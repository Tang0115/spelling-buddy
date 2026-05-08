type Props = { onClick: () => void; disabled?: boolean };

export function PlayWordButton({ onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-5 px-6 rounded-2xl bg-coral-400 hover:bg-coral-600 disabled:opacity-50 disabled:pointer-events-none text-white text-lg font-semibold shadow-md shadow-coral-200/80 transition-colors active:scale-[0.98] transform"
    >
      Play word
    </button>
  );
}
