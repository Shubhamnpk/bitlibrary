<p align="center">
  <img src="./assets/bitlibrary-logo.svg" alt="BitLibrary logo" width="220" />
</p>

# BitLibrary

BitLibrary is a futuristic book discovery and reading app built with React, Vite, and TypeScript. It combines public book data sources, AI-assisted search enrichment, cached browsing, and a polished reading-focused UI.

## Features

- Multi-source book search across Gutendex, Google Books, Open Library, Internet Archive, and IT Bookstore
- Fast staged search results with caching for repeat queries
- Author and category exploration pages
- AI-assisted search insights and enrichment through OpenRouter
- Reader flow for opening and navigating book details
- Cached explore page data for faster repeat visits
- Responsive UI with a distinctive "neural archive" visual style

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Convex
- OpenRouter

## Data Sources

BitLibrary currently pulls book and metadata results from:

- Gutendex
- Google Books
- Open Library
- Internet Archive
- IT Bookstore

AI-powered search enhancements are optional and use OpenRouter when configured.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm or npm

### Installation

```bash
pnpm install
```

If you use npm instead:

```bash
npm install
```

### Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Required for AI features:

- `VITE_OPENROUTER_API_KEY`

Optional:

- `VITE_OPENROUTER_MODEL`
- `VITE_OPENROUTER_SITE_URL`
- `VITE_OPENROUTER_APP_NAME`

Without an OpenRouter key, the app still works, but AI-generated search enrichment and summaries will be disabled.

## Running Locally

```bash
pnpm dev
```

Open:

```text
http://localhost:5173
```

## Build

```bash
pnpm build
```

## Preview Production Build

```bash
pnpm preview
```

## Project Structure

```text
src/
  components/     Reusable UI pieces
  pages/          Route-level pages
  services/       External API integrations
  lib/            Shared utilities
  styles/         Global styling
convex/           Convex schema and functions
```

## Open Source Notes

- Secrets should never be committed. Use `.env.local` for local development.
- `.env.local` is ignored by git.
- If you accidentally expose an API key, rotate it immediately.

## Known Limitations

- Search speed depends on third-party APIs, and some sources are slower than others.
- Convex types may need to be generated locally if you plan to use Convex functions in development.
- Availability and quality of book metadata can vary by source.

## Scripts

- `pnpm dev` - Start the Vite dev server
- `pnpm build` - Create a production build
- `pnpm preview` - Preview the production build locally

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

If you discover a security issue, please read [SECURITY.md](./SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
