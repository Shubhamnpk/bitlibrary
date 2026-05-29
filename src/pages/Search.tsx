import React, { useEffect, useRef, useState } from 'react';
import { Audiobook, Book } from '@/types/index';
import { searchBooksInGutendex, searchGoogleBooks, searchITBooks, searchOpenLibrary, searchInternetArchive } from '@/services/bookService';
import { searchAudiobooks } from '@/services/audiobookService';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { useSearchParams } from 'react-router-dom';
import { BookOpenText, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Mic, Search, SlidersHorizontal, Sparkles, SpellCheck, Volume2, Zap } from 'lucide-react';
import { fetchDictionaryEntries, getDictionaryLanguageForQuery, type DictionaryEntry, type DictionaryLanguage } from '@/services/dictionaryLookupService';
import type { EnglishSpellcheckResult } from '@/services/englishSpellcheckService';
import type { NepaliSpellcheckResult } from '@/services/nepaliSpellcheckService';
import {
  getAudiobookSearchScore,
  getBookSearchScore,
  isAudioBookResource,
  isReadableSearchBook,
  mergeUniqueBooks,
  rankAudiobooks,
  rankBooks,
  searchYoBookBooksSmart,
} from '@/lib/searchOptimization';

export const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_KEY = 'bitlibrary-search-cache-v5';
const SEARCH_CACHE_TTL = 15 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 20;
const SEARCH_MAX_RESULTS = 100;
const SEARCH_PAGE_SIZE = 24;
const DEVANAGARI_QUERY_PATTERN = /[\u0900-\u097F]/u;
const ENGLISH_QUERY_PATTERN = /^[A-Za-z][A-Za-z' -]*$/;

const formatResultCount = (count: number) => new Intl.NumberFormat('en').format(count);

const formatResultLabel = (count: number, label: string) => (
  `${formatResultCount(count)} ${label}${count === 1 ? '' : 's'}`
);

const getSpellcheckLanguageForQuery = (query: string): DictionaryLanguage | null => {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (DEVANAGARI_QUERY_PATTERN.test(trimmed)) return 'nepali';
  if (ENGLISH_QUERY_PATTERN.test(trimmed)) return 'english';
  return null;
};

interface SearchCacheEntry {
  results: Book[];
  timestamp: number;
}

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
  const [activeSource, setActiveSource] = useState<'all' | Book['source'] | Audiobook['source']>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [mobileSearchDraft, setMobileSearchDraft] = useState('');
  const [speechListening, setSpeechListening] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryError, setDictionaryError] = useState('');
  const [dictionaryEntries, setDictionaryEntries] = useState<DictionaryEntry[]>([]);
  const [englishSpellcheckResult, setEnglishSpellcheckResult] = useState<EnglishSpellcheckResult | null>(null);
  const [englishSpellcheckLoading, setEnglishSpellcheckLoading] = useState(false);
  const [nepaliSpellcheckResult, setNepaliSpellcheckResult] = useState<NepaliSpellcheckResult | null>(null);
  const [nepaliSpellcheckLoading, setNepaliSpellcheckLoading] = useState(false);
  const dictionaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
        const limitedCachedResults = cachedResults.filter(isReadableSearchBook).slice(0, SEARCH_MAX_RESULTS);
        setSearchResults(limitedCachedResults);
        onResultsChange(limitedCachedResults);
      }

      setIsSearching(true);
      onSearchingChange(true);

      const updateResults = (newBooks: Book[]) => {
        if (activeSearchRequestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setSearchResults((prev) => {
          const merged = mergeUniqueBooks(prev, newBooks.filter((book) => !isAudioBookResource(book) && isReadableSearchBook(book)));
          return rankBooks(merged, query).slice(0, SEARCH_MAX_RESULTS);
        });
      };
      const updateAudiobookResults = (newAudiobooks: Audiobook[]) => {
        if (activeSearchRequestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setAudiobookResults(rankAudiobooks(newAudiobooks, query).slice(0, SEARCH_MAX_RESULTS));
      };

      // 1. Concurrent Independent Streaming Fetches
      setAudiobookResults([]);
      const searchTasks = [
        searchYoBookBooksSmart(query, controller.signal).then(updateResults),
        searchBooksInGutendex(query, controller.signal).then(updateResults),
        searchGoogleBooks(query, controller.signal).then(updateResults),
        searchOpenLibrary(query, controller.signal).then(updateResults),
        // Secondary sources
        searchITBooks(query, controller.signal).then(updateResults),
        searchInternetArchive(query, controller.signal).then(updateResults),
        searchAudiobooks(query, 24).then(updateAudiobookResults),
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
  const dictionaryLanguage = getDictionaryLanguageForQuery(currentQuery);
  const spellcheckLanguage = getSpellcheckLanguageForQuery(currentQuery);
  const canLookupDictionary = dictionaryLanguage !== null;
  const availableSources = Array.from(new Set([
    ...searchResults.map((book) => book.source).filter(Boolean),
    ...audiobookResults.map((audiobook) => audiobook.source).filter(Boolean),
  ])) as Array<Book['source'] | Audiobook['source']>;
  const availableCategories = Array.from(new Set([
    ...searchResults.map((book) => book.category).filter(Boolean),
    ...audiobookResults.flatMap((audiobook) => audiobook.genres).filter(Boolean),
  ])).slice(0, 8);
  const filteredResults = searchResults.filter((book) => {
    if (!isReadableSearchBook(book)) return false;
    const matchesSource = activeSource === 'all' || book.source === activeSource;
    const matchesCategory = activeCategory === 'all' || book.category === activeCategory;
    return matchesSource && matchesCategory;
  });
  const filteredAudiobooks = audiobookResults.filter((audiobook) => {
    const matchesSource = activeSource === 'all' || audiobook.source === activeSource;
    const matchesCategory = activeCategory === 'all' || audiobook.genres.includes(activeCategory);
    return matchesSource && matchesCategory;
  });
  const mixedResults = [
    ...(activeType === 'all' || activeType === 'books'
      ? filteredResults.map((book) => ({ type: 'book' as const, id: `book-${book.id}`, item: book }))
      : []),
    ...(activeType === 'all' || activeType === 'audiobooks'
      ? filteredAudiobooks.map((audiobook) => ({ type: 'audiobook' as const, id: `audio-${audiobook.id}`, item: audiobook }))
      : []),
  ].sort((a, b) => {
    const scoreA = a.type === 'book' ? getBookSearchScore(a.item, currentQuery) : getAudiobookSearchScore(a.item, currentQuery);
    const scoreB = b.type === 'book' ? getBookSearchScore(b.item, currentQuery) : getAudiobookSearchScore(b.item, currentQuery);
    return scoreB - scoreA;
  }).slice(0, SEARCH_MAX_RESULTS);
  const sourceCounts = availableSources.map((source) => ({
    source,
    count: searchResults.filter((book) => book.source === source).length
      + audiobookResults.filter((audiobook) => audiobook.source === source).length,
  }));
  const quickTopics = Array.from(new Set([...recentSearches, 'Mathematics', 'Grade 10', 'Nepali Stories', 'Science', 'Philosophy', 'Machine Learning'])).slice(0, 6);

  useEffect(() => {
    setActiveType('all');
    setActiveSource('all');
    setActiveCategory('all');
    setShowFilters(false);
    setDictionaryOpen(false);
    setDictionaryLoading(false);
    setDictionaryError('');
    setDictionaryEntries([]);
    setEnglishSpellcheckResult(null);
    setEnglishSpellcheckLoading(false);
    setNepaliSpellcheckResult(null);
    setNepaliSpellcheckLoading(false);
    setCurrentPage(1);
    setMobileSearchDraft(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    if (!isQueryReady || spellcheckLanguage !== 'english') {
      setEnglishSpellcheckResult(null);
      setEnglishSpellcheckLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setEnglishSpellcheckLoading(true);
      import('@/services/englishSpellcheckService')
        .then(({ checkEnglishSpelling }) => checkEnglishSpelling(currentQuery))
        .then((result) => {
          if (!cancelled) setEnglishSpellcheckResult(result);
        })
        .catch(() => {
          if (!cancelled) setEnglishSpellcheckResult(null);
        })
        .finally(() => {
          if (!cancelled) setEnglishSpellcheckLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentQuery, isQueryReady, spellcheckLanguage]);

  useEffect(() => {
    if (!isQueryReady || spellcheckLanguage !== 'nepali') {
      setNepaliSpellcheckResult(null);
      setNepaliSpellcheckLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setNepaliSpellcheckLoading(true);
      import('@/services/nepaliSpellcheckService')
        .then(({ checkNepaliSpelling }) => checkNepaliSpelling(currentQuery))
        .then((result) => {
          if (!cancelled) setNepaliSpellcheckResult(result);
        })
        .catch(() => {
          if (!cancelled) setNepaliSpellcheckResult(null);
        })
        .finally(() => {
          if (!cancelled) setNepaliSpellcheckLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentQuery, isQueryReady, spellcheckLanguage]);

  useEffect(() => () => {
    dictionaryAudioRef.current?.pause();
  }, []);

  const handleMobileSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = mobileSearchDraft.trim();
    if (query.length < SEARCH_MIN_QUERY_LENGTH) return;
    onQuickSearch(query);
  };

  const handleSpeechSearch = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || speechListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = spellcheckLanguage === 'nepali' ? 'ne-NP' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setSpeechListening(true);
    recognition.onend = () => setSpeechListening(false);
    recognition.onerror = () => setSpeechListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (transcript.length < SEARCH_MIN_QUERY_LENGTH) return;
      setMobileSearchDraft(transcript);
      onQuickSearch(transcript);
    };
    recognition.start();
  };

  const handleDictionaryLookup = async () => {
    if (!canLookupDictionary) return;

    const controller = new AbortController();
    setDictionaryOpen(true);
    setDictionaryLoading(true);
    setDictionaryError('');

    try {
      setDictionaryEntries(await fetchDictionaryEntries(currentQuery, controller.signal));
    } catch {
      setDictionaryError('Definition lookup is unavailable right now.');
      setDictionaryEntries([]);
    } finally {
      setDictionaryLoading(false);
    }
  };

  const playDictionaryAudio = (audioUrl: string) => {
    dictionaryAudioRef.current?.pause();
    dictionaryAudioRef.current = new Audio(audioUrl);
    void dictionaryAudioRef.current.play();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeType, activeSource, activeCategory]);

  const hasActiveFilters = activeType !== 'all' || activeSource !== 'all' || activeCategory !== 'all';
  const shouldShowFilters = showFilters || hasActiveFilters;
  const totalResultCount = searchResults.length + audiobookResults.length;
  const totalFilteredCount = mixedResults.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / SEARCH_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * SEARCH_PAGE_SIZE;
  const paginatedResults = mixedResults.slice(pageStart, pageStart + SEARCH_PAGE_SIZE);
  const featuredResult = safeCurrentPage === 1 ? paginatedResults[0] : undefined;
  const regularResults = safeCurrentPage === 1 ? paginatedResults.slice(1) : paginatedResults;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeSpellcheckResult = spellcheckLanguage === 'english' ? englishSpellcheckResult : nepaliSpellcheckResult;
  const activeSpellcheckLoading = spellcheckLanguage === 'english' ? englishSpellcheckLoading : nepaliSpellcheckLoading;
  const spellingIssues = activeSpellcheckResult?.issues || [];
  const fullyCorrectedQuery = spellingIssues.reduce((query, issue) => (
    issue.suggestions[0] ? query.replaceAll(issue.word, issue.suggestions[0]) : query
  ), currentQuery);
  const spellingSuggestions = Array.from(new Map(
    [
      ...(fullyCorrectedQuery !== currentQuery ? [{
        issueWord: '',
        suggestion: fullyCorrectedQuery,
        query: fullyCorrectedQuery,
      }] : []),
      ...spellingIssues.flatMap((issue) => issue.suggestions.map((suggestion) => ({
        issueWord: issue.word,
        suggestion,
        query: currentQuery.replaceAll(issue.word, suggestion),
      }))),
    ]
      .filter((item) => item.suggestion.trim() && item.query.trim() !== currentQuery)
      .map((item) => [item.query, item])
  ).values()).slice(0, 6);

  const spellingSuggestionPanel = (spellcheckLanguage && (activeSpellcheckLoading || spellingSuggestions.length > 0)) ? (
    <div className="border-t border-bit-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted">
          {activeSpellcheckLoading ? <Loader2 size={13} className="animate-spin text-bit-accent" /> : <SpellCheck size={13} className="text-bit-accent" />}
          Did you mean
        </span>
        {spellingSuggestions.map(({ issueWord, suggestion, query }) => (
          <button
            key={`${issueWord}-${suggestion}-${query}`}
            type="button"
            onClick={() => onQuickSearch(query)}
            className="rounded-full border border-bit-accent/20 bg-bit-accent/10 px-3 py-1.5 text-xs font-medium text-bit-accent transition-all hover:bg-bit-accent hover:text-white"
            title={`Replace ${issueWord} with ${suggestion}`}
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const dictionaryPanel = dictionaryOpen ? (
    <div className="border-t border-bit-border pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">Dictionary</p>
          <h3 className="mt-2 text-lg font-display font-bold leading-tight text-bit-text sm:text-2xl">Definition for "{currentQuery}"</h3>
        </div>
        <button
          type="button"
          onClick={() => setDictionaryOpen(false)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bit-muted transition-colors hover:bg-bit-panel/50 hover:text-bit-accent"
          aria-label="Collapse dictionary result"
          title="Collapse"
        >
          <ChevronUp size={17} />
        </button>
      </div>

      <div className="mt-5">
        {dictionaryError ? (
          <p className="text-sm leading-7 text-red-400">{dictionaryError}</p>
        ) : dictionaryLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-bit-muted">
            <Loader2 size={18} className="animate-spin text-bit-accent" />
            Looking up definition...
          </div>
        ) : dictionaryEntries.length === 0 ? (
          <div className="flex min-h-28 flex-col justify-center border border-dashed border-bit-border px-4 py-8 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">No definition found</p>
            <p className="mt-2 text-sm leading-7 text-bit-muted">Try another English word or Nepali word in Devanagari script.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dictionaryEntries.slice(0, 2).map((entry, entryIndex) => (
              <article key={`${entry.word}-${entryIndex}`} className={entryIndex > 0 ? 'border-t border-bit-border pt-6' : ''}>
                <div className="flex items-center gap-2">
                  <h4 className="text-2xl font-display font-bold text-bit-text">{entry.word}</h4>
                  {entry.audio && (
                    <button
                      type="button"
                      onClick={() => playDictionaryAudio(entry.audio as string)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bit-muted transition-colors hover:bg-bit-panel/50 hover:text-bit-accent"
                      aria-label={`Play pronunciation for ${entry.word}`}
                      title="Play pronunciation"
                    >
                      <Volume2 size={15} />
                    </button>
                  )}
                </div>
                {entry.phonetic && <p className="mt-1 text-sm text-bit-muted">{entry.phonetic}</p>}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {entry.meanings.slice(0, 4).map((meaning) => (
                    <section key={meaning.partOfSpeech} className="border-t border-bit-border/70 pt-4">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">{meaning.partOfSpeech}</p>
                      <ol className="mt-3 space-y-3">
                        {meaning.definitions.slice(0, 2).map((definition, index) => (
                          <li key={`${definition.definition}-${index}`} className="text-sm leading-7 text-bit-muted">
                            <span className="mr-2 font-mono text-[10px] text-bit-accent">{index + 1}.</span>
                            <span className="text-bit-text">{definition.definition}</span>
                            {definition.example && (
                              <p className="mt-1 pl-6 text-xs italic leading-6 text-bit-muted">"{definition.example}"</p>
                            )}
                            {meaning.etymology && (
                              <p className="mt-1 pl-6 text-xs leading-6 text-bit-muted">Origin: {meaning.etymology}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const renderResultCard = (
    result: typeof mixedResults[number],
    index: number,
    options: { bestMatch?: boolean } = {},
  ) => (
    result.type === 'audiobook' ? (
      <div
        key={result.id}
        className="relative h-full animate-fade-in-up"
        style={{ animationDelay: `${(index % 8) * 40}ms` }}
      >
        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
          Audio
        </div>
        {options.bestMatch && (
          <div className="absolute -top-3 right-2 z-30 inline-flex items-center gap-1 rounded-full border border-bit-accent/30 bg-bit-panel/95 px-2.5 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm backdrop-blur">
            <Sparkles size={10} />
            Best
          </div>
        )}
        <AudiobookCard
          audiobook={result.item}
          onClick={onAudiobookClick}
          variant="compact"
          searchQuery={currentQuery}
        />
      </div>
    ) : (
      <div
        key={result.id}
        className="relative h-full animate-fade-in-up group"
        style={{ animationDelay: `${(index % 8) * 40}ms` }}
      >
        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-panel px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm border border-bit-border">
          Book
        </div>
        {options.bestMatch && (
          <div className="absolute -top-3 right-2 z-30 inline-flex items-center gap-1 rounded-full border border-bit-accent/30 bg-bit-panel/95 px-2.5 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm backdrop-blur">
            <Sparkles size={10} />
            Best
          </div>
        )}
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
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-12 space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/30 p-5 shadow-sm md:rounded-[2rem] md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--bit-accent-rgb),0.08),transparent_42%)] pointer-events-none" />
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-bit-accent/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent mb-4 font-bold">Search</p>
                <h2 className="text-2xl leading-tight sm:text-3xl md:text-5xl font-display font-bold text-bit-text tracking-tighter">
                  {isQueryReady ? `Results for "${currentQuery}"` : 'Search books and audiobooks'}
                </h2>
                <form onSubmit={handleMobileSearchSubmit} className="mt-5 flex items-center gap-2 rounded-2xl border border-bit-border bg-bit-bg/55 p-2 shadow-sm md:hidden">
                  <Search size={17} className="ml-2 shrink-0 text-bit-accent" />
                  <input
                    type="search"
                    value={mobileSearchDraft}
                    onChange={(event) => setMobileSearchDraft(event.target.value)}
                    placeholder="Search books..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-bit-text placeholder:text-bit-muted/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSpeechSearch}
                    className={`h-9 w-9 shrink-0 rounded-xl border border-bit-border text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent ${speechListening ? 'bg-bit-accent text-white hover:text-white' : 'bg-bit-panel/35'}`}
                    aria-label="Search by voice"
                    title="Search by voice"
                  >
                    <Mic size={15} className="mx-auto" />
                  </button>
                  <button
                    type="submit"
                    disabled={mobileSearchDraft.trim().length < SEARCH_MIN_QUERY_LENGTH}
                    className="h-9 shrink-0 rounded-xl bg-bit-accent px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Go
                  </button>
                </form>
                {isQueryReady && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-bit-muted">
                    {isSearching && totalResultCount === 0 ? (
                      <span>Searching across connected libraries...</span>
                    ) : totalResultCount > 0 ? (
                      <>
                        <span>
                          Showing {formatResultLabel(totalFilteredCount, 'result')}
                          {hasActiveFilters ? ` from ${formatResultLabel(totalResultCount, 'match')}` : ''}
                        </span>
                        {isSearching && (
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-bit-accent">
                            Updating
                          </span>
                        )}
                      </>
                    ) : (
                      <span>No results found yet</span>
                    )}
                  </div>
                )}
                {isQueryReady && (canLookupDictionary || totalResultCount > 0) && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {canLookupDictionary && (
                      <button
                        type="button"
                        onClick={dictionaryOpen ? () => setDictionaryOpen(false) : handleDictionaryLookup}
                        disabled={dictionaryLoading && !dictionaryOpen}
                        className="inline-flex items-center gap-2 rounded-full border border-bit-accent/25 bg-bit-accent/10 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-accent transition-all hover:bg-bit-accent hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {dictionaryLoading ? <Loader2 size={14} className="animate-spin" /> : <BookOpenText size={14} />}
                        {dictionaryOpen ? 'Hide definition' : `${dictionaryLanguage === 'nepali' ? 'Search' : 'Define'} "${currentQuery}"`}
                      </button>
                    )}
                    {totalResultCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/40 hover:bg-bit-accent/10 hover:text-bit-text"
                      >
                        <SlidersHorizontal size={14} className="text-bit-accent" />
                        <span>Filters</span>
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-300 ${shouldShowFilters ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {spellingSuggestionPanel}
            {dictionaryPanel}
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
                BitLibrary checks the YoBook catalog first, then widens to open archives when needed. Try a title, grade, subject, source, or language.
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
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Mathematics"</p>
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Grade 8 Science"</p>
                <p className="flex items-center gap-2"><ChevronRight size={12} className="text-bit-accent" /> "Nepali Stories"</p>
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
                {featuredResult && (
                  <div className="mb-10 hidden sm:block">
                    {featuredResult.type === 'audiobook' ? (
                      <div className="relative h-full w-full max-w-[12rem] animate-fade-in-up">
                        <div className="pointer-events-none absolute -inset-2 rounded-2xl border border-bit-accent/20 bg-bit-accent/[0.035]" />
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
                          Audio
                        </div>
                        <div className="absolute -top-3 right-2 z-30 inline-flex items-center gap-1 rounded-full border border-bit-accent/30 bg-bit-panel/95 px-2.5 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm backdrop-blur">
                          <Sparkles size={10} />
                          Best match
                        </div>
                        <AudiobookCard
                          audiobook={featuredResult.item}
                          onClick={onAudiobookClick}
                          variant="compact"
                          searchQuery={currentQuery}
                        />
                      </div>
                    ) : (
                      <div className="relative h-full w-full max-w-[12rem] animate-fade-in-up group">
                        <div className="pointer-events-none absolute -inset-2 rounded-2xl border border-bit-accent/20 bg-bit-accent/[0.035]" />
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-panel px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm border border-bit-border">
                          Book
                        </div>
                        <div className="absolute -top-3 right-2 z-30 inline-flex items-center gap-1 rounded-full border border-bit-accent/30 bg-bit-panel/95 px-2.5 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-bit-accent shadow-sm backdrop-blur">
                          <Sparkles size={10} />
                          Best match
                        </div>
                        {featuredResult.item.source === 'neural' && (
                          <div className="absolute right-2 top-5 z-20 px-2 py-1 bg-bit-accent text-white text-[8px] font-bold font-mono rounded rounded-bl-none shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.4)] transition-transform group-hover:scale-110">
                            NEURAL
                          </div>
                        )}
                        <BookCard
                          variant="compact"
                          book={featuredResult.item}
                          onClick={onBookClick}
                          onRead={onRead}
                          onAuthorClick={onAuthorClick}
                          searchQuery={currentQuery}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="bit-card-grid sm:hidden">
                  {paginatedResults.map((result, index) => renderResultCard(result, index, { bestMatch: safeCurrentPage === 1 && index === 0 }))}
                </div>
                <div className="hidden sm:grid bit-card-grid">
                  {regularResults.map((result, index) => renderResultCard(result, index))}
                </div>
                {totalFilteredCount > SEARCH_PAGE_SIZE && (
                  <div className="mt-10 flex flex-col gap-4 border-t border-bit-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
                      Showing {pageStart + 1}-{Math.min(pageStart + SEARCH_PAGE_SIZE, totalFilteredCount)} of {totalFilteredCount}
                      {totalFilteredCount === SEARCH_MAX_RESULTS ? ' max results' : ' results'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Previous search results page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, index) => index + 1)
                          .filter((page) => (
                            page === 1
                            || page === totalPages
                            || Math.abs(page - safeCurrentPage) <= 1
                          ))
                          .map((page, index, pages) => {
                            const previousPage = pages[index - 1];
                            const showGap = previousPage && page - previousPage > 1;

                            return (
                              <React.Fragment key={page}>
                                {showGap && (
                                  <span className="px-1 text-[10px] font-mono text-bit-muted">...</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage(page)}
                                  className={`h-9 min-w-9 rounded-full border px-3 text-[10px] font-mono font-bold transition-all ${safeCurrentPage === page ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/40 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
                                  aria-current={safeCurrentPage === page ? 'page' : undefined}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Next search results page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
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
