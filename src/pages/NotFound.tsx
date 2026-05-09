import React from 'react';
import { ArrowLeft, BookOpenText, Home, Library, Search, Waypoints } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const quickLinks = [
  {
    label: 'Discover',
    body: 'Return to the main discovery stream.',
    href: '/',
    icon: Home,
  },
  {
    label: 'Library',
    body: 'Browse open archive collections.',
    href: '/library',
    icon: Library,
  },
  {
    label: 'Search',
    body: 'Look up books, authors, and subjects.',
    href: '/search',
    icon: Search,
  },
];

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-[calc(100svh-5rem)] items-center overflow-hidden px-4 py-4 sm:px-6 md:py-6">
      <div className="mx-auto w-full max-w-7xl">
        <section className="relative overflow-hidden rounded-[1.5rem] border border-bit-border bg-bit-panel/25 px-4 py-5 sm:px-5 md:rounded-[2rem] md:px-8 md:py-8 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bit-accent/50 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.12),transparent_34%,rgba(var(--bit-text),0.03))]" />
          <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-bit-accent/30 to-transparent" />
          <div className="absolute right-8 top-8 hidden h-40 w-40 border border-bit-accent/20 md:block" />
          <div className="absolute right-14 top-14 hidden h-40 w-40 border border-bit-border md:block" />

          <div className="relative grid gap-5 md:gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-bit-accent/20 bg-bit-accent/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">
                <Waypoints size={13} />
                Route Missing
              </div>

              <h1 className="font-display text-5xl font-bold leading-none tracking-tight text-bit-text sm:text-6xl md:text-7xl lg:text-8xl">
                404
              </h1>
              <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold leading-tight text-bit-text sm:text-3xl md:text-4xl lg:text-5xl">
                This shelf is not in the archive.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-bit-muted md:text-base">
                The route may have moved, the book may no longer be indexed, or the address was typed by hand. You can continue from a known BitLibrary section.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-2.5 text-xs font-mono uppercase tracking-[0.16em] text-bit-text transition-all hover:border-bit-accent/40 hover:bg-bit-panel"
                >
                  <ArrowLeft size={16} />
                  Go Back
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-bit-accent px-4 py-2.5 text-xs font-mono uppercase tracking-[0.16em] text-white transition-all hover:scale-[0.98]"
                >
                  <Home size={16} />
                  Home
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="hidden rounded-2xl border border-bit-border bg-bit-bg/55 p-4 sm:block">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                    <BookOpenText size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">BitLibrary</p>
                    <p className="mt-1.5 text-sm leading-6 text-bit-muted">
                      Use the archive paths below to reconnect with discovery, browsing, or search.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="group flex items-center gap-3 rounded-2xl border border-bit-border bg-bit-panel/40 p-3 transition-all hover:-translate-y-0.5 hover:border-bit-accent/35 hover:bg-bit-panel/60 sm:block sm:p-4"
                    >
                      <div className="flex shrink-0 items-center justify-between gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-bit-border text-bit-accent transition-colors group-hover:border-bit-accent/30">
                          <Icon size={17} />
                        </div>
                        <span className="hidden text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted group-hover:text-bit-accent sm:inline">
                          Open
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-bold text-bit-text sm:mt-4 sm:text-lg">{item.label}</h3>
                        <p className="mt-1 text-xs leading-5 text-bit-muted sm:mt-1.5 sm:text-sm sm:leading-6">{item.body}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NotFound;
