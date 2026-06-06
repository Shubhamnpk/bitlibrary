import type { Book, ResourceFormat, ResourceLink } from '@/types/index';

export interface DownloadOption {
  id: string;
  url: string;
  href: string;
  label: string;
  format: ResourceFormat;
  provider?: string;
}

const FORMAT_EXTENSIONS: Partial<Record<ResourceFormat, string>> = {
  pdf: 'pdf',
  text: 'txt',
  xml: 'xml',
  epub: 'epub',
  package: 'zip',
  audio: 'mp3',
  video: 'mp4',
};

const DOWNLOAD_PRIORITY: ResourceFormat[] = ['pdf', 'epub', 'package', 'text', 'xml', 'audio', 'video', 'html', 'unknown'];

const getUrlFilename = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    const fileName = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
    return fileName.replace(/[\\/:*?"<>|]+/g, '-').trim();
  } catch {
    return '';
  }
};

const hasReadableAscii = (value: string) => /[a-z0-9]{3,}/i.test(value);

const getSafeFilename = (title: string, format: ResourceFormat, url: string) => {
  const titleFilename = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    || 'download';
  const extension = FORMAT_EXTENSIONS[format];
  const urlFilename = getUrlFilename(url);
  const safeTitle = hasReadableAscii(titleFilename) ? titleFilename : (urlFilename || titleFilename);
  if (!extension || new RegExp(`\\.${extension}$`, 'i').test(safeTitle)) return safeTitle;
  return `${safeTitle}.${extension}`;
};

export const getDownloadProxyUrl = (url: string, title: string, format: ResourceFormat) => {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}&download=1&filename=${encodeURIComponent(getSafeFilename(title, format, url))}`;
};

export const downloadResource = (option: DownloadOption) => {
  const link = document.createElement('a');
  link.href = option.href;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const inferDownloadFormat = (url = '', label = ''): ResourceFormat => {
  const signature = `${url} ${label}`.toLowerCase();
  if (/\.pdf(?:$|[?#])|\/pdf\/?|application\/pdf|\bpdf\b/.test(signature)) return 'pdf';
  if (/\.epub(?:$|[?#])|\bepub\b/.test(signature)) return 'epub';
  if (/\.(?:zip|tar|gz|tgz)(?:$|[?#])|\b(?:zip|archive|package|tgz|tar)\b/.test(signature)) return 'package';
  if (/\.(?:xml|jats)(?:$|[?#])|\b(?:xml|jats|bioc)\b/.test(signature)) return 'xml';
  if (/\.(?:txt|text)(?:$|[?#])|\b(?:text|plain)\b/.test(signature)) return 'text';
  if (/\.(?:mp3|m4a|wav|ogg|aac)(?:$|[?#])|\b(?:audio|mp3|m4a)\b/.test(signature)) return 'audio';
  if (/\.(?:mp4|webm|mov|mkv)(?:$|[?#])|\b(?:video|mp4|webm)\b/.test(signature)) return 'video';
  if (/\.html?(?:$|[?#])|\bhtml\b/.test(signature)) return 'html';
  return 'unknown';
};

const optionLabel = (format: ResourceFormat, label?: string, provider?: string) => {
  const cleanLabel = label?.replace(/\s+/g, ' ').trim();
  if (cleanLabel && !/^download$/i.test(cleanLabel) && cleanLabel.toLowerCase() !== format) return cleanLabel;
  return [format === 'unknown' ? 'File' : format.toUpperCase(), provider].filter(Boolean).join(' - ');
};

const addOption = (
  options: DownloadOption[],
  seen: Set<string>,
  title: string,
  url: string | undefined,
  format: ResourceFormat,
  label?: string,
  provider?: string,
) => {
  if (!url) return;
  const key = url.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  const resolvedFormat = format === 'unknown' ? inferDownloadFormat(url, label) : format;
  options.push({
    id: `${resolvedFormat}:${key}`,
    url,
    href: getDownloadProxyUrl(url, title, resolvedFormat),
    label: optionLabel(resolvedFormat, label, provider),
    format: resolvedFormat,
    provider,
  });
};

const isDownloadableResource = (link: ResourceLink) => (
  link.downloadable !== false
  && (link.relation !== 'reader' || link.format === 'pdf')
  && !['source', 'doi', 'metadata', 'landing'].includes(link.relation || '')
  && link.format !== 'source'
);

export const getBookDownloadOptions = (book: Book): DownloadOption[] => {
  const options: DownloadOption[] = [];
  const seen = new Set<string>();

  (book.resourceLinks || [])
    .filter(isDownloadableResource)
    .forEach((link) => addOption(options, seen, book.title, link.url, link.format, link.label, link.provider));

  addOption(options, seen, book.title, book.downloadUrl, inferDownloadFormat(book.downloadUrl), 'Primary download', book.source);
  addOption(options, seen, book.title, book.audioUrl, 'audio', 'Audio', book.source);

  (book.chapterPdfUrls || []).forEach((chapter, index) => {
    addOption(options, seen, `${book.title} - ${chapter.title || `Chapter ${index + 1}`}`, chapter.pdfUrl, 'pdf', chapter.title || `Chapter ${index + 1}`, book.source);
  });

  return options.sort((first, second) => {
    const priorityDelta = DOWNLOAD_PRIORITY.indexOf(first.format) - DOWNLOAD_PRIORITY.indexOf(second.format);
    if (priorityDelta !== 0) return priorityDelta;
    return first.label.localeCompare(second.label);
  });
};
