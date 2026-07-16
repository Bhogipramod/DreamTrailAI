from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import Pace, RevisionRequest, TripPlan, TripRequest
from app.services.trip_provider import get_trip_provider

app = FastAPI(title="MemoryTrip API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "provider": "mock"}


@app.post("/api/trips/generate", response_model=TripPlan)
def generate_trip(request: TripRequest) -> TripPlan:
    return get_trip_provider().generate(request)


@app.post("/api/trips/revise", response_model=TripPlan)
def revise_trip(request: RevisionRequest) -> TripPlan:
    updated = request.trip.model_copy(deep=True)
    instruction = request.instruction.lower()
    if "budget" in instruction or "cheap" in instruction:
        updated.budget = max(1000, int(updated.budget * 0.85))
    if "slow" in instruction or "relax" in instruction:
        updated.pace = Pace.RELAXED
    if "adventure" in instruction:
        updated.interests = ["adventure", *[item for item in updated.interests if item != "adventure"]]
    return get_trip_provider().generate(updated)
