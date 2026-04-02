import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '@/types/index';
import { BookOpen, Bookmark, Calendar, BarChart } from 'lucide-react';
import { toggleSavedBook, useLocalUserState } from '@/lib/local-user';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  onRead?: (book: Book) => void;
  onAuthorClick?: (name: string) => void;
  variant?: 'compact' | 'full';
}

const BookCard: React.FC<BookCardProps> = ({ book, onClick, onRead, onAuthorClick, variant = 'full' }) => {
  const navigate = useNavigate();
  const { state } = useLocalUserState();
  const isSaved = state.savedBooks.some((entry) => entry.id === book.id);
  // Generate a deterministic aesthetic gradient based on ID
  const gradients = [
    "from-orange-500/20 to-purple-900/40",
    "from-blue-500/20 to-cyan-900/40",
    "from-emerald-500/20 to-teal-900/40",
    "from-rose-500/20 to-pink-900/40",
    "from-amber-500/20 to-orange-900/40",
  ];
  const bgGradient = gradients[book.title.length % gradients.length];

  return (
    <div
      onClick={() => onClick(book)}
      className={`group relative overflow-hidden rounded-xl border border-bit-border bg-bit-panel/30 hover:bg-bit-panel/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-bit-accent/30 ${variant === 'compact' ? 'p-0' : 'h-full flex flex-col shadow-sm'}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Decorative lines */}
      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
        <div className="w-16 h-[1px] bg-bit-text mb-1 ml-auto"></div>
        <div className="w-8 h-[1px] bg-bit-text ml-auto"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Cover Aspect Ratio container - Flush top with no margin */}
        <div className={`aspect-[4/5] w-full bg-gradient-to-b from-bit-panel/40 to-transparent flex items-center justify-center border-b border-bit-border shadow-md overflow-hidden group-hover:scale-[1.01] transition-transform duration-500 relative`}>

          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s] ease-out opacity-80 group-hover:opacity-100"
              alt={book.title}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543005127-d0d080007886?q=80&w=300&auto=format&fit=crop';
                (e.target as HTMLImageElement).classList.add('opacity-40');
              }}
            />
          ) : (
            // Abstract Book Cover Art
            <div className="w-full h-full relative bg-bit-panel/50">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-display font-bold text-lg leading-tight text-bit-text mb-1 line-clamp-3">{book.title}</h3>
                <p className="text-[10px] text-bit-muted/40 font-mono tracking-widest uppercase">{book.author}</p>
              </div>
            </div>
          )}

          {/* Always show category badge */}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/category/${encodeURIComponent(book.category)}`); }}
            className="absolute top-3 left-3 z-30 bg-bit-panel/80 backdrop-blur-md px-2 py-0.5 rounded border border-bit-border text-[9px] uppercase tracking-wider font-mono text-bit-accent shadow-sm hover:bg-bit-accent hover:text-white hover:border-bit-accent transition-all active:scale-95"
          >
            {book.category}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSavedBook(book); }}
            className={`absolute top-3 right-3 z-30 h-9 w-9 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
              isSaved
                ? 'bg-bit-accent text-white border-bit-accent shadow-lg shadow-bit-accent/30'
                : 'bg-bit-panel/80 text-bit-muted border-bit-border hover:border-bit-accent hover:text-bit-accent'
            }`}
            aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
          >
            <Bookmark size={16} className={isSaved ? 'fill-current' : ''} />
          </button>

          {/* Cinematic Overlay & Action HUD Stack */}
          <div className="absolute inset-0 bg-bit-panel/90 opacity-0 group-hover:opacity-100 backdrop-blur-[6px] transition-all duration-500 flex flex-col items-center justify-center p-6 gap-3 z-20">
            {onRead && (
              <button
                onClick={(e) => { e.stopPropagation(); onRead(book); }}
                className="w-full py-3 bg-bit-accent text-white rounded-xl shadow-lg shadow-bit-accent/30 flex items-center justify-center gap-3 transform -translate-y-4 group-hover:translate-y-0 transition-all duration-500 hover:scale-105 active:scale-95 border-2 border-bit-accent/10 group/btn"
              >
                <BookOpen size={18} />
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase">Read</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClick(book); }}
              className="w-full py-3 bg-bit-panel/50 text-bit-text rounded-xl border border-bit-border flex items-center justify-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 hover:bg-bit-panel/80 hover:border-bit-accent/30 hover:scale-105 active:scale-95"
            >
              <BarChart size={18} className="rotate-90" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-bit-muted">View Details</span>
            </button>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-bit-panel/60 via-transparent to-transparent opacity-60 pointer-events-none" />
        </div>

        {/* Content Sector with breathing room */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex flex-col h-full">
            <div className={variant === 'full' ? 'mb-4' : ''}>
              <h3 className={`font-display font-bold text-bit-text leading-tight line-clamp-2 group-hover:text-bit-accent transition-colors mb-1 ${variant === 'full' ? 'text-base' : 'text-sm'}`}>{book.title}</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); onAuthorClick?.(book.author); }}
                className="text-[9px] text-bit-muted/70 hover:text-bit-accent font-mono tracking-widest uppercase transition-colors text-left"
              >
                By {book.author}
              </button>
            </div>

            {variant === 'full' && (
              <div className="mt-auto">
                <div className="flex items-center justify-between text-[9px] text-bit-muted/50 font-mono pt-2 border-t border-bit-border group-hover:border-bit-accent/20 transition-colors">
                  <span className="flex items-center gap-1 uppercase">NODE_{book.year || 'UNK'}</span>
                  <span className="flex items-center gap-1 uppercase">{book.pages || 'INF'}_PAGES</span>
                  <span className="flex items-center gap-1 uppercase">{book.popularity}%_RANK</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
