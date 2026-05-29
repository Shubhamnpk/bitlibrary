import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import {
  fetchBooksFromGutendex,
  fetchBooksFromYoBook,
  searchGoogleBooks,
  searchInternetArchive,
  searchITBooks,
  searchOpenLibrary,
} from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { ArrowLeft, Library, Zap, Info, ChevronRight, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import Seo from '@/components/Seo';
import { createItemListSchema, truncate } from '@/lib/seo';
import { mergeUniqueBooks, rankBooks } from '@/lib/searchOptimization';

const CATEGORY_MAX_RESULTS = 120;

const settledBooks = (result: PromiseSettledResult<Book[]>) => (
  result.status === 'fulfilled' ? result.value : []
);

const loadCategorySources = async (category: string, signal?: AbortSignal) => {
  const [yobookResult, gutendexResult, googleResult, itResult, openLibraryResult, archiveResult] = await Promise.allSettled([
    fetchBooksFromYoBook(1, category, signal),
    fetchBooksFromGutendex(1, category, signal),
    searchGoogleBooks(category, signal),
    searchITBooks(category, signal),
    searchOpenLibrary(category, signal),
    searchInternetArchive(category, signal),
  ]);

  const yobook = yobookResult.status === 'fulfilled' ? yobookResult.value : { books: [], next: null };
  const gutendex = gutendexResult.status === 'fulfilled' ? gutendexResult.value : { books: [], next: null };
  const supplemental = [
    ...settledBooks(googleResult),
    ...settledBooks(itResult),
    ...settledBooks(openLibraryResult),
    ...settledBooks(archiveResult),
  ];

  return {
    books: rankBooks(mergeUniqueBooks(yobook.books, gutendex.books, supplemental), category).slice(0, CATEGORY_MAX_RESULTS),
    nextYoBook: yobook.next,
    nextGutendex: gutendex.next,
  };
};

const CategoryDetails: React.FC<{ onBookClick: (b: Book) => void }> = ({ onBookClick }) => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gutendexPage, setGutendexPage] = useState(1);
  const [yoBookPage, setYoBookPage] = useState(1);
  const [hasMoreGutendex, setHasMoreGutendex] = useState(false);
  const [hasMoreYoBook, setHasMoreYoBook] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const decodedCategory = categoryId ? decodeURIComponent(categoryId) : 'All';

  useEffect(() => {
    const controller = new AbortController();
    const loadCategoryBooks = async () => {
      setLoading(true);
      try {
        const { books: results, nextYoBook, nextGutendex } = await loadCategorySources(decodedCategory, controller.signal);
        if (controller.signal.aborted) return;
        setBooks(results);
        setHasMoreYoBook(Boolean(nextYoBook));
        setHasMoreGutendex(Boolean(nextGutendex));
        setHasMore(Boolean(nextYoBook || nextGutendex));
        setYoBookPage(1);
        setGutendexPage(1);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("[Category Sync] Error:", err);
        }
      }
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    };

    loadCategoryBooks();

    return () => {
      controller.abort();
    };
  }, [decodedCategory]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const controller = new AbortController();
    setLoadingMore(true);
    try {
      const nextYoBookPage = yoBookPage + 1;
      const nextGutendexPage = gutendexPage + 1;
      const [yoBookResult, gutendexResult] = await Promise.allSettled([
        hasMoreYoBook ? fetchBooksFromYoBook(nextYoBookPage, decodedCategory, controller.signal) : Promise.resolve({ books: [], next: null }),
        hasMoreGutendex ? fetchBooksFromGutendex(nextGutendexPage, decodedCategory, controller.signal) : Promise.resolve({ books: [], next: null }),
      ]);
      const yoBookMore = yoBookResult.status === 'fulfilled' ? yoBookResult.value : { books: [], next: null };
      const gutendexMore = gutendexResult.status === 'fulfilled' ? gutendexResult.value : { books: [], next: null };
      const moreBooks = rankBooks(mergeUniqueBooks(yoBookMore.books, gutendexMore.books), decodedCategory);

      if (moreBooks.length > 0) {
        setBooks(prev => rankBooks(mergeUniqueBooks(prev, moreBooks), decodedCategory).slice(0, CATEGORY_MAX_RESULTS));
      }
      setYoBookPage(hasMoreYoBook ? nextYoBookPage : yoBookPage);
      setGutendexPage(hasMoreGutendex ? nextGutendexPage : gutendexPage);
      setHasMoreYoBook(Boolean(yoBookMore.next));
      setHasMoreGutendex(Boolean(gutendexMore.next));
      setHasMore(Boolean(yoBookMore.next || gutendexMore.next));
    } catch (err) {
      console.error("[Category Pagination] Error:", err);
    }
    setLoadingMore(false);
  };

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
      <Seo
        title={`${decodedCategory} Books, Authors, and Open Archives | BitLibrary`}
        description={truncate(
          `Discover ${decodedCategory} books, public-domain editions, author records, related subjects, and reading options in BitLibrary's open digital library.`,
          155
        )}
        canonicalPath={`/category/${encodeURIComponent(decodedCategory)}`}
        keywords={[decodedCategory, `${decodedCategory} books`, `${decodedCategory} ebooks`, `${decodedCategory} public domain`]}
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${decodedCategory} books`,
            description: `Open digital library collection for ${decodedCategory} books and archive records.`,
          },
          ...(books.length > 0 ? [
          createItemListSchema(
            books.map((book) => ({
              name: book.title,
              path: `/book/${book.id}`,
              image: book.coverUrl,
            })),
            `${decodedCategory} books on BitLibrary`
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
          <div className="p-2 rounded-lg bg-bit-panel/50 group-hover:bg-bit-accent group-hover:text-white transition-all border border-bit-border">
            <ArrowLeft size={18} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest">Return to Library</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bit-accent/5 border border-bit-accent/20">
          <div className="w-2 h-2 rounded-full bg-bit-accent animate-pulse" />
          <span className="font-mono text-[10px] text-bit-accent uppercase tracking-widest font-bold">Node: Archival Sector</span>
        </div>
      </nav>

      {/* Hero Section: Category Identity */}
      <section className="relative mb-24 border-b border-bit-border pb-16">
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-bit-accent/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-bit-accent/50 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">
            <LayoutGrid size={14} /> Subject Cluster Active
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-bit-text tracking-tight leading-none uppercase">
            {decodedCategory}
          </h1>
          
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-bit-panel/30 border border-bit-border shadow-sm">
              <Zap size={16} className="text-bit-accent" />
              <span className="font-mono text-xs text-bit-text uppercase tracking-widest font-bold">
                {books.length}+ Archived Volumes
              </span>
            </div>
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-bit-panel/30 border border-bit-border shadow-sm">
              <SlidersHorizontal size={16} className="text-bit-accent" />
              <span className="font-mono text-xs text-bit-text uppercase tracking-widest font-bold">
                Optimized Sector Path
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Stream */}
      <section>
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-xl font-display font-semibold text-bit-text flex items-center gap-3">
            <Library size={20} className="text-bit-accent" /> Sector Volumes Registry
          </h3>
          <p className="font-mono text-[10px] text-bit-muted uppercase tracking-[0.2em]">Synchronizing YoBook and open archive sources</p>
        </div>

        {loading ? (
          <BookGridSkeleton count={8} />
        ) : (
          <div className="bit-card-grid mb-16">
            {books.map((book, idx) => (
              <div 
                key={book.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <BookCard 
                  variant="compact"
                  book={book} 
                  onClick={() => onBookClick(book)} 
                  onRead={() => onBookClick(book)} 
                />
              </div>
            ))}
          </div>
        )}

        {!loading && books.length === 0 && (
          <div className="py-40 text-center bg-bit-panel/30 rounded-3xl border-dashed border-bit-border">
            <Info size={40} className="mx-auto mb-6 text-bit-border" />
            <p className="font-mono text-sm text-bit-muted uppercase tracking-[0.3em]">Sector Registry is currently empty.</p>
          </div>
        )}

        {!loading && books.length > 0 && hasMore && (
          <div className="flex justify-center mt-12 bg-bit-panel/50 p-4 rounded-full border border-bit-border max-w-sm mx-auto group hover:border-bit-accent/30 shadow-md transition-all cursor-pointer" onClick={handleLoadMore}>
             <button
                disabled={loadingMore}
                className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase text-bit-muted group-hover:text-bit-accent transition-colors flex items-center gap-3"
             >
                {loadingMore ? (
                   <>
                      <div className="w-2 h-2 rounded-full bg-bit-accent animate-ping" />
                      SYNCHRONIZING_NEXT_BLOCK...
                   </>
                ) : (
                   <>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      LOAD_ARCHIVAL_DATA
                   </>
                )}
             </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default CategoryDetails;
