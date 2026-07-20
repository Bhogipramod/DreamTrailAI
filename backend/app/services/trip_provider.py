"""Trip generation providers.

Three implementations sit behind a common `TripProvider` interface:

- `MockTripProvider`: deterministic, no network calls, reacts to
  destination scope / duration / budget / pace / interests. This is the
  default and the only provider needed for MVP1.
- `OpenAITripProvider`: server-side GPT-5.6 provider stub — not yet
  implemented (raises NotImplementedError); wiring it up requires async
  FastAPI routes. Do not enable in the frontend; the key must never leave
  the backend.
- `GeminiTripProvider`: server-side Gemini provider, fully implemented.
  Activate with `AI_PROVIDER=gemini` and `GEMINI_API_KEY` set as
  environment variables (never commit the key, never send it to the
  frontend). Uses the `google-genai` SDK's structured-output support so
  each stage's JSON response is validated directly into our own Pydantic
  models. Optional `GEMINI_MODEL` env var overrides the default model
  (`gemini-3.5-flash`).

`get_trip_provider()` is the single entry point `main.py` should use.
"""

from __future__ import annotations

import hashlib
import logging
import os
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import List

from app.models import (
    BudgetLineItem,
    BudgetPlan,
    DayNote,
    Destination,
    ItineraryDay,
    ItineraryItem,
    Optimization,
    Pace,
    PhotoPayload,
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

    @abstractmethod
    def generate_post_trip_story(
        self,
        request: TripRequest,
        day_notes: List[DayNote],
        extra_notes: List[str],
        extra_photos: List[PhotoPayload],
        style: StoryStyle,
    ) -> Story:
        """Weaves the traveller's own day-by-day captions - and, for
        providers that support it, a capped number of resized photos -
        into one flowing retrospective story."""
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

    def generate_post_trip_story(
        self,
        request: TripRequest,
        day_notes: List[DayNote],
        extra_notes: List[str],
        extra_photos: List[PhotoPayload],
        style: StoryStyle,
    ) -> Story:
        destination = _pick_destination(request)
        ordered_notes = sorted(day_notes, key=lambda n: n.day)
        total_photos = sum(len(note.photos) for note in ordered_notes) + len(extra_photos)

        if not ordered_notes and not extra_notes:
            content = f"A quiet trip to {destination.name} - add photos and captions above to build your story."
        else:
            sentences = [
                f"Day {note.day} carried the feeling of {note.theme.lower()}: {note.caption}"
                for note in ordered_notes
                if note.caption.strip()
            ]
            sentences.extend(note for note in extra_notes if note.strip())
            body = " ".join(sentences)
            opener = _STORY_OPENERS.get(style, _STORY_OPENERS[StoryStyle.DOCUMENTARY]).format(dest=destination.name)
            content = f"{opener} {body}"
            if total_photos:
                # Mock mode is caption-only - it can't actually look at
                # image content, so it says so rather than pretending to.
                content += (
                    f" ({total_photos} photo{'s' if total_photos != 1 else ''} attached - mock mode "
                    "writes from your captions only; switch to a vision-capable provider for real "
                    "photo analysis.)"
                )

        return Story(
            style=style,
            title=f"Looking Back: {destination.name}",
            content=content,
            disclaimer="Written from your own photos and captions - not independently verified.",
        )


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

    def generate_post_trip_story(
        self,
        request: TripRequest,
        day_notes: List[DayNote],
        extra_notes: List[str],
        extra_photos: List[PhotoPayload],
        style: StoryStyle,
    ) -> Story:
        raise NotImplementedError("Implement alongside `generate`.")


# --------------------------------------------------------------------------
# Gemini provider — real, working implementation. Requires GEMINI_API_KEY
# to be set server-side (never in the frontend / never committed). Uses the
# `google-genai` SDK's structured-output support (response_schema=<Pydantic
# model>) so the model's JSON is validated straight into our own models.
# --------------------------------------------------------------------------

GEMINI_MODEL_TARGET = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")


def _build_destination_itinerary_schema():
    """Small nested schema used only for the Gemini destination+itinerary
    call. Defined lazily so importing this module never requires pydantic
    features specific to this provider unless Gemini is actually selected."""
    from pydantic import BaseModel as _BaseModel

    class DestinationItineraryResult(_BaseModel):
        destination: Destination
        itinerary: List[ItineraryDay]

    return DestinationItineraryResult


class GeminiTripProvider(TripProvider):
    generation_mode = "gemini"

    def __init__(self) -> None:
        try:
            from google import genai  # local import: optional dependency
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "google-genai package not installed. Add `google-genai` to "
                "requirements.txt before enabling AI_PROVIDER=gemini."
            ) from exc

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Export it server-side "
                "(never in the frontend, never committed) before enabling "
                "AI_PROVIDER=gemini."
            )

        self._client = genai.Client(api_key=api_key)
        self._DestinationItineraryResult = _build_destination_itinerary_schema()

    def _generate_structured(self, contents, schema):
        from google.genai import types

        response = self._client.models.generate_content(
            model=GEMINI_MODEL_TARGET,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        return response.parsed

    def _run_emotion_stage(self, request: TripRequest) -> PreferenceSummary:
        prompt = (
            "You are a travel psychologist. Read the traveller's prompt and turn it "
            "into a structured preference profile: a primary emotional intent, up to "
            "three supporting themes, and confirm the travel pace.\n\n"
            f"Prompt: {request.travel_prompt}\n"
            f"Stated interests: {', '.join(request.interests) or 'none given'}\n"
            f"Pace: {request.pace.value}"
        )
        return self._generate_structured(prompt, PreferenceSummary)

    def _run_destination_itinerary_stage(self, request: TripRequest, prefs: PreferenceSummary):
        scope = (request.destination_scope or "").strip()
        is_open = not scope or scope.lower() == "open to suggestions"

        if is_open:
            destination_instruction = (
                "The traveller has not named a destination — recommend the single best "
                "destination for their preferences, budget, and origin."
            )
        else:
            destination_instruction = (
                f"The traveller has specified a destination: '{scope}'. You MUST set the "
                "destination to this exact place (fill in country and a fitting rationale) "
                "— do not substitute, override, or 'improve on' it with a different location."
            )

        prompt = (
            "You are a travel planner. Produce a destination and a complete day-by-day "
            f"itinerary with exactly {request.duration_days} days (day numbers 1 to "
            f"{request.duration_days}), each with a morning, afternoon, and evening "
            "activity. Every itinerary item needs a title, description, category, "
            "rationale tying back to the traveller's emotional intent, an estimated "
            "cost in the traveller's currency, and a suggested photo/memory moment. "
            "Do not invent real-time prices, bookings, or availability as fact — mark "
            f"them as estimates.\n\n{destination_instruction}\n\n"
            f"Origin: {request.origin}\n"
            f"Destination scope requested: {request.destination_scope}\n"
            f"Traveller count: {request.traveller_count}\n"
            f"Currency: {request.currency}\n"
            f"Total budget: {request.budget}\n"
            f"Emotional intent: {prefs.emotional_intent}\n"
            f"Themes: {', '.join(prefs.themes)}\n"
            f"Pace: {prefs.pace.value}"
        )
        result = self._generate_structured(prompt, self._DestinationItineraryResult)
        return result.destination, result.itinerary

    def _run_budget_stage(self, request: TripRequest, itinerary: List[ItineraryDay]) -> BudgetPlan:
        itinerary_summary = "\n".join(
            f"Day {day.day}: {day.theme} (items: {len(day.items)}, "
            f"estimated cost: {day.estimated_daily_cost})"
            for day in itinerary
        )
        prompt = (
            "You are a travel budget analyst. Build a category budget breakdown for "
            f"this trip. The traveller's total budget is {request.budget} "
            f"{request.currency}. Compare it against the itinerary's estimated costs, "
            "report the variance, list assumptions (mark all figures as estimates, "
            "not live pricing), and if the plan is over budget provide at least three "
            "actionable optimisation suggestions with estimated savings and impact.\n\n"
            f"Itinerary overview:\n{itinerary_summary}"
        )
        return self._generate_structured(prompt, BudgetPlan)

    def _run_story_stage(self, destination: Destination, prefs: PreferenceSummary, style: StoryStyle) -> Story:
        prompt = (
            f"You are a creative travel essayist. Write a short, {style.value} "
            f"pre-trip inspirational story about a trip to {destination.name}, "
            f"{destination.country}. Ground it in the traveller's emotional intent: "
            f"{prefs.emotional_intent}. Themes to weave in: {', '.join(prefs.themes)}. "
            "This is a fictional, inspirational piece written before the trip happens - "
            "do not state anything as a real, verified event. Include a short "
            "disclaimer field noting it is an inspirational pre-trip story."
        )
        return self._generate_structured(prompt, Story)

    def generate(self, request: TripRequest) -> TripPlan:
        prefs = self._run_emotion_stage(request)
        destination, itinerary = self._run_destination_itinerary_stage(request, prefs)
        budget = self._run_budget_stage(request, itinerary)
        story = self._run_story_stage(destination, prefs, request.story_style)

        return TripPlan(
            preference_summary=prefs,
            destination=destination,
            itinerary=itinerary,
            budget=budget,
            story=story,
            generation_mode=self.generation_mode,
        )

    def regenerate_story(self, request: TripRequest, style: StoryStyle) -> Story:
        # Lighter path than a full generate(): re-derive preferences +
        # destination context, then only call the story stage.
        prefs = self._run_emotion_stage(request)
        destination, _itinerary = self._run_destination_itinerary_stage(request, prefs)
        return self._run_story_stage(destination, prefs, style)

    def generate_post_trip_story(
        self,
        request: TripRequest,
        day_notes: List[DayNote],
        extra_notes: List[str],
        extra_photos: List[PhotoPayload],
        style: StoryStyle,
    ) -> Story:
        from google.genai import types
        import base64

        ordered_notes = sorted(day_notes, key=lambda n: n.day)

        instruction = (
            f"You are a travel essayist writing a {style.value} retrospective story about "
            "a trip that has already happened. Weave the traveller's own day-by-day notes "
            "and any attached photos into one flowing, cohesive narrative — do not just "
            "list the days back verbatim. Base what you say about each photo only on what "
            "is actually visible in it; do not invent events, people, or details the notes "
            "and photos don't support. Write in past tense, as something that already "
            "occurred. Include a short disclaimer noting this story is written from the "
            "traveller's own photos/captions and is not independently verified.\n\n"
            f"Destination: {request.destination_scope or 'as travelled'}"
        )

        # Total image cap across the whole request - vision tokens cost far
        # more than text, so this bounds both payload size and API cost
        # regardless of how many photos the user actually uploaded.
        MAX_TOTAL_IMAGES = 12
        images_used = 0

        contents: list = [instruction]
        for note in ordered_notes:
            if not note.caption.strip() and not note.photos:
                continue
            contents.append(f"Day {note.day} ({note.theme}): {note.caption}")
            for photo in note.photos:
                if images_used >= MAX_TOTAL_IMAGES:
                    break
                contents.append(
                    types.Part.from_bytes(data=base64.b64decode(photo.data), mime_type=photo.mime_type)
                )
                images_used += 1

        if extra_notes or extra_photos:
            contents.append("Other moments from the trip:")
            for note in extra_notes:
                if note.strip():
                    contents.append(f"- {note}")
            for photo in extra_photos:
                if images_used >= MAX_TOTAL_IMAGES:
                    break
                contents.append(
                    types.Part.from_bytes(data=base64.b64decode(photo.data), mime_type=photo.mime_type)
                )
                images_used += 1

        return self._generate_structured(contents, Story)


@lru_cache
def get_trip_provider() -> TripProvider:
    provider_name = os.environ.get("AI_PROVIDER", "mock").strip().lower()
    if provider_name == "openai":
        logger.info("Using OpenAITripProvider (%s)", MODEL_TARGET)
        return OpenAITripProvider()
    if provider_name == "gemini":
        logger.info("Using GeminiTripProvider (%s)", GEMINI_MODEL_TARGET)
        return GeminiTripProvider()
    logger.info("Using MockTripProvider")
    return MockTripProvider()
