import { useState } from 'react';
import {
  loadCustomWords,
  parseWordInput,
  saveCustomWords,
  clearCustomWords,
  type CustomWordEntry,
} from '../lib/customWords';

type Props = {
  onBack: () => void;
};

const GRADE_LABEL: Record<number, string> = {
  0: 'K',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
};

export function CustomWordsScreen({ onBack }: Props) {
  const existing = loadCustomWords();
  const [input, setInput] = useState(() =>
    existing.map((e) => (e.grade === 3 ? e.word : `${e.word}, ${e.grade}`)).join('\n'),
  );
  const [saved, setSaved] = useState(false);

  const parsed: CustomWordEntry[] = parseWordInput(input);
  const hasParsed = parsed.length > 0;

  const handleSave = () => {
    saveCustomWords(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    clearCustomWords();
    setInput('');
  };

  return (
    <div className="min-h-[100dvh] bg-cream flex items-center justify-center box-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm overflow-hidden border border-coral-50">
        <div className="p-5 border-b border-coral-50">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-coral-700 hover:text-coral-900 transition-colors mb-3 block"
          >
            ← Back to practice
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center shrink-0">
              <span className="text-amber-800" aria-hidden>
                📝
              </span>
            </div>
            <div>
              <span className="font-semibold text-sm text-coral-900 block">My Word List</span>
              <span className="text-xs text-coral-800/70">Add words for your child to practice</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 space-y-1">
            <p className="font-semibold">How to add words:</p>
            <p>• One word per line: <code className="bg-amber-100 px-1 rounded">elephant</code></p>
            <p>
              • Optionally include grade (0=K through 5):{' '}
              <code className="bg-amber-100 px-1 rounded">elephant, 2</code>
            </p>
          </div>

          <div>
            <label htmlFor="word-input" className="block text-sm font-semibold text-coral-900 mb-2">
              Word list
            </label>
            <textarea
              id="word-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
              placeholder={'elephant\nrhythm, 3\nfriend, 1\nbicycle, 3'}
              className="w-full px-4 py-3 rounded-xl border-2 border-coral-200 focus:border-coral-400 outline-none text-sm text-coral-900 bg-white resize-none font-mono"
            />
          </div>

          {input.trim() && (
            <div className="bg-coral-50 border border-coral-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-coral-900 mb-2">
                Preview — {parsed.length} valid word{parsed.length !== 1 ? 's' : ''}
              </p>
              {hasParsed ? (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {parsed.map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-white border border-coral-200 rounded-full px-2.5 py-1 text-xs text-coral-900"
                    >
                      {e.word}
                      <span className="text-coral-400 font-medium">
                        G{GRADE_LABEL[e.grade] ?? e.grade}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-coral-800/70">No valid words found — check for typos.</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasParsed}
              className="flex-1 py-3 rounded-xl bg-coral-400 hover:bg-coral-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {saved ? 'Saved ✓' : `Save ${hasParsed ? parsed.length + ' words' : ''}`}
            </button>
            {existing.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="py-3 px-4 rounded-xl border-2 border-coral-200 text-coral-800 hover:bg-coral-50 font-semibold text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
