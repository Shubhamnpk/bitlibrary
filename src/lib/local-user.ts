import { useEffect, useState } from 'react';
import type { Book, LocalUserState, ThemeMode } from '@/types/index';

const USER_STATE_KEY = 'bitlibrary-user-state-v1';
const LEGACY_KEYS = [
  'bitlibrary-explore-cache-v1',
  'bitlibrary-search-cache-v1',
  'recentSearches',
];
const USER_STATE_EVENT = 'bitlibrary:user-state-changed';
const MAX_RECENT_SEARCHES = 8;
const MAX_RECENTLY_VIEWED = 12;

const defaultUserState: LocalUserState = {
  profile: {
    displayName: 'Reader',
  },
  settings: {
    theme: 'dark',
  },
  savedBooks: [],
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

const emitUserStateChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USER_STATE_EVENT));
};

export const readLocalUserState = (): LocalUserState => {
  if (typeof window === 'undefined') return defaultUserState;

  try {
    const raw = window.localStorage.getItem(USER_STATE_KEY);
    if (!raw) return defaultUserState;

    const parsed = JSON.parse(raw) as Partial<LocalUserState>;
    return {
      profile: {
        displayName: parsed.profile?.displayName?.trim() || defaultUserState.profile.displayName,
      },
      settings: {
        theme: parsed.settings?.theme === 'light' ? 'light' : 'dark',
      },
      savedBooks: dedupeBooks(parsed.savedBooks || []),
      recentSearches: (parsed.recentSearches || []).filter(Boolean).slice(0, MAX_RECENT_SEARCHES),
      recentlyViewed: dedupeBooks(parsed.recentlyViewed || []).slice(0, MAX_RECENTLY_VIEWED),
    };
  } catch {
    return defaultUserState;
  }
};

export const writeLocalUserState = (state: LocalUserState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_STATE_KEY, JSON.stringify(state));
  emitUserStateChange();
};

export const updateLocalUserState = (updater: (current: LocalUserState) => LocalUserState) => {
  const nextState = updater(readLocalUserState());
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
        : [book, ...current.savedBooks].slice(0, 100),
    };
  });
};

export const recordRecentlyViewedBook = (book: Book) => {
  return updateLocalUserState((current) => ({
    ...current,
    recentlyViewed: [book, ...current.recentlyViewed.filter((entry) => entry.id !== book.id)].slice(0, MAX_RECENTLY_VIEWED),
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
    recordRecentlyViewedBook,
    updateDisplayName,
    setThemeMode,
    clearLocalUserData,
  };
};
