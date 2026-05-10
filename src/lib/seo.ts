export const SITE_URL = 'https://bitlibrary.bitnepal.net';
export const SITE_NAME = 'BitLibrary';
export const DEFAULT_TITLE = 'BitLibrary | Open Digital Library for Books, Authors, and Research';
export const DEFAULT_DESCRIPTION =
  'Discover public-domain books, open archives, classic literature, authors, and study-friendly reading tools in BitLibrary.';
export const DEFAULT_KEYWORDS = [
  'BitLibrary',
  'digital library',
  'open digital library',
  'public domain books',
  'free ebooks',
  'open books',
  'online library',
  'classic literature',
  'book discovery',
  'research books',
  'educational books',
  'Gutendex',
  'Open Library',
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
