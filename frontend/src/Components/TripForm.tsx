import React, { useState } from 'react';
import { TripRequest, Pace } from '../types';

interface TripFormProps {
  onSubmit: (data: TripRequest) => void;
  isLoading: boolean;
}

export const TripForm: React.FC<TripFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<TripRequest>({
    display_name: '',
    travel_prompt: '',
    destination_scope: '',
    origin: '',
    duration_days: 3,
    traveller_count: 1,
    budget: 15000,
    currency: 'INR',
    pace: 'moderate' as Pace,
    interests: ['local culture'],
    story_style: 'documentary',
  });

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

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!formData.travel_prompt || !formData.display_name) return;
  
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-md shadow-xl text-slate-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          What story do you want to live? 
        </h2>
        <p className="text-slate-400 mt-2 text-sm">
          Tell us about the memories and feelings you are seeking, rather than just where you want to go. [cite: 7]
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your Name</label>
          <input
            type="text"
            name="display_name"
            required
            value={formData.display_name}
            onChange={handleChange}
            placeholder="e.g., Alex"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Describe Your Dream Experience [cite: 67]</label>
          <textarea
            name="travel_prompt"
            required
            rows={3}
            value={formData.travel_prompt}
            onChange={handleChange}
            placeholder="e.g., I want to read a book in a peaceful local café, hear the soft rustle of misty forests, and feel completely disconnected from city life." 
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Rough Destination Focus</label>
            <input
              type="text"
              name="destination_scope"
              value={formData.destination_scope}
              onChange={handleChange}
              placeholder="e.g., India, Himachal, Japan"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Story Telling Style [cite: 104]</label>
            <select
              name="story_style"
              value={formData.story_style}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="documentary">Documentary</option> [cite: 109]
              <option value="watercolor">Watercolor</option> [cite: 108]
              <option value="cinematic">Cinematic</option> [cite: 106]
              <option value="fantasy">Fantasy</option> [cite: 107]
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Days [cite: 57]</label>
            <input
              type="number"
              name="duration_days"
              min={1}
              max={30}
              value={formData.duration_days}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Travellers</label>
            <input
              type="number"
              name="traveller_count"
              min={1}
              value={formData.traveller_count}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Max Budget [cite: 57]</label>
            <div className="flex gap-1">
              <select 
                name="currency" 
                value={formData.currency} 
                onChange={handleChange}
                className="bg-slate-950 border border-slate-800 rounded-l-lg px-2 text-slate-300"
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
              </select>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-r-lg px-4 py-3 text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Travel Pace [cite: 71]</label>
          <div className="grid grid-cols-3 gap-3">
            {(['relaxed', 'balanced','packed', 'active'] as Pace[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pace: p }))}
                className={`py-2 rounded-lg text-sm font-medium border capitalize transition-all duration-200 ${
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Focal Interests [cite: 72]</label>
          <div className="flex flex-wrap gap-2">
            {['Nature', 'Food & Dining', 'Heritage', 'Arts & Crafts', 'Adventure'].map((interest) => {
              const val = interest.toLowerCase();
              const selected = formData.interests.includes(val);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => handleInterestChange(val)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
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
          className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 py-4 px-6 rounded-xl font-bold tracking-wide transition transform duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? 'Consulting Your Dream Agents...' : 'Begin My Trail'}
        </button>
      </div>
    </form>
  );
};