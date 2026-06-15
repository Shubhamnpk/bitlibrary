import React, { useEffect, useMemo, useState } from 'react';
import type { Audiobook, Book, UserProfile, UserSettings } from '@/types/index';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { ArrowRight, Bookmark, BookOpenText, ChevronDown, Clock, Database, HardDrive, Headphones, History, Library as LibraryIcon, Moon, Play, Search, Settings, ShieldCheck, Sun, Trash2, User2, X } from 'lucide-react';
import { clearLocalUserData, setThemeMode, updateDisplayName } from '@/lib/local-user';
import {
  clearRecoverableCaches,
  clearStaleCaches,
  clearStorageCategory,
  formatStorageBytes,
  getPdfReaderProgressKey,
  getStorageReport,
  getStorageReportEventName,
  getStorageSummary,
  readReaderEntry,
  type StorageEntryReport,
} from '@/lib/storage-manager';
import { isPdfLikeUrl } from '@/lib/pdf';
import { getStudyId } from '@/lib/pdf-reader-storage';

interface MyLibraryProps {
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

const MyLibrary: React.FC<MyLibraryProps> = ({
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
  const [activeSection, setActiveSection] = useState<'overview' | 'all' | 'saved' | 'history'>('overview');
  const [draftName, setDraftName] = useState(profile.displayName);
  const [showProfile, setShowProfile] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSearches, setShowSearches] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [storageReport, setStorageReport] = useState<StorageEntryReport[]>(() => getStorageReport());

  const continueBooks = useMemo(() => {
    return recentlyViewed
      .map((book) => {
        if (!book?.id) return null;
        const chp = readReaderEntry<{ chapterIndex?: number }>(getPdfReaderProgressKey(book.id));
        if (chp?.chapterIndex) return { book, chapterIndex: chp.chapterIndex, label: 'ch' as const };
        const pdfUrl = book.chapterPdfUrls?.[0]?.pdfUrl || (isPdfLikeUrl(book.downloadUrl) ? book.downloadUrl : null);
        if (pdfUrl) {
          const s = readReaderEntry<{ studies?: Record<string, { lastPage?: number }> }>('pdf');
          const lastPage = s?.studies?.[getStudyId(pdfUrl)]?.lastPage ?? null;
          if (lastPage) return { book, chapterIndex: lastPage, label: 'p' as const };
        }
        return { book, chapterIndex: 0, label: '' as const };
      })
      .filter((entry): entry is { book: Book; chapterIndex: number; label: string } => entry !== null)
      .slice(0, 6);
  }, [recentlyViewed]);

  const savedCount = savedBooks.length + savedAudiobooks.length;

  const displayedBooks = useMemo(() => {
    if (activeSection === 'saved') return savedBooks;
    if (activeSection === 'history') return recentlyViewed;
    const seen = new Set<string>();
    return [...savedBooks, ...recentlyViewed, ...borrowedBooks].filter((book) => {
      if (!book?.id || seen.has(book.id)) return false;
      seen.add(book.id);
      return true;
    });
  }, [activeSection, borrowedBooks, recentlyViewed, savedBooks]);

  const displayedAudiobooks = useMemo(() => {
    if (activeSection === 'saved') return savedAudiobooks;
    if (activeSection === 'overview' || activeSection === 'history') return [];
    return savedAudiobooks;
  }, [activeSection, savedAudiobooks]);

  const hasDisplayedItems = displayedBooks.length > 0 || displayedAudiobooks.length > 0;
  const storageSummary = useMemo(() => getStorageSummary(storageReport), [storageReport]);
  const storageRows = useMemo(() => [
    ['account', 'Account', storageSummary.categories.account],
    ['reader', 'Reader', storageSummary.categories.reader],
    ['api-cache', 'API cache', storageSummary.categories['api-cache']],
    ['page-cache', 'Page cache', storageSummary.categories['page-cache']],
    ['unknown', 'Unmanaged', storageSummary.categories.unknown],
  ] as const, [storageSummary]);

  const refreshStorageReport = () => setStorageReport(getStorageReport());

  useEffect(() => {
    refreshStorageReport();
    const eventName = getStorageReportEventName();
    window.addEventListener(eventName, refreshStorageReport);
    window.addEventListener('storage', refreshStorageReport);
    return () => {
      window.removeEventListener(eventName, refreshStorageReport);
      window.removeEventListener('storage', refreshStorageReport);
    };
  }, []);

  const handleSaveProfile = () => { updateDisplayName(draftName); setShowProfile(false); };
  const handleClearStaleCaches = () => { clearStaleCaches(); refreshStorageReport(); };
  const handleClearRecoverableCaches = () => { clearRecoverableCaches(); refreshStorageReport(); };
  const handleClearReaderProgress = () => { clearStorageCategory('reader'); refreshStorageReport(); };

  const toolSections = [
    {
      key: 'profile', title: 'Profile name', summary: profile.displayName || 'Reader', icon: User2,
      open: showProfile, setOpen: setShowProfile,
      content: (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-bit-text">Display name</label>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Reader"
            className="w-full rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-3 text-sm text-bit-text transition-all focus:border-bit-accent/50 focus:outline-none focus:ring-1 focus:ring-bit-accent/20" />
          <button onClick={handleSaveProfile}
            className="w-full rounded-xl bg-bit-accent py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-[0.98]">Save name</button>
        </div>
      ),
    },
    {
      key: 'appearance', title: 'Appearance', summary: settings.theme === 'dark' ? 'Dark theme' : 'Light theme', icon: Settings,
      open: showAppearance, setOpen: setShowAppearance,
      content: (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setThemeMode('dark')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}>
            <Moon size={18} className="mb-3" /><p className="font-display text-sm font-bold">Dark</p>
          </button>
          <button onClick={() => setThemeMode('light')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'light' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}>
            <Sun size={18} className="mb-3" /><p className="font-display text-sm font-bold">Light</p>
          </button>
        </div>
      ),
    },
    {
      key: 'searches', title: 'Recent searches', summary: `${recentSearches.length} saved`, icon: Search,
      open: showSearches, setOpen: setShowSearches,
      content: recentSearches.length > 0 ? (
        <div className="flex flex-wrap gap-2">{recentSearches.map((q) => (
          <span key={q} className="rounded-xl border border-bit-border bg-bit-panel/50 px-3 py-2 text-xs text-bit-text shadow-sm">{q}</span>
        ))}</div>
      ) : (<p className="text-sm leading-7 text-bit-muted">Your recent searches will appear here.</p>),
    },
    {
      key: 'storage', title: 'Cache and storage', summary: `${formatStorageBytes(storageSummary.totalBytes)} on this device`, icon: HardDrive,
      open: showStorage, setOpen: setShowStorage,
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Total</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{formatStorageBytes(storageSummary.totalBytes)}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Entries</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{storageSummary.entryCount}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Stale</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{storageSummary.staleCount}</p>
            </div>
          </div>
          <div className="space-y-2">{storageRows.map(([key, label, stats]) => (
            <div key={key} className="rounded-xl border border-bit-border bg-bit-panel/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {key === 'account' ? <ShieldCheck size={15} className="shrink-0 text-bit-accent" /> : <Database size={15} className="shrink-0 text-bit-muted" />}
                  <span className="truncate text-sm font-semibold text-bit-text">{label}</span>
                </div>
                <span className="shrink-0 text-xs font-mono text-bit-muted">{formatStorageBytes(stats.bytes)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                <span>{stats.count} entries</span><span>{stats.staleCount} stale</span>
              </div>
            </div>
          ))}</div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={handleClearStaleCaches} disabled={storageSummary.staleCount === 0}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-bit-border bg-bit-panel/50 px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-40">
              <Clock size={13} className="shrink-0" /><span className="truncate">Stale</span>
            </button>
            <button type="button" onClick={handleClearRecoverableCaches}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-bit-accent/25 bg-bit-accent/10 px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-bit-accent transition-all hover:bg-bit-accent hover:text-white">
              <Database size={13} className="shrink-0" /><span className="truncate">Caches</span>
            </button>
            <button type="button" onClick={handleClearReaderProgress}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-bit-border bg-bit-panel/50 px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
              <BookOpenText size={13} className="shrink-0" /><span className="truncate">Reader</span>
            </button>
          </div>
          <p className="text-xs leading-6 text-bit-muted">Saved books, audiobooks, profile name, and theme are protected from cache cleanup.</p>
        </div>
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
            ['overview', 'Overview'],
            ['all', 'All'],
            ['saved', 'Favorites'],
            ['history', 'History'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveSection(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${activeSection === key ? 'bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'text-bit-muted hover:text-bit-text'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="space-y-10">

          {/* ─── OVERVIEW ─── */}
          {activeSection === 'overview' && (
            <>
              {continueBooks.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                        <Play size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Continue</p>
                        <h2 className="text-lg font-display font-bold text-bit-text">Continue Reading</h2>
                      </div>
                    </div>
                    <button onClick={() => setActiveSection('history')}
                      className="flex items-center gap-1.5 rounded-lg border border-bit-border bg-bit-panel/50 px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
                      View all <ArrowRight size={13} />
                    </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none -mx-1 px-1 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={(e) => { const el = e.currentTarget; let down = e.clientX; const onMove = (ev: MouseEvent) => { el.scrollLeft += down - ev.clientX; down = ev.clientX; }; const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); }}>
                    {continueBooks.map(({ book }) => (
                      <div key={book.id} className="snap-start shrink-0 w-[160px] sm:w-[180px] relative group">
                        <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} showProgress />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {savedBooks.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                        <Bookmark size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Favorites</p>
                        <h2 className="text-lg font-display font-bold text-bit-text">Favorite Books</h2>
                      </div>
                    </div>
                  </div>
                  <div className="bit-card-grid">
                    {savedBooks.map((book) => (
                      <BookCard key={book.id} variant="compact" book={book} onClick={onBookClick} onRead={onRead} showProgress />
                    ))}
                  </div>
                </section>
              )}

              {savedAudiobooks.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                        <Headphones size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Audio</p>
                        <h2 className="text-lg font-display font-bold text-bit-text">Favorite Audiobooks</h2>
                      </div>
                    </div>
                  </div>
                  <div className="bit-card-grid">
                    {savedAudiobooks.map((audiobook) => (
                      <AudiobookCard key={audiobook.id} variant="compact" audiobook={audiobook} onClick={onAudiobookClick} />
                    ))}
                  </div>
                </section>
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
                  <button onClick={onExplore} className="w-full rounded-lg bg-bit-accent py-2.5 text-xs font-bold uppercase text-white shadow-md transition-all hover:scale-95">Explore more</button>
                </div>
              </section>

              {continueBooks.length === 0 && savedBooks.length === 0 && savedAudiobooks.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-bit-border bg-bit-panel/30 py-24 shadow-inner">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted shadow-sm">
                    <LibraryIcon size={40} className="opacity-40" />
                  </div>
                  <h3 className="mb-2 text-xl font-display font-bold text-bit-text">Nothing saved yet</h3>
                  <p className="mb-8 max-w-md px-6 text-center text-sm leading-7 text-bit-muted">
                    Save a book or audiobook and it will show up here for quick access.
                  </p>
                  <button onClick={onExplore}
                    className="flex items-center gap-3 rounded-xl bg-bit-accent px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-105">
                    Explore books <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* ─── ALL / FAVORITES / HISTORY ─── */}
          {(activeSection === 'all' || activeSection === 'saved' || activeSection === 'history') && (
            hasDisplayedItems ? (
              <div className="space-y-10">
                {displayedBooks.length > 0 && (
                  <section>
                    {activeSection === 'history' && (
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Recently viewed</p>
                          <h2 className="mt-1 text-2xl font-display font-bold text-bit-text">Reading History</h2>
                        </div>
                        {recentlyViewed.length > 0 && (
                          <History size={20} className="shrink-0 text-bit-muted" />
                        )}
                      </div>
                    )}
                    {activeSection === 'saved' && (
                      <div className="mb-5">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Favorites</p>
                        <h2 className="mt-1 text-2xl font-display font-bold text-bit-text">Favorite Books</h2>
                      </div>
                    )}
                    <div className="bit-card-grid">
                      {displayedBooks.map((book) => (
                        <BookCard key={book.id} variant="compact" book={book} onClick={onBookClick} onRead={onRead} showProgress={activeSection === 'saved' || activeSection === 'history'} />
                      ))}
                    </div>
                  </section>
                )}
                {displayedAudiobooks.length > 0 && (
                  <section>
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Saved audio</p>
                        <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">Audiobooks</h2>
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
                  {activeSection === 'history' ? 'No recently viewed books yet.' : 'Save a book or audiobook and it will show up here for quick access.'}
                </p>
                <button onClick={onExplore}
                  className="flex items-center gap-3 rounded-xl bg-bit-accent px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-105">
                  Explore books <ArrowRight size={18} />
                </button>
              </div>
            )
          )}

        </div>

        {/* ─── TOOLS SIDEBAR ─── */}
        <button onClick={() => setShowTools((v) => !v)}
          className="fixed right-0 top-1/3 z-40 flex items-center gap-2 rounded-l-xl border border-r-0 border-bit-border bg-bit-panel/80 px-3 py-4 shadow-lg backdrop-blur-md transition-all hover:bg-bit-accent/20 hover:border-bit-accent/30">
          <Settings size={16} className="text-bit-accent" />
          <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-bit-muted">Tools</span>
        </button>

        {showTools && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowTools(false)}>
            <div className="w-full max-w-sm bg-bit-panel/95 backdrop-blur-xl border-l border-bit-border shadow-2xl overflow-y-auto p-6 space-y-4 translate-x-0 transition-transform duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-display font-bold text-bit-text">Library tools</h2>
                <button onClick={() => setShowTools(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-bit-border text-bit-muted hover:text-bit-text hover:border-bit-accent/30 transition-all">
                  <X size={15} />
                </button>
              </div>
              <p className="text-sm leading-6 text-bit-muted">Settings are tucked away until you need them.</p>

              {toolSections.map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.key} className="rounded-xl border border-bit-border bg-bit-panel/50 p-4 shadow-sm">
                    <button type="button" onClick={() => section.setOpen(!section.open)} className="flex w-full items-center justify-between gap-3 text-left">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                          <Icon size={17} />
                        </span>
                        <span>
                          <span className="block text-sm font-display font-bold text-bit-text">{section.title}</span>
                          <span className="mt-0.5 block text-xs text-bit-muted">{section.summary}</span>
                        </span>
                      </span>
                      <ChevronDown size={15} className={`shrink-0 text-bit-muted transition-transform ${section.open ? 'rotate-180' : ''}`} />
                    </button>
                    {section.open && <div className="mt-4 border-t border-bit-border pt-4">{section.content}</div>}
                  </section>
                );
              })}

              <section className="rounded-xl border border-red-500/10 bg-red-500/5 p-4 shadow-sm">
                <button type="button" onClick={() => setShowReset((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500">
                      <Trash2 size={17} />
                    </span>
                    <span>
                      <span className="block text-sm font-display font-bold text-red-500">Reset local data</span>
                      <span className="mt-0.5 block text-xs text-red-500/70">Only needed when you want to clear this device.</span>
                    </span>
                  </span>
                  <ChevronDown size={15} className={`shrink-0 text-red-500/70 transition-transform ${showReset ? 'rotate-180' : ''}`} />
                </button>
                {showReset && (
                  <div className="mt-4 border-t border-red-500/10 pt-4">
                    <p className="text-xs leading-6 text-red-500/75">This removes your saved books, favorite audiobooks, recent searches, and local preferences from this browser.</p>
                    <button onClick={clearLocalUserData}
                      className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white">
                      <Trash2 size={14} className="inline-block -mt-0.5 mr-1.5" />
                      Reset everything
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyLibrary;