import pytest
from fastapi.testclient import TestClient

from app import app
from database.session import init_db


@pytest.fixture
def client():
    init_db()
    return TestClient(app)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_case_workspace_empty(client):
    client.post("/api/auth/register", json={"email": "ws@example.com", "username": "wsuser", "password": "testpass123"})
    tok = client.post("/api/auth/login", data={"username": "wsuser", "password": "testpass123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    created = client.post("/api/cases", headers=h, json={"title": "Empty", "priority": "high"}).json()
    assert created.get("case_number")
    ws = client.get(f"/api/cases/{created['id']}/workspace", headers=h)
    assert ws.status_code == 200
    body = ws.json()
    assert body["title"] == "Empty"
    assert body["priority"] == "high"
    assert body["clips"] == []


def test_register_and_login(client):
    resp = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"

    resp = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_nl_search_parsing():
    from search.nl_search import NaturalLanguageSearch, time_str_to_seconds

    nl = NaturalLanguageSearch()
    result = nl._parse_with_rules("Show me all white cars between 8 PM and 10 PM")
    assert result["object_class"] == "car"
    assert result["color"] == "white"
    assert result.get("start_time")
    assert time_str_to_seconds("8:00 PM") == 20 * 3600
