import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, Database, FileDown, FileText, Filter, Loader2, Microscope, Search, X } from 'lucide-react';
import BookCard from '@/components/BookCard';
import Seo from '@/components/Seo';
import type { Book, ResourceFormat } from '@/types/index';
import { searchAcademicResearch } from '@/services/bookService';
import { recordRecentSearch } from '@/lib/local-user';

const RESEARCH_MIN_QUERY_LENGTH = 2;
const RESEARCH_CACHE_KEY = 'bitlibrary-research-cache-v1';
const RESEARCH_CACHE_TTL = 20 * 60 * 1000;
const RESEARCH_QUICK_TOPICS = ['climate adaptation', 'neural networks', 'public health', 'renewable energy', 'education policy', 'soil microbiome'];
const READABLE_FORMATS: ResourceFormat[] = ['pdf', 'xml', 'text', 'epub', 'package', 'audio', 'video'];

interface ResearchCacheEntry {
  results: Book[];
  timestamp: number;
}

interface ResearchPageProps {
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
  onResultsChange: (books: Book[]) => void;
}

const formatCount = (value: number) => new Intl.NumberFormat('en').format(value);

const getFormatIcon = (format: ResourceFormat) => {
  if (format === 'pdf') return FileDown;
  if (format === 'xml' || format === 'text') return FileText;
  return Database;
};

const getResearchCache = (): Record<string, ResearchCacheEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(RESEARCH_CACHE_KEY) || '{}') as Record<string, ResearchCacheEntry>;
  } catch {
    return {};
  }
};

const readResearchCache = (query: string): Book[] | null => {
  if (typeof window === 'undefined') return null;
  const key = query.trim().toLowerCase();
  const cache = getResearchCache();
  const entry = cache[key];
  if (!entry || Date.now() - entry.timestamp > RESEARCH_CACHE_TTL) return null;
  return entry.results || null;
};

const writeResearchCache = (query: string, results: Book[]) => {
  if (typeof window === 'undefined') return;
  try {
    const cache = getResearchCache();
    cache[query.trim().toLowerCase()] = { results, timestamp: Date.now() };
    const fresh = Object.fromEntries(
      Object.entries(cache)
        .filter(([, entry]) => Date.now() - entry.timestamp <= RESEARCH_CACHE_TTL)
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 16)
    );
    window.localStorage.setItem(RESEARCH_CACHE_KEY, JSON.stringify(fresh));
  } catch {
    // Network results still render when local storage is unavailable.
  }
};

const getResourceFormats = (book: Book) => (
  Array.from(new Set(
    (book.resourceLinks || [])
      .map((link) => link.format)
      .filter((format): format is ResourceFormat => READABLE_FORMATS.includes(format))
  ))
);

