import { useEffect, useState } from 'react';
import type { Audiobook, Book, LocalUserState, ThemeMode } from '@/types/index';

const USER_STATE_KEY = 'bitlibrary-user-state-v1';
const LEGACY_SAVED_AUDIOBOOKS_KEY = 'bitlibrary-saved-audiobooks-v1';
const LEGACY_KEYS = [
  'bitlibrary-explore-cache-v1',
  'bitlibrary-search-cache-v1',
  LEGACY_SAVED_AUDIOBOOKS_KEY,
  'recentSearches',
];
const USER_STATE_EVENT = 'bitlibrary:user-state-changed';
const MAX_RECENT_SEARCHES = 8;
const MAX_RECENTLY_VIEWED = 12;
const MAX_SAVED_BOOKS = 80;
const MAX_SAVED_AUDIOBOOKS = 40;
const MAX_COMPACT_TEXT = 420;
const MAX_COMPACT_LIST = 10;

const defaultUserState: LocalUserState = {
  profile: {
    displayName: 'Reader',
  },
  settings: {
    theme: 'dark',
  },
  savedBooks: [],
  savedAudiobooks: [],
  recentSearches: [],
  recentlyViewed: [],
};

const dedupeBooks = (books: Book[]) => {
  const seen = new Set<string>();
  return books.filter((book) => {
    if (!book?.id || seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  });
};

const dedupeAudiobooks = (audiobooks: Audiobook[]) => {
  const seen = new Set<string>();
  return audiobooks.filter((audiobook) => {
    if (!audiobook?.id || seen.has(audiobook.id)) return false;
    seen.add(audiobook.id);
    return true;
  });
};

const compactText = (value: unknown, maxLength = MAX_COMPACT_TEXT) => {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized;
};

const compactStringList = (value: unknown, maxItems = MAX_COMPACT_LIST) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => compactText(entry, 80))
    .slice(0, maxItems);
};

const compactAuthors = (authors: Book['authors'] | Audiobook['authors'] = []) => {
  return authors
    .filter((author) => author?.name)
    .slice(0, 4)
    .map((author) => ({
      name: compactText(author.name, 80),
      birth_year: author.birth_year,
      death_year: author.death_year,
    }));
};

const compactBook = (book: Book): Book => ({
  id: String(book.id),
  title: compactText(book.title, 180) || 'Untitled book',
  author: compactText(book.author, 120) || 'Unknown author',
  authors: compactAuthors(book.authors),
  category: compactText(book.category, 80) || 'General',
  description: compactText(book.description),
  coverGradient: book.coverGradient,
  coverUrl: book.coverUrl,
  year: book.year,
  pages: book.pages,
  popularity: book.popularity,
  downloads: book.downloads,
  subjects: compactStringList(book.subjects),
  keywords: compactStringList(book.keywords),
  bookshelves: compactStringList(book.bookshelves),
  externalUrl: book.externalUrl,
  downloadUrl: book.downloadUrl,
  audioUrl: book.audioUrl,
  gutenbergId: book.gutenbergId,
  grade: book.grade,
  level: book.level,
  curriculum: book.curriculum,
  language: book.language,
  country: book.country,
  detailUrl: book.detailUrl,
  sourceUrl: book.sourceUrl,
  providerSource: book.providerSource,
  source: book.source,
});

const compactAudiobook = (audiobook: Audiobook): Audiobook => ({
  id: String(audiobook.id),
  title: compactText(audiobook.title, 180) || 'Untitled audiobook',
  author: compactText(audiobook.author, 120) || 'Unknown author',
  authors: compactAuthors(audiobook.authors),
  description: compactText(audiobook.description),
  language: compactText(audiobook.language, 40) || 'Unknown',
  copyrightYear: audiobook.copyrightYear,
  coverUrl: audiobook.coverUrl,
  thumbnailUrl: audiobook.thumbnailUrl,
  totalTime: audiobook.totalTime,
  totalTimeSeconds: audiobook.totalTimeSeconds,
  numSections: audiobook.numSections || audiobook.tracks?.length || 0,
  genres: compactStringList(audiobook.genres),
  sourceTextUrl: audiobook.sourceTextUrl,
  librivoxUrl: audiobook.librivoxUrl || audiobook.archiveUrl || audiobook.rssUrl || '',
  archiveUrl: audiobook.archiveUrl,
  rssUrl: audiobook.rssUrl,
  zipUrl: audiobook.zipUrl,
  tracks: (audiobook.tracks || []).slice(0, 3).map((track) => ({
    id: String(track.id),
    sectionNumber: track.sectionNumber,
    title: compactText(track.title, 160) || 'Audio track',
    listenUrl: track.listenUrl,
    fallbackUrls: compactStringList(track.fallbackUrls, 2),
    playtimeSeconds: track.playtimeSeconds,
    readers: compactStringList(track.readers, 4),
  })),
  source: audiobook.source,
});

