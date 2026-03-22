export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverGradient: string;
  year: number;
  pages: number;
  popularity: number; // 0-100
}

export enum ViewState {
  HOME = 'HOME',
  SEARCH = 'SEARCH',
  READER = 'READER',
  LIBRARY = 'LIBRARY'
}

export interface SearchFilters {
  category?: string;
  minYear?: number;
}
