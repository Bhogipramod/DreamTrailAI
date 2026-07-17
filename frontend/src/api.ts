import { TripRequest, TripPlan, SavedTripListItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 1. Generate new plan
export async function generateTripPlan(requestData: TripRequest): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  });
  if (!res.ok) throw new Error(await res.text() || 'Failed to generate trail.');
  return res.json();
}

// 2. Revise existing plan
export async function reviseTripPlan(id: string, instructions: string): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/${id}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions }),
  });
  if (!res.ok) throw new Error('Failed to revise your trail components.');
  return res.json();
}

// 3. Get single saved trip
export async function getSavedTrip(id: string): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/${id}`);
  if (!res.ok) throw new Error('Failed to retrieve the selected journey.');
  return res.json();
}

// 4. List all user trips
export async function listSavedTrips(): Promise<SavedTripListItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/trips`);
  if (!res.ok) throw new Error('Failed to look up saved history profiles.');
  return res.json();
}

// 5. Regenerate localized story narrative
export async function regenerateStory(id: string, style: string): Promise<TripPlan> {
  const res = await fetch(`${API_BASE_URL}/api/trips/${id}/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style }),
  });
  if (!res.ok) throw new Error('Failed to craft narrative changes.');
  return res.json();
}

// 6. Upload file expense extraction
export async function uploadExpenseReceipt(id: string, file: File): Promise<{ success: boolean; updated_budget: any }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/trips/${id}/expenses`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Receipt parsing error reported by extraction agent.');
  return res.json();
}