import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Book, ViewState } from '@/types/index';
import { INITIAL_BOOKS, CATEGORIES } from '@/constants';
import { fetchBooksFromGutendex, fetchBookById } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import Reader, { ReaderSkeleton } from '@/components/Reader';
import { Search, Library, Zap, Command, Menu, X, Github, Disc, ChevronRight, ArrowUpRight, Clock3, House, BookOpenText, Info } from 'lucide-react';
import BookDetails from '@/pages/BookDetails';
import { BookDetailsSkeleton, BookCardSkeleton } from '@/components/Skeletons';
import LibraryPage from '@/pages/Library';
import BrowseBooks from '@/pages/BrowseBooks';
import AboutPage from '@/pages/AboutPage';
import StaticPage from '@/pages/StaticPage';
import AuthorDetails from '@/pages/AuthorDetails';
import CategoryDetails from '@/pages/CategoryDetails';
import SearchPage, { SEARCH_MIN_QUERY_LENGTH } from '@/pages/Search';
import NotFound from '@/pages/NotFound';
import ReleasesPage from '@/pages/ReleasesPage';
import RoadmapPage from '@/pages/RoadmapPage';
import AudiobooksPage from '@/pages/AudiobooksPage';
import AudiobookDetails from '@/pages/AudiobookDetails';
import CurriculumPage from '@/pages/CurriculumPage';
import { recordRecentSearch, useLocalUserState } from '@/lib/local-user';

import { Routes, Route, useNavigate, useLocation, useSearchParams, Link, useParams, matchPath } from 'react-router-dom';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import Seo from '@/components/Seo';
import FloatingScrollButton from '@/components/FloatingScrollButton';
import MobileBottomNav from '@/components/MobileBottomNav';
import MobileProfileModal from '@/components/MobileProfileModal';

const SEARCH_DEBOUNCE_MS = 400;
const EXPLORE_CACHE_KEY = 'bitlibrary-explore-cache-v1';
const EXPLORE_CACHE_TTL = 30 * 60 * 1000;
const SEARCH_SUGGESTIONS = ['Philosophy', 'Artificial Intelligence', 'Poetry', 'History', 'Quantum', 'Psychology'];
const ROUTE_PATTERNS = ['/','/library','/library/:categoryId','/books','/books/:categoryId','/browse','/browse/:categoryId','/curriculum','/mylibrary','/search','/book/:id','/audiobooks','/audiobooks/category/:categoryId','/audiobook/:id','/author/:name','/category/:categoryId','/terms','/about','/releases','/roadmap',];
const HERO_ORBIT_NODES = {
  star: {
    title: 'Archive Star',
    role: 'Core catalog',
    description: 'The central gravity for open books, authors, and discovery paths.',
    signal: 'Stable index',
  },
  discovery: {
    title: 'Discovery Planet',
    role: 'Search stream',
    description: 'Surfaces subjects, authors, and fresh paths through the archive.',
    signal: 'Live orbit',
  },
  archive: {
    title: 'Archive Moon',
    role: 'Saved knowledge',
    description: 'Keeps borrowed, saved, and recently viewed books close to you.',
    signal: 'Synced',
  },
  reader: {
    title: 'Reader Node',
    role: 'Reading flow',
    description: 'Opens a focused path from search result to book detail to reader.',
    signal: 'Ready',
  },
};
type HeroOrbitNodeKey = keyof typeof HERO_ORBIT_NODES;

interface ExploreCachePayload {
  featuredBooks: Book[];
  borrowedBooks: Book[];
  timestamp: number;
}

