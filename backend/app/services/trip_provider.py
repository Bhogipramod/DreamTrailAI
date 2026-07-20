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
from dotenv import load_dotenv
from pathlib import Path

import os
from functools import lru_cache
from google import genai
from google.genai import types

env_path = Path(__file__).resolve().parent.parent.parent / ".env"

load_dotenv(env_path)
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
        # Scope given but not recognised: keeping the user's wording, mocking a rationale.
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

    def revise_trip(
        self,
        request: TripRequest,
        current_plan: TripPlan,
        instruction: str,
        ) -> TripPlan:
        """
        Mock revision by tweaking the original request based on a few
        common revision instructions, then regenerating the trip.
        """

        revised_request = request.model_copy(deep=True)

        text = instruction.lower()

        if "budget" in text or "cheap" in text:
            revised_request.budget = max(100, int(revised_request.budget * 0.8))

        if "slower" in text or "relaxed" in text:
            revised_request.pace = Pace.relaxed

        if "faster" in text or "active" in text:
            revised_request.pace = Pace.active

        if "culture" in text and "culture" not in revised_request.interests:
            revised_request.interests.append("culture")

        if "adventure" in text and "adventure" not in revised_request.interests:
            revised_request.interests.append("adventure")

        if "food" in text and "food" not in revised_request.interests:
            revised_request.interests.append("food")

        return self.generate(revised_request)
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
# AI trip provider 
# --------------------------------------------------------------------------

MODEL_TARGET = "gemini-3.5-flash"


class GeminiTripProvider(TripProvider):
    generation_mode = "gemini"

    def __init__(self) -> None:
        try:
            from google import genai
        except ImportError as exc:
            raise RuntimeError(
                "google-genai package not installed. "
                "Run `pip install google-genai`."
            ) from exc

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")

        self._client = genai.Client(api_key=api_key)

    def generate(self, request: TripRequest) -> TripPlan:
        """Generates a complete structured TripPlan using Gemini."""

        prompt = f"""
        You are an expert AI travel planner and storyteller.
        Generate a complete travel plan based on the user's preferences.
        Return ONLY valid JSON that exactly matches the TripPlan schema.
        Do NOT include markdown, explanations, headings, or any extra text.
        User Preferences:
        -----------------
        Display Name: {request.display_name}
        Travel Prompt: {request.travel_prompt}
        Destination Scope: {request.destination_scope}
        Duration: {request.duration_days} days
        Travellers: {request.traveller_count}
        Budget: {request.budget} {request.currency}
        Currency: {request.currency}
        Preferred Pace: {request.pace}
        Interests: {", ".join(request.interests)}
        Story Style: {request.story_style}

        Requirements:
        -------------
        1. Understand the user's emotional intent from the travel prompt.
        2. Create a PreferenceSummary including:
        - emotional_intent
        - themes
        - pace

        3. Select the most suitable destination that best fits the request.
        4. Explain clearly why this destination was chosen.
        5. Provide an estimated fit for the destination.

        6. Generate a detailed itinerary for every day of the trip.
        Each day should include:
        - meaningful theme
        - multiple activities
        - realistic timings
        - estimated costs
        - category
        - rationale
        - memorable photo moments

        7. Create a realistic budget plan including:
        - transportation
        - accommodation
        - food
        - attractions
        - miscellaneous expenses

        8. Include practical assumptions used while estimating the budget.

        9. Suggest at least three optimization ideas to reduce costs without reducing the overall experience.

        10. Write an immersive travel story in the requested story style.
            The story should feel personal, emotional, and connected to the itinerary.

        11. Ensure:
            - Budget estimates are realistic.
            - Activities match the user's interests.
            - Pace matches the selected pace.
            - Total itinerary length matches the requested duration.
            - Story aligns with the destination and activities.

        Return ONLY valid JSON.
        """

        response = self._client.models.generate_content(
            model=MODEL_TARGET,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TripPlan,
            ),
        )

        return TripPlan.model_validate_json(response.text)

    def regenerate_story(self, request: TripRequest, style: StoryStyle) -> Story:
        """Regenerates only the story portion based on existing trip context."""
        prompt = f"""
        Rewrite the trip story for the following trip context:
        - Destination: {request.destination_scope}
        - User Interests: {', '.join(request.interests)}
        - New Story Style: {style}
        """

        response = self._client.models.generate_content(
            model=MODEL_TARGET,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=Story,
            ),
        )
        
        return Story.model_validate_json(response.text)

    def revise_trip(self,request: TripRequest,instruction: str,) -> TripPlan:
        """
        Revises an existing trip request according to the user's instruction
        and generates a new TripPlan.
        """

        prompt = f"""
        You are an expert AI travel planner.

        The user previously requested the following trip:

        Display Name: {request.display_name}
        Travel Prompt: {request.travel_prompt}
        Destination Scope: {request.destination_scope}
        Duration: {request.duration_days} days
        Travellers: {request.traveller_count}
        Budget: {request.budget} {request.currency}
        Currency: {request.currency}
        Preferred Pace: {request.pace}
        Interests: {", ".join(request.interests)}
        Story Style: {request.story_style}

        The user now wants to revise the trip.

        Revision Instruction:
        "{instruction}"

        Apply ONLY the requested changes while keeping everything else as consistent as possible.

        Examples:
        - "Reduce the budget" → keep destination if possible, choose cheaper hotels and activities.
        - "Make the pace slower" → reduce the number of activities each day.
        - "Add more adventure" → replace some activities with adventurous ones.
        - "Add more culture" → include museums, heritage sites, local experiences.
        - "Choose another destination" → select a better destination while respecting all other preferences.

        Requirements:
        -------------
        1. Preserve the user's original emotional intent.
        2. Apply the revision naturally.
        3. Generate a complete new TripPlan.
        4. Update itinerary, budget, destination, and story if necessary.
        5. Keep costs realistic.
        6. Story must reflect the revised itinerary.
        7. Return ONLY valid JSON matching the TripPlan schema.
        """

        response = self._client.models.generate_content(
            model=MODEL_TARGET,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TripPlan,
            ),
        )

        plan = TripPlan.model_validate_json(response.text)

    
        if hasattr(plan, "generation_mode"):
            plan.generation_mode = self.generation_mode

        return plan

@lru_cache
def get_trip_provider() -> TripProvider:
    print(os.getenv("AI_PROVIDER","mock"))
    provider_name = os.getenv("AI_PROVIDER").strip().lower()

    if provider_name == "gemini":
        logger.info("Using GeminiTripProvider (%s)", MODEL_TARGET)
        return GeminiTripProvider()

    logger.info("Using MockTripProvider")
    return MockTripProvider()
