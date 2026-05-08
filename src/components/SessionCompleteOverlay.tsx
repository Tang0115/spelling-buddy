import { motion } from 'framer-motion';

type Props = {
  wordsAttempted: number;
  correctCount: number;
  bestStreak: number;
  missedCount: number;
  onRestart: () => void;
  onMissed: () => void;
};

export function SessionCompleteOverlay({
  wordsAttempted,
  correctCount,
  bestStreak,
  missedCount,
  onRestart,
  onMissed,
}: Props) {
  const pct = wordsAttempted > 0 ? Math.round((correctCount / wordsAttempted) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/35 flex items-center justify-center p-6 z-10 rounded-2xl"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20 }}
        className="max-w-sm w-full bg-amber-50 rounded-2xl p-8 text-center shadow-xl border-2 border-amber-200"
      >
        <div className="text-5xl mb-3">{pct === 100 ? '🏆' : pct >= 70 ? '🌟' : '💪'}</div>
        <h2 className="text-xl font-bold text-amber-800 mb-1">Session complete!</h2>
        <p className="text-sm text-amber-800/70 mb-5">
          You practiced {wordsAttempted} word{wordsAttempted !== 1 ? 's' : ''}
        </p>

        <div className="bg-white rounded-xl p-4 mb-6 space-y-2 text-sm border border-amber-100">
          <div className="flex justify-between">
            <span className="text-coral-800/80">Correct</span>
            <span className="font-semibold text-coral-900">
              {correctCount} / {wordsAttempted}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-coral-800/80">Score</span>
            <span className="font-semibold text-coral-900">{pct}%</span>
          </div>
          {bestStreak >= 3 && (
            <div className="flex justify-between">
              <span className="text-coral-800/80">Best streak</span>
              <span className="font-semibold text-coral-900">🔥 {bestStreak}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold transition-colors"
          >
            Practice again
          </button>
          {missedCount > 0 && (
            <button
              type="button"
              onClick={onMissed}
              className="w-full py-3 rounded-xl border-2 border-amber-300 text-amber-900 bg-white hover:bg-amber-50 font-semibold transition-colors"
            >
              Practice missed words ({missedCount})
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