const readExploreCache = (): ExploreCachePayload | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(EXPLORE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ExploreCachePayload;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > EXPLORE_CACHE_TTL) {
      window.localStorage.removeItem(EXPLORE_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writeExploreCache = (payload: Omit<ExploreCachePayload, 'timestamp'>) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      EXPLORE_CACHE_KEY,
      JSON.stringify({
        ...payload,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore storage failures and continue with network-backed state.
  }
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [featuredBooks, setFeaturedBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { state: localUserState } = useLocalUserState();

  // Persistent Global Reader State
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchShellRef = React.useRef<HTMLDivElement>(null);
  const syncSearchQueryFromRoute = useCallback((value: string) => {
    setSearchQuery((current) => {
      const isActivelyTyping = isSearchFocused && document.activeElement === searchInputRef.current;
      if (isActivelyTyping && current.trim() !== value.trim()) {
        return current;
      }

      return value;
    });
  }, [isSearchFocused]);

  const navigateToSearch = useCallback((rawQuery: string, options?: { persistRecent?: boolean }) => {
    const trimmed = rawQuery.trim();

    if (!trimmed || trimmed.length < SEARCH_MIN_QUERY_LENGTH) {
      if (location.pathname === '/search') {
        setSearchParams({});
      }
      return;
    }

    const nextSearch = `?q=${encodeURIComponent(trimmed)}`;
    if (options?.persistRecent) {
      recordRecentSearch(trimmed);
    }
    if (location.pathname === '/search') {
      setSearchParams({ q: trimmed });
      return;
    }

    navigate(`/search${nextSearch}`);
  }, [location.pathname, navigate, setSearchParams]);

  const closeSearchSurface = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(localUserState.settings.theme === 'light' ? 'theme-light' : 'theme-dark');
  }, [localUserState.settings.theme]);

  // Sync Global Reader with URL - DECOMMISSIONED (Moved to state-driven only)
  useEffect(() => {
    // We no longer sync from URL. 
    // The reader is triggered via onRead state in the overlay system.
  }, []);

  // Sync Data on Load
  useEffect(() => {
    const cached = readExploreCache();
    if (cached) {
      setFeaturedBooks(cached.featuredBooks);
      setBorrowedBooks(cached.borrowedBooks);
    }

    const syncData = async () => {
      if (!cached) {
        setIsFeaturedLoading(true);
      }
      try {
        const { books: apiBooks } = await fetchBooksFromGutendex(1);
        if (apiBooks.length > 0) {
          const nextFeaturedBooks = apiBooks.slice(0, 8);
          const nextBorrowedBooks = apiBooks.slice(0, 2);

          setFeaturedBooks(nextFeaturedBooks);
          setBorrowedBooks(nextBorrowedBooks);
          writeExploreCache({
            featuredBooks: nextFeaturedBooks,
            borrowedBooks: nextBorrowedBooks,
          });
        }
      } finally {
        setIsFeaturedLoading(false);
      }
    };

    void syncData();
  }, []);

  useEffect(() => {
    syncSearchQueryFromRoute(searchParams.get('q') || '');
  }, [searchParams, syncSearchQueryFromRoute]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchShellRef.current?.contains(event.target as Node)) {
        closeSearchSurface();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [closeSearchSurface]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    navigateToSearch(searchQuery, { persistRecent: true });
    closeSearchSurface();
  };

  // Auto-search after the user has typed enough signal to avoid noisy one-letter searches.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const isDeepSector = location.pathname.startsWith('/book/') ||
      location.pathname.startsWith('/reader/') ||
      location.pathname.startsWith('/author/');

    const isSearchableSector = location.pathname === '/' || location.pathname === '/search';
    if (trimmed.length < SEARCH_MIN_QUERY_LENGTH) {
      if (location.pathname === '/search' && searchParams.get('q')) {
        const timer = setTimeout(() => setSearchParams({}), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (trimmed.length >= SEARCH_MIN_QUERY_LENGTH && !isDeepSector && isSearchableSector) {
      const timer = setTimeout(() => {
        if (searchParams.get('q') !== trimmed) {
          navigateToSearch(trimmed);
        }
      }, SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchParams, location.pathname, navigateToSearch, setSearchParams]);

  const isReaderActive = Boolean(activeBook && !isMinimized);
  const activeTab = (path: string) => location.pathname === path;
  const isNotFoundRoute = useMemo(
    () => !ROUTE_PATTERNS.some((path) => matchPath({ path, end: true }, location.pathname)),
    [location.pathname]
  );
  const isLibraryRoute = /^\/(?:library|books|browse|mylibrary)(?:\/|$)/.test(location.pathname);
  const hideFloatingScrollControls = Boolean(isReaderActive || readerLoading || mobileMenuOpen || mobileProfileOpen);
  const hideMobileBottomNav = Boolean(isReaderActive || readerLoading || mobileMenuOpen || mobileProfileOpen || isNotFoundRoute);

  const handleReadBook = useCallback((book: Book) => {
    setActiveBook(book);
    setIsMinimized(false);
  }, []);

  // Global Search Keyboard Shortcut (/)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }

      if (e.key === 'Escape') {
        closeSearchSurface();
        setMobileMenuOpen(false);
        setMobileProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [closeSearchSurface]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow || '';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const trimmedSearchQuery = searchQuery.trim();
  const searchDropdownRecent = localUserState.recentSearches.slice(0, 4);
  const searchDropdownSuggestions = SEARCH_SUGGESTIONS.filter((item) => item.toLowerCase() !== trimmedSearchQuery.toLowerCase()).slice(0, 4);
  const showSearchSurface = isSearchFocused && !isReaderActive;
  const mobileQuickTopics = Array.from(new Set([...searchDropdownRecent, ...SEARCH_SUGGESTIONS])).slice(0, 8);

  const applySearchSelection = (query: string) => {
    setSearchQuery(query);
    navigateToSearch(query, { persistRecent: true });
    closeSearchSurface();
  };
  const currentRoutePath = useCallback(() => `${location.pathname}${location.search}${location.hash}`, [location.hash, location.pathname, location.search]);
  const navigateToBook = useCallback((bookOrId: Book | string, extraState?: Record<string, unknown>) => {
    const id = typeof bookOrId === 'string' ? bookOrId : bookOrId.id;
    const currentState = location.state as { from?: string } | null;
    const from = location.pathname.startsWith('/book/')
      ? currentState?.from || '/library'
      : currentRoutePath();

    navigate(`/book/${id}`, {
      state: {
        from,
        ...extraState,
      },
    });
  }, [currentRoutePath, location.pathname, location.state, navigate]);

  const handleMobileMenuSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateToSearch(searchQuery, { persistRecent: true });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-bit-bg text-bit-text font-sans selection:bg-bit-accent selection:text-white transition-colors duration-500">
      <ScrollToTop />
      <Seo />
      {/* Background Grid & Effects */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-[0.12] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-bit-bg/50 to-bit-bg pointer-events-none" />

      {/* Navigation & Mobile Menu */}
      <Navbar 
        isReaderActive={isReaderActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearchSubmit={handleSearchSubmit}
        isSearching={isSearching}
        showSearchSurface={showSearchSurface}
        trimmedSearchQuery={trimmedSearchQuery}
        SEARCH_MIN_QUERY_LENGTH={SEARCH_MIN_QUERY_LENGTH}
        searchDropdownRecent={searchDropdownRecent}
        searchDropdownSuggestions={searchDropdownSuggestions}
        applySearchSelection={applySearchSelection}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        localUserState={localUserState}
        handleMobileMenuSearchSubmit={handleMobileMenuSearchSubmit}
        activeTab={activeTab}
        searchInputRef={searchInputRef}
        searchShellRef={searchShellRef}
        setIsSearchFocused={setIsSearchFocused}
        mobileQuickTopics={mobileQuickTopics}
        navigateToSearch={navigateToSearch}
      />


      {/* Main Layout */}
      <main className={`${isNotFoundRoute ? 'min-h-[100svh] pb-0' : 'min-h-screen pb-28 md:pb-20'} relative z-0 ${isReaderActive ? '' : 'pt-16 md:pt-20'}`}>

        <Routes>
          {/* Home / Discovery */}
          <Route path="/" element={
            <div className="animate-fade-in-up">
              {/* Hero */}
              <section className="relative mb-12 overflow-hidden py-10 md:mb-16 md:py-16 lg:py-20">
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                  <div className="absolute inset-y-0 right-0 w-full md:w-[68%] bg-[radial-gradient(ellipse_at_72%_42%,rgba(var(--bit-accent-rgb),0.12),transparent_42%),linear-gradient(110deg,transparent_0%,rgba(var(--bit-accent-rgb),0.03)_48%,rgba(var(--bit-text),0.018)_100%)]" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bit-border to-transparent" />

                  <div className="absolute right-[-10rem] top-[-7rem] h-72 w-72 rotate-[-10deg] opacity-40 md:hidden">
                    <div className="absolute inset-x-0 top-1/2 h-32 -translate-y-1/2 rounded-[50%] border border-bit-accent/20" />
                    <div className="absolute inset-x-10 top-1/2 h-20 -translate-y-1/2 rounded-[50%] border border-bit-border/60" />
                    <div className="absolute right-12 top-16 h-3.5 w-3.5 rounded-full bg-bit-accent" />
                  </div>

                  <div className="absolute right-[-18rem] top-[-9rem] hidden h-[60rem] w-[60rem] opacity-100 md:block">
                    <button
                      type="button"
                      aria-label="Archive star"
                      className="group pointer-events-auto absolute left-1/2 top-1/2 z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bit-accent/35 bg-[radial-gradient(circle_at_35%_30%,rgba(var(--bit-accent-rgb),0.24),rgba(var(--bit-panel),0.06)_58%,transparent_70%)] shadow-[0_0_110px_rgba(var(--bit-accent-rgb),0.15)] transition-all duration-300 hover:border-bit-accent/70 hover:shadow-[0_0_150px_rgba(var(--bit-accent-rgb),0.22)] focus:outline-none focus:ring-2 focus:ring-bit-accent/40"
                    >
                      <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+0.9rem)] w-72 -translate-x-1/2 translate-y-2 rounded-2xl border border-bit-border/70 bg-bit-bg/85 p-4 text-left opacity-0 shadow-2xl shadow-bit-bg/50 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        <span className="flex items-center justify-between gap-4">
                          <span className="text-[9px] font-mono uppercase tracking-[0.24em] text-bit-accent">{HERO_ORBIT_NODES.star.role}</span>
                          <span className="rounded-full border border-bit-accent/20 bg-bit-accent/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-bit-accent">{HERO_ORBIT_NODES.star.signal}</span>
                        </span>
                        <span className="mt-3 block font-display text-xl font-bold leading-tight text-bit-text">{HERO_ORBIT_NODES.star.title}</span>
                        <span className="mt-2 block text-sm leading-6 text-bit-muted">{HERO_ORBIT_NODES.star.description}</span>
                      </span>
                    </button>
                    <div className="absolute left-1/2 top-1/2 z-20 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bit-border bg-bit-bg/70" />

                    <div className="absolute inset-0 rotate-[-12deg]">
                      <div className="absolute inset-x-[18%] top-[32%] h-[36%] rounded-[50%] border border-bit-border/70" />
                      <div className="absolute inset-x-[6%] top-[24%] h-[52%] rounded-[50%] border border-bit-accent/20" />
                      <div className="absolute inset-x-0 top-[16%] h-[68%] rounded-[50%] border border-bit-border/40" />

                      <button
                        type="button"
                        aria-label="Discovery planet"
                        className="group hero-planet hero-planet-discovery pointer-events-auto h-4 w-4 rounded-full bg-bit-accent shadow-[0_0_18px_rgba(var(--bit-accent-rgb),0.5)] transition-[height,width,box-shadow] hover:h-6 hover:w-6 hover:shadow-[0_0_34px_rgba(var(--bit-accent-rgb),0.8)] focus:outline-none focus:ring-2 focus:ring-bit-accent/50"
                      >
                        <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+0.75rem)] w-64 -translate-x-1/2 translate-y-2 rounded-2xl border border-bit-border/70 bg-bit-bg/85 p-4 text-left opacity-0 shadow-2xl shadow-bit-bg/50 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                          <span className="text-[9px] font-mono uppercase tracking-[0.24em] text-bit-accent">{HERO_ORBIT_NODES.discovery.role}</span>
                          <span className="mt-2 block font-display text-lg font-bold leading-tight text-bit-text">{HERO_ORBIT_NODES.discovery.title}</span>
                          <span className="mt-2 block text-xs leading-5 text-bit-muted">{HERO_ORBIT_NODES.discovery.description}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Archive moon"
                        className="group hero-planet hero-planet-archive pointer-events-auto h-5 w-5 rounded-full border border-bit-accent/35 bg-bit-panel shadow-[0_0_24px_rgba(var(--bit-accent-rgb),0.2)] transition-[height,width,border-color,box-shadow] hover:h-7 hover:w-7 hover:border-bit-accent/70 hover:shadow-[0_0_36px_rgba(var(--bit-accent-rgb),0.45)] focus:outline-none focus:ring-2 focus:ring-bit-accent/50"
                      >
                        <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+0.75rem)] w-64 -translate-x-1/2 translate-y-2 rounded-2xl border border-bit-border/70 bg-bit-bg/85 p-4 text-left opacity-0 shadow-2xl shadow-bit-bg/50 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                          <span className="text-[9px] font-mono uppercase tracking-[0.24em] text-bit-accent">{HERO_ORBIT_NODES.archive.role}</span>
                          <span className="mt-2 block font-display text-lg font-bold leading-tight text-bit-text">{HERO_ORBIT_NODES.archive.title}</span>
                          <span className="mt-2 block text-xs leading-5 text-bit-muted">{HERO_ORBIT_NODES.archive.description}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Reader node"
                        className="group hero-planet hero-planet-reader pointer-events-auto h-4 w-4 rounded-full bg-bit-text/45 transition-[height,width,background-color] hover:h-6 hover:w-6 hover:bg-bit-text/80 focus:outline-none focus:ring-2 focus:ring-bit-accent/40"
                      >
                        <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+0.75rem)] w-64 -translate-x-1/2 translate-y-2 rounded-2xl border border-bit-border/70 bg-bit-bg/85 p-4 text-left opacity-0 shadow-2xl shadow-bit-bg/50 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                          <span className="text-[9px] font-mono uppercase tracking-[0.24em] text-bit-accent">{HERO_ORBIT_NODES.reader.role}</span>
                          <span className="mt-2 block font-display text-lg font-bold leading-tight text-bit-text">{HERO_ORBIT_NODES.reader.title}</span>
                          <span className="mt-2 block text-xs leading-5 text-bit-muted">{HERO_ORBIT_NODES.reader.description}</span>
                        </span>
                      </button>
                    </div>

                    <div className="absolute left-1/2 top-1/2 h-px w-[86%] -translate-x-1/2 rotate-[-12deg] bg-gradient-to-r from-transparent via-bit-accent/25 to-transparent" />
                    <div className="absolute left-1/2 top-[54%] h-px w-[96%] -translate-x-1/2 rotate-[-12deg] bg-gradient-to-r from-transparent via-bit-border to-transparent" />
                  </div>

                  <div className="absolute right-12 top-16 grid grid-cols-3 gap-3 opacity-70 md:right-44 md:top-20">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className={`h-1.5 w-1.5 ${index % 4 === 0 ? 'bg-bit-accent' : 'bg-bit-border'}`} />
                    ))}
                  </div>
                </div>

                <div className="pointer-events-none max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                  <span className="inline-block py-1 px-3 rounded-full border border-bit-accent/20 bg-bit-accent/5 text-[10px] text-bit-accent font-mono mb-6 uppercase tracking-[0.2em]">
                    BitLibrary Platform
                  </span>
                  <h1 className="text-4xl sm:text-6xl md:text-8xl font-display font-bold text-bit-text mb-6 md:mb-8 leading-[0.95] tracking-tighter">
                    Open books,
                    <br />
                    <span className="bg-gradient-to-r from-bit-text via-bit-text to-bit-accent bg-clip-text text-transparent drop-shadow-sm">
                      open discovery.
                    </span>
                  </h1>
                  <div className="text-base md:text-lg text-bit-muted max-w-2xl mb-10 md:mb-12 leading-relaxed font-sans">
                    The Open Digital Library for modern readers, students, and explorers of knowledge.
                    <p className="text-xs sm:text-sm text-bit-muted/60 max-w-2xl mt-4 leading-relaxed font-mono uppercase tracking-[0.14em] sm:tracking-[0.18em]">
                      Search across open archives, discover authors, and explore books with a faster digital reading interface.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.slice(0, 6).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSearchQuery(cat); navigateToSearch(cat, { persistRecent: true }); }}
                        className="pointer-events-auto px-4 py-2 rounded-lg bg-bit-panel/30 border border-bit-border hover:border-bit-accent/40 hover:bg-bit-panel/50 text-[10px] text-bit-muted hover:text-bit-text transition-all font-mono uppercase tracking-widest"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Featured Swiper / Grid */}
              <section className="mb-24 md:mb-32 max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-bit-text">Registry Spotlight</h2>
                    <p className="text-xs text-bit-muted font-mono mt-1 uppercase tracking-widest">Active nodes in the current stream</p>
                  </div>
                  <Link to="/library" className="group flex items-center gap-2 text-[10px] text-bit-accent hover:text-bit-text font-mono uppercase tracking-[0.2em] transition-colors">
                    View Full Registry <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

                <div className="bit-card-grid">
                  {isFeaturedLoading && featuredBooks.length === 0 ? (
                    // Logic for "One Row" using CSS grid visibility
                    // We render 4 to ensure a full row on all screens
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`skeleton-${i}`} className={i === 2 ? 'hidden md:block' : i === 3 ? 'hidden lg:block' : ''}>
                        <BookCardSkeleton />
                      </div>
                    ))
                  ) : (
                    featuredBooks.map(book => (
                      <BookCard key={book.id} variant="compact" book={book} onClick={navigateToBook} onRead={handleReadBook} />
                    ))
                  )}
                </div>
              </section>

              {/* Collections Bento */}
              <section className="max-w-7xl mx-auto px-4 sm:px-6">
                <h2 className="text-xl md:text-2xl font-display font-bold text-bit-text mb-8 md:mb-10">Neural Clusters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[500px]">
                  <div onClick={() => navigateToSearch('Quantum', { persistRecent: true })} className="col-span-1 md:col-span-2 rounded-3xl border border-bit-border bg-bit-panel/30 p-6 md:p-10 relative overflow-hidden group cursor-pointer hover:border-bit-accent/30 transition-all shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-bit-accent/5 to-transparent" />
                    <h3 className="text-3xl md:text-4xl font-display font-bold text-bit-text relative z-10">Quantum Era</h3>
                    <p className="text-bit-muted mt-4 max-w-xs relative z-10 leading-relaxed text-sm">Synthetic analysis of particle logic and future computation streams.</p>
                    <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 text-bit-accent/10 group-hover:scale-125 group-hover:text-bit-accent/30 transition-all duration-700">
                      <Zap size={56} className="md:w-20 md:h-20" />
                    </div>
                  </div>
                  <div onClick={() => navigateToSearch('Philosophy', { persistRecent: true })} className="rounded-3xl border border-bit-border bg-bit-panel/30 p-6 md:p-8 relative group overflow-hidden cursor-pointer hover:border-bit-accent/30 transition-all shadow-sm">
                    <div className="absolute -top-8 -right-8 md:-top-10 md:-right-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <Library size={88} className="md:w-[120px] md:h-[120px]" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-display font-bold text-bit-text uppercase tracking-tight">Ancient <br />Nodes</h3>
                    <p className="text-xs text-bit-accent font-mono mt-2">128 COLLECTIONS</p>
                  </div>
                </div>
              </section>
            </div>
          } />

          {/* Discovery / Library Registry */}
          <Route path="/library/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={navigateToBook} onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)} onRead={handleReadBook} /></div>} />
          <Route path="/books/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={navigateToBook} onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)} onRead={handleReadBook} /></div>} />
          <Route path="/browse/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={navigateToBook} onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)} onRead={handleReadBook} /></div>} />

          <Route path="/curriculum" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <CurriculumPage
                onBookClick={navigateToBook}
                onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)}
                onRead={handleReadBook}
              />
            </div>
          } />

          {/* Personal Bookshelf */}
          <Route path="/mylibrary" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <LibraryPage
                borrowedBooks={borrowedBooks}
                savedBooks={localUserState.savedBooks}
                savedAudiobooks={localUserState.savedAudiobooks}
                recentSearches={localUserState.recentSearches}
                recentlyViewed={localUserState.recentlyViewed}
                profile={localUserState.profile}
                settings={localUserState.settings}
                onBookClick={navigateToBook}
                onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)}
                onRead={handleReadBook}
                onExplore={() => navigate('/')}
              />
            </div>
          } />

          <Route path="/search" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <SearchPage
                onBookClick={navigateToBook}
                onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)}
                onRead={handleReadBook}
                onAuthorClick={(name) => navigate(`/author/${encodeURIComponent(name)}`)}
                onResultsChange={setSearchResults}
                onSearchingChange={setIsSearching}
                onQuerySync={syncSearchQueryFromRoute}
                recentSearches={localUserState.recentSearches}
                onQuickSearch={applySearchSelection}
              />
            </div>
          } />

          <Route path="/audiobooks" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <AudiobooksPage onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)} />
            </div>
          } />

          <Route path="/audiobooks/category/:categoryId" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <AudiobooksPage onAudiobookClick={(audiobook) => navigate(`/audiobook/${audiobook.id}`)} />
            </div>
          } />

          {/* Deep Routes (Wrappers for details/reader) */}
          <Route path="/audiobook/:id" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <AudiobookDetails />
            </div>
          } />

          <Route path="/book/:id" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <BookDetailsRoute
                books={[...featuredBooks, ...searchResults]}
                onRead={(id) => {
                  const b = [...featuredBooks, ...searchResults].find(node => node.id === id);
                  if (b) {
                    setActiveBook(b);
                    setIsMinimized(false);
                  } else {
                    setReaderLoading(true);
                    fetchBookById(id).then(res => {
                      if (res) {
                        setActiveBook(res);
                        setIsMinimized(false);
                      }
                      setReaderLoading(false);
                    });
                  }
                }}
                onBookClick={(id) => navigateToBook(id)}
                onAuthorClick={(name) => navigate(`/author/${encodeURIComponent(name)}`)}
                onCategoryClick={(cat) => navigate(`/category/${encodeURIComponent(cat)}`)}
              />
            </div>
          } />

          <Route path="/author/:name" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <AuthorDetails onBookClick={navigateToBook} />
            </div>
          } />

          <Route path="/category/:categoryId" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <CategoryDetails onBookClick={navigateToBook} />
            </div>
          } />

          {/* Static Pages */}
          <Route path="/terms" element={<StaticPage type="terms" onBack={() => navigate('/')} />} />
          <Route path="/about" element={<AboutPage onBack={() => navigate('/')} />} />
          <Route path="/releases" element={<ReleasesPage onBack={() => navigate('/')} />} />
          <Route path="/roadmap" element={<RoadmapPage onBack={() => navigate('/')} />} />
          <Route path="*" element={<NotFound />} />

        </Routes>

      </main>

      {/* Global Footer */}
      <Footer isReaderActive={Boolean(isReaderActive || isNotFoundRoute)} />

      <FloatingScrollButton
        hidden={hideFloatingScrollControls}
        hideScrollDown={isLibraryRoute}
      />
      <MobileBottomNav hidden={hideMobileBottomNav} onProfileClick={() => setMobileProfileOpen(true)} />
      <MobileProfileModal
        open={mobileProfileOpen}
        onClose={() => setMobileProfileOpen(false)}
        localUserState={localUserState}
      />

      {/* Global PiP Overlay */}
      {readerLoading && !activeBook && <ReaderSkeleton />}
      {activeBook && (
        <Reader
          book={activeBook}
          isMinimized={isMinimized}
          onClose={() => setActiveBook(null)}
          onToggleMinimize={(min) => setIsMinimized(min)}
        />
      )}
    </div>
  );
};

