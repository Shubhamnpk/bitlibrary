import React from 'react';
import { ArrowLeft, FileText, Globe, Library, Search, ShieldCheck } from 'lucide-react';
import staticPages from '@/content/static-pages.json';

interface StaticPageProps {
  type: 'terms';
  onBack: () => void;
}

type HighlightIcon = 'file' | 'globe' | 'library' | 'search' | 'shield';

interface StaticPageEntry {
  eyebrow: string;
  title: string;
  subtitle: string;
  updatedLabel: string;
  updatedValue: string;
  intro: string[];
  highlights: Array<{
    icon: HighlightIcon;
    title: string;
    body: string;
  }>;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  closingTitle: string;
  closingBody: string;
}

const iconMap: Record<HighlightIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  file: FileText,
  globe: Globe,
  library: Library,
  search: Search,
  shield: ShieldCheck,
};

const pageContent = staticPages as Record<'terms', StaticPageEntry>;

const StaticPage: React.FC<StaticPageProps> = ({ type, onBack }) => {
  const content = pageContent[type];

  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-6 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent font-bold shadow-sm"
        >
          <ArrowLeft size={14} />
          Back to Archives
        </button>

        <article className="space-y-8 md:space-y-12">
          <header className="relative overflow-hidden rounded-[2.5rem] border border-bit-border bg-bit-panel/40 px-6 py-12 text-center shadow-xl md:px-14 md:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--bit-accent-rgb),0.1),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-bit-accent/30 to-transparent pointer-events-none" />
            <div className="relative mx-auto max-w-3xl">
              <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.3em] text-bit-accent font-bold">
                {content.eyebrow}
              </p>
              <h1 className="text-4xl font-display font-bold leading-tight tracking-tight text-bit-text md:text-6xl uppercase">
                {content.title}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-bit-muted font-sans italic">
                {content.subtitle}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <div className="inline-flex rounded-full border border-bit-border bg-bit-panel/50 px-5 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted font-bold">
                  {content.updatedLabel}: {content.updatedValue}
                </div>
                <div className="inline-flex rounded-full border border-bit-accent/20 bg-bit-accent/5 px-5 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent font-bold">
                  {content.sections.length} Regulatory Sections
                </div>
              </div>
            </div>
          </header>

          <section className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3 md:gap-8">
            {content.highlights.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.title} className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-8 text-center transition-all hover:-translate-y-2 hover:border-bit-accent/30 hover:bg-bit-panel/40 shadow-sm">
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-bit-accent/10 bg-bit-accent/5 text-bit-accent shadow-inner">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-xl font-display font-bold text-bit-text tracking-tight">{item.title}</h2>
                  <p className="mt-4 text-xs leading-relaxed text-bit-muted font-mono uppercase tracking-widest font-bold">{item.body}</p>
                </div>
              );
            })}
          </section>

          <section className="mx-auto max-w-3xl rounded-[2.5rem] border border-bit-border bg-bit-panel/20 px-8 py-10 text-center shadow-inner md:px-12">
            {content.intro.map((paragraph) => (
              <p key={paragraph} className="text-lg leading-9 text-bit-text/90 font-serif mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </section>

          <section className="mx-auto max-w-4xl space-y-6 md:space-y-8">
            {content.sections.map((section, index) => (
              <div key={section.heading} className="rounded-[2.5rem] border border-bit-border bg-bit-panel/30 px-8 py-10 transition-colors hover:border-bit-accent/20 md:px-12 shadow-sm">
                <div className="mb-6 flex items-center gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/5 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-accent font-bold shadow-sm">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-bit-accent/20 to-transparent" />
                </div>
                <h2 className="text-2xl font-display font-bold text-bit-text md:text-4xl tracking-tight">
                  {section.heading}
                </h2>
                <div className="mt-6 space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-bit-muted font-sans">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mx-auto max-w-4xl rounded-[2.5rem] border border-bit-border bg-bit-panel/30 px-8 py-12 md:px-12 shadow-sm">
            <div className="text-center mb-12">
              <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-bit-accent font-bold">Support Database</p>
              <h2 className="mt-4 text-4xl font-display font-bold text-bit-text tracking-tight uppercase">Common Queries</h2>
            </div>
            <div className="grid gap-6">
              {content.faq.map((item) => (
                <div key={item.question} className="rounded-[2rem] border border-bit-border bg-bit-panel/20 p-8 transition-colors hover:border-bit-accent/20 shadow-inner">
                  <h3 className="text-xl font-display font-bold text-bit-text tracking-tight">{item.question}</h3>
                  <p className="mt-4 text-sm leading-8 text-bit-muted font-sans">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-3xl rounded-[2.5rem] border border-bit-accent/20 bg-gradient-to-br from-bit-accent/10 to-bit-panel/20 px-10 py-14 text-center shadow-xl">
            <h2 className="text-3xl font-display font-bold text-bit-text tracking-tight uppercase">{content.closingTitle}</h2>
            <p className="mt-6 text-lg leading-9 text-bit-text/80 font-serif">{content.closingBody}</p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default StaticPage;
