import { useEffect, useState } from 'react';
import { UserButton, useAuth } from '@clerk/react';
import { loadProgress, loadProgressFromPuter, type Progress } from '../lib/progress';

type Props = {
  onBack: () => void;
};

export function StatsScreen({ onBack }: Props) {
  const { userId, isLoaded: authLoaded } = useAuth({ treatPendingAsSignedOut: true });
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  useEffect(() => {
    if (!authLoaded || !userId) return;
    void loadProgressFromPuter(userId).then((p) => {
      if (p) setProgress(p);
    });
  }, [authLoaded, userId]);

  const { totalAttempts, totalCorrect } = progress.stats;
  const correctionRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
  const sortedMissed = [...progress.missedWords].sort((a, b) => b.missedCount - a.missedCount);

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center box-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm overflow-hidden border border-coral-50">

        {/* Header */}
        <div className="p-5 border-b border-coral-50 space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-coral-700 hover:text-coral-900 transition-colors mb-1"
          >
            ← Back
          </button>

          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center shrink-0">
                <span className="text-amber-800" aria-hidden>😊</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium text-sm text-coral-900 block">Spelling Buddy</span>
                <span className="text-xs text-coral-800/80">Your stats</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {userId && <UserButton />}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Overall stats card */}
          <div className="rounded-xl border border-coral-100 bg-coral-50/40 p-5">
            {totalAttempts === 0 ? (
              <p className="text-sm text-coral-800/70 text-center">No attempts yet — start practising!</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-6">
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-coral-900">{totalAttempts}</p>
                    <p className="text-xs text-coral-800/70 mt-1">Total attempts</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-coral-900">{correctionRate}%</p>
                    <p className="text-xs text-coral-800/70 mt-1">Correct</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-coral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-coral-400 rounded-full transition-all"
                    style={{ width: `${correctionRate}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Missed words list */}
          <div>
            <h2 className="text-sm font-semibold text-coral-900 mb-3">Words to keep practising</h2>
            {sortedMissed.length === 0 ? (
              <p className="text-sm text-coral-800/70 text-center py-4">No missed words — great job! 🎉</p>
            ) : (
              <ul className="space-y-0">
                {sortedMissed.map((m) => (
                  <li
                    key={m.word}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-coral-50 last:border-0"
                  >
                    <span className="font-semibold text-coral-900 capitalize">{m.word}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Missed {m.missedCount}×
                      </span>
                      <span className="text-xs text-coral-800/50">
                        {new Date(m.lastMissedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
