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
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-mono uppercase tracking-[0.18em] text-gray-400 transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <article className="space-y-8 md:space-y-10">
          <header className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.02] px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:px-14 md:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--bit-accent-rgb),0.14),transparent_45%)] pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-bit-accent/40 to-transparent pointer-events-none" />
            <div className="relative mx-auto max-w-3xl">
              <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent">
                {content.eyebrow}
              </p>
              <h1 className="text-4xl font-display font-bold leading-tight tracking-tight text-white md:text-6xl">
                {content.title}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 md:text-lg">
                {content.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <div className="inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400">
                  {content.updatedLabel}: {content.updatedValue}
                </div>
                <div className="inline-flex rounded-full border border-bit-accent/20 bg-bit-accent/5 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-accent">
                  {content.sections.length} sections
                </div>
              </div>
            </div>
          </header>

          <section className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3 md:gap-6">
            {content.highlights.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.title} className="rounded-[1.75rem] border border-white/5 bg-white/[0.02] p-6 text-center transition-all hover:-translate-y-1 hover:border-bit-accent/20 hover:bg-white/[0.03]">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-bit-accent/10 bg-bit-accent/10 text-bit-accent">
                    <Icon size={20} />
                  </div>
                  <h2 className="text-xl font-display font-bold text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.body}</p>
                </div>
              );
            })}
          </section>

          <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-white/5 bg-white/[0.015] px-6 py-8 text-center md:px-8">
            {content.intro.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-gray-300 md:text-lg">
                {paragraph}
              </p>
            ))}
          </section>

          <section className="mx-auto max-w-4xl space-y-5 md:space-y-6">
            {content.sections.map((section, index) => (
              <div key={section.heading} className="rounded-[1.75rem] border border-white/5 bg-white/[0.02] px-6 py-7 transition-colors hover:border-white/10 md:px-8">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-bit-accent/20 bg-bit-accent/10 text-[11px] font-mono uppercase tracking-[0.18em] text-bit-accent">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-bit-accent/20 to-transparent" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white md:text-3xl">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-gray-400 md:text-base">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/5 bg-white/[0.02] px-6 py-8 md:px-8">
            <div className="text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent">Support Notes</p>
              <h2 className="mt-3 text-3xl font-display font-bold text-white">Common Questions</h2>
            </div>
            <div className="mt-8 grid gap-4">
              {content.faq.map((item) => (
                <div key={item.question} className="rounded-[1.5rem] border border-white/5 bg-black/20 p-5 transition-colors hover:border-white/10">
                  <h3 className="text-lg font-display font-bold text-white">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-400">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-3xl rounded-[2rem] border border-bit-accent/20 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.12),rgba(255,255,255,0.02))] px-8 py-10 text-center">
            <h2 className="text-3xl font-display font-bold text-white">{content.closingTitle}</h2>
            <p className="mt-4 text-base leading-8 text-gray-300">{content.closingBody}</p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default StaticPage;
