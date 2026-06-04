import { Author, Book } from '@/types/index';

const splitAuthorText = (value: string) => (
  value
    .split(/\s*(?:;|\band\b|&)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)
);

export const getBookAuthors = (book: Pick<Book, 'author' | 'authors' | 'collection_name'>): Author[] => {
  if (book.collection_name) return [{ name: book.collection_name }];
  if (book.authors?.length) return book.authors.filter((author) => author.name.trim());
  return splitAuthorText(book.author || 'Unknown Author').map((name) => ({ name }));
};

export const formatCompactAuthors = (
  authors: Author[],
  options: { maxVisible?: number } = {},
) => {
  const maxVisible = Math.max(1, options.maxVisible ?? 2);
  const visible = authors.slice(0, maxVisible);
  const remaining = Math.max(0, authors.length - visible.length);
  const names = visible.map((author) => author.name).join(', ');
  return remaining > 0 ? `${names} +${remaining} more` : names;
};
