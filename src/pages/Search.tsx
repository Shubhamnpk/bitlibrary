import React, { useEffect, useRef, useState } from 'react';
import { Book } from '@/types/index';
import { searchBooksWithGemini, generateSearchInsights } from '@/services/geminiService';
import { searchBooksInGutendex, searchGoogleBooks, searchITBooks, searchOpenLibrary, searchInternetArchive } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton, SearchInsightSkeleton } from '@/components/Skeletons';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Search, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';

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

  const getWeight = (book: Book) => {
    const title = book.title.toLowerCase();
    const desc = (book.description || '').toLowerCase();
    const author = (book.author || '').toLowerCase();
    const category = (book.category || '').toLowerCase();
    const subjects = (book.subjects || []).join(' ').toLowerCase();

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
  onRead,
  onAuthorClick,
  onResultsChange,
  onSearchingChange,
  onQuerySync,
  recentSearches,
  onQuickSearch,
}) => {
  const [searchParams] = useSearchParams();
  const [searchAIAnalysis, setSearchAIAnalysis] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [activeSource, setActiveSource] = useState<'all' | Book['source']>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const activeSearchRequestRef = useRef(0);

  useEffect(() => {
    const query = searchParams.get('q')?.trim() || '';
    onQuerySync(query);

    if (!query) {
      activeSearchRequestRef.current += 1;
      setSearchResults([]);
      setSearchAIAnalysis(null);
      setIsSearching(false);
      onResultsChange([]);
      onSearchingChange(false);
      return;
    }

    if (query.length < SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setSearchAIAnalysis(null);
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
      setSearchAIAnalysis(null);

      try {
        const fastResults = await Promise.allSettled([
          searchBooksInGutendex(query, controller.signal),
          searchGoogleBooks(query, controller.signal),
          searchOpenLibrary(query, controller.signal),
        ]);

        if (activeSearchRequestRef.current !== requestId) return;

        const rankedFastResults = rankBooks(
          mergeUniqueBooks(
            ...(fastResults.map((result) => result.status === 'fulfilled' ? result.value : []))
          ),
          query
        );

        setSearchResults(rankedFastResults);
        onResultsChange(rankedFastResults);
        writeSearchCache(query, rankedFastResults);
        setIsSearching(false);
        onSearchingChange(false);

        const secondarySourcesPromise = Promise.allSettled([
          searchITBooks(query, controller.signal),
          searchInternetArchive(query, controller.signal),
        ])
          .then((secondaryResults) => {
            if (activeSearchRequestRef.current !== requestId) return;

            const mergedSecondary = mergeUniqueBooks(
              rankedFastResults,
              ...(secondaryResults.map((result) => result.status === 'fulfilled' ? result.value : []))
            );
            const rankedSecondary = rankBooks(mergedSecondary, query);
            setSearchResults(rankedSecondary);
            onResultsChange(rankedSecondary);
            writeSearchCache(query, rankedSecondary);
          })
          .catch((error) => {
            if ((error as Error)?.name !== 'AbortError') {
              console.error('Secondary source sync failed:', error);
            }
          });

        const geminiPromise = searchBooksWithGemini(query)
          .then((geminiResults) => {
            if (activeSearchRequestRef.current !== requestId || geminiResults.length === 0) return;
            const taggedResults = geminiResults.map((book) => ({ ...book, source: 'neural' as const }));
            setSearchResults((prev) => {
              const next = rankBooks(mergeUniqueBooks(taggedResults, prev), query);
              onResultsChange(next);
              writeSearchCache(query, next);
              return next;
            });
          })
          .catch((error) => {
            console.error('Neural result sync failed:', error);
          });

        const insightPromise = generateSearchInsights(query)
          .then((result) => {
            if (activeSearchRequestRef.current !== requestId) return;
            setSearchAIAnalysis(result || null);
          })
          .catch((error) => {
            console.error('Neural insight sync failed:', error);
          });

        void Promise.allSettled([secondarySourcesPromise, geminiPromise, insightPromise]);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('Neural search failed:', err);
        }

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

  const currentQuery = searchParams.get('q')?.trim() || '';
  const isQueryReady = currentQuery.length >= SEARCH_MIN_QUERY_LENGTH;
  const availableSources = Array.from(new Set(searchResults.map((book) => book.source).filter(Boolean))) as Book['source'][];
  const availableCategories = Array.from(new Set(searchResults.map((book) => book.category).filter(Boolean))).slice(0, 8);
  const filteredResults = searchResults.filter((book) => {
    const matchesSource = activeSource === 'all' || book.source === activeSource;
    const matchesCategory = activeCategory === 'all' || book.category === activeCategory;
    return matchesSource && matchesCategory;
  });
  const sourceCounts = availableSources.map((source) => ({
    source,
    count: searchResults.filter((book) => book.source === source).length,
  }));
  const quickTopics = Array.from(new Set([...recentSearches, 'Philosophy', 'History', 'Science Fiction', 'Machine Learning'])).slice(0, 6);

  useEffect(() => {
    setActiveSource('all');
    setActiveCategory('all');
    setShowFilters(false);
  }, [currentQuery]);

  const hasActiveFilters = activeSource !== 'all' || activeCategory !== 'all';
  const shouldShowFilters = showFilters || hasActiveFilters;

  return (
    <div className="animate-fade-in">
      <div className="mb-12 space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.02] p-8 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--bit-accent-rgb),0.14),transparent_42%)] pointer-events-none" />
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-bit-accent/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent mb-4">Search Network</p>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tighter">
                  {isSearching ? <span className="animate-pulse tracking-widest text-bit-accent text-3xl">SCANNING_GRID...</span> : (isQueryReady ? `Results for "${currentQuery}"` : 'Find your next read')}
                </h2>
              </div>
              {isQueryReady && searchResults.length > 0 ? (
                <div className="flex items-center md:self-center">
                  <button
                    onClick={() => setShowFilters((prev) => !prev)}
                    className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-bit-accent/40 hover:bg-bit-accent/10 transition-all"
                  >
                    <SlidersHorizontal size={16} className="text-bit-accent" />
                    <span>Refine Results</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${shouldShowFilters ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              ) : null}
            </div>

          </div>
        </section>

        {!isQueryReady && (
          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
            <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-8">
              <div className="flex items-center gap-3 mb-4 text-bit-accent">
                <Search size={18} />
                <p className="text-[10px] font-mono uppercase tracking-[0.24em]">Start With A Better Query</p>
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-3">Search by title, author, topic, or category.</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                BitLibrary works best when the query has at least {SEARCH_MIN_QUERY_LENGTH} characters. Try a broad topic first, then refine once you see the results mix.
              </p>
              <div className="flex flex-wrap gap-3">
                {quickTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => onQuickSearch(topic)}
                    className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.02] text-sm text-gray-300 hover:text-white hover:border-bit-accent/40 hover:bg-bit-accent/10 transition-all"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-8">
              <div className="flex items-center gap-3 mb-4 text-bit-accent">
                <Sparkles size={18} />
                <p className="text-[10px] font-mono uppercase tracking-[0.24em]">Good Search Ideas</p>
              </div>
              <div className="space-y-3 text-sm text-gray-400">
                <p>`Jane Austen` for author-first discovery.</p>
                <p>`modern philosophy` for broad thematic browsing.</p>
                <p>`data structures` when you want more technical sources.</p>
              </div>
            </div>
          </section>
        )}

        {!isSearching && searchAIAnalysis && (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-bit-accent/5 to-transparent border border-white/5 mb-16 relative overflow-hidden group animate-fade-in">
            <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-bit-accent/50 to-transparent" />
            <div className="flex items-start gap-4">
              <div className="p-2 bg-bit-accent/10 rounded-lg text-bit-accent mt-1 shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-[10px] font-mono text-bit-accent uppercase tracking-widest mb-3 font-bold">Neural Insight Syncing</h3>
                <p className="text-gray-200 leading-relaxed text-lg font-serif italic font-medium">
                  "{searchAIAnalysis}"
                </p>
              </div>
            </div>
          </div>
        )}

        {isQueryReady && searchResults.length > 0 && shouldShowFilters && (
          <section className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-5">
              <SlidersHorizontal size={16} className="text-bit-accent" />
              <h3 className="text-lg font-display font-bold text-white">Refine Results</h3>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-gray-500 mb-3">Source</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveSource('all')}
                  className={`px-3 py-2 rounded-full border text-[11px] transition-all ${activeSource === 'all' ? 'border-bit-accent bg-bit-accent/10 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-bit-accent/40'}`}
                >
                  All Sources
                </button>
                {sourceCounts.map(({ source, count }) => (
                  <button
                    key={source}
                    onClick={() => setActiveSource(source)}
                    className={`px-3 py-2 rounded-full border text-[11px] transition-all ${activeSource === source ? 'border-bit-accent bg-bit-accent/10 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-bit-accent/40'}`}
                  >
                    {source} ({count})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-gray-500 mb-3">Category</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-2 rounded-full border text-[11px] transition-all ${activeCategory === 'all' ? 'border-bit-accent bg-bit-accent/10 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-bit-accent/40'}`}
                >
                  All Categories
                </button>
                {availableCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-2 rounded-full border text-[11px] transition-all ${activeCategory === category ? 'border-bit-accent bg-bit-accent/10 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-bit-accent/40'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {isSearching ? (
        <div className="animate-fade-in">
          <SearchInsightSkeleton />
          <BookGridSkeleton count={8} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 mb-24">
          {filteredResults.length > 0 ? (
            filteredResults.map((book) => (
              <div key={book.id} className="relative group">
                {book.source === 'neural' && (
                  <div className="absolute -top-3 -right-3 z-20 px-2 py-1 bg-bit-accent text-black text-[8px] font-bold font-mono rounded rounded-bl-none shadow-[0_0_15px_rgba(255,77,0,0.4)] transition-transform group-hover:scale-110">
                    NEURAL
                  </div>
                )}
                <BookCard book={book} onClick={onBookClick} onRead={onRead} onAuthorClick={onAuthorClick} />
              </div>
            ))
          ) : (
            <div className="col-span-full py-40 text-center">
              <Zap className="mx-auto text-gray-800 mb-6" size={48} />
              <p className="text-gray-600 font-mono text-xs uppercase tracking-[0.3em]">
                {searchResults.length > 0 ? 'No books match the active filters.' : 'Neural link severed. No results found.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
