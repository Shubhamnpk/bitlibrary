import React, { useState, useEffect, useCallback } from 'react';
import { Book, ViewState } from '@/types/index';
import { INITIAL_BOOKS, CATEGORIES } from '@/constants';
import { fetchBooksFromGutendex, fetchBookById } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import Reader, { ReaderSkeleton } from '@/components/Reader';
import { Search, Library, Zap, Command, Menu, X, Github, Disc, ChevronRight } from 'lucide-react';
import BookDetails from '@/pages/BookDetails';
import { BookDetailsSkeleton } from '@/components/Skeletons';
import LibraryPage from '@/pages/Library';
import BrowseBooks from '@/pages/BrowseBooks';
import StaticPage from '@/pages/StaticPage';
import AuthorDetails from '@/pages/AuthorDetails';
import CategoryDetails from '@/pages/CategoryDetails';
import SearchPage from '@/pages/Search';

import { Routes, Route, useNavigate, useLocation, useSearchParams, Link, useParams } from 'react-router-dom';

const SEARCH_DEBOUNCE_MS = 350;
const MIN_SEARCH_LENGTH = 3;
const EXPLORE_CACHE_KEY = 'bitlibrary-explore-cache-v1';
const EXPLORE_CACHE_TTL = 30 * 60 * 1000;

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

  // Persistent Global Reader State
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const navigateToSearch = useCallback((rawQuery: string) => {
    const trimmed = rawQuery.trim();

    if (!trimmed) {
      if (location.pathname === '/search') {
        setSearchParams({});
      }
      return;
    }

    const nextSearch = `?q=${encodeURIComponent(trimmed)}`;
    if (location.pathname === '/search') {
      setSearchParams({ q: trimmed });
      return;
    }

    navigate(`/search${nextSearch}`);
  }, [location.pathname, navigate, setSearchParams]);

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

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    navigateToSearch(searchQuery);
  };

  // Auto-Search Neural Synchronization (Debounced after 3 characters)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const isDeepSector = location.pathname.startsWith('/book/') ||
      location.pathname.startsWith('/reader/') ||
      location.pathname.startsWith('/author/');

    const isSearchableSector = location.pathname === '/' || location.pathname === '/search';
    if (trimmed.length >= MIN_SEARCH_LENGTH && !isDeepSector && isSearchableSector) {
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
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-bit-bg text-bit-text font-sans selection:bg-bit-accent selection:text-black">
      <ScrollToTop />
      {/* Background Grid & Effects */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-bit-bg/50 to-bit-bg pointer-events-none" />

      {/* Navigation - Hidden in Full Reader mode */}
      {!isReaderActive && (
        <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-bit-bg/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

            <Link to="/" className="flex items-center gap-3 group min-w-0">
              <img
                src="/assets/bitlibrary-icon-clean.svg"
                alt="BitLibrary"
                className="w-9 h-9 shrink-0 transition-transform group-hover:scale-105"
              />
              <div className="min-w-0">
                <p className="font-display font-bold text-xl tracking-tight text-white leading-none">BitLibrary</p>
                <p className="hidden lg:block text-[9px] font-mono uppercase tracking-[0.22em] text-bit-accent/80 mt-1">
                  The Open Digital Library
                </p>
              </div>
            </Link>

            {/* Desktop Search */}
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center flex-1 max-w-lg mx-8 relative group">
              <Search className="absolute left-3 text-gray-500 group-focus-within:text-bit-accent transition-colors" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Synchronize with registry... (Press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-bit-accent/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-600 font-mono"
              />
              {isSearching && (
                <div className="absolute right-4 animate-spin text-bit-accent">
                  <Disc size={16} />
                </div>
              )}
            </form>

            <div className="hidden md:flex items-center gap-6 font-mono text-xs tracking-wider">
              <Link to="/" className={`hover:text-white transition-colors uppercase ${activeTab('/') ? 'text-bit-accent' : 'text-gray-400'}`}>Discover</Link>
              <Link to="/library" className={`hover:text-white transition-colors uppercase ${activeTab('/library') ? 'text-bit-accent' : 'text-gray-400'}`}>Library</Link>
              <Link to="/mylibrary" className={`hover:text-white transition-colors uppercase ${activeTab('/mylibrary') ? 'text-bit-accent' : 'text-gray-400'}`}>My Library</Link>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center cursor-pointer">
                <span className="text-[10px] font-bold text-white">US</span>
              </div>
            </div>

            <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
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
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-bit-accent/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10">
                  <span className="inline-block py-1 px-3 rounded-full border border-bit-accent/20 bg-bit-accent/5 text-[10px] text-bit-accent font-mono mb-6 uppercase tracking-[0.2em]">
                    BitLibrary Platform
                  </span>
                  <h1 className="text-6xl md:text-8xl font-display font-bold text-white mb-8 leading-none tracking-tighter">
                    NEURAL DATA <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-gray-700">STORM.</span>
                  </h1>
                  <p className="text-lg text-gray-500 max-w-2xl mb-12 leading-relaxed font-sans">
                    The Open Digital Library for modern readers, students, and explorers of knowledge.
                    <p className="text-sm text-gray-600 max-w-2xl mb-12 leading-relaxed font-mono uppercase tracking-[0.18em]">
                      Search across open archives, discover authors, and explore books with a faster digital reading interface.
                    </p>
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.slice(0, 6).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSearchQuery(cat); navigateToSearch(cat); }}
                        className="px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-bit-accent/40 hover:bg-white/[0.05] text-[10px] text-gray-400 hover:text-white transition-all font-mono uppercase tracking-widest"
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
                    <h2 className="text-3xl font-display font-bold text-white">Registry Spotlight</h2>
                    <p className="text-xs text-gray-600 font-mono mt-1 uppercase tracking-widest">Active nodes in the current stream</p>
                  </div>
                  <Link to="/books" className="group flex items-center gap-2 text-[10px] text-bit-accent hover:text-white font-mono uppercase tracking-[0.2em] transition-colors">
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
                <h2 className="text-2xl font-display font-bold text-white mb-10">Neural Clusters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
                  <div onClick={() => navigateToSearch('Quantum')} className="col-span-1 md:col-span-2 rounded-3xl border border-white/5 bg-white/[0.01] p-10 relative overflow-hidden group cursor-pointer hover:border-bit-accent/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-transparent" />
                    <h3 className="text-4xl font-display font-bold text-white relative z-10">Quantum Era</h3>
                    <p className="text-gray-500 mt-4 max-w-xs relative z-10 leading-relaxed text-sm">Synthetic analysis of particle logic and future computation streams.</p>
                    <div className="absolute bottom-10 right-10 text-bit-accent/20 group-hover:scale-125 group-hover:text-bit-accent/50 transition-all duration-700">
                      <Zap size={80} />
                    </div>
                  </div>
                  <div onClick={() => navigateToSearch('Philosophy')} className="rounded-3xl border border-white/5 bg-white/[0.01] p-8 relative group overflow-hidden cursor-pointer hover:border-bit-accent/30 transition-all">
                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-20 transition-opacity">
                      <Library size={120} />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Ancient <br />Nodes</h3>
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
          <Route path="/about" element={<StaticPage type="about" onBack={() => navigate('/')} />} />

        </Routes>

      </main>

      {/* Enhanced Footer */}
      {!isReaderActive && (
        <footer className="border-t border-white/5 pt-20 pb-12 bg-black relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bit-accent/50 to-transparent opacity-20" />

          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-4">
                <Link to="/" className="inline-flex items-center mb-6 group">
                  <img
                    src="/assets/bitlibrary-logo.svg"
                    alt="BitLibrary"
                    className="h-14 w-auto"
                  />
                </Link>
                <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-sm">
                  The Open Digital Library for accessible discovery, open archives, and modern reading.
                  Built to connect books, authors, and knowledge in one searchable interface.
                </p>
                <div className="flex gap-4">
                  <button className="p-2 rounded-full border border-white/5 hover:border-bit-accent/50 hover:text-bit-accent transition-all"><Github size={18} /></button>
                  <button className="p-2 rounded-full border border-white/5 hover:border-bit-accent/50 hover:text-bit-accent transition-all"><Disc size={18} /></button>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8 text-[10px] font-mono">
                <div>
                  <h4 className="text-white font-medium mb-6 uppercase tracking-widest opacity-40">Library Hub</h4>
                  <ul className="space-y-4 text-gray-500">
                    <li><Link to="/library" className="hover:text-bit-accent transition-all">CENTRAL REGISTRY</Link></li>
                    <li><Link to="/" className="hover:text-bit-accent transition-all">COLLECTIONS</Link></li>
                    <li><Link to="/mylibrary" className="hover:text-bit-accent transition-all">MY ARCHIVE</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-6 uppercase tracking-widest opacity-40">Protocol</h4>
                  <ul className="space-y-4 text-gray-500">
                    <li><Link to="/about" className="hover:text-bit-accent transition-all">ABOUT ENGINE</Link></li>
                    <li><Link to="/terms" className="hover:text-bit-accent transition-all">TERMS OF USE</Link></li>
                    <li><button className="hover:text-bit-accent transition-all uppercase">NEURAL AUDIT</button></li>
                  </ul>
                </div>
                <div className="hidden md:block">
                  <h4 className="text-white font-medium mb-6 uppercase tracking-widest opacity-40">Lab Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-[9px] text-gray-500">STABLE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-bit-accent shadow-[0_0_8px_rgba(255,77,0,0.6)]" />
                      <span className="text-[9px] text-gray-500">SYNC ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 relative group hover:border-bit-accent/20 transition-all">
                  <h4 className="text-white font-display font-bold mb-2">Join the Lab</h4>
                  <p className="text-[10px] text-gray-500 mb-6 font-mono leading-relaxed uppercase">
                    Enroll in the neural notification stream.
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ARCHIVE_ID@EMAIL.NET"
                      className="w-full bg-black/50 border border-white/10 rounded py-2 px-3 text-[10px] font-mono focus:outline-none focus:border-bit-accent/50 transition-all"
                    />
                    <button className="absolute right-1 top-1 bottom-1 px-2 bg-bit-accent text-black text-[9px] font-bold rounded hover:scale-95 transition-all">ENROLL</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pt-12 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
              <div>© 2026 BitLibrary • The Open Digital Library</div>
              <div className="flex items-center gap-4">
                <span>Infr Status:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={`h-1 w-3 rounded-full ${i < 5 ? 'bg-bit-accent/20' : 'bg-gray-900'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-bit-bg md:hidden animate-fade-in flex flex-col items-center justify-center gap-10 p-8 text-center scroll-lock">
          <button className="absolute top-6 right-6 text-white" onClick={() => setMobileMenuOpen(false)}>
            <X size={28} />
          </button>
          <nav className="flex flex-col items-center gap-8">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`text-4xl font-display font-bold ${activeTab('/') ? 'text-bit-accent' : 'text-white'}`}>Discover</Link>
            <Link to="/books" onClick={() => setMobileMenuOpen(false)} className={`text-4xl font-display font-bold ${activeTab('/books') ? 'text-bit-accent' : 'text-white'}`}>Registry</Link>
            <Link to="/library" onClick={() => setMobileMenuOpen(false)} className={`text-4xl font-display font-bold ${activeTab('/library') ? 'text-bit-accent' : 'text-white'}`}>Archive</Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-xl font-mono text-gray-500 uppercase">About</Link>
          </nav>
        </div>
      )}
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



