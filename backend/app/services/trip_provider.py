"""Trip generation providers.

Two implementations sit behind a common `TripProvider` interface:

- `MockTripProvider`: deterministic, no network calls, reacts to
  destination scope / duration / budget / pace / interests. This is the
  default and the only provider needed for MVP1.
- `OpenAITripProvider`: server-side GPT-5.6 provider, wired up but not
  activated until `AI_PROVIDER=openai` and `OPENAI_API_KEY` are set. Do not
  enable in the frontend; the key must never leave the backend.

`get_trip_provider()` is the single entry point `main.py` should use.
"""

from __future__ import annotations

import hashlib
import logging
import os
from abc import ABC, abstractmethod
from functools import lru_cache

from app.models import (
    BudgetLineItem,
    BudgetPlan,
    Destination,
    ItineraryDay,
    ItineraryItem,
    Optimization,
    Pace,
    PreferenceSummary,
    Story,
    StoryStyle,
    TripPlan,
    TripRequest,
)

logger = logging.getLogger("memorytrip.provider")


class TripProvider(ABC):
    """Common interface both providers must satisfy."""

    generation_mode: str = "mock"

    @abstractmethod
    def generate(self, request: TripRequest) -> TripPlan:
        ...

    @abstractmethod
    def regenerate_story(self, request: TripRequest, style: StoryStyle) -> Story:
        ...


# --------------------------------------------------------------------------
# Mock provider — deterministic, no external calls.
# --------------------------------------------------------------------------

_DESTINATION_LIBRARY = [
    {
        "keywords": ["kerala", "india south", "wayanad", "munnar"],
        "name": "Wayanad, Kerala",
        "country": "India",
        "rationale": "Misty hill forests, slow mornings, and a pace built for reconnecting with nature.",
    },
    {
        "keywords": ["himachal", "manali", "spiti", "mountain", "himalaya"],
        "name": "Kasol, Himachal Pradesh",
        "country": "India",
        "rationale": "River-side stillness in the mountains, ideal for a quiet, photography-led reset.",
    },
    {
        "keywords": ["japan", "kyoto", "tokyo"],
        "name": "Kyoto, Japan",
        "country": "Japan",
        "rationale": "Temple gardens and quiet lantern-lit streets that reward slow, observant travel.",
    },
    {
        "keywords": ["goa", "beach", "coast"],
        "name": "South Goa",
        "country": "India",
        "rationale": "Uncrowded coastline with a laid-back rhythm suited to unwinding without an itinerary crush.",
    },
    {
        "keywords": ["rajasthan", "desert", "jaipur", "udaipur"],
        "name": "Udaipur, Rajasthan",
        "country": "India",
        "rationale": "Lakeside heritage architecture and golden-hour views built for a romantic, story-rich trip.",
    },
]

_DEFAULT_DESTINATION = {
    "name": "Coorg, Karnataka",
    "country": "India",
    "rationale": "A dependable pick when destination scope is open: coffee estates, forest air, and slow pace.",
}

_TIME_SLOTS = ["morning", "afternoon", "evening"]

_CATEGORY_BY_INTEREST = {
    "nature": "nature",
    "photography": "photography",
    "wellness": "wellness",
    "food": "food",
    "food & dining": "food",
    "heritage": "culture",
    "culture": "culture",
    "arts & crafts": "culture",
    "adventure": "adventure",
    "nightlife": "nightlife",
}

_BUDGET_CATEGORY_WEIGHTS = [
    ("Accommodation", 0.32),
    ("Local transportation", 0.14),
    ("Food", 0.22),
    ("Activities", 0.20),
    ("Shopping/other", 0.07),
    ("Emergency reserve", 0.05),
]


def _stable_pick(seed: str, options: list) -> object:
    """Deterministic pseudo-random pick so the same input always gives the
    same output, without relying on `random`'s global state."""
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    index = int(digest, 16) % len(options)
    return options[index]


