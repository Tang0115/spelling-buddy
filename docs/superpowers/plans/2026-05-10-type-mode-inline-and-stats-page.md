# Inline Type Mode + Parent Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible type-mode input box so letters appear directly in the letter tray, and add a Stats page for signed-in parents showing correction rate and missed words.

**Architecture:** Feature 1 replaces the visible `<input>` block in PracticeScreen and MissedWordsScreen with a hidden zero-size input that captures keystrokes invisibly — the letter tray already mirrors typed letters, so it becomes the sole visual output. Feature 2 adds a new `StatsScreen` view wired into App's navigation, accessible via a Stats button in the PracticeScreen header (signed-in users only).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Clerk (auth + user metadata), Vite

---

## File Map

| File | Action |
|------|--------|
| `src/components/LetterTray.tsx` | Modify — add optional `showCursor` prop |
| `src/components/PracticeScreen.tsx` | Modify — hidden input, cursor prop, Stats button |
| `src/components/MissedWordsScreen.tsx` | Modify — hidden input, cursor prop (same pattern) |
| `src/components/StatsScreen.tsx` | Create — new stats view |
| `src/App.tsx` | Modify — add `'stats'` view, wire `onOpenStats` |

---

## Task 1: Add `showCursor` prop to LetterTray

**Files:**
- Modify: `src/components/LetterTray.tsx`

- [ ] **Step 1: Update Props type and cell rendering**

Replace the entire file contents with:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LetterTray.tsx
git commit -m "feat: add showCursor prop to LetterTray"
```

---

## Task 2: Inline type mode in PracticeScreen

**Files:**
- Modify: `src/components/PracticeScreen.tsx`

- [ ] **Step 1: Add hiddenInputRef and focus effect**

After the existing `stopListeningRef` declaration (line 110), add:

```tsx
const hiddenInputRef = useRef<HTMLInputElement>(null);
```

After the existing `warmUpVoices` useEffect (around line 133), add:

```tsx
useEffect(() => {
  if (typeMode && phase !== 'result') {
    hiddenInputRef.current?.focus();
  }
}, [typeMode, phase]);
```

- [ ] **Step 2: Replace visible input block with hidden input**

Find and remove this block entirely (the visible input + submit button):

```tsx
          {typeMode && (
            <div className="mt-8 flex gap-2">
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
                placeholder="Type the spelling…"
                autoFocus
                disabled={phase === 'result'}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-coral-200 focus:border-coral-400 text-coral-900 bg-white outline-none text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleTypedSubmit}
                disabled={phase === 'result' || !typedInput.trim()}
                className="px-4 py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
              >
                Submit
              </button>
            </div>
          )}
```

Replace it with a hidden input only:

```tsx
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
```

- [ ] **Step 3: Wrap LetterTray in a clickable div and pass showCursor**

Find the existing `<LetterTray ... />` usage in the `p-8` section and replace it with:

```tsx
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
```

- [ ] **Step 4: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeScreen.tsx
git commit -m "feat: inline type mode in PracticeScreen — hidden input, tray is the visual"
```

---

## Task 3: Inline type mode in MissedWordsScreen

**Files:**
- Modify: `src/components/MissedWordsScreen.tsx`

- [ ] **Step 1: Add hiddenInputRef and focus effect**

After the existing `stopListeningRef` declaration (around line 61), add:

```tsx
const hiddenInputRef = useRef<HTMLInputElement>(null);
```

After the existing `warmUpVoices` useEffect (around line 104), add:

```tsx
useEffect(() => {
  if (typeMode && phase !== 'result') {
    hiddenInputRef.current?.focus();
  }
}, [typeMode, phase]);
```

- [ ] **Step 2: Replace visible input block with hidden input**

Find and remove this block entirely:

```tsx
              {typeMode && (
                <div className="mt-8 flex gap-2">
                  <input
                    type="text"
                    value={typedInput}
                    onChange={(e) => setTypedInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
                    placeholder="Type the spelling…"
                    autoFocus
                    disabled={phase === 'result'}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-coral-200 focus:border-coral-400 text-coral-900 bg-white outline-none text-sm disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleTypedSubmit}
                    disabled={phase === 'result' || !typedInput.trim()}
                    className="px-4 py-3 rounded-xl bg-coral-400 hover:bg-coral-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              )}
```

Replace it with:

```tsx
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
```

- [ ] **Step 3: Wrap LetterTray in a clickable div and pass showCursor**

Find the existing `<LetterTray ... />` in the missed words body section and replace it with:

```tsx
              <div
                onClick={() => typeMode && phase !== 'result' && hiddenInputRef.current?.focus()}
                className={typeMode && phase !== 'result' ? 'cursor-text' : ''}
              >
                <LetterTray
                  letters={trayLetters}
                  expectedLength={currentWordStr.length}
                  overflowContext={typeMode ? 'type' : 'voice'}
                  showCursor={typeMode && phase !== 'result'}
                />
              </div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/MissedWordsScreen.tsx
git commit -m "feat: inline type mode in MissedWordsScreen — hidden input, tray is the visual"
```

---

## Task 4: Create StatsScreen component

