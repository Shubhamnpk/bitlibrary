import React from 'react';
import { ArrowLeft, ArrowUpRight, BookOpenText, Database, FileAudio, FileText, Image, Library, Sparkles } from 'lucide-react';
import Seo from '@/components/Seo';

interface SourcesPageProps {
  onBack: () => void;
}

type SourceCategory = 'books' | 'audio' | 'dictionary' | 'media' | 'ai' | 'software';

interface SourceCredit {
  category: SourceCategory;
  name: string;
  role: string;
  credit: string;
  url: string;
}

const categoryConfig: Record<SourceCategory, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  books: { label: 'Books and catalog metadata', icon: Library },
  audio: { label: 'Audiobooks and audio files', icon: FileAudio },
  dictionary: { label: 'Dictionary and language tools', icon: BookOpenText },
  media: { label: 'Images and media helpers', icon: Image },
  ai: { label: 'AI-assisted features', icon: Sparkles },
  software: { label: 'Open-source infrastructure', icon: Database },
};

const sourceCredits: SourceCredit[] = [
  {
    category: 'books',
    name: 'YoBook API',
    role: 'Primary connected catalog for Nepali, curriculum, and locally indexed books.',
    credit: 'Used for book records, curriculum grouping, source links, covers, and readable file metadata when available.',
    url: 'https://yobook-api.vercel.app',
  },
  {
    category: 'books',
    name: 'Gutendex and Project Gutenberg',
    role: 'Public-domain ebook discovery and classic literature metadata.',
    credit: 'Used for public-domain titles, authors, subjects, covers, and source links to Project Gutenberg works.',
    url: 'https://gutendex.com',
  },
  {
    category: 'books',
    name: 'Open Library',
    role: 'Open book catalog metadata, author records, cover IDs, and archive links.',
    credit: 'Used to widen search results and provide book metadata where matching records are available.',
    url: 'https://openlibrary.org',
  },
  {
    category: 'books',
    name: 'Internet Archive',
    role: 'Archive records, embedded readers, downloadable files, covers, and item metadata.',
    credit: 'Used for archive-backed book access and metadata when an item is available through archive.org.',
    url: 'https://archive.org',
  },
  {
    category: 'books',
    name: 'Google Books API',
    role: 'Supplemental book search, previews, descriptions, identifiers, and cover thumbnails.',
    credit: 'Used as an additional discovery source when broader web-scale book metadata helps the search flow.',
    url: 'https://developers.google.com/books',
  },
  {
    category: 'books',
    name: 'IT Bookstore API',
    role: 'Technology and programming book search metadata.',
    credit: 'Used for technical-book discovery where the upstream API has matching records.',
    url: 'https://api.itbook.store',
  },
  {
    category: 'books',
    name: 'CDC Nepal, CEHRD, and NCERT references',
    role: 'Curriculum labels and educational-source context.',
    credit: 'Used as source context when connected catalog records identify school books, teacher guides, or curriculum resources.',
    url: 'https://moecdc.gov.np',
  },
  {
    category: 'audio',
    name: 'LibriVox',
    role: 'Public-domain volunteer audiobook catalog and chapter audio.',
    credit: 'Used for audiobook discovery, narrator metadata, durations, genres, and public-domain audio files.',
    url: 'https://librivox.org',
  },
  {
    category: 'audio',
    name: 'Internet Archive audio hosting',
    role: 'Audio file delivery and archive-hosted media assets.',
    credit: 'Used when LibriVox or archive metadata points to hosted audio files on archive.org.',
    url: 'https://archive.org',
  },
  {
    category: 'dictionary',
    name: 'dictionaryapi.dev',
    role: 'English dictionary definitions, phonetics, examples, synonyms, and audio pronunciation links.',
    credit: 'Used only for English-script dictionary lookups.',
    url: 'https://dictionaryapi.dev',
  },
  {
    category: 'dictionary',
    name: 'Yo Shabdakosh Static API',
    role: 'Nepali dictionary entries for Devanagari-script searches.',
    credit: 'Used for Nepali word definitions, grammar labels, etymology, and senses through the published static JSON API.',
    url: 'https://shubhamnpk.github.io/yoshabdakosh/openapi.yaml',
  },
  {
    category: 'dictionary',
    name: 'dictionary-ne and Hunspell data',
    role: 'Nepali spellcheck dictionary data inside the local spellcheck panel.',
    credit: 'Used for spelling checks and suggestions, separate from dictionary definitions.',
    url: 'https://www.npmjs.com/package/dictionary-ne',
  },
  {
    category: 'media',
    name: 'wsrv.nl image proxy',
    role: 'Responsive image optimization for remote book and audiobook covers.',
    credit: 'Used to resize and serve cover images from upstream catalogs more consistently in the UI.',
    url: 'https://images.weserv.nl',
  },
  {
    category: 'media',
    name: 'Unsplash fallback images',
    role: 'Fallback visual placeholder when a book cover is missing or fails to load.',
    credit: 'Used only as a generic fallback image, not as a replacement for source-provided covers.',
    url: 'https://unsplash.com',
  },
  {
    category: 'media',
    name: 'Transparent Textures',
    role: 'Subtle interface texture used in selected visual surfaces.',
    credit: 'Used as a decorative texture asset where referenced by the app styles.',
    url: 'https://www.transparenttextures.com',
  },
  {
    category: 'ai',
    name: 'OpenRouter',
    role: 'Optional AI gateway for assisted search and generated reading context when configured.',
    credit: 'Used only when the app has an OpenRouter API key; generated output should be checked against original sources.',
    url: 'https://openrouter.ai',
  },
  {
    category: 'software',
    name: 'PDF.js',
    role: 'PDF rendering and reader support.',
    credit: 'Used to power PDF viewing and worker/WASM-assisted document rendering in the reading experience.',
    url: 'https://mozilla.github.io/pdf.js',
  },
  {
    category: 'software',
    name: 'React, Vite, Tailwind CSS, and lucide-react',
    role: 'Frontend application framework, build tooling, styling, and icons.',
    credit: 'Used to build the BitLibrary interface and interaction layer.',
    url: 'https://github.com/Shubhamnpk/bitlibrary',
  },
  {
    category: 'software',
    name: 'Convex',
    role: 'Connected backend capability for app data workflows where configured.',
    credit: 'Used by the project integration layer when a Convex deployment URL is provided.',
    url: 'https://www.convex.dev',
  },
];

