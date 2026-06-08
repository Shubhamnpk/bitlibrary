import { readReaderEntry, writeReaderEntry } from '@/lib/storage-manager';

export type PdfBackgroundPresetId = 'default' | 'wood' | 'paper' | 'sage' | 'night';
export type PdfHighlightColorId = 'yellow' | 'mint' | 'sky' | 'rose' | 'violet';

export interface PdfHighlightRect {
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

export interface PdfStudyState {
  lastPage?: number;
  bookmarks: number[];
  highlights: number[];
  notes: Record<string, string>;
  textHighlights: PdfTextHighlight[];
}

interface PdfReaderStorage {
  preferences: {
    backgroundPreset: PdfBackgroundPresetId;
    highlightColor: PdfHighlightColorId;
  };
  studyIndex: string[];
  studies: Record<string, PdfStudyState>;
}

const PDF_READER_ENTRY_KEY = 'pdf';
const MAX_PDF_STUDY_RECORDS = 40;

const PDF_BACKGROUND_PRESET_IDS: PdfBackgroundPresetId[] = ['default', 'wood', 'paper', 'sage', 'night'];
const PDF_HIGHLIGHT_COLOR_IDS: PdfHighlightColorId[] = ['yellow', 'mint', 'sky', 'rose', 'violet'];

const emptyStudyState = (): PdfStudyState => ({
  bookmarks: [],
  highlights: [],
  notes: {},
  textHighlights: [],
});

const defaultStorage = (): PdfReaderStorage => ({
  preferences: {
    backgroundPreset: 'default',
    highlightColor: 'yellow',
  },
  studyIndex: [],
  studies: {},
});

const isPdfBackgroundPresetId = (value: unknown): value is PdfBackgroundPresetId => (
  typeof value === 'string' && PDF_BACKGROUND_PRESET_IDS.includes(value as PdfBackgroundPresetId)
);

const isPdfHighlightColorId = (value: unknown): value is PdfHighlightColorId => (
  typeof value === 'string' && PDF_HIGHLIGHT_COLOR_IDS.includes(value as PdfHighlightColorId)
);

const compactStudyState = (state: Partial<PdfStudyState> | null | undefined): PdfStudyState => {
  const parsedLastPage = typeof state?.lastPage === 'number' && Number.isFinite(state.lastPage) && state.lastPage > 0
    ? Math.floor(state.lastPage)
    : undefined;

  return {
    lastPage: parsedLastPage,
    bookmarks: Array.isArray(state?.bookmarks) ? state.bookmarks.filter(Number.isFinite) : [],
    highlights: Array.isArray(state?.highlights) ? state.highlights.filter(Number.isFinite) : [],
    notes: state?.notes && typeof state.notes === 'object' ? state.notes as Record<string, string> : {},
    textHighlights: Array.isArray(state?.textHighlights) ? state.textHighlights.filter((highlight) => (
      typeof highlight?.id === 'string' &&
      Number.isFinite(highlight.page) &&
      typeof highlight.text === 'string' &&
      Array.isArray(highlight.rects) &&
      (highlight.color === undefined || isPdfHighlightColorId(highlight.color))
    )) as PdfTextHighlight[] : [],
  };
};

const getStudyId = (pdfUrl: string) => {
  let hash = 0;
  for (let index = 0; index < pdfUrl.length; index += 1) {
    hash = Math.imul(31, hash) + pdfUrl.charCodeAt(index) | 0;
  }

  return `${(hash >>> 0).toString(36)}:${encodeURIComponent(pdfUrl).slice(0, 80)}`;
};

const pruneStorage = (storage: PdfReaderStorage, activeStudyId?: string): PdfReaderStorage => {
  const studyIndex = [
    ...(activeStudyId ? [activeStudyId] : []),
    ...storage.studyIndex.filter((studyId) => studyId !== activeStudyId && storage.studies[studyId]),
  ].slice(0, MAX_PDF_STUDY_RECORDS);
  const keepIds = new Set(studyIndex);
  const studies = Object.fromEntries(
    Object.entries(storage.studies).filter(([studyId]) => keepIds.has(studyId)),
  );

  return {
    ...storage,
    studyIndex,
    studies,
  };
};

const readStorage = (): PdfReaderStorage => {
  const parsed = readReaderEntry<Partial<PdfReaderStorage>>(PDF_READER_ENTRY_KEY);
  const storage = defaultStorage();

  if (parsed?.preferences) {
    storage.preferences.backgroundPreset = isPdfBackgroundPresetId(parsed.preferences.backgroundPreset)
      ? parsed.preferences.backgroundPreset
      : storage.preferences.backgroundPreset;
    storage.preferences.highlightColor = isPdfHighlightColorId(parsed.preferences.highlightColor)
      ? parsed.preferences.highlightColor
      : storage.preferences.highlightColor;
  }

  if (parsed?.studies && typeof parsed.studies === 'object') {
    storage.studies = Object.fromEntries(
      Object.entries(parsed.studies).map(([studyId, state]) => [studyId, compactStudyState(state)]),
    );
  }

  if (Array.isArray(parsed?.studyIndex)) {
    storage.studyIndex = parsed.studyIndex.filter((studyId): studyId is string => (
      typeof studyId === 'string' && Boolean(storage.studies[studyId])
    ));
  }

  return pruneStorage(storage);
};

const writeStorage = (storage: PdfReaderStorage) => {
  try {
    writeReaderEntry(PDF_READER_ENTRY_KEY, pruneStorage(storage));
  } catch {
    // Local study tools stay optional when browser storage is unavailable.
  }
};

export const readPdfBackgroundPreset = (): PdfBackgroundPresetId => {
  if (typeof window === 'undefined') return 'default';
  return readStorage().preferences.backgroundPreset;
};

export const writePdfBackgroundPreset = (preset: PdfBackgroundPresetId) => {
  if (typeof window === 'undefined') return;
  const storage = readStorage();

  writeStorage({
    ...storage,
    preferences: {
      ...storage.preferences,
      backgroundPreset: preset,
    },
  });
};

export const readPdfHighlightColor = (): PdfHighlightColorId => {
  if (typeof window === 'undefined') return 'yellow';
  return readStorage().preferences.highlightColor;
};

export const writePdfHighlightColor = (color: PdfHighlightColorId) => {
  if (typeof window === 'undefined') return;
  const storage = readStorage();

  writeStorage({
    ...storage,
    preferences: {
      ...storage.preferences,
      highlightColor: color,
    },
  });
};

export const readPdfStudyState = (pdfUrl: string): PdfStudyState => {
  if (typeof window === 'undefined') return emptyStudyState();

  const studyId = getStudyId(pdfUrl);
  const storage = readStorage();
  const studyState = storage.studies[studyId] || emptyStudyState();

  writeStorage(pruneStorage({
    ...storage,
    studies: {
      ...storage.studies,
      [studyId]: studyState,
    },
  }, studyId));

  return studyState;
};

export const writePdfStudyState = (pdfUrl: string, state: PdfStudyState) => {
  if (typeof window === 'undefined') return;

  const studyId = getStudyId(pdfUrl);
  const storage = readStorage();
  writeStorage(pruneStorage({
    ...storage,
    studies: {
      ...storage.studies,
      [studyId]: compactStudyState(state),
    },
  }, studyId));
};