**Files:**
- Create: `src/components/StatsScreen.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/StatsScreen.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { UserButton, useAuth, useUser } from '@clerk/react';
import { loadProgress, type Progress } from '../lib/progress';

type Props = {
  onBack: () => void;
};

export function StatsScreen({ onBack }: Props) {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth({ treatPendingAsSignedOut: true });
  const [progress, setProgress] = useState<Progress>(() => loadProgress(undefined));

  useEffect(() => {
    if (!isLoaded) return;
    setProgress(loadProgress(user ?? undefined));
  }, [isLoaded, user?.id, user]);

  const { totalAttempts, totalCorrect } = progress.stats;
  const correctionRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
  const sortedMissed = [...progress.missedWords].sort((a, b) => b.missedCount - a.missedCount);

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center box-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm overflow-hidden border border-coral-50">

        {/* Header */}
        <div className="p-5 border-b border-coral-50 space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-coral-700 hover:text-coral-900 transition-colors mb-1"
          >
            ← Back
          </button>

          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center shrink-0">
                <span className="text-amber-800" aria-hidden>😊</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium text-sm text-coral-900 block">Spelling Buddy</span>
                <span className="text-xs text-coral-800/80">Your stats</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {userId && <UserButton />}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Overall stats card */}
          <div className="rounded-xl border border-coral-100 bg-coral-50/40 p-5">
            {totalAttempts === 0 ? (
              <p className="text-sm text-coral-800/70 text-center">No attempts yet — start practising!</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-6">
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-coral-900">{totalAttempts}</p>
                    <p className="text-xs text-coral-800/70 mt-1">Total attempts</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-coral-900">{correctionRate}%</p>
                    <p className="text-xs text-coral-800/70 mt-1">Correct</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-coral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-coral-400 rounded-full transition-all"
                    style={{ width: `${correctionRate}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Missed words list */}
          <div>
            <h2 className="text-sm font-semibold text-coral-900 mb-3">Words to keep practising</h2>
            {sortedMissed.length === 0 ? (
              <p className="text-sm text-coral-800/70 text-center py-4">No missed words — great job! 🎉</p>
            ) : (
              <ul className="space-y-0">
                {sortedMissed.map((m) => (
                  <li
                    key={m.word}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-coral-50 last:border-0"
                  >
                    <span className="font-semibold text-coral-900 capitalize">{m.word}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Missed {m.missedCount}×
                      </span>
                      <span className="text-xs text-coral-800/50">
                        {new Date(m.lastMissedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatsScreen.tsx
git commit -m "feat: add StatsScreen component with correction rate and missed words list"
```

---

## Task 5: Wire StatsScreen into App and PracticeScreen header

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/PracticeScreen.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the entire file with:

```tsx
import { useState } from 'react';
import { PracticeScreen } from './components/PracticeScreen';
import { MissedWordsScreen } from './components/MissedWordsScreen';
import { CustomWordsScreen } from './components/CustomWordsScreen';
import { StatsScreen } from './components/StatsScreen';

type View = 'practice' | 'missed' | 'custom-words' | 'stats';

function App() {
  const [view, setView] = useState<View>('practice');
  const [customWordsVersion, setCustomWordsVersion] = useState(0);

  if (view === 'missed') {
    return <MissedWordsScreen onBack={() => setView('practice')} />;
  }

  if (view === 'custom-words') {
    return (
      <CustomWordsScreen
        onBack={() => {
          setCustomWordsVersion((v) => v + 1);
          setView('practice');
        }}
      />
    );
  }

  if (view === 'stats') {
    return <StatsScreen onBack={() => setView('practice')} />;
  }

  return (
    <PracticeScreen
      onOpenMissed={() => setView('missed')}
      onOpenCustomWords={() => setView('custom-words')}
      onOpenStats={() => setView('stats')}
      customWordsVersion={customWordsVersion}
    />
  );
}

export default App;
```

- [ ] **Step 2: Add onOpenStats prop to PracticeScreen and Stats button to Header**

In `src/components/PracticeScreen.tsx`:

**2a.** Update the `Props` type (around line 35) to add `onOpenStats`:

```tsx
type Props = {
  onOpenMissed: () => void;
  onOpenCustomWords: () => void;
  onOpenStats: () => void;
  customWordsVersion: number;
};
```

**2b.** Update the function signature to destructure `onOpenStats`:

```tsx
export function PracticeScreen({ onOpenMissed, onOpenCustomWords, onOpenStats, customWordsVersion }: Props) {
```

**2c.** Pass `onOpenStats` to `<Header>`. Find the Header usage and add the prop:

```tsx
        <Header
          wordIndex={wordIndex}
          total={sessionWords.length}
          grade={currentWord.grade}
          streak={streak}
          onOpenCustomWords={onOpenCustomWords}
          onOpenStats={onOpenStats}
        />
```

**2d.** Update the `Header` function signature (near the bottom of the file) to accept and use `onOpenStats`:

```tsx
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
```

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/PracticeScreen.tsx
git commit -m "feat: wire StatsScreen into App navigation and add Stats button to header"
```

---

## Manual Verification Checklist

After all tasks are complete:

1. Run `npm run dev` and open the app.
2. **Type mode — inline tray:**
   - Click "Type instead" — confirm no visible input box appears below the tray.
   - Type letters — confirm they appear one-by-one in the tray cells.
   - Confirm the active (next empty) cell pulses with a coral border.
   - Press Enter — confirm the word is submitted and the feedback overlay appears.
   - Click anywhere on the tray — confirm focus returns to the hidden input and typing resumes.
   - Click "Switch to voice" — confirm the cursor disappears and voice mode works.
3. **Stats page:**
   - Sign in with Clerk.
   - Confirm a "Stats" button appears in the header (not visible when signed out).
   - Click Stats — confirm the stats page loads with overall attempts and correction rate.
   - Confirm the missed words list is sorted by missed count descending.
   - Click ← Back — confirm return to practice screen.
