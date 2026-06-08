<p>
  <img src="./public/assets/bitlibrary-logo.svg" alt="BitLibrary logo" width="240" />
</p>

# BitLibrary

BitLibrary is an open digital library for discovering books, curriculum resources, audiobooks, research papers, and reader-friendly public knowledge.

The current release is **v0.5.0**, focused on smarter search, stronger reader study tools, curriculum audio, inline dictionary support, and a calmer local-first library experience.

- Website: [bitlibrary.bitnepal.net](https://bitlibrary.bitnepal.net)
- Release history: [bitlibrary.bitnepal.net/releases](https://bitlibrary.bitnepal.net/releases)
- Roadmap: [bitlibrary.bitnepal.net/roadmap](https://bitlibrary.bitnepal.net/roadmap)
- Source: [github.com/Shubhamnpk/bitlibrary](https://github.com/Shubhamnpk/bitlibrary)

## What BitLibrary Does

BitLibrary brings multiple public book and learning sources into one reading interface. It helps users search across open catalogs, inspect book metadata, read PDFs, listen to audiobooks, save items locally, and use study tools without needing an account.

The app is local-first where possible. Saved books, saved audiobooks, profile preferences, recent searches, recently viewed items, reader settings, PDF bookmarks, highlights, and reading progress are stored in the browser.

## Current Highlights

- Multi-source book discovery across Gutendex, Google Books, Open Library, Internet Archive, IT Bookstore, and YoBook.
- Search with a 2-character threshold, 400ms debounce, pagination, safer URL syncing, source filters, voice search, and English/Nepali correction suggestions.
- Inline dictionary cards and spelling support for English and Nepali learning flows.
- Curriculum pages for Nepal and NCERT resources with grade, subject, and resource-type filtering.
- YoBook-powered curriculum books, chapter PDFs, and chapter-level audio where available.
- Audiobook discovery and playback using LibriVox and YoBook audio sources.
- Book detail pages with source links, download options, related books, metadata, and optional AI-assisted descriptions.
- PDF reader powered by PDF.js with Turn.js desktop page-turn behavior.
- Reader study tools: bookmarks, grouped highlights, removable highlights, highlight colors, background presets, focus mode, touch zoom, page slider, and last-page restore.
- Reader read-aloud tools for generated text and PDF pages, including continuous page/spread playback, live sentence highlighting, voice/speed controls, and movable desktop audio controls.
- Local profile, saved library, saved audio, recently viewed books, recent searches, and theme preference.
- Research mode for scholarly sources such as arXiv, Semantic Scholar, PubMed Central, Europe PMC, OpenAlex, Crossref, DataCite, and Unpaywall.
- SEO metadata, sitemap/robots handling, static project pages, release notes, roadmap, terms, sources, and about pages.

## Roadmap

Active roadmap work is tracked in [src/data/roadmap.json](./src/data/roadmap.json) and displayed at [bitlibrary.bitnepal.net/roadmap](https://bitlibrary.bitnepal.net/roadmap).

Current active areas include:

- YoBook curriculum coverage and clearer source provenance.
- Reader comfort on mobile and desktop.
- Connected book/audio paths.
- Source quality, license, and usage-right clarity.
- Local profile management.
- Mobile bottom navigation.
- Library portability for collections, import/export, bookmarks, and highlights.
- Future account sync after the local-first experience is solid.

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
- Vercel serverless API routes

## Data Sources

BitLibrary uses public APIs and open catalogs. Some sources are faster or more complete than others, so the app uses staged loading, client-side caching, ranking, source filtering, and fallbacks.

- Gutendex / Project Gutenberg
- Google Books
- Open Library
- Internet Archive
- IT Bookstore
- YoBook and audio records
- LibriVox audiobook feeds
- arXiv
- Semantic Scholar
- PubMed Central
- Europe PMC
- OpenAlex
- Crossref
- DataCite
- Unpaywall

Research sources are opt-in from the UI and are not called during normal book search.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
```

### Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Optional OpenRouter settings enable AI-assisted summaries and search insight enrichment:

```text
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_OPENROUTER_MODEL=minimax/minimax-m2.5:free
VITE_OPENROUTER_SITE_URL=http://localhost:5173
VITE_OPENROUTER_APP_NAME=BitLibrary
```

Optional Unpaywall configuration improves DOI-based open-access lookup in research mode:

```text
VITE_UNPAYWALL_EMAIL=research-contact@example.com
```

Convex files are present for backend experiments. The current application is primarily browser-local. If you wire Convex locally, set:

```text
VITE_CONVEX_URL=your_convex_url
```

Without optional keys, the core app still works. AI and some research enrichments simply fall back or stay disabled.

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

- `pnpm dev` - Start the Vite development server.
- `pnpm typecheck` - Run TypeScript typechecking.
- `pnpm build` - Build production assets.
- `pnpm preview` - Preview the production build locally.
- `pnpm check` - Run typecheck and build.

## Main Routes

- `/` - Home and discovery surface.
- `/library`, `/books`, `/browse` - Book discovery and collection browsing.
- `/category/:categoryId` - Category detail page.
- `/curriculum` - Nepal and NCERT curriculum library.
- `/curriculum/subjects` - Curriculum subject browsing.
- `/audiobooks` - Audiobook browse page.
- `/audiobooks/category/:categoryId` - Audiobook category page.
- `/book/:id` - Book detail and reader entry.
- `/audiobook/:id` - Audiobook detail and player page.
- `/author/:name` - Author detail page.
- `/mylibrary` - Local saved books, saved audio, profile state, and history.
- `/search?q=...` - Search results.
- `/research` - Research discovery surface.
- `/dictionary` - Dictionary and spelling tools.
- `/sources` - Sources and credits.
- `/releases` - Release history.
- `/roadmap` - Product roadmap.
- `/about` - About BitLibrary.
- `/terms` - Terms of use.

## Project Structure

```text
api/
  pdf-proxy.ts              Vercel API route for PDF streaming/download fallback
  research-proxy.ts         Vercel API route for research-source requests
  lib/                      Server-side API helpers

convex/
  schema.ts, books.ts       Convex schema/functions kept for backend experiments

public/
  assets/                   Brand assets and social images
  fixtures/                 XML/SVG fixtures for reader and research parsing
  sitemap.xml, robots.txt   Search metadata

src/
  components/               Shared UI, reader, cards, navbar, SEO
  pages/                    Route-level screens
  services/                 Book, audiobook, dictionary, spellcheck, and AI services
  lib/                      Local user state, downloads, PDF helpers, SEO, search ranking
  styles/                   Global CSS and reader styles
  data/                     Roadmap data
  content/                  Static page content
```

## Reader Notes

The PDF reader uses PDF.js for rendering and Turn.js for page navigation on desktop. Study state is stored in a single localStorage record:

```text
bitlibrary-pdf-reader-storage-v1
```

That record stores PDF reader preferences, recent PDF study records, last page, bookmarks, highlights, and highlight colors. Older scattered PDF reader keys are migrated or cleaned up by [src/lib/pdf-reader-storage.ts](./src/lib/pdf-reader-storage.ts).

## Deployment

The app is designed for Vercel as a Vite frontend with serverless API routes in [api/](./api).

Static SPA routing, cache headers, and API route behavior are configured in [vercel.json](./vercel.json).

## Known Limitations

- Public APIs can rate-limit, timeout, return inconsistent metadata, or remove downloadable files.
- PDF rendering quality depends on the source PDF, browser, fonts, device memory, and network behavior.
- PDF outlines only appear when the source PDF contains embedded outline data.
- User library/profile data is browser-local and can be cleared by browser storage cleanup.
- AI-assisted features require an OpenRouter key and depend on model/provider availability.
- Research API behavior depends on each upstream source and can vary by topic, DOI coverage, and open-access availability.
- Large production bundles currently produce Vite chunk-size warnings during build.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

Secrets should never be committed. Use `.env.local` for local development. If you discover a security issue, please read [SECURITY.md](./SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
