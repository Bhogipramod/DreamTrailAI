import React, { useState } from 'react';

interface WelcomeScreenProps {
  initialName?: string;
  onContinue: (displayName: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ initialName, onContinue }) => {
  const [name, setName] = useState(initialName ?? '');
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!trimmed) return;
    onContinue(trimmed);
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-md shadow-xl text-slate-100 space-y-6"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Who's travelling?
          </h2>
          <p className="text-slate-400 text-sm">
            Just a name to personalise your plan — this isn't an account, and nothing is saved beyond this browser session.
          </p>
        </div>

        <div>
          <label htmlFor="welcome-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Your Name
          </label>
          <input
            id="welcome-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Alex"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 transition"
            aria-describedby={touched && !trimmed ? 'welcome-name-error' : undefined}
            aria-invalid={touched && !trimmed}
          />
          {touched && !trimmed && (
            <p id="welcome-name-error" className="text-xs text-rose-400 mt-1" role="alert">
              Please enter a name to continue.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 py-3 px-6 rounded-xl font-bold tracking-wide transition transform duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-400"
        >
          Continue
        </button>
      </form>
    </div>
  );
};
