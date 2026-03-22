import React, { useState, useEffect, useCallback } from 'react';
import { Book, ViewState } from '@/types/index';
import { INITIAL_BOOKS, CATEGORIES } from '@/constants';
import { searchBooksWithGemini } from '@/services/geminiService';
import BookCard from '@/components/BookCard';
import Reader from '@/components/Reader';
import { Search, Library, Zap, Command, Menu, X, Github, Disc } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        const results = await searchBooksWithGemini(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
        if (view !== ViewState.SEARCH) setView(ViewState.SEARCH);
      } else if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        if (view === ViewState.SEARCH) setView(ViewState.HOME);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery, view]);

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setView(ViewState.READER);
  };

  const closeReader = () => {
    setSelectedBook(null);
    setView(ViewState.HOME);
  };

  return (
    <div className="min-h-screen bg-bit-bg text-bit-text font-sans selection:bg-bit-accent selection:text-black">
      {/* Background Grid & Effects */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-bit-bg/50 to-bit-bg pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-bit-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(ViewState.HOME)}>
            <div className="w-8 h-8 bg-bit-accent rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.4)]">
              <Zap className="text-black fill-black" size={18} />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">BitLibrary</span>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex items-center flex-1 max-w-lg mx-8 relative group">
            <Search className="absolute left-3 text-gray-500 group-focus-within:text-bit-accent transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search for books, topics, or authors..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-bit-accent/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-600 font-mono"
            />
             {isSearching && (
               <div className="absolute right-3 animate-spin text-bit-accent">
                 <Disc size={18} />
               </div>
             )}
          </div>

          <div className="hidden md:flex items-center gap-6">
             <button onClick={() => setView(ViewState.HOME)} className={`text-sm font-medium hover:text-white transition-colors ${view === ViewState.HOME ? 'text-white' : 'text-gray-400'}`}>Discover</button>
             <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Library</button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center">
                <span className="text-xs font-bold text-white">US</span>
             </div>
          </div>

          <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Main Layout */}
      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen flex flex-col relative z-0">
        
        {view === ViewState.READER && selectedBook && (
            <Reader book={selectedBook} onClose={closeReader} />
        )}

        {/* Home / Discovery View */}
        {view === ViewState.HOME && (
          <div className="animate-fade-in-up">
            {/* Hero Section */}
            <section className="mb-16 relative">
               <div className="absolute -top-20 -left-20 w-96 h-96 bg-bit-accent/10 rounded-full blur-[100px] pointer-events-none" />
               <div className="relative z-10">
                 <span className="inline-block py-1 px-3 rounded-full border border-bit-accent/30 bg-bit-accent/10 text-bit-accent text-xs font-mono mb-4">
                   v2.0 • AI Powered Library
                 </span>
                 <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
                   Discover knowledge <br />
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-600">at the speed of thought.</span>
                 </h1>
                 <p className="text-lg text-gray-400 max-w-2xl mb-8 leading-relaxed">
                   Access a limitless stream of academic resources generated in real-time. 
                   Powered by Gemini Neural Engine for instant retrieval and synthesis.
                 </p>
                 
                 <div className="flex flex-wrap gap-4">
                   {CATEGORIES.slice(0, 5).map(cat => (
                     <button 
                        key={cat}
                        onClick={() => setSearchQuery(cat)}
                        className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 hover:border-bit-accent/50 hover:bg-white/[0.06] text-sm text-gray-300 transition-all font-mono"
                     >
                       {cat}
                     </button>
                   ))}
                 </div>
               </div>
            </section>

            {/* Featured Grid */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display font-semibold text-white">Featured Reads</h2>
                <button className="text-sm text-bit-accent hover:underline font-mono">View All</button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredBooks.map(book => (
                  <BookCard key={book.id} book={book} onClick={handleBookClick} />
                ))}
              </div>
            </section>

             {/* Bento Grid Layout Example */}
             <section className="mt-20">
                <h2 className="text-2xl font-display font-semibold text-white mb-8">Curated Collections</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-4 h-[600px]">
                    <div className="col-span-1 md:col-span-2 row-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-8 relative overflow-hidden group cursor-pointer hover:border-white/10 transition-colors">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <h3 className="text-3xl font-display font-bold text-white relative z-10">The Quantum Era</h3>
                        <p className="text-gray-400 mt-2 max-w-md relative z-10">Essential readings on quantum mechanics, computing, and the future of physics.</p>
                        <div className="absolute bottom-8 right-8 text-bit-accent">
                            <Zap size={40} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 relative group overflow-hidden cursor-pointer hover:border-white/10 transition-colors">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30">
                            <Library size={60} />
                         </div>
                         <h3 className="text-xl font-display font-bold text-white">Philosophy</h3>
                         <p className="text-sm text-gray-500 mt-1">128 Books</p>
                    </div>
                     <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 relative group overflow-hidden cursor-pointer hover:border-white/10 transition-colors">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30">
                            <Command size={60} />
                         </div>
                         <h3 className="text-xl font-display font-bold text-white">Computer Science</h3>
                         <p className="text-sm text-gray-500 mt-1">256 Books</p>
                    </div>
                </div>
             </section>
          </div>
        )}

        {/* Search Results View */}
        {view === ViewState.SEARCH && (
           <div className="animate-fade-in">
              <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-3xl font-display font-bold text-white">
                    {isSearching ? 'Scanning Archives...' : `Results for "${searchQuery}"`}
                  </h2>
              </div>
              
              {isSearching ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 opacity-50">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-96 rounded-xl bg-white/5 animate-pulse"></div>
                    ))}
                 </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {searchResults.length > 0 ? (
                      searchResults.map(book => (
                        <BookCard key={book.id} book={book} onClick={handleBookClick} />
                      ))
                  ) : (
                      <div className="col-span-full py-20 text-center">
                          <p className="text-gray-500 font-mono">No entities found in the stream.</p>
                      </div>
                  )}
                </div>
              )}
           </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white/10 rounded-sm flex items-center justify-center">
                  <Zap className="text-white" size={12} />
                </div>
                <span className="font-display font-bold text-white">BitLibrary</span>
            </div>
            <div className="flex gap-8 text-sm text-gray-500 font-mono">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">API</a>
            </div>
            <div className="text-gray-600">
                <Github size={20} />
            </div>
         </div>
      </footer>
    </div>
  );
};

export default App;
