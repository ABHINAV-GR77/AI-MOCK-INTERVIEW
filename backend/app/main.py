import os
import csv
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes import auth, dashboard, interview, voice, analytics, misc
from app.paths import DATA_DIR, FRONTEND_STATIC_DIR


def auto_seed():
    print("[SEED] Starting auto-seed check...", flush=True)
    try:
        import chromadb
        from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

        # Dummy embedding function — no model download, just hashes
        # ChromaDB needs embeddings to store docs; we use simple numeric hashes
        class HashEmbedding(EmbeddingFunction):
            def __call__(self, input: Documents) -> Embeddings:
                result = []
                for text in input:
                    # Create a 384-dim embedding from hash (matches default dim)
                    import hashlib
                    h = hashlib.md5(text.encode()).digest()
                    # Repeat hash bytes to fill 384 floats
                    extended = (h * 24)[:384]
                    vec = [(b / 255.0) - 0.5 for b in extended]
                    result.append(vec)
                return result

        CHROMA_HOST = os.getenv("CHROMA_HOST", "chromadb")
        CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8000))
        BATCH_SIZE = 100
        CSV_FILES = [
            "software_engineer.csv",
            "system_design.csv",
            "behavioral.csv",
            "product_manager.csv",
            "financial_analyst.csv",
            "accountant.csv",
            "digital_marketing.csv",
            "hr_manager.csv",
            "ux_designer.csv",
            "business_analyst.csv",
            "data_engineer.csv",
            "ml_engineer.csv",
            "project_manager.csv",
            "devops_engineer.csv",
            "content_writer.csv",
            "management_consultant.csv",
        ]

        # Retry connecting
        client = None
        for attempt in range(5):
            try:
                client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
                client.heartbeat()
                print(f"[SEED] Connected to ChromaDB on attempt {attempt+1}", flush=True)
                break
            except Exception as e:
                print(f"[SEED] ChromaDB not ready (attempt {attempt+1}): {e}", flush=True)
                time.sleep(2)

        if client is None:
            print("[SEED] Could not connect to ChromaDB.", flush=True)
            return

        collection = client.get_or_create_collection(
            name="interview_questions",
        )

        existing = collection.count()
        if existing > 0:
            print(f"[SEED] Already has {existing} questions — skipping.", flush=True)
            return

        print("[SEED] Seeding from CSV files...", flush=True)

        ids, docs, metas = [], [], []
        seen_ids = set()
        total_loaded = 0

        for fname in CSV_FILES:
            fpath = os.path.join(str(DATA_DIR), fname)
            if not os.path.exists(fpath):
                print(f"[SEED] WARNING: {fpath} not found.", flush=True)
                continue

            with open(fpath, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    q = row.get("question", "").strip()
                    t = row.get("type", row.get("role", "")).strip().lower()
                    d = row.get("difficulty", "").strip().lower()
                    if not q or not t or not d:
                        continue
                    if d not in ("easy", "medium", "hard"):
                        continue

                    uid = str(abs(hash(q)) % (10 ** 12))
                    if uid in seen_ids:
                        continue
                    seen_ids.add(uid)

                    ids.append(uid)
                    docs.append(q)
                    cat = row.get("category","").strip().lower()
                    meta = {"type": t, "difficulty": d}
                    if cat: meta["category"] = cat
                    metas.append(meta)

                    if len(ids) >= BATCH_SIZE:
                        collection.add(ids=ids, documents=docs, metadatas=metas)
                        total_loaded += len(ids)
                        print(f"[SEED] Loaded {total_loaded} questions...", flush=True)
                        ids, docs, metas = [], [], []

        if ids:
            collection.add(ids=ids, documents=docs, metadatas=metas)
            total_loaded += len(ids)

        print(f"[SEED] Done! {total_loaded} questions loaded.", flush=True)

    except Exception as e:
        import traceback
        print(f"[SEED] ERROR: {e}", flush=True)
        traceback.print_exc()


@asynccontextmanager
async def lifespan(app: FastAPI):
    auto_seed()
    yield


app = FastAPI(title="InterviewAI", lifespan=lifespan)

if not FRONTEND_STATIC_DIR.exists():
    raise RuntimeError(f"Static directory not found: {FRONTEND_STATIC_DIR}")

app.mount("/static", StaticFiles(directory=str(FRONTEND_STATIC_DIR)), name="static")

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(voice.router)
app.include_router(interview.router)
app.include_router(analytics.router)
app.include_router(misc.router)
