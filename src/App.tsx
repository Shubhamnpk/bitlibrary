import React, { useState, useEffect, useCallback } from 'react';
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
import { recordRecentSearch, useLocalUserState } from '@/lib/local-user';
import { ThemeToggle } from '@/components/ThemeToggle';

import { Routes, Route, useNavigate, useLocation, useSearchParams, Link, useParams } from 'react-router-dom';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

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
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(false);
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
      <main className={`pb-20 min-h-screen relative z-0 ${isReaderActive ? '' : 'pt-16 md:pt-20'}`}>

        <Routes>
          {/* Home / Discovery */}
          <Route path="/" element={
            <div className="animate-fade-in-up">
              {/* Hero */}
              <section className="mb-12 md:mb-16 relative overflow-hidden py-8 md:py-14">
                {/* Decorative Geometric Elements */}
                <div className="absolute top-0 right-0 w-full md:w-3/4 h-full pointer-events-none overflow-hidden select-none">
                  {/* Rotating Rings - Enhanced visibility */}
                  <div className="absolute -top-40 -right-40 w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full border-[2px] border-bit-accent/15 animate-slow-rotate" />
                  <div className="absolute -top-20 -right-20 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full border-[1px] border-bit-accent/10 animate-slow-rotate [animation-direction:reverse]" />
                  <div className="absolute -top-60 -right-60 w-[700px] h-[700px] md:w-[900px] md:h-[900px] rounded-full border-[0.5px] border-bit-accent/5 animate-slow-rotate [animation-duration:40s]" />
                  
                  {/* Floating Geometric "Stones/Nodes" - More visible and polished */}
                  <div className="absolute top-1/4 right-1/4 w-16 h-16 bg-gradient-to-br from-bit-accent/20 to-bit-accent/5 backdrop-blur-md border border-bit-accent/30 rounded-2xl rotate-12 animate-float-up shadow-[0_0_20px_rgba(var(--bit-accent-rgb),0.1)]" />
                  <div className="absolute top-1/2 right-1/3 w-10 h-10 bg-bit-panel/60 backdrop-blur-lg border border-bit-border rounded-lg -rotate-12 animate-float-down shadow-xl" />
                  <div className="absolute bottom-1/4 right-1/2 w-20 h-20 border-2 border-bit-accent/20 border-dashed rounded-full animate-pulse" />
                  
                  {/* Small Shards / CONCEPT_NODES */}
                  <div className="absolute top-[15%] right-1/2 w-5 h-5 bg-bit-accent/40 backdrop-blur-sm rotate-45 animate-float-up shadow-sm border border-bit-accent/20" />
                  <div className="absolute bottom-1/3 right-[15%] w-4 h-4 bg-bit-text opacity-20 rotate-12 animate-float-down" />
                  <div className="absolute top-1/2 right-[45%] w-3 h-3 bg-bit-accent rounded-full animate-pulse blur-[1px]" />
                  
                  {/* Light Orbs */}
                  <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-bit-accent/15 rounded-full blur-[120px] opacity-60 mix-blend-plus-lighter" />
                  <div className="absolute bottom-[20%] right-[30%] w-[300px] h-[300px] bg-bit-accent/5 rounded-full blur-[100px] opacity-40 mix-blend-plus-lighter" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
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
                        className="px-4 py-2 rounded-lg bg-bit-panel/30 border border-bit-border hover:border-bit-accent/40 hover:bg-bit-panel/50 text-[10px] text-bit-muted hover:text-bit-text transition-all font-mono uppercase tracking-widest"
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

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
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
                      <BookCard key={book.id} variant="compact" book={book} onClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} />
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
          <Route path="/library/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} /></div>} />
          <Route path="/books/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} /></div>} />
          <Route path="/browse/:categoryId?" element={<div className="max-w-7xl mx-auto px-4 sm:px-6"><BrowseBooks onBookClick={(b) => navigate(`/book/${b.id}`)} onRead={handleReadBook} /></div>} />

          {/* Personal Bookshelf */}
          <Route path="/mylibrary" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
            </div>
          } />

          <Route path="/search" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
            </div>
          } />

          {/* Deep Routes (Wrappers for details/reader) */}
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
                onBookClick={(id) => navigate(`/book/${id}`)}
                onAuthorClick={(name) => navigate(`/author/${encodeURIComponent(name)}`)}
                onCategoryClick={(cat) => navigate(`/category/${encodeURIComponent(cat)}`)}
              />
            </div>
          } />

          <Route path="/author/:name" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <AuthorDetails onBookClick={(book) => navigate(`/book/${book.id}`)} />
            </div>
          } />

          <Route path="/category/:categoryId" element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <CategoryDetails onBookClick={(book) => navigate(`/book/${book.id}`)} />
            </div>
          } />

          {/* Static Pages */}
          <Route path="/terms" element={<StaticPage type="terms" onBack={() => navigate('/')} />} />
          <Route path="/about" element={<AboutPage onBack={() => navigate('/')} />} />

        </Routes>

      </main>

      {/* Global Footer */}
      <Footer isReaderActive={isReaderActive} />

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
