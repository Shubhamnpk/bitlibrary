import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
  createBreadcrumbSchema,
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
}

const getRouteSeo = (pathname: string, searchQuery: string): SeoProps => {
  const decodeParam = (value: string) => decodeURIComponent(value).replace(/\+/g, ' ');

  if (pathname === '/') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/',
    };
  }

  if (pathname === '/library' || pathname === '/browse' || pathname === '/books') {
    return {
      title: 'Browse Open Books and Public Domain Classics | BitLibrary',
      description:
        'Browse BitLibrary by subject, author, and source to find public-domain books, open educational resources, classics, research texts, and readable digital editions.',
      canonicalPath: '/library',
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
    return {
      title: `${category} Books and Open Archives | BitLibrary`,
      description: truncate(
        `Explore ${category} books, public-domain texts, author collections, and open archive records in BitLibrary's digital library.`,
        155
      ),
      canonicalPath: `/category/${encodeURIComponent(category)}`,
      keywords: [category, `${category} books`, `${category} ebooks`, `${category} open library`],
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
        155
      ),
      canonicalPath: `/author/${encodeURIComponent(author)}`,
      type: 'profile',
      keywords: [author, `${author} books`, `${author} works`, `${author} bibliography`],
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
        'Inspect book metadata, author details, related works, reading options, downloads, and source links in BitLibrary.',
      canonicalPath: pathname,
      type: 'book',
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
      robots: 'noindex,follow',
    };
  }

  if (pathname === '/audiobooks') {
    return {
      title: 'Public Domain Audiobooks | BitLibrary',
      description:
        'Listen to public-domain audiobooks from LibriVox inside BitLibrary, with source attribution and chapter-level playback.',
      canonicalPath: '/audiobooks',
      keywords: ['public domain audiobooks', 'LibriVox audiobooks', 'free audiobooks', 'classic audiobooks'],
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
    };
  }

  if (pathname === '/about') {
    return {
      title: 'About BitLibrary | Open Digital Library by Bitnepal',
      description:
        'Learn how BitLibrary helps students, researchers, and readers discover open books, public-domain classics, authors, and digital reading paths.',
      canonicalPath: '/about',
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
      keywords: ['BitLibrary roadmap', 'digital library roadmap', 'audiobook roadmap'],
      structuredData: [
        createBreadcrumbSchema([
          { name: 'BitLibrary', path: '/' },
          { name: 'Roadmap', path: '/roadmap' },
        ]),
      ],
    };
  }

  if (pathname === '/mylibrary') {
    return {
      title: 'My Library | BitLibrary',
      description: 'Your local BitLibrary reading history, saved books, and recent searches.',
      canonicalPath: '/mylibrary',
      robots: 'noindex,nofollow',
    };
  }

  if (pathname === '/terms') {
    return {
      title: 'Terms and Responsible Use | BitLibrary',
      description: 'Read the terms, acceptable-use notes, content limitations, and reader responsibilities for BitLibrary.',
      canonicalPath: '/terms',
      robots: 'noindex,follow',
    };
  }

  return {
    title: 'Page Not Found | BitLibrary',
    description: 'This BitLibrary page could not be found.',
    canonicalPath: pathname,
    robots: 'noindex,follow',
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
  const routeSeo = getRouteSeo(location.pathname, searchParams.get('q')?.trim() || '');
  const seo = {
    ...routeSeo,
    ...props,
    structuredData: [...(routeSeo.structuredData || []), ...(props.structuredData || [])],
  };

  useEffect(() => {
    const title = seo.title || DEFAULT_TITLE;
    const description = truncate(seo.description || DEFAULT_DESCRIPTION, 158);
    const canonicalPath = seo.canonicalPath || location.pathname;
    const canonical = toAbsoluteUrl(canonicalPath);
    const image = toAbsoluteUrl(seo.image || '/assets/bitlibrary-og.png');
    const keywords = Array.from(new Set([...(seo.keywords || []), ...DEFAULT_KEYWORDS]));
    const robots = seo.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords.join(', ') });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="author"]', { name: 'author', content: 'BitLibrary Team' });
    upsertMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#0f1117' });

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type === 'book' ? 'book' : 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${SITE_NAME} preview image` });
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

    upsertLink('canonical', canonical);
    upsertLink('alternate', canonical, { hreflang: 'en' });

    const baseStructuredData = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: toAbsoluteUrl('/assets/bitlibrary-logo.svg'),
        sameAs: ['https://github.com/Shubhamnpk/bitlibrary'],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ];

    writeStructuredData([...baseStructuredData, ...(seo.structuredData || [])]);
  }, [
    location.pathname,
    seo.canonicalPath,
    seo.description,
    seo.image,
    seo.keywords,
    seo.robots,
    seo.structuredData,
    seo.title,
    seo.type,
  ]);

  return null;
};

export default Seo;
