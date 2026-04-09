# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.26.0 · March 2026**

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
- **Worker `/subscribe` endpoint** — app POSTs `{ email }` to `foundry-ai.timberandcode3.workers.dev/subscribe`; localStorage is the safety net fallback
- **Go Pro banner** on Home tab — "GET EARLY ACCESS" CTA opens pricing overlay
- **AI builder paywall** — designed, deferred post-Vite. `ppl:pro` reserved.
- **Free tier for Under 18 / 62+** — live callout on DOB screen during onboarding and SetupPage

### Next Revenue Steps
- **Mailchimp Worker swap** — replace Kit route in Worker with Mailchimp Members API; same app-side POST, no app changes needed. Requires: Mailchimp account + Audience List ID + API key stored as Wrangler secrets.
- **Pro paywall activation** — post-Vite/Capacitor migration

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~18,800 lines) |
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
- `ppl:` namespace is legacy — all new keys use `foundry:`
- `repsSuggested: true` flag on carried sets — must be checked anywhere "has reps = worked" logic exists
- Deload week = always `MESO.weeks - 1` (last index) — use `WEEK_PHASE[w] === "Deload"` to detect
- Component-scoped month arrays (e.g. `SETUP_MONTHS`) must be declared inside the component, not in the plain script block
- **`icons` is module-scope** — defined once before `ProfileDrawer`/`HomeView`, visible to all components including `ProgressPage`

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase auth + PostgreSQL + RLS.

---

## 4 · What Was Built (v1.24–v1.26.0)

### v1.24–v1.25 (prior session, reconstructed from file)
- **BW-aware fat loss stall detection** — `detectStallingLifts` accepts `profile` arg; if `profile.goal === "lose_fat"`, reads `ppl:bwlog` and checks if BW is trending down over the same 3-week window. BW trending down → `isProtecting: true` stall (positive coaching message instead of warning). BW flat/rising on a cut → normal stall card fires.
- **Worker `/subscribe` endpoint wired** — app POSTs `{ email }` to the Cloudflare Worker at submit; localStorage write kept as fallback. Worker-side Kit/Mailchimp implementation TBD (Mailchimp swap is next).

### v1.26.0 (this session)

#### Person Icon / Profile Drawer (bug fix + feature)
- **Root bug fixed**: `onProfileTap` in App-level `FoundryBanner` called `goTo("profile")` which only existed inside `HomeView`'s closure — silent no-op on every tap. Fixed by wiring to `setShowProfileDrawer(true)` in App scope.
- **Person icon gated by view**: icon shown only when `view === "home"` (tabs). Workout, cardio, mobility, extra views show the plain banner — no icon.
- **`ProfileDrawer` component** — slides in from right (82% width, `slideInRight` animation), backdrop tap or × closes it. Contains:
  - Profile fields: name, DOB dropdowns (Month/Day/Year), body weight, gender
  - Save writes to `ppl:profile` and updates App-level `profile` state immediately
  - `ThemeToggleCard wide` below a divider — Dark / Light pills, applies instantly via `data-theme` attribute + `ppl:theme` localStorage

#### Dead code removed
- `ProfilePage` full-screen component (~130 lines) — replaced by drawer
- `{tab === "profile" && <ProfilePage />}` render in HomeView
- `needsBackupNudge()` function — defined but never called anywhere

#### `icons` hoisted to module scope (bug fix)
- `icons` was trapped inside `HomeView`'s closure, causing `ReferenceError: icons is not defined` whenever `ProgressPage` rendered (Progress tab crash). Hoisted to module scope before `ProfileDrawer` — now visible to all components.

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON (includes `dob: { month, day, year }`, `birthdate`, `age`) |
| ppl:done:d{d}:w{w} | Session completion flag |
| ppl:completedDate:d{d}:w{w} | ISO date of completion |
| ppl:day{d}:week{w} | Set/rep data (includes `repsSuggested` flag) |
| ppl:currentWeek | Stored week index |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:notes/exnotes:d{d}:w{w} | Session + exercise notes |
| ppl:bwlog | Bodyweight log [{date, weight}] — used by fat loss stall detection |
| ppl:theme | Theme preference: `"dark"` or `"light"` |
| ppl:onboarded / ppl:show_tour / ppl:toured | Onboarding + tour flags |
| ppl:onboarding_data | { name, dob: { month, day, year }, age } |
| ppl:onboarding_goal | Goal ID string |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| foundry:pro_email | Pro email capture from pricing page |

