import React, { useEffect, useRef, useState } from 'react';
import { Audiobook, Book } from '@/types/index';
import { fetchBooksFromYoBook, searchBooksInGutendex, searchGoogleBooks, searchITBooks, searchOpenLibrary, searchInternetArchive, searchYoBookBooks } from '@/services/bookService';
import { searchAudiobooks } from '@/services/audiobookService';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';

export const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_KEY = 'bitlibrary-search-cache-v4';
const SEARCH_CACHE_TTL = 15 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 20;

const SUBJECT_ALIASES: Record<string, string> = {
  algebra: 'mathematics',
  arithmetic: 'mathematics',
  biology: 'science',
  chemistry: 'science',
  englishs: 'english',
  environment: 'science',
  gk: 'social studies',
  hamro: 'hamro serofero',
  mathematic: 'mathematics',
  mathematics: 'mathematics',
  math: 'mathematics',
  maths: 'mathematics',
  english: 'english',
  nepali: 'nepali',
  neplai: 'nepali',
  physics: 'science',
  sciece: 'science',
  scince: 'science',
  science: 'science',
  sience: 'science',
  social: 'social studies',
  socials: 'social studies',
  society: 'social studies',
  health: 'health',
  serofero: 'hamro serofero',
};

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  tin: '10',
  eleven: '11',
  twelve: '12',
};

const SEARCH_STOP_WORDS = new Set([
  'book',
  'books',
  'textbook',
  'textbooks',
  'subject',
  'subjects',
  'the',
  'a',
  'an',
  'of',
  'for',
  'in',
  'and',
  'only',
]);

const GRADE_HINT_WORDS = new Set(['class', 'grade', 'standard', 'std', 'clas', 'clss', 'klass', 'grad', 'garde']);
const SUBJECT_CANONICALS = Array.from(new Set(Object.values(SUBJECT_ALIASES)));

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

const normalizeForSearch = (value: string) => (
  value
    .toLowerCase()
    .replace(/\b(clas|clss|klass)\b/g, 'class')
    .replace(/\b(grad|garde)\b/g, 'grade')
    .replace(/\b(class|grade|standard|std)\s+(one|two|three|four|five|six|seven|eight|nine|ten|tin|eleven|twelve)\b/g, (_, prefix, word) => `${prefix} ${NUMBER_WORDS[word]}`)
    .replace(/\b(1st|2nd|3rd|([4-9]|1[0-2])th)\b/g, (match) => match.replace(/\D/g, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmaths?\b/g, 'mathematics')
    .replace(/\b(sciece|scince|sience)\b/g, 'science')
    .replace(/\bsocial\b(?!\s+studies)/g, 'social studies')
    .replace(/\s+/g, ' ')
    .trim()
);

const tokenizeSearch = (value: string) => normalizeForSearch(value).split(' ').filter(Boolean);

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

const isFuzzyTokenMatch = (queryToken: string, candidateToken: string) => {
  if (queryToken === candidateToken) return true;
  if (queryToken.length <= 2 || candidateToken.length <= 2) return false;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return true;

  const distance = levenshteinDistance(queryToken, candidateToken);
  const maxDistance = queryToken.length >= 8 || candidateToken.length >= 8 ? 2 : 1;
  return distance <= maxDistance;
};

const countFuzzyTokenMatches = (queryTokens: string[], candidateText: string) => {
  const candidateTokens = tokenizeSearch(candidateText);
  const usefulQueryTokens = queryTokens.filter((token) => !SEARCH_STOP_WORDS.has(token));

  return usefulQueryTokens.filter((queryToken) => {
    const canonicalToken = SUBJECT_ALIASES[queryToken] || queryToken;
    return candidateTokens.some((candidateToken) => isFuzzyTokenMatch(canonicalToken, SUBJECT_ALIASES[candidateToken] || candidateToken));
  }).length;
};

const findSubjectIntent = (tokens: string[], normalized: string) => {
  const direct = Object.entries(SUBJECT_ALIASES).find(([alias, canonical]) => (
    tokens.includes(alias) || normalized.includes(canonical)
  ))?.[1];
  if (direct) return direct;

  return SUBJECT_CANONICALS.find((subject) => (
    subject.split(' ').every((subjectToken) => tokens.some((token) => isFuzzyTokenMatch(token, subjectToken)))
  ));
};

const findGradeIntent = (tokens: string[], normalized: string) => {
  const explicitGradeMatch = normalized.match(/\b(?:class|grade|standard|std)\s*(\d{1,2})\b/);
  if (explicitGradeMatch) return Number(explicitGradeMatch[1]);

  const hintedNumber = tokens.find((token, index) => (
    /^\d{1,2}$/.test(token)
    && (
      GRADE_HINT_WORDS.has(tokens[index - 1])
      || GRADE_HINT_WORDS.has(tokens[index + 1])
      || tokens.some((candidate) => GRADE_HINT_WORDS.has(candidate))
    )
  ));
  if (hintedNumber) return Number(hintedNumber);

  return undefined;
};

const getSearchIntent = (query: string) => {
  const normalized = normalizeForSearch(query);
  const tokens = normalized.split(' ').filter(Boolean);
  const subject = findSubjectIntent(tokens, normalized);
  const grade = findGradeIntent(tokens, normalized);
  const canonicalQuery = [grade ? `grade ${grade}` : '', subject || '', tokens.filter((token) => !GRADE_HINT_WORDS.has(token) && token !== String(grade) && !SEARCH_STOP_WORDS.has(token)).join(' ')]
    .filter(Boolean)
    .join(' ');

  return {
    normalized,
    tokens,
    grade: grade && grade >= 1 && grade <= 12 ? grade : undefined,
    subject,
    canonicalQuery: normalizeForSearch(canonicalQuery || query),
  };
};

const buildYoBookSearchVariants = (query: string): string[] => {
  const intent = getSearchIntent(query);
  const variants = new Set([query, intent.normalized, intent.canonicalQuery]);

  if (intent.grade) {
    variants.add(`Class ${intent.grade}`);
    variants.add(`Grade ${intent.grade}`);
  }

  if (intent.subject) {
    variants.add(intent.subject);
    if (intent.grade) {
      variants.add(`Class ${intent.grade} ${intent.subject}`);
      variants.add(`${intent.subject} Grade ${intent.grade}`);
    }
  }

  intent.tokens.forEach((token) => {
    const alias = SUBJECT_ALIASES[token];
    if (alias) variants.add(alias);
  });

  return Array.from(variants).map((item) => item.trim()).filter(Boolean);
};

const searchYoBookBooksSmart = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const intent = getSearchIntent(query);
  const variantSearches = buildYoBookSearchVariants(query).slice(0, 6).map((variant) => searchYoBookBooks(variant, signal));
  const gradeSearch = intent.grade ? [fetchBooksFromYoBook(1, `Class ${intent.grade}`, signal).then((result) => result.books)] : [];
  const results = await Promise.allSettled([...variantSearches, ...gradeSearch]);

  return mergeUniqueBooks(...results.map((result) => result.status === 'fulfilled' ? result.value : []));
};

