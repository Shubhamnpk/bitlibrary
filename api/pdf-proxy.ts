const ALLOWED_PDF_HOSTS = new Set([
  'learning.cehrd.gov.np',
  'yobook-api.vercel.app',
  'pustakalaya.org',
]);

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return new Response('Missing url parameter.', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response('Invalid url parameter.', { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_PDF_HOSTS.has(target.hostname)) {
    return new Response('PDF host is not allowed.', { status: 403 });
  }

  const upstreamHeaders = new Headers({
    accept: 'application/pdf,*/*',
  });
  const range = request.headers.get('range');
  if (range) {
    upstreamHeaders.set('range', range);
  }

  const upstream = await fetch(target, {
    headers: upstreamHeaders,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Unable to fetch PDF.', { status: upstream.status || 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'application/pdf';
  if (!contentType.toLowerCase().includes('pdf')) {
    return new Response('Target is not a PDF.', { status: 415 });
  }

  const headers = new Headers({
    'content-type': contentType,
    'cache-control': 'public, max-age=3600, s-maxage=86400',
    'access-control-allow-origin': '*',
    'accept-ranges': upstream.headers.get('accept-ranges') || 'bytes',
  });

  ['content-length', 'content-range'].forEach((headerName) => {
    const headerValue = upstream.headers.get(headerName);
    if (headerValue) headers.set(headerName, headerValue);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
