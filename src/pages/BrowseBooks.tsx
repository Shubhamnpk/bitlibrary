import React, { useState } from 'react';
import { Book } from '@/types/index';
import { CATEGORIES, INITIAL_BOOKS } from '@/constants';
import BookCard from '@/components/BookCard';
import { Filter, Search, Zap, SlidersHorizontal, ChevronDown, LayoutGrid, List } from 'lucide-react';

interface BrowseBooksProps {
  onBookClick: (book: Book) => void;
}

const BrowseBooks: React.FC<BrowseBooksProps> = ({ onBookClick }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'featured' | 'new' | 'popular'>('featured');

  const filteredBooks = selectedCategory === 'All' 
    ? INITIAL_BOOKS 
    : INITIAL_BOOKS.filter(b => b.category === selectedCategory);

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-12">
         <h1 className="text-5xl font-display font-bold text-white mb-4">The Book Vault</h1>
         <p className="text-gray-500 font-mono text-sm max-w-xl">
           Browse over 2.4 Million neural volumes synthesized from the world's knowledge. 
           Access instantly via the Gemini Neural Engine.
         </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-12 border-b border-white/5 pb-8">
         <div className="flex flex-wrap gap-2 flex-1">
            <button 
               onClick={() => setSelectedCategory('All')}
               className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === 'All' ? 'bg-bit-accent border-bit-accent text-black font-bold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
            >
               ALL
            </button>
            {CATEGORIES.slice(0, 6).map(cat => (
               <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${selectedCategory === cat ? 'bg-bit-accent border-bit-accent text-black font-bold' : 'border-white/10 text-gray-400 hover:border-white/30'}`}
               >
                  {cat.toUpperCase()}
               </button>
            ))}
         </div>
         
         <div className="flex items-center gap-4">
            <div className="h-10 w-[1px] bg-white/5 hidden md:block" />
            <button className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-xs font-mono text-gray-300 hover:text-white transition-colors">
               <SlidersHorizontal size={14} /> FILTERS
            </button>
            <div className="flex gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/5">
                <button className="p-1.5 bg-white/10 rounded text-white transition-colors"><LayoutGrid size={16} /></button>
                <button className="p-1.5 text-gray-600 hover:text-white transition-colors"><List size={16} /></button>
            </div>
         </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
         {filteredBooks.map(book => (
            <div key={book.id} className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
               <BookCard book={book} onClick={onBookClick} />
            </div>
         ))}
      </div>

      {/* Pagination Placeholder */}
      <div className="mt-20 flex flex-col items-center gap-6">
         <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
         <button className="group flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-gray-600 group-hover:text-bit-accent transition-colors">LOAD MORE ENTITIES</span>
            <ChevronDown className="text-gray-700 group-hover:text-bit-accent animate-bounce" />
         </button>
      </div>
    </div>
  );
};

export default BrowseBooks;
