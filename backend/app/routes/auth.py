import os
import uuid
import random
import bcrypt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.database import users_col, redis_client
from app.models import UserRegister, UserLogin, ForgotPassword, ResetPassword
from app.paths import FRONTEND_PAGES_DIR

router = APIRouter()
templates = Jinja2Templates(directory=str(FRONTEND_PAGES_DIR))

SESSION_TTL = 60 * 60 * 3  # 3 hours
OTP_TTL     = 60 * 10   # 10 min


# ── Helpers ───────────────────────────────────────────

async def get_current_user(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    return await redis_client.get(f"session:{session_id}")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def send_otp_email(to_email: str, otp: str):
    """Send OTP via Gmail SMTP. Falls back to console log if not configured."""
    mail_user = os.getenv("MAIL_USERNAME", "")
    mail_pass = os.getenv("MAIL_PASSWORD", "")

    if not mail_user or not mail_pass:
        print(f"[DEV] OTP for {to_email}: {otp}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "InterviewAI — Your Password Reset OTP"
        msg["From"]    = f"InterviewAI <{mail_user}>"
        msg["To"]      = to_email

        html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
<tr><td align="center">
<table width="460" cellpadding="0" cellspacing="0" style="max-width:460px;background:#0d1117;border-radius:20px;overflow:hidden;border:1px solid #1a2235;">

  <!-- Header -->
  <tr>
    <td align="center" style="background:linear-gradient(180deg,#0d2137 0%,#0a1628 100%);padding:32px 32px 24px;border-bottom:1px solid #1a2235;">
      <p style="font-size:24px;font-weight:700;color:#00e5ff;margin:0 0 6px 0;letter-spacing:0.5px;">InterviewAI</p>
      <p style="font-size:11px;color:#4a6080;margin:0;letter-spacing:3px;text-transform:uppercase;">Password Reset OTP</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      <p style="font-size:16px;font-weight:700;color:#e2e8f0;text-align:center;margin:0 0 8px 0;">Your OTP Code</p>
      <p style="font-size:13px;color:#6b7280;text-align:center;margin:0 0 28px 0;">
        Use this code to reset your password for<br/>
        <a href="mailto:{to_email}" style="color:#00e5ff;text-decoration:none;">{to_email}</a>.
        Expires in <strong style="color:#00e5ff;">10 minutes</strong>.
      </p>

      <!-- OTP box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td align="center" style="background:#080c14;border:1.5px solid #00e5ff;border-radius:14px;padding:24px 20px;">
            <p style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:700;letter-spacing:18px;color:#00e5ff;margin:0;text-shadow:0 0 20px rgba(0,229,255,0.4);">{otp}</p>
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#0a0f1a;border-radius:10px;border:1px solid #1a2235;padding:12px 16px;">
            <p style="font-size:12px;color:#6b7280;margin:0;text-align:center;">🔒 Never share this OTP. If you didn't request this, ignore this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 32px;border-top:1px solid #1a2235;">
      <p style="font-size:10px;color:#2d3748;text-align:center;margin:0;letter-spacing:2px;text-transform:uppercase;">© 2026 InterviewAI · AI-Powered Mock Interviews</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>"""
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(mail_user, mail_pass)
            server.sendmail(mail_user, to_email, msg.as_string())

        print(f"[EMAIL] OTP sent to {to_email}")
    except Exception as e:
        print(f"[EMAIL ERROR] {e} — OTP for {to_email}: {otp}")


# ── Pages ─────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    user = await get_current_user(request)
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("landing.html", {"request": request})

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    user = await get_current_user(request)
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@router.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password_page(request: Request):
    return templates.TemplateResponse("forgot-password.html", {"request": request})

@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    return templates.TemplateResponse("reset-password.html", {"request": request})


# ── API ───────────────────────────────────────────────

@router.post("/register")
async def register(data: UserRegister):
    if not data.email or "@" not in data.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await users_col.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    await users_col.insert_one({
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name or "",
        "bio": "",
        "target_role": "",
        "created_at": datetime.utcnow().isoformat(),
    })
    return {"status": "ok", "message": "Account created"}


@router.post("/login")
async def login(data: UserLogin, response: Response):
    user = await users_col.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_id = str(uuid.uuid4())
    await redis_client.setex(f"session:{session_id}", SESSION_TTL, data.email)

    response = JSONResponse({"status": "ok", "redirect": "/dashboard"})
    response.set_cookie(key="session_id", value=session_id, httponly=True, max_age=SESSION_TTL, samesite="lax")
    return response


@router.get("/logout")
async def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        await redis_client.delete(f"session:{session_id}")
    resp = RedirectResponse(url="/", status_code=302)
    resp.delete_cookie("session_id")
    return resp


@router.post("/forgot-password")
async def forgot_password(data: ForgotPassword):
    user = await users_col.find_one({"email": data.email})
    if not user:
        # Return success regardless — don't reveal if email exists
        return {"status": "ok", "message": "If this email is registered, an OTP has been sent."}

    otp = str(random.randint(100000, 999999))
    await redis_client.setex(f"otp:{data.email}", OTP_TTL, otp)

    send_otp_email(data.email, otp)
    return {"status": "ok", "message": "OTP sent"}


@router.post("/reset-password")
async def reset_password(data: ResetPassword):
    stored_otp = await redis_client.get(f"otp:{data.email}")
    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    if stored_otp != data.token:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    await users_col.update_one({"email": data.email}, {"$set": {"password": hash_password(data.new_password)}})
    await redis_client.delete(f"otp:{data.email}")
    return {"status": "ok", "message": "Password updated"}
