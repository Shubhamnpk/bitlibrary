import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react';
import Seo from '@/components/Seo';

interface RoadmapPageProps {
  onBack: () => void;
}

const roadmapColumns = [
  {
    label: 'Now',
    title: 'Polish audio',
    items: [
      'Make playback, chapter switching, and progress resume feel reliable.',
      'Keep saved audiobooks visible in My Library.',
      'Reduce catalog request noise when external sources fail.',
    ],
  },
  {
    label: 'Next',
    title: 'Connect books and audio',
    items: [
      'Show Listen actions on matching book detail pages.',
      'Match books and audiobooks by title, author, and source text.',
      'Improve source attribution for every archive-backed item.',
    ],
  },
  {
    label: 'Later',
    title: 'Personal library tools',
    items: [
      'Add user-created reading and listening collections.',
      'Add import/export for local library data.',
      'Consider account sync after the local-first flow is strong.',
    ],
  },
];

const principles = [
  'Prefer open and clearly licensed sources.',
  'Make useful workflows before adding decoration.',
  'Keep personal data local unless sync is intentionally added.',
  'Make books, audio, authors, and subjects easy to move between.',
];

const RoadmapPage: React.FC<RoadmapPageProps> = ({ onBack }) => {
  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <Seo
        title="Roadmap | BitLibrary"
        description="See what BitLibrary is working on now, what is planned next, and the principles guiding future development."
        canonicalPath="/roadmap"
        keywords={['BitLibrary roadmap', 'digital library roadmap', 'audiobook roadmap', 'open library planning']}
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
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Roadmap</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-bit-text md:text-4xl">What we are working toward</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-bit-muted">
                A short planning view for future work. Release notes stay on the history page.
              </p>
            </div>
            <Link
              to="/releases"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-panel/35 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
            >
              Releases
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

        <main className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            {roadmapColumns.map((column) => (
              <article key={column.label} className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5 md:p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">{column.label}</p>
                <h2 className="mt-2 text-xl font-display font-bold text-bit-text">{column.title}</h2>
                <ul className="mt-5 space-y-3">
                  {column.items.map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-bit-muted">
                      {index === 0 ? <CheckCircle2 size={14} className="mt-1 shrink-0 text-bit-accent" /> : <CircleDashed size={14} className="mt-1 shrink-0 text-bit-muted" />}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5 md:p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">Decision Principles</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {principles.map((principle) => (
                <div key={principle} className="rounded-xl border border-bit-border bg-bit-panel/20 p-4 text-sm leading-6 text-bit-muted">
                  {principle}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default RoadmapPage;
