import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $ from 'jquery';
import '@ksedline/turnjs';
import { Bookmark, BookmarkCheck, BookOpenText, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Eraser, ExternalLink, GripVertical, Headphones, Highlighter, Loader2, MousePointer2, Pause, PenLine, Play, RotateCcw, Trash2, Type, Volume2, VolumeX, X, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getPdfProxyUrl } from '@/lib/pdf';
import { PDF_BACKGROUND_PRESETS, PDF_HIGHLIGHT_COLOR_PRESETS } from '@/lib/pdf-reader-presets';
import { getPdfSpeechSegments, type PdfSpeechItemRange, type PdfSpeechSegment, type PdfSpeechStatus } from '@/lib/pdf-speech';
import {
  readPdfBackgroundPreset,
  readPdfHighlightColor,
  readPdfStudyState,
  writePdfBackgroundPreset,
  writePdfHighlightColor,
  writePdfStudyState,
  type PdfBackgroundPresetId,
  type PdfHighlightColorId,
  type PdfAnnotation,
  type PdfInkAnnotation,
  type PdfStudyState,
  type PdfTextAnnotation,
  type PdfTextHighlight,
} from '@/lib/pdf-reader-storage';
import { getPreferredSpeechVoiceURI, getSpeechWordAtBoundary, normalizeSpeechMatchText, speakUtterance } from '@/lib/speech';
import { buildNormalizedPoints, buildSearchSnippet, collectTextNodes, findReaderSearchRanges } from '@/lib/reader-search';

export type {
  PdfBackgroundPresetId,
  PdfHighlightColorId,
  PdfTextHighlight,
} from '@/lib/pdf-reader-storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PDFJS_WASM_URL = '/assets/pdfjs/wasm/';
const MIN_PDF_RENDER_RATIO = 3;
const MAX_PDF_RENDER_RATIO = 4.5;
const PDF_STABLE_RENDER_SCALE = 2.6;
const MAX_PDF_LOAD_ATTEMPTS = 3;
const PDF_LOAD_RETRY_DELAY_MS = 400;
const isTurnTouchDevice = () => Boolean(($ as unknown as { isTouch?: boolean }).isTouch);

export interface PdfSearchResultEntry {
  page: number;
  snippet: string;
}

export interface PdfSearchResults {
  total: number;
  activeIndex: number;
  loading: boolean;
  matches: PdfSearchResultEntry[];
}

export interface PdfSearchRequest {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  pageOnly: boolean;
  activeIndex: number;
  navRequest: number;
  version: number;
}

interface PDFFlipBookProps {
  pdfUrl: string;
  title: string;
  backgroundPreset?: PdfBackgroundPresetId;
  highlightColor?: PdfHighlightColorId;
  speechHighlightMode?: 'paragraph' | 'word';
  speechReadingOrder?: 'page' | 'source';
  studyPanelOpen?: boolean;
  tableOfContentsRequestId?: number;
  studyAction?: PdfStudyAction | null;
  onStudyPanelOpenChange?: (open: boolean) => void;
  onHighlightColorChange?: (color: PdfHighlightColorId) => void;
  onStudySnapshotChange?: (snapshot: PdfStudySnapshot) => void;
  onTableOfContentsChange?: (snapshot: PdfTableOfContentsSnapshot) => void;
  onPreviousBoundary?: () => void;
  onNextBoundary?: () => void;
  preferFullDocumentLoad?: boolean;
  controlsCompact?: boolean;
  searchRequest?: PdfSearchRequest;
  onSearchResultsChange?: (results: PdfSearchResults) => void;
  onLookupWord?: (text: string) => void;
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
  textSelectionEnabled: boolean;
  renderScale: number;
  targetWidth: number;
  targetHeight: number;
  isBookmarked: boolean;
  isHighlighted: boolean;
  textHighlights: PdfTextHighlight[];
  annotations: PdfAnnotation[];
  selectedAnnotationId: string | null;
  annotationTool: PdfAnnotationTool;
  activeSpeechText?: string;
  activeSpeechItemRange?: PdfSpeechItemRange | null;
  activeSpeechWord?: string;
  activeSpeechWordOccurrence?: number;
  speechHighlightMode: 'paragraph' | 'word';
  speechReadingOrder: 'page' | 'source';
  pendingSelectionRects: PdfSpeechHighlightRect[];
  searchHighlightText?: string;
  searchActiveOccurrence?: number;
  searchCaseSensitive?: boolean;
  searchWholeWord?: boolean;
  currentHighlightColor: PdfHighlightColorId;
  onTextSelection: (selection: PdfPendingTextSelection) => void;
  onAddTextAnnotation: (page: number, x: number, y: number) => void;
  onAddInkAnnotation: (page: number, points: PdfInkAnnotation['points']) => void;
  onSelectAnnotation: (annotationId: string | null) => void;
  onMoveAnnotation: (annotationId: string, dx: number, dy: number) => void;
  onUpdateTextAnnotation: (annotationId: string, text: string) => void;
  onRemoveTextHighlight: (highlightId: string) => void;
  onRemoveAnnotation: (annotationId: string) => void;
}

const EMPTY_TEXT_HIGHLIGHTS: PdfTextHighlight[] = [];
const EMPTY_PDF_SELECTION_RECTS: PdfSpeechHighlightRect[] = [];

type PdfSpeechHighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfTextSpanMetrics = {
  element: HTMLElement;
  text: string;
  rect: PdfSpeechHighlightRect;
};

type PdfSpeechPlaybackSegment = PdfSpeechSegment & {
  pageNumber: number;
};

type PdfPendingTextSelection = Omit<PdfTextHighlight, 'id' | 'createdAt'> & {
  popover: {
    x: number;
    y: number;
  };
};

type PdfAnnotationTool = 'highlight' | 'select' | 'text' | 'pen' | 'erase';

type PdfAnnotationDragState = {
  annotationId: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
};

const mergeSpeechHighlightRects = (rects: PdfSpeechHighlightRect[]) => {
  const sortedRects = [...rects].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const merged: PdfSpeechHighlightRect[] = [];

  sortedRects.forEach((rect) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...rect });
      return;
    }

    const sameLine = Math.abs(previous.y - rect.y) < 0.7;
    const smallGap = rect.x - (previous.x + previous.width) < 1.4;

    if (sameLine && smallGap) {
      const right = Math.max(previous.x + previous.width, rect.x + rect.width);
      const bottom = Math.max(previous.y + previous.height, rect.y + rect.height);
      previous.x = Math.min(previous.x, rect.x);
      previous.y = Math.min(previous.y, rect.y);
      previous.width = right - previous.x;
      previous.height = bottom - previous.y;
    } else {
      merged.push({ ...rect });
    }
  });

  return merged;
};

const normalizePdfSelectionRects = (rects: PdfSpeechHighlightRect[]) => {
  const normalized = rects
    .filter((rect) => rect.width > 0.2 && rect.height > 0.2)
    .map((rect) => {
      const height = Math.max(0.65, rect.height * 0.96);
      const y = rect.y + (rect.height - height) / 2;
      return { ...rect, y, height };
    })
    .sort((a, b) => (Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < 0.35 ? a.x - b.x : a.y - b.y));

  const merged: PdfSpeechHighlightRect[] = [];
  normalized.forEach((rect) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...rect });
      return;
    }

    const previousCenter = previous.y + previous.height / 2;
    const rectCenter = rect.y + rect.height / 2;
    const sameLine = Math.abs(previousCenter - rectCenter) <= Math.max(previous.height, rect.height) * 0.62;
    const gap = rect.x - (previous.x + previous.width);
    if (sameLine && gap < 1.8) {
      const left = Math.min(previous.x, rect.x);
      const right = Math.max(previous.x + previous.width, rect.x + rect.width);
      const top = Math.min(previous.y, rect.y);
      const bottom = Math.max(previous.y + previous.height, rect.y + rect.height);
      previous.x = left;
      previous.y = top;
      previous.width = right - left;
      previous.height = bottom - top;
      return;
    }

    merged.push({ ...rect });
  });

  return merged.map((rect) => {
    const height = Math.max(0.65, rect.height * 1.08);
    return {
      ...rect,
      y: rect.y + (rect.height - height) / 2,
      height,
    };
  });
};

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

export interface PdfTableOfContentsItem {
  id: string;
  title: string;
  page: number;
  level: number;
}

export interface PdfTableOfContentsSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  items: PdfTableOfContentsItem[];
  pageCount: number;
}

type TurnBook = JQuery & {
  turn: (commandOrOptions?: unknown, value?: unknown, secondValue?: unknown) => unknown;
};

type GestureEventLike = Event & {
  scale?: number;
};

type PdfOutlineItem = {
  title?: string;
  dest?: string | unknown[] | null;
  items?: PdfOutlineItem[];
};

const isTurnBookReady = (book: TurnBook) => {
  try {
    return Boolean(book.turn('is'));
  } catch {
    return false;
  }
};

const normalizePageNumber = (page: unknown, pageCount: number, fallback = 1) => {
  const numericPage = typeof page === 'number' ? page : Number(page);
  if (!Number.isFinite(numericPage) || numericPage < 1) return fallback;
  if (!Number.isFinite(pageCount) || pageCount < 1) return Math.floor(numericPage);
  return Math.min(pageCount, Math.floor(numericPage));
};

const clampZoom = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Number(value.toFixed(3)));
};

const getHighlightOverlay = (color?: PdfHighlightColorId) => (
  PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === color)?.overlay || PDF_HIGHLIGHT_COLOR_PRESETS[0].overlay
);

