import React, { useState } from 'react';
import { ItineraryDay } from '../types';

export const ItineraryView: React.FC<{ itinerary: ItineraryDay[] }> = ({ itinerary }) => {
  const [activeDay, setActiveDay] = useState(1);

  const currentDayPlan = itinerary.find((d) => d.day === activeDay) || itinerary[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar Day Selectors */}
      <div className="space-y-2">
        <h4 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-4 px-1">Day Selector</h4>
        {itinerary.map((day) => (
          <button
            key={day.day}
            onClick={() => setActiveDay(day.day)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
              activeDay === day.day
                ? 'bg-slate-800 border-emerald-500/50 shadow-md'
                : 'bg-slate-900/30 border-slate-800/60 hover:bg-slate-900/70 hover:border-slate-800'
            }`}
          >
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wide">Day {day.day}</div>
            <div className="text-sm font-semibold text-slate-200 truncate mt-1">{day.theme}</div>
            <div className="text-xs text-emerald-400 mt-2 font-medium">
              Daily Est: ₹{day.estimated_daily_cost}
            </div>
          </button>
        ))}
      </div>

      {/* Primary Itinerary Timeline */}
      <div className="lg:col-span-3 bg-slate-900/20 border border-slate-800/70 rounded-2xl p-6 lg:p-8 space-y-8">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <span className="text-emerald-400">Day {currentDayPlan.day}:</span> {currentDayPlan.theme}
          </h3>
        </div>

        <div className="relative border-l-2 border-slate-800 ml-3 pl-8 space-y-8">
          {currentDayPlan.items.map((item, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline Indicator Dot */}
              <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-slate-950 border-2 border-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 transition duration-150">
                <span className="w-2 h-2 rounded-full bg-emerald-300 group-hover:bg-slate-950" />
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-cyan-400 tracking-widest">{item.time_of_day}</span>
                <h4 className="text-lg font-bold text-slate-200 mt-1">{item.title}</h4>
                <p className="text-slate-300 mt-1.5 leading-relaxed text-sm">{item.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-900/50 border border-slate-800/80 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider block">Why this fits your goals</span> [cite: 83]
                    <p className="text-xs text-slate-400 mt-1">{item.rationale}</p> [cite: 83]
                  </div>
                  <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] uppercase text-amber-400/80 font-bold tracking-wider block">📷 Core Memory Spot</span> [cite: 82]
                    <p className="text-xs text-slate-400 mt-1 italic">"{item.photo_moment}"</p> [cite: 82]
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};