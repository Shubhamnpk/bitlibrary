export const SITE_URL = 'https://bitlibrary.bitnepal.net';
export const SITE_NAME = 'BitLibrary';
export const DEFAULT_LOCALE = 'en_US';
export const DEFAULT_TITLE = 'BitLibrary | Open Digital Library for Books, Authors, and Research';
export const DEFAULT_DESCRIPTION =
  'Discover public-domain books, open archives, classic literature, authors, and study-friendly reading tools in BitLibrary. The open digital library for students and researchers.';

export const DEFAULT_KEYWORDS = [
  'BitLibrary', 'bitlibrary', 'bit library', 'bitnepal library',
  'digital library', 'open digital library', 'online library',
  'public domain books', 'free ebooks', 'free books online',
  'open books', 'classic literature',
  'book discovery', 'research books', 'educational books',
  'Gutendex', 'Open Library', 'Project Gutenberg',
  'Nepali books', 'Nepali curriculum books', 'CDC Nepal textbooks',
  'free audiobooks', 'LibriVox',
];

const MISSPELLED_KEYWORDS = [
  'piblic domain', 'publik domain', 'pablic domain',
  'digitial library', 'digetal library', 'digatal libary', 'digital libary',
  'onlin library', 'onlie library', 'onlne librery',
  'free ebookes', 'free e-books', 'fre ebooks',
  'claasic literature', 'clasic literature', 'clasical litrature',
  'librery', 'libary', 'librarry',
  'open libary', 'opne library', 'opne libary',
  'gutendex', 'gutenberg books',
  'nepli books', 'nepali buks', 'nepali curiculum',
  'audiobooks free', 'audio books', 'free audio books',
  'CDC Nepal', 'cdc nepal textbook', 'nepal education',
  'bitnepal', 'BitNepal', 'bit nepal',
  'bitlibery', 'bitlibry', 'bitlibary', 'bitlibrery',
  'libery bit', 'libry bit', 'libary bit',
  'bit libary', 'bit librery', 'bit libry',
  'open bitnepal', 'opne bitnepal', 'open bitnepla',
  'openlibery', 'openlibry', 'openlibary', 'openlibrery',
];

export const GEO_KEYWORDS = [
  ...DEFAULT_KEYWORDS,
  ...MISSPELLED_KEYWORDS,
];

export const toAbsoluteUrl = (path = '/') => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
};

export const truncate = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const createBreadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: toAbsoluteUrl(item.path),
  })),
});

export const createItemListSchema = (
  items: Array<{ name: string; path: string; image?: string }>,
  name: string
) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  itemListElement: items.slice(0, 12).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: toAbsoluteUrl(item.path),
    name: item.name,
    ...(item.image ? { image: item.image } : {}),
  })),
});

export const createSpeakableSchema = (cssSelector: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector,
  },
});

export const createFaqSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

export const createSearchActionSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});
