export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverGradient?: string;
  coverUrl?: string;
  year?: number;
  pages?: number;
  popularity?: number; // 0-100
  externalUrl?: string;
  gutenbergId?: number;
  source?: 'traditional' | 'neural' | 'Google Books' | 'IT Bookstore' | 'Gutendex' | 'Neural Lab';
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
