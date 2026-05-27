import type { IncomingMessage, ServerResponse } from 'node:http';
const ALLOWED_PDF_HOSTS = new Set([
  'learning.cehrd.gov.np',
  'lib.moecdc.gov.np',
  'ncert.nic.in',
  'yobook-api.vercel.app',
  'pustakalaya.org',
  'www.pustakalaya.org',
]);

const ALLOWED_PDF_DOMAIN_SUFFIXES = [
  '.pustakalaya.org',
];

const isAllowedPdfHost = (hostname: string) => {
  const normalizedHostname = hostname.toLowerCase();
  return (
    ALLOWED_PDF_HOSTS.has(normalizedHostname) ||
    ALLOWED_PDF_DOMAIN_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix))
  );
};

const sendText = (response: ServerResponse, statusCode: number, message: string) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(message);
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url || '/', 'https://bitlibrary.local');
  const rawUrl = requestUrl.searchParams.get('url');

  if (!rawUrl) {
    sendText(response, 400, 'Missing url parameter.');
    return;
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    sendText(response, 400, 'Invalid url parameter.');
    return;
  }

  if (target.protocol !== 'https:' || !isAllowedPdfHost(target.hostname)) {
    sendText(response, 403, 'PDF host is not allowed.');
    return;
  }

  const upstreamHeaders = new Headers({
    accept: 'application/pdf,*/*',
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
      sendText(response, upstream.status || 502, 'Unable to fetch PDF.');
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    if (!contentType.toLowerCase().includes('pdf')) {
      sendText(response, 415, 'Target is not a PDF.');
      return;
    }

    response.statusCode = upstream.status;
    response.setHeader('content-type', contentType);
    response.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400');
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes');

    ['content-length', 'content-range'].forEach((headerName) => {
      const headerValue = upstream.headers.get(headerName);
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
    sendText(response, 502, 'PDF proxy failed.');
  }
}
