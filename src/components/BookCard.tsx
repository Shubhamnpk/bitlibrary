import React from 'react';
import { Book } from '@/types/index';
import { BookOpen, User, Calendar, BarChart } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  variant?: 'compact' | 'full';
}

const BookCard: React.FC<BookCardProps> = ({ book, onClick, variant = 'full' }) => {
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
      className={`group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-bit-accent/30 ${variant === 'compact' ? 'p-4' : 'h-full flex flex-col'}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      {/* Decorative lines */}
      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
        <div className="w-16 h-[1px] bg-white mb-1 ml-auto"></div>
        <div className="w-8 h-[1px] bg-white ml-auto"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Cover Aspect Ratio container - Decreased height ratio */}
        <div className={`aspect-[4/5] w-full rounded-lg bg-gradient-to-b from-white/10 to-transparent mb-3 flex items-center justify-center border border-white/5 shadow-2xl overflow-hidden group-hover:scale-[1.01] transition-transform duration-500 relative`}>
           
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
              <div className="w-full h-full relative">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="absolute bottom-4 left-4 right-4">
                     <h3 className="font-display font-bold text-lg leading-tight text-white mb-1 line-clamp-3">{book.title}</h3>
                     <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase">{book.author}</p>
                 </div>
              </div>
           )}

           {/* Always show category badge */}
           <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-[9px] uppercase tracking-wider font-mono text-bit-accent shadow-xl">
             {book.category}
           </div>

           {/* Cinematic Overlay */}
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />
        </div>

        {variant === 'full' && (
          <div className="mt-auto space-y-2">
             <p className="text-[11px] text-gray-500 line-clamp-1 leading-relaxed font-sans group-hover:text-gray-400 transition-colors uppercase tracking-tight">{book.description}</p>
             
             <div className="flex items-center justify-between text-[9px] text-gray-600 font-mono pt-2 border-t border-white/5 group-hover:border-bit-accent/20 transition-colors">
                <span className="flex items-center gap-1 uppercase">NODE_{book.year || 'UNK'}</span>
                <span className="flex items-center gap-1 uppercase">{book.pages || 'INF'}_PAGES</span>
                <span className="flex items-center gap-1 uppercase">{book.popularity}%_RANK</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCard;
