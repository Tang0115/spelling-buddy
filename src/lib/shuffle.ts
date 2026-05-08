/** Fisher–Yates shuffle; mutates and returns the same array. */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Random order; does not mutate the source array. */
export function shuffledCopy<T>(items: readonly T[]): T[] {
  return shuffleInPlace([...items]);
}
