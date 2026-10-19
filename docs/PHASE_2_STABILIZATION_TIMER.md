# Phase 2: Complete One Unified Activity Timer (PR 04 / TIMER-01 - TIMER-05)

## 1. Executive Summary
This document specifies the stabilization of the activity timer across the Books & Games Diary (`com.ralph.diary`), resolving all five timer-related stabilization requirements from `DIARY_STABILIZATION_IMPLEMENTATION.md`:
- **TIMER-01 (Review Modal Continuity)**: Mount global `ActivityTimerReviewModal` in `DiaryShell` so the review state never disappears when `openReview()` transitions out of the mini-tray (`running` / `paused`).
- **TIMER-02 (Conflict Guarding)**: Prevent silent timer overwrites when starting a new activity while another timer is active. Render a conflict confirmation modal allowing the user to either keep the active timer or replace it.
- **TIMER-03 (Monotonic Active Time Tracking)**: Accurately calculate active duration across pauses using elapsed intervals (`accumulatedActiveMs`), strictly excluding pause intervals.
- **TIMER-04 (Detail Page Deep Integration)**: Connect Book Detail (`/app/books/:id`) and Game Detail (`/app/games/:id`) directly to `startTimer` from `useTimer`.
- **TIMER-05 (Session Save Idempotency & Draft Preservation)**: Generate and preserve a deterministic `sessionId` across review retries to prevent duplicate records, and maintain review draft in state on network/storage errors.

---

## 2. Architecture & State Lifecycle

### 2.1 Complete State Machine
```
       ┌────────────────────────┐
       │         IDLE           │
       └───────────┬────────────┘
                   │ startTimer() (Conflict check if already running)
                   ▼
  ┌───────────► RUNNING ◄──────────┐
  │                │               │
  │ resumeTimer()  │ pauseTimer()  │ cancelReview()
  │                ▼               │
  └──────────── PAUSED ────────────┘
                   │
                   │ openReview()
                   ▼
                REVIEW
                   │
                   │ saveSession()
                   ▼
                SAVING (with stable sessionId)
              ┌────┴────┐
     (Success)│         │(Error - draft kept)
              ▼         ▼
            IDLE      REVIEW
```

### 2.2 Global Review Modal Mounting
Previously, `ActiveTimerTray` only rendered when `state === 'running' || state === 'paused'`. When `openReview()` transitioned the timer state to `review`, the tray unmounted. With no global review modal, the user experienced the timer "disappearing into thin air".
By mounting `<ActivityTimerReviewModal />` at the root of `<DiaryShell />`, the review modal appears immediately and unconditionally across all diary routes, rendering:
1. Cover art, item title, and formatted active time (pauses excluded).
2. Book reading progress form (start page, end page, auto-computed pages read) or gaming session form.
3. Private reflection / session notes.
4. "Save Session to Diary" (calls canonical repository `saveSession` with stable `sessionId`).
5. "Resume Timer" (returns to `paused` state with duration intact).
6. "Discard" with explicit confirmation step.

---

## 3. Conflict Resolution Protocol (`TIMER-02`)
When `startTimer({ mediaType, itemId, itemTitle, ... })` is called while an existing timer is in `running`, `paused`, or `review`:
1. `TimerContext` records a pending conflict:
   ```javascript
   setTimerConflict({
       current: activeTimer,
       incoming: { mediaType, itemId, itemTitle, ... }
   });
   ```
2. `ActivityTimerReviewModal` detects `timerConflict` and renders a high-priority warning dialog:
   - "Keep Active Timer": Dismisses the conflict dialog and leaves the running session undisturbed.
   - "Replace and Start New Timer": Discards the previous session and immediately launches the new timer.

---

## 4. Verification & Invariants
1. **0 Errors & 0 Warnings**: Zero ESLint issues across the codebase.
2. **Keyed Remounting Pattern**: `ReviewForm` uses `key={activeTimer.timerId || activeTimer.sessionId}` to reset form fields cleanly upon new sessions without triggering `react-hooks/set-state-in-effect` cascading renders.
3. **Timezone Attribution**: Timestamps and session records use local timezone (`Asia/Manila`) per `DATE-01` to eliminate UTC midnight date misattribution.
4. **Idempotent Saves**: `sessionId` is assigned at review creation and preserved during retries, preventing duplicate records.
