import React, { useState, useEffect } from 'react';
import { Book, ChapterAudio, QuestionPaper, ViewState } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import BookCard from '@/components/BookCard';
import { ArrowLeft, BookOpen, User, Calendar, BarChart, Zap, Share2, Play, ChevronLeft, ChevronRight, Share, Info, Maximize2, Library, Download, Bookmark, ExternalLink, Headphones, X } from 'lucide-react';
import { BookCardSkeleton, BookDetailsSkeleton } from '@/components/Skeletons';
import ReactMarkdown from 'react-markdown';
import { recordRecentlyViewedBook, toggleSavedBook, useLocalUserState } from '@/lib/local-user';
import Seo from '@/components/Seo';
import { createBreadcrumbSchema, toAbsoluteUrl, truncate } from '@/lib/seo';
import { downloadPdfOptimized, getBestPdfSourceUrl } from '@/lib/pdf';
import { fetchYoBookGradeAudio, fetchYoBookGuideCollection, fetchYoBookTextbookCollection, getYoBookAudioSubjectForBook, isPriorCurriculumEdition } from '@/services/bookService';

const isCurriculumBook = (book: Book) => (
  book.source === 'YoBook'
  || Boolean(book.grade)
  || book.bookshelves?.includes('Nepali Curriculum')
  || book.subjects?.includes('Nepali Curriculum')
);

