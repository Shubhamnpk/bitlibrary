import type { Book, ResourceLink } from '@/types/index';

const isPdfLikeUrl = (url?: string) => (
  Boolean(url)
  && (
    /\.pdf(?:$|[?#])/i.test(url || '')
    || /\/pdf\/?$/i.test(url || '')
    || /\/api\/getpdf(?:$|[?#])/i.test(url || '')
    || /[?&](?:format|type|ext)=pdf(?:&|$)/i.test(url || '')
  )
);

const isTextLikeUrl = (url?: string) => (
  Boolean(url)
  && (
    /\.(?:txt|xml)(?:$|[?#])/i.test(url || '')
    || /fulltextxml/i.test(url || '')
    || /[?&](?:format|type|ext)=(?:txt|text|xml)(?:&|$)/i.test(url || '')
  )
);

const isHtmlLikeUrl = (url?: string) => (
  Boolean(url)
  && (
    /\.x?html?(?:$|[?#])/i.test(url || '')
    || /[?&](?:format|type|ext)=html?(?:&|$)/i.test(url || '')
    || /^https:\/\/archive\.org\/embed\/[^/?#]+/i.test(url || '')
  )
);

const isReadableResource = (link: ResourceLink) => (
  !['source', 'doi', 'metadata', 'landing'].includes(link.relation || '')
  && (
    link.format === 'pdf'
    || ((link.format === 'html' || link.format === 'text' || link.format === 'xml') && link.embeddable !== false)
  )
);

const isDownloadableResource = (link: ResourceLink) => (
  link.downloadable !== false
  && !['source', 'doi', 'metadata', 'landing'].includes(link.relation || '')
  && link.format !== 'source'
);

const isDownloadOnlySource = (book: Pick<Book, 'source' | 'providerSource'>) => {
  const sourceText = `${book.source || ''} ${book.providerSource || ''}`.toLowerCase();
  return sourceText.includes('datacite') || sourceText.includes('zenodo');
};

type AccessBook = Pick<Book, 'externalUrl' | 'downloadUrl' | 'resourceLinks' | 'chapterPdfUrls' | 'audioUrl' | 'source' | 'providerSource'>;

export const hasInAppReadableAccess = (book: AccessBook) => (
  !isDownloadOnlySource(book)
  && (
    Boolean(book.chapterPdfUrls?.some((chapter) => isPdfLikeUrl(chapter.pdfUrl)))
    || Boolean(book.resourceLinks?.some(isReadableResource))
    || isPdfLikeUrl(book.downloadUrl)
    || isTextLikeUrl(book.downloadUrl)
    || isPdfLikeUrl(book.externalUrl)
    || isTextLikeUrl(book.externalUrl)
    || isHtmlLikeUrl(book.externalUrl)
    || Boolean(book.audioUrl)
  )
);

export const hasDownloadOnlyAccess = (book: Pick<Book, 'downloadUrl' | 'resourceLinks' | 'chapterPdfUrls' | 'audioUrl'>) => (
  Boolean(book.downloadUrl)
  || Boolean(book.audioUrl)
  || Boolean(book.chapterPdfUrls?.length)
  || Boolean(book.resourceLinks?.some(isDownloadableResource))
);

export const getAccessMode = (book: AccessBook): 'read' | 'download' | 'none' => {
  if (hasInAppReadableAccess(book)) return 'read';
  if (hasDownloadOnlyAccess(book)) return 'download';
  return 'none';
};
