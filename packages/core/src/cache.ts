import { get, set, del, keys } from 'idb-keyval';

const CACHE_PREFIX = 'localizer-cache:';

export async function getCachedBlob(key: string): Promise<Blob | undefined> {
  return get<Blob>(`${CACHE_PREFIX}${key}`);
}

export async function setCachedBlob(key: string, blob: Blob): Promise<void> {
  await set(`${CACHE_PREFIX}${key}`, blob);
}

export async function clearModelCache(): Promise<void> {
  const allKeys = await keys();
  await Promise.all(
    allKeys
      .filter((key) => typeof key === 'string' && key.startsWith(CACHE_PREFIX))
      .map((key) => del(key)),
  );
}

export function cacheKey(baseUrl: string, file: string): string {
  return `${baseUrl}${file}`;
}

export async function fetchWithCache(
  url: string,
  cacheEnabled: boolean,
  init?: RequestInit,
): Promise<Response> {
  const key = cacheKey('', url);
  if (cacheEnabled) {
    const cached = await getCachedBlob(key);
    if (cached) {
      return new Response(cached, { status: 200, statusText: 'OK' });
    }
  }

  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  if (cacheEnabled) {
    const blob = await response.clone().blob();
    await setCachedBlob(key, blob);
  }

  return response;
}
