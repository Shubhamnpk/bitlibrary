import { Author, Book } from '@/types/index';
import { INITIAL_BOOKS } from '@/constants';
import type { ResourceFormat, ResourceLink } from '@/types/index';
import { ChapterAudio } from '@/types/index';

const GUTENDEX_BASE = 'https://gutendex.com/books';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
const IT_BOOKSTORE_BASE = 'https://api.itbook.store/1.0';
const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
const INTERNET_ARCHIVE_BASE = 'https://archive.org/advancedsearch.php';
const GUTENDEX_DEV_PROXY_BASE = '/api/gutendex/books';
const YOBOOK_BASE = 'https://yobook-api.vercel.app';
const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
const SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1';
const NCBI_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';
const OPENALEX_BASE = 'https://api.openalex.org/works';
const CROSSREF_BASE = 'https://api.crossref.org/works';
const DATACITE_BASE = 'https://api.datacite.org/dois';

// --- Browser Cache Configuration ---
const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_PREFIX = 'bitlibrary-book-cache-v11';
const cache: Record<string, { data: any, timestamp: number }> = {};

const getStorageKey = (key: string) => `${CACHE_STORAGE_PREFIX}:${key}`;

const getFromCache = <T>(key: string): T | null => {
  const item = cache[key];
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data as T;
  }

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;

    const stored = JSON.parse(raw) as { data: T; timestamp: number };
    if (!stored?.timestamp || Date.now() - stored.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(getStorageKey(key));
      return null;
    }

    cache[key] = stored;
    return stored.data;
  } catch {
    return null;
  }

  return null;
};

const setInCache = (key: string, data: any) => {
  const item = { data, timestamp: Date.now() };
  cache[key] = item;

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(item));
  } catch {
    // Keep the in-memory cache when persistent storage is full or blocked.
  }
};

const findBookInValue = (value: unknown, id: string, depth = 0): Book | null => {
  if (!value || depth > 5) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findBookInValue(entry, id, depth + 1);
      if (result) return result;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (record.id === id && typeof record.title === 'string') return record as unknown as Book;

  for (const nested of ['data', 'results', 'books', 'recentlyViewed']) {
    const result = findBookInValue(record[nested], id, depth + 1);
    if (result) return result;
  }

  for (const nested of Object.values(record)) {
    const result = findBookInValue(nested, id, depth + 1);
    if (result) return result;
  }

  return null;
};

const findCachedBookById = (id: string): Book | null => {
  for (const item of Object.values(cache)) {
    const result = findBookInValue(item.data, id);
    if (result) return result;
  }

  if (typeof window === 'undefined') return null;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || '';
      if (!key.startsWith(CACHE_STORAGE_PREFIX) && !key.startsWith('bitlibrary-research-cache') && key !== 'bitlibrary-local-user-v1') continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const result = findBookInValue(parsed?.data ?? parsed, id);
      if (result) return result;
    }
  } catch {
    return null;
  }

  return null;
};

const normalizeCacheKey = (value: string) => value.trim().toLowerCase();
const isAbortError = (error: unknown): boolean => {
  return (error as { name?: string })?.name === 'AbortError';
};
const getGutendexBase = () => ((import.meta as any).env?.DEV ? GUTENDEX_DEV_PROXY_BASE : GUTENDEX_BASE);
type ProviderName = 'gutendex' | 'google' | 'itbookstore' | 'openlibrary' | 'internetarchive' | 'yobook' | 'arxiv' | 'semanticscholar' | 'pubmedcentral' | 'europepmc' | 'openalex' | 'crossref' | 'datacite' | 'unpaywall';
type ProviderHealth = { disabledUntil: number; failures: number; lastWarnAt: number };
const PROVIDER_COOLDOWN_DEFAULT_MS = 3 * 60 * 1000;
const PROVIDER_HEALTH: Record<ProviderName, ProviderHealth> = {
  gutendex: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  google: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  itbookstore: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  openlibrary: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  internetarchive: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  yobook: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  arxiv: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  semanticscholar: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  pubmedcentral: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  europepmc: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  openalex: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  crossref: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  datacite: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  unpaywall: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
};
const isProviderInCooldown = (provider: ProviderName): boolean => {
  return Date.now() < PROVIDER_HEALTH[provider].disabledUntil;
};
const warnProviderCooldown = (provider: ProviderName) => {
  const health = PROVIDER_HEALTH[provider];
  const now = Date.now();
  if (now - health.lastWarnAt < 30_000) return;
  health.lastWarnAt = now;
  const secondsLeft = Math.max(0, Math.ceil((health.disabledUntil - now) / 1000));
  console.warn(`[Provider Cooldown] ${provider} temporarily paused for ${secondsLeft}s due to repeated upstream failures.`);
};
const getCooldownMs = (status?: number): number => {
  if (status === 429) return 15 * 60 * 1000;
  if (status === 503) return 5 * 60 * 1000;
  if (status && status >= 500) return 4 * 60 * 1000;
  return PROVIDER_COOLDOWN_DEFAULT_MS;
};
const markProviderFailure = (provider: ProviderName, status?: number) => {
  const health = PROVIDER_HEALTH[provider];
  health.failures += 1;
  const backoffMultiplier = Math.min(health.failures, 4);
  const cooldown = getCooldownMs(status) * backoffMultiplier;
  health.disabledUntil = Date.now() + cooldown;
};
const markProviderSuccess = (provider: ProviderName) => {
  PROVIDER_HEALTH[provider] = { disabledUntil: 0, failures: 0, lastWarnAt: 0 };
};
const toText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    const firstText = value.find((item) => typeof item === 'string');
    return typeof firstText === 'string' ? firstText : fallback;
  }
  if (typeof value === 'object') {
    const text = (value as { value?: unknown; text?: unknown }).value ?? (value as { text?: unknown }).text;
    return typeof text === 'string' ? text : fallback;
  }
  return String(value);
};

const toOptionalText = (value: unknown): string | undefined => {
  const text = toText(value, '').trim();
  return text || undefined;
};

const getAbsoluteYoBookAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${YOBOOK_BASE}${url}`;
  return url;
};

const isPdfLikeResourceUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.pdf(?:$|[?#])/i.test(url || '')
    || /[?&]ext=pdf(?:&|$)/i.test(url || '')
  )
);

const mapQuestionPapers = (items: unknown) => (
  Array.isArray(items)
    ? items
      .map((paper: any) => {
        const title = toText(paper?.title, '').trim();
        if (!title) return null;

        return {
          title,
          year: toOptionalText(paper?.year),
          readUrl: getAbsoluteYoBookAssetUrl(paper?.readUrl),
          url: getAbsoluteYoBookAssetUrl(paper?.url),
          downloadUrl: getAbsoluteYoBookAssetUrl(paper?.downloadUrl),
          sourceUrl: getAbsoluteYoBookAssetUrl(paper?.sourceUrl),
          coverUrl: getAbsoluteYoBookAssetUrl(paper?.coverUrl),
          fileSize: toOptionalText(paper?.fileSize),
        };
      })
      .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper))
    : []
);

const ARCHIVE_READABLE_FORMATS = new Set([
  'text pdf',
  'pdf',
  'epub',
  'djvu',
  'djvutxt',
  'full text',
]);

const getArchiveFormats = (item: any): string[] => {
  const formatValues = [
    ...(Array.isArray(item?.format) ? item.format : (item?.format ? [item.format] : [])),
    ...(Array.isArray(item?.files) ? item.files.map((file: any) => file?.format) : []),
  ];

  return formatValues
    .filter((format: unknown): format is string => typeof format === 'string')
    .map((format) => format.trim().toLowerCase());
};

const hasArchiveReadableFormat = (item: any): boolean => (
  getArchiveFormats(item).some((format) => ARCHIVE_READABLE_FORMATS.has(format))
);

const getArchiveDirectFileUrl = (identifier: string, item: any): string | undefined => {
  if (!identifier || !Array.isArray(item?.files)) return undefined;

  const files = item.files.filter((file: any) => typeof file?.name === 'string');
  const preferredFile = files.find((file: any) => file.format === 'Text PDF' || /\.pdf$/i.test(file.name))
    || files.find((file: any) => file.format === 'PDF')
    || files.find((file: any) => file.format === 'EPUB' || /\.epub$/i.test(file.name))
    || files.find((file: any) => file.format === 'DjVu' || /\.djvu$/i.test(file.name));

  return preferredFile ? `https://archive.org/download/${identifier}/${encodeURIComponent(preferredFile.name)}` : undefined;
};

