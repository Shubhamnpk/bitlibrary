import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Wrench } from 'lucide-react';
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

const minorUpdates = [
  'Description previews tightened on audiobook detail pages.',
  'Desktop audiobook artwork reduced so content stays in view.',
  'Player moved above description on desktop.',
  'React type packages added for cleaner editor diagnostics.',
  'SEO and sitemap entries updated for audio, releases, and roadmap.',
];

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
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <header className="mb-8 border-b border-bit-border pb-7">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Release History</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-bit-text md:text-4xl">What changed in BitLibrary</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-bit-muted">
                A practical changelog for shipped work, small fixes, and product movement.
              </p>
            </div>
            <Link
              to="/roadmap"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-panel/35 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
            >
              Roadmap
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <section className="space-y-4">
            {releaseNotes.map((release) => (
              <article key={release.version} className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">{release.version}</p>
                    <h2 className="mt-2 text-xl font-display font-bold text-bit-text md:text-2xl">{release.title}</h2>
                  </div>
                  <span className="w-fit rounded-full border border-bit-border bg-bit-panel/45 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.16em] text-bit-muted">
                    {release.status}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-bit-muted">{release.summary}</p>
                <ul className="mt-5 space-y-2">
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

          <aside className="space-y-4">
            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5">
              <div className="flex items-center gap-2 text-bit-accent">
                <Clock3 size={16} />
                <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Current</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-bit-muted">
                The latest work is focused on making audiobooks usable, saveable, and connected to the main library experience.
              </p>
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5">
              <div className="flex items-center gap-2 text-bit-accent">
                <Wrench size={16} />
                <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Minor fixes</p>
              </div>
              <ul className="mt-4 space-y-3">
                {minorUpdates.map((update) => (
                  <li key={update} className="text-sm leading-6 text-bit-muted">{update}</li>
                ))}
              </ul>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default ReleasesPage;
