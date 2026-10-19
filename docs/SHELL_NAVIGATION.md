# Diary Shell & Navigation Redirection Documentation

## Overview
Ticket: **PR-08 / P2-01**
Specification Reference: `BOOKS_GAMES_DIARY_IMPLEMENTATION.md` (Sections 3.1, 3.2, 3.3, 4.1, 14: P2-01)

This implementation establishes the persistent 5-tab diary shell, accessible quick logging modal, and legacy route redirection.

---

## 1. Five Persistent Tabs (`src/components/diary/navigationConfig.js`)

1. **Home**: `/app/home` — Daily overview, resume cards, and quick summary.
2. **Library**: `/app/library/books` (or `/app/library/games`) — Media collection.
3. **Calendar**: `/app/calendar` — Cover-based activity calendar.
4. **Journal**: `/app/journal` — Reflections, reviews, and quotes.
5. **Insights**: `/app/insights` — Statistics, velocity, and goals.

Active tab highlighting is derived directly from `location.pathname` via `getActiveTab(pathname)` to avoid state lag on back/forward browser navigation.

---

## 2. Prominent Global Quick Action (`+`)

The center action button opens `QuickActionModal`:
- **Add Book**: Search catalog and add media (`/app/library/books?action=add`).
- **Add Game**: Log new game in backlog (`/app/library/games?action=add`).
- **Log Reading**: Record pages or manual reading time.
- **Log Playtime**: Record gaming hours.
- **Write Note**: Capture reflection or book quote (`/app/journal?action=new`).

All interactive controls meet the WCAG AA minimum 44×44px touch targets.

---

## 3. Route Aliases & Compatibility Redirects (`src/App.jsx`)

- `/#/app` → `/#/app/home`
- `/#/app/books` → `/#/app/library/books`
- `/#/app/games` → `/#/app/library/games`
- `/#/app/library` → `/#/app/library/books`
- Native Capacitor wrapper: root redirect defaults to `/app/home`.

Public portfolio routes (`/`, `/portfolio`, `/library`, `/stats`) remain completely independent and public.
