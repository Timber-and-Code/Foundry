# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.20.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

---

## 2 · Pricing Model & Path to $100K

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 — permanently free for: Under 18 · Adults 62+ | Manual program builder, full tracking, exercise library, warmup guides |
| **Pro** | $12/mo · $99/yr (save 2 months) | AI program builder, full history, sparklines, e1RM, all advanced features |
| **Trainer / Coach** | $29/mo · $249/yr — post-Capacitor | Client management, shared programs, coach dashboard |

### The Math to $100K
- 700 active Pro subscribers at $12/mo = $100,800 ARR
- Or: 850 annual at $99 + ~200 monthly = $102,550
- Tyler (James's wife, works in business banking) and James are active beta testers — currently mid-mesocycle
- Tyler's business banking network is the primary warm acquisition channel
- James's daughter and a friend are also beta testing
- Sydney (works at a gym) = target pilot for the Trainer tier
- Every trainer using the app is a distribution node — 10 trainers × 20 clients = 200 users from 10 conversations

### Revenue Opportunities (Surfaced & Standing)
- **AI builder paywall** — Free tier gets static generator, Pro gets AI. Clearest monetization lever. Deferred until post-Vite migration; beta testers remain ungated. `ppl:pro` localStorage key reserved.
- **Rest day "Next Session" preview as Pro gate** — free users see session label only; Pro users see full exercise list, prescribed weights, and volume targets.
- **Sample programs as a conversion funnel** — "Start this program" is the highest-intent free-user moment. Prime candidate for a Pro interstitial: "Get the AI-personalized version with Pro."
- **Free tier for Under 18 / 62+** — young users become paying adults; older users convert adult children; both demographics are underserved by mainstream fitness apps.
- **Cardio plan as a Pro differentiator** — guided interval timer + structured cardio plans could gate HIIT protocols behind Pro while keeping freeform logging free.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~15,977 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker → `https://foundry-ai.timberandcode3.workers.dev` |
| AI Key | Stored as Cloudflare Worker secret `ANTHROPIC_API_KEY` — never in source |
| Hosting | GitHub Pages — `https://timber-and-code.github.io/Foundry` |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | `~/foundry-worker/worker.js` + `wrangler.toml` on James's WSL2 machine |

**Critical invariant:** The `exercises` useState hook MUST be declared before the `prevWeekNotes` useMemo (~line 9051). Reversing this order causes a black screen on Week 2+.

**Vite/Capacitor migration:** Deferred to v2.0 sprint. Triggers: Pro paywall activation, App Store distribution, Trainer tier.

---

## 4 · Version History

### v1.20.0 — Cardio System

**CARDIO_WORKOUTS data array** (plain script block)
8 protocols across 3 categories, each with id, label, category, description, defaultType/Duration/Intensity, and optional intervals config:
- HIIT: Tabata (20/10 × 8), Norwegian 4×4 (240/180 × 4), 30/30s (30/30 × 10)
- Steady State: Zone 2, Easy Run, Long Slow Distance
- Conditioning: 10-Min Flush, 20-Min AMRAP

**New storage key:** `ppl:cardio:session:YYYY-MM-DD` — fully independent of meso day slots. Helpers: `loadCardioSession()` / `saveCardioSession()`.

**`CardioIntervalTimer` component**
- Full modal: SVG ring, WORK (red) / REST (green) phase label, round counter, round pip indicators, MINIMIZE ↓ button
- Minimized bar: fixed above nav at `bottom:64`, phase-colored background, tap to expand — mirrors rest timer architecture
- Haptic on each phase transition; zIndex 225 (above rest timer at 220)
- Buttons: STOP / SKIP TO REST→ / SKIP TO WORK→ / LOG SESSION ✓ on completion

**`CardioSessionView` component**
- Standalone view parallel to DayView/ExtraDayView
- Protocol selector: category labels + horizontally-arranged chips; tapping pre-fills type/duration/intensity + shows description + interval badges
- Log section: type chips, duration input, intensity buttons — fully editable after protocol selection
- Elapsed timer in header once started
- "▶ Open Interval Timer" button visible for HIIT protocols after session started
- Completion confirmation modal; saves `completed: true` to session storage

**Meso creation — optional cardio plan step**
- `maybePromptCardio()` intercepts all three SetupPage exit points (manual path, AI path, leg balance prompt)
- Full-screen overlay (zIndex 9999): 7-day picker with per-day protocol selector
- Lifting days labeled inline; protocol description shown on selection
- Skip → saves profile without `cardioSchedule`; Save Plan → saves `{ cardioSchedule: [{ dayOfWeek, protocol }] }` on profile
- Flat across the whole meso — phase-aware variation deferred

**Home tab cardio card**
- Planned cardio (slot in `cardioSchedule` matching today's day-of-week): full card with protocol name, description, interval badges, START ▶ button
- Completed: card shows CARDIO DONE ✓ state
- No planned cardio: soft "Add a cardio session +" CTA
- Both open `CardioSessionView` via `onOpenCardio(dateStr, protocolId)`

**Calendar markers**
- Green dot bottom-right on any date with a cardio session (`ppl:cardio:session:YYYY-MM-DD` present)
- Brighter green when `completed: true`, accent color when in-progress
- Tappable — opens `CardioSessionView` for that date
- Legend updated with Cardio entry

**App routing**
- `view="cardio"` added with `selectedCardioDate` + `selectedCardioProtocol` state
- `foundry:openCardio` custom event listener — allows DayView's post-strength "Log Cardio →" button to navigate to `CardioSessionView` after returning to home

**Old CardioBlock removed**
- Component definition deleted (~170 lines)
- `cardio-block` div and `<CardioBlock>` render removed from DayView
- Post-strength prompt "Log Cardio →" now fires `foundry:openCardio` custom event instead of scrolling

**Bug fixed this session**
- `ReadyDialog` function declaration got eaten by the cardio plan `str_replace` — `function ReadyDialog` prefix was dropped, causing a full Babel parse failure (black screen). Restored.

---

### v1.19.0 — Polish & Visual Systems
- Typography sweep: 12px floor, CSS variable contrast fixes
- PR Tracker: compact single-row cards + tap-through bottom sheet
- Rest timer minimized: larger countdown, ring-color tint
- Volume Check landmark labels: plain language
- "Sets Logged" bar chart removed from home tab

### v1.18.0 — Explore Launch + CompleteDialog Overhaul
- "Start this program" CTA on all 10 sample programs
- CompleteDialog RPE redesign, Not yet / Done ✓, + Add a Set, last-set timer sequencing
- ErrorBoundary added
- iOS PWA cache-busting
- Black screen Week 2+ fix (exercises useState ordering)

---

## 5 · Onboarding Rewrite (#21) — Designed, Not Yet Built

Full design approved. Ready for implementation.

| Screen | Content |
|--------|---------|
| Screen 0 | Problem/solution framing |
| Screen 1 | Guesswork-removal messaging + progression visualization |
| Screen 2 | Experience level selector with dynamic subtext |
| Tutorial | Option B — first-use coach overlay on home screen |

---

## 6 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON — now includes optional `cardioSchedule: [{ dayOfWeek, protocol }]` |
| ppl:done:d{d}:w{w} | Meso session completion flag |
| ppl:day{d}:week{w} | Set/rep data for meso session |
| ppl:sess:lift:d{d}:w{w} | Session duration (minutes) |
| ppl:sessionStart:d{d}:w{w} | Session start timestamp (ms) |
| ppl:strengthEnd:d{d}:w{w} | Strength phase end timestamp (ms) |
| ppl:extra:YYYY-MM-DD | Extra session day object JSON |
| ppl:extra:done:YYYY-MM-DD | Extra session completion flag |
| ppl:extra:start:YYYY-MM-DD | Extra session start timestamp |
| ppl:extra:end:YYYY-MM-DD | Extra session strength end timestamp |
| ppl:extra:data:YYYY-MM-DD | Extra session set/rep data |
| ppl:cardio:session:YYYY-MM-DD | Cardio session (standalone, by date) — new in v1.20.0 |
| ppl:bwlog | Bodyweight log array JSON |
| ppl:bwPromptSunday | BW check-in shown-flag (resets weekly) |
| ppl:bwGoal | Body weight goal (lbs, string) |
| ppl:skip:d{d}:w{w} | Skip flag for future meso day slot |
| ppl:currentWeek | Current meso week index |
| ppl:theme | Dark/light theme preference |
| ppl:archive | Completed meso archive array (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override (swap) for slot |
| ppl:notes:d{d}:w{w} | Session-level note text |
| ppl:exnotes:d{d}:w{w} | Per-exercise notes JSON |
| ppl:cardio:d{d}:w{w} | Legacy cardio log (still exists, no longer written to) |
| ppl:extra:notes:YYYY-MM-DD | Extra session session-level note |
| ppl:extra:exnotes:YYYY-MM-DD | Extra session per-exercise notes JSON |
| ppl:pro | Reserved — Pro tier flag (not yet active) |

---

## 7 · Key Code Locations (v1.20.0)

| Item | Location |
|------|---------|
| CARDIO_WORKOUTS array | ~line 2867 (plain script block) |
| loadCardioSession / saveCardioSession | ~line 3056 |
| FOUNDRY_AI_WORKER_URL | ~line 4621 |
| callFoundryAI() | ~line 4623 |
| autoSelectProgram() | ~line 4727 |
| SetupPage (maybePromptCardio, cardio plan step) | ~line 4854 |
| PHASE_COLOR JS constant | ~line 3029 |
| QUOTES array (233 quotes) | ~line 3416 |
| haptic() + HAPTIC patterns | ~line 3228 |
| CardioIntervalTimer | ~line 7769 |
| CardioSessionView | ~line 8003 |
| ExtraDayView | ~line 8395 |
| DayView | ~line 8896 |
| exercises useState (MUST stay before prevWeekNotes useMemo) | ~line 9051 |
| prevWeekNotes useMemo | ~line 9071 |
| WorkoutCompleteModal (PR callout) | ~line 6200 |
| RPE_OPTS + CompleteDialog | ~line 6483 |
| ExerciseCard | ~line 7005 |
| WeekSection (skip toggle) | ~line 10890 |
| BwChart | ~line 9630 |
| HomeView (onOpenCardio wired, cardio card) | ~line 12442 |
| ExplorePage | ~line 11002 |
| NoMesoShell | ~line 14650 |
| App (view routing, foundry:openCardio listener) | ~line 15510 |
| ErrorBoundary | ~line 15727 |

---

## 8 · QA Tracker

### Resolved
| # | Issue |
|---|-------|
| 1–24 | See v1.19.0 synopsis |
| — | Typography sweep, PR Tracker, rest timer, Volume Check, Sets Logged chart — v1.19.0 |
| — | CardioBlock removed; full cardio system replaced with CardioSessionView + CardioIntervalTimer |
| — | ReadyDialog declaration mangled by str_replace → black screen — restored |

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| 17 | Verify past sessions open in editable DayView | Likely works — needs manual confirmation |
| 21 | Onboarding rewrite | Design approved, not yet built |
| — | Post-strength "Log Cardio →" timing | Fires onBack() + 80ms delay before custom event — test on device for jank |

---

## 9 · Product Roadmap (Priority Order)

1. **Onboarding rewrite (#21)** — Design fully approved. Highest-leverage item before acquisition push.
2. **End-of-mesocycle retention** — "Start your next meso" prompt when Week 8 completes. Churn prevention.
3. **Vite + Capacitor migration (v2.0)** — Unlocks Pro paywall, App Store, push notifications, Trainer tier.
4. **AI builder paywall** — Hard gate at path selection; PRO badge on AI card. Post-Vite. `ppl:pro` reserved.
5. **Trainer tier pilot** — Sydney's gym.
6. **Rest day Next Session detail as Pro gate**
7. **Sample program Pro upsell**
8. **In-app referral** — 30 days free for both parties.
9. **Progress photos** — Camera upload pinned to date.
10. **Recovery & Readiness section** — Sleep, stress, HRV. Bridge to Foundry Whole Health.
11. **Cardio plan as Pro gate** — HIIT guided protocols behind Pro; freeform logging stays free.
12. **Push notifications** — Requires Capacitor.
13. **"Foundry Whole Health"** — Revisit at ~$30K ARR.

---

## 10 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays (`EXERCISE_DB`, `QUOTES`, `SAMPLE_PROGRAMS`, `CARDIO_WORKOUTS`) must live in a plain `<script>` tag — never in the Babel block
- `const` redeclaration across script tags is a hard JS error that silently crashes the entire app
- `ProgramCard` and similar components must be proper top-level named function components
- Template-started programs bypass algorithmic generation via `templateDays` short-circuit
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent invariant
- `str_replace` edits that close a function block can eat the next function's declaration if the match spans the boundary — always verify function declarations after large insertions
- The real moat is coaching intelligence: stalling detection, phase-aware progression, RIR targets, coherent session flows

---

## 11 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Work section by section with clear status tracking after each item
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (`Foundry_1_20_0.html`)
- Outputs always copied to `/mnt/user-data/outputs/`
- Tyler = James's wife, works in business banking, active beta tester mid-mesocycle (she/her)
- James's daughter + her friend also beta testing — keep ungated until post-Vite
