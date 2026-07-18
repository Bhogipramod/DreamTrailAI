from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_PAYLOAD = {
    "display_name": "Priya",
    "travel_prompt": "A peaceful, photography-focused break close to nature",
    "origin": "Bengaluru, India",
    "duration_days": 4,
    "traveller_count": 1,
    "budget": 30000,
    "currency": "INR",
    "destination_scope": "Kerala, India",
    "pace": "relaxed",
    "interests": ["nature", "photography", "wellness"],
    "story_style": "cinematic",
}


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["provider"] == "mock"


def test_generate_valid_payload_matches_contract():
    res = client.post("/api/trips/generate", json=VALID_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert body["generation_mode"] == "mock"
    assert "id" in body
    assert len(body["itinerary"]) == VALID_PAYLOAD["duration_days"]
    for day in body["itinerary"]:
        assert len(day["items"]) == 3  # morning/afternoon/evening
    assert body["budget"]["currency"] == "INR"


def test_generate_invalid_payload_returns_422():
    bad_payload = {**VALID_PAYLOAD, "travel_prompt": "short"}  # under min_length=10
    res = client.post("/api/trips/generate", json=bad_payload)
    assert res.status_code == 422


def test_generate_missing_required_field_returns_422():
    bad_payload = dict(VALID_PAYLOAD)
    del bad_payload["origin"]
    res = client.post("/api/trips/generate", json=bad_payload)
    assert res.status_code == 422


def test_low_budget_triggers_optimizations():
    low_budget_payload = {**VALID_PAYLOAD, "budget": 3000, "duration_days": 6}
    res = client.post("/api/trips/generate", json=low_budget_payload)
    assert res.status_code == 200
    body = res.json()
    if body["budget"]["variance"] < 0:
        assert len(body["budget"]["optimizations"]) >= 3
        for opt in body["budget"]["optimizations"]:
            assert opt["estimated_saving"] >= 0


def test_revise_lowers_budget_on_instruction():
    generate_res = client.post("/api/trips/generate", json=VALID_PAYLOAD)
    assert generate_res.status_code == 200

    revise_res = client.post(
        "/api/trips/revise",
        json={"trip": VALID_PAYLOAD, "instruction": "please reduce the budget"},
    )
    assert revise_res.status_code == 200
    revised_budget = revise_res.json()["budget"]["user_budget"]
    assert revised_budget < VALID_PAYLOAD["budget"]


def test_story_endpoint_regenerates_only_story():
    res = client.post(
        "/api/trips/story",
        json={"trip": VALID_PAYLOAD, "style": "fantasy"},
    )
    assert res.status_code == 200
    story = res.json()
    assert story["style"] == "fantasy"
    assert "content" in story
