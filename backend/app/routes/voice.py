import os
import uuid
import json
import random
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from groq import Groq

from app.database import sessions_col, get_chroma
from app.models import VoiceResultsPayload
from app.routes.auth import get_current_user

router = APIRouter()
QUESTIONS_PER_SESSION = 5
templates = Jinja2Templates(directory="/app/backend/frontend/pages")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def groq_chat(messages: list, max_tokens: int = 600) -> str:
    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[GROQ ERROR] {e}")
        return '{"score": 50, "feedback": "Could not evaluate answer due to a server error."}'


def pick_questions(interview_type: str, difficulty: str, n: int = QUESTIONS_PER_SESSION, exclude: list = [], role: str = "") -> list:
    """
    Fetch questions from ChromaDB using metadata filters (no embedding needed).
    - If role is set: filter by role (non-CS fields)
    - Otherwise: filter by type (CS fields)
    """
    try:
        col = get_chroma()
        diff = difficulty.lower().strip()
        if diff not in ("easy", "medium", "hard"):
            diff = "medium"

        if col.count() == 0:
            print("[CHROMA] Collection is empty.")
            return []

        fetch_n = min(n + len(exclude) + 50, 500)

        if role:
            chroma_type = role.lower().strip()
        else:
            TYPE_MAP = {
                "technical":     "technical",
                "system_design": "system_design",
                "behavioral":    "behavioral",
                "situational":   "behavioral",
                "product_sense": "product_manager",
            }
            chroma_type = TYPE_MAP.get(interview_type.lower().strip(), interview_type.lower().strip())

        # Use get() with where filter — no embeddings needed
        results = col.get(
            where={"$and": [{"type": {"$eq": chroma_type}}, {"difficulty": {"$eq": diff}}]},
            limit=fetch_n,
        )
        docs = results.get("documents", [])

        # Fallback: try without difficulty filter
        if len(docs) < n:
            results = col.get(
                where={"type": {"$eq": chroma_type}},
                limit=fetch_n,
            )
            docs = results.get("documents", [])

        exclude_set = set(exclude)
        candidates = [d for d in docs if d not in exclude_set]
        random.shuffle(candidates)
        return candidates[:n]

    except Exception as e:
        print(f"[CHROMA ERROR] {e}")
        import traceback; traceback.print_exc()
        return []


@router.get("/interview/voice", response_class=HTMLResponse)
async def voice_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("voice.html", {"request": request, "user": user})


# ── API ───────────────────────────────────────────────

@router.post("/interview/voice/questions")
async def voice_questions(request: Request):
    """Return 5 real questions pulled directly from ChromaDB."""
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    body = await request.json()
    interview_type = body.get("interview_type", "technical")
    difficulty = body.get("difficulty", "medium")

    role = body.get("role", "")
    questions = pick_questions(interview_type, difficulty, n=5, role=role)

    if not questions:
        return JSONResponse(
            {"error": "No questions found in database. Please run seed_data.py."},
            status_code=500
        )

    return {"questions": questions, "interview_type": interview_type}


@router.post("/interview/voice/upload-audio")
async def upload_audio(request: Request):
    """Upload raw audio to AssemblyAI and return upload URL."""
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
    if not api_key:
        return JSONResponse({"error": "AssemblyAI key not configured"}, status_code=500)

    import httpx
    audio_data = await request.body()

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.assemblyai.com/v2/upload",
            headers={"authorization": api_key, "content-type": "application/octet-stream"},
            content=audio_data,
            timeout=60,
        )
    if res.status_code != 200:
        return JSONResponse({"error": "Upload failed", "detail": res.text}, status_code=500)

    return {"upload_url": res.json()["upload_url"]}


@router.post("/interview/voice/transcribe")
async def transcribe_audio(request: Request):
    """Submit audio URL to AssemblyAI and poll until transcript is ready."""
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
    body = await request.json()
    audio_url = body.get("audio_url")

    import httpx, asyncio
    async with httpx.AsyncClient() as client:
        # Submit transcription request with disfluencies enabled
        res = await client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers={"authorization": api_key, "content-type": "application/json"},
            json={"audio_url": audio_url, "disfluencies": True},
            timeout=30,
        )
        if res.status_code != 200:
            return JSONResponse({"error": "Transcription submit failed"}, status_code=500)

        transcript_id = res.json()["id"]

        # Poll until complete (max 60s)
        for _ in range(30):
            await asyncio.sleep(2)
            poll = await client.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers={"authorization": api_key},
                timeout=30,
            )
            result = poll.json()
            print(f"[ASSEMBLYAI] status={result.get('status')} text={repr(result.get('text','')[:80])}", flush=True)
            if result["status"] == "completed":
                return {"text": result["text"], "status": "completed"}
            elif result["status"] == "error":
                return JSONResponse({"error": result.get("error")}, status_code=500)

    return JSONResponse({"error": "Transcription timed out"}, status_code=504)


