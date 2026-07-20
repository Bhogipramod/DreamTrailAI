# MemoryTrip

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

The provider boundary keeps the frontend independent of the AI implementation. During development, `MockTripProvider` returns realistic input-sensitive plans. For the final submission, `OpenAITripProvider` will call GPT-5.6 server-side and return the same validated response shape.

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

### Prerequisites

- Node.js 20 LTS or newer (required by React/Vite tooling)
- Python 3.11 or newer

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for interactive API documentation.

### Frontend

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

### Environment variables

Copy `backend/.env.example` to `backend/.env` when enabling the live AI provider. Never commit that file.

```text
TRIP_PROVIDER=mock
OPENAI_API_KEY=
```

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | API health/provider status. |
| `POST` | `/api/trips/generate` | Creates a complete travel plan from user preferences. |
| `POST` | `/api/trips/revise` | Re-generates a plan after a revision instruction. |

## Codex collaboration story

Codex was used as an active engineering collaborator throughout the project’s early development. Its contribution was not a single code-generation request; it helped shape the product and establish a buildable technical path.

1. **Requirements analysis:** Codex reviewed the original DreamTrail concept document and translated it into a developer-ready MVP specification. This clarified the user flow, mandatory inputs, budget rules, acceptance criteria, exclusions, and hackathon priorities.
2. **Product decisions:** Together, we reduced scope to a session-only MVP: no database, booking, live pricing, or real authentication. This protected time for the differentiated emotion-to-itinerary-to-story experience.
3. **Architecture:** Codex proposed the React/Vite + FastAPI split and a provider boundary so mock data could unblock development while preserving a clean path to GPT-5.6.
4. **Implementation:** Codex scaffolded the local frontend and backend, created typed Pydantic/TypeScript contracts, implemented the mock trip generator, added API routes, browser-session persistence, revision controls, loading/error states, and the responsive results experience.
5. **Quality and handoff:** Codex created the business requirements, two-developer plan, API contract, setup guide, and a static Python syntax check.

This collaboration allowed the team to spend its early hackathon time refining the travel experience rather than repeatedly rebuilding foundations.

## GPT-5.6 integration status and final-demo plan

**Current repository status:** the application is intentionally in `mock` mode. The mock provider exists so the full user experience can be developed and tested before API billing is enabled. GPT-5.6 must be enabled before submitting this project; it must not be claimed as live until that integration is complete.

For the final demo, the FastAPI backend will use the OpenAI Responses API with GPT-5.6 to perform four visible stages:

1. **Emotion profile:** convert the travel wish into intent, themes, travel style, pace, and constraints.
2. **Itinerary generation:** recommend a destination and structured daily plan that respects the selected scope and duration.
3. **Budget reasoning:** estimate categories, compare them with the user’s budget, and propose trade-offs.
4. **Memory-led story:** write an inspirational pre-trip narrative based only on the approved trip plan and selected style.

The response will be validated against the existing `TripPlan` schema before it is sent to the frontend. The OpenAI API key will remain on the server in an environment variable and will never be sent to the browser.

### Accurate final-submission wording after live integration

> GPT-5.6 powers MemoryTrip’s server-side travel-generation workflow. It interprets an emotion-led travel brief, produces a scoped destination and itinerary, reasons about the budget, and writes a memory-led pre-trip story. Structured validation ensures that the model’s output is rendered as a reliable, cohesive travel plan rather than raw chat text.



## Development documentation

- [Business requirements](BUSINESS_REQUIREMENTS.md)
- [Two-developer MVP1 plan](DEVELOPER_PLAN.md)


