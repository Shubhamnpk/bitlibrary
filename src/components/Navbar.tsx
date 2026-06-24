import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Disc, Command, Clock3, ArrowUpRight, Zap, X, Menu, House, Library, BookOpenText, Info, AudioLines, GraduationCap, User, ChevronDown, Bookmark, Headphones, History, Settings, FileText, Mic, Microscope } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getSpeechRecognitionConstructor, isSpeechRecognitionContextAllowed, requestMicrophoneForSpeech } from '@/lib/speech';

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
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchShellRef: React.RefObject<HTMLDivElement | null>;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSearchError, setVoiceSearchError] = useState('');
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = localUserState.profile.displayName || 'Reader';
  const profileInitials = useMemo(() => {
    const initials = displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('');

    return initials || 'US';
  }, [displayName]);

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const handleVoiceSearch = async () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (voiceListening) return;

    if (!SpeechRecognition) {
      setVoiceSearchError('Voice search is not supported in this browser.');
      return;
    }

    if (!isSpeechRecognitionContextAllowed()) {
      setVoiceSearchError('Voice search needs HTTPS or localhost in Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = /[\u0900-\u097F]/u.test(searchQuery) ? 'ne-NP' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceSearchError('');
      setVoiceListening(true);
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = (event) => {
      setVoiceListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceSearchError('Microphone permission is blocked for this site.');
      } else if (event.error === 'no-speech') {
        setVoiceSearchError('No speech was detected. Try again.');
      } else {
        setVoiceSearchError('Voice search could not start in this browser.');
      }
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (!transcript) return;
      setVoiceSearchError('');
      setSearchQuery(transcript);
      navigateToSearch(transcript, { persistRecent: true });
      setMobileMenuOpen(false);
    };
    try {
      await requestMicrophoneForSpeech();
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceSearchError('Microphone permission is blocked for this site.');
    }
  };

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
            <form onSubmit={handleSearchSubmit} className="relative group flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bit-muted group-focus-within:text-bit-accent transition-colors" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search books, authors... (Press /)"
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bit-panel/30 border border-bit-border rounded-full py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-bit-accent/50 focus:bg-bit-panel/50 transition-all placeholder:text-bit-muted/50"
                />
                {trimmedSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-bit-muted hover:text-bit-text transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`text-bit-muted transition-colors hover:text-bit-accent ${voiceListening ? 'text-bit-accent' : ''}`}
                  aria-label="Search by voice"
                  title={voiceSearchError || 'Search by voice'}
                >
                  <Mic size={15} />
                </button>
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
                <div className="px-5 py-4 border-b border-bit-border/40 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Search Control</p>
                      <p className="text-sm text-bit-muted mt-1">
                        {voiceSearchError
                          ? voiceSearchError
                          : trimmedSearchQuery.length >= SEARCH_MIN_QUERY_LENGTH
                          ? `Press Enter to open results for "${trimmedSearchQuery}".`
                          : `Type at least ${SEARCH_MIN_QUERY_LENGTH} characters to start searching.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                      <Command size={12} />
                      /
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted/40 border border-bit-border/30 rounded-full px-3 py-1.5">
                      Modes — coming soon
                    </span>
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
            <Link to="/" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Home</Link>
            <Link to="/library" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/library') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Library</Link>
            <Link to="/research" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/research') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Research</Link>
            <Link to="/curriculum" className={`hover:text-bit-text transition-colors uppercase ${activeTab('/curriculum') ? 'text-bit-accent font-bold' : 'text-bit-muted'}`}>Curriculum</Link>
            <ThemeToggle />
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={`flex items-center gap-2 rounded-full border px-1.5 py-1 transition-all ${profileOpen ? 'border-bit-accent/60 bg-bit-panel text-bit-text' : 'border-bit-border bg-bit-panel/40 text-bit-muted hover:border-bit-accent/50 hover:text-bit-text'}`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-bit-border bg-gradient-to-tr from-bit-panel to-bit-border text-[10px] font-bold text-bit-text">
                  {profileInitials}
                </span>
                <ChevronDown size={13} className={`transition-transform ${profileOpen ? 'rotate-180 text-bit-accent' : ''}`} />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.75rem)] w-80 overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/95 text-bit-text shadow-2xl shadow-bit-bg/35 backdrop-blur-2xl"
                >
                  <div className="border-b border-bit-border/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-bit-accent/30 bg-bit-accent/10 text-sm font-bold text-bit-accent">
                        {profileInitials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{displayName}</p>
                        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">book lover</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-bit-border/50 text-center">
                    <div className="px-3 py-3">
                      <p className="text-sm font-bold text-bit-text">{localUserState.savedBooks.length}</p>
                      <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-bit-muted">Books</p>
                    </div>
                    <div className="border-x border-bit-border/50 px-3 py-3">
                      <p className="text-sm font-bold text-bit-text">{localUserState.savedAudiobooks.length}</p>
                      <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-bit-muted">Audio</p>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-sm font-bold text-bit-text">{localUserState.recentlyViewed.length}</p>
                      <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-bit-muted">Recent</p>
                    </div>
                  </div>

                  <div className="p-2">
                    <Link
                      to="/mylibrary"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-bit-muted transition-all hover:bg-bit-bg/50 hover:text-bit-text"
                    >
                      <Bookmark size={16} className="text-bit-accent" />
                      My Library
                    </Link>
                    <Link
                      to="/audiobooks"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-bit-muted transition-all hover:bg-bit-bg/50 hover:text-bit-text"
                    >
                      <Headphones size={16} className="text-bit-accent" />
                      Audiobooks
                    </Link>
                    <Link
                      to="/search"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-bit-muted transition-all hover:bg-bit-bg/50 hover:text-bit-text"
                    >
                      <History size={16} className="text-bit-accent" />
                      Search history
                    </Link>
                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-bit-muted transition-all hover:bg-bit-bg/50 hover:text-bit-text"
                    >
                      <Settings size={16} className="text-bit-accent" />
                      Profile
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-bit-border/50 px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted">
                      <Settings size={13} />
                      Theme
                    </div>
                    <ThemeToggle />
                  </div>
                </div>
              )}
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
          className={`absolute right-0 top-0 h-full w-[85vw] max-w-sm border-l border-bit-border bg-bit-bg shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-label="Mobile navigation"
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/bitlibrary-icon-clean.svg"
                  alt="BitLibrary"
                  className="w-7 h-7"
                />
                <span className="text-sm font-display font-bold text-bit-text">BitLibrary</span>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-lg text-bit-muted hover:text-bit-text hover:bg-bit-panel/50 transition-all flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close mobile menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile row */}
            <div className="flex items-center gap-3 px-5 py-3 border-t border-bit-border/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bit-accent/30 bg-bit-accent/10 text-[10px] font-bold text-bit-accent">
                {profileInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-bit-text">{displayName}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">Local reader profile</p>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <House size={17} className="shrink-0" />
                Discover
              </Link>
              <Link
                to="/library"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/library')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <Library size={17} className="shrink-0" />
                Library
              </Link>
              <Link
                to="/research"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/research')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <Microscope size={17} className="shrink-0" />
                Research
              </Link>
              <Link
                to="/audiobooks"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/audiobooks')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <AudioLines size={17} className="shrink-0" />
                Audiobooks
              </Link>
              <Link
                to="/curriculum"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/curriculum')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <GraduationCap size={17} className="shrink-0" />
                Curriculum
              </Link>

              <div className="my-3 border-t border-bit-border/40" />

              <Link
                to="/mylibrary"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/mylibrary')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <BookOpenText size={17} className="shrink-0" />
                My Library
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab('/profile')
                    ? 'bg-bit-accent/10 text-bit-accent'
                    : 'text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text'
                }`}
              >
                <Settings size={17} className="shrink-0" />
                Profile
              </Link>

              <div className="my-3 border-t border-bit-border/40" />

              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text transition-all"
              >
                <Info size={17} className="shrink-0" />
                About
              </Link>
              <Link
                to="/sources"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-bit-muted hover:bg-bit-panel/40 hover:text-bit-text transition-all"
              >
                <FileText size={17} className="shrink-0" />
                Sources & Credits
              </Link>
            </nav>

            {/* Theme toggle footer */}
            <div className="shrink-0 border-t border-bit-border/50 px-5 py-3">
              <div className="flex items-center justify-between rounded-xl bg-bit-panel/20 px-3 py-2">
                <span className="text-xs font-medium text-bit-muted">Appearance</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>
      </div>
         <div className="h-18 md:hidden" aria-hidden="true" />
    </>
  );
};

export default Navbar;
