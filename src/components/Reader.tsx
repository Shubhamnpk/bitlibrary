import React, { useState, useEffect, useRef } from 'react';
import { Book } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import { ArrowLeft, BookOpen, Settings, Share2, ChevronLeft, ChevronRight, Loader2, Maximize2, X, Layout, Monitor, Minimize2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

const Reader: React.FC<ReaderProps> = ({ book, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(1);
  const [fontSize, setFontSize] = useState(18);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isExternal = !!book.externalUrl;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImmersive) {
          setIsImmersive(false);
        } else if (!isMinimized) {
          // If already in normal view, maybe minimize or close? 
          // Let's just exit immersive for now.
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

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 w-64 h-40 bg-bit-bg border border-bit-accent/30 rounded-xl shadow-2xl z-[100] cursor-pointer hover:scale-105 transition-all overflow-hidden animate-fade-in group"
      >
         <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
         {book.coverUrl ? (
            <img src={book.coverUrl} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" alt="" />
         ) : (
            <div className={`w-full h-full bg-gradient-to-br from-bit-accent/10 to-transparent`}></div>
         )}
         <div className="absolute inset-x-4 bottom-4">
            <h4 className="text-white text-xs font-bold truncate">{book.title}</h4>
            <p className="text-[10px] text-bit-accent font-mono uppercase tracking-widest mt-1">Paused Node</p>
         </div>
         <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1.5 bg-black/50 rounded-full text-white hover:bg-red-500/50"
            >
               <X size={12} />
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[1000] bg-bit-bg flex flex-col animate-fade-in overflow-hidden shadow-2xl transition-all duration-700`}>
      {/* Smart Reveal / Fixed Header */}
      <header className={`h-16 border-b border-white/10 bg-black/80 backdrop-blur-2xl flex items-center justify-between px-6 z-[10001] transition-all duration-310 ${isImmersive ? 'absolute top-0 left-0 right-0 -translate-y-[90%] hover:translate-y-0 opacity-0 hover:opacity-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]' : 'relative'}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 pr-4 border-r border-white/10 group transition-all"
          >
            <div className="p-2 bg-white/5 rounded-full text-bit-accent group-hover:bg-bit-accent group-hover:text-black transition-all">
               <ArrowLeft size={18} />
            </div>
            <span className="hidden sm:block text-[10px] font-mono font-bold text-white tracking-widest uppercase">RETURN_TO_LAB</span>
          </button>
          <div className="pl-2">
            <h2 className="font-display font-semibold text-white tracking-tight line-clamp-1 max-w-[200px] md:max-w-md">{book.title}</h2>
            <p className="text-[9px] text-bit-accent font-mono uppercase tracking-widest animate-pulse">
                SYNC_NODE: {book.id.substring(0, 12)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isExternal && (
            <div className="flex items-center gap-1 mr-4 bg-white/5 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                className="p-1 px-2 hover:bg-white/10 rounded text-white font-mono text-xs transition-colors"
                title="Decrease font size"
              >
                A-
              </button>
              <div className="w-[1px] h-3 bg-white/10"></div>
              <button
                onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                className="p-1 px-2 hover:bg-white/10 rounded text-white font-mono text-xs transition-colors"
                title="Increase font size"
              >
                A+
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <button
                onClick={() => setIsMinimized(true)}
                className="p-2.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-bit-accent transition-all"
                title="Minimize stream (PIP)"
            >
              <Layout size={18} />
            </button>
            <button
                onClick={() => setIsImmersive(true)}
                className="p-2.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-bit-accent transition-all"
                title="Neural Focus Mode"
            >
              <Maximize2 size={18} />
            </button>
            <button
                onClick={toggleFullscreen}
                className="p-2.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-bit-accent hidden md:block transition-all"
                title="System Fullscreen"
            >
              <Monitor size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide bg-white/5">
        {isExternal ? (
          <div className="w-full h-full bg-white relative">
            <iframe
              src={book.externalUrl}
              className="w-full h-full border-none"
              title={book.title}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            ></iframe>
            {isImmersive && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] text-bit-accent font-mono z-10 pointer-events-none uppercase tracking-[0.2em] shadow-2xl">
                Encapsulated Registry View
                </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 animate-fade-in">
            {loading && content.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-bit-accent" size={40} />
                <p className="font-mono text-sm text-bit-accent animate-pulse uppercase tracking-widest">Decrypting Neural Stream...</p>
              </div>
            )}

            <div
              ref={contentRef}
              style={{ fontSize: `${fontSize}px` }}
              className={`prose prose-invert prose-p:text-gray-300 prose-headings:text-white prose-headings:font-display prose-strong:text-white prose-a:text-bit-accent max-w-none transition-all duration-300 leading-relaxed font-serif ${isImmersive ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
            >
              <ReactMarkdown>{content}</ReactMarkdown>
              {loading && content.length > 0 && <span className="inline-block w-2 h-4 bg-bit-accent animate-pulse ml-1 align-middle"></span>}
            </div>

            {!loading && (
              <div className="mt-20 flex items-center justify-between pt-10 border-t border-white/5">
                <button
                  disabled={chapter <= 1}
                  onClick={() => setChapter(c => c - 1)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 font-mono text-xs transition-colors ${chapter <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:border-bit-accent/50 text-white'}`}
                >
                  <ChevronLeft size={16} /> PREV_CHUNK
                </button>
                <button
                  onClick={() => setChapter(c => c + 1)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-bit-accent text-black font-bold font-mono text-xs hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(255,77,0,0.3)] hover:scale-95"
                >
                  FETCH_NEXT <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Natural Top-Right Command Capsule - Always accessible in Immersive/Fullscreen */}
      <div className={`fixed top-4 right-6 flex items-center gap-2 p-1.5 bg-black/80 backdrop-blur-2xl border border-white/20 rounded-full z-[10005] transition-all duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${isImmersive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'}`}>
        <div className="flex items-center gap-1.5 px-3 border-r border-white/10 group cursor-default">
           <Zap className="text-bit-accent animate-pulse" size={14} />
           <span className="text-[9px] text-white/60 font-mono uppercase tracking-[0.2em]">Live_Stream</span>
        </div>
        
        <button
          onClick={() => setIsImmersive(false)}
          className="p-2 bg-white/5 hover:bg-bit-accent hover:text-black rounded-full transition-all text-white/40"
          title="Restore HUD"
        >
            <Minimize2 size={16} />
        </button>
        
        <button
          onClick={onClose}
          className="p-2 bg-red-500/20 hover:bg-red-500 hover:text-white rounded-full transition-all text-red-500"
          title="Exit Neural Stream"
        >
            <X size={16} />
        </button>
      </div>

      {/* Extreme Top Rescue Zone (Transparent Header Reveal) */}
      {isImmersive && (
        <div className="fixed top-0 left-0 right-0 h-2 bg-gradient-to-b from-bit-accent/30 to-transparent opacity-0 hover:opacity-100 transition-all duration-300 z-[10000] cursor-n-resize group">
           <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-bit-accent text-black text-[9px] font-bold font-mono rounded-b-lg shadow-[0_0_20px_rgba(255,77,0,0.5)] transform -translate-y-6 group-hover:translate-y-0 transition-all">
              NODE_OPERATIONAL // REVEAL HEADER
           </div>
        </div>
      )}

      {/* Lab UI footer bar */}
      {!isImmersive && (
        <div className="h-2 bg-bit-bg flex border-t border-white/5 relative z-10">
          <div className="h-full bg-bit-accent/10 w-1/4 border-r border-white/5"></div>
          <div className="h-full bg-bit-accent/60 w-1/2 shadow-[0_0_20px_rgba(255,77,0,0.3)]"></div>
          <div className="h-full bg-bit-bg w-1/4"></div>
        </div>
      )}
    </div>
  );
};

export default Reader;
