import React from 'react';
import { PreferenceSummary } from '../types';

export const PreferenceSummaryCard: React.FC<{ summary: PreferenceSummary }> = ({ summary }) => {
  return (
    <div className="bg-slate-900/30 border border-slate-800/70 rounded-2xl p-6">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Your Preference Profile
      </h4>
      <p className="text-slate-200 text-sm leading-relaxed">{summary.emotional_intent}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {summary.themes.map((theme) => (
          <span
            key={theme}
            className="text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-3 py-1 rounded-full capitalize"
          >
            {theme}
          </span>
        ))}
        <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full capitalize">
          {summary.pace} pace
        </span>
      </div>
    </div>
  );
};
