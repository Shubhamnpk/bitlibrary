import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://bitlibrary.bitnepal.net';
const OUT_PATH = join(__dirname, '..', 'dist', 'sitemap.xml');

const BLOG_SLUGS = [
  'the-open-digital-library-vision',
  'what-is-public-domain-books-guide',
  'nepal-education-curriculum-cdc-textbooks',
  'free-audiobooks-online-librivox-guide',
  'open-digital-library-vs-traditional-library',
  'how-to-read-books-online-free',
  'nepali-literature-books-authors-guide',
  'class-1-3-cdc-textbooks-parent-guide',
  'class-4-5-upper-primary-cdc-textbooks',
  'class-6-8-lower-secondary-cdc-guide',
  'class-9-10-see-preparation-cdc',
  'class-11-12-higher-secondary-cdc-guide',
  'nepali-subject-guide-cdc-curriculum',
  'english-subject-guide-cdc-curriculum',
  'mathematics-guide-cdc-curriculum',
  'science-education-guide-cdc-curriculum',
  'social-studies-guide-cdc-curriculum',
  'teacher-guides-cdc-resources',
  'cdc-question-papers-exam-preparation',
  '50-must-read-public-domain-books',
  'best-classic-novels-online-free',
  'free-philosophy-books-online',
  'free-science-books-classics-online',
  'download-free-ebooks-to-kindle',
  'best-free-online-libraries-comparison',
  'copyright-expiration-guide-public-domain',
  'public-domain-poetry-classic-poems-free',
  'best-free-audiobooks-for-commutes',
  'free-audiobooks-for-children',
  'listen-without-subscription-free-audiobooks',
  'top-10-librivox-classics',
  'what-is-open-digital-library-guide',
  'online-vs-offline-reading-comparison',
  'build-reading-habit-free-online-books',
  'digital-reading-tools-features-guide',
  'find-free-research-papers-online',
  'best-open-access-databases-guide',
  'search-academic-databases-effectively',
  'modern-nepali-literature-contemporary-authors',
  'nepali-poetry-guide-major-poets',
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
