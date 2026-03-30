# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.28.0 · March 2026**

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
- Tyler (James's wife, business banking) + James: active beta testers
- Tyler's business banking network = primary warm acquisition channel
- James's daughter + friend = also beta testing
- Sydney (works at a gym) = Trainer tier pilot target

### Revenue Infrastructure Built
- **Pricing page** live inside app — 3 tiers, marketing copy, email capture
- **"Built by" founder story** — live on pricing page
- **`foundry:pro_email`** — email stored to localStorage on submit
- **Go Pro banner** on Home tab — "GET EARLY ACCESS" CTA opens pricing overlay
- **AI builder paywall** — designed, deferred post-Vite. `ppl:pro` reserved.
- **Free tier for Under 18 / 62+** — live callout on DOB screen

### Next Revenue Step
- **Mailchimp Worker** — Cloudflare Worker `/subscribe` endpoint proxying Mailchimp API
  - Waiting on: Audience List ID + datacenter suffix from James
  - Same Wrangler secret pattern as Anthropic key

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~18,900 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| AI Key | Stored as Cloudflare Worker secret — never in source |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |
| Versioning | Semantic: Major = architecture rebuild, Minor = features, Patch = fixes |

### Critical Invariants
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- `stallingData` useMemo declared after `prevWeekNotes` — ordering: exercises → prevWeekNotes → stallingData
- Brace balance check mandatory before every ship (depth must be 0)
- **Plain script block must also parse cleanly** — `new Function(block)` check before ship
- `activeWeek` (computed) != `currentWeek` (stored) — always use activeWeek/displayWeek for display
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead of calendar
- Today-done detection requires `ppl:completedDate` — not findIndex of first incomplete
- Global state surviving tab navigation must live in App
- **str_replace on EXERCISE_DB: always include `description:` key in both old/new strings**
- Pure-data arrays must live in plain script tag — never Babel block
- `ppl:` namespace is legacy — all new keys use `foundry:` going forward
- `repsSuggested: true` flag on carried sets — must be checked anywhere "has reps = worked" logic exists
- Deload week = always `MESO.weeks - 1` (last index) — use `WEEK_PHASE[w] === "Deload"` to detect
- Component-scoped month arrays must be declared inside the component, not in the plain script block
- **Variables defined inside IIFEs (isToday, showDay, showDayAccent) are not accessible outside** — use refs set inside the IIFE and read outside: `isTodayRef`, `showDayRef`, `showDayAccentRef`

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier.

---

## 4 · What Was Built (v1.27.0 → v1.28.0)

### v1.27.0 — Three Bug Fixes

**Fix 1a — Exercise history showing current week** (`loadExerciseHistory`)
- Added `if (store.get(`ppl:done:d${dayIdx}:w${w}`) !== "1") continue;` at top of loop
- History panel now only shows completed weeks; in-progress week carryover data never appears

**Fix 1b — False stall card at session start** (`handleSetCheckmark`)
- When user confirms a set, now also writes `repsSuggested: false` alongside `confirmed: true`
- Carryover sets had `repsSuggested: true` surviving after confirmation — causing stall detection to see an empty window and misfire
- `detectStallingLifts` now correctly counts confirmed sets as real data

**Fix 2 — Completed session re-entering workout start flow** (`showMesoOverlay` initializer)
- Changed `useState(() => !isDone && !isLocked)` to read `ppl:done:d${dayIdx}:w${weekIdx}` directly from localStorage
- Prop staleness between `handleComplete` and DayView mount caused overlay to initialize open even for done sessions

### v1.28.0 — Home Tab Recovery + Mobility System

**Recovery card — full overhaul (all 3 rest/done paths)**

Path 1 — **Week Complete** (all sessions done, no next day): upgraded from tiny trophy banner to full card:
- 🏆 WEEK COMPLETE header
- ACTIVE RECOVERY: Sauna/Steam · Easy Cardio · Cold Finish (with coaching copy)
- MORNING MOBILITY · 3 MOVES (collapsible, collapsed by default)
- [LAST SESSION TAG] MOBILITY · 3 MOVES (collapsible, only if tag resolves from last session of week)

Path 2 — **Rest Day**: upgraded from bare "Rest Day" label to full recovery card:
- REST DAY header
- RECOVERY ESSENTIALS: 😴 Sleep · 🥩 Protein · 🚶 Walk (always visible)
- MORNING MOBILITY · 3 MOVES (collapsible, collapsed by default)
- [MOST RECENT SESSION TAG] MOBILITY · 3 MOVES (collapsible, tag resolved by scanning back through completed sessions regardless of gap)
- NEXT SESSION card below (separate, collapsible)

Path 3 — **Session Done Today**: same full card as Path 2 but with green ✓ "TODAY · DONE" header + session label

**Pre-workout mobility card — "BEFORE YOU TRAIN"** (active workout days only)
- Appears between cardio card and next section — order: Today Session → Cardio → Before You Train
- MORNING MOBILITY · 3 MOVES: Cat-Cow, World's Greatest Stretch, 90/90 Hip Switch
- Open by default (collapsed by tapping header); chevron indicates state
- Session tag pill (e.g. "UPPER") shown in header for context
- Tag-specific post-workout stretches removed from this card (they belong on the recovery card, not pre-workout)
- Uses `isTodayRef`, `showDayRef`, `showDayAccentRef` — refs set inside today-card IIFE, read outside

**Mobility data**
- `HOME_MOBILITY` object: PUSH / PULL / LEGS — 3 moves each (post-workout static holds)
- `MORNING_MOBILITY` array: 3 dynamic moves used every day (Cat-Cow, World's Greatest, 90/90)
- Pre-workout card has UPPER and LOWER sets added (previously only PUSH/PULL/LEGS existed)
- Tag mobility correctly identified as post-workout (static stretching); never shown pre-session

**HomeView state added**
- `showMorningMobility` — `true` by default (before-you-train card open)
- `showRecoveryMorning` — `false` by default (recovery card morning mobility collapsed)
- `showRecoveryTag` — `false` by default (recovery card tag mobility collapsed)
- `isTodayRef`, `showDayRef`, `showDayAccentRef` — refs bridging IIFE scope to outside

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON (includes `dob: { month, day, year }`) |
| ppl:done:d{d}:w{w} | Session completion flag |
| ppl:completedDate:d{d}:w{w} | ISO date of completion |
| ppl:day{d}:week{w} | Set/rep data (includes `repsSuggested` flag) |
| ppl:currentWeek | Stored week index |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:notes/exnotes:d{d}:w{w} | Session + exercise notes |
| ppl:bwlog | Bodyweight log [{date, weight}] |
| ppl:onboarded / ppl:show_tour / ppl:toured | Onboarding + tour flags |
| ppl:onboarding_data | { name, dob: { month, day, year }, age } |
| ppl:onboarding_goal | Goal ID string |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| foundry:pro_email | Pro email capture from pricing page |

---

## 6 · Key Code Locations (v1.28.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~328 |
| loadExerciseHistory (done-check fix) | ~3558 |
| detectStallingLifts (BW-aware) | ~3681 |
| handleSetCheckmark (repsSuggested fix) | ~8205 |
| ExerciseCard component | ~8107 |
| DayView — showMesoOverlay (freshDone fix) | ~10357 |
| DayView — exercises useState | ~10430 |
| DayView — stallingData useMemo | ~10465 |
| HomeView — showNextSession + mobility states | ~14459 |
| HomeView — isTodayRef + showDayRef refs | ~14463 |
| HomeView — recovery card (all 3 paths) | ~14910 |
| HomeView — today card IIFE (ref assignments) | ~15091 |
| HomeView — CARDIO CARD | ~15195 |
| HomeView — PRE-WORKOUT MOBILITY CARD | ~15270 |
| WeeklySummary (1RM in PR rows) | ~15700 |
| PricingPage | ~13350 |
| OnboardingFlow | ~16700 |

---

## 7 · QA Notes

### Verified Fixed (v1.27.0–v1.28.0)
| # | Issue | Fix |
|---|-------|-----|
| ✓ | Exercise history showing current week in-progress data | Done-check in loadExerciseHistory |
| ✓ | False stall card at session start | repsSuggested cleared on set confirm |
| ✓ | Completed session re-enters workout start flow | freshDone localStorage read in showMesoOverlay |
| ✓ | isToday/showDay/showDayAccent not defined outside IIFE | Refs bridging scope |

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Mailchimp Worker integration | Waiting on Audience List ID + datacenter suffix |
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |

---

## 8 · Next Session Priorities

1. **Mailchimp Worker** — Cloudflare Worker `/subscribe` + Wrangler secret + app-side POST
   - Need: Mailchimp account confirmed, Audience List ID, datacenter suffix (e.g. `us21`)
   - Same pattern as Anthropic Worker

2. **Mobility nudges — warmup CTA on RIR overlay** (partially discussed, deferred)
   - Warmup CTA on RIR overlay before session starts
   - Cooldown beat after Finish Session (all strength days)
   - Day-tag suggestions

3. **Onboarding rewrite** — next major feature candidate

### Revenue Milestone (v2.0)
- Vite + Capacitor migration — App Store, Pro paywall, push notifications
- Supabase data layer — auth + PostgreSQL + RLS
- ppl: → foundry: full migration
- AI builder paywall — hard gate post-Vite
- Trainer tier pilot — Sydney's gym
- In-app referral — 30 days free both parties
- Meso 2+ AI builder reads meso 1 data — the compounding intelligence moat

### Coaching Intelligence (The Moat)
- DONE: Rep ladder, last session context, cross-meso note, stalling detection, 1RM estimates, goal-aware AI programming, fat loss BW-aware stall card, home tab recovery card + mobility system
- TODO: Warmup CTA on RIR overlay, cooldown nudge post-session, body map, recovery & readiness section

---

## 9 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays must live in plain script tag — never Babel block
- **Plain script block must parse as valid JS** — `new Function(block)` check before ship
- **str_replace on EXERCISE_DB: always include `description:` key** in both strings
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- `stallingData` useMemo always declared after `prevWeekNotes` — never before
- Brace balance check mandatory before every ship — depth must be 0
- `activeWeek` (computed) != `currentWeek` (stored) — always use displayWeek
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead
- Today-done detection requires `ppl:completedDate`
- Global state surviving tab nav must live in App
- `ppl:` namespace is legacy — new keys use `foundry:`
- `repsSuggested: true` flag — check anywhere "has reps = worked" logic exists; clear on set confirm
- Deload week = always `MESO.weeks - 1` — use `WEEK_PHASE[w] === "Deload"` to detect
- Component-scoped arrays must live inside the component, never in the plain script block
- **IIFE scope isolation**: variables defined inside `{(() => { ... })()}` blocks (isToday, showDay, showDayAccent) are not visible outside. Bridge with refs set inside, read outside.
- `useState` cannot be called inside IIFEs — state for IIFE-rendered content must live at component level

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_28_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester (she/her)
- James's daughter + her friend also beta testing — ungated until post-Vite
- Sydney (works at a gym) = Trainer tier pilot target
- New storage keys use `foundry:` namespace, not `ppl:`
