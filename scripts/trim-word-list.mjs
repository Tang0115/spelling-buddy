import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const limits = [30, 50, 60, 70, 50, 40];
const pathIn = join(__dirname, '..', 'src', 'data', 'word-list.json');
const raw = JSON.parse(readFileSync(pathIn, 'utf8'));
const buckets = [[], [], [], [], [], []];

for (const e of raw) {
  const g = e.grade;
  if (g < 0 || g > 5) continue;
  if (buckets[g].length < limits[g]) {
    buckets[g].push({ word: e.word, grade: g });
  }
}

const list = buckets.flat();
writeFileSync(pathIn, JSON.stringify(list, null, 2) + '\n');
console.log('Trimmed to', list.length, 'words');
