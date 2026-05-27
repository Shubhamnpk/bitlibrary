import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import '@ksedline/turnjs';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ExternalLink, Highlighter, Loader2, RotateCcw, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { getPdfProxyUrl } from '@/lib/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PDFJS_WASM_URL = 'https://unpkg.com/pdfjs-dist@5.7.284/wasm/';
const MIN_PDF_RENDER_RATIO = 3;
const MAX_PDF_RENDER_RATIO = 4.5;
const PDF_STABLE_RENDER_SCALE = 2.1;
const isTurnTouchDevice = () => Boolean(($ as unknown as { isTouch?: boolean }).isTouch);

interface PDFFlipBookProps {
  pdfUrl: string;
  title: string;
  backgroundPreset?: PdfBackgroundPresetId;
  highlightColor?: PdfHighlightColorId;
  studyPanelOpen?: boolean;
  studyAction?: PdfStudyAction | null;
  onStudyPanelOpenChange?: (open: boolean) => void;
  onStudySnapshotChange?: (snapshot: PdfStudySnapshot) => void;
  onPreviousBoundary?: () => void;
  onNextBoundary?: () => void;
  preferFullDocumentLoad?: boolean;
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
  currentHighlightColor: PdfHighlightColorId;
  onTextSelection: (highlight: Omit<PdfTextHighlight, 'id' | 'createdAt'>) => void;
}

interface PdfHighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextHighlight {
  id: string;
  page: number;
  text: string;
  rects: PdfHighlightRect[];
  color?: PdfHighlightColorId;
  createdAt: number;
}

interface PdfStudyState {
  lastPage?: number;
  bookmarks: number[];
  highlights: number[];
  notes: Record<string, string>;
  textHighlights: PdfTextHighlight[];
}

const EMPTY_TEXT_HIGHLIGHTS: PdfTextHighlight[] = [];

export type PdfBackgroundPresetId = 'default' | 'wood' | 'paper' | 'sage' | 'night';
export type PdfHighlightColorId = 'yellow' | 'mint' | 'sky' | 'rose' | 'violet';

export interface PdfStudySnapshot {
  currentPage: number;
  pageCount: number;
  currentPageBookmarked: boolean;
  currentPageHighlighted: boolean;
  bookmarkedPages: number[];
  bookmarkCount: number;
  highlightCount: number;
  noteCount: number;
  textHighlights: PdfTextHighlight[];
}

export type PdfStudyAction = {
  id: number;
  type: 'toggle-bookmark' | 'open-panel' | 'go-to-page' | 'remove-text-highlight';
  page?: number;
  highlightId?: string;
};

type TurnBook = JQuery & {
  turn: (commandOrOptions?: unknown, value?: unknown) => unknown;
};

type GestureEventLike = Event & {
  scale?: number;
};

const PDF_BACKGROUND_STORAGE_KEY = 'bitlibrary-pdf-background-v1';
const PDF_HIGHLIGHT_COLOR_STORAGE_KEY = 'bitlibrary-pdf-highlight-color-v1';

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
    swatch: 'linear-gradient(135deg, #0f172a, #2563eb)',
  },
  {
    id: 'wood',
    label: 'Wood',
    className: 'bit-pdf-reader-bg-wood',
    swatch: 'linear-gradient(135deg, #4a2616, #a76532 52%, #2a140c)',
  },
  {
    id: 'paper',
    label: 'Paper',
    className: 'bit-pdf-reader-bg-paper',
    swatch: 'linear-gradient(135deg, #d9b66d, #fff1c9 58%, #a7772d)',
  },
  {
    id: 'sage',
    label: 'Sage',
    className: 'bit-pdf-reader-bg-sage',
    swatch: 'linear-gradient(135deg, #26382f, #7f9a78 55%, #111b16)',
  },
  {
    id: 'night',
    label: 'Night',
    className: 'bit-pdf-reader-bg-night',
    swatch: 'linear-gradient(135deg, #131821, #334055 55%, #090b10)',
  },
];

export const PDF_HIGHLIGHT_COLOR_PRESETS: Array<{
  id: PdfHighlightColorId;
  label: string;
  swatch: string;
  overlay: string;
}> = [
  { id: 'yellow', label: 'Yellow', swatch: '#fde047', overlay: 'rgba(253, 224, 71, 0.48)' },
  { id: 'mint', label: 'Mint', swatch: '#86efac', overlay: 'rgba(134, 239, 172, 0.46)' },
  { id: 'sky', label: 'Sky', swatch: '#7dd3fc', overlay: 'rgba(125, 211, 252, 0.44)' },
  { id: 'rose', label: 'Rose', swatch: '#fda4af', overlay: 'rgba(253, 164, 175, 0.46)' },
  { id: 'violet', label: 'Violet', swatch: '#c4b5fd', overlay: 'rgba(196, 181, 253, 0.44)' },
];

