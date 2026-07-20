import React, { useState } from 'react';
import { Story } from '../types';

interface StoryViewProps {
  tripId: string;
  story: Story;
  onRegenerate: (style: string) => void;
  readOnly?: boolean;
}

export const StoryView: React.FC<StoryViewProps> = ({ tripId, story, onRegenerate, readOnly = false }) => {
  const [selectedStyle, setSelectedStyle] = useState(story.style);
  const [isUpdating, setIsUpdating] = useState(false);

  const stylesList = ['documentary', 'watercolor', 'cinematic', 'fantasy', 'animation'];

  const handleStyleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStyle = e.target.value;
    setSelectedStyle(nextStyle);
    setIsUpdating(true);
    await onRegenerate(nextStyle);
    setIsUpdating(false);
  };

  return (
    <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 max-w-3xl mx-auto shadow-md relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📖</span>
          <div>
            <h3 className="text-2xl font-bold text-slate-100">{story.title}</h3>
            <p className="text-xs text-emerald-400 uppercase font-semibold tracking-widest mt-0.5">Labelled Narrative Engine</p>
          </div>
        </div>
        {!readOnly && <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">Change Tone:</label>
          <select
            value={selectedStyle}
            disabled={isUpdating}
            onChange={handleStyleChange}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>}
      </div>

      <div className={`transition-opacity duration-200 ${isUpdating ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap italic">
          "{story.content}"
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800/50">
        <p className="text-xs text-slate-500 font-medium">{story.disclaimer}</p>
      </div>
    </div>
  );
};
