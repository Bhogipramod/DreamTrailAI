# DreamTrail AI — Business & Functional Requirements (MVP)

## 1. Product Definition

DreamTrail AI is an emotion-first travel planning web app. A user describes the experience they want (for example, a quiet solo reset or a romantic food-focused anniversary), and the app produces a practical, personalised trip plan, budget, and travel story.

**MVP outcome:** a user can submit travel preferences, receive a coherent AI-generated itinerary and budget, revise it, and generate a memory-led pre-trip story. Receipt processing and post-trip stories are optional stretch features.

## 2. Goals and Non-goals

### Goals

- Translate a natural-language travel wish into structured trip preferences.
- Recommend a destination and a day-by-day itinerary that are practical for the user's duration and budget.
- Explain why recommendations fit the desired experience.
- Make budget trade-offs visible and offer alternatives when a plan exceeds the budget.
- Present a polished, responsive, demo-ready experience.

### Non-goals for the MVP

- Booking or payment processing.
- Guaranteed real-time prices, availability, weather, or venue opening hours.
- Banking/email integrations.
- Full receipt OCR accuracy or automated expense extraction.
- Offline, group-planning, and social-sharing functionality.

## 3. Users

| User | Need | Primary value |
| --- | --- | --- |
| Traveller | Plan a meaningful trip quickly without knowing the destination first. | Personalised, actionable trip concept. |
| Budget-conscious traveller | See whether a desired experience is affordable and what can change. | Transparent estimate and alternatives. |
| Story-oriented traveller | Imagine and preserve the emotional arc of a journey. | AI-written travel story. |

## 4. Primary User Journey

1. User opens the landing page and selects **Plan my trip**.
2. User describes the experience they want and completes essential trip details.
3. The system analyses intent and shows a short preference summary for confirmation.
4. The system generates a destination recommendation, itinerary, and budget.
5. User reviews the plan, asks for a revision, or adjusts a constraint such as budget, dates, pace, or destination.
6. The system regenerates the affected plan and budget.
7. User selects a story style and generates a pre-trip story.
8. User may save the trip when authentication is enabled; otherwise the session remains usable for the active browser session.

## 5. Functional Requirements

### FR-01 — Travel preference intake (Must)

The system shall collect the following inputs:

- Free-text prompt: “What story do you want to live?” (required; minimum 10 characters).
- Origin city/airport (required).
- Date range or trip duration in days (at least one required).
- Traveller count (required; default 1).
- Total budget and currency (required; INR is the default currency).
- Destination preference: open to suggestions, a country/state/region scope, or a specific destination (required).
- Travel pace: relaxed, balanced, or packed (required; default balanced).
- Optional interests (food, nature, culture, adventure, photography, wellness, nightlife, etc.).
- Optional accommodation preference and accessibility needs.

Validation shall identify missing/invalid fields before generation. The UI shall state that all cost figures are estimates.

### FR-02 — Emotion and preference analysis (Must)

The system shall transform the user input into a structured preference profile containing:

- Primary emotional intent and up to three supporting themes.
- Travel style, pace, and relevant interests.
- Budget sensitivity.
- Constraints and assumptions.

The user shall see this profile as an editable summary before or alongside generation. The app must not expose hidden model reasoning.

### FR-03 — Destination recommendation (Must)

The system shall recommend one primary destination. It may show up to two alternatives.

Each recommendation shall include destination name, short rationale, suitability highlights, approximate budget fit, and a clear disclaimer if costs are estimated rather than live. If the requested constraints cannot be met, the system shall explain why and propose a closest-fit alternative.

### FR-04 — Itinerary generation (Must)

The system shall generate a complete itinerary for each day of the requested trip duration. Each day shall include:

- Morning, afternoon, and evening plan.
- Activity/experience name, short description, and category.
- Local or emotional-fit rationale.
- Estimated activity and local-transport costs.
- Suggested meal or local experience where relevant.
- At least one suggested photo/memory moment for the trip.

The itinerary must respect the selected pace, traveller count, budget, and stated constraints. It shall avoid presenting invented bookings, real-time availability, or confirmed prices as facts.

### FR-05 — Revision controls (Must)

The user shall be able to request a revision through either quick controls or free-text instructions. Supported quick revisions: lower budget, slower/faster pace, more/less adventure, more/less culture, change destination, and replace an activity.

The system shall preserve unaffected user preferences and identify what changed in the updated plan.

### FR-06 — Budget planning (Must)

The system shall create a total estimated budget, per traveller and for the group, broken down into:

- Transportation to/from destination (if included in assumptions).
- Local transportation.
- Accommodation.
- Food.
- Activities.
- Shopping/other.
- Emergency reserve.

It shall display planned total, user budget, remaining amount or overage, and assumptions. When over budget, it shall provide at least three actionable optimisation suggestions with estimated savings and impact on experience.

### FR-07 — Travel story generation (Must)

The user shall select one style: cinematic, fantasy, watercolor, documentary, or animation.

The system shall create a pre-trip story based on the trip plan and preference profile. It must clearly label the story as fictional/inspirational and not state unverified events as having occurred.

### FR-08 — Save and retrieve trips (Should)

MVP1 shall provide a lightweight welcome/login-style screen that captures a display name only; it is not authentication and shall not request or validate a password. The generated trip remains available for the active browser session only. Persistent saved trips and real authentication are post-MVP capabilities.

### FR-09 — Expense tracking (Stretch)

The MVP may allow a user to upload a receipt/invoice image or PDF and manually confirm the extracted amount, date, vendor, and category. The system shall then update actual spend against planned budget. Email inbox and banking access are out of scope.

