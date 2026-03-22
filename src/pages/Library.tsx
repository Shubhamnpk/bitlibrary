import React, { useState } from 'react';
import { Book, ViewState } from '@/types/index';
import BookCard from '@/components/BookCard';
import { Library as LibraryIcon, Bookmark, Clock, ArrowRight, Zap, Filter, Search } from 'lucide-react';

interface LibraryProps {
  borrowedBooks: Book[];
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
  onExplore: () => void;
}

const Library: React.FC<LibraryProps> = ({ borrowedBooks, onBookClick, onRead, onExplore }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'saved'>('all');

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Neural Archive</h1>
          <p className="text-gray-500 font-mono text-sm leading-relaxed">Your personal stream of synthesized knowledge and stored volumes.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex bg-white/[0.03] border border-white/5 rounded-lg p-1">
                <button 
                  onClick={() => setActiveFilter('all')}
                  className={`px-4 py-1.5 rounded-md text-xs font-mono transition-all ${activeFilter === 'all' ? 'bg-bit-accent text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                >
                  ALL
                </button>
                <button 
                  onClick={() => setActiveFilter('recent')}
                  className={`px-4 py-1.5 rounded-md text-xs font-mono transition-all ${activeFilter === 'recent' ? 'bg-bit-accent text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                >
                  RECENT
                </button>
                <button 
                  onClick={() => setActiveFilter('saved')}
                  className={`px-4 py-1.5 rounded-md text-xs font-mono transition-all ${activeFilter === 'saved' ? 'bg-bit-accent text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                >
                  SAVED
                </button>
            </div>
            <button className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-gray-400 hover:text-white transition-colors">
                <Filter size={18} />
            </button>
        </div>
      </div>

      {borrowedBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
           {borrowedBooks.map(book => (
             <BookCard key={book.id} book={book} onClick={onBookClick} onRead={onRead} />
           ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
           <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center text-gray-600 mb-6">
              <LibraryIcon size={40} />
           </div>
           <h3 className="text-xl font-display font-semibold text-white mb-2">Archive Empty</h3>
           <p className="text-gray-500 font-mono text-sm mb-8 text-center max-w-sm px-6">You haven't initialized any neural streams. Start exploring to build your digital archive.</p>
           <button 
             onClick={onExplore}
             className="px-8 py-3 rounded-xl bg-bit-accent text-black font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(255,77,0,0.3)] hover:scale-105 transition-all flex items-center gap-2"
           >
             Start Exploration <ArrowRight size={18} />
           </button>
        </div>
      )}

      {/* Stats / Overview Section for a "Complete" feel */}
      <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-bit-accent/10 group-hover:text-bit-accent/20 transition-colors">
                <Clock size={100} />
            </div>
            <p className="text-gray-500 text-[10px] font-mono uppercase mb-1 tracking-widest">Time Spent Reading</p>
            <h4 className="text-3xl font-display font-bold text-white leading-none">0h 42m</h4>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-bit-accent">
                <Zap size={10} /> Syncing session...
            </div>
         </div>
         <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-bit-accent/10 group-hover:text-bit-accent/20 transition-colors">
                <Bookmark size={100} />
            </div>
            <p className="text-gray-500 text-[10px] font-mono uppercase mb-1 tracking-widest">Saved Volumes</p>
            <h4 className="text-3xl font-display font-bold text-white leading-none">0</h4>
            <div className="mt-4 h-1 bg-white/5 rounded-full">
                <div className="h-full bg-bit-accent w-0" />
            </div>
         </div>
         <div className="glass-panel p-6 rounded-2xl border-bit-accent/20 bg-bit-accent/5">
            <h4 className="text-lg font-display font-bold text-bit-accent mb-2">Upgrade Archive</h4>
            <p className="text-xs text-gray-400 mb-4 font-mono">Unlock unlimited neural streams and offline access for free during v2.0 beta.</p>
            <button className="w-full py-2 bg-bit-accent text-black rounded-lg text-xs font-bold font-mono">ENROLL NOW</button>
         </div>
      </section>
    </div>
  );
};

export default Library;
