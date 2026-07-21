# DreamTrail AI

DreamTrail AI turns an emotion-led travel wish into a destination recommendation, day-by-day itinerary, budget, and memory-led story — powered by Google Gemini.

> **Plan the journey your heart remembers.**

DreamTrail AI is an emotion-first travel planning experience. Instead of asking users to choose a destination first, it starts with the memory they want to create: a quiet reset, a romantic celebration, an adventurous road trip, or a photography-led escape. It turns that intention into a destination recommendation, a practical day-by-day itinerary, a transparent budget, and a memory-led pre-trip story — then lets the traveller revisit it after the trip and turn their own photos and notes into a post-trip story.

## Hackathon submission summary

**Category:** Apps for life

**Project description:**

DreamTrail AI reframes travel planning as an act of storytelling. Users share what they want their journey to feel like, along with practical constraints such as origin, duration, budget, group size, pace, interests, and an optional country/state/destination scope. Google Gemini interprets this brief, recommends a fitting destination, builds a paced itinerary, estimates a category-based budget, suggests savings when needed, and writes a personal pre-trip story in the user's chosen style. After the trip, the traveller can add their own day-by-day photos and captions and have the same AI weave them into a labelled retrospective story.

The MVP deliberately prioritises a cohesive planning experience over booking logistics. All travel costs are labelled as estimates; the app does not claim live availability or confirmed bookings, and every AI-written story is clearly labelled as inspirational/retrospective rather than a verified account of real events.

## Why MemoryTrip

Most trip planners start from a destination. MemoryTrip starts from a feeling — the traveller describes the *experience* they want, and the AI works backward to a destination, itinerary, and budget that fit it. Every recommendation carries a stated rationale, every cost is labelled as an estimate, and every generated story is clearly marked as inspirational rather than fact, so the experience stays honest even as it stays personal.

## Features

- Emotion-led travel prompt: "What story do you want to live?"
- Optional destination scope: users can leave the destination open or specify a country, state, region, or city.
- AI-personalised destination recommendation and rationale.
- Daily itinerary with morning, afternoon, and evening activities.
- Suggested memory/photo moments and rationale for each activity.
- Category-based budget: accommodation, food, transport, activities, and emergency reserve.
- Practical optimisation suggestions when a plan exceeds the user's budget.
- Five story styles: cinematic, fantasy, watercolor, documentary, and animation.
- Revision actions: reduce budget, slow down the pace, add adventure/culture, change destination, or provide a free-text instruction — the AI regenerates the affected plan.
- **Post-trip memory story:** after the trip, the traveller can attach photos and captions to each itinerary day, optionally let the AI actually look at a capped number of photos, and generate a labelled retrospective story from their own material.
- **Saved trips:** each generated plan can be kept for the active session; a dedicated view lists saved trips and lets the traveller reopen any of them without regenerating.
- Session-based persistence: the current plan and saved trips are restored via browser `sessionStorage` during the active session; no database or user account is required for MVP1.

## Demo flow

1. Enter a display name (not an account — nothing is sent anywhere beyond this session).
2. Share your travel wish, origin, duration, budget, pace, and interests, and optionally narrow the destination to a country/state/region.
3. Generate the plan — Gemini produces the preference summary, destination, itinerary, budget, and story in one request.
4. Review the emotional intent, recommended destination, itinerary, and budget.
5. Revise the plan with a quick action (lower budget, slower pace, more culture, etc.) or a custom free-text request.
6. Read the memory-led pre-trip story, and switch its style on demand.
7. After the trip, add photos/captions per day under **Post-Trip Memories** and generate a retrospective story.
8. Save the trip and start another — reopen any saved trip later from **Saved Trips**.

## Technology

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS | Responsive interactive travel-planning UI. |
| Backend | Python, FastAPI, Pydantic | Typed API, request validation, AI orchestration boundary. |
| AI | Google Gemini, via the `google-genai` SDK | Generates the preference profile, destination, itinerary, budget, story, and post-trip story. Structured JSON output is validated straight into the app's Pydantic models, so the model can never return anything that doesn't match the shared contract. |
| Persistence | Browser `sessionStorage` | Retains the active plan and saved trips through a browser refresh, for the active session only. |

## Architecture

```text
React / Vite frontend
        |
        | POST /api/trips/generate | /revise | /story | /post-story
        v
FastAPI backend (app/main.py)
        |
        v
AI provider interface (app/services/trip_provider.py)
        |
        v
Google Gemini — structured JSON output
        |
        v
Validated TripPlan / Story JSON (Pydantic)
        |
        v
Itinerary, budget, revisions, and story UI
```

