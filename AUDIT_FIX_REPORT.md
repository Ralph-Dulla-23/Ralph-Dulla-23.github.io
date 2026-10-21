# Ralph Dulla Games & Books Diary — Deep Source Audit and Fix Report

**Date:** October 20, 2026  
**Baseline:** `Ralph-Dulla-23.github.io(1).zip` (uploaded repository)  
**Deliverable:** `DIARY_FIXED_AFFECTED_FILES.zip` (relative-path patch archive)  
**Scope:** Source audit + targeted code corrections. No live Firebase writes, migrations, deployments, or Android rebuilds performed.

## 1. Executive results

- **Changed/added source/config/test files:** 22.
- **Automated tests:** 175 total; **174 pass**, **0 fail**, **1 skipped**. The skipped test scans a fresh `dist/assets` production bundle that could not be generated here.
- **Lint:** clean (`node node_modules/eslint/bin/eslint.js .`).
- **Syntax:** all 66 JavaScript/JSX files under `src/` parse with Babel's JSX parser.
- **Production build:** not verified. The ZIP contains Windows-oriented `node_modules`; this Linux environment does not have `@rollup/rollup-linux-x64-gnu` or Linux esbuild binaries. `npm ci --offline` also cannot restore uncached dependencies. The GitHub Actions Node version was updated to 24 for newer Firebase dependency engine requirements. A clean online `npm ci && npm run check` on the target platform remains necessary.
- **Firebase production permission errors:** actual deployed Firestore rules, Firebase Auth user UID, secrets, and project configuration cannot be inspected or changed from this archive. Source diagnostics and deploy configuration were improved, but remote rule deployment and verification are **required**.

## 2. Verified defects fixed

| ID | Severity | Finding | Code fix |
|---|---|---|---|
| PRV-01 | Critical | `saveGame()` auto-published games even when the owner had not approved publication. | Removed the implicit public-shelf write. Publishing is now an explicit action. |
| PRV-02 | Critical | `GamesPage` auto-published every game whenever it received a collection update. | Removed effect-driven publication. |
| PRV-03 | Critical | Manual `syncLocalToCloud()` and `pullGamesFromCloud()` also republished games. | Removed unintended publish side effects. |
| PRV-04 | Critical | Public shelf merged cached local records and unconditionally fell back to a static bookshelf when the public collection was empty. Unpublish could appear ineffective. | Public `observePublicShelf` / `observePublicHighlights` use only Firestore `publicProfiles/{uid}` projection. Empty public projection stays empty. Errors no longer masquerade as published items. |
| AUTH-01 | High | Owner-only read/write paths can produce permission errors, while listeners display local data without explaining the cause. | Added centralized permission diagnostics and an owner-visible warning banner. |
| AUTH-02 | High | Several private save functions swallowed `permission-denied` and appeared successful after only local writes. | Permission and unauthenticated errors now propagate for book/game saves, book progress, reading sessions, journal writes/deletions and public publication operations. Local drafts remain available. |
| AUTH-03 | High | Deployment configuration did not include a Firestore CLI rules mapping. | Added `firebase.json`. Added CI check for Firebase config/owner UID mismatch. No rules were deployed remotely. |
| TIM-01 | High | Game timer passed `undefined` page properties to Firestore, which rejects undefined field values. | Builds page fields only for book sessions. |
| TIM-02 | High | Timer used UTC `toISOString().slice(0,10)` for date, not the local Manila date. | Uses `getCurrentLocalDateKey()` in timer saving and review. |
| TIM-03 | High | Timer restored a persisted `review`/`saving` state with the dialog closed. | Opens the review on recovery and converts interrupted `saving` to `review`. |
| TIM-04 | High | Canonical book timer created session records but did not update the book's page progress. | Updates the legacy book progress after a successfully saved canonical reading session; records failure separately so the session itself is not lost. |
| TIM-05 | High | Timer used a fabricated anonymous owner UID when authentication was unavailable. | Saving now requires a verified signed-in UID. |
| CAL-01 | High | Calendar ignored canonical `libraryItemId`/`itemId`, preventing cover/title joins and sometimes misclassifying games. | Canonical IDs and explicit `mediaType` take precedence; book start/end fields and duration are normalized for the current UI. |
| CAL-02 | Medium | Explicit local session dates were subordinate to ISO timestamp conversion. | Prefers saved `date` and uses Asia/Manila helpers. |
| INS-01 | High | Analytics ignored canonical `activeSeconds` and sometimes canonical media IDs. | Both book and game insight selectors now recognize canonical sessions and real active durations. |
| INS-02 | High | Editing cumulative hours created another dated session that was counted in addition to the total. | Cumulative game hours remain an aggregate edit; actual timed sessions are stored separately. Updated the outdated source-string test accordingly. |
| DATA-01 | Medium | Unknown total pages were replaced with fictional 350-page values. | Preserves `null` for unknown page totals in current read/save/progress and edit flows. |
| DATA-02 | Medium | Resetting book progress could retain a previous completed date. | Reversible progress correction now clears the completion date. |
| DATA-03 | Medium | Moving a game out of Finished preserved its `finishedOn`. | Clears finished date for non-finished status. |
| BAK-01 | High | "Full JSON Backup" omitted canonical attempts, sessions, journal entries, aggregates, and published projections. | Exports v2 collections and public projections alongside legacy records, with warnings when cloud verification is incomplete; stops on permission errors. |
| CI-01 | High | GitHub workflow specified Node 20 despite newer Firebase packages requiring Node 24.12+. | Uses Node 24 and validates relevant GitHub Actions secrets and the owner UID against local rules before the build. |
| UX-01 | Medium | Public library used an initially static bookshelf and would not clear books after the actual public shelf became empty. | Reads the authoritative public shelf and displays an error when permission is denied. |

