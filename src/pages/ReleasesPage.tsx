import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, Library, Sparkles } from 'lucide-react';
import Seo from '@/components/Seo';

interface ReleasesPageProps {
  onBack: () => void;
}

const releaseNotes = [
  {
    version: 'v0.4.0',
    title: 'Audiobooks and saved audio',
    status: 'Current preview',
    summary: 'Added public-domain audiobook discovery and made audio feel like a first-class library item.',
    changes: [
      'Audiobooks page and dedicated audiobook detail route.',
      'Custom player with chapters, skip controls, speed control, and local progress resume.',
      'Saved audiobooks now appear in My Library favorites.',
      'Suggested audiobook rows are responsive across mobile, tablet, and desktop.',
    ],
  },
  {
    version: 'v0.3.0',
    title: 'My Library registry',
    status: 'Released',
    summary: 'Added local saved books, recently viewed items, recent searches, and profile/theme preferences.',
    changes: [
      'Saved book controls on cards and detail pages.',
      'Local-first user state without requiring accounts.',
      'Library filters for all items, recent items, and saved archive.',
    ],
  },
  {
    version: 'v0.2.0',
    title: 'Discovery routes',
    status: 'Released',
    summary: 'Improved search, category, author, and book detail flows so browsing has clearer paths.',
    changes: [
      'Search and browse routes for archive discovery.',
      'Author and category detail pages.',
      'Richer book details with metadata and related items.',
    ],
  },
  {
    version: 'v0.1.0',
    title: 'Library foundation',
    status: 'Released',
    summary: 'Established the first usable archive interface with navigation, catalog display, and reader flow.',
    changes: [
      'Home discovery surface.',
      'Book cards and reader shell.',
      'Core visual system and responsive layout.',
    ],
  },
];

const releaseStats = [
  { label: 'Current build', value: 'v0.4.0' },
  { label: 'Major releases', value: releaseNotes.length.toString() },
  { label: 'Primary focus', value: 'Audio' },
];

const releaseHighlights = [
  {
    title: 'Audiobooks became native',
    body: 'Audio now has discovery, detail pages, a focused player, saved items, and local progress resume.',
    icon: Headphones,
  },
  {
    title: 'Library memory improved',
    body: 'Saved books, saved audiobooks, recent searches, and recently viewed items now work together.',
    icon: Library,
  },
  {
    title: 'Discovery routes matured',
    body: 'Search, author, category, and detail paths now make browsing feel more connected.',
    icon: Sparkles,
  },
];

const getReleaseAnchor = (version: string) => `release-${version.replace(/\./g, '-').replace(/^v/i, 'v')}`;

const ReleasesPage: React.FC<ReleasesPageProps> = ({ onBack }) => {
  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <Seo
        title="Release History | BitLibrary"
        description="Follow BitLibrary version history, shipped improvements, small changes, and development direction."
        canonicalPath="/releases"
        keywords={['BitLibrary releases', 'BitLibrary changelog', 'digital library version history', 'BitLibrary development']}
      />

      <div className="mx-auto max-w-5xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/30 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <header className="relative mb-8 overflow-hidden rounded-[2rem] border border-bit-border bg-[linear-gradient(160deg,rgba(var(--bit-accent-rgb),0.1),rgba(var(--bit-panel),0.24)_42%,rgba(var(--bit-bg),0.02))] px-5 py-8 md:px-8 md:py-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bit-accent/45 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-bit-accent/15" />
          <div className="pointer-events-none absolute -right-6 top-12 h-24 w-24 rounded-full border border-bit-border/80" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Release History</p>
              <h1 className="mt-3 text-4xl font-display font-bold leading-tight text-bit-text md:text-6xl">
                BitLibrary is getting sharper with every build.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted md:text-base md:leading-8">
                Follow the shipped work behind reading, listening, discovery, local library memory, and the small fixes that make the archive feel calmer to use.
              </p>
            </div>
            <Link
              to="/roadmap"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/45 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
            >
              Roadmap
              <ArrowRight size={13} />
            </Link>
          </div>

          <dl className="relative mt-8 grid gap-3 sm:grid-cols-3">
            {releaseStats.map((stat) => (
              <div key={stat.label} className="border border-bit-border bg-bit-panel/30 p-4">
                <dt className="text-[9px] font-mono uppercase tracking-[0.2em] text-bit-muted">{stat.label}</dt>
                <dd className="mt-2 text-2xl font-display font-bold text-bit-text">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <main className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            {releaseHighlights.map((highlight) => {
              const Icon = highlight.icon;

              return (
                <article key={highlight.title} className="rounded-xl border border-bit-border bg-bit-panel/25 p-5 transition-colors hover:border-bit-accent/20">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-bit-accent/10 bg-bit-accent/10 text-bit-accent">
                    <Icon size={18} />
                  </div>
                  <h2 className="mt-5 text-lg font-display font-bold text-bit-text">{highlight.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-bit-muted">{highlight.body}</p>
                </article>
              );
            })}
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-bit-border pb-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">Version timeline</p>
                  <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">Shipped changes</h2>
                </div>
              </div>

              {releaseNotes.map((release) => (
                <article
                  id={getReleaseAnchor(release.version)}
                  key={release.version}
                  className="relative scroll-mt-28 rounded-xl border border-bit-border bg-bit-panel/25 p-5 transition-colors hover:border-bit-accent/20 md:p-6"
                >
                  <div className="absolute left-0 top-6 h-8 w-1 bg-bit-accent" />
                  <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-xl">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">{release.version}</p>
                        <span className="rounded-md border border-bit-border bg-bit-panel/45 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.16em] text-bit-muted">
                          {release.status}
                        </span>
                      </div>
                      <h3 className="mt-2 text-xl font-display font-bold text-bit-text md:text-2xl">{release.title}</h3>
                    </div>
                  </div>
                  <p className="mt-4 pl-2 text-sm leading-7 text-bit-muted">{release.summary}</p>
                  <ul className="mt-5 space-y-2 pl-2">
                    {release.changes.map((change) => (
                      <li key={change} className="flex gap-3 text-sm leading-6 text-bit-muted">
                        <CheckCircle2 size={14} className="mt-1 shrink-0 text-bit-accent" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-xl border border-bit-border bg-bit-panel/25 p-5">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">Versions</p>
                <div className="mt-4 grid gap-2">
                  {releaseNotes.map((release) => (
                    <a
                      key={release.version}
                      href={`#${getReleaseAnchor(release.version)}`}
                      className="group flex items-center justify-between rounded-lg border border-bit-border bg-bit-panel/25 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
                    >
                      <span>{release.version}</span>
                      <span className="max-w-24 truncate text-[9px] text-bit-muted/70 transition-colors group-hover:text-bit-accent/80">
                        {release.status}
                      </span>
                    </a>
                  ))}
                </div>
              </section>

            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReleasesPage;
