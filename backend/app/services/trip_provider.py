import os
import logging
from openai import AsyncOpenAI
from app.schemas import (
    TripRequest, PreferenceSummary, Destination, ItineraryDay, 
    BudgetPlan, Story, TripPlan
)

logger = logging.getLogger("DreamTrailOrchestrator")

# Initialize the official Async client
# It will automatically pick up the OS environment variable: os.environ.get("OPENAI_API_KEY")
client = AsyncOpenAI()

# We utilize the newly released GPT-5.6 frontier intelligence model family
MODEL_TARGET = "gpt-5.6-sol" 

class EmotionService:
    @staticmethod
    async def process(request: TripRequest, correlation_id: str) -> PreferenceSummary:
        logger.info(f"[{correlation_id}] Emotion Agent invoking {MODEL_TARGET}")
        
        completion = await client.beta.chat.completions.parse(
            model=MODEL_TARGET,
            messages=[
                {"role": "system", "content": "You are a psychological travel assistant. Deconstruct the user input prompt into deep emotional intents, underlying themes, and rhythm expectations."},
                {"role": "user", "content": f"Prompt: {request.travel_prompt}. Specified Interests: {request.interests}. Pace: {request.pace}"}
            ],
            response_format=PreferenceSummary,
        )
        return completion.choices[0].message.parsed

class ItineraryService:
    @staticmethod
    async def process(request: TripRequest, prefs: PreferenceSummary, correlation_id: str) -> tuple[Destination, list[ItineraryDay]]:
        logger.info(f"[{correlation_id}] Itinerary Agent mapping geographical targets with {MODEL_TARGET}")
        
        # Helper schema to pull multiple items out of a single model pass smoothly
        class TempItineraryStructure(BaseModel):
            destination: Destination
            itinerary: list[ItineraryDay]

        prompt_context = (
            f"Target Scope: {request.destination_scope}. Origin: {request.origin}. "
            f"Duration: {request.duration_days} days. Number of travelers: {request.traveller_count}. "
            f"Emotional profiles extracted: Intent='{prefs.emotional_intent}', Themes={prefs.themes}, Pace={prefs.pace}."
        )

        completion = await client.beta.chat.completions.parse(
            model=MODEL_TARGET,
            messages=[
                {"role": "system", "content": f"You are a master travel planner. Generate a targeted destination configuration and a highly detailed daily itinerary list with exactly {request.duration_days} unique days mapping day numbers 1 to {request.duration_days}."},
                {"role": "user", "content": prompt_context}
            ],
            response_format=TempItineraryStructure,
        )
        parsed_data = completion.choices[0].message.parsed
        return parsed_data.destination, parsed_data.itinerary

class BudgetService:
    @staticmethod
    async def process(request: TripRequest, itinerary: list[ItineraryDay], correlation_id: str) -> BudgetPlan:
        logger.info(f"[{correlation_id}] Budget Agent computing fiscal distributions.")
        
        # Turn structural days into textual mapping data so the model understands the layout
        itinerary_summary = "\n".join([f"Day {d.day}: {d.theme}" for d in itinerary])

        completion = await client.beta.chat.completions.parse(
            model=MODEL_TARGET,
            messages=[
                {"role": "system", "content": "You are a financial travel analyst. Calculate totals, track cost variances against user limits, map line items, and extract strategic optimizations."},
                {"role": "user", "content": f"Total Budget Pool: {request.budget} {request.currency}. Itinerary Overview:\n{itinerary_summary}"}
            ],
            response_format=BudgetPlan,
        )
        return completion.choices[0].message.parsed

class StoryService:
    @staticmethod
    async def process(dest: Destination, prefs: PreferenceSummary, style: str, correlation_id: str) -> Story:
        logger.info(f"[{correlation_id}] Story Agent assembling descriptive narrative prose.")
        
        completion = await client.beta.chat.completions.parse(
            model=MODEL_TARGET,
            messages=[
                {"role": "system", "content": f"You are a creative travel essayist. Write a rich, immersive travel narrative summary focusing on the target destination in a distinct '{style}' formatting style wrapper."},
                {"role": "user", "content": f"Destination: {dest.name}, {dest.country}. Traveler Intent parameters: {prefs.emotional_intent}."}
            ],
            response_format=Story,
        )
        return completion.choices[0].message.parsed