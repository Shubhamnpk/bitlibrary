---
description: Deep Research on Free Book & Ebook APIs for BitLibrary v2.0
---

# 📚 Book API Discovery & Research Report

To build a robust, scalable, and $0-cost library, we can leverage these public APIs. They provide metadata, cover images, and in many cases, direct links to download or read books.

---

## 1. Gutendex (Project Gutenberg JSON API)
**Best for:** High-quality public domain classics.

- **Base URL:** `https://gutendex.com/`
- **Main Endpoint:** `GET /books/`
- **Search Parameter:** `?search={query}` (URL encoded)
- **Technical Specs:**
    - Filter by Language: `?languages=en,fr`
    - Filter by Subject: `?topic={subject}`
    - Pagination: Returns a `next` URL in the response.
- **Deep Research Note:** This is our **primary source** for "Borrowing." We can link directly to their hosted EPUBs/PDFs.

## 2. Open Library API (By Internet Archive)
**Best for:** Modern book metadata and high-quality cover images.

- **Search Base:** `https://openlibrary.org/search.json`
- **Covers Base:** `https://covers.openlibrary.org/b/`
- **Key Endpoints:**
    - Search: `?q={query}` OR `?title={title}&author={author}`
    - Covers: `/{id_type}/{value}-{size}.jpg`
        - Example: `isbn/0385472579-L.jpg` (Supports S, M, L)
    - Work Detail: `https://openlibrary.org/works/{work_id}.json`
- **Deep Research Note:** Use this specifically for **Cover Images**. It’s the most reliable source for images by ISBN.

## 3. Google Books API
**Best for:** Comprehensive search across almost every book.

- **Base URL:** `https://www.googleapis.com/books/v1/volumes`
- **Main Endpoint:** `GET /`
- **Search Parameter:** `?q={query}`
- **Technical Specs:**
    - API Key: `&key={YOUR_API_KEY}` (Required for higher limits)
    - Filter by Ebook: `?filter=ebooks`
    - Pagination: `startIndex` and `maxResults`.
- **Deep Research Note:** Best used as a **Fallback Search Engine**. 

## 4. IT Bookstore API
**Best for:** Programming and technology books.

- **Base URL:** `https://api.itbook.store/1.0/`
- **Search Endpoint:** `GET /search/{query}`
- **Book Details:** `GET /books/{isbn13}`
- **Technical Specs:**
    - Simple and open; returns direct PDF download links where available.
- **Deep Research Note:** Perfect for the "Computer Science" collection.

## 5. Standard Ebooks (OPDS Feed)
**Best for:** Professional-grade, modern formatting of classics.

- **Base URL:** `https://standardebooks.org/opds/`
- **Main Endpoint:** `GET /all`
- **Search Endpoint:** `GET /all?q={query}`
- **Technical Specs:** 
    - This is an **OPDS (Open Publication Distribution System)** feed (XML format), requiring an XML-to-JSON parser or direct parsing in the frontend.
- **Deep Research Note:** Use this to provide a "Premium Reading" option for popular classics.

---

## 🚀 Recommended Integration Strategy for BitLibrary

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Primary Catalog** | **Gutendex** | Provides the actual content files for free. |
| **Cover Images** | **Open Library** | The only reliable source for high-res free covers. |
| **Search Engine** | **Google Books** | For the broadest possible search reach. |
| **Tech Collection** | **IT Bookstore** | Native support for PDF links for developers. |

### Implementation Goal:
Instead of uploading every PDF to **Cloudflare R2**, we will:
1.  Search via **Google Books**.
2.  If it's a classic, fetch the download link from **Gutendex**.
3.  If it's a tech book, fetch the PDF from **IT Bookstore**.
4.  **Only use R2** for user-uploaded books or rare PDFs we find ourselves.

---

### Comparison of Storage Impact
*   **Method A (Upload everything):** 1,000 books = 10GB (Hits R2 Free Tier Limit).
*   **Method B (API Linking):** 1,000,000 books = **0GB** (Infinite Scaling).