const isAudioBookResource = (book: Book) => (
  Boolean(book.audioUrl)
  || book.providerSource === 'cehrd-audio'
  || /audio/i.test(book.category)
  || book.subjects?.some((subject) => /audio|drama|listening/i.test(subject))
);

const getBookSearchScore = (book: Book, query: string): number => {
  const intent = getSearchIntent(query);
  const title = normalizeForSearch(toSearchableText(book.title));
  const desc = normalizeForSearch(toSearchableText(book.description));
  const author = normalizeForSearch(toSearchableText(book.author));
  const category = normalizeForSearch(toSearchableText(book.category));
  const subjects = normalizeForSearch((book.subjects || []).map((subject) => toSearchableText(subject)).join(' '));
  const keywords = normalizeForSearch((book.keywords || []).join(' '));
  const shelves = normalizeForSearch((book.bookshelves || []).join(' '));
  const haystack = normalizeForSearch([title, author, category, subjects, keywords, shelves, desc, book.grade ? `class ${book.grade} grade ${book.grade}` : ''].join(' '));

  let weight = 0;

  if (title === intent.normalized || title === intent.canonicalQuery) weight += 20000;
  if (title.startsWith(intent.normalized) || title.startsWith(intent.canonicalQuery)) weight += 9000;
  if (title.includes(intent.normalized) || title.includes(intent.canonicalQuery)) weight += 4500;
  if (intent.subject && [title, category, subjects, keywords, shelves].some((field) => field.includes(intent.subject!))) weight += 9000;
  if (intent.grade && book.grade === intent.grade) weight += 6000;
  if (intent.grade && haystack.includes(`grade ${intent.grade}`)) weight += 2000;
  if (intent.grade && haystack.includes(`class ${intent.grade}`)) weight += 2000;
  if (intent.grade && book.source === 'YoBook' && !book.grade && !haystack.includes(`grade ${intent.grade}`) && !haystack.includes(`class ${intent.grade}`)) weight -= 9000;
  if (author.includes(intent.normalized)) weight += 800;
  if (category.includes(intent.normalized)) weight += 400;
  if (subjects.includes(intent.normalized)) weight += 300;
  if (keywords.includes(intent.normalized) || keywords.includes(intent.canonicalQuery)) weight += 4200;
  if (desc.includes(intent.normalized)) weight += 200;

  const tokens = Array.from(new Set([...intent.tokens, ...tokenizeSearch(intent.subject || '')])).filter((token) => !GRADE_HINT_WORDS.has(token) && !SEARCH_STOP_WORDS.has(token));
  const matchedTokens = tokens.filter((token) => haystack.includes(SUBJECT_ALIASES[token] || token));
  const fuzzyMatches = countFuzzyTokenMatches(tokens, haystack);
  const keywordFuzzyMatches = countFuzzyTokenMatches(tokens, keywords);
  weight += matchedTokens.length * 350;
  weight += fuzzyMatches * 450;
  weight += keywordFuzzyMatches * 900;
  if (tokens.length > 0 && matchedTokens.length === tokens.length) weight += 1200;
  if (tokens.length > 0 && fuzzyMatches === tokens.length) weight += 900;

  weight += Math.min(book.downloads || 0, 5000) / 25;
  weight += book.source === 'YoBook' ? 12000 : 0;
  weight += book.audioUrl ? 1500 : 0;
  weight += book.source === 'neural' ? 150 : 0;

  return weight;
};

