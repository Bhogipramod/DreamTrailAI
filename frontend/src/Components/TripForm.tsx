import React, { useState } from 'react';
import { TripRequest, Pace } from '../types';

interface TripFormProps {
  onSubmit: (data: TripRequest) => void;
  isLoading: boolean;
  displayName: string;
  initialValues?: TripRequest;
}

function makeDefaultForm(displayName: string): TripRequest {
  return {
    display_name: displayName,
    travel_prompt: '',
    destination_scope: '',
    origin: '',
    duration_days: 3,
    traveller_count: 1,
    budget: 15000,
    currency: 'INR',
    pace: 'balanced',
    interests: ['nature'],
    story_style: 'documentary',
  };
}

const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 transition';

export const TripForm: React.FC<TripFormProps> = ({ onSubmit, isLoading, displayName, initialValues }) => {
  const [formData, setFormData] = useState<TripRequest>(
    initialValues ?? makeDefaultForm(displayName),
  );
  const [touched, setTouched] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'duration_days' || name === 'traveller_count' || name === 'budget'
        ? Number(value)
        : value,
    }));
  };

  const handleInterestChange = (interest: string) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(interest);
      const updated = exists
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests: updated };
    });
  };

  const promptLength = formData.travel_prompt.trim().length;
  const promptTooShort = promptLength > 0 && promptLength < 10;
  const originMissing = touched && !formData.origin.trim();
  const promptInvalid = touched && promptLength < 10;
  const budgetTooLow = touched && formData.budget < 1000;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);

    if (!formData.origin.trim()) return;
    if (promptLength < 10) return;
    if (formData.budget < 1000) return;

    onSubmit({ ...formData, display_name: displayName });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-md shadow-xl text-slate-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          What story do you want to live, {displayName}?
        </h2>
        <p className="text-slate-400 mt-2 text-sm">
          Tell us about the memories and feelings you are seeking, rather than just where you want to go.
        </p>
        <p className="text-slate-500 mt-1 text-xs">All costs shown later are estimates, not live pricing.</p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="origin" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Origin City <span className="text-rose-400">*</span>
          </label>
          <input
            id="origin"
            type="text"
            name="origin"
            required
            value={formData.origin}
            onChange={handleChange}
            placeholder="e.g., Bengaluru, India"
            className={inputClass}
            aria-invalid={originMissing}
            aria-describedby={originMissing ? 'origin-error' : undefined}
          />
          {originMissing && (
            <p id="origin-error" role="alert" className="text-xs text-rose-400 mt-1">
              Please tell us where you're travelling from.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="travel_prompt" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Describe Your Dream Experience <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="travel_prompt"
            name="travel_prompt"
            required
            rows={3}
            value={formData.travel_prompt}
            onChange={handleChange}
            placeholder="e.g., I want to read a book in a peaceful local café, hear the soft rustle of misty forests, and feel completely disconnected from city life."
            className={inputClass}
            aria-invalid={promptInvalid}
            aria-describedby={promptInvalid || promptTooShort ? 'prompt-error' : undefined}
          />
          {(promptInvalid || promptTooShort) && (
            <p id="prompt-error" role="alert" className="text-xs text-rose-400 mt-1">
              Tell us a little more (at least 10 characters, {promptLength}/10 so far).
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="destination_scope" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Rough Destination Focus
            </label>
            <input
              id="destination_scope"
              type="text"
              name="destination_scope"
              value={formData.destination_scope}
              onChange={handleChange}
              placeholder="e.g., India, Himachal, Japan (leave blank if open)"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="story_style" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Story Telling Style
            </label>
            <select
              id="story_style"
              name="story_style"
              value={formData.story_style}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="documentary">Documentary</option>
              <option value="watercolor">Watercolor</option>
              <option value="cinematic">Cinematic</option>
              <option value="fantasy">Fantasy</option>
              <option value="animation">Animation</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="duration_days" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Days
            </label>
            <input
              id="duration_days"
              type="number"
              name="duration_days"
              min={1}
              max={14}
              value={formData.duration_days}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="traveller_count" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Travellers
            </label>
            <input
              id="traveller_count"
              type="number"
              name="traveller_count"
              min={1}
              max={12}
              value={formData.traveller_count}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="budget" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Max Budget <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-1">
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                aria-label="Currency"
                className="bg-slate-950 border border-slate-800 rounded-l-lg px-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
              </select>
              <input
                id="budget"
                type="number"
                name="budget"
                min={1000}
                value={formData.budget}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-r-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                aria-invalid={budgetTooLow}
              />
            </div>
            {budgetTooLow && (
              <p role="alert" className="text-xs text-rose-400 mt-1">Minimum budget is 1,000.</p>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Travel Pace</span>
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Travel pace">
            {(['relaxed', 'balanced', 'packed'] as Pace[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={formData.pace === p}
                onClick={() => setFormData(prev => ({ ...prev, pace: p }))}
                className={`py-2 rounded-lg text-sm font-medium border capitalize transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  formData.pace === p
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Focal Interests</span>
          <div className="flex flex-wrap gap-2">
            {['Nature', 'Food & Dining', 'Heritage', 'Arts & Crafts', 'Adventure', 'Photography', 'Wellness', 'Nightlife'].map((interest) => {
              const val = interest.toLowerCase();
              const selected = formData.interests.includes(val);
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleInterestChange(val)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                    selected
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 py-4 px-6 rounded-xl font-bold tracking-wide transition transform duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-400"
        >
          {isLoading ? 'Consulting Your Dream Agents...' : 'Begin My Trail'}
        </button>
      </div>
    </form>
  );
};