def _pick_destination(request: TripRequest) -> Destination:
    scope = (request.destination_scope or "").strip().lower()
    if scope and scope != "open to suggestions":
        for candidate in _DESTINATION_LIBRARY:
            if any(keyword in scope for keyword in candidate["keywords"]):
                fit = "Within budget" if request.budget >= 12000 else "Tight but workable within budget"
                return Destination(
                    name=candidate["name"],
                    country=candidate["country"],
                    rationale=candidate["rationale"],
                    estimated_fit=fit,
                )
        # Scope given but not recognised: keep the user's wording, mock a rationale.
        return Destination(
            name=request.destination_scope,
            country="Unspecified",
            rationale=f"Selected to match your requested scope of '{request.destination_scope}'.",
            estimated_fit="Estimated fit pending finer-grained destination data.",
        )

    picked = _stable_pick(f"{request.origin}:{request.duration_days}", _DESTINATION_LIBRARY)
    fit = "Within budget" if request.budget >= 12000 else "Tight but workable within budget"
    return Destination(
        name=picked["name"],
        country=picked["country"],
        rationale=picked["rationale"],
        estimated_fit=fit,
    )


def _themes_for(request: TripRequest) -> list[str]:
    themes = []
    if request.interests:
        themes.extend(i.title() for i in request.interests[:2])
    themes.append({
        Pace.RELAXED: "slow travel",
        Pace.BALANCED: "balanced exploration",
        Pace.PACKED: "high-energy discovery",
    }[request.pace])
    # de-dupe, keep order, cap at 3 per contract
    seen = []
    for t in themes:
        if t not in seen:
            seen.append(t)
    return seen[:3]


def _emotional_intent(request: TripRequest) -> str:
    prompt = request.travel_prompt.strip().rstrip(".")
    if len(prompt) > 90:
        prompt = prompt[:87] + "..."
    return f"A journey shaped around: {prompt}"


def _build_preferences(request: TripRequest) -> PreferenceSummary:
    return PreferenceSummary(
        emotional_intent=_emotional_intent(request),
        themes=_themes_for(request),
        pace=request.pace,
    )


