import { useState, useEffect } from 'react';
import { WelcomeScreen } from './Components/WelcomeScreen';
import { TripForm } from './Components/TripForm';
import { StoryView } from './Components/StoryView';
import { ItineraryView } from './Components/ItineraryView';
import { BudgetView } from './Components/BudgetView';
import { PreferenceSummaryCard } from './Components/PreferenceSummaryCard';
import { PostTripStory } from './Components/PostTripStory';
import { TripRequest, TripPlan, StoryStyle, PersistedSession, SavedTrip } from './types';
import { generateTripPlan, reviseTripPlan, regenerateStory } from './api';

type AppStage = 'welcome' | 'landing' | 'intake' | 'generating' | 'dashboard' | 'saved-trips';
type Tab = 'story' | 'itinerary' | 'budget' | 'memories';
type LegacySavedTrip = Pick<SavedTrip, 'request' | 'plan'>;

const SESSION_KEY = 'memorytrip.session.v1';
const NAME_KEY = 'memorytrip.displayName.v1';

const PROGRESS_STAGES = [
  'Understanding your travel mood',
  'Designing your trail',
  'Balancing your budget',
  'Writing your story',
];

function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession | null) {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing) - fail silently,
    // the app still works, it just won't survive a refresh.
  }
}

function saveCurrentTrip(
  savedTrips: SavedTrip[],
  activeSavedTripId: string | null,
  request: TripRequest | null,
  plan: TripPlan | null,
): { savedTrips: SavedTrip[]; activeSavedTripId: string | null } {
  if (!request || !plan) return { savedTrips, activeSavedTripId };

  const id = activeSavedTripId ?? `saved-trip-${Date.now()}-${plan.id}`;
  const trip: SavedTrip = { id, savedAt: Date.now(), request, plan };

  return {
    // Re-saving a revised trip replaces its earlier version and moves it to
    // the top, so only the latest final plan is retained.
    savedTrips: [trip, ...savedTrips.filter(savedTrip => savedTrip.id !== id)],
    activeSavedTripId: id,
  };
}

