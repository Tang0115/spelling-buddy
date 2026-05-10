import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  letters: string[];
  expectedLength: number;
  /** When the user types too many letters, message wording differs from voice STT overflow */
  overflowContext?: 'voice' | 'type';
  /** When true, pulse the next empty cell to show where typing will appear */
  showCursor?: boolean;
};

export function LetterTray({ letters, expectedLength, overflowContext = 'voice', showCursor = false }: Props) {
  const overflow = letters.length - expectedLength;
  const overflowHint =
    overflowContext === 'type'
      ? `+${overflow} extra letter${overflow !== 1 ? 's' : ''} — this word has ${expectedLength} letters`
      : `+${overflow} extra letter${overflow !== 1 ? 's' : ''} heard — try saying one letter at a time`;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 justify-center min-h-[3.5rem]">
        {Array.from({ length: expectedLength }, (_, i) => {
          const letter = letters[i];
          const isCursorCell = showCursor && !letter && i === Math.min(letters.length, expectedLength - 1);
          return (
            <div
              key={i}
              className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                letter
                  ? 'border-coral-400 bg-coral-50 text-coral-900'
                  : isCursorCell
                    ? 'border-coral-400 bg-white text-transparent animate-pulse'
                    : 'border-coral-100 bg-white text-transparent'
              }`}
            >
              <AnimatePresence mode="popLayout">
                {letter && (
                  <motion.span
                    key={`${i}-${letter}`}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="select-none"
                  >
                    {letter}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <p className="mt-2 text-center text-xs text-coral-600 font-medium">
          {overflowHint}
        </p>
      )}
    </div>
  );
}
