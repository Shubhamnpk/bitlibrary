import { Audiobook, AudiobookTrack, Author, Book } from '@/types/index';
import { fetchBookById, fetchBooksFromYoBook, fetchYoBookBooksBySource, searchBooksInGutendex, searchYoBookBooks } from '@/services/bookService';
import { readCacheEntry, writeCacheEntry } from '@/lib/storage-manager';

const LIBRIVOX_API_BASE = 'https://librivox.org/api/feed/audiobooks';
const INTERNET_ARCHIVE_ADVANCED_SEARCH_BASE = 'https://archive.org/advancedsearch.php';
const INTERNET_ARCHIVE_METADATA_BASE = 'https://archive.org/metadata';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const YOBOOK_AUDIO_ID_PREFIX = 'yobook-audio-';
const GUTENBERG_AUDIO_ID_PREFIX = 'gutenberg-audio-';
const INTERNET_ARCHIVE_AUDIO_ID_PREFIX = 'internet-archive-audio-';
const getStorageKey = (key: string) => `audiobook:${key}`;
const cache: Record<string, { data: unknown; timestamp: number }> = {};
const inFlightRequests: Record<string, Promise<any[]> | undefined> = {};

export const AUDIOBOOK_SOURCES = [
  {
    id: 'librivox',
    name: 'LibriVox',
    status: 'active',
    description: 'Public-domain volunteer recordings with chapter audio and catalog metadata.',
  },
  {
    id: 'internet-archive',
    name: 'Internet Archive',
    status: 'active',
    description: 'Playable public audio records with direct MP3/Ogg files from archive.org.',
  },
  {
    id: 'project-gutenberg',
    name: 'Project Gutenberg',
    status: 'active',
    description: 'Public-domain Project Gutenberg audio editions with direct MP3/Ogg tracks.',
  },
] as const;

interface ProjectGutenbergAudioSeed {
  id: string;
  title: string;
  author: string;
  language: string;
  genres: string[];
}

const PROJECT_GUTENBERG_AUDIO_CATALOG: ProjectGutenbergAudioSeed[] = [
  { id: '9727', title: 'Oliver Twist', author: 'Charles Dickens', language: 'en', genres: ['Fiction', 'Classics'] },
  { id: '20038', title: 'Frankenstein; Or, The Modern Prometheus', author: 'Mary Wollstonecraft Shelley', language: 'en', genres: ['Fiction', 'Horror', 'Classics'] },
  { id: '19640', title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', language: 'en', genres: ['Fiction', 'Adventure', 'Classics'] },
  { id: '21171', title: "The Pilgrim's Progress", author: 'John Bunyan', language: 'en', genres: ['Fiction', 'Religion', 'Classics'] },
];

interface ProjectGutenbergAudioPayload {
  id: string;
  title: string;
  pageUrl: string;
  tracks: Array<{ url: string; title: string }>;
}

interface InternetArchiveSearchDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  description?: string;
  date?: string;
  language?: string | string[];
  downloads?: number;
}

interface InternetArchiveMetadataPayload {
  metadata?: Record<string, unknown>;
  files?: Array<Record<string, unknown>>;
}

export const AUDIOBOOK_CATEGORIES = [
  {
    id: 'fiction',
    label: 'Fiction',
    genre: 'Fiction',
    matchTerms: ['fiction', 'novel', 'stories', 'romance'],
    description: 'Classic novels, short stories, and literary recordings.',
  },
  {
    id: 'mystery',
    label: 'Mystery',
    genre: 'Mystery',
    matchTerms: ['mystery', 'detective', 'sherlock', 'crime'],
    description: 'Detective stories, suspense, and crime classics.',
  },
  {
    id: 'poetry',
    label: 'Poetry',
    genre: 'Poetry',
    matchTerms: ['poetry', 'poems', 'verse'],
    description: 'Poems, verse collections, and spoken literature.',
  },
  {
    id: 'children',
    label: 'Children',
    genre: 'Children',
    matchTerms: ['children', 'fairy', 'tales', 'juvenile'],
    description: "Family-friendly stories and children's classics.",
  },
  {
    id: 'history',
    label: 'History',
    genre: 'History',
    matchTerms: ['history', 'historical', 'memoir', 'biography'],
    description: 'Historical works, memoirs, and public-domain nonfiction.',
  },
] as const;

