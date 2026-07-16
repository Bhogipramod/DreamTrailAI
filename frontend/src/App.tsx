import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateTrip, reviseTrip } from "./api";
import type { Pace, StoryStyle, TripPlan, TripRequest } from "./types";

const emptyRequest: TripRequest = {
  display_name: "", travel_prompt: "", origin: "", duration_days: 4, traveller_count: 1,
  budget: 30000, currency: "INR", destination_scope: "Open to suggestions", pace: "balanced",
  interests: ["nature", "photography"], story_style: "cinematic",
};
const interests = ["nature", "photography", "food", "culture", "adventure", "wellness"];
const stages = ["Understanding your travel mood", "Designing your trail", "Balancing your budget", "Writing your story"];
const formatMoney = (value: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export default function App() {
  const [request, setRequest] = useState<TripRequest>(() => JSON.parse(sessionStorage.getItem("memorytrip-request") || "null") || emptyRequest);
  const [plan, setPlan] = useState<TripPlan | null>(() => JSON.parse(sessionStorage.getItem("memorytrip-plan") || "null"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);
  const [revision, setRevision] = useState("");

  useEffect(() => { sessionStorage.setItem("memorytrip-request", JSON.stringify(request)); }, [request]);
  useEffect(() => { if (plan) sessionStorage.setItem("memorytrip-plan", JSON.stringify(plan)); }, [plan]);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 700);
    return () => window.clearInterval(timer);
  }, [loading]);

  const setField = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => setRequest((current) => ({ ...current, [key]: value }));
  const canGenerate = useMemo(() => request.display_name.trim() && request.travel_prompt.trim().length >= 10 && request.origin.trim(), [request]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canGenerate) { setError("Please add your name, origin, and a travel wish of at least 10 characters."); return; }
    setError(""); setStage(0); setLoading(true);
    try { setPlan(await generateTrip(request)); } catch (err) { setError(err instanceof Error ? err.message : "Could not generate your trip."); }
    finally { setLoading(false); }
  }
  async function revise(instruction: string) {
    setError(""); setStage(1); setLoading(true);
    try { setPlan(await reviseTrip(request, instruction)); setRevision(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not revise your trip."); }
    finally { setLoading(false); }
  }
  function toggleInterest(interest: string) { setField("interests", request.interests.includes(interest) ? request.interests.filter((item) => item !== interest) : [...request.interests, interest]); }

  return <main>
    <header className="hero"><span className="eyebrow">MEMORYTRIP / MVP1</span><h1>Plan a journey your heart remembers.</h1><p>Start with a feeling. Leave with a trail made for it.</p></header>
    {!plan && <section className="panel"><h2>What story do you want to live?</h2><form onSubmit={submit} className="form-grid">
      <label>Your name<input value={request.display_name} onChange={(e) => setField("display_name", e.target.value)} placeholder="Priya" /></label>
      <label>Starting from<input value={request.origin} onChange={(e) => setField("origin", e.target.value)} placeholder="Bengaluru, India" /></label>
      <label className="full">Your travel wish<textarea value={request.travel_prompt} onChange={(e) => setField("travel_prompt", e.target.value)} placeholder="I want a peaceful, photography-focused break close to nature..." /></label>
      <label>Country, state, or destination scope<input value={request.destination_scope} onChange={(e) => setField("destination_scope", e.target.value)} /></label>
      <label>Duration (days)<input type="number" min="1" max="14" value={request.duration_days} onChange={(e) => setField("duration_days", Number(e.target.value))} /></label>
      <label>Budget<input type="number" min="1000" value={request.budget} onChange={(e) => setField("budget", Number(e.target.value))} /></label>
      <label>Currency<select value={request.currency} onChange={(e) => setField("currency", e.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
      <label>Travel pace<select value={request.pace} onChange={(e) => setField("pace", e.target.value as Pace)}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option></select></label>
      <label>Story style<select value={request.story_style} onChange={(e) => setField("story_style", e.target.value as StoryStyle)}>{["cinematic", "fantasy", "watercolor", "documentary", "animation"].map((style) => <option key={style}>{style}</option>)}</select></label>
      <fieldset className="full"><legend>What draws you in?</legend><div className="chips">{interests.map((interest) => <button type="button" key={interest} className={request.interests.includes(interest) ? "chip selected" : "chip"} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div></fieldset>
      <button className="primary full" disabled={loading}>{loading ? "Creating your trail..." : "Create my MemoryTrip"}</button>
    </form></section>}
    {loading && <section className="panel loading"><h2>Crafting your journey</h2>{stages.map((item, index) => <p key={item} className={index <= stage ? "active" : ""}>{index <= stage ? "●" : "○"} {item}</p>)}</section>}
    {error && <p className="error" role="alert">{error}</p>}
    {plan && <TripResult plan={plan} revision={revision} setRevision={setRevision} onRevise={revise} onStartOver={() => setPlan(null)} />}
  </main>;
}

function TripResult({ plan, revision, setRevision, onRevise, onStartOver }: { plan: TripPlan; revision: string; setRevision: (value: string) => void; onRevise: (value: string) => void; onStartOver: () => void }) {
  return <section className="results">
    <div className="destination"><span className="eyebrow">YOUR MEMORYTRIP</span><h2>{plan.destination.name}, {plan.destination.country}</h2><p>{plan.destination.rationale}</p><span className="badge">{plan.destination.estimated_fit}</span></div>
    <div className="two-col"><article className="panel"><h3>Your travel mood</h3><strong>{plan.preference_summary.emotional_intent}</strong><div className="chips">{plan.preference_summary.themes.map((theme) => <span className="chip selected" key={theme}>{theme}</span>)}</div></article><article className="panel"><h3>Budget at a glance</h3><p className="amount">{formatMoney(plan.budget.estimated_total, plan.budget.currency)}</p><p>of {formatMoney(plan.budget.user_budget, plan.budget.currency)} · {plan.budget.variance >= 0 ? "room to breathe" : "over plan"}</p></article></div>
    <section className="panel"><h3>Your trail</h3>{plan.itinerary.map((day) => <article className="day" key={day.day}><div><span className="eyebrow">DAY {day.day}</span><h4>{day.theme}</h4><p>{formatMoney(day.estimated_daily_cost, plan.budget.currency)} estimated</p></div><div className="activities">{day.items.map((item) => <div className="activity" key={`${day.day}-${item.time_of_day}`}><b>{item.time_of_day} · {item.title}</b><p>{item.description}</p><small>{item.rationale} · {formatMoney(item.estimated_cost, plan.budget.currency)}</small><em>Memory cue: {item.photo_moment}</em></div>)}</div></article>)}</section>
    <div className="two-col"><section className="panel"><h3>Make the budget lighter</h3>{plan.budget.optimizations.map((item) => <div className="tip" key={item.title}><b>{item.title}</b><span>Save ~{formatMoney(item.estimated_saving, plan.budget.currency)}</span><p>{item.impact}</p></div>)}</section><section className="panel story"><span className="eyebrow">{plan.story.style} story</span><h3>{plan.story.title}</h3><p>{plan.story.content}</p><small>{plan.story.disclaimer}</small></section></div>
    <section className="panel revise"><h3>Shape the story further</h3><div className="chips">{["Reduce budget", "Slower pace", "More adventure", "More culture", "Change destination"].map((item) => <button className="chip" key={item} onClick={() => onRevise(item)}>{item}</button>)}</div><div className="revision-row"><input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Or describe a change..." /><button className="primary" onClick={() => revision.trim() && onRevise(revision)}>Revise</button><button className="secondary" onClick={onStartOver}>Start over</button></div></section>
  </section>;
}
