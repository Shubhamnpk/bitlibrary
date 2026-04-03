import React, { useState, useEffect } from 'react';
import { Book, ViewState } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import BookCard from '@/components/BookCard';
import { ArrowLeft, BookOpen, User, Calendar, BarChart, Zap, Share2, Play, ChevronRight, Share, Info, Maximize2, Library, Download, Bookmark } from 'lucide-react';
import { BookCardSkeleton, BookDetailsSkeleton } from '@/components/Skeletons';
import ReactMarkdown from 'react-markdown';
import { recordRecentlyViewedBook, toggleSavedBook, useLocalUserState } from '@/lib/local-user';

interface BookDetailsProps {
  book: Book;
  allBooks: Book[];
  onClose: () => void;
  onRead: (id?: string) => void;
  onBookClick: (book: Book) => void;
  onAuthorClick?: (name: string) => void;
  onCategoryClick?: (category: string) => void;
  onBreadcrumbClick?: (book: Book, index: number) => void;
  breadcrumbPath?: Book[];
}

const BookDetails: React.FC<BookDetailsProps> = ({ book, allBooks, onClose, onRead, onBookClick, onAuthorClick, onCategoryClick, onBreadcrumbClick, breadcrumbPath = [] }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'read' | 'authors'>('overview');
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [fullDescription, setFullDescription] = useState<string>(book.description || '');
  const [descLoading, setDescLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { state } = useLocalUserState();
  const isSaved = state.savedBooks.some((entry) => entry.id === book.id);

  // Synchronize Neural History for generic volumes
  useEffect(() => {
    setFullDescription(book.description || '');
    setDescLoading(false);
  }, [book.id, book.description]); // Re-sync on book change

  const handleGenerateSummary = async () => {
    setDescLoading(true);
    try {
      const { generateNeuralSummary } = await import('@/services/geminiService');
      const summary = await generateNeuralSummary(book);
      setFullDescription(summary);
    } catch (err) {
      console.error("Neural Summary Synthesis Failed:", err);
    } finally {
      setDescLoading(false);
    }
  };

  useEffect(() => {
    recordRecentlyViewedBook(book);
  }, [book]);

  // Synchronize Similar Books
  useEffect(() => {
    const syncSimilar = async () => {
      const local = allBooks
        .filter(b => b.category === book.category && b.id !== book.id)
        .slice(0, 3);

      setSimilarBooks(local);

      if (local.length < 3 && book.category) {
        setSimilarLoading(true);
        try {
          const { searchBooksInGutendex, searchGoogleBooks } = await import('@/services/bookService');
          const [gutenberg, google] = await Promise.all([
            searchBooksInGutendex(book.category),
            searchGoogleBooks(book.category)
          ]);

          const merged = [...local, ...gutenberg, ...google]
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            .filter(b => b.id !== book.id)
            .slice(0, 3);

          setSimilarBooks(merged);
        } catch (err) {
          console.error("Similar Node Sync Failed:", err);
        } finally {
          setSimilarLoading(false);
        }
      }
    };
    syncSimilar();
  }, [book.id, book.category, allBooks]);

  useEffect(() => {
    setContent('');
    setLoading(false);
    setActiveTab('overview');
  }, [book.id]);

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
      <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm font-mono text-bit-text hover:text-bit-accent transition-colors"
        >
          <ArrowLeft size={16} /> Back to Library
        </button>
        <div className="flex items-center gap-6">
          {book.source && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-bit-panel/50 border border-bit-border text-[9px] font-mono text-bit-muted/70 tracking-widest uppercase backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-bit-accent animate-pulse" />
              {book.source}
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => toggleSavedBook(book)}
              className={`transition-colors ${isSaved ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
            >
              <Bookmark size={18} className={isSaved ? 'fill-current' : ''} />
            </button>
            <button className="text-bit-muted hover:text-bit-text transition-colors"><Share2 size={18} /></button>
            <button className="text-bit-muted hover:text-bit-text transition-colors"><Zap size={18} /></button>
          </div>
        </div>
      </div>

      <nav className="mb-10 flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar whitespace-nowrap border-b border-bit-border">
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-bit-muted hover:text-bit-text uppercase tracking-[0.2em] transition-colors flex items-center gap-2 group/bc"
        >
          <Library size={12} className="group-hover/bc:text-bit-accent" /> Library
        </button>

        {breadcrumbPath.map((b, i) => (
          <React.Fragment key={`${b.id}-${i}`}>
            <ChevronRight size={10} className="text-bit-muted/20" />
            <button
              onClick={() => onBreadcrumbClick ? onBreadcrumbClick(b, i) : onBookClick(b)}
              className="text-[10px] font-mono text-bit-muted/60 hover:text-bit-accent uppercase tracking-[0.2em] transition-colors"
            >
              {b.title.length > 20 ? `${b.title.substring(0, 20)}...` : b.title}
            </button>
          </React.Fragment>
        ))}

        <ChevronRight size={10} className="text-bit-muted/20" />
        <span className="text-[10px] font-mono text-bit-accent uppercase tracking-[0.3em] font-bold">
          {book.title.length > 30 ? `${book.title.substring(0, 30)}...` : book.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 sticky top-24 h-fit">
          <div className={`aspect-[2/3] w-full rounded-2xl bg-gradient-to-br ${book.coverGradient || 'from-orange-500/20 to-purple-900/40'} shadow-2xl border border-bit-border overflow-hidden relative group`}>
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-700"
                alt=""
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent group-hover:via-black/20 transition-all duration-500" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-700 backdrop-blur-[4px] z-10">
              <button
                onClick={(e) => { e.stopPropagation(); onRead(); }}
                className="px-8 py-4 bg-bit-accent text-white flex items-center gap-4 rounded-full shadow-[0_0_60px_rgba(var(--bit-accent-rgb),0.6)] transform scale-75 group-hover:scale-100 transition-all duration-700 hover:scale-105 active:scale-95 border-4 border-black/10 group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                <BookOpen size={24} className="relative z-10" />
                <span className="text-xs font-mono font-bold tracking-[0.2em] relative z-10 uppercase">READ_VOLUME</span>
              </button>
            </div>
            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  onClick={() => onCategoryClick?.(book.category)}
                  className="inline-block px-3 py-1 rounded bg-bit-accent text-white text-[10px] font-bold uppercase tracking-widest w-fit shadow-lg shadow-bit-accent/40 hover:bg-white hover:text-black transition-all active:scale-95"
                >
                  {book.category}
                </button>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-[1.1] tracking-tight group-hover:text-bit-accent transition-colors duration-500">{book.title}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-6 mb-10 border-l-2 border-bit-accent/30 pl-4 py-1 italic">
                <span className="text-xl text-white/70 font-sans">by</span>
                {book.authors && book.authors.length > 0 ? (
                  book.authors.map((author, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAuthorClick?.(author.name)}
                      className="group/author text-left flex flex-col"
                    >
                      <span className="text-xl text-white hover:text-bit-accent transition-colors font-sans">
                        {author.name}{idx < book.authors!.length - 1 ? ',' : ''}
                      </span>
                      {author.birth_year && (
                        <span className="block text-[10px] font-mono text-white/30 uppercase mt-1 not-italic tracking-[0.2em] group-hover/author:text-bit-accent/50 transition-colors">
                          {author.birth_year} — {author.death_year || 'Decelerated'}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <span className="text-xl text-white/70 font-sans">{book.author}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
                <span className="flex items-center gap-1"><Calendar size={12} /> {book.year || 'N/A'}</span>
                <span className="mx-2">•</span>
                <span className="flex items-center gap-1"><BookOpen size={12} /> {book.pages || 'INF'} Pages</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="flex gap-8 border-b border-bit-border mb-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 text-sm font-mono font-bold tracking-wider transition-colors relative ${activeTab === 'overview' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
            >
              OVERVIEW
              {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`pb-4 text-sm font-mono font-bold tracking-wider transition-colors relative ${activeTab === 'read' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
            >
              AI_CHAPTER_EXTRACT
              {activeTab === 'read' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
            {book.authors && book.authors.length > 1 && (
              <button
                onClick={() => setActiveTab('authors')}
                className={`pb-4 text-sm font-mono font-bold tracking-wider transition-colors relative ${activeTab === 'authors' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
              >
                CONTRIBUTORS
                {activeTab === 'authors' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
              </button>
            )}
          </div>

          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <section className="mb-12">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-semibold text-bit-text flex items-center gap-2">
                    <Info size={18} className="text-bit-accent" /> Summary Registry
                  </h3>
                  <div className="flex gap-3">
                    {book.downloadUrl && (
                      <a href={book.downloadUrl} download={book.title} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 bg-bit-panel/50 text-bit-accent border border-bit-accent/30 rounded-lg flex items-center gap-2 font-mono text-[10px] font-bold uppercase transition-all hover:bg-bit-accent hover:text-white hover:border-bit-accent shadow-sm active:scale-95 group/dl">
                        <Download size={16} className="group-hover/dl:translate-y-0.5 transition-transform" /> Download
                      </a>
                    )}
                    <button onClick={() => onRead()} className="px-6 py-2.5 bg-bit-accent text-white rounded-lg shadow-lg shadow-bit-accent/20 flex items-center gap-2 font-mono text-[10px] font-bold uppercase transition-all hover:scale-105 active:scale-95">
                      <BookOpen size={16} /> Open Volume
                    </button>
                  </div>
                </div>
                <div className="text-lg text-bit-muted leading-relaxed max-w-3xl">
                  {descLoading ? (
                    <div className="flex flex-col gap-4">
                      <div className="h-4 bg-bit-panel/50 rounded animate-pulse w-full" />
                      <div className="h-4 bg-bit-panel/50 rounded animate-pulse w-5/6" />
                      <div className="h-4 bg-bit-panel/50 rounded animate-pulse w-4/6" />
                      <span className="flex items-center gap-2 text-[10px] font-mono text-bit-accent animate-pulse mt-2 uppercase tracking-[0.2em] font-bold">
                        <Zap size={12} className="animate-pulse" /> Reconstructing Neural History...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="prose prose-bit prose-p:text-bit-muted max-w-none">
                        <ReactMarkdown>
                          {(!isExpanded && fullDescription.length > 400) ? `${fullDescription.substring(0, 400)}...` : fullDescription}
                        </ReactMarkdown>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-6">
                        {fullDescription.length > 400 && (
                          <button onClick={() => setIsExpanded(!isExpanded)} className="text-[10px] font-mono text-bit-accent hover:text-bit-text transition-colors uppercase tracking-widest flex items-center gap-2 group/more font-bold">
                            <div className={`w-1 h-1 rounded-full bg-bit-accent transition-all group-hover/more:scale-150 ${isExpanded ? 'bg-bit-text' : 'animate-pulse'}`} />
                            {isExpanded ? 'Show Less' : 'Show More'}
                          </button>
                        )}
                        {fullDescription === book.description && (
                          <button onClick={handleGenerateSummary} className="text-[10px] font-mono text-bit-muted/70 hover:text-bit-accent transition-all uppercase tracking-[0.2em] flex items-center gap-2 border border-bit-border hover:border-bit-accent/30 px-3 py-1.5 rounded-full bg-bit-panel/30 shadow-sm">
                            <Zap size={12} /> Synthesize AI Summary
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="mb-12">
                <h3 className="text-xl font-display font-semibold text-bit-text mb-6">Metadata Archive</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-bit-border bg-bit-panel/30 shadow-sm">
                    <p className="text-[10px] font-mono text-bit-muted uppercase mb-1 font-bold">Impact Score</p>
                    <p className="text-2xl font-display font-bold text-bit-text">{book.popularity || 0}%</p>
                  </div>
                  <div className="p-4 rounded-xl border border-bit-border bg-bit-panel/30 shadow-sm">
                    <p className="text-[10px] font-mono text-bit-muted uppercase mb-1 font-bold">Downloads</p>
                    <p className="text-2xl font-display font-bold text-bit-text">{(book.downloads || 0).toLocaleString()}</p>
                  </div>
                  <button onClick={() => onAuthorClick?.(book.author)} className="p-4 rounded-xl border border-bit-border bg-bit-panel/30 text-left hover:border-bit-accent/50 transition-colors group/meta shadow-sm">
                    <p className="text-[10px] font-mono text-bit-muted uppercase mb-1 group-hover/meta:text-bit-accent transition-colors font-bold">By Artist</p>
                    <p className="text-xl font-display font-bold text-bit-text truncate group-hover/meta:text-bit-accent transition-colors">{book.author}</p>
                  </button>
                  <div className="p-4 rounded-xl border border-bit-border bg-bit-panel/30 shadow-sm">
                    <p className="text-[10px] font-mono text-bit-muted uppercase mb-1 font-bold">Language</p>
                    <p className="text-2xl font-display font-bold text-bit-text">English</p>
                  </div>
                </div>
              </section>

              {((book.subjects && book.subjects.length > 0) || (book.bookshelves && book.bookshelves.length > 0)) && (
                <section className="mb-12">
                  <h3 className="text-xl font-display font-semibold text-bit-text mb-6">Subject Inventory</h3>
                  <div className="flex flex-wrap gap-2">
                    {book.subjects?.map((s, i) => (
                      <button key={i} onClick={() => onCategoryClick?.(s)} className="px-3 py-1.5 rounded-lg bg-bit-accent/5 border border-bit-accent/20 text-[9px] font-mono text-bit-accent uppercase tracking-[0.2em] font-bold hover:bg-bit-accent hover:text-white hover:border-bit-accent transition-all shadow-sm active:scale-95">
                        {s}
                      </button>
                    ))}
                    {book.bookshelves?.map((b, i) => (
                      <button key={i} onClick={() => onCategoryClick?.(b)} className="px-3 py-1.5 rounded-lg bg-bit-panel/30 border border-bit-border text-[9px] font-mono text-bit-muted uppercase tracking-[0.2em] font-bold hover:bg-bit-muted hover:text-white hover:border-bit-muted transition-all shadow-sm active:scale-95">
                        {b}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'read' && (
            <div className="animate-fade-in bg-bit-panel/30 border border-bit-border rounded-2xl p-8 min-h-[500px] shadow-sm">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-2 border-bit-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-mono text-sm text-bit-accent font-bold uppercase tracking-widest">Splicing neural stream...</p>
                </div>
              ) : (
                <article className="prose prose-bit prose-p:text-bit-muted max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </article>
              )}
            </div>
          )}

          {activeTab === 'authors' && book.authors && (
            <div className="animate-fade-in-up space-y-6">
              <h3 className="text-xl font-display font-semibold text-bit-text mb-8 px-2 flex items-center gap-3">
                <User size={20} className="text-bit-accent" /> Collaborative Registry
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {book.authors.map((author, index) => (
                  <button key={index} onClick={() => onAuthorClick?.(author.name)} className="flex items-center gap-6 p-6 rounded-2xl bg-bit-panel/30 border border-bit-border hover:border-bit-accent/30 transition-all group/author-card text-left relative overflow-hidden shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-bit-accent/5 to-transparent pr-4 opacity-0 group-hover/author-card:opacity-100 transition-opacity" />
                    <div className="w-14 h-14 rounded-2xl bg-bit-panel/50 border border-bit-border flex items-center justify-center text-bit-accent group-hover/author-card:bg-bit-accent group-hover/author-card:text-white transition-all duration-500 relative z-10 shadow-sm">
                      <User size={24} />
                    </div>
                    <div className="relative z-10 flex-1">
                      <h4 className="text-lg font-display font-bold text-bit-text group-hover/author-card:text-bit-accent transition-colors tracking-tight">{author.name}</h4>
                      {author.birth_year && (
                        <p className="font-mono text-[10px] text-bit-muted uppercase tracking-widest mt-1 font-bold">
                          {author.birth_year} — {author.death_year || 'Decelerated'}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-bit-muted/30 group-hover/author-card:text-bit-accent group-hover/author-card:translate-x-1 transition-all relative z-10" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-semibold text-bit-text tracking-tight">Similar Works</h3>
              <ChevronRight className="text-bit-accent" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-6 md:gap-8">
              {similarLoading ? [1, 2, 3].map(i => <BookCardSkeleton key={i} />) : similarBooks.map(b => (
                <BookCard key={b.id} book={b} onClick={onBookClick} onRead={(sb) => onRead(sb.id)} variant="compact" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BookDetails;