const getArchiveFileResourceFormat = (file: any): ResourceFormat => {
  const format = String(file?.format || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (format.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf';
  if (format.includes('epub') || /\.epub$/i.test(name)) return 'epub';
  if (format.includes('djvutxt') || format.includes('full text') || /\.(?:txt|djvu\.txt)$/i.test(name)) return 'text';
  if (format.includes('xml') || /\.xml$/i.test(name)) return 'xml';
  if (/\.(?:zip|tar|gz|tgz)$/i.test(name)) return 'package';
  return 'unknown';
};

const buildArchiveResourceLinks = (identifier?: string, item?: any, provider = 'Internet Archive'): ResourceLink[] => {
  if (!identifier) return [];

  const detailUrl = `https://archive.org/details/${identifier}`;
  const links: ResourceLink[] = [
    {
      url: `https://archive.org/embed/${identifier}`,
      format: 'html',
      provider,
      label: 'Archive reader',
      relation: 'reader',
      embeddable: true,
      downloadable: false,
    },
  ];

  if (Array.isArray(item?.files)) {
    item.files
      .filter((file: any) => typeof file?.name === 'string')
      .map((file: any): ResourceLink => {
        const format = getArchiveFileResourceFormat(file);
        return {
          url: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`,
          format,
          provider,
          label: String(file.format || file.name),
          relation: 'download',
          embeddable: false,
          downloadable: true,
        };
      })
      .filter((link: ResourceLink) => ['pdf', 'epub', 'text', 'xml', 'package'].includes(link.format))
      .forEach((link: ResourceLink) => links.push(link));
  }

  links.push({
    url: detailUrl,
    format: 'source',
    provider,
    label: 'Archive details',
    relation: 'source',
    embeddable: false,
    downloadable: false,
  });

  return links.filter((link, index, list) => list.findIndex((entry) => entry.url === link.url) === index);
};

const hasOpenLibraryReadableAccess = (item: any): boolean => {
  const ebookAccess = typeof item?.ebook_access === 'string' ? item.ebook_access : '';
  return (
    item?.has_fulltext === true
    && (
      item?.public_scan_b === true
      || ebookAccess === 'public'
      || ebookAccess === 'borrowable'
    )
  );
};

const getOpenLibraryArchiveId = (item: any): string | undefined => {
  if (typeof item?.lending_identifier_s === 'string' && item.lending_identifier_s.trim()) {
    return item.lending_identifier_s.trim();
  }

  if (Array.isArray(item?.ia)) {
    return item.ia.find((identifier: unknown): identifier is string => (
      typeof identifier === 'string' && identifier.trim().length > 0
    ));
  }

  return undefined;
};

export const isPriorCurriculumEdition = (book: Pick<Book, 'title' | 'description' | 'keywords' | 'bookshelves'>): boolean => {
  const text = [
    book.title,
    book.description,
    ...(book.keywords || []),
    ...(book.bookshelves || []),
  ].join(' ').toLowerCase();

  return /\b(old|older|previous|prior)\s+(edition|textbook|version)\b|\b(old|older)\b|\u092a\u0941\u0930\u093e\u0928\u094b/.test(text);
};

const getGradeFromCategory = (category?: string): number | undefined => {
  const match = category?.match(/^(?:class|grade)\s*(\d{1,2})$/i);
  if (!match) return undefined;
  const grade = Number(match[1]);
  return grade >= 1 && grade <= 12 ? grade : undefined;
};

const getGradeFromValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && value >= 1 && value <= 12) return value;
  if (typeof value !== 'string') return undefined;
  const match = value.match(/\b(?:grade|class)?\s*(\d{1,2})\b/i);
  if (!match) return undefined;
  const grade = Number(match[1]);
  return grade >= 1 && grade <= 12 ? grade : undefined;
};

const ROMAN_GRADES: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

const NUMBER_WORD_GRADES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const GRADE_TOKEN = '(?:\\d{1,2}|[\\u0966-\\u096f]{1,2}|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two|one|xii|xi|ix|viii|vii|vi|iv|iii|ii|i|x|v)';
const GRADE_LABEL = '(?:grade|class|kaksha|\\u0915\\u0915\\u094d\\u0937\\u093e)';

const normalizeGradeToken = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\u0966-\u096f]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
);

const getGradeFromToken = (value: string): number | undefined => {
  const normalized = normalizeGradeToken(value);
  const grade = Number(normalized) || NUMBER_WORD_GRADES[normalized] || ROMAN_GRADES[normalized];
  return grade >= 1 && grade <= 12 ? grade : undefined;
};

const addGradeOrRange = (grades: Set<number>, startValue: string, endValue?: string) => {
  const startGrade = getGradeFromToken(startValue);
  const endGrade = endValue ? getGradeFromToken(endValue) : undefined;
  if (!startGrade) return;

  if (!endGrade || startGrade === endGrade) {
    grades.add(startGrade);
    return;
  }

  const [from, to] = startGrade < endGrade ? [startGrade, endGrade] : [endGrade, startGrade];
  for (let grade = from; grade <= to; grade += 1) {
    grades.add(grade);
  }
};

const getGradesFromYoBookItem = (item: any): number[] => {
  const explicitGrade = getGradeFromValue(item.grade);
  if (explicitGrade) return [explicitGrade];

  const text = [
    item.grade,
    item.title,
    item.category,
    item.description,
    item.educationLevel,
    item.curriculum,
    ...(Array.isArray(item.keywords) ? item.keywords : []),
    ...(Array.isArray(item.subjects) ? item.subjects : []),
    ...(Array.isArray(item.bookshelves) ? item.bookshelves : []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  const grades = new Set<number>();
  const labeledGradePattern = new RegExp(`${GRADE_LABEL}\\s*[-:]?\\s*(${GRADE_TOKEN})(?:\\s*(?:-|–|—|to|dekhi|\\u0926\\u0947\\u0916\\u093f)\\s*(${GRADE_TOKEN}))?`, 'gi');
  let labeledGradeMatch: RegExpExecArray | null;
  while ((labeledGradeMatch = labeledGradePattern.exec(text))) {
    addGradeOrRange(grades, labeledGradeMatch[1], labeledGradeMatch[2]);
  }

  const bookNumberPattern = new RegExp(`\\bbook\\s+(${GRADE_TOKEN})(?:\\s*(?:-|–|—|to|dekhi)\\s*(${GRADE_TOKEN}))?\\b`, 'gi');
  let bookNumberMatch: RegExpExecArray | null;
  while ((bookNumberMatch = bookNumberPattern.exec(text))) {
    addGradeOrRange(grades, bookNumberMatch[1], bookNumberMatch[2]);
  }

  const gradeKeywordPattern = new RegExp(`\\b(${GRADE_TOKEN})\\s*(?:grade|class)\\b`, 'gi');
  let gradeKeywordMatch: RegExpExecArray | null;
  while ((gradeKeywordMatch = gradeKeywordPattern.exec(text))) {
    addGradeOrRange(grades, gradeKeywordMatch[1]);
  }

  return Array.from(grades);
};
const YOBOOK_SUBJECTS = new Set([
  'English',
  'English Stories',
  'Hamro Serofero',
  'Health',
  'Mathematics',
  'NFE Level 1',
  'NFE Level 2',
  'NFE Level 3',
  'Nepali',
  'Nepali Stories',
  'Science',
  'Social Studies',
  'Audio Drama',
]);

const YOBOOK_AUDIO_SUBJECT_LABELS: Record<string, string> = {
  english: 'English',
  nepali: 'नेपाली',
  mathematics: 'Mathematics',
  science: 'Science',
  'social studies': 'Social Studies',
  health: 'Health',
};

const YOBOOK_SOURCE_LABELS: Record<string, string> = {
  'cehrd-learning': 'CEHRD Learning',
  'cehrd-audio': 'CEHRD Audio',
  'cehrd-stories': 'CEHRD Stories',
  'cehrd-nfe': 'CEHRD NFE',
  'pustakalaya-stories': 'Pustakalaya Stories',
  'pustakalaya-reference': 'Pustakalaya Reference',
  'pustakalaya-course': 'Pustakalaya Course',
  'pustakalaya-teaching': 'Pustakalaya Teaching',
  'pustakalaya-other-educational': 'Pustakalaya Educational',
  'cdc-library': 'CDC Library',
  'ncert-official': 'NCERT',
};

const getYoBookQueryType = (value?: string): 'all' | 'grade' | 'subject' | 'query' => {
  if (!value || value === 'All' || value === 'Nepali Curriculum') return 'all';
  if (getGradeFromCategory(value)) return 'grade';
  if (YOBOOK_SUBJECTS.has(value)) return 'subject';
  return 'query';
};

const getYoBookAudioSubjectFromValue = (value?: string): string | undefined => {
  if (/नेपाली|नेपালি|नेपालि/.test(value || '')) return 'नेपाली';

  const normalized = (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return undefined;
  if (['math', 'maths', 'mathematics'].includes(normalized)) return 'Mathematics';
  if (normalized.includes('english')) return 'English';
  if (normalized.includes('nepali')) return 'नेपाली';
  if (normalized.includes('science')) return 'Science';
  if (normalized.includes('social')) return 'Social Studies';
  if (normalized.includes('health')) return 'Health';
  return YOBOOK_AUDIO_SUBJECT_LABELS[normalized];
};

export const getYoBookAudioSubjectForBook = (book: Pick<Book, 'category' | 'subjects'>): string | undefined => {
  const categorySubject = getYoBookAudioSubjectFromValue(book.category);
  if (categorySubject) return categorySubject;

  return (book.subjects || [])
    .map(getYoBookAudioSubjectFromValue)
    .find((subject): subject is string => Boolean(subject));
};

// --- Neural Format Helpers ---
const formatAuthorName = (name: string): string => {
  if (!name || !name.includes(',')) return name;
  const parts = name.split(',').map(p => p.trim());
  // Standard Surname, Given format (e.g., "Shakespeare, William")
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return name;
};

// --- Archival Data Mappers ---
const mapGutendexToBook = (item: any): Book => {
  const formattedAuthors: Author[] = (item.authors || []).map((a: any) => ({
    ...a,
    name: formatAuthorName(a.name)
  }));
  const author = formattedAuthors.map((a: Author) => a.name).join(', ');

  const category = item.subjects && item.subjects.length > 0 ? item.subjects[0].split(' -- ')[0] : 'Unknown Science';
  const coverUrl = item.formats['image/jpeg'] || `https://covers.openlibrary.org/b/id/${item.id}-L.jpg`;

  // High-Fidelity Data Extraction: Prioritize authentic summaries if available in the archive
  const description = (item.summaries && item.summaries.length > 0)
    ? item.summaries[0]
    : `Classical volume found in neural archives. ${category}.`;

  return {
    id: `gutenberg-${item.id}`,
    gutenbergId: item.id,
    title: item.title,
    author,
    authors: formattedAuthors,
    category,
    description,
    coverUrl,
    popularity: Math.min(Math.round(item.download_count / 100), 100),
    downloads: item.download_count,
    subjects: item.subjects,
    bookshelves: item.bookshelves?.map((b: string) => b.replace('Category: ', '')),
    externalUrl: item.formats['text/html'] || item.formats['application/epub+zip'] || item.formats['text/plain; charset=us-ascii'] || item.formats['text/plain'],
    downloadUrl: item.formats['application/epub+zip'] || item.formats['application/pdf'] || item.formats['application/x-mobipocket-ebook'],
    source: 'Gutendex'
  };
};

const mapGoogleToBook = (item: any): Book => {
  const info = item.volumeInfo || {};
  // Neural Protocol: Use the established &output=embed parameter for direct archival linking
  const embedUrl = `https://books.google.com/books?id=${item.id}&lpg=PP1&pg=PP1&output=embed`;

  return {
    id: `google-${item.id}`,
    title: info.title || 'Unknown Volume',
    author: (info.authors || []).map(formatAuthorName).join(', ') || 'Unknown Author',
    authors: (info.authors || []).map((name: string) => ({ name: formatAuthorName(name) })),
    category: (info.categories || [])[0] || 'Uncategorized',
    description: info.description || 'No neural description found for this volume.',
    coverUrl: info.imageLinks?.thumbnail || `https://covers.openlibrary.org/b/isbn/${info.industryIdentifiers?.[0]?.identifier}-L.jpg`,
    year: parseInt(info.publishedDate?.split('-')[0]) || undefined,
    pages: info.pageCount,
    source: 'Google Books',
    externalUrl: embedUrl,
    subjects: info.categories,
    downloads: info.ratingsCount // Approximate for Google Books
  };
};

const mapOpenLibraryToBook = (item: any): Book => {
  const author = item.author_name ? item.author_name.join(', ') : 'Unknown Author';
  const coverUrl = item.cover_i 
    ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` 
    : (item.isbn && item.isbn[0]) 
      ? `https://covers.openlibrary.org/b/isbn/${item.isbn[0]}-L.jpg`
      : `https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400`;

  const archiveId = getOpenLibraryArchiveId(item);
  const externalUrl = archiveId
    ? `https://archive.org/embed/${archiveId}`
    : `https://openlibrary.org${item.key}`;
  const resourceLinks = archiveId
    ? [
      ...buildArchiveResourceLinks(archiveId, item, 'Open Library'),
      {
        url: `https://openlibrary.org${item.key}`,
        format: 'source' as const,
        provider: 'Open Library',
        label: 'Open Library record',
        relation: 'source' as const,
        embeddable: false,
        downloadable: false,
      },
    ]
    : undefined;

  const firstSentence = toText(item.first_sentence, 'Historical volume from Open Library Archive.');

  return {
    id: `ol-${item.key.replace('/works/', '')}`,
    title: item.title,
    author: (item.author_name || []).map(formatAuthorName).join(', '),
    authors: (item.author_name || []).map((name: string) => ({ name: formatAuthorName(name) })),
    category: item.subject ? item.subject[0] : 'Library Volume',
    description: firstSentence,
    coverUrl,
    year: item.first_publish_year,
    source: 'Open Library',
    subjects: item.subject?.slice(0, 5),
    popularity: item.ratings_average ? Math.round(item.ratings_average * 20) : undefined,
    downloads: item.ratings_count || 0,
    externalUrl,
    sourceUrl: `https://openlibrary.org${item.key}`,
    resourceLinks,
  };
};

const getOpenLibraryKeyId = (key?: string): string => {
  if (!key) return '';
  return key.split('/').filter(Boolean).pop() || '';
};

const fetchOpenLibraryAuthor = async (authorKey?: string): Promise<Author | null> => {
  const authorId = getOpenLibraryKeyId(authorKey);
  if (!authorId) return null;

  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE}/authors/${encodeURIComponent(authorId)}.json`);
    if (!response.ok) return null;

    const data = await response.json();
    const birthYear = parseInt(String(data.birth_date || '').match(/\d{4}/)?.[0] || '', 10);
    const deathYear = parseInt(String(data.death_date || '').match(/\d{4}/)?.[0] || '', 10);

    return {
      name: formatAuthorName(toText(data.name, 'Unknown Author')),
      birth_year: Number.isFinite(birthYear) ? birthYear : undefined,
      death_year: Number.isFinite(deathYear) ? deathYear : undefined,
    };
  } catch {
    return null;
  }
};

const fetchOpenLibrarySearchDocForWork = async (workId: string, title: string): Promise<any | null> => {
  if (!workId || title.trim().length < 3) return null;

  try {
    const fields = 'key,title,ebook_access,has_fulltext,public_scan_b,ia,lending_identifier_s';
    const response = await fetch(`${OPEN_LIBRARY_BASE}/search.json?q=${encodeURIComponent(title)}&limit=10&fields=${fields}`);
    if (!response.ok) return null;

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];
    return docs.find((doc: any) => doc.key === `/works/${workId}` && hasOpenLibraryReadableAccess(doc) && getOpenLibraryArchiveId(doc)) || null;
  } catch {
    return null;
  }
};

const mapOpenLibraryWorkToBook = async (item: any): Promise<Book> => {
  const workId = getOpenLibraryKeyId(item.key);
  const title = toText(item.title, 'Untitled Open Library Work');
  const readableSearchDoc = workId ? await fetchOpenLibrarySearchDocForWork(workId, title) : null;
  const archiveId = readableSearchDoc ? getOpenLibraryArchiveId(readableSearchDoc) : undefined;
  const openLibraryUrl = workId ? `${OPEN_LIBRARY_BASE}/works/${workId}` : OPEN_LIBRARY_BASE;
  const resourceLinks = archiveId
    ? [
      ...buildArchiveResourceLinks(archiveId, readableSearchDoc, 'Open Library'),
      {
        url: openLibraryUrl,
        format: 'source' as const,
        provider: 'Open Library',
        label: 'Open Library record',
        relation: 'source' as const,
        embeddable: false,
        downloadable: false,
      },
    ]
    : undefined;
  const authorKeys = (Array.isArray(item.authors) ? item.authors : [])
    .map((entry: any) => entry?.author?.key)
    .filter((key: unknown): key is string => typeof key === 'string')
    .slice(0, 4);
  const authors = (await Promise.all(authorKeys.map(fetchOpenLibraryAuthor)))
    .filter((author): author is Author => Boolean(author));
  const author = authors.length ? authors.map((entry) => entry.name).join(', ') : 'Unknown Author';
  const coverId = Array.isArray(item.covers) ? item.covers.find(Number.isFinite) : undefined;
  const subjects = Array.isArray(item.subjects)
    ? item.subjects.filter((subject: unknown): subject is string => typeof subject === 'string')
    : [];
  const year = parseInt(String(item.first_publish_date || '').match(/\d{4}/)?.[0] || '', 10);

  return {
    id: `ol-${workId}`,
    title,
    author,
    authors: authors.length ? authors : [{ name: author }],
    category: subjects[0] || 'Library Volume',
    description: toText(item.description, 'Historical volume from Open Library Archive.'),
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
    year: Number.isFinite(year) ? year : undefined,
    source: 'Open Library',
    subjects: subjects.slice(0, 12),
    externalUrl: archiveId ? `https://archive.org/embed/${archiveId}` : openLibraryUrl,
    sourceUrl: openLibraryUrl,
    resourceLinks,
    downloads: 0,
  };
};

const mapITToBook = (item: any): Book => {
  return {
    id: `it-${item.isbn13}`,
    title: item.title,
    author: item.subtitle || 'Tech Author',
    category: 'Technology',
    description: item.desc || 'Advanced technology archival stream.',
    coverUrl: item.image,
    source: 'IT Bookstore',
    externalUrl: item.url
  };
};

const mapArchiveToBook = (item: any): Book => {
  if (!item) return {} as Book;

  const metadata = item.metadata && item.files ? item.metadata : item;
  const creator = metadata.creator || 'Unknown Archivist';
  const author = Array.isArray(creator) ? creator.join(', ') : (typeof creator === 'string' ? creator : 'Unknown Archivist');
  const id = metadata.identifier;
  const coverUrl = `https://archive.org/services/img/${id}`;
  const detailUrl = `https://archive.org/details/${id}`;
  const externalUrl = hasArchiveReadableFormat(item) ? `https://archive.org/embed/${id}` : detailUrl;
  const downloadUrl = getArchiveDirectFileUrl(id, item);
  const resourceLinks = buildArchiveResourceLinks(id, item, 'Internet Archive');

  const subjectArray = Array.isArray(metadata.subject) 
    ? metadata.subject 
    : (typeof metadata.subject === 'string' ? [metadata.subject] : []);

  return {
    id: `ia-${id}`,
    title: metadata.title || 'Untitled Archive',
    author: author,
    authors: Array.isArray(creator) ? creator.map((n: any) => ({ name: String(n) })) : [{ name: String(author) }],
    category: subjectArray[0] || 'Historical Archive',
    description: toText(metadata.description, 'De-centralized archival node from Internet Archive.'),
    coverUrl,
    year: parseInt(String(metadata.date || '').split('-')[0]) || undefined,
    source: 'Open Library', // Grouping with Open Library since they share IA identifiers
    subjects: subjectArray.filter((s: unknown): s is string => typeof s === 'string').slice(0, 5),
    downloads: parseInt(metadata.downloads || 0),
    externalUrl,
    downloadUrl,
    resourceLinks,
    sourceUrl: detailUrl,
  };
};

const getEnvValue = (key: string): string => (
  String(((import.meta as any).env?.[key] || '')).trim()
);

const getResearchProxyUrl = (provider: string, params: Record<string, string>): string => {
  const searchParams = new URLSearchParams({ provider, ...params });
  return `/api/research-proxy?${searchParams.toString()}`;
};

const getAcademicCoverUrl = (source: string) => {
  const seed = encodeURIComponent(source);
  return `https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400&seed=${seed}`;
};

const stripMarkup = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const stableResearchId = (prefix: string, value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
};

const encodeResearchIdPart = (value: string) => encodeURIComponent(value).replace(/%/g, '~');
const decodeResearchIdPart = (value: string) => decodeURIComponent(value.replace(/~/g, '%'));

const getEuropePmcBookId = (item: any) => {
  const pmcid = toText(item.pmcid);
  const externalId = toText(item.id || item.pmid);
  const doi = normalizeDoi(item.doi);
  if (pmcid) return `epmc-${encodeResearchIdPart(pmcid)}`;
  if (externalId) return `epmc-ext-${encodeResearchIdPart(externalId)}`;
  if (doi) return `epmc-doi-${encodeResearchIdPart(doi)}`;
  return stableResearchId('epmc', toText(item.title));
};

const getOpenAlexBookId = (work: any) => {
  const workId = toText(work.id).replace(/^https:\/\/openalex\.org\//i, '');
  const doi = normalizeDoi(work.doi);
  if (workId) return `openalex-${encodeResearchIdPart(workId)}`;
  if (doi) return `openalex-doi-${encodeResearchIdPart(doi)}`;
  return stableResearchId('openalex', toText(work.display_name || work.title));
};

const getCrossrefBookId = (item: any) => {
  const doi = normalizeDoi(item.DOI);
  if (doi) return `crossref-doi-${encodeResearchIdPart(doi)}`;
  return stableResearchId('crossref', item.URL || toText(Array.isArray(item.title) ? item.title[0] : item.title));
};

const getDataCiteBookId = (item: any) => {
  const doi = normalizeDoi(item.attributes?.doi || item.id);
  if (doi) return `datacite-doi-${encodeResearchIdPart(doi)}`;
  return stableResearchId('datacite', item.id || toText(item.attributes?.title));
};

const isResearchPdfUrl = (url?: string) => /\.pdf(?:$|[?#])/i.test(url || '') || /\/pdf\/?$/i.test(url || '') || /\/api\/getpdf(?:$|[?#])/i.test(url || '') || /[?&](?:format|type|ext)=pdf(?:&|$)/i.test(url || '');
const isResearchEpubUrl = (url?: string) => /\.epub(?:$|[?#])/i.test(url || '') || /[?&](?:format|type|ext)=epub(?:&|$)/i.test(url || '');
const isResearchXmlUrl = (url?: string) => /\.xml(?:$|[?#])/i.test(url || '') || /fulltextxml/i.test(url || '') || /[?&](?:format|type|ext)=xml(?:&|$)/i.test(url || '');
const isResearchTextUrl = (url?: string) => /\.txt(?:$|[?#])/i.test(url || '') || /[?&](?:format|type|ext)=(?:txt|text)(?:&|$)/i.test(url || '');
const isResearchPackageUrl = (url?: string) => /\.(?:tar\.gz|tgz|zip|gz)(?:$|[?#])/i.test(url || '');
const RESEARCH_READER_BLOCKED_HOSTS = new Set([
  'academic.oup.com',
  'mdpi.com',
  'pmc.ncbi.nlm.nih.gov',
  'www.mdpi.com',
  'www.ncbi.nlm.nih.gov',
]);

const isBlockedResearchReaderUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return RESEARCH_READER_BLOCKED_HOSTS.has(hostname);
  } catch {
    return true;
  }
};

const normalizeResearchUrl = (value?: string) => {
  const url = toText(value);
  if (!url) return '';
  if (/^ftp:\/\/ftp\.ncbi\.nlm\.nih\.gov\//i.test(url)) {
    return url.replace(/^ftp:\/\/ftp\.ncbi\.nlm\.nih\.gov/i, 'https://ftp.ncbi.nlm.nih.gov');
  }
  return url;
};

const getResearchFormat = (url: string, type = '', label = ''): ResourceFormat => {
  const signature = `${type} ${label}`.toLowerCase();
  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (hostname === 'doi.org' || hostname === 'dx.doi.org' || signature.includes('doi') || signature.includes('landing') || signature.includes('source page')) return 'source';
  if (isResearchPdfUrl(url) || signature.includes('pdf') || signature.includes('application/pdf')) return 'pdf';
  if (isResearchEpubUrl(url) || signature.includes('epub')) return 'epub';
  if (isResearchXmlUrl(url) || signature.includes('xml') || signature.includes('jats') || signature.includes('bioc')) return 'xml';
  if (isResearchPackageUrl(url) || signature.includes('tgz') || signature.includes('tar') || signature.includes('package')) return 'package';
  if (/html?/i.test(signature) || signature.includes('fulltext') || signature.includes('full text') || /\.html?(?:$|[?#])/i.test(url)) return 'html';
  if (isResearchTextUrl(url) || signature.includes('text/plain') || signature === 'text' || signature.includes(' plain text')) return 'text';
  return 'unknown';
};

const isEmbeddableResearchResource = (url: string, format: ResourceFormat) => {
  if (format === 'pdf' || format === 'text' || format === 'xml') return true;
  return false;
};

const buildResearchResourceLinks = (
  items: Array<{ url?: string; type?: string; label?: string; provider?: string; relation?: ResourceLink['relation'] }>,
  provider: string,
): ResourceLink[] => {
  const seen = new Set<string>();
  return items
    .map((item) => {
      const url = normalizeResearchUrl(item.url);
      const type = toText(item.type);
      const label = toText(item.label);
      const format = getResearchFormat(url, type, label);
      const relation = item.relation || (format === 'source' || format === 'html' || format === 'unknown' ? 'source' : 'download');
      return {
        url,
        format,
        provider: item.provider || provider,
        label: label || type || format,
        relation,
        embeddable: isEmbeddableResearchResource(url, format),
        downloadable: ['pdf', 'text', 'xml', 'epub', 'package'].includes(format),
      };
    })
    .filter((item) => {
      if (!/^https?:\/\//i.test(item.url)) return false;
      const key = item.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const chooseResearchResourceUrls = (resourceLinks: ResourceLink[]) => {
  const byFormat = (formats: ResourceFormat[], predicate: (link: ResourceLink) => boolean = () => true) => (
    formats.flatMap((format) => resourceLinks.filter((link) => (
      link.format === format
      && link.relation !== 'source'
      && link.relation !== 'doi'
      && link.relation !== 'metadata'
      && predicate(link)
    )))[0]
  );
  const reader = byFormat(['pdf', 'text', 'xml'], (link) => link.embeddable !== false)
    || byFormat(['epub']);
  const download = byFormat(['pdf', 'text', 'xml', 'epub', 'package'], (link) => link.downloadable !== false);

  return {
    readerUrl: reader?.url,
    downloadUrl: download?.url,
  };
};

const choosePmcResourceUrls = (resourceLinks: ResourceLink[]) => {
  const byFormat = (formats: ResourceFormat[], predicate: (link: ResourceLink) => boolean = () => true) => (
    formats.flatMap((format) => resourceLinks.filter((link) => (
      link.format === format
      && link.relation !== 'source'
      && link.relation !== 'doi'
      && link.relation !== 'metadata'
      && predicate(link)
    )))[0]
  );
  const reader = byFormat(['xml', 'text'], (link) => link.embeddable !== false)
    || byFormat(['pdf'], (link) => link.embeddable !== false);
  const download = byFormat(['pdf', 'xml', 'text', 'epub', 'package'], (link) => link.downloadable !== false);

  return {
    readerUrl: reader?.url,
    downloadUrl: download?.url,
  };
};

const hasUsableResearchResource = (book: Book): boolean => (
  (book.resourceLinks || []).some((link) => (
    ['pdf', 'text', 'xml', 'epub'].includes(link.format)
    && link.relation !== 'source'
    && link.relation !== 'doi'
    && (link.embeddable !== false || link.downloadable !== false)
  ))
);

const normalizeDoi = (value?: string | null): string | undefined => {
  const doi = (value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  return doi && /^10\.\S+\/\S+/.test(doi) ? doi : undefined;
};

const getFirstXmlText = (entry: Element, tagName: string): string => {
  return entry.getElementsByTagName(tagName)[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
};

const getArxivId = (idUrl: string) => idUrl.split('/abs/').pop()?.trim() || idUrl.split('/').pop()?.trim() || idUrl;
const getArxivPdfUrl = (arxivId: string, href?: string | null) => {
  const url = normalizeResearchUrl(href || `https://arxiv.org/pdf/${arxivId}`);
  return /\.pdf(?:$|[?#])/i.test(url) ? url : `${url.replace(/\/$/, '')}.pdf`;
};

const mapArxivEntryToBook = (entry: Element): Book => {
  const idUrl = getFirstXmlText(entry, 'id');
  const arxivId = getArxivId(idUrl);
  const authors = Array.from(entry.getElementsByTagName('author'))
    .map((author) => getFirstXmlText(author, 'name'))
    .filter(Boolean);
  const links = Array.from(entry.getElementsByTagName('link'));
  const pdfUrl = getArxivPdfUrl(arxivId, links.find((link) => (
    link.getAttribute('title') === 'pdf'
    || link.getAttribute('type') === 'application/pdf'
  ))?.getAttribute('href'));
  const primaryCategory = Array.from(entry.getElementsByTagName('arxiv:primary_category'))[0]?.getAttribute('term')
    || Array.from(entry.getElementsByTagName('category'))[0]?.getAttribute('term')
    || 'Research Paper';
  const publishedYear = parseInt(getFirstXmlText(entry, 'published').slice(0, 4), 10);
  const doi = normalizeDoi(getFirstXmlText(entry, 'arxiv:doi') || getFirstXmlText(entry, 'doi'));
  const resourceLinks = buildResearchResourceLinks([
    { url: pdfUrl, type: 'application/pdf', label: 'PDF', provider: 'arXiv', relation: 'download' },
    { url: idUrl || `https://arxiv.org/abs/${arxivId}`, label: 'source page', provider: 'arXiv', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'arXiv');
  const readable = chooseResearchResourceUrls(resourceLinks);

  return {
    id: `arxiv-${arxivId}`,
    title: getFirstXmlText(entry, 'title') || 'Untitled arXiv Paper',
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name) => ({ name })),
    category: primaryCategory,
    description: getFirstXmlText(entry, 'summary') || 'Academic preprint from arXiv.',
    coverUrl: getAcademicCoverUrl('arxiv'),
    year: Number.isFinite(publishedYear) ? publishedYear : undefined,
    source: 'arXiv',
    subjects: [primaryCategory],
    keywords: [arxivId, ...(doi ? [doi] : [])],
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl: idUrl || `https://arxiv.org/abs/${arxivId}`,
    downloads: 0,
  };
};

const mapSemanticScholarPaperToBook = (paper: any): Book => {
  const authors = Array.isArray(paper.authors) ? paper.authors.map((author: any) => toText(author?.name)).filter(Boolean) : [];
  const fieldsOfStudy = Array.isArray(paper.fieldsOfStudy) ? paper.fieldsOfStudy.filter((field: unknown): field is string => typeof field === 'string') : [];
  const doi = normalizeDoi(paper.externalIds?.DOI);
  const openPdfUrl = toText(paper.openAccessPdf?.url);
  const resourceLinks = buildResearchResourceLinks([
    { url: openPdfUrl, type: 'application/pdf', label: 'PDF', provider: 'Semantic Scholar', relation: 'download' },
    { url: paper.url, label: 'source page', provider: 'Semantic Scholar', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'Semantic Scholar');
  const readable = chooseResearchResourceUrls(resourceLinks);

  return {
    id: `s2-${paper.paperId}`,
    title: toText(paper.title, 'Untitled Semantic Scholar Paper'),
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name: string) => ({ name })),
    category: fieldsOfStudy[0] || toText(paper.venue, 'Research Paper'),
    description: toText(paper.abstract, 'Academic paper indexed by Semantic Scholar.'),
    coverUrl: getAcademicCoverUrl('semantic-scholar'),
    year: Number.isFinite(Number(paper.year)) ? Number(paper.year) : undefined,
    source: 'Semantic Scholar',
    subjects: fieldsOfStudy.slice(0, 8),
    keywords: [paper.paperId, ...(doi ? [doi] : [])].filter(Boolean),
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl: paper.url,
    downloads: Number(paper.citationCount || 0),
  };
};

const decodeOpenAlexAbstract = (abstractIndex: any): string => {
  if (!abstractIndex || typeof abstractIndex !== 'object') return '';
  const words: Array<[string, number]> = [];
  Object.entries(abstractIndex).forEach(([word, positions]) => {
    if (!Array.isArray(positions)) return;
    positions.forEach((position) => {
      if (Number.isFinite(position)) words.push([word, Number(position)]);
    });
  });

  return words.sort((a, b) => a[1] - b[1]).map(([word]) => word).join(' ');
};

const mapOpenAlexWorkToBook = (work: any): Book => {
  const authors = (Array.isArray(work.authorships) ? work.authorships : [])
    .map((entry: any) => toText(entry?.author?.display_name))
    .filter(Boolean);
  const topics = [
    ...(Array.isArray(work.topics) ? work.topics.map((topic: any) => toText(topic?.display_name)) : []),
    ...(Array.isArray(work.concepts) ? work.concepts.map((concept: any) => toText(concept?.display_name)) : []),
  ].filter(Boolean);
  const doi = normalizeDoi(work.doi);
  const sourceUrl = toText(work.primary_location?.landing_page_url) || toText(work.id) || (doi ? `https://doi.org/${doi}` : undefined);
  const openAlexLocations = [
    work.best_oa_location,
    work.primary_location,
    ...(Array.isArray(work.locations) ? work.locations : []),
  ].filter(Boolean);
  const resourceLinks = buildResearchResourceLinks([
    ...openAlexLocations.flatMap((location: any) => ([
      { url: location?.pdf_url || location?.url_for_pdf, type: 'application/pdf', label: 'PDF', provider: 'OpenAlex', relation: 'download' as const },
      { url: location?.landing_page_url || location?.url, type: location?.is_oa ? 'text/html' : '', label: location?.is_oa ? 'open access html' : 'source page', provider: 'OpenAlex', relation: 'source' as const },
    ])),
    { url: sourceUrl, label: 'source page', provider: 'OpenAlex', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'OpenAlex');
  const readable = chooseResearchResourceUrls(resourceLinks);

  return {
    id: getOpenAlexBookId(work),
    title: toText(work.title || work.display_name, 'Untitled OpenAlex Work'),
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name: string) => ({ name })),
    category: topics[0] || toText(work.primary_location?.source?.display_name, 'Research Work'),
    description: decodeOpenAlexAbstract(work.abstract_inverted_index) || 'Scholarly work indexed by OpenAlex.',
    coverUrl: getAcademicCoverUrl('openalex'),
    year: Number.isFinite(Number(work.publication_year)) ? Number(work.publication_year) : undefined,
    source: 'OpenAlex',
    subjects: topics.slice(0, 8),
    keywords: [toText(work.id), ...(doi ? [doi] : [])].filter(Boolean),
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl,
    downloads: Number(work.cited_by_count || 0),
  };
};

const getCrossrefDateYear = (item: any): number | undefined => {
  const dateParts = item?.published?.['date-parts'] || item?.published_print?.['date-parts'] || item?.published_online?.['date-parts'];
  const year = Number(Array.isArray(dateParts) ? dateParts[0]?.[0] : undefined);
  return Number.isFinite(year) ? year : undefined;
};

const CROSSREF_BOOK_TYPES = new Set([
  'book',
  'book-chapter',
  'book-part',
  'book-section',
  'edited-book',
  'monograph',
  'reference-book',
  'reference-entry',
]);

const chooseCrossrefResourceUrls = (resourceLinks: ResourceLink[]) => {
  const findByFormat = (formats: ResourceFormat[]) => (
    formats.flatMap((format) => resourceLinks.filter((link) => (
      link.format === format
      && link.relation !== 'source'
      && link.relation !== 'doi'
      && link.relation !== 'metadata'
      && link.embeddable !== false
    )))[0]
  );
  const reader = findByFormat(['xml', 'text']) || findByFormat(['pdf']);
  const download = resourceLinks.find((link) => link.format === 'pdf' && !['source', 'doi', 'metadata'].includes(link.relation || '') && link.downloadable !== false)
    || resourceLinks.find((link) => ['xml', 'text', 'epub', 'package'].includes(link.format) && !['source', 'doi', 'metadata'].includes(link.relation || '') && link.downloadable !== false);

  return {
    readerUrl: reader?.url,
    downloadUrl: download?.url,
  };
};

const mapCrossrefWorkToBook = (item: any): Book => {
  const authors = (Array.isArray(item.author) ? item.author : [])
    .map((author: any) => [author.given, author.family].filter(Boolean).join(' ').trim())
    .filter(Boolean);
  const title = Array.isArray(item.title) ? item.title[0] : item.title;
  const subjects = Array.isArray(item.subject) ? item.subject.filter((subject: unknown): subject is string => typeof subject === 'string') : [];
  const doi = normalizeDoi(item.DOI);
  const sourceUrl = item.URL || (doi ? `https://doi.org/${doi}` : undefined);
  const resourceLinks = buildResearchResourceLinks([
    ...(Array.isArray(item.link) ? item.link : []).map((link: any) => ({
      url: link?.URL || link?.url,
      type: link?.['content-type'] || link?.contentType,
      label: link?.['intended-application'] || link?.type || 'full text',
      provider: 'Crossref',
      relation: 'download' as const,
    })),
    { url: sourceUrl, label: 'source page', provider: 'Crossref', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'Crossref');
  const readable = chooseCrossrefResourceUrls(resourceLinks);

  return {
    id: getCrossrefBookId(item),
    title: toText(title, 'Untitled Crossref Work'),
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name: string) => ({ name })),
    category: subjects[0] || toText(item.type, 'Research Work'),
    description: stripMarkup(toText(item.abstract, 'Scholarly metadata record from Crossref.')),
    coverUrl: getAcademicCoverUrl('crossref'),
    year: getCrossrefDateYear(item),
    source: 'Crossref',
    subjects: subjects.slice(0, 8),
    keywords: [doi, item.URL].filter(Boolean),
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl,
    downloads: Number(item['is-referenced-by-count'] || 0),
  };
};

const mapEuropePmcWorkToBook = (item: any): Book => {
  const authors = Array.isArray(item?.authorList?.author)
    ? item.authorList.author.map((author: any) => toText(author?.fullName)).filter(Boolean)
    : toText(item.authorString).split(',').map((author) => author.trim()).filter(Boolean);
  const doi = normalizeDoi(item.doi);
  const pmcid = toText(item.pmcid);
  const sourceUrl = toText(item.fullTextUrl) || (pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/` : `https://europepmc.org/article/${toText(item.source, 'MED')}/${toText(item.id)}`);
  const fullTextEntries = Array.isArray(item?.fullTextUrlList?.fullTextUrl) ? item.fullTextUrlList.fullTextUrl : [];
  const resourceLinks = buildResearchResourceLinks([
    ...fullTextEntries.map((entry: any) => ({
      url: entry?.url,
      type: entry?.documentStyle,
      label: [entry?.availability, entry?.site, entry?.documentStyle].filter(Boolean).join(' '),
      provider: entry?.site || 'Europe PMC',
      relation: 'download' as const,
    })),
    ...(pmcid ? [
      { url: `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`, type: 'application/xml', label: 'Full text XML', provider: 'Europe PMC', relation: 'reader' as const },
    ] : []),
    { url: sourceUrl, label: 'source page', provider: 'Europe PMC', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'Europe PMC');
  const readable = chooseResearchResourceUrls(resourceLinks);

  return {
    id: getEuropePmcBookId(item),
    title: toText(item.title, 'Untitled Europe PMC Article'),
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name: string) => ({ name })),
    category: toText(item.journalTitle, 'Biomedical Research'),
    description: stripMarkup(toText(item.abstractText, 'Publication record indexed by Europe PMC.')),
    coverUrl: getAcademicCoverUrl('europe-pmc'),
    year: Number.isFinite(Number(item.pubYear)) ? Number(item.pubYear) : undefined,
    source: 'Europe PMC',
    subjects: [toText(item.journalTitle, 'Biomedical Research')],
    keywords: [toText(item.id), pmcid, ...(doi ? [doi] : [])].filter(Boolean),
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl,
    downloads: Number(item.citedByCount || 0),
  };
};

const mapDataCiteDoiToBook = (item: any): Book => {
  const attributes = item.attributes || {};
  const authors = (Array.isArray(attributes.creators) ? attributes.creators : [])
    .map((creator: any) => toText(creator?.name))
    .filter(Boolean);
  const title = Array.isArray(attributes.titles) ? attributes.titles[0]?.title : attributes.title;
  const subjects = (Array.isArray(attributes.subjects) ? attributes.subjects : [])
    .map((subject: any) => toText(subject?.subject || subject))
    .filter(Boolean);
  const description = (Array.isArray(attributes.descriptions) ? attributes.descriptions : [])
    .map((entry: any) => toText(entry?.description))
    .find(Boolean);
  const doi = normalizeDoi(attributes.doi || item.id);
  const contentUrls = Array.isArray(attributes.contentUrl) ? attributes.contentUrl : (attributes.contentUrl ? [attributes.contentUrl] : []);
  const relatedUrls = Array.isArray(attributes.relatedIdentifiers)
    ? attributes.relatedIdentifiers
    : [];
  const sourceUrl = toText(attributes.url) || (doi ? `https://doi.org/${doi}` : undefined);
  const resourceLinks = buildResearchResourceLinks([
    ...contentUrls.map((url: unknown) => ({ url: toText(url), label: 'content', provider: 'DataCite', relation: 'download' as const })),
    ...relatedUrls.map((entry: any) => ({
      url: entry?.relatedIdentifier,
      type: entry?.relatedIdentifierType,
      label: entry?.relationType || 'related',
      provider: 'DataCite',
      relation: 'metadata' as const,
    })),
    { url: sourceUrl, label: 'source page', provider: 'DataCite', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'DataCite');
  const readable = chooseResearchResourceUrls(resourceLinks);

  return {
    id: getDataCiteBookId(item),
    title: toText(title, 'Untitled DataCite Record'),
    author: authors.join(', ') || 'Unknown Creators',
    authors: authors.map((name: string) => ({ name })),
    category: toText(attributes.types?.resourceTypeGeneral || attributes.types?.resourceType, 'Research Output'),
    description: stripMarkup(description || 'Research output metadata from DataCite.'),
    coverUrl: getAcademicCoverUrl('datacite'),
    year: Number.isFinite(Number(attributes.publicationYear)) ? Number(attributes.publicationYear) : undefined,
    source: 'DataCite',
    subjects: subjects.slice(0, 8),
    keywords: [doi, item.id].filter(Boolean),
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl,
    downloads: Number(attributes.citationCount || 0),
  };
};

const getZenodoRecordIdFromDoi = (doi?: string): string | undefined => {
  const match = normalizeDoi(doi)?.match(/^10\.5281\/zenodo\.(\d+)$/i);
  return match?.[1];
};

const fetchZenodoResourceLinks = async (doi?: string, signal?: AbortSignal): Promise<ResourceLink[]> => {
  const recordId = getZenodoRecordIdFromDoi(doi);
  if (!recordId) return [];

  try {
    const response = await fetch(getResearchProxyUrl('zenodo-record', { recordId }), { signal });
    if (!response.ok) return [];

    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];
    return buildResearchResourceLinks(files.map((file: any) => ({
      url: file?.links?.self,
      type: file?.type || file?.mimetype,
      label: file?.key || 'Zenodo file',
      provider: 'Zenodo',
      relation: 'download' as const,
    })), 'Zenodo');
  } catch {
    return [];
  }
};

const enrichDataCiteWithRepositoryFiles = async (books: Book[], signal?: AbortSignal): Promise<Book[]> => {
  const enriched = await Promise.all(books.map(async (book) => {
    const doi = book.keywords?.map(normalizeDoi).find(Boolean);
    const repositoryLinks = await fetchZenodoResourceLinks(doi, signal);
    if (repositoryLinks.length === 0) return book;

    const resourceLinks = buildResearchResourceLinks([
      ...(book.resourceLinks || []),
      ...repositoryLinks,
    ], 'DataCite');
    const readable = chooseResearchResourceUrls(resourceLinks);

    return {
      ...book,
      externalUrl: readable.readerUrl || book.externalUrl,
      downloadUrl: readable.downloadUrl || book.downloadUrl,
      resourceLinks,
      providerSource: book.providerSource || 'Zenodo',
    };
  }));

  return enriched.filter(hasUsableResearchResource);
};

const getPmcArticleId = (item: any, type: string): string | undefined => {
  const ids = Array.isArray(item?.articleids) ? item.articleids : [];
  return ids.find((entry: any) => String(entry?.idtype || '').toLowerCase() === type)?.value;
};

const mapPmcSummaryToBook = (item: any): Book => {
  const authors = Array.isArray(item.authors) ? item.authors.map((author: any) => toText(author?.name)).filter(Boolean) : [];
  const pmcid = getPmcArticleId(item, 'pmc') || `PMC${item.uid}`;
  const doi = normalizeDoi(getPmcArticleId(item, 'doi'));
  const year = parseInt(String(item.pubdate || '').match(/\d{4}/)?.[0] || '', 10);
  const articleUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`;
  const resourceLinks = buildResearchResourceLinks([
    { url: `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_xml/${pmcid}/unicode`, type: 'application/xml', label: 'BioC full text XML', provider: 'PubMed Central BioC', relation: 'reader' },
    { url: `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/${pmcid}/unicode`, type: 'application/json', label: 'BioC full text JSON', provider: 'PubMed Central BioC', relation: 'download' },
    { url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf/`, type: 'application/pdf', label: 'PDF', provider: 'PubMed Central', relation: 'download' },
    { url: articleUrl, label: 'source page', provider: 'PubMed Central', relation: 'source' },
    ...(doi ? [{ url: `https://doi.org/${doi}`, label: 'doi', provider: 'DOI', relation: 'doi' as const }] : []),
  ], 'PubMed Central');
  const readable = choosePmcResourceUrls(resourceLinks);

  return {
    id: `pmc-${item.uid}`,
    title: toText(item.title, 'Untitled PubMed Central Article'),
    author: authors.join(', ') || 'Unknown Authors',
    authors: authors.map((name: string) => ({ name })),
    category: toText(item.fulljournalname, 'Biomedical Research'),
    description: [
      toText(item.fulljournalname),
      toText(item.pubdate),
      doi ? `DOI: ${doi}` : '',
    ].filter(Boolean).join(' | ') || 'Open biomedical article from PubMed Central.',
    coverUrl: getAcademicCoverUrl('pubmed-central'),
    year: Number.isFinite(year) ? year : undefined,
    source: 'PubMed Central',
    subjects: [toText(item.fulljournalname, 'Biomedical Research')],
    keywords: [pmcid, ...(doi ? [doi] : [])],
    externalUrl: readable.readerUrl,
    downloadUrl: readable.downloadUrl,
    resourceLinks,
    sourceUrl: articleUrl,
    downloads: 0,
  };
};

const fetchUnpaywallResourceLinks = async (doi: string, signal?: AbortSignal): Promise<ResourceLink[]> => {
  const email = getEnvValue('VITE_UNPAYWALL_EMAIL');
  if (!email || isProviderInCooldown('unpaywall')) return [];

  try {
    const response = await fetch(getResearchProxyUrl('unpaywall', { doi, email }), { signal });
    if (!response.ok) {
      markProviderFailure('unpaywall', response.status);
      return [];
    }

    const data = await response.json();
    const location = data.best_oa_location || {};
    const resourceLinks = buildResearchResourceLinks([
      { url: location.url_for_pdf, type: 'application/pdf', label: 'best open access PDF', provider: 'Unpaywall', relation: 'download' },
      { url: location.url_for_landing_page || location.url, type: 'text/html', label: 'landing page', provider: 'Unpaywall', relation: 'source' },
      ...((Array.isArray(data.oa_locations) ? data.oa_locations : []).flatMap((entry: any) => ([
        { url: entry?.url_for_pdf, type: 'application/pdf', label: [entry?.host_type, entry?.version, 'PDF'].filter(Boolean).join(' '), provider: 'Unpaywall', relation: 'download' as const },
        { url: entry?.url_for_landing_page || entry?.url, type: 'text/html', label: [entry?.host_type, entry?.version, 'landing page'].filter(Boolean).join(' '), provider: 'Unpaywall', relation: 'source' as const },
      ]))),
    ], 'Unpaywall');
    markProviderSuccess('unpaywall');
    return resourceLinks;
  } catch (error) {
    if (!isAbortError(error)) markProviderFailure('unpaywall');
    return [];
  }
};

const enrichWithUnpaywall = async (books: Book[], signal?: AbortSignal): Promise<Book[]> => {
  const email = getEnvValue('VITE_UNPAYWALL_EMAIL');
  if (!email) return books;

  const enriched = await Promise.all(books.map(async (book, index) => {
    if (index >= 12) return book;
    const doi = book.keywords?.map(normalizeDoi).find(Boolean);
    if (!doi) return book;
    const oaLinks = await fetchUnpaywallResourceLinks(doi, signal);
    if (oaLinks.length === 0) return book;
    const resourceLinks = buildResearchResourceLinks([
      ...(book.resourceLinks || []),
      ...oaLinks,
    ], book.source || 'Research');
    const readable = chooseResearchResourceUrls(resourceLinks);
    return {
      ...book,
      downloadUrl: book.downloadUrl || readable.downloadUrl,
      externalUrl: book.externalUrl || readable.readerUrl,
      resourceLinks,
      providerSource: 'Unpaywall',
    };
  }));

  return enriched;
};

const mapYoBookToBook = (item: any): Book => {
  const grade = getGradeFromValue(item.grade);
  const subject = toText(item.subject, item.category || 'Textbook');
  const curriculum = toText(item.curriculum, item.country === 'in' || item.source === 'ncert-official' ? 'NCERT' : 'CDC Nepal');
  const language = toText(item.language, 'en');
  const questionPapers = mapQuestionPapers(item.question_papers);
  const isQuestionPaperCollection = questionPapers.length > 0;
  const pdfUrl = getAbsoluteYoBookAssetUrl(item.pdfUrl);
  const audioUrl = getAbsoluteYoBookAssetUrl(item.audioUrl);
  const readUrl = getAbsoluteYoBookAssetUrl(item.readUrl);
  const chapterPdfUrls = Array.isArray(item.chapterPdfUrls)
    ? item.chapterPdfUrls
      .map((chapter: any) => ({
        title: toText(chapter?.title, 'Chapter'),
        pdfUrl: getAbsoluteYoBookAssetUrl(chapter?.pdfUrl) || '',
      }))
      .filter((chapter: { title: string; pdfUrl: string }) => isPdfLikeResourceUrl(chapter.pdfUrl))
    : [];
  const chapterPdfUrl = chapterPdfUrls[0]?.pdfUrl;
  const zipUrl = getAbsoluteYoBookAssetUrl(item.zipUrl);
  const coverUrl = getAbsoluteYoBookAssetUrl(item.coverUrl || item.localCoverUrl);
  const sourceUrl = getAbsoluteYoBookAssetUrl(item.sourceUrl);
  const detailUrl = getAbsoluteYoBookAssetUrl(item.detailUrl);
  const sourceKey = toText(item.source, 'yobook');
  const sourceLabel = YOBOOK_SOURCE_LABELS[sourceKey] || sourceKey;
  const category = toText(item.category, subject || 'Educational Resource');
  const collectionName = toText(item.collection_name, '');
  const keywords = Array.isArray(item.keywords)
    ? item.keywords.filter((keyword: unknown): keyword is string => typeof keyword === 'string')
    : [];
  const subjects = [
    subject,
    grade ? `Class ${grade}` : undefined,
    item.level ? `Level ${item.level}` : undefined,
    category,
    curriculum,
    sourceLabel,
    'Nepali Curriculum',
    curriculum === 'NCERT' ? 'NCERT Curriculum' : undefined,
    'CEHRD',
    'Pustakalaya',
    ...keywords,
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value as string) === index);
  const primaryResourceUrl = isQuestionPaperCollection ? undefined : (pdfUrl || chapterPdfUrl || audioUrl || readUrl || sourceUrl);
  const downloadResourceUrl = isQuestionPaperCollection ? undefined : (pdfUrl || (isPdfLikeResourceUrl(readUrl) ? readUrl : undefined) || chapterPdfUrl || zipUrl || audioUrl);

  return {
    id: `yobook-${item.id}`,
    title: toText(item.title, 'Nepal Educational Resource'),
    author: collectionName || toText(item.author, 'Centre for Education and Human Resource Development'),
    authors: [{ name: collectionName || toText(item.author, 'Centre for Education and Human Resource Development') }],
    category: subject || category,
    description: toText(
      item.description,
      isQuestionPaperCollection
        ? `${collectionName || sourceLabel} collection with ${questionPapers.length} question papers.`
        : `${subject || category}${grade ? ` for Class ${grade}` : ''} from ${sourceLabel}.`
    ),
    coverUrl,
    subjects,
    keywords,
    bookshelves: [grade ? `Class ${grade}` : '', item.level ? `Level ${item.level}` : '', curriculum, sourceLabel, 'Nepali Curriculum'].filter(Boolean),
    externalUrl: primaryResourceUrl,
    downloadUrl: downloadResourceUrl,
    audioUrl,
    detailUrl,
    sourceUrl,
    chapterPdfUrls,
    collection_name: collectionName || undefined,
    question_papers: questionPapers.length > 0 ? questionPapers : undefined,
    questionPaperCount: questionPapers.length > 0 ? questionPapers.length : undefined,
    providerSource: sourceKey,
    source: isQuestionPaperCollection ? sourceKey : 'YoBook',
    grade,
    level: typeof item.level === 'number' ? item.level : undefined,
    curriculum,
    language,
    country: toText(item.country, 'np'),
    year: item.scrapedAt ? new Date(item.scrapedAt).getFullYear() : undefined,
    popularity: grade ? Math.max(50, 100 - Math.abs(grade - 6) * 3) : 75,
    downloads: 0,
  };
};

const fetchYoBookEndpointPage = async (endpoint: 'textbooks' | 'teacher-guides', page: number, signal?: AbortSignal): Promise<{ items: any[]; pages: number }> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: '200',
    full: 'true',
  });
  const response = await fetch(`${YOBOOK_BASE}/api/${endpoint}?${params.toString()}`, { signal });
  if (!response.ok) {
    markProviderFailure('yobook', response.status);
    return { items: [], pages: 0 };
  }

  const data = await response.json();
  return {
    items: Array.isArray(data.data) ? data.data : [],
    pages: Number(data.meta?.pages || 1),
  };
};

export interface YoBookGradeCollection {
  rows: Record<number, Book[]>;
  ungraded: Book[];
}

const booksToGradeCollection = (books: Book[]): YoBookGradeCollection => {
  const ungraded: Book[] = [];
  const rows = books.reduce((gradeRows: Record<number, Book[]>, book) => {
    const grades = getGradesFromYoBookItem(book);
    if (grades.length === 0) {
      ungraded.push(book);
      return gradeRows;
    }

    grades.forEach((grade) => {
      gradeRows[grade] = gradeRows[grade] || [];
      gradeRows[grade].push({ ...book, grade });
    });
    return gradeRows;
  }, {});

  Object.keys(rows).forEach((grade) => {
    rows[Number(grade)] = rows[Number(grade)].filter((book: Book, index: number, list: Book[]) => (
      list.findIndex((entry) => entry.id === book.id) === index
    ));
  });

  return { rows, ungraded };
};

const fetchYoBookEndpointCollection = async (endpoint: 'textbooks' | 'teacher-guides', signal?: AbortSignal): Promise<YoBookGradeCollection> => {
  const cacheKey = `yobook-${endpoint}-collection-v4`;
  const cached = getFromCache<YoBookGradeCollection>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return { rows: {}, ungraded: [] };
  }

  try {
    const firstPage = await fetchYoBookEndpointPage(endpoint, 1, signal);
    const remainingPages = Array.from({ length: Math.max(0, firstPage.pages - 1) }, (_, index) => index + 2);
    const remaining = await Promise.all(remainingPages.map((page) => fetchYoBookEndpointPage(endpoint, page, signal)));
    const books = [firstPage, ...remaining]
      .flatMap((page) => page.items)
      .map(mapYoBookToBook)
      .filter((book, index, list) => list.findIndex((entry) => entry.id === book.id) === index);
    const collection = booksToGradeCollection(books);
    setInCache(cacheKey, collection);
    markProviderSuccess('yobook');
    return collection;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('yobook');
      console.error(`Failed to fetch YoBook ${endpoint}:`, error);
    }
    return { rows: {}, ungraded: [] };
  }
};

// --- Exported Archival Connectors ---

export const fetchBooksFromGutendex = async (page = 1, category?: string, signal?: AbortSignal): Promise<{ books: Book[], next: string | null }> => {
  const cacheKey = `gutendex-list-${page}-${category || 'all'}`;
  const cached = getFromCache<{ books: Book[], next: string | null }>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('gutendex')) {
    warnProviderCooldown('gutendex');
    return { books: [], next: null };
  }

  try {
    let url = `${getGutendexBase()}/?page=${page}&languages=en`;
    if (category && category !== 'All') {
      url += `&topic=${encodeURIComponent(category)}`;
    }

    const response = await fetch(url, { signal });
    if (!response.ok) {
      markProviderFailure('gutendex', response.status);
      return { books: [], next: null };
    }
    const data = await response.json();

    const result = {
      books: data.results.map((item: any) => mapGutendexToBook(item)),
      next: data.next
    };
    setInCache(cacheKey, result);
    markProviderSuccess('gutendex');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('gutendex');
      console.error('Failed to fetch from Gutendex:', error);
    }
    return { books: [], next: null };
  }
};

export const fetchBooksFromYoBook = async (page = 1, category?: string, signal?: AbortSignal): Promise<{ books: Book[], next: string | null }> => {
  const cacheKey = `yobook-list-${page}-${category || 'all'}`;
  const cached = getFromCache<{ books: Book[], next: string | null }>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return { books: [], next: null };
  }

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: '100',
      full: 'true',
    });

    const queryType = getYoBookQueryType(category);
    if (queryType === 'grade') {
      params.set('grade', String(getGradeFromCategory(category)));
    } else if (queryType === 'subject' && category) {
      params.set('subject', category);
    } else if (queryType === 'query' && category) {
      params.set('q', category);
    }

    const response = await fetch(`${YOBOOK_BASE}/api/books?${params.toString()}`, { signal });
    if (!response.ok) {
      markProviderFailure('yobook', response.status);
      return { books: [], next: null };
    }

    const data = await response.json();
    const books = Array.isArray(data.data) ? data.data.map(mapYoBookToBook) : [];
    const pages = Number(data.meta?.pages || 1);
    const currentPage = Number(data.meta?.page || page);
    const result = {
      books,
      next: currentPage < pages ? String(currentPage + 1) : null,
    };

    setInCache(cacheKey, result);
    markProviderSuccess('yobook');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('yobook');
      console.error('Failed to fetch from YoBook:', error);
    }
    return { books: [], next: null };
  }
};

export const fetchYoBookBooksBySource = async (source: string, limit = 100, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `yobook-source-${source}-${limit}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return [];
  }

  try {
    const pageSize = Math.min(100, Math.max(1, limit));
    const fetchPage = async (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        full: 'true',
        source,
      });

      const response = await fetch(`${YOBOOK_BASE}/api/books?${params.toString()}`, { signal });
      if (!response.ok) {
        markProviderFailure('yobook', response.status);
        return { books: [] as Book[], pages: 0 };
      }

      const data = await response.json();
      return {
        books: Array.isArray(data.data) ? data.data.map(mapYoBookToBook) : [],
        pages: Number(data.meta?.pages || 1),
      };
    };

    const firstPage = await fetchPage(1);
    const remainingPages = Array.from(
      { length: Math.max(0, Math.min(firstPage.pages, Math.ceil(limit / pageSize)) - 1) },
      (_, index) => index + 2
    );
    const remaining = await Promise.all(remainingPages.map(fetchPage));
    const books = [firstPage, ...remaining]
      .flatMap((page) => page.books)
      .filter((book, index, list) => list.findIndex((entry) => entry.id === book.id) === index)
      .slice(0, limit);

    setInCache(cacheKey, books);
    markProviderSuccess('yobook');
    return books;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('yobook');
      console.error(`Failed to fetch YoBook source ${source}:`, error);
    }
    return [];
  }
};

export const searchYoBookBooks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `yobook-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return [];
  }

  try {
    const params = new URLSearchParams({ q: query, limit: '100', full: 'true' });
    const grade = getGradeFromCategory(query);
    if (grade) {
      params.delete('q');
      params.set('grade', String(grade));
    } else if (YOBOOK_SUBJECTS.has(query)) {
      params.delete('q');
      params.set('subject', query);
    }

    const response = await fetch(`${YOBOOK_BASE}/api/books?${params.toString()}`, { signal });
    if (!response.ok) {
      markProviderFailure('yobook', response.status);
      return [];
    }

    const data = await response.json();
    const result = Array.isArray(data.data) ? data.data.map(mapYoBookToBook) : [];
    setInCache(cacheKey, result);
    markProviderSuccess('yobook');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('yobook');
      console.error('YoBook search failed:', error);
    }
    return [];
  }
};

export const fetchYoBookTextbookRows = async (signal?: AbortSignal): Promise<Record<number, Book[]>> => (
  fetchYoBookEndpointCollection('textbooks', signal).then((collection) => collection.rows)
);

export const fetchYoBookTextbookCollection = async (signal?: AbortSignal): Promise<YoBookGradeCollection> => (
  fetchYoBookEndpointCollection('textbooks', signal)
);

export const fetchYoBookGuideRows = async (signal?: AbortSignal): Promise<Record<number, Book[]>> => (
  fetchYoBookEndpointCollection('teacher-guides', signal).then((collection) => collection.rows)
);

export const fetchYoBookGuideCollection = async (signal?: AbortSignal): Promise<YoBookGradeCollection> => (
  fetchYoBookEndpointCollection('teacher-guides', signal)
);

export const fetchYoBookGradeAudio = async (grade: number, subject?: string, signal?: AbortSignal): Promise<ChapterAudio[]> => {
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) return [];

  const normalizedSubject = getYoBookAudioSubjectFromValue(subject) || subject?.trim();
  const cacheKey = `yobook-gradewise-audio-${grade}-${normalizedSubject || 'all'}`;
  const cached = getFromCache<ChapterAudio[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return [];
  }

  try {
    const params = new URLSearchParams({ grade: String(grade) });
    if (normalizedSubject) params.set('subject', normalizedSubject);

    const response = await fetch(`${YOBOOK_BASE}/api/gradewise-audio?${params.toString()}`, { signal });
    if (!response.ok) {
      markProviderFailure('yobook', response.status);
      return [];
    }

    const payload = await response.json();
    const chapters = (Array.isArray(payload?.data?.grades) ? payload.data.grades : [])
      .flatMap((gradeEntry: any) => Array.isArray(gradeEntry?.subjects) ? gradeEntry.subjects : [])
      .flatMap((subjectEntry: any) => Array.isArray(subjectEntry?.chapters) ? subjectEntry.chapters : [])
      .map((chapter: any): ChapterAudio => ({
        chapter: Number(chapter?.chapter || 0),
        chapterName: toText(chapter?.chapterName, 'Chapter'),
        unit: toText(chapter?.unit, ''),
        url: getAbsoluteYoBookAssetUrl(chapter?.url) || '',
      }))
      .filter((chapter: ChapterAudio) => chapter.chapter > 0 && /^https?:\/\//i.test(chapter.url))
      .sort((a: ChapterAudio, b: ChapterAudio) => a.chapter - b.chapter);

    setInCache(cacheKey, chapters);
    markProviderSuccess('yobook');
    return chapters;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('yobook');
      console.error('YoBook gradewise audio sync failed:', error);
    }
    return [];
  }
};

export interface YoBookSourceInfo {
  source: string;
  count: number;
  grades: number[];
  subjects: string[];
}

export interface YoBookStats {
  totalBooks: number;
  byGrade: Record<string, number>;
  byLanguage: Record<string, number>;
  bySource: Record<string, number>;
  bySubject: Record<string, number>;
}

export const fetchYoBookSources = async (signal?: AbortSignal): Promise<YoBookSourceInfo[]> => {
  const cacheKey = 'yobook-sources';
  const cached = getFromCache<YoBookSourceInfo[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) return [];

  try {
    const response = await fetch(`${YOBOOK_BASE}/api/sources`, { signal });
    if (!response.ok) {
      markProviderFailure('yobook', response.status);
      return [];
    }

    const data = await response.json();
    const result = Array.isArray(data.data) ? data.data : [];
    setInCache(cacheKey, result);
    markProviderSuccess('yobook');
    return result;
  } catch (error) {
    if (!isAbortError(error)) markProviderFailure('yobook');
    return [];
  }
};

export const fetchYoBookStats = async (signal?: AbortSignal): Promise<YoBookStats | null> => {
  const cacheKey = 'yobook-stats';
  const cached = getFromCache<YoBookStats>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) return null;

  try {
    const response = await fetch(`${YOBOOK_BASE}/api/stats`, { signal });
    if (!response.ok) {
      markProviderFailure('yobook', response.status);
      return null;
    }

    const data = await response.json();
    const result = data.data || null;
    if (result) setInCache(cacheKey, result);
    markProviderSuccess('yobook');
    return result;
  } catch (error) {
    if (!isAbortError(error)) markProviderFailure('yobook');
    return null;
  }
};

export const searchBooksInGutendex = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `gutendex-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('gutendex')) {
    warnProviderCooldown('gutendex');
    return [];
  }

  try {
    const url = `${getGutendexBase()}/?search=${encodeURIComponent(query)}&languages=en`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
      markProviderFailure('gutendex', response.status);
      return [];
    }
    const data = await response.json();

    const result = data.results.map((item: any) => mapGutendexToBook(item));
    setInCache(cacheKey, result);
    markProviderSuccess('gutendex');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('gutendex');
      console.error('Search failed in Gutendex:', error);
    }
    return [];
  }
};

export const searchGoogleBooks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `google-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('google')) {
    warnProviderCooldown('google');
    return [];
  }

  try {
    const response = await fetch(`${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=10`, { signal });
    if (!response.ok) {
      markProviderFailure('google', response.status);
      return [];
    }
    const data = await response.json();
    const result = (data.items || []).map((item: any) => mapGoogleToBook(item));
    setInCache(cacheKey, result);
    markProviderSuccess('google');
    return result;
  } catch (err) {
    if (!isAbortError(err)) {
      markProviderFailure('google');
      console.error('Google Books sync failed:', err);
    }
    return [];
  }
};

export const searchITBooks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `it-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('itbookstore')) {
    warnProviderCooldown('itbookstore');
    return [];
  }

  try {
    const response = await fetch(`${IT_BOOKSTORE_BASE}/search/${encodeURIComponent(query)}`, { signal });
    if (!response.ok) {
      markProviderFailure('itbookstore', response.status);
      return [];
    }
    const data = await response.json();
    const books = (data.books || []).map(mapITToBook);
    setInCache(cacheKey, books);
    markProviderSuccess('itbookstore');
    return books;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('itbookstore');
    }
    return [];
  }
};

export const searchOpenLibrary = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `ol-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('openlibrary')) {
    warnProviderCooldown('openlibrary');
    return [];
  }

  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,cover_i,isbn,subject,first_sentence,first_publish_year,ratings_average,ratings_count,ebook_access,has_fulltext,public_scan_b,ia,lending_identifier_s`, { signal });
    if (!response.ok) {
      markProviderFailure('openlibrary', response.status);
      return [];
    }
    const data = await response.json();
    const books = (data.docs || [])
      .filter(hasOpenLibraryReadableAccess)
      .filter((item: any) => Boolean(getOpenLibraryArchiveId(item)))
      .map(mapOpenLibraryToBook);
    setInCache(cacheKey, books);
    markProviderSuccess('openlibrary');
    return books;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('openlibrary');
      console.error('[Open Library Sync] Error:', error);
    }
    return [];
  }
};

export const searchInternetArchive = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `ia-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('internetarchive')) {
    warnProviderCooldown('internetarchive');
    return [];
  }

  try {
    const archiveQuery = `${query} AND mediatype:texts AND (format:"Text PDF" OR format:EPUB OR format:PDF OR format:DjVuTXT)`;
    const url = `${INTERNET_ARCHIVE_BASE}?q=${encodeURIComponent(archiveQuery)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&fl[]=subject&fl[]=mediatype&fl[]=format&rows=20&page=1&output=json`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
      markProviderFailure('internetarchive', response.status);
      return [];
    }
    const data = await response.json();
    const books = (data.response?.docs || [])
      .filter((item: any) => item.mediatype === 'texts')
      .filter(hasArchiveReadableFormat)
      .map(mapArchiveToBook);
    setInCache(cacheKey, books);
    markProviderSuccess('internetarchive');
    return books;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('internetarchive');
      console.error('[Internet Archive Sync] Error:', error);
    }
    return [];
  }
};

