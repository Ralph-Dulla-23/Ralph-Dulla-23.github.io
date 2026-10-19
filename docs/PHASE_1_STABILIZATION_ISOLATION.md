# Phase 1 Stabilization — Critical Public/Private Isolation (SEC-01 & SEC-02)

This document certifies the implementation and verification of **Phase 1** from `DIARY_STABILIZATION_IMPLEMENTATION.md` (covering PR 02 & PR 03).

---

## 1. Issues Diagnosed and Resolved

### SEC-01: Public Shelf Reader Cutover (PR 02)
- **Problem**: `src/pages/LibraryPage.jsx` and `src/components/Library.jsx` previously called `watchPublicBooks()` and `watchPublicGames()` in `src/lib/db.js`, which directly queried owner-private collections `users/{uid}/books` and `users/{uid}/games`.
- **Resolution**:
  - Implemented `src/services/publicShelfService.js` exporting:
    - `observePublicShelf(ownerUid, onUpdate)`: Subscribes strictly to `publicProfiles/{ownerUid}/shelf` and the local mirror (`diary_public_shelf_v1`), falling back to sanitized static books if the cloud shelf is empty.
    - `observePublicHighlights(ownerUid, onUpdate)`: Subscribes strictly to `publicProfiles/{ownerUid}/highlights`.
  - Switched `src/pages/LibraryPage.jsx` and `src/components/Library.jsx` to `observePublicShelf`, completely eliminating signed-out reads to `/users/{uid}/**`.
  - Updated `toPublicShelfItem` in `src/domain/publicProjection.js` to preserve allowlisted display metadata (`genres`, `platform`, `platforms`, `hoursPlayed`, `pages`, `currentPage`, `rating`, `ratingScale`) while strictly excluding `privateNotes`, `logs`, drafts, and personal review text.

### SEC-02: Firestore Security Cutover & Missing Session Rules (PR 03)
- **Problem**:
  1. `createSession()` writes to `/users/{uid}/sessions/{sessionId}`, but `firestore.rules` lacked an explicit match rule for `/sessions/{sessionId}`, causing write permission errors.
  2. The wildcard subcollection rule on `/publicProfiles/{uid}/{subcollection}/{docId}` was overly broad.
  3. `users/{uid}/books` and `users/{uid}/games` allowed signed-out public reads.
- **Resolution**:
  - Added explicit match for `/users/{uid}/sessions/{sessionId}` with `allow read, write: if isOwner(uid);`.
  - Replaced wildcard public profile rules with explicit subcollection rules for `/shelf/{itemId}` and `/highlights/{highlightId}`.
  - Restricted `/users/{uid}/books/**` and `/users/{uid}/games/**` to `isOwner(uid)` only.

---

## 2. Test Verification Matrix

Automated verification was established via `tests/public-private-isolation.test.mjs` and verified against all 22 test suites (**118 passing tests**):

| Test ID | Test Description | Result |
|---|---|---|
| **TC-01** | `publicShelfService.js` queries `publicProfiles` exclusively | **PASS** |
| **TC-02** | `LibraryPage.jsx` uses `observePublicShelf` exclusively | **PASS** |
| **TC-03** | `Library.jsx` portfolio preview uses `observePublicShelf` | **PASS** |
| **TC-04** | `firestore.rules` authorizes `/sessions` and tightens private rules | **PASS** |
| **TC-05** | `toPublicShelfItem` preserves allowlisted fields without leakage | **PASS** |

---

## 3. Production Build & Static Analysis
- **ESLint**: 0 errors, 0 warnings (`npm run lint`).
- **Vite Build**: Compiled cleanly in 11.23s (`npm run build`), producing code-split chunks for `LibraryPage`, `DiaryShell`, and lazy routes.
