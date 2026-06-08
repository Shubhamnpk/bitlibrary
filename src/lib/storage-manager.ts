export type StorageCategory = 'account' | 'reader' | 'api-cache' | 'page-cache' | 'unknown';
export type CacheScope = 'api' | 'page';

export interface StorageEntryReport {
  key: string;
  category: StorageCategory;
  label: string;
  bytes: number;
  updatedAt?: number;
  ttlMs?: number;
  stale: boolean;
  protected: boolean;
}

export interface StorageSummary {
  totalBytes: number;
  staleBytes: number;
  staleCount: number;
  entryCount: number;
  categories: Record<StorageCategory, { bytes: number; count: number; staleCount: number }>;
}

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

type CacheBucket = Record<string, CacheEntry>;
type ReaderBucket = Record<string, CacheEntry>;

const KB = 1024;
const MB = 1024 * KB;

export const USER_STORAGE_KEY = 'bitlibrary-user-state-v1';
export const READER_STORAGE_KEY = 'bitlibrary-reader-state-v1';
export const API_CACHE_STORAGE_KEY = 'bitlibrary-api-cache-v1';
export const PAGE_CACHE_STORAGE_KEY = 'bitlibrary-page-cache-v1';

export const RECOVERABLE_CACHE_BUDGET_BYTES = 2 * MB;
const API_CACHE_BUDGET_BYTES = 1.5 * MB;
const PAGE_CACHE_BUDGET_BYTES = 850 * KB;
const STORAGE_EVENT = 'bitlibrary:storage-report-changed';

const CACHE_STORAGE_KEYS: Record<CacheScope, string> = {
  api: API_CACHE_STORAGE_KEY,
  page: PAGE_CACHE_STORAGE_KEY,
};

const emptyCategorySummary = () => ({
  account: { bytes: 0, count: 0, staleCount: 0 },
  reader: { bytes: 0, count: 0, staleCount: 0 },
  'api-cache': { bytes: 0, count: 0, staleCount: 0 },
  'page-cache': { bytes: 0, count: 0, staleCount: 0 },
  unknown: { bytes: 0, count: 0, staleCount: 0 },
});

const isBrowserStorageAvailable = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const getStorageByteSize = (key: string, value: string) => {
  try {
    return new Blob([key, value]).size;
  } catch {
    return key.length + value.length;
  }
};

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const readTimestamp = (value: string): number | undefined => {
  const parsed = safeParse<{ timestamp?: unknown; updatedAt?: unknown }>(value, {});
  const timestamp = Number(parsed.timestamp ?? parsed.updatedAt);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
};

const isEntryStale = (updatedAt: number | undefined, ttlMs: number | undefined) => (
  Boolean(updatedAt && ttlMs && Date.now() - updatedAt > ttlMs)
);

const emitStorageChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
};

export const getStorageReportEventName = () => STORAGE_EVENT;
export const notifyStorageReportChanged = emitStorageChange;

const getCacheStorageKey = (scope: CacheScope) => CACHE_STORAGE_KEYS[scope];

const readCacheBucket = (scope: CacheScope): CacheBucket => {
  if (!isBrowserStorageAvailable()) return {};
  return safeParse<CacheBucket>(readStorageItem(getCacheStorageKey(scope)), {});
};

export const readCacheSnapshot = (scope: CacheScope) => readCacheBucket(scope);

const readReaderBucket = (): ReaderBucket => {
  if (!isBrowserStorageAvailable()) return {};
  return safeParse<ReaderBucket>(readStorageItem(READER_STORAGE_KEY), {});
};

export const readReaderSnapshot = () => readReaderBucket();

const writeCacheBucket = (scope: CacheScope, bucket: CacheBucket) => {
  if (!isBrowserStorageAvailable()) return;
  writeStorageItem(getCacheStorageKey(scope), JSON.stringify(bucket));
  emitStorageChange();
};

const writeReaderBucket = (bucket: ReaderBucket) => {
  if (!isBrowserStorageAvailable()) return;
  writeStorageItem(READER_STORAGE_KEY, JSON.stringify(bucket));
  emitStorageChange();
};

export const readCacheEntry = <T>(scope: CacheScope, key: string, ttlMs: number): T | null => {
  const bucket = readCacheBucket(scope);
  const entry = bucket[key] as CacheEntry<T> | undefined;
  if (!entry?.timestamp || Date.now() - entry.timestamp > ttlMs) {
    if (entry) {
      delete bucket[key];
      writeCacheBucket(scope, bucket);
    }
    return null;
  }

  return entry.data;
};

export const writeCacheEntry = (scope: CacheScope, key: string, data: unknown) => {
  const bucket = readCacheBucket(scope);
  bucket[key] = { data, timestamp: Date.now() };
  writeCacheBucket(scope, bucket);
  enforceCacheBudget();
};

export const readReaderEntry = <T>(key: string): T | null => {
  const entry = readReaderBucket()[key] as CacheEntry<T> | undefined;
  return entry?.data ?? null;
};

export const writeReaderEntry = (key: string, data: unknown) => {
  const bucket = readReaderBucket();
  bucket[key] = { data, timestamp: Date.now() };
  writeReaderBucket(bucket);
};

const pruneCacheBucket = (scope: CacheScope, maxBytes: number) => {
  if (!isBrowserStorageAvailable()) return 0;
  const storageKey = getCacheStorageKey(scope);
  let bucket = readCacheBucket(scope);
  let serialized = JSON.stringify(bucket);
  if (getStorageByteSize(storageKey, serialized) <= maxBytes) return 0;

  const entries = Object.entries(bucket).sort((first, second) => first[1].timestamp - second[1].timestamp);
  let removed = 0;
  for (const [entryKey] of entries) {
    delete bucket[entryKey];
    removed += 1;
    serialized = JSON.stringify(bucket);
    if (getStorageByteSize(storageKey, serialized) <= maxBytes) break;
  }

  writeCacheBucket(scope, bucket);
  return removed;
};

export const enforceCacheBudget = (maxBytes = RECOVERABLE_CACHE_BUDGET_BYTES) => {
  let removed = 0;
  removed += pruneCacheBucket('api', API_CACHE_BUDGET_BYTES);
  removed += pruneCacheBucket('page', PAGE_CACHE_BUDGET_BYTES);

  const report = getStorageReport();
  const recoverableBytes = report
    .filter((entry) => entry.category === 'api-cache' || entry.category === 'page-cache')
    .reduce((sum, entry) => sum + entry.bytes, 0);

  if (recoverableBytes > maxBytes) {
    removed += pruneCacheBucket('api', Math.max(0, API_CACHE_BUDGET_BYTES - (recoverableBytes - maxBytes)));
  }

  return removed;
};

const reportKey = (key: string): Omit<StorageEntryReport, 'bytes' | 'updatedAt' | 'stale'> | null => {
  if (key === USER_STORAGE_KEY) {
    return { key, category: 'account', label: 'Local account and library', protected: true };
  }
  if (key === READER_STORAGE_KEY) {
    return { key, category: 'reader', label: 'Reader state bucket', protected: false };
  }
  if (key === API_CACHE_STORAGE_KEY) {
    return { key, category: 'api-cache', label: 'API cache bucket', protected: false };
  }
  if (key === PAGE_CACHE_STORAGE_KEY) {
    return { key, category: 'page-cache', label: 'Page cache bucket', protected: false };
  }
  if (key.startsWith('bitlibrary-')) {
    return { key, category: 'unknown', label: 'Unmanaged BitLibrary storage', protected: true };
  }
  return null;
};

export const getStorageReport = (): StorageEntryReport[] => {
  if (!isBrowserStorageAvailable()) return [];

  const entries: StorageEntryReport[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    const base = reportKey(key);
    if (!base) continue;

    const value = window.localStorage.getItem(key);
    if (value === null) continue;

    const updatedAt = readTimestamp(value);
    const ttlMs = base.ttlMs;
    entries.push({
      ...base,
      bytes: getStorageByteSize(key, value),
      updatedAt,
      ttlMs,
      stale: isEntryStale(updatedAt, ttlMs),
    });
  }

  return entries.sort((first, second) => second.bytes - first.bytes);
};

export const getStorageSummary = (entries = getStorageReport()): StorageSummary => {
  const categories = emptyCategorySummary();
  let totalBytes = 0;
  let staleBytes = 0;
  let staleCount = 0;

  entries.forEach((entry) => {
    totalBytes += entry.bytes;
    categories[entry.category].bytes += entry.bytes;
    categories[entry.category].count += 1;
    if (entry.stale) {
      staleBytes += entry.bytes;
      staleCount += 1;
      categories[entry.category].staleCount += 1;
    }
  });

  return {
    totalBytes,
    staleBytes,
    staleCount,
    entryCount: entries.length,
    categories,
  };
};

const removeKeys = (keys: string[]) => {
  if (!isBrowserStorageAvailable()) return 0;
  let removed = 0;
  keys.forEach((key) => {
    try {
      removeStorageItem(key);
      removed += 1;
    } catch {
      // Storage cleanup is best effort.
    }
  });
  if (removed > 0) emitStorageChange();
  return removed;
};

export const clearStorageCategory = (category: StorageCategory) => {
  const keys = getStorageReport()
    .filter((entry) => entry.category === category && !entry.protected)
    .map((entry) => entry.key);
  return removeKeys(keys);
};

export const clearStaleCaches = () => {
  const keys = getStorageReport()
    .filter((entry) => entry.stale && !entry.protected && ['api-cache', 'page-cache'].includes(entry.category))
    .map((entry) => entry.key);
  return removeKeys(keys);
};

export const clearRecoverableCaches = () => {
  const keys = getStorageReport()
    .filter((entry) => !entry.protected && ['api-cache', 'page-cache'].includes(entry.category))
    .map((entry) => entry.key);
  return removeKeys(keys);
};

export const formatStorageBytes = (bytes: number) => {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(bytes < 10 * KB ? 1 : 0)} KB`;
  return `${(bytes / MB).toFixed(2)} MB`;
};
import { readStorageItem, removeStorageItem, writeStorageItem } from '@/lib/encrypted-storage';