export const searchArxivPapers = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `arxiv-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('arxiv')) {
    warnProviderCooldown('arxiv');
    return [];
  }

  try {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: '0',
      max_results: '12',
      sortBy: 'relevance',
      sortOrder: 'descending',
    });
    const response = await fetch(getResearchProxyUrl('arxiv', Object.fromEntries(params)), { signal });
    if (!response.ok) {
      markProviderFailure('arxiv', response.status);
      return [];
    }

    const xml = await response.text();
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const result = await enrichWithUnpaywall(
      Array.from(document.getElementsByTagName('entry')).map(mapArxivEntryToBook),
      signal,
    );
    setInCache(cacheKey, result);
    markProviderSuccess('arxiv');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('arxiv');
      console.error('arXiv search failed:', error);
    }
    return [];
  }
};

export const searchSemanticScholarPapers = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `semantic-scholar-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('semanticscholar')) {
    warnProviderCooldown('semanticscholar');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      limit: '12',
      fields: 'title,abstract,authors,year,venue,externalIds,url,openAccessPdf,fieldsOfStudy,citationCount,isOpenAccess',
    });
    const response = await fetch(getResearchProxyUrl('semanticscholar', Object.fromEntries(params)), { signal });
    if (!response.ok) {
      markProviderFailure('semanticscholar', response.status);
      return [];
    }

    const data = await response.json();
    const books = (Array.isArray(data.data) ? data.data : [])
      .filter((paper: any) => paper?.paperId && paper?.title)
      .map(mapSemanticScholarPaperToBook);
    const result = await enrichWithUnpaywall(books, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('semanticscholar');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('semanticscholar');
      console.error('Semantic Scholar search failed:', error);
    }
    return [];
  }
};