const getAudiobookSearchScore = (audiobook: Audiobook, query: string): number => {
  const intent = getSearchIntent(query);
  const title = normalizeForSearch(audiobook.title);
  const author = normalizeForSearch(audiobook.author);
  const description = normalizeForSearch(audiobook.description);
  const genres = normalizeForSearch(audiobook.genres.join(' '));
  const haystack = normalizeForSearch([title, author, description, genres].join(' '));

  let weight = 0;
  if (title === intent.normalized || title === intent.canonicalQuery) weight += 24000;
  if (title.startsWith(intent.normalized) || title.startsWith(intent.canonicalQuery)) weight += 10000;
  if (title.includes(intent.normalized) || title.includes(intent.canonicalQuery)) weight += 6000;
  if (intent.subject && [title, genres, description].some((field) => field.includes(intent.subject!))) weight += 8000;
  if (intent.grade && haystack.includes(`grade ${intent.grade}`)) weight += 5000;
  if (intent.grade && haystack.includes(`class ${intent.grade}`)) weight += 5000;
  if (author.includes(intent.normalized)) weight += 900;

  const tokens = Array.from(new Set([...intent.tokens, ...tokenizeSearch(intent.subject || '')])).filter((token) => !GRADE_HINT_WORDS.has(token) && !SEARCH_STOP_WORDS.has(token));
  const matchedTokens = tokens.filter((token) => haystack.includes(SUBJECT_ALIASES[token] || token));
  const fuzzyMatches = countFuzzyTokenMatches(tokens, haystack);
  weight += matchedTokens.length * 400;
  weight += fuzzyMatches * 500;
  if (tokens.length > 0 && matchedTokens.length === tokens.length) weight += 1200;
  if (tokens.length > 0 && fuzzyMatches === tokens.length) weight += 900;
  weight += audiobook.source === 'YoBook' ? 50000 : 0;
  weight += Math.min(audiobook.numSections || 0, 50);

  return weight;
};

const rankBooks = (books: Book[], query: string): Book[] => {
  return [...books].sort((a, b) => getBookSearchScore(b, query) - getBookSearchScore(a, query));
};

const rankAudiobooks = (audiobooks: Audiobook[], query: string): Audiobook[] => {
  return [...audiobooks].sort((a, b) => getAudiobookSearchScore(b, query) - getAudiobookSearchScore(a, query));
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
  const [activeSource, setActiveSource] = useState<'all' | Book['source'] | Audiobook['source']>('all');
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
          const merged = mergeUniqueBooks(prev, newBooks.filter((book) => !isAudioBookResource(book)));
          return rankBooks(merged, query);
        });
      };
      const updateAudiobookResults = (newAudiobooks: Audiobook[]) => {
        if (activeSearchRequestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setAudiobookResults(rankAudiobooks(newAudiobooks, query));
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
        searchAudiobooks(query, 16).then(updateAudiobookResults),
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
    ...audiobookResults.map((audiobook) => audiobook.source).filter(Boolean),
  ])) as Array<Book['source'] | Audiobook['source']>;
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
  });
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
