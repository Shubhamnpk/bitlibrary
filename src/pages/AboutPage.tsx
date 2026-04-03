import React from 'react';
import { ArrowLeft, BookHeart, BookOpenText, Github, Library, Sparkles, Users, Waypoints } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

const valueCards = [
  {
    title: 'Open by mindset',
    body: 'BitLibrary is built in an open way to support readers, builders, and the wider open-source community.',
    icon: Sparkles,
  },
  {
    title: 'Made for learning',
    body: 'We bring public-domain books and important educational references into one simpler reading space.',
    icon: Library,
  },
  {
    title: 'For real people',
    body: 'Students, researchers, and book lovers should be able to find, save, and enjoy books without friction.',
    icon: Users,
  },
];

const trustPoints = [
  {
    label: 'What we are',
    value: 'The Open Digital Library',
  },
  {
    label: 'Built by',
    value: 'Open-source community, Bitnepal, and Yoguru',
  },
  {
    label: 'Why it exists',
    value: 'Make books easier to reach, read, and love',
  },
];

const simplePromises = [
  'Find the book you want in a few simple clicks.',
  'Read, save, and bookmark without clutter.',
  'Keep learning, researching, and exploring in one place.',
];

const quickAnswers = [
  {
    question: 'Is BitLibrary open?',
    answer: 'Yes. Openness is a core part of the project mindset, the product direction, and the community around it.',
  },
  {
    question: 'Who is behind BitLibrary?',
    answer: 'This project is made by the open-source community together with Bitnepal and Yoguru.',
  },
  {
    question: 'Is it for education only?',
    answer: 'Education is a major focus, but BitLibrary is also for anyone who simply loves books and reading.',
  },
  {
    question: 'What is the main goal?',
    answer: 'To help people discover books faster, read more easily, and stay connected to the joy of reading.',
  },
];

