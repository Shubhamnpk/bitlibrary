import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book } from '@/types/index';
import { streamBookChapter } from '@/services/geminiService';
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, Download, ExternalLink, ChevronLeft, ChevronRight, Highlighter, Loader2, Maximize2, X, Layout, Minimize2, Palette, PanelRight, Trash2, Type, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PDFFlipBook, { PDF_BACKGROUND_PRESETS, PDF_HIGHLIGHT_COLOR_PRESETS, readPdfBackgroundPreset, readPdfHighlightColor, type PdfBackgroundPresetId, type PdfHighlightColorId, type PdfStudyAction, type PdfStudySnapshot } from './PDFFlipBook';
import AppSelect from './AppSelect';
import { downloadPdfOptimized, getBestPdfSourceUrl, getPdfProxyUrl, isPdfLikeUrl } from '@/lib/pdf';

interface ReaderProps {
  book: Book;
  onClose: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
}

const getPdfReaderProgressKey = (bookId: string) => `bitlibrary-pdf-reader-progress-v1:${encodeURIComponent(bookId).slice(0, 160)}`;

const readSavedPdfChapterIndex = (bookId: string, chapterCount: number) => {
  if (typeof window === 'undefined' || chapterCount < 2) return 0;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(getPdfReaderProgressKey(bookId)) || 'null') as { chapterIndex?: number } | null;
    const chapterIndex = typeof parsed?.chapterIndex === 'number' && Number.isFinite(parsed.chapterIndex) ? Math.floor(parsed.chapterIndex) : 0;
    return Math.min(chapterCount - 1, Math.max(0, chapterIndex));
  } catch {
    return 0;
  }
};

const writeSavedPdfChapterIndex = (bookId: string, chapterIndex: number) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getPdfReaderProgressKey(bookId), JSON.stringify({ chapterIndex }));
  } catch {
    // Reader progress is helpful, but storage failures should not block reading.
  }
};