const compactUserState = (state: LocalUserState): LocalUserState => ({
  profile: {
    displayName: compactText(state.profile?.displayName, 80) || defaultUserState.profile.displayName,
  },
  settings: {
    theme: state.settings?.theme === 'light' ? 'light' : 'dark',
  },
  savedBooks: dedupeBooks(state.savedBooks || []).slice(0, MAX_SAVED_BOOKS).map(compactBook),
  savedAudiobooks: dedupeAudiobooks(state.savedAudiobooks || []).slice(0, MAX_SAVED_AUDIOBOOKS).map(compactAudiobook),
  recentSearches: (state.recentSearches || [])
    .map((entry) => compactText(entry, 80))
    .filter(Boolean)
    .slice(0, MAX_RECENT_SEARCHES),
  recentlyViewed: dedupeBooks(state.recentlyViewed || []).slice(0, MAX_RECENTLY_VIEWED).map(compactBook),
});

const pruneLegacyLocalData = () => {
  LEGACY_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures; the caller will handle the write result.
    }
  });
};

const emitUserStateChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USER_STATE_EVENT));
};

const readLegacySavedAudiobooks = (): Audiobook[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LEGACY_SAVED_AUDIOBOOKS_KEY);
    return raw ? dedupeAudiobooks(JSON.parse(raw) as Audiobook[]).map(compactAudiobook) : [];
  } catch {
    return [];
  }
};

