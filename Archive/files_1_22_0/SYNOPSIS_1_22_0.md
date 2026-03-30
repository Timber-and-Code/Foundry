# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.22.0 · March 2026**

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
- **`foundry:pro_email`** — email stored to localStorage on submit
- **Go Pro banner** on Home tab — "GET EARLY ACCESS" CTA opens pricing overlay
- **AI builder paywall** — designed, deferred post-Vite. `ppl:pro` reserved.
- **Free tier for Under 18 / 62+** — live callout on DOB screen during onboarding

### Next Revenue Step
- **Kit (ConvertKit) email list integration** — deferred
  - Plan: Cloudflare Worker `/subscribe` endpoint proxying Kit API
  - Key stored as Wrangler secret (same pattern as Anthropic key)
  - App POSTs { email } to Worker; localStorage write kept as fallback

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~17,700 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| AI Key | Stored as Cloudflare Worker secret — never in source |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |
| Versioning | Semantic: Major = architecture rebuild, Minor = features, Patch = fixes |

### Critical Invariants
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
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

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase auth + PostgreSQL + RLS.

---

## 4 · What Was Built (v1.22.0 — Full Session)

### Onboarding Rewrite
- 4-screen flow: Name → Birthday (Month/Day/Year picker) → Goal (tap-select) → How It Works
- Name used from screen 1 onward; DOB replaces freetext age via `ageFromDob()`
- Live free-tier callout on DOB screen (under 18 / 62+)
- All 5 GOAL_OPTIONS with emoji icons + checkmark
- Saves `ppl:onboarding_data` (name, dob, age) + `ppl:onboarding_goal` on complete
- SetupPage pre-fills name, age, goal from saved data
- Onboarding → SetupPage directly (NoMesoShell bypassed for first-time users)
- No skip button

### Helper Functions Added
- `ageFromDob({ month, day, year })` — derives integer age from DOB object
- `getTimeGreeting()` — "Good morning" / "Good afternoon" / "Good evening" by hour

### SetupPage
- Path select "AI" badge → "AUTO"; sublabel updated; submit button → "The Foundry Builds My Program →"

### HomeView Greeting
- "Good morning, Tyler." above dashboard — time-aware, name in bold

### Week / Meso Complete Modals
- Week: "Strong week, Tyler." + week number + sessions
- Meso: "Tyler — 6 Weeks. Done."

### Rep Ladder (Per-Set Rep Suggestions)
- `loadDayWeekWithCarryover()` suggests reps per set:
  - Week 1 / no data → rangeMin
  - Weight advanced → reset to rangeMin (earn the reps at new load)
  - Weight held → last_week_reps + 1, capped at rangeMax
  - Set not logged → rangeMin (no penalty)
- `repsSuggested: true` flag prevents false "done" state on carried sets
- "TARGET" label under reps column when suggestion active
- Weight auto-fill fixed to use `confirmed === true` not `reps !== ""`

### Last Session Context
- "Last: 185 × 5" muted hint below each set row (prior week actual logged values)

### Cross-Meso Context Note
- Week 0 only: "📊 Last meso: 185 × 6" above set rows if same exercise in most recent archive
- Pulls last working week, skips deload

### Future Session Locked Preview
- Future weeks: stripped list — name + sets×reps + rest + lock icon, 50% opacity
- No inputs, no suggested data, no fake done state

### Explore Tab
- Order: THE METHODOLOGY callout ("Learn more →") → Exercise Library + Sample Programs (2-col)
- "Learn the System" card removed (redundant)
- "AI Program Builder" → "Foundry Program Builder" throughout
- Learn card icon: 🏗 → ⚙️ for visibility on dark backgrounds

### Warmup Fixes
**10 exercises corrected from "Full protocol" to "2 ramp sets":**
- DB Flat Bench Press, Incline DB Press
- KB Military Press, KB Push Press, KB Sumo Deadlift, KB Clean, KB Snatch, KB Clean & Press, KB Thruster, KB Turkish Get-Up

