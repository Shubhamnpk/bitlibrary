import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_LOCALE,
  DEFAULT_TITLE,
  GEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  createBreadcrumbSchema,
  createSearchActionSchema,
  toAbsoluteUrl,
  truncate,
} from '@/lib/seo';

interface SeoProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article' | 'book' | 'profile';
  robots?: string;
  keywords?: string[];
  structuredData?: Array<Record<string, unknown>>;
  locale?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noCrawl?: boolean;
}

const getRouteSeo = (pathname: string, searchQuery: string): SeoProps => {
  const decodeParam = (value: string) => decodeURIComponent(value).replace(/\+/g, ' ');

  if (pathname === '/') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/',
      locale: 'en_US',
    };
  }

  if (pathname === '/library' || pathname === '/browse' || pathname === '/books') {
    return {
      title: 'Browse Open Books and Public Domain Classics | BitLibrary',
      description:
        'Browse BitLibrary by subject, author, and source to find public-domain books, open educational resources, classics, research texts, and readable digital editions.',
      canonicalPath: '/library',
      locale: 'en_US',
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Library', path: '/library' },
        ]),
      ],
    };
  }

  const categoryMatch = pathname.match(/^\/(?:library|browse|books|category)\/(.+)$/);
  if (categoryMatch) {
    const category = decodeParam(categoryMatch[1]);
    const isNepaliCategory = /Nepali|nepali|CDC|Curriculum|Social Studies|Health|Hamro/i.test(category);
    return {
      title: `${category} Books and Open Archives | BitLibrary`,
      description: truncate(
        `Explore ${category} books, public-domain texts, author collections, and open archive records in BitLibrary's digital library. Free online reading.`,
        158
      ),
      canonicalPath: `/category/${encodeURIComponent(category)}`,
      keywords: [
        category, `${category} books`, `${category} ebooks`,
        `${category} open library`, `${category} public domain`,
        ...(isNepaliCategory ? [`${category} Nepal`, `${category} CDC`, `class ${category}`] : []),
      ],
      locale: isNepaliCategory ? 'en_US' : 'en_US',
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Library', path: '/library' },
          { name: category, path: `/category/${encodeURIComponent(category)}` },
        ]),
      ],
    };
  }

  const authorMatch = pathname.match(/^\/author\/(.+)$/);
  if (authorMatch) {
    const author = decodeParam(authorMatch[1]);
    return {
      title: `${author} Books, Biography, and Works | BitLibrary`,
      description: truncate(
        `Discover books and open archive records by ${author}. Browse readable public-domain editions, related works, and author metadata on BitLibrary.`,
        158
      ),
      canonicalPath: `/author/${encodeURIComponent(author)}`,
      type: 'profile',
      locale: 'en_US',
      keywords: [author, `${author} books`, `${author} works`, `${author} bibliography`, `${author} public domain`],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Authors', path: '/library' },
          { name: author, path: `/author/${encodeURIComponent(author)}` },
        ]),
      ],
    };
  }

  const bookMatch = pathname.match(/^\/book\/(.+)$/);
  if (bookMatch) {
    return {
      title: 'Book Details and Reading Options | BitLibrary',
      description:
        'Inspect book metadata, author details, related works, reading options, downloads, and source links in BitLibrary. Read public domain books online free.',
      canonicalPath: pathname,
      type: 'book',
      locale: 'en_US',
    };
  }

  if (pathname === '/search') {
    return {
      title: searchQuery
        ? `Search Results for ${searchQuery} | BitLibrary`
        : 'Search Open Books, Authors, and Topics | BitLibrary',
      description:
        'Search BitLibrary across public-domain books, open archive records, authors, subjects, and readable digital editions.',
      canonicalPath: '/search',
      locale: 'en_US',
    };
  }

  if (pathname === '/audiobooks') {
    return {
      title: 'Public Domain Audiobooks | BitLibrary',
      description:
        'Listen to public-domain audiobooks from LibriVox inside BitLibrary, with source attribution and chapter-level playback. Free classic audiobooks online.',
      canonicalPath: '/audiobooks',
      locale: 'en_US',
      keywords: ['public domain audiobooks', 'LibriVox audiobooks', 'free audiobooks', 'classic audiobooks', 'free audio books online'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Audiobooks', path: '/audiobooks' },
        ]),
      ],
    };
  }

  if (pathname.startsWith('/audiobook/')) {
    return {
      title: 'Audiobook Details and Player | BitLibrary',
      description: 'Listen to a public-domain audiobook with chapter metadata, source links, and LibriVox attribution in BitLibrary.',
      canonicalPath: pathname,
      type: 'book',
      locale: 'en_US',
    };
  }

  if (pathname === '/about') {
    return {
      title: 'About BitLibrary | Open Digital Library by Bitnepal',
      description:
        'Learn how BitLibrary helps students, researchers, and readers discover open books, public-domain classics, authors, and digital reading paths.',
      canonicalPath: '/about',
      locale: 'en_US',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About BitLibrary',
          url: toAbsoluteUrl('/about'),
          isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        },
      ],
    };
  }

  if (pathname === '/releases') {
    return {
      title: 'Release History | BitLibrary',
      description:
        'Follow BitLibrary version history, shipped improvements, small changes, and development direction.',
      canonicalPath: '/releases',
      locale: 'en_US',
      keywords: ['BitLibrary releases', 'BitLibrary changelog', 'digital library version history'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Releases', path: '/releases' },
        ]),
      ],
    };
  }

  if (pathname === '/roadmap') {
    return {
      title: 'Roadmap | BitLibrary',
      description:
        'See what BitLibrary is working on now, what is planned next, and the principles guiding future development.',
      canonicalPath: '/roadmap',
      locale: 'en_US',
      keywords: ['BitLibrary roadmap', 'digital library roadmap', 'audiobook roadmap'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Roadmap', path: '/roadmap' },
        ]),
      ],
    };
  }

  if (pathname === '/curriculum') {
    return {
      title: 'Nepal Curriculum Books and Resources | BitLibrary',
      description:
        'Browse Nepal CDC curriculum textbooks, teacher guides, and educational resources by grade and subject for Class 1-12.',
      canonicalPath: '/curriculum',
      locale: 'en_US',
      keywords: ['Nepal curriculum', 'CDC textbooks', 'class 1-12 books', 'Nepali education', 'Nepal school books', 'CDC Nepal'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Curriculum', path: '/curriculum' },
        ]),
      ],
    };
  }

  if (pathname === '/curriculum/subjects') {
    return {
      title: 'Curriculum Subjects | BitLibrary',
      description: 'Browse all curriculum subjects including Nepali, English, Mathematics, Science, Social Studies, and Health.',
      canonicalPath: '/curriculum/subjects',
      locale: 'en_US',
      keywords: ['curriculum subjects', 'Nepali subject', 'English subject', 'Mathematics', 'Science', 'Social Studies'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Curriculum', path: '/curriculum' },
          { name: 'Subjects', path: '/curriculum/subjects' },
        ]),
      ],
    };
  }

  if (pathname === '/dictionary') {
    return {
      title: searchQuery
        ? `Dictionary Results for ${searchQuery} | BitLibrary`
        : 'English and Nepali Dictionary | BitLibrary',
      description:
        'Search English definitions and Nepali dictionary entries in Devanagari script inside BitLibrary.',
      canonicalPath: '/dictionary',
      locale: 'en_US',
      keywords: ['English dictionary', 'Nepali dictionary', 'Yo Shabdakosh', 'word definitions', 'BitLibrary dictionary'],
    };
  }

  if (pathname === '/sources') {
    return {
      title: 'Data Sources and Credits | BitLibrary',
      description: 'BitLibrary integrates with open book, research, and audio sources. See all credits, API attributions, and open-source tools here.',
      canonicalPath: '/sources',
      locale: 'en_US',
      keywords: ['BitLibrary sources', 'open data sources', 'book API credits', 'Gutendex', 'Open Library', 'LibriVox'],
    };
  }

  if (pathname === '/blog') {
    return {
      title: 'BitLibrary Blog: Guides on Public Domain Books, Free Audiobooks, and Digital Reading',
      description:
        'Read guides on public domain books, free audiobooks, Nepal education curriculum, digital libraries, and open educational resources.',
      canonicalPath: '/blog',
      locale: 'en_US',
      keywords: ['BitLibrary blog', 'digital library guide', 'public domain books guide', 'free audiobooks guide', 'free ebooks blog'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Blog', path: '/blog' },
        ]),
      ],
    };
  }

  if (pathname.startsWith('/blog/')) {
    return {
      title: 'BitLibrary Blog',
      description: 'Read guides and resources about public domain books, free audiobooks, and digital reading on BitLibrary.',
      canonicalPath: pathname,
      locale: 'en_US',
      type: 'article',
    };
  }

  if (pathname === '/research') {
    return {
      title: searchQuery
        ? `Research Results for ${searchQuery} | BitLibrary`
        : 'Academic Research Search | BitLibrary',
      description: 'Search academic papers across arXiv, PubMed, Semantic Scholar, OpenAlex, Crossref, and other open research databases.',
      canonicalPath: '/research',
      locale: 'en_US',
      keywords: ['academic research', 'research papers', 'arXiv', 'PubMed', 'Semantic Scholar', 'open research'],
    };
  }

  if (pathname === '/mylibrary') {
    return {
      title: 'My Library | BitLibrary',
      description: 'Your local BitLibrary reading history, saved books, and recent searches.',
      canonicalPath: '/mylibrary',
      locale: 'en_US',
      noCrawl: true,
    };
  }

  if (pathname === '/terms') {
    return {
      title: 'Terms and Responsible Use | BitLibrary',
      description: 'Read the terms, acceptable-use notes, content limitations, and reader responsibilities for BitLibrary.',
      canonicalPath: '/terms',
      locale: 'en_US',
      noCrawl: true,
    };
  }

  return {
    title: 'Page Not Found | BitLibrary',
    description: 'This BitLibrary page could not be found.',
    canonicalPath: pathname,
    locale: 'en_US',
    noCrawl: true,
  };
};

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement('meta');
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) => node?.setAttribute(key, value));
};

