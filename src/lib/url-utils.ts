import type { Book, ResourceLink } from '@/types/index';

export const isPdfLikeUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.pdf(?:$|[?#])/i.test(url || '')
    || /\/pdf\/?$/i.test(url || '')
    || /\/api\/getpdf(?:$|[?#])/i.test(url || '')
    || /[?&](?:format|type|ext)=pdf(?:&|$)/i.test(url || '')
  )
);

export const isTextLikeUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.(?:txt|xml)(?:$|[?#])/i.test(url || '')
    || /fulltextxml/i.test(url || '')
    || /[?&](?:format|type|ext)=(?:txt|text|xml)(?:&|$)/i.test(url || '')
  )
);

export const isHtmlLikeUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.x?html?(?:$|[?#])/i.test(url || '')
    || /[?&](?:format|type|ext)=html?(?:&|$)/i.test(url || '')
    || /^https:\/\/(?:www\.)?archive\.org\/embed\/[^/?#]+/i.test(url || '')
  )
);

export const isEpubLikeUrl = (url?: string): boolean => (
  Boolean(url) && /\.epub(?:$|[?#])/i.test(url || '')
);

export const isArchiveEmbedUrl = (url?: string): boolean => (
  Boolean(url) && /^https:\/\/(?:www\.)?archive\.org\/embed\/[^/?#]+/i.test(url || '')
);

export const isReadableResource = (link: ResourceLink): boolean => (
  ['pdf', 'text', 'xml', 'epub', 'html'].includes(link.format)
  && !['source', 'doi', 'metadata', 'landing'].includes(link.relation || '')
  && (link.format !== 'html' || link.embeddable !== false)
);

export const isDownloadableResource = (link: ResourceLink): boolean => (
  link.downloadable !== false
  && !['source', 'doi', 'metadata', 'landing'].includes(link.relation || '')
  && link.format !== 'source'
);

export const clickDownloadLink = (href: string, filename?: string): void => {
  const link = document.createElement('a');
  link.href = href;
  if (filename) link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const dedupeBooks = (books: Book[]): Book[] => {
  const seen = new Set<string>();
  return books.filter((book) => {
    if (!book?.id || seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  });
};
