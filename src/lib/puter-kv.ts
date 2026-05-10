interface PuterKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  del(key: string): Promise<boolean>;
}

async function getKv(): Promise<PuterKv | null> {
  try {
    const { puter } = await import('@heyputer/puter.js');
    const kv = (puter as unknown as { kv: PuterKv }).kv;
    return kv ?? null;
  } catch {
    return null;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const kv = await getKv();
    if (!kv) return null;
    const val = await kv.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const kv = await getKv();
    if (!kv) return;
    await kv.set(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Puter KV write failed:', e);
  }
}
