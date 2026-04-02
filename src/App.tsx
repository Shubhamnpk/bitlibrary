import React, { useState, useEffect, useCallback } from 'react';
import { Book, ViewState } from '@/types/index';
import { INITIAL_BOOKS, CATEGORIES } from '@/constants';
import { fetchBooksFromGutendex, fetchBookById } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import Reader, { ReaderSkeleton } from '@/components/Reader';
import { Search, Library, Zap, Command, Menu, X, Github, Disc, ChevronRight, ArrowUpRight, Clock3, House, BookOpenText, Info } from 'lucide-react';
import BookDetails from '@/pages/BookDetails';
import { BookDetailsSkeleton } from '@/components/Skeletons';
import LibraryPage from '@/pages/Library';
import BrowseBooks from '@/pages/BrowseBooks';
import AboutPage from '@/pages/AboutPage';
import StaticPage from '@/pages/StaticPage';
import AuthorDetails from '@/pages/AuthorDetails';
import CategoryDetails from '@/pages/CategoryDetails';
import SearchPage, { SEARCH_MIN_QUERY_LENGTH } from '@/pages/Search';
import { recordRecentSearch, useLocalUserState } from '@/lib/local-user';
import { ThemeToggle } from '@/components/ThemeToggle';

import { Routes, Route, useNavigate, useLocation, useSearchParams, Link, useParams } from 'react-router-dom';

