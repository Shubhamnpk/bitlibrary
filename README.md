<p>
  <img src="./assets/bitlibrary-logo.svg" alt="BitLibrary logo" width="220" />
</p>

# BitLibrary

BitLibrary is an open digital library for books, curriculum resources, audiobooks, and focused reading. It is built with React, Vite, TypeScript, Tailwind CSS, PDF.js, and public book/audio APIs.

The app is local-first where possible: saved books, saved audiobooks, profile preferences, reader progress, PDF bookmarks, and highlights live in the browser unless a future backend feature moves them elsewhere.

## Current Features

- Multi-source book discovery across Gutendex, Google Books, Open Library, Internet Archive, IT Bookstore, and YoBook
- Curriculum library for Nepal and NCERT resources, with grade, subject, and resource-type filters
- Audiobook browsing and playback using LibriVox and YoBook audio sources
- Book detail pages with source links, downloads, related books, and AI-assisted summaries when configured
- PDF flip-book reader powered by PDF.js and Turn.js
- PDF study tools: page bookmarks, text highlights, highlight colors, background presets, last-page restore, and on-demand PDF outline loading
- Local profile dropdown, saved books, saved audiobooks, recent searches, recently viewed books, and theme preference
- Optimized PDF download path with a browser-first download attempt and Vercel proxy fallback
- SEO metadata, sitemap/robots handling, release notes, roadmap, terms, and about pages

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- PDF.js
- Turn.js
- Lucide React
- Axios
- Convex client package
- Vercel serverless API route for PDF proxying

## Data Sources

BitLibrary reads public metadata and media from several sources:

- Gutendex / Project Gutenberg
- Google Books
- Open Library
- Internet Archive
- IT Bookstore
- YoBook curriculum and audio records
- LibriVox audiobook feeds

Some sources are slower or less consistent than others, so the app uses client-side caching, staged loading, ranking, and fallbacks.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
```

### Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Optional AI enrichment uses OpenRouter:

```text
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_OPENROUTER_MODEL=minimax/minimax-m2.5:free
VITE_OPENROUTER_SITE_URL=http://localhost:5173
VITE_OPENROUTER_APP_NAME=BitLibrary
```

Without an OpenRouter key, the app still works. AI summaries, streamed chapter-style responses, and search insight enrichment fall back gracefully or are disabled.

Convex is present in the repo, but the current app is primarily client/local-first. If you wire Convex features locally, set:

```text
VITE_CONVEX_URL=your_convex_url
```

## Development

Start the Vite dev server:

```bash
pnpm dev
```

Open:

```text
http://localhost:5173
```

Run checks:

```bash
pnpm typecheck
pnpm build
```

Or run both:

```bash
pnpm check
```

Preview the production build:

```bash
pnpm preview
```

## Scripts

- `pnpm dev` - Start the Vite development server
- `pnpm typecheck` - Run TypeScript typechecking
- `pnpm build` - Build production assets
- `pnpm preview` - Preview the production build locally
- `pnpm check` - Run typecheck and build

## Project Structure

```text
api/
  pdf-proxy.ts              Vercel API route for PDF streaming/download fallback

convex/
  schema.ts, books.ts       Convex schema/functions kept for backend experiments

src/
  components/               Shared UI, reader, cards, navbar, SEO
  pages/                    Route-level screens
  services/                 Book, audiobook, and AI service integrations
  lib/                      Local user state, PDF helpers, SEO, search ranking
  styles/                   Global CSS and PDF reader styles
  data/                     Roadmap/release content
  content/                  Static page content
```

## Main Routes

- `/` - Home
- `/library`, `/books`, `/browse` - Book discovery
- `/curriculum` - Nepal and NCERT curriculum library
- `/audiobooks` - Audiobook browse page
- `/audiobooks/category/:categoryId` - Audiobook category page
- `/book/:id` - Book detail page
- `/audiobook/:id` - Audiobook detail/player page
- `/author/:name` - Author page
- `/mylibrary` - Local saved books, saved audio, profile state
- `/search?q=...` - Search results
- `/releases`, `/roadmap`, `/about`, `/terms` - Project pages

## Reader Notes

The PDF reader uses PDF.js for rendering and Turn.js for page navigation. Study state is stored under a single localStorage record:

```text
bitlibrary-pdf-reader-storage-v1
```

That record stores PDF reader preferences, recent PDF study records, last page, bookmarks, and text highlights. Older scattered PDF reader keys are migrated/cleaned up by `src/lib/pdf-reader-storage.ts`.

## Deployment

The app is designed to deploy cleanly on Vercel as a Vite frontend with one serverless API route:

```text
api/pdf-proxy.ts
```

The proxy is used when direct PDF download or loading needs same-origin help. Static SPA routing is handled by `vercel.json`.

## Known Limitations

- Public APIs can rate-limit, timeout, or return inconsistent metadata.
- PDF rendering quality depends on the source PDF, browser, fonts, and device memory.
- PDF outlines only appear when the PDF contains embedded outline data.
- User library/profile data is browser-local and can be cleared by browser storage cleanup.
- Large bundles currently produce Vite chunk-size warnings during build.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

Secrets should never be committed. Use `.env.local` for local development. If you discover a security issue, please read [SECURITY.md](./SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
