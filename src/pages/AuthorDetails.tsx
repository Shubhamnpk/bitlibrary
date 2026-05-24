import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book, Author } from '@/types/index';
import {
  searchBooksInGutendex,
  searchGoogleBooks,
  searchInternetArchive,
  searchITBooks,
  searchOpenLibrary,
  searchYoBookBooks,
} from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { ArrowLeft, User, Calendar, Zap, Info, Library } from 'lucide-react';
import Seo from '@/components/Seo';
import { createItemListSchema, toAbsoluteUrl, truncate } from '@/lib/seo';

const AUTHOR_PROVIDER_TIMEOUT_MS = 5500;

const normalizeAuthor = (value: string) => value
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const getAuthorSearchTerms = (authorName: string) => {
  const normalized = normalizeAuthor(authorName);
  const terms = [authorName];

  if (
    normalized.includes('centre for education and human resource development') ||
    normalized.includes('center for education and human resource development')
  ) {
    terms.push('CEHRD');
  }

  return terms.filter((term, index, list) => term && list.indexOf(term) === index);
};

const bookMatchesAuthor = (book: Book, authorName: string) => {
  const target = normalizeAuthor(authorName);
  const aliases = getAuthorSearchTerms(authorName).map(normalizeAuthor);
  const authorFields = [
    book.author,
    ...(book.authors || []).map((author) => author.name),
  ].filter(Boolean).map((value) => normalizeAuthor(String(value)));

  return authorFields.some((author) => (
    author.includes(target) ||
    target.includes(author) ||
    aliases.some((alias) => alias && (author.includes(alias) || alias.includes(author)))
  ));
};

const dedupeBooks = (books: Book[]) => books.filter((book, index, list) => (
  index === list.findIndex((entry) => entry.id === book.id)
));

const getSourcePriority = (book: Book) => {
  if (book.source === 'YoBook') return 0;
  if (book.source === 'Gutendex') return 1;
  if (book.source === 'Google Books') return 2;
  if (book.source === 'Open Library') return 3;
  if (book.source === 'IT Bookstore') return 4;
  return 5;
};

const rankAuthorBooks = (books: Book[]) => [...books].sort((a, b) => (
  getSourcePriority(a) - getSourcePriority(b) ||
  (b.downloads || b.popularity || 0) - (a.downloads || a.popularity || 0) ||
  a.title.localeCompare(b.title)
));

