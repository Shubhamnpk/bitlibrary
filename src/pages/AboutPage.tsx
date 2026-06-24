import React, { useState } from 'react';
import { ArrowLeft, BookHeart, BookOpenText, ChevronDown, Github, GraduationCap, Heart, Sparkles, Users, Waypoints } from 'lucide-react';
import Seo from '@/components/Seo';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="animate-fade-in pb-28 md:pb-32">
      <Seo
        title="About BitLibrary | Open Digital Library by Bitnepal"
        description="BitLibrary is an open digital library for students, researchers, and readers who want faster access to public-domain books, authors, and readable archive records."
        canonicalPath="/about"
        keywords={['about BitLibrary', 'Bitnepal library', 'open digital library', 'public domain books']}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* ───── Back ───── */}
        <div className="sm:hidden">
          <div className="pt-6">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:text-bit-accent"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          </div>
        </div>

        {/* ───── Hero ───── */}
        <section className="relative overflow-hidden border-y border-bit-border/40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(var(--bit-accent-rgb),0.08),transparent_50%)] pointer-events-none" />

          <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 md:block">
            <img
              src="/assets/bitlibrary-icon-clean.svg"
              alt=""
              className="h-80 w-80 opacity-[0.04]"
              aria-hidden="true"
            />
          </div>

          <div className="relative py-12 md:py-24">
            <div className="flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-bit-accent/70">
                  About BitLibrary
                </p>
                <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-display font-bold leading-[0.92] tracking-tight text-bit-text">
                  The Open<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-bit-accent to-bit-accent/50">
                    Digital Library.
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-bit-muted sm:text-lg">
                  An open library for students, researchers, and everyone who loves books.
                  Built with community spirit, designed for reading joy.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-bit-accent/15 bg-bit-accent/5 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">
                    <Sparkles size={12} />
                    Open Digital Library
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-bit-border/60 bg-bit-bg px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                    <Users size={12} />
                    Community made
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-bit-border/60 bg-bit-bg px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                    <GraduationCap size={12} />
                    Education focused
                  </span>
                </div>
              </div>

              <div className="hidden shrink-0 md:block">
                <img
                  src="/assets/bitlibrary-icon-clean.svg"
                  alt="BitLibrary"
                  className="h-28 w-28"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ───── Story ───── */}
        <section className="relative py-12 md:py-24">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.9fr] md:items-center">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-bit-accent/70">Our story</p>
              <h2 className="mt-4 text-3xl font-display font-bold leading-tight text-bit-text md:text-4xl">
                One place for books, built with openness at the centre.
              </h2>
              <div className="mt-6 space-y-5 text-base leading-8 text-bit-muted">
                <p>
                  BitLibrary was created to centralise books and reading tools in one platform
                  instead of making people jump across scattered sources.
                </p>
                <p>
                  We focus on public-domain books first, while also making room for important
                  educational materials when needed for learning and curriculum support.
                </p>
                <p>
                  The platform is not only about access to books, but also about supporting a
                  healthier open knowledge ecosystem.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl border border-bit-border/30 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.06),rgba(var(--bit-accent-rgb),0.02))]">
                <div className="aspect-[4/3] p-6 sm:p-8">
                  <div className="flex h-full flex-col justify-between">
                    <div className="space-y-5">
                      {[
                        { label: 'What we are', value: 'The Open Digital Library' },
                        { label: 'Built by', value: 'Open-source community, Bitnepal, and Yoguru' },
                        { label: 'Why it exists', value: 'Make books easier to reach, read, and love' },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-bit-accent">{item.label}</p>
                          <p className="mt-1 text-sm font-medium text-bit-text">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted/50">
                      Simple, warm, and made for readers.
                    </p>
                  </div>
                </div>

                {/* Decorative book icon */}
                <div className="pointer-events-none absolute -bottom-8 -right-8 select-none">
                  <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.06]">
                    <path d="M20 28C20 20.268 26.268 14 34 14H66C124.542 14 172 61.458 172 120V182C172 189.732 165.732 196 158 196H34C26.268 196 20 189.732 20 182V28Z" fill="currentColor"/>
                    <path d="M48 44C48 36.268 54.268 30 62 30H80C138.542 30 186 77.458 186 136V198C186 205.732 179.732 212 172 212H62C54.268 212 48 205.732 48 198V44Z" fill="currentColor"/>
                    <path d="M48 44C48 36.268 54.268 30 62 30H88V212H62C54.268 212 48 205.732 48 198V44Z" fill="currentColor"/>
                    <rect x="98" y="30" width="6" height="182" rx="3" fill="currentColor"/>
                    <path d="M62 74H82" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
                    <path d="M62 108H82" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
                    <path d="M62 142H82" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
                    <path d="M62 176H82" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-2xl border border-bit-border/20 bg-bit-panel/10" />
            </div>
          </div>
        </section>

        {/* ───── Values with illustration ───── */}
        <section className="border-t border-bit-border/40 py-12 md:py-24">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-start">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-bit-accent/70">What we believe</p>
              <h2 className="mt-3 text-2xl font-display font-bold text-bit-text md:text-3xl">
                Values that shape everything.
              </h2>

              <div className="mt-8 space-y-8">
                {[
                  {
                    icon: Sparkles,
                    title: 'Open by mindset',
                    body: 'Built transparently to support readers, builders, and the wider open-source community.',
                  },
                  {
                    icon: GraduationCap,
                    title: 'Made for learning',
                    body: 'Public-domain books and educational references brought into one simpler reading space.',
                  },
                  {
                    icon: Heart,
                    title: 'For real people',
                    body: 'Students, researchers, and book lovers should find, save, and enjoy books without friction.',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="group flex gap-4">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-bit-border/50 bg-bit-panel/30 text-bit-accent transition-colors group-hover:bg-bit-accent/10 group-hover:border-bit-accent/20">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-lg font-display font-bold text-bit-text">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-7 text-bit-muted">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="sticky top-24">
                <div className="relative mx-auto aspect-square max-w-sm overflow-hidden rounded-2xl border border-bit-border/20 bg-[linear-gradient(160deg,rgba(var(--bit-accent-rgb),0.05),rgba(var(--bit-accent-rgb),0.01))] p-8">
                  {/* Decorative reading illustration */}
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-bit-accent/20">
                      <circle cx="60" cy="40" r="16" stroke="currentColor" strokeWidth="2.5" fill="none" />
                      <path d="M28 110C28 82.386 42.318 60 60 60C77.682 60 92 82.386 92 110" stroke="currentColor" strokeWidth="2.5" fill="none" />
                      <path d="M36 58L18 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M84 58L102 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M48 78L60 68L72 78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <rect x="48" y="82" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path d="M54 88H66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M54 94H66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="mt-4 text-xs font-mono uppercase tracking-[0.18em] text-bit-muted/40">
                      Reading made simple
                    </p>
                  </div>
                  <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full border border-bit-border/20" />
                  <div className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 rounded-full border border-bit-border/15" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Promises ───── */}
        <section className="border-t border-bit-border/40 py-12 md:py-24">
          <div className="mb-10 max-w-xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-bit-accent/70">Reading experience</p>
            <h2 className="mt-3 text-2xl font-display font-bold text-bit-text md:text-3xl">
              What you can expect.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { num: '01', text: 'Find the book you want in a few simple clicks.' },
              { num: '02', text: 'Read, save, and bookmark without clutter.' },
              { num: '03', text: 'Keep learning, researching, and exploring in one place.' },
            ].map((item) => (
              <div key={item.num} className="group rounded-xl border border-bit-border/30 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.03),transparent)] p-6 transition-all hover:border-bit-accent/15 hover:bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.06),transparent)]">
                <span className="text-3xl font-display font-bold text-bit-accent/20 transition-colors group-hover:text-bit-accent/40">{item.num}</span>
                <p className="mt-3 text-sm leading-7 text-bit-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section className="border-t border-bit-border/40 py-12 md:py-24">
          <div className="mb-10 max-w-xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-bit-accent/70">Quick answers</p>
            <h2 className="mt-3 text-2xl font-display font-bold text-bit-text md:text-3xl">
              Things people usually want to know.
            </h2>
          </div>

          <div className="max-w-3xl">
            {[
              { question: 'Is BitLibrary open?', answer: 'Yes. Openness is a core part of the project mindset, the product direction, and the community around it.' },
              { question: 'Who is behind BitLibrary?', answer: 'This project is made by the open-source community together with Bitnepal and Yoguru.' },
              { question: 'Is it for education only?', answer: 'Education is a major focus, but BitLibrary is also for anyone who simply loves books and reading.' },
              { question: 'What is the main goal?', answer: 'To help people discover books faster, read more easily, and stay connected to the joy of reading.' },
            ].map((item, index) => (
              <div key={index} className="border-b border-bit-border/30 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-bit-text transition-colors hover:text-bit-accent sm:text-base"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-bit-muted transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === index ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-sm leading-7 text-bit-muted">{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───── CTA ───── */}
        <section className="relative overflow-hidden rounded-2xl border border-bit-accent/15 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.08),rgba(var(--bit-accent-rgb),0.02))] px-6 py-14 text-center sm:px-10 sm:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--bit-accent-rgb),0.06),transparent_50%)] pointer-events-none" />

          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-bit-accent/15 bg-bit-accent/5 text-bit-accent">
              <BookHeart size={20} />
            </div>
            <h2 className="mt-5 text-3xl font-display font-bold text-bit-text sm:text-4xl">
              Read more. Learn more. Love books more.
            </h2>
            <p className="mt-4 text-sm leading-7 text-bit-muted sm:text-base">
              That is the heart of BitLibrary: a simpler, warmer, and more open way
              to bring books closer to people.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-bit-border/60 bg-bit-bg px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                <Github size={13} className="text-bit-accent" />
                Open community project
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-bit-border/60 bg-bit-bg px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                <Waypoints size={13} className="text-bit-accent" />
                One platform for reading
              </span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default AboutPage;