const ResearchPage: React.FC<ResearchPageProps> = ({ onBookClick, onRead, onResultsChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() || '';
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSource, setActiveSource] = useState('all');
  const [activeFormat, setActiveFormat] = useState<ResourceFormat | 'all'>('all');
  const requestRef = useRef(0);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (query.length < RESEARCH_MIN_QUERY_LENGTH) {
      requestRef.current += 1;
      setResults([]);
      setLoading(false);
      setError('');
      onResultsChange([]);
      return;
    }

    const cached = readResearchCache(query);
    if (cached) {
      setResults(cached);
      onResultsChange(cached);
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const nextResults = await searchAcademicResearch(query, controller.signal);
        if (requestRef.current !== requestId || controller.signal.aborted) return;
        setResults(nextResults);
        onResultsChange(nextResults);
        writeResearchCache(query, nextResults);
      } catch {
        if (requestRef.current === requestId && !controller.signal.aborted) {
          setError('Research search is unavailable right now.');
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [onResultsChange, query]);

  const sources = useMemo(() => (
    Array.from(new Set(results.map((book) => book.source).filter(Boolean))).sort() as string[]
  ), [results]);

  const formats = useMemo(() => (
    Array.from(new Set(results.flatMap(getResourceFormats))).sort() as ResourceFormat[]
  ), [results]);

  const filteredResults = useMemo(() => (
    results.filter((book) => {
      const matchesSource = activeSource === 'all' || book.source === activeSource;
      const matchesFormat = activeFormat === 'all' || getResourceFormats(book).includes(activeFormat);
      return matchesSource && matchesFormat;
    })
  ), [activeFormat, activeSource, results]);

  const resultStats = useMemo(() => ({
    readable: results.filter((book) => book.externalUrl || book.resourceLinks?.some((link) => link.embeddable !== false)).length,
    pdf: results.filter((book) => getResourceFormats(book).includes('pdf')).length,
    xml: results.filter((book) => getResourceFormats(book).includes('xml')).length,
  }), [results]);

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length < RESEARCH_MIN_QUERY_LENGTH) return;
    recordRecentSearch(trimmed);
    setSearchParams({ q: trimmed });
  };

  const openResource = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="animate-fade-in py-8 md:py-12">
      <Seo
        title="Research Search | BitLibrary"
        description="Search open academic resources, full text, PDFs, XML records, DOI metadata, datasets, and scholarly outputs in BitLibrary."
        canonicalPath="/research"
        keywords={['research search', 'open access papers', 'Europe PMC', 'PubMed Central', 'Crossref', 'OpenAlex']}
      />

      <section className="mb-8 border-b border-bit-border pb-8 md:mb-10 md:pb-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-bit-accent/25 bg-bit-accent/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">
              <Microscope size={13} />
              Research resources
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-bit-text md:text-5xl">
              Search scholarly full text.
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[25rem]">
            {[
              ['Results', results.length],
              ['Readable', resultStats.readable],
              ['PDF/XML', resultStats.pdf + resultStats.xml],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-bit-border bg-bit-panel/35 px-3 py-3">
                <p className="text-lg font-bold text-bit-text">{formatCount(Number(value))}</p>
                <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] text-bit-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-8 flex flex-col gap-3 rounded-xl border border-bit-border bg-bit-panel/30 p-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bit-muted" size={18} />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search papers, datasets, DOI titles, authors..."
              className="h-12 w-full rounded-lg border border-bit-border bg-bit-bg/55 pl-10 pr-10 text-sm text-bit-text outline-none transition-all placeholder:text-bit-muted/55 focus:border-bit-accent/45"
            />
            {draft && (
              <button
                type="button"
                onClick={() => setDraft('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-bit-muted transition-colors hover:text-bit-text"
                aria-label="Clear research query"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={draft.trim().length < RESEARCH_MIN_QUERY_LENGTH}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-bit-accent px-5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-white transition-all hover:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Search
          </button>
        </form>

        {!query && (
          <div className="mt-4 flex flex-wrap gap-2">
            {RESEARCH_QUICK_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  setDraft(topic);
                  recordRecentSearch(topic);
                  setSearchParams({ q: topic });
                }}
                className="rounded-full border border-bit-border bg-bit-panel/30 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-text"
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
            <Filter size={13} />
            Sources
          </span>
          {['all', ...sources].map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-all ${activeSource === source ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/35 hover:text-bit-text'}`}
            >
              {source}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...formats] as Array<ResourceFormat | 'all'>).map((format) => {
            const Icon = format === 'all' ? BookOpenText : getFormatIcon(format);
            return (
              <button
                key={format}
                type="button"
                onClick={() => setActiveFormat(format)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-all ${activeFormat === format ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/35 hover:text-bit-text'}`}
              >
                <Icon size={12} />
                {format}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && results.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-xl border border-bit-border bg-bit-panel/25" />
          ))}
        </div>
      ) : filteredResults.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="bit-card-grid">
            {filteredResults.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                variant="compact"
                onClick={onBookClick}
                onRead={onRead}
                searchQuery={query}
              />
            ))}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-bit-border bg-bit-panel/25 p-4">
              <p className="mb-4 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">Readable resources</p>
              <div className="space-y-3">
                {filteredResults.slice(0, 8).map((book) => {
                  const resources = (book.resourceLinks || [])
                    .filter((link) => READABLE_FORMATS.includes(link.format))
                    .slice(0, 3);
                  return (
                    <div key={book.id} className="border-b border-bit-border/50 pb-3 last:border-b-0 last:pb-0">
                      <p className="line-clamp-2 text-xs font-semibold text-bit-text">{book.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {resources.map((resource) => {
                          const Icon = getFormatIcon(resource.format);
                          return (
                            <button
                              key={`${book.id}-${resource.url}`}
                              type="button"
                              onClick={() => openResource(resource.url)}
                              className="inline-flex items-center gap-1 rounded-full border border-bit-border bg-bit-bg/55 px-2 py-1 text-[8px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
                            >
                              <Icon size={10} />
                              {resource.format}
                              <ArrowUpRight size={9} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-bit-border bg-bit-panel/20 px-5 py-14 text-center">
          <Microscope className="mx-auto mb-4 text-bit-accent" size={30} />
          <p className="font-display text-xl font-bold text-bit-text">
            {query ? 'No research resources match this search.' : 'Search for research resources.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ResearchPage;
