# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.21.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

---

## 2 · Pricing Model & Path to $100K

| Tier | Price | Status |
|------|-------|--------|
| **Free** | $0 — permanently free: Under 18 · Adults 62+ | Live |
| **Pro** | $12/mo · $99/yr | Email capture live · paywall post-Vite |
| **Trainer** | $29/mo · $249/yr | Coming soon · Sydney's gym pilot |

### The Math to $100K
- 700 active Pro subscribers at $12/mo = $100,800 ARR
- Or: 850 annual at $99 + ~200 monthly = $102,550
- Tyler (James's wife, business banking) + James: active beta testers, Week 4 of 8
- Tyler's business banking network = primary warm acquisition channel
- James's daughter + friend = also beta testing
- Sydney (works at a gym) = Trainer tier pilot target

### Revenue Infrastructure Built
- **Pricing page** live inside app — 3 tiers, marketing copy, email capture
- **`foundry:pro_email`** — email stored to localStorage on submit (new `foundry:` namespace)
- **Go Pro banner** on Home tab — "GET EARLY ACCESS" CTA opens pricing overlay
- **AI builder paywall** — designed, deferred post-Vite. `ppl:pro` reserved.
- **Free tier for Under 18 / 62+** — long-term acquisition funnel

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~17,310 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward (e.g. `foundry:pro_email`) |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| AI Key | Stored as Cloudflare Worker secret — never in source |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |
| Versioning | Semantic: Major = architecture rebuild, Minor = features, Patch = fixes |

### Namespace Migration Plan
`ppl:` stays until v2.0. New features use `foundry:`. Full migration at Vite + Capacitor with Supabase data layer. One-time migration script copies all `ppl:` keys to `foundry:` and removes old ones.

### Critical Invariants
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- Brace balance check mandatory before every ship (depth must be 0)
- `activeWeek` (computed from completedDays) ≠ `currentWeek` (stored) — always use `activeWeek` for display
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead of the calendar
- Today-done detection uses `ppl:completedDate` — not findIndex of first incomplete
- Timer state lives in App, not DayView
- Pure-data arrays must live in plain script tag, never Babel block

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall activation, App Store, push notifications, Trainer tier. Post-migration data layer: Supabase (auth + PostgreSQL + RLS). Sprint plan: 1=Vite, 2=Supabase auth, 3=data migration dual-write, 4=localStorage removed.

---

## 4 · What Was Built Today (v1.21.0 — Session 2)

### Calendar Week Fix (Major)
Root cause: `activeWeek` was purely completion-based — finishing Week 3 on Friday immediately jumped the app to Week 4, even though the calendar said it was still Week 3.

- Added `calendarWeek` useMemo — derives current week from `startDate + workoutDays + today`, same sessionDateMap logic as Schedule tab
- Added `displayWeek = Math.min(activeWeek, calendarWeek)` — display never jumps ahead of the calendar
- `phase`, `pc`, `rir`, `weekDone`, `weekPct`, `weekMuscles` all switched to `displayWeek`
- Phase card pills use `displayWeek`
- `ProgressPage` receives `displayWeek` (was `activeWeek`) — volume tracker now shows correct week's data
- WK label in phase card: `WK {displayWeek+1}/{MESO.weeks}`

### Today Card — Calendar-Aware Detection (Major)
Replaced the old `isTodayLiftingDay` + `findIndex` logic with sessionDateMap-based detection:
- Builds `sessionDateMap` ("YYYY-MM-DD" → "dayIdx:weekIdx") from startDate
- `calendarEntry` = what the calendar says about today specifically
- `calendarSessionDone` = whether today's scheduled session is completed
- `displayWeekAllDone` = all sessions in displayWeek done (between-weeks rest state)
- `isRestState` fires when: not a calendar workout day, OR session done, OR week done
- Result: rest card shows correctly on rest days AND on days between weeks

### Rest Card Improvements
- "TODAY · DONE" header restored to `var(--phase-accum)` green — correct phase completion color
- "REST DAY" header also uses `var(--phase-accum)` green
- Duplicate START ▶ button removed from recovery card cardio row — replaced with "below ↓" label
- HIIT Pyramid label text changed to `var(--text-secondary)` muted gray

### Label Fix
"Day 1 · Week 4" → **"Week 4 · Day 1"** — week first, day second

### Accent Color Unification
All accent text now matches nav icon blue (`#5ba8ff` dark / `#2b7fd4` light):
- `--accent` and `--accent-blue` updated in both dark and light theme
- `--accent-rgb` updated to `91,168,255` dark / `43,127,212` light
- `--selected-bg` and `--selected-border` updated to match
- Title left border updated from hardcoded `#2f4f6f` to `var(--accent)`
- `--btn-primary-bg` kept at `#2f4f6f` — buttons stay dark for contrast

### Tag Abbreviation Map
Replaced `tag.slice(0,2)` with explicit map: `PUSH→PU · PULL→PL · LEGS→LE · UPPER→UP · LOWER→LO · FULL→FB`

### MESO SETS Label Fix
`tag.slice(0,2)` was showing "PU" for both PUSH and PULL. Fixed with explicit abbreviation object.

### Progress Tab Cleanup
- PR Tracker defaults to anchor lifts only (`anchorsOnly: true`)
- List rows stripped to: name + best weight×reps + trend arrow. Tag pill and "Peak Wk" removed from row (live in detail sheet)
- "Show all (N)" toggle in header to see all exercises
- Meso sets by muscle: compact inline row inside This Week card (`MESO SETS: 45 PU · 38 PL · 52 LE`)
- Separate `MesoMuscleCard` component removed from render

### Pricing Page (Live)
- Full-screen overlay, accessible from "The Foundry Pro" banner on Home tab
- **Free tier**: $0, 8 features, dimmed checks (de-emphasized vs Pro)
- **Pro tier**: $12/mo · $99/yr, 6 features, gold checks, email capture CTA
- **Trainer tier**: $29/mo, coming soon badge, 60% opacity
- Email stored to `foundry:pro_email` in localStorage
- Home banner badge changed from "COMING SOON" → "GET EARLY ACCESS"
- "Everything in Free" removed from Pro feature list

### Explore Tab
- Exercise Library subtitle: "How To's & Supporting Videos"
- All three cards: Lucide SVG icons (grid-3x3 · layers · lightbulb)

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON |
| ppl:done:d{d}:w{w} | Session completion flag |
| ppl:completedDate:d{d}:w{w} | ISO date of completion — today-done detection |
| ppl:day{d}:week{w} | Set/rep data |
| ppl:currentWeek | Stored week index (use displayWeek for display) |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:notes/exnotes:d{d}:w{w} | Session + exercise notes |
| ppl:onboarded / ppl:show_tour / ppl:toured | Onboarding + tour flags |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| **foundry:pro_email** | **NEW — Pro email capture from pricing page** |

---

## 6 · Key Code Locations (v1.21.0)

| Item | Approx Line |
|------|------------|
| RECOVERY_TIPS array | ~2745 |
| markComplete (writes completedDate) | ~3432 |
| resetMeso (clears completedDate) | ~3485 |
| PHASE_COLOR / TAG_ACCENT | ~3834 |
| PricingPage component | ~12827 |
| SwapModal (equipment-aware) | ~7242 |
| WorkoutCompleteModal (2-card + anchor comparison) | ~6829 |
| DayView | ~9140 |
| exercises useState (MUST stay before prevWeekNotes) | ~9180 |
| HomeView — calendarWeek / displayWeek useMemos | ~12891 |
| HomeView — Today card (sessionDateMap logic) | ~13226 |
| Go Pro banner | ~13836 |
| Pricing overlay render | ~13947 |
| ExplorePage (filter panel, Lucide icons) | ~11979 |
| PRTracker (anchors default) | ~15323 |
| App timer state | ~15929 |
| App handleComplete (meso retrospective) | ~16314 |
| App weekCompleteModal (retrospective render) | ~16471 |

---

## 7 · QA Notes

### Resolved This Session
- Volume tracker empty after week complete — fixed (displayWeek passed to ProgressPage)
- App jumping to Week 4 before calendar reaches it — fixed (calendarWeek + displayWeek)
- Rest card not firing between weeks — fixed (sessionDateMap detection)
- MESO SETS showing PU · PU · LE — fixed (explicit abbrev map)
- FU abbreviation for Full Body — fixed (FB)
- "TODAY · DONE" showing blue instead of green — restored to phase-accum
- Duplicate START button in recovery card — removed
- "Everything in Free" in Pro tier — removed

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |
| — | goalNote passthrough | Not yet passed to callFoundryAI |

---

## 8 · Full Product Roadmap

### Now — In Progress
- ✅ Pricing page with email capture

### Soon — Before External Sharing
- Email capture prompt (weekly training summary CTA)
- SYNOPSIS + session-starter prompt updated

### Revenue Milestone (v2.0)
- **Vite + Capacitor migration** — App Store, Pro paywall, push notifications
- **Supabase data layer** — auth + PostgreSQL + RLS (replaces localStorage)
- **`ppl:` → `foundry:` full migration** — one-time script at v2.0
- **AI builder paywall** — hard gate post-Vite
- **Trainer tier pilot** — Sydney's gym
- **In-app referral** — 30 days free both parties

### Coaching Intelligence (The Moat)
- Smart rep progression — phase-aware reps for isolation/BW
- Stalling detection + coaching nudges
- Warm-up timer — guided ramp sets
- Body map — anatomical muscle volume visualizer (SVG built, needs EXERCISE_DB muscle mapping)
- EXERCISE_DB muscle mapping — `muscles:[]` on all 200+ exercises

### Later
- Progress photos
- Push notifications (requires Capacitor)
- Cardio plan as Pro gate
- Foundry Whole Health (revisit at ~$30K ARR)

---

## 9 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays must live in plain script tag — never Babel block
- `const` redeclaration across script tags crashes app silently
- React hooks cannot be called inside an IIFE in JSX
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- **Brace balance check mandatory before every ship** — depth must be 0
- `activeWeek` (computed) ≠ `currentWeek` (stored) — always use activeWeek/displayWeek for display
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead of calendar
- Today-done detection requires `ppl:completedDate` — not findIndex of first incomplete
- Global state surviving tab navigation must live in App — timer is the canonical example
- str_replace including closing braces can silently delete following elements — verify context
- `ppl:` namespace is legacy — all new keys use `foundry:` going forward

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_21_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester Week 4/8 (she/her)
- James's daughter + her friend also beta testing — ungated until post-Vite
- Sydney (works at a gym) = Trainer tier pilot target
- New storage keys use `foundry:` namespace, not `ppl:`
