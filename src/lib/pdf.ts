import type { Book } from '@/types/index';

export const isPdfLikeUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.pdf(?:$|[?#])/i.test(url || '')
    || /[?&]ext=pdf(?:&|$)/i.test(url || '')
  )
);

export const getPdfProxyUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
};

export const getBestPdfSourceUrl = (book: Pick<Book, 'downloadUrl' | 'externalUrl' | 'sourceUrl' | 'detailUrl'>): string | undefined => (
  [book.downloadUrl, book.externalUrl, book.sourceUrl, book.detailUrl].find(isPdfLikeUrl)
);

const getSafePdfFilename = (title: string) => {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    || 'book';

  return /\.pdf$/i.test(safeTitle) ? safeTitle : `${safeTitle}.pdf`;
};

export const downloadPdfLocally = async (sourceUrl: string, title: string): Promise<void> => {
  const response = await fetch(getPdfProxyUrl(sourceUrl));
  if (!response.ok) throw new Error('Unable to download PDF.');

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = getSafePdfFilename(title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
