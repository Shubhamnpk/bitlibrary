import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import { fetchBooksFromGutendex } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { ArrowLeft, Library, Zap, Info, ChevronRight, LayoutGrid, SlidersHorizontal } from 'lucide-react';

const CategoryDetails: React.FC<{ onBookClick: (b: Book) => void }> = ({ onBookClick }) => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const decodedCategory = categoryId ? decodeURIComponent(categoryId) : 'All';

  useEffect(() => {
    const loadCategoryBooks = async () => {
      setLoading(true);
      try {
        const { books: results } = await fetchBooksFromGutendex(1, decodedCategory);
        setBooks(results);
        setHasMore(results.length > 0);
        setPage(1);
      } catch (err) {
        console.error("[Category Sync] Error:", err);
      }
      setLoading(false);
    };

    loadCategoryBooks();
  }, [decodedCategory]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { books: moreBooks } = await fetchBooksFromGutendex(nextPage, decodedCategory);
      if (moreBooks.length > 0) {
        setBooks(prev => [...prev, ...moreBooks]);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[Category Pagination] Error:", err);
    }
    setLoadingMore(false);
  };

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
      {/* Navigation Header */}
      <nav className="mb-12 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-bit-accent group-hover:text-black transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest">Return to Library</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bit-accent/5 border border-bit-accent/10">
          <div className="w-2 h-2 rounded-full bg-bit-accent animate-pulse" />
          <span className="font-mono text-[10px] text-bit-accent uppercase tracking-widest font-bold">Node: Archival Sector</span>
        </div>
      </nav>

      {/* Hero Section: Category Identity */}
      <section className="relative mb-24 border-b border-white/5 pb-16">
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-bit-accent/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-bit-accent/50 font-mono text-[10px] uppercase tracking-[0.4em]">
            <LayoutGrid size={14} /> Subject Cluster
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-white tracking-tight leading-none uppercase">
            {decodedCategory}
          </h1>
          
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
              <Zap size={16} className="text-bit-accent" />
              <span className="font-mono text-xs text-white uppercase tracking-widest">
                {books.length}+ Archived Volumes
              </span>
            </div>
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
              <SlidersHorizontal size={16} className="text-bit-accent" />
              <span className="font-mono text-xs text-white uppercase tracking-widest">
                Optimized Sector Path
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Stream */}
      <section>
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-xl font-display font-semibold text-white flex items-center gap-3">
            <Library size={20} className="text-bit-accent" /> Sector Volumes
          </h3>
          <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">Synchronizing decentralized Gutendex nodes</p>
        </div>

        {loading ? (
          <BookGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 mb-16">
            {books.map((book, idx) => (
              <div 
                key={book.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <BookCard 
                  book={book} 
                  onClick={() => onBookClick(book)} 
                  onRead={() => navigate(`/book/${book.id}`)} 
                />
              </div>
            ))}
          </div>
        )}

        {!loading && books.length === 0 && (
          <div className="py-40 text-center glass-panel rounded-3xl border-dashed border-white/10">
            <Info size={40} className="mx-auto mb-6 text-white/10" />
            <p className="font-mono text-sm text-white/30 uppercase tracking-[0.3em]">Sector Registry is currently empty.</p>
          </div>
        )}

        {!loading && books.length > 0 && hasMore && (
          <div className="flex justify-center mt-12 bg-white/5 p-4 rounded-full border border-white/5 max-w-sm mx-auto group hover:border-bit-accent/30 transition-all cursor-pointer shadow-2xl" onClick={handleLoadMore}>
             <button
                disabled={loadingMore}
                className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase text-white/60 group-hover:text-bit-accent transition-colors flex items-center gap-3"
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
