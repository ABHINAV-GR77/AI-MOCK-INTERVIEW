from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str          # 6-digit OTP
    new_password: str
    email: EmailStr


# ── Interview ─────────────────────────────────────────
class InterviewAnswer(BaseModel):
    question: str
    answer: str
    score: Optional[int] = None
    feedback: Optional[str] = None
    skipped: bool = False

class InterviewSession(BaseModel):
    session_id: str
    user_email: str
    interview_type: str           # technical | behavioral | system_design | product_sense
    difficulty: str               # easy | medium | hard
    score: Optional[int] = None
    date: datetime
    duration_minutes: Optional[int] = 0
    mode: str = "text"            # text | voice
    answers: List[InterviewAnswer] = []

class StartInterviewRequest(BaseModel):
    interview_type: str
    difficulty: str
    role: str = ""  # optional role for targeted questions

class AnswerRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    question_number: int

class EndInterviewRequest(BaseModel):
    session_id: str
    answers: List[InterviewAnswer]
    duration_minutes: Optional[int] = 0


# ── Voice ─────────────────────────────────────────────
class VoiceAnswer(BaseModel):
    question: str
    answer: str
    score: Optional[int] = None
    feedback: Optional[str] = None
    skipped: bool = False
    filler_count: Optional[int] = 0
    stutter_count: Optional[int] = 0

class VoiceResultsPayload(BaseModel):
    interview_type: str
    difficulty: Optional[str] = "medium"
    answers: List[VoiceAnswer]
    total_duration: Optional[int] = 0


# ── Analytics ─────────────────────────────────────────
class AICoachRequest(BaseModel):
    answers: list
    interview_type: str
    stutter_count: Optional[int] = 0


# ── Settings ──────────────────────────────────────────
class UpdateProfile(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    target_role: Optional[str] = None

# ── Coaching ───────────────────────────────────────────
class CoachingRequest(BaseModel):
    session_id: str
    interview_type: str
    mode: str = "text"   # text | voice