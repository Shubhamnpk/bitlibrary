import { Author, Book } from '@/types/index';
import { INITIAL_BOOKS } from '@/constants';

const GUTENDEX_BASE = 'https://gutendex.com/books';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
const IT_BOOKSTORE_BASE = 'https://api.itbook.store/1.0';
const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
const INTERNET_ARCHIVE_BASE = 'https://archive.org/advancedsearch.php';
const GUTENDEX_DEV_PROXY_BASE = '/api/gutendex/books';
const YOBOOK_BASE = 'https://yobook-api.vercel.app';

// --- Browser Cache Configuration ---
const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_PREFIX = 'bitlibrary-book-cache-v2';
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

const normalizeCacheKey = (value: string) => value.trim().toLowerCase();
const isAbortError = (error: unknown): boolean => {
  return (error as { name?: string })?.name === 'AbortError';
};
const getGutendexBase = () => ((import.meta as any).env?.DEV ? GUTENDEX_DEV_PROXY_BASE : GUTENDEX_BASE);
type ProviderName = 'gutendex' | 'google' | 'itbookstore' | 'openlibrary' | 'internetarchive' | 'yobook';
type ProviderHealth = { disabledUntil: number; failures: number; lastWarnAt: number };
const PROVIDER_COOLDOWN_DEFAULT_MS = 3 * 60 * 1000;
const PROVIDER_HEALTH: Record<ProviderName, ProviderHealth> = {
  gutendex: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  google: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  itbookstore: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  openlibrary: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  internetarchive: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
  yobook: { disabledUntil: 0, failures: 0, lastWarnAt: 0 },
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

const getAbsoluteYoBookAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${YOBOOK_BASE}${url}`;
  return url;
};

const getGradeFromCategory = (category?: string): number | undefined => {
  const match = category?.match(/^(?:class|grade)\s*(\d{1,2})$/i);
  if (!match) return undefined;
  const grade = Number(match[1]);
  return grade >= 1 && grade <= 12 ? grade : undefined;
};

const YOBOOK_SUBJECTS = new Set([
  'English',
  'Hamro Serofero',
  'Health',
  'Mathematics',
  'Nepali',
  'Science',
  'Social Studies',
]);

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

  const externalUrl = (item.ia && item.ia.length > 0)
    ? `https://archive.org/embed/${item.ia[0]}`
    : `https://openlibrary.org${item.key}`;

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
    downloadUrl: (item.ia && item.ia.length > 0) ? `https://archive.org/download/${item.ia[0]}` : undefined
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

const mapOpenLibraryWorkToBook = async (item: any): Promise<Book> => {
  const workId = getOpenLibraryKeyId(item.key);
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
    title: toText(item.title, 'Untitled Open Library Work'),
    author,
    authors: authors.length ? authors : [{ name: author }],
    category: subjects[0] || 'Library Volume',
    description: toText(item.description, 'Historical volume from Open Library Archive.'),
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
    year: Number.isFinite(year) ? year : undefined,
    source: 'Open Library',
    subjects: subjects.slice(0, 12),
    externalUrl: workId ? `${OPEN_LIBRARY_BASE}/works/${workId}` : OPEN_LIBRARY_BASE,
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
  
  const creator = item.creator || 'Unknown Archivist';
  const author = Array.isArray(creator) ? creator.join(', ') : (typeof creator === 'string' ? creator : 'Unknown Archivist');
  const id = item.identifier;
  const coverUrl = `https://archive.org/services/img/${id}`;
  const externalUrl = `https://archive.org/embed/${id}`;
  const downloadUrl = `https://archive.org/download/${id}`;

  const subjectArray = Array.isArray(item.subject) 
    ? item.subject 
    : (typeof item.subject === 'string' ? [item.subject] : []);

  return {
    id: `ia-${id}`,
    title: item.title || 'Untitled Archive',
    author: author,
    authors: Array.isArray(creator) ? creator.map((n: any) => ({ name: String(n) })) : [{ name: String(author) }],
    category: subjectArray[0] || 'Historical Archive',
    description: toText(item.description, 'De-centralized archival node from Internet Archive.'),
    coverUrl,
    year: parseInt(String(item.date || '').split('-')[0]) || undefined,
    source: 'Open Library', // Grouping with Open Library since they share IA identifiers
    subjects: subjectArray.filter((s: unknown): s is string => typeof s === 'string').slice(0, 5),
    downloads: parseInt(item.downloads || 0),
    externalUrl,
    downloadUrl
  };
};

const mapYoBookToBook = (item: any): Book => {
  const grade = typeof item.grade === 'number' ? item.grade : undefined;
  const subject = toText(item.subject, item.category || 'Textbook');
  const curriculum = toText(item.curriculum, 'CDC Nepal');
  const language = toText(item.language, 'en');
  const pdfUrl = getAbsoluteYoBookAssetUrl(item.pdfUrl);
  const readUrl = getAbsoluteYoBookAssetUrl(item.readUrl);
  const coverUrl = getAbsoluteYoBookAssetUrl(item.coverUrl || item.localCoverUrl);
  const sourceUrl = getAbsoluteYoBookAssetUrl(item.sourceUrl);
  const subjects = [
    subject,
    grade ? `Class ${grade}` : undefined,
    curriculum,
    'Nepali Curriculum',
    'CEHRD',
    ...(Array.isArray(item.keywords) ? item.keywords : []),
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value as string) === index);

  return {
    id: `yobook-${item.id}`,
    title: toText(item.title, 'Nepali Curriculum Textbook'),
    author: toText(item.author, 'Centre for Education and Human Resource Development'),
    authors: [{ name: toText(item.author, 'Centre for Education and Human Resource Development') }],
    category: subject,
    description: toText(
      item.description,
      `${subject}${grade ? ` for Class ${grade}` : ''} from the ${curriculum} curriculum.`
    ),
    coverUrl,
    subjects,
    bookshelves: [grade ? `Class ${grade}` : '', curriculum, 'Nepali Curriculum'].filter(Boolean),
    externalUrl: pdfUrl || readUrl || sourceUrl,
    downloadUrl: pdfUrl,
    sourceUrl,
    source: 'YoBook',
    grade,
    curriculum,
    language,
    country: toText(item.country, 'np'),
    year: item.scrapedAt ? new Date(item.scrapedAt).getFullYear() : undefined,
    popularity: grade ? Math.max(50, 100 - Math.abs(grade - 6) * 3) : 70,
    downloads: 0,
  };
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
      limit: '52',
    });

    const grade = getGradeFromCategory(category);
    if (grade) {
      params.set('grade', String(grade));
    } else if (category && category !== 'All' && category !== 'Nepali Curriculum') {
      if (YOBOOK_SUBJECTS.has(category)) {
        params.set('subject', category);
      } else {
        params.set('q', category);
      }
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

export const searchYoBookBooks = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const cacheKey = `yobook-search-${normalizeCacheKey(query)}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;
  if (isProviderInCooldown('yobook')) {
    warnProviderCooldown('yobook');
    return [];
  }

  try {
    const params = new URLSearchParams({ q: query, limit: '52' });
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
    const response = await fetch(`${OPEN_LIBRARY_BASE}/search.json?q=${encodeURIComponent(query)}&limit=10`, { signal });
    if (!response.ok) {
      markProviderFailure('openlibrary', response.status);
      return [];
    }
    const data = await response.json();
    const books = (data.docs || []).map(mapOpenLibraryToBook);
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
    const url = `${INTERNET_ARCHIVE_BASE}?q=${encodeURIComponent(query)} AND mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&fl[]=subject&fl[]=mediatype&rows=10&page=1&output=json`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
      markProviderFailure('internetarchive', response.status);
      return [];
    }
    const data = await response.json();
    const books = (data.response?.docs || [])
      .filter((item: any) => item.mediatype === 'texts')
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

export const fetchBookById = async (id: string): Promise<Book | null> => {
  const cacheKey = `book-detail-${id}`;
  const cached = getFromCache<Book>(cacheKey);
  if (cached) return cached;

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
      const result = mapArchiveToBook(data.metadata);
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

    // Handle local synthetic books (from constants)
    return INITIAL_BOOKS.find(b => b.id === id) || null;
  } catch (err) {
    console.error(`Neural link to node ${id} severed:`, err);
    return null;
  }
};
