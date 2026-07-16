from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Tuple

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
    TripPlan,
    TripRequest,
)


class TripProvider(ABC):
    @abstractmethod
    def generate(self, request: TripRequest) -> TripPlan:
        raise NotImplementedError


class MockTripProvider(TripProvider):
    """Predictable, input-sensitive generator used until the live AI provider is enabled."""

    DESTINATIONS = {
        "kerala": ("Wayanad", "India", "misty hills, forest trails, and unhurried local life"),
        "goa": ("South Goa", "India", "quiet beaches, coastal food, and golden-hour walks"),
        "rajasthan": ("Udaipur", "India", "lake reflections, living heritage, and warm evening light"),
        "himachal": ("Tirthan Valley", "India", "river paths, mountain calm, and village-scale adventure"),
        "japan": ("Kyoto", "Japan", "ritual, gardens, and intimate cultural moments"),
    }

    def generate(self, request: TripRequest) -> TripPlan:
        intent, themes = self._preference_profile(request)
        destination, country, character = self._destination(request)
        itinerary = self._itinerary(request, destination, character, themes)
        budget = self._budget(request, itinerary)
        story = self._story(request, destination, themes)
        return TripPlan(
            preference_summary=PreferenceSummary(
                emotional_intent=intent, themes=themes, pace=request.pace
            ),
            destination=Destination(
                name=destination,
                country=country,
                rationale=(
                    f"{destination} fits your wish for {intent}: it offers {character} "
                    f"at a {request.pace.value} pace."
                ),
                estimated_fit=(
                    "Within your stated budget" if budget.variance >= 0 else "Slightly above budget - see savings ideas"
                ),
            ),
            itinerary=itinerary,
            budget=budget,
            story=story,
        )

    def _preference_profile(self, request: TripRequest) -> Tuple[str, List[str]]:
        prompt = request.travel_prompt.lower()
        if any(word in prompt for word in ("peace", "calm", "heal", "rest", "quiet")):
            return "a restorative escape", ["slow travel", "stillness", "mindful moments"]
        if any(word in prompt for word in ("romantic", "anniversary", "love")):
            return "a shared romantic memory", ["togetherness", "beautiful evenings", "local flavour"]
        if any(word in prompt for word in ("adventure", "road", "trek", "thrill")):
            return "an energising adventure", ["movement", "nature", "small discoveries"]
        return "a meaningful change of scene", ["curiosity", "local connection", "new memories"]

    def _destination(self, request: TripRequest) -> Tuple[str, str, str]:
        search_text = f"{request.destination_scope} {request.travel_prompt}".lower()
        for key, destination in self.DESTINATIONS.items():
            if key in search_text:
                return destination
        if "beach" in search_text:
            return self.DESTINATIONS["goa"]
        if "mountain" in search_text or "nature" in search_text:
            return self.DESTINATIONS["himachal"]
        return self.DESTINATIONS["kerala"]

    def _itinerary(
        self, request: TripRequest, destination: str, character: str, themes: List[str]
    ) -> List[ItineraryDay]:
        interest = request.interests[0] if request.interests else "local culture"
        pace_note = "Leave spacious pauses between experiences." if request.pace == Pace.RELAXED else "Keep the day active but realistic."
        days: List[ItineraryDay] = []
        for day_number in range(1, request.duration_days + 1):
            is_first = day_number == 1
            theme = "Arrival and exhale" if is_first else f"A deeper day in {destination}"
            base = 500 + (day_number * 120)
            items = [
                ItineraryItem(
                    time_of_day="Morning",
                    title="A quiet local beginning" if is_first else f"{interest.title()} morning experience",
                    description=f"Start with an unhurried introduction to {character}.",
                    category=interest,
                    rationale=f"This keeps the journey rooted in {themes[0]}.",
                    estimated_cost=base,
                    photo_moment="Frame the first light, a small detail, and the place before the day begins.",
                ),
                ItineraryItem(
                    time_of_day="Afternoon",
                    title="Choose-your-own local trail",
                    description=f"Follow a flexible experience shaped by your {request.pace.value} pace.",
                    category="experience",
                    rationale=pace_note,
                    estimated_cost=base + 250,
                    photo_moment="Capture one candid moment that would be easy to forget later.",
                ),
                ItineraryItem(
                    time_of_day="Evening",
                    title="A memory-making meal",
                    description="Settle into a regional meal and reflect on the best moment of the day.",
                    category="food",
                    rationale="A shared ritual turns activity into memory.",
                    estimated_cost=base + 150,
                    photo_moment="Photograph the table, the light, or the person beside you - not just the food.",
                ),
            ]
            days.append(ItineraryDay(day=day_number, theme=theme, items=items, estimated_daily_cost=sum(item.estimated_cost for item in items)))
        return days

    def _budget(self, request: TripRequest, itinerary: List[ItineraryDay]) -> BudgetPlan:
        activity_total = sum(day.estimated_daily_cost for day in itinerary) * request.traveller_count
        accommodation = request.duration_days * 2200 * request.traveller_count
        food = request.duration_days * 900 * request.traveller_count
        local_transport = request.duration_days * 500 * request.traveller_count
        emergency = max(1000, int((activity_total + accommodation + food + local_transport) * 0.08))
        line_items = [
            BudgetLineItem(category="Accommodation", amount=accommodation),
            BudgetLineItem(category="Food", amount=food),
            BudgetLineItem(category="Local transportation", amount=local_transport),
            BudgetLineItem(category="Activities", amount=activity_total),
            BudgetLineItem(category="Emergency reserve", amount=emergency),
        ]
        total = sum(item.amount for item in line_items)
        return BudgetPlan(
            currency=request.currency.upper(),
            user_budget=request.budget,
            estimated_total=total,
            variance=request.budget - total,
            line_items=line_items,
            assumptions=["All costs are indicative estimates, not live prices.", "Inter-city transport is excluded unless stated in the itinerary."],
            optimizations=[
                Optimization(title="Choose a locally run stay", estimated_saving=max(500, accommodation // 10), impact="Keeps the local feel while reducing accommodation spend."),
                Optimization(title="Use shared local transport for one day", estimated_saving=max(250, local_transport // 4), impact="Slightly less flexible, but preserves key experiences."),
                Optimization(title="Keep one evening meal simple", estimated_saving=max(300, food // 8), impact="Retains the itinerary's most meaningful activity."),
            ],
        )

    def _story(self, request: TripRequest, destination: str, themes: List[str]) -> Story:
        return Story(
            style=request.story_style,
            title=f"The memory waiting in {destination}",
            content=(
                f"{request.display_name}, this is not a journey measured only in kilometres. In {destination}, "
                f"your days begin with {themes[0]} and end with small details worth carrying home. "
                f"Between them, there is room to notice what your everyday life usually rushes past. "
                "The story is waiting; you only have to step into its first scene."
            ),
            disclaimer="An inspirational pre-trip story based on your planned journey. It does not describe events that have happened.",
        )


def get_trip_provider() -> TripProvider:
    # The future OpenAITripProvider will be selected here using TRIP_PROVIDER.
    return MockTripProvider()
