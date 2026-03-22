import React, { useState, useEffect } from 'react';
import { Book, ViewState } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import BookCard from '@/components/BookCard';
import { ArrowLeft, BookOpen, User, Calendar, BarChart, Zap, Share2, Play, ChevronRight, Share, Info, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface BookDetailsProps {
  book: Book;
  allBooks: Book[];
  onClose: () => void;
  onRead: (id?: string) => void;
  onBookClick: (book: Book) => void;
}

const BookDetails: React.FC<BookDetailsProps> = ({ book, allBooks, onClose, onRead, onBookClick }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'read'>('overview');
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [fullDescription, setFullDescription] = useState<string>(book.description);
  const [descLoading, setDescLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Synchronize Neural History for generic volumes
  useEffect(() => {
    if (book.description.startsWith('Classical volume found in neural archives')) {
      const loadNeuralDesc = async () => {
        setDescLoading(true);
        const { generateNeuralSummary } = await import('@/services/geminiService');
        const summary = await generateNeuralSummary(book);
        setFullDescription(summary);
        setDescLoading(false);
      };
      loadNeuralDesc();
    } else {
      setFullDescription(book.description);
      setDescLoading(false);
    }
  }, [book.id]); // Reload on book change

  // Synchronize Similar Books
  useEffect(() => {
    const syncSimilar = async () => {
      // 1. Initial local synchronization
      const local = allBooks
        .filter(b => b.category === book.category && b.id !== book.id)
        .slice(0, 3);

      setSimilarBooks(local);

      // 2. Deep ARCHIVE Synchronization if local registry is small
      if (local.length < 3 && book.category) {
        const { searchBooksInGutendex, searchGoogleBooks } = await import('@/services/bookService');
        const [gutenberg, google] = await Promise.all([
          searchBooksInGutendex(book.category),
          searchGoogleBooks(book.category)
        ]);

        const merged = [...local, ...gutenberg, ...google]
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Unique
          .filter(b => b.id !== book.id)
          .slice(0, 3);

        setSimilarBooks(merged);
      }
    };
    syncSimilar();
  }, [book.id, book.category, allBooks]);

  // Load preview content for the Read tab
  useEffect(() => {
    if (activeTab === 'read' && !content) {
      const loadPreview = async () => {
        setLoading(true);
        const text = await streamBookChapter(book, 1);
        setContent(text);
        setLoading(false);
      };
      loadPreview();
    }
  }, [activeTab, book, content]);

  return (
    <div className="animate-fade-in pb-20">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm font-mono text-white hover:text-bit-accent transition-colors"
        >
          <ArrowLeft size={16} /> Back to Library
        </button>
        <div className="flex items-center gap-6">
          {book.source && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/40 tracking-widest uppercase backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-bit-accent animate-pulse" />
              {book.source}
            </div>
          )}
          <div className="flex gap-4">
            <button className="text-gray-400 hover:text-white transition-colors"><Share2 size={18} /></button>
            <button className="text-gray-400 hover:text-white transition-colors"><Zap size={18} /></button>
          </div>
        </div>
      </div>

      {/* Main Content: Immersive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* Left Col: Book Identity (4 cols) */}
        <div className="lg:col-span-4 sticky top-24 h-fit">
          <div className={`aspect-[2/3] w-full rounded-2xl bg-gradient-to-br ${book.coverGradient || 'from-orange-500/20 to-purple-900/40'} shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden relative group`}>
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-700"
                alt=""
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent group-hover:via-black/20 transition-all duration-500" />

            {/* Hover Neural Link Action Hub */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-700 backdrop-blur-[4px] z-10">
              <button
                onClick={(e) => { e.stopPropagation(); onRead(); }}
                className="px-8 py-4 bg-bit-accent text-black flex items-center gap-4 rounded-full shadow-[0_0_60px_rgba(255,77,0,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-700 hover:scale-105 active:scale-95 border-4 border-black/10 group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                <BookOpen size={24} className="relative z-10" />
                <span className="text-xs font-mono font-bold tracking-[0.2em] relative z-10 uppercase">READ</span>
              </button>
            </div>
            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded bg-bit-accent text-black text-[10px] font-bold uppercase tracking-widest w-fit shadow-[0_0_15px_rgba(255,77,0,0.4)]">
                  {book.category}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-[1.1] tracking-tight group-hover:text-bit-accent transition-colors duration-500">{book.title}</h1>
              <p className="text-xl text-white/70 mb-10 font-sans border-l-2 border-bit-accent/30 pl-4 py-1 italic">by {book.author}</p>
              <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
                <span className="flex items-center gap-1"><Calendar size={12} /> {book.year || 'N/A'}</span>
                <span className="mx-2">•</span>
                <span className="flex items-center gap-1"><BookOpen size={12} /> {book.pages || 'INF'} Pages</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Col: Details (8 cols) */}
        <div className="lg:col-span-8">
          <div className="flex gap-8 border-b border-white/5 mb-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 text-sm font-mono tracking-wider transition-colors relative ${activeTab === 'overview' ? 'text-bit-accent' : 'text-gray-500 hover:text-white'}`}
            >
              OVERVIEW
              {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`pb-4 text-sm font-mono tracking-wider transition-colors relative ${activeTab === 'read' ? 'text-bit-accent' : 'text-gray-500 hover:text-white'}`}
            >
              AI CHAPTER EXTRACT
              {activeTab === 'read' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <section className="mb-12">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-semibold text-white flex items-center gap-2">
                    <Info size={18} className="text-bit-accent" /> History
                  </h3>
                  <button
                    onClick={onRead}
                    className="px-6 py-2.5 bg-bit-accent text-black rounded-lg shadow-[0_0_20px_rgba(255,77,0,0.3)] flex items-center gap-2 font-mono text-[10px] font-bold uppercase transition-all hover:scale-105 active:scale-95"
                  >
                    <BookOpen size={14} /> open book
                  </button>
                </div>
                <div className="text-lg text-gray-400 leading-relaxed max-w-3xl">
                  {descLoading ? (
                    <div className="flex flex-col gap-4">
                      <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
                      <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
                      <div className="h-4 bg-white/5 rounded animate-pulse w-4/6" />
                      <span className="flex items-center gap-2 text-[10px] font-mono text-bit-accent animate-pulse mt-2 uppercase tracking-[0.2em]">
                        <Zap size={12} className="animate-pulse" /> Reconstructing Neural History...
                      </span>
                    </div>
                  ) : (
                    <>
                      <p>{fullDescription}</p>
                      {fullDescription !== book.description && (
                        <span className="block mt-6 text-[10px] font-mono text-white/20 uppercase tracking-widest border-t border-white/5 pt-4">
                          (This is an automatically generated neural summary)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section className="mb-12">
                <h3 className="text-xl font-display font-semibold text-white mb-6">Metadata Archive</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">Impact Score</p>
                    <p className="text-2xl font-display font-bold text-white">{book.popularity}%</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">Volume Type</p>
                    <p className="text-2xl font-display font-bold text-white">Full Stream</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">Source Node</p>
                    <p className="text-2xl font-display font-bold text-white">Gemini-3</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">Language</p>
                    <p className="text-2xl font-display font-bold text-white">English</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'read' && (
            <div className="animate-fade-in glass-panel rounded-2xl p-8 min-h-[500px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-2 border-bit-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-mono text-sm text-bit-accent">Splicing neural stream...</p>
                </div>
              ) : (
                <article className="prose prose-invert prose-p:text-gray-400 max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </article>
              )}
            </div>
          )}

          {/* Related Collections Section */}
          <section className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-semibold text-white">Similar Books</h3>
              <ChevronRight className="text-bit-accent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {similarBooks.map(b => (
                <BookCard key={b.id} book={b} onClick={onBookClick} onRead={(sb) => onRead(sb.id)} variant="compact" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export const BookDetailsSkeleton: React.FC = () => {
  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto">
      <div className="h-8 w-32 bg-white/5 rounded-md mb-8 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 h-[500px] rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
        <div className="lg:col-span-8 space-y-8">
          <div className="h-4 w-1/4 bg-white/5 rounded animate-pulse" />
          <div className="h-16 w-3/4 bg-white/5 rounded animate-pulse" />
          <div className="h-12 w-full bg-white/5 rounded animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-white/[0.01] border border-white/5 animate-pulse" />)}
          </div>
          <div className="h-64 rounded-2xl bg-white/[0.01] border border-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default BookDetails;
