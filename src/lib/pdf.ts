import type { Book } from '@/types/index';

export const isPdfLikeUrl = (url?: string): boolean => (
  Boolean(url)
  && (
    /\.pdf(?:$|[?#])/i.test(url || '')
    || /\/pdf\/?$/i.test(url || '')
    || /\/api\/getpdf(?:$|[?#])/i.test(url || '')
    || /[?&]ext=pdf(?:&|$)/i.test(url || '')
    || /[?&](?:format|type)=pdf(?:&|$)/i.test(url || '')
  )
);

export const getPdfProxyUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
};

export const getReaderProxyUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}&reader=1`;
};

export const getPdfProxyDownloadUrl = (url: string, title: string): string => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}&download=1&filename=${encodeURIComponent(getSafePdfFilename(title))}`;
};

export const getBestPdfSourceUrl = (book: Pick<Book, 'downloadUrl' | 'externalUrl' | 'sourceUrl' | 'detailUrl' | 'resourceLinks'>): string | undefined => (
  [
    ...(book.resourceLinks || []).filter((link) => link.format === 'pdf').map((link) => link.url),
    book.downloadUrl,
    book.externalUrl,
    book.sourceUrl,
    book.detailUrl,
  ].find(isPdfLikeUrl)
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

const clickDownloadLink = (href: string, title: string): void => {
  const link = document.createElement('a');
  link.href = href;
  link.download = getSafePdfFilename(title);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const downloadPdfViaProxy = (sourceUrl: string, title: string): void => {
  clickDownloadLink(getPdfProxyDownloadUrl(sourceUrl, title), title);
};

const downloadPdfFromBrowser = async (sourceUrl: string, title: string): Promise<void> => {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error('Unable to fetch PDF directly.');

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  clickDownloadLink(objectUrl, title);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export const downloadPdfOptimized = async (sourceUrl: string, title: string): Promise<void> => {
  try {
    await downloadPdfFromBrowser(sourceUrl, title);
  } catch {
    downloadPdfViaProxy(sourceUrl, title);
  }
};
