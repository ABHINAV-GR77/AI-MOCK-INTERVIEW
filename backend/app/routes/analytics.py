import os
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.database import sessions_col, get_chroma
from app.models import AICoachRequest
from app.paths import FRONTEND_PAGES_DIR
from app.routes.auth import get_current_user
try:
    from app.utils import groq_chat
except ImportError:
    # Fallback if utils.py not yet placed
    import os
    from groq import Groq as _Groq
    _groq_client = _Groq(api_key=os.getenv("GROQ_API_KEY"))
    def groq_chat(messages, max_tokens=600):
        resp = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()

router = APIRouter()
templates = Jinja2Templates(directory=str(FRONTEND_PAGES_DIR))


@router.get("/analytics", response_class=HTMLResponse)
async def analytics_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("analytics.html", {"request": request, "user": user})


@router.get("/analytics/data")
async def analytics_data(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    cursor   = sessions_col.find({"user_email": user}, {"_id": 0})
    sessions = await cursor.to_list(length=500)
    sessions.sort(key=lambda s: s.get("date", ""), reverse=True)

    score_trend = [
        {"date": s["date"][:10], "score": s["score"], "type": s.get("interview_type")}
        for s in sessions if s.get("score") is not None
    ]

    type_stats: dict = {}
    for s in sessions:
        t = s.get("interview_type", "unknown")
        if t not in type_stats:
            type_stats[t] = {"scores": [], "count": 0, "total_filler": 0, "total_stutter": 0}
        type_stats[t]["count"] += 1
        if s.get("score") is not None:
            type_stats[t]["scores"].append(s["score"])
        type_stats[t]["total_filler"]  += s.get("total_filler_words", 0)
        type_stats[t]["total_stutter"] += s.get("total_stutters", 0)

    breakdown = {
        t: {
            "avg_score":     round(sum(d["scores"]) / len(d["scores"])) if d["scores"] else 0,
            "count":         d["count"],
            "total_filler":  d["total_filler"],
            "total_stutter": d["total_stutter"],
        }
        for t, d in type_stats.items()
    }

    return {
        "total_sessions": len(sessions),
        "score_trend":    score_trend[-30:],
        "breakdown":      breakdown,
        "recent":         sessions[:50],
    }


@router.post("/analytics/ai-coach")
async def ai_coach(request: Request, payload: AICoachRequest):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    context = ""
    try:
        col     = get_chroma()
        results = col.query(
            query_texts=[f"ideal {payload.interview_type} interview answer techniques"],
            n_results=4,
        )
        docs    = results.get("documents", [[]])[0]
        context = "\n".join(docs)
    except Exception:
        pass

    answers_summary = "\n".join([
        f"Q: {a.get('question','')}\nA: {a.get('answer','')}\nScore: {a.get('score','')} — {a.get('feedback','')}"
        for a in payload.answers[:5]
    ])

    context_line = f"Context — ideal interview answers:\n{context}" if context else ""
    system = f"""You are an expert interview coach. Analyze the candidate's performance and give specific, actionable feedback.
{context_line}
Filler words / stutters total: {payload.stutter_count}
Focus on: what they did well, key weaknesses, and 3 concrete tips to improve."""

    coaching = groq_chat([
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Here are the interview answers:\n{answers_summary}\n\nProvide detailed coaching feedback."}
    ])

    return {"feedback": coaching}


@router.post("/coaching/session")
async def coaching_session(request: Request):
    """Per-session AI coaching called from Analytics AI Coach tab."""
    import json as _json
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    body           = await request.json()
    session_id     = body.get("session_id", "")
    interview_type = body.get("interview_type", "technical").replace("voice_", "")
    mode           = body.get("mode", "text")
    is_voice       = mode == "voice"

    session = await sessions_col.find_one(
        {"session_id": session_id, "user_email": user},
        {"_id": 0, "question_queue": 0}
    )
    if not session:
        return JSONResponse({"error": "session not found"}, status_code=404)

    answers   = session.get("answers", [])
    answered  = [a for a in answers if not a.get("skipped") and a.get("answer") not in (None, "", "[Skipped]")]
    avg_score = session.get("score", 0) or 0

    if not answered:
        return {
            "session_id":      session_id,
            "interview_type":  interview_type,
            "is_voice":        is_voice,
            "avg_score":       avg_score,
            "overall_summary": "No answered questions found. Complete an interview without skipping to get coaching.",
            "answers":         [dict(a, content_gaps=None, rewrite=None, ideal_answer=None, speaking_tip=None) for a in answers],
        }

    # Per-question coaching - one call per question for reliability
    coached_answers = []
    for a in answers:
        if a.get("skipped") or not a.get("answer") or a.get("answer") in ("", "[Skipped]"):
            coached_answers.append(dict(a, content_gaps=None, rewrite=None, ideal_answer=None, speaking_tip=None))
            continue

        filler_line = ""
        if is_voice:
            filler_line = "Filler words: " + str(a.get("filler_count", 0)) + " | Stutters: " + str(a.get("stutter_count", 0))

        tip_field = '"speaking_tip": "one specific tip on pace and delivery"' if is_voice else '"speaking_tip": ""'

        prompt_lines = [
            "You are an expert " + interview_type + " interview coach. Respond ONLY as valid JSON.",
            "",
            "Question: " + a["question"],
            "Candidate Answer: " + a["answer"],
            "Score: " + str(a.get("score", "?")) + "/100",
        ]
        if filler_line:
            prompt_lines.append(filler_line)
        prompt_lines += [
            "",
            "Return ONLY this JSON object (no markdown, no extra text):",
            '{',
            '  "content_gaps": "2-3 sentences on what key points were missing",',
            '  "rewrite": "A better version in first person natural spoken style, 3-5 sentences.",',
            '  "ideal_answer": "A model answer using the right framework for this question, 4-6 sentences.",',
            "  " + tip_field,
            '}',
        ]
        prompt = "\n".join(prompt_lines)

        raw = groq_chat([
            {"role": "system", "content": "You are a strict JSON-only interview coach. Output only valid JSON."},
            {"role": "user",   "content": prompt}
        ], max_tokens=500)

        try:
            c = _json.loads(raw.replace("```json", "").replace("```", "").strip())
        except Exception:
            c = {"content_gaps": "Analysis unavailable.", "rewrite": None, "ideal_answer": None, "speaking_tip": None}

        coached_answers.append(dict(a,
            content_gaps  = c.get("content_gaps"),
            rewrite       = c.get("rewrite"),
            ideal_answer  = c.get("ideal_answer"),
            speaking_tip  = c.get("speaking_tip") if is_voice else None,
        ))

    # Overall summary
    weak_count = sum(1 for a in answered if (a.get("score") or 0) < 65)
    voice_extra = "Also give specific speaking delivery tips (fillers, pace, confidence). " if is_voice else ""
    overall_lines = [
        "You are an expert " + interview_type + " interview coach.",
        "Mode: " + ("Voice" if is_voice else "Text") + " | Avg score: " + str(avg_score) + "/100 | Weak answers (<65): " + str(weak_count) + "/" + str(len(answered)),
        "",
        "Write a 3-paragraph coaching summary:",
        "1. Honest assessment of overall performance (2-3 sentences)",
        "2. Top 2-3 specific weaknesses with concrete fixes",
        "3. " + voice_extra + "3 action items for next interview",
        "",
        "Be direct, specific, and encouraging. Paragraphs only, no bullet points.",
    ]
    try:
        overall_summary = groq_chat([
            {"role": "system", "content": "You are a direct expert interview coach. Write in paragraphs only."},
            {"role": "user",   "content": "\n".join(overall_lines)}
        ], max_tokens=500)
    except Exception:
        overall_summary = "You scored " + str(avg_score) + "% on your " + interview_type + " interview. Review each question below for coaching."

    return {
        "session_id":      session_id,
        "interview_type":  interview_type,
        "is_voice":        is_voice,
        "avg_score":       avg_score,
        "overall_summary": overall_summary,
        "answers":         coached_answers,
    }
