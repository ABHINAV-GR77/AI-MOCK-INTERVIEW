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
from app.models import StartInterviewRequest, AnswerRequest, EndInterviewRequest
from app.routes.auth import get_current_user

router = APIRouter()
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
        raise

QUESTIONS_PER_SESSION = 5


# ── RAG: Pick questions directly from ChromaDB ─────────

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


@router.get("/interview/{interview_type}", response_class=HTMLResponse)
async def interview_page(request: Request, interview_type: str):
    if interview_type in ("voice", "results"):
        return RedirectResponse(url="/dashboard", status_code=302)
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("interview.html", {
        "request": request,
        "interview_type": interview_type,
        "user": user,
    })


@router.get("/interview/results/{session_id}", response_class=HTMLResponse)
async def results_page(request: Request, session_id: str):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("results.html", {
        "request": request,
        "session_id": session_id,
        "user": user,
    })


# ── API ───────────────────────────────────────────────

@router.post("/interview/start")
async def interview_start(request: Request, data: StartInterviewRequest):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    try:
        # Pull all 5 questions upfront directly from ChromaDB
        questions = pick_questions(data.interview_type, data.difficulty, n=QUESTIONS_PER_SESSION, role=data.role or "")

        if not questions:
            return JSONResponse({"error": "No questions found in database. Please run seed_data.py."}, status_code=500)

        session_id = str(uuid.uuid4())
        await sessions_col.insert_one({
            "session_id": session_id,
            "user_email": user,
            "interview_type": data.interview_type,
            "difficulty": data.difficulty,
            "role": data.role or "",
            "score": None,
            "date": datetime.utcnow().isoformat(),
            "duration_minutes": 0,
            "mode": "text",
            "answers": [],
            # Store all 5 questions upfront — no LLM generation needed
            "question_queue": questions,
        })

        return {
            "session_id": session_id,
            "question": questions[0],
            "question_number": 1,
            "total_questions": QUESTIONS_PER_SESSION,
        }
    except Exception as e:
        print(f"[START ERROR] {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/interview/answer")
async def interview_answer(request: Request, data: AnswerRequest):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    session = await sessions_col.find_one({"session_id": data.session_id, "user_email": user})
    if not session:
        return JSONResponse({"error": "session not found"}, status_code=404)

    # Score the answer via Groq (still used for evaluation)
    score_raw = groq_chat([
        {"role": "system", "content": 'You are an interview evaluator. Score 0-100 and give brief feedback. Respond ONLY as JSON: {"score": <int>, "feedback": "<2-3 sentences>"}'},
        {"role": "user", "content": f"Question: {data.question}\nAnswer: {data.answer}"}
    ], max_tokens=200)

    try:
        score_data = json.loads(score_raw.replace("```json", "").replace("```", "").strip())
    except Exception:
        score_data = {"score": 50, "feedback": "Could not parse score."}

    answer_doc = {
        "question": data.question,
        "answer": data.answer,
        "score": score_data.get("score", 50),
        "feedback": score_data.get("feedback", ""),
        "skipped": data.answer == "[Skipped]",
    }
    await sessions_col.update_one(
        {"session_id": data.session_id},
        {"$push": {"answers": answer_doc}}
    )

    next_num = data.question_number + 1
    if next_num > QUESTIONS_PER_SESSION:
        return {"done": True, "score": score_data.get("score"), "feedback": score_data.get("feedback")}

    # Serve next question from the pre-fetched queue (0-based index)
    queue = session.get("question_queue", [])
    if next_num - 1 < len(queue):
        next_q = queue[next_num - 1]
    else:
        # Safety fallback: fetch fresh one excluding already asked
        asked = [a["question"] for a in session.get("answers", [])] + [data.question]
        fresh = pick_questions(session["interview_type"], session["difficulty"], n=1, exclude=asked)
        next_q = fresh[0] if fresh else "Tell me about a challenging problem you solved recently."

    return {
        "done": False,
        "question": next_q,
        "question_number": next_num,
        "score": score_data.get("score"),
        "feedback": score_data.get("feedback"),
    }


@router.post("/interview/end")
async def interview_end(request: Request, data: EndInterviewRequest):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    session = await sessions_col.find_one({"session_id": data.session_id, "user_email": user})
    if not session:
        return JSONResponse({"error": "not found"}, status_code=404)

    answers = session.get("answers", [])
    scores  = [a["score"] for a in answers if a.get("score") is not None and not a.get("skipped")]
    avg     = round(sum(scores) / len(scores)) if scores else 0

    await sessions_col.update_one(
        {"session_id": data.session_id},
        {"$set": {"score": avg, "duration_minutes": data.duration_minutes}}
    )

    return {"status": "ok", "session_id": data.session_id, "score": avg}


@router.get("/interview/results-data/{session_id}")
async def results_data(request: Request, session_id: str):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    session = await sessions_col.find_one(
        {"session_id": session_id, "user_email": user},
        {"_id": 0, "question_queue": 0}  # hide internal queue from response
    )
    if not session:
        return JSONResponse({"error": "not found"}, status_code=404)

    return session