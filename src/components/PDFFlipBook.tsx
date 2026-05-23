import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import '@ksedline/turnjs';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RotateCcw, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PDFJS_WASM_URL = 'https://unpkg.com/pdfjs-dist@5.7.284/wasm/';
const isTurnTouchDevice = () => Boolean(($ as unknown as { isTouch?: boolean }).isTouch);

interface PDFFlipBookProps {
  pdfUrl: string;
  title: string;
}

interface FlipDimensions {
  width: number;
  height: number;
  display: 'single' | 'double';
}

interface PDFPageCanvasProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  shouldRender: boolean;
  renderScale: number;
}

type TurnBook = JQuery & {
  turn: (commandOrOptions?: unknown, value?: unknown) => unknown;
};

const isTurnBookReady = (book: TurnBook) => {
  try {
    return Boolean(book.turn('is'));
  } catch {
    return false;
  }
};

const getProxyPdfUrl = (url: string) => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
};

const playPageTurnSound = () => {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const duration = 0.16;
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    const progress = index / data.length;
    const envelope = Math.pow(1 - progress, 2.5);
    data[index] = (Math.random() * 2 - 1) * envelope * 0.22;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
  source.stop(audioContext.currentTime + duration);
  source.onended = () => void audioContext.close();
};

const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({ document, pageNumber, shouldRender, renderScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      try {
        setLoading(true);
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        await renderTask.promise.catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'RenderingCancelledException') {
            throw error;
          }
        });
      } catch (renderError) {
        if ((renderError as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn(`[PDF Turn.js] Page ${pageNumber} render failed:`, renderError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, renderScale, shouldRender]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      {shouldRender ? (
        <>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <Loader2 className="animate-spin text-bit-accent" size={22} />
            </div>
          )}
          <canvas ref={canvasRef} className="h-full w-full object-contain" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-mono uppercase tracking-widest text-zinc-300">
          Page {pageNumber}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-[9px] font-mono text-zinc-400 shadow-sm">
        {pageNumber}
      </div>
    </div>
  );
};

const getDimensions = (containerWidth: number, containerHeight: number): FlipDimensions => {
  const display: FlipDimensions['display'] = containerWidth < 760 ? 'single' : 'double';
  const maxPageWidth = display === 'single' ? 430 : 420;
  const pageWidth = Math.max(260, Math.min(maxPageWidth, display === 'single' ? containerWidth - 72 : (containerWidth - 120) / 2));
  const pageHeight = Math.min(containerHeight - 24, pageWidth * 1.414);
  const finalPageWidth = pageHeight / 1.414 < pageWidth ? pageHeight / 1.414 : pageWidth;

  return {
    display,
    width: Math.round(display === 'single' ? finalPageWidth : finalPageWidth * 2),
    height: Math.round(finalPageWidth * 1.414),
  };
};

const PDFFlipBook: React.FC<PDFFlipBookProps> = ({ pdfUrl, title }) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dimensions, setDimensions] = useState<FlipDimensions>({ width: 840, height: 594, display: 'double' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const currentPageRef = useRef(currentPage);
  const suppressNextSoundRef = useRef(false);
  const proxiedPdfUrl = useMemo(() => getProxyPdfUrl(pdfUrl), [pdfUrl]);

  const getBook = useCallback((): TurnBook | null => {
    if (!bookRef.current) return null;
    const book = $(bookRef.current) as unknown as TurnBook;
    return isTurnBookReady(book) ? book : null;
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateDimensions = () => {
      const rect = shell.getBoundingClientRect();
      const nextDimensions = getDimensions(rect.width, rect.height);
      setDimensions((currentDimensions) => {
        if (
          currentDimensions.width === nextDimensions.width &&
          currentDimensions.height === nextDimensions.height &&
          currentDimensions.display === nextDimensions.display
        ) {
          return currentDimensions;
        }

        return nextDimensions;
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setZoom(1);

    const task = pdfjsLib.getDocument({
      url: proxiedPdfUrl,
      disableAutoFetch: false,
      disableStream: false,
      wasmUrl: PDFJS_WASM_URL,
    });

    task.promise
      .then((loadedDocument) => {
        if (cancelled) {
          loadedDocument.destroy();
          return;
        }
        setDocument(loadedDocument);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          console.error('[PDF Turn.js] Load failed:', loadError);
          setError('This PDF could not be prepared for flip-book reading.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [proxiedPdfUrl]);

  useEffect(() => {
    if (!document || !bookRef.current) return;

    const book = $(bookRef.current) as unknown as TurnBook;

    try {
      if (isTurnBookReady(book)) {
        book.turn('destroy');
      }

      const pageToRestore = Math.min(currentPageRef.current, document.numPages);

      book.turn({
        width: dimensions.width,
        height: dimensions.height,
        display: dimensions.display,
        autoCenter: true,
        gradients: !isTurnTouchDevice(),
        elevation: 80,
        duration: 900,
        acceleration: true,
        turnCorners: 'bl,br',
        pages: document.numPages,
        when: {
          turned: (_event: unknown, page: number) => {
            setCurrentPage(page);
            if (suppressNextSoundRef.current) {
              suppressNextSoundRef.current = false;
              return;
            }
            if (soundEnabledRef.current) playPageTurnSound();
          },
        },
      });

      if (pageToRestore > 1) {
        suppressNextSoundRef.current = true;
      }
      book.turn('page', pageToRestore);
    } catch (turnError) {
      console.warn('[PDF Turn.js] Init skipped:', turnError);
    }

    return () => {
      try {
        if (isTurnBookReady(book)) {
          book.turn('destroy');
        }
      } catch {
        // Turn.js can throw during teardown if a flip animation is mid-flight.
      }
    };
  }, [dimensions.display, dimensions.height, dimensions.width, document]);

  const pageCount = document?.numPages || 0;
  const canZoomOut = zoom > 1;
  const canZoomIn = zoom < 1.75;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < pageCount;
  const renderScale = Math.min(2.7, 1.45 * zoom);
  const renderWindow = zoom > 1 ? 4 : 8;
  const isZoomed = zoom > 1;

  useEffect(() => {
    if (!isZoomed || !shellRef.current) return;

    window.requestAnimationFrame(() => {
      if (!shellRef.current) return;
      shellRef.current.scrollTop = 0;
      shellRef.current.scrollLeft = Math.max(0, (shellRef.current.scrollWidth - shellRef.current.clientWidth) / 2);
    });
  }, [isZoomed, zoom]);

  const goPrevious = useCallback(() => {
    const book = getBook();
    if (!book || currentPageRef.current <= 1) return;
    try {
      book.turn('previous');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Previous page skipped:', turnError);
    }
  }, [getBook]);

  const goNext = useCallback(() => {
    const book = getBook();
    if (!book || currentPageRef.current >= pageCount) return;
    try {
      book.turn('next');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Next page skipped:', turnError);
    }
  }, [getBook, pageCount]);

  const adjustZoom = useCallback((direction: 'in' | 'out') => {
    setZoom((currentZoom) => {
      const nextZoom = direction === 'in' ? currentZoom + 0.25 : currentZoom - 0.25;
      return Math.min(1.75, Math.max(1, Number(nextZoom.toFixed(2))));
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const peelCorner = useCallback((corner: 'bl' | 'br' | false) => {
    const book = getBook();
    if (!book) return;

    try {
      book.turn('peel', corner);
    } catch {
      // Ignore hover peels when Turn.js is between internal states.
    }
  }, [getBook]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        adjustZoom('in');
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        adjustZoom('out');
      } else if (event.key === '0') {
        event.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adjustZoom, goNext, goPrevious, resetZoom]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-bit-bg text-center">
        <Loader2 className="animate-spin text-bit-accent" size={44} />
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-bit-accent">Preparing Turn.js Book</p>
          <p className="mt-2 text-sm text-bit-muted">Loading the PDF pages.</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-bit-bg px-6 text-center">
        <RotateCcw className="text-bit-accent" size={42} />
        <div>
          <p className="text-lg font-display font-bold text-bit-text">Flip-book view is unavailable</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-bit-muted">
            {error || 'The PDF could not be loaded here.'} You can still open the source PDF directly.
          </p>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-bit-accent px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white"
        >
          <ExternalLink size={15} />
          Open PDF
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(var(--bit-accent-rgb),0.08),transparent_42%),linear-gradient(180deg,rgba(var(--bit-panel),0.3),rgba(var(--bit-bg),1))]">
      <div
        ref={shellRef}
        data-pdf-reader-shell
        className={`relative flex min-h-0 flex-1 ${isZoomed ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden'} px-4 py-6 md:px-10 md:py-8`}
      >
        <button
          type="button"
          onClick={goPrevious}
          onMouseDown={(event) => event.stopPropagation()}
          disabled={!canGoPrevious}
          className="absolute left-2 top-1/2 z-[10060] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-bit-border bg-bit-bg/85 text-bit-muted shadow-xl backdrop-blur transition-all hover:border-bit-accent/40 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-25 md:left-6"
          aria-label="Previous page"
        >
          <ChevronLeft size={22} />
        </button>

        <div
          aria-hidden="true"
          className="absolute bottom-5 left-4 z-10 h-24 w-24 cursor-pointer md:left-10 md:h-32 md:w-32"
          onClick={goPrevious}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch' && currentPage > 1) peelCorner('bl');
          }}
          onPointerLeave={() => peelCorner(false)}
        />

        <div
          className={`bit-turn-stage relative z-0 flex min-h-full w-full ${isZoomed ? 'items-start justify-center' : 'items-center justify-center'}`}
          style={{
            minWidth: isZoomed ? `${dimensions.width * zoom + 96}px` : undefined,
            minHeight: isZoomed ? `${dimensions.height * zoom + 96}px` : undefined,
          }}
        >
          <div
            className="relative transition-[width,height] duration-200 ease-out"
            style={{
              width: isZoomed ? `${dimensions.width * zoom}px` : `${dimensions.width}px`,
              height: isZoomed ? `${dimensions.height * zoom}px` : `${dimensions.height}px`,
            }}
          >
          <div
            className="absolute left-0 top-0 transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <div ref={bookRef} className="bit-turn-book">
              {Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1;
                const shouldRender = Math.abs(pageNumber - currentPage) <= renderWindow;
                return (
                  <div key={pageNumber} className="bit-turn-page bg-white">
                    <PDFPageCanvas document={document} pageNumber={pageNumber} renderScale={renderScale} shouldRender={shouldRender} />
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute bottom-5 right-4 z-10 h-24 w-24 cursor-pointer md:right-10 md:h-32 md:w-32"
          onClick={goNext}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch' && currentPage < pageCount) peelCorner('br');
          }}
          onPointerLeave={() => peelCorner(false)}
        />

        <button
          type="button"
          onClick={goNext}
          onMouseDown={(event) => event.stopPropagation()}
          disabled={!canGoNext}
          className="absolute right-2 top-1/2 z-[10060] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-bit-border bg-bit-bg/85 text-bit-muted shadow-xl backdrop-blur transition-all hover:border-bit-accent/40 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-25 md:right-6"
          aria-label="Next page"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="relative z-[10050] flex items-center justify-between gap-4 border-t border-bit-border bg-bit-panel/55 px-4 py-3 backdrop-blur md:px-6">
        <p className="min-w-0 line-clamp-1 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-bit-border bg-bit-bg/60 p-1">
            <button
              type="button"
              onClick={() => adjustZoom('out')}
              disabled={!canZoomOut}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="min-w-10 text-center text-[10px] font-mono font-bold text-bit-muted">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => adjustZoom('in')}
              disabled={!canZoomIn}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled((enabled) => !enabled)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bit-border bg-bit-bg/60 text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
            aria-label={soundEnabled ? 'Disable page turn sound' : 'Enable page turn sound'}
            title={soundEnabled ? 'Disable page turn sound' : 'Enable page turn sound'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">
            Page {currentPage} / {pageCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFFlipBook;
