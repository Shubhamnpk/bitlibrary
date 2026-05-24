import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Audiobook, Book } from '@/types/index';
import { CATEGORIES, INITIAL_BOOKS } from '@/constants';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { fetchBooksFromGutendex, fetchBooksFromYoBook, searchGoogleBooks, searchInternetArchive, searchOpenLibrary } from '@/services/bookService';
import { fetchFeaturedAudiobooks } from '@/services/audiobookService';
import { BookGridSkeleton } from '@/components/Skeletons';
import { ArrowRight, BookOpen, Disc, Headphones, LayoutGrid, List } from 'lucide-react';
import Seo from '@/components/Seo';
import { createItemListSchema, truncate } from '@/lib/seo';

const SHELF_ITEM_LIMIT = 6;
const INITIAL_VISIBLE_CATEGORY_ROWS = 3;
const CATEGORY_ROW_BATCH_SIZE = 2;
const CATEGORY_ROW_LOAD_MARGIN = '240px';
const CATEGORY_ROW_SCROLL_STEP = 140;
const SHELF_PRIMARY_TIMEOUT_MS = 3500;
const SHELF_FALLBACK_TIMEOUT_MS = 3500;
const BROWSE_CACHE_TTL = 6 * 60 * 60 * 1000;
const BROWSE_CACHE_PREFIX = 'bitlibrary-browse-cache-v3';
const SHELF_FALLBACK_BOOKS: Book[] = [
   { id: 'gutenberg-100', title: 'The Complete Works of William Shakespeare', author: 'William Shakespeare', category: 'Poetry', description: 'A public-domain collection of plays and poems.', coverUrl: 'https://www.gutenberg.org/cache/epub/100/pg100.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/100.html.images', subjects: ['Poetry', 'Drama', 'Fiction'] },
   { id: 'gutenberg-84', title: 'Frankenstein; or, The Modern Prometheus', author: 'Mary Wollstonecraft Shelley', category: 'Fiction', description: 'A gothic novel about creation, responsibility, and fear.', coverUrl: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/84.html.images', subjects: ['Fiction', 'Science', 'Drama'] },
   { id: 'gutenberg-1661', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', category: 'Mystery', description: 'Classic detective stories with Sherlock Holmes and Dr. Watson.', coverUrl: 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/1661.html.images', subjects: ['Mystery', 'Short Stories', 'Adventure'] },
   { id: 'gutenberg-98', title: 'A Tale of Two Cities', author: 'Charles Dickens', category: 'History', description: 'A historical novel set around the French Revolution.', coverUrl: 'https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/98.html.images', subjects: ['History', 'Fiction', 'Drama'] },
   { id: 'gutenberg-1497', title: 'The Republic', author: 'Plato', category: 'Philosophy', description: 'A foundational work on justice, politics, and education.', coverUrl: 'https://www.gutenberg.org/cache/epub/1497/pg1497.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/1497.html.images', subjects: ['Philosophy', 'History'] },
   { id: 'gutenberg-23', title: 'Narrative of the Life of Frederick Douglass', author: 'Frederick Douglass', category: 'Biography', description: 'A powerful autobiography by Frederick Douglass.', coverUrl: 'https://www.gutenberg.org/cache/epub/23/pg23.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/23.html.images', subjects: ['Biography', 'History'] },
   { id: 'gutenberg-1228', title: 'On the Origin of Species', author: 'Charles Darwin', category: 'Science', description: 'Darwin’s major work on evolution by natural selection.', coverUrl: 'https://www.gutenberg.org/cache/epub/1228/pg1228.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/1228.html.images', subjects: ['Science', 'History'] },
   { id: 'gutenberg-11', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', category: 'Children', description: 'A playful fantasy classic for younger readers.', coverUrl: 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/11.html.images', subjects: ['Children', 'Adventure', 'Fiction'] },
   { id: 'gutenberg-120', title: 'Treasure Island', author: 'Robert Louis Stevenson', category: 'Adventure', description: 'A sea adventure with pirates, maps, and danger.', coverUrl: 'https://www.gutenberg.org/cache/epub/120/pg120.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/120.html.images', subjects: ['Adventure', 'Children', 'Fiction'] },
   { id: 'gutenberg-1342', title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Romance', description: 'A sharp novel about manners, family, pride, and love.', coverUrl: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/1342.html.images', subjects: ['Romance', 'Fiction', 'Drama'] },
   { id: 'gutenberg-174', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', category: 'Drama', description: 'A gothic philosophical novel about beauty and consequence.', coverUrl: 'https://www.gutenberg.org/cache/epub/174/pg174.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/174.html.images', subjects: ['Drama', 'Fiction', 'Philosophy'] },
   { id: 'gutenberg-2147', title: 'The Works of Edgar Allan Poe, Volume 1', author: 'Edgar Allan Poe', category: 'Short Stories', description: 'Stories and poems from a defining gothic fiction voice.', coverUrl: 'https://www.gutenberg.org/cache/epub/2147/pg2147.cover.medium.jpg', source: 'Gutendex', externalUrl: 'https://www.gutenberg.org/ebooks/2147.html.images', subjects: ['Short Stories', 'Mystery', 'Poetry'] },
];

interface BrowseBooksProps {
   onBookClick: (book: Book) => void;
   onAudiobookClick: (audiobook: Audiobook) => void;
   onRead: (book: Book) => void;
}

interface BookCategoryShelfProps {
   category: string;
   onBookClick: (book: Book) => void;
   onRead: (book: Book) => void;
   onViewAll: (category: string) => void;
}

interface BrowseCategoryCachePayload {
   books: Book[];
   hasMore: boolean;
   timestamp: number;
}

interface ShelfCachePayload {
   books: Book[];
   timestamp: number;
}

const getBrowseCacheKey = (category: string) => `${BROWSE_CACHE_PREFIX}:category:${category}`;
const getShelfCacheKey = (category: string) => `${BROWSE_CACHE_PREFIX}:shelf:${category}`;
const getCurriculumShelfCacheKey = () => `${BROWSE_CACHE_PREFIX}:shelf:nepali-curriculum`;

const readCachePayload = <T extends { timestamp: number }>(key: string): T | null => {
   if (typeof window === 'undefined') return null;

   try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as T;
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > BROWSE_CACHE_TTL) {
         window.localStorage.removeItem(key);
         return null;
      }

      return parsed;
   } catch {
      return null;
   }
};