const getFirstMatchingAuthor = (books: Book[], authorName: string) => {
  const firstMatch = books.find((book) => book.authors?.some((author) => bookMatchesAuthor({ ...book, author: author.name, authors: [author] }, authorName)));
  return firstMatch?.authors?.find((author) => bookMatchesAuthor({ ...firstMatch, author: author.name, authors: [author] }, authorName)) || null;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const AuthorDetails: React.FC<{ onBookClick: (b: Book) => void }> = ({ onBookClick }) => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
  const authorName = name ? decodeURIComponent(name) : 'Unknown Author';

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setBooks([]);
    setAuthorInfo(null);

    const searchTerms = getAuthorSearchTerms(authorName);
    const archiveSearchTerms = [authorName];
    const searchAllTerms = (searcher: (query: string, signal?: AbortSignal) => Promise<Book[]>, terms = archiveSearchTerms) => (
      Promise.all(terms.map((term) => searcher(term, controller.signal))).then((results) => results.flat())
    );
    const providers = [
      { label: 'YoBook', run: () => searchAllTerms(searchYoBookBooks, searchTerms), timeout: 3500 },
      { label: 'Gutendex', run: () => searchAllTerms(searchBooksInGutendex), timeout: AUTHOR_PROVIDER_TIMEOUT_MS },
      { label: 'Google Books', run: () => searchAllTerms(searchGoogleBooks), timeout: AUTHOR_PROVIDER_TIMEOUT_MS },
      { label: 'Open Library', run: () => searchAllTerms(searchOpenLibrary), timeout: AUTHOR_PROVIDER_TIMEOUT_MS },
      { label: 'Internet Archive', run: () => searchAllTerms(searchInternetArchive), timeout: AUTHOR_PROVIDER_TIMEOUT_MS },
      { label: 'IT Bookstore', run: () => searchAllTerms(searchITBooks), timeout: AUTHOR_PROVIDER_TIMEOUT_MS },
    ];

    let completedProviders = 0;
    let foundAnyResults = false;
    let collectedBooks: Book[] = [];

    const finishProvider = () => {
      completedProviders += 1;
      if (!cancelled && completedProviders === providers.length && !foundAnyResults) {
        setLoading(false);
      }
    };

    providers.forEach((provider) => {
      void withTimeout(provider.run(), provider.timeout, [])
        .then((results) => {
          if (cancelled) return;
          const matchedResults = results.filter((book) => bookMatchesAuthor(book, authorName));
          if (matchedResults.length === 0) return;

          foundAnyResults = true;
          collectedBooks = rankAuthorBooks(dedupeBooks([...collectedBooks, ...matchedResults]));
          setBooks(collectedBooks);
          setAuthorInfo(getFirstMatchingAuthor(collectedBooks, authorName));
          setLoading(false);
        })
        .catch((error) => {
          if (!cancelled) console.warn(`[Author Sync] ${provider.label} skipped:`, error);
        })
        .finally(finishProvider);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [name, authorName]);

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
      <Seo
        title={`${authorName} Books and Works | BitLibrary Author Archive`}
        description={truncate(
          `Browse books, open archive records, public-domain editions, and related works by ${authorName} on BitLibrary.`,
          155
        )}
        canonicalPath={`/author/${encodeURIComponent(authorName)}`}
        type="profile"
        keywords={[authorName, `${authorName} books`, `${authorName} bibliography`, `${authorName} works`].filter(Boolean)}
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `${authorName} on BitLibrary`,
            url: toAbsoluteUrl(`/author/${encodeURIComponent(authorName)}`),
            mainEntity: {
              '@type': 'Person',
              name: authorName,
              ...(authorInfo?.birth_year ? { birthDate: String(authorInfo.birth_year) } : {}),
              ...(authorInfo?.death_year ? { deathDate: String(authorInfo.death_year) } : {}),
            },
          },
          ...(books.length > 0 ? [
            createItemListSchema(
              books.map((book) => ({
                name: book.title,
                path: `/book/${book.id}`,
                image: book.coverUrl,
              })),
              `${authorName} books on BitLibrary`
            ),
          ] : []),
        ]}
      />
      {/* Navigation Header */}
      <nav className="mb-12 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-bit-muted hover:text-bit-text transition-colors group"
        >
          <div className="p-2 rounded-lg bg-bit-panel/50 border border-bit-border group-hover:bg-bit-accent group-hover:text-white transition-all shadow-sm">
            <ArrowLeft size={18} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Return to Library</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bit-accent/5 border border-bit-accent/10">
          <div className="w-2 h-2 rounded-full bg-bit-accent animate-pulse" />
          <span className="font-mono text-[10px] text-bit-accent uppercase tracking-widest font-bold uppercase tracking-widest">Node: Author Registry</span>
        </div>
      </nav>

      {/* Hero Section: Author Identity */}
      <section className="relative mb-24">
        <div className="absolute -left-20 -top-20 w-64 h-64 bg-bit-accent/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-end gap-10">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-3xl bg-bit-panel/30 border border-bit-border flex items-center justify-center text-bit-accent relative group overflow-hidden shadow-sm">
            <User size={80} className="relative z-10 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-bit-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="flex-1 space-y-4">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-bit-text tracking-tight leading-non tracking-tight leading-none uppercase">
              {authorName}
            </h1>
            
            <div className="flex flex-wrap gap-6 items-center">
              {authorInfo?.birth_year && (
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-bit-panel/50 border border-bit-border shadow-sm">
                  <Calendar size={16} className="text-bit-accent" />
                  <span className="font-mono text-xs text-bit-text font-bold">
                    {authorInfo.birth_year} — {authorInfo.death_year || 'Decelerated'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-bit-panel/50 border border-bit-border shadow-sm">
                <Zap size={16} className="text-bit-accent" />
                <span className="font-mono text-xs text-bit-text uppercase tracking-widest font-bold">
                  {books.length} Synchronized Volumes
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Stream */}
      <section>
        <div className="flex items-center justify-between mb-12 border-b border-bit-border pb-6">
          <h3 className="text-xl font-display font-semibold text-bit-text flex items-center gap-3">
            <Library size={20} className="text-bit-accent" /> Archived Volumes
          </h3>
          <p className="font-mono text-[10px] text-bit-muted uppercase tracking-[0.2em] font-bold">Live results from all connected APIs</p>
        </div>

        {loading ? (
          <BookGridSkeleton count={8} />
        ) : (
          <div className="bit-card-grid">
            {books.map((book, idx) => (
              <div 
                key={book.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <BookCard 
                  variant="compact"
                  book={book} 
                  onClick={() => onBookClick(book)} 
                  onRead={() => navigate(`/book/${book.id}`)} 
                />
              </div>
            ))}
          </div>
        )}

        {!loading && books.length === 0 && (
          <div className="py-40 text-center bg-bit-panel/20 rounded-3xl border border-dashed border-bit-border shadow-inner">
            <Info size={40} className="mx-auto mb-6 text-bit-muted/30" />
            <p className="font-mono text-sm text-bit-muted/60 uppercase tracking-[0.3em] font-bold">No associated volumes found in this sector.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default AuthorDetails;
