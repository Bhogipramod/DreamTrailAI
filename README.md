# MemoryTrip

MemoryTrip turns an emotion-led travel wish into a destination recommendation, day-by-day itinerary, budget, and memory-led story.
> **Plan the journey your heart remembers.**

MemoryTrip is an emotion-first travel planning experience. Instead of asking users to choose a destination first, it starts with the memory they want to create: a quiet reset, a romantic celebration, an adventurous road trip, or a photography-led escape. It turns that intention into a destination recommendation, a practical day-by-day itinerary, a transparent budget, and a memory-led pre-trip story.

## Hackathon submission summary

**Category:** Select the category that best matches the final hackathon submission.

**Project description:**

MemoryTrip reframes travel planning as an act of storytelling. Users share what they want their journey to feel like, along with practical constraints such as origin, duration, budget, group size, pace, interests, and an optional country/state/destination scope. The application interprets this brief, recommends a fitting destination, builds a paced itinerary, estimates a category-based budget, suggests savings when needed, and writes a personal pre-trip story in the user’s chosen style.

The MVP deliberately prioritises a cohesive planning experience over booking logistics. All travel costs are labelled as estimates; the app does not claim live availability or confirmed bookings.

## Features

- Emotion-led travel prompt: “What story do you want to live?”
- Optional destination scope: users can leave the destination open or specify a country, state, region, or city.
- Personalised destination recommendation and rationale.
- Daily itinerary with morning, afternoon, and evening activities.
- Suggested memory/photo moments and rationale for each activity.
- Category-based budget: accommodation, food, transport, activities, and emergency reserve.
- Practical optimisation suggestions when a plan exceeds the user’s budget.
- Five story styles: cinematic, fantasy, watercolor, documentary, and animation.
- Revision actions: reduce budget, slow down the pace, add adventure/culture, change destination, or provide a free-text instruction.
- Session-based persistence: the current plan is restored during the active browser session; no database or user account is required for MVP1.

## Demo flow

1. Enter a display name, origin, travel wish, duration, budget, pace, and interests.
2. Optionally limit recommendations to a country, state, region, or destination.
3. Generate the MemoryTrip plan.
4. Review the emotional intent, recommended destination, itinerary, and budget.
5. Revise the plan with a quick action or custom request.
6. Read the memory-led pre-trip story.

## Technology

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Responsive interactive travel-planning UI. |
| Backend | Python, FastAPI, Pydantic | Typed API, validation, orchestration boundary. |
| Persistence | `sessionStorage` | Retains the active trip through a browser refresh. |
| Development provider | Deterministic mock provider | Supports UI/API development without an API key. |
| Final AI provider | OpenAI Responses API + GPT-5.6 | Generates the live preference profile, itinerary, budget, and story. |

## Architecture

```text
React / Vite frontend
        |
        | POST /api/trips/generate or /api/trips/revise
        v
FastAPI backend
        |
        v
Trip provider boundary
   |                    |
MockTripProvider   OpenAITripProvider (final demo)
        |
        v
Validated TripPlan JSON
        |
        v
Itinerary, budget, revisions, and story UI
```

## MVP1 stack
The provider boundary keeps the frontend independent of the AI implementation. During development, `MockTripProvider` returns realistic input-sensitive plans. For the final submission, `OpenAITripProvider` will call GPT-5.6 server-side and return the same validated response shape.

- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI + Pydantic
- Persistence: Browser session storage
- AI mode: Dynamic mock generator now; GPT-5.6 server provider later
## Project structure

```text
MemoryTrip/
├── frontend/                   # React + TypeScript + Vite application
│   └── src/
│       ├── App.tsx             # Form, loading states, results, revisions
│       ├── api.ts              # FastAPI client
│       ├── types.ts            # Shared client-side contract
│       └── styles.css          # Responsive visual design
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI routes and CORS
│   │   ├── models.py           # Pydantic request/response models
│   │   └── services/
│   │       └── trip_provider.py # Mock provider; GPT-5.6 extension point
│   ├── requirements.txt
│   └── .env.example
├── BUSINESS_REQUIREMENTS.md
└── DEVELOPER_PLAN.md
```

## Run locally