### FR-10 — Post-trip story (Stretch)

The system may accept user notes and uploaded photos/captions to generate a post-trip story. It must use only user-provided data and the saved trip, and obtain confirmation before including uploaded personal content.

## 6. Screens and UI States

| Screen | Required content/actions |
| --- | --- |
| Landing | Product message, sample inspiration, primary CTA. |
| Trip intake | Prompt and structured fields; inline validation; submit action. |
| Generation | Progress state with clear stages: understanding, planning, budgeting, crafting story. |
| Plan overview | Destination, preference summary, itinerary, budget summary, revise control. |
| Itinerary detail | Day selector; activity cards; cost and rationale. |
| Budget detail | Category breakdown, planned vs budget, optimisations. |
| Story | Style chooser, generate/regenerate, labelled story output. |
| Saved trips (if enabled) | Trip list and reopen/delete controls. |

The interface must work on mobile widths and desktop, provide loading/error/empty states, and meet basic keyboard and contrast accessibility expectations.

## 7. Data Requirements

Minimum entities:

| Entity | Key fields |
| --- | --- |
| User | id, email, createdAt. |
| Trip | id, userId (nullable), title, status, origin, destination, dates/duration, travellerCount, currency, budget, pace, prompt, preferences, createdAt, updatedAt. |
| ItineraryDay | id, tripId, dayNumber, theme, estimatedDailyCost. |
| ItineraryItem | id, itineraryDayId, timeOfDay, title, description, category, rationale, estimatedCost, locationText. |
| Budget | id, tripId, totalEstimated, userBudget, variance, assumptions. |
| BudgetLineItem | id, budgetId, category, estimatedAmount, actualAmount (nullable). |
| Story | id, tripId, stage (pre/post), style, content, createdAt. |
| Expense (stretch) | id, tripId, source, vendor, amount, currency, date, category, status. |

AI-generated structured data must be validated against a server-side schema before storage and rendering.

## 8. AI Orchestration Requirements

The backend shall use specialised services/agents, coordinated by one orchestration endpoint:

1. **Emotion service:** input → structured preference profile.
2. **Itinerary service:** preference profile + constraints → destination and itinerary.
3. **Budget service:** itinerary + trip inputs → category budget and optimisations.
4. **Story service:** approved trip data + selected style → story.

The orchestration layer shall pass structured JSON between services, log a request/correlation ID, enforce timeouts, and return a user-friendly fallback error if any service fails. The user-facing response shall contain the final validated plan, not raw agent messages.

## 9. Non-functional Requirements

- **Performance:** show a progress state within 1 second; target complete plan generation within 30 seconds under normal API conditions.
- **Reliability:** failed generation must be retryable without losing submitted inputs.
- **Security:** API keys remain server-side; authenticated trips are only accessible by their owner; upload types and sizes are validated.
- **Privacy:** collect only required travel details; provide deletion of saved trips/user data when authentication is available.
- **Quality:** all monetary values display currency, “estimate” status, and assumptions; generated content must be safe for display and schema-valid.
- **Observability:** record request IDs, agent duration, error type, and generation version without logging secrets.

## 10. API Contract (MVP)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/trips/generate` | Validate intake, orchestrate agents, create/return plan. |
| `POST /api/trips/{id}/revise` | Apply revision instruction/controls and return updated plan. |
| `GET /api/trips/{id}` | Retrieve a saved trip. |
| `GET /api/trips` | List the current user's saved trips. |
| `POST /api/trips/{id}/stories` | Generate/regenerate a story for selected style. |
| `POST /api/trips/{id}/expenses` | Stretch: upload/process an expense. |

All write endpoints shall validate inputs, return stable structured JSON, and provide a readable error code/message. Authentication is required for persistence endpoints; generation may support anonymous session mode.

## 11. Acceptance Criteria for Hackathon Demo

1. Given valid trip inputs, a user receives a destination, complete daily itinerary, and budget in one cohesive result.
2. Every itinerary day contains at least three time-of-day activities and cost estimates.
3. The plan visibly explains the emotional fit for the destination and/or key activities.
4. The budget shows categories, total estimate, user budget, and variance.
5. An over-budget scenario shows at least three alternatives that retain the intended experience where possible.
6. A user can revise a plan and sees the updated itinerary/budget without re-entering all inputs.
7. A user can generate a labelled pre-trip story in one of the five styles.
8. The application handles loading, invalid inputs, and generation failures gracefully on mobile and desktop.
9. The demo can show the orchestration stages or trace in a developer/demo mode without exposing prompts, secrets, or hidden reasoning.

## 12. Decisions Required Before Development

1. Will destination and cost content be AI-estimated only, sourced from a static curated dataset, or connected to live third-party APIs?
2. Is sign-in and persistent saved trips required for the hackathon demo, or can the app be session-only?
3. Which origin markets/currencies must be supported initially?
4. Are flight costs included in the initial budget, and if so, what estimate source/assumption is acceptable?
5. Should the MVP use only text stories, or include generated images as a stretch goal?
6. What is the maximum acceptable generation time and fallback behaviour when an AI provider fails?

## 13. Delivery Priority

**P0 — must be demo-complete:** FR-01 through FR-07, lightweight display-name entry (not authentication), generated plan persistence in-session, responsive UI, validation/loading/error handling.

**P1 — implement if time allows:** authentication and saved trips (FR-08), receipt upload/manual confirmation (FR-09).

**P2 — post-hackathon:** post-trip storytelling from memories (FR-10), live travel data, booking, banking/email integrations, maps, weather, voice, and group planning.