export const searchPubMedCentralArticles = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `pmc-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('pubmedcentral')) {
    warnProviderCooldown('pubmedcentral');
    return [];
  }

  try {
    const searchTerm = `(${query}) AND open access[filter]`;
    const searchParams = new URLSearchParams({
      db: 'pmc',
      term: searchTerm,
      retmode: 'json',
      retmax: '12',
      sort: 'relevance',
    });
    const searchResponse = await fetch(getResearchProxyUrl('pmc-search', Object.fromEntries(searchParams)), { signal });
    if (!searchResponse.ok) {
      markProviderFailure('pubmedcentral', searchResponse.status);
      return [];
    }

    const searchData = await searchResponse.json();
    const ids = Array.isArray(searchData.esearchresult?.idlist) ? searchData.esearchresult.idlist : [];
    if (ids.length === 0) {
      markProviderSuccess('pubmedcentral');
      setInCache(cacheKey, []);
      return [];
    }

    const summaryParams = new URLSearchParams({
      db: 'pmc',
      id: ids.join(','),
      retmode: 'json',
    });
    const summaryResponse = await fetch(getResearchProxyUrl('pmc-summary', Object.fromEntries(summaryParams)), { signal });
    if (!summaryResponse.ok) {
      markProviderFailure('pubmedcentral', summaryResponse.status);
      return [];
    }

    const summaryData = await summaryResponse.json();
    const resultEntries = summaryData.result || {};
    const books = ids
      .map((id: string) => resultEntries[id])
      .filter(Boolean)
      .map(mapPmcSummaryToBook)
      .filter(hasUsableResearchResource);
    const result = await enrichWithUnpaywall(books, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('pubmedcentral');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('pubmedcentral');
      console.error('PubMed Central search failed:', error);
    }
    return [];
  }
};

export const searchEuropePmcWorks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `europe-pmc-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('europepmc')) {
    warnProviderCooldown('europepmc');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      format: 'json',
      pageSize: '12',
      resultType: 'core',
      synonym: 'true',
    });
    const response = await fetch(getResearchProxyUrl('europepmc', Object.fromEntries(params)), { signal });
    if (!response.ok) {
      markProviderFailure('europepmc', response.status);
      return [];
    }

    const data = await response.json();
    const books = (Array.isArray(data.resultList?.result) ? data.resultList.result : [])
      .filter((item: any) => item?.id && item?.title)
      .map(mapEuropePmcWorkToBook)
      .filter(hasUsableResearchResource);
    const result = await enrichWithUnpaywall(books, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('europepmc');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('europepmc');
      console.error('Europe PMC search failed:', error);
    }
    return [];
  }
};

