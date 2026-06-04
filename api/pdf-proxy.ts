import type { IncomingMessage, ServerResponse } from 'node:http';
import { readerMessageHtml, readerTextHtml } from './lib/reader-renderer';

const sendText = (response: ServerResponse, statusCode: number, message: string) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(message);
};

const isPrivateReaderHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === 'metadata.google.internal'
    || normalized === '169.254.169.254'
    || /^127\./.test(normalized)
    || /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    || normalized === '::1'
    || normalized === '[::1]';
};

const isXmlLikeReaderTarget = (target: URL) => (
  /\.xml(?:$|[?#])/i.test(target.toString())
  || /\/BioC_xml\//i.test(target.pathname)
  || /fullTextXML/i.test(target.toString())
  || /[?&](?:format|type|ext)=xml(?:&|$)/i.test(target.search)
);

const isTextLikeReaderTarget = (target: URL) => (
  /\.txt(?:$|[?#])/i.test(target.toString())
  || /[?&](?:format|type|ext)=(?:txt|text)(?:&|$)/i.test(target.search)
);

const sendReaderMessage = (response: ServerResponse, statusCode: number, message: string) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(readerMessageHtml(message));
};

const sendReaderTextDocument = async (response: ServerResponse, statusCode: number, body: string, contentType: string, target: URL) => {
  const html = await readerTextHtml(body, contentType, target);
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400');
  response.setHeader('access-control-allow-origin', '*');
  response.end(html);
};

const getSafePdfFilename = (title: string | null) => {
  const safeTitle = (title || 'book')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    || 'book';

  return /\.pdf$/i.test(safeTitle) ? safeTitle : `${safeTitle}.pdf`;
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url || '/', 'https://bitlibrary.local');
  const rawUrl = requestUrl.searchParams.get('url');
  const shouldDownload = requestUrl.searchParams.get('download') === '1';
  const isReaderRequest = requestUrl.searchParams.get('reader') === '1';

  if (!rawUrl) {
    (isReaderRequest ? sendReaderMessage : sendText)(response, 400, 'Missing url parameter.');
    return;
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    (isReaderRequest ? sendReaderMessage : sendText)(response, 400, 'Invalid url parameter.');
    return;
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    (isReaderRequest ? sendReaderMessage : sendText)(response, 403, `Reader URL protocol is not allowed: ${target.protocol}`);
    return;
  }
  if (isPrivateReaderHostname(target.hostname)) {
    (isReaderRequest ? sendReaderMessage : sendText)(response, 403, 'Reader URL host is private or local.');
    return;
  }

  const upstreamHeaders = new Headers({
    accept: isReaderRequest ? 'application/pdf,application/xml,text/xml,text/plain,*/*' : 'application/pdf,*/*',
    'user-agent': 'BitLibrary/0.5.0 (reader proxy; academic research access)',
  });
  const range = request.headers.range;
  if (typeof range === 'string') {
    upstreamHeaders.set('range', range);
  }

  try {
    const upstream = await fetch(target, {
      headers: upstreamHeaders,
    });

    if (!upstream.ok || !upstream.body) {
      (isReaderRequest ? sendReaderMessage : sendText)(response, upstream.status || 502, 'Unable to fetch reader resource.');
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    const normalizedContentType = contentType.toLowerCase();
    const isPdfUrl = /\.pdf(?:$|[?#])/i.test(target.toString()) || /\/pdf\/?$/i.test(target.pathname) || /\/api\/getpdf\/?$/i.test(target.pathname);
    const isXmlUrl = isXmlLikeReaderTarget(target);
    const isTextUrl = isTextLikeReaderTarget(target);
    const isSupportedReaderContent = (
      normalizedContentType.includes('pdf')
      || normalizedContentType.includes('xml')
      || normalizedContentType.includes('text/plain')
      || isXmlUrl
      || isTextUrl
    );
    if (!normalizedContentType.includes('pdf') && !isPdfUrl && (!isReaderRequest || !isSupportedReaderContent)) {
      (isReaderRequest ? sendReaderMessage : sendText)(response, 415, isReaderRequest ? 'Target is not a supported reader resource.' : 'Target is not a PDF.');
      return;
    }

    if (isReaderRequest && (normalizedContentType.includes('xml') || normalizedContentType.includes('text/plain') || isXmlUrl || isTextUrl)) {
      const body = await upstream.text();
      await sendReaderTextDocument(response, upstream.status, body, contentType, target);
      return;
    }

    response.statusCode = upstream.status;
    response.setHeader('content-type', isPdfUrl && !normalizedContentType.includes('pdf') ? 'application/pdf' : contentType);
    response.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400');
    response.setHeader('access-control-allow-origin', '*');
    const upstreamHonoredRange = !range || upstream.status === 206;
    response.setHeader('accept-ranges', upstreamHonoredRange ? upstream.headers.get('accept-ranges') || 'bytes' : 'none');
    if (shouldDownload) {
      response.setHeader('content-disposition', `attachment; filename="${getSafePdfFilename(requestUrl.searchParams.get('filename'))}"`);
    }

    ['content-length', 'content-range'].forEach((headerName) => {
      const headerValue = upstream.headers.get(headerName);
      if (headerName === 'content-range' && !upstreamHonoredRange) return;
      if (headerValue) response.setHeader(headerName, headerValue);
    });

    const reader = upstream.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        response.end();
        return;
      }

      response.write(Buffer.from(value), () => {
        void pump();
      });
    };

    void pump();
  } catch {
    (isReaderRequest ? sendReaderMessage : sendText)(response, 502, 'Reader proxy failed.');
  }
}
