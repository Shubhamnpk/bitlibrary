import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import '@ksedline/turnjs';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ExternalLink, Highlighter, Loader2, PanelRight, RotateCcw, StickyNote, Trash2, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PDFJS_WASM_URL = 'https://unpkg.com/pdfjs-dist@5.7.284/wasm/';
const isTurnTouchDevice = () => Boolean(($ as unknown as { isTouch?: boolean }).isTouch);

interface PDFFlipBookProps {
  pdfUrl: string;
  title: string;
  backgroundPreset?: PdfBackgroundPresetId;
  studyPanelOpen?: boolean;
  onStudyPanelOpenChange?: (open: boolean) => void;
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
  shouldRenderTextLayer: boolean;
  renderScale: number;
  targetWidth: number;
  targetHeight: number;
  isBookmarked: boolean;
  isHighlighted: boolean;
  textHighlights: PdfTextHighlight[];
  onTextSelection: (highlight: Omit<PdfTextHighlight, 'id' | 'createdAt'>) => void;
}

interface PdfHighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfTextHighlight {
  id: string;
  page: number;
  text: string;
  rects: PdfHighlightRect[];
  createdAt: number;
}

interface PdfStudyState {
  bookmarks: number[];
  highlights: number[];
  notes: Record<string, string>;
  textHighlights: PdfTextHighlight[];
}

export type PdfBackgroundPresetId = 'default' | 'wood' | 'paper' | 'sage' | 'night';

type TurnBook = JQuery & {
  turn: (commandOrOptions?: unknown, value?: unknown) => unknown;
};

const PDF_BACKGROUND_STORAGE_KEY = 'bitlibrary-pdf-background-v1';

export const PDF_BACKGROUND_PRESETS: Array<{
  id: PdfBackgroundPresetId;
  label: string;
  className: string;
  swatch: string;
}> = [
  {
    id: 'default',
    label: 'Default',
    className: 'bit-pdf-reader-bg-default',
    swatch: 'linear-gradient(135deg, rgb(var(--bit-bg)), rgba(var(--bit-accent-rgb), 0.34))',
  },
  {
    id: 'wood',
    label: 'Wood',
    className: 'bit-pdf-reader-bg-wood',
    swatch: 'linear-gradient(135deg, #5f351f, #b8753e 52%, #3b2116)',
  },
  {
    id: 'paper',
    label: 'Paper',
    className: 'bit-pdf-reader-bg-paper',
    swatch: 'linear-gradient(135deg, #f4dfb8, #fff5dc 58%, #d7b47b)',
  },
  {
    id: 'sage',
    label: 'Sage',
    className: 'bit-pdf-reader-bg-sage',
    swatch: 'linear-gradient(135deg, #425143, #8fa085 55%, #1f2c26)',
  },
  {
    id: 'night',
    label: 'Night',
    className: 'bit-pdf-reader-bg-night',
    swatch: 'linear-gradient(135deg, #131821, #334055 55%, #090b10)',
  },
];

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

const getStudyStorageKey = (pdfUrl: string) => `bitlibrary-pdf-study-v1:${encodeURIComponent(pdfUrl).slice(0, 180)}`;

const clampZoom = (value: number) => Math.min(1.75, Math.max(1, Number(value.toFixed(2))));

export const readPdfBackgroundPreset = (): PdfBackgroundPresetId => {
  if (typeof window === 'undefined') return 'default';

  try {
    const value = window.localStorage.getItem(PDF_BACKGROUND_STORAGE_KEY);
    return PDF_BACKGROUND_PRESETS.some((preset) => preset.id === value) ? value as PdfBackgroundPresetId : 'default';
  } catch {
    return 'default';
  }
};

export const writePdfBackgroundPreset = (preset: PdfBackgroundPresetId) => {
  try {
    window.localStorage.setItem(PDF_BACKGROUND_STORAGE_KEY, preset);
  } catch {
    // Reading backgrounds are cosmetic, so storage failures should not block the reader.
  }
};

