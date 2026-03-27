import os
from pathlib import Path


def _candidate_from_env(name: str) -> Path | None:
    value = os.getenv(name)
    return Path(value) if value else None


def _first_existing(*candidates: Path) -> Path:
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    return candidates[0]


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
REPO_DIR = BACKEND_DIR.parent

FRONTEND_DIR = _first_existing(
    _candidate_from_env("FRONTEND_DIR"),
    BACKEND_DIR / "frontend",
    REPO_DIR / "frontend",
)

FRONTEND_PAGES_DIR = FRONTEND_DIR / "pages"
FRONTEND_STATIC_DIR = FRONTEND_DIR / "static"
DATA_DIR = _first_existing(
    _candidate_from_env("DATA_DIR"),
    BACKEND_DIR / "data",
    REPO_DIR / "backend" / "data",
)
