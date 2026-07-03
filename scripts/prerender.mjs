import { execSync } from 'child_process';
import { get, createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PORT = 4173;

const CRITICAL_ROUTES = [
  '/',
  '/library',
  '/audiobooks',
  '/curriculum',
  '/curriculum/subjects',
  '/about',
  '/research',
  '/blog',
  '/dictionary',
  '/sources',
  '/releases',
  '/roadmap',
  '/search',
  '/category/General%20Education',
  '/category/Science%20%26%20Technology',
  '/category/Public%20Domain%20Classics',
  '/category/Nepali%20Literature',
  '/category/School%20Textbooks',
  '/category/Engineering%20%26%20Tech',
  '/category/Medicine%20%26%20Health',
  '/category/Management%20%26%20Business',
  '/category/Social%20Sciences%20%26%20Arts',
  '/category/University%20Curriculum',
  '/category/Open%20Educational%20Resources',
  '/category/Historical%20Archives',
];

const log = (msg) => console.log(`  \x1b[36m▸\x1b[0m ${msg}`);
const ok = (msg) => console.log(`  \x1b[32m▸\x1b[0m ${msg}`);
const fail = (msg) => console.log(`  \x1b[31m▸\x1b[0m ${msg}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForServer = (url, timeout = 30000) => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      get(url, (res) => { res.resume(); resolve(); })
        .on('error', () => {
          if (Date.now() - start > timeout) reject(new Error('Server not ready'));
          else setTimeout(check, 300);
        });
    };
    check();
  });
};

const serveStatic = () => new Promise((resolve) => {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.xml': 'application/xml',
  };

  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let filePath = join(DIST, pathname === '/' ? 'index.html' : pathname);

    if (!existsSync(filePath)) {
      if (!extname(pathname)) {
        filePath = join(DIST, 'index.html');
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not found');
        return;
      }
    }

    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath) || '.html';
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.end(content);
    } catch {
      res.statusCode = 500;
      res.end('Server error');
    }
  });

  server.listen(PORT, () => {
    log(`Server on http://localhost:${PORT}`);
    resolve(() => server.close());
  });
});

const renderPage = async (page, route) => {
  const decodedRoute = decodeURIComponent(route);
  const url = `http://localhost:${PORT}${route}`;

  log(`Rendering ${decodedRoute}...`);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: attempt === 0 ? 'networkidle0' : 'domcontentloaded',
        timeout: 30000,
      });

      const ok = await page.evaluate(() => {
        const root = document.getElementById('root');
        if (!root) return false;
        const t = root.innerText || root.textContent || '';
        return t.length > 80 && !t.startsWith('Loading');
      });

      if (ok) break;

      await sleep(2000);
      const ok2 = await page.evaluate(() => {
        const root = document.getElementById('root');
        const t = root.innerText || root.textContent || '';
        return t.length > 80 && !t.startsWith('Loading');
      });

      if (ok2) break;
    } catch {
      if (attempt === 1) throw new Error('Failed to render after 2 attempts');
    }
  }

  await sleep(1000);

  const html = await page.content();
  const size = html.length;

  if (route === '/') {
    writeFileSync(join(DIST, 'index.html'), html, 'utf-8');
  } else {
    const cleanPath = route.replace(/\/+$/, '');
    mkdirSync(join(DIST, cleanPath), { recursive: true });
    writeFileSync(join(DIST, cleanPath, 'index.html'), html, 'utf-8');
  }

  ok(`  Saved (${(size / 1024).toFixed(0)} KB)`);
  return true;
};

const prerender = async () => {
  console.log('');
  log('Pre-rendering critical pages...\n');

  if (!existsSync(DIST) || !existsSync(join(DIST, 'index.html'))) {
    log('Building...');
    execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
  }

  const closeServer = await serveStatic();
  await waitForServer(`http://localhost:${PORT}/`);

  let browser;
  try {
    const { default: puppeteer } = await import('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.setDefaultTimeout(30000);

    let done = 0;
    for (const route of CRITICAL_ROUTES) {
      try {
        if (await renderPage(page, route)) done++;
      } catch (err) {
        fail(`  Failed: ${err.message.split('\n')[0]}`);
      }
    }

    const pct = ((done / CRITICAL_ROUTES.length) * 100).toFixed(0);
    console.log(`\n  \x1b[36m▸\x1b[0m \x1b[1m${done}/${CRITICAL_ROUTES.length} (${pct}%) pages prerendered\x1b[0m\n`);
  } catch (err) {
    fail(`Fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    closeServer();
  }
};

prerender();
