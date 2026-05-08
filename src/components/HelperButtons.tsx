type Props = {
  onDefinition: () => void;
  onSentence: () => void;
  disabled?: boolean;
};

export function HelperButtons({ onDefinition, onSentence, disabled }: Props) {
  return (
    <div className="flex gap-3 mt-4">
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
  );
}