const Reader: React.FC<ReaderProps> = ({ book, onClose, isMinimized = false, onToggleMinimize }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(1);
  const [selectedPdfChapterIndex, setSelectedPdfChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [isImmersive, setIsImmersive] = useState(false);
  const [localIsMinimized, setLocalIsMinimized] = useState(isMinimized);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'saved' | 'look'>('saved');
  const [pdfBackgroundPreset, setPdfBackgroundPreset] = useState<PdfBackgroundPresetId>(() => readPdfBackgroundPreset());
  const [pdfHighlightColor, setPdfHighlightColor] = useState<PdfHighlightColorId>(() => readPdfHighlightColor());
  const [pdfStudySnapshot, setPdfStudySnapshot] = useState<PdfStudySnapshot | null>(null);
  const [pdfStudyAction, setPdfStudyAction] = useState<PdfStudyAction | null>(null);
  const [pdfHighlightMode, setPdfHighlightMode] = useState(false);
  const [expandedHighlightPages, setExpandedHighlightPages] = useState<Record<number, boolean>>({});

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
  const preloadedPdfChapterUrlsRef = useRef(new Set<string>());
  const pdfChapters = useMemo(
    () => book.chapterPdfUrls?.filter((entry) => isPdfLikeUrl(entry.pdfUrl)) || [],
    [book.chapterPdfUrls]
  );
  const activePdfChapter = pdfChapters[selectedPdfChapterIndex];
  const isExternal = !!book.externalUrl || pdfChapters.length > 0;
  const externalReaderUrl = activePdfChapter?.pdfUrl || book.externalUrl || book.downloadUrl || '';
  const isPdfReader = pdfChapters.length > 0 || isPdfLikeUrl(externalReaderUrl) || isPdfLikeUrl(book.downloadUrl);
  const readerUrl = activePdfChapter?.pdfUrl || (isPdfReader && isPdfLikeUrl(book.downloadUrl) ? book.downloadUrl || externalReaderUrl : externalReaderUrl);
  const pdfDownloadUrl = getBestPdfSourceUrl(book);
  const downloadUrl = pdfDownloadUrl || book.downloadUrl;
  const handleDownload = async () => {
    if (!pdfDownloadUrl) return;
    await downloadPdfOptimized(pdfDownloadUrl, book.title);
  };
  const goToPdfChapter = (index: number) => {
    if (index < 0 || index >= pdfChapters.length) return;
    setSelectedPdfChapterIndex(index);
  };
  const goToPreviousPdfChapter = () => {
    setSelectedPdfChapterIndex((index) => Math.max(0, index - 1));
  };
  const goToNextPdfChapter = () => {
    setSelectedPdfChapterIndex((index) => Math.min(pdfChapters.length - 1, index + 1));
  };
  useEffect(() => {
    const nextChapter = pdfChapters[selectedPdfChapterIndex + 1];
    if (!nextChapter) return;

    const controller = new AbortController();
    const preloadPdfChapter = async () => {
      const preloadUrl = getPdfProxyUrl(nextChapter.pdfUrl);
      if (preloadedPdfChapterUrlsRef.current.has(preloadUrl)) return;

      try {
        const response = await fetch(preloadUrl, {
          cache: 'force-cache',
          signal: controller.signal,
        });

        if (response.ok) {
          await response.arrayBuffer();
          preloadedPdfChapterUrlsRef.current.add(preloadUrl);
        }
      } catch {
        // Preloading is best-effort; normal reader loading remains authoritative.
      }
    };

    void preloadPdfChapter();

    return () => controller.abort();
  }, [pdfChapters, selectedPdfChapterIndex]);

  useEffect(() => {
    if (!isExternal || isPdfReader) return;
    setIframeLoading(true);
    const fallbackTimer = window.setTimeout(() => setIframeLoading(false), 6000);
    return () => window.clearTimeout(fallbackTimer);
  }, [isExternal, isPdfReader, readerUrl]);

  useEffect(() => {
    setSelectedPdfChapterIndex(readSavedPdfChapterIndex(book.id, pdfChapters.length));
    preloadedPdfChapterUrlsRef.current.clear();
  }, [book.id, pdfChapters.length]);

  useEffect(() => {
    if (pdfChapters.length < 2) return;
    writeSavedPdfChapterIndex(book.id, selectedPdfChapterIndex);
  }, [book.id, pdfChapters.length, selectedPdfChapterIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false);
        } else if (isImmersive) {
          exitFocusMode();
        } else if (!isMinimized) {
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImmersive, isMinimized, sidebarOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsImmersive(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const enterFocusMode = () => {
    setIsImmersive(true);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  const exitFocusMode = () => {
    setIsImmersive(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit full-screen mode: ${err.message}`);
      });
    }
  };

  const triggerPdfStudyAction = (type: PdfStudyAction['type'], page?: number, highlightId?: string) => {
    setPdfStudyAction({ id: Date.now(), type, page, highlightId });
  };

  const toggleHighlightPage = (page: number) => {
    setExpandedHighlightPages((current) => ({
      ...current,
      [page]: !current[page],
    }));
  };

  const groupedTextHighlights = useMemo(() => {
    const groups = new Map<number, NonNullable<PdfStudySnapshot['textHighlights']>>();
    pdfStudySnapshot?.textHighlights.forEach((highlight) => {
      const pageHighlights = groups.get(highlight.page) ?? [];
      pageHighlights.push(highlight);
      groups.set(highlight.page, pageHighlights);
    });

    return Array.from(groups.entries())
      .sort(([pageA], [pageB]) => pageA - pageB)
      .map(([page, highlights]) => ({ page, highlights }));
  }, [pdfStudySnapshot?.textHighlights]);

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
          {isPdfReader && pdfChapters.length > 1 && (
            <AppSelect
              label="Chapter"
              value={String(selectedPdfChapterIndex)}
              onChange={(value) => setSelectedPdfChapterIndex(Number(value))}
              options={pdfChapters.map((entry, index) => ({
                value: String(index),
                label: entry.title,
              }))}
              className="hidden max-w-64 bg-bit-panel/50 shadow-sm md:inline-flex"
              selectClassName="max-w-44"
              ariaLabel="Select PDF chapter"
            />
          )}
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
            {pdfDownloadUrl ? (
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-lg p-2.5 text-bit-accent transition-all hover:bg-bit-panel hover:text-bit-text sm:border-r sm:border-bit-border sm:p-3 group"
                title="Download Archival Volume"
                aria-label="Download book"
              >
                <Download size={17} className="transition-transform group-hover:translate-y-0.5 sm:size-[18px]" />
              </button>
            ) : downloadUrl && (
              <a 
                href={downloadUrl}
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
              onClick={enterFocusMode}
              className="rounded-lg p-2.5 text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent sm:p-3 group"
              title="Focus mode"
              aria-label="Enter focus mode"
            >
              <Maximize2 size={17} className="group-hover:scale-110 sm:size-[18px]" />
            </button>
            <button
              onClick={() => {
                setSidebarOpen((open) => {
                  const nextOpen = !open;
                  if (nextOpen && isPdfReader) {
                    setPdfHighlightMode(true);
                  }
                  return nextOpen;
                });
              }}
              className={`rounded-lg p-2.5 transition-all sm:p-3 group ${sidebarOpen ? 'bg-bit-accent text-white' : 'text-bit-muted hover:bg-bit-panel hover:text-bit-accent'}`}
              title="Reader sidebar"
              aria-label="Open reader sidebar"
              aria-expanded={sidebarOpen}
            >
              <PanelRight size={17} className="transition-transform group-hover:translate-x-0.5 sm:size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <aside className="fixed bottom-0 right-0 top-14 z-[10120] isolate flex w-full flex-col overflow-hidden border-l border-bit-border bg-bit-bg shadow-[-18px_0_60px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,255,255,0.05)] ring-1 ring-white/5 animate-fade-in sm:top-16 sm:w-[min(23rem,100vw)]">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015)_35%,rgba(0,0,0,0.08))]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-px bg-gradient-to-b from-bit-accent/60 via-bit-border to-transparent" />
          <div className="border-b border-bit-border/70 bg-bit-bg px-5 py-3">
            <div className="flex rounded-full border border-bit-border bg-bit-panel/50 p-1">
              <button
                type="button"
                onClick={() => setSidebarTab('saved')}
                className={`h-9 flex-1 rounded-full text-xs font-semibold transition-all ${sidebarTab === 'saved' ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20' : 'text-bit-muted hover:text-bit-text'}`}
              >
                Saved
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('look')}
                className={`h-9 flex-1 rounded-full text-xs font-semibold transition-all ${sidebarTab === 'look' ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20' : 'text-bit-muted hover:text-bit-text'}`}
              >
                Look
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-bit-bg p-5">
            {isPdfReader && pdfChapters.length > 1 && (
              <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-bit-accent">
                    <BookOpen size={16} />
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Contents</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-bit-muted tabular-nums">
                    {selectedPdfChapterIndex + 1}/{pdfChapters.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pdfChapters.map((entry, index) => (
                    <button
                      key={`${entry.pdfUrl}-${index}`}
                      type="button"
                      onClick={() => goToPdfChapter(index)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${selectedPdfChapterIndex === index ? 'border-bit-accent bg-bit-accent text-white shadow-sm shadow-bit-accent/20' : 'border-bit-border bg-bit-bg/40 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{entry.title}</span>
                        <span className={`mt-1 block text-[9px] font-mono font-bold uppercase tracking-widest ${selectedPdfChapterIndex === index ? 'text-white/70' : 'text-bit-muted'}`}>
                          PDF {index + 1}
                        </span>
                      </span>
                      <ChevronRight size={14} className={`shrink-0 transition-transform ${selectedPdfChapterIndex === index ? 'translate-x-0.5' : ''}`} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {sidebarTab === 'saved' ? (
              <>
                {isPdfReader ? (
                  <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-bit-accent">
                        <BookmarkCheck size={16} />
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Bookmarks</p>
                      </div>
                      {pdfStudySnapshot && (
                        <span className="text-[10px] font-mono font-bold text-bit-muted tabular-nums">
                          {pdfStudySnapshot.bookmarkCount}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => triggerPdfStudyAction('toggle-bookmark')}
                      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-all ${pdfStudySnapshot?.currentPageBookmarked || pdfStudySnapshot?.currentPageHighlighted ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/40 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
                    >
                      {pdfStudySnapshot?.currentPageBookmarked || pdfStudySnapshot?.currentPageHighlighted ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      {pdfStudySnapshot?.currentPageBookmarked || pdfStudySnapshot?.currentPageHighlighted ? 'Saved current page' : 'Save current page'}
                    </button>

                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {pdfStudySnapshot?.bookmarkedPages.length ? pdfStudySnapshot.bookmarkedPages.map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => triggerPdfStudyAction('go-to-page', page)}
                          className={`inline-flex h-10 min-w-0 items-center justify-center rounded-full border px-2 text-xs font-mono font-bold tabular-nums transition-all ${pdfStudySnapshot.currentPage === page ? 'border-bit-accent bg-bit-accent text-white shadow-sm shadow-bit-accent/25' : 'border-bit-border bg-bit-bg/45 text-bit-accent hover:border-bit-accent/50 hover:bg-bit-accent/10'}`}
                          aria-label={`Go to bookmarked page ${page}`}
                          title={`Page ${page}`}
                        >
                          {page}
                        </button>
                      )) : (
                        <p className="col-span-4 rounded-lg border border-dashed border-bit-border bg-bit-bg/25 px-3 py-6 text-center text-sm leading-6 text-bit-muted">
                          Save pages while reading and they will appear here.
                        </p>
                      )}
                    </div>
                  </section>
                ) : (
                  <p className="rounded-xl border border-dashed border-bit-border bg-bit-panel/25 px-4 py-8 text-center text-sm leading-6 text-bit-muted">
                    Bookmarks and highlights are available for PDF books.
                  </p>
                )}

                {isPdfReader && (
                  <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-bit-accent">
                        <Highlighter size={16} />
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Highlights</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-bit-muted tabular-nums">
                        {pdfStudySnapshot?.highlightCount ?? 0}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfHighlightMode((enabled) => !enabled)}
                      className={`mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-all ${pdfHighlightMode ? 'border-yellow-300 bg-yellow-300 text-zinc-950' : 'border-bit-border bg-bit-bg/40 text-bit-muted hover:border-yellow-300/50 hover:text-yellow-200'}`}
                    >
                      <Highlighter size={16} />
                      {pdfHighlightMode ? 'Highlight mode on' : 'Enable text highlight'}
                    </button>
                    <div className="space-y-3">
                      {groupedTextHighlights.length ? groupedTextHighlights.map(({ page, highlights }) => {
                        const isExpanded = Boolean(expandedHighlightPages[page]);

                        return (
                          <div
                            key={page}
                            className={`rounded-xl border bg-bit-bg/45 transition-all ${isExpanded ? 'border-yellow-300/35 p-3' : 'border-bit-border p-2.5 hover:border-yellow-300/30 hover:bg-bit-panel/20'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => triggerPdfStudyAction('go-to-page', page)}
                                className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-mono font-bold tabular-nums transition-all ${pdfStudySnapshot?.currentPage === page ? 'border-yellow-300 bg-yellow-300 text-zinc-950' : 'border-yellow-300/40 bg-yellow-300/10 text-yellow-200 hover:bg-yellow-300 hover:text-zinc-950'}`}
                                aria-label={`Go to page ${page}`}
                                title={`Go to page ${page}`}
                              >
                                {page}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleHighlightPage(page)}
                                className="min-w-0 flex-1 text-left"
                                aria-expanded={isExpanded}
                              >
                                <p className="text-xs font-semibold text-bit-text">Page highlights</p>
                                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                                  {highlights.length} saved
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleHighlightPage(page)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-2.5 text-[10px] font-mono font-bold text-yellow-200 transition-all hover:border-yellow-300/50 hover:bg-yellow-300/15"
                                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} highlights for page ${page}`}
                                aria-expanded={isExpanded}
                              >
                                <span className="tabular-nums">{highlights.length}</span>
                                <ChevronRight size={13} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            </div>

                            {isExpanded && (
                              <>
                                <div className="mt-2.5 space-y-2">
                                  {highlights.map((highlight) => (
                                    <div
                                      key={highlight.id}
                                      className="group/highlight flex items-start gap-2 rounded-lg border border-bit-border/70 bg-bit-bg/40 p-2 transition-colors hover:border-yellow-300/25"
                                    >
                                <button
                                  type="button"
                                  onClick={() => triggerPdfStudyAction('go-to-page', highlight.page)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <span
                                    className="mb-1 block h-1 w-10 rounded-full"
                                    style={{
                                      backgroundColor: PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === highlight.color)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch,
                                    }}
                                  />
                                  <span className="line-clamp-3 text-xs leading-5 text-bit-text/88">
                                    {highlight.text}
                                  </span>
                                </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          triggerPdfStudyAction('remove-text-highlight', undefined, highlight.id);
                                        }}
                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-bit-muted opacity-80 transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 group-hover/highlight:opacity-100"
                                        aria-label="Remove highlight"
                                        title="Remove highlight"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      }) : (
                        <p className="rounded-lg border border-dashed border-bit-border bg-bit-bg/25 px-3 py-6 text-center text-sm leading-6 text-bit-muted">
                          No text highlights yet.
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                {isPdfReader && (
                  <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                    <div className="mb-3 flex items-center gap-2 text-bit-accent">
                      <Palette size={16} />
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Background</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {PDF_BACKGROUND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPdfBackgroundPreset(preset.id)}
                          className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-all ${pdfBackgroundPreset === preset.id ? 'border-bit-accent bg-bit-accent/10 ring-2 ring-bit-accent/25' : 'border-bit-border bg-bit-bg/40 hover:border-bit-accent/50'}`}
                          aria-label={`Use ${preset.label} PDF background`}
                        >
                          <span
                            className="h-8 w-11 shrink-0 rounded-md border border-white/20 shadow-inner"
                            style={{ background: preset.swatch }}
                          />
                          <span className="text-sm font-semibold text-bit-text">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {isPdfReader && (
                  <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-4">
                    <div className="mb-3 flex items-center gap-2 text-bit-accent">
                      <Highlighter size={16} />
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Highlight color</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {PDF_HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPdfHighlightColor(preset.id)}
                          className={`flex h-11 items-center justify-center rounded-full border transition-all ${pdfHighlightColor === preset.id ? 'border-bit-accent bg-bit-accent/10 ring-2 ring-bit-accent/25' : 'border-bit-border bg-bit-bg/40 hover:border-bit-accent/50'}`}
                          aria-label={`Use ${preset.label} highlight color`}
                          title={preset.label}
                        >
                          <span
                            className="h-6 w-6 rounded-full border border-white/40 shadow-inner"
                            style={{ backgroundColor: preset.swatch }}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-bit-muted">
                      New text highlights will use this color.
                    </p>
                  </section>
                )}

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
              </>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area - Optimized Strip Layout */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide bg-bit-bg flex flex-col items-center">
        {isPdfReader && pdfChapters.length > 1 && (
          <div className="flex w-full items-center gap-2 overflow-x-auto border-b border-bit-border bg-bit-bg px-3 py-2 md:hidden">
            {pdfChapters.map((entry, index) => (
              <button
                key={`${entry.pdfUrl}-${index}`}
                type="button"
                onClick={() => setSelectedPdfChapterIndex(index)}
                className={`h-9 shrink-0 rounded-full border px-3 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${selectedPdfChapterIndex === index ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
              >
                {entry.title}
              </button>
            ))}
          </div>
        )}
        {isExternal && isPdfReader ? (
          <PDFFlipBook
            pdfUrl={readerUrl}
            title={book.title}
            backgroundPreset={pdfBackgroundPreset}
            highlightColor={pdfHighlightColor}
            studyPanelOpen={pdfHighlightMode}
            studyAction={pdfStudyAction}
            onStudyPanelOpenChange={setPdfHighlightMode}
            onStudySnapshotChange={setPdfStudySnapshot}
            onPreviousBoundary={selectedPdfChapterIndex > 0 ? goToPreviousPdfChapter : undefined}
            onNextBoundary={selectedPdfChapterIndex < pdfChapters.length - 1 ? goToNextPdfChapter : undefined}
            preferFullDocumentLoad={pdfChapters.length > 1}
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
              onLoad={() => setIframeLoading(false)}
              className="w-full h-full border-none bg-white"
              title={book.title}
              sandbox={isPdfReader ? undefined : 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals'}
              loading="eager"
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
            onClick={() => {
              setSidebarOpen((open) => {
                const nextOpen = !open;
                if (nextOpen && isPdfReader) {
                  setPdfHighlightMode(true);
                }
                return nextOpen;
              });
            }}
            className={`p-3 backdrop-blur-xl border rounded-xl transition-all shadow-2xl ${sidebarOpen ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/80 text-bit-muted hover:text-bit-accent hover:border-bit-accent/50'}`}
            title="Reader sidebar"
            aria-label="Open reader sidebar"
            aria-expanded={sidebarOpen}
          >
            <PanelRight size={18} />
          </button>
          <button
            onClick={exitFocusMode}
            className="p-3 bg-bit-panel/80 backdrop-blur-xl border border-bit-border rounded-xl text-bit-muted hover:text-bit-accent hover:border-bit-accent/50 transition-all shadow-2xl"
            title="Restore Interface"
            aria-label="Exit focus mode"
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
