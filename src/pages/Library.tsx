import React, { useMemo, useState } from 'react';
import type { Audiobook, Book, UserProfile, UserSettings } from '@/types/index';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { ArrowRight, Bookmark, ChevronDown, Clock, Headphones, History, Library as LibraryIcon, Moon, Search, Settings, Sun, Trash2, User2 } from 'lucide-react';
import { clearLocalUserData, setThemeMode, updateDisplayName } from '@/lib/local-user';

interface LibraryProps {
  borrowedBooks: Book[];
  savedBooks: Book[];
  savedAudiobooks: Audiobook[];
  recentSearches: string[];
  recentlyViewed: Book[];
  profile: UserProfile;
  settings: UserSettings;
  onBookClick: (book: Book) => void;
  onAudiobookClick: (audiobook: Audiobook) => void;
  onRead: (book: Book) => void;
  onExplore: () => void;
}

const Library: React.FC<LibraryProps> = ({
  borrowedBooks,
  savedBooks,
  savedAudiobooks,
  recentSearches,
  recentlyViewed,
  profile,
  settings,
  onBookClick,
  onAudiobookClick,
  onRead,
  onExplore,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'saved'>('all');
  const [draftName, setDraftName] = useState(profile.displayName);
  const [showProfile, setShowProfile] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSearches, setShowSearches] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const displayedBooks = useMemo(() => {
    if (activeFilter === 'saved') return savedBooks;
    if (activeFilter === 'recent') return recentlyViewed;

    const seen = new Set<string>();
    return [...savedBooks, ...recentlyViewed, ...borrowedBooks].filter((book) => {
      if (!book?.id || seen.has(book.id)) return false;
      seen.add(book.id);
      return true;
    });
  }, [activeFilter, borrowedBooks, recentlyViewed, savedBooks]);

  const displayedAudiobooks = useMemo(() => {
    if (activeFilter === 'recent') return [];
    return savedAudiobooks;
  }, [activeFilter, savedAudiobooks]);

  const savedCount = savedBooks.length + savedAudiobooks.length;
  const hasDisplayedItems = displayedBooks.length > 0 || displayedAudiobooks.length > 0;

  const handleSaveProfile = () => {
    updateDisplayName(draftName);
    setShowProfile(false);
  };

  const toolSections = [
    {
      key: 'profile',
      title: 'Profile name',
      summary: profile.displayName || 'Reader',
      icon: User2,
      open: showProfile,
      setOpen: setShowProfile,
      content: (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-bit-text">Display name</label>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Reader"
            className="w-full rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-3 text-sm text-bit-text transition-all focus:border-bit-accent/50 focus:outline-none focus:ring-1 focus:ring-bit-accent/20"
          />
          <button
            onClick={handleSaveProfile}
            className="w-full rounded-xl bg-bit-accent py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-[0.98]"
          >
            Save name
          </button>
        </div>
      ),
    },
    {
      key: 'appearance',
      title: 'Appearance',
      summary: settings.theme === 'dark' ? 'Dark theme' : 'Light theme',
      icon: Settings,
      open: showAppearance,
      setOpen: setShowAppearance,
      content: (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setThemeMode('dark')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}
          >
            <Moon size={18} className="mb-3" />
            <p className="font-display text-sm font-bold">Dark</p>
          </button>
          <button
            onClick={() => setThemeMode('light')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'light' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}
          >
            <Sun size={18} className="mb-3" />
            <p className="font-display text-sm font-bold">Light</p>
          </button>
        </div>
      ),
    },
    {
      key: 'searches',
      title: 'Recent searches',
      summary: `${recentSearches.length} saved`,
      icon: Search,
      open: showSearches,
      setOpen: setShowSearches,
      content: recentSearches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {recentSearches.map((query) => (
            <span key={query} className="rounded-xl border border-bit-border bg-bit-panel/50 px-3 py-2 text-xs text-bit-text shadow-sm">
              {query}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-bit-muted">Your recent searches will appear here.</p>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:mb-10 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-display font-bold tracking-tight text-bit-text sm:mb-2 sm:text-4xl">My Library</h1>
          <p className="hidden max-w-2xl text-sm leading-7 text-bit-muted sm:block">
            Your saved books, favorite audiobooks, and recently viewed items are kept here on this device.
          </p>
        </div>
        <div className="flex w-fit rounded-xl border border-bit-border bg-bit-panel/50 p-1 shadow-sm">
          {([
            ['all', 'All'],
            ['recent', 'Recent'],
            ['saved', 'Saved'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${activeFilter === key ? 'bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'text-bit-muted hover:text-bit-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-10 xl:col-span-8">
          {hasDisplayedItems ? (
            <div className="space-y-10">
              {displayedBooks.length > 0 && (
                <div className="bit-card-grid">
                  {displayedBooks.map((book) => (
                    <BookCard key={book.id} variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                  ))}
                </div>
              )}

              {displayedAudiobooks.length > 0 && (
                <section>
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Saved audio</p>
                      <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">Favorite Audiobooks</h2>
                    </div>
                    <Headphones size={24} className="text-bit-muted" />
                  </div>
                  <div className="bit-card-grid">
                    {displayedAudiobooks.map((audiobook) => (
                      <AudiobookCard key={audiobook.id} variant="compact" audiobook={audiobook} onClick={onAudiobookClick} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-bit-border bg-bit-panel/30 py-24 shadow-inner">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted shadow-sm">
                <LibraryIcon size={40} className="opacity-40" />
              </div>
              <h3 className="mb-2 text-xl font-display font-bold text-bit-text">Nothing saved yet</h3>
              <p className="mb-8 max-w-md px-6 text-center text-sm leading-7 text-bit-muted">
                Save a book or audiobook and it will show up here for quick access.
              </p>
              <button
                onClick={onExplore}
                className="flex items-center gap-3 rounded-xl bg-bit-accent px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-105"
              >
                Explore books <ArrowRight size={18} />
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="glass-panel group relative overflow-hidden rounded-2xl p-8 shadow-sm">
              <div className="absolute -right-4 -top-4 text-bit-accent/10 transition-colors group-hover:text-bit-accent/20">
                <Clock size={120} />
              </div>
              <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">Recently viewed</p>
              <h4 className="text-4xl font-display font-bold leading-none text-bit-text">{recentlyViewed.length}</h4>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-bit-accent">
                <History size={14} /> Stored on this device
              </div>
            </div>
            <div className="glass-panel group relative overflow-hidden rounded-2xl p-8 shadow-sm">
              <div className="absolute -right-4 -top-4 text-bit-accent/10 transition-colors group-hover:text-bit-accent/20">
                <Bookmark size={120} />
              </div>
              <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">Saved favorites</p>
              <h4 className="text-4xl font-display font-bold leading-none text-bit-text">{savedCount}</h4>
              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-bit-border">
                <div className="h-full bg-bit-accent transition-all duration-1000" style={{ width: `${Math.min(savedCount * 12, 100)}%` }} />
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-bit-accent/20 bg-bit-accent/5 p-8 shadow-sm">
              <div className="absolute -right-4 -top-4 text-bit-accent/10 transition-colors group-hover:text-bit-accent/20">
                <Search size={100} />
              </div>
              <h4 className="mb-3 text-xl font-display font-bold tracking-tight text-bit-accent">Recent searches</h4>
              <p className="mb-6 line-clamp-2 text-sm leading-7 text-bit-muted">
                {recentSearches.length > 0 ? recentSearches.slice(0, 3).join(', ') : 'No recent searches yet'}
              </p>
              <button onClick={onExplore} className="w-full rounded-lg bg-bit-accent py-2.5 text-xs font-bold uppercase text-white shadow-md transition-all hover:scale-95">
                Explore more
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <section className="rounded-2xl border border-bit-border bg-bit-panel/30 p-5 shadow-sm">
            <h2 className="mb-1 text-xl font-display font-bold text-bit-text">Library tools</h2>
            <p className="text-sm leading-7 text-bit-muted">Settings are tucked away until you need them.</p>
          </section>

          {toolSections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.key} className="rounded-2xl border border-bit-border bg-bit-panel/30 p-5 shadow-sm">
                <button type="button" onClick={() => section.setOpen(!section.open)} className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                      <Icon size={20} />
                    </span>
                    <span>
                      <span className="block font-display font-bold text-bit-text">{section.title}</span>
                      <span className="mt-1 block text-sm text-bit-muted">{section.summary}</span>
                    </span>
                  </span>
                  <ChevronDown size={18} className={`text-bit-muted transition-transform ${section.open ? 'rotate-180' : ''}`} />
                </button>
                {section.open && (
                  <div className="mt-5 border-t border-bit-border pt-5">
                    {section.content}
                  </div>
                )}
              </section>
            );
          })}

          <section className="rounded-2xl border border-red-500/10 bg-red-500/5 p-5 shadow-sm">
            <button type="button" onClick={() => setShowReset((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500">
                  <Trash2 size={19} />
                </span>
                <span>
                  <span className="block font-display font-bold text-red-500">Reset local data</span>
                  <span className="mt-1 block text-sm text-red-500/70">Only needed when you want to clear this device.</span>
                </span>
              </span>
              <ChevronDown size={18} className={`text-red-500/70 transition-transform ${showReset ? 'rotate-180' : ''}`} />
            </button>
            {showReset && (
              <div className="mt-5 border-t border-red-500/10 pt-5">
                <p className="text-sm leading-7 text-red-500/75">
                  This removes your saved books, favorite audiobooks, recent searches, and local preferences from this browser.
                </p>
                <button
                  onClick={clearLocalUserData}
                  className="mt-4 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white"
                >
                  Clear local data
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default Library;