## 3. Permission-error root cause and required external action

### A. Paths in the uploaded source vs. rules file

Private owner paths used by the app:

- `users/{uid}/games/{id}` and `/private/notes`
- `users/{uid}/books/{id}` and `/private/notes` and `/sessions/{id}`
- `users/{uid}/journalEntries/{id}`
- `users/{uid}/libraryItems/{id}`
- `users/{uid}/attempts/{id}`
- `users/{uid}/sessions/{id}`
- `users/{uid}/historicalAggregates/{id}`

Public paths:

- `publicProfiles/{uid}/shelf/{id}`
- `publicProfiles/{uid}/highlights/{id}`

The uploaded **`firestore.rules` already lists rules for those paths**. It requires the authenticated user's Firebase UID to equal the designated owner UID. Public profiles of that same UID can be read anonymously. Do **not** solve permission errors by broadening all private paths to public access.

### B. Why permission-denied may still occur

1. The repo's local `firestore.rules` may **not be deployed** to the live Firebase project.
2. The browser can be connected to a different Firebase `projectId` than the one where the rules were deployed.
3. The GitHub Actions secret `VITE_OWNER_UID`, deployed rule UID, and actual Firebase Authentication user UID may not match.
4. The user may be signed out or using a different Firebase Authentication account.
5. Cached/offline data may be shown even though a remote query is denied; the updated app surfaces permission warnings, but cannot repair server permissions on its own.

### C. Deployment procedure (do not skip)

1. **Back up Firestore data and export the existing diary before changing rules.** Use Firebase Console and your currently working exports; don't assume the updated backup is verified until the deployed collections can be read.
2. In Firebase Console → Project Settings, verify the web app belongs to the desired project.
3. In Firebase Console → Authentication → Users, check the **UID** of the account you use to sign in. It must match `VITE_OWNER_UID` and the owner UID in `firestore.rules`.
4. In GitHub repository → Settings → Secrets and variables → Actions, verify all `VITE_FIREBASE_*` secrets and `VITE_OWNER_UID` belong to that project. Never commit the real `.env` or passwords.
5. Review the included `firestore.rules` and `firebase.json`, then from the repo root deploy rules with Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

6. Deploy the updated web application, sign out and sign back in, then test reading/writing the owner collections. Check DevTools Console and Firestore rules evaluation, and verify the expected `projectId` from the web configuration.
7. Test signed-out public browsing and confirm it can only read `publicProfiles/{uid}/shelf` and `/highlights`, not `/users/{uid}/...`.

The new `scripts/verify-firebase-config.mjs` compares the CI owner UID with local rule content, but **cannot** prove deployed rules match. The script intentionally fails when build-time secrets are absent or incompatible.

## 4. Behavior changes requiring attention

**Public bookshelf no longer automatically displays all static books.** This is intentional to enforce explicit publication and make Unpublish actually work. If the public projection is empty, visitors see no published books until the owner explicitly publishes entries from their book/game detail pages or performs a separately reviewed, opt-in one-time public-shelf migration. The private diary still retains its existing book records and static fallback.

**Game total-hour edits no longer fabricate a dated play session.** Use the Play Timer for actual dated sessions. Existing synthetic sessions created by earlier builds were not deleted; review them when reconciling historic statistics.

**Permission errors now appear and may reject a save rather than silently claiming it synced.** This preserves the local draft and communicates why a cloud write failed. Resolving the underlying permissions requires deployment verification.

**Backups contain more collections.** If a cloud read fails, the UI warns that the backup may be incomplete or stops for permission denial. Backups remain a user-controlled action, not background changes.

## 5. Additional risks identified but **not** fully fixed

| Severity | Outstanding risk | Recommended follow-up |
|---|---|---|
| High | Legacy `syncLocalToCloud()` can bulk overwrite newer server records when devices have divergent state. | Move to a versioned/outbox sync model, preserving per-record conflicts and tombstones before removing the legacy mirror. |
| High | `pullBooksFromCloud()` and `pullGamesFromCloud()` may replace newer local data without a conflict review. | Transactional merge by canonical revision; explicit user reconciliation. |
| High | Private notes remain in unencrypted browser `localStorage` mirrors. | Use owner-scoped secure storage and consider encryption for an unlocked device/shared browser. |
| Medium | Dormant `seedExistingBooks()` still performs a legacy import with synthetic dates and page estimates. | Retire it after verifying the v2 migration flow. It is not invoked automatically on page load in this snapshot. |
| Medium | Older, previously auto-published games already in Firestore stay public until manually unpublished. | Audit `publicProfiles/{uid}/shelf` and manually unpublish anything unintended. |
| Medium | Production bundle privacy scan is skipped when no `dist` exists. | Run a clean CI build followed by the bundle-content test. |
| Medium | No live authenticated Firestore/Android end-to-end environment was available. | Test with Firebase Emulator and Android device before production release. |
| Medium | The improved full backup still cannot guarantee local pending writes or unsaved timer draft are captured as canonical records. | Develop a dedicated atomic snapshot/restore process before relying on it as a disaster-recovery system. |

These are deliberately called out, not represented as solved by the patch.

## 6. Files included

All changed files retain their project-relative locations. Copy them into a branch of the original repo, **do not overwrite your entire project blindly**, and review the changes before merging.

```
.github/workflows/deploy.yml
firebase.json
scripts/verify-firebase-config.mjs
src/components/Library.jsx
src/components/diary/DiaryShell.jsx
src/components/timer/ActivityTimerReviewModal.jsx
src/context/TimerContext.jsx
src/domain/selectors/insightsSelectors.js
src/hooks/useDiarySessions.js
src/lib/db.js
src/lib/permissionDiagnostics.js
src/pages/LibraryPage.jsx
src/pages/app/BookDetailPage.jsx
src/pages/app/BooksPage.jsx
src/pages/app/CalendarPage.jsx
src/pages/app/GameDetailPage.jsx
src/pages/app/GamesPage.jsx
src/pages/app/HomePage.jsx
src/pages/app/InsightsPage.jsx
src/services/publicShelfService.js
tests/detail-page-integration.test.mjs
tests/permissions-and-session-regressions.test.mjs
```

The ZIP also contains the unchanged **`firestore.rules`** for convenient review and deployment, plus this report. It does not include `.git`, `node_modules`, `dist`, `.env`, personal backup archives, screenshots, or build binaries.

## 7. Verification steps for your environment

```bash
npm ci
npm run lint
npm test
npm run build
```

After successful build:

```bash
# App available in dist/; run privacy test after the assets exist
node --test tests/public-bundle-privacy.test.mjs
```

Use real smoke tests (owner sign-in, public view, a timed book session, a timed game session, publishing/unpublishing an item, journal save/delete, offline reconnect, and full backup) and confirm the deployed Firestore rules first. These cannot be certified from static analysis alone.

### Bottom line

The patch resolves verified application-side publication errors, most immediately actionable permission diagnostics, timer field validation, canonical calendar/analytics mapping, missing-page defaults, and incomplete backup coverage. **It does not deploy Firestore rules or fix all legacy multi-device synchronization design problems.** Those remaining items are listed above so the next implementation stage can be completed without falsely claiming production readiness.
