import type { TripPlan, TripRequest } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? "Something went wrong. Please try again.");
  }
  return response.json() as Promise<T>;
}

export const generateTrip = (request: TripRequest) => post<TripPlan>("/api/trips/generate", request);
export const reviseTrip = (trip: TripRequest, instruction: string) => post<TripPlan>("/api/trips/revise", { trip, instruction });
