import { useState, useEffect } from 'react';
import { TripForm } from './Components/TripForm';
import { StoryView } from './Components/StoryView';
import { ItineraryView } from './Components/ItineraryView';
import { BudgetView } from './Components/BudgetView';
import { TripRequest, TripPlan, SavedTripListItem } from './types';
import { generateTripPlan, reviseTripPlan, listSavedTrips, getSavedTrip, regenerateStory } from './api';

type AppStage = 'landing' | 'intake' | 'generating' | 'dashboard';
type Tab = 'story' | 'itinerary' | 'budget';

export default function App() {
  const [stage, setStage] = useState<AppStage>('landing');
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [savedTrips, setSavedTrips] = useState<SavedTripListItem[]>([]);
  
  // Generation Progress Substates
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const items = await listSavedTrips();
      setSavedTrips(items);
    } catch (e) { console.error(e); }
  };

  const executePipeline = async (data: TripRequest) => {
    setStage('generating');
    setError(null);
    try {
      // Mimic Codex Orchestrator feedback steps
      setLoadingStage('Emotion Agent: Decoding your memory intent...');
      await new Promise(r => setTimeout(r, 800));
      setLoadingStage('Itinerary Agent: Shaping geographical pathways...');
      await new Promise(r => setTimeout(r, 800));
      setLoadingStage('Budget Agent: Rebalancing local optimization costs...');
      await new Promise(r => setTimeout(r, 600));
      setLoadingStage('Story Agent: Translating timeline into creative prose...');

      const outcome = await generateTripPlan(data);
      setTripPlan(outcome);
      setStage('dashboard');
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Error communicating with orchestrator.');
      setStage('intake');
    }
  };

  const handleRevisionSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tripPlan || !revisionPrompt.trim()) return;
    setIsRevising(true);
    try {
      const updated = await reviseTripPlan(tripPlan.id, revisionPrompt);
      setTripPlan(updated);
      setRevisionPrompt('');
    } catch (err) {
      alert("Revision error reported.");
    } finally {
      setIsRevising(false);
    }
  };

  const handleSelectSaved = async (id: string) => {
    try {
      const selected = await getSavedTrip(id);
      setTripPlan(selected);
      setStage('dashboard');
    } catch (e) { alert("Failed to open saved trail."); }
  };

  const handleStoryRegen = async (style: string) => {
    if (!tripPlan) return;
    const updated = await regenerateStory(tripPlan.id, style);
    setTripPlan(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 h-16 flex items-center justify-between px-6">
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer" onClick={() => setStage('landing')}>
          DreamTrail AI
        </span>
        {stage !== 'landing' && (
          <button onClick={() => setStage('intake')} className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:border-slate-700 transition">
            Plan Another Trail
          </button>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Hand Sidebar for Saved History View */}
        <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl h-fit space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Saved History Logs</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {savedTrips.map(t => (
              <button key={t.id} onClick={() => handleSelectSaved(t.id)} className="w-full text-left p-2.5 rounded text-xs bg-slate-950/50 hover:bg-slate-900 border border-slate-800 transition block truncate">
                🗺️ {t.destination_name} ({t.duration_days} Days)
              </button>
            ))}
            {savedTrips.length === 0 && <span className="text-xs text-slate-600 block">No trails recorded yet.</span>}
          </div>
        </div>

        {/* Dynamic Center Workstation Component Rendering */}
        <div className="lg:col-span-3">
          {error && <div className="mb-6 bg-rose-950/25 border border-rose-800 p-4 text-rose-300 text-sm rounded-xl">{error}</div>}

          {/* 1. LANDING PHASE VIEW */}
          {stage === 'landing' && (
            <div className="text-center py-20 max-w-2xl mx-auto space-y-6">
              <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">
                Design Journeys Around Memories, Not Logistics.
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                Stop filling out forms about hotels and flight schedules. Tell our AI agents the emotional atmosphere you want to capture, and we will build the trail.
              </p>
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-left text-xs space-y-2">
                <span className="font-bold text-emerald-400 block">💡 Sample Inspiration prompt ideas:</span>
                <p className="italic text-slate-300">"I want to sit in a foggy mountain café, hear rainfall on corrugated roofs, and read classic literature undisturbed."</p>
              </div>
              <button onClick={() => setStage('intake')} className="px-8 py-4 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95">
                Begin Intake Journey
              </button>
            </div>
          )}

          {/* 2. INTAKE FORM STAGE */}
          {stage === 'intake' && <TripForm onSubmit={executePipeline} isLoading={false} />}

          {/* 3. COGNITIVE AGENT GENERATION LOADER */}
          {stage === 'generating' && (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-200">Orchestrating AI Agents</h3>
                <p className="text-sm text-emerald-400 font-mono mt-2 animate-pulse">{loadingStage}</p>
              </div>
            </div>
          )}

          {/* 4. DASHBOARD REVIEW VIEW OVERVIEW */}
          {stage === 'dashboard' && tripPlan && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/20 p-6 rounded-2xl border border-slate-800">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-100">{tripPlan.destination.name}, {tripPlan.destination.country}</h2>
                  <p className="text-sm text-slate-400 mt-1">{tripPlan.destination.rationale}</p>
                </div>
                
                {/* Revision Control Component Block */}
                <form onSubmit={handleRevisionSubmit} className="w-full md:w-auto flex gap-2">
                  <input
                    type="text"
                    required
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder="e.g., Increase budget cap or shift day 2 pace"
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 min-w-[240px]"
                  />
                  <button type="submit" disabled={isRevising} className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-lg disabled:opacity-50">
                    {isRevising ? 'Modifying...' : 'Revise'}
                  </button>
                </form>
              </div>

              <div className="flex border-b border-slate-900 gap-2">
                {(['story', 'itinerary', 'budget'] as Tab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 border-b-2 text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'border-emerald-500 text-emerald-400 bg-slate-900/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {tab === 'story' ? '📖 Story View' : tab === 'itinerary' ? '🗺️ Trail Itinerary' : '💰 Budget Breakdown'}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {activeTab === 'story' && <StoryView tripId={tripPlan.id} story={tripPlan.story} onRegenerate={handleStoryRegen} />}
                {activeTab === 'itinerary' && <ItineraryView itinerary={tripPlan.itinerary} />}
                {activeTab === 'budget' && (
                  <BudgetView
                    tripId={tripPlan.id}
                    budget={tripPlan.budget}
                    onExpenseUploaded={(newBudget) => setTripPlan(prev => prev ? { ...prev, budget: newBudget } : null)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}