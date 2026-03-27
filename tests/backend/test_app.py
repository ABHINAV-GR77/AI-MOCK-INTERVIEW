from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routes import auth, dashboard
import app.main as main_module


class FakeUsersCollection:
    def __init__(self):
        self.docs = {}

    async def find_one(self, query, projection=None):
        doc = self.docs.get(query.get("email"))
        if doc is None:
            return None
        if projection:
            filtered = {
                key: value
                for key, value in doc.items()
                if not (key in projection and projection[key] == 0)
            }
            return filtered
        return dict(doc)

    async def insert_one(self, document):
        self.docs[document["email"]] = dict(document)
        return SimpleNamespace(inserted_id=document["email"])

    async def update_one(self, query, update):
        email = query["email"]
        if email in self.docs:
            self.docs[email].update(update.get("$set", {}))
        return SimpleNamespace(modified_count=1)


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def delete(self, key):
        self.store.pop(key, None)


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, length):
        return list(self.docs)[:length]


class FakeSessionsCollection:
    def __init__(self, docs):
        self.docs = docs

    def find(self, query):
        matches = [doc for doc in self.docs if doc["user_email"] == query["user_email"]]
        return FakeCursor(matches)


@pytest.fixture
def client(monkeypatch):
    fake_users = FakeUsersCollection()
    fake_redis = FakeRedis()

    monkeypatch.setattr(main_module, "auto_seed", lambda: None)
    monkeypatch.setattr(auth, "users_col", fake_users)
    monkeypatch.setattr(auth, "redis_client", fake_redis)

    with TestClient(main_module.app) as test_client:
        yield test_client, fake_users, fake_redis


def test_login_page_renders(client):
    test_client, _, _ = client

    response = test_client.get("/login")

    assert response.status_code == 200
    assert "InterviewAI" in response.text


def test_register_then_login_sets_session_cookie(client):
    test_client, fake_users, fake_redis = client

    register_response = test_client.post(
        "/register",
        json={"email": "ci@example.com", "password": "StrongPass1!", "name": "CI User"},
    )
    login_response = test_client.post(
        "/login",
        json={"email": "ci@example.com", "password": "StrongPass1!"},
    )

    assert register_response.status_code == 200
    assert "ci@example.com" in fake_users.docs
    assert login_response.status_code == 200
    assert login_response.cookies.get("session_id")
    assert any(key.startswith("session:") for key in fake_redis.store)


def test_dashboard_stats_returns_aggregated_metrics(client, monkeypatch):
    test_client, _, _ = client
    fake_sessions = FakeSessionsCollection(
        [
            {
                "user_email": "ci@example.com",
                "score": 80,
                "date": "2026-03-27T08:30:00",
                "interview_type": "technical",
                "mode": "text",
                "duration_minutes": 30,
                "session_id": "one",
            },
            {
                "user_email": "ci@example.com",
                "score": 90,
                "date": "2026-03-26T08:30:00",
                "interview_type": "behavioral",
                "mode": "voice",
                "duration_minutes": 30,
                "session_id": "two",
            },
        ]
    )

    async def fake_current_user(request):
        return "ci@example.com"

    monkeypatch.setattr(dashboard, "get_current_user", fake_current_user)
    monkeypatch.setattr(dashboard, "sessions_col", fake_sessions)

    response = test_client.get("/dashboard/stats")
    payload = response.json()

    assert response.status_code == 200
    assert payload["total_sessions"] == 2
    assert payload["avg_score"] == 85
    assert payload["skill_progress"]["technical"] == 80
    assert payload["skill_progress"]["behavioral"] == 90
