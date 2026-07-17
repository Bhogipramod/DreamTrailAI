import React, { useState } from 'react';
import { BudgetPlan } from '../types';
import { uploadExpenseReceipt } from '../api';

interface BudgetViewProps {
  tripId: string;
  budget: BudgetPlan;
  onExpenseUploaded: (updatedPlan: any) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ tripId, budget, onExpenseUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const isOverBudget = budget.variance < 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const result = await uploadExpenseReceipt(tripId, e.target.files[0]);
      alert("Receipt processed and structural budget recalculated!");
      onExpenseUploaded(result.updated_budget);
    } catch (err) {
      alert("Failed parsing target document.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Planned Limit</span>
          <span className="text-2xl font-black text-slate-100 mt-1 block">
            {budget.currency} {budget.user_budget.toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Current AI Actual Estimate</span>
          <span className="text-2xl font-black text-slate-100 mt-1 block">
            {budget.currency} {budget.estimated_total.toLocaleString()}
          </span>
        </div>
        <div className={`border p-6 rounded-xl ${isOverBudget ? 'bg-rose-950/20 border-rose-800/80' : 'bg-emerald-950/20 border-emerald-800/80'}`}>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Variance Delta</span>
          <span className={`text-2xl font-black mt-1 block ${isOverBudget ? 'text-rose-400' : 'text-emerald-400'}`}>
            {budget.currency} {budget.variance.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/20 border border-slate-800/70 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-200">Category Allocations</h3>
            
            {/* Intelligent Expense Intelligence Agent Upload Button */}
            <label className="text-xs bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg cursor-pointer transition">
              {uploading ? 'Extracting...' : '🧾 Upload Invoice'}
              <input type="file" onChange={handleFileUpload} accept="image/*,application/pdf" className="hidden" disabled={uploading} />
            </label>
          </div>
          <div className="space-y-3">
            {budget.line_items.map((item, idx) => {
              const pct = Math.min((item.amount / (budget.user_budget || 1)) * 100, 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{item.category}</span>
                    <span className="text-slate-100 font-bold">{budget.currency} {item.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.amount > (budget.user_budget/5) ? 'bg-rose-500' : 'bg-cyan-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/20 border border-slate-800/70 p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-amber-400">💡 Optimization Substitutes</h3>
          <div className="space-y-3">
            {budget.optimizations.map((opt, idx) => (
              <div key={idx} className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-sm font-bold text-slate-200">{opt.title}</h4>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    Save ~{budget.currency} {opt.estimated_saving}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{opt.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};