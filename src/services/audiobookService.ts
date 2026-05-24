import { Audiobook, AudiobookTrack, Author, Book } from '@/types/index';
import { fetchBookById, fetchBooksFromYoBook, searchYoBookBooks } from '@/services/bookService';

const LIBRIVOX_API_BASE = 'https://librivox.org/api/feed/audiobooks';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_PREFIX = 'bitlibrary-audiobook-cache-v3';
const YOBOOK_AUDIO_ID_PREFIX = 'yobook-audio-';
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
    status: 'planned',
    description: 'Potential expansion source after item-level rights and file metadata checks.',
  },
  {
    id: 'project-gutenberg',
    name: 'Project Gutenberg',
    status: 'planned',
    description: 'Potential source-text matching layer, with audio added only when rights are clear.',
  },
] as const;

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
    const storageKey = `${CACHE_STORAGE_PREFIX}:${key}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const stored = JSON.parse(raw) as { data: T; timestamp: number };
    if (!stored?.timestamp || Date.now() - stored.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    cache[key] = stored;
    return stored.data;
  } catch {
    return null;
  }
};

const setCached = (key: string, data: unknown) => {
  const item = { data, timestamp: Date.now() };
  cache[key] = item;

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${CACHE_STORAGE_PREFIX}:${key}`, JSON.stringify(item));
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

  const { books } = await fetchBooksFromYoBook(1, 'Audio Drama', signal);
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
  const books = await requestAudiobooks({ limit, offset: 0, extended: true });
  return books.map(mapAudiobook);
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

  const [yoBookResult, ...fallbackResults] = await Promise.allSettled([
    searchYoBookAudiobooks(trimmed, limit),
    ...[0, 50, 100, 150].map((pageOffset) => (
      requestAudiobooks({ limit: 50, offset: pageOffset, extended: true })
    )),
  ]);
  const yoBookAudiobooks = yoBookResult.status === 'fulfilled' ? yoBookResult.value : [];
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

  return [...yoBookAudiobooks, ...librivoxMatches]
    .filter((audiobook, index, list) => list.findIndex((entry) => entry.id === audiobook.id) === index)
    .slice(0, limit);
};

export const fetchAudiobookById = async (id: string): Promise<Audiobook | null> => {
  if (id.startsWith(YOBOOK_AUDIO_ID_PREFIX)) {
    const book = await fetchBookById(`yobook-${id.replace(YOBOOK_AUDIO_ID_PREFIX, '')}`);
    return book && isYoBookAudioBook(book) ? mapYoBookAudioToAudiobook(book) : null;
  }

  const cleanId = id.replace(/^librivox-/, '');
  try {
    const books = await requestAudiobooks({ id: cleanId, limit: 1, offset: 0, extended: true });
    return books[0] ? mapAudiobook(books[0]) : null;
  } catch {
    return null;
  }
};
