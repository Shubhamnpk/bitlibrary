import React, { useState, useEffect, useRef } from 'react';
import { Book } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, Maximize2, X, Layout, Monitor, Minimize2, Moon, Palette, PanelRight, Settings, Sun, Type, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PDFFlipBook, { PDF_BACKGROUND_PRESETS, readPdfBackgroundPreset, type PdfBackgroundPresetId } from './PDFFlipBook';
import { useLocalUserState } from '@/lib/local-user';

interface ReaderProps {
  book: Book;
  onClose: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
}

const Reader: React.FC<ReaderProps> = ({ book, onClose, isMinimized = false, onToggleMinimize }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(1);
  const [fontSize, setFontSize] = useState(18);
  const [isImmersive, setIsImmersive] = useState(false);
  const [localIsMinimized, setLocalIsMinimized] = useState(isMinimized);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfStudyPanelOpen, setPdfStudyPanelOpen] = useState(false);
  const [pdfBackgroundPreset, setPdfBackgroundPreset] = useState<PdfBackgroundPresetId>(() => readPdfBackgroundPreset());
  const { state: localUserState, setThemeMode, toggleSavedBook } = useLocalUserState();

  useEffect(() => {
    setLocalIsMinimized(isMinimized);
  }, [isMinimized]);

  const toggleMinimized = () => {
    if (onToggleMinimize) {
      onToggleMinimize(!localIsMinimized);
    } else {
      setLocalIsMinimized(!localIsMinimized);
    }
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const isExternal = !!book.externalUrl;
  const externalReaderUrl = book.externalUrl || book.downloadUrl || '';
  const isPdfReader = /\.pdf(?:$|[?#])/i.test(externalReaderUrl) || /\.pdf(?:$|[?#])/i.test(book.downloadUrl || '');
  const readerUrl = isPdfReader && book.downloadUrl ? book.downloadUrl : externalReaderUrl;
  const isLightTheme = localUserState.settings.theme === 'light';
  const isSavedBook = localUserState.savedBooks.some((entry) => entry.id === book.id);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (isImmersive) {
          setIsImmersive(false);
        } else if (!isMinimized) {
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImmersive, isMinimized, settingsOpen]);

  useEffect(() => {
    if (isExternal) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const loadChapter = async () => {
      setLoading(true);
      setContent('');
      let firstChunk = true;

      try {
        await streamBookChapter(book, chapter, (chunk) => {
          if (!mounted) return;
          if (firstChunk) {
            setLoading(false);
            firstChunk = false;
          }
          setContent(prev => prev + chunk);
        });
      } catch (err) {
        if (mounted) setContent("ERROR: Neural downlink failure.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadChapter();

    // 2. Pre-fetch next chapter node for seamless transition
    if (chapter < 50) { // Limit pre-fetch
      const prefetch = async () => {
        try {
          await streamBookChapter(book, chapter + 1);
        } catch { /* Ignore prefetch failures */ }
      };
      void prefetch();
    }

    return () => { mounted = false; };
  }, [book, chapter, isExternal]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // If minimized, render as a compact floating node (PiP)
  if (localIsMinimized) {
    return (
      <div
        onClick={toggleMinimized}
        className="fixed bottom-8 right-8 w-48 h-72 bg-bit-panel/80 backdrop-blur-xl border border-bit-border rounded-2xl shadow-2xl z-[1000] cursor-pointer hover:scale-105 hover:border-bit-accent/40 transition-all duration-500 overflow-hidden animate-fade-in group"
      >
        <div className="relative w-full h-full overflow-hidden">
          {book.coverUrl ? (
            <img src={book.coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" alt="" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${book.coverGradient || 'from-bit-accent/10 to-transparent'} flex items-center justify-center p-6 text-center`}>
              <p className="text-bit-muted font-display font-bold text-xs uppercase tracking-widest leading-relaxed">{book.title}</p>
            </div>
          )}

          {/* Minimalist Hover Overlay */}
          <div className="absolute inset-0 bg-bit-bg/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
            <div className="p-2.5 bg-bit-panel/60 backdrop-blur-md rounded-full text-bit-text border border-bit-border">
              <Maximize2 size={20} />
            </div>
            <p className="text-[9px] text-bit-text font-mono uppercase tracking-[0.2em] font-bold">RESTORE_SESSION</p>
          </div>

          <div className="absolute top-2 right-2 flex gap-2 z-30">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1.5 bg-bit-panel/80 backdrop-blur-md rounded-full text-bit-muted hover:text-red-500 hover:bg-bit-panel transition-all opacity-0 group-hover:opacity-100 shadow-lg"
              title="Terminate Stream"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final Immersive Render
  return (
    <div className={`fixed inset-0 z-[1000] bg-bit-bg flex flex-col animate-fade-in overflow-hidden shadow-2xl transition-all duration-700`}>
      {/* Smart Reveal Header */}
      <header className={`h-14 sm:h-16 border-b border-bit-border bg-bit-panel/80 backdrop-blur-2xl flex items-center justify-between gap-3 px-3 sm:px-6 z-[10001] transition-all duration-300 ${isImmersive ? 'absolute top-0 left-0 right-0 -translate-y-full hover:translate-y-0 opacity-0 hover:opacity-100' : 'relative'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="flex shrink-0 items-center gap-2 pr-2 transition-all group sm:border-r sm:border-bit-border sm:pr-6"
            aria-label="Close reader"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-accent shadow-sm transition-all group-hover:bg-bit-accent group-hover:text-white">
              <ArrowLeft size={17} />
            </div>
            <span className="hidden sm:block text-[10px] font-mono font-bold text-bit-text tracking-widest uppercase">close</span>
          </button>
          <div className="hidden min-w-0 sm:block">
            <h2 className="max-w-[200px] line-clamp-1 font-display font-semibold tracking-tight text-bit-text md:max-w-md">{book.title}</h2>
            <div className="flex items-center gap-2">
              <Zap size={10} className="text-bit-accent" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-bit-accent/60">Sector_ID: {book.id.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-6">
          {!isExternal && (
            <div className="hidden lg:flex items-center bg-bit-panel/50 rounded-lg border border-bit-border p-1 shadow-sm">
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                className="p-2 hover:bg-bit-panel rounded text-bit-muted hover:text-bit-text transition-colors font-bold"
              >
                A-
              </button>
              <div className="w-[1px] h-4 bg-bit-border mx-1"></div>
              <button
                onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                className="p-2 hover:bg-bit-panel rounded text-bit-muted hover:text-bit-text transition-colors font-bold"
              >
                A+
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-bit-border bg-bit-panel/50 p-1 shadow-sm">
            {isExternal && (
              <a 
                href={readerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2.5 text-bit-accent transition-all hover:bg-bit-panel hover:text-bit-text sm:border-r sm:border-bit-border sm:p-3 group"
                title={isPdfReader ? 'Open PDF in new tab' : 'Open External Archive'}
                aria-label={isPdfReader ? 'Open PDF in new tab' : 'Open external archive'}
              >
                <ExternalLink size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:size-[18px]" />
              </a>
            )}
            {book.downloadUrl && (
              <a 
                href={book.downloadUrl}
                download={book.title}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2.5 text-bit-accent transition-all hover:bg-bit-panel hover:text-bit-text sm:border-r sm:border-bit-border sm:p-3 group"
                title="Download Archival Volume"
                aria-label="Download book"
              >
                <Download size={17} className="transition-transform group-hover:translate-y-0.5 sm:size-[18px]" />
              </a>
            )}
            <button
              onClick={toggleMinimized}
              className="rounded-lg p-2.5 text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent sm:p-3 group"
              title="Minimize stream (PiP)"
            >
              <Layout size={17} className="group-hover:scale-110 sm:size-[18px]" />
            </button>
            <button
              onClick={() => setIsImmersive(true)}
              className="rounded-lg p-2.5 text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent sm:p-3 group"
              title="Immersive Protocol"
            >
              <Maximize2 size={17} className="group-hover:scale-110 sm:size-[18px]" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 hover:bg-bit-panel rounded-lg text-bit-muted hover:text-bit-accent hidden md:block transition-all group"
            >
              <Monitor size={18} className="group-hover:scale-110" />
            </button>
            <button
              onClick={() => setSettingsOpen((open) => !open)}
              className={`rounded-lg p-2.5 transition-all sm:p-3 group ${settingsOpen ? 'bg-bit-accent text-white' : 'text-bit-muted hover:bg-bit-panel hover:text-bit-accent'}`}
              title="Reader settings"
              aria-label="Open reader settings"
              aria-expanded={settingsOpen}
            >
              <Settings size={17} className="transition-transform group-hover:rotate-45 sm:size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {settingsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 z-[10100] bg-bit-bg/35 backdrop-blur-[1px] sm:top-16"
            aria-label="Close reader settings"
            onClick={() => setSettingsOpen(false)}
          />
          <aside className="fixed right-0 top-14 bottom-0 z-[10110] flex w-full flex-col border-l border-bit-border bg-bit-bg/96 shadow-2xl backdrop-blur-xl animate-fade-in sm:top-16 sm:w-[min(24rem,100vw)]">
            <div className="flex items-center justify-between border-b border-bit-border px-5 py-4">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">Reader</p>
                <h3 className="mt-1 font-display text-xl font-bold text-bit-text">Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-bit-border p-2 text-bit-muted transition-colors hover:border-bit-accent/40 hover:text-bit-accent"
                aria-label="Close reader settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
              <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-bit-accent">
                  {isSavedBook ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Bookmarks</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSavedBook(book)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${isSavedBook ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/50 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
                >
                  {isSavedBook ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  {isSavedBook ? 'Saved to library' : 'Save this book'}
                </button>
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-bit-muted">Saved books</p>
                  {localUserState.savedBooks.slice(0, 6).length ? localUserState.savedBooks.slice(0, 6).map((savedBook) => (
                    <div key={savedBook.id} className="rounded-lg border border-bit-border bg-bit-bg/35 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-semibold text-bit-text">{savedBook.title}</p>
                      <p className="mt-1 line-clamp-1 text-[9px] font-mono uppercase tracking-widest text-bit-muted">{savedBook.author}</p>
                    </div>
                  )) : (
                    <p className="text-xs leading-5 text-bit-muted">Saved books will appear here.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-bit-accent">
                  {isLightTheme ? <Sun size={16} /> : <Moon size={16} />}
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Theme</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`rounded-lg border px-3 py-3 text-left transition-all ${!isLightTheme ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/40 text-bit-muted hover:text-bit-text'}`}
                  >
                    <Moon size={15} />
                    <span className="mt-2 block text-[10px] font-mono font-bold uppercase tracking-widest">Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`rounded-lg border px-3 py-3 text-left transition-all ${isLightTheme ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/40 text-bit-muted hover:text-bit-text'}`}
                  >
                    <Sun size={15} />
                    <span className="mt-2 block text-[10px] font-mono font-bold uppercase tracking-widest">Light</span>
                  </button>
                </div>
              </section>

              {!isExternal && (
                <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                  <div className="mb-3 flex items-center gap-2 text-bit-accent">
                    <Type size={16} />
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Text size</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                      className="h-10 flex-1 rounded-lg border border-bit-border bg-bit-bg/40 text-sm font-bold text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent"
                    >
                      A-
                    </button>
                    <span className="min-w-14 text-center text-[10px] font-mono font-bold text-bit-accent">{fontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                      className="h-10 flex-1 rounded-lg border border-bit-border bg-bit-bg/40 text-sm font-bold text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent"
                    >
                      A+
                    </button>
                  </div>
                </section>
              )}

              {isPdfReader && (
                <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                  <div className="mb-3 flex items-center gap-2 text-bit-accent">
                    <Palette size={16} />
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">PDF background</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {PDF_BACKGROUND_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPdfBackgroundPreset(preset.id)}
                        className={`h-11 rounded-lg border transition-all ${pdfBackgroundPreset === preset.id ? 'border-bit-accent ring-2 ring-bit-accent/25' : 'border-bit-border hover:border-bit-accent/50'}`}
                        style={{ background: preset.swatch }}
                        aria-label={`Use ${preset.label} PDF background`}
                        title={`${preset.label} background`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfStudyPanelOpen(true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-bit-border bg-bit-bg/40 px-3 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:border-bit-accent/40 hover:text-bit-accent"
                  >
                    <PanelRight size={14} />
                    Open PDF bookmarks and notes
                  </button>
                </section>
              )}

              <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Session</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleMinimized}
                    className="rounded-lg border border-bit-border bg-bit-bg/40 px-3 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:border-bit-accent/40 hover:text-bit-accent"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImmersive(true)}
                    className="rounded-lg border border-bit-border bg-bit-bg/40 px-3 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:border-bit-accent/40 hover:text-bit-accent"
                  >
                    Immersive
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area - Optimized Strip Layout */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide bg-bit-bg flex flex-col items-center">
        {isExternal && isPdfReader ? (
          <PDFFlipBook
            pdfUrl={readerUrl}
            title={book.title}
            backgroundPreset={pdfBackgroundPreset}
            studyPanelOpen={pdfStudyPanelOpen}
            onStudyPanelOpenChange={setPdfStudyPanelOpen}
          />
        ) : isExternal ? (
          <div className="w-full max-w-[1000px] h-full bg-white relative shadow-2xl border-x border-bit-border overflow-hidden">
            {iframeLoading && (
              <div className="absolute inset-0 bg-bit-bg z-20 p-12 md:p-24 animate-fade-in flex flex-col gap-10">
                <div className="h-12 w-3/4 animate-shimmer bg-bit-panel/30 rounded-lg border border-bit-border/30" />
                <div className="flex-1 flex flex-col gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                    <div key={i} className="h-4 w-full animate-shimmer bg-bit-panel/20 rounded border border-bit-border/20" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                  <div className="h-4 w-1/2 animate-shimmer bg-bit-panel/20 rounded border border-bit-border/20" style={{ animationDelay: '1100ms' }} />
                </div>
              </div>
            )}

            <iframe
              src={readerUrl}
              onLoad={() => {
                // Ensure the loading state is cleared even if some content is blocked
                setTimeout(() => setIframeLoading(false), 2000);
              }}
              className="w-full h-full border-none bg-white"
              title={book.title}
              sandbox={isPdfReader ? undefined : 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals'}
              loading="lazy"
            ></iframe>

            {isImmersive && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-bit-panel/90 backdrop-blur-md border border-bit-border rounded-full text-[10px] text-bit-accent font-mono z-10 uppercase tracking-widest shadow-2xl font-bold">
                ARCHIVAL_CONDUIT_ACTIVE
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-[560px] min-h-full bg-bit-panel/5 px-10 md:px-16 py-24 md:py-40 animate-fade-in border-x border-bit-border shadow-sm relative z-10">
            {/* Visual Continuity Guides */}
            <div className="absolute inset-y-0 -left-[1px] w-[1px] bg-gradient-to-b from-transparent via-bit-accent/20 to-transparent"></div>
            <div className="absolute inset-y-0 -right-[1px] w-[1px] bg-gradient-to-b from-transparent via-bit-accent/20 to-transparent"></div>

            {loading && content.length === 0 && (
              <div className="flex flex-col items-center justify-center py-40 gap-6">
                <Loader2 className="animate-spin text-bit-accent" size={48} />
                <div className="text-center">
                  <p className="font-mono text-xs text-bit-accent/60 mb-2 uppercase tracking-[0.3em] font-bold">Sector Synchronization</p>
                  <p className="font-mono text-sm text-bit-accent uppercase tracking-widest animate-pulse font-bold">Establishing Neural Link...</p>
                </div>
              </div>
            )}

            <div
              ref={contentRef}
              style={{ fontSize: `${fontSize}px` }}
              className={`prose-bit max-w-none transition-all duration-300 font-serif ${isImmersive ? 'opacity-100' : 'opacity-90'}`}
            >
              <ReactMarkdown>{content}</ReactMarkdown>
              {loading && content.length > 0 && <span className="inline-block w-2.5 h-5 bg-bit-accent animate-pulse ml-1 align-baseline"></span>}
            </div>

            {!loading && (
              <div className="mt-24 flex items-center justify-between pt-12 border-t border-bit-border opacity-40 hover:opacity-100 transition-opacity text-[10px] font-mono tracking-[0.4em] text-bit-muted">
                <button
                  disabled={chapter <= 1}
                  onClick={() => setChapter(c => c - 1)}
                  className={`flex items-center gap-2 px-6 py-4 rounded-xl border border-bit-border transition-all font-bold ${chapter <= 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-bit-panel hover:border-bit-accent/50 text-bit-text'}`}
                >
                  <ChevronLeft size={16} /> SYNC_PREV
                </button>
                <div className="hidden sm:block font-bold">CHUNK_NODE_{chapter}</div>
                <button
                  onClick={() => setChapter(c => c + 1)}
                  className="flex items-center gap-3 px-8 py-4 rounded-xl bg-bit-accent text-white font-bold hover:scale-95 transition-all shadow-lg shadow-bit-accent/20"
                >
                  SYNC_NEXT <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Rescue Controls - Accessible in immersive */}
      {isImmersive && (
        <div className="fixed top-6 right-6 flex gap-2 z-[10002] animate-fade-in group">
          <button
            onClick={() => setIsImmersive(false)}
            className="p-3 bg-bit-panel/80 backdrop-blur-xl border border-bit-border rounded-xl text-bit-muted hover:text-bit-accent hover:border-bit-accent/50 transition-all shadow-2xl"
            title="Restore Interface"
          >
            <Minimize2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-2xl"
            title="Terminate Stream"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export const ReaderSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-bit-bg flex flex-col items-center animate-fade-in z-[2000]">
      <div className="h-16 w-full border-b border-bit-border bg-bit-panel/50 p-6 flex justify-between">
        <div className="h-4 w-32 animate-shimmer bg-bit-panel/20 rounded-full border border-bit-border/30" />
        <div className="h-4 w-20 animate-shimmer bg-bit-panel/20 rounded-full border border-bit-border/30" />
      </div>
      <div className="w-full max-w-[560px] h-full p-20 space-y-8 bg-bit-panel/5 border-x border-bit-border shadow-2xl overflow-hidden relative">
        <div className="h-10 w-3/4 animate-shimmer bg-bit-panel/20 rounded border border-bit-border/30" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-4 w-full animate-shimmer bg-bit-panel/10 rounded border border-bit-border/10" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="h-96 w-full animate-shimmer bg-bit-panel/10 rounded border border-bit-border/20" />
      </div>
    </div>
  );
};

export default Reader;
