import React, { useEffect, useRef, useState } from 'react';
import { Audiobook, Book } from '@/types/index';
import { searchBooksInGutendex, searchGoogleBooks, searchITBooks, searchOpenLibrary, searchInternetArchive } from '@/services/bookService';
import { searchAudiobooks } from '@/services/audiobookService';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';

export const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_KEY = 'bitlibrary-search-cache-v1';
const SEARCH_CACHE_TTL = 15 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 20;

interface SearchCacheEntry {
  results: Book[];
  timestamp: number;
}

const mergeUniqueBooks = (...collections: Book[][]): Book[] => {
  const seen = new Set<string>();
  const merged: Book[] = [];

  collections.flat().forEach((book) => {
    if (!book?.id || seen.has(book.id)) return;
    seen.add(book.id);
    merged.push(book);
  });

  return merged;
};

const rankBooks = (books: Book[], query: string): Book[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const toSearchableText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((item) => toSearchableText(item)).join(' ');
    if (typeof value === 'object') {
      const maybeText = (value as { text?: unknown }).text;
      if (typeof maybeText === 'string') return maybeText;
      return '';
    }
    return String(value);
  };

  const getWeight = (book: Book) => {
    const title = toSearchableText(book.title).toLowerCase();
    const desc = toSearchableText(book.description).toLowerCase();
    const author = toSearchableText(book.author).toLowerCase();
    const category = toSearchableText(book.category).toLowerCase();
    const subjects = (book.subjects || []).map((subject) => toSearchableText(subject)).join(' ').toLowerCase();

    let weight = 0;

    if (title === normalizedQuery) weight += 10000;
    if (title.startsWith(normalizedQuery)) weight += 5000;
    if (title.includes(normalizedQuery)) weight += 2000;
    if (author.includes(normalizedQuery)) weight += 800;
    if (category.includes(normalizedQuery)) weight += 400;
    if (subjects.includes(normalizedQuery)) weight += 300;
    if (desc.includes(normalizedQuery)) weight += 200;
    weight += Math.min(book.downloads || 0, 5000) / 25;
    weight += book.source === 'neural' ? 150 : 0;

    return weight;
  };

  return [...books].sort((a, b) => getWeight(b) - getWeight(a));
};

const readSearchCacheState = (): Record<string, SearchCacheEntry> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return {};

    return JSON.parse(raw) as Record<string, SearchCacheEntry>;
  } catch {
    return {};
  }
};

const pruneSearchCache = (cache: Record<string, SearchCacheEntry>) => {
  const now = Date.now();
  const freshEntries = Object.entries(cache)
    .filter(([, entry]) => now - entry.timestamp <= SEARCH_CACHE_TTL)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, SEARCH_CACHE_MAX_ENTRIES);

  return Object.fromEntries(freshEntries);
};

const readSearchCache = (query: string): Book[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cache = pruneSearchCache(readSearchCacheState());
    window.localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
    const entry = cache[query.trim().toLowerCase()];
    if (!entry) return null;
    return entry.results || null;
  } catch {
    return null;
  }
};

const writeSearchCache = (query: string, results: Book[]) => {
  if (typeof window === 'undefined') return;

  try {
    const current = readSearchCacheState();
    current[query.trim().toLowerCase()] = {
      results,
      timestamp: Date.now(),
    };
    const nextCache = pruneSearchCache(current);
    window.localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(nextCache));
  } catch {
    // Ignore storage failures; network search still works.
  }
};

