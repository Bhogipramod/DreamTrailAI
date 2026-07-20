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

export interface PreferenceSummary {
  emotional_intent: string;
  themes: string[];
  pace: Pace;
}

export interface Destination {
  name: string;
  country: string;
  rationale: string;
  estimated_fit: string;
}

export interface ItineraryItem {
  time_of_day: string;
  title: string;
  description: string;
  category: string;
  rationale: string;
  estimated_cost: number;
  photo_moment: string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  items: ItineraryItem[];
  estimated_daily_cost: number;
}

export interface BudgetLineItem {
  category: string;
  amount: number;
}

export interface Optimization {
  title: string;
  estimated_saving: number;
  impact: string;
}

export interface BudgetPlan {
  currency: string;
  user_budget: number;
  estimated_total: number;
  variance: number;
  line_items: BudgetLineItem[];
  assumptions: string[];
  optimizations: Optimization[];
}

export interface Story {
  style: string;
  title: string;
  content: string;
  disclaimer: string;
}

export interface TripPlan {
  id: string;
  preference_summary: PreferenceSummary;
  destination: Destination;
  itinerary: ItineraryDay[];
  budget: BudgetPlan;
  story: Story;
  generation_mode: string;
}

// A trip request + the plan it produced. Saved trips retain both values so
// they can be restored or displayed with the preferences that produced them.
export interface SavedTrip {
  id: string;
  savedAt: number;
  request: TripRequest;
  plan: TripPlan;
}

// The active plan and all generated plans persisted for the browser session.
// `request` and `plan` are optional when the traveller has started another
// trail but has not generated it yet.
export interface PersistedSession {
  request?: TripRequest;
  plan?: TripPlan;
  savedTrips: SavedTrip[];
  activeSavedTripId?: string;
}
