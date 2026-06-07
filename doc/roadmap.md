---
description: BitLibrary v2.0 - Implementation Plan & Architecture (API-First Strategy)
---

# 📚 BitLibrary v2.0: The Infinite Library

BitLibrary v2.0 is an "AI-First" digital library platform. It leverages **Google Gemini** (via OpenRouter) for discovery and **Public APIs (Gutendex, Open Library, Google Books, Internet Archive, YoBook)** to provide millions of free books with **zero storage cost**.

By prioritizing **API Linking** over direct file hosting, we ensure BitLibrary can scale indefinitely within the free tiers of our infrastructure.

---

## Current Product Progress (v0.5.0 — Active)

Live progress tracking is in `src/data/roadmap.json` and visualized on the **Roadmap page** (`/roadmap`). Current milestones:

### ✅ Completed (v0.1.0 – v0.5.0)

- **Library foundation (v0.1.0):** Home page, navigation, book cards, reader shell, responsive layout, core visual system.
- **Book discovery (v0.2.0):** Search, author pages, category pages, book detail routes, Open Library/Gutendex/Google Books/IT Bookstore integrations.
- **My Library registry (v0.3.0):** Local-first saved books, saved audiobooks, recent searches, recently viewed, profile and theme preferences.
- **Audiobooks (v0.4.0):** Audiobook discovery page, detail routes, custom audio player with chapters/skip/speed, progress resume, LibriVox integration.
- **Search quality (v0.5.0):** Debounced search (400ms), pagination, minimum 2-char threshold, spelling corrections (English + Nepali), voice search, inline dictionary results.
- **Reader study mode (v0.5.0):** Bookmarks, grouped highlights, highlight color choices, focus mode, side-panel tools, touch zoom, page slider.
- **Curriculum audio player (v0.5.0):** On-demand chapter audio, shared player per book, reader side-panel audio, Nepali/English subject resolution.
- **Navigation polish (v0.5.0):** Back-to-source navigation, floating scroll button, compact metadata, overlay-aware helpers.
- **Reader read-aloud (v0.5.0):** Text-to-speech for generated text and PDF pages, continuous PDF page/spread playback, live PDF sentence highlighting, voice/speed/pause, movable desktop audio controls, headphone trigger, smooth speed changes up to 2.5x.
- **Trust layer — source filtering (v0.5.0):** Hide Internet Archive and Open Library entries without readable PDF/EPUB access — done at 100%.
- **Inline dictionary & spelling (v0.5.0):** Dictionary results expand inline, English/Nepali correction suggestions, filter controls in result header.

### 🔄 In Progress (v0.5.0)

- **YoBook curriculum coverage:** `96%` — Show school books fast, browse by grade/subject, show source provenance per item, full NFE and NCERT content.
- **Reader comfort:** `92%` — Zoom, focused reading, smoother phone reading, side-panel polish, background presets.
- **Connected book and audio paths:** `55-78%` — Listen from book pages, match books with their audio.
- **Trust and source clarity:** `56-76%` — Show source quality and usage rights clearly.
- **Local profile management:** `18-30%` — Edit name/picture, reading preferences, privacy controls, reset/restore.

### 🟡 Early Stages (v0.5.0)

- **Mobile bottom navigation:** `16-20%` — Thumb-friendly bottom nav bar, quick actions, library/reader shortcuts, comfortable mobile spacing.
- **Library portability:** `12-26%` — Custom collections, import/export, move bookmarks and highlights.
- **Account sync (Future):** `2-10%` — Choose what syncs, sync selected data, recover library safely.

---

## 🗺️ Architecture Map (Hybrid Model)

### 1. The "Frontend" (Cloudflare Pages)
- **Search Engines:** Combines results from **Google Books**, **Gutendex**, **Open Library**, and **YoBook**.
- **Cover Display:** Proxies images from **Open Library's Covers API**, Internet Archive, and direct YoBook assets.
- **Reader:** Integrated streaming for AI content (via OpenRouter), PDF.js for external PDFs, IFrame embedding for Internet Archive reader.
- **Research APIs:** Optional toggle for **arXiv, Semantic Scholar, PubMed Central, Europe PMC, OpenAlex, Crossref, DataCite, Unpaywall**.

### 2. The "Intelligence & Data" (Convex)
- **Real-time Catalog:** Stores metadata for "Featured" and "Community Uploaded" books.
- **Cache Layer:** Persistent localStorage cache (6-hour TTL) for API results, reducing upstream calls.
- **User Activity:** Local user state with `localStorage` persistence (no account required for core features).

