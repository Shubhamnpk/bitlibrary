import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../types';
import { streamBookChapter } from '../services/geminiService';
import { ArrowLeft, BookOpen, Settings, Share2, ChevronLeft, ChevronRight, Loader2, Maximize2 } from 'lucide-react';
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
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadChapter = async () => {
      setLoading(true);
      setContent(''); // Clear previous content
      
      const text = await streamBookChapter(book, chapter);
      
      if (mounted) {
        // Simulate streaming typing effect for aesthetics
        let currentText = "";
        const words = text.split(" ");
        setLoading(false);
        
        // Fast "stream" locally since we get the full block from Gemini
        // In a real stream we would append chunks.
        let i = 0;
        const interval = setInterval(() => {
          if (i >= words.length) {
            clearInterval(interval);
            return;
          }
          currentText += words[i] + " ";
          setContent(currentText);
          i++;
          // Scroll to bottom if user is near bottom? No, usually top for reading.
        }, 10); // Very fast typing
      }
    };

    loadChapter();
    return () => { mounted = false; };
  }, [book, chapter]);

  return (
    <div className="fixed inset-0 z-50 bg-bit-bg flex flex-col animate-fade-in">
      {/* Reader Header */}
      <header className="h-16 border-b border-bit-border bg-bit-bg/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-display font-semibold text-white tracking-tight">{book.title}</h2>
            <p className="text-xs text-gray-500 font-mono">Chapter {chapter} • {book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="p-2 hover:bg-white/10 rounded-md text-gray-400 font-mono text-xs"
            >
              A-
            </button>
            <span className="text-xs font-mono text-gray-500">{fontSize}px</span>
            <button 
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="p-2 hover:bg-white/10 rounded-md text-gray-400 font-mono text-xs"
            >
              A+
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
            <button className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-bit-accent">
                <Share2 size={18} />
            </button>
             <button className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-bit-accent">
                <Maximize2 size={18} />
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide">
        <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
          
          {loading && content.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-bit-accent" size={40} />
              <p className="font-mono text-sm text-bit-accent animate-pulse">Decrypting content stream...</p>
            </div>
          )}

          <div 
            ref={contentRef}
            style={{ fontSize: `${fontSize}px` }}
            className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white prose-headings:font-display prose-strong:text-white prose-a:text-bit-accent max-w-none transition-all duration-300 leading-relaxed"
          >
            <ReactMarkdown>{content}</ReactMarkdown>
            {loading && content.length > 0 && <span className="inline-block w-2 h-4 bg-bit-accent animate-pulse ml-1 align-middle"></span>}
          </div>

          {!loading && (
            <div className="mt-20 flex items-center justify-between pt-10 border-t border-white/5">
                <button 
                    disabled={chapter <= 1}
                    onClick={() => setChapter(c => c - 1)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 font-mono text-sm transition-colors ${chapter <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:border-bit-accent/50 text-white'}`}
                >
                    <ChevronLeft size={16} /> Previous
                </button>
                <button 
                    onClick={() => setChapter(c => c + 1)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-bit-accent text-black font-semibold font-mono text-sm hover:bg-orange-500 transition-colors shadow-[0_0_15px_rgba(255,77,0,0.3)]"
                >
                    Next Chapter <ChevronRight size={16} />
                </button>
            </div>
          )}
        </div>
      </main>

      {/* Progress Bar */}
      <div className="h-1 bg-bit-border w-full">
         {/* In a real app, this would track scroll progress */}
         <div className="h-full bg-bit-accent w-1/3"></div> 
      </div>
    </div>
  );
};

export default Reader;
