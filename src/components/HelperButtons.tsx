type Props = {
  onDefinition: () => void;
  onSentence: () => void;
  onSpellItOut: () => void;
  disabled?: boolean;
};

export function HelperButtons({ onDefinition, onSentence, onSpellItOut, disabled }: Props) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDefinition}
          disabled={disabled}
          className="flex-1 py-3 px-4 rounded-xl border-2 border-coral-200 text-coral-800 bg-coral-50/60 hover:bg-coral-50 font-medium text-sm disabled:opacity-50 transition-colors"
        >
          Definition
        </button>
        <button
          type="button"
          onClick={onSentence}
          disabled={disabled}
          className="flex-1 py-3 px-4 rounded-xl border-2 border-coral-200 text-coral-800 bg-coral-50/60 hover:bg-coral-50 font-medium text-sm disabled:opacity-50 transition-colors"
        >
          Sentence
        </button>
      </div>
      <button
        type="button"
        onClick={onSpellItOut}
        disabled={disabled}
        className="w-full py-2.5 px-4 rounded-xl border-2 border-amber-200 text-amber-900 bg-amber-50/60 hover:bg-amber-50 font-medium text-sm disabled:opacity-50 transition-colors"
      >
        🔤 Spell it out
      </button>
    </div>
  );
}
