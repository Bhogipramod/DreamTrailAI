# DreamTrail AI — Two-Developer MVP1 Plan

## Stack and MVP Boundaries

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, browser `sessionStorage`.
- **Backend:** Python 3.11+, FastAPI, Pydantic, Uvicorn.
- **AI mode now:** deterministic mock trip generator.
- **AI mode before submission:** OpenAI Responses API using GPT-5.6, called only by FastAPI.
- **Out of scope:** database, real authentication, payments, booking, live travel prices, receipt extraction, maps, weather, and generated images.

### Prerequisites

- Install Node.js **20 LTS or newer** for the React/Vite toolchain. Node.js is not used as a backend.
- Install Python 3.11+.
- Use Git/GitHub before parallel development begins.

## Shared Product Contract (agree before coding)

### Inputs to `POST /api/trips/generate`

```json
{
  "displayName": "Priya",
  "travelPrompt": "A peaceful, photography-focused break close to nature",
  "origin": "Bengaluru, India",
  "durationDays": 4,
  "travellerCount": 1,
  "budget": 30000,
  "currency": "INR",
  "destinationScope": "Kerala, India",
  "pace": "relaxed",
  "interests": ["nature", "photography", "wellness"]
}
```

### Required response shape

```json
{
  "tripId": "local-uuid",
  "preferenceSummary": {
    "emotionalIntent": "restorative exploration",
    "themes": ["nature", "slow travel"],
    "pace": "relaxed"
  },
  "destination": {
    "name": "Wayanad, Kerala",
    "country": "India",
    "rationale": "...",
    "estimatedFit": "Within budget"
  },
  "itinerary": [
    {
      "day": 1,
      "theme": "Arrival and reset",
      "items": [
        {
          "timeOfDay": "morning",
          "title": "...",
          "description": "...",
          "category": "wellness",
          "rationale": "...",
          "estimatedCost": 0,
          "photoMoment": "..."
        }
      ],
      "estimatedDailyCost": 0
    }
  ],
  "budget": {
    "currency": "INR",
    "userBudget": 30000,
    "estimatedTotal": 28500,
    "variance": -1500,
    "lineItems": [
      { "category": "Accommodation", "amount": 0 }
    ],
    "assumptions": ["Estimated, not live pricing"],
    "optimizations": [
      { "title": "...", "estimatedSaving": 0, "impact": "..." }
    ]
  },
  "story": {
    "style": "cinematic",
    "title": "...",
    "content": "...",
    "disclaimer": "An inspirational pre-trip story based on your planned journey."
  },
  "generationMode": "mock"
}
```

All fields must be typed on the frontend and represented by Pydantic models on the backend. Keep this contract stable.

## Developer A — Backend & AI Domain

### Ownership

`backend/` and backend API documentation. Developer A owns FastAPI route design, input validation, mock generation logic, error responses, and the later GPT-5.6 replacement.

### Tasks

1. Create FastAPI app with health endpoint: `GET /api/health`.
2. Define Pydantic request/response models matching the shared contract.
3. Implement `POST /api/trips/generate`.
4. Implement deterministic mock stages: preference analysis, destination/itinerary, budget, story.
5. Make mock data react to destination scope, duration, budget, pace, and interests.
6. Implement `POST /api/trips/revise` using the original request plus a revision instruction.
7. Add CORS configuration for the React development origin.
8. Add unit tests for schema validation and over-budget optimisation behaviour.
9. Add `README` instructions for Python environment setup and running the API.

### Done when

- Both endpoints return valid JSON matching the contract.
- Invalid input returns a readable 4xx validation response.
- A realistic plan is returned for at least three sample trip profiles.
- `generationMode: "mock"` is included in every mock result.

### Later GPT-5.6 task (do not begin until API access is confirmed)

- Add a provider interface with `MockTripProvider` and `OpenAITripProvider`.
- Keep prompts and `OPENAI_API_KEY` server-only.
- Use structured output/validation and retain the same response contract.
- Change `generationMode` to `gpt-5.6` for live calls.

## Developer B — Frontend & Experience

### Ownership

`frontend/` and visual/design decisions. Developer B owns screens, responsive UI, browser-session persistence, API integration, and user-facing states.

### Tasks

1. Create React + TypeScript + Vite application and Tailwind setup.
2. Build a welcome screen which stores a display name locally; this is not authentication.
3. Build the trip-input form with required validation and country/state/destination scope field.
4. Create progress UI showing: Understanding your travel mood → Designing your trail → Balancing your budget → Writing your story.
5. Implement plan overview with destination rationale and emotion summary.
6. Build itinerary view with daily cards, time-of-day activities, cost, and photo-memory moment.
7. Build budget dashboard with category split, planned vs budget, assumptions, and optimisation suggestions.
8. Build memory-story view with style selector and regenerate action.
9. Add revision quick actions: reduce budget, slower pace, more adventure, more culture, change destination; plus free-text revision.
10. Persist current request/result in `sessionStorage`, and restore it after refresh.
11. Provide polished loading, error, empty, mobile, keyboard, and contrast states.

### Done when

- The user can complete the core flow on mobile and desktop.
- UI reads only the shared response contract; no duplicated business logic.
- A failed API request retains form inputs and presents a retry action.
- All monetary figures include the selected currency and estimate disclaimer.

## Joint Integration Responsibilities

1. Agree on the contract before scaffold work starts; update it together if required.
2. Use a branch per feature; do not edit the other developer's owned directory without agreement.
3. Integrate the frontend against a saved mock JSON fixture first, then against FastAPI.
4. Hold a 15-minute integration check after each completed API endpoint/UI screen.
5. Run a full demo path before merging: welcome → form → generate → revise → story → refresh.

## Recommended Git Workflow

```text
main
├── feature/backend-api-mocks       (Developer A)
├── feature/frontend-trip-flow      (Developer B)
└── feature/integration-polish      (joint, after both features work)
```

- Protect `main`; merge only reviewed, working pull requests.
- Developer A merges the API contract/models first.
- Developer B can build against `docs/trip-plan.fixture.json` until API is ready.
- Merge frontend and backend independently, then use the joint integration branch for API URL/configuration and final polish.

## Suggested Four-Day Schedule

| Day | Developer A | Developer B | Joint checkpoint |
| --- | --- | --- | --- |
| 1 | FastAPI scaffold, models, mock plan endpoint | React scaffold, design tokens, welcome/form | Approve API contract and sample fixture |
| 2 | Budget/revision endpoint, validation tests | Results, itinerary, budget screens | Connect generation endpoint |
| 3 | Improve mock quality, errors, prepare GPT provider boundary | Story, revisions, responsive/error polish | Full demo-path test |
| 4 | GPT-5.6 integration if API is funded; backend QA | Demo polish, video path, README visuals | Submission rehearsal and README review |

## Definition of MVP1 Done

- User chooses a country/state scope or leaves destination open.
- User submits an emotion-led trip prompt and required constraints.
- App returns a destination, daily itinerary, INR/default currency budget, optimisation guidance, and a memory-led story.
- User revises the plan without re-entering all information.
- The plan survives a browser refresh in the same session.
- App is responsive and works entirely with mock mode until GPT-5.6 is enabled.