const writeCachePayload = (key: string, payload: object) => {
   if (typeof window === 'undefined') return;

   try {
      window.localStorage.setItem(key, JSON.stringify({ ...payload, timestamp: Date.now() }));
   } catch {
      // Ignore storage failures; page-level state still works.
   }
};

const dedupeBooks = (books: Book[]) => books.filter((book, index, list) => (
   Boolean(book?.id) && list.findIndex((entry) => entry.id === book.id) === index
));

const mergeBooksBySourcePriority = (...collections: Book[][]) => dedupeBooks(collections.flat());

const loadBooksForShelf = async (category: string): Promise<Book[]> => {
   const cached = readCachePayload<ShelfCachePayload>(getShelfCacheKey(category));
   if (cached?.books?.length) return cached.books;

   const controller = new AbortController();
   const timeoutId = window.setTimeout(() => controller.abort(), SHELF_PRIMARY_TIMEOUT_MS);
   const [yoBookResult, gutendexResult] = await Promise.allSettled([
      fetchBooksFromYoBook(1, category, controller.signal),
      fetchBooksFromGutendex(1, category, controller.signal),
   ]).finally(() => {
      window.clearTimeout(timeoutId);
   });
   let shelfBooks = mergeBooksBySourcePriority(
      yoBookResult.status === 'fulfilled' ? yoBookResult.value.books : [],
      gutendexResult.status === 'fulfilled' ? gutendexResult.value.books : []
   );

   if (shelfBooks.length === 0) {
      const fallbackResults = await Promise.race([
         Promise.allSettled([
            searchGoogleBooks(category),
            searchOpenLibrary(category),
            searchInternetArchive(category),
         ]),
         new Promise<PromiseSettledResult<Book[]>[]>((resolve) => {
            window.setTimeout(() => resolve([]), SHELF_FALLBACK_TIMEOUT_MS);
         }),
      ]);
      shelfBooks = fallbackResults.flatMap((fallback) => fallback.status === 'fulfilled' ? fallback.value : []);
   }

   const dedupedBooks = shelfBooks
      .filter((book, index, list) => list.findIndex((entry) => entry.id === book.id) === index)
      .slice(0, SHELF_ITEM_LIMIT);

   if (dedupedBooks.length > 0) {
      writeCachePayload(getShelfCacheKey(category), { books: dedupedBooks });
      return dedupedBooks;
   }

   const categoryFallbacks = SHELF_FALLBACK_BOOKS.filter((book) =>
      book.category === category || book.subjects?.includes(category)
   );
   const fallbackPool = [
      ...categoryFallbacks,
      ...SHELF_FALLBACK_BOOKS.filter((book) => !categoryFallbacks.some((entry) => entry.id === book.id)),
   ];

   const fallbackBooks = fallbackPool.slice(0, SHELF_ITEM_LIMIT);

   writeCachePayload(getShelfCacheKey(category), { books: fallbackBooks });
   return fallbackBooks;
};

const loadCurriculumShelf = async (): Promise<Book[]> => {
   const cached = readCachePayload<ShelfCachePayload>(getCurriculumShelfCacheKey());
   if (cached?.books?.length) return cached.books;

   const controller = new AbortController();
   const timeoutId = window.setTimeout(() => controller.abort(), SHELF_PRIMARY_TIMEOUT_MS);
   const { books } = await fetchBooksFromYoBook(1, 'Nepali Curriculum', controller.signal).finally(() => {
      window.clearTimeout(timeoutId);
   });
   const shelfBooks = dedupeBooks(books).slice(0, SHELF_ITEM_LIMIT);

   if (shelfBooks.length > 0) {
      writeCachePayload(getCurriculumShelfCacheKey(), { books: shelfBooks });
   }

   return shelfBooks;
};

const CurriculumShelf: React.FC<{
   onBookClick: (book: Book) => void;
   onRead: (book: Book) => void;
   onViewAll: () => void;
}> = ({ onBookClick, onRead, onViewAll }) => {
   const [shelfBooks, setShelfBooks] = useState<Book[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      let isMounted = true;

      setIsLoading(true);
      loadCurriculumShelf()
         .then((items) => {
            if (isMounted) setShelfBooks(items);
         })
         .catch((error) => {
            console.warn('Curriculum shelf skipped:', error);
            if (isMounted) setShelfBooks([]);
         })
         .finally(() => {
            if (isMounted) setIsLoading(false);
         });

      return () => {
         isMounted = false;
      };
   }, []);

   if (!isLoading && shelfBooks.length === 0) return null;

   return (
      <section className="mb-14 space-y-6 border-b border-bit-border pb-12">
         <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
               <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Education</p>
               <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">Nepali curriculum books</h2>
               <p className="mt-2 max-w-2xl text-sm leading-7 text-bit-muted">
                  A focused row for CDC Nepal and CEHRD books. Browse the full class-wise collection in Curriculum.
               </p>
            </div>
            <button
               type="button"
               onClick={onViewAll}
               className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
            >
               View curriculum <ArrowRight size={14} />
            </button>
         </div>

         {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
               {Array.from({ length: SHELF_ITEM_LIMIT }).map((_, index) => (
                  <div key={index} className="h-72 w-40 shrink-0 animate-pulse rounded-xl border border-bit-border bg-bit-panel/40 sm:w-44" />
               ))}
            </div>
         ) : (
            <div className="flex snap-x gap-4 overflow-x-auto pb-4">
               {shelfBooks.map((book) => (
                  <div key={book.id} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
                     <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                  </div>
               ))}
            </div>
         )}
      </section>
   );
};

const BookCategoryShelf: React.FC<BookCategoryShelfProps> = ({ category, onBookClick, onRead, onViewAll }) => {
   const [shelfBooks, setShelfBooks] = useState<Book[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      let isMounted = true;

      setIsLoading(true);
      loadBooksForShelf(category)
         .then((items) => {
            if (isMounted) setShelfBooks(items);
         })
         .catch((error) => {
            console.warn(`Library shelf skipped for ${category}:`, error);
            if (isMounted) setShelfBooks([]);
         })
         .finally(() => {
            if (isMounted) setIsLoading(false);
         });

      return () => {
         isMounted = false;
      };
   }, [category]);

   if (!isLoading && shelfBooks.length === 0) return null;

   return (
      <section>
         <div className="mb-4 flex items-center justify-between gap-4">
            <div>
               <h3 className="text-xl font-display font-bold text-bit-text">{category}</h3>
               <p className="mt-1 line-clamp-1 text-xs text-bit-muted">Open books and archive records for {category.toLowerCase()}.</p>
            </div>
            <button type="button" onClick={() => onViewAll(category)} className="shrink-0 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent hover:text-bit-text">
               View all
            </button>
         </div>

         {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
               {Array.from({ length: SHELF_ITEM_LIMIT }).map((_, index) => (
                  <div key={index} className="h-72 w-40 shrink-0 animate-pulse rounded-xl border border-bit-border bg-bit-panel/40 sm:w-44" />
               ))}
            </div>
         ) : (
            <div className="flex snap-x gap-4 overflow-x-auto pb-4">
               {shelfBooks.map((book) => (
                  <div key={book.id} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
                     <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                  </div>
               ))}
            </div>
         )}
      </section>
   );
};

const BrowseBooks: React.FC<BrowseBooksProps> = ({ onBookClick, onAudiobookClick, onRead }) => {
   const { categoryId } = useParams();
   const navigate = useNavigate();
   const [books, setBooks] = useState<Book[]>([]);
   const [featuredAudiobooks, setFeaturedAudiobooks] = useState<Audiobook[]>([]);
   const [loadingMoreShelves, setLoadingMoreShelves] = useState(false);
   const [visibleShelfCount, setVisibleShelfCount] = useState(INITIAL_VISIBLE_CATEGORY_ROWS);
   const [loading, setLoading] = useState(true);
   const [loadingMore, setLoadingMore] = useState(false);
   const [page, setPage] = useState(1);
   const [hasMore, setHasMore] = useState(true);
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   
   const observerRef = useRef<HTMLDivElement>(null);
   const shelfObserverRef = useRef<HTMLDivElement>(null);
   const lastShelfLoadYRef = useRef(0);
   const allFetchedBooks = useRef<Book[]>([]); // Global Session Cache for Instant Filtering
   const selectedCategory = categoryId || 'All';
   const shouldShowShelves = selectedCategory === 'All';

   useEffect(() => {
      if (!shouldShowShelves) return;

      setVisibleShelfCount(INITIAL_VISIBLE_CATEGORY_ROWS);
      lastShelfLoadYRef.current = 0;
   }, [selectedCategory, shouldShowShelves]);

   const loadInitialBooks = useCallback(async (isInstant = false) => {
      const cached = readCachePayload<BrowseCategoryCachePayload>(getBrowseCacheKey(selectedCategory));
      if (cached?.books?.length) {
         setBooks(cached.books);
         setHasMore(cached.hasMore);
         setPage(1);
         const uniqueCachedBooks = cached.books.filter((book) => !allFetchedBooks.current.some((entry) => entry.id === book.id));
         allFetchedBooks.current = [...allFetchedBooks.current, ...uniqueCachedBooks];
         setLoading(false);
         return;
      }

      // If NOT instant, we show skeleton
      if (!isInstant) {
         setLoading(true);
      }
      
      try {
         const controller = new AbortController();
         const timeoutId = window.setTimeout(() => controller.abort(), SHELF_PRIMARY_TIMEOUT_MS);
         const [yoBookResult, gutendexResult] = await Promise.allSettled([
            fetchBooksFromYoBook(1, selectedCategory, controller.signal),
            fetchBooksFromGutendex(1, selectedCategory, controller.signal),
         ]).finally(() => {
            window.clearTimeout(timeoutId);
         });
         const yoBookBooks = yoBookResult.status === 'fulfilled' ? yoBookResult.value.books : [];
         const gutendexBooks = gutendexResult.status === 'fulfilled' ? gutendexResult.value.books : [];
         const apiBooks = mergeBooksBySourcePriority(yoBookBooks, gutendexBooks);
         const next = yoBookResult.status === 'fulfilled' && yoBookResult.value.next
            ? yoBookResult.value.next
            : gutendexResult.status === 'fulfilled' ? gutendexResult.value.next : null;
         
         const results = dedupeBooks(apiBooks.length > 0 ? apiBooks : INITIAL_BOOKS);
         setBooks(results);
         setHasMore(!!next);
         writeCachePayload(getBrowseCacheKey(selectedCategory), { books: results, hasMore: !!next });
         
         // Update session cache
         const uniqueNewBooks = apiBooks.filter(nb => !allFetchedBooks.current.some(ob => ob.id === nb.id));
         allFetchedBooks.current = [...allFetchedBooks.current, ...uniqueNewBooks];
         
      } catch (err) {
         console.error("Browse Error:", err);
         if (!isInstant) {
            setBooks(INITIAL_BOOKS);
            writeCachePayload(getBrowseCacheKey(selectedCategory), { books: INITIAL_BOOKS, hasMore: false });
         }
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

   useEffect(() => {
      let isMounted = true;

      const loadInitialAudio = async () => {
         const featured = await fetchFeaturedAudiobooks(SHELF_ITEM_LIMIT).catch(() => []);
         if (isMounted) {
            setFeaturedAudiobooks(featured.slice(0, SHELF_ITEM_LIMIT));
         }
      };

      if (shouldShowShelves) {
         lastShelfLoadYRef.current = 0;
         if (featuredAudiobooks.length === 0) {
            void loadInitialAudio();
         }
      } else {
         setFeaturedAudiobooks([]);
         setLoadingMoreShelves(false);
         setVisibleShelfCount(INITIAL_VISIBLE_CATEGORY_ROWS);
      }

      return () => {
         isMounted = false;
      };
   }, [featuredAudiobooks.length, shouldShowShelves]);

   const handleLoadMore = useCallback(async () => {
      if (loadingMore || !hasMore) return;
      
      setLoadingMore(true);
      const nextPage = page + 1;
      try {
         const [yoBookResult, gutendexResult] = await Promise.allSettled([
            fetchBooksFromYoBook(nextPage, selectedCategory),
            fetchBooksFromGutendex(nextPage, selectedCategory),
         ]);
         const yoBookBooks = yoBookResult.status === 'fulfilled' ? yoBookResult.value.books : [];
         const gutendexBooks = gutendexResult.status === 'fulfilled' ? gutendexResult.value.books : [];
         const moreBooks = mergeBooksBySourcePriority(yoBookBooks, gutendexBooks);
         const next = yoBookResult.status === 'fulfilled' && yoBookResult.value.next
            ? yoBookResult.value.next
            : gutendexResult.status === 'fulfilled' ? gutendexResult.value.next : null;
         if (moreBooks.length > 0) {
            setBooks(prev => {
               const filtered = prev.filter(b => !moreBooks.some(m => m.id === b.id));
               const nextBooks = [...filtered, ...moreBooks];
               writeCachePayload(getBrowseCacheKey(selectedCategory), { books: nextBooks, hasMore: !!next });
               return nextBooks;
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
            if (!shouldShowShelves && entries[0].isIntersecting && !loadingMore && hasMore && !loading) {
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
   }, [handleLoadMore, loadingMore, hasMore, loading, shouldShowShelves]);

   useEffect(() => {
      if (!shouldShowShelves) return;

      const observer = new IntersectionObserver(
         (entries) => {
            const movedFartherDown = window.scrollY > lastShelfLoadYRef.current + CATEGORY_ROW_SCROLL_STEP;

            if (entries[0].isIntersecting && movedFartherDown && !loadingMoreShelves && visibleShelfCount < CATEGORIES.length) {
               lastShelfLoadYRef.current = window.scrollY;
               setVisibleShelfCount((count) => Math.min(count + CATEGORY_ROW_BATCH_SIZE, CATEGORIES.length));
            }
         },
         { threshold: 0, rootMargin: CATEGORY_ROW_LOAD_MARGIN }
      );

      const currentTarget = shelfObserverRef.current;
      if (currentTarget) {
         observer.observe(currentTarget);
      }

      return () => {
         if (currentTarget) {
            observer.unobserve(currentTarget);
         }
      };
   }, [loadingMoreShelves, shouldShowShelves, visibleShelfCount]);

   return (
      <div className="animate-fade-in pb-20">
         <Seo
            title={selectedCategory === 'All' ? 'Browse Open Books and Digital Library Collections | BitLibrary' : `${selectedCategory} Books and Digital Library Collections | BitLibrary`}
            description={truncate(
               selectedCategory === 'All'
                  ? 'Browse open books, public-domain classics, research texts, educational resources, and archive collections in BitLibrary.'
                  : `Browse ${selectedCategory} books, public-domain classics, educational resources, and open archive records in BitLibrary.`,
               155
            )}
            canonicalPath={selectedCategory === 'All' ? '/library' : `/category/${encodeURIComponent(selectedCategory)}`}
            keywords={selectedCategory === 'All' ? ['browse books', 'digital library collections'] : [selectedCategory, `${selectedCategory} books`, `${selectedCategory} digital library`]}
            structuredData={[
               {
                  '@context': 'https://schema.org',
                  '@type': 'CollectionPage',
                  name: selectedCategory === 'All' ? 'BitLibrary open book collection' : `${selectedCategory} books`,
                  description: selectedCategory === 'All'
                     ? 'Open digital library collection for books, authors, and archive records.'
                     : `Open digital library collection for ${selectedCategory} books and archive records.`,
               },
               ...(books.length > 0 ? [
                  createItemListSchema(
                     books.map((book) => ({
                        name: book.title,
                        path: `/book/${book.id}`,
                        image: book.coverUrl,
                     })),
                     selectedCategory === 'All' ? 'BitLibrary open book collection' : `${selectedCategory} books on BitLibrary`
                  ),
               ] : []),
            ]}
         />
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

            {!shouldShowShelves && (
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
            )}
         </div>

         {shouldShowShelves && (
            <CurriculumShelf
               onBookClick={onBookClick}
               onRead={onRead}
               onViewAll={() => navigate('/curriculum')}
            />
         )}

         {shouldShowShelves && (
            <section className="mb-14 space-y-10 border-b border-bit-border pb-12">
               <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                     <div className="mb-3 flex items-center gap-2 text-bit-accent">
                        <Headphones size={18} />
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Audiobooks</p>
                     </div>
                     <h2 className="text-3xl font-display font-bold tracking-tight text-bit-text">Start listening</h2>
                     <p className="mt-2 max-w-2xl text-sm leading-7 text-bit-muted">
                        One quick row for public-domain recordings. Open the audiobook page when you want more listening categories.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={() => navigate('/audiobooks')}
                     className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
                  >
                     View all audiobooks <ArrowRight size={14} />
                  </button>
               </div>

               {featuredAudiobooks.length === 0 ? (
                  <div className="flex gap-4 overflow-hidden">
                     {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="h-72 w-40 shrink-0 animate-pulse rounded-xl border border-bit-border bg-bit-panel/40 sm:w-44" />
                     ))}
                  </div>
               ) : featuredAudiobooks.length > 0 && (
                  <div className="flex snap-x gap-4 overflow-x-auto pb-4">
                     {featuredAudiobooks.map((audiobook) => (
                        <div key={audiobook.id} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
                           <AudiobookCard variant="compact" audiobook={audiobook} onClick={onAudiobookClick} />
                        </div>
                     ))}
                  </div>
               )}
            </section>
         )}

         {shouldShowShelves && (
            <section className="space-y-12">
               <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Books</p>
                  <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">Browse by category</h2>
               </div>

               <div className="space-y-12">
                     {CATEGORIES.slice(0, visibleShelfCount).map((category) => (
                        <BookCategoryShelf
                           key={category}
                           category={category}
                           onBookClick={onBookClick}
                           onRead={onRead}
                           onViewAll={(nextCategory) => navigate(`/browse/${encodeURIComponent(nextCategory)}`)}
                        />
                     ))}
                     {visibleShelfCount < CATEGORIES.length && (
                        <div ref={shelfObserverRef} className="flex flex-col items-center gap-4 py-8">
                           {loadingMoreShelves ? (
                              <div className="flex gap-4 overflow-hidden">
                                 {Array.from({ length: SHELF_ITEM_LIMIT }).map((_, index) => (
                                    <div key={index} className="h-72 w-40 shrink-0 animate-pulse rounded-xl border border-bit-border bg-bit-panel/40 sm:w-44" />
                                 ))}
                              </div>
                           ) : (
                              <button
                                 type="button"
                                 onClick={() => setVisibleShelfCount((count) => Math.min(count + CATEGORY_ROW_BATCH_SIZE, CATEGORIES.length))}
                                 className="rounded-full border border-bit-border bg-bit-panel/40 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
                              >
                                 Show more categories
                              </button>
                           )}
                        </div>
                     )}
                  </div>
            </section>
         )}

         {/* Results */}
         {!shouldShowShelves && loading && books.length === 0 ? (
            <BookGridSkeleton count={8} />
         ) : !shouldShowShelves && viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
               {books.map((book, idx) => (
                  <div key={`${book.id}-${idx}`} className="animate-fade-in-up" style={{ animationDelay: `${(idx % 8) * 40}ms` }}>
                     <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                  </div>
               ))}
            </div>
         ) : !shouldShowShelves ? (
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
         ) : null}

         {/* Infinite Scroll Sentinel */}
         {!shouldShowShelves && (
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
         )}
      </div>
   );
};

export default BrowseBooks;
