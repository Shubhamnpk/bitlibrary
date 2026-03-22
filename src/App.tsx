import React, { useState, useEffect, useCallback } from 'react';
import { Book, ViewState } from '@/types/index';
import { INITIAL_BOOKS, CATEGORIES } from '@/constants';
import { searchBooksWithGemini } from '@/services/geminiService';
import BookCard from '@/components/BookCard';
import Reader from '@/components/Reader';
import { Search, Library, Zap, Command, Menu, X, Github, Disc } from 'lucide-react';
import BookDetails from '@/pages/BookDetails';
import LibraryPage from '@/pages/Library';
import BrowseBooks from '@/pages/BrowseBooks';
import StaticPage from '@/pages/StaticPage';

const App: React.FC = () => {
  const [view, setViewState] = useState<ViewState>(ViewState.HOME);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]); // To be handled by Convex later
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Custom setter for view to handle scroll
  const setView = (v: ViewState) => {
    setViewState(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Demo: Sync library on load
  useEffect(() => {
    if (borrowedBooks.length === 0 && INITIAL_BOOKS.length > 0) {
      setBorrowedBooks([INITIAL_BOOKS[0], INITIAL_BOOKS[1]]);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        const results = await searchBooksWithGemini(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
        // Special case: if user is in Browse/Library but searches, jump to Search view
        if (![ViewState.SEARCH, ViewState.DETAILS, ViewState.READER].includes(view)) {
           setView(ViewState.SEARCH);
        }
      } else if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        if (view === ViewState.SEARCH) setView(ViewState.HOME);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery, view]);

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setView(ViewState.DETAILS);
  };

  const openFullReader = (book: Book) => {
    setSelectedBook(book);
    setView(ViewState.READER);
  }

  const closeView = () => {
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
             <button onClick={() => setView(ViewState.BOOKS)} className={`text-sm font-medium hover:text-white transition-colors ${view === ViewState.BOOKS ? 'text-white' : 'text-gray-400'}`}>Books</button>
             <button onClick={() => setView(ViewState.LIBRARY)} className={`text-sm font-medium hover:text-white transition-colors ${view === ViewState.LIBRARY ? 'text-white' : 'text-gray-400'}`}>Library</button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center cursor-pointer">
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
            <Reader book={selectedBook} onClose={() => setView(ViewState.DETAILS)} />
        )}

        {view === ViewState.DETAILS && selectedBook && (
            <BookDetails 
               book={selectedBook} 
               allBooks={INITIAL_BOOKS} 
               onClose={closeView} 
               onRead={() => setView(ViewState.READER)}
               onBookClick={handleBookClick}
            />
        )}

        {view === ViewState.LIBRARY && (
            <LibraryPage 
               borrowedBooks={borrowedBooks} 
               onBookClick={handleBookClick} 
               onExplore={() => setView(ViewState.HOME)} 
            />
        )}

        {view === ViewState.BOOKS && (
            <BrowseBooks onBookClick={handleBookClick} />
        )}

        {(view === ViewState.ABOUT || view === ViewState.TERMS) && (
            <StaticPage 
               type={view === ViewState.ABOUT ? 'about' : 'terms'} 
               onBack={() => setView(ViewState.HOME)} 
            />
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
                    Knowledge stream <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-600">at machine speed.</span>
                 </h1>
                 <p className="text-lg text-gray-400 max-w-2xl mb-8 leading-relaxed">
                   Access an infinite neural archive of synthesized knowledge. 
                   Real-time retrieval of massive scale academia powered by the Gemini Neural Engine.
                 </p>
                 
                 <div className="flex flex-wrap gap-4">
                   {CATEGORIES.slice(0, 5).map(cat => (
                     <button 
                        key={cat}
                        onClick={() => { setSearchQuery(cat); setView(ViewState.SEARCH); }}
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
                <h2 className="text-2xl font-display font-semibold text-white">Featured Neural Nodes</h2>
                <button onClick={() => setView(ViewState.BOOKS)} className="text-sm text-bit-accent hover:underline font-mono">View All</button>
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

      {/* Enhanced Footer */}
      <footer className="border-t border-white/5 pt-20 pb-12 bg-black relative overflow-hidden">
         <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bit-accent/50 to-transparent opacity-20" />
         
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
               {/* Brand & Mission section */}
               <div className="lg:col-span-4">
                  <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 bg-bit-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.3)]">
                        <Zap className="text-black fill-black" size={18} />
                      </div>
                      <span className="font-display font-bold text-2xl text-white">BitLibrary</span>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-sm">
                     Operating the world's most advanced synthetic knowledge archive. 
                     Powered by Gemini-3 Flash and decentralized edge nodes. 
                     Scaling academia to its neural limit.
                  </p>
                  <div className="flex gap-4">
                     <button className="p-2 rounded-full border border-white/5 hover:border-bit-accent/50 hover:text-bit-accent transition-all"><Github size={18} /></button>
                     <button className="p-2 rounded-full border border-white/5 hover:border-bit-accent/50 hover:text-bit-accent transition-all"><Disc size={18} /></button>
                     <button className="p-2 rounded-full border border-white/5 hover:border-bit-accent/50 hover:text-bit-accent transition-all"><Zap size={18} /></button>
                  </div>
               </div>

               {/* Links Grid */}
               <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8">
                  <div>
                     <h4 className="text-white font-display font-medium mb-6 uppercase tracking-widest text-[10px]">Registry</h4>
                     <ul className="space-y-4 text-sm text-gray-500 font-mono">
                        <li><button onClick={() => setView(ViewState.BOOKS)} className="hover:text-bit-accent transition-all">Browse All</button></li>
                        <li><button onClick={() => setView(ViewState.HOME)} className="hover:text-bit-accent transition-all">Collections</button></li>
                        <li><button onClick={() => setView(ViewState.LIBRARY)} className="hover:text-bit-accent transition-all">My Archive</button></li>
                        <li><button className="hover:text-bit-accent transition-all">Gutendex Beta</button></li>
                     </ul>
                  </div>
                  <div>
                     <h4 className="text-white font-display font-medium mb-6 uppercase tracking-widest text-[10px]">Protocol</h4>
                     <ul className="space-y-4 text-sm text-gray-500 font-mono">
                        <li><button onClick={() => setView(ViewState.ABOUT)} className="hover:text-bit-accent transition-all">About Engine</button></li>
                        <li><button onClick={() => setView(ViewState.TERMS)} className="hover:text-bit-accent transition-all">Terms of Use</button></li>
                        <li><button className="hover:text-bit-accent transition-all">Neural Audit</button></li>
                        <li><button className="hover:text-bit-accent transition-all">API Node</button></li>
                     </ul>
                  </div>
                  <div className="hidden md:block">
                     <h4 className="text-white font-display font-medium mb-6 uppercase tracking-widest text-[10px]">Lab Status</h4>
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                           <span className="text-[10px] text-gray-500 font-mono">NODE: STABLE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-bit-accent shadow-[0_0_8px_rgba(255,77,0,0.6)] animate-pulse" />
                            <span className="text-[10px] text-gray-500 font-mono">SYNC: ACTIVE</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Recruitment / Newsletter Section */}
               <div className="lg:col-span-3">
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-bit-accent/30 transition-all">
                     <div className="absolute inset-0 bg-gradient-to-br from-bit-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <h4 className="text-white font-display font-bold mb-2">Join the Lab</h4>
                     <p className="text-xs text-gray-500 mb-6 font-mono leading-relaxed">
                        Stay notified of new neural streams and engine upgrades.
                     </p>
                     <div className="relative">
                        <input 
                           type="email" 
                           placeholder="ARCHIVE_ID@EMAIL.NET" 
                           className="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-[10px] font-mono focus:outline-none focus:border-bit-accent/50 transition-all"
                        />
                        <button className="absolute right-1 top-1 bottom-1 px-3 bg-bit-accent text-black text-[10px] font-bold rounded-md hover:scale-95 transition-all">ENROLL</button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pt-12">
               <div className="flex items-center gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                  <span>© 2026 BitNepal Lab</span>
                  <span className="h-1 w-1 bg-gray-800 rounded-full" />
                  <span>Spliced via Gemini Neural Core</span>
               </div>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-600">INFRASTRUCTURE STATUS:</span>
                  <div className="flex gap-1">
                     {[1,2,3,4,5,6].map(i => (
                        <div key={i} className={`h-1 w-4 rounded-full ${i < 5 ? 'bg-bit-accent/30' : 'bg-gray-800'}`} />
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </footer>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-bit-bg md:hidden animate-fade-in flex flex-col items-center justify-center gap-10 p-8 text-center">
           <button className="absolute top-6 right-6 text-white" onClick={() => setMobileMenuOpen(false)}>
              <X size={28} />
           </button>
           <nav className="flex flex-col items-center gap-8">
              <button onClick={() => { setView(ViewState.HOME); setMobileMenuOpen(false); }} className={`text-4xl font-display font-bold ${view === ViewState.HOME ? 'text-bit-accent' : 'text-white'}`}>Discover</button>
              <button onClick={() => { setView(ViewState.BOOKS); setMobileMenuOpen(false); }} className={`text-4xl font-display font-bold ${view === ViewState.BOOKS ? 'text-bit-accent' : 'text-white'}`}>Books</button>
              <button onClick={() => { setView(ViewState.LIBRARY); setMobileMenuOpen(false); }} className={`text-4xl font-display font-bold ${view === ViewState.LIBRARY ? 'text-bit-accent' : 'text-white'}`}>Library</button>
              <button onClick={() => { setView(ViewState.ABOUT); setMobileMenuOpen(false); }} className="text-xl font-mono text-gray-500">About Node</button>
           </nav>
           <div className="mt-10 flex gap-10 text-gray-500">
              <Github size={24} />
              <Disc size={24} />
              <Zap size={24} />
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
