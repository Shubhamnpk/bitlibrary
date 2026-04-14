import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book, Author } from '@/types/index';
import { searchBooksInGutendex } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import { ArrowLeft, User, Calendar, MapPin, Zap, Info, ChevronRight, Library } from 'lucide-react';

const AuthorDetails: React.FC<{ onBookClick: (b: Book) => void }> = ({ onBookClick }) => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);

  useEffect(() => {
    if (!name) return;

    const loadAuthorData = async () => {
      setLoading(true);
      try {
        // Targeted Author-Node Discovery
        const results = await searchBooksInGutendex(name);
        setBooks(results);
        
        // Attempt to extract structured lifespans from the first found volume
        if (results.length > 0 && results[0].authors) {
          const match = results[0].authors.find(a => a.name.includes(name));
          if (match) setAuthorInfo(match);
        }
      } catch (err) {
        console.error("[Author Sync] Error:", err);
      }
      setLoading(false);
    };

    loadAuthorData();
  }, [name]);

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
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
              {name?.replace(/%20/g, ' ')}
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
          <p className="font-mono text-[10px] text-bit-muted uppercase tracking-[0.2em] font-bold">Decentralized Results from Gutendex</p>
        </div>

        {loading ? (
          <BookGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
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
