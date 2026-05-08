import { motion } from 'framer-motion';

type Props = {
  isCorrect: boolean;
  correctWord: string;
  onNext: () => void;
};

export function FeedbackOverlay({ isCorrect, correctWord, onNext }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/35 flex items-center justify-center p-6 z-10 rounded-2xl"
    >
      <motion.div
        initial={isCorrect ? { scale: 0.85, y: 20 } : { x: [-6, 6, -4, 4, 0] }}
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
        <div className="text-5xl mb-3">{isCorrect ? '⭐' : 'Try again'}</div>
        <h2 className={`text-xl font-bold mb-2 ${isCorrect ? 'text-amber-800' : 'text-coral-800'}`}>
          {isCorrect ? 'Nice spelling!' : 'Not quite'}
        </h2>
        {!isCorrect && (
          <p className="text-coral-800/90 mb-6">
            The word is <span className="font-semibold">{correctWord}</span>
          </p>
        )}
        {isCorrect && <p className="text-amber-800/80 mb-6">You got it!</p>}
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