const isTurnBookReady = (book: TurnBook) => {
  try {
    return Boolean(book.turn('is'));
  } catch {
    return false;
  }
};

const getStudyStorageKey = (pdfUrl: string) => `bitlibrary-pdf-study-v1:${encodeURIComponent(pdfUrl).slice(0, 180)}`;

const clampZoom = (value: number) => Math.min(1.75, Math.max(1, Number(value.toFixed(3))));

const getHighlightOverlay = (color?: PdfHighlightColorId) => (
  PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === color)?.overlay || PDF_HIGHLIGHT_COLOR_PRESETS[0].overlay
);

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

export const readPdfHighlightColor = (): PdfHighlightColorId => {
  if (typeof window === 'undefined') return 'yellow';

  try {
    const value = window.localStorage.getItem(PDF_HIGHLIGHT_COLOR_STORAGE_KEY);
    return PDF_HIGHLIGHT_COLOR_PRESETS.some((preset) => preset.id === value) ? value as PdfHighlightColorId : 'yellow';
  } catch {
    return 'yellow';
  }
};

export const writePdfHighlightColor = (color: PdfHighlightColorId) => {
  try {
    window.localStorage.setItem(PDF_HIGHLIGHT_COLOR_STORAGE_KEY, color);
  } catch {
    // Highlight color is cosmetic, so storage failures should not block reading.
  }
};

