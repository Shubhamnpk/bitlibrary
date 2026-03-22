export interface Author {
  name: string;
  birth_year?: number;
  death_year?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string; // Primary display name
  authors?: Author[]; // Structured archival data
  category: string;
  description: string;
  coverGradient?: string;
  coverUrl?: string;
  year?: number;
  pages?: number;
  popularity?: number; // 0-100
  downloads?: number;
  subjects?: string[];
  bookshelves?: string[];
  externalUrl?: string;
  gutenbergId?: number;
  source?: 'traditional' | 'neural' | 'Google Books' | 'IT Bookstore' | 'Gutendex' | 'Neural Lab' | 'Open Library';
}

export enum ViewState {
  HOME = 'HOME',
  SEARCH = 'SEARCH',
  READER = 'READER',
  LIBRARY = 'LIBRARY',
  DETAILS = 'DETAILS',
  BOOKS = 'BOOKS',
  TERMS = 'TERMS',
  ABOUT = 'ABOUT'
}

export interface SearchFilters {
  category?: string;
  minYear?: number;
}
