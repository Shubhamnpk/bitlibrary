import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Disc, Command, Clock3, ArrowUpRight, Zap, X, Menu, House, Library, BookOpenText, Info } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  isReaderActive: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearchSubmit: (e?: React.FormEvent) => void;
  isSearching: boolean;
  showSearchSurface: boolean;
  trimmedSearchQuery: string;
  SEARCH_MIN_QUERY_LENGTH: number;
  searchDropdownRecent: string[];
  searchDropdownSuggestions: string[];
  applySearchSelection: (query: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  localUserState: any;
  handleMobileMenuSearchSubmit: (e: React.FormEvent) => void;
  activeTab: (path: string) => boolean;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchShellRef: React.RefObject<HTMLDivElement>;
  setIsSearchFocused: (focused: boolean) => void;
  mobileQuickTopics: string[];
  navigateToSearch: (query: string, options?: { persistRecent?: boolean }) => void;
}

const Navbar: React.FC<NavbarProps> = ({
  isReaderActive,
  searchQuery,
  setSearchQuery,
  handleSearchSubmit,
  isSearching,
  showSearchSurface,
  trimmedSearchQuery,
  SEARCH_MIN_QUERY_LENGTH,
  searchDropdownRecent,
  searchDropdownSuggestions,
  applySearchSelection,
  mobileMenuOpen,
  setMobileMenuOpen,
  localUserState,
  handleMobileMenuSearchSubmit,
  activeTab,
  searchInputRef,
  searchShellRef,
  setIsSearchFocused,
  mobileQuickTopics,
  navigateToSearch
}) => {
  if (isReaderActive) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-bit-border/50 bg-bit-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group min-w-0">
            <img
              src="/assets/bitlibrary-icon-clean.svg"
              alt="BitLibrary"
              className="w-9 h-9 shrink-0 transition-transform group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-xl tracking-tight text-bit-text leading-none">BitLibrary</p>
              <p className="hidden lg:block text-[9px] font-mono uppercase tracking-[0.22em] text-bit-accent/80 mt-1">
                The Open Digital Library
              </p>
            </div>
          </Link>

          {/* Desktop Search */}
          <div ref={searchShellRef} className="hidden md:block flex-1 max-w-lg mx-8 relative">
            <form onSubmit={handleSearchSubmit} className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bit-muted group-focus-within:text-bit-accent transition-colors" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search books, authors... (Press /)"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bit-panel/30 border border-bit-border rounded-full py-2 pl-10 pr-24 text-sm focus:outline-none focus:border-bit-accent/50 focus:bg-bit-panel/50 transition-all placeholder:text-bit-muted/50"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {trimmedSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted hover:text-bit-text transition-colors"
                  >
                    Clear
                  </button>
                )}
                {isSearching ? (
                  <div className="animate-spin text-bit-accent">
                    <Disc size={16} />
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-full bg-bit-accent text-white text-[10px] font-mono uppercase tracking-[0.2em] hover:scale-[0.98] transition-all shadow-sm"
                  >
                    Search
                  </button>
                )}
              </div>
            </form>

            {showSearchSurface && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] rounded-3xl border border-bit-border bg-bit-panel/95 backdrop-blur-2xl shadow-2xl shadow-bit-bg/40 overflow-hidden">
                <div className="px-5 py-4 border-b border-bit-border/40 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Search Control</p>
                    <p className="text-sm text-bit-muted mt-1">
                      {trimmedSearchQuery.length >= SEARCH_MIN_QUERY_LENGTH
                        ? `Press Enter to open results for "${trimmedSearchQuery}".`
                        : `Type at least ${SEARCH_MIN_QUERY_LENGTH} characters to start searching.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                    <Command size={12} />
                    /
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-0">
                  <div className="p-5 border-r border-bit-border/40">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted mb-4">
                      <Clock3 size={12} />
                      Recent Searches
                    </div>
                    <div className="space-y-2">
                      {searchDropdownRecent.length > 0 ? searchDropdownRecent.map((query) => (
                        <button
                          key={query}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySearchSelection(query)}
                          className="w-full flex items-center justify-between rounded-2xl border border-bit-border bg-bit-panel/30 px-4 py-3 text-left hover:border-bit-accent/30 hover:bg-bit-panel/50 transition-all group"
                        >
                          <span className="text-sm text-bit-text">{query}</span>
                          <ArrowUpRight size={14} className="text-bit-muted group-hover:text-bit-accent transition-colors" />
                        </button>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-bit-border px-4 py-6 text-sm text-bit-muted">
                          Your recent searches will show up here.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted mb-4">
                      <Zap size={12} />
                      Explore Topics
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchDropdownSuggestions.map((query) => (
                        <button
                          key={query}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySearchSelection(query)}
                          className="px-3 py-2 rounded-full border border-bit-border bg-bit-panel/30 text-[11px] text-bit-muted hover:text-bit-text hover:border-bit-accent/40 hover:bg-bit-accent/10 transition-all"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl border border-bit-accent/20 bg-bit-accent/5 p-4">
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent mb-2">Search Tips</p>
                      <p className="text-sm text-bit-muted leading-relaxed">
                        Try author names, subjects, or themes for richer results from every archive source.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-6 font-mono text-xs tracking-wider">
            <Link to="/" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Discover</Link>
            <Link to="/library" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/library') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Library</Link>
            <Link to="/mylibrary" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/mylibrary') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>My Library</Link>
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-bit-panel to-bit-border border border-bit-border flex items-center justify-center cursor-pointer hover:border-bit-accent/50 transition-all">
              <span className="text-[10px] font-bold text-bit-text">US</span>
            </div>
          </div>

          <button className="md:hidden text-bit-text" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          aria-label="Close mobile menu backdrop"
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-bit-bg/65 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
        />

        <aside
          className={`absolute right-0 top-0 h-full w-[90vw] max-w-sm border-l border-bit-border bg-bit-bg shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between border-b border-bit-border px-5 h-16">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Navigation Hub</p>
              <p className="text-xs text-bit-muted truncate">Hi {localUserState.profile.displayName || 'Reader'}</p>
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted hover:text-bit-text hover:border-bit-accent/40 transition-all"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close mobile menu"
            >
              <X size={18} className="mx-auto" />
            </button>
          </div>

          <div className="h-[calc(100%-4rem)] overflow-y-auto px-5 py-5 space-y-6">
            <form onSubmit={handleMobileMenuSearchSubmit} className="rounded-2xl border border-bit-border bg-bit-panel/35 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-2">Quick Search</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search books or authors..."
                  className="flex-1 rounded-xl border border-bit-border bg-bit-bg/60 px-3 py-2 text-sm text-bit-text placeholder:text-bit-muted/60 focus:outline-none focus:border-bit-accent/40"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-bit-accent text-white px-3 py-2 text-[10px] font-mono uppercase tracking-widest"
                >
                  Go
                </button>
              </div>
            </form>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-3">Main Routes</p>
              <div className="space-y-2">
                <Link to="/" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <House size={16} />
                  Discover
                </Link>
                <Link to="/library" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/library') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <Library size={16} />
                  Library
                </Link>
                <Link to="/mylibrary" className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${activeTab('/mylibrary') ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:text-bit-text hover:border-bit-accent/30'}`}>
                  <BookOpenText size={16} />
                  My Library
                </Link>
                <Link to="/about" className="flex items-center gap-3 rounded-xl border border-bit-border bg-bit-panel/30 px-3 py-2 text-sm text-bit-muted hover:text-bit-text hover:border-bit-accent/30 transition-all">
                  <Info size={16} />
                  About
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent mb-3">Quick Topics</p>
              <div className="flex flex-wrap gap-2">
                {mobileQuickTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setSearchQuery(topic);
                      navigateToSearch(topic, { persistRecent: true });
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-full border border-bit-border bg-bit-panel/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-text hover:border-bit-accent/30 transition-all"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Theme</p>
                  <p className="text-xs text-bit-muted mt-1">Switch light or dark mode.</p>
                </div>
                <ThemeToggle />
              </div>
            </section>
          </div>
        </aside>
      </div>
    </>
  );
};

export default Navbar;
