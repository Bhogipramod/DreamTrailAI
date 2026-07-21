from dotenv import load_dotenv

# Load backend/.env (if present) into the process environment before
# anything reads AI_PROVIDER / GEMINI_API_KEY / OPENAI_API_KEY. Safe to
# call even if the file doesn't exist - it's a no-op in that case.
load_dotenv()

from typing import Callable, TypeVar

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    Pace,
    PostTripStoryRequest,
    RevisionRequest,
    Story,
    StoryRequest,
    TripPlan,
    TripRequest,
)
from app.services.trip_provider import get_trip_provider

app = FastAPI(title="MemoryTrip API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

T = TypeVar("T")


def _call_provider(fn: Callable[[], T]) -> T:
    """Runs a provider call and turns known failure modes into clean,
    user-facing errors instead of a raw 500 + traceback:
    - NotImplementedError (e.g. OpenAI provider stub) -> 501
    - Gemini rate-limit/quota errors -> 503 with a friendly message
    """
    try:
        return fn()
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see below
        # Avoid a hard dependency on google-genai when it isn't installed
        # (e.g. mock-only setups) by checking the exception type by name
        # rather than importing google.genai.errors at module load time.
        if type(exc).__name__ == "ClientError" and "RESOURCE_EXHAUSTED" in str(exc):
            raise HTTPException(
                status_code=503,
                detail=(
                    "The AI provider's request quota has been used up for now. "
                    "Wait a bit and try again, or switch AI_PROVIDER back to "
                    "'mock' in the meantime."
                ),
            ) from exc
        raise


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "provider": get_trip_provider().generation_mode}


@app.post("/api/trips/generate", response_model=TripPlan)
def generate_trip(request: TripRequest) -> TripPlan:
    return _call_provider(lambda: get_trip_provider().generate(request))


@app.post("/api/trips/revise", response_model=TripPlan)
def revise_trip(request: RevisionRequest) -> TripPlan:

    return _call_provider(lambda: get_trip_provider().revise_trip(request.trip, request.instruction))


@app.post("/api/trips/story", response_model=Story)
def regenerate_story(request: StoryRequest) -> Story:
    """Regenerates only the story for an already-generated plan, leaving
    the itinerary/budget the user is looking at untouched client-side."""
    return _call_provider(lambda: get_trip_provider().regenerate_story(request.trip, request.style))


@app.post("/api/trips/post-story", response_model=Story)
def generate_post_trip_story(request: PostTripStoryRequest) -> Story:
    """Weaves the traveller's own day-by-day captions (from the manual
    photo-upload flow) into one flowing retrospective story. Photos are
    optional and capped client-side; vision-capable providers (Gemini)
    will actually look at them, others use captions only."""
    return _call_provider(
        lambda: get_trip_provider().generate_post_trip_story(
            request.trip, request.day_notes, request.extra_notes, request.extra_photos, request.style
        )
    )