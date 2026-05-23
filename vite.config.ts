import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ALLOWED_PDF_HOSTS = new Set([
  'learning.cehrd.gov.np',
  'yobook-api.vercel.app',
  'pustakalaya.org',
]);

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
            rewrite: (path) => path.replace(/^\/api\/gutendex/, ''),
          },
        },
      },
      plugins: [
        react(),
        {
          name: 'bitlibrary-pdf-proxy',
          configureServer(server) {
            server.middlewares.use('/api/pdf-proxy', async (req, res) => {
              try {
                const requestUrl = new URL(req.url || '', 'http://localhost');
                const rawUrl = requestUrl.searchParams.get('url');
                if (!rawUrl) {
                  res.statusCode = 400;
                  res.end('Missing url parameter.');
                  return;
                }

                const target = new URL(rawUrl);
                if (target.protocol !== 'https:' || !ALLOWED_PDF_HOSTS.has(target.hostname)) {
                  res.statusCode = 403;
                  res.end('PDF host is not allowed.');
                  return;
                }

                const upstreamHeaders = new Headers({ accept: 'application/pdf,*/*' });
                const range = req.headers.range;
                if (typeof range === 'string') {
                  upstreamHeaders.set('range', range);
                }

                const upstream = await fetch(target, {
                  headers: upstreamHeaders,
                });

                if (!upstream.ok || !upstream.body) {
                  res.statusCode = upstream.status || 502;
                  res.end('Unable to fetch PDF.');
                  return;
                }

                const contentType = upstream.headers.get('content-type') || 'application/pdf';
                if (!contentType.toLowerCase().includes('pdf')) {
                  res.statusCode = 415;
                  res.end('Target is not a PDF.');
                  return;
                }

                res.statusCode = upstream.status;
                res.setHeader('content-type', contentType);
                res.setHeader('cache-control', 'public, max-age=3600');
                res.setHeader('access-control-allow-origin', '*');
                res.setHeader('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes');

                ['content-length', 'content-range'].forEach((headerName) => {
                  const headerValue = upstream.headers.get(headerName);
                  if (headerValue) {
                    res.setHeader(headerName, headerValue);
                  }
                });

                const reader = upstream.body.getReader();
                const pump = async () => {
                  const { done, value } = await reader.read();
                  if (done) {
                    res.end();
                    return;
                  }
                  res.write(Buffer.from(value), pump);
                };
                void pump();
              } catch {
                res.statusCode = 500;
                res.end('PDF proxy failed.');
              }
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
