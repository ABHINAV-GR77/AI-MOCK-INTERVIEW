from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta

from app.database import sessions_col, redis_client
from app.routes.auth import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="/app/backend/frontend/pages")


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user})


@router.get("/practice", response_class=HTMLResponse)
async def practice_page(request: Request):
    user = await get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("practice.html", {"request": request, "user": user})


@router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Fetch all sessions for this user
    cursor = sessions_col.find({"user_email": user})
    sessions = await cursor.to_list(length=500)

    total_sessions = len(sessions)
    scores = [s["score"] for s in sessions if s.get("score") is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else 0

    # Streak — count consecutive days with at least one session
    today = datetime.utcnow().date()
    session_dates = set()
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["date"]).date()
            session_dates.add(d)
        except Exception:
            pass

    streak = 0
    check = today
    while check in session_dates:
        streak += 1
        check -= timedelta(days=1)

    # Skill breakdown by interview type
    type_map = {
        "technical": [], "behavioral": [],
        "system_design": [], "product_sense": []
    }
    for s in sessions:
        itype = s.get("interview_type", "").replace("voice_", "")
        if itype in type_map and s.get("score") is not None:
            type_map[itype].append(s["score"])

    skill_progress = {
        k: round(sum(v) / len(v)) if v else 0
        for k, v in type_map.items()
    }

    # Recent 50 sessions (enough for charts)
    recent = sorted(sessions, key=lambda s: s.get("date", ""), reverse=True)[:50]
    recent_sessions = [
        {
            "session_id": s.get("session_id"),
            "interview_type": s.get("interview_type"),
            "score": s.get("score"),
            "date": s.get("date"),
            "mode": s.get("mode", "text"),
            "duration_minutes": s.get("duration_minutes", 0),
        }
        for s in recent
    ]

    practice_hours = round(sum(s.get("duration_minutes", 0) for s in sessions) / 60, 1)

    return {
        "email": user,
        "total_sessions": total_sessions,
        "avg_score": avg_score,
        "streak": streak,
        "practice_hours": practice_hours,
        "skill_progress": skill_progress,
        "recent_sessions": recent_sessions,
    }