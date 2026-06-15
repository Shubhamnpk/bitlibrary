import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

const SITE_URL = 'https://bitlibrary.bitnepal.net';

const CATEGORIES = [
  'Poetry', 'Fiction', 'Nepali Literature', 'Mystery', 'History',
  'Philosophy', 'Biography', 'Science', 'Children', 'Adventure',
  'Romance', 'Drama', 'Short Stories', 'General Education',
  'Science & Technology', 'University Curriculum', 'Open Educational Resources',
  'School Textbooks', 'Research Journals', 'Historical Archives',
  'Public Domain Classics', 'Engineering & Tech', 'Medicine & Health',
  'Management & Business', 'Social Sciences & Arts',
];

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/library', priority: '0.9', changefreq: 'daily' },
  { path: '/books', priority: '0.8', changefreq: 'daily' },
  { path: '/browse', priority: '0.8', changefreq: 'daily' },
  { path: '/audiobooks', priority: '0.85', changefreq: 'daily' },
  { path: '/curriculum', priority: '0.9', changefreq: 'weekly' },
  { path: '/curriculum/subjects', priority: '0.8', changefreq: 'weekly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/releases', priority: '0.6', changefreq: 'weekly' },
  { path: '/roadmap', priority: '0.6', changefreq: 'monthly' },
  { path: '/dictionary', priority: '0.7', changefreq: 'monthly' },
  { path: '/sources', priority: '0.7', changefreq: 'monthly' },
  { path: '/research', priority: '0.7', changefreq: 'weekly' },
];

const LAST_MOD = new Date().toISOString().split('T')[0];

const buildSitemap = (): string => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  STATIC_PAGES.forEach((page) => {
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}${page.path}</loc>\n`;
    xml += `    <lastmod>${LAST_MOD}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  CATEGORIES.forEach((category) => {
    const encoded = encodeURIComponent(category);
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}/category/${encoded}</loc>\n`;
    xml += `    <lastmod>${LAST_MOD}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.75</priority>\n';
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
};

export default async (_req: VercelRequest, res: VercelResponse) => {
  const sitemap = buildSitemap();
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(sitemap);
};
