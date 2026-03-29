import React, { useEffect, useRef, useState } from 'react';
import { Book } from '@/types/index';
import { searchBooksWithGemini, generateSearchInsights } from '@/services/geminiService';
import { searchBooksInGutendex, searchGoogleBooks, searchITBooks, searchOpenLibrary, searchInternetArchive } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton, SearchInsightSkeleton } from '@/components/Skeletons';
import { useSearchParams } from 'react-router-dom';
import { Zap } from 'lucide-react';

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
}

const SearchPage: React.FC<SearchPageProps> = ({
  onBookClick,
  onRead,
  onAuthorClick,
  onResultsChange,
  onSearchingChange,
  onQuerySync,
}) => {
  const [searchParams] = useSearchParams();
  const [searchAIAnalysis, setSearchAIAnalysis] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
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

  return (
    <div className="animate-fade-in">
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8 mb-8">
          <div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tighter">
              {isSearching ? <span className="animate-pulse tracking-widest text-bit-accent text-3xl">SCANNING_GRID...</span> : `Sector Results: ${searchResults.length}`}
            </h2>
            <p className="text-xs text-gray-600 font-mono mt-2 uppercase tracking-[0.4em]">Archival_Link: {currentQuery.toUpperCase() || 'NULL'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bit-accent/5 border border-bit-accent/20 text-[8px] font-mono text-bit-accent">
              <Zap size={10} className="animate-pulse" /> NEURAL_SEARCH_ACTIVE
            </div>
          </div>
        </div>

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
      </div>

      {isSearching ? (
        <div className="animate-fade-in">
          <SearchInsightSkeleton />
          <BookGridSkeleton count={8} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 mb-24">
          {searchResults.length > 0 ? (
            searchResults.map((book) => (
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
              <p className="text-gray-600 font-mono text-xs uppercase tracking-[0.3em]">Neural link severed. No results found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