The AI call sits behind a single, well-defined interface, so the frontend never depends on model-specific details — it only reads the validated `TripPlan` / `Story` response. That boundary also keeps the API key and every prompt entirely server-side; nothing AI-related is ever sent to the browser.

## Project structure

```text
DreamTrail AI/
├── frontend/                          # React + TypeScript + Vite application
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js / postcss.config.js
│   └── src/
│       ├── App.tsx                    # Screens, tabs, revisions, saved trips, session persistence
│       ├── api.ts                     # FastAPI client (generate / revise / story / post-story)
│       ├── types.ts                   # Shared client-side contract
│       ├── imageUtils.ts              # Client-side photo resize before sending to Gemini
│       ├── styles.css                 # Visual design
│       └── Components/
│           ├── WelcomeScreen.tsx
│           ├── TripForm.tsx
│           ├── PreferenceSummaryCard.tsx
│           ├── ItineraryView.tsx
│           ├── BudgetView.tsx
│           ├── StoryView.tsx
│           └── PostTripStory.tsx
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI routes, CORS, error handling
│   │   ├── models.py                  # Pydantic request/response models (the shared contract)
│   │   └── services/
│   │       └── trip_provider.py       # Gemini integration and generation logic
│   ├── tests/
│   │   └── test_trip_api.py           # Schema validation and over-budget optimisation tests
│   ├── list_models.py                 # Lists Gemini models available to your API key
│   ├── requirements.txt
│   └── .env                           # Not committed — see setup below
├── BUSINESS_REQUIREMENTS.md
└── DEVELOPER_PLAN.md
```

## Run locally

### Prerequisites

- **Node.js 20 LTS or newer**
- **Python 3.11+**
- A **Gemini API key** (from Google AI Studio)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` (this file is git-ignored and never committed):

```properties
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-3.1-flash-lite   # optional; overrides the default model
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`; visit `http://localhost:8000/docs` for interactive API documentation. Confirm it's up:

```bash
curl http://localhost:8000/api/health
# {"status":"ok","provider":"gemini"}
```

Run the backend tests:

```bash
pytest tests/ -v
```

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
```

By default the frontend talks to `http://localhost:8000`. To point it elsewhere, create `frontend/.env`:

```properties
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | API health check. |
| `POST` | `/api/trips/generate` | Creates a complete travel plan from user preferences. |
| `POST` | `/api/trips/revise` | Re-generates a plan after a revision instruction, resending the original request (the backend is stateless). |
| `POST` | `/api/trips/story` | Regenerates only the story for an existing plan, in a chosen style. |
| `POST` | `/api/trips/post-story` | Weaves the traveller's own day-by-day captions (and optional photos) into a labelled post-trip story. |

## Built with AI-assisted development

Two different AI tools were part of this project, doing two different jobs — one during development, one at runtime for the live product.

**Codex and GPT — used to build the app:**

- **Requirements analysis:** translated the initial concept into a developer-ready MVP specification — user flow, mandatory inputs, budget rules, acceptance criteria, and scope boundaries.
- **Product decisions:** helped scope the MVP to a session-only experience (no database, booking, live pricing, or full authentication), protecting time for the core emotion-to-itinerary-to-story experience.
- **Architecture:** proposed the React/Vite + FastAPI split and a clean AI-orchestration boundary that keeps the frontend independent of the model implementation.
- **Implementation:** scaffolded the frontend and backend, built typed Pydantic/TypeScript contracts, implemented API routes, browser-session persistence, revision controls, loading/error states, and the responsive results UI.
- **Debugging and review:** used for code review passes, catching integration bugs (mismatched function signatures, invalid enum usage) and tightening error handling.
- **Quality and handoff:** produced the business requirements, developer plan, and API contract documentation.

**Google Gemini — powers the live app:**

Trip generation itself — the destination recommendation, itinerary, budget, and story writing the user actually sees at runtime — is powered by **Google Gemini** via the `google-genai` SDK, called server-side so the API key and prompts never reach the browser.

## Known limitations

- The generation-progress UI ("Understanding your mood → Designing your trail → Balancing your budget → Writing your story") is a fixed client-side sequence rather than a live trace of separate backend stages.
- Accommodation preference and accessibility-needs fields described in `BUSINESS_REQUIREMENTS.md` (FR-01) are not yet present in the intake form.
- All costs, availability, and story content are AI-generated estimates, not sourced from live travel data — this is called out in the UI and in every story's disclaimer.

## Development documentation

- [Business requirements](BUSINESS_REQUIREMENTS.md)
- [Two-developer MVP1 plan](DEVELOPER_PLAN.md)