interface SearchPageProps {
  onBookClick: (book: Book) => void;
  onAudiobookClick: (audiobook: Audiobook) => void;
  onRead: (book: Book) => void;
  onAuthorClick: (name: string) => void;
  onResultsChange: (books: Book[]) => void;
  onSearchingChange: (value: boolean) => void;
  onQuerySync: (value: string) => void;
  recentSearches: string[];
  onQuickSearch: (query: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
  onBookClick,
  onAudiobookClick,
  onRead,
  onAuthorClick,
  onResultsChange,
  onSearchingChange,
  onQuerySync,
  recentSearches,
  onQuickSearch,
}) => {
  const [searchParams] = useSearchParams();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [audiobookResults, setAudiobookResults] = useState<Audiobook[]>([]);
  const [activeType, setActiveType] = useState<'all' | 'books' | 'audiobooks'>('all');
  const [activeSource, setActiveSource] = useState<'all' | Book['source'] | 'LibriVox'>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const activeSearchRequestRef = useRef(0);

  useEffect(() => {
    const query = searchParams.get('q')?.trim() || '';
    onQuerySync(query);

    if (!query) {
      activeSearchRequestRef.current += 1;
      setSearchResults([]);
      setAudiobookResults([]);
      setIsSearching(false);
      onResultsChange([]);
      onSearchingChange(false);
      return;
    }

    if (query.length < SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setAudiobookResults([]);
      setIsSearching(false);
      onResultsChange([]);
      onSearchingChange(false);
      return;
    }

    const requestId = activeSearchRequestRef.current + 1;
    activeSearchRequestRef.current = requestId;
    const controller = new AbortController();

    const performSearch = async () => {
      const cachedResults = readSearchCache(query);
      if (cachedResults && cachedResults.length > 0) {
        setSearchResults(cachedResults);
        onResultsChange(cachedResults);
      }

      setIsSearching(true);
      onSearchingChange(true);

      const updateResults = (newBooks: Book[]) => {
        if (activeSearchRequestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setSearchResults((prev) => {
          const merged = mergeUniqueBooks(prev, newBooks);
          return rankBooks(merged, query);
        });
      };
      const updateAudiobookResults = (newAudiobooks: Audiobook[]) => {
        if (activeSearchRequestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setAudiobookResults(newAudiobooks);
      };

      // 1. Concurrent Independent Streaming Fetches
      setAudiobookResults([]);
      const searchTasks = [
        searchBooksInGutendex(query, controller.signal).then(updateResults),
        searchGoogleBooks(query, controller.signal).then(updateResults),
        searchOpenLibrary(query, controller.signal).then(updateResults),
        // Secondary sources
        searchITBooks(query, controller.signal).then(updateResults),
        searchInternetArchive(query, controller.signal).then(updateResults),
        searchAudiobooks(query, 8).then(updateAudiobookResults),
      ];

      try {
        await Promise.allSettled(searchTasks);
      } finally {
        if (activeSearchRequestRef.current === requestId) {
          setIsSearching(false);
          onSearchingChange(false);
        }
      }
    };

    void performSearch();

    return () => {
      controller.abort();
    };
  }, [onQuerySync, onResultsChange, onSearchingChange, searchParams]);

  useEffect(() => {
    onResultsChange(searchResults);
    const query = searchParams.get('q')?.trim() || '';
    if (query) {
      writeSearchCache(query, searchResults);
    }
  }, [onResultsChange, searchParams, searchResults]);

  const currentQuery = searchParams.get('q')?.trim() || '';
  const isQueryReady = currentQuery.length >= SEARCH_MIN_QUERY_LENGTH;
  const availableSources = Array.from(new Set([
    ...searchResults.map((book) => book.source).filter(Boolean),
    ...(audiobookResults.length ? ['LibriVox'] : []),
  ])) as Array<Book['source'] | 'LibriVox'>;
  const availableCategories = Array.from(new Set([
    ...searchResults.map((book) => book.category).filter(Boolean),
    ...audiobookResults.flatMap((audiobook) => audiobook.genres).filter(Boolean),
  ])).slice(0, 8);
  const filteredResults = searchResults.filter((book) => {
    const matchesSource = activeSource === 'all' || book.source === activeSource;
    const matchesCategory = activeCategory === 'all' || book.category === activeCategory;
    return matchesSource && matchesCategory;
  });
  const filteredAudiobooks = audiobookResults.filter((audiobook) => {
    const matchesSource = activeSource === 'all' || activeSource === 'LibriVox';
    const matchesCategory = activeCategory === 'all' || audiobook.genres.includes(activeCategory);
    return matchesSource && matchesCategory;
  });
  const mixedResults = [
    ...(activeType === 'all' || activeType === 'audiobooks'
      ? filteredAudiobooks.map((audiobook) => ({ type: 'audiobook' as const, id: `audio-${audiobook.id}`, item: audiobook }))
      : []),
    ...(activeType === 'all' || activeType === 'books'
      ? filteredResults.map((book) => ({ type: 'book' as const, id: `book-${book.id}`, item: book }))
      : []),
  ];
  const sourceCounts = availableSources.map((source) => ({
    source,
    count: source === 'LibriVox'
      ? audiobookResults.length
      : searchResults.filter((book) => book.source === source).length,
  }));
  const quickTopics = Array.from(new Set([...recentSearches, 'Philosophy', 'History', 'Science Fiction', 'Machine Learning'])).slice(0, 6);

  useEffect(() => {
    setActiveType('all');
    setActiveSource('all');
    setActiveCategory('all');
    setShowFilters(false);
  }, [currentQuery]);

  const hasActiveFilters = activeType !== 'all' || activeSource !== 'all' || activeCategory !== 'all';
  const shouldShowFilters = showFilters || hasActiveFilters;
  const totalResultCount = searchResults.length + audiobookResults.length;
  const totalFilteredCount = mixedResults.length;

  return (
    <div className="animate-fade-in">
      <div className="mb-12 space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-bit-border bg-bit-panel/30 p-8 md:p-10 shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--bit-accent-rgb),0.08),transparent_42%)] pointer-events-none" />
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-bit-accent/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent mb-4 font-bold">Search</p>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-bit-text tracking-tighter">
                  {isQueryReady ? `Results for "${currentQuery}"` : 'Search books and audiobooks'}
                </h2>
              </div>
              {isQueryReady && totalResultCount > 0 && (
                <div className="flex items-center md:self-center">
                  <button
                    onClick={() => setShowFilters((prev) => !prev)}
                    className="inline-flex items-center gap-3 rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-sm text-bit-muted hover:text-bit-text hover:border-bit-accent/40 hover:bg-bit-accent/10 transition-all font-mono uppercase tracking-widest"
                  >
                    <SlidersHorizontal size={14} className="text-bit-accent" />
                    <span>Filters</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${shouldShowFilters ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              )}
            </div>
            {!isQueryReady && (
               <div className="flex flex-wrap gap-2">
                 {quickTopics.map(s => (
                   <button
                     key={s}
                     onClick={() => onQuickSearch(s)}
                     className="px-3 py-1.5 rounded-full border border-bit-border bg-bit-panel/30 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-text hover:border-bit-accent/40 transition-all"
                   >
                     {s}
                   </button>
                 ))}
               </div>
            )}
          </div>
        </section>

        {shouldShowFilters && totalResultCount > 0 && (
          <section className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-6 shadow-sm animate-fade-in-up">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent mb-4 font-bold">Type</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', `All (${totalResultCount})`],
                    ['books', `Books (${searchResults.length})`],
                    ['audiobooks', `Audiobooks (${audiobookResults.length})`],
                  ] as const).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setActiveType(type)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all ${activeType === type ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/40'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent mb-4 font-bold">Sources</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSource('all')}
                    className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all ${activeSource === 'all' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/40'}`}
                  >
                    All sources
                  </button>
                  {sourceCounts.map(({ source, count }) => (
                    <button
                      key={source}
                      onClick={() => setActiveSource(source)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all ${activeSource === source ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/40'}`}
                    >
                      {source} ({count})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent mb-4 font-bold">Categories</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all ${activeCategory === 'all' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/40'}`}
                  >
                    All categories
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all ${activeCategory === category ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/40'}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {!isQueryReady && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-bit-accent">
                <Search size={18} />
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] font-bold">Search tips</p>
              </div>
              <h3 className="text-2xl font-display font-bold text-bit-text mb-3 tracking-tight">Search by title, author, or topic.</h3>
              <p className="text-bit-muted leading-relaxed mb-6 text-sm">
                BitLibrary works best when the query has at least {SEARCH_MIN_QUERY_LENGTH} characters. Try a broad topic first, then narrow the results with filters.
              </p>
              <div className="flex flex-wrap gap-3">
                {recentSearches.slice(0, 4).map(q => (
                  <button key={q} onClick={() => onQuickSearch(q)} className="px-3 py-1.5 rounded-lg border border-bit-border bg-bit-panel/50 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-text hover:border-bit-accent/40 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-bit-accent">
                <Sparkles size={18} />
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] font-bold">Suggested searches</p>
              </div>
              <div className="space-y-3 text-sm text-bit-muted font-mono uppercase tracking-widest text-[11px]">
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Jane Austen"</p>
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Modern Philosophy"</p>
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Quantum Theory"</p>
              </div>
            </div>
          </section>
        )}

      </div>

      <div className="mb-24">
        {isSearching && totalResultCount === 0 ? (
          <div className="animate-fade-in space-y-12">
            <BookGridSkeleton count={8} />
          </div>
        ) : (
          <div className="animate-fade-in space-y-12">
            {mixedResults.length > 0 && (
              <section>
                <div className="mb-5">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Results</p>
                  <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">Books and audiobooks</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-10">
                  {mixedResults.map((result) => (
                    result.type === 'audiobook' ? (
                      <div key={result.id} className="relative">
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
                          Audio
                        </div>
                        <AudiobookCard
                          audiobook={result.item}
                          onClick={onAudiobookClick}
                          variant="compact"
                          searchQuery={currentQuery}
                        />
                      </div>
                    ) : (
                      <div key={result.id} className="relative group">
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-panel px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm border border-bit-border">
                          Book
                        </div>
                        {result.item.source === 'neural' && (
                          <div className="absolute -top-3 -right-3 z-20 px-2 py-1 bg-bit-accent text-white text-[8px] font-bold font-mono rounded rounded-bl-none shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.4)] transition-transform group-hover:scale-110">
                            NEURAL
                          </div>
                        )}
                        <BookCard
                          variant="compact"
                          book={result.item}
                          onClick={onBookClick}
                          onRead={onRead}
                          onAuthorClick={onAuthorClick}
                          searchQuery={currentQuery}
                        />
                      </div>
                    )
                  ))}
                </div>
              </section>
            )}

            {totalFilteredCount === 0 && isQueryReady && !isSearching && (
              <div className="py-40 text-center rounded-[2rem] border border-dashed border-bit-border bg-bit-panel/30">
                <Zap className="mx-auto text-bit-border mb-6" size={48} />
                <p className="text-bit-muted font-mono text-xs uppercase tracking-[0.3em]">
                  {totalResultCount > 0 ? 'No results match the active filters.' : 'No books or audiobooks found.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