const visualMoments = [
  {
    title: 'Open shelves',
    body: 'Public-domain reading, gathered into one calm space.',
    icon: Library,
  },
  {
    title: 'Learning flow',
    body: 'A gentler path for study, curriculum, and discovery.',
    icon: BookOpenText,
  },
];

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <div className="animate-fade-in pb-28 pt-4 md:pb-32 md:pt-6">
      <div className="mx-auto max-w-6xl">
        <article className="space-y-8 md:space-y-12">
          <section className="relative overflow-hidden rounded-[2.75rem] border border-bit-border bg-[linear-gradient(160deg,rgba(var(--bit-accent-rgb),0.08),rgba(var(--bit-accent-rgb),0.02))] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.16)] md:px-12 md:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--bit-accent-rgb),0.16),transparent_48%)] pointer-events-none" />
            <div className="absolute -left-24 top-12 h-60 w-60 rounded-full bg-bit-accent/10 blur-3xl pointer-events-none" />
            <div className="absolute right-0 top-0 h-72 w-72 bg-[radial-gradient(circle,rgba(var(--bit-accent-rgb),0.1),transparent_60%)] pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-bit-accent/40 to-transparent pointer-events-none" />

            <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="max-w-3xl">
                <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent">
                  About BitLibrary
                </p>
                <h1 className="max-w-4xl text-5xl font-display font-bold leading-[0.94] tracking-tight text-bit-text md:text-7xl">
                  The Open Digital Library.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-bit-muted">
                  An openlibrary space for students, researchers, or who simply love books.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="inline-flex rounded-full border border-bit-accent/20 bg-bit-accent/8 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-accent">
                    Open Digital Library
                  </div>
                  <div className="inline-flex rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                    Community made
                  </div>
                  <div className="inline-flex rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                    Education focused
                  </div>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-lg">
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[2.25rem] border border-bit-border bg-bit-panel/40 p-6 backdrop-blur-sm md:p-7">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                        <Sparkles size={12} className="text-bit-accent" />
                        Open by design
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted/70">
                        Read more freely
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {trustPoints.map((item) => (
                        <div key={item.label} className="rounded-[1.35rem] border border-bit-border bg-bit-panel/30 p-4">
                          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-bit-accent">{item.label}</p>
                          <p className="mt-2 text-sm font-display font-bold leading-6 text-bit-text">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {visualMoments.map((item, index) => {
                      const Icon = item.icon;

                      return (
                        <div key={item.title} className={`relative overflow-hidden rounded-[2rem] border border-bit-border p-5 ${index === 0 ? 'bg-[linear-gradient(160deg,rgba(var(--bit-accent-rgb),0.14),rgba(var(--bit-accent-rgb),0.03))]' : 'bg-[linear-gradient(160deg,rgba(var(--bit-accent-rgb),0.06),rgba(var(--bit-accent-rgb),0.02))]'}`}>
                          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full border border-bit-border opacity-40" />
                          <div className="relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-bit-border bg-bit-panel/40 text-bit-accent">
                              <Icon size={20} />
                            </div>
                            <h3 className="mt-8 text-2xl font-display font-bold text-bit-text">{item.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-bit-muted">{item.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3 md:gap-6">
            {valueCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-bit-border bg-[linear-gradient(180deg,rgba(var(--bit-accent-rgb),0.05),rgba(var(--bit-accent-rgb),0.015))] p-7 transition-all hover:-translate-y-1 hover:border-bit-accent/20"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-bit-accent/10 bg-bit-accent/10 text-bit-accent">
                    <Icon size={20} />
                  </div>
                  <h2 className="text-xl font-display font-bold text-bit-text">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-bit-muted">{item.body}</p>
                </div>
              );
            })}
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2.25rem] border border-bit-border bg-bit-panel/30 p-7 md:p-10">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Our story</p>
              <h2 className="mt-4 text-3xl font-display font-bold text-bit-text md:text-4xl">
                One place for books, built with openness at the center.
              </h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-bit-muted">
                <p>
                  BitLibrary was created to centralize books and reading tools in one platform instead of making people jump across scattered sources.
                </p>
                <p>
                  We focus on public-domain books first, while also making room for important educational materials when needed for learning and curriculum support.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[2.25rem] border border-bit-accent/15 bg-[linear-gradient(180deg,rgba(var(--bit-accent-rgb),0.12),rgba(var(--bit-accent-rgb),0.02))] p-7 md:p-10">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">What it should feel like</p>
                <h2 className="mt-4 text-3xl font-display font-bold text-bit-text md:text-4xl">
                  Simple, warm, and made for readers.
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {simplePromises.map((item) => (
                  <div key={item} className="rounded-[1.5rem] border border-bit-border bg-bit-panel/40 px-4 py-5 text-sm leading-7 text-bit-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2.25rem] border border-bit-border bg-bit-panel/30 p-7 md:p-10">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-muted/70">Open community</p>
              <h2 className="mt-4 text-3xl font-display font-bold text-bit-text">Built with community spirit.</h2>
              <p className="mt-4 text-sm leading-7 text-bit-muted md:text-base">
                BitLibrary is made by the open-source community together with Bitnepal and Yoguru. That matters, because the platform is not only about access to books, but also about supporting a healthier open knowledge ecosystem.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-bit-border bg-bit-panel/30 p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Openness</p>
                <p className="mt-4 text-sm leading-7 text-bit-muted">
                  The project aims to stay transparent, accessible, and useful for people who care about open culture and shared learning.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-bit-border bg-bit-panel/30 p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Education</p>
                <p className="mt-4 text-sm leading-7 text-bit-muted">
                  Students and researchers need fewer barriers between search, discovery, and actual reading.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-bit-border bg-bit-panel/30 p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Reading joy</p>
                <p className="mt-4 text-sm leading-7 text-bit-muted">
                  We want people to save books, bookmark pages, and spend more time enjoying what they read.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-bit-border bg-bit-panel/30 p-6">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">GitHub friendly</p>
                <p className="mt-4 text-sm leading-7 text-bit-muted">
                  The project should feel easy to follow, easy to trust, and easy for the community to connect with.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-bit-border bg-[linear-gradient(180deg,rgba(var(--bit-accent-rgb),0.03),rgba(var(--bit-accent-rgb),0.015))] px-6 py-10 md:px-10 md:py-12">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-bit-accent">Quick answers</p>
              <h2 className="mt-3 text-3xl font-display font-bold text-bit-text md:text-4xl">
                The things people usually want to know first.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2">
              {quickAnswers.map((item) => (
                <div key={item.question} className="rounded-[1.75rem] border border-bit-border bg-bit-panel/40 p-6 transition-colors hover:border-bit-accent/20">
                  <h3 className="text-lg font-display font-bold text-bit-text">{item.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-bit-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-bit-accent/20 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.14),rgba(255,255,255,0.02))] px-8 py-12 text-center md:px-12 md:py-14">
            <div className="mx-auto max-w-3xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                <BookHeart size={22} />
              </div>
              <h2 className="mt-6 text-3xl font-display font-bold text-bit-text md:text-4xl">
                Read more. Learn more. Love books more.
              </h2>
              <p className="mt-5 text-base leading-8 text-bit-muted">
                That is the heart of BitLibrary: a sweeter, simpler, and more open way to bring books closer to people.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                  <Github size={14} className="text-bit-accent" />
                  Open community project
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/50 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-bit-muted">
                  <Waypoints size={14} className="text-bit-accent" />
                  One platform for reading
                </div>
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};

export default AboutPage;
