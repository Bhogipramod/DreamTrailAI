# MemoryTrip

MemoryTrip turns an emotion-led travel wish into a destination recommendation, day-by-day itinerary, budget, and memory-led story.

## MVP1 stack

- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI + Pydantic
- Persistence: Browser session storage
- AI mode: Dynamic mock generator now; GPT-5.6 server provider later

## Run locally

### Backend

Requires Python 3.11+.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

Requires Node.js 20+.

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (normally `http://localhost:5173`). The frontend expects the API at `http://localhost:8000` by default.

## Documentation

- [Business requirements](BUSINESS_REQUIREMENTS.md)
- [Two-developer plan](DEVELOPER_PLAN.md)

## Before hackathon submission

Replace the mock provider in `backend/app/services/trip_provider.py` with a server-side GPT-5.6 provider. Do not put API keys in the frontend or commit `.env` files.
