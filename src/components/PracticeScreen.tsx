import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/react';
import wordList from '../data/word-list.json';
import { lookupWord, type DictionaryEntry } from '../lib/dictionary';
import { shuffledCopy } from '../lib/shuffle';
import { loadProgress, recordAttempt, saveProgress, type Progress } from '../lib/progress';
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

type WordEntry = (typeof wordList)[number];
type Phase = 'idle' | 'spelling' | 'result';
type MicGate = 'pending' | 'ready' | 'blocked' | 'skipped';

type Props = {
  onOpenMissed: () => void;
};

export function PracticeScreen({ onOpenMissed }: Props) {
  const { user, isLoaded } = useUser();
  const { userId, isLoaded: authLoaded } = useAuth({ treatPendingAsSignedOut: true });
  const [progress, setProgress] = useState<Progress>(() => loadProgress(undefined));

  const failStreakRef = useRef(0);

  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [letters, setLetters] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [micGate, setMicGate] = useState<MicGate>(() => (sttSupported ? 'pending' : 'skipped'));

  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(true);

  const stopListeningRef = useRef<(() => void) | null>(null);

  const sessionWords = useMemo(() => shuffledCopy(wordList) as WordEntry[], []);

  const currentWord: WordEntry = sessionWords[wordIndex];

  useEffect(() => {
    if (!isLoaded) return;
    setProgress(loadProgress(user ?? undefined));
  }, [isLoaded, user?.id, user]);

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setDictLoading(true);
      setDictEntry(null);
      const entry = await lookupWord(currentWord.word);
      if (cancelled) return;
      if (entry) {
        failStreakRef.current = 0;
        setDictEntry(entry);
        setDictLoading(false);
        return;
      }

      console.warn(`Dictionary lookup failed for "${currentWord.word}" — skipping.`);
      failStreakRef.current += 1;
      if (failStreakRef.current >= sessionWords.length) {
        console.error('Spelling Buddy: dictionary lookup failed for every word in the list.');
        setDictLoading(false);
        return;
      }

      setWordIndex((i) => (i + 1) % sessionWords.length);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWord.word, wordIndex, sessionWords.length]);

  const handlePlayWord = () => void speak(currentWord.word);
  const handleDefinition = () => {
    if (dictEntry) void speak(dictEntry.definition);
  };
  const handleSentence = () => {
    if (dictEntry) void speak(dictEntry.example);
  };

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

        setProgress((prev) => {
          const next = recordAttempt(prev, currentWord.word, correct);
          saveProgress(user ?? undefined, next);
          return next;
        });
      },
    });

    stopListeningRef.current = stop;
  };

  const handleSpellEnd = () => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
  };

  const handleNext = () => {
    failStreakRef.current = 0;
    setLetters([]);
    setIsCorrect(null);
    setPhase('idle');
    setWordIndex((i) => (i + 1) % sessionWords.length);
  };

  const playBusy =
    phase === 'spelling' || phase === 'result' || micGate === 'pending';

  const handleRetryMic = () => {
    setMicGate('pending');
    void (async () => {
      const ok = await retryMicrophonePrime();
      setMicGate(ok ? 'ready' : 'blocked');
    })();
  };

  const missedCount = progress.missedWords.length;

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

        <Header wordIndex={wordIndex} total={sessionWords.length} grade={currentWord.grade} />

        {authLoaded && !userId && (
          <p className="px-5 pt-2 pb-0 text-xs text-coral-800/70 text-center">
            Sign in to save your progress and practice missed words on any device.
          </p>
        )}

        {authLoaded && !!userId && missedCount > 0 && (
          <div className="px-5 pt-3">
            <button
              type="button"
              onClick={onOpenMissed}
              className="w-full py-2 rounded-xl text-sm font-semibold border-2 border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-50 transition-colors"
            >
              Practice missed words ({missedCount})
            </button>
          </div>
        )}

        <div className="p-8">
          {dictLoading && (
            <p className="text-sm text-coral-800/80 text-center mb-2">Loading word…</p>
          )}

          <PlayWordButton onClick={handlePlayWord} disabled={playBusy} />

          <HelperButtons
            onDefinition={handleDefinition}
            onSentence={handleSentence}
            disabled={playBusy || dictLoading || !dictEntry}
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
  const { userId } = useAuth({ treatPendingAsSignedOut: true });

  return (
    <div className="p-5 border-b border-coral-50 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center shrink-0">
            <span className="text-amber-800" aria-hidden>
              😊
            </span>
          </div>
          <span className="font-medium text-sm text-coral-900">Spelling Buddy</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!userId ? (
            <>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-semibold bg-coral-400 text-white hover:bg-coral-600 transition-colors"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-semibold border-2 border-amber-300 text-amber-900 bg-amber-50/80 hover:bg-amber-50 transition-colors"
                >
                  Sign up
                </button>
              </SignUpButton>
            </>
          ) : (
            <UserButton />
          )}
        </div>
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