export type AudiobookCategory = typeof AUDIOBOOK_CATEGORIES[number];

export const getAudiobookCategoryById = (id?: string): AudiobookCategory | undefined => {
  if (!id) return undefined;
  return AUDIOBOOK_CATEGORIES.find((category) => category.id === id);
};

interface AudiobookQuery {
  id?: string;
  limit?: number;
  offset?: number;
  title?: string;
  author?: string;
  genre?: string;
  extended?: boolean;
}

const getCached = <T>(key: string): T | null => {
  const item = cache[key];
  if (item && Date.now() - item.timestamp <= CACHE_TTL) return item.data as T;

  if (typeof window === 'undefined') return null;

  try {
    const data = readCacheEntry<T>('api', getStorageKey(key), CACHE_TTL);
    if (!data) return null;

    cache[key] = { data, timestamp: Date.now() };
    return data;
  } catch {
    return null;
  }
};

const setCached = (key: string, data: unknown) => {
  const item = { data, timestamp: Date.now() };
  cache[key] = item;

  if (typeof window === 'undefined') return;

  try {
    writeCacheEntry('api', getStorageKey(key), data);
  } catch {
    // Keep the in-memory cache when persistent storage is full or blocked.
  }
};

const stripHtml = (value?: string) => {
  if (!value) return '';
  const withoutTags = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (textarea) {
    textarea.innerHTML = withoutTags;
    return textarea.value.replace(/\s+/g, ' ').trim();
  }

  return withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const toText = (value: unknown, fallback = ''): string => {
  if (Array.isArray(value)) return value.map((entry) => toText(entry)).filter(Boolean).join(', ') || fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const toNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const joinName = (first?: string, last?: string) => [first, last].filter(Boolean).join(' ').trim();

const mapAuthor = (item: any): Author => ({
  name: joinName(item?.first_name, item?.last_name) || 'Unknown Author',
  birth_year: toNumber(item?.dob),
  death_year: toNumber(item?.dod),
});

const mapReader = (reader: any): string => {
  if (typeof reader === 'string') return reader;
  if (reader?.display_name) return String(reader.display_name);
  return 'LibriVox volunteer';
};

const buildAudioFallbackUrls = (listenUrl: string) => {
  const urls = new Set<string>();
  if (!listenUrl) return [];

  urls.add(listenUrl);

  try {
    const parsed = new URL(listenUrl);
    if (parsed.hostname === 'www.archive.org') {
      parsed.hostname = 'archive.org';
      urls.add(parsed.toString());
    }

    const archiveMatch = parsed.pathname.match(/\/download\/([^/]+)\/(.+)$/);
    if (archiveMatch) {
      const [, identifier, fileName] = archiveMatch;
      urls.add(`https://archive.org/download/${identifier}/${fileName}`);
      urls.add(`https://archive.org/serve/${identifier}/${fileName}`);
    }
  } catch {
    // Keep the original URL only when parsing fails.
  }

  return Array.from(urls);
};

const interleaveAudiobooks = (...collections: Audiobook[][]) => {
  const results: Audiobook[] = [];
  const maxLength = Math.max(...collections.map((collection) => collection.length));

  for (let index = 0; index < maxLength; index += 1) {
    collections.forEach((collection) => {
      const audiobook = collection[index];
      if (audiobook && !results.some((entry) => entry.id === audiobook.id)) {
        results.push(audiobook);
      }
    });
  }

  return results;
};

const dedupeAudiobooks = (audiobooks: Audiobook[]) => audiobooks.filter((audiobook, index, list) => (
  Boolean(audiobook.id) && list.findIndex((entry) => entry.id === audiobook.id) === index
));

const mapTrack = (item: any): AudiobookTrack => ({
  id: String(item?.id || `${item?.section_number}-${item?.title}`),
  sectionNumber: toNumber(item?.section_number) || 0,
  title: item?.title || `Section ${item?.section_number || ''}`.trim(),
  listenUrl: item?.listen_url || '',
  fallbackUrls: buildAudioFallbackUrls(item?.listen_url || ''),
  playtimeSeconds: toNumber(item?.playtime),
  readers: Array.isArray(item?.readers) ? item.readers.map(mapReader) : [],
});

const mapAudiobook = (item: any): Audiobook => {
  const authors: Author[] = Array.isArray(item?.authors) ? item.authors.map(mapAuthor) : [];
  const genres = Array.isArray(item?.genres) ? item.genres.map((genre: any) => String(genre?.name || genre)).filter(Boolean) : [];
  const tracks = Array.isArray(item?.sections) ? item.sections.map(mapTrack).filter((track: AudiobookTrack) => track.listenUrl) : [];

  return {
    id: String(item?.id),
    title: item?.title || 'Untitled audiobook',
    author: authors.map((author) => author.name).join(', ') || 'Unknown Author',
    authors,
    description: stripHtml(item?.description) || 'Public-domain audiobook recorded by LibriVox volunteers.',
    language: item?.language || 'Unknown',
    copyrightYear: item?.copyright_year || undefined,
    coverUrl: item?.coverart_jpg || item?.coverart_thumbnail || undefined,
    thumbnailUrl: item?.coverart_thumbnail || item?.coverart_jpg || undefined,
    totalTime: item?.totaltime || undefined,
    totalTimeSeconds: toNumber(item?.totaltimesecs),
    numSections: toNumber(item?.num_sections) || tracks.length,
    genres,
    sourceTextUrl: item?.url_text_source || undefined,
    librivoxUrl: item?.url_librivox || `https://librivox.org/api/feed/audiobooks/id/${item?.id}`,
    archiveUrl: item?.url_iarchive || undefined,
    rssUrl: item?.url_rss || undefined,
    zipUrl: item?.url_zip_file || undefined,
    tracks,
    source: 'LibriVox',
  };
};

export const isYoBookAudioBook = (book: Book) => (
  Boolean(book.audioUrl)
  || book.providerSource === 'cehrd-audio'
  || book.category.toLowerCase().includes('audio')
  || book.subjects?.some((subject) => /audio|drama|listening/i.test(subject))
);

const buildYoBookAudioFallbackUrls = (book: Book) => {
  const urls = new Set<string>();
  if (book.audioUrl) urls.add(book.audioUrl);
  if (book.downloadUrl && /\.(mp3|m4a|wav|ogg)(?:$|[?#])/i.test(book.downloadUrl)) urls.add(book.downloadUrl);
  if (book.externalUrl && /\.(mp3|m4a|wav|ogg)(?:$|[?#])/i.test(book.externalUrl)) urls.add(book.externalUrl);
  return Array.from(urls);
};

export const mapYoBookAudioToAudiobook = (book: Book): Audiobook | null => {
  const audioUrls = buildYoBookAudioFallbackUrls(book);
  if (!audioUrls.length) return null;

  const track: AudiobookTrack = {
    id: `${book.id}-track-1`,
    sectionNumber: 1,
    title: book.title,
    listenUrl: audioUrls[0],
    fallbackUrls: audioUrls,
    readers: [book.author || 'Centre for Education and Human Resource Development'],
  };

  return {
    id: `${YOBOOK_AUDIO_ID_PREFIX}${book.id.replace(/^yobook-/, '')}`,
    title: book.title,
    author: book.author,
    authors: book.authors || [{ name: book.author }],
    description: book.description || 'Educational audio from YoBook.',
    language: book.language || 'ne',
    copyrightYear: book.year ? String(book.year) : undefined,
    coverUrl: book.coverUrl,
    thumbnailUrl: book.coverUrl,
    numSections: 1,
    genres: [book.category, ...(book.subjects || []), ...(book.keywords || [])].filter(Boolean),
    sourceTextUrl: book.sourceUrl,
    librivoxUrl: book.sourceUrl || book.externalUrl || audioUrls[0],
    archiveUrl: book.sourceUrl,
    zipUrl: book.downloadUrl && book.downloadUrl !== audioUrls[0] ? book.downloadUrl : undefined,
    tracks: [track],
    source: 'YoBook',
  };
};

const fetchProjectGutenbergAudioPayload = async (id: string, signal?: AbortSignal): Promise<ProjectGutenbergAudioPayload | null> => {
  const cacheKey = `project-gutenberg-audio-payload:${id}`;
  const cached = getCached<ProjectGutenbergAudioPayload>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/gutenberg-audio?id=${encodeURIComponent(id)}`, { signal });
    if (!response.ok) return null;
    const payload = await response.json() as ProjectGutenbergAudioPayload;
    if (!Array.isArray(payload.tracks) || payload.tracks.length === 0) return null;
    setCached(cacheKey, payload);
    return payload;
  } catch {
    return null;
  }
};

const mapProjectGutenbergAudioToAudiobook = (seed: ProjectGutenbergAudioSeed, payload: ProjectGutenbergAudioPayload): Audiobook | null => {
  const tracks = payload.tracks
    .filter((track) => /\.(mp3|ogg)(?:$|[?#])/i.test(track.url))
    .map((track, index): AudiobookTrack => ({
      id: `${GUTENBERG_AUDIO_ID_PREFIX}${seed.id}-${index + 1}`,
      sectionNumber: index + 1,
      title: track.title || `Track ${index + 1}`,
      listenUrl: track.url,
      fallbackUrls: [track.url],
      readers: ['Project Gutenberg'],
    }));

  if (tracks.length === 0) return null;

  return {
    id: `${GUTENBERG_AUDIO_ID_PREFIX}${seed.id}`,
    title: seed.title,
    author: seed.author,
    authors: [{ name: seed.author }],
    description: 'Public-domain audiobook from Project Gutenberg.',
    language: seed.language,
    coverUrl: `https://www.gutenberg.org/cache/epub/${seed.id}/pg${seed.id}.cover.medium.jpg`,
    thumbnailUrl: `https://www.gutenberg.org/cache/epub/${seed.id}/pg${seed.id}.cover.medium.jpg`,
    numSections: tracks.length,
    genres: [...seed.genres],
    sourceTextUrl: `https://www.gutenberg.org/ebooks/${seed.id}`,
    librivoxUrl: payload.pageUrl || `https://www.gutenberg.org/ebooks/${seed.id}`,
    tracks,
    source: 'Project Gutenberg',
  };
};

export const fetchProjectGutenbergAudiobooks = async (limit = 8, query = '', signal?: AbortSignal): Promise<Audiobook[]> => {
  const normalizedQuery = normalizeSearchText(query);
  let seeds = PROJECT_GUTENBERG_AUDIO_CATALOG.filter((seed) => {
    if (!normalizedQuery) return true;
    const haystack = normalizeSearchText([seed.title, seed.author, ...seed.genres].join(' '));
    return normalizedQuery.split(' ').filter(Boolean).every((term) => haystack.includes(term));
  });

  if (normalizedQuery) {
    const gutenbergMatches = await searchBooksInGutendex(query, signal).catch(() => []);
    const dynamicSeeds = gutenbergMatches
      .filter((book) => book.gutenbergId)
      .map((book): ProjectGutenbergAudioSeed => ({
        id: String(book.gutenbergId),
        title: book.title,
        author: book.author || 'Project Gutenberg',
        language: book.language || 'en',
        genres: [book.category, ...(book.subjects || []), ...(book.bookshelves || [])].filter(Boolean).slice(0, 8),
      }));
    seeds = [...seeds, ...dynamicSeeds].filter((seed, index, list) => (
      list.findIndex((entry) => entry.id === seed.id) === index
    ));
  }

  seeds = seeds.slice(0, Math.max(limit, 6));

  const results = await Promise.allSettled(seeds.map(async (seed) => {
    const payload = await fetchProjectGutenbergAudioPayload(seed.id, signal);
    return payload ? mapProjectGutenbergAudioToAudiobook(seed, payload) : null;
  }));

  return results
    .flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
    .slice(0, limit);
};

const isPlayableArchiveAudioFile = (file: Record<string, unknown>) => {
  const name = toText(file.name);
  const format = toText(file.format).toLowerCase();
  if (toText(file.source) === 'derivative' && !/\.(mp3|ogg|oga)(?:$|[?#])/i.test(name)) return false;
  return /\.(mp3|ogg|oga)(?:$|[?#])/i.test(name)
    || /(?:vbr mp3|mp3|ogg vorbis|ogg audio)/i.test(format);
};

const getArchiveFileUrl = (identifier: string, name: string) => {
  const encodedName = name.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedName}`;
};

const fetchInternetArchiveMetadata = async (identifier: string, signal?: AbortSignal): Promise<InternetArchiveMetadataPayload | null> => {
  const cacheKey = `internet-archive-metadata:${identifier}`;
  const cached = getCached<InternetArchiveMetadataPayload>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${INTERNET_ARCHIVE_METADATA_BASE}/${encodeURIComponent(identifier)}`, { signal });
    if (!response.ok) return null;
    const payload = await response.json() as InternetArchiveMetadataPayload;
    setCached(cacheKey, payload);
    return payload;
  } catch {
    return null;
  }
};

const mapInternetArchiveAudioToAudiobook = (
  doc: InternetArchiveSearchDoc,
  payload: InternetArchiveMetadataPayload,
): Audiobook | null => {
  const metadata = payload.metadata || {};
  const identifier = doc.identifier || toText(metadata.identifier);
  if (!identifier) return null;

  const playableFiles = (payload.files || [])
    .filter(isPlayableArchiveAudioFile)
    .filter((file, index, list) => (
      list.findIndex((entry) => toText(entry.name) === toText(file.name)) === index
    ))
    .slice(0, 200);
  if (playableFiles.length === 0) return null;

  const title = toText(metadata.title, doc.title || 'Internet Archive audio');
  const author = toText(metadata.creator, toText(doc.creator, 'Internet Archive'));
  const description = stripHtml(toText(metadata.description, doc.description || 'Playable audio record from Internet Archive.'));
  const tracks = playableFiles.map((file, index): AudiobookTrack => {
    const name = toText(file.name);
    const url = getArchiveFileUrl(identifier, name);
    return {
      id: `${INTERNET_ARCHIVE_AUDIO_ID_PREFIX}${identifier}-${index + 1}`,
      sectionNumber: index + 1,
      title: name.replace(/\.(mp3|ogg|oga)$/i, '').replace(/[_-]+/g, ' ').trim() || `Track ${index + 1}`,
      listenUrl: url,
      fallbackUrls: buildAudioFallbackUrls(url),
      playtimeSeconds: toNumber(file.length),
      readers: [author],
    };
  });

  return {
    id: `${INTERNET_ARCHIVE_AUDIO_ID_PREFIX}${identifier}`,
    title,
    author,
    authors: [{ name: author }],
    description,
    language: toText(metadata.language, toText(doc.language, 'Unknown')),
    copyrightYear: toText(metadata.date, doc.date || '').slice(0, 4) || undefined,
    coverUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    thumbnailUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    totalTimeSeconds: tracks.reduce((sum, track) => sum + (track.playtimeSeconds || 0), 0) || undefined,
    numSections: tracks.length,
    genres: ['Internet Archive', toText(metadata.subject)].filter(Boolean),
    sourceTextUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    librivoxUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    archiveUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    tracks,
    source: 'Internet Archive',
  };
};

export const fetchInternetArchiveAudiobooks = async (limit = 8, query = 'audio book', signal?: AbortSignal): Promise<Audiobook[]> => {
  const normalizedQuery = normalizeSearchText(query || 'audio book');
  const cacheKey = `internet-archive-audio:${normalizedQuery}:${limit}`;
  const cached = getCached<Audiobook[]>(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: `mediatype:audio AND (${query.trim() ? `title:(${query}) OR creator:(${query}) OR subject:(${query})` : 'collection:librivoxaudio OR subject:(audio book)'})`,
      rows: String(Math.min(20, Math.max(limit * 3, 8))),
      page: '1',
      output: 'json',
      sort: 'downloads desc',
    });
    ['identifier', 'title', 'creator', 'description', 'date', 'language', 'downloads'].forEach((field) => {
      params.append('fl[]', field);
    });
    const response = await fetch(`${INTERNET_ARCHIVE_ADVANCED_SEARCH_BASE}?${params.toString()}`, { signal });
    if (!response.ok) return [];
    const data = await response.json();
    const docs = (data.response?.docs || []) as InternetArchiveSearchDoc[];
    const settled = await Promise.allSettled(docs.map(async (doc) => {
      const metadata = await fetchInternetArchiveMetadata(doc.identifier, signal);
      return metadata ? mapInternetArchiveAudioToAudiobook(doc, metadata) : null;
    }));
    const audiobooks = dedupeAudiobooks(settled.flatMap((result) => (
      result.status === 'fulfilled' && result.value ? [result.value] : []
    ))).slice(0, limit);

    setCached(cacheKey, audiobooks);
    return audiobooks;
  } catch {
    return [];
  }
};

const searchYoBookAudiobooks = async (query: string, limit: number, signal?: AbortSignal): Promise<Audiobook[]> => {
  const books = await searchYoBookBooks(query, signal);
  return books
    .filter(isYoBookAudioBook)
    .map(mapYoBookAudioToAudiobook)
    .filter((audiobook): audiobook is Audiobook => Boolean(audiobook))
    .slice(0, limit);
};

export const fetchYoBookAudiobooks = async (limit = 12, signal?: AbortSignal): Promise<Audiobook[]> => {
  const cacheKey = `yobook-audio-featured:${limit}`;
  const cached = getCached<Audiobook[]>(cacheKey);
  if (cached) return cached;

  const sourceBooks = await fetchYoBookBooksBySource('cehrd-audio', limit, signal);
  const books = sourceBooks.length > 0
    ? sourceBooks
    : (await fetchBooksFromYoBook(1, 'Audio Drama', signal)).books;
  const audiobooks = books
    .filter(isYoBookAudioBook)
    .map(mapYoBookAudioToAudiobook)
    .filter((audiobook): audiobook is Audiobook => Boolean(audiobook))
    .slice(0, limit);

  setCached(cacheKey, audiobooks);
  return audiobooks;
};

const buildUrl = (query: AudiobookQuery, format: 'json' | 'jsonp', callbackName?: string) => {
  const params = new URLSearchParams({
    format,
    extended: query.extended === false ? '0' : '1',
    coverart: '1',
    limit: String(query.limit || 10),
    offset: String(query.offset || 0),
  });

  if (query.title) params.set('title', query.title);
  if (query.author) params.set('author', query.author);
  if (query.genre) params.set('genre', query.genre);
  if (query.id) params.set('id', query.id);
  if (callbackName) params.set('callback', callbackName);

  return `${LIBRIVOX_API_BASE}/?${params.toString()}`;
};

const fetchJsonp = <T>(query: AudiobookQuery): Promise<T> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('JSONP is only available in the browser.'));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__bitlibraryLibrivox${Date.now()}${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete (window as any)[callbackName];
      script.remove();
    };

    (window as any)[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    script.src = buildUrl(query, 'jsonp', callbackName);
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error('LibriVox JSONP request failed.'));
    };
    document.head.appendChild(script);
  });
};

const requestAudiobooks = async (query: AudiobookQuery): Promise<any[]> => {
  const cacheKey = JSON.stringify(query);
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  if (inFlightRequests[cacheKey]) return inFlightRequests[cacheKey];

  const request = (async () => {
    const data = typeof window === 'undefined'
      ? await fetch(buildUrl(query, 'json')).then((response) => response.json())
      : await fetchJsonp<{ books?: any[] }>(query);

    const books = data.books || [];
    setCached(cacheKey, books);
    return books;
  })();

  inFlightRequests[cacheKey] = request;
  try {
    return await request;
  } finally {
    delete inFlightRequests[cacheKey];
  }
};

export const fetchFeaturedAudiobooks = async (limit = 8): Promise<Audiobook[]> => {
  const cacheKey = `featured-audiobooks:${limit}:with-gutenberg-v1`;
  const cached = getCached<Audiobook[]>(cacheKey);
  if (cached) return cached;

  const [librivoxResult, gutenbergResult] = await Promise.allSettled([
    requestAudiobooks({ limit, offset: 0, extended: true }),
    fetchProjectGutenbergAudiobooks(Math.min(3, limit)),
  ]);
  const librivoxAudiobooks = librivoxResult.status === 'fulfilled' ? librivoxResult.value.map(mapAudiobook) : [];
  const gutenbergAudiobooks = gutenbergResult.status === 'fulfilled' ? gutenbergResult.value : [];
  const audiobooks = interleaveAudiobooks(librivoxAudiobooks, gutenbergAudiobooks).slice(0, limit);

  setCached(cacheKey, audiobooks);
  return audiobooks;
};

export const fetchPopularAudiobooks = async (limit = 8): Promise<Audiobook[]> => {
  const cacheKey = `popular-audiobooks:${limit}`;
  const cached = getCached<Audiobook[]>(cacheKey);
  if (cached) return cached;

  const popularTitles = [
    'Adventures of Sherlock Holmes',
    'Pride and Prejudice',
    'Alice in Wonderland',
    'Frankenstein',
    'Dracula',
    'A Christmas Carol',
    'Secret Garden',
    'Moby Dick',
    'Jane Eyre',
    'Treasure Island',
  ];

  const results = await Promise.allSettled(
    popularTitles.map((title) => requestAudiobooks({ title, limit: 3, offset: 0, extended: true }))
  );
  const audiobooks = results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .map(mapAudiobook)
    .filter((audiobook, index, list) => list.findIndex((entry) => entry.id === audiobook.id) === index)
    .slice(0, limit);

  setCached(cacheKey, audiobooks);
  return audiobooks;
};

export const fetchAudiobooksByGenre = async (genre: string, limit = 8, offset = 0): Promise<Audiobook[]> => {
  const category = AUDIOBOOK_CATEGORIES.find((item) => item.genre === genre || item.label === genre || item.id === genre.toLowerCase());
  const terms = (category?.matchTerms || [genre]).map(normalizeSearchText).filter(Boolean);
  const pageOffsets = [offset, offset + 50, offset + 100];
  const results = await Promise.allSettled(pageOffsets.map((pageOffset) => (
    requestAudiobooks({ limit: 50, offset: pageOffset, extended: true })
  )));
  const books = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const deduped = books.filter((item, index, list) => (
    list.findIndex((entry) => String(entry.id) === String(item.id)) === index
  ));
  const mapped = deduped.map(mapAudiobook);
  const matched = mapped.filter((audiobook) => {
    const haystack = normalizeSearchText([
      audiobook.title,
      audiobook.description,
      audiobook.genres.join(' '),
    ].join(' '));
    return terms.some((term) => haystack.includes(term));
  });

  return (matched.length ? matched : mapped).slice(0, limit);
};

export const searchAudiobooks = async (query: string, limit = 12): Promise<Audiobook[]> => {
  const trimmed = query.trim();
  if (!trimmed) return fetchFeaturedAudiobooks(limit);

  const [yoBookResult, gutenbergResult, archiveResult, ...fallbackResults] = await Promise.allSettled([
    searchYoBookAudiobooks(trimmed, limit),
    fetchProjectGutenbergAudiobooks(limit, trimmed),
    fetchInternetArchiveAudiobooks(Math.min(4, limit), trimmed),
    ...[0, 50, 100, 150].map((pageOffset) => (
      requestAudiobooks({ limit: 50, offset: pageOffset, extended: true })
    )),
  ]);
  const yoBookAudiobooks = yoBookResult.status === 'fulfilled' ? yoBookResult.value : [];
  const gutenbergAudiobooks = gutenbergResult.status === 'fulfilled' ? gutenbergResult.value : [];
  const archiveAudiobooks = archiveResult.status === 'fulfilled' ? archiveResult.value : [];
  const terms = normalizeSearchText(trimmed).split(' ').filter(Boolean);
  const fallbackBooks = fallbackResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const deduped = fallbackBooks.filter((item, index, list) => (
    list.findIndex((entry) => String(entry.id) === String(item.id)) === index
  ));

  const librivoxMatches = deduped
    .map(mapAudiobook)
    .filter((audiobook) => {
      const haystack = normalizeSearchText([
        audiobook.title,
        audiobook.author,
        audiobook.description,
        audiobook.genres.join(' '),
      ].join(' '));
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);

  return [...yoBookAudiobooks, ...gutenbergAudiobooks, ...archiveAudiobooks, ...librivoxMatches]
    .filter((audiobook, index, list) => list.findIndex((entry) => entry.id === audiobook.id) === index)
    .slice(0, limit);
};

export const fetchAudiobookById = async (id: string): Promise<Audiobook | null> => {
  if (id.startsWith(YOBOOK_AUDIO_ID_PREFIX)) {
    const book = await fetchBookById(`yobook-${id.replace(YOBOOK_AUDIO_ID_PREFIX, '')}`);
    return book && isYoBookAudioBook(book) ? mapYoBookAudioToAudiobook(book) : null;
  }

  if (id.startsWith(GUTENBERG_AUDIO_ID_PREFIX)) {
    const gutenbergId = id.replace(GUTENBERG_AUDIO_ID_PREFIX, '').split('-')[0];
    const seed = PROJECT_GUTENBERG_AUDIO_CATALOG.find((item) => item.id === gutenbergId);
    if (!seed) return null;
    const payload = await fetchProjectGutenbergAudioPayload(seed.id);
    return payload ? mapProjectGutenbergAudioToAudiobook(seed, payload) : null;
  }

  if (id.startsWith(INTERNET_ARCHIVE_AUDIO_ID_PREFIX)) {
    const identifier = id.replace(INTERNET_ARCHIVE_AUDIO_ID_PREFIX, '');
    const payload = await fetchInternetArchiveMetadata(identifier);
    return payload ? mapInternetArchiveAudioToAudiobook({ identifier }, payload) : null;
  }

  const cleanId = id.replace(/^librivox-/, '');
  try {
    const books = await requestAudiobooks({ id: cleanId, limit: 1, offset: 0, extended: true });
    return books[0] ? mapAudiobook(books[0]) : null;
  } catch {
    return null;
  }
};