const SEARCH_DEBOUNCE_MS = 350;
const EXPLORE_CACHE_KEY = 'bitlibrary-explore-cache-v1';
const EXPLORE_CACHE_TTL = 30 * 60 * 1000;
const SEARCH_SUGGESTIONS = ['Philosophy', 'Artificial Intelligence', 'Poetry', 'History', 'Quantum', 'Psychology'];

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { state: localUserState } = useLocalUserState();

  // Persistent Global Reader State
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchShellRef = React.useRef<HTMLDivElement>(null);
  const navigateToSearch = useCallback((rawQuery: string, options?: { persistRecent?: boolean }) => {
    const trimmed = rawQuery.trim();

    if (!trimmed) {
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
    };

    void syncData();
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

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

  // Auto-Search Neural Synchronization (Debounced after 3 characters)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const isDeepSector = location.pathname.startsWith('/book/') ||
      location.pathname.startsWith('/reader/') ||
      location.pathname.startsWith('/author/');

    const isSearchableSector = location.pathname === '/' || location.pathname === '/search';
    if (trimmed.length >= SEARCH_MIN_QUERY_LENGTH && !isDeepSector && isSearchableSector) {
      const timer = setTimeout(() => {
        if (searchParams.get('q') !== trimmed) {
          navigateToSearch(trimmed);
        }
      }, SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchParams, location.pathname, navigateToSearch]);

  const isReaderActive = activeBook && !isMinimized;
  const activeTab = (path: string) => location.pathname === path;

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
  const handleMobileMenuSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateToSearch(searchQuery, { persistRecent: true });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-bit-bg text-bit-text font-sans selection:bg-bit-accent selection:text-white transition-colors duration-500">
      <ScrollToTop />
      {/* Background Grid & Effects */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-bit-bg/50 to-bit-bg pointer-events-none" />

      {/* Navigation - Hidden in Full Reader mode */}
      {!isReaderActive && (
        <nav className="fixed top-0 left-0 right-0 z-40 border-b border-bit-border/50 bg-bit-bg/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

            <Link to="/" className="flex items-center gap-3 group min-w-0">
              <img
                src="/assets/bitlibrary-icon-clean.svg"
                alt="BitLibrary"
                className="w-9 h-9 shrink-0 transition-transform group-hover:scale-105"
              />
              <div className="min-w-0">
                <p className="font-display font-bold text-xl tracking-tight text-bit-text leading-none">BitLibrary</p>
                <p className="hidden lg:block text-[9px] font-mono uppercase tracking-[0.22em] text-bit-accent/80 mt-1">
                  The Open Digital Library
                </p>
              </div>
            </Link>

            {/* Desktop Search */}
            <div ref={searchShellRef} className="hidden md:block flex-1 max-w-lg mx-8 relative">
              <form onSubmit={handleSearchSubmit} className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bit-muted group-focus-within:text-bit-accent transition-colors" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search books, authors... (Press /)"
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bit-panel/30 border border-bit-border rounded-full py-2 pl-10 pr-24 text-sm focus:outline-none focus:border-bit-accent/50 focus:bg-bit-panel/50 transition-all placeholder:text-bit-muted/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {trimmedSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted hover:text-bit-text transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  {isSearching ? (
                    <div className="animate-spin text-bit-accent">
                      <Disc size={16} />
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-full bg-bit-accent text-white text-[10px] font-mono uppercase tracking-[0.2em] hover:scale-[0.98] transition-all shadow-sm"
                    >
                      Search
                    </button>
                  )}
                </div>
              </form>

              {showSearchSurface && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] rounded-3xl border border-bit-border bg-bit-panel/95 backdrop-blur-2xl shadow-2xl shadow-bit-bg/40 overflow-hidden">
                  <div className="px-5 py-4 border-b border-bit-border/40 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Search Control</p>
                      <p className="text-sm text-bit-muted mt-1">
                        {trimmedSearchQuery.length >= SEARCH_MIN_QUERY_LENGTH
                          ? `Press Enter to open results for "${trimmedSearchQuery}".`
                          : `Type at least ${SEARCH_MIN_QUERY_LENGTH} characters to start searching.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                      <Command size={12} />
                      /
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-0">
                    <div className="p-5 border-r border-bit-border/40">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted mb-4">
                        <Clock3 size={12} />
                        Recent Searches
                      </div>
                      <div className="space-y-2">
                        {searchDropdownRecent.length > 0 ? searchDropdownRecent.map((query) => (
                          <button
                            key={query}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySearchSelection(query)}
                            className="w-full flex items-center justify-between rounded-2xl border border-bit-border bg-bit-panel/30 px-4 py-3 text-left hover:border-bit-accent/30 hover:bg-bit-panel/50 transition-all group"
                          >
                            <span className="text-sm text-bit-text">{query}</span>
                            <ArrowUpRight size={14} className="text-bit-muted group-hover:text-bit-accent transition-colors" />
                          </button>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-bit-border px-4 py-6 text-sm text-bit-muted">
                            Your recent searches will show up here.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted mb-4">
                        <Zap size={12} />
                        Explore Topics
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {searchDropdownSuggestions.map((query) => (
                          <button
                            key={query}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySearchSelection(query)}
                            className="px-3 py-2 rounded-full border border-bit-border bg-bit-panel/30 text-[11px] text-bit-muted hover:text-bit-text hover:border-bit-accent/40 hover:bg-bit-accent/10 transition-all"
                          >
                            {query}
                          </button>
                        ))}
                      </div>
                      <div className="mt-5 rounded-2xl border border-bit-accent/20 bg-bit-accent/5 p-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent mb-2">Search Tips</p>
                        <p className="text-sm text-bit-muted leading-relaxed">
                          Try author names, subjects, or themes for richer results from every archive source.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden md:flex items-center gap-6 font-mono text-xs tracking-wider">
              <Link to="/" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Discover</Link>
              <Link to="/library" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/library') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Library</Link>
              <Link to="/mylibrary" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/mylibrary') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>My Library</Link>
              <ThemeToggle />
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-bit-panel to-bit-border border border-bit-border flex items-center justify-center cursor-pointer hover:border-bit-accent/50 transition-all">
                <span className="text-[10px] font-bold text-bit-text">US</span>
              </div>
            </div>

            <button className="md:hidden text-bit-text" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
      )}

      {/* Main Layout */}
      <main className={`pb-20 px-6 max-w-7xl mx-auto min-h-screen flex flex-col relative z-0 ${isReaderActive ? '' : 'pt-24'}`}>

        <Routes>
          {/* Home / Discovery */}
          <Route path="/" element={
            <div className="animate-fade-in-up">
              {/* Hero */}
              <section className="mb-24 relative">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-bit-accent/10 rounded-full blur-[120px] pointer-events-none opacity-50" />
                <div className="relative z-10">
                  <span className="inline-block py-1 px-3 rounded-full border border-bit-accent/20 bg-bit-accent/5 text-[10px] text-bit-accent font-mono mb-6 uppercase tracking-[0.2em]">
                    BitLibrary Platform
                  </span>
                  <h1 className="text-6xl md:text-8xl font-display font-bold text-bit-text mb-8 leading-none tracking-tighter">
                    Open books,
                    <br />
                    <span className="text-bit-text/40 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-gray-300 dark:to-gray-700">open discovery.</span>
                  </h1>
                  <div className="text-lg text-bit-muted max-w-2xl mb-12 leading-relaxed font-sans">
                    The Open Digital Library for modern readers, students, and explorers of knowledge.
                    <p className="text-sm text-bit-muted/60 max-w-2xl mt-4 leading-relaxed font-mono uppercase tracking-[0.18em]">
                      Search across open archives, discover authors, and explore books with a faster digital reading interface.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.slice(0, 6).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSearchQuery(cat); navigateToSearch(cat, { persistRecent: true }); }}
                        className="px-4 py-2 rounded-lg bg-bit-panel/30 border border-bit-border hover:border-bit-accent/40 hover:bg-bit-panel/50 text-[10px] text-bit-muted hover:text-bit-text transition-all font-mono uppercase tracking-widest"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Featured Swiper / Grid */}
              <section className="mb-32">
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-bit-text">Registry Spotlight</h2>
                    <p className="text-xs text-bit-muted font-mono mt-1 uppercase tracking-widest">Active nodes in the current stream</p>
                  </div>
                  <Link to="/library" className="group flex items-center gap-2 text-[10px] text-bit-accent hover:text-bit-text font-mono uppercase tracking-[0.2em] transition-colors">
                    View Full Registry <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
                  {featuredBooks.map(book => (
                    <BookCard key={book.id} book={book} onClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} />
                  ))}
                </div>
              </section>

              {/* Collections Bento */}
              <section>
                <h2 className="text-2xl font-display font-bold text-bit-text mb-10">Neural Clusters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[500px]">
                  <div onClick={() => navigateToSearch('Quantum', { persistRecent: true })} className="col-span-1 md:col-span-2 rounded-3xl border border-bit-border bg-bit-panel/30 p-10 relative overflow-hidden group cursor-pointer hover:border-bit-accent/30 transition-all shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-bit-accent/5 to-transparent" />
                    <h3 className="text-4xl font-display font-bold text-bit-text relative z-10">Quantum Era</h3>
                    <p className="text-bit-muted mt-4 max-w-xs relative z-10 leading-relaxed text-sm">Synthetic analysis of particle logic and future computation streams.</p>
                    <div className="absolute bottom-10 right-10 text-bit-accent/10 group-hover:scale-125 group-hover:text-bit-accent/30 transition-all duration-700">
                      <Zap size={80} />
                    </div>
                  </div>
                  <div onClick={() => navigateToSearch('Philosophy', { persistRecent: true })} className="rounded-3xl border border-bit-border bg-bit-panel/30 p-8 relative group overflow-hidden cursor-pointer hover:border-bit-accent/30 transition-all shadow-sm">
                    <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <Library size={120} />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-bit-text uppercase tracking-tight">Ancient <br />Nodes</h3>
                    <p className="text-xs text-bit-accent font-mono mt-2">128 COLLECTIONS</p>
                  </div>
                </div>
              </section>
            </div>
          } />

          {/* Discovery / Library Registry */}
          <Route path="/library/:categoryId?" element={<BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} />} />
          <Route path="/books/:categoryId?" element={<BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} />} />
          <Route path="/browse/:categoryId?" element={<BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} />} />

          {/* Personal Bookshelf */}
          <Route path="/mylibrary" element={
            <LibraryPage
              borrowedBooks={borrowedBooks}
              savedBooks={localUserState.savedBooks}
              recentSearches={localUserState.recentSearches}
              recentlyViewed={localUserState.recentlyViewed}
              profile={localUserState.profile}
              settings={localUserState.settings}
              onBookClick={(b) => navigate(`/book/${b.id}`)}
              onRead={handleReadBook}
              onExplore={() => navigate('/')}
            />
          } />

          <Route path="/search" element={
            <SearchPage
              onBookClick={(book) => navigate(`/book/${book.id}`)}
              onRead={handleReadBook}
              onAuthorClick={(name) => navigate(`/author/${encodeURIComponent(name)}`)}
              onResultsChange={setSearchResults}
              onSearchingChange={setIsSearching}
              onQuerySync={setSearchQuery}
              recentSearches={localUserState.recentSearches}
              onQuickSearch={applySearchSelection}
            />
          } />

          {/* Deep Routes (Wrappers for details/reader) */}
          <Route path="/book/:id" element={
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
              onBookClick={(id) => navigate(`/book/${id}`)}
              onAuthorClick={(name) => navigate(`/author/${encodeURIComponent(name)}`)}
              onCategoryClick={(cat) => navigate(`/category/${encodeURIComponent(cat)}`)}
            />
          } />

          <Route path="/author/:name" element={
            <AuthorDetails onBookClick={(book) => navigate(`/book/${book.id}`)} />
          } />

          <Route path="/category/:categoryId" element={
            <CategoryDetails onBookClick={(book) => navigate(`/book/${book.id}`)} />
          } />

          {/* Static Pages */}
          <Route path="/terms" element={<StaticPage type="terms" onBack={() => navigate('/')} />} />
          <Route path="/about" element={<AboutPage onBack={() => navigate('/')} />} />

        </Routes>

      </main>

      {/* Enhanced Footer */}
      {!isReaderActive && (
        <footer className="border-t border-bit-border/50 pt-20 pb-12 bg-bit-panel/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bit-accent/50 to-transparent opacity-20" />

          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-4">
                <Link to="/" className="inline-flex items-center mb-6 group">
                  <img
                    src="/assets/bitlibrary-icon-clean.svg"
                    alt="BitLibrary"
                    className="h-10 w-auto"
                  />
                  <span className="ml-3 font-display font-bold text-2xl text-bit-text tracking-tighter">BitLibrary</span>
                </Link>
                <p className="text-bit-muted text-sm leading-relaxed mb-8 max-w-sm">
                  The Open Digital Library for accessible discovery, open archives, and modern reading.
                  Built to connect books, authors, and knowledge in one searchable interface.
                </p>
                <div className="flex gap-4">
                  <button className="p-2 rounded-full border border-bit-border hover:border-bit-accent/50 text-bit-muted hover:text-bit-accent transition-all"><Github size={18} /></button>
                  <button className="p-2 rounded-full border border-bit-border hover:border-bit-accent/50 text-bit-muted hover:text-bit-accent transition-all"><Disc size={18} /></button>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8 text-[10px] font-mono">
                <div>
                  <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Library Hub</h4>
                  <ul className="space-y-4 text-bit-muted">
                    <li><Link to="/library" className="hover:text-bit-accent transition-all">CENTRAL REGISTRY</Link></li>
                    <li><Link to="/" className="hover:text-bit-accent transition-all">COLLECTIONS</Link></li>
                    <li><Link to="/mylibrary" className="hover:text-bit-accent transition-all">MY ARCHIVE</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Protocol</h4>
                  <ul className="space-y-4 text-bit-muted">
                    <li><Link to="/about" className="hover:text-bit-accent transition-all">ABOUT ENGINE</Link></li>
                    <li><Link to="/terms" className="hover:text-bit-accent transition-all">TERMS OF USE</Link></li>
                    <li><button className="hover:text-bit-accent transition-all uppercase">NEURAL AUDIT</button></li>
                  </ul>
                </div>
                <div className="hidden md:block">
                  <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Lab Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-[9px] text-bit-muted">STABLE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-bit-accent shadow-[0_0_8px_rgba(255,77,0,0.6)]" />
                      <span className="text-[9px] text-bit-muted">SYNC ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="p-6 rounded-2xl bg-bit-panel/30 border border-bit-border relative group hover:border-bit-accent/40 transition-all shadow-sm">
                  <h4 className="text-bit-text font-display font-bold mb-2">Join the Lab</h4>
                  <p className="text-[10px] text-bit-muted mb-6 font-mono leading-relaxed uppercase">
                    Enroll in the neural notification stream.
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ARCHIVE_ID@EMAIL.NET"
                      className="w-full bg-bit-bg/50 border border-bit-border rounded py-2 px-3 text-[10px] font-mono focus:outline-none focus:border-bit-accent/50 transition-all text-bit-text"
                    />
                    <button className="absolute right-1 top-1 bottom-1 px-2 bg-bit-accent text-white text-[9px] font-bold rounded hover:scale-95 transition-all">ENROLL</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-bit-border/50 pt-12 text-[10px] font-mono text-bit-muted uppercase tracking-widest">
              <div>© 2026 BitLibrary • The Open Digital Library Platform</div>
              <div className="flex items-center gap-4">
                <span>Infrastructure:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={`h-1 w-3 rounded-full ${i < 5 ? 'bg-bit-accent/40' : 'bg-bit-border'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          aria-label="Close mobile menu backdrop"
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-bit-bg/65 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
        />

        <aside
          className={`absolute right-0 top-0 h-full w-[90vw] max-w-sm border-l border-bit-border bg-bit-bg shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between border-b border-bit-border px-5 h-16">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Navigation Hub</p>
              <p className="text-xs text-bit-muted truncate">Hi {localUserState.profile.displayName || 'Reader'}</p>
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted hover:text-bit-text hover:border-bit-accent/40 transition-all"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close mobile menu"
            >
              <X size={18} className="mx-auto" />
            </button>
          </div>

          <div className="h-[calc(100%-4rem)] overflow-y-auto px-5 py-5 space-y-6">
            <form onSubmit={handleMobileMenuSearchSubmit} className="rounded-2xl border border-bit-border bg-bit-panel/35 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-2">Quick Search</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search books or authors..."
                  className="flex-1 rounded-xl border border-bit-border bg-bit-bg/60 px-3 py-2 text-sm text-bit-text placeholder:text-bit-muted/60 focus:outline-none focus:border-bit-accent/40"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-bit-accent text-white px-3 py-2 text-[10px] font-mono uppercase tracking-widest"
                >
                  Go
                </button>
              </div>
            </form>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-3">Main Routes</p>
              <div className="space-y-2">
                <Link to="/" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <House size={16} />
                  Discover
                </Link>
                <Link to="/library" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/library') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <Library size={16} />
                  Library
                </Link>
                <Link to="/mylibrary" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/mylibrary') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <BookOpenText size={16} />
                  My Library
                </Link>
                <Link to="/about" className="flex items-center gap-3 rounded-xl border border-bit-border bg-bit-panel/30 px-3 py-2 text-sm text-bit-muted hover:text-bit-text hover:border-bit-accent/30 transition-all">
                  <Info size={16} />
                  About
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-3">Quick Topics</p>
              <div className="flex flex-wrap gap-2">
                {mobileQuickTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setSearchQuery(topic);
                      navigateToSearch(topic, { persistRecent: true });
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-full border border-bit-border bg-bit-panel/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-text hover:border-bit-accent/30 transition-all"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Theme</p>
                  <p className="text-xs text-bit-muted mt-1">Switch light or dark mode.</p>
                </div>
                <ThemeToggle />
              </div>
            </section>
          </div>
        </aside>
      </div>
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

  return (
    <BookDetails
      book={book}
      allBooks={books}
      onClose={() => navigate('/library')}
      onRead={(rid) => onRead(rid || book.id)}
      onBookClick={(b) => navigate(`/book/${b.id}`, { state: { path: [...(location.state?.path || []), book] } })}
      onAuthorClick={onAuthorClick}
      onCategoryClick={onCategoryClick}
      onBreadcrumbClick={(b, index) => {
        const currentPath = location.state?.path || [];
        // Truncate path to avoid circular loops
        navigate(`/book/${b.id}`, { state: { path: currentPath.slice(0, index) } });
      }}
      breadcrumbPath={location.state?.path || []}
    />
  );
};

const ReaderRoute: React.FC<{ books: Book[] }> = ({ books }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  return <div className="hidden">Triggering Neural Sector {id}...</div>;
};

export default App;
