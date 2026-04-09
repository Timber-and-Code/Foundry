# Foundry v1.36.0 — UI Premium Redesign & Cleanup

**Date:** April 3–4, 2026
**Commits:** `9b2366e`, `59a3527`
**Files changed:** 21 | **+1,251 / -2,176** (net -925 lines)

---

## Overview

Major UI overhaul focused on decluttering the interface, establishing visual hierarchy, and making the app feel more polished and premium. Every change was driven by the principle: show less at once, make what matters stand out, and tuck supporting content behind intentional interactions.

---

## Changes

### 1. Title Bar Declutter

**Before:** The header bar contained the sync status dot, pending changes badge, truncated email, logout button, and profile icon — all competing for attention in a small space.

**After:** The title bar is now just the logo, app name, subtitle, and a single profile person icon. The icon itself communicates sync state through color:

| State | Color | Glow |
|-------|-------|------|
| Idle | Amber (`#C0885A`) | None |
| Syncing | Blue (`#60a5fa`) | Blue glow |
| Synced | Green (`#4ade80`) | Green glow (fades after 3s) |
| Offline | Red (`#f87171`) | Red glow |

**Files:** `FoundryBanner.tsx`, `UserMenu.tsx`, `App.tsx`
**New file:** `src/hooks/useSyncState.ts` — extracted shared sync hooks for reuse

### 2. Profile Drawer Expansion

The profile drawer now contains three new sections that were previously scattered across the UI:

- **ACCOUNT** — Email, sync status with dot + label + pending count, sign out button
- **Foundry Pro UPGRADE** — Relocated from home tab; dispatches `foundry:showPricing` custom event to open pricing modal from anywhere
- **Export Backup** — Was already here; Import removed (redundant with Supabase sync)

**Files:** `SettingsView.tsx`, `HomeView.tsx`

### 3. Tour Timing Fix

**Bug:** After first program generation, the tour wouldn't appear until the next full page reload. The `useEffect` that checked for `foundry:show_tour` had an empty `[]` dependency array — it ran once on mount before the flag was set, then never re-ran.

**Fix:** Changed dependency array to `[profile]`. When `setProfile()` fires after setup completes, the effect re-runs and triggers the tour immediately.

**File:** `App.tsx`

### 4. Removed Redundant UI

| Removed | Location | Reason |
|---------|----------|--------|
| Import/Export button | Home tab | Supabase handles sync; Export is in profile drawer |
| Import/Export button | Progress tab header | Same |
| Data Management sub-view | MesoOverview | Import/Export/Reset page — Export in drawer, Reset in drawer |
| Sessions by Week accordion | Schedule tab | Redundant with the calendar view above it |
| `DataManagement` component | MesoOverview.tsx | Dead code after removal |
| `WeekSection` / `DeloadSection` | ScheduleTab.tsx | Dead code after removal |

**Files:** `HomeTab.tsx`, `ProgressView.tsx`, `ScheduleTab.tsx`, `MesoOverview.tsx`, `HomeView.tsx`

### 5. Meso Overview — Built Out

**Before:** Placeholder text: `"Meso overview"` — never implemented.

**After:** Full phase breakdown with four sections:

1. **Program Card** — Split type, duration (weeks + deload), sessions per week
2. **Phase Progression Bar** — Color-coded segments per week, current week highlighted with glow, legend showing which weeks belong to each phase (e.g., "Accumulation W1–2")
3. **Week-by-Week Breakdown** — Each week shows:
   - Phase name + RIR target badge (e.g., "2 RIR")
   - "CURRENT" indicator on active week with phase-colored left border
   - Coaching guidance text from `getMesoRows()`
   - Load and reps progression targets from `getProgTargets()`
4. **Volume Strategy Card** — Explains MEV → MAV → MRV philosophy with color-coded labels

**Data sources:** `getMeso()`, `getWeekPhase()`, `getMesoRows()`, `getProgTargets()`, `PHASE_COLOR`

**File:** `MesoOverview.tsx`

### 6. Emoji Cleanup

| Change | Location |
|--------|----------|
| Removed 💪 (flexing arm) from every exercise card | `ExerciseCard.tsx` |
| Replaced ⭐ with `HammerIcon` SVG for anchor exercises | `ProgressView.tsx` (2 locations) |
| Icon/status div only renders for completed (✓) or cardio (♪) | `ExerciseCard.tsx` |

Anchor exercises now have a consistent visual language — the orange/gold hammer SVG — across ExerciseCard, ProgressView, ExplorePage, and ManualBuilderFlow.

**Files:** `ExerciseCard.tsx`, `ProgressView.tsx`

### 7. PWA Icon Upgrade

**Before:** Plain gold "F" on black background (inline SVG, no gradients, no texture). Manifest `icons` array was empty. Apple touch icon pointed to an SVG (iOS ignores SVGs).

**After:** Forged iron "F" with orange-to-gold gradient, ember glow effect, and radial background warmth — matching the in-app brand identity.

| File | Size | Purpose |
|------|------|---------|
| `icon-512.png` | 512×512 | PWA install, splash screen |
| `icon-192.png` | 192×192 | PWA home screen |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `icon-512.svg` | 512×512 | SVG fallback |
| `icon-192.svg` | 192×192 | SVG fallback |

Manifest updated with PNG icons (primary) + SVG fallbacks. `index.html` updated with proper `<link>` tags for favicon and Apple touch icon.

**Files:** `manifest.json`, `public/manifest.json`, `index.html`, `.gitignore` (added PNG exceptions)

### 8. Home Tab Premium Redesign

The home tab was restructured into two distinct zones separated by an ember gradient divider:

#### Primary Zone (above divider) — "What do I do right now"

- **Greeting** — Unchanged
- **Unified Dashboard Card** — Meso ring (compact 54px inline) + phase badge + week counter + RIR + day pills + progress bar, all in one card. Clicking navigates to Progress tab.
- **Hero Today Card** — The workout card now has:
  - 4px phase-colored left border
  - Colored box shadow (`0 2px 16px`)
  - 17px bold session name (was 15px)
  - Styled "Start →" button badge with phase-colored background
  - On rest/done days: compact header with single "Recovery Guide" collapsible containing tips + mobility

#### Secondary Zone (below divider) — "Supporting actions"

- Readiness card (rest days only)
- Cardio card
- Pre-workout mobility (workout days only)
- Mobility CTA

#### Removed from Home Tab

- Go Pro banner — moved to profile drawer

**Files:** `HomeTab.tsx`, `HomeView.tsx`, `__tests__/HomeTab.test.tsx`

---

## Architecture Notes

- **`useSyncState` hook** (`src/hooks/useSyncState.ts`) — Extracted from `UserMenu.tsx` for reuse. Exports `useSyncState()` (returns `SyncState` enum) and `useSyncDirtyCount()` (returns pending sync count). Listens to `foundry:sync` custom event and online/offline browser events.

- **`foundry:showPricing` custom event** — New event pattern for triggering the pricing modal from anywhere in the app (profile drawer, future paywall gates). HomeView listens and sets `showPricing` state.

- **MesoOverview data flow** — All week/phase/RIR data comes from the existing `getMeso()` cache in `data/constants.ts`. No new data fetching or storage — just rendering what was already computed.

---

## Test Impact

- 210 tests passing (0 failures)
- 2 tests updated to reflect new layout:
  - Removed `MESO PROGRESS` text assertion (merged dashboard no longer has separate label)
  - Updated day pill click test (pills are now `div` elements with `onClick`, not `button`)
- TypeScript strict check passing with 0 errors
