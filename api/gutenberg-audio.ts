import type { IncomingMessage, ServerResponse } from 'node:http';

const AUDIO_LINK_PATTERN = /href=["']([^"']+\.(?:mp3|ogg))["'][^>]*>([^<]*)/gi;
const TITLE_PATTERN = /<h1[^>]*>(.*?)<\/h1>/i;

const stripHtml = (value: string) => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', statusCode === 200 ? 'public, max-age=21600, s-maxage=86400' : 'no-store');
  response.setHeader('access-control-allow-origin', '*');
  response.end(JSON.stringify(body));
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url || '/', 'https://bitlibrary.local');
  const id = requestUrl.searchParams.get('id');

  if (!id || !/^\d{1,8}$/.test(id)) {
    sendJson(response, 400, { error: 'Missing or invalid Project Gutenberg ebook id.' });
    return;
  }

  try {
    const pageUrl = `https://www.gutenberg.org/ebooks/${id}`;
    const upstream = await fetch(pageUrl, {
      headers: {
        accept: 'text/html,*/*',
        'user-agent': 'BitLibrary/0.6.0 (Project Gutenberg audio discovery; https://github.com/Shubhamnpk/bitlibrary)',
      },
    });

    if (!upstream.ok) {
      sendJson(response, upstream.status, { error: 'Project Gutenberg page was not reachable.' });
      return;
    }

    const html = await upstream.text();
    const title = stripHtml(html.match(TITLE_PATTERN)?.[1] || `Project Gutenberg #${id}`);
    const tracks: Array<{ url: string; title: string }> = [];
    const seenUrls = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = AUDIO_LINK_PATTERN.exec(html))) {
      const url = new URL(match[1], pageUrl).toString();
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      tracks.push({
        url,
        title: stripHtml(match[2]) || `Audio ${tracks.length + 1}`,
      });
    }

    sendJson(response, 200, {
      id,
      title,
      pageUrl,
      tracks,
    });
  } catch {
    sendJson(response, 502, { error: 'Project Gutenberg audio proxy failed.' });
  }
}
