"""
seed_data.py — Seed ChromaDB with all interview questions
Usage: python seed_data.py [--reset]
"""
import os, csv, sys, chromadb

CHROMA_HOST = os.getenv("CHROMA_HOST", "chromadb")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8000))
DATA_DIR    = os.path.join(os.path.dirname(__file__), "data")
COLLECTION  = "interview_questions"

# All CSV files — one per role, each has easy + medium + hard questions
CSV_FILES = [
    # Computer Science
    "software_engineer.csv",
    "system_design.csv",
    "behavioral.csv",
    "product_manager.csv",
    "data_engineer.csv",
    "ml_engineer.csv",
    "devops_engineer.csv",
    # Finance
    "financial_analyst.csv",
    "accountant.csv",
    # Marketing
    "digital_marketing.csv",
    "content_writer.csv",
    # HR
    "hr_manager.csv",
    # Design
    "ux_designer.csv",
    # Business
    "business_analyst.csv",
    "project_manager.csv",
    "management_consultant.csv",
]

print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

if "--reset" in sys.argv:
    try:
        client.delete_collection(COLLECTION)
        print(f"Deleted existing collection: {COLLECTION}")
    except Exception as e:
        print(f"No existing collection to delete: {e}")

col = client.get_or_create_collection(
    name=COLLECTION,
    metadata={"hnsw:space": "cosine"}
)

existing = col.count()
print(f"Existing documents: {existing}")
if existing > 0 and "--reset" not in sys.argv:
    print("Collection already seeded. Use --reset to reseed.")
    sys.exit(0)

all_docs, all_ids, all_meta = [], [], []
id_set = set()
total_files = 0

for filename in CSV_FILES:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"  WARNING: {filename} not found in {DATA_DIR}, skipping")
        continue

    count = 0
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            q    = row.get("question", "").strip()
            role = row.get("role", "").strip().lower()
            cat  = row.get("category", "technical").strip().lower()
            diff = row.get("difficulty", "medium").strip().lower()

            if not q or not role:
                continue
            if diff not in ("easy", "medium", "hard"):
                diff = "medium"

            uid = f"{role[:6]}_{abs(hash(q)) % 10_000_000:07d}"
            if uid in id_set:
                uid = f"{uid}_{i}"
            id_set.add(uid)

            all_docs.append(q)
            all_ids.append(uid)
            all_meta.append({
                "type":       role,
                "difficulty": diff,
                "category":   cat,
            })
            count += 1

    print(f"  ✓ {filename}: {count} questions")
    total_files += 1

if not all_docs:
    print("ERROR: No questions loaded. Check that CSV files exist in backend/data/")
    sys.exit(1)

# Batch upsert into ChromaDB
BATCH = 500
total = len(all_docs)
print(f"\nUpserting {total} questions into ChromaDB in batches of {BATCH}...")

for i in range(0, total, BATCH):
    col.upsert(
        documents=all_docs[i:i+BATCH],
        ids=all_ids[i:i+BATCH],
        metadatas=all_meta[i:i+BATCH],
    )
    batch_num = i // BATCH + 1
    total_batches = (total + BATCH - 1) // BATCH
    print(f"  Batch {batch_num}/{total_batches} done")

final_count = col.count()
print(f"\n✅ Seeding complete!")
print(f"   Files processed : {total_files}")
print(f"   Questions loaded: {total}")
print(f"   ChromaDB total  : {final_count}")