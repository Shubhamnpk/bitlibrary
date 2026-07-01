import type { LocalUserState } from '@/types/index';
import { readLocalUserState, writeLocalUserState } from '@/lib/local-user';
import {
  readCacheSnapshot,
  readReaderSnapshot,
  writeCacheSnapshot,
  writeReaderSnapshot,
  type CacheScope,
} from '@/lib/storage-manager';

export type DataPortabilityCategory = 'profile' | 'library' | 'history' | 'reader' | 'cache';

export const DATA_PORTABILITY_CATEGORIES: Array<{ id: DataPortabilityCategory; label: string; description: string }> = [
  { id: 'profile', label: 'Profile', description: 'Display name, theme, and preferences.' },
  { id: 'library', label: 'Saved Library', description: 'Saved books and saved audiobooks.' },
  { id: 'history', label: 'Book History', description: 'Recent searches and recently viewed books.' },
  { id: 'reader', label: 'Reader Data', description: 'PDF progress, bookmarks, highlights, notes, and reader settings.' },
  { id: 'cache', label: 'Caches', description: 'Recoverable API and page caches for faster browsing.' },
];

const EXPORT_VERSION = 1;

type PortableCacheBucket = ReturnType<typeof readCacheSnapshot>;
type PortableReaderBucket = ReturnType<typeof readReaderSnapshot>;

export interface BitLibraryExportFile {
  app: 'bitlibrary';
  version: number;
  exportedAt: string;
  categories: DataPortabilityCategory[];
  data: {
    profile?: LocalUserState['profile'];
    settings?: LocalUserState['settings'];
    savedBooks?: LocalUserState['savedBooks'];
    savedAudiobooks?: LocalUserState['savedAudiobooks'];
    recentSearches?: LocalUserState['recentSearches'];
    recentlyViewed?: LocalUserState['recentlyViewed'];
    reader?: PortableReaderBucket;
    caches?: Partial<Record<CacheScope, PortableCacheBucket>>;
  };
}

const uniqueBy = <T>(items: T[], getKey: (item: T) => string | undefined) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mergeTextList = (incoming: string[] | undefined, existing: string[]) => (
  Array.from(new Set([...(incoming || []), ...existing].map((entry) => entry.trim()).filter(Boolean)))
);

const pickCategories = (categories: DataPortabilityCategory[]) => new Set(categories);

export const createBitLibraryExport = (categories: DataPortabilityCategory[]): BitLibraryExportFile => {
  const selected = pickCategories(categories);
  const localUser = readLocalUserState();
  const data: BitLibraryExportFile['data'] = {};

  if (selected.has('profile')) {
    data.profile = localUser.profile;
    data.settings = localUser.settings;
  }

  if (selected.has('library')) {
    data.savedBooks = localUser.savedBooks;
    data.savedAudiobooks = localUser.savedAudiobooks;
  }

  if (selected.has('history')) {
    data.recentSearches = localUser.recentSearches;
    data.recentlyViewed = localUser.recentlyViewed;
  }

  if (selected.has('reader')) {
    data.reader = readReaderSnapshot();
  }

  if (selected.has('cache')) {
    data.caches = {
      api: readCacheSnapshot('api'),
      page: readCacheSnapshot('page'),
    };
  }

  return {
    app: 'bitlibrary',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    data,
  };
};

const isExportCategory = (value: unknown): value is DataPortabilityCategory => (
  typeof value === 'string' && DATA_PORTABILITY_CATEGORIES.some((category) => category.id === value)
);

export const parseBitLibraryExport = (value: string): BitLibraryExportFile => {
  const parsed = JSON.parse(value) as Partial<BitLibraryExportFile>;
  if (parsed.app !== 'bitlibrary' || typeof parsed.version !== 'number' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('This does not look like a BitLibrary export file.');
  }

  return {
    app: 'bitlibrary',
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    categories: Array.isArray(parsed.categories) ? parsed.categories.filter(isExportCategory) : [],
    data: parsed.data,
  };
};

export const importBitLibraryExport = (portable: BitLibraryExportFile, categories: DataPortabilityCategory[]) => {
  const selected = pickCategories(categories);
  const currentUser = readLocalUserState();
  const nextUser: LocalUserState = {
    ...currentUser,
    profile: selected.has('profile') && portable.data.profile ? portable.data.profile : currentUser.profile,
    settings: selected.has('profile') && portable.data.settings ? portable.data.settings : currentUser.settings,
    savedBooks: selected.has('library')
      ? uniqueBy([...(portable.data.savedBooks || []), ...currentUser.savedBooks], (book) => book.id)
      : currentUser.savedBooks,
    savedAudiobooks: selected.has('library')
      ? uniqueBy([...(portable.data.savedAudiobooks || []), ...currentUser.savedAudiobooks], (audiobook) => audiobook.id)
      : currentUser.savedAudiobooks,
    recentSearches: selected.has('history')
      ? mergeTextList(portable.data.recentSearches, currentUser.recentSearches)
      : currentUser.recentSearches,
    recentlyViewed: selected.has('history')
      ? uniqueBy([...(portable.data.recentlyViewed || []), ...currentUser.recentlyViewed], (book) => book.id)
      : currentUser.recentlyViewed,
  };

  if (selected.has('profile') || selected.has('library') || selected.has('history')) {
    writeLocalUserState(nextUser);
  }

  if (selected.has('reader') && portable.data.reader) {
    writeReaderSnapshot({
      ...readReaderSnapshot(),
      ...portable.data.reader,
    });
  }

  if (selected.has('cache') && portable.data.caches) {
    if (portable.data.caches.api) {
      writeCacheSnapshot('api', {
        ...readCacheSnapshot('api'),
        ...portable.data.caches.api,
      });
    }
    if (portable.data.caches.page) {
      writeCacheSnapshot('page', {
        ...readCacheSnapshot('page'),
        ...portable.data.caches.page,
      });
    }
  }
};

export const downloadBitLibraryExport = (portable: BitLibraryExportFile) => {
  const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `bitlibrary-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