**`generateWarmupSteps()` now respects warmup string:**
- "Full protocol" barbell → 4 steps (bar only, 50%×5, 70%×3, 85%×1)
- "2 ramp sets" → 2 steps (40%×10, 65%×5)
- "1 feeler set" → 1 step (65%×8-10)
- "1 light feeler set" → 1 step (50%×12-15)

**`getWarmupDetail()` — new "2 ramp sets" branch** for DB/KB compounds

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON |
| ppl:done:d{d}:w{w} | Session completion flag |
| ppl:completedDate:d{d}:w{w} | ISO date of completion |
| ppl:day{d}:week{w} | Set/rep data (includes `repsSuggested` flag) |
| ppl:currentWeek | Stored week index |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:notes/exnotes:d{d}:w{w} | Session + exercise notes |
| ppl:onboarded / ppl:show_tour / ppl:toured | Onboarding + tour flags |
| ppl:onboarding_data | { name, dob: { month, day, year }, age } |
| ppl:onboarding_goal | Goal ID string |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| foundry:pro_email | Pro email capture from pricing page |

---

## 6 · Key Code Locations (v1.22.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~328 |
| GOAL_OPTIONS | ~2885 |
| generateWarmupSteps | ~3925 |
| getWarmupDetail | ~3975 |
| ageFromDob helper | ~3720 |
| getTimeGreeting helper | ~3734 |
| loadDayWeekWithCarryover (rep ladder) | ~3090 |
| PricingPage | ~13020 |
| ExerciseCard | ~7570 |
| DayView | ~9220 |
| exercises useState (MUST stay before prevWeekNotes) | ~9270 |
| HomeView — greeting | ~13420 |
| HomeView — calendarWeek / displayWeek | ~13220 |
| Go Pro banner | ~13970 |
| ExplorePage | ~12350 |
| PRTracker | ~15480 |
| App timer state | ~16080 |
| App weekCompleteModal render | ~17060 |
| OnboardingFlow (4-screen) | ~16220 |

---

## 7 · QA Notes

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |
| — | goalNote passthrough | Not yet passed to callFoundryAI |
| — | Kit email list integration | Worker /subscribe + Wrangler secret |

---

## 8 · Next Session Priorities

1. **Stalling detection** — surface as Home tab coaching card when lift hasn't moved in 2+ weeks
2. **1RM estimate** — Epley formula in PR tracker (data already exists)
3. **Kit email list** — Worker /subscribe endpoint, Wrangler secret, app-side POST
4. **goalNote passthrough** — pass to callFoundryAI
5. **"Built by" story** — James on pricing page, 3-sentence origin story

### Revenue Milestone (v2.0)
- Vite + Capacitor migration — App Store, Pro paywall, push notifications
- Supabase data layer — auth + PostgreSQL + RLS
- ppl: → foundry: full migration
- AI builder paywall — hard gate post-Vite
- Trainer tier pilot — Sydney's gym
- In-app referral — 30 days free both parties
- Meso 2+ AI builder reads meso 1 data — the compounding intelligence moat

### Coaching Intelligence (The Moat)
- DONE: Rep ladder, last session context, cross-meso note
- TODO: Stalling detection card, warm-up guided timer, 1RM estimates, body map

---

## 9 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays must live in plain script tag — never Babel block
- **Plain script block must parse as valid JS** — `new Function(block)` check before ship
- **str_replace on EXERCISE_DB: always include `description:` key** in both strings
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent
- Brace balance check mandatory before every ship — depth must be 0
- `activeWeek` (computed) != `currentWeek` (stored) — always use displayWeek
- `displayWeek = Math.min(activeWeek, calendarWeek)` — never jump ahead
- Today-done detection requires `ppl:completedDate`
- Global state surviving tab nav must live in App
- `ppl:` namespace is legacy — new keys use `foundry:`
- `repsSuggested: true` flag — check anywhere "has reps = worked" logic exists

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_22_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester (she/her)
- James's daughter + her friend also beta testing — ungated until post-Vite
- Sydney (works at a gym) = Trainer tier pilot target
- New storage keys use `foundry:` namespace, not `ppl:`