---

## 6 · Key Code Locations (v1.26.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~328 |
| slideInRight keyframe | ~195 |
| icons (module-scope) | ~13129 |
| ProfileDrawer component | ~13183 |
| HomeView function start | ~13344 |
| GOAL_OPTIONS | ~2885 |
| callFoundryAI (with goal guidance) | ~5023 |
| generateWarmupSteps | ~3925 |
| ageFromDob helper | ~3720 |
| loadDayWeekWithCarryover (rep ladder) | ~3090 |
| detectSessionPRs | ~3268 |
| detectStallingLifts (BW-aware) | ~3371 |
| loadBwLog / saveBwLog | ~3791 |
| ProgressPage | ~12886 |
| ThemeToggleCard | ~13060 |
| WeeklySummary (1RM in PR rows) | ~15400 |
| PricingPage (+ founder story) | ~13970 |
| App — showProfileDrawer state | ~17916 |
| App — FoundryBanner (view-gated icon) | ~18312 |
| App — ProfileDrawer render | ~18316 |
| OnboardingFlow | ~17400 |

---

## 7 · QA Notes

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |
| — | Mailchimp Worker swap | App-side POST ready; Worker route needs Mailchimp implementation |

### Fixed This Session
| # | Fix |
|---|-----|
| ✓ | Person icon tap — was calling `goTo("profile")` in wrong scope, silent no-op |
| ✓ | Progress tab crash — `icons` was HomeView-scoped, invisible to ProgressPage |

---

## 8 · Next Session Priorities

1. **Mailchimp Worker swap**
   - Worker `/subscribe` route: POST to Mailchimp Members API `https://{dc}.api.mailchimp.com/3.0/lists/{list_id}/members`
   - Auth: HTTP Basic `anystring:{api_key}`, datacenter from key suffix
   - Body: `{ email_address, status: "subscribed" }`
   - Already-subscribed (400) → treat as success (silent swallow)
   - Secrets needed: `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC`
   - Deliver as standalone `worker.js` for Wrangler deploy

2. **Mobility light-touch nudges** (design confirmed, awaiting session)
   - **A — Warmup CTA on RIR overlay**: muted dismissible row at bottom of RIR card. `useState` only, no storage.
   - **B — Cooldown nudge after Finish Session**: brief full-screen beat card with tag-specific stretch suggestion (Push → chest/shoulder, Pull → lats/biceps, Legs → hip flexors/quads). One "Done" button, proceeds normally. Strength days only TBD.
   - **C — Day tag → suggested focus**: 2–3 plain-text mobility suggestions per tag, borrowed from rest day MOBILITY map. No timer, no protocols.

### Revenue Milestone (v2.0)
- Vite + Capacitor migration — App Store, Pro paywall, push notifications
- Supabase data layer — auth + PostgreSQL + RLS
- ppl: → foundry: full migration
- AI builder paywall — hard gate post-Vite
- Trainer tier pilot — Sydney's gym
- In-app referral — 30 days free both parties
- Meso 2+ AI builder reads meso 1 data — the compounding intelligence moat

### Coaching Intelligence (The Moat)
- DONE: Rep ladder, last session context, cross-meso note, stalling detection, 1RM estimates, goal-aware AI programming, BW-aware fat loss stall detection
- TODO: Mobility warmup/cooldown nudges, onboarding rewrite, body map, recovery & readiness section

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
- `repsSuggested: true` flag — check anywhere "has reps = worked" logic exists
- Deload week = always `MESO.weeks - 1` — use `WEEK_PHASE[w] === "Deload"` to detect
- Component-scoped month arrays must live inside the component, never in the plain script block
- **`icons` must remain at module scope** — never re-scope to a single component

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_26_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester (she/her)
- James's daughter + her friend also beta testing — ungated until post-Vite
- Sydney (works at a gym) = Trainer tier pilot target
- New storage keys use `foundry:` namespace, not `ppl:`
