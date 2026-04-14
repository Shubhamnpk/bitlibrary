import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import { CATEGORIES, INITIAL_BOOKS } from '@/constants';
import BookCard from '@/components/BookCard';
import { fetchBooksFromGutendex } from '@/services/bookService';
import { BookGridSkeleton } from '@/components/Skeletons';
import { BookOpen, Disc, LayoutGrid, List } from 'lucide-react';

interface BrowseBooksProps {
   onBookClick: (book: Book) => void;
   onRead: (book: Book) => void;
}

const BrowseBooks: React.FC<BrowseBooksProps> = ({ onBookClick, onRead }) => {
   const { categoryId } = useParams();
   const navigate = useNavigate();
   const [books, setBooks] = useState<Book[]>([]);
   const [loading, setLoading] = useState(true);
   const [loadingMore, setLoadingMore] = useState(false);
   const [page, setPage] = useState(1);
   const [hasMore, setHasMore] = useState(true);
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   
   const observerRef = useRef<HTMLDivElement>(null);
   const allFetchedBooks = useRef<Book[]>([]); // Global Session Cache for Instant Filtering
   const selectedCategory = categoryId || 'All';

   const loadInitialBooks = useCallback(async (isInstant = false) => {
      // If NOT instant, we show skeleton
      if (!isInstant) {
         setLoading(true);
      }
      
      try {
         const { books: apiBooks, next } = await fetchBooksFromGutendex(1, selectedCategory);
         
         const results = apiBooks.length > 0 ? apiBooks : INITIAL_BOOKS;
         setBooks(results);
         setHasMore(!!next);
         
         // Update session cache
         const uniqueNewBooks = apiBooks.filter(nb => !allFetchedBooks.current.some(ob => ob.id === nb.id));
         allFetchedBooks.current = [...allFetchedBooks.current, ...uniqueNewBooks];
         
      } catch (err) {
         console.error("Browse Error:", err);
         if (!isInstant) setBooks(INITIAL_BOOKS);
         setHasMore(false);
      }
      setLoading(false);
      setPage(1);
   }, [selectedCategory]);

   // Instant Filter Logic: Adaptive Neural Sector Switching
   useEffect(() => {
      // 1. Identify local clusters from current session registry
      const localMatches = allFetchedBooks.current.filter(book => {
         if (selectedCategory === 'All') return true;
         const catStr = selectedCategory.toLowerCase();
         return book.category.toLowerCase().includes(catStr) || 
                (book.subjects && book.subjects.some(s => s.toLowerCase().includes(catStr)));
      });

      if (localMatches.length > 0) {
         // Instant Promotion: Show existing nodes immediately
         setBooks(localMatches);
         // Background Sync: Refresh registry silently
         void loadInitialBooks(true);
      } else {
         // Full Re-Synchronization: Show skeletons while syncing new sector
         setBooks([]);
         void loadInitialBooks(false);
      }
   }, [selectedCategory, loadInitialBooks]);

   const handleLoadMore = useCallback(async () => {
      if (loadingMore || !hasMore) return;
      
      setLoadingMore(true);
      const nextPage = page + 1;
      try {
         const { books: moreBooks, next } = await fetchBooksFromGutendex(nextPage, selectedCategory);
         if (moreBooks.length > 0) {
            setBooks(prev => {
               const filtered = prev.filter(b => !moreBooks.some(m => m.id === b.id));
               return [...filtered, ...moreBooks];
            });
            setPage(nextPage);
            setHasMore(!!next);
            
            // Update session cache
            const uniqueNewBooks = moreBooks.filter(nb => !allFetchedBooks.current.some(ob => ob.id === nb.id));
            allFetchedBooks.current = [...allFetchedBooks.current, ...uniqueNewBooks];
         } else {
            setHasMore(false);
         }
      } catch (err) {
         console.error("Load More Error:", err);
         setHasMore(false);
      }
      setLoadingMore(false);
   }, [loadingMore, hasMore, page, selectedCategory]);

   // Smart Intersection Observer: On-Demand Loading
   useEffect(() => {
      const observer = new IntersectionObserver(
         (entries) => {
            // Trigger 200px before reaching the end for a "seamless" feel
            if (entries[0].isIntersecting && !loadingMore && hasMore && !loading) {
               void handleLoadMore();
            }
         },
         { threshold: 0, rootMargin: '400px' } 
      );

      const currentTarget = observerRef.current;
      if (currentTarget) {
         observer.observe(currentTarget);
      }

      return () => {
         if (currentTarget) {
            observer.unobserve(currentTarget);
         }
      };
   }, [handleLoadMore, loadingMore, hasMore, loading]);

   return (
      <div className="animate-fade-in pb-20">
         <div className="mb-12">
            <h1 className="text-5xl font-display font-bold text-bit-text mb-4 tracking-tight">Book Archive</h1>
            <p className="text-bit-muted font-mono text-sm max-w-xl">
               Explore open books by category, discover public-domain classics, and keep moving through the archive with a cleaner reading flow.
            </p>
         </div>

         {/* Filter Bar */}
         <div className="flex flex-col md:flex-row items-center gap-6 mb-12 border-b border-bit-border pb-8">
            <div className="flex flex-wrap gap-2 flex-1">
               <button
                  onClick={() => navigate('/browse')}
                  className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === 'All' ? 'bg-bit-accent border-bit-accent text-white font-bold shadow-lg shadow-bit-accent/20' : 'border-bit-border text-bit-muted hover:border-bit-accent/30'}`}
               >
                  ALL
               </button>
               {CATEGORIES.slice(0, 8).map(cat => (
                  <button
                     key={cat}
                     onClick={() => navigate(`/browse/${encodeURIComponent(cat)}`)}
                     className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === cat ? 'bg-bit-accent border-bit-accent text-white font-bold shadow-lg shadow-bit-accent/20' : 'border-bit-border text-bit-muted hover:border-bit-accent/30'}`}
                  >
                     {cat.toUpperCase()}
                  </button>
               ))}
            </div>

            <div className="flex items-center gap-4">
               <div className="h-10 w-[1px] bg-bit-border hidden md:block" />
               <div className="flex gap-1 bg-bit-panel/50 p-1 rounded-lg border border-bit-border">
                  <button
                     onClick={() => setViewMode('grid')}
                     aria-label="Grid view"
                     className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-bit-accent text-white shadow-sm' : 'text-bit-muted hover:text-bit-text'}`}
                  >
                     <LayoutGrid size={16} />
                  </button>
                  <button
                     onClick={() => setViewMode('list')}
                     aria-label="List view"
                     className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-bit-accent text-white shadow-sm' : 'text-bit-muted hover:text-bit-text'}`}
                  >
                     <List size={16} />
                  </button>
               </div>
            </div>
         </div>

         {/* Results */}
         {loading && books.length === 0 ? (
            <BookGridSkeleton count={8} />
         ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
               {books.map((book, idx) => (
                  <div key={`${book.id}-${idx}`} className="animate-fade-in-up" style={{ animationDelay: `${(idx % 8) * 40}ms` }}>
                     <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                  </div>
               ))}
            </div>
         ) : (
            <div className="space-y-4">
               {books.map((book, idx) => (
                  <div
                     key={`${book.id}-${idx}`}
                     onClick={() => onBookClick(book)}
                     className="animate-fade-in-up group cursor-pointer rounded-3xl border border-bit-border bg-bit-panel/30 p-5 transition-all hover:border-bit-accent/30 hover:bg-bit-panel/50 shadow-sm"
                     style={{ animationDelay: `${(idx % 8) * 30}ms` }}
                  >
                     <div className="flex flex-col gap-5 md:flex-row md:items-center">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                           <div className="h-28 w-20 shrink-0 overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/50 overflow-hidden">
                              {book.coverUrl ? (
                                 <img
                                    src={`https://images.weserv.nl/?url=${encodeURIComponent(book.coverUrl)}&w=200&h=300&fit=cover&output=webp`}
                                    alt={book.title}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                       (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543005127-d0d080007886?q=80&w=300&auto=format&fit=crop';
                                       (e.target as HTMLImageElement).classList.add('opacity-40');
                                    }}
                                 />
                              ) : (
                                 <div className="flex h-full items-end bg-gradient-to-br from-bit-panel to-transparent p-3">
                                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted">
                                       {book.category}
                                    </span>
                                 </div>
                              )}
                           </div>

                           <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                 <span className="rounded-full border border-bit-accent/20 bg-bit-accent/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-accent font-bold">
                                    {book.category}
                                 </span>
                                 {book.source && (
                                    <span className="rounded-full border border-bit-border bg-bit-panel/50 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted">
                                       {book.source.toUpperCase()}
                                    </span>
                                 )}
                              </div>
                              <h3 className="text-2xl font-display font-bold text-bit-text transition-colors group-hover:text-bit-accent tracking-tight">
                                 {book.title}
                              </h3>
                              <p className="mt-2 text-sm font-mono uppercase tracking-[0.18em] text-bit-muted font-bold">
                                 By {book.author}
                              </p>
                              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bit-muted/80 line-clamp-2">
                                 {book.description || 'Open the details page to inspect this volume, its metadata, and reading options.'}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted/60">
                                 <span>Year {book.year || 'Unknown'}</span>
                                 <span>Pages {book.pages || 'N/A'}</span>
                                 <span>Rank {book.popularity || 0}%</span>
                              </div>
                           </div>
                        </div>

                        <div className="flex shrink-0 gap-3 md:flex-col">
                           <button
                              onClick={(event) => {
                                 event.stopPropagation();
                                 onBookClick(book);
                              }}
                              className="flex-1 rounded-2xl border border-bit-border bg-bit-panel/50 px-5 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-bit-text transition-all hover:border-bit-accent/40 hover:text-bit-accent md:min-w-[160px]"
                           >
                              View Details
                           </button>
                           <button
                              onClick={(event) => {
                                 event.stopPropagation();
                                 onRead(book);
                              }}
                              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-bit-accent px-5 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-[0.99] md:min-w-[160px]"
                           >
                              <BookOpen size={14} />
                              Read Now
                           </button>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Infinite Scroll Sentinel */}
         <div ref={observerRef} className="mt-12 flex flex-col items-center gap-6 py-10">
            {hasMore ? (
               <div className="flex flex-col items-center gap-3">
                  <Disc className="text-bit-accent animate-spin" size={24} />
                  <span className="text-[10px] font-mono text-bit-muted font-bold uppercase tracking-[0.3em] animate-pulse">Syncing_Sector_Registry...</span>
               </div>
            ) : books.length > 0 && (
               <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-bit-border to-transparent" />
            )}
         </div>
      </div>
   );
};

export default BrowseBooks;
