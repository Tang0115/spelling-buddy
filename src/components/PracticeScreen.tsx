import { useEffect, useRef, useState } from 'react';
import words from '../data/words.json';
import { speak, warmUpVoices } from '../lib/tts';
import {
  primeMicrophoneForSpelling,
  retryMicrophonePrime,
  startListening,
  sttSupported,
} from '../lib/stt';
import { PlayWordButton } from './PlayWordButton';
import { HelperButtons } from './HelperButtons';
import { LetterTray } from './LetterTray';
import { HoldToSpellButton } from './HoldToSpellButton';
import { FeedbackOverlay } from './FeedbackOverlay';

type WordEntry = (typeof words)[number];
type Phase = 'idle' | 'spelling' | 'result';
type MicGate = 'pending' | 'ready' | 'blocked' | 'skipped';

export function PracticeScreen() {
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [letters, setLetters] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [micGate, setMicGate] = useState<MicGate>(() => (sttSupported ? 'pending' : 'skipped'));

  const stopListeningRef = useRef<(() => void) | null>(null);

  const currentWord: WordEntry = words[wordIndex];

  useEffect(() => {
    void warmUpVoices();
  }, []);

  useEffect(() => {
    if (!sttSupported) return;

    let cancelled = false;
    void (async () => {
      const ok = await primeMicrophoneForSpelling();
      if (cancelled) return;
      setMicGate(ok ? 'ready' : 'blocked');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlayWord = () => void speak(currentWord.word);
  const handleDefinition = () => void speak(currentWord.definition);
  const handleSentence = () => void speak(currentWord.sentence);

  const handleSpellStart = () => {
    if (!sttSupported) {
      window.alert('Use Chrome or Edge for voice spelling — Firefox does not support it yet.');
      return;
    }
    if (micGate !== 'ready') {
      return;
    }
    setLetters([]);
    setPhase('spelling');

    const stop = startListening(currentWord.word, {
      onLetter: (letter) => {
        setLetters((prev) => [...prev, letter]);
      },
      onEnd: (allLetters) => {
        const guess = allLetters.join('').toLowerCase();
        const correct = guess === currentWord.word.toLowerCase();
        setIsCorrect(correct);
        setPhase('result');
        stopListeningRef.current = null;
      },
    });

    stopListeningRef.current = stop;
  };

  const handleSpellEnd = () => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
  };

  const handleNext = () => {
    setLetters([]);
    setIsCorrect(null);
    setPhase('idle');
    setWordIndex((i) => (i + 1) % words.length);
  };

  const busy = phase === 'spelling' || phase === 'result' || micGate === 'pending';

  const handleRetryMic = () => {
    setMicGate('pending');
    void (async () => {
      const ok = await retryMicrophonePrime();
      setMicGate(ok ? 'ready' : 'blocked');
    })();
  };

  return (
    <div className="min-h-[100dvh] bg-cream flex items-center justify-center box-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm overflow-hidden border border-coral-50 relative">
        {(micGate === 'pending' || micGate === 'blocked') && sttSupported && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-cream/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mic-gate-title"
            aria-describedby="mic-gate-desc"
          >
            <div className="max-w-md w-full rounded-2xl border border-coral-100 bg-white p-8 shadow-lg text-center">
              <h2 id="mic-gate-title" className="text-lg font-bold text-coral-900 mb-2">
                {micGate === 'pending' ? 'Microphone setup' : 'Microphone blocked'}
              </h2>
              <p id="mic-gate-desc" className="text-sm text-coral-800/90 mb-6">
                {micGate === 'pending'
                  ? 'Spelling Buddy needs the microphone when your browser asks. Please tap Allow so your first word isn’t missed.'
                  : 'We can’t hear your spelling without the microphone. Allow access in your browser settings, then try again.'}
              </p>
              {micGate === 'blocked' && (
                <button
                  type="button"
                  onClick={handleRetryMic}
                  className="w-full py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        <Header wordIndex={wordIndex} total={words.length} grade={currentWord.grade} />

        <div className="p-8">
          <PlayWordButton onClick={handlePlayWord} disabled={busy} />

          <HelperButtons
            onDefinition={handleDefinition}
            onSentence={handleSentence}
            disabled={busy}
          />

          <LetterTray letters={letters} expectedLength={currentWord.word.length} />

          <HoldToSpellButton
            onPressStart={handleSpellStart}
            onPressEnd={handleSpellEnd}
            isListening={phase === 'spelling'}
            disabled={phase === 'result' || (sttSupported ? micGate !== 'ready' : false)}
          />
        </div>

        {phase === 'result' && isCorrect !== null && (
          <FeedbackOverlay isCorrect={isCorrect} correctWord={currentWord.word} onNext={handleNext} />
        )}
      </div>
    </div>
  );
}

function Header({
  wordIndex,
  total,
  grade,
}: {
  wordIndex: number;
  total: number;
  grade: number;
}) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-coral-50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center">
          <span className="text-amber-800" aria-hidden>
            😊
          </span>
        </div>
        <span className="font-medium text-sm text-coral-900">Spelling Buddy</span>
      </div>
      <div className="flex items-center gap-3 text-sm flex-wrap justify-end">
        <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full font-medium">
          Word {wordIndex + 1} of {total}
        </span>
        <span className="bg-coral-50 text-coral-800 px-2.5 py-1 rounded-full font-medium">
          Grade {grade}
        </span>
      </div>
    </div>
  );
}