const normalizeCurriculumSubject = (value?: string) => {
  const normalized = (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (['math', 'maths', 'mathematics'].includes(normalized)) return 'mathematics';
  if (normalized.includes('english')) return 'english';
  if (normalized.includes('nepali')) return 'nepali';
  if (normalized.includes('science')) return 'science';
  if (normalized.includes('social')) return 'social studies';
  if (normalized.includes('health')) return 'health';
  return normalized;
};

const isTeacherGuideResource = (book: Book) => {
  const text = [
    book.title,
    book.category,
    book.description,
    ...(book.keywords || []),
    ...(book.bookshelves || []),
  ].join(' ').toLowerCase();

  return /teacher'?s?\s+(guide|note)|teaching\s+manual|teachers?\s+guides?|\u0936\u093f\u0915\u094d\u0937\u0915\s+\u0928\u093f\u0930\u094d\u0926\u0947\u0936\u093f\u0915\u093e|\u0936\u093f\u0915\u094d\u0937\u0923\s+\u0928\u093f\u0930\u094d\u0926\u0947\u0936\u093f\u0915\u093e/.test(text);
};

const isSameCurriculumFamily = (book: Book, candidate: Book) => (
  candidate.id !== book.id
  && candidate.grade === book.grade
  && normalizeCurriculumSubject(candidate.category) === normalizeCurriculumSubject(book.category)
  && (
    !book.curriculum
    || !candidate.curriculum
    || book.curriculum === candidate.curriculum
    || book.country === candidate.country
  )
);

const isQuestionPaperCollection = (book: Book) => (
  Array.isArray(book.question_papers) && book.question_papers.length > 0
);

const getQuestionPaperReadUrl = (paper: QuestionPaper) => (
  paper.readUrl || paper.url || paper.downloadUrl || ''
);

interface BookDetailsProps {
  book: Book;
  allBooks: Book[];
  onClose: () => void;
  onRead: (id?: string, book?: Book) => void;
  onBookClick: (book: Book) => void;
  onAuthorClick?: (name: string) => void;
  onCategoryClick?: (category: string) => void;
  onBreadcrumbClick?: (book: Book, index: number) => void;
  breadcrumbPath?: Book[];
}

const BookDetails: React.FC<BookDetailsProps> = ({ book, allBooks, onClose, onRead, onBookClick, onAuthorClick, onCategoryClick, onBreadcrumbClick, breadcrumbPath = [] }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'read' | 'authors'>('overview');
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [editionBooks, setEditionBooks] = useState<Book[]>([]);
  const [editionLoading, setEditionLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [chapterAudio, setChapterAudio] = useState<ChapterAudio[]>([]);
  const [chapterAudioLoading, setChapterAudioLoading] = useState(false);
  const [chapterAudioRequested, setChapterAudioRequested] = useState(false);
  const [selectedChapterAudioIndex, setSelectedChapterAudioIndex] = useState<number | null>(null);
  const [fullDescription, setFullDescription] = useState<string>(book.description || '');
  const [descLoading, setDescLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const pdfDownloadUrl = getBestPdfSourceUrl(book);
  const downloadUrl = pdfDownloadUrl || book.downloadUrl;
  const questionPaperCollection = isQuestionPaperCollection(book);
  const questionPapers = book.question_papers || [];
  const hasTopLevelReadableFile = Boolean(downloadUrl || book.externalUrl || book.resourceLinks?.length || book.chapterPdfUrls?.length || book.audioUrl);
  const displayCurriculum = book.curriculum === 'CDC Nepal' ? undefined : book.curriculum;
  const handleDownload = async () => {
    if (!pdfDownloadUrl) return;
    await downloadPdfOptimized(pdfDownloadUrl, book.title);
  };
  const handleReadQuestionPaper = (paper: QuestionPaper, index: number) => {
    const paperUrl = getQuestionPaperReadUrl(paper);
    if (!paperUrl) return;

    onRead(undefined, {
      ...book,
      id: `${book.id}-question-paper-${index}`,
      title: paper.title,
      author: book.collection_name || book.author,
      authors: [{ name: book.collection_name || book.author }],
      description: [book.title, paper.year, paper.fileSize].filter(Boolean).join(' - ') || paper.title,
      coverUrl: paper.coverUrl || book.coverUrl,
      year: paper.year && /^\d{1,4}$/.test(paper.year) ? Number(paper.year) : undefined,
      pages: undefined,
      externalUrl: paperUrl,
      downloadUrl: paperUrl,
      sourceUrl: paper.sourceUrl || book.sourceUrl,
      detailUrl: paper.sourceUrl || book.detailUrl,
      resourceLinks: undefined,
      chapterPdfUrls: undefined,
      question_papers: undefined,
      questionPaperCount: undefined,
    });
  };
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

  useEffect(() => {
    if (!isCurriculumBook(book) || !book.grade) {
      setEditionBooks([]);
      setEditionLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const syncEditions = async () => {
      setEditionLoading(true);
      try {
        const [textbookCollection, guideCollection] = await Promise.all([
          fetchYoBookTextbookCollection(controller.signal),
          fetchYoBookGuideCollection(controller.signal),
        ]);
        if (!isMounted) return;

        const gradeCandidates = isTeacherGuideResource(book)
          ? (guideCollection.rows[book.grade || 0] || [])
          : (textbookCollection.rows[book.grade || 0] || []);
        const currentIsPrior = isPriorCurriculumEdition(book);
        const editions = gradeCandidates
          .filter((candidate) => isSameCurriculumFamily(book, candidate))
          .filter((candidate) => currentIsPrior || isPriorCurriculumEdition(candidate))
          .filter((candidate, index, list) => list.findIndex((entry) => entry.id === candidate.id) === index)
          .slice(0, 6);

        setEditionBooks(editions);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Curriculum edition sync failed:', error);
          setEditionBooks([]);
        }
      } finally {
        if (isMounted) setEditionLoading(false);
      }
    };

    void syncEditions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [book]);

  const audioSubject = getYoBookAudioSubjectForBook(book);
  const canLoadChapterAudio = Boolean(isCurriculumBook(book) && book.grade && audioSubject);
  const selectedChapterAudio = selectedChapterAudioIndex === null ? null : chapterAudio[selectedChapterAudioIndex] || null;

  const loadChapterAudio = async () => {
    if (!book.grade || !audioSubject || chapterAudioLoading) return;

    setChapterAudioRequested(true);
    setChapterAudioLoading(true);
    try {
      const chapters = await fetchYoBookGradeAudio(book.grade, audioSubject);
      setChapterAudio(chapters);
    } catch (error) {
      console.error('Curriculum audio sync failed:', error);
      setChapterAudio([]);
    } finally {
      setChapterAudioLoading(false);
    }
  };

  useEffect(() => {
    setChapterAudio([]);
    setChapterAudioLoading(false);
    setChapterAudioRequested(false);
    setSelectedChapterAudioIndex(null);
  }, [book.id]);

  // Synchronize Similar Books
  useEffect(() => {
    const syncSimilar = async () => {
      if (isCurriculumBook(book) && book.grade) {
        const localCurriculum = allBooks
          .filter((candidate) => (
            candidate.id !== book.id
            && candidate.grade === book.grade
            && candidate.category !== book.category
          ))
          .slice(0, 3);

        setSimilarBooks(localCurriculum);

        if (localCurriculum.length < 3) {
          setSimilarLoading(true);
          try {
            const { fetchBooksFromYoBook } = await import('@/services/bookService');
            const { books } = await fetchBooksFromYoBook(1, `Class ${book.grade}`);

            const merged = [...localCurriculum, ...books]
              .filter((candidate) => (
                candidate.id !== book.id
                && candidate.grade === book.grade
                && candidate.category !== book.category
              ))
              .filter((candidate, index, list) => list.findIndex((entry) => entry.id === candidate.id) === index)
              .slice(0, 3);

            setSimilarBooks(merged);
          } catch (err) {
            console.error("Curriculum Similar Sync Failed:", err);
          } finally {
            setSimilarLoading(false);
          }
        }
        return;
      }

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
  }, [book.id, book.category, book.grade, book.source, book.subjects, book.bookshelves, allBooks]);

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
      <Seo
        title={`${book.title} by ${book.author || 'Unknown Author'} | Read Online | BitLibrary`}
        description={truncate(
          `${book.description || `Read ${book.title} by ${book.author || 'Unknown Author'} in BitLibrary.`} Explore metadata, subjects, related works, reading options, and source downloads.`,
          155
        )}
        canonicalPath={`/book/${book.id}`}
        image={book.coverUrl}
        type="book"
        keywords={[
          book.title,
          book.author,
          book.category,
          ...(book.subjects || []).slice(0, 6),
          'read online',
          'public domain book',
        ].filter(Boolean)}
        structuredData={[
          createBreadcrumbSchema([
            { name: 'BitLibrary', path: '/' },
            { name: 'Library', path: '/library' },
            { name: book.category || 'Books', path: `/category/${encodeURIComponent(book.category || 'Books')}` },
            { name: book.title, path: `/book/${book.id}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            url: toAbsoluteUrl(`/book/${book.id}`),
            author: (book.authors && book.authors.length > 0 ? book.authors : [{ name: book.author }]).map((author) => ({
              '@type': 'Person',
              name: author.name,
              ...(author.birth_year ? { birthDate: String(author.birth_year) } : {}),
              ...(author.death_year ? { deathDate: String(author.death_year) } : {}),
            })),
            description: truncate(book.description || `${book.title} by ${book.author}`, 300),
            genre: book.category,
            image: book.coverUrl,
            datePublished: book.year ? String(book.year) : undefined,
            inLanguage: book.language || 'en',
            isAccessibleForFree: true,
            keywords: [...(book.subjects || []), ...(book.bookshelves || [])].slice(0, 12).join(', '),
            sameAs: book.externalUrl,
            workExample: book.downloadUrl
              ? {
                  '@type': 'Book',
                  bookFormat: 'https://schema.org/EBook',
                  url: book.downloadUrl,
                }
              : undefined,
          },
        ]}
      />
      <div className="mb-6 flex items-center justify-between gap-4 opacity-80 transition-opacity hover:opacity-100 sm:mb-8">
        <button
          onClick={onClose}
          className="flex min-w-0 items-center gap-2 text-xs font-mono text-bit-text transition-colors hover:text-bit-accent sm:text-sm"
        >
          <ArrowLeft size={16} className="shrink-0" /> <span className="truncate">Back</span>
        </button>
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          {book.source && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-bit-panel/50 border border-bit-border text-[9px] font-mono text-bit-muted/70 tracking-widest uppercase backdrop-blur-sm">
              <div className="w-1 h-1 rounded-full bg-bit-accent animate-pulse" />
              {book.source}
            </div>
          )}
          <div className="flex gap-3 sm:gap-4">
            <button
              onClick={() => toggleSavedBook(book)}
              className={`transition-colors ${isSaved ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
              aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
            >
              <Bookmark size={18} className={isSaved ? 'fill-current' : ''} />
            </button>
            <button className="text-bit-muted hover:text-bit-text transition-colors" aria-label="Share book"><Share2 size={18} /></button>
            <button className="text-bit-muted hover:text-bit-text transition-colors" aria-label="Book tools"><Zap size={18} /></button>
          </div>
        </div>
      </div>

      <nav className="mb-8 flex items-center gap-3 overflow-x-auto border-b border-bit-border pb-4 no-scrollbar whitespace-nowrap sm:mb-10">
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="h-fit lg:sticky lg:top-24 lg:col-span-4">
          <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-bit-border bg-gradient-to-br shadow-2xl sm:aspect-[2/3] ${book.coverGradient || 'from-orange-500/20 to-purple-900/40'} group`}>
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                className="absolute inset-0 h-full w-full object-cover opacity-45 transition-opacity duration-700 sm:group-hover:opacity-60"
                alt=""
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent transition-all duration-500 sm:group-hover:via-black/20" />
            {!questionPaperCollection && hasTopLevelReadableFile && (
              <div className="absolute inset-0 z-10 hidden items-center justify-center opacity-0 backdrop-blur-[4px] transition-all duration-700 sm:flex sm:group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); onRead(); }}
                  className="px-8 py-4 bg-bit-accent text-white flex items-center gap-4 rounded-full shadow-[0_0_60px_rgba(var(--bit-accent-rgb),0.6)] transform scale-75 group-hover:scale-100 transition-all duration-700 hover:scale-105 active:scale-95 border-4 border-black/10 group/btn relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                  <BookOpen size={24} className="relative z-10" />
                  <span className="text-xs font-mono font-bold tracking-[0.2em] relative z-10 uppercase">READ</span>
                </button>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                <button
                  onClick={() => onCategoryClick?.(book.category)}
                  className="inline-block px-3 py-1 rounded bg-bit-accent text-white text-[10px] font-bold uppercase tracking-widest w-fit shadow-lg shadow-bit-accent/40 hover:bg-white hover:text-black transition-all active:scale-95"
                >
                  {book.category}
                </button>
              </div>
              <h1 className="mb-4 line-clamp-3 text-2xl font-display font-bold leading-tight tracking-tight text-white transition-colors duration-500 group-hover:text-bit-accent sm:mb-6 sm:text-4xl md:text-5xl">{book.title}</h1>
              <div className="mb-5 flex flex-wrap gap-x-3 gap-y-3 border-l-2 border-bit-accent/30 py-1 pl-4 italic sm:mb-10 sm:gap-x-4 sm:gap-y-6">
                <span className="text-base text-white/70 font-sans sm:text-xl">{book.collection_name ? 'in' : 'by'}</span>
                {book.authors && book.authors.length > 0 ? (
                  book.authors.map((author, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAuthorClick?.(author.name)}
                      className="group/author text-left flex flex-col"
                    >
                      <span className="text-base text-white transition-colors hover:text-bit-accent sm:text-xl">
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
                  <span className="text-base text-white/70 font-sans sm:text-xl">{book.collection_name || book.author}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/45 font-mono sm:text-xs">
                <span className="flex items-center gap-1"><Calendar size={12} /> {book.year || 'N/A'}</span>
                <span className="mx-2">•</span>
                <span className="flex items-center gap-1"><BookOpen size={12} /> {questionPaperCollection ? `${questionPapers.length} Papers` : `${book.pages || 'INF'} Pages`}</span>
              </div>
            </div>
          </div>
          {!questionPaperCollection && hasTopLevelReadableFile && (
            <button
              onClick={() => onRead()}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-bit-accent px-5 py-3 text-xs font-mono font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all active:scale-95 sm:hidden"
            >
              <BookOpen size={17} /> Read
            </button>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="mb-8 flex gap-6 overflow-x-auto border-b border-bit-border no-scrollbar sm:gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`relative shrink-0 pb-4 text-xs font-mono font-bold tracking-wider transition-colors sm:text-sm ${activeTab === 'overview' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
            >
              OVERVIEW
              {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`relative shrink-0 pb-4 text-xs font-mono font-bold tracking-wider transition-colors sm:text-sm ${activeTab === 'read' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
            >
              <span className="sm:hidden">AI_EXTRACT</span>
              <span className="hidden sm:inline">AI_EXTRACT</span>
              {activeTab === 'read' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
            </button>
            {book.authors && book.authors.length > 1 && (
              <button
                onClick={() => setActiveTab('authors')}
                className={`relative shrink-0 pb-4 text-xs font-mono font-bold tracking-wider transition-colors sm:text-sm ${activeTab === 'authors' ? 'text-bit-accent' : 'text-bit-muted hover:text-bit-text'}`}
              >
                CONTRIBUTORS
                {activeTab === 'authors' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bit-accent" />}
              </button>
            )}
          </div>

          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <section className="mb-12">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="flex items-center gap-2 text-xl font-display font-semibold text-bit-text">
                    <Info size={18} className="text-bit-accent" /> Summary
                  </h3>
                  {!questionPaperCollection && (
                    <div className="grid grid-cols-2 gap-3 sm:flex">
                      {pdfDownloadUrl ? (
                        <button type="button" onClick={handleDownload} className="flex items-center justify-center gap-2 rounded-lg border border-bit-accent/30 bg-bit-panel/50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase text-bit-accent shadow-sm transition-all hover:border-bit-accent hover:bg-bit-accent hover:text-white active:scale-95 sm:px-6 group/dl">
                          <Download size={16} className="group-hover/dl:translate-y-0.5 transition-transform" /> Download
                        </button>
                      ) : downloadUrl && (
                        <a href={downloadUrl} download={book.title} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-bit-accent/30 bg-bit-panel/50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase text-bit-accent shadow-sm transition-all hover:border-bit-accent hover:bg-bit-accent hover:text-white active:scale-95 sm:px-6 group/dl">
                          <Download size={16} className="group-hover/dl:translate-y-0.5 transition-transform" /> Download
                        </a>
                      )}
                      <button onClick={() => onRead()} className={`${downloadUrl ? 'hidden sm:flex' : 'col-span-2 hidden sm:flex'} items-center justify-center gap-2 rounded-lg bg-bit-accent px-4 py-2.5 font-mono text-[10px] font-bold uppercase text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-105 active:scale-95 sm:px-6`}>
                        <BookOpen size={16} /> read
                      </button>
                    </div>
                  )}
                </div>
                <div className="max-w-3xl text-base leading-8 text-bit-muted sm:text-lg sm:leading-relaxed">
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

              {questionPaperCollection && (
                <section className="mb-12">
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">{book.collection_name || 'Question paper collection'}</p>
                      <h3 className="mt-1 text-xl font-display font-semibold text-bit-text">Question papers</h3>
                    </div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                      {questionPapers.length} {questionPapers.length === 1 ? 'paper' : 'papers'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {questionPapers.map((paper, index) => {
                      const paperUrl = getQuestionPaperReadUrl(paper);
                      return (
                        <div key={`${paper.title}-${paper.year || index}`} className="group flex gap-4 rounded-lg border border-bit-border bg-bit-panel/25 p-3 transition-all hover:border-bit-accent/40 hover:bg-bit-panel/40">
                          <div className="h-24 w-16 shrink-0 overflow-hidden rounded border border-bit-border bg-bit-bg/60">
                            {paper.coverUrl ? (
                              <img src={paper.coverUrl} alt="" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-bit-accent/70">
                                <BookOpen size={22} />
                              </div>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-bit-text group-hover:text-bit-accent">{paper.title}</h4>
                            <p className="mt-1 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                              {[paper.year, paper.fileSize].filter(Boolean).join(' / ') || 'Question paper'}
                            </p>
                            <div className="mt-auto flex flex-wrap gap-2 pt-4">
                              <button
                                type="button"
                                onClick={() => handleReadQuestionPaper(paper, index)}
                                disabled={!paperUrl}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-bit-accent px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <BookOpen size={14} /> Read
                              </button>
                              {paper.sourceUrl && (
                                <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-bit-border bg-bit-bg/40 px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent">
                                  <ExternalLink size={14} /> Source
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="mb-12">
                <h3 className="text-xl font-display font-semibold text-bit-text mb-6">Metadata Archive</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                  <div className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 shadow-sm">
                    <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted">Impact Score</p>
                    <p className="text-xl font-display font-bold text-bit-text">{book.popularity || 0}%</p>
                  </div>
                  <div className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 shadow-sm">
                    <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted">Downloads</p>
                    <p className="text-xl font-display font-bold text-bit-text">{(book.downloads || 0).toLocaleString()}</p>
                  </div>
                  <button onClick={() => onAuthorClick?.(book.author)} className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 text-left shadow-sm transition-colors hover:border-bit-accent/50 group/meta">
                    <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted transition-colors group-hover/meta:text-bit-accent">{book.source === 'YoBook' ? 'By Publisher' : 'By Author'}</p>
                    <p className="line-clamp-2 text-sm font-display font-bold text-bit-text transition-colors group-hover/meta:text-bit-accent">{book.author}</p>
                  </button>
                  <div className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 shadow-sm">
                    <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted">Language</p>
                    <p className="text-xl font-display font-bold text-bit-text">{(book.language || 'en').toUpperCase()}</p>
                  </div>
                  {book.grade && (
                    <div className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 shadow-sm">
                      <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted">Class</p>
                      <p className="text-xl font-display font-bold text-bit-text">Class {book.grade}</p>
                    </div>
                  )}
                  {displayCurriculum && (
                    <div className="rounded-lg border border-bit-border bg-bit-panel/30 p-3 shadow-sm">
                      <p className="mb-1 text-[9px] font-mono font-bold uppercase text-bit-muted">Curriculum</p>
                      <p className="line-clamp-2 text-sm font-display font-bold text-bit-text">{displayCurriculum}</p>
                    </div>
                  )}
                </div>
              </section>

              {canLoadChapterAudio && (
                <section className="mb-12">
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Chapter audio</p>
                      <h3 className="mt-1 text-xl font-display font-semibold text-bit-text">Listen by unit</h3>
                    </div>
                    {chapterAudio.length > 0 && (
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                        {chapterAudio.length} tracks
                      </p>
                    )}
                  </div>
                  {!chapterAudioRequested ? (
                    <button
                      type="button"
                      onClick={loadChapterAudio}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-bit-border bg-bit-panel/30 px-4 text-sm font-semibold text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
                    >
                      <Headphones size={16} />
                      Load chapter audio
                    </button>
                  ) : chapterAudioLoading ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-20 animate-shimmer rounded-lg border border-bit-border/40 bg-bit-panel/25" />
                      ))}
                    </div>
                  ) : chapterAudio.length > 0 ? (
                    <div className="space-y-3">
                      {selectedChapterAudio && (
                        <div className="rounded-xl border border-bit-accent/35 bg-bit-accent/10 p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedChapterAudioIndex((index) => index === null ? 0 : Math.max(0, index - 1))}
                              disabled={selectedChapterAudioIndex === 0}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-accent/30 text-bit-accent transition-all hover:bg-bit-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label="Previous audio chapter"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <div className="min-w-0 flex-1 text-center">
                              <p className="truncate text-sm font-semibold text-bit-text">{selectedChapterAudio.chapterName}</p>
                              <p className="mt-1 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                                {selectedChapterAudio.unit || `Chapter ${selectedChapterAudio.chapter}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedChapterAudioIndex(null)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-border/70 text-bit-muted transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                              aria-label="Close audio player"
                            >
                              <X size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedChapterAudioIndex((index) => index === null ? 0 : Math.min(chapterAudio.length - 1, index + 1))}
                              disabled={selectedChapterAudioIndex === chapterAudio.length - 1}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-accent/30 text-bit-accent transition-all hover:bg-bit-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label="Next audio chapter"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <audio key={selectedChapterAudio.url} controls autoPlay preload="metadata" src={selectedChapterAudio.url} className="h-9 w-full" />
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {chapterAudio.map((audio, index) => (
                          <button
                            key={`${audio.chapter}-${audio.url}`}
                            type="button"
                            onClick={() => setSelectedChapterAudioIndex(index)}
                            className={`group flex min-h-24 flex-col items-start gap-2 rounded-lg border p-2 text-left transition-all sm:min-h-16 sm:flex-row sm:items-center sm:gap-3 sm:p-3 ${selectedChapterAudioIndex === index ? 'border-bit-accent bg-bit-accent text-white shadow-sm shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/25 hover:border-bit-accent/40 hover:bg-bit-panel/40'}`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${selectedChapterAudioIndex === index ? 'bg-white/15 text-white' : 'bg-bit-accent/10 text-bit-accent group-hover:bg-bit-accent group-hover:text-white'}`}>
                              <Play size={14} className={selectedChapterAudioIndex === index ? 'fill-current' : ''} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-xs font-semibold leading-4 sm:block sm:truncate sm:text-sm">{audio.chapterName}</span>
                              <span className={`mt-1 block text-[9px] font-mono font-bold uppercase tracking-widest ${selectedChapterAudioIndex === index ? 'text-white/70' : 'text-bit-muted'}`}>
                                {audio.unit || `Chapter ${audio.chapter}`}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-bit-border bg-bit-panel/25 px-3 py-5 text-center text-sm leading-6 text-bit-muted">
                      No chapter audio is available for this subject yet.
                    </p>
                  )}
                </section>
              )}

              {book.chapterPdfUrls && book.chapterPdfUrls.length > 0 && (
                <section className="mb-12">
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Chapter PDFs</p>
                      <h3 className="mt-1 text-xl font-display font-semibold text-bit-text">NCERT chapter reader</h3>
                    </div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                      {book.chapterPdfUrls.length} files
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {book.chapterPdfUrls.map((chapterPdf, index) => (
                      <a
                        key={`${chapterPdf.pdfUrl}-${index}`}
                        href={chapterPdf.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex min-h-12 items-center justify-between gap-3 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-left transition-all hover:border-bit-accent/40 hover:bg-bit-panel/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-bit-text group-hover:text-bit-accent">
                            {chapterPdf.title}
                          </span>
                          <span className="mt-1 block text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                            PDF chapter {index + 1}
                          </span>
                        </span>
                        <ExternalLink size={15} className="shrink-0 text-bit-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {(editionLoading || editionBooks.length > 0) && (
                <section className="mb-12">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">
                        {isPriorCurriculumEdition(book) ? 'Edition trail' : 'Prior editions'}
                      </p>
                      <h3 className="mt-1 text-xl font-display font-semibold text-bit-text">
                        {isPriorCurriculumEdition(book) ? 'Other editions' : 'Earlier versions'}
                      </h3>
                    </div>
                    {editionBooks.length > 0 && (
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                        {editionBooks.length} found
                      </p>
                    )}
                  </div>
                  <div className="flex snap-x gap-4 overflow-x-auto pb-4">
                    {editionLoading
                      ? [1, 2, 3].map((index) => (
                        <div key={index} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
                          <BookCardSkeleton />
                        </div>
                      ))
                      : editionBooks.map((edition) => (
                        <div key={edition.id} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
                          <BookCard
                            book={edition}
                            onClick={onBookClick}
                            onRead={(editionBook) => onRead(editionBook.id)}
                            variant="compact"
                          />
                        </div>
                      ))}
                  </div>
                </section>
              )}

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
