from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.database import sessions_col, users_col, db
feedback_col = db['feedback']
from app.models import UpdateProfile
from app.paths import FRONTEND_PAGES_DIR
from app.routes.auth import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory=str(FRONTEND_PAGES_DIR))


@router.get("/study-guide", response_class=HTMLResponse)
async def study_guide(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("study-guide.html", {"request": request, "user": user})


@router.get("/tips", response_class=HTMLResponse)
async def tips(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("tips.html", {"request": request, "user": user})


@router.get("/leaderboard", response_class=HTMLResponse)
async def leaderboard(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("leaderboard.html", {"request": request, "user": user})


@router.get("/leaderboard/data")
async def leaderboard_data(request: Request):
    """Top 20 users by average score."""
    cursor = sessions_col.aggregate([
        {"$match": {"score": {"$ne": None}}},
        {"$group": {
            "_id": "$user_email",
            "avg_score": {"$avg": "$score"},
            "total_sessions": {"$sum": 1}
        }},
        {"$sort": {"avg_score": -1}},
        {"$limit": 20},
    ])
    rows = await cursor.to_list(length=20)
    return [
        {
            "email": r["_id"],
            "display": r["_id"].split("@")[0],
            "avg_score": round(r["avg_score"]),
            "total_sessions": r["total_sessions"],
        }
        for r in rows
    ]


@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("profile.html", {"request": request, "user": user})


@router.get("/profile/data")
async def profile_data(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    doc = await users_col.find_one({"email": user}, {"_id": 0, "password": 0})
    if not doc:
        return JSONResponse({"error": "not found"}, status_code=404)
    return doc


@router.post("/profile/update")
async def profile_update(request: Request, data: UpdateProfile):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    update = {k: v for k, v in data.dict().items() if v is not None}
    await users_col.update_one({"email": user}, {"$set": update})
    return {"status": "ok"}


@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("settings.html", {"request": request, "user": user})


@router.post("/settings/clear-history")
async def clear_history(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    result = await sessions_col.delete_many({"user_email": user})
    return {"status": "ok", "deleted": result.deleted_count}

import json as _json
import os as _os
from groq import Groq as _Groq
_groq_client = _Groq(api_key=_os.getenv("GROQ_API_KEY"))

def _groq_chat(messages, max_tokens=800):
    resp = _groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


@router.post("/ai-chat/message")
async def ai_chat_message(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    body    = await request.json()
    history = body.get("history", [])
    message = body.get("message", "").strip()
    if not message:
        return JSONResponse({"error": "empty message"}, status_code=400)

    SYSTEM = """You are InterviewAI Coach — a sharp, friendly interview expert. Help users with:
1. Explaining interview concepts (technical, behavioral, system design, product sense)
2. Reviewing and improving their answers — always give a concrete rewrite
3. Providing ideal example answers for any interview question
4. Quizzing them — ask a question and evaluate their response

Rules:
- Be concise but thorough. Use short paragraphs, not walls of text.
- Use STAR format for behavioral answers, proper frameworks for technical/system design.
- When reviewing an answer, always end with a rewritten version.
- If the question is not interview-related, gently redirect back to interview prep.
- Use markdown formatting (bold, bullets, code blocks) — it will be rendered."""

    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        reply = _groq_chat(messages, max_tokens=800)
        return {"reply": reply}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/feedback")
async def submit_feedback(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    body = await request.json()
    await feedback_col.insert_one({
        "user_email": user,
        "type":       body.get("type", "General"),
        "rating":     body.get("rating", 0),
        "message":    body.get("message", ""),
        "date":       __import__('datetime').datetime.utcnow().isoformat(),
    })
    return {"status": "ok"}
