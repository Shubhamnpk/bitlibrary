import path from 'path';
import { readFile } from 'node:fs/promises';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pdfProxyHandler from './api/pdf-proxy';
import { readerMessageHtml, readerTextHtml } from './api/lib/reader-renderer';

const buildResearchProxyTarget = (requestUrl: URL): string | null => {
  const provider = requestUrl.searchParams.get('provider');
  const copyParams = (upstream: URL, keys: string[]) => {
    keys.forEach((key) => {
      const value = requestUrl.searchParams.get(key);
      if (value) upstream.searchParams.set(key, value);
    });
    return upstream.toString();
  };

  if (provider === 'arxiv') return copyParams(new URL('https://export.arxiv.org/api/query'), ['search_query', 'id_list', 'start', 'max_results', 'sortBy', 'sortOrder']);
  if (provider === 'semanticscholar') return copyParams(new URL('https://api.semanticscholar.org/graph/v1/paper/search'), ['query', 'limit', 'fields']);
  if (provider === 'semanticscholar-paper') {
    const paperId = requestUrl.searchParams.get('paperId');
    if (!paperId || !/^[\w.:/-]+$/.test(paperId)) return null;
    return copyParams(new URL(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}`), ['fields']);
  }
  if (provider === 'pmc-search') return copyParams(new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'), ['db', 'term', 'retmode', 'retmax', 'sort']);
  if (provider === 'pmc-summary') return copyParams(new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'), ['db', 'id', 'retmode']);
  if (provider === 'europepmc') return copyParams(new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search'), ['query', 'format', 'pageSize', 'resultType', 'synonym']);
  if (provider === 'openalex') return copyParams(new URL('https://api.openalex.org/works'), ['search', 'per_page', 'sort', 'mailto']);
  if (provider === 'openalex-work') {
    const workId = requestUrl.searchParams.get('workId');
    if (!workId || !/^[\w:/.-]+$/.test(workId)) return null;
    return `https://api.openalex.org/works/${encodeURIComponent(workId)}`;
  }
  if (provider === 'crossref') return copyParams(new URL('https://api.crossref.org/works'), ['query', 'rows', 'sort', 'order', 'filter', 'mailto']);
  if (provider === 'crossref-work') {
    const doi = requestUrl.searchParams.get('doi');
    if (!doi || !/^10\.\S+\/\S+/.test(doi)) return null;
    return `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  }
  if (provider === 'datacite') return copyParams(new URL('https://api.datacite.org/dois'), ['query', 'page[size]']);
  if (provider === 'datacite-doi') {
    const doi = requestUrl.searchParams.get('doi');
    if (!doi || !/^10\.\S+\/\S+/.test(doi)) return null;
    return `https://api.datacite.org/dois/${encodeURIComponent(doi)}`;
  }
  if (provider === 'zenodo-record') {
    const recordId = requestUrl.searchParams.get('recordId');
    if (!recordId || !/^\d+$/.test(recordId)) return null;
    return `https://zenodo.org/api/records/${recordId}`;
  }
  if (provider === 'unpaywall') {
    const doi = requestUrl.searchParams.get('doi');
    const email = requestUrl.searchParams.get('email');
    if (!doi || !email) return null;
    const upstream = new URL(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`);
    upstream.searchParams.set('email', email);
    return upstream.toString();
  }

  return null;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/gutendex': {
          target: 'https://gutendex.com',
          changeOrigin: true,
          secure: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/gutendex/, ''),
        },
      },
    },
    plugins: [
      react(),
      {
        name: 'bitlibrary-api-proxies',
        configureServer(server) {
          server.middlewares.use('/api/xml-fixture-reader', async (req, res) => {
            try {
              const requestUrl = new URL(req.originalUrl || req.url || '', 'http://localhost');
              const name = requestUrl.searchParams.get('name') || 'maximal-jats';
              if (!/^[a-z0-9-]+$/i.test(name)) {
                res.statusCode = 400;
                res.setHeader('content-type', 'text/html; charset=utf-8');
                res.end(readerMessageHtml('Invalid fixture name.'));
                return;
              }
              const fixturePath = path.join(process.cwd(), 'public', 'fixtures', `${name}.xml`);
              const body = await readFile(fixturePath, 'utf8');
              res.statusCode = 200;
              res.setHeader('content-type', 'text/html; charset=utf-8');
              res.setHeader('cache-control', 'no-store');
              res.end(await readerTextHtml(body, 'application/xml', new URL(`https://fixtures.bitlibrary.local/${name}.xml`)));
            } catch (error) {
              res.statusCode = 404;
              res.setHeader('content-type', 'text/html; charset=utf-8');
              const message = error instanceof Error ? error.message : 'XML fixture was not found.';
              res.end(readerMessageHtml(`XML fixture was not found. ${message}`));
            }
          });
          server.middlewares.use('/api/pdf-proxy', (req, res) => {
            void pdfProxyHandler(req, res);
          });
          server.middlewares.use('/api/research-proxy', async (req, res) => {
            try {
              const requestUrl = new URL(req.url || '', 'http://localhost');
              const targetUrl = buildResearchProxyTarget(requestUrl);
              if (!targetUrl) {
                res.statusCode = 400;
                res.end('Unknown research provider.');
                return;
              }

              const provider = requestUrl.searchParams.get('provider');
              const upstream = await fetch(targetUrl, {
                headers: {
                  accept: provider === 'arxiv' ? 'application/atom+xml,application/xml,text/xml,*/*' : 'application/json,*/*',
                  'user-agent': 'BitLibrary/0.5.0 (academic research discovery; https://github.com/Shubhamnpk/bitlibrary)',
                },
              });
              const body = await upstream.arrayBuffer();

              res.statusCode = upstream.status;
              res.setHeader('content-type', upstream.headers.get('content-type') || (provider === 'arxiv' ? 'application/xml; charset=utf-8' : 'application/json; charset=utf-8'));
              res.setHeader('cache-control', upstream.ok ? 'public, max-age=1800' : 'no-store');
              res.setHeader('access-control-allow-origin', '*');
              res.end(Buffer.from(body));
            } catch {
              res.statusCode = 502;
              res.end('Research proxy failed.');
            }
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
