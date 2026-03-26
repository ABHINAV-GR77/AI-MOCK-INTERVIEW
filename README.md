# InterviewAI 🤖

An AI-powered mock interview platform with text and voice interview modes, real-time scoring, analytics, and personalized coaching.

---

## 🗂 Project Structure

```
ai-mock-interview/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── database.py          # MongoDB + ChromaDB connections
│   │   ├── models.py            # Pydantic data models
│   │   └── routes/
│   │       ├── auth.py          # Login, register, forgot/reset password
│   │       ├── dashboard.py     # Dashboard stats API
│   │       ├── interview.py     # Text interview routes
│   │       ├── voice.py         # Voice interview routes
│   │       ├── analytics.py     # Analytics + AI coach
│   │       └── misc.py          # Profile, settings, tips, leaderboard
│   ├── data/                    # CSV question files (16 roles)
│   │   ├── software_engineer.csv
│   │   ├── system_design.csv
│   │   ├── behavioral.csv
│   │   ├── product_manager.csv
│   │   ├── data_engineer.csv
│   │   ├── ml_engineer.csv
│   │   ├── devops_engineer.csv
│   │   ├── financial_analyst.csv
│   │   ├── accountant.csv
│   │   ├── digital_marketing.csv
│   │   ├── content_writer.csv
│   │   ├── hr_manager.csv
│   │   ├── ux_designer.csv
│   │   ├── business_analyst.csv
│   │   ├── project_manager.csv
│   │   └── management_consultant.csv
│   ├── seed_data.py             # Seeds ChromaDB from CSV files
│   └── requirements.txt
├── frontend/
│   ├── pages/                   # HTML pages (served by FastAPI)
│   │   ├── landing.html         # Public landing page
│   │   ├── index.html           # Login page
│   │   ├── register.html        # Registration page
│   │   ├── forgot-password.html # Forgot password
│   │   ├── reset-password.html  # Reset password (OTP)
│   │   ├── dashboard.html       # Main dashboard
│   │   ├── practice.html        # Text interview setup
│   │   ├── interview.html       # Text interview session
│   │   ├── voice.html           # Voice interview setup + session
│   │   ├── results.html         # Interview results
│   │   ├── analytics.html       # Analytics + AI coach
│   │   ├── leaderboard.html     # Leaderboard
│   │   ├── profile.html         # User profile
│   │   ├── settings.html        # Settings
│   │   ├── tips.html            # Interview tips
│   │   └── study-guide.html     # AI chat coach
│   └── static/
│       ├── css/
│       │   └── style.css        # Auth pages CSS
│       └── js/
│           ├── script.js        # Global auth + utilities
│           ├── interview.js     # Text interview logic
│           ├── voice.js         # Voice interview logic
│           ├── analytics.js     # Analytics charts + AI coach
│           ├── leaderboard.js   # Leaderboard rendering
│           ├── results.js       # Results page logic
│           └── anticheat.js     # Anti-cheat detection
├── docker-compose.yml
└── .env
```

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Database | MongoDB (user data, sessions) |
| Vector DB | ChromaDB (RAG question retrieval) |
| AI / LLM | Groq API (llama-3.3-70b-versatile) |
| Frontend | HTML + Tailwind CSS + Vanilla JS |
| Voice | Web Speech API (live transcript) + AssemblyAI |
| Containers | Docker + Docker Compose |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DB=interviewai
CHROMA_HOST=chromadb
CHROMA_PORT=8000
SECRET_KEY=your_secret_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

---

## 🐳 Docker Setup

### Start all services
```powershell
docker compose up -d
```

### Stop all services
```powershell
docker compose down
```

### Restart backend only
```powershell
docker compose restart backend
```

### View logs
```powershell
docker compose logs -f backend
docker compose logs -f chromadb
```

---

## 🌱 Seeding ChromaDB (Question Bank)

After first run or when adding new CSV files:

```powershell
docker exec backend python /app/backend/seed_data.py --reset
```

Expected output:
```
✅ Seeding complete!
   Files processed : 16
   Questions loaded: 2952
   ChromaDB total  : 2952
```

---

## 🗄️ MongoDB Shell

```powershell
docker exec -it mongodb mongosh "mongodb://localhost:27017/interviewai"
```

Useful commands:
```js
show collections        // users, sessions
db.users.find().pretty()
db.sessions.find().pretty()
db.users.countDocuments()
db.sessions.countDocuments()
// Delete a user
db.users.deleteOne({ email: "test@example.com" })
// Clear all sessions
db.sessions.deleteMany({})
```

---

## 🎤 Features

### Text Interview
- 4 interview types: Technical, Behavioral, System Design, Product Sense
- 3 difficulty levels: Easy, Medium, Hard
- 35 role options across 7 categories
- AI scoring + feedback per question (Groq LLM)
- Anti-cheat detection

### Voice Interview
- Same types, difficulties, and roles as text
- Live speech-to-text transcript (Web Speech API)
- Filler word detection (um, uh, like, you know)
- Stutter/repeat detection
- AI scoring on transcribed answers

