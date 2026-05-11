import type { UserResource } from '@clerk/shared/types';

export interface MissedWord {
  word: string;
  missedCount: number;
  correctSinceMissed: number;
  lastMissedAt: string;
}

export interface Progress {
  version: 1;
  missedWords: MissedWord[];
  stats: {
    totalAttempts: number;
    totalCorrect: number;
  };
}

const LOCAL_KEY = 'spelling-buddy:progress:v1';

const EMPTY: Progress = {
  version: 1,
  missedWords: [],
  stats: { totalAttempts: 0, totalCorrect: 0 },
};

export function loadProgress(user: UserResource | null | undefined): Progress {
  if (user) {
    const cloud = user.unsafeMetadata?.spellingProgress as Progress | undefined;
    if (cloud?.version === 1) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cloud));
      return cloud;
    }
  }

  const local = localStorage.getItem(LOCAL_KEY);
  if (local) {
    try {
      const parsed = JSON.parse(local) as Progress;
      if (parsed.version === 1) return parsed;
    } catch {
      // fall through to empty
    }
  }

  return { ...EMPTY, missedWords: [], stats: { ...EMPTY.stats } };
}

export function saveProgress(user: UserResource | null | undefined, progress: Progress): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
  if (user) {
    const prev = user.unsafeMetadata;
    const base =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {};
    void user.update({
      unsafeMetadata: {
        ...base,
        spellingProgress: progress,
      },
    });
  }
}

export function recordAttempt(prev: Progress, word: string, isCorrect: boolean): Progress {
  const key = word.toLowerCase().trim();

  const next: Progress = {
    ...prev,
    stats: {
      totalAttempts: prev.stats.totalAttempts + 1,
      totalCorrect: prev.stats.totalCorrect + (isCorrect ? 1 : 0),
    },
    missedWords: [...prev.missedWords],
  };

  const existingIdx = next.missedWords.findIndex((m) => m.word === key);

  if (!isCorrect) {
    if (existingIdx >= 0) {
      next.missedWords[existingIdx] = {
        ...next.missedWords[existingIdx],
        missedCount: next.missedWords[existingIdx].missedCount + 1,
        correctSinceMissed: 0,
        lastMissedAt: new Date().toISOString(),
      };
    } else {
      next.missedWords.push({
        word: key,
        missedCount: 1,
        correctSinceMissed: 0,
        lastMissedAt: new Date().toISOString(),
      });
    }
  } else if (existingIdx >= 0) {
    const updated = {
      ...next.missedWords[existingIdx],
      correctSinceMissed: next.missedWords[existingIdx].correctSinceMissed + 1,
    };
    if (updated.correctSinceMissed >= 2) {
      next.missedWords.splice(existingIdx, 1);
    } else {
      next.missedWords[existingIdx] = updated;
    }
  }

  return next;
}