const readStudyState = (pdfUrl: string): PdfStudyState => {
  if (typeof window === 'undefined') return { bookmarks: [], highlights: [], notes: {}, textHighlights: [] };

  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStudyStorageKey(pdfUrl)) || 'null') as Partial<PdfStudyState> | null;
    const parsedLastPage = typeof parsed?.lastPage === 'number' && Number.isFinite(parsed.lastPage) && parsed.lastPage > 0
      ? Math.floor(parsed.lastPage)
      : undefined;

    return {
      lastPage: parsedLastPage,
      bookmarks: Array.isArray(parsed?.bookmarks) ? parsed.bookmarks.filter(Number.isFinite) : [],
      highlights: Array.isArray(parsed?.highlights) ? parsed.highlights.filter(Number.isFinite) : [],
      notes: parsed?.notes && typeof parsed.notes === 'object' ? parsed.notes as Record<string, string> : {},
      textHighlights: Array.isArray(parsed?.textHighlights) ? parsed.textHighlights.filter((highlight) => (
        typeof highlight?.id === 'string' &&
        Number.isFinite(highlight.page) &&
        typeof highlight.text === 'string' &&
        Array.isArray(highlight.rects) &&
        (highlight.color === undefined || PDF_HIGHLIGHT_COLOR_PRESETS.some((preset) => preset.id === highlight.color))
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

const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({ document, pageNumber, shouldRender, shouldRenderTextLayer, renderScale, targetWidth, targetHeight, isBookmarked, isHighlighted, textHighlights, currentHighlightColor, onTextSelection }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRenderedCanvas, setHasRenderedCanvas] = useState(false);

  const clearTextLayerSelection = () => {
    const selection = window.getSelection();
    const textLayer = textLayerRef.current;
    if (!selection || selection.rangeCount === 0 || !textLayer) return;

    const touchesTextLayer = Array.from({ length: selection.rangeCount }).some((_, index) => {
      const range = selection.getRangeAt(index);
      return (
        textLayer.contains(range.commonAncestorContainer) ||
        Boolean(selection.anchorNode && textLayer.contains(selection.anchorNode)) ||
        Boolean(selection.focusNode && textLayer.contains(selection.focusNode))
      );
    });

    if (touchesTextLayer) {
      selection.removeAllRanges();
    }
  };

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
        const zoomQuality = Math.max(MIN_PDF_RENDER_RATIO, renderScale * 1.35);
        const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1) * zoomQuality, MAX_PDF_RENDER_RATIO);

        content.style.width = `${viewport.width}px`;
        content.style.height = `${viewport.height}px`;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.imageRendering = 'auto';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.style.setProperty('--scale-factor', String(fitScale));
        textLayer.style.setProperty('--total-scale-factor', String(fitScale));
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

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

      if (!cancelled) setHasRenderedCanvas(true);
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
      clearTextLayerSelection();
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

        clearTextLayerSelection();
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
        clearTextLayerSelection();
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
      clearTextLayerSelection();
    };
  }, [document, pageNumber, shouldRender, shouldRenderTextLayer, targetHeight, targetWidth]);

  const handleTextPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    selectionStartRef.current = { x: event.clientX, y: event.clientY };
    clearTextLayerSelection();
  };

  const handleTextPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = selectionStartRef.current;
    selectionStartRef.current = null;

    if (start) {
      const dragDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (dragDistance < 4) {
        clearTextLayerSelection();
        return;
      }
    }

    const selection = window.getSelection();
    const pageElement = contentRef.current;
    const textLayer = textLayerRef.current;
    if (!selection || selection.isCollapsed || !pageElement || !textLayer || selection.rangeCount === 0) {
      clearTextLayerSelection();
      return;
    }
    if (!textLayer.contains(selection.anchorNode) || !textLayer.contains(selection.focusNode)) {
      clearTextLayerSelection();
      return;
    }

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (selectedText.length < 2) {
      clearTextLayerSelection();
      return;
    }

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

    if (!rects.length) {
      clearTextLayerSelection();
      return;
    }
    onTextSelection({ page: pageNumber, text: selectedText, rects });
    clearTextLayerSelection();
  };

  return (
    <div ref={pageRef} className="bit-pdf-page relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      {shouldRender ? (
        <>
          {loading && !hasRenderedCanvas && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <Loader2 className="animate-spin text-bit-accent" size={22} />
            </div>
          )}
          <div ref={contentRef} className="relative max-h-full max-w-full">
            <canvas ref={canvasRef} className="absolute inset-0" />
            <div
              ref={textLayerRef}
              className="textLayer bit-pdf-text-layer"
              style={{ '--bit-pdf-selection-color': getHighlightOverlay(currentHighlightColor) } as React.CSSProperties}
              onPointerDown={handleTextPointerDown}
              onPointerUp={handleTextPointerUp}
              onPointerCancel={() => {
                selectionStartRef.current = null;
                clearTextLayerSelection();
              }}
            />
            {textHighlights.map((highlight) => (
              <div key={highlight.id} className="pointer-events-none absolute inset-0 z-[3]">
                {highlight.rects.map((rect, index) => (
                  <span
                    key={`${highlight.id}-${index}`}
                    className="absolute rounded-[3px] mix-blend-multiply"
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${rect.height}%`,
                      backgroundColor: getHighlightOverlay(highlight.color),
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

const MemoPDFPageCanvas = React.memo(PDFPageCanvas);

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

const getDefaultZoom = () => (
  typeof window !== 'undefined' && window.innerWidth < 760 ? 1.2 : 1
);

const PDFFlipBook: React.FC<PDFFlipBookProps> = ({
  pdfUrl,
  title,
  backgroundPreset: controlledBackgroundPreset,
  highlightColor: controlledHighlightColor,
  studyPanelOpen: controlledStudyPanelOpen,
  studyAction,
  onStudyPanelOpenChange,
  onStudySnapshotChange,
  onPreviousBoundary,
  onNextBoundary,
  preferFullDocumentLoad = false,
}) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(() => readStudyState(pdfUrl).lastPage || 1);
  const [dimensions, setDimensions] = useState<FlipDimensions>(() => (
    typeof window === 'undefined'
      ? { width: 840, height: 594, display: 'double' }
      : getDimensions(window.innerWidth, Math.max(420, window.innerHeight - 120))
  ));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState(() => getDefaultZoom());
  const [isPageSliderActive, setIsPageSliderActive] = useState(false);
  const [internalStudyPanelOpen, setInternalStudyPanelOpen] = useState(false);
  const [internalBackgroundPreset] = useState<PdfBackgroundPresetId>(() => readPdfBackgroundPreset());
  const [internalHighlightColor] = useState<PdfHighlightColorId>(() => readPdfHighlightColor());
  const [studyState, setStudyState] = useState<PdfStudyState>(() => readStudyState(pdfUrl));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const wasZoomedRef = useRef(false);
  const centeredMobileLayoutKeyRef = useRef<string | null>(null);
  const suppressNextSoundRef = useRef(false);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pointerTouchesRef = useRef(new Map<number, { x: number; y: number }>());
  const pointerPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const gestureZoomRef = useRef<number | null>(null);
  const pendingZoomRef = useRef(zoom);
  const zoomFrameRef = useRef<number | null>(null);
  const handledStudyActionRef = useRef<number | null>(null);
  const skipNextStudyStateWriteRef = useRef(false);
  const proxiedPdfUrl = useMemo(() => getPdfProxyUrl(pdfUrl), [pdfUrl]);
  const sortedBookmarks = useMemo(() => [...studyState.bookmarks].sort((a, b) => a - b), [studyState.bookmarks]);
  const studyPanelOpen = controlledStudyPanelOpen ?? internalStudyPanelOpen;
  const backgroundPreset = controlledBackgroundPreset ?? internalBackgroundPreset;
  const highlightColor = controlledHighlightColor ?? internalHighlightColor;
  const activeBackgroundPreset = useMemo(
    () => PDF_BACKGROUND_PRESETS.find((preset) => preset.id === backgroundPreset) || PDF_BACKGROUND_PRESETS[0],
    [backgroundPreset]
  );
  const textHighlightsByPage = useMemo(() => {
    const highlights = new Map<number, PdfTextHighlight[]>();
    studyState.textHighlights.forEach((highlight) => {
      const pageHighlights = highlights.get(highlight.page);
      if (pageHighlights) {
        pageHighlights.push(highlight);
      } else {
        highlights.set(highlight.page, [highlight]);
      }
    });
    return highlights;
  }, [studyState.textHighlights]);
  const currentPageBookmarked = studyState.bookmarks.includes(currentPage);
  const currentPageHighlighted = studyState.highlights.includes(currentPage);
  const currentPageTextHighlights = textHighlightsByPage.get(currentPage) ?? EMPTY_TEXT_HIGHLIGHTS;
  const sortedTextHighlights = useMemo(() => [...studyState.textHighlights].sort((a, b) => b.createdAt - a.createdAt), [studyState.textHighlights]);

  const scheduleZoom = useCallback((nextZoom: number | ((currentZoom: number) => number)) => {
    const nextValue = clampZoom(
      typeof nextZoom === 'function' ? nextZoom(pendingZoomRef.current) : nextZoom
    );

    pendingZoomRef.current = nextValue;
    zoomRef.current = nextValue;

    if (zoomFrameRef.current !== null) return;

    zoomFrameRef.current = window.requestAnimationFrame(() => {
      zoomFrameRef.current = null;
      setZoom(pendingZoomRef.current);
    });
  }, []);

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
    skipNextStudyStateWriteRef.current = true;
    setStudyState(readStudyState(pdfUrl));
  }, [pdfUrl]);

  useEffect(() => {
    if (skipNextStudyStateWriteRef.current) {
      skipNextStudyStateWriteRef.current = false;
      return;
    }

    writeStudyState(pdfUrl, studyState);
  }, [pdfUrl, studyState]);

  useEffect(() => {
    writePdfBackgroundPreset(backgroundPreset);
  }, [backgroundPreset]);

  useEffect(() => {
    writePdfHighlightColor(highlightColor);
  }, [highlightColor]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!Number.isFinite(currentPage) || currentPage < 1) return;

    setStudyState((currentState) => {
      const lastPage = Math.floor(currentPage);
      return currentState.lastPage === lastPage ? currentState : { ...currentState, lastPage };
    });
  }, [currentPage]);

  useEffect(() => {
    zoomRef.current = zoom;
    pendingZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    return () => {
      if (zoomFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomFrameRef.current);
      }
    };
  }, []);

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
  }, [document]);

  useEffect(() => {
    if (loading || !document) return;

    const shell = shellRef.current;
    if (!shell) return;

    const getPointDistance = (first: { x: number; y: number }, second: { x: number; y: number }) => {
      return Math.hypot(first.x - second.x, first.y - second.y);
    };

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
      scheduleZoom(pinch.zoom * (distance / pinch.distance));
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    const getPointerPair = () => {
      const points = Array.from(pointerTouchesRef.current.values());
      return points.length >= 2 ? [points[0], points[1]] as const : null;
    };

    const syncPointerPinch = () => {
      const pair = getPointerPair();
      if (!pair) {
        pointerPinchRef.current = null;
        return;
      }

      const distance = getPointDistance(pair[0], pair[1]);
      if (!distance) return;

      if (!pointerPinchRef.current) {
        pointerPinchRef.current = {
          distance,
          zoom: zoomRef.current,
        };
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointerTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        shell.setPointerCapture(event.pointerId);
      } catch {
        // Some embedded browser contexts do not allow capture; the document listeners still cover movement.
      }
      syncPointerPinch();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointerTouchesRef.current.has(event.pointerId)) return;
      pointerTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pair = getPointerPair();
      const pinch = pointerPinchRef.current;
      if (!pair || !pinch) return;

      const distance = getPointDistance(pair[0], pair[1]);
      if (!distance) return;

      event.preventDefault();
      scheduleZoom(pinch.zoom * (distance / pinch.distance));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointerTouchesRef.current.delete(event.pointerId);
      syncPointerPinch();
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      if (!(target instanceof Node) || !shell.contains(target)) return;

      event.preventDefault();
      const zoomDelta = Math.max(-0.08, Math.min(0.08, -event.deltaY * 0.0015));
      scheduleZoom((currentZoom) => currentZoom + zoomDelta);
    };

    const handleGestureStart = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node) || !shell.contains(target)) return;

      event.preventDefault();
      gestureZoomRef.current = zoomRef.current;
    };

    const handleGestureChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node) || !shell.contains(target)) return;

      const gestureEvent = event as GestureEventLike;
      const scale = typeof gestureEvent.scale === 'number' ? gestureEvent.scale : 1;
      const baseZoom = gestureZoomRef.current ?? zoomRef.current;

      event.preventDefault();
      scheduleZoom(baseZoom * scale);
    };

    const handleGestureEnd = () => {
      gestureZoomRef.current = null;
    };

    shell.addEventListener('touchstart', handleTouchStart, { passive: true });
    shell.addEventListener('touchmove', handleTouchMove, { passive: false });
    shell.addEventListener('touchend', handleTouchEnd);
    shell.addEventListener('touchcancel', handleTouchEnd);
    shell.addEventListener('pointerdown', handlePointerDown, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.document.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
    window.document.addEventListener('pointerup', handlePointerEnd, { capture: true });
    window.document.addEventListener('pointercancel', handlePointerEnd, { capture: true });
    window.document.addEventListener('gesturestart', handleGestureStart, { passive: false, capture: true });
    window.document.addEventListener('gesturechange', handleGestureChange, { passive: false, capture: true });
    window.document.addEventListener('gestureend', handleGestureEnd, { capture: true });

    return () => {
      shell.removeEventListener('touchstart', handleTouchStart);
      shell.removeEventListener('touchmove', handleTouchMove);
      shell.removeEventListener('touchend', handleTouchEnd);
      shell.removeEventListener('touchcancel', handleTouchEnd);
      shell.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('wheel', handleWheel, { capture: true });
      window.document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.document.removeEventListener('pointerup', handlePointerEnd, { capture: true });
      window.document.removeEventListener('pointercancel', handlePointerEnd, { capture: true });
      window.document.removeEventListener('gesturestart', handleGestureStart, { capture: true });
      window.document.removeEventListener('gesturechange', handleGestureChange, { capture: true });
      window.document.removeEventListener('gestureend', handleGestureEnd, { capture: true });
      pointerTouchesRef.current.clear();
      pointerPinchRef.current = null;
      pinchRef.current = null;
      gestureZoomRef.current = null;
    };
  }, [loading, document, scheduleZoom]);

  useEffect(() => {
    let cancelled = false;
    const savedState = readStudyState(pdfUrl);
    const pageToRestore = savedState.lastPage && savedState.lastPage > 0 ? savedState.lastPage : 1;
    setLoading(true);
    setError(null);
    currentPageRef.current = pageToRestore;
    setCurrentPage(pageToRestore);
    const defaultZoom = getDefaultZoom();
    zoomRef.current = defaultZoom;
    pendingZoomRef.current = defaultZoom;
    setZoom(defaultZoom);

    const task = pdfjsLib.getDocument({
      url: proxiedPdfUrl,
      disableRange: preferFullDocumentLoad,
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
  }, [pdfUrl, preferFullDocumentLoad, proxiedPdfUrl]);

  useEffect(() => {
    if (!document || currentPage <= document.numPages) return;
    currentPageRef.current = document.numPages;
    setCurrentPage(document.numPages);
  }, [currentPage, document]);

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
        autoCenter: dimensions.display !== 'single',
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
  const canGoPrevious = currentPage > 1 || Boolean(onPreviousBoundary);
  const canGoNext = currentPage < pageCount || Boolean(onNextBoundary);
  const renderScale = PDF_STABLE_RENDER_SCALE;
  const renderWindow = zoom > 1 ? 6 : 10;
  const textLayerWindow = dimensions.display === 'single' ? 1 : 2;
  const isZoomed = zoom > 1;
  const zoomedWidth = Math.round(dimensions.width * zoom);
  const zoomedHeight = Math.round(dimensions.height * zoom);
  const pageRenderWidth = dimensions.display === 'double' ? dimensions.width / 2 : dimensions.width;
  const pageRenderHeight = dimensions.height;
  const shouldCenterZoomedReader = isZoomed && dimensions.display === 'single';
  const pageSliderProgress = pageCount > 1 ? ((currentPage - 1) / (pageCount - 1)) * 100 : 0;
  const isLightReaderBackground = backgroundPreset === 'paper';
  const navButtonToneClass = isLightReaderBackground
    ? 'border-black/10 bg-white/45 text-black/50 hover:border-black/20 hover:bg-white/75 hover:text-black/80 md:border-black/10 md:bg-white/55 md:text-black/50 md:hover:border-black/25 md:hover:bg-white/85 md:hover:text-black/80'
    : 'border-white/10 bg-black/20 text-white/45 hover:border-white/20 hover:bg-black/35 hover:text-white/85 md:border-white/15 md:bg-black/25 md:text-white/55 md:hover:border-white/25 md:hover:bg-black/40 md:hover:text-white/90';
  const navButtonBaseClass = `fixed top-1/2 z-[10060] flex h-16 w-8 -translate-y-1/2 items-center justify-center border-y shadow-none backdrop-blur-md transition-all disabled:pointer-events-none disabled:opacity-0 md:h-11 md:w-11 md:rounded-full md:border md:shadow-lg md:disabled:pointer-events-auto md:disabled:cursor-not-allowed md:disabled:opacity-20 ${navButtonToneClass}`;

  useEffect(() => {
    const wasZoomed = wasZoomedRef.current;
    wasZoomedRef.current = shouldCenterZoomedReader;
    const layoutKey = `${currentPage}:${dimensions.width}:${dimensions.height}:${zoom}`;
    const shouldCenterForLayout = shouldCenterZoomedReader && centeredMobileLayoutKeyRef.current !== layoutKey;
    if (!shouldCenterZoomedReader || (wasZoomed && !shouldCenterForLayout) || !shellRef.current) return;
    centeredMobileLayoutKeyRef.current = layoutKey;

    window.requestAnimationFrame(() => {
      const shell = shellRef.current;
      if (!shell) return;
      shell.scrollLeft = Math.max(0, (shell.scrollWidth - shell.clientWidth) / 2);
    });
  }, [shouldCenterZoomedReader, currentPage, dimensions.width, dimensions.height, zoom]);

  const goPrevious = useCallback(() => {
    if (currentPageRef.current <= 1 && onPreviousBoundary) {
      onPreviousBoundary();
      return;
    }

    if (dimensions.display === 'single') {
      setCurrentPage((page) => Math.max(1, page - 1));
      if (soundEnabledRef.current && currentPageRef.current > 1) playPageTurnSound();
      return;
    }

    const book = getBook();
    if (!book || currentPageRef.current <= 1) return;
    try {
      book.turn('previous');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Previous page skipped:', turnError);
    }
  }, [dimensions.display, getBook, onPreviousBoundary]);

  const goNext = useCallback(() => {
    if (currentPageRef.current >= pageCount && onNextBoundary) {
      onNextBoundary();
      return;
    }

    if (dimensions.display === 'single') {
      setCurrentPage((page) => Math.min(pageCount, page + 1));
      if (soundEnabledRef.current && currentPageRef.current < pageCount) playPageTurnSound();
      return;
    }

    const book = getBook();
    if (!book || currentPageRef.current >= pageCount) return;
    try {
      book.turn('next');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Next page skipped:', turnError);
    }
  }, [dimensions.display, getBook, onNextBoundary, pageCount]);

  const goToPage = useCallback((page: number) => {
    if (dimensions.display === 'single') {
      if (page < 1 || page > pageCount) return;
      setCurrentPage(page);
      return;
    }

    const book = getBook();
    if (!book || page < 1 || page > pageCount) return;

    try {
      book.turn('page', page);
    } catch (turnError) {
      console.warn('[PDF Turn.js] Page jump skipped:', turnError);
    }
  }, [dimensions.display, getBook, pageCount]);

  const handlePageSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    goToPage(Number(event.currentTarget.value));
  }, [goToPage]);

  const toggleSavedPage = useCallback((page: number) => {
    setStudyState((current) => {
      const isSaved = current.bookmarks.includes(page) || current.highlights.includes(page);
      const nextBookmarks = isSaved
        ? current.bookmarks.filter((value) => value !== page)
        : [...current.bookmarks, page].sort((a, b) => a - b);
      const nextHighlights = isSaved
        ? current.highlights.filter((value) => value !== page)
        : [...current.highlights, page].sort((a, b) => a - b);

      return {
        ...current,
        bookmarks: nextBookmarks,
        highlights: nextHighlights,
      };
    });
  }, []);

  const addTextHighlight = useCallback((highlight: Omit<PdfTextHighlight, 'id' | 'createdAt'>) => {
    setStudyState((current) => ({
      ...current,
      textHighlights: [
        {
          ...highlight,
          color: highlight.color ?? highlightColor,
          id: `${highlight.page}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        },
        ...current.textHighlights,
      ].slice(0, 250),
    }));
  }, [highlightColor]);

  const removeTextHighlight = useCallback((highlightId: string) => {
    setStudyState((current) => ({
      ...current,
      textHighlights: current.textHighlights.filter((highlight) => highlight.id !== highlightId),
    }));
  }, []);

  useEffect(() => {
    onStudySnapshotChange?.({
      currentPage,
      pageCount,
      currentPageBookmarked,
      currentPageHighlighted,
      bookmarkedPages: sortedBookmarks,
      bookmarkCount: studyState.bookmarks.length,
      highlightCount: studyState.textHighlights.length,
      noteCount: Object.keys(studyState.notes).length,
      textHighlights: sortedTextHighlights,
    });
  }, [
    currentPage,
    pageCount,
    currentPageBookmarked,
    currentPageHighlighted,
    sortedBookmarks,
    sortedTextHighlights,
    studyState.bookmarks.length,
    studyState.textHighlights.length,
    studyState.notes,
    onStudySnapshotChange,
  ]);

  useEffect(() => {
    if (!studyAction) return;
    if (handledStudyActionRef.current === studyAction.id) return;
    handledStudyActionRef.current = studyAction.id;

    if (studyAction.type === 'toggle-bookmark') {
      toggleSavedPage(currentPage);
    } else if (studyAction.type === 'go-to-page' && studyAction.page) {
      goToPage(studyAction.page);
    } else if (studyAction.type === 'remove-text-highlight' && studyAction.highlightId) {
      removeTextHighlight(studyAction.highlightId);
    } else {
      setStudyPanelOpen(true);
    }
  }, [currentPage, goToPage, removeTextHighlight, setStudyPanelOpen, studyAction, toggleSavedPage]);

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
        className={`scrollbar-hide relative flex min-h-0 flex-1 touch-none overscroll-contain ${isZoomed ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden'} px-4 py-6 md:px-10 md:py-8`}
      >
        <button
          type="button"
          onClick={goPrevious}
          onMouseDown={(event) => event.stopPropagation()}
          disabled={!canGoPrevious}
          className={`${navButtonBaseClass} left-0 rounded-r-full border-r md:left-6`}
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
            contain: 'layout paint',
            minWidth: isZoomed ? `${zoomedWidth + 96}px` : undefined,
            minHeight: isZoomed ? `${zoomedHeight + 96}px` : undefined,
          }}
        >
          <div
            className="relative"
            style={{
              width: isZoomed ? `${zoomedWidth}px` : `${dimensions.width}px`,
              height: isZoomed ? `${zoomedHeight}px` : `${dimensions.height}px`,
            }}
          >
          <div
            className="absolute left-0 top-0 will-change-transform"
            style={{
              transform: `translate3d(0, 0, 0) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {dimensions.display === 'single' ? (
              <div className="h-full w-full overflow-hidden rounded-sm bg-white shadow-2xl">
                <MemoPDFPageCanvas
                  document={document}
                  pageNumber={currentPage}
                  renderScale={renderScale}
                  shouldRender
                  shouldRenderTextLayer={studyPanelOpen}
                  targetWidth={pageRenderWidth}
                  targetHeight={pageRenderHeight}
                  isBookmarked={currentPageBookmarked}
                  isHighlighted={currentPageHighlighted}
                  textHighlights={currentPageTextHighlights}
                  currentHighlightColor={highlightColor}
                  onTextSelection={addTextHighlight}
                />
              </div>
            ) : (
              <div ref={bookRef} className="bit-turn-book">
                {Array.from({ length: pageCount }, (_, index) => {
                  const pageNumber = index + 1;
                  const shouldRender = Math.abs(pageNumber - currentPage) <= renderWindow;
                  const shouldRenderTextLayer = studyPanelOpen && Math.abs(pageNumber - currentPage) <= textLayerWindow;
                  return (
                    <div key={pageNumber} className="bit-turn-page bg-white">
                      <MemoPDFPageCanvas
                        document={document}
                        pageNumber={pageNumber}
                        renderScale={renderScale}
                        shouldRender={shouldRender}
                        shouldRenderTextLayer={shouldRenderTextLayer}
                        targetWidth={pageRenderWidth}
                        targetHeight={pageRenderHeight}
                        isBookmarked={studyState.bookmarks.includes(pageNumber)}
                        isHighlighted={studyState.highlights.includes(pageNumber)}
                        textHighlights={textHighlightsByPage.get(pageNumber) ?? EMPTY_TEXT_HIGHLIGHTS}
                        currentHighlightColor={highlightColor}
                        onTextSelection={addTextHighlight}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
          className={`${navButtonBaseClass} right-0 rounded-l-full border-l md:right-6`}
          aria-label="Next page"
        >
          <ChevronRight size={22} />
        </button>

      </div>

      <div className="relative z-[10050] flex flex-col gap-2 border-t border-bit-border/55 bg-bit-panel/35 px-3 py-2.5 shadow-[0_-18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30rem)_minmax(0,1fr)] lg:gap-4">
        <p className="hidden min-w-0 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted lg:line-clamp-1 lg:block">
          {title}
        </p>
        <div className="flex min-w-0 flex-1 items-end gap-2 sm:gap-3 lg:col-start-2 lg:w-full">
          <span className="shrink-0 pb-1 text-[10px] font-mono font-bold text-bit-muted">1</span>
          <label className="relative flex min-w-[12rem] flex-1 flex-col gap-2 sm:min-w-[18rem]">
            {isPageSliderActive && (
              <span
                className="pointer-events-none absolute -top-8 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-bit-accent bg-bit-accent px-1.5 text-[10px] font-mono font-bold leading-none text-white shadow-lg shadow-bit-accent/25 backdrop-blur"
                style={{
                  left: `clamp(1.6rem, ${pageSliderProgress}%, calc(100% - 1.6rem))`,
                  transform: 'translateX(-50%)',
                }}
              >
                {currentPage}
              </span>
            )}
            <span className="sr-only">Navigate PDF page</span>
            <div className={`pointer-events-none absolute bottom-3 left-0 right-0 h-2 overflow-hidden rounded-full shadow-inner transition-all duration-150 ${isPageSliderActive ? 'bg-bit-text/25 ring-4 ring-bit-accent/10' : 'bg-bit-text/15'}`}>
              <span
                className={`block h-full rounded-full bg-bit-accent transition-[width,box-shadow] duration-100 ${isPageSliderActive ? 'shadow-[0_0_24px_rgba(var(--bit-accent-rgb),0.55)]' : 'shadow-[0_0_18px_rgba(var(--bit-accent-rgb),0.35)]'}`}
                style={{ width: `${pageSliderProgress}%` }}
              />
            </div>
            <input
              type="range"
              min={1}
              max={pageCount}
              step={1}
              value={currentPage}
              onInput={handlePageSliderChange}
              onChange={handlePageSliderChange}
              onPointerDown={() => setIsPageSliderActive(true)}
              onPointerUp={() => setIsPageSliderActive(false)}
              onPointerCancel={() => setIsPageSliderActive(false)}
              onTouchStart={() => setIsPageSliderActive(true)}
              onTouchEnd={() => setIsPageSliderActive(false)}
              onMouseDown={() => setIsPageSliderActive(true)}
              onMouseUp={() => setIsPageSliderActive(false)}
              onBlur={() => setIsPageSliderActive(false)}
              disabled={pageCount <= 1}
              className={`pdf-page-slider relative z-10 h-8 w-full bg-transparent disabled:cursor-not-allowed disabled:opacity-40 ${isPageSliderActive ? 'cursor-grabbing' : 'cursor-grab'}`}
              aria-label="Navigate PDF page"
              aria-valuetext={`Page ${currentPage} of ${pageCount}`}
            />
          </label>
          <span className="shrink-0 pb-1 text-[10px] font-mono font-bold text-bit-muted">{pageCount}</span>
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 sm:justify-start sm:gap-3 lg:justify-end">
          <button
            type="button"
            onClick={() => toggleSavedPage(currentPage)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all ${currentPageBookmarked || currentPageHighlighted ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
            aria-label={currentPageBookmarked || currentPageHighlighted ? 'Unsave current page' : 'Save current page'}
            title={currentPageBookmarked || currentPageHighlighted ? 'Saved page' : 'Save page'}
          >
            {currentPageBookmarked || currentPageHighlighted ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setStudyPanelOpen((open) => !open)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all ${studyPanelOpen ? 'border-yellow-300 bg-yellow-300 text-zinc-950' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-yellow-300/40 hover:text-yellow-200'}`}
            aria-label={studyPanelOpen ? 'Disable text highlighting' : 'Enable text highlighting'}
            title={studyPanelOpen ? 'Highlighting on' : 'Turn on highlighting'}
          >
            <Highlighter size={15} />
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
            <span className="min-w-9 text-center text-[10px] font-mono font-bold text-bit-muted sm:min-w-10">
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
          <div className="min-w-[5.5rem] whitespace-nowrap text-right text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-accent tabular-nums sm:min-w-[8.5rem] sm:tracking-[0.22em]">
            <span className="sm:hidden">{currentPage}/{pageCount}</span>
            <span className="hidden sm:inline">Page {currentPage} / {pageCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFFlipBook;
