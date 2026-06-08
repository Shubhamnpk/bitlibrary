# BitLibrary Storage, Cache, and Account Management Analysis

> Date: 2026-06-08
> Scope: Browser storage, cache management, IndexedDB suitability, and account-management direction.

---

## 1. Executive Decision

BitLibrary should keep browser storage simple at the localStorage key level:

| Key | Purpose |
|---|---|
| `bitlibrary-user-state-v1` | One protected local account/library key. |
| `bitlibrary-reader-state-v1` | One reader state bucket. |
| `bitlibrary-api-cache-v1` | One recoverable API cache bucket. |
| `bitlibrary-page-cache-v1` | One recoverable page cache bucket. |

This avoids the old scattered-cache problem while keeping implementation risk low. No migration or legacy-cache compatibility is part of this pass; old cache data can be handled later by a separate helper/migration system.

The active keys are written as AES-GCM encrypted envelopes in localStorage for browser-side privacy. The app keeps the decryption key in IndexedDB and initializes the decrypted in-memory view before React mounts.

---

## 2. Current Account State

Current file:

- `src/lib/local-user.ts`

Protected key:

```text
bitlibrary-user-state-v1
```

This local account state stores:

- `profile.displayName`
- `settings.theme`
- `savedBooks`
- `savedAudiobooks`
- `recentSearches`
- `recentlyViewed`

Important rule: cache cleanup must never remove this key.

---

## 3. Current Cache State

Recoverable caches now use two localStorage bucket keys.

### 3.1 API Cache

API cache bucket:

```text
bitlibrary-api-cache-v1
```

Internal entries:

| Internal prefix | Source |
|---|---|
| `book:*` | `src/services/bookService.ts` |
| `audiobook:*` | `src/services/audiobookService.ts` |

Each internal entry stores data with its own timestamp. The bucket is safe to clear because it can be rebuilt from network/API calls.

### 3.2 Page Cache

Page cache bucket:

```text
bitlibrary-page-cache-v1
```

Internal entries:

| Internal key | Source |
|---|---|
| `explore` | `src/App.tsx` |
| `browse:*` | `src/pages/Library.tsx` |
| `search` | `src/pages/Search.tsx` |
| `research` | `src/pages/ResearchPage.tsx` |

These entries are also recoverable and safe to clear.

### 3.3 Reader State

Reader state now uses one localStorage bucket key:

```text
bitlibrary-reader-state-v1
```

Internal entries:

| Internal key | Purpose |
|---|---|
| `pdf` | PDF reader preferences and study state |
| `pdf-progress:*` | PDF chapter progress |
| `audiobook-progress-*` | Audiobook playback progress |

Reader data is still categorized separately from recoverable API/page cache because it is user reading/progress data.

---

## 4. Main Problems Solved

### 4.1 Cache key fragmentation

Old page/service caches used many separate localStorage keys. The current direction reduces that to:

- one API cache key,
- one page cache key,
- internal category-style entry names inside each bucket.

### 4.2 Unbounded cache volume

The storage manager enforces cache budgets by pruning oldest internal entries.

Recommended active budgets:

| Area | Budget |
|---|---:|
| Total recoverable API/page cache | 2 MB |
| API cache bucket | 1.5 MB |
| Page cache bucket | 850 KB |

### 4.3 Account and cache separation

The app now treats browser storage as separate groups:

| Category | Behavior |
|---|---|
| `account` | Protected local account/library state. |
| `reader` | One user reading/progress bucket, clear only by user intent. |
| `api-cache` | Recoverable API cache. |
| `page-cache` | Recoverable page cache. |
| `unknown` | Unmanaged BitLibrary keys, reported but not cleared automatically. |

---

## 5. IndexedDB Study

IndexedDB is useful later, but it is not the best first fix for this problem.

Use IndexedDB when data is:

- large,
- structured,
- queryable by id/source/query,
- safe to load asynchronously,
- recoverable from the network,
- too expensive to repeatedly stringify into localStorage.

Good future candidates:

| Candidate | Why IndexedDB fits |
|---|---|
| Normalized book records by `book.id` | Prevents duplicate full book objects across search/browse/detail caches. |
| Provider API responses | Can grow beyond localStorage more comfortably. |
| Search result references | Store query result IDs instead of repeated book objects. |
| Browse shelf/category references | Store lists of book IDs plus cache metadata. |
| Research results | Larger metadata objects and provider result sets. |

Avoid IndexedDB for:

| Data | Better storage |
|---|---|
| Theme | localStorage or server/user settings. |
| Display name | localStorage now, server account later. |
| Small recent-search list | localStorage. |
| Auth/session tokens | Auth/session provider, not custom IndexedDB. |
| Security-sensitive account data | Server/auth provider. |
| Data needed synchronously during first paint | localStorage or bootstrapped server data. |

Recommendation: keep the current centralized localStorage buckets first. Move large normalized cache data to IndexedDB only after the bucket manager and storage UI are stable.

---

## 6. Account Management Direction

For the current release, account management should mean:

- local profile display name,
- theme preference,
- saved books,
- saved audiobooks,
- recently viewed,
- recent searches,
- reset local data,
- storage/cache visibility.

For future synced accounts:

- add authentication first,
- store durable account identity on the server,
- sync saved books/audiobooks and preferences,
- keep local state as an offline-first mirror,
- reconcile anonymous local data into the signed-in account later.

Do not put security-sensitive account data in localStorage or IndexedDB.

---

## 7. Implementation Plan

Implemented direction:

1. Add `src/lib/storage-manager.ts`.
2. Use one reader state bucket: `bitlibrary-reader-state-v1`.
3. Use one API cache bucket: `bitlibrary-api-cache-v1`.
4. Use one page cache bucket: `bitlibrary-page-cache-v1`.
5. Keep `bitlibrary-user-state-v1` protected.
6. Report account, reader, API cache, page cache, and unknown storage in the My Library storage panel.
7. Do not migrate old cache keys in this pass.

Future direction:

1. Add a separate migration/helper system if old data needs to be imported.
2. Consider IndexedDB for normalized large cache records after the current bucket system is stable.
3. Add real server-backed account sync only when authentication is ready.

---

## 8. Final Recommendation

The best solution for BitLibrary right now is centralized localStorage buckets, not many scattered keys and not an immediate IndexedDB rewrite.

Keep:

- one user/account key,
- one reader state key,
- one API cache key,
- one page cache key.

Use IndexedDB later only for larger normalized cache data, and keep account sync as a separate server/auth feature.
