# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.30.0 · March 2026**

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

### Key People
- **Tyler** (James's wife, she/her) — works in business banking; primary warm acquisition channel; active beta tester
- **James's daughter + friend** — active beta testers
- **Sydney** — works at a gym; Trainer tier pilot target

### Revenue Infrastructure (all live)
- Pricing page — 3 tiers, marketing copy, email capture
- `foundry:pro_email` — email stored to localStorage on submit
- **Brevo email integration** — fully live; Worker `/subscribe` → Brevo API → "Foundry Early Access" list (ID: 2)
- Go Pro banner — home tab "GET EARLY ACCESS" CTA
- AI builder paywall — designed, deferred post-Vite; `ppl:pro` reserved
- **Pricing page Pro callout** — "MESO 2+ INTELLIGENCE" block: explains meso 2 is built from meso 1 performance data. Copy closer: "The AI knows what you lifted."

### Brevo / Worker Infrastructure
- Worker folder: `~/foundry-worker/` — entry file `worker.js`, config `wrangler.toml`
- Worker name: `foundry-ai` — always deploy with `--config wrangler.toml`
- **CRITICAL**: `~/wrangler.jsonc` exists in home dir and overrides project config — ALWAYS use `--config wrangler.toml`
- Deploy: `cd ~/foundry-worker && npx wrangler deploy --config wrangler.toml`
- Worker URL: `https://foundry-ai.timberandcode3.workers.dev`
- Secrets: `ANTHROPIC_API_KEY`, `BREVO_API_KEY`
- `BREVO_LIST_ID = 2` hardcoded in worker.js
- **Security gap**: Worker endpoint unauthenticated — must add auth before App Store launch — **first priority tomorrow**

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~19,272 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |

### Critical Invariants
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- `stallingData` useMemo always after `prevWeekNotes` — never before
- Brace balance check mandatory before every ship — depth must be 0
- Plain script block must parse cleanly — `new Function(block)` check before ship
- str_replace on EXERCISE_DB: always include `description:` key in both strings
- `activeWeek` (computed) != `currentWeek` (stored) — always use displayWeek
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead
- Today-done detection requires `ppl:completedDate`
- Global state surviving tab nav must live in App
- Pure-data arrays must live in plain script tag — never Babel block
- `ppl:` namespace is legacy — all new keys use `foundry:`
- `repsSuggested: true` flag — clear on set confirm
- Deload week = always `MESO.weeks - 1` — use `WEEK_PHASE[w] === "Deload"`
- **IIFE scope isolation**: variables inside IIFEs not visible outside — bridge with refs
- `useState` cannot be called inside IIFEs — state must live at component level
- **Large block replacement**: use Node script, not str_replace — more reliable on complex JSX
- **Meso weeks**: `MESO.weeks = mesoLength + 1` — working weeks + 1 deload always appended
- **`weekDay` in DayView**: always use `weekDay` (week-adjusted sets) not raw `day` for init
- **`FOUNDRY_MOBILITY` is the single source**: never define mobility data inline
- **`MORNING_MOBILITY` is the single source**: no inline `MORNING_MOVES` arrays anywhere

### Known Technical Debt
- **`ppl:` vs `foundry:` namespace split** — no migration path yet; keep running key list for Supabase mapping
- **Worker endpoint unauthenticated** — open to abuse at App Store scale — tomorrow

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase + PostgreSQL + RLS + full namespace migration.

---

## 4 · What Was Built (v1.29.0 → v1.30.0)

### SetupPage Goal Field — Read-Only
- Checks `store.get("ppl:onboarding_goal")` at render time
- If present + valid `GOAL_OPTIONS` id → locked pill, "set during onboarding" (same style as experience field)
- If absent → interactive buttons unchanged
- `goalNote` textarea always visible

### Mobility Data Consolidation (complete)
- All inline definitions removed: `HOME_MOBILITY`, `MOBILITY`, `MORNING_MOVES`
- **`FOUNDRY_MOBILITY`** at module scope — tag-based cooldown/recovery moves
- **`MORNING_MOBILITY`** at module scope — morning mobility moves
- **`getMobilityMoves(tag)`** — resolves `PUSH/PULL/LEGS/UPPER/LOWER/FULL`; unknown → one from each
- All 6 call sites updated: HomeView recovery card, HomeView week-complete card, calendar rest-day sheet, DayView warmup accordion, WorkoutCompleteModal cooldown accordion, BEFORE YOU TRAIN card

### Warmup Accordion — DayView RIR Overlay
- Between phase focus card and Begin Workout button
- Expanded on first session of meso (`weekIdx === 0 && dayIdx === 0`), collapsed after
- `warmupOpen` useState, chevron, `e.stopPropagation()`

### Cooldown Accordion — WorkoutCompleteModal
- Above NEXT SESSION → button; `dayTag` prop on both call sites
- Expanded on week 0, collapsed after

### ExploreView Feature Cards
- Removed dead icon container div
- Added `borderLeft: "3px solid var(--accent)"` to each card
- All 5 consistent

### Pricing Page — MESO 2+ INTELLIGENCE Callout
- Inside Pro tier card, above email CTA
- Gold left border, explains readiness-aware meso 2 seeding

### Recovery & Readiness Check-In
- Daily card on home tab between dashboard row and today-card
- **3 signals**: Sleep (Poor/OK/Good), Soreness (High/Moderate/Low), Energy (Low/Moderate/High)
- **Score 0–6**: READY (5–6, accent), MODERATE (3–4, amber), LOW (0–2, red)
- Auto-collapses when all 3 filled — score badge + advice line in header; advice line below header when collapsed
- Tap header to re-open and change answers
- **Storage**: `foundry:readiness:YYYY-MM-DD` → `{ sleep, soreness, energy }` — self-expiring
- **Module-scope helpers**: `getReadinessScore(r)` → 0–6 | null; `getReadinessLabel(score)` → `{ label, color, advice, banner }`

### Readiness Banner — RIR Overlay
- Fires only on score 0–2 (LOW)
- Amber-red one-liner above warmup accordion: "Low readiness today — consider 10–15% load reduction."
- Dismissible ✕ via `readinessBannerDismissed` useState in DayView
- Reads `foundry:readiness:YYYY-MM-DD` fresh at render — no prop drilling

### Readiness → Meso Transition Seeding
- `archiveCurrentMeso` scans all `foundry:readiness:` keys from `profile.startDate` → today
- Computes `{ avgScore, lowDays, totalLogged, totalDays }` → stored in `foundry:meso_transition.readinessSummary`
- Only appended if `totalLogged >= 5`
- `callFoundryAI` appends recovery profile block to prompt:
  - avgScore ≤ 2.5 → conservative weeks 1–2, higher RIR, no front-loaded intensity
  - avgScore 2.5–3.5 → standard ramp, watch peak weeks
  - avgScore > 3.5 → standard or aggressive ramp
- Silent fallback — if no readiness data, block omitted

---

## 5 · Storage Keys

| Key | Value |
|-----|-------|
| ppl:profile | Full profile JSON |
| ppl:meso | Meso config JSON |
| ppl:done:d{d}:w{w} | "1" when session complete |
| ppl:completedDate:d{d}:w{w} | ISO date of completion |
| ppl:day{d}:week{w} | Set/rep data |
| ppl:currentWeek | Stored week index |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:mobility:session:YYYY-MM-DD | Standalone mobility session |
| ppl:notes:d{d}:w{w} | Session note |
| ppl:exnotes:d{d}:w{w} | Per-exercise notes JSON |
| ppl:bwlog | Bodyweight log — newest first |
| ppl:bwPromptSunday | Sunday date for BW prompt dedup |
| ppl:onboarded | "1" when onboarding complete |
| ppl:onboarding_data | { name, dob, age, experience } |
| ppl:onboarding_goal | Goal ID string |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| foundry:pro_email | Pro email capture |
| foundry:meso_transition | Meso transition context incl. readinessSummary — cleared after use |
| **foundry:readiness:YYYY-MM-DD** | `{ sleep, soreness, energy }` — daily readiness check-in |

---

## 6 · Key Code Locations (v1.30.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~321 |
| loadDayWeekWithCarryover | ~3391 |
| getWeekSets (MEV→MAV→MRV) | ~3797 |
| archiveCurrentMeso (**readiness scan**) | ~3981 |
| buildMesoConfig | ~4130 |
| VOLUME_LANDMARKS | ~4373 |
| FOUNDRY_MOBILITY (module scope) | ~4389 |
| MORNING_MOBILITY (module scope) | ~4410 |
| getMobilityMoves (module scope) | ~4418 |
| **getReadinessScore** (module scope) | ~4430 |
| **getReadinessLabel** (module scope) | ~4438 |
| callFoundryAI (**readiness prompt block**) | ~5480 |
| autoSelectProgram | ~5700 |
| SetupPage (goal read-only) | ~5740 |
| WorkoutCompleteModal (cooldown accordion) | ~7560 |
| DayView (warmup + **readiness banner**) | ~10440 |
| ProgressView | ~12110 |
| ExploreView (accent-border feature cards) | ~13840 |
| PricingPage (**MESO 2+ callout**) | ~14490 |
| HomeView (**readiness card**) | ~14800 |
| OnboardingFlow | ~17760 |
| App root | ~18330 |

---

## 7 · Next Session Priorities

1. **Worker authentication** — shared secret header before App Store; open endpoint is a live abuse vector. Deferred two sessions. Do this first.
2. **Stalling + readiness correlation** — if stalling on a lift AND avg readiness low last 7 days → coaching card: "this may be fatigue, not a true plateau"
3. **Vite + Capacitor migration (v2.0)**

### Coaching Intelligence (The Moat)
- **DONE**: Rep ladder, last session context, cross-meso note, stalling detection, 1RM estimates, goal-aware AI, fat loss BW-aware stall card, recovery + mobility system, experience-differentiated programming, MEV→MAV→MRV progression, experience-aware weight increments, per-muscle volume landmarks, deload weight targets, post-deload meso transition with AI seeding, warmup/cooldown nudges, Recovery & Readiness daily check-in, readiness → RIR overlay banner, readiness → meso 2 AI recovery profile
- **TODO**: Stalling + readiness correlation card, body map, Worker auth

---

## 8 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays in plain script tag — never Babel block
- Plain script block: `new Function(block)` check before ship
- str_replace on EXERCISE_DB: always include `description:` key
- `exercises` useState before `prevWeekNotes` useMemo — permanent
- `stallingData` useMemo always after `prevWeekNotes`
- Brace balance = 0 before every ship
- `activeWeek` != `currentWeek` — always use displayWeek
- Today-done detection requires `ppl:completedDate`
- Global state must live in App
- `repsSuggested: true` — clear on confirm
- Deload week: `WEEK_PHASE[w] === "Deload"`
- Component-scoped arrays inside component — never plain script block
- **IIFE scope isolation** — bridge with refs for cross-IIFE variable access
- **Large replacements** — Node script > str_replace for complex JSX
- **Wrangler**: always `--config wrangler.toml` from `~/foundry-worker/`
- **`weekDay` not `day`** — always use week-adjusted sets in DayView
- **`MESO.weeks = mesoLength + 1`** — deload appended, not included
- **Hybrid AI + client enforcement** — prompt for intent, hydration clamps for guarantee
- **Experience normalization** — always run through `expNormalize` before prompt
- **`FOUNDRY_MOBILITY` + `MORNING_MOBILITY` are the single sources** — use `getMobilityMoves(tag)` at all call sites, never define inline
- **str_replace closing fragment risk** — old_str ending with `</>` consumes `)}` on same line; always verify depth = 0
- **Readiness data is best-effort** — guard with `totalLogged >= 5`; silent fallback if absent

---

## 9 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- No scope assumptions — don't combine items without explicit approval
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Read SYNOPSIS at start of every session before taking action
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_30_0.html)
- Outputs to /mnt/user-data/outputs/
- Tyler = James's wife, business banking, active beta tester (she/her)
- Sydney = Trainer tier pilot target (works at a gym)
- New storage keys use `foundry:` namespace

