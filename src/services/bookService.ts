import { Book } from '@/types/index';

const GUTENDEX_BASE = 'https://gutendex.com/books';

export const fetchBooksFromGutendex = async (page = 1, category?: string): Promise<{ books: Book[], next: string | null }> => {
  try {
    let url = `${GUTENDEX_BASE}/?page=${page}&languages=en`;
    if (category && category !== 'All') {
      url += `&topic=${encodeURIComponent(category)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    return {
      books: data.results.map((item: any) => mapGutendexToBook(item)),
      next: data.next
    };
  } catch (error) {
    console.error('Failed to fetch from Gutendex:', error);
    return { books: [], next: null };
  }
};

export const searchBooksInGutendex = async (query: string): Promise<Book[]> => {
  try {
    const url = `${GUTENDEX_BASE}/?search=${encodeURIComponent(query)}&languages=en`;
    const response = await fetch(url);
    const data = await response.json();

    return data.results.map((item: any) => mapGutendexToBook(item));
  } catch (error) {
    console.error('Search failed in Gutendex:', error);
    return [];
  }
};

import { INITIAL_BOOKS } from '@/constants';

export const fetchBookById = async (id: string): Promise<Book | null> => {
  // Handle Gutenberg books
  if (id.startsWith('gutenberg-')) {
    const gutenbergId = id.replace('gutenberg-', '');
    try {
      const response = await fetch(`${GUTENDEX_BASE}/${gutenbergId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return mapGutendexToBook(data);
    } catch (err) {
      console.error('Failed to fetch archival volume:', err);
      return null;
    }
  }

  // Handle local synthetic books (from constants)
  return INITIAL_BOOKS.find(b => b.id === id) || null;
};

const mapGutendexToBook = (item: any): Book => {
  // Extract authors
  const author = item.authors && item.authors.length > 0 
    ? item.authors.map((a: any) => a.name).join(', ') 
    : 'Unknown Entity';

  // Choose a primary category
  const category = item.subjects && item.subjects.length > 0 
    ? item.subjects[0].split(' -- ')[0] 
    : 'Unknown Science';

  // Get cover image from formats or Open Library fallback
  const coverUrl = item.formats['image/jpeg'] || `https://covers.openlibrary.org/b/id/${item.id}-L.jpg`;

  return {
    id: `gutenberg-${item.id}`,
    gutenbergId: item.id,
    title: item.title,
    author: author,
    category: category,
    description: `A classical volume found in the neural archives. This work has been transcribed and processed for modern consumption. Part of the ${category} series.`,
    coverUrl: coverUrl,
    popularity: Math.min(Math.round(item.download_count / 100), 100),
    externalUrl: item.formats['text/html'] || item.formats['application/epub+zip']
  };
};