### 3. The "Vaults" (Storage Strategy)
- **Primary Vault:** **Gutendex, Google Books, Open Library, YoBook** (Direct links to millions of free books).
- **Private Vault:** **Cloudflare R2** (Reserved for rare/user-uploaded PDFs — not yet implemented).
- **Limits:** 10GB for private files, Unlimited for API-linked books.

---

## 🛠️ Implementation Phases & Current Status

### ✅ Phase 1: Foundation (Convex & Hosting) — Complete
- [x] Connect **Convex** and define the `books`, `users`, and `borrows` tables in schema.
- [x] Deploy current React app infrastructure (Vite + TypeScript).
- [x] Initialize **local user state** (Clerk Auth is deferred; local-first approach preferred).

### ✅ Phase 2: The "API Master" Integration — Complete
- [x] Build **Search Orchestrator** querying **Gutendex**, **Google Books**, **Open Library**, and **IT Bookstore**.
- [x] Connect **Open Library Covers API** and Internet Archive cover/image services.
- [x] Update `Book` type to support `externalUrl`, `downloadUrl`, `resourceLinks`, `sourceUrl`, and structured authors.
- [x] YoBook API integration for curriculum books, chapter PDFs, and chapter-level audio.
- [x] Research API integrations (arXiv, Semantic Scholar, OpenAlex, Crossref, DataCite, Europe PMC, etc.) behind a toggle.

### 🔄 Phase 3: The "Infinite Reading" Experience — Active
- [x] PDF viewer handling both local Blob URLs and external HTTPS links (PDF.js via `react-pdf`).
- [x] Stream Gemini-generated "Preview Chapters" via OpenRouter API.
- [x] Text reader with read-aloud, highlights, bookmarks, and study tools.
- [x] Reader side-panel with bookmarks, grouped highlights, background presets, and focus mode.
- [ ] Add a "Save to My Library" toggle that pins API books to the user's profile (done locally, Convex sync pending).
- [ ] Smooth mobile reading experience improvements (66% → 100%).

### ⬜ Phase 4: Cloudflare R2 & Community Uploads — Not Started
- [ ] Configure **Cloudflare R2** for user contributions.
- [ ] Build a secure "Upload Book" form with PDF compression.
- [ ] Implement **Presigned URLs** so users can safely share rare books with the community.

### 🟡 Phase 5: AI-Driven "Library Assistant" — Partially Started
- [x] OpenRouter/Gemini integration for chapter summaries and book descriptions.
- [ ] Allow users to ask: "Find me high-quality free books on Quantum computing."
- [ ] Gemini will search all APIs and present the best three results with one-click "Borrow" options.

---

## 💎 Infrastructure Breakdown ($0 Cost)

| Provider | Service | Usage | Free Tier |
| :--- | :--- | :--- | :--- |
| **Cloudflare** | Pages | Hosting | Unlimited Sites/Bandwidth |
| **Cloudflare** | R2 | Storage | 10GB / month |
| **Convex** | Database | Meta-data | 1M Rows / 10M Actions |
| **OpenRouter** | AI API | AI Logic (Gemini/etc.) | Free models available |
| **Gutenberg** | Gutendex | Classics | Infinite (Public Domain) |
| **Internet Archive** | Open Library | Covers & Books | Infinite (Open Source) |
| **YoBook** | Curriculum API | Nepali education | Free tier |

---

## ⚖️ Strategy: API Linking vs. R2 Storage
- **API Linking (Primary):** Use for 99% of books. No storage cost. Scaling is infinite.
- **R2 Storage (Secondary):** Reserved for "Original Works" or rare PDFs not found in public APIs. 10GB limit. (Not yet implemented.)

## 📦 Current Release: v0.5.0

The latest release is **v0.5.0** — "Reader study tools and smarter search." Key improvements:
- Reader study tools: bookmarks, grouped highlights, highlight colors, focus mode, smoother PDF controls
- Search improvements: debounce, minimum character threshold, pagination, safer URL sync
- YoBook curriculum content: stronger priority across search, curriculum, and audiobook routes
- Reader read-aloud: full TTS with live PDF sentence highlighting, continuous page playback, movable controls
- Inline dictionary and spelling corrections (English + Nepali)
- Voice search support

See `/releases` and `src/data/roadmap.json` for the complete version history and upcoming goals.