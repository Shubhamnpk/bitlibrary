# BitLibrary Cache Implementation Report

> Date: 2026-06-08
> Scope: Centralized localStorage keys for account, reader, API cache, and page cache state.

---

## 1. Active Storage Keys

BitLibrary now uses four main localStorage keys.

| Key | Role |
|---|---|
| `bitlibrary-user-state-v1` | Local account/library state. |
| `bitlibrary-reader-state-v1` | Reader preferences, study state, and progress. |
| `bitlibrary-api-cache-v1` | API/service cache bucket. |
| `bitlibrary-page-cache-v1` | Page-level cache bucket. |

Old scattered cache/reader keys are not read, written, or migrated in this implementation. A later helper can handle old data if needed.

The four active keys are stored as AES-GCM encrypted envelopes in localStorage. The app decrypts them during startup and then continues to use normal objects through the storage manager.

---

## 2. Account State

Protected account data remains in:

```text
bitlibrary-user-state-v1
```

It stores:

- local display name,
- theme,
- saved books,
- saved audiobooks,
- recent searches,
- recently viewed books.

This key is protected from cache cleanup.

---

## 3. Reader Bucket

Reader state now lives inside:

```text
bitlibrary-reader-state-v1
```

Internal entries:

| Internal key | Source | Purpose | Expiry |
|---|---|---|---|
| `pdf` | `src/lib/pdf-reader-storage.ts` | PDF preferences and study state | No expiry |
| `pdf-progress:{bookId}` | `src/components/Reader.tsx` | PDF chapter progress | No expiry |
| `audiobook-progress-{audiobookId}` | `src/pages/AudiobookDetails.tsx` | Audiobook playback progress | No expiry |

Reader state is clearable from the My Library storage tools, but it is not removed by normal API/page cache cleanup.

---

## 4. API Cache Bucket

API cache entries live inside:

```text
bitlibrary-api-cache-v1
```

Internal entries:

| Internal prefix | Source | Expiry |
|---|---|---:|
| `book:*` | `src/services/bookService.ts` | 6 hours |
| `audiobook:*` | `src/services/audiobookService.ts` | 6 hours |

Behavior:

- one localStorage key for API cache,
- each internal entry has its own timestamp,
- expired entries are removed when read,
- oldest entries are pruned when the API bucket exceeds its budget.

---

## 5. Page Cache Bucket

Page cache entries live inside:

```text
bitlibrary-page-cache-v1
```

Internal entries:

| Internal key | Source | Expiry |
|---|---|---:|
| `explore` | `src/App.tsx` | 30 minutes |
| `browse:category:{category}` | `src/pages/Library.tsx` | 6 hours |
| `browse:shelf:{category}` | `src/pages/Library.tsx` | 6 hours |
| `browse:shelf:nepali-curriculum` | `src/pages/Library.tsx` | 6 hours |
| `search` | `src/pages/Search.tsx` | 15 minutes |
| `research` | `src/pages/ResearchPage.tsx` | 20 minutes |

Behavior:

- one localStorage key for page cache,
- each internal entry has its own timestamp,
- expired entries are removed when read,
- oldest entries are pruned when the page bucket exceeds its budget.

---

## 6. Storage UI

Updated:

- `src/pages/MyLibrary.tsx`

The My Library storage panel reports:

- account,
- reader,
- API cache,
- page cache,
- unmanaged BitLibrary storage.

Actions:

- clear stale API/page caches,
- clear API and page caches,
- clear reader state.

The storage action buttons are shown in one compact row.

---

## 7. File Naming

The public catalog page file is now:

```text
src/pages/Library.tsx
```

The personal library page file was renamed:

```text
src/pages/Library.tsx -> src/pages/MyLibrary.tsx
```

Routes are unchanged:

- `/library`
- `/books`
- `/browse`

---

## 8. Budget Rules

| Area | Budget |
|---|---:|
| Total recoverable API/page cache | 2 MB |
| API cache bucket | 1.5 MB |
| Page cache bucket | 850 KB |

Budgets prune internal bucket entries, not protected account data.

---

## 9. Browser Storage Privacy

Added:

- `src/lib/encrypted-storage.ts`

Storage format:

```json
{
  "v": 1,
  "i": "...",
  "d": "...",
  "t": 1760000000000
}
```

Behavior:

- managed localStorage values are unreadable at rest,
- AES-GCM uses a 256-bit per-browser key,
- the key is stored in a generic IndexedDB runtime record,
- encryption is bound to `VITE_STORAGE_PRIVACY_SEED` and the specific localStorage key through AES-GCM additional data,
- `src/main.tsx` initializes encrypted storage before React mounts,
- plaintext active-key values are encrypted on startup when encountered,
- managed writes do not fall back to readable localStorage when encryption is unavailable,
- older descriptive IndexedDB key storage is copied into the generic runtime record and cleaned up,
- older `alg` / `iv` / `data` envelopes can still be read and are rewritten in the compact format,
- this is browser privacy/obfuscation, not user-secret encryption.

---

## 10. Verification

Commands run:

```bash
pnpm typecheck
pnpm build
```

Result:

- TypeScript passed.
- Production build passed.
- Vite chunk-size/dynamic-import warnings remain unrelated to this storage work.
