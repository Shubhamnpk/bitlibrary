import React, { useMemo, useState } from 'react';
import type { Audiobook, Book } from '@/types/index';
import { Link } from 'react-router-dom';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { ArrowRight, Bookmark, Clock, Headphones, History, Library as LibraryIcon, Play, Search, User } from 'lucide-react';
import { getPdfReaderProgressKey, readReaderEntry } from '@/lib/storage-manager';
import { isPdfLikeUrl } from '@/lib/url-utils';
import { getStudyId } from '@/lib/pdf-reader-storage';

interface MyLibraryProps {
  borrowedBooks: Book[];
  savedBooks: Book[];
  savedAudiobooks: Audiobook[];
  recentSearches: string[];
  recentlyViewed: Book[];
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
  onBookClick,
  onAudiobookClick,
  onRead,
  onExplore,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'all' | 'saved' | 'history'>('overview');

  const continueBooks = useMemo(() => {
    return recentlyViewed
      .map((book) => {
        if (!book?.id) return null;
        const chp = readReaderEntry<{ chapterIndex?: number }>(getPdfReaderProgressKey(book.id));
        if (typeof chp?.chapterIndex === 'number') return { book, chapterIndex: chp.chapterIndex, label: 'ch' as const };
        const pdfUrl = book.chapterPdfUrls?.[0]?.pdfUrl || (isPdfLikeUrl(book.downloadUrl) ? book.downloadUrl : null);
        if (pdfUrl) {
          const s = readReaderEntry<{ studies?: Record<string, { lastPage?: number }> }>('pdf');
          const lastPage = s?.studies?.[getStudyId(pdfUrl)]?.lastPage ?? null;
          if (lastPage) return { book, chapterIndex: lastPage, label: 'p' as const };
        }
        return { book, chapterIndex: 0, label: '' as const };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:mb-10 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-2xl font-display font-bold tracking-tight text-bit-text sm:mb-2 sm:text-4xl">My Library</h1>
            <p className="hidden max-w-2xl text-sm leading-7 text-bit-muted sm:block">
              Your saved books, favorite audiobooks, and recently viewed items are kept here on this device.
            </p>
          </div>
          <Link to="/profile"
            className="mt-1 flex md:hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-bit-border bg-bit-panel/50 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent hover:bg-bit-accent/5"
            aria-label="Profile">
            <User size={18} />
          </Link>
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
      </div>
    </div>
  );
};

export default MyLibrary;