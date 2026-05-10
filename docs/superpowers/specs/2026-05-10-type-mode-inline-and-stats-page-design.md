# Design: Inline Type Mode + Parent Stats Page

**Date:** 2026-05-10  
**Status:** Approved

---

## Overview

Two features:
1. When the user switches to type mode, letters should appear directly in the letter tray instead of a separate visible input box appearing below it.
2. Signed-in users get a Stats page showing their overall correction rate and missed words list.

---

## Feature 1 — Inline Type Mode

### Problem
Clicking "Type instead" currently shows a visible `<input>` + Submit button below the letter tray. The tray already mirrors what's typed, so the input box is visually redundant and confusing — it looks like a second place to interact.

### Solution
Replace the visible input block with a hidden input that captures keystrokes invisibly. The letter tray becomes the sole visual output.

### Changes

**`PracticeScreen.tsx` and `MissedWordsScreen.tsx`** (same pattern in both):
- Remove the `{typeMode && <div className="mt-8 flex gap-2">…</div>}` block (the visible input + Submit button).
- Add a hidden `<input>` element:
  - Styled: `position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none`
  - Has `autoFocus` when `typeMode` is true
  - A `useRef` attached so the tray area can `.focus()` it on click
  - `onKeyDown`: Enter key calls `handleTypedSubmit()`
  - `onChange`: updates `typedInput` as before
  - `disabled` when `phase === 'result'`
- Wrap the `<LetterTray>` in a `<div>` that calls `hiddenInputRef.current?.focus()` on click, so tapping the tray area activates typing.

**`LetterTray.tsx`**:
- Accept an optional `showCursor?: boolean` prop.
- When `showCursor` is true, the first empty cell (index `letters.length`, clamped to `expectedLength - 1`) gets a blinking border: `animate-pulse border-coral-400`.

### Submit
- Enter key submits (existing behavior, unchanged).
- No visible Submit button — the user types and presses Enter (or the word is auto-submitted via Enter).

---

## Feature 2 — Parent Stats Page

### Problem
Parents asked to see their child's test history, correction rate, and missed words after signing in. The existing data already tracks total attempts, total correct, and a missed-words list — it just isn't surfaced anywhere.

### Solution
A new dedicated `StatsScreen` view, reachable via a "Stats" button in the practice screen header (signed-in users only).

### Data
No changes to the `Progress` data model. Uses:
- `progress.stats.totalAttempts`
- `progress.stats.totalCorrect`
- `progress.missedWords` — array of `{ word, missedCount, correctSinceMissed, lastMissedAt }`

### Changes

**`App.tsx`**:
- Add `'stats'` to the `View` union type.
- Add `onOpenStats` prop to `PracticeScreen`.
- Render `<StatsScreen onBack={() => setView('practice')} />` when `view === 'stats'`.

**`PracticeScreen.tsx` — Header**:
- Add `onOpenStats: () => void` to `Props` and pass it to `<Header>`.
- In `Header`, when `userId` is truthy, add a "Stats" button next to "My word list":
  ```
  <button onClick={onOpenStats}>Stats</button>
  ```
  Styled to match the "My word list" button (rounded-full, border, coral palette).

**New `src/components/StatsScreen.tsx`**:

Layout follows `MissedWordsScreen` visual conventions (same background, card, header pattern).

Sections:
1. **Header** — back button ("← Back"), Spelling Buddy logo + "Your stats" subtitle, `<UserButton />`.
2. **Overall stats card** — two columns:
   - Left: total attempts (numeric)
   - Right: correction rate as `X%` (totalCorrect / totalAttempts × 100, rounded). Shows a filled progress bar beneath. Falls back to "No attempts yet" when totalAttempts is 0.
3. **Missed words section** — header "Words to keep practising", then a list of `progress.missedWords` sorted by `missedCount` descending. Each row:
   - Word (bold, coral-900)
   - "Missed X time(s)" badge (amber-50 background)
   - Last missed date formatted as "May 8" (using `toLocaleDateString`)
   - If list is empty: "No missed words — great job! 🎉"

### Access control
The "Stats" button only renders when `userId` is truthy, so unauthenticated users never see it. The `StatsScreen` component itself loads progress via `loadProgress(user)` on mount (same pattern as `MissedWordsScreen`).

---

## Files Touched

| File | Change |
|------|--------|
| `src/App.tsx` | Add `'stats'` view, wire `onOpenStats`, render `StatsScreen` |
| `src/components/PracticeScreen.tsx` | Hidden input for type mode; add `onOpenStats` + Stats button to header |
| `src/components/MissedWordsScreen.tsx` | Hidden input for type mode (same pattern) |
| `src/components/LetterTray.tsx` | Add optional `showCursor` prop with blinking-border effect |
| `src/components/StatsScreen.tsx` | New file |

No changes to `progress.ts`, `tts.ts`, `stt.ts`, or any other lib files.
