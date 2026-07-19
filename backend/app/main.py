from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import Pace, RevisionRequest, Story, StoryRequest, TripPlan, TripRequest
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
    return {"status": "ok", "provider": get_trip_provider().generation_mode}


@app.post("/api/trips/generate", response_model=TripPlan)
def generate_trip(request: TripRequest) -> TripPlan:
    try:
        return get_trip_provider().generate(request)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@app.post("/api/trips/revise", response_model=TripPlan)
def revise_trip(request: RevisionRequest) -> TripPlan:
    try:
        return get_trip_provider().revise_trip(request.trip, request.instruction)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@app.post("/api/trips/story", response_model=Story)
def regenerate_story(request: StoryRequest) -> Story:
    """Regenerates only the story for an already-generated plan, leaving
    the itinerary/budget the user is looking at untouched client-side."""
    try:
        return get_trip_provider().regenerate_story(request.trip, request.style)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
