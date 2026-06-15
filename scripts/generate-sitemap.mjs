import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://bitlibrary.bitnepal.net';
const OUT_PATH = join(__dirname, '..', 'dist', 'sitemap.xml');

const BLOG_SLUGS = [
  'what-is-public-domain-books-guide',
  'nepal-education-curriculum-cdc-textbooks',
  'free-audiobooks-online-librivox-guide',
  'open-digital-library-vs-traditional-library',
  'how-to-read-books-online-free',
  'nepali-literature-books-authors-guide',
];

const CATEGORIES = [
  'Poetry', 'Fiction', 'Nepali Literature', 'Mystery', 'History',
  'Philosophy', 'Biography', 'Science', 'Children', 'Adventure',
  'Romance', 'Drama', 'Short Stories', 'General Education',
  'Science & Technology', 'University Curriculum', 'Open Educational Resources',
  'School Textbooks', 'Research Journals', 'Historical Archives',
  'Public Domain Classics', 'Engineering & Tech', 'Medicine & Health',
  'Management & Business', 'Social Sciences & Arts',
];

const PAGES = [
  { path: '/', priority: '1.0', freq: 'weekly' },
  { path: '/library', priority: '0.9', freq: 'daily' },
  { path: '/books', priority: '0.8', freq: 'daily' },
  { path: '/browse', priority: '0.8', freq: 'daily' },
  { path: '/audiobooks', priority: '0.85', freq: 'daily' },
  { path: '/curriculum', priority: '0.9', freq: 'weekly' },
  { path: '/curriculum/subjects', priority: '0.8', freq: 'weekly' },
  { path: '/about', priority: '0.7', freq: 'monthly' },
  { path: '/releases', priority: '0.6', freq: 'weekly' },
  { path: '/roadmap', priority: '0.6', freq: 'monthly' },
  { path: '/dictionary', priority: '0.7', freq: 'monthly' },
  { path: '/sources', priority: '0.7', freq: 'monthly' },
  { path: '/research', priority: '0.7', freq: 'weekly' },
  { path: '/blog', priority: '0.8', freq: 'weekly' },
];

const now = new Date().toISOString().split('T')[0];

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

for (const page of PAGES) {
  xml += '  <url>\n';
  xml += `    <loc>${SITE_URL}${page.path}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `    <changefreq>${page.freq}</changefreq>\n`;
  xml += `    <priority>${page.priority}</priority>\n`;
  xml += '  </url>\n';
}

for (const slug of BLOG_SLUGS) {
  xml += '  <url>\n';
  xml += `    <loc>${SITE_URL}/blog/${slug}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>monthly</changefreq>\n';
  xml += '    <priority>0.7</priority>\n';
  xml += '  </url>\n';
}

for (const cat of CATEGORIES) {
  xml += '  <url>\n';
  xml += `    <loc>${SITE_URL}/category/${encodeURIComponent(cat)}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>weekly</changefreq>\n';
  xml += '    <priority>0.75</priority>\n';
  xml += '  </url>\n';
}

xml += '</urlset>';

writeFileSync(OUT_PATH, xml, 'utf-8');
console.log(`Sitemap generated at ${OUT_PATH} (${PAGES.length + BLOG_SLUGS.length + CATEGORIES.length} URLs)`);
