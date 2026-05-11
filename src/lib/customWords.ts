import type { UserResource } from '@clerk/shared/types';

export interface CustomWordEntry {
  word: string;
  grade: number;
}

const KEY = 'spelling-buddy:customWords:v1';

export function loadCustomWords(user?: UserResource | null): CustomWordEntry[] {
  if (user) {
    const cloud = user.unsafeMetadata?.customWords as CustomWordEntry[] | undefined;
    if (Array.isArray(cloud)) {
      localStorage.setItem(KEY, JSON.stringify(cloud));
      return cloud.filter(
        (e): e is CustomWordEntry =>
          typeof e === 'object' && e !== null && typeof e.word === 'string' && typeof e.grade === 'number',
      );
    }
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CustomWordEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.word === 'string' &&
        typeof e.grade === 'number',
    );
  } catch {
    return [];
  }
}

export function saveCustomWords(words: CustomWordEntry[], user?: UserResource | null): void {
  localStorage.setItem(KEY, JSON.stringify(words));
  if (user) {
    const prev = user.unsafeMetadata;
    const base =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {};
    void user.update({
      unsafeMetadata: {
        ...base,
        customWords: words,
      },
    });
  }
}

export function clearCustomWords(user?: UserResource | null): void {
  localStorage.removeItem(KEY);
  if (user) {
    const prev = user.unsafeMetadata;
    const base =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : {};
    void user.update({
      unsafeMetadata: {
        ...base,
        customWords: [],
      },
    });
  }
}

/** Parse a parent-typed word list. Each line: "word" or "word, grade". */
export function parseWordInput(text: string): CustomWordEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const word = (parts[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
      if (!word) return [];
      const gradeRaw = parseInt(parts[1] ?? '3', 10);
      const grade = isNaN(gradeRaw) || gradeRaw < 0 || gradeRaw > 5 ? 3 : gradeRaw;
      return [{ word, grade }];
    });
}
