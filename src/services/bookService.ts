import { Book } from '@/types/index';
import { INITIAL_BOOKS } from '@/constants';

const GUTENDEX_BASE = 'https://gutendex.com/books';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
const IT_BOOKSTORE_BASE = 'https://api.itbook.store/1.0';

// --- Neural Cache Configuration (5 Minute TTL) ---
const CACHE_TTL = 5 * 60 * 1000; 
const cache: Record<string, { data: any, timestamp: number }> = {};

const getFromCache = <T>(key: string): T | null => {
  const item = cache[key];
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    console.log(`[Cache Sync] Synchronized Node ${key} from memory registry.`);
    return item.data as T;
  }
  return null;
};

const setInCache = (key: string, data: any) => {
  cache[key] = { data, timestamp: Date.now() };
};

// --- Archival Data Mappers ---
const mapGutendexToBook = (item: any): Book => {
  const author = item.authors && item.authors.length > 0 ? item.authors.map((a: any) => a.name).join(', ') : 'Unknown Entity';
  const category = item.subjects && item.subjects.length > 0 ? item.subjects[0].split(' -- ')[0] : 'Unknown Science';
  const coverUrl = item.formats['image/jpeg'] || `https://covers.openlibrary.org/b/id/${item.id}-L.jpg`;

  return {
    id: `gutenberg-${item.id}`,
    gutenbergId: item.id,
    title: item.title,
    author,
    category,
    description: `Classical volume found in neural archives. ${category}.`,
    coverUrl,
    popularity: Math.min(Math.round(item.download_count / 100), 100),
    externalUrl: item.formats['text/html'] || item.formats['application/epub+zip'],
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
    author: (info.authors || []).join(', ') || 'Unknown Author',
    category: (info.categories || [])[0] || 'Uncategorized',
    description: info.description || 'No neural description found for this volume.',
    coverUrl: info.imageLinks?.thumbnail || `https://covers.openlibrary.org/b/isbn/${info.industryIdentifiers?.[0]?.identifier}-L.jpg`,
    year: parseInt(info.publishedDate?.split('-')[0]) || undefined,
    pages: info.pageCount,
    source: 'Google Books',
    externalUrl: embedUrl
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

// --- Exported Archival Connectors ---

export const fetchBooksFromGutendex = async (page = 1, category?: string): Promise<{ books: Book[], next: string | null }> => {
  const cacheKey = `gutendex-list-${page}-${category || 'all'}`;
  const cached = getFromCache<{ books: Book[], next: string | null }>(cacheKey);
  if (cached) return cached;

  try {
    let url = `${GUTENDEX_BASE}/?page=${page}&languages=en`;
    if (category && category !== 'All') {
      url += `&topic=${encodeURIComponent(category)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    const result = {
      books: data.results.map((item: any) => mapGutendexToBook(item)),
      next: data.next
    };
    setInCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Failed to fetch from Gutendex:', error);
    return { books: [], next: null };
  }
};

export const searchBooksInGutendex = async (query: string): Promise<Book[]> => {
  const cacheKey = `gutendex-search-${query}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${GUTENDEX_BASE}/?search=${encodeURIComponent(query)}&languages=en`;
    const response = await fetch(url);
    const data = await response.json();

    const result = data.results.map((item: any) => mapGutendexToBook(item));
    setInCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Search failed in Gutendex:', error);
    return [];
  }
};

export const searchGoogleBooks = async (query: string): Promise<Book[]> => {
  const cacheKey = `google-search-${query}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=10`);
    const data = await response.json();
    const result = (data.items || []).map((item: any) => mapGoogleToBook(item));
    setInCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Google Books sync failed:', err);
    return [];
  }
};

export const searchITBooks = async (query: string): Promise<Book[]> => {
  const cacheKey = `itbooks-search-${query}`;
  const cached = getFromCache<Book[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${IT_BOOKSTORE_BASE}/search/${encodeURIComponent(query)}`);
    const data = await response.json();
    const result = (data.books || []).map((item: any) => mapITToBook(item));
    setInCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('IT Bookstore sync failed:', err);
    return [];
  }
};

export const fetchBookById = async (id: string): Promise<Book | null> => {
  const cacheKey = `book-detail-${id}`;
  const cached = getFromCache<Book>(cacheKey);
  if (cached) return cached;

  try {
    // Handle Gutenberg books
    if (id.startsWith('gutenberg-')) {
      const gutenbergId = id.replace('gutenberg-', '');
      const response = await fetch(`${GUTENDEX_BASE}/${gutenbergId}`);
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