// Route Wrappers to handle fetching by ID
const BookDetailsRoute: React.FC<{ books: Book[], onRead: (id: string) => void, onBookClick: (id: string) => void, onAuthorClick: (name: string) => void, onCategoryClick: (cat: string) => void }> = ({ books, onRead, onBookClick, onAuthorClick, onCategoryClick }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [book, setBook] = useState<Book | null>(() => books.find(b => b.id === id) || null);
  const [loading, setLoading] = useState(!book);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      // Background sync - even if we have local cache
      const data = await fetchBookById(id);
      if (data) {
        setBook(data);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading && !book) return <div className="animate-fade-in"><BookDetailsSkeleton /></div>;
  if (!book) return <div className="py-20 text-center font-mono text-red-500 uppercase">Archive Node {id} not found in current sector registry.</div>;

  const routeState = location.state as { from?: string; path?: Book[] } | null;
  const returnTo = routeState?.from || '/library';
  const breadcrumbPath = routeState?.path || [];

  return (
    <BookDetails
      book={book}
      allBooks={books}
      onClose={() => navigate(returnTo)}
      onRead={(rid) => onRead(rid || book.id)}
      onBookClick={(b) => navigate(`/book/${b.id}`, { state: { from: returnTo, path: [...breadcrumbPath, book] } })}
      onAuthorClick={onAuthorClick}
      onCategoryClick={onCategoryClick}
      onBreadcrumbClick={(b, index) => {
        navigate(`/book/${b.id}`, { state: { from: returnTo, path: breadcrumbPath.slice(0, index) } });
      }}
      breadcrumbPath={breadcrumbPath}
    />
  );
};

const ReaderRoute: React.FC<{ books: Book[] }> = ({ books }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  return <div className="hidden">Triggering Neural Sector {id}...</div>;
};

export default App;
