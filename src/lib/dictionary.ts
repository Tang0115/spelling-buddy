// Looks up definition and example from Free Dictionary API, caches in localStorage.

export interface DictionaryEntry {
  word: string;
  definition: string;
  example: string;
  fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'dict:cache:v3:';

type RawDef = { definition?: string; example?: string };

type RawEntry = {
  meanings?: Array<{ definitions?: RawDef[] }>;
};

function pickDefinitionAndExample(
  data: RawEntry[],
  normalized: string,
): { definition: string; example: string } | null {
  let definition: string | undefined;
  let example: string | undefined;

  for (const entry of data) {
    for (const meaning of entry.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (typeof def.definition === 'string' && def.definition.trim() && !definition) {
          definition = def.definition.trim();
        }
        const ex = def.example?.trim();
        if (ex && !example) {
          example = ex;
        }
        if (definition && example) {
          return { definition, example };
        }
      }
    }
  }

  if (!definition) {
    return null;
  }

  return {
    definition,
    example: example ?? `Here is an example with the word ${normalized}.`,
  };
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const normalized = word.toLowerCase().trim();
  const cacheKey = CACHE_KEY_PREFIX + normalized;

  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as DictionaryEntry;
    } catch {
      // fall through to refetch on parse error
    }
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as RawEntry[];
    const picked = pickDefinitionAndExample(data, normalized);
    if (!picked) return null;

    const entry: DictionaryEntry = {
      word: normalized,
      definition: picked.definition,
      example: picked.example,
      fetchedAt: Date.now(),
    };

    localStorage.setItem(cacheKey, JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}
