from fastapi.testclient import TestClient

from app import create_app
from agents.scout.routes import router as scout_router


def test_health_endpoint():
    app = create_app()

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_scout_route_validation_error(force_mock_mode):
    app = create_app()
    app.include_router(scout_router)
    client = TestClient(app)

    response = client.post("/ai/scout/research-topic", json={"user_id": "user-1", "topic": ""})

    assert response.status_code == 422


def test_scout_mock_route_success(force_mock_mode, monkeypatch):
    from agents.scout import routes as scout_routes

    async def autocomplete(topic):
        return [topic]

    monkeypatch.setattr(scout_routes, "google_autocomplete", autocomplete)

    app = create_app()
    app.include_router(scout_router)
    client = TestClient(app)

    response = client.post(
        "/ai/scout/research-topic",
        json={"user_id": "user-1", "topic": "AI CRM"},
    )

    assert response.status_code == 200
    assert response.json()["bottom_line"]