const groupedCredits = (Object.keys(categoryConfig) as SourceCategory[]).map((category) => ({
  category,
  ...categoryConfig[category],
  credits: sourceCredits.filter((source) => source.category === category),
}));

const SourcesPage: React.FC<SourcesPageProps> = ({ onBack }) => {
  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <Seo
        title="Sources and Credits | BitLibrary"
        description="Credits for the book catalogs, dictionaries, audiobook sources, media helpers, AI services, and open-source software used by BitLibrary."
        canonicalPath="/sources"
        keywords={['BitLibrary sources', 'open book sources', 'dictionary credits', 'audiobook credits', 'open source credits']}
      />

      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/30 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <header className="border-b border-bit-border pb-8">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-bit-accent">Sources and Credits</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-display font-bold leading-tight text-bit-text md:text-6xl">
            Credit for the sources behind BitLibrary.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-bit-muted md:text-base">
            BitLibrary is an interface over open catalogs, public APIs, dictionary datasets, media helpers, and open-source software. This page lists the major sources used by the website and describes how each one supports the product.
          </p>
        </header>

        <section className="mt-8 grid gap-6">
          {groupedCredits.map(({ category, label, icon: Icon, credits }) => (
            <section key={category} className="border-b border-bit-border pb-8 last:border-b-0">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted">Credit Type</p>
                  <h2 className="text-2xl font-display font-bold text-bit-text">{label}</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {credits.map((source) => (
                  <article key={source.name} className="rounded-lg border border-bit-border bg-bit-panel/30 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-display font-bold text-bit-text">{source.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-bit-text/80">{source.role}</p>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${source.name}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bit-border bg-bit-bg/40 text-bit-muted transition-colors hover:border-bit-accent/40 hover:text-bit-accent"
                      >
                        <ArrowUpRight size={15} />
                      </a>
                    </div>
                    <p className="mt-4 border-t border-bit-border/70 pt-4 text-xs leading-6 text-bit-muted">
                      {source.credit}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="mt-10 rounded-lg border border-bit-accent/25 bg-bit-accent/10 p-5">
          <div className="flex items-start gap-3">
            <FileText size={18} className="mt-1 shrink-0 text-bit-accent" />
            <p className="text-sm leading-7 text-bit-text/85">
              Source records can change upstream, and rights or access conditions may vary by item. For publication, legal, or academic decisions, always verify the original source page linked from the book, audio, or dictionary record.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SourcesPage;