export const searchOpenAlexWorks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `openalex-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('openalex')) {
    warnProviderCooldown('openalex');
    return [];
  }

  try {
    const params = new URLSearchParams({
      search: query,
      per_page: '12',
      sort: 'relevance_score:desc',
    });
    const email = getEnvValue('VITE_UNPAYWALL_EMAIL');
    if (email) params.set('mailto', email);

    const response = await fetch(getResearchProxyUrl('openalex', Object.fromEntries(params)), { signal });
    if (!response.ok) {
      markProviderFailure('openalex', response.status);
      return [];
    }

    const data = await response.json();
    const books = (Array.isArray(data.results) ? data.results : [])
      .filter((work: any) => work?.id && (work?.title || work?.display_name))
      .map(mapOpenAlexWorkToBook);
    const result = await enrichWithUnpaywall(books, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('openalex');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('openalex');
      console.error('OpenAlex search failed:', error);
    }
    return [];
  }
};

export const searchCrossrefWorks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `crossref-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('crossref')) {
    warnProviderCooldown('crossref');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      rows: '12',
      sort: 'relevance',
      order: 'desc',
      filter: 'has-full-text:true,type:book',
    });
    const email = getEnvValue('VITE_UNPAYWALL_EMAIL');
    if (email) params.set('mailto', email);

    const response = await fetch(getResearchProxyUrl('crossref', Object.fromEntries(params)), { signal });
    if (!response.ok) {
      markProviderFailure('crossref', response.status);
      return [];
    }

    const data = await response.json();
    const books = (Array.isArray(data.message?.items) ? data.message.items : [])
      .filter((item: any) => item?.title || item?.DOI)
      .filter((item: any) => CROSSREF_BOOK_TYPES.has(String(item?.type || '').toLowerCase()))
      .map(mapCrossrefWorkToBook);
    const result = await enrichWithUnpaywall(books, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('crossref');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('crossref');
      console.error('Crossref search failed:', error);
    }
    return [];
  }
};

