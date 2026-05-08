import type { SyntheticEvent } from 'react';

type Props = {
  onPressStart: () => void;
  onPressEnd: () => void;
  isListening: boolean;
  disabled?: boolean;
};

export function HoldToSpellButton({ onPressStart, onPressEnd, isListening, disabled }: Props) {
  const start = (e: SyntheticEvent) => {
    e.preventDefault();
    onPressStart();
  };
  const end = (e: SyntheticEvent) => {
    e.preventDefault();
    onPressEnd();
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={start}
        onMouseUp={end}
        onMouseLeave={isListening ? end : undefined}
        onTouchStart={start}
        onTouchEnd={end}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-full py-4 rounded-2xl font-semibold text-white transition-all active:scale-[0.99] select-none touch-none disabled:opacity-50 ${
          isListening
            ? 'bg-amber-400 ring-4 ring-amber-200 shadow-lg'
            : 'bg-coral-600 hover:bg-coral-800 shadow-md'
        }`}
      >
        {isListening ? 'Listening… let go when done' : 'Hold to spell'}
      </button>
      <p className="text-center text-sm text-coral-800/70 mt-2">
        Press and hold, say each letter, then release
      </p>
    </div>
  );
}