const getPdfSpeechWords = (value: string): string[] => (
  normalizeSpeechMatchText(value).match(/[\p{L}\p{N}'-]+/gu) || []
);

const hasExactPdfSpeechWord = (text: string, word: string) => {
  const normalizedWord = normalizeSpeechMatchText(word);
  if (!normalizedWord) return false;
  return getPdfSpeechWords(text).includes(normalizedWord);
};

const sortPdfSpeechItemsByPageOrder = <T extends { x: number; y: number }>(items: T[]) => (
  [...items].sort((first, second) => {
    const rowDelta = first.y - second.y;
    if (Math.abs(rowDelta) > 0.75) return rowDelta;
    return first.x - second.x;
  })
);

const getPdfSpeechTextItems = (items: any[], readingOrder: 'page' | 'source') => {
  const mappedItems = items
    .map((item, sourceIndex) => {
      const text = ('str' in item ? item.str : '').replace(/\s+/g, ' ').trim();
      if (!text) return null;
      const transform = Array.isArray(item.transform) ? item.transform : [];
      return {
        sourceIndex,
        text,
        x: Number(transform[4]) || 0,
        y: -(Number(transform[5]) || 0),
      };
    })
    .filter((item): item is { sourceIndex: number; text: string; x: number; y: number } => Boolean(item));

  return readingOrder === 'page' ? sortPdfSpeechItemsByPageOrder(mappedItems).map((item) => item.text) : mappedItems.map((item) => item.text);
};

const rectsOverlap = (first: PdfSpeechHighlightRect, second: PdfSpeechHighlightRect) => (
  first.x < second.x + second.width
  && first.x + first.width > second.x
  && first.y < second.y + second.height
  && first.y + first.height > second.y
);

const getPdfSpeechWordOccurrence = (text: string, word: { value: string; start: number } | null) => (
  word ? getPdfSpeechWords(text.slice(0, word.start)).filter((value) => value === normalizeSpeechMatchText(word.value)).length : 0
);

const getAnnotationId = (page: number) => `${page}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clampPercent = (value: number, max = 100) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));

const getHighlightSwatch = (color?: PdfHighlightColorId) => (
  PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === color)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch
);

const hexToPdfRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return rgb(
    Number.isFinite(red) ? red / 255 : 0,
    Number.isFinite(green) ? green / 255 : 0,
    Number.isFinite(blue) ? blue / 255 : 0,
  );
};

const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const resolveOutlinePage = async (document: PDFDocumentProxy, dest: PdfOutlineItem['dest']) => {
  try {
    const explicitDestination = typeof dest === 'string'
      ? await document.getDestination(dest)
      : Array.isArray(dest)
        ? dest
        : null;
    const destinationRef = explicitDestination?.[0];

    if (typeof destinationRef === 'number') {
      return Math.min(document.numPages, Math.max(1, destinationRef + 1));
    }

    if (destinationRef && typeof destinationRef === 'object') {
      return await document.getPageIndex(destinationRef).then((pageIndex) => pageIndex + 1);
    }
  } catch {
    return null;
  }

  return null;
};

const readOutlineItems = async (document: PDFDocumentProxy) => {
  const outline = await document.getOutline() as PdfOutlineItem[] | null;
  if (!outline?.length) return [];

  const items: PdfTableOfContentsItem[] = [];
  let itemIndex = 0;

  const visit = async (entries: PdfOutlineItem[], level: number) => {
    for (const entry of entries) {
      const page = await resolveOutlinePage(document, entry.dest);
      const title = entry.title?.replace(/\s+/g, ' ').trim();

      if (title && page) {
        itemIndex += 1;
        items.push({
          id: `${level}-${itemIndex}-${page}`,
          title,
          page,
          level,
        });
      }

      if (entry.items?.length) {
        await visit(entry.items, level + 1);
      }
    }
  };

  await visit(outline, 0);
  return items;
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

const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({ document, pageNumber, shouldRender, shouldRenderTextLayer, textSelectionEnabled, renderScale, targetWidth, targetHeight, isBookmarked, isHighlighted, textHighlights, annotations, selectedAnnotationId, annotationTool, activeSpeechText = '', activeSpeechItemRange = null, activeSpeechWord = '', activeSpeechWordOccurrence = 0, speechHighlightMode, speechReadingOrder, pendingSelectionRects, searchHighlightText = '', searchActiveOccurrence = -1, searchCaseSensitive = false, searchWholeWord = false, currentHighlightColor, onTextSelection, onAddTextAnnotation, onAddInkAnnotation, onSelectAnnotation, onMoveAnnotation, onUpdateTextAnnotation, onRemoveTextHighlight, onRemoveAnnotation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const inkDraftRef = useRef<{ pointerId: number; points: PdfInkAnnotation['points'] } | null>(null);
  const annotationDragRef = useRef<PdfAnnotationDragState | null>(null);
  const eraserDragPointerRef = useRef<number | null>(null);
  const erasedItemIdsRef = useRef(new Set<string>());
  const focusedTextAnnotationRef = useRef<string | null>(null);
  const speechSpanMetricsRef = useRef<PdfTextSpanMetrics[]>([]);
  const speechHighlightedSpansRef = useRef<HTMLElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRenderedCanvas, setHasRenderedCanvas] = useState(false);
  const [speechHighlightRects, setSpeechHighlightRects] = useState<PdfSpeechHighlightRect[]>([]);
  const [searchHighlightRects, setSearchHighlightRects] = useState<Array<{ rect: PdfSpeechHighlightRect; active: boolean }>>([]);
  const [draftInkPoints, setDraftInkPoints] = useState<PdfInkAnnotation['points']>([]);
  const [eraserPoint, setEraserPoint] = useState<{ x: number; y: number } | null>(null);
  const [erasingAnnotationIds, setErasingAnnotationIds] = useState<Set<string>>(() => new Set());
  const [erasingHighlightIds, setErasingHighlightIds] = useState<Set<string>>(() => new Set());

  const cacheSpeechSpanMetrics = useCallback(() => {
    const textLayer = textLayerRef.current;
    const content = contentRef.current;
    if (!textLayer || !content) {
      speechSpanMetricsRef.current = [];
      return;
    }

    const contentRect = content.getBoundingClientRect();
    if (contentRect.width <= 0 || contentRect.height <= 0) {
      speechSpanMetricsRef.current = [];
      return;
    }

    const metrics = Array.from(textLayer.querySelectorAll<HTMLElement>('span'))
      .map((span) => {
        const text = normalizeSpeechMatchText(span.textContent || '');
        if (!text) return null;

        const rect = span.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;

        return {
          element: span,
          text,
          rect: {
            x: ((rect.left - contentRect.left) / contentRect.width) * 100,
            y: ((rect.top - contentRect.top) / contentRect.height) * 100,
            width: (rect.width / contentRect.width) * 100,
            height: (rect.height / contentRect.height) * 100,
          },
        };
      })
      .filter((item): item is PdfTextSpanMetrics => Boolean(item));

    speechSpanMetricsRef.current = speechReadingOrder === 'page'
      ? sortPdfSpeechItemsByPageOrder(metrics.map((metric, sourceIndex) => ({ ...metric, sourceIndex, x: metric.rect.x, y: metric.rect.y })))
      : metrics;
  }, [speechReadingOrder]);

  const clearSpeechHighlight = useCallback(() => {
    speechHighlightedSpansRef.current.forEach((span) => span.classList.remove('bit-pdf-speech-highlight', 'bit-pdf-speech-word-highlight'));
    speechHighlightedSpansRef.current = [];
    setSpeechHighlightRects([]);
  }, []);

  const applySpeechHighlight = useCallback(() => {
    speechHighlightedSpansRef.current.forEach((span) => span.classList.remove('bit-pdf-speech-highlight', 'bit-pdf-speech-word-highlight'));
    speechHighlightedSpansRef.current = [];

    const normalizedActiveText = normalizeSpeechMatchText(activeSpeechText);
    const normalizedActiveWord = normalizeSpeechMatchText(activeSpeechWord);
    if (
      !shouldRenderTextLayer
      || (speechHighlightMode === 'paragraph' && !normalizedActiveText && !activeSpeechItemRange)
      || (speechHighlightMode === 'word' && !normalizedActiveWord)
    ) {
      setSpeechHighlightRects([]);
      return;
    }

    const nextRects: PdfSpeechHighlightRect[] = [];
    const nextHighlightedSpans: HTMLElement[] = [];
    const spanMetrics = speechSpanMetricsRef.current;

    let matchedWordOccurrence = 0;
    spanMetrics.forEach(({ element, text, rect }, spanIndex) => {
      const isInItemRange = Boolean(activeSpeechItemRange && spanIndex >= activeSpeechItemRange.start && spanIndex <= activeSpeechItemRange.end);
      const isFallbackMatch = !activeSpeechItemRange && text.length > 2 && normalizedActiveText.includes(text);
      const isActiveParagraphSpan = isInItemRange || isFallbackMatch;
      const isActiveWordSpan = Boolean(isActiveParagraphSpan && normalizedActiveWord && hasExactPdfSpeechWord(text, normalizedActiveWord));
      const isCurrentWordOccurrence = isActiveWordSpan && matchedWordOccurrence++ === activeSpeechWordOccurrence;
      if ((speechHighlightMode === 'paragraph' && isActiveParagraphSpan) || (speechHighlightMode === 'word' && isActiveParagraphSpan && isCurrentWordOccurrence)) {
        element.classList.add('bit-pdf-speech-highlight');
        nextHighlightedSpans.push(element);
        nextRects.push(rect);
      }
    });

    speechHighlightedSpansRef.current = nextHighlightedSpans;
    setSpeechHighlightRects(mergeSpeechHighlightRects(nextRects));
  }, [activeSpeechItemRange, activeSpeechText, activeSpeechWord, activeSpeechWordOccurrence, shouldRenderTextLayer, speechHighlightMode]);

  const computeSearchHighlight = useCallback(() => {
    if (!searchHighlightText || !shouldRenderTextLayer) {
      setSearchHighlightRects([]);
      return;
    }

    const textLayer = textLayerRef.current;
    const content = contentRef.current;
    if (!textLayer || !content) {
      setSearchHighlightRects([]);
      return;
    }

    const contentRect = content.getBoundingClientRect();
    if (contentRect.width <= 0 || contentRect.height <= 0) {
      setSearchHighlightRects([]);
      return;
    }

    const nodes = collectTextNodes(textLayer);
    const { normalizedText, points } = buildNormalizedPoints(nodes);
    const normalizedQuery = normalizeSpeechMatchText(searchHighlightText);
    const ranges = findReaderSearchRanges(normalizedText, normalizedQuery, searchCaseSensitive, searchWholeWord);
    const rects: Array<{ rect: PdfSpeechHighlightRect; active: boolean }> = [];

    ranges.forEach((range, rangeIndex) => {
      const pointRuns: Array<{ node: Text; start: number; end: number }> = [];
      for (let index = range.start; index < range.end; index += 1) {
        const point = points[index];
        if (!point) continue;
        const lastRun = pointRuns[pointRuns.length - 1];
        if (lastRun && lastRun.node === point.node) {
          lastRun.end = point.offset;
        } else {
          pointRuns.push({ node: point.node, start: point.offset, end: point.offset });
        }
      }

      pointRuns.forEach((run) => {
        const domRange = textLayer.ownerDocument.createRange();
        domRange.setStart(run.node, run.start);
        domRange.setEnd(run.node, run.end + 1);
        const rect = domRange.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        rects.push({
          rect: {
            x: ((rect.left - contentRect.left) / contentRect.width) * 100,
            y: ((rect.top - contentRect.top) / contentRect.height) * 100,
            width: (rect.width / contentRect.width) * 100,
            height: (rect.height / contentRect.height) * 100,
          },
          active: rangeIndex === searchActiveOccurrence,
        });
      });
    });

    setSearchHighlightRects(rects);
  }, [searchActiveOccurrence, searchCaseSensitive, searchHighlightText, searchWholeWord, shouldRenderTextLayer]);

  useEffect(() => {
    computeSearchHighlight();
  }, [computeSearchHighlight]);

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
      speechSpanMetricsRef.current = [];
      clearSpeechHighlight();
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
        cacheSpeechSpanMetrics();
        applySpeechHighlight();
        computeSearchHighlight();
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
  }, [applySpeechHighlight, cacheSpeechSpanMetrics, clearSpeechHighlight, computeSearchHighlight, document, pageNumber, shouldRender, shouldRenderTextLayer, targetHeight, targetWidth]);

  useEffect(() => {
    applySpeechHighlight();
  }, [applySpeechHighlight]);

  useEffect(() => {
    if (annotationTool !== 'erase') setEraserPoint(null);
  }, [annotationTool]);

  const handleTextPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!textSelectionEnabled) return;
    if (!event.isPrimary) return;
    selectionStartRef.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType !== 'touch') {
      clearTextLayerSelection();
    }
  };

  const captureTextLayerSelection = () => {
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
    const rects = normalizePdfSelectionRects(Array.from(selection.getRangeAt(0).getClientRects())
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
      .filter((rect) => rect.width > 0.2 && rect.height > 0.2));

    if (!rects.length) {
      clearTextLayerSelection();
      return;
    }
    const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    onTextSelection({
      page: pageNumber,
      text: selectedText,
      rects,
      popover: {
        x: Math.max(12, Math.min(window.innerWidth - 220, selectionRect.left + selectionRect.width / 2 - 110)),
        y: Math.max(12, selectionRect.top - 52),
      },
    });
    clearTextLayerSelection();
  };

  const handleTextPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!textSelectionEnabled) return;
    const start = selectionStartRef.current;
    selectionStartRef.current = null;

    const isTouch = event.pointerType === 'touch';

    if (!isTouch && start) {
      const dragDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (dragDistance < 4) {
        // A stationary click only counts as a selection when the browser has already
        // established one, e.g. a double-click word selection. Otherwise clear it.
        const selection = window.getSelection();
        const textLayer = textLayerRef.current;
        const hasWordSelection = Boolean(
          selection
          && !selection.isCollapsed
          && textLayer
          && selection.rangeCount > 0
          && textLayer.contains(selection.anchorNode)
          && textLayer.contains(selection.focusNode)
        );
        if (!hasWordSelection) {
          clearTextLayerSelection();
          return;
        }
      }
    }

    captureTextLayerSelection();
  };

  const handleTextDoubleClick = () => {
    if (!textSelectionEnabled) return;
    captureTextLayerSelection();
  };

  const getAnnotationPoint = (event: React.PointerEvent<HTMLElement>) => {
    const content = contentRef.current;
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleAnnotationLayerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (annotationTool === 'select') {
      onSelectAnnotation(null);
      return;
    }

    const point = getAnnotationPoint(event);
    if (!point) return;

    if (annotationTool === 'erase' && event.isPrimary) {
      event.preventDefault();
      eraserDragPointerRef.current = event.pointerId;
      setEraserPoint(point);
      return;
    }

    if (annotationTool === 'text') {
      event.preventDefault();
      onAddTextAnnotation(pageNumber, point.x, point.y);
      return;
    }

    if (annotationTool === 'pen' && event.isPrimary) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      inkDraftRef.current = { pointerId: event.pointerId, points: [point] };
      setDraftInkPoints([point]);
    }
  };

  const handleAnnotationLayerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (annotationTool === 'erase') {
      setEraserPoint(getAnnotationPoint(event));
    }

    const draft = inkDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = getAnnotationPoint(event);
    if (!point) return;
    const previous = draft.points[draft.points.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.15) return;
    draft.points = [...draft.points, point];
    setDraftInkPoints(draft.points);
  };

  const finishInk = (event: React.PointerEvent<HTMLDivElement>) => {
    if (eraserDragPointerRef.current === event.pointerId) {
      eraserDragPointerRef.current = null;
    }

    const draft = inkDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    inkDraftRef.current = null;
    setDraftInkPoints([]);
    if (draft.points.length > 1) onAddInkAnnotation(pageNumber, draft.points);
  };

  const eraseAnnotation = (annotationId: string) => {
    if (erasedItemIdsRef.current.has(`annotation:${annotationId}`)) return;
    erasedItemIdsRef.current.add(`annotation:${annotationId}`);
    setErasingAnnotationIds((current) => new Set(current).add(annotationId));
    window.setTimeout(() => {
      onRemoveAnnotation(annotationId);
      setErasingAnnotationIds((current) => {
        const next = new Set(current);
        next.delete(annotationId);
        return next;
      });
      erasedItemIdsRef.current.delete(`annotation:${annotationId}`);
    }, 170);
  };

  const handleAnnotationPointerDown = (event: React.PointerEvent<HTMLElement>, annotation: PdfAnnotation) => {
    event.stopPropagation();

    if (annotationTool === 'erase') {
      event.preventDefault();
      eraseAnnotation(annotation.id);
      return;
    }

    onSelectAnnotation(annotation.id);

    if (annotationTool === 'select') {
      if (annotation.type === 'ink') event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      annotationDragRef.current = {
        annotationId: annotation.id,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
      };
    }
  };

  const eraseTextHighlight = (event: React.PointerEvent<HTMLElement>, highlightId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (erasedItemIdsRef.current.has(`highlight:${highlightId}`)) return;
    erasedItemIdsRef.current.add(`highlight:${highlightId}`);
    setErasingHighlightIds((current) => new Set(current).add(highlightId));
    window.setTimeout(() => {
      onRemoveTextHighlight(highlightId);
      setErasingHighlightIds((current) => {
        const next = new Set(current);
        next.delete(highlightId);
        return next;
      });
      erasedItemIdsRef.current.delete(`highlight:${highlightId}`);
    }, 170);
  };

  const eraseAnnotationWhileDragging = (event: React.PointerEvent<HTMLElement>, annotationId: string) => {
    if (annotationTool !== 'erase') return;
    if (eraserDragPointerRef.current !== null || event.buttons === 1) {
      event.preventDefault();
      event.stopPropagation();
      eraseAnnotation(annotationId);
    }
  };

  const eraseHighlightWhileDragging = (event: React.PointerEvent<HTMLElement>, highlightId: string) => {
    if (annotationTool !== 'erase') return;
    if (eraserDragPointerRef.current !== null || event.buttons === 1) {
      eraseTextHighlight(event, highlightId);
    }
  };

  const handleAnnotationPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = annotationDragRef.current;
    const content = contentRef.current;
    if (!drag || !content) return;
    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((event.clientX - drag.lastX) / rect.width) * 100;
    const dy = ((event.clientY - drag.lastY) / rect.height) * 100;
    annotationDragRef.current = {
      ...drag,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    onMoveAnnotation(drag.annotationId, dx, dy);
  };

  const finishAnnotationDrag = () => {
    annotationDragRef.current = null;
  };

  const renderInkPath = (points: PdfInkAnnotation['points']) => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

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
              style={{
                '--bit-pdf-selection-color': getHighlightOverlay(currentHighlightColor),
                pointerEvents: textSelectionEnabled ? undefined : 'none',
                touchAction: textSelectionEnabled ? 'auto' : undefined,
                userSelect: textSelectionEnabled ? 'text' : undefined,
                WebkitUserSelect: textSelectionEnabled ? 'text' : undefined,
              } as React.CSSProperties}
              onPointerDown={handleTextPointerDown}
              onPointerUp={handleTextPointerUp}
              onDoubleClick={handleTextDoubleClick}
              onPointerCancel={() => {
                selectionStartRef.current = null;
                clearTextLayerSelection();
              }}
            />
            {pendingSelectionRects.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden="true">
                {pendingSelectionRects.map((rect, index) => (
                  <span
                    key={`pending-selection-${pageNumber}-${index}`}
                    className="absolute rounded-[3px] mix-blend-multiply ring-1 ring-black/5"
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${rect.height}%`,
                      background: getHighlightOverlay(currentHighlightColor),
                      boxShadow: `0 0 0 2px ${getHighlightOverlay(currentHighlightColor)}`,
                    }}
                  />
                ))}
              </div>
            )}
            {textHighlights.map((highlight) => (
              <div key={highlight.id} className="pointer-events-none absolute inset-0 z-[3]">
                {highlight.rects.map((rect, index) => (
                  <span
                    key={`${highlight.id}-${index}`}
                    className={`absolute rounded-[3px] mix-blend-multiply transition-all duration-150 ${erasingHighlightIds.has(highlight.id) ? 'scale-95 opacity-0 blur-[1px]' : ''}`}
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
            {speechHighlightRects.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[4]">
                {speechHighlightRects.map((rect, index) => (
                  <span
                    key={`${pageNumber}-speech-${index}`}
                    className="absolute rounded-[3px] bg-bit-accent/25 ring-1 ring-bit-accent/30"
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${Math.max(rect.height, 1.2)}%`,
                    }}
                  />
                ))}
              </div>
            )}
            {searchHighlightRects.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[4]">
                {searchHighlightRects.map(({ rect, active }, index) => (
                  <span
                    key={`${pageNumber}-search-${index}`}
                    className={`absolute rounded-[3px] ${active ? 'bg-[rgba(var(--bit-accent-rgb),0.52)] ring-2 ring-bit-accent' : 'bg-[rgba(var(--bit-accent-rgb),0.22)] ring-1 ring-bit-accent/50'}`}
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${Math.max(rect.height, 1.2)}%`,
                    }}
                  />
                ))}
              </div>
            )}
            <div
              className="absolute inset-0 z-[6]"
              style={{
                pointerEvents: annotationTool === 'highlight' ? 'none' : 'auto',
                touchAction: annotationTool === 'pen' ? 'none' : 'manipulation',
              }}
              onPointerDown={handleAnnotationLayerPointerDown}
              onPointerMove={handleAnnotationLayerPointerMove}
              onPointerUp={finishInk}
              onPointerCancel={finishInk}
              onPointerLeave={() => setEraserPoint(null)}
              aria-label="PDF annotations"
            >
              {annotationTool === 'erase' && eraserPoint && (
                <div
                  className="pointer-events-none absolute z-[12] h-8 w-14 -translate-x-[88%] -translate-y-1/2 -rotate-12 drop-shadow-[0_8px_16px_rgba(127,29,29,0.35)]"
                  style={{ left: `${eraserPoint.x}%`, top: `${eraserPoint.y}%` }}
                  aria-hidden="true"
                >
                  <div className="relative flex h-full w-full overflow-hidden rounded-[8px] border border-red-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-6px_10px_rgba(127,29,29,0.1)]">
                    <div className="flex h-full w-[68%] items-center justify-center bg-gradient-to-br from-red-300 via-red-400 to-red-500 text-white">
                      <Eraser size={14} />
                    </div>
                    <div className="h-full flex-1 border-l border-red-200/80 bg-gradient-to-br from-white via-rose-50 to-zinc-100" />
                    <div className="absolute inset-x-1 top-1 h-px bg-white/70" />
                  </div>
                  <span className="absolute right-0 top-1/2 h-3 w-1 -translate-y-1/2 rounded-r-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                  <span className="absolute -bottom-1 left-3 h-1 w-6 rounded-full bg-red-300/40 blur-[1px]" />
                </div>
              )}
              {annotationTool === 'erase' && textHighlights.map((highlight) => (
                <div key={`${highlight.id}-erase-hit`} className="absolute inset-0 z-[7]">
                  {highlight.rects.map((rect, index) => (
                    <button
                      key={`${highlight.id}-erase-hit-${index}`}
                      type="button"
                      onPointerDown={(event) => eraseTextHighlight(event, highlight.id)}
                      onPointerEnter={(event) => eraseHighlightWhileDragging(event, highlight.id)}
                      onPointerMove={(event) => eraseHighlightWhileDragging(event, highlight.id)}
                      className={`absolute cursor-none rounded-[4px] border border-transparent transition-all duration-150 hover:border-red-300 hover:bg-red-500/20 hover:shadow-[0_0_18px_rgba(248,113,113,0.3)] ${erasingHighlightIds.has(highlight.id) ? 'scale-95 border-red-300 bg-red-500/25 opacity-0' : ''}`}
                      style={{
                        left: `${rect.x}%`,
                        top: `${rect.y}%`,
                        width: `${rect.width}%`,
                        height: `${rect.height}%`,
                      }}
                      aria-label="Erase text highlight"
                    />
                  ))}
                </div>
              ))}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {annotations.filter((annotation): annotation is PdfInkAnnotation => annotation.type === 'ink').map((annotation) => (
                  <path
                    key={annotation.id}
                    d={renderInkPath(annotation.points)}
                    fill="none"
                    stroke={PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === annotation.color)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch}
                    strokeWidth={annotation.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className={`transition-all duration-150 ${selectedAnnotationId === annotation.id ? 'drop-shadow-[0_0_4px_rgba(0,0,0,0.35)]' : ''} ${erasingAnnotationIds.has(annotation.id) ? 'opacity-0 blur-[2px]' : ''}`}
                  />
                ))}
                {draftInkPoints.length > 1 && (
                  <path
                    d={renderInkPath(draftInkPoints)}
                    fill="none"
                    stroke={PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === currentHighlightColor)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {annotations.filter((annotation): annotation is PdfInkAnnotation => annotation.type === 'ink').map((annotation) => {
                const minX = Math.min(...annotation.points.map((point) => point.x));
                const maxX = Math.max(...annotation.points.map((point) => point.x));
                const minY = Math.min(...annotation.points.map((point) => point.y));
                const maxY = Math.max(...annotation.points.map((point) => point.y));
                return (
                  <button
                    key={`${annotation.id}-hit`}
                    type="button"
                    onPointerDown={(event) => handleAnnotationPointerDown(event, annotation)}
                    onPointerEnter={(event) => eraseAnnotationWhileDragging(event, annotation.id)}
                    onPointerMove={(event) => {
                      eraseAnnotationWhileDragging(event, annotation.id);
                      handleAnnotationPointerMove(event);
                    }}
                    onPointerUp={finishAnnotationDrag}
                    onPointerCancel={finishAnnotationDrag}
                    className={`absolute rounded-md border transition-all duration-150 ${selectedAnnotationId === annotation.id ? 'border-bit-accent bg-bit-accent/10' : 'border-transparent'} ${annotationTool === 'erase' ? 'cursor-none hover:border-red-300 hover:bg-red-500/20 hover:shadow-[0_0_18px_rgba(248,113,113,0.28)]' : 'cursor-move'} ${erasingAnnotationIds.has(annotation.id) ? 'scale-95 border-red-300 bg-red-500/25 opacity-0' : ''}`}
                    style={{
                      left: `${Math.max(0, minX - 2)}%`,
                      top: `${Math.max(0, minY - 2)}%`,
                      width: `${Math.min(100 - Math.max(0, minX - 2), Math.max(3, maxX - minX + 4))}%`,
                      height: `${Math.min(100 - Math.max(0, minY - 2), Math.max(3, maxY - minY + 4))}%`,
                    }}
                    aria-label="Select ink annotation"
                  />
                );
              })}
              {annotations.filter((annotation): annotation is PdfTextAnnotation => annotation.type === 'text').map((annotation) => (
                <textarea
                  key={annotation.id}
                  ref={(node) => {
                    if (
                      node &&
                      selectedAnnotationId === annotation.id &&
                      focusedTextAnnotationRef.current !== annotation.id &&
                      annotation.text.length === 0
                    ) {
                      focusedTextAnnotationRef.current = annotation.id;
                      window.setTimeout(() => {
                        node.focus();
                        node.select();
                      }, 0);
                    }
                  }}
                  value={annotation.text}
                  placeholder="Type note"
                  onPointerDown={(event) => handleAnnotationPointerDown(event, annotation)}
                  onPointerEnter={(event) => eraseAnnotationWhileDragging(event, annotation.id)}
                  onPointerMove={(event) => {
                    eraseAnnotationWhileDragging(event, annotation.id);
                    handleAnnotationPointerMove(event);
                  }}
                  onPointerUp={finishAnnotationDrag}
                  onPointerCancel={finishAnnotationDrag}
                  onChange={(event) => onUpdateTextAnnotation(annotation.id, event.currentTarget.value)}
                  onFocus={() => onSelectAnnotation(annotation.id)}
                  readOnly={annotationTool === 'erase'}
                  className={`absolute resize-none rounded-md border bg-white/85 px-2 py-1 leading-snug text-zinc-950 shadow-sm outline-none backdrop-blur-sm transition-all duration-150 placeholder:text-zinc-500/70 ${selectedAnnotationId === annotation.id ? 'border-bit-accent ring-2 ring-bit-accent/25' : 'border-zinc-900/15 hover:border-bit-accent/40'} ${annotationTool === 'erase' ? 'cursor-none hover:border-red-300 hover:bg-red-50 hover:shadow-[0_0_18px_rgba(248,113,113,0.35)]' : ''} ${annotationTool === 'select' ? 'cursor-move' : ''} ${erasingAnnotationIds.has(annotation.id) ? 'scale-95 border-red-300 bg-red-50 opacity-0 blur-[1px]' : ''}`}
                  style={{
                    left: `${annotation.x}%`,
                    top: `${annotation.y}%`,
                    width: `${annotation.width}%`,
                    height: `${annotation.height}%`,
                    color: PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === annotation.color)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch,
                    fontSize: `${annotation.fontSize}px`,
                  }}
                  aria-label="PDF text annotation"
                />
              ))}
            </div>
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
  speechHighlightMode = 'word',
  speechReadingOrder = 'page',
  studyPanelOpen: controlledStudyPanelOpen,
  tableOfContentsRequestId = 0,
  studyAction,
  onStudyPanelOpenChange,
  onHighlightColorChange,
  onStudySnapshotChange,
  onTableOfContentsChange,
  onPreviousBoundary,
  onNextBoundary,
  preferFullDocumentLoad = false,
  controlsCompact = false,
  searchRequest,
  onSearchResultsChange,
  onLookupWord,
}) => {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(() => readPdfStudyState(pdfUrl).lastPage || 1);
  const [dimensions, setDimensions] = useState<FlipDimensions>(() => (
    typeof window === 'undefined'
      ? { width: 840, height: 594, display: 'double' }
      : getDimensions(window.innerWidth, Math.max(420, window.innerHeight - 120))
  ));
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });
  const [showDetailedProgress, setShowDetailedProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoadAttempt, setPdfLoadAttempt] = useState(0);
  const [pdfSearchMatches, setPdfSearchMatches] = useState<PdfSearchResultEntry[]>([]);
  const [pdfSearchLoading, setPdfSearchLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState(() => getDefaultZoom());
  const [turnFallbackMode, setTurnFallbackMode] = useState(false);
  const [isPageSliderActive, setIsPageSliderActive] = useState(false);
  const [pdfSpeechStatus, setPdfSpeechStatus] = useState<PdfSpeechStatus>('idle');
  const [pdfSpeechVoices, setPdfSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedPdfSpeechVoiceURI, setSelectedPdfSpeechVoiceURI] = useState('');
  const [pdfSpeechRate, setPdfSpeechRate] = useState(1);
  const [pdfSpeechPillPosition, setPdfSpeechPillPosition] = useState<{ x: number; y: number } | null>(null);
  const [pdfSpeechSegments, setPdfSpeechSegments] = useState<PdfSpeechPlaybackSegment[]>([]);
  const [activePdfSpeechSegmentIndex, setActivePdfSpeechSegmentIndex] = useState<number | null>(null);
  const [activePdfSpeechWord, setActivePdfSpeechWord] = useState('');
  const [activePdfSpeechWordOccurrence, setActivePdfSpeechWordOccurrence] = useState(0);
  const [pdfSpeechAdvancePending, setPdfSpeechAdvancePending] = useState(false);
  const [pendingTextSelection, setPendingTextSelection] = useState<PdfPendingTextSelection | null>(null);
  const [selectionColorMenuOpen, setSelectionColorMenuOpen] = useState(false);
  const [internalStudyPanelOpen, setInternalStudyPanelOpen] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<PdfAnnotationTool>('highlight');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [exportingAnnotatedPdf, setExportingAnnotatedPdf] = useState(false);
  const [internalBackgroundPreset] = useState<PdfBackgroundPresetId>(() => readPdfBackgroundPreset());
  const [internalHighlightColor, setInternalHighlightColor] = useState<PdfHighlightColorId>(() => readPdfHighlightColor());
  const [studyState, setStudyState] = useState<PdfStudyState>(() => readPdfStudyState(pdfUrl));
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
  const loadedTableOfContentsRequestRef = useRef<string | null>(null);
  const pdfSpeechStoppedRef = useRef(false);
  const pdfSpeechRestartingRef = useRef(false);
  const pdfSpeechPausedRef = useRef(false);
  const pdfSpeechIgnoreCancelEventsUntilRef = useRef(0);
  const pdfSpeechRateRef = useRef(pdfSpeechRate);
  const pdfSpeechRateRestartTimerRef = useRef<number | null>(null);
  const pdfSpeechPillDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const speakPdfSpeechSegmentRef = useRef<((segments: PdfSpeechPlaybackSegment[], index: number) => void) | null>(null);
  const readCurrentPdfPageRef = useRef<(() => Promise<void>) | null>(null);
  const selectedTextSpeechActiveRef = useRef(false);
  const selectedPdfSpeechTextRef = useRef('');
  const pdfSpeechSegmentsRef = useRef<PdfSpeechPlaybackSegment[]>([]);
  const activePdfSpeechSegmentIndexRef = useRef<number | null>(null);
  const pdfSpeechSegmentsCacheRef = useRef(new Map<number, PdfSpeechSegment[]>());
  const pdfSpeechAutoAdvanceRef = useRef(false);
  const pdfSpeechAdvanceInProgressRef = useRef(false);
  const pageCountRef = useRef(1);
  const proxiedPdfUrl = useMemo(() => getPdfProxyUrl(pdfUrl), [pdfUrl]);
  const pageCount = document?.numPages || 0;
  const effectiveDimensions = useMemo<FlipDimensions>(() => (
    turnFallbackMode && dimensions.display === 'double'
      ? {
        width: Math.max(260, Math.min(430, Math.round(dimensions.width / 2))),
        height: dimensions.height,
        display: 'single',
      }
      : dimensions
  ), [dimensions, turnFallbackMode]);
  const readerDisplay = effectiveDimensions.display;
  const sortedBookmarks = useMemo(() => [...studyState.bookmarks].sort((a, b) => a - b), [studyState.bookmarks]);
  const studyPanelOpen = controlledStudyPanelOpen ?? internalStudyPanelOpen;
  const pdfTextSelectionEnabled = annotationTool === 'highlight';
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
  const annotationsByPage = useMemo(() => {
    const pages = new Map<number, PdfAnnotation[]>();
    studyState.annotations.forEach((annotation) => {
      const pageAnnotations = pages.get(annotation.page);
      if (pageAnnotations) {
        pageAnnotations.push(annotation);
      } else {
        pages.set(annotation.page, [annotation]);
      }
    });
    return pages;
  }, [studyState.annotations]);
  const currentPageAnnotations = annotationsByPage.get(currentPage) ?? [];
  const selectedAnnotation = useMemo(() => (
    selectedAnnotationId
      ? (studyState.annotations || []).find((annotation) => annotation.id === selectedAnnotationId) || null
      : null
  ), [selectedAnnotationId, studyState.annotations]);
  const sortedTextHighlights = useMemo(() => [...studyState.textHighlights].sort((a, b) => b.createdAt - a.createdAt), [studyState.textHighlights]);
  const selectedPdfSpeechVoice = useMemo(
    () => pdfSpeechVoices.find((voice) => voice.voiceURI === selectedPdfSpeechVoiceURI) || null,
    [pdfSpeechVoices, selectedPdfSpeechVoiceURI]
  );
  const activePdfSpeechSegment = activePdfSpeechSegmentIndex === null ? null : pdfSpeechSegments[activePdfSpeechSegmentIndex] || null;
  const activePdfSpeechText = activePdfSpeechSegment?.text || '';
  const activePdfSpeechItemRange = activePdfSpeechSegment
    ? { start: activePdfSpeechSegment.itemStart, end: activePdfSpeechSegment.itemEnd }
    : null;
  const activePdfSpeechPage = activePdfSpeechSegment?.pageNumber ?? currentPage;
  const getPendingSelectionRectsForPage = useCallback((pageNumber: number) => (
    pendingTextSelection?.page === pageNumber ? pendingTextSelection.rects : EMPTY_PDF_SELECTION_RECTS
  ), [pendingTextSelection]);
  const pendingSelectionHighlightIds = useMemo(() => {
    if (!pendingTextSelection) return [];
    return studyState.textHighlights
      .filter((highlight) => (
        highlight.page === pendingTextSelection.page
        && highlight.rects.some((savedRect) => pendingTextSelection.rects.some((selectionRect) => rectsOverlap(savedRect, selectionRect)))
      ))
      .map((highlight) => highlight.id);
  }, [pendingTextSelection, studyState.textHighlights]);

  const clearPendingPdfSelection = useCallback((stopSelectedSpeech = false) => {
    setPendingTextSelection(null);
    setSelectionColorMenuOpen(false);
    if (
      stopSelectedSpeech
      && selectedTextSpeechActiveRef.current
      && typeof window !== 'undefined'
      && 'speechSynthesis' in window
    ) {
      selectedTextSpeechActiveRef.current = false;
      pdfSpeechStoppedRef.current = true;
      window.speechSynthesis.cancel();
      setPdfSpeechStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setPdfSpeechVoices(voices);
      setSelectedPdfSpeechVoiceURI((current) => current || getPreferredSpeechVoiceURI(voices));
    };

    loadVoices();
    const retryHandle = window.setTimeout(loadVoices, 250);
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.clearTimeout(retryHandle);
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    if (!pendingTextSelection) return;
    setSelectionColorMenuOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPendingPdfSelection(true);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest('[data-pdf-selection-popover]')
        || target?.closest('[data-pdf-speech-pill]')
        || target?.closest('.bit-pdf-text-layer')
      ) {
        return;
      }
      clearPendingPdfSelection(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [clearPendingPdfSelection, pendingTextSelection]);

  const stopPdfSpeech = useCallback(() => {
    pdfSpeechAutoAdvanceRef.current = false;
    pdfSpeechAdvanceInProgressRef.current = false;
    pdfSpeechStoppedRef.current = true;
    pdfSpeechPausedRef.current = false;
    selectedTextSpeechActiveRef.current = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPdfSpeechStatus('idle');
    setActivePdfSpeechSegmentIndex(null);
    setActivePdfSpeechWord('');
    setActivePdfSpeechWordOccurrence(0);
    setPdfSpeechSegments([]);
    pdfSpeechSegmentsRef.current = [];
    activePdfSpeechSegmentIndexRef.current = null;
    setPdfSpeechAdvancePending(false);
  }, []);

  const speakPdfSpeechSegment = useCallback((segments: PdfSpeechPlaybackSegment[], index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (index >= segments.length) {
      const lastSpokenPage = segments[segments.length - 1]?.pageNumber ?? currentPageRef.current;
      if (pdfSpeechAutoAdvanceRef.current && lastSpokenPage < pageCountRef.current) {
        setPdfSpeechAdvancePending(true);
        return;
      }
      if (selectedTextSpeechActiveRef.current) {
        setPdfSpeechStatus('paused');
        setActivePdfSpeechWord('');
        setActivePdfSpeechWordOccurrence(0);
        return;
      }
      stopPdfSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(segments[index].text);
    if (selectedPdfSpeechVoice) utterance.voice = selectedPdfSpeechVoice;
    utterance.rate = pdfSpeechRateRef.current;
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return;
      const word = getSpeechWordAtBoundary(segments[index].text, event.charIndex);
      setActivePdfSpeechWord(word?.value || '');
      setActivePdfSpeechWordOccurrence(getPdfSpeechWordOccurrence(segments[index].text, word));
    };
    utterance.onend = () => {
      if (pdfSpeechStoppedRef.current || pdfSpeechPausedRef.current || pdfSpeechRestartingRef.current || Date.now() < pdfSpeechIgnoreCancelEventsUntilRef.current) return;
      setActivePdfSpeechWord('');
      setActivePdfSpeechWordOccurrence(0);
      speakPdfSpeechSegmentRef.current?.(segments, index + 1);
    };
    utterance.onerror = () => {
      if (pdfSpeechPausedRef.current || pdfSpeechRestartingRef.current || Date.now() < pdfSpeechIgnoreCancelEventsUntilRef.current) return;
      stopPdfSpeech();
    };
    activePdfSpeechSegmentIndexRef.current = index;
    setActivePdfSpeechSegmentIndex(index);
    setActivePdfSpeechWord('');
    setActivePdfSpeechWordOccurrence(0);
    setPdfSpeechStatus('playing');
    speakUtterance(utterance);
  }, [selectedPdfSpeechVoice, stopPdfSpeech]);
  speakPdfSpeechSegmentRef.current = speakPdfSpeechSegment;

  const readCurrentPdfPage = useCallback(async () => {
    if (!document || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (pdfSpeechStatus === 'paused') {
      pdfSpeechPausedRef.current = false;
      window.speechSynthesis.resume();
      setPdfSpeechStatus('playing');
      return;
    }

    try {
      selectedTextSpeechActiveRef.current = false;
      pdfSpeechStoppedRef.current = false;
      pdfSpeechAutoAdvanceRef.current = true;
      window.speechSynthesis.cancel();
      setPdfSpeechStatus('loading');

      const pageNumbers = readerDisplay === 'double'
        ? [currentPage, currentPage + 1].filter((pageNumber) => pageNumber <= pageCount)
        : [currentPage];

      const playbackSegments: PdfSpeechPlaybackSegment[] = [];

      for (const pageNumber of pageNumbers) {
        let pageSegments = pdfSpeechSegmentsCacheRef.current.get(pageNumber);

        if (!pageSegments) {
          const page = await document.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const itemTexts = getPdfSpeechTextItems(textContent.items, speechReadingOrder);
          pageSegments = getPdfSpeechSegments(itemTexts);
          pdfSpeechSegmentsCacheRef.current.set(pageNumber, pageSegments);
        }

        playbackSegments.push(...pageSegments.map((segment) => ({ ...segment, pageNumber })));
      }

      if (playbackSegments.length === 0) {
        setPdfSpeechStatus('idle');
        return;
      }

      setPdfSpeechSegments(playbackSegments);
      pdfSpeechSegmentsRef.current = playbackSegments;
      speakPdfSpeechSegment(playbackSegments, 0);
    } catch {
      setPdfSpeechStatus('idle');
    }
  }, [currentPage, document, pageCount, pdfSpeechStatus, readerDisplay, speakPdfSpeechSegment, speechReadingOrder]);
  readCurrentPdfPageRef.current = readCurrentPdfPage;

  const pausePdfSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    pdfSpeechPausedRef.current = true;
    window.speechSynthesis.pause();
    setPdfSpeechStatus('paused');
  }, []);

  const restartCurrentPdfSpeechSegment = useCallback(() => {
    if (pdfSpeechStatus !== 'playing' || activePdfSpeechSegmentIndexRef.current === null) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    pdfSpeechRestartingRef.current = true;
    pdfSpeechIgnoreCancelEventsUntilRef.current = Date.now() + 500;
    window.speechSynthesis.cancel();
    window.setTimeout(() => {
      pdfSpeechRestartingRef.current = false;
      pdfSpeechStoppedRef.current = false;
      speakPdfSpeechSegmentRef.current?.(pdfSpeechSegmentsRef.current, activePdfSpeechSegmentIndexRef.current ?? 0);
    }, 0);
  }, [pdfSpeechStatus]);

  useEffect(() => {
    restartCurrentPdfSpeechSegment();
  }, [restartCurrentPdfSpeechSegment, selectedPdfSpeechVoiceURI]);

  const handlePdfSpeechRateChange = useCallback((value: number) => {
    const nextRate = Number(value.toFixed(1));
    pdfSpeechRateRef.current = nextRate;
    setPdfSpeechRate(nextRate);

    if (pdfSpeechRateRestartTimerRef.current !== null) {
      window.clearTimeout(pdfSpeechRateRestartTimerRef.current);
    }

    if (pdfSpeechStatus !== 'playing' || activePdfSpeechSegmentIndexRef.current === null) return;
    pdfSpeechRateRestartTimerRef.current = window.setTimeout(() => {
      pdfSpeechRateRestartTimerRef.current = null;
      restartCurrentPdfSpeechSegment();
    }, 35);
  }, [pdfSpeechStatus, restartCurrentPdfSpeechSegment]);

  useEffect(() => () => {
    if (pdfSpeechRateRestartTimerRef.current !== null) {
      window.clearTimeout(pdfSpeechRateRestartTimerRef.current);
    }
  }, []);

  const handlePdfSpeechPillPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button,select,input,label')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pdfSpeechPillDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePdfSpeechPillPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pdfSpeechPillDragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const maxX = Math.max(12, window.innerWidth - rect.width - 12);
    const maxY = Math.max(12, window.innerHeight - rect.height - 12);
    setPdfSpeechPillPosition({
      x: Math.min(maxX, Math.max(12, event.clientX - drag.offsetX)),
      y: Math.min(maxY, Math.max(12, event.clientY - drag.offsetY)),
    });
  }, []);

  const handlePdfSpeechPillPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pdfSpeechPillDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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

  const setHighlightColor = useCallback((color: PdfHighlightColorId) => {
    if (onHighlightColorChange) {
      onHighlightColorChange(color);
    } else {
      setInternalHighlightColor(color);
    }
  }, [onHighlightColorChange]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setStudyState(readPdfStudyState(pdfUrl));
    setPendingTextSelection(null);
    loadedTableOfContentsRequestRef.current = null;
  }, [pdfUrl]);

  useEffect(() => {
    writePdfStudyState(pdfUrl, studyState);
  }, [pdfUrl, studyState]);

  useEffect(() => {
    writePdfBackgroundPreset(backgroundPreset);
  }, [backgroundPreset]);

  useEffect(() => {
    writePdfHighlightColor(highlightColor);
  }, [highlightColor]);

  useEffect(() => {
    currentPageRef.current = currentPage;
    setPendingTextSelection(null);
  }, [currentPage]);

  useEffect(() => {
    if (!pdfTextSelectionEnabled) clearPendingPdfSelection(true);
  }, [clearPendingPdfSelection, pdfTextSelectionEnabled]);

  useEffect(() => {
    if (studyPanelOpen) return;
    setAnnotationTool('highlight');
    setSelectedAnnotationId(null);
  }, [studyPanelOpen]);

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

  useEffect(() => {
    if (pdfSpeechAdvanceInProgressRef.current) {
      pdfSpeechAdvanceInProgressRef.current = false;
      void readCurrentPdfPageRef.current?.();
      return;
    }
    stopPdfSpeech();
  }, [currentPage, pdfUrl, stopPdfSpeech]);

  useEffect(() => {
    pdfSpeechSegmentsCacheRef.current.clear();
  }, [document, pdfUrl, speechReadingOrder]);

  useEffect(() => () => stopPdfSpeech(), [stopPdfSpeech]);

  useEffect(() => {
    if (!Number.isFinite(currentPage) || currentPage < 1) return;

    setStudyState((currentState) => {
      const lastPage = Math.floor(currentPage);
      const pc = pageCount > 0 ? pageCount : undefined;
      if (currentState.lastPage === lastPage && currentState.pageCount === pc) return currentState;
      return { ...currentState, lastPage, pageCount: pc };
    });
  }, [currentPage, pageCount]);

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
      if (rect.width < 320 || rect.height < 360) return;

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
    let activeTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    const savedState = readPdfStudyState(pdfUrl);
    const pageToRestore = savedState.lastPage && savedState.lastPage > 0 ? savedState.lastPage : 1;
    setLoading(true);
    setError(null);
    setTurnFallbackMode(false);
    setLoadProgress({ loaded: 0, total: 0 });
    currentPageRef.current = pageToRestore;
    setCurrentPage(pageToRestore);
    const defaultZoom = getDefaultZoom();
    zoomRef.current = defaultZoom;
    pendingZoomRef.current = defaultZoom;
    setZoom(defaultZoom);

    const attemptLoad = (attempt: number) => {
      if (cancelled) return;

      const task = pdfjsLib.getDocument({
        url: proxiedPdfUrl,
        disableRange: preferFullDocumentLoad,
        disableAutoFetch: false,
        disableStream: false,
        wasmUrl: PDFJS_WASM_URL,
      });
      activeTask = task;

      task.onProgress = (progress: { loaded: number; total: number }) => {
        if (!cancelled) setLoadProgress({ loaded: progress.loaded, total: progress.total });
      };

      task.promise
        .then((loadedDocument) => {
          if (cancelled) {
            loadedDocument.destroy();
            return;
          }
          activeTask = null;
          setDocument(loadedDocument);
          setLoading(false);
        })
        .catch((loadError: unknown) => {
          if (cancelled) return;
          activeTask = null;
          if (attempt < MAX_PDF_LOAD_ATTEMPTS) {
            console.warn(`[PDF Turn.js] Load attempt ${attempt}/${MAX_PDF_LOAD_ATTEMPTS} failed; retrying…`, loadError);
            window.setTimeout(() => attemptLoad(attempt + 1), PDF_LOAD_RETRY_DELAY_MS * attempt);
          } else {
            console.error(`[PDF Turn.js] Load failed after ${MAX_PDF_LOAD_ATTEMPTS} attempts:`, loadError);
            setError('This PDF could not be prepared for flip-book reading.');
            setLoading(false);
          }
        });
    };

    attemptLoad(1);

    return () => {
      cancelled = true;
      if (activeTask) void activeTask.destroy();
    };
  }, [pdfUrl, pdfLoadAttempt, preferFullDocumentLoad, proxiedPdfUrl]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setShowDetailedProgress(true), 3000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const activePdfSearchMatch = pdfSearchMatches[searchRequest?.activeIndex ?? 0] ?? null;

  const searchMatchPages = useMemo(() => {
    const pages = new Map<number, number[]>();
    pdfSearchMatches.forEach((match, index) => {
      const occurrence = pages.get(match.page) ?? [];
      occurrence.push(index);
      pages.set(match.page, occurrence);
    });
    return pages;
  }, [pdfSearchMatches]);

  useEffect(() => {
    const query = searchRequest?.query.trim() || '';
    if (!document) return;

    if (!query) {
      setPdfSearchMatches([]);
      setPdfSearchLoading(false);
      onSearchResultsChange?.({ total: 0, activeIndex: 0, loading: false, matches: [] });
      return;
    }

    const caseSensitive = Boolean(searchRequest?.caseSensitive);
    const wholeWord = Boolean(searchRequest?.wholeWord);
    const pageOnly = Boolean(searchRequest?.pageOnly);
    const currentPageNumber = normalizePageNumber(currentPageRef.current, document.numPages);

    let cancelled = false;
    setPdfSearchLoading(true);
    onSearchResultsChange?.({ total: 0, activeIndex: 0, loading: true, matches: [] });

    const timer = window.setTimeout(async () => {
      try {
        const matches: PdfSearchResultEntry[] = [];

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) return;
          if (pageOnly && pageNumber !== currentPageNumber) continue;
          let pageSegments = pdfSpeechSegmentsCacheRef.current.get(pageNumber);
          if (!pageSegments) {
            const page = await document.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const itemTexts = getPdfSpeechTextItems(textContent.items, 'source');
            pageSegments = getPdfSpeechSegments(itemTexts);
            pdfSpeechSegmentsCacheRef.current.set(pageNumber, pageSegments);
          }
          const pageText = pageSegments.map((segment) => segment.text).join(' ');
          const ranges = findReaderSearchRanges(pageText, query, caseSensitive, wholeWord);
          ranges.forEach((range) => {
            matches.push({
              page: pageNumber,
              snippet: buildSearchSnippet(pageText, range.start, range.end),
            });
          });
        }

        if (cancelled) return;
        setPdfSearchMatches(matches);
        setPdfSearchLoading(false);
        const currentPageMatchIndex = matches.findIndex((match) => match.page === currentPageNumber);
        const nextActiveIndex = matches.length > 0 ? Math.max(0, currentPageMatchIndex) : 0;
        onSearchResultsChange?.({ total: matches.length, activeIndex: nextActiveIndex, loading: false, matches });
      } catch {
        if (!cancelled) {
          setPdfSearchMatches([]);
          setPdfSearchLoading(false);
          onSearchResultsChange?.({ total: 0, activeIndex: 0, loading: false, matches: [] });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [document, onSearchResultsChange, searchRequest?.caseSensitive, searchRequest?.pageOnly, searchRequest?.query, searchRequest?.version, searchRequest?.wholeWord]);

  useEffect(() => {
    if (!document || currentPage <= document.numPages) return;
    currentPageRef.current = document.numPages;
    setCurrentPage(document.numPages);
  }, [currentPage, document]);

  useEffect(() => {
    if (!tableOfContentsRequestId || !document || !onTableOfContentsChange) return;

    const requestKey = `${pdfUrl}:${tableOfContentsRequestId}`;
    if (loadedTableOfContentsRequestRef.current === requestKey) return;

    let cancelled = false;
    loadedTableOfContentsRequestRef.current = requestKey;
    onTableOfContentsChange({ status: 'loading', items: [], pageCount: document.numPages });

    const loadTableOfContents = async () => {
      try {
        const items = await readOutlineItems(document);
        if (cancelled) return;

        onTableOfContentsChange({
          status: items.length ? 'ready' : 'empty',
          items,
          pageCount: document.numPages,
        });
      } catch {
        if (!cancelled) {
          onTableOfContentsChange({ status: 'error', items: [], pageCount: document.numPages });
        }
      }
    };

    void loadTableOfContents();

    return () => {
      cancelled = true;
    };
  }, [document, onTableOfContentsChange, pdfUrl, tableOfContentsRequestId]);

  useEffect(() => {
    if (!document || !bookRef.current || readerDisplay !== 'double') return;

    const book = $(bookRef.current) as unknown as TurnBook;
    const pageToRestore = normalizePageNumber(currentPageRef.current, document.numPages);

    try {
      if (isTurnBookReady(book)) {
        book.turn('size', dimensions.width, dimensions.height);
        if (pageToRestore !== normalizePageNumber(currentPageRef.current, document.numPages)) {
          book.turn('page', pageToRestore);
        }
        return;
      }

      book.turn({
        width: dimensions.width,
        height: dimensions.height,
        display: 'double',
        autoCenter: true,
        gradients: !isTurnTouchDevice(),
        elevation: 80,
        duration: 900,
        acceleration: true,
        turnCorners: 'bl,br',
        pages: document.numPages,
        when: {
          turned: (_event: unknown, page: number) => {
            const nextPage = normalizePageNumber(page, document.numPages, currentPageRef.current);
            currentPageRef.current = nextPage;
            setCurrentPage(nextPage);
            if (suppressNextSoundRef.current) {
              suppressNextSoundRef.current = false;
              return;
            }
            if (soundEnabledRef.current) playPageTurnSound();
          },
        },
      });
    } catch (turnError) {
      console.warn('[PDF Turn.js] Init skipped:', turnError);
      setTurnFallbackMode(true);
      return;
    }

    if (pageToRestore <= 1) return;

    const restoreFrame = window.requestAnimationFrame(() => {
      const restoredBook = getBook();
      if (!restoredBook) return;

      try {
        suppressNextSoundRef.current = true;
        restoredBook.turn('page', pageToRestore);
      } catch (turnError) {
        suppressNextSoundRef.current = false;
        console.warn('[PDF Turn.js] Restore page skipped:', turnError);
        setTurnFallbackMode(true);
        currentPageRef.current = 1;
        setCurrentPage(1);
      }
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
    }
  }, [dimensions.height, dimensions.width, document, getBook, readerDisplay]);

  const canZoomOut = zoom > 1;
  const canZoomIn = true;
  const canGoPrevious = currentPage > 1 || Boolean(onPreviousBoundary);
  const canGoNext = currentPage < pageCount || Boolean(onNextBoundary);
  const renderScale = PDF_STABLE_RENDER_SCALE;
  const renderWindow = zoom > 1 ? 6 : 10;
  const textLayerWindow = readerDisplay === 'single' ? 1 : 2;
  const isZoomed = zoom > 1;
  const zoomedWidth = Math.round(effectiveDimensions.width * zoom);
  const zoomedHeight = Math.round(effectiveDimensions.height * zoom);
  const pageRenderWidth = readerDisplay === 'double' ? effectiveDimensions.width / 2 : effectiveDimensions.width;
  const pageRenderHeight = effectiveDimensions.height;
  const shouldCenterZoomedReader = isZoomed && readerDisplay === 'single';
  const pageSliderProgress = pageCount > 1 ? ((currentPage - 1) / (pageCount - 1)) * 100 : 0;
  const isLightReaderBackground = backgroundPreset === 'paper';
  const navButtonToneClass = isLightReaderBackground
    ? 'border-black/10 bg-white/45 text-black/50 hover:border-black/20 hover:bg-white/75 hover:text-black/80 md:border-black/10 md:bg-white/55 md:text-black/50 md:hover:border-black/25 md:hover:bg-white/85 md:hover:text-black/80'
    : 'border-white/10 bg-black/20 text-white/45 hover:border-white/20 hover:bg-black/35 hover:text-white/85 md:border-white/15 md:bg-black/25 md:text-white/55 md:hover:border-white/25 md:hover:bg-black/40 md:hover:text-white/90';
  const navButtonBaseClass = `fixed top-1/2 z-[10060] flex h-16 w-8 -translate-y-1/2 items-center justify-center border-y shadow-none backdrop-blur-md transition-all disabled:pointer-events-none disabled:opacity-0 md:h-11 md:w-11 md:rounded-full md:border md:shadow-lg md:disabled:pointer-events-auto md:disabled:cursor-not-allowed md:disabled:opacity-20 ${navButtonToneClass}`;

  useEffect(() => {
    const wasZoomed = wasZoomedRef.current;
    wasZoomedRef.current = shouldCenterZoomedReader;
    const layoutKey = `${currentPage}:${effectiveDimensions.width}:${effectiveDimensions.height}:${zoom}`;
    const shouldCenterForLayout = shouldCenterZoomedReader && centeredMobileLayoutKeyRef.current !== layoutKey;
    if (!shouldCenterZoomedReader || (wasZoomed && !shouldCenterForLayout) || !shellRef.current) return;
    centeredMobileLayoutKeyRef.current = layoutKey;

    window.requestAnimationFrame(() => {
      const shell = shellRef.current;
      if (!shell) return;
      shell.scrollLeft = Math.max(0, (shell.scrollWidth - shell.clientWidth) / 2);
    });
  }, [shouldCenterZoomedReader, currentPage, effectiveDimensions.width, effectiveDimensions.height, zoom]);

  const goPrevious = useCallback(() => {
    const currentSafePage = normalizePageNumber(currentPageRef.current, pageCount);

    if (currentSafePage <= 1 && onPreviousBoundary) {
      onPreviousBoundary();
      return;
    }

    if (readerDisplay === 'single') {
      setCurrentPage((page) => Math.max(1, page - 1));
      if (soundEnabledRef.current && currentSafePage > 1) playPageTurnSound();
      return;
    }

    const book = getBook();
    if (!book || currentSafePage <= 1) return;
    try {
      book.turn('previous');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Previous page skipped:', turnError);
      setTurnFallbackMode(true);
    }
  }, [getBook, onPreviousBoundary, pageCount, readerDisplay]);

  const goNext = useCallback(() => {
    const currentSafePage = normalizePageNumber(currentPageRef.current, pageCount);

    if (currentSafePage >= pageCount && onNextBoundary) {
      onNextBoundary();
      return;
    }

    if (readerDisplay === 'single') {
      setCurrentPage((page) => Math.min(pageCount, page + 1));
      if (soundEnabledRef.current && currentSafePage < pageCount) playPageTurnSound();
      return;
    }

    const book = getBook();
    if (!book || currentSafePage >= pageCount) return;
    try {
      book.turn('next');
    } catch (turnError) {
      console.warn('[PDF Turn.js] Next page skipped:', turnError);
      setTurnFallbackMode(true);
    }
  }, [getBook, onNextBoundary, pageCount, readerDisplay]);

  useEffect(() => {
    if (!pdfSpeechAdvancePending) return;
    pdfSpeechAdvanceInProgressRef.current = true;
    setPdfSpeechAdvancePending(false);
    goNext();
  }, [goNext, pdfSpeechAdvancePending]);

  const goToPage = useCallback((page: number) => {
    const safePage = normalizePageNumber(page, pageCount);
    if (safePage === normalizePageNumber(currentPageRef.current, pageCount)) return;

    if (readerDisplay === 'single') {
      if (safePage < 1 || safePage > pageCount) return;
      setCurrentPage(safePage);
      return;
    }

    const book = getBook();
    if (!book || safePage < 1 || safePage > pageCount) return;

    try {
      book.turn('page', safePage);
    } catch (turnError) {
      console.warn('[PDF Turn.js] Page jump skipped:', turnError);
      setTurnFallbackMode(true);
    }
  }, [getBook, pageCount, readerDisplay]);

  const lastProcessedNavRequestRef = useRef(0);

  useEffect(() => {
    if (!activePdfSearchMatch || pdfSearchLoading) return;
    const navRequest = searchRequest?.navRequest ?? 0;
    if (navRequest === lastProcessedNavRequestRef.current) return;
    lastProcessedNavRequestRef.current = navRequest;
    const currentPageNumber = normalizePageNumber(currentPageRef.current, pageCount);
    if (activePdfSearchMatch.page !== currentPageNumber) {
      goToPage(activePdfSearchMatch.page);
    }
  }, [activePdfSearchMatch, goToPage, pageCount, pdfSearchLoading, searchRequest?.navRequest]);

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
    const nextHighlight = {
      ...highlight,
      color: highlight.color ?? highlightColor,
      id: `${highlight.page}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    setStudyState((current) => ({
      ...current,
      textHighlights: [
        nextHighlight,
        ...current.textHighlights,
      ].slice(0, 250),
    }));
    setPendingTextSelection(null);
  }, [highlightColor]);

  const handlePdfTextSelection = useCallback((selection: PdfPendingTextSelection) => {
    if (studyPanelOpen && annotationTool === 'highlight') {
      addTextHighlight(selection);
      return;
    }

    setPendingTextSelection(selection);
  }, [addTextHighlight, annotationTool, studyPanelOpen]);

  const removeTextHighlight = useCallback((highlightId: string) => {
    setStudyState((current) => ({
      ...current,
      textHighlights: current.textHighlights.filter((highlight) => highlight.id !== highlightId),
    }));
  }, []);

  const removeTextHighlights = useCallback((highlightIds: string[]) => {
    if (highlightIds.length === 0) return;
    const removable = new Set(highlightIds);
    setStudyState((current) => ({
      ...current,
      textHighlights: current.textHighlights.filter((highlight) => !removable.has(highlight.id)),
    }));
    setPendingTextSelection(null);
  }, []);

  const addTextAnnotation = useCallback((page: number, x: number, y: number) => {
    const now = Date.now();
    const annotation: PdfTextAnnotation = {
      id: getAnnotationId(page),
      type: 'text',
      page,
      x: clampPercent(x, 82),
      y: clampPercent(y, 92),
      width: typeof window !== 'undefined' && window.innerWidth < 760 ? 34 : 26,
      height: 8,
      text: '',
      color: highlightColor,
      fontSize: 13,
      createdAt: now,
      updatedAt: now,
    };
    setStudyState((current) => ({
      ...current,
      annotations: [annotation, ...(current.annotations || [])].slice(0, 500),
    }));
    setSelectedAnnotationId(annotation.id);
  }, [highlightColor]);

  const addInkAnnotation = useCallback((page: number, points: PdfInkAnnotation['points']) => {
    if (points.length < 2) return;
    const now = Date.now();
    const annotation: PdfInkAnnotation = {
      id: getAnnotationId(page),
      type: 'ink',
      page,
      points: points.map((point) => ({ x: clampPercent(point.x), y: clampPercent(point.y) })),
      color: highlightColor,
      strokeWidth: 2.25,
      createdAt: now,
      updatedAt: now,
    };
    setStudyState((current) => ({
      ...current,
      annotations: [annotation, ...(current.annotations || [])].slice(0, 500),
    }));
    setSelectedAnnotationId(annotation.id);
  }, [highlightColor]);

  const updateTextAnnotation = useCallback((annotationId: string, text: string) => {
    setStudyState((current) => ({
      ...current,
      annotations: (current.annotations || []).map((annotation) => (
        annotation.id === annotationId && annotation.type === 'text'
          ? { ...annotation, text: text.slice(0, 600), updatedAt: Date.now() }
          : annotation
      )),
    }));
  }, []);

  const updateTextAnnotationFontSize = useCallback((annotationId: string, delta: number) => {
    setStudyState((current) => ({
      ...current,
      annotations: (current.annotations || []).map((annotation) => (
        annotation.id === annotationId && annotation.type === 'text'
          ? { ...annotation, fontSize: Math.max(9, Math.min(24, annotation.fontSize + delta)), updatedAt: Date.now() }
          : annotation
      )),
    }));
  }, []);

  const updateAnnotationColor = useCallback((annotationId: string, color: PdfHighlightColorId) => {
    setStudyState((current) => ({
      ...current,
      annotations: (current.annotations || []).map((annotation) => (
        annotation.id === annotationId
          ? { ...annotation, color, updatedAt: Date.now() }
          : annotation
      )),
    }));
  }, []);

  const moveAnnotation = useCallback((annotationId: string, dx: number, dy: number) => {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    setStudyState((current) => ({
      ...current,
      annotations: (current.annotations || []).map((annotation) => {
        if (annotation.id !== annotationId) return annotation;
        if (annotation.type === 'text') {
          return {
            ...annotation,
            x: clampPercent(annotation.x + dx, 100 - Math.min(annotation.width, 100)),
            y: clampPercent(annotation.y + dy, 100 - Math.min(annotation.height, 100)),
            updatedAt: Date.now(),
          };
        }
        return {
          ...annotation,
          points: annotation.points.map((point) => ({
            x: clampPercent(point.x + dx),
            y: clampPercent(point.y + dy),
          })),
          updatedAt: Date.now(),
        };
      }),
    }));
  }, []);

  const removeAnnotation = useCallback((annotationId: string) => {
    setStudyState((current) => ({
      ...current,
      annotations: (current.annotations || []).filter((annotation) => annotation.id !== annotationId),
    }));
    setSelectedAnnotationId((current) => current === annotationId ? null : current);
  }, []);

  const readSelectedPdfText = useCallback((text: string) => {
    const speechText = text.replace(/\s+/g, ' ').trim();
    if (!speechText || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const itemTexts = speechText
      .split(/(?<=[.!?\u0964])\s+/u)
      .map((segment) => segment.trim())
      .filter(Boolean);
    const playbackSegments = getPdfSpeechSegments(itemTexts.length ? itemTexts : [speechText])
      .map((segment): PdfSpeechPlaybackSegment => ({
        ...segment,
        pageNumber: pendingTextSelection?.page || currentPageRef.current,
      }));
    if (playbackSegments.length === 0) return;

    pdfSpeechAutoAdvanceRef.current = false;
    pdfSpeechStoppedRef.current = false;
    selectedTextSpeechActiveRef.current = true;
    selectedPdfSpeechTextRef.current = speechText;
    window.speechSynthesis.cancel();
    setPdfSpeechSegments(playbackSegments);
    pdfSpeechSegmentsRef.current = playbackSegments;
    speakPdfSpeechSegment(playbackSegments, 0);
  }, [pendingTextSelection?.page, speakPdfSpeechSegment]);

  const replaySelectedPdfText = useCallback(() => {
    const text = selectedPdfSpeechTextRef.current;
    if (!text) return;
    readSelectedPdfText(text);
  }, [readSelectedPdfText]);

  const copySelectedPdfText = useCallback((text: string) => {
    const copyText = text.replace(/\s+/g, ' ').trim();
    if (!copyText) return;
    const fallback = () => {
      const textarea = window.document.createElement('textarea');
      textarea.value = copyText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      window.document.body.appendChild(textarea);
      textarea.select();
      try { window.document.execCommand('copy'); } catch { /* clipboard fallback */ }
      textarea.remove();
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(copyText).catch(fallback);
      } else {
        fallback();
      }
    } catch {
      fallback();
    }
    clearPendingPdfSelection(true);
  }, [clearPendingPdfSelection]);

  const exportAnnotatedPdf = useCallback(async () => {
    if (!document || exportingAnnotatedPdf) return;

    try {
      setExportingAnnotatedPdf(true);
      const response = await fetch(proxiedPdfUrl);
      if (!response.ok) throw new Error('Unable to load the PDF for export.');

      const sourceBytes = await response.arrayBuffer();
      const pdfDocument = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
      const pages = pdfDocument.getPages();

      (studyState.annotations || []).forEach((annotation) => {
        const page = pages[annotation.page - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        const color = hexToPdfRgb(getHighlightSwatch(annotation.color));

        if (annotation.type === 'text') {
          const fontSize = Math.max(8, Math.min(24, annotation.fontSize || 12));
          const left = (annotation.x / 100) * width;
          const top = height - (annotation.y / 100) * height;
          const maxWidth = Math.max(48, (annotation.width / 100) * width);
          const lineHeight = fontSize * 1.25;
          const words = annotation.text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
          const lines: string[] = [];
          let currentLine = '';

          words.forEach((word) => {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !currentLine) {
              currentLine = candidate;
            } else {
              lines.push(currentLine);
              currentLine = word;
            }
          });
          if (currentLine) lines.push(currentLine);

          lines.slice(0, 10).forEach((line, index) => {
            page.drawText(line, {
              x: left,
              y: top - fontSize - (index * lineHeight),
              size: fontSize,
              font,
              color,
              maxWidth,
            });
          });
          return;
        }

        annotation.points.slice(1).forEach((point, index) => {
          const previous = annotation.points[index];
          page.drawLine({
            start: { x: (previous.x / 100) * width, y: height - (previous.y / 100) * height },
            end: { x: (point.x / 100) * width, y: height - (point.y / 100) * height },
            thickness: Math.max(0.75, annotation.strokeWidth),
            color,
          });
        });
      });

      const exportedBytes = await pdfDocument.save();
      const safeTitle = title
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 100) || 'document';
      downloadBlob(new Blob([exportedBytes], { type: 'application/pdf' }), `${safeTitle}-annotated.pdf`);
    } catch (exportError) {
      console.warn('[PDF Turn.js] Annotated export failed:', exportError);
      setError(exportError instanceof Error ? exportError.message : 'Unable to export annotated PDF.');
    } finally {
      setExportingAnnotatedPdf(false);
    }
  }, [document, exportingAnnotatedPdf, proxiedPdfUrl, studyState.annotations, title]);

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

      if (event.key === 'Escape' && pdfSpeechStatus !== 'idle') {
        event.preventDefault();
        stopPdfSpeech();
      } else if (event.key === 'ArrowLeft') {
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
  }, [adjustZoom, goNext, goPrevious, pdfSpeechStatus, resetZoom, stopPdfSpeech]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-bit-bg text-center px-8">
        <Loader2 className="animate-spin text-bit-accent" size={40} />
        <div className="w-full max-w-xs space-y-4">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-bit-accent">
            Loading PDF
          </p>
          {showDetailedProgress && loadProgress.total > 0 ? (
            <div className="space-y-2 animate-fade-in">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bit-panel/30">
                <div
                  className="h-full rounded-full bg-bit-accent transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-bit-muted/80">
                <span>{loadProgress.loaded < 1024 ? `${loadProgress.loaded} B` : loadProgress.loaded < 1048576 ? `${(loadProgress.loaded / 1024).toFixed(1)} KB` : `${(loadProgress.loaded / 1048576).toFixed(1)} MB`}</span>
                <span className="text-bit-accent/80">{Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))}%</span>
                <span>{loadProgress.total < 1024 ? `${loadProgress.total} B` : loadProgress.total < 1048576 ? `${(loadProgress.total / 1024).toFixed(1)} KB` : `${(loadProgress.total / 1048576).toFixed(1)} MB`}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-bit-muted">Loading PDF pages…</p>
          )}
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPdfLoadAttempt((attempt) => attempt + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-bit-border px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
          >
            <RotateCcw size={14} />
            Try again
          </button>
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
      </div>
    );
  }

  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden ${activeBackgroundPreset.className}`}>
      <div
        ref={shellRef}
        data-pdf-reader-shell
        className={`scrollbar-hide relative flex min-h-0 flex-1 overscroll-contain ${pdfTextSelectionEnabled ? '' : 'touch-none'} ${isZoomed ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden'} px-4 py-6 md:px-10 md:py-8`}
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
              width: isZoomed ? `${zoomedWidth}px` : `${effectiveDimensions.width}px`,
              height: isZoomed ? `${zoomedHeight}px` : `${effectiveDimensions.height}px`,
            }}
          >
          <div
            className="absolute left-0 top-0 will-change-transform"
            style={{
              transform: `translate3d(0, 0, 0) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {readerDisplay === 'single' ? (
              <div className="h-full w-full overflow-hidden rounded-sm bg-white shadow-2xl">
                <MemoPDFPageCanvas
                  document={document}
                  pageNumber={currentPage}
                  renderScale={renderScale}
                  shouldRender
                  shouldRenderTextLayer={pdfTextSelectionEnabled || pdfSpeechStatus !== 'idle'}
                  textSelectionEnabled={pdfTextSelectionEnabled}
                  targetWidth={pageRenderWidth}
                  targetHeight={pageRenderHeight}
                  isBookmarked={currentPageBookmarked}
                  isHighlighted={currentPageHighlighted}
                  textHighlights={currentPageTextHighlights}
                  annotations={currentPageAnnotations}
                  selectedAnnotationId={selectedAnnotationId}
                  annotationTool={annotationTool}
                  activeSpeechText={activePdfSpeechPage === currentPage ? activePdfSpeechText : ''}
                  activeSpeechItemRange={activePdfSpeechPage === currentPage ? activePdfSpeechItemRange : null}
                  activeSpeechWord={activePdfSpeechPage === currentPage ? activePdfSpeechWord : ''}
                  activeSpeechWordOccurrence={activePdfSpeechPage === currentPage ? activePdfSpeechWordOccurrence : 0}
                  speechHighlightMode={speechHighlightMode}
                  speechReadingOrder={speechReadingOrder}
                  pendingSelectionRects={getPendingSelectionRectsForPage(currentPage)}
                  searchHighlightText={searchRequest?.query && searchMatchPages.has(currentPage) ? searchRequest.query : ''}
                  searchActiveOccurrence={activePdfSearchMatch?.page === currentPage ? (searchMatchPages.get(currentPage)?.indexOf(searchRequest?.activeIndex ?? 0) ?? -1) : -1}
                  searchCaseSensitive={Boolean(searchRequest?.caseSensitive)}
                  searchWholeWord={Boolean(searchRequest?.wholeWord)}
                  currentHighlightColor={highlightColor}
                  onTextSelection={handlePdfTextSelection}
                  onAddTextAnnotation={addTextAnnotation}
                  onAddInkAnnotation={addInkAnnotation}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onMoveAnnotation={moveAnnotation}
                  onUpdateTextAnnotation={updateTextAnnotation}
                  onRemoveTextHighlight={removeTextHighlight}
                  onRemoveAnnotation={removeAnnotation}
                />
              </div>
            ) : (
              <div key={`${pdfUrl}:${pageCount}`} ref={bookRef} className="bit-turn-book">
                {Array.from({ length: pageCount }, (_, index) => {
                  const pageNumber = index + 1;
                  const shouldRender = Math.abs(pageNumber - currentPage) <= renderWindow;
                  const isCurrentSpeechPage = pdfSpeechStatus !== 'idle' && pageNumber === activePdfSpeechPage;
                  const shouldRenderTextLayer = (pdfTextSelectionEnabled && Math.abs(pageNumber - currentPage) <= textLayerWindow) || isCurrentSpeechPage;
                  return (
                    <div key={pageNumber} className="bit-turn-page bg-white">
                      <MemoPDFPageCanvas
                        document={document}
                        pageNumber={pageNumber}
                        renderScale={renderScale}
                        shouldRender={shouldRender}
                        shouldRenderTextLayer={shouldRenderTextLayer}
                        textSelectionEnabled={pdfTextSelectionEnabled}
                        targetWidth={pageRenderWidth}
                        targetHeight={pageRenderHeight}
                        isBookmarked={studyState.bookmarks.includes(pageNumber)}
                        isHighlighted={studyState.highlights.includes(pageNumber)}
                        textHighlights={textHighlightsByPage.get(pageNumber) ?? EMPTY_TEXT_HIGHLIGHTS}
                        annotations={annotationsByPage.get(pageNumber) ?? []}
                        selectedAnnotationId={selectedAnnotationId}
                        annotationTool={annotationTool}
                        activeSpeechText={isCurrentSpeechPage ? activePdfSpeechText : ''}
                        activeSpeechItemRange={isCurrentSpeechPage ? activePdfSpeechItemRange : null}
                        activeSpeechWord={isCurrentSpeechPage ? activePdfSpeechWord : ''}
                        activeSpeechWordOccurrence={isCurrentSpeechPage ? activePdfSpeechWordOccurrence : 0}
                        speechHighlightMode={speechHighlightMode}
                        speechReadingOrder={speechReadingOrder}
                        pendingSelectionRects={getPendingSelectionRectsForPage(pageNumber)}
                        searchHighlightText={searchRequest?.query && searchMatchPages.has(pageNumber) ? searchRequest.query : ''}
                        searchActiveOccurrence={activePdfSearchMatch?.page === pageNumber ? (searchMatchPages.get(pageNumber)?.indexOf(searchRequest?.activeIndex ?? 0) ?? -1) : -1}
                        searchCaseSensitive={Boolean(searchRequest?.caseSensitive)}
                        searchWholeWord={Boolean(searchRequest?.wholeWord)}
                        currentHighlightColor={highlightColor}
                        onTextSelection={handlePdfTextSelection}
                        onAddTextAnnotation={addTextAnnotation}
                        onAddInkAnnotation={addInkAnnotation}
                        onSelectAnnotation={setSelectedAnnotationId}
                        onMoveAnnotation={moveAnnotation}
                        onUpdateTextAnnotation={updateTextAnnotation}
                        onRemoveTextHighlight={removeTextHighlight}
                        onRemoveAnnotation={removeAnnotation}
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

      {pendingTextSelection && (
        <div
          className="fixed z-[10080] flex max-w-[min(24rem,calc(100vw-1.5rem))] items-center gap-1 rounded-full border border-bit-border bg-bit-panel/95 p-1.5 text-bit-text shadow-2xl shadow-black/35 backdrop-blur-xl"
          style={{ left: pendingTextSelection.popover.x, top: Math.max(12, window.innerWidth < 760 ? pendingTextSelection.popover.y - 12 : pendingTextSelection.popover.y) }}
          data-pdf-selection-popover
          onMouseDown={(event) => event.preventDefault()}
          role="toolbar"
          aria-label="PDF selection actions"
        >
          <div className="relative flex items-center gap-0.5 rounded-full bg-bit-bg/50 p-0.5">
            <button
              type="button"
              onClick={() => {
                const { popover: _popover, ...highlight } = pendingTextSelection;
                addTextHighlight(highlight);
              }}
              className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-zinc-950 transition-all hover:scale-105 active:scale-95"
              style={{ backgroundColor: PDF_HIGHLIGHT_COLOR_PRESETS.find((preset) => preset.id === highlightColor)?.swatch || PDF_HIGHLIGHT_COLOR_PRESETS[0].swatch }}
              aria-label="Highlight selected text"
              title="Highlight selected text"
            >
              <Highlighter size={18} className="md:size-[15px]" />
            </button>
            <button
              type="button"
              onClick={() => setSelectionColorMenuOpen((open) => !open)}
              className="inline-flex h-10 w-8 md:h-8 md:w-6 items-center justify-center rounded-full text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-text"
              aria-label="Choose highlight color"
              aria-expanded={selectionColorMenuOpen}
              title="Choose highlight color"
            >
              <ChevronDown size={16} className={`md:size-[14px] transition-transform ${selectionColorMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {selectionColorMenuOpen && (
              <div className="absolute left-0 top-12 md:top-10 flex w-max max-w-[min(16rem,calc(100vw-1.5rem))] flex-wrap gap-1.5 rounded-full border border-bit-border bg-bit-panel/95 p-1.5 shadow-2xl shadow-black/35 backdrop-blur-xl">
                {PDF_HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setHighlightColor(preset.id);
                      setSelectionColorMenuOpen(false);
                    }}
                    className={`h-8 w-8 md:h-6 md:w-6 rounded-full border transition-all ${highlightColor === preset.id ? 'border-white ring-2 ring-bit-accent/45' : 'border-white/35 hover:border-white'}`}
                    style={{ backgroundColor: preset.swatch }}
                    aria-label={`Use ${preset.label} highlight color`}
                    aria-pressed={highlightColor === preset.id}
                    title={preset.label}
                  />
                ))}
              </div>
            )}
          </div>
          {pendingSelectionHighlightIds.length > 0 && (
            <button
              type="button"
              onClick={() => removeTextHighlights(pendingSelectionHighlightIds)}
              className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-red-200 transition-all hover:bg-red-500/15 hover:text-red-100 active:scale-95"
              aria-label="Remove highlight from selection"
              title="Remove highlight from selection"
            >
              <Eraser size={18} className="md:size-[15px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => readSelectedPdfText(pendingTextSelection.text)}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-bit-accent transition-all hover:bg-bit-accent/12 hover:text-bit-text active:scale-95"
            aria-label="Read selected text"
            title="Read selected text"
          >
            <Headphones size={18} className="md:size-[15px]" />
          </button>
          <button
            type="button"
            onClick={() => {
              const { popover: _popover, ...lookupSelection } = pendingTextSelection;
              clearPendingPdfSelection(true);
              onLookupWord?.(lookupSelection.text);
            }}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full bg-bit-accent/12 text-bit-accent transition-all hover:bg-bit-accent hover:text-white active:scale-95"
            aria-label="Look up selected word"
            title="Look up selected word"
          >
            <BookOpenText size={18} className="md:size-[15px]" />
          </button>
          <button
            type="button"
            onClick={() => copySelectedPdfText(pendingTextSelection.text)}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-text active:scale-95"
            aria-label="Copy selected text"
            title="Copy selected text"
          >
            <Copy size={18} className="md:size-[15px]" />
          </button>
          <button
            type="button"
            onClick={() => clearPendingPdfSelection(true)}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-bit-muted transition-all hover:bg-bit-bg/80 hover:text-bit-text active:scale-95"
            aria-label="Close selection actions"
            title="Close"
          >
            <X size={18} className="md:size-[15px]" />
          </button>
        </div>
      )}

      {pdfSpeechStatus !== 'idle' && (
        <>
        <div
          className={`pointer-events-auto fixed z-[10060] items-center gap-2 rounded-full border border-bit-border bg-bit-panel/95 px-3 py-2 shadow-2xl shadow-black/25 backdrop-blur-xl ${pdfSpeechPillDragRef.current ? 'cursor-grabbing' : 'cursor-grab'} hidden md:flex`}
          style={pdfSpeechPillPosition ? { left: pdfSpeechPillPosition.x, top: pdfSpeechPillPosition.y } : { left: '50%', bottom: '5rem', transform: 'translateX(-50%)' }}
          onPointerDown={handlePdfSpeechPillPointerDown}
          onPointerMove={handlePdfSpeechPillPointerMove}
          onPointerUp={handlePdfSpeechPillPointerUp}
          onPointerCancel={handlePdfSpeechPillPointerUp}
          data-pdf-speech-pill
          aria-label="Read aloud controls"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bit-accent/12 text-bit-accent" title="Drag read aloud controls" aria-hidden="true">
            <GripVertical size={16} />
          </div>
          <button
            type="button"
            onClick={pdfSpeechStatus === 'playing' ? pausePdfSpeech : readCurrentPdfPage}
            disabled={!document || pdfSpeechStatus === 'loading'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bit-accent/35 bg-bit-accent/10 text-bit-accent transition-all hover:bg-bit-accent hover:text-white disabled:cursor-wait disabled:opacity-50"
            aria-label={pdfSpeechStatus === 'playing' ? 'Pause read aloud' : 'Resume read aloud'}
            title={pdfSpeechStatus === 'playing' ? 'Pause' : 'Resume'}
          >
            {pdfSpeechStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : pdfSpeechStatus === 'playing' ? <Pause size={14} /> : <Play size={14} />}
          </button>
          {selectedTextSpeechActiveRef.current && (
            <button
              type="button"
              onClick={replaySelectedPdfText}
              disabled={!document || pdfSpeechStatus === 'loading'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bit-border bg-bit-bg/60 text-bit-muted transition-all hover:border-bit-accent/35 hover:bg-bit-accent/10 hover:text-bit-accent disabled:cursor-wait disabled:opacity-50"
              aria-label="Replay selected text"
              title="Replay selected text"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <select
            value={selectedPdfSpeechVoiceURI}
            onChange={(event) => setSelectedPdfSpeechVoiceURI(event.target.value)}
            className="h-8 w-32 cursor-pointer rounded-full border border-bit-border bg-bit-bg/75 px-3 text-[11px] text-bit-text outline-none transition-all hover:border-bit-accent/35 focus:border-bit-accent"
            aria-label="Read aloud voice"
          >
            {pdfSpeechVoices.length === 0 ? (
              <option value="">System voice</option>
            ) : (
              pdfSpeechVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name}
                </option>
              ))
            )}
          </select>
          <label className="flex items-center gap-2 rounded-full border border-bit-border bg-bit-bg/60 px-3 py-1 text-[10px] font-mono font-bold text-bit-muted">
            <span className="tabular-nums">{pdfSpeechRate.toFixed(1)}x</span>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={pdfSpeechRate}
              onInput={(event) => handlePdfSpeechRateChange(Number(event.currentTarget.value))}
              onChange={(event) => handlePdfSpeechRateChange(Number(event.currentTarget.value))}
              className="h-6 w-20 accent-bit-accent"
              aria-label="Read aloud speed"
            />
          </label>
          <button
            type="button"
            onClick={stopPdfSpeech}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bit-border bg-bit-bg/60 text-bit-muted transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            aria-label="Stop read aloud"
            title="Stop read aloud (Esc)"
          >
            <X size={14} />
          </button>
        </div>
        </>
      )}

      {studyPanelOpen && (
        <div className="relative z-[10055] border-t border-bit-border/55 bg-bit-panel/55 px-3 py-2 shadow-[0_-12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl md:px-6">
          <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'highlight' as const, label: 'Highlight', icon: Highlighter },
              { id: 'select' as const, label: 'Select', icon: MousePointer2 },
              { id: 'text' as const, label: 'Text', icon: Type },
              { id: 'pen' as const, label: 'Pen', icon: PenLine },
              { id: 'erase' as const, label: 'Erase', icon: Eraser },
            ].map((tool) => {
              const ToolIcon = tool.icon;
              const active = annotationTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setAnnotationTool(tool.id);
                    clearPendingPdfSelection(true);
                  }}
                  className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${active ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-bit-accent/35 hover:text-bit-accent'}`}
                  aria-pressed={active}
                  aria-label={`${tool.label} PDF annotation tool`}
                  title={tool.label}
                >
                  <ToolIcon size={14} />
                  <span className="hidden sm:inline">{tool.label}</span>
                </button>
              );
            })}

            <div className="mx-1 h-7 w-px shrink-0 bg-bit-border/70" />

            <div className="flex shrink-0 items-center gap-1 rounded-full border border-bit-border bg-bit-bg/60 p-1">
              {PDF_HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setHighlightColor(preset.id);
                    if (selectedAnnotation) updateAnnotationColor(selectedAnnotation.id, preset.id);
                  }}
                  className={`h-7 w-7 rounded-full border transition-all ${(selectedAnnotation?.color || highlightColor) === preset.id ? 'border-white ring-2 ring-bit-accent/50' : 'border-white/30 hover:border-white/80'}`}
                  style={{ backgroundColor: preset.swatch }}
                  aria-label={`Use ${preset.label}`}
                  aria-pressed={highlightColor === preset.id}
                  title={preset.label}
                />
              ))}
            </div>

            {selectedAnnotation?.type === 'text' && (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-bit-border bg-bit-bg/60 p-1">
                <button
                  type="button"
                  onClick={() => updateTextAnnotationFontSize(selectedAnnotation.id, -1)}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent"
                  aria-label="Decrease text size"
                  title="Decrease text size"
                >
                  A-
                </button>
                <span className="min-w-8 text-center text-[10px] font-mono font-bold text-bit-muted tabular-nums">
                  {selectedAnnotation.fontSize}
                </span>
                <button
                  type="button"
                  onClick={() => updateTextAnnotationFontSize(selectedAnnotation.id, 1)}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent"
                  aria-label="Increase text size"
                  title="Increase text size"
                >
                  A+
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => selectedAnnotation && removeAnnotation(selectedAnnotation.id)}
              disabled={!selectedAnnotation}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-border bg-bit-bg/60 text-bit-muted transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Delete selected annotation"
              title="Delete selected annotation"
            >
              <Trash2 size={15} />
            </button>

            <button
              type="button"
              onClick={exportAnnotatedPdf}
              disabled={!document || exportingAnnotatedPdf}
              className="ml-auto inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-bit-accent/30 bg-bit-accent/10 px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent transition-all hover:bg-bit-accent hover:text-white disabled:cursor-wait disabled:opacity-45"
              aria-label="Export annotated PDF"
              title="Export annotated PDF"
            >
              {exportingAnnotatedPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      )}

      <div className={`relative ${isPageSliderActive ? 'z-[10150]' : 'z-[10050]'} flex flex-col gap-2 overflow-visible border-t border-bit-border/55 bg-bit-panel/35 px-3 py-2.5 shadow-[0_-18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:grid sm:items-center sm:gap-3 md:px-6 ${controlsCompact ? 'sm:grid-cols-1 lg:grid-cols-1' : 'sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30rem)_minmax(0,1fr)] lg:gap-4'}`}>
        <p className={`hidden min-w-0 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted ${controlsCompact ? '' : 'lg:line-clamp-1 lg:block'}`}>
          {title}
        </p>
        <div className={`flex min-w-0 flex-1 items-end gap-2 sm:gap-3 ${controlsCompact ? 'w-full' : 'lg:col-start-2 lg:w-full'}`}>
          <span className="shrink-0 pb-1 text-[10px] font-mono font-bold text-bit-muted">1</span>
          <label className={`relative flex min-w-0 flex-1 flex-col gap-2 ${controlsCompact ? 'sm:min-w-[12rem]' : 'min-w-[12rem] sm:min-w-[18rem]'}`}>
            {isPageSliderActive && (
              <span
                className="pointer-events-none absolute -top-8 z-[10080] flex h-6 min-w-6 items-center justify-center rounded-full border border-bit-accent bg-bit-accent px-1.5 text-[10px] font-mono font-bold leading-none text-white shadow-lg shadow-bit-accent/25 backdrop-blur"
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
        <div className={`scrollbar-hide flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 sm:gap-3 ${controlsCompact ? 'w-full justify-start' : 'shrink-0 justify-between sm:justify-start lg:justify-end'}`}>
          <button
            type="button"
            onClick={() => toggleSavedPage(currentPage)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${currentPageBookmarked || currentPageHighlighted ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
            aria-label={currentPageBookmarked || currentPageHighlighted ? 'Unsave current page' : 'Save current page'}
            title={currentPageBookmarked || currentPageHighlighted ? 'Saved page' : 'Save page'}
          >
            {currentPageBookmarked || currentPageHighlighted ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setStudyPanelOpen((open) => annotationTool === 'highlight' ? !open : true);
              setAnnotationTool('highlight');
            }}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${studyPanelOpen ? 'border-yellow-300 bg-yellow-300 text-zinc-950' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-yellow-300/40 hover:text-yellow-200'}`}
            aria-label={studyPanelOpen ? 'Close PDF annotation tools' : 'Open PDF annotation tools'}
            title={studyPanelOpen ? 'Annotation tools on' : 'Open annotation tools'}
          >
            <Highlighter size={15} />
          </button>
          <button
            type="button"
            onClick={pdfSpeechStatus !== 'idle' ? stopPdfSpeech : readCurrentPdfPage}
            disabled={!document}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${pdfSpeechStatus === 'playing' || pdfSpeechStatus === 'paused' ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-bg/60 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'} disabled:cursor-wait disabled:opacity-50`}
            aria-label={pdfSpeechStatus !== 'idle' ? 'Stop read aloud' : 'Open read aloud controls'}
            title={pdfSpeechStatus !== 'idle' ? 'Stop read aloud' : 'Read aloud'}
          >
            {pdfSpeechStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />}
          </button>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-bit-border bg-bit-bg/60 p-1">
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
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bit-border bg-bit-bg/60 text-bit-muted transition-all hover:border-bit-accent/40 hover:text-bit-accent"
            aria-label={soundEnabled ? 'Disable page turn sound' : 'Enable page turn sound'}
            title={soundEnabled ? 'Disable page turn sound' : 'Enable page turn sound'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <div className="min-w-[5.5rem] shrink-0 whitespace-nowrap text-right text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-accent tabular-nums sm:min-w-[8.5rem] sm:tracking-[0.22em]">
            <span className="sm:hidden">{currentPage}/{pageCount}</span>
            <span className="hidden sm:inline">Page {currentPage} / {pageCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFFlipBook;

