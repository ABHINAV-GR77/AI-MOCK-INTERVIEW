import os
import redis.asyncio as aioredis
import chromadb
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# ── MongoDB ───────────────────────────────────────────
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://mongodb:27017")
mongo_client = AsyncIOMotorClient(MONGODB_URL)
db = mongo_client["interviewai"]

users_col    = db["users"]
sessions_col = db["sessions"]

# ── Redis ─────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

# ── ChromaDB (lazy) ───────────────────────────────────
_chroma_client = None
_interview_collection = None

def get_chroma():
    global _chroma_client, _interview_collection
    if _chroma_client is None:
        _chroma_client = chromadb.HttpClient(host="chromadb", port=8000)
        # No custom embedding_function — use ChromaDB default (all-MiniLM-L6-v2)
        # which matches what seed_data.py used
        _interview_collection = _chroma_client.get_or_create_collection(
            name="interview_questions",
        )
    return _interview_collection