export type Pace = "relaxed" | "balanced" | "packed";
export type StoryStyle = "cinematic" | "fantasy" | "watercolor" | "documentary" | "animation";

export interface TripRequest {
  display_name: string;
  travel_prompt: string;
  origin: string;
  duration_days: number;
  traveller_count: number;
  budget: number;
  currency: string;
  destination_scope: string;
  pace: Pace;
  interests: string[];
  story_style: StoryStyle;
}

export interface TripPlan {
  trip_id: string;
  preference_summary: { emotional_intent: string; themes: string[]; pace: Pace };
  destination: { name: string; country: string; rationale: string; estimated_fit: string };
  itinerary: Array<{ day: number; theme: string; estimated_daily_cost: number; items: Array<{ time_of_day: string; title: string; description: string; category: string; rationale: string; estimated_cost: number; photo_moment: string }> }>;
  budget: { currency: string; user_budget: number; estimated_total: number; variance: number; line_items: Array<{ category: string; amount: number }>; assumptions: string[]; optimizations: Array<{ title: string; estimated_saving: number; impact: string }> };
  story: { style: StoryStyle; title: string; content: string; disclaimer: string };
  generation_mode: string;
}