---

## 10 · Supabase Migration Key Map

### User Profile
| localStorage Key | Postgres Table | Column(s) |
|-----------------|----------------|-----------|
| ppl:profile | users | name, age, gender, weight, goal, experience, theme, start_date, workout_days, session_duration, split_type, days_per_week, meso_length, equipment, cardio_schedule, birthdate |
| ppl:onboarding_data | users | name, dob_month, dob_day, dob_year, age, experience |
| ppl:onboarding_goal | users | goal |
| ppl:onboarded | users | onboarded_at (timestamp) |
| ppl:pro | users | is_pro (bool) |
| foundry:pro_email | users | email |
| foundry:meso_transition | users | meso_transition_json (JSONB, nullable) |

### Meso / Session Data
| localStorage Key | Postgres Table | Column(s) |
|-----------------|----------------|-----------|
| ppl:day{d}:week{w} | sessions | user_id, day_idx, week_idx, sets_json |
| ppl:done:d{d}:w{w} | sessions | completed (bool) |
| ppl:completedDate:d{d}:w{w} | sessions | completed_at (date) |
| ppl:currentWeek | users | current_week |
| ppl:skip:d{d}:w{w} | sessions | skipped (bool) |
| ppl:notes:d{d}:w{w} | sessions | session_note |
| ppl:exnotes:d{d}:w{w} | sessions | exercise_notes_json |
| ppl:exov:d{d}:ex{i} | exercise_overrides | user_id, day_idx, ex_idx, exercise_id, scope |

### Health / Body / Readiness
| localStorage Key | Postgres Table | Column(s) |
|-----------------|----------------|-----------|
| ppl:bwlog | bodyweight_log | user_id, date, weight |
| foundry:readiness:YYYY-MM-DD | readiness_log | user_id, date, sleep, soreness, energy, score |

### Cardio / Mobility / Archive
| localStorage Key | Postgres Table | Column(s) |
|-----------------|----------------|-----------|
| ppl:cardio:session:YYYY-MM-DD | cardio_sessions | user_id, date, protocol_id, completed, data_json |
| ppl:mobility:session:YYYY-MM-DD | mobility_sessions | user_id, date, protocol_id, completed, data_json |
| ppl:archive | meso_archive | user_id, id, archived_at, profile_json, sessions_json, meso_weeks |