function loadDisplayName(): string {
  try {
    return sessionStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveDisplayName(name: string) {
  try {
    sessionStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export default function App() {
  const initialSession = loadSession();
  const initialName = loadDisplayName();
  // Include the active trip when migrating sessions created before savedTrips
  // was introduced.
  const savedTripsFromSession: Array<SavedTrip | LegacySavedTrip> = initialSession?.savedTrips
    ?? (initialSession?.plan && initialSession.request
      ? [{ request: initialSession.request, plan: initialSession.plan }]
      : []);
  const initialSavedTrips: SavedTrip[] = savedTripsFromSession.map((savedTrip, index) => ({
    ...savedTrip,
    id: 'id' in savedTrip ? savedTrip.id : `saved-trip-${index}-${savedTrip.plan.id}`,
    savedAt: 'savedAt' in savedTrip ? savedTrip.savedAt : index,
  })).sort((a, b) => b.savedAt - a.savedAt);

  const [displayName, setDisplayName] = useState<string>(initialName);
  const [stage, setStage] = useState<AppStage>(() => {
    if (initialSession?.plan && initialSession.request) return 'dashboard';
    if (initialName) return 'landing';
    return 'welcome';
  });
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(initialSession?.plan ?? null);
  const [lastRequest, setLastRequest] = useState<TripRequest | null>(initialSession?.request ?? null);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(initialSavedTrips);
  const [activeSavedTripId, setActiveSavedTripId] = useState<string | null>(
    initialSession?.activeSavedTripId
      ?? initialSavedTrips.find(savedTrip => savedTrip.plan.id === initialSession?.plan?.id)?.id
      ?? null,
  );
  const [selectedSavedTripId, setSelectedSavedTripId] = useState<string | null>(initialSavedTrips[0]?.id ?? null);

  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  useEffect(() => {
    saveSession({
      request: lastRequest ?? undefined,
      plan: tripPlan ?? undefined,
      savedTrips,
      activeSavedTripId: activeSavedTripId ?? undefined,
    });
  }, [tripPlan, lastRequest, savedTrips, activeSavedTripId]);

  const handleWelcomeContinue = (name: string) => {
    setDisplayName(name);
    saveDisplayName(name);
    setStage('landing');
  };

  const executePipeline = async (data: TripRequest) => {
    setStage('generating');
    setError(null);
    try {
      setLoadingStage(PROGRESS_STAGES[0]);
      await new Promise(r => setTimeout(r, 500));
      setLoadingStage(PROGRESS_STAGES[1]);
      await new Promise(r => setTimeout(r, 500));
      setLoadingStage(PROGRESS_STAGES[2]);
      await new Promise(r => setTimeout(r, 400));
      setLoadingStage(PROGRESS_STAGES[3]);

      const outcome = await generateTripPlan(data);
      setTripPlan(outcome);
      setLastRequest(data);
      setActiveSavedTripId(null);
      setActiveTab('story');
      setStage('dashboard');
    } catch (err: any) {
      setError(err.message || 'Error communicating with the trip planner. Your inputs are still here — try again.');
      setStage('intake');
    }
  };

  const handleRevisionSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lastRequest || !revisionPrompt.trim()) return;
    setIsRevising(true);
    setError(null);
    try {
      const updated = await reviseTripPlan(lastRequest, revisionPrompt);
      setTripPlan(updated);
      setRevisionPrompt('');
    } catch (err: any) {
      setError(err.message || 'Could not apply that revision. Please try again.');
    } finally {
      setIsRevising(false);
    }
  };

  const applyQuickRevision = async (instruction: string) => {
    if (!lastRequest) return;
    setIsRevising(true);
    setError(null);
    try {
      const updated = await reviseTripPlan(lastRequest, instruction);
      setTripPlan(updated);
    } catch (err: any) {
      setError(err.message || 'Could not apply that revision.');
    } finally {
      setIsRevising(false);
    }
  };

  const handleStoryRegen = async (style: string) => {
    if (!lastRequest) return;
    try {
      const story = await regenerateStory(lastRequest, style as StoryStyle);
      setTripPlan(prev => (prev ? { ...prev, story } : prev));
      setLastRequest(prev => (prev ? { ...prev, story_style: style as StoryStyle } : prev));
    } catch (err: any) {
      setError(err.message || 'Could not regenerate the story. Please try again.');
    }
  };

  const persistCurrentTrip = () => {
    const result = saveCurrentTrip(savedTrips, activeSavedTripId, lastRequest, tripPlan);
    setSavedTrips(result.savedTrips);
    setActiveSavedTripId(result.activeSavedTripId);
    saveSession({
      request: lastRequest ?? undefined,
      plan: tripPlan ?? undefined,
      savedTrips: result.savedTrips,
      activeSavedTripId: result.activeSavedTripId ?? undefined,
    });
    return result;
  };

  const handlePlanAnother = () => {
    const result = persistCurrentTrip();
    setTripPlan(null);
    setLastRequest(null);
    setActiveSavedTripId(null);
    saveSession({ savedTrips: result.savedTrips });
    setStage('intake');
  };

  const handleShowSavedTrips = () => {
    const result = persistCurrentTrip();
    const selectedId = result.activeSavedTripId ?? result.savedTrips[0]?.id ?? null;
    setSelectedSavedTripId(selectedId);
    setActiveTab('story');
    setStage('saved-trips');
  };

  const renderPlanTabs = (plan: TripPlan, readOnly = false) => (
    <>
      <div className="flex border-b border-slate-900 gap-2" role="tablist">
        {([
          ['story', 'Story View'],
          ['itinerary', 'Trail Itinerary'],
          ['budget', 'Budget Breakdown'],
          ['memories', 'Post-Trip Memories'],
        ] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 border-b-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 ${activeTab === tab ? 'border-emerald-500 text-emerald-400 bg-slate-900/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'story' && <StoryView tripId={plan.id} story={plan.story} onRegenerate={handleStoryRegen} readOnly={readOnly} />}
        {activeTab === 'itinerary' && <ItineraryView itinerary={plan.itinerary} />}
        {activeTab === 'budget' && <BudgetView budget={plan.budget} />}
        {activeTab === 'memories' && <PostTripStory destination={plan.destination} itinerary={plan.itinerary} />}
      </div>
    </>
  );

  return (
    <div className="app-shell flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 h-16 flex items-center justify-between px-6">
        <span
          className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer"
          onClick={() => setStage(tripPlan ? 'dashboard' : 'landing')}
        >
          DreamTrail AI
        </span>
        {stage !== 'welcome' && stage !== 'landing' && (
          <div className="flex items-center gap-2">
            <button onClick={handlePlanAnother} className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-400">
              Plan Another Trail
            </button>
            <button onClick={handleShowSavedTrips} className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-400">
              Saved Trips
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {error && (
          <div role="alert" className="mb-6 bg-rose-950/25 border border-rose-800 p-4 text-rose-300 text-sm rounded-xl flex justify-between items-start gap-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 font-bold focus:outline-none focus:ring-2 focus:ring-rose-400 rounded" aria-label="Dismiss error">×</button>
          </div>
        )}

        {stage === 'welcome' && (
          <WelcomeScreen initialName={displayName} onContinue={handleWelcomeContinue} />
        )}

        {/* 1. LANDING */}
        {stage === 'landing' && (
          <div className="text-center py-20 max-w-2xl mx-auto space-y-6">
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">
              Design Journeys Around Memories, Not Logistics.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Tell our AI agents the emotional atmosphere you want to capture, and we will build the trail.
            </p>
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-left text-xs space-y-2">
              <span className="font-bold text-emerald-400 block">💡 Sample inspiration:</span>
              <p className="italic text-slate-300">"I want to sit in a foggy mountain café, hear rainfall on corrugated roofs, and read classic literature undisturbed."</p>
            </div>
            <button
              onClick={() => setStage('intake')}
              className="px-8 py-4 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-emerald-400"
            >
              Begin Intake Journey, {displayName || 'Traveller'}
            </button>
          </div>
        )}

        {/* 2. INTAKE FORM */}
        {stage === 'intake' && (
          <TripForm
            onSubmit={executePipeline}
            isLoading={false}
            displayName={displayName}
            initialValues={lastRequest ?? undefined}
          />
        )}

        {/* 3. GENERATION PROGRESS */}
        {stage === 'generating' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-8" aria-live="polite">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-slate-200">Building your trail</h3>
              <ol className="text-sm space-y-1.5">
                {PROGRESS_STAGES.map((label) => (
                  <li
                    key={label}
                    className={label === loadingStage ? 'text-emerald-400 font-semibold' : 'text-slate-600'}
                  >
                    {label}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* 4. DASHBOARD */}
        {stage === 'dashboard' && tripPlan && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/20 p-6 rounded-2xl border border-slate-800">
              <div>
                {lastRequest?.origin && (
                  <p className="text-xs text-cyan-400/90 font-semibold uppercase tracking-wide mb-1">
                    {lastRequest.origin} → {tripPlan.destination.name}
                  </p>
                )}
                <h2 className="text-3xl font-extrabold text-slate-100">{tripPlan.destination.name}, {tripPlan.destination.country}</h2>
                <p className="text-sm text-slate-400 mt-1">{tripPlan.destination.rationale}</p>
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded">
                  All costs are estimates · {tripPlan.generation_mode} mode
                </span>
              </div>

              <form onSubmit={handleRevisionSubmit} className="w-full md:w-auto flex gap-2">
                <label htmlFor="revision-input" className="sr-only">Revision instruction</label>
                <input
                  id="revision-input"
                  type="text"
                  required
                  value={revisionPrompt}
                  onChange={(e) => setRevisionPrompt(e.target.value)}
                  placeholder="e.g., lower the budget, slower pace, more culture"
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 min-w-[240px]"
                />
                <button type="submit" disabled={isRevising} className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
                  {isRevising ? 'Revising...' : 'Revise'}
                </button>
              </form>
            </div>

            <PreferenceSummaryCard summary={tripPlan.preference_summary} />

            {/* Quick revision controls (FR-05) */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Lower budget', instruction: 'reduce the budget' },
                { label: 'Slower pace', instruction: 'make the pace slower and more relaxed' },
                { label: 'More adventure', instruction: 'add more adventure' },
                { label: 'More culture', instruction: 'add more culture' },
                { label: 'Open destination', instruction: 'change destination to be open' },
              ].map((qa) => (
                <button
                  key={qa.label}
                  disabled={isRevising}
                  onClick={() => applyQuickRevision(qa.instruction)}
                  className="text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {qa.label}
                </button>
              ))}
            </div>

            <div className="flex border-b border-slate-900 gap-2" role="tablist">
              {([
                ['story', '📖 Story View'],
                ['itinerary', '🗺️ Trail Itinerary'],
                ['budget', '💰 Budget Breakdown'],
                ['memories', '📸 Post-Trip Memories'],
              ] as [Tab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 border-b-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 ${activeTab === tab ? 'border-emerald-500 text-emerald-400 bg-slate-900/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="pt-2">
              {activeTab === 'story' && <StoryView tripId={tripPlan.id} story={tripPlan.story} onRegenerate={handleStoryRegen} />}
              {activeTab === 'itinerary' && <ItineraryView itinerary={tripPlan.itinerary} />}
              {activeTab === 'budget' && <BudgetView budget={tripPlan.budget} />}
              {activeTab === 'memories' && (
                lastRequest ? (
                  <PostTripStory destination={tripPlan.destination} itinerary={tripPlan.itinerary} tripRequest={lastRequest} />
                ) : (
                  <p className="text-sm text-slate-500 text-center py-12">
                    Your trip details aren't available right now — try generating a new plan.
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {stage === 'saved-trips' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-100">Saved Trips</h1>
              <p className="mt-1 text-sm text-slate-400">Your latest trail appears first. Select a trip to view it without leaving this page.</p>
            </div>

            {savedTrips.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400">
                No trips saved yet. Create a trail to add it here.
              </div>
            ) : (
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex shrink-0 gap-2 overflow-x-auto md:w-72 md:flex-col md:overflow-visible" role="tablist" aria-orientation="vertical">
                  {savedTrips.map((savedTrip, index) => (
                    <button
                      key={savedTrip.id}
                      role="tab"
                      aria-selected={selectedSavedTripId === savedTrip.id}
                      onClick={() => {
                        setSelectedSavedTripId(savedTrip.id);
                        setActiveTab('story');
                      }}
                      className={`min-w-52 rounded-xl border p-4 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 md:min-w-0 ${selectedSavedTripId === savedTrip.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 bg-slate-900/30 text-slate-300 hover:border-slate-700'}`}
                    >
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{index === 0 ? 'Latest plan' : `Saved plan ${savedTrips.length - index}`}</span>
                      <span className="block font-semibold">{savedTrip.plan.destination.name}, {savedTrip.plan.destination.country}</span>
                      <span className="mt-1 block text-xs text-slate-500">{savedTrip.plan.story.title}</span>
                    </button>
                  ))}
                </div>

                {(() => {
                  const selectedTrip = savedTrips.find(savedTrip => savedTrip.id === selectedSavedTripId) ?? savedTrips[0];
                  return (
                    <div className="min-w-0 flex-1 space-y-6">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6">
                        <h2 className="text-3xl font-extrabold text-slate-100">{selectedTrip.plan.destination.name}, {selectedTrip.plan.destination.country}</h2>
                        <p className="mt-1 text-sm text-slate-400">{selectedTrip.plan.destination.rationale}</p>
                        <span className="mt-2 inline-block rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                          All costs are estimates · {selectedTrip.plan.generation_mode} mode
                        </span>
                      </div>
                      <PreferenceSummaryCard summary={selectedTrip.plan.preference_summary} />
                      {renderPlanTabs(selectedTrip.plan, true)}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