@router.post("/interview/voice-results")
async def voice_results(request: Request, payload: VoiceResultsPayload):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    scored_answers = []
    total_score = 0
    total_filler = 0
    total_stutter = 0

    print(f"[VOICE] Received {len(payload.answers)} answers from {user}")
    for i, a in enumerate(payload.answers):
        print(f"[VOICE] Q{i+1}: skipped={a.skipped} answer_len={len(a.answer)} answer_preview={repr(a.answer[:80])}")

    for ans in payload.answers:
        if ans.skipped:
            scored_answers.append({
                "question": ans.question,
                "answer": ans.answer,
                "score": 0,
                "feedback": "Skipped",
                "skipped": True,
                "filler_count": 0,
                "stutter_count": 0,
            })
            continue

        # Python-side stutter detection (catches what Chrome didn't strip)
        def count_stutters_py(text):
            words = text.lower().split()
            count = 0
            for i in range(1, len(words)):
                w1 = ''.join(c for c in words[i-1] if c.isalpha())
                w2 = ''.join(c for c in words[i]   if c.isalpha())
                if w1 and w2 and w1 == w2:  # repeated word: "the the", "I I"
                    count += 1
            return count

        py_stutters = count_stutters_py(ans.answer)

        # Let Groq analyze the raw transcript for score, feedback, fillers and stutters
        raw = groq_chat([
            {"role": "system", "content": (
                'You are an interview evaluator analyzing a SPEECH-TO-TEXT transcript. '
                'Important: speech recognition strips out sounds like "uh", "um", "uhh" — so you cannot rely on seeing them. '
                'Instead, detect stutters and hesitations from these signals in the transcript: '
                '1) Repeated consecutive words: "I I think", "the the problem", "was was going" '
                '2) Incomplete or cut-off words followed by correction: "I wa- was", "it re- returns" '
                '3) Sentences that restart mid-way: "so the- so the function" '
                '4) Unusual gaps shown as broken phrasing '
                'For filler words, detect: like, basically, literally, actually, you know, i mean, kind of, sort of, right, okay, so, well, anyway '
                'Be generous — if the transcript looks choppy or has repetitions, count them. '
                'Respond ONLY as JSON with no extra text: '
                '{"score": <int 0-100>, "feedback": "<2-3 sentences on content AND communication clarity>", '
                '"filler_count": <int>, "stutter_count": <int>, '
                '"filler_words": ["list","of","fillers","found"]}'
            )},
            {"role": "user", "content": f"Question: {ans.question}\nSpoken transcript: {ans.answer}"}
        ], max_tokens=300)

        print(f"[GROQ RAW RESPONSE] {raw}", flush=True)
        try:
            scored = json.loads(raw.replace("```json", "").replace("```", "").strip())
        except Exception:
            scored = {"score": 50, "feedback": "Could not evaluate answer.", "filler_count": 0, "stutter_count": 0, "filler_words": []}
        print(f"[GROQ PARSED] filler={scored.get('filler_count')} stutter={scored.get('stutter_count')} words={scored.get('filler_words')}", flush=True)

        score         = scored.get("score", 50)
        filler_count  = scored.get("filler_count", 0)
        # Combine Groq's detected stutters + Python's word-repetition count
        stutter_count = max(scored.get("stutter_count", 0), py_stutters)
        total_score   += score
        total_filler  += filler_count
        total_stutter += stutter_count
        print(f"[STUTTER] groq={scored.get('stutter_count',0)} py={py_stutters} final={stutter_count}", flush=True)

        scored_answers.append({
            "question":      ans.question,
            "answer":        ans.answer,
            "score":         score,
            "feedback":      scored.get("feedback", ""),
            "skipped":       False,
            "filler_count":  filler_count,
            "stutter_count": stutter_count,
            "filler_words":  scored.get("filler_words", []),
        })

    answered = [a for a in scored_answers if not a["skipped"]]
    avg_score = round(total_score / len(answered)) if answered else 0

    session_id = str(uuid.uuid4())
    await sessions_col.insert_one({
        "session_id": session_id,
        "user_email": user,
        "interview_type": f"voice_{payload.interview_type}",
        "role": getattr(payload, "role", ""),
        "difficulty": payload.difficulty if hasattr(payload, "difficulty") else "medium",
        "score": avg_score,
        "date": datetime.utcnow().isoformat(),
        "duration_minutes": round(payload.total_duration / 60) if payload.total_duration else 0,
        "mode": "voice",
        "role": getattr(payload, "role", ""),
        "role_label": getattr(payload, "role_label", "") or payload.interview_type.replace("_"," ").title(),
        "answers": scored_answers,
        "total_filler_words": total_filler,
        "total_stutters": total_stutter,
    })

    return {
        "session_id": session_id,
        "score": avg_score,
        "answers": scored_answers,
        "total_filler_words": total_filler,
        "total_stutters": total_stutter,
    }