const removeMeta = (selector: string) => {
  document.head.querySelector(selector)?.remove();
};

const upsertLink = (rel: string, href: string, attributes: Record<string, string> = {}) => {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', rel);
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
  Object.entries(attributes).forEach(([key, value]) => node?.setAttribute(key, value));
};

const writeStructuredData = (items: Array<Record<string, unknown>>) => {
  document.querySelectorAll('script[data-bitlibrary-seo="jsonld"]').forEach((node) => node.remove());

  items.forEach((item, index) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.bitlibrarySeo = 'jsonld';
    script.id = `bitlibrary-jsonld-${index}`;
    script.text = JSON.stringify(item);
    document.head.appendChild(script);
  });
};

const Seo = (props: SeoProps) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() || '';
  const routeSeo = getRouteSeo(location.pathname, searchQuery);
  const seo = {
    ...routeSeo,
    ...props,
    structuredData: [...(routeSeo.structuredData || []), ...(props.structuredData || [])],
    noCrawl: props.noCrawl ?? routeSeo.noCrawl ?? false,
  };

  useEffect(() => {
    const title = seo.title || DEFAULT_TITLE;
    const description = truncate(seo.description || DEFAULT_DESCRIPTION, 158);
    const canonicalPath = seo.canonicalPath || location.pathname;
    const canonical = toAbsoluteUrl(canonicalPath);
    const image = toAbsoluteUrl(seo.image || '/assets/bitlibrary-og.png');
    const keywords = Array.from(new Set([...(seo.keywords || []), ...GEO_KEYWORDS]));
    const locale = seo.locale || DEFAULT_LOCALE;

    const robots = seo.noCrawl
      ? 'noindex,nofollow'
      : (seo.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');

    document.title = title;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords.join(', ') });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="author"]', { name: 'author', content: 'BitLibrary Team' });
    upsertMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#0f1117' });
    upsertMeta('meta[name="application-name"]', { name: 'application-name', content: 'BitLibrary' });

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type === 'book' ? 'book' : 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${SITE_NAME} preview image` });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: locale });

    if (seo.publishedTime) {
      upsertMeta('meta[property="article:published_time"]', { property: 'article:published_time', content: seo.publishedTime });
    } else {
      removeMeta('meta[property="article:published_time"]');
    }

    if (seo.modifiedTime) {
      upsertMeta('meta[property="article:modified_time"]', { property: 'article:modified_time', content: seo.modifiedTime });
    } else {
      removeMeta('meta[property="article:modified_time"]');
    }

    if (seo.image) {
      removeMeta('meta[property="og:image:width"]');
      removeMeta('meta[property="og:image:height"]');
    } else {
      upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
      upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });
    }

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: `${SITE_NAME} preview image` });
    upsertMeta('meta[name="twitter:site"]', { name: 'twitter:site', content: '@bitlibrary' });

    upsertLink('canonical', canonical);
    upsertLink('alternate', canonical, { hreflang: 'en' });

    const baseStructuredData: Array<Record<string, unknown>> = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: toAbsoluteUrl('/assets/bitlibrary-logo.svg'),
        sameAs: [
          'https://github.com/Shubhamnpk/bitlibrary',
        ],
        description: 'An open digital library for books, authors, public-domain classics, and research-friendly reading.',
      },
      createSearchActionSchema(),
    ];

    const allStructuredData = [...baseStructuredData, ...(seo.structuredData || [])];

    writeStructuredData(allStructuredData);
  }, [
    location.pathname,
    seo.canonicalPath,
    seo.description,
    seo.image,
    seo.keywords,
    seo.locale,
    seo.modifiedTime,
    seo.noCrawl,
    seo.publishedTime,
    seo.robots,
    seo.structuredData,
    seo.title,
    seo.type,
  ]);

  return null;
};

export default Seo;
