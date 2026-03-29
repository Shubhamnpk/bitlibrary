---
description: BitLibrary v2.0 - Implementation Plan & Architecture (API-First Strategy)
---

# 📚 BitLibrary v2.0: The Infinite Library

BitLibrary v2.0 is an "AI-First" digital library platform. It leverages **Google Gemini** for discovery and **Public APIs (Gutendex, Open Library)** to provide millions of free books with **zero storage cost**. 

By prioritizing **API Linking** over direct file hosting, we ensure BitLibrary can scale indefinitely within the free tiers of our infrastructure.

---

## 🗺️ Architecture Map (Hybrid Model)

### 1. The "Frontend" (Cloudflare Pages)
- **Search Engines:** Combines results from **Google Books** and **Gutendex**.
- **Cover Display:** Proxies images from **Open Library's Covers API**.
- **Reader:** Integrated streaming for AI content and PDF.js for external PDFs.

### 2. The "Intelligence & Data" (Convex)
- **Real-time Catalog:** Stores metadata for "Featured" and "Community Uploaded" books.
- **Cache Layer:** Stores recently fetched API results to reduce latency.
- **User Activity:** Manages "My Library" and "Borrowed" books.

### 3. The "Vaults" (Storage Strategy)
- **Primary Vault:** **Gutendex & IT Bookstore** (Direct links to millions of free books).
- **Private Vault:** **Cloudflare R2** (Reserved for rare/user-uploaded PDFs).
- **Limits:** 10GB for private files, Unlimited for API-linked books.

---

## 🛠️ Implementation Phases

### Phase 1: Foundation (Convex & Hosting)
*   [ ] Connect **Convex** and define the `books` and `borrows` tables.
*   [ ] Deploy current React app to **Cloudflare Pages**.
*   [ ] Initialize **Clerk Auth** for user-specific libraries.

### Phase 2: The "API Master" Integration
*   [ ] Build a **Search Orchestrator** in Convex that queries **Gutendex** for classics and **IT Bookstore** for tech.
*   [ ] Connect **Open Library Covers API** to automatically fetch beautiful covers for any book by ISBN/Title.
*   [ ] Update `Book` type to support `externalUrl` (for API books) and `r2Path` (for private books).

### Phase 3: The "Infinite Reading" Experience
*   [ ] Implement a PDF viewer that can handle both local Blob URLs and external HTTPS links.
*   [ ] Stream Gemini-generated "Preview Chapters" for books that don't have a full PDF available.
*   [ ] Add a "Save to My Library" toggle that pins API books to the user's Convex profile.

### Phase 4: Cloudflare R2 & Community Uploads
*   [ ] Configure **Cloudflare R2** for user contributions.
*   [ ] Build a secure "Upload Book" form with PDF compression.
*   [ ] Implement **Presigned URLs** so users can safely share rare books with the community.

### Phase 5: AI-Driven "Library Assistant"
*   [ ] Integrate **Gemini** to act as a "Research Librarian."
*   [ ] Allow users to ask: "Find me high-quality free books on Quantum computing."
*   [ ] Gemini will search all APIs and present the best three results with one-click "Borrow" options.

---

## 💎 Infrastructure Breakdown ($0 Cost)

| Provider | Service | Usage | Free Tier |
| :--- | :--- | :--- | :--- |
| **Cloudflare** | Pages | Hosting | Unlimited Sites/Bandwidth |
| **Cloudflare** | R2 | Storage | 10GB / month |
| **Convex** | Database | Meta-data | 1M Rows / 10M Actions |
| **Google** | Gemini API | AI Logic | 15 RPM (Free) |
| **Gutenberg** | Gutendex | Classics | Infinite (Public Domain) |
| **Internet Archive** | Open Library | Covers | Infinite (Open Source) |

---

## ⚖️ Strategy: API Linking vs. R2 Storage
- **API Linking (Primary):** Use for 99% of books. No storage cost. Scaling is infinite.
- **R2 Storage (Secondary):** Reserved for "Original Works" or rare PDFs not found in public APIs. 10GB limit.
