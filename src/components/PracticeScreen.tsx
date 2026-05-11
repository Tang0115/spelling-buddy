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
import { speak, spellWordAloud, warmUpVoices } from '../lib/tts';
import {
  primeMicrophoneForSpelling,
  retryMicrophonePrime,
  startListening,
  sttSupported,
} from '../lib/stt';
import { loadCustomWords, type CustomWordEntry } from '../lib/customWords';
import { PlayWordButton } from './PlayWordButton';
import { HelperButtons } from './HelperButtons';
import { LetterTray } from './LetterTray';
import { HoldToSpellButton } from './HoldToSpellButton';
import { FeedbackOverlay } from './FeedbackOverlay';
import { SessionCompleteOverlay } from './SessionCompleteOverlay';

type WordEntry = { word: string; grade: number };
type Phase = 'idle' | 'spelling' | 'result';
type MicGate = 'pending' | 'ready' | 'blocked' | 'skipped';

const ALL_GRADES = [0, 1, 2, 3, 4, 5];
const GRADE_LABEL: Record<number, string> = { 0: 'K', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

type Props = {
  onOpenMissed: () => void;
  onOpenCustomWords: () => void;
  onOpenStats: () => void;
  customWordsVersion: number;
};

export function PracticeScreen({ onOpenMissed, onOpenCustomWords, onOpenStats, customWordsVersion }: Props) {
  const { user, isLoaded } = useUser();
  const { userId, isLoaded: authLoaded } = useAuth({ treatPendingAsSignedOut: true });
  const [progress, setProgress] = useState<Progress>(() => loadProgress(undefined));

  // ── grade filter (persisted) ──────────────────────────────────────────────
  const [gradeFilter, setGradeFilter] = useState<number[]>(() => {
    try {
      const s = localStorage.getItem('spelling-buddy:gradeFilter');
      return s ? (JSON.parse(s) as number[]) : ALL_GRADES;
    } catch {
      return ALL_GRADES;
    }
  });

  // ── custom words ──────────────────────────────────────────────────────────
  const [customWordsList, setCustomWordsList] = useState<CustomWordEntry[]>(() =>
    loadCustomWords(),
  );
  const [useCustomWords, setUseCustomWords] = useState(false);

  useEffect(() => {
    const fresh = loadCustomWords();
    setCustomWordsList(fresh);
    // If custom list was cleared externally, turn off the toggle
    if (fresh.length === 0) setUseCustomWords(false);
  }, [customWordsVersion]);

  // ── session words ─────────────────────────────────────────────────────────
  const [sessionKey, setSessionKey] = useState(0);
  const gradeFilterKey = gradeFilter.slice().sort().join(',');

  const sessionWords = useMemo((): WordEntry[] => {
    if (useCustomWords && customWordsList.length > 0) {
      return shuffledCopy(customWordsList);
    }
    const filtered = (wordList as WordEntry[]).filter((w) => gradeFilter.includes(w.grade));
    const source = filtered.length > 0 ? filtered : (wordList as WordEntry[]);
    return shuffledCopy(source);
    // sessionKey forces a reshuffle on restart; gradeFilterKey + useCustomWords on filter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, gradeFilterKey, useCustomWords, customWordsList.length]);

  // ── core spelling state ───────────────────────────────────────────────────
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [letters, setLetters] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lastSpellWord, setLastSpellWord] = useState('');
  const [micGate, setMicGate] = useState<MicGate>(() => (sttSupported ? 'pending' : 'skipped'));

  // ── streak + session stats ────────────────────────────────────────────────
  const [streak, setStreak] = useState(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [showSessionComplete, setShowSessionComplete] = useState(false);

  // ── dictionary ────────────────────────────────────────────────────────────
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(true);
  const failStreakRef = useRef(0);

  // ── type-mode (keyboard fallback) ─────────────────────────────────────────
  const [typeMode, setTypeMode] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [sttUnavailable, setSttUnavailable] = useState(false);

  const stopListeningRef = useRef<(() => void) | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const currentWord: WordEntry = sessionWords[Math.min(wordIndex, sessionWords.length - 1)];

  const trayLetters = useMemo(() => {
    if (phase === 'result') return letters;
    if (typeMode) {
      return typedInput
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .split('')
        .filter(Boolean);
    }
    return letters;
  }, [phase, typeMode, typedInput, letters]);

  // ── load progress + custom words from Clerk when auth resolves ───────────
  useEffect(() => {
    if (!isLoaded) return;
    setProgress(loadProgress(user ?? undefined));
    if (user) {
      const cloud = loadCustomWords(user);
      if (cloud.length > 0) setCustomWordsList(cloud);
    }
  }, [isLoaded, user?.id, user]);

  useEffect(() => {
    void warmUpVoices();
  }, []);

  useEffect(() => {
    if (typeMode && phase !== 'result') {
      hiddenInputRef.current?.focus();
    }
  }, [typeMode, phase]);

  // ── prime microphone ──────────────────────────────────────────────────────
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

  // ── dictionary lookup ─────────────────────────────────────────────────────
  // Depends only on currentWord.word — wordIndex is intentionally excluded so
  // changing index without changing the word (impossible with current data, but
  // possible with custom lists) doesn't double-fetch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord.word, sessionWords.length]);

  // ── shared result handler ─────────────────────────────────────────────────
  const processResult = (allLetters: string[], word: string) => {
    const guess = allLetters.join('').toLowerCase();
    const correct = guess === word.toLowerCase();

    setLastSpellWord(word);
    setLetters(allLetters);
    setIsCorrect(correct);
    setPhase('result');
    stopListeningRef.current = null;

    if (correct) {
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      setStreak(streakRef.current);
      setSessionCorrect((c) => c + 1);
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    setProgress((prev) => {
      const next = recordAttempt(prev, word, correct);
      saveProgress(user ?? undefined, next);
      return next;
    });
  };

  // ── voice mode ────────────────────────────────────────────────────────────
  const handlePlayWord = () => void speak(currentWord.word);
  const handleDefinition = () => { if (dictEntry) void speak(dictEntry.definition); };
  const handleSentence = () => { if (dictEntry) void speak(dictEntry.example); };
  const handleSpellItOut = () => void spellWordAloud(currentWord.word);

  const handleSpellStart = () => {
    if (!sttSupported) {
      setSttUnavailable(true);
      return;
    }
    if (micGate !== 'ready') return;
    setLetters([]);
    setPhase('spelling');

    const wordBeingSpelled = currentWord.word;
    const stop = startListening(wordBeingSpelled, {
      onLetter: (letter) => {
        setLetters((prev) => [...prev, letter]);
      },
      onEnd: (allLetters) => {
        processResult(allLetters, wordBeingSpelled);
      },
    });
    stopListeningRef.current = stop;
  };

  const handleSpellEnd = () => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
  };

  // ── type mode ─────────────────────────────────────────────────────────────
  const handleTypedSubmit = () => {
    const cleanLetters = typedInput
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('')
      .filter(Boolean);
    if (cleanLetters.length === 0) return;
    setTypedInput('');
    processResult(cleanLetters, currentWord.word);
  };

  // ── navigation ────────────────────────────────────────────────────────────
  const handleNext = () => {
    failStreakRef.current = 0;
    setLetters([]);
    setIsCorrect(null);
    setPhase('idle');
    setTypedInput('');

    if (sessionAttempts + 1 >= sessionWords.length) {
      setShowSessionComplete(true);
      return;
    }
    setSessionAttempts((a) => a + 1);
    setWordIndex((i) => (i + 1) % sessionWords.length);
  };

  const handleSessionRestart = () => {
    setShowSessionComplete(false);
    setSessionAttempts(0);
    setSessionCorrect(0);
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setStreak(0);
    setWordIndex(0);
    setSessionKey((k) => k + 1);
  };

  // ── grade filter ──────────────────────────────────────────────────────────
  const handleGradeToggle = (grade: number) => {
    setGradeFilter((prev) => {
      const next = prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade];
      const result = next.length > 0 ? next : prev;
      localStorage.setItem('spelling-buddy:gradeFilter', JSON.stringify(result));
      return result;
    });
    setWordIndex(0);
    setSessionAttempts(0);
    setSessionCorrect(0);
    streakRef.current = 0;
    setStreak(0);
    setSessionKey((k) => k + 1);
  };

  const handleToggleCustomWords = () => {
    setUseCustomWords((u) => !u);
    setWordIndex(0);
    setSessionAttempts(0);
    setSessionCorrect(0);
    streakRef.current = 0;
    setStreak(0);
    setSessionKey((k) => k + 1);
  };

  const handleRetryMic = () => {
    setMicGate('pending');
    void (async () => {
      const ok = await retryMicrophonePrime();
      setMicGate(ok ? 'ready' : 'blocked');
    })();
  };

  const playBusy = phase === 'spelling' || phase === 'result' || micGate === 'pending';
  const missedCount = progress.missedWords.length;

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center box-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">

      {/* Grade filter + word source controls */}
      <div className="w-full max-w-xl mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-coral-800/70 shrink-0">Grades:</span>
          {ALL_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => handleGradeToggle(g)}
              disabled={useCustomWords}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 ${
                gradeFilter.includes(g)
                  ? 'bg-coral-400 text-white'
                  : 'bg-white text-coral-800 border border-coral-200 hover:bg-coral-50'
              }`}
            >
              {GRADE_LABEL[g]}
            </button>
          ))}
          {customWordsList.length > 0 && (
            <button
              type="button"
              onClick={handleToggleCustomWords}
              className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                useCustomWords
                  ? 'bg-amber-400 text-white border-amber-400'
                  : 'border-amber-300 text-amber-900 bg-white hover:bg-amber-50'
              }`}
            >
              {useCustomWords ? 'My words ✓' : 'My words'}
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm overflow-hidden border border-coral-50 relative">

        {/* Mic gate overlay */}
        {(micGate === 'pending' || micGate === 'blocked') && sttSupported && !typeMode && (
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
                  ? "Spelling Buddy needs the microphone when your browser asks. Please tap Allow so your first word isn’t missed."
                  : "We can’t hear your spelling without the microphone. Allow access in your browser settings, then try again."}
              </p>
              {micGate === 'blocked' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleRetryMic}
                    className="w-full py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTypeMode(true); setMicGate('skipped'); }}
                    className="w-full py-3 rounded-xl border-2 border-coral-200 text-coral-800 hover:bg-coral-50 font-semibold text-sm transition-colors"
                  >
                    Type instead
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session complete overlay */}
        {showSessionComplete && (
          <SessionCompleteOverlay
            wordsAttempted={sessionAttempts + 1}
            correctCount={sessionCorrect}
            bestStreak={bestStreakRef.current}
            missedCount={missedCount}
            onRestart={handleSessionRestart}
            onMissed={() => { setShowSessionComplete(false); onOpenMissed(); }}
          />
        )}

        <Header
          wordIndex={wordIndex}
          total={sessionWords.length}
          grade={currentWord.grade}
          streak={streak}
          onOpenCustomWords={onOpenCustomWords}
          onOpenStats={onOpenStats}
        />

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
            onSpellItOut={handleSpellItOut}
            disabled={playBusy || dictLoading || !dictEntry}
          />

          <div
            onClick={() => typeMode && phase !== 'result' && hiddenInputRef.current?.focus()}
            className={typeMode && phase !== 'result' ? 'cursor-text' : ''}
          >
            <LetterTray
              letters={trayLetters}
              expectedLength={currentWord.word.length}
              overflowContext={typeMode ? 'type' : 'voice'}
              showCursor={typeMode && phase !== 'result'}
            />
          </div>

          {!typeMode && (
            <HoldToSpellButton
              onPressStart={handleSpellStart}
              onPressEnd={handleSpellEnd}
              isListening={phase === 'spelling'}
              disabled={phase === 'result' || (sttSupported ? micGate !== 'ready' : false)}
            />
          )}

          {typeMode && (
            <input
              ref={hiddenInputRef}
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
              disabled={phase === 'result'}
              aria-hidden="true"
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />
          )}

          {/* Voice / type toggle */}
          <div className="mt-3 text-center">
            {sttUnavailable && !typeMode && (
              <p className="text-xs text-coral-700 mb-1">
                Voice spelling needs Chrome or Edge.
              </p>
            )}
            {sttSupported ? (
              <button
                type="button"
                onClick={() => { setTypeMode((t) => !t); setLetters([]); setTypedInput(''); setSttUnavailable(false); }}
                className="text-xs text-coral-700/70 hover:text-coral-900 underline"
              >
                {typeMode ? 'Switch to voice' : 'Type instead'}
              </button>
            ) : (
              !typeMode && (
                <button
                  type="button"
                  onClick={() => setTypeMode(true)}
                  className="text-xs text-coral-700/70 hover:text-coral-900 underline"
                >
                  Type instead
                </button>
              )
            )}
          </div>
        </div>

        {phase === 'result' && isCorrect !== null && (
          <FeedbackOverlay
            isCorrect={isCorrect}
            correctWord={lastSpellWord}
            streak={streak}
            onNext={handleNext}
            onSpellItOut={() => void spellWordAloud(lastSpellWord)}
          />
        )}
      </div>
    </div>
  );
}

function Header({
  wordIndex,
  total,
  grade,
  streak,
  onOpenCustomWords,
  onOpenStats,
}: {
  wordIndex: number;
  total: number;
  grade: number;
  streak: number;
  onOpenCustomWords: () => void;
  onOpenStats: () => void;
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
          <button
            type="button"
            onClick={onOpenCustomWords}
            className="py-1.5 px-3 rounded-full text-xs font-semibold border border-coral-200 text-coral-700 hover:bg-coral-50 transition-colors"
          >
            My word list
          </button>
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
            <>
              <button
                type="button"
                onClick={onOpenStats}
                className="py-1.5 px-3 rounded-full text-xs font-semibold border border-coral-200 text-coral-700 hover:bg-coral-50 transition-colors"
              >
                Stats
              </button>
              <UserButton />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm flex-wrap justify-end">
        {streak >= 2 && (
          <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full font-semibold text-xs">
            🔥 {streak} streak
          </span>
        )}
        <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full font-medium">
          Word {wordIndex + 1} of {total}
        </span>
        <span className="bg-coral-50 text-coral-800 px-2.5 py-1 rounded-full font-medium">
          Grade {grade === 0 ? 'K' : grade}
        </span>
      </div>
    </div>
  );
}
