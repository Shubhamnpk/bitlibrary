import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import { CATEGORIES, INITIAL_BOOKS } from '@/constants';
import BookCard from '@/components/BookCard';
import { fetchBooksFromGutendex } from '@/services/bookService';
import { BookGridSkeleton } from '@/components/Skeletons';
import { Filter, Search, Zap, SlidersHorizontal, ChevronDown, LayoutGrid, List, Disc } from 'lucide-react';

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
               Browsing the decentralized Gutendex network.
               Over 70,000 public domain volumes synchronized via Gemini nodes.
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
                  <button className="p-1.5 bg-white/10 rounded text-white transition-colors"><LayoutGrid size={16} /></button>
                  <button className="p-1.5 text-gray-600 hover:text-white transition-colors"><List size={16} /></button>
               </div>
            </div>
         </div>

         {/* Results Grid */}
         {loading ? (
            <BookGridSkeleton count={8} />
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
               {books.map((book, idx) => (
                  <div key={`${book.id}-${idx}`} className="animate-fade-in-up" style={{ animationDelay: `${(idx % 8) * 50}ms` }}>
                     <BookCard book={book} onClick={onBookClick} onRead={onRead} />
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