def _daily_cost_target(request: TripRequest) -> int:
    return max(500, request.budget // max(1, request.duration_days))


def _build_itinerary(request: TripRequest, destination: Destination) -> list[ItineraryDay]:
    interests = [i.lower() for i in request.interests] or ["nature"]
    daily_budget = _daily_cost_target(request)
    per_item = max(150, daily_budget // 4)

    days: list[ItineraryDay] = []
    for day_num in range(1, request.duration_days + 1):
        interest = interests[(day_num - 1) % len(interests)]
        category = _CATEGORY_BY_INTEREST.get(interest, "experience")

        if day_num == 1:
            theme = "Arrival and reset"
        elif day_num == request.duration_days:
            theme = "Farewell and reflection"
        else:
            theme = f"{interest.title()} focused day"

        items = []
        for slot in _TIME_SLOTS:
            items.append(
                ItineraryItem(
                    time_of_day=slot,
                    title=f"{slot.title()} {interest} experience near {destination.name}",
                    description=(
                        f"A {request.pace.value}-paced {slot} activity centred on {interest}, "
                        f"suited to a group of {request.traveller_count}."
                    ),
                    category=category,
                    rationale=f"Chosen to reinforce the '{interest}' theme from your travel prompt.",
                    estimated_cost=per_item,
                    photo_moment=f"{slot.title()} light over {destination.name}",
                )
            )

        days.append(
            ItineraryDay(
                day=day_num,
                theme=theme,
                items=items,
                estimated_daily_cost=per_item * len(items),
            )
        )
    return days


def _build_budget(request: TripRequest, itinerary: list[ItineraryDay]) -> BudgetPlan:
    estimated_total = sum(day.estimated_daily_cost for day in itinerary)
    # Nudge total to be realistically close to (not always under) budget.
    line_items = [
        BudgetLineItem(category=name, amount=round(estimated_total * weight))
        for name, weight in _BUDGET_CATEGORY_WEIGHTS
    ]
    computed_total = sum(item.amount for item in line_items)
    variance = request.budget - computed_total

    optimizations: list[Optimization] = []
    if variance < 0:
        optimizations = [
            Optimization(
                title="Shift to shared/local transport options",
                estimated_saving=round(abs(variance) * 0.3),
                impact="Slightly less door-to-door convenience, minimal effect on itinerary quality.",
            ),
            Optimization(
                title="Swap one premium activity for a free/self-guided alternative",
                estimated_saving=round(abs(variance) * 0.25),
                impact="Keeps the theme intact while trimming a paid experience.",
            ),
            Optimization(
                title="Choose a 3-star or homestay option over premium stays",
                estimated_saving=round(abs(variance) * 0.35),
                impact="Comparable comfort with a more local, lower-cost stay.",
            ),
        ]

    return BudgetPlan(
        currency=request.currency,
        user_budget=request.budget,
        estimated_total=computed_total,
        variance=variance,
        line_items=line_items,
        assumptions=[
            "Estimated, not live pricing.",
            "Assumes local transport only; long-haul travel to origin/destination excluded.",
            f"Costs scaled for {request.traveller_count} traveller(s).",
        ],
        optimizations=optimizations,
    )


_STORY_OPENERS = {
    StoryStyle.CINEMATIC: "The scene opens on {dest}, golden light catching the horizon as the journey begins.",
    StoryStyle.FANTASY: "Beyond the ordinary map, {dest} waits like a chapter pulled from an old, half-remembered tale.",
    StoryStyle.WATERCOLOR: "Soft edges and quiet color: {dest} unfolds like a page from a watercolor travel journal.",
    StoryStyle.DOCUMENTARY: "This is {dest}, observed plainly and honestly, day by day, as the trip actually unfolds.",
    StoryStyle.ANIMATION: "Picture {dest} rendered in bright, playful frames, each day a new scene worth pausing on.",
}


def _build_story(destination: Destination, prefs: PreferenceSummary, style: StoryStyle) -> Story:
    opener = _STORY_OPENERS[style].format(dest=destination.name)
    content = (
        f"{opener} {prefs.emotional_intent}. Each day leans into "
        f"{', '.join(prefs.themes) if prefs.themes else 'the trip\'s central mood'}, "
        f"moving at a {prefs.pace.value} pace toward a handful of moments worth remembering."
    )
    return Story(
        style=style,
        title=f"A {style.value.title()} Trail Through {destination.name}",
        content=content,
        disclaimer="An inspirational pre-trip story based on your planned journey.",
    )


class MockTripProvider(TripProvider):
    generation_mode = "mock"

    def generate(self, request: TripRequest) -> TripPlan:
        destination = _pick_destination(request)
        preferences = _build_preferences(request)
        itinerary = _build_itinerary(request, destination)
        budget = _build_budget(request, itinerary)
        story = _build_story(destination, preferences, request.story_style)

        return TripPlan(
            preference_summary=preferences,
            destination=destination,
            itinerary=itinerary,
            budget=budget,
            story=story,
            generation_mode=self.generation_mode,
        )

    def regenerate_story(self, request: TripRequest, style: StoryStyle) -> Story:
        destination = _pick_destination(request)
        preferences = _build_preferences(request)
        return _build_story(destination, preferences, style)


# --------------------------------------------------------------------------
# OpenAI provider — not active until explicitly configured. Keep the API
# key and prompts server-side only; never import this provider's client
# construction into a path that can be reached without OPENAI_API_KEY set.
# --------------------------------------------------------------------------

MODEL_TARGET = "gpt-5.6-sol"


class OpenAITripProvider(TripProvider):
    generation_mode = "gpt-5.6"

    def __init__(self) -> None:
        try:
            from openai import AsyncOpenAI  # local import: optional dependency
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "openai package not installed. Add `openai` to requirements.txt "
                "before enabling AI_PROVIDER=openai."
            ) from exc
        self._client = AsyncOpenAI()

    def generate(self, request: TripRequest) -> TripPlan:
        raise NotImplementedError(
            "OpenAITripProvider.generate is a placeholder. Implement the "
            "async orchestration (emotion -> itinerary -> budget -> story) "
            "and adapt FastAPI routes to async def before enabling this provider."
        )

    def regenerate_story(self, request: TripRequest, style: StoryStyle) -> Story:
        raise NotImplementedError("Implement alongside `generate`.")


@lru_cache
def get_trip_provider() -> TripProvider:
    provider_name = os.environ.get("AI_PROVIDER", "mock").strip().lower()
    if provider_name == "openai":
        logger.info("Using OpenAITripProvider (%s)", MODEL_TARGET)
        return OpenAITripProvider()
    logger.info("Using MockTripProvider")
    return MockTripProvider()