export const readLocalUserState = (): LocalUserState => {
  if (typeof window === 'undefined') return defaultUserState;

  try {
    const raw = window.localStorage.getItem(USER_STATE_KEY);
    if (!raw) {
      return {
        ...defaultUserState,
        savedAudiobooks: readLegacySavedAudiobooks(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<LocalUserState>;
    const hasSavedAudiobooks = Object.prototype.hasOwnProperty.call(parsed, 'savedAudiobooks');
    const savedAudiobooks = hasSavedAudiobooks
      ? dedupeAudiobooks(parsed.savedAudiobooks || [])
      : readLegacySavedAudiobooks();
    return {
      profile: {
        displayName: parsed.profile?.displayName?.trim() || defaultUserState.profile.displayName,
      },
      settings: {
        theme: parsed.settings?.theme === 'light' ? 'light' : 'dark',
      },
      savedBooks: dedupeBooks(parsed.savedBooks || []).slice(0, MAX_SAVED_BOOKS).map(compactBook),
      savedAudiobooks: savedAudiobooks.slice(0, MAX_SAVED_AUDIOBOOKS).map(compactAudiobook),
      recentSearches: (parsed.recentSearches || []).filter(Boolean).slice(0, MAX_RECENT_SEARCHES),
      recentlyViewed: dedupeBooks(parsed.recentlyViewed || []).slice(0, MAX_RECENTLY_VIEWED).map(compactBook),
    };
  } catch {
    return {
      ...defaultUserState,
      savedAudiobooks: readLegacySavedAudiobooks(),
    };
  }
};

export const writeLocalUserState = (state: LocalUserState) => {
  if (typeof window === 'undefined') return;
  const compactState = compactUserState(state);
  const candidates: LocalUserState[] = [
    compactState,
    {
      ...compactState,
      savedBooks: compactState.savedBooks.slice(0, 40),
      savedAudiobooks: compactState.savedAudiobooks.slice(0, 25),
      recentlyViewed: compactState.recentlyViewed.slice(0, 6),
    },
    {
      ...compactState,
      savedBooks: compactState.savedBooks.slice(0, 15),
      savedAudiobooks: compactState.savedAudiobooks.slice(0, 10),
      recentlyViewed: compactState.recentlyViewed.slice(0, 3),
    },
  ];

  for (const candidate of candidates) {
    try {
      window.localStorage.setItem(USER_STATE_KEY, JSON.stringify(candidate));
      emitUserStateChange();
      return;
    } catch {
      pruneLegacyLocalData();
    }
  }

  try {
    window.localStorage.setItem(
      USER_STATE_KEY,
      JSON.stringify({
        ...defaultUserState,
        profile: compactState.profile,
        settings: compactState.settings,
        recentSearches: compactState.recentSearches,
      }),
    );
    emitUserStateChange();
  } catch (error) {
    console.warn('Unable to save BitLibrary local user state because browser storage is full.', error);
  }
};

export const updateLocalUserState = (updater: (current: LocalUserState) => LocalUserState) => {
  const nextState = compactUserState(updater(readLocalUserState()));
  writeLocalUserState(nextState);
  return nextState;
};

export const recordRecentSearch = (query: string) => {
  const normalized = query.trim();
  if (!normalized) return;

  return updateLocalUserState((current) => ({
    ...current,
    recentSearches: [normalized, ...current.recentSearches.filter((entry) => entry !== normalized)].slice(0, MAX_RECENT_SEARCHES),
  }));
};

export const toggleSavedBook = (book: Book) => {
  return updateLocalUserState((current) => {
    const alreadySaved = current.savedBooks.some((entry) => entry.id === book.id);
    return {
      ...current,
      savedBooks: alreadySaved
        ? current.savedBooks.filter((entry) => entry.id !== book.id)
        : [compactBook(book), ...current.savedBooks].slice(0, MAX_SAVED_BOOKS),
    };
  });
};

export const saveBook = (book: Book) => {
  return updateLocalUserState((current) => {
    if (current.savedBooks.some((entry) => entry.id === book.id)) {
      return current;
    }

    return {
      ...current,
      savedBooks: [compactBook(book), ...current.savedBooks].slice(0, MAX_SAVED_BOOKS),
    };
  });
};

export const toggleSavedAudiobook = (audiobook: Audiobook) => {
  return updateLocalUserState((current) => {
    const alreadySaved = current.savedAudiobooks.some((entry) => entry.id === audiobook.id);
    return {
      ...current,
      savedAudiobooks: alreadySaved
        ? current.savedAudiobooks.filter((entry) => entry.id !== audiobook.id)
        : [compactAudiobook(audiobook), ...current.savedAudiobooks.filter((entry) => entry.id !== audiobook.id)].slice(0, MAX_SAVED_AUDIOBOOKS),
    };
  });
};

export const recordRecentlyViewedBook = (book: Book) => {
  return updateLocalUserState((current) => ({
    ...current,
    recentlyViewed: [compactBook(book), ...current.recentlyViewed.filter((entry) => entry.id !== book.id)].slice(0, MAX_RECENTLY_VIEWED),
  }));
};

export const updateDisplayName = (displayName: string) => {
  return updateLocalUserState((current) => ({
    ...current,
    profile: {
      displayName: displayName.trim() || defaultUserState.profile.displayName,
    },
  }));
};

export const setThemeMode = (theme: ThemeMode) => {
  return updateLocalUserState((current) => ({
    ...current,
    settings: {
      ...current.settings,
      theme,
    },
  }));
};

export const clearLocalUserData = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(USER_STATE_KEY);
  LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
  emitUserStateChange();
};

export const useLocalUserState = () => {
  const [state, setState] = useState<LocalUserState>(() => readLocalUserState());

  useEffect(() => {
    const syncState = () => setState(readLocalUserState());
    window.addEventListener(USER_STATE_EVENT, syncState);
    window.addEventListener('storage', syncState);
    return () => {
      window.removeEventListener(USER_STATE_EVENT, syncState);
      window.removeEventListener('storage', syncState);
    };
  }, []);

  return {
    state,
    recordRecentSearch,
    toggleSavedBook,
    saveBook,
    toggleSavedAudiobook,
    recordRecentlyViewedBook,
    updateDisplayName,
    setThemeMode,
    clearLocalUserData,
  };
};
