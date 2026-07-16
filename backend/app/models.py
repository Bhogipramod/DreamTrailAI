from __future__ import annotations

from enum import Enum
from typing import List
from uuid import uuid4

from pydantic import BaseModel, Field


class Pace(str, Enum):
    RELAXED = "relaxed"
    BALANCED = "balanced"
    PACKED = "packed"


class StoryStyle(str, Enum):
    CINEMATIC = "cinematic"
    FANTASY = "fantasy"
    WATERCOLOR = "watercolor"
    DOCUMENTARY = "documentary"
    ANIMATION = "animation"


class TripRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    travel_prompt: str = Field(min_length=10, max_length=1000)
    origin: str = Field(min_length=2, max_length=120)
    duration_days: int = Field(ge=1, le=14)
    traveller_count: int = Field(default=1, ge=1, le=12)
    budget: int = Field(ge=1000, le=5_000_000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    destination_scope: str = Field(default="Open to suggestions", max_length=120)
    pace: Pace = Pace.BALANCED
    interests: List[str] = Field(default_factory=list, max_length=8)
    story_style: StoryStyle = StoryStyle.CINEMATIC


class PreferenceSummary(BaseModel):
    emotional_intent: str
    themes: List[str]
    pace: Pace


class Destination(BaseModel):
    name: str
    country: str
    rationale: str
    estimated_fit: str


class ItineraryItem(BaseModel):
    time_of_day: str
    title: str
    description: str
    category: str
    rationale: str
    estimated_cost: int
    photo_moment: str


class ItineraryDay(BaseModel):
    day: int
    theme: str
    items: List[ItineraryItem]
    estimated_daily_cost: int


class BudgetLineItem(BaseModel):
    category: str
    amount: int


class Optimization(BaseModel):
    title: str
    estimated_saving: int
    impact: str


class BudgetPlan(BaseModel):
    currency: str
    user_budget: int
    estimated_total: int
    variance: int
    line_items: List[BudgetLineItem]
    assumptions: List[str]
    optimizations: List[Optimization]


class Story(BaseModel):
    style: StoryStyle
    title: str
    content: str
    disclaimer: str


class TripPlan(BaseModel):
    trip_id: str = Field(default_factory=lambda: str(uuid4()))
    preference_summary: PreferenceSummary
    destination: Destination
    itinerary: List[ItineraryDay]
    budget: BudgetPlan
    story: Story
    generation_mode: str = "mock"


class RevisionRequest(BaseModel):
    trip: TripRequest
    instruction: str = Field(min_length=3, max_length=300)
