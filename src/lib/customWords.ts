import { kvGet, kvSet } from './puter-kv';

export interface CustomWordEntry {
  word: string;
  grade: number;
}

const KEY = 'spelling-buddy:customWords:v1';

export function loadCustomWords(): CustomWordEntry[] {
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

export async function loadCustomWordsFromPuter(userId: string): Promise<CustomWordEntry[] | null> {
  const words = await kvGet<CustomWordEntry[]>(`customWords:${userId}`);
  if (!Array.isArray(words)) return null;
  return words.filter(
    (e): e is CustomWordEntry =>
      typeof e === 'object' && e !== null && typeof e.word === 'string' && typeof e.grade === 'number',
  );
}

export function saveCustomWords(words: CustomWordEntry[], userId?: string): void {
  localStorage.setItem(KEY, JSON.stringify(words));
  if (userId) {
    void kvSet(`customWords:${userId}`, words);
  }
}

export function clearCustomWords(userId?: string): void {
  localStorage.removeItem(KEY);
  if (userId) {
    void kvSet(`customWords:${userId}`, []);
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
