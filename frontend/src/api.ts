import { TripRequest, TripPlan, Story, StoryStyle } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) {
      // FastAPI validation error shape
      return body.detail.map((d: any) => d.msg).join('; ');
    }
  } catch {
    // response wasn't JSON; fall through
  }
  return fallback;
}

// 1. Generate new plan
export async function generateTripPlan(requestData: TripRequest): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to generate trail.'));
  return res.json();
}

// 2. Revise existing plan. The backend is stateless, so we resend the
// full original request alongside the free-text instruction.
export async function reviseTripPlan(requestData: TripRequest, instruction: string): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip: requestData, instruction }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to revise your trail.'));
  return res.json();
}

// 3. Regenerate only the story, keeping the itinerary/budget the user is
// already viewing untouched.
export async function regenerateStory(requestData: TripRequest, style: StoryStyle): Promise<Story> {
  const res = await fetch(`${API_BASE_URL}/api/trips/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip: { ...requestData, story_style: style }, style }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to craft narrative changes.'));
  return res.json();
}
