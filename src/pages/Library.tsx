import React, { useMemo, useState } from 'react';
import type { Book, UserProfile, UserSettings } from '@/types/index';
import BookCard from '@/components/BookCard';
import { ArrowRight, Bookmark, Clock, History, Library as LibraryIcon, Moon, RotateCcw, Search, Sun, Trash2, User2, Zap } from 'lucide-react';
import { clearLocalUserData, setThemeMode, updateDisplayName } from '@/lib/local-user';

interface LibraryProps {
  borrowedBooks: Book[];
  savedBooks: Book[];
  recentSearches: string[];
  recentlyViewed: Book[];
  profile: UserProfile;
  settings: UserSettings;
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
  onExplore: () => void;
}

const Library: React.FC<LibraryProps> = ({
  borrowedBooks,
  savedBooks,
  recentSearches,
  recentlyViewed,
  profile,
  settings,
  onBookClick,
  onRead,
  onExplore,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'saved'>('all');
  const [draftName, setDraftName] = useState(profile.displayName);

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

  const handleSaveProfile = () => {
    updateDisplayName(draftName);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between mb-12 gap-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Your Library</h1>
          <p className="text-gray-500 font-mono text-sm leading-relaxed max-w-2xl">
            Your local reading foundation for saved books, recent searches, profile preferences, and device-level settings.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-white/[0.03] border border-white/5 rounded-lg p-1">
            {([
              ['all', 'ALL'],
              ['recent', 'RECENT'],
              ['saved', 'SAVED'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-1.5 rounded-md text-xs font-mono transition-all ${activeFilter === key ? 'bg-bit-accent text-black font-bold' : 'text-gray-500 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-10">
          {displayedBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedBooks.map((book) => (
                <BookCard key={book.id} book={book} onClick={onBookClick} onRead={onRead} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
              <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center text-gray-600 mb-6">
                <LibraryIcon size={40} />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-2">Nothing saved yet</h3>
              <p className="text-gray-500 font-mono text-sm mb-8 text-center max-w-md px-6">
                Save books, open a few details pages, or search for something new and your local library foundation will start filling in here.
              </p>
              <button
                onClick={onExplore}
                className="px-8 py-3 rounded-xl bg-bit-accent text-black font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(255,77,0,0.3)] hover:scale-105 transition-all flex items-center gap-2"
              >
                Start Exploration <ArrowRight size={18} />
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-bit-accent/10 group-hover:text-bit-accent/20 transition-colors">
                <Clock size={100} />
              </div>
              <p className="text-gray-500 text-[10px] font-mono uppercase mb-1 tracking-widest">Recently Viewed</p>
              <h4 className="text-3xl font-display font-bold text-white leading-none">{recentlyViewed.length}</h4>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-bit-accent uppercase tracking-[0.2em]">
                <History size={10} /> Device-synced locally
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-bit-accent/10 group-hover:text-bit-accent/20 transition-colors">
                <Bookmark size={100} />
              </div>
              <p className="text-gray-500 text-[10px] font-mono uppercase mb-1 tracking-widest">Saved Volumes</p>
              <h4 className="text-3xl font-display font-bold text-white leading-none">{savedBooks.length}</h4>
              <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-bit-accent transition-all" style={{ width: `${Math.min(savedBooks.length * 12, 100)}%` }} />
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl border-bit-accent/20 bg-bit-accent/5">
              <h4 className="text-lg font-display font-bold text-bit-accent mb-2">Recent Searches</h4>
              <p className="text-xs text-gray-400 mb-4 font-mono">
                {recentSearches.length > 0 ? recentSearches.slice(0, 3).join(' • ') : 'No recent searches yet'}
              </p>
              <button onClick={onExplore} className="w-full py-2 bg-bit-accent text-black rounded-lg text-xs font-bold font-mono">
                EXPLORE MORE
              </button>
            </div>
          </section>
        </div>

        <aside className="xl:col-span-4 space-y-6">
          <section className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-bit-accent/10 text-bit-accent flex items-center justify-center">
                <User2 size={18} />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white">Local Profile</h3>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Device-only for now</p>
              </div>
            </div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-2">
              Display Name
            </label>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Reader"
              className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-bit-accent/50"
            />
            <button
              onClick={handleSaveProfile}
              className="mt-4 w-full rounded-xl bg-bit-accent text-black py-3 text-xs font-bold font-mono tracking-[0.16em]"
            >
              SAVE PROFILE
            </button>
          </section>

          <section className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-bit-accent/10 text-bit-accent flex items-center justify-center">
                {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white">Appearance</h3>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Foundation theme switch</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setThemeMode('dark')}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent text-black' : 'border-white/10 bg-white/[0.02] text-white'}`}
              >
                <Moon size={16} className="mb-3" />
                <p className="font-display font-bold">Black</p>
                <p className="text-[10px] font-mono uppercase mt-1 opacity-70">Current base</p>
              </button>
              <button
                onClick={() => setThemeMode('light')}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${settings.theme === 'light' ? 'border-bit-accent bg-bit-accent text-black' : 'border-white/10 bg-white/[0.02] text-white'}`}
              >
                <Sun size={16} className="mb-3" />
                <p className="font-display font-bold">Light</p>
                <p className="text-[10px] font-mono uppercase mt-1 opacity-70">Reading mode</p>
              </button>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-bit-accent/10 text-bit-accent flex items-center justify-center">
                <Search size={18} />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white">Recent Searches</h3>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Stored locally</p>
              </div>
            </div>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query) => (
                  <span key={query} className="px-3 py-2 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-gray-300">
                    {query}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Search history will appear here after you start exploring.</p>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-6 border border-red-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white">Reset Local Data</h3>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Bookmarks, profile, searches, cache</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={clearLocalUserData}
                className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold font-mono tracking-[0.16em] text-red-300 transition-all hover:bg-red-500/20"
              >
                CLEAR DATA
              </button>
              <button
                onClick={onExplore}
                className="flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-bit-accent transition-all hover:border-bit-accent/40"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default Library;