### Analytics
- Score trend chart over time
- Breakdown by interview type
- AI Coach — personalized improvement tips
- Per-session deep coaching (question-by-question)

### Other Pages
- **Dashboard** — stats, recent sessions, streaks
- **Leaderboard** — top users by average score
- **Profile** — account info + history
- **AI Chat** — ask the AI coach anything
- **Tips & Tricks** — interview strategies

---

## 🗺️ RAG Architecture

Questions are stored in ChromaDB with metadata:
```
type       = role name (e.g. "software_engineer", "financial_analyst")
difficulty = easy | medium | hard
category   = technical | behavioral | situational | system_design | product_sense
```

### Type Mapping (interview type → ChromaDB type)
```python
TYPE_MAP = {
    "technical":     "software_engineer",
    "system_design": "system_design",
    "behavioral":    "behavioral",
    "product_sense": "product_manager",
}
```

When a user selects a **role** (e.g. Financial Analyst), ChromaDB filters:
```python
where={"$and": [{"type": "financial_analyst"}, {"difficulty": "medium"}]}
```

---

## 📦 Role → CSV Mapping

| Dropdown Role | ChromaDB Type |
|---------------|--------------|
| Software Engineer | `software_engineer` |
| System Design Engineer | `system_design` |
| Data Engineer | `data_engineer` |
| ML Engineer | `ml_engineer` |
| DevOps Engineer | `devops_engineer` |
| Product Manager | `product_manager` |
| Business Analyst | `business_analyst` |
| Project Manager | `project_manager` |
| Operations Manager | `project_manager` |
| Management Consultant | `management_consultant` |
| Financial Analyst | `financial_analyst` |
| Investment Analyst | `financial_analyst` |
| Risk Analyst | `financial_analyst` |
| Accountant | `accountant` |
| Audit Associate | `accountant` |
| Digital Marketer | `digital_marketing` |
| SEO Specialist | `digital_marketing` |
| Brand Manager | `digital_marketing` |
| Content Writer | `content_writer` |
| Copywriter | `content_writer` |
| HR Manager | `hr_manager` |
| HR Business Partner | `hr_manager` |
| Talent Acquisition | `hr_manager` |
| L&D Specialist | `hr_manager` |
| Compensation Analyst | `hr_manager` |
| UI/UX Designer | `ux_designer` |
| Product Designer | `ux_designer` |
| UX Researcher | `ux_designer` |
| Interaction Designer | `ux_designer` |
| Visual Designer | `ux_designer` |

---

## 🔑 Routes Summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Landing page |
| GET | `/login` | Login page |
| GET | `/register` | Register page |
| POST | `/auth/login` | Login API |
| POST | `/auth/register` | Register API |
| POST | `/auth/forgot-password` | Send OTP |
| POST | `/auth/reset-password` | Reset with OTP |
| GET | `/dashboard` | Dashboard page |
| GET | `/dashboard/stats` | Dashboard data API |
| GET | `/practice` | Practice setup page |
| POST | `/interview/start` | Start text interview |
| POST | `/interview/answer` | Submit answer |
| POST | `/interview/end` | End + score session |
| GET | `/interview/voice` | Voice setup page |
| POST | `/interview/voice/questions` | Get voice questions |
| POST | `/interview/voice/results` | Submit voice results |
| GET | `/analytics` | Analytics page |
| GET | `/analytics/data` | Analytics data API |
| POST | `/analytics/ai-coach` | AI coaching |
| POST | `/coaching/session` | Deep session coaching |
| GET | `/leaderboard` | Leaderboard page |
| GET | `/leaderboard/data` | Leaderboard API |
| GET | `/profile` | Profile page |
| GET | `/settings` | Settings page |
| POST | `/settings/clear-history` | Clear session history |
| GET | `/study-guide` | AI Chat page |
| POST | `/study-guide/chat` | AI Chat API |
| GET | `/tips` | Tips page |
| GET | `/results` | Results page |
| GET | `/logout` | Logout |

---

## 🛠️ Common Issues

### "Failed to start. Try again."
- ChromaDB is empty → run `seed_data.py --reset`
- Wrong type names in ChromaDB → check `TYPE_MAP` in `interview.py` and `voice.py`

### ChromaDB PostHog telemetry spam in logs
Add to `docker-compose.yml` under chromadb service:
```yaml
environment:
  - ANONYMIZED_TELEMETRY=false
```

### Pages showing wrong content
- Do NOT replace sidebar pages from corrupted outputs
- Always use your backup pages as the base

---

## 📝 Development Notes

- All sidebar pages use **Tailwind CSS** (CDN)
- Auth pages (`index.html`, `register.html` etc.) use **pure CSS** (`style.css`)
- `practice.html` and `voice.html` use **pure CSS** (no Tailwind) to avoid light mode issues
- JS for each page is in a separate file in `frontend/static/js/`
- Session IDs are stored in HTTP-only cookies
