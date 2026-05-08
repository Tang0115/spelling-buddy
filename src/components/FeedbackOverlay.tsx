import { motion } from 'framer-motion';

type Props = {
  isCorrect: boolean;
  correctWord: string;
  streak: number;
  onNext: () => void;
  onSpellItOut: () => void;
};

export function FeedbackOverlay({ isCorrect, correctWord, streak, onNext, onSpellItOut }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/35 flex items-center justify-center p-6 z-10 rounded-2xl"
    >
      <motion.div
        initial={isCorrect ? { scale: 0.85, y: 20 } : { x: [-6, 6, -4, 4, 0] as unknown as number }}
        animate={isCorrect ? { scale: [1, 1.06, 1], y: 0 } : { x: 0 }}
        transition={
          isCorrect
            ? { type: 'spring', stiffness: 400, damping: 18 }
            : { duration: 0.4 }
        }
        className={`max-w-sm w-full rounded-2xl p-8 text-center shadow-xl ${
          isCorrect ? 'bg-amber-50 border-2 border-amber-200' : 'bg-white border-2 border-coral-200'
        }`}
      >
        <div className="text-5xl mb-3">{isCorrect ? '⭐' : '🤔'}</div>
        <h2 className={`text-xl font-bold mb-2 ${isCorrect ? 'text-amber-800' : 'text-coral-800'}`}>
          {isCorrect ? 'Nice spelling!' : 'Not quite'}
        </h2>

        {isCorrect && streak >= 2 && (
          <p className="text-amber-700 font-semibold mb-4 text-sm">🔥 {streak} in a row!</p>
        )}
        {isCorrect && streak < 2 && <p className="text-amber-800/80 mb-6">You got it!</p>}

        {!isCorrect && (
          <div className="mb-5 space-y-3">
            <p className="text-coral-800/90">
              The word is <span className="font-semibold tracking-wide">{correctWord}</span>
            </p>
            <button
              type="button"
              onClick={onSpellItOut}
              className="w-full py-2.5 rounded-xl border-2 border-coral-200 text-coral-800 bg-coral-50 hover:bg-coral-100 text-sm font-semibold transition-colors"
            >
              🔤 Hear it spelled out
            </button>
          </div>
        )}

        {isCorrect && streak >= 2 && <div className="mb-2" />}

        <button
          type="button"
          onClick={onNext}
          className="w-full py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold transition-colors"
        >
          Next word
        </button>
      </motion.div>
    </motion.div>
  );
}
