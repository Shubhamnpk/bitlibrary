export interface Author {
  name: string;
  birth_year?: number;
  death_year?: number;
}

export interface ChapterPdf {
  title: string;
  pdfUrl: string;
}

export interface ChapterAudio {
  chapter: number;
  chapterName: string;
  unit: string;
  url: string;
}

export interface QuestionPaper {
  title: string;
  year?: string;
  readUrl?: string;
  url?: string;
  downloadUrl?: string;
  sourceUrl?: string;
  coverUrl?: string;
  fileSize?: string;
}

export type ResourceFormat = 'pdf' | 'text' | 'xml' | 'epub' | 'html' | 'package' | 'source' | 'unknown';

export interface ResourceLink {
  url: string;
  format: ResourceFormat;
  provider: string;
  label?: string;
  relation?: 'reader' | 'download' | 'landing' | 'doi' | 'metadata' | 'source';
  embeddable?: boolean;
  downloadable?: boolean;
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
  keywords?: string[];
  bookshelves?: string[];
  externalUrl?: string;
  downloadUrl?: string;
  resourceLinks?: ResourceLink[];
  audioUrl?: string;
  gutenbergId?: number;
  grade?: number;
  level?: number;
  curriculum?: string;
  language?: string;
  country?: string;
  detailUrl?: string;
  sourceUrl?: string;
  chapterPdfUrls?: ChapterPdf[];
  collection_name?: string;
  question_papers?: QuestionPaper[];
  questionPaperCount?: number;
  providerSource?: string;
  source?: 'traditional' | 'neural' | 'Google Books' | 'IT Bookstore' | 'Gutendex' | 'Neural Lab' | 'Open Library' | 'YoBook' | 'arXiv' | 'Semantic Scholar' | 'PubMed Central' | 'Europe PMC' | 'OpenAlex' | 'Crossref' | 'DataCite' | 'Unpaywall' | (string & {});
}

export interface AudiobookTrack {
  id: string;
  sectionNumber: number;
  title: string;
  listenUrl: string;
  fallbackUrls?: string[];
  playtimeSeconds?: number;
  readers: string[];
}

export interface Audiobook {
  id: string;
  title: string;
  author: string;
  authors: Author[];
  description: string;
  language: string;
  copyrightYear?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  totalTime?: string;
  totalTimeSeconds?: number;
  numSections: number;
  genres: string[];
  sourceTextUrl?: string;
  librivoxUrl: string;
  archiveUrl?: string;
  rssUrl?: string;
  zipUrl?: string;
  tracks: AudiobookTrack[];
  source: 'LibriVox' | 'Internet Archive' | 'Project Gutenberg' | 'YoBook';
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

export type ThemeMode = 'dark' | 'light';

export interface UserProfile {
  displayName: string;
}

export interface UserSettings {
  theme: ThemeMode;
}

export interface LocalUserState {
  profile: UserProfile;
  settings: UserSettings;
  savedBooks: Book[];
  savedAudiobooks: Audiobook[];
  recentSearches: string[];
  recentlyViewed: Book[];
}
