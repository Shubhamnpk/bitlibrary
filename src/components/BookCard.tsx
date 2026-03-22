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
        {/* Cover Placeholder */}
        <div className={`aspect-[2/3] w-full rounded-lg bg-gradient-to-b from-white/5 to-transparent mb-4 flex items-center justify-center border border-white/5 shadow-2xl overflow-hidden group-hover:scale-[1.02] transition-transform duration-500`}>
           {/* Abstract Book Cover Art */}
           <div className="w-full h-full relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-display font-bold text-xl leading-tight text-white mb-1 line-clamp-3">{book.title}</h3>
                  <p className="text-sm text-white/60 font-sans">{book.author}</p>
              </div>
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-xs border border-white/10 uppercase tracking-wider font-mono text-bit-accent">
                {book.category}
              </div>
           </div>
        </div>

        {variant === 'full' && (
          <div className="mt-auto space-y-3">
             <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{book.description}</p>
             
             <div className="flex items-center justify-between text-xs text-gray-500 font-mono pt-3 border-t border-white/5">
                <span className="flex items-center gap-1"><Calendar size={12} /> {book.year}</span>
                <span className="flex items-center gap-1"><BookOpen size={12} /> {book.pages}p</span>
                <span className="flex items-center gap-1"><BarChart size={12} /> {book.popularity}%</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCard;
