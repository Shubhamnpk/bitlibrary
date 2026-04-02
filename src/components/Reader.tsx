import React, { useState, useEffect, useRef } from 'react';
import { Book } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import { ArrowLeft, BookOpen, Settings, ExternalLink, Download, ChevronLeft, ChevronRight, Loader2, Maximize2, X, Layout, Monitor, Minimize2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImmersive) {
          setIsImmersive(false);
        } else if (!isMinimized) {
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImmersive, isMinimized]);

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
      <header className={`h-16 border-b border-bit-border bg-bit-panel/80 backdrop-blur-2xl flex items-center justify-between px-6 z-[10001] transition-all duration-300 ${isImmersive ? 'absolute top-0 left-0 right-0 -translate-y-full hover:translate-y-0 opacity-0 hover:opacity-100' : 'relative'}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 pr-6 border-r border-bit-border group transition-all"
          >
            <div className="p-2 bg-bit-panel/50 rounded-full text-bit-accent border border-bit-border group-hover:bg-bit-accent group-hover:text-white transition-all shadow-sm">
              <ArrowLeft size={18} />
            </div>
            <span className="hidden sm:block text-[10px] font-mono font-bold text-bit-text tracking-widest uppercase">END_SESSION</span>
          </button>
          <div>
            <h2 className="font-display font-semibold text-bit-text tracking-tight line-clamp-1 max-w-[200px] md:max-w-md">{book.title}</h2>
            <div className="flex items-center gap-2">
              <Zap size={10} className="text-bit-accent" />
              <p className="text-[9px] text-bit-accent/60 font-mono uppercase tracking-widest font-bold">Sector_ID: {book.id.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
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

          <div className="flex items-center gap-1 bg-bit-panel/50 rounded-xl border border-bit-border p-1 shadow-sm">
            {isExternal && (
              <a 
                href={book.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 hover:bg-bit-panel rounded-lg text-bit-accent hover:text-bit-text transition-all group border-r border-bit-border"
                title="Open External Archive"
              >
                <ExternalLink size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
            {book.downloadUrl && (
              <a 
                href={book.downloadUrl}
                download={book.title}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 hover:bg-bit-panel rounded-lg text-bit-accent hover:text-bit-text transition-all group border-r border-bit-border"
                title="Download Archival Volume"
              >
                <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
              </a>
            )}
            <button
              onClick={toggleMinimized}
              className="p-3 hover:bg-bit-panel rounded-lg text-bit-muted hover:text-bit-accent transition-all group"
              title="Minimize stream (PiP)"
            >
              <Layout size={18} className="group-hover:scale-110" />
            </button>
            <button
              onClick={() => setIsImmersive(true)}
              className="p-3 hover:bg-bit-panel rounded-lg text-bit-muted hover:text-bit-accent transition-all group"
              title="Immersive Protocol"
            >
              <Maximize2 size={18} className="group-hover:scale-110" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 hover:bg-bit-panel rounded-lg text-bit-muted hover:text-bit-accent hidden md:block transition-all group"
            >
              <Monitor size={18} className="group-hover:scale-110" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Optimized Strip Layout */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide bg-bit-bg flex flex-col items-center">
        {isExternal ? (
          <div className="w-full max-w-[1000px] h-full bg-white relative shadow-2xl border-x border-bit-border overflow-hidden">
            {iframeLoading && (
              <div className="absolute inset-0 bg-bit-bg z-20 p-12 md:p-24 animate-fade-in flex flex-col gap-10">
                <div className="h-12 w-3/4 bg-bit-panel/30 rounded-lg animate-pulse" />
                <div className="flex-1 flex flex-col gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                    <div key={i} className="h-4 w-full bg-bit-panel/20 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                  <div className="h-4 w-1/2 bg-bit-panel/20 rounded animate-pulse" style={{ animationDelay: '1100ms' }} />
                </div>
              </div>
            )}

            <iframe
              src={book.externalUrl}
              onLoad={() => {
                // Ensure the loading state is cleared even if some content is blocked
                setTimeout(() => setIframeLoading(false), 2000);
              }}
              className="w-full h-full border-none bg-white"
              title={book.title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals"
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
    <div className="fixed inset-0 bg-bit-bg flex flex-col items-center animate-fade-in">
      <div className="h-16 w-full border-b border-bit-border bg-bit-panel/50 p-6 flex justify-between">
        <div className="h-4 w-32 bg-bit-panel/20 rounded-full animate-pulse" />
        <div className="h-4 w-20 bg-bit-panel/20 rounded-full animate-pulse" />
      </div>
      <div className="w-full max-w-[560px] h-full p-20 space-y-8 bg-bit-panel/5 border-x border-bit-border shadow-2xl overflow-hidden">
        <div className="h-10 w-3/4 bg-bit-panel/20 rounded animate-pulse" />
        <div className="h-4 w-full bg-bit-panel/10 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-bit-panel/10 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-bit-panel/10 rounded animate-pulse" />
        <div className="h-4 w-full bg-bit-panel/10 rounded animate-pulse" />
        <div className="h-96 w-full bg-bit-panel/10 rounded animate-pulse" />
      </div>
    </div>
  );
};

export default Reader;
