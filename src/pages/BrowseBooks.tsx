import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import { CATEGORIES, INITIAL_BOOKS } from '@/constants';
import BookCard from '@/components/BookCard';
import { fetchBooksFromGutendex } from '@/services/bookService';
import { BookGridSkeleton } from '@/components/Skeletons';
import { BookOpen, ChevronDown, Disc, LayoutGrid, List } from 'lucide-react';

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
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

   const selectedCategory = categoryId || 'All';

   useEffect(() => {
      const loadBooks = async () => {
         setLoading(true);
         const { books: apiBooks } = await fetchBooksFromGutendex(1, selectedCategory);
         setBooks(apiBooks.length > 0 ? apiBooks : INITIAL_BOOKS);
         setLoading(false);
         setPage(1);
      };
      loadBooks();
   }, [selectedCategory]);

   const handleLoadMore = async () => {
      setLoadingMore(true);
      const nextPage = page + 1;
      const { books: moreBooks } = await fetchBooksFromGutendex(nextPage, selectedCategory);
      if (moreBooks.length > 0) {
         setBooks(prev => [...prev, ...moreBooks]);
         setPage(nextPage);
      }
      setLoadingMore(false);
   };

   return (
      <div className="animate-fade-in pb-20">
	         <div className="mb-12">
	            <h1 className="text-5xl font-display font-bold text-white mb-4">Book Archive</h1>
	            <p className="text-gray-500 font-mono text-sm max-w-xl">
	               Explore open books by category, discover public-domain classics, and keep moving through the archive with a cleaner reading flow.
	            </p>
	         </div>

         {/* Filter Bar */}
         <div className="flex flex-col md:flex-row items-center gap-6 mb-12 border-b border-white/5 pb-8">
            <div className="flex flex-wrap gap-2 flex-1">
               <button
                  onClick={() => navigate('/browse')}
                  className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === 'All' ? 'bg-bit-accent border-bit-accent text-black font-bold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
               >
                  ALL
               </button>
               {CATEGORIES.slice(0, 8).map(cat => (
                  <button
                     key={cat}
                     onClick={() => navigate(`/browse/${encodeURIComponent(cat)}`)}
                     className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === cat ? 'bg-bit-accent border-bit-accent text-black font-bold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
                  >
                     {cat.toUpperCase()}
                  </button>
               ))}
            </div>

	            <div className="flex items-center gap-4">
	               <div className="h-10 w-[1px] bg-white/5 hidden md:block" />
	               <div className="flex gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/5">
	                  <button
	                     onClick={() => setViewMode('grid')}
	                     aria-label="Grid view"
	                     className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-white'}`}
	                  >
	                     <LayoutGrid size={16} />
	                  </button>
	                  <button
	                     onClick={() => setViewMode('list')}
	                     aria-label="List view"
	                     className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-white'}`}
	                  >
	                     <List size={16} />
	                  </button>
	               </div>
	            </div>
	         </div>
	
	         {/* Results */}
	         {loading ? (
	            <BookGridSkeleton count={8} />
	         ) : viewMode === 'grid' ? (
	            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
	               {books.map((book, idx) => (
	                  <div key={`${book.id}-${idx}`} className="animate-fade-in-up" style={{ animationDelay: `${(idx % 8) * 50}ms` }}>
	                     <BookCard book={book} onClick={onBookClick} onRead={onRead} />
	                  </div>
	               ))}
	            </div>
	         ) : (
	            <div className="space-y-4">
	               {books.map((book, idx) => (
	                  <div
	                     key={`${book.id}-${idx}`}
	                     onClick={() => onBookClick(book)}
	                     className="animate-fade-in-up group cursor-pointer rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-bit-accent/30 hover:bg-white/[0.04]"
	                     style={{ animationDelay: `${(idx % 8) * 40}ms` }}
	                  >
	                     <div className="flex flex-col gap-5 md:flex-row md:items-center">
	                        <div className="flex items-start gap-4 flex-1 min-w-0">
	                           <div className="h-28 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
	                              {book.coverUrl ? (
	                                 <img
	                                    src={book.coverUrl}
	                                    alt={book.title}
	                                    className="h-full w-full object-cover"
	                                    onError={(e) => {
	                                       (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543005127-d0d080007886?q=80&w=300&auto=format&fit=crop';
	                                       (e.target as HTMLImageElement).classList.add('opacity-40');
	                                    }}
	                                 />
	                              ) : (
	                                 <div className="flex h-full items-end bg-gradient-to-br from-white/10 to-transparent p-3">
	                                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/60">
	                                       {book.category}
	                                    </span>
	                                 </div>
	                              )}
	                           </div>

	                           <div className="min-w-0 flex-1">
	                              <div className="flex flex-wrap items-center gap-2 mb-3">
	                                 <span className="rounded-full border border-bit-accent/20 bg-bit-accent/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-accent">
	                                    {book.category}
	                                 </span>
	                                 {book.source && (
	                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
	                                       {book.source}
	                                    </span>
	                                 )}
	                              </div>
	                              <h3 className="text-2xl font-display font-bold text-white transition-colors group-hover:text-bit-accent">
	                                 {book.title}
	                              </h3>
	                              <p className="mt-2 text-sm font-mono uppercase tracking-[0.18em] text-gray-500">
	                                 By {book.author}
	                              </p>
	                              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-400 line-clamp-3">
	                                 {book.description || 'Open the details page to inspect this volume, its metadata, and reading options.'}
	                              </p>
	                              <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
	                                 <span>Year {book.year || 'Unknown'}</span>
	                                 <span>Pages {book.pages || 'N/A'}</span>
	                                 <span>Downloads {book.downloads || 0}</span>
	                              </div>
	                           </div>
	                        </div>

	                        <div className="flex shrink-0 gap-3 md:flex-col">
	                           <button
	                              onClick={(event) => {
	                                 event.stopPropagation();
	                                 onBookClick(book);
	                              }}
	                              className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-mono uppercase tracking-[0.18em] text-white transition-all hover:border-bit-accent/40 hover:text-bit-accent md:min-w-[160px]"
	                           >
	                              View Details
	                           </button>
	                           <button
	                              onClick={(event) => {
	                                 event.stopPropagation();
	                                 onRead(book);
	                              }}
	                              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-bit-accent px-5 py-3 text-[11px] font-mono uppercase tracking-[0.18em] text-black transition-all hover:scale-[0.99] md:min-w-[160px]"
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

         {/* Pagination */}
         <div className="mt-24 flex flex-col items-center gap-6">
            <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <button
               onClick={handleLoadMore}
               disabled={loadingMore}
               className="group flex flex-col items-center gap-2 disabled:opacity-50"
            >
               {loadingMore ? (
                  <Disc className="text-bit-accent animate-spin" size={24} />
               ) : (
                  <>
                     <span className="text-[10px] font-mono text-gray-600 group-hover:text-bit-accent transition-colors">PULL NEXT NODE STREAM</span>
                     <ChevronDown className="text-gray-700 group-hover:text-bit-accent animate-bounce" />
                  </>
               )}
            </button>
         </div>
      </div>
   );
};

export default BrowseBooks;