const readStudyState = (pdfUrl: string): PdfStudyState => {
  if (typeof window === 'undefined') return { bookmarks: [], highlights: [], notes: {}, textHighlights: [] };

  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStudyStorageKey(pdfUrl)) || 'null') as Partial<PdfStudyState> | null;
    return {
      bookmarks: Array.isArray(parsed?.bookmarks) ? parsed.bookmarks.filter(Number.isFinite) : [],
      highlights: Array.isArray(parsed?.highlights) ? parsed.highlights.filter(Number.isFinite) : [],
      notes: parsed?.notes && typeof parsed.notes === 'object' ? parsed.notes as Record<string, string> : {},
      textHighlights: Array.isArray(parsed?.textHighlights) ? parsed.textHighlights.filter((highlight) => (
        typeof highlight?.id === 'string' &&
        Number.isFinite(highlight.page) &&
        typeof highlight.text === 'string' &&
        Array.isArray(highlight.rects)
      )) as PdfTextHighlight[] : [],
    };
  } catch {
    return { bookmarks: [], highlights: [], notes: {}, textHighlights: [] };
  }
};

const writeStudyState = (pdfUrl: string, state: PdfStudyState) => {
  try {
    window.localStorage.setItem(getStudyStorageKey(pdfUrl), JSON.stringify(state));
  } catch {
    // Local study tools stay optional when browser storage is unavailable.
  }
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

const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({ document, pageNumber, shouldRender, shouldRenderTextLayer, renderScale, targetWidth, targetHeight, isBookmarked, isHighlighted, textHighlights, onTextSelection }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
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

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const content = contentRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas || !context || !content || !textLayer) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height);
        const viewport = page.getViewport({ scale: fitScale });
        const zoomQuality = Math.max(1, renderScale / 1.45);
        const pixelRatio = Math.min((window.devicePixelRatio || 1) * zoomQuality, 3);

        content.style.width = `${viewport.width}px`;
        content.style.height = `${viewport.height}px`;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.style.setProperty('--scale-factor', String(fitScale));
        textLayer.style.setProperty('--total-scale-factor', String(fitScale));
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
  }, [document, pageNumber, renderScale, shouldRender, targetHeight, targetWidth]);

  useEffect(() => {
    if (!shouldRender || !shouldRenderTextLayer) {
      textLayerRef.current?.replaceChildren();
      return;
    }

    let cancelled = false;
    let pdfTextLayer: pdfjsLib.TextLayer | null = null;

    const renderTextLayer = async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const textLayer = textLayerRef.current;
        if (!textLayer) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height);
        const viewport = page.getViewport({ scale: fitScale });

        textLayer.replaceChildren();
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.style.setProperty('--scale-factor', String(fitScale));
        textLayer.style.setProperty('--total-scale-factor', String(fitScale));

        pdfTextLayer = new pdfjsLib.TextLayer({
          textContentSource: page.streamTextContent({
            includeMarkedContent: true,
            disableNormalization: true,
          }),
          container: textLayer,
          viewport,
        });

        await pdfTextLayer.render();
      } catch (textLayerError) {
        if ((textLayerError as { name?: string })?.name !== 'AbortException') {
          console.warn(`[PDF Turn.js] Page ${pageNumber} text layer failed:`, textLayerError);
        }
      }
    };

    const handle = window.setTimeout(() => void renderTextLayer(), 80);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      pdfTextLayer?.cancel();
    };
  }, [document, pageNumber, shouldRender, shouldRenderTextLayer, renderScale, targetHeight, targetWidth]);

  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    const pageElement = contentRef.current;
    const textLayer = textLayerRef.current;
    if (!selection || selection.isCollapsed || !pageElement || !textLayer || selection.rangeCount === 0) return;
    if (!textLayer.contains(selection.anchorNode) || !textLayer.contains(selection.focusNode)) return;

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (selectedText.length < 2) return;

    const pageBounds = pageElement.getBoundingClientRect();
    const rects = Array.from(selection.getRangeAt(0).getClientRects())
      .map((rect) => {
        const left = Math.max(rect.left, pageBounds.left);
        const top = Math.max(rect.top, pageBounds.top);
        const right = Math.min(rect.right, pageBounds.right);
        const bottom = Math.min(rect.bottom, pageBounds.bottom);

        return {
          x: ((left - pageBounds.left) / pageBounds.width) * 100,
          y: ((top - pageBounds.top) / pageBounds.height) * 100,
          width: ((right - left) / pageBounds.width) * 100,
          height: ((bottom - top) / pageBounds.height) * 100,
        };
      })
      .filter((rect) => rect.width > 0.2 && rect.height > 0.2);

    if (!rects.length) return;
    onTextSelection({ page: pageNumber, text: selectedText, rects });
    selection.removeAllRanges();
  };

  return (
    <div ref={pageRef} className="bit-pdf-page relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      {shouldRender ? (
        <>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <Loader2 className="animate-spin text-bit-accent" size={22} />
            </div>
          )}
          <div ref={contentRef} className="relative max-h-full max-w-full">
            <canvas ref={canvasRef} className="absolute inset-0" />
            <div
              ref={textLayerRef}
              className="textLayer bit-pdf-text-layer"
              onMouseUp={handleTextMouseUp}
              onTouchEnd={handleTextMouseUp}
            />
            {textHighlights.map((highlight) => (
              <div key={highlight.id} className="pointer-events-none absolute inset-0 z-[3]">
                {highlight.rects.map((rect, index) => (
                  <span
                    key={`${highlight.id}-${index}`}
                    className="absolute rounded-[3px] bg-yellow-300/45 mix-blend-multiply"
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${rect.height}%`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-mono uppercase tracking-widest text-zinc-300">
          Page {pageNumber}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-[9px] font-mono text-zinc-400 shadow-sm">
        {pageNumber}
      </div>
      {isHighlighted && (
        <div className="pointer-events-none absolute inset-0 border-[5px] border-yellow-300/70 bg-yellow-200/10" />
      )}
      {isBookmarked && (
        <div className="pointer-events-none absolute right-4 top-0 flex h-12 w-7 items-center justify-center rounded-b-sm bg-bit-accent text-white shadow-md">
          <BookmarkCheck size={14} />
        </div>
      )}
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

const PDFFlipBook: React.FC<PDFFlipBookProps> = ({
  pdfUrl,
  title,
  backgroundPreset: controlledBackgroundPreset,
  studyPanelOpen: controlledStudyPanelOpen,
  onStudyPanelOpenChange,
}) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dimensions, setDimensions] = useState<FlipDimensions>({ width: 840, height: 594, display: 'double' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [internalStudyPanelOpen, setInternalStudyPanelOpen] = useState(false);
  const [internalBackgroundPreset] = useState<PdfBackgroundPresetId>(() => readPdfBackgroundPreset());
  const [studyState, setStudyState] = useState<PdfStudyState>(() => readStudyState(pdfUrl));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const suppressNextSoundRef = useRef(false);
  const bookmarkReturnRef = useRef<{ bookmarkPage: number; returnPage: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const proxiedPdfUrl = useMemo(() => getProxyPdfUrl(pdfUrl), [pdfUrl]);
  const sortedBookmarks = useMemo(() => [...studyState.bookmarks].sort((a, b) => a - b), [studyState.bookmarks]);
  const sortedHighlights = useMemo(() => [...studyState.highlights].sort((a, b) => a - b), [studyState.highlights]);
  const sortedTextHighlights = useMemo(() => [...studyState.textHighlights].sort((a, b) => b.createdAt - a.createdAt), [studyState.textHighlights]);
  const studyPanelOpen = controlledStudyPanelOpen ?? internalStudyPanelOpen;
  const backgroundPreset = controlledBackgroundPreset ?? internalBackgroundPreset;
  const activeBackgroundPreset = useMemo(
    () => PDF_BACKGROUND_PRESETS.find((preset) => preset.id === backgroundPreset) || PDF_BACKGROUND_PRESETS[0],
    [backgroundPreset]
  );
  const currentPageNote = studyState.notes[String(currentPage)] || '';
  const currentPageBookmarked = studyState.bookmarks.includes(currentPage);
  const currentPageHighlighted = studyState.highlights.includes(currentPage);
  const currentPageTextHighlights = studyState.textHighlights.filter((highlight) => highlight.page === currentPage);

  const getBook = useCallback((): TurnBook | null => {
    if (!bookRef.current) return null;
    const book = $(bookRef.current) as unknown as TurnBook;
    return isTurnBookReady(book) ? book : null;
  }, []);

  const setStudyPanelOpen = useCallback((value: boolean | ((open: boolean) => boolean)) => {
    const nextValue = typeof value === 'function' ? value(studyPanelOpen) : value;
    if (onStudyPanelOpenChange) {
      onStudyPanelOpenChange(nextValue);
    } else {
      setInternalStudyPanelOpen(nextValue);
    }
  }, [onStudyPanelOpenChange, studyPanelOpen]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setStudyState(readStudyState(pdfUrl));
    bookmarkReturnRef.current = null;
  }, [pdfUrl]);

  useEffect(() => {
    writeStudyState(pdfUrl, studyState);
  }, [pdfUrl, studyState]);

  useEffect(() => {
    writePdfBackgroundPreset(backgroundPreset);
  }, [backgroundPreset]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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
    const shell = shellRef.current;
    if (!shell) return;

    const getTouchDistance = (touches: TouchList) => {
      const first = touches.item(0);
      const second = touches.item(1);
      if (!first || !second) return 0;

      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const distance = getTouchDistance(event.touches);
      if (!distance) return;

      pinchRef.current = {
        distance,
        zoom: zoomRef.current,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;

      const distance = getTouchDistance(event.touches);
      if (!distance) return;

      event.preventDefault();
      setZoom(clampZoom(pinch.zoom * (distance / pinch.distance)));
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      if (!(target instanceof Node) || !shell.contains(target)) return;

      event.preventDefault();
      const zoomDelta = event.deltaY < 0 ? 0.08 : -0.08;
      setZoom((currentZoom) => clampZoom(currentZoom + zoomDelta));
    };

    shell.addEventListener('touchstart', handleTouchStart, { passive: true });
    shell.addEventListener('touchmove', handleTouchMove, { passive: false });
    shell.addEventListener('touchend', handleTouchEnd);
    shell.addEventListener('touchcancel', handleTouchEnd);
    shell.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      shell.removeEventListener('touchstart', handleTouchStart);
      shell.removeEventListener('touchmove', handleTouchMove);
      shell.removeEventListener('touchend', handleTouchEnd);
      shell.removeEventListener('touchcancel', handleTouchEnd);
      shell.removeEventListener('wheel', handleWheel);
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    currentPageRef.current = 1;
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
  const renderWindow = zoom > 1 ? 6 : 10;
  const textLayerWindow = dimensions.display === 'single' ? 1 : 2;
  const isZoomed = zoom > 1;
  const pageRenderWidth = dimensions.display === 'double' ? dimensions.width / 2 : dimensions.width;
  const pageRenderHeight = dimensions.height;

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

  const goToPage = useCallback((page: number) => {
    const book = getBook();
    if (!book || page < 1 || page > pageCount) return;

    try {
      book.turn('page', page);
    } catch (turnError) {
      console.warn('[PDF Turn.js] Page jump skipped:', turnError);
    }
  }, [getBook, pageCount]);

  const handlePageSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    goToPage(Number(event.target.value));
  }, [goToPage]);

  const goToBookmark = useCallback((page: number) => {
    const returnTarget = bookmarkReturnRef.current;
    const current = currentPageRef.current;

    if (returnTarget?.bookmarkPage === page && current === page) {
      bookmarkReturnRef.current = null;
      goToPage(returnTarget.returnPage);
      return;
    }

    if (current !== page) {
      bookmarkReturnRef.current = { bookmarkPage: page, returnPage: current };
    }

    goToPage(page);
  }, [goToPage]);

  const togglePageValue = useCallback((key: 'bookmarks' | 'highlights', page: number) => {
    setStudyState((current) => {
      const values = current[key];
      const nextValues = values.includes(page)
        ? values.filter((value) => value !== page)
        : [...values, page].sort((a, b) => a - b);

      return { ...current, [key]: nextValues };
    });
  }, []);

  const setPageNote = useCallback((page: number, note: string) => {
    setStudyState((current) => {
      const notes = { ...current.notes };
      if (note.trim()) {
        notes[String(page)] = note;
      } else {
        delete notes[String(page)];
      }

      return { ...current, notes };
    });
  }, []);

  const addTextHighlight = useCallback((highlight: Omit<PdfTextHighlight, 'id' | 'createdAt'>) => {
    setStudyState((current) => ({
      ...current,
      textHighlights: [
        {
          ...highlight,
          id: `${highlight.page}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        },
        ...current.textHighlights,
      ].slice(0, 250),
    }));
    setStudyPanelOpen(true);
  }, []);

  const removeTextHighlight = useCallback((highlightId: string) => {
    setStudyState((current) => ({
      ...current,
      textHighlights: current.textHighlights.filter((highlight) => highlight.id !== highlightId),
    }));
  }, []);

  const clearPageStudyData = useCallback((page: number) => {
    setStudyState((current) => {
      const notes = { ...current.notes };
      delete notes[String(page)];

      return {
        bookmarks: current.bookmarks.filter((value) => value !== page),
        highlights: current.highlights.filter((value) => value !== page),
        notes,
        textHighlights: current.textHighlights.filter((highlight) => highlight.page !== page),
      };
    });
  }, []);

  const adjustZoom = useCallback((direction: 'in' | 'out') => {
    setZoom((currentZoom) => {
      const nextZoom = direction === 'in' ? currentZoom + 0.25 : currentZoom - 0.25;
      return clampZoom(nextZoom);
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
    <div className={`relative flex h-full w-full flex-col overflow-hidden ${activeBackgroundPreset.className}`}>
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
                const shouldRenderTextLayer = studyPanelOpen && Math.abs(pageNumber - currentPage) <= textLayerWindow;
                return (
                  <div key={pageNumber} className="bit-turn-page bg-white">
                    <PDFPageCanvas
                      document={document}
                      pageNumber={pageNumber}
                      renderScale={renderScale}
                      shouldRender={shouldRender}
                      shouldRenderTextLayer={shouldRenderTextLayer}
                      targetWidth={pageRenderWidth}
                      targetHeight={pageRenderHeight}
                      isBookmarked={studyState.bookmarks.includes(pageNumber)}
                      isHighlighted={studyState.highlights.includes(pageNumber)}
                      textHighlights={studyState.textHighlights.filter((highlight) => highlight.page === pageNumber)}
                      onTextSelection={addTextHighlight}
                    />
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

        {studyPanelOpen && (
          <aside className="absolute right-4 top-4 z-[10070] flex max-h-[calc(100%-2rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-bit-border bg-bit-bg/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-bit-border px-4 py-3">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">Study Tools</p>
                <p className="text-xs text-bit-muted">Page {currentPage}</p>
              </div>
              <button
                type="button"
                onClick={() => setStudyPanelOpen(false)}
                className="rounded-full p-2 text-bit-muted transition-colors hover:bg-bit-panel hover:text-bit-text"
                aria-label="Close study tools"
              >
                <PanelRight size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => togglePageValue('bookmarks', currentPage)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${currentPageBookmarked ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/40 text-bit-muted hover:text-bit-accent'}`}
                >
                  {currentPageBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  Bookmark
                </button>
                <button
                  type="button"
                  onClick={() => togglePageValue('highlights', currentPage)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${currentPageHighlighted ? 'border-yellow-400 bg-yellow-300 text-zinc-950' : 'border-bit-border bg-bit-panel/40 text-bit-muted hover:text-yellow-300'}`}
                >
                  <Highlighter size={14} />
                  Highlight
                </button>
              </div>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
                  <StickyNote size={13} />
                  Page Note
                </span>
                <textarea
                  value={currentPageNote}
                  onChange={(event) => setPageNote(currentPage, event.target.value)}
                  placeholder="Write a quick note for this page..."
                  className="min-h-28 w-full resize-none rounded-lg border border-bit-border bg-bit-panel/35 p-3 text-sm leading-6 text-bit-text outline-none transition-colors placeholder:text-bit-muted/60 focus:border-bit-accent/50"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">Bookmarks</p>
                  <span className="text-[10px] font-mono text-bit-muted">{sortedBookmarks.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sortedBookmarks.length ? sortedBookmarks.map((page) => {
                    const canReturn = bookmarkReturnRef.current?.bookmarkPage === page && currentPage === page;

                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToBookmark(page)}
                        title={canReturn ? 'Return to the page you came from' : `Go to page ${page}`}
                        className={`rounded-full border px-3 py-1.5 text-xs font-mono transition-colors ${canReturn ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/35 text-bit-muted hover:border-bit-accent/50 hover:text-bit-accent'}`}
                      >
                        {canReturn ? `Return from ${page}` : `Page ${page}`}
                      </button>
                    );
                  }) : (
                    <p className="text-xs leading-5 text-bit-muted">No bookmarked pages yet.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">Highlighted Pages</p>
                  <span className="text-[10px] font-mono text-bit-muted">{sortedHighlights.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sortedHighlights.length ? sortedHighlights.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => goToPage(page)}
                      className="rounded-full border border-yellow-400/40 bg-yellow-300/10 px-3 py-1.5 text-xs font-mono text-yellow-200 transition-colors hover:bg-yellow-300 hover:text-zinc-950"
                    >
                      Page {page}
                    </button>
                  )) : (
                    <p className="text-xs leading-5 text-bit-muted">Highlight important pages while reading.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">Text Highlights</p>
                  <span className="text-[10px] font-mono text-bit-muted">{studyState.textHighlights.length}</span>
                </div>
                <div className="space-y-2">
                  {sortedTextHighlights.length ? sortedTextHighlights.slice(0, 16).map((highlight) => (
                    <div key={highlight.id} className="rounded-lg border border-bit-border bg-bit-panel/25 p-3">
                      <button
                        type="button"
                        onClick={() => goToPage(highlight.page)}
                        className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent"
                      >
                        Page {highlight.page}
                      </button>
                      <p className="line-clamp-3 text-xs leading-5 text-bit-muted">{highlight.text}</p>
                      <button
                        type="button"
                        onClick={() => removeTextHighlight(highlight.id)}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-red-300 hover:text-red-200"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  )) : (
                    <p className="text-xs leading-5 text-bit-muted">Select text on the page to save a real highlight.</p>
                  )}
                </div>
              </div>

              {(currentPageBookmarked || currentPageHighlighted || currentPageNote || currentPageTextHighlights.length > 0) && (
                <button
                  type="button"
                  onClick={() => clearPageStudyData(currentPage)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={14} />
                  Clear This Page
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="relative z-[10050] flex flex-col gap-3 border-t border-bit-border bg-bit-panel/55 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between md:px-6">
        <p className="min-w-0 line-clamp-1 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">
          {title}
        </p>
        <label className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-2xl">
          <span className="shrink-0 text-[10px] font-mono font-bold text-bit-muted">1</span>
          <span className="sr-only">Navigate PDF page</span>
          <input
            type="range"
            min={1}
            max={pageCount}
            step={1}
            value={currentPage}
            onChange={handlePageSliderChange}
            disabled={pageCount <= 1}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-bit-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Navigate PDF page"
            aria-valuetext={`Page ${currentPage} of ${pageCount}`}
          />
          <span className="shrink-0 text-[10px] font-mono font-bold text-bit-muted">{pageCount}</span>
        </label>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStudyPanelOpen((open) => !open)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all ${studyPanelOpen ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
            aria-label="Open study tools"
            title="Study tools"
          >
            <PanelRight size={15} />
          </button>
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