export const searchDataCiteWorks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `datacite-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('datacite')) {
    warnProviderCooldown('datacite');
    return [];
  }

  try {
    const response = await fetch(getResearchProxyUrl('datacite', { query, 'page[size]': '12' }), { signal });
    if (!response.ok) {
      markProviderFailure('datacite', response.status);
      return [];
    }

    const data = await response.json();
    const books = (Array.isArray(data.data) ? data.data : [])
      .filter((item: any) => item?.id || item?.attributes?.titles)
      .map(mapDataCiteDoiToBook);
    const withRepositoryFiles = await enrichDataCiteWithRepositoryFiles(books, signal);
    const result = await enrichWithUnpaywall(withRepositoryFiles, signal);
    setInCache(cacheKey, result);
    markProviderSuccess('datacite');
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      markProviderFailure('datacite');
      console.error('DataCite search failed:', error);
    }
    return [];
  }
};

export const searchAcademicResearch = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const results = await Promise.allSettled([
    searchArxivPapers(query, signal),
    searchSemanticScholarPapers(query, signal),
    searchPubMedCentralArticles(query, signal),
    searchEuropePmcWorks(query, signal),
    searchOpenAlexWorks(query, signal),
    searchCrossrefWorks(query, signal),
    searchDataCiteWorks(query, signal),
  ]);

  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
};

const LEGACY_SHELF_IDS: Record<string, string> = {
  'shelf-shakespeare': 'gutenberg-100',
  'shelf-frankenstein': 'gutenberg-84',
  'shelf-sherlock': 'gutenberg-1661',
  'shelf-two-cities': 'gutenberg-98',
  'shelf-republic': 'gutenberg-1497',
  'shelf-douglass': 'gutenberg-23',
  'shelf-origin': 'gutenberg-1228',
  'shelf-wonderland': 'gutenberg-11',
  'shelf-treasure-island': 'gutenberg-120',
  'shelf-pride': 'gutenberg-1342',
  'shelf-dorian': 'gutenberg-174',
  'shelf-poe': 'gutenberg-2147',
};

const resolveLegacyShelfId = (id: string): string => {
  if (!id.startsWith('shelf-')) return id;

  const direct = LEGACY_SHELF_IDS[id];
  if (direct) return direct;

  const match = Object.keys(LEGACY_SHELF_IDS).find((legacyId) => (
    id === legacyId || id.startsWith(`${legacyId}-`)
  ));

  return match ? LEGACY_SHELF_IDS[match] : id;
};

const LEGACY_RESEARCH_IDS: Record<string, string> = {
  // Previous Europe PMC links used one-way hashed ids. This one resolves to PMID 41804376 / PMCID PMC12967488.
  'epmc-rpty25': 'epmc-ext-41804376',
};

const fetchEuropePmcBookByQuery = async (query: string): Promise<Book | null> => {
  const params = new URLSearchParams({
    query,
    format: 'json',
    pageSize: '1',
    resultType: 'core',
  });
  const response = await fetch(getResearchProxyUrl('europepmc', Object.fromEntries(params)));
  if (!response.ok) return null;
  const data = await response.json();
  const item = Array.isArray(data?.resultList?.result) ? data.resultList.result[0] : null;
  return item ? mapEuropePmcWorkToBook(item) : null;
};

const fetchArxivBookById = async (arxivId: string): Promise<Book | null> => {
  const response = await fetch(getResearchProxyUrl('arxiv', { id_list: arxivId, max_results: '1' }));
  if (!response.ok) return null;
  const xml = await response.text();
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const entry = document.getElementsByTagName('entry')[0];
  return entry ? mapArxivEntryToBook(entry) : null;
};

const fetchSemanticScholarBookById = async (paperId: string): Promise<Book | null> => {
  const fields = 'title,abstract,authors,year,venue,externalIds,url,openAccessPdf,fieldsOfStudy,citationCount,isOpenAccess';
  const response = await fetch(getResearchProxyUrl('semanticscholar-paper', { paperId, fields }));
  if (!response.ok) return null;
  const paper = await response.json();
  return paper?.paperId && paper?.title ? mapSemanticScholarPaperToBook(paper) : null;
};

const fetchOpenAlexBookById = async (workId: string): Promise<Book | null> => {
  const response = await fetch(getResearchProxyUrl('openalex-work', { workId }));
  if (!response.ok) return null;
  const work = await response.json();
  return work?.id ? mapOpenAlexWorkToBook(work) : null;
};

const fetchOpenAlexBookByDoi = async (doi: string): Promise<Book | null> => {
  const response = await fetch(getResearchProxyUrl('openalex-work', { workId: `doi:${doi}` }));
  if (!response.ok) return null;
  const work = await response.json();
  return work?.id ? mapOpenAlexWorkToBook(work) : null;
};

const fetchCrossrefBookByDoi = async (doi: string): Promise<Book | null> => {
  const response = await fetch(getResearchProxyUrl('crossref-work', { doi }));
  if (!response.ok) return null;
  const data = await response.json();
  return data?.message ? mapCrossrefWorkToBook(data.message) : null;
};

const fetchDataCiteBookByDoi = async (doi: string): Promise<Book | null> => {
  const response = await fetch(getResearchProxyUrl('datacite-doi', { doi }));
  if (!response.ok) return null;
  const data = await response.json();
  return data?.data ? mapDataCiteDoiToBook(data.data) : null;
};

export const fetchBookById = async (id: string): Promise<Book | null> => {
  const resolvedId = resolveLegacyShelfId(id);
  if (resolvedId !== id) return fetchBookById(resolvedId);
  const legacyResearchId = LEGACY_RESEARCH_IDS[id];
  if (legacyResearchId) return fetchBookById(legacyResearchId);

  const cacheKey = `book-detail-${id}`;
  const cached = getFromCache<Book>(cacheKey);
  if (cached) return cached;
  const cachedFromCollections = findCachedBookById(id);
  if (cachedFromCollections) {
    setInCache(cacheKey, cachedFromCollections);
    return cachedFromCollections;
  }

  try {
    // Handle Nepali curriculum textbooks from YoBook
    if (id.startsWith('yobook-')) {
      const yoBookId = id.replace('yobook-', '');
      const response = await fetch(`${YOBOOK_BASE}/api/books/${encodeURIComponent(yoBookId)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const result = data.data ? mapYoBookToBook(data.data) : null;
      if (result) setInCache(cacheKey, result);
      return result;
    }

    // Handle Internet Archive
    if (id.startsWith('ia-')) {
      const iaId = id.replace('ia-', '');
      const response = await fetch(`https://archive.org/metadata/${iaId}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!hasArchiveReadableFormat(data)) return null;
      const result = mapArchiveToBook(data);
      setInCache(cacheKey, result);
      return result;
    }

    // Handle Open Library works
    if (id.startsWith('ol-')) {
      const openLibraryId = id.replace('ol-', '');
      const response = await fetch(`${OPEN_LIBRARY_BASE}/works/${encodeURIComponent(openLibraryId)}.json`);
      if (!response.ok) return null;
      const data = await response.json();
      const result = await mapOpenLibraryWorkToBook(data);
      if (!/^https:\/\/archive\.org\/embed\//i.test(result.externalUrl || '')) return null;
      setInCache(cacheKey, result);
      return result;
    }

    // Handle Gutenberg books
    if (id.startsWith('gutenberg-')) {
      const gutenbergId = id.replace('gutenberg-', '');
      const response = await fetch(`${getGutendexBase()}/${gutenbergId}`);
      if (!response.ok) return null;
      const data = await response.json();
      const result = mapGutendexToBook(data);
      setInCache(cacheKey, result);
      return result;
    }

    // Handle Google Books
    if (id.startsWith('google-')) {
      const googleId = id.replace('google-', '');
      const response = await fetch(`${GOOGLE_BOOKS_BASE}/${googleId}`);
      if (!response.ok) return null;
      const data = await response.json();
      const result = mapGoogleToBook(data);
      setInCache(cacheKey, result);
      return result;
    }

    // Handle IT Bookstore
    if (id.startsWith('it-')) {
      const isbn13 = id.replace('it-', '');
      const response = await fetch(`${IT_BOOKSTORE_BASE}/books/${isbn13}`);
      if (!response.ok) return null;
      const data = await response.json();
      const result = mapITToBook(data);
      setInCache(cacheKey, result);
      return result;
    }

    // Handle arXiv papers from direct research URLs.
    if (id.startsWith('arxiv-')) {
      const arxivId = id.replace('arxiv-', '');
      if (!/^[\w./-]+$/.test(arxivId)) return null;
      const result = await fetchArxivBookById(arxivId);
      if (result) setInCache(cacheKey, result);
      return result;
    }

    // Handle Semantic Scholar papers from direct research URLs.
    if (id.startsWith('s2-')) {
      const paperId = id.replace('s2-', '');
      if (!/^[\w.:/-]+$/.test(paperId)) return null;
      const result = await fetchSemanticScholarBookById(paperId);
      if (result) setInCache(cacheKey, result);
      return result;
    }

    // Handle PubMed Central articles from deep links/search result URLs.
    if (id.startsWith('pmc-')) {
      const pmcId = id.replace('pmc-', '');
      if (!/^\d+$/.test(pmcId)) return null;
      const summaryParams = new URLSearchParams({
        db: 'pmc',
        id: pmcId,
        retmode: 'json',
      });
      const response = await fetch(getResearchProxyUrl('pmc-summary', Object.fromEntries(summaryParams)));
      if (!response.ok) return null;
      const data = await response.json();
      const item = data?.result?.[pmcId];
      if (!item?.uid) return null;
      const result = mapPmcSummaryToBook(item);
      setInCache(cacheKey, result);
      return result;
    }

    // Handle recoverable Europe PMC articles from direct research URLs.
    if (/^epmc-PMC/i.test(id) || id.startsWith('epmc-pmc-') || id.startsWith('epmc-ext-') || id.startsWith('epmc-doi-')) {
      const prefix = /^epmc-PMC/i.test(id) ? 'epmc-' : id.startsWith('epmc-pmc-') ? 'epmc-pmc-' : id.startsWith('epmc-ext-') ? 'epmc-ext-' : 'epmc-doi-';
      const value = decodeResearchIdPart(id.slice(prefix.length));
      const query = prefix === 'epmc-ext-'
        ? `EXT_ID:${value}`
        : value;
      const result = await fetchEuropePmcBookByQuery(query);
      if (result) {
        setInCache(cacheKey, result);
        setInCache(`book-detail-${result.id}`, result);
      }
      return result;
    }

    // Handle OpenAlex, Crossref, and DataCite records from recoverable direct research URLs.
    if (id.startsWith('openalex-') || id.startsWith('openalex-doi-')) {
      const isDoi = id.startsWith('openalex-doi-');
      const value = decodeResearchIdPart(id.slice(isDoi ? 'openalex-doi-'.length : 'openalex-'.length));
      const result = isDoi ? await fetchOpenAlexBookByDoi(value) : await fetchOpenAlexBookById(value);
      if (result) {
        setInCache(cacheKey, result);
        setInCache(`book-detail-${result.id}`, result);
      }
      return result;
    }

    if (id.startsWith('crossref-doi-')) {
      const doi = decodeResearchIdPart(id.slice('crossref-doi-'.length));
      const result = await fetchCrossrefBookByDoi(doi);
      if (result) {
        setInCache(cacheKey, result);
        setInCache(`book-detail-${result.id}`, result);
      }
      return result;
    }

    if (id.startsWith('datacite-doi-')) {
      const doi = decodeResearchIdPart(id.slice('datacite-doi-'.length));
      const result = await fetchDataCiteBookByDoi(doi);
      if (result) {
        setInCache(cacheKey, result);
        setInCache(`book-detail-${result.id}`, result);
      }
      return result;
    }

    // Handle local synthetic books (from constants)
    return INITIAL_BOOKS.find(b => b.id === id) || null;
  } catch (err) {
    console.error(`Neural link to node ${id} severed:`, err);
    return null;
  }
};
