# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.31.0 · March 2026**

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
- Paywall — designed, deferred post-Vite; `ppl:pro` reserved
- **Pricing page Pro callout** — "MESO 2+ INTELLIGENCE" block: explains meso 2 is built from meso 1 performance data. Copy closer: "The Foundry knows what you lifted."

### Pro Paywall Strategy (post-Vite activation)

**Principle:** Free users feel coached. Pro users feel like The Foundry *knows them* and builds for them. Free creates the data and the desire; Pro unlocks the action.

**Branding rule:** Always "The Foundry" — never "AI." "The Foundry builds your program" positions intelligence as a product capability, not a feature checkbox.

**Pro-gated (The Foundry does it for you):**
1. **The Foundry Program Builder** — hard gate at path selection (Option A). Free users get the static Quick Build; Pro users get the full builder. This is the revenue engine.
2. **Meso 2+ Intelligence** — The Foundry reads meso 1 performance, seeds anchor peaks, rotates accessories, adjusts ramp based on recovery profile. The "it gets smarter" story.
3. **Next Session Full Preview** — free users see "Push Day" on rest days; Pro users see every exercise, prescribed weight, and volume target. Daily reminder of what you're paying for.
4. **Meso-Integrated Cardio Plan** — free users log cardio freely with the guided timer; Pro users get The Foundry weaving cardio into their meso schedule.
5. **Stalling + Recovery Coaching** — correlation card: "this may be fatigue, not a true plateau." Coaching insight, not data display.

**Free (creates desire for Pro):**
- **Recovery & Readiness check-in** — stays free. If gated, users never generate the data that makes Pro valuable. Every check-in feeds intelligence they can only unlock by upgrading.
- **Per-muscle volume landmarks** — stays free. The "this app tracks more than I realized" moment. Visible proof of depth.
- **Readiness → RIR banner** — stays free. "Low readiness — consider reducing load" builds trust. That's brand equity.
- **Sample programs** — browsable for free. Gate is the interstitial: "Start this program" → "Want The Foundry to personalize it for you?"

### Brevo / Worker Infrastructure
- Worker folder: `~/foundry-worker/` — entry file `worker.js`, config `wrangler.toml`
- Worker name: `foundry-ai` — always deploy with `--config wrangler.toml`
- **CRITICAL**: `~/wrangler.jsonc` exists in home dir and overrides project config — ALWAYS use `--config wrangler.toml`
- Deploy: `cd ~/foundry-worker && npx wrangler deploy --config wrangler.toml`
- Worker URL: `https://foundry-ai.timberandcode3.workers.dev`
- Secrets: `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `FOUNDRY_APP_KEY`
- `BREVO_LIST_ID = 2` hardcoded in worker.js
- **Worker auth: LIVE** — `X-Foundry-Key` shared secret on every POST; 401 if missing/wrong. Key baked into HTML. Real per-user auth at v2.0 with Supabase.
- **Worker CORS: multi-origin** — `thefoundry.coach`, `www.thefoundry.coach`, `timber-and-code.github.io`, `localhost`, `127.0.0.1`

### Domain & Hosting
- **Custom domain: `thefoundry.coach`** — purchased via GoDaddy, DNS configured (4 A records → GitHub IPs + CNAME www → timber-and-code.github.io)
- GitHub Pages serves the app; custom domain is the public-facing URL
- HTTPS enforced via GitHub Pages once DNS propagates
- Old URL (`timber-and-code.github.io/Foundry`) still works — Worker CORS allows both origins

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~19,391 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| Hosting | GitHub Pages — thefoundry.coach (custom domain) |

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
- **`DAILY_MOBILITY` is the single source**: no inline `MORNING_MOVES` arrays anywhere

### Known Technical Debt
- **`ppl:` vs `foundry:` namespace split** — no migration path yet; keep running key list for Supabase mapping

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase + PostgreSQL + RLS + full namespace migration.

---

## 4 · What Was Built (v1.29.0 → v1.31.0)

### Tour Overlay — Tab Navigation Fix
- **Bug**: Tour called `setView("explore")` etc. — but explore/schedule/progress are internal HomeView tabs, not App-level views. Nothing rendered behind the overlay.
- **Fix**: App-level `tourTab` state added. Tour's `onNavigate` keeps `view="home"` and sets `tourTab`. HomeView receives `forcedTab` prop, syncs to internal `tab` via `useEffect` (mapping `"home"` → `"landing"`).
- 4 edits, 7 net new lines. Content now visible behind tooltip at every tour step.

### Worker Auth — Deployed & Live
- `FOUNDRY_APP_KEY` secret set via `wrangler secret put`
- Worker checks `X-Foundry-Key` header on every POST; 401 if missing/wrong
- HTML placeholder `REPLACE_WITH_YOUR_KEY_TONIGHT` replaced with real key
- Both fetch calls (AI builder + Brevo subscribe) send the header
- Worker CORS updated: accepts `thefoundry.coach`, `www.thefoundry.coach`, `timber-and-code.github.io`

### Custom Domain — thefoundry.coach
- Purchased via GoDaddy
- DNS: 4 A records (GitHub IPs) + CNAME www → timber-and-code.github.io
- GitHub Pages custom domain configured, HTTPS pending DNS propagation

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

### Stalling Detection — Progression-Aware Suppression
- If the last 3 completed sessions are at the same weight BUT the current week's carry-forward weight is already higher → stall card suppressed
- Reads `ppl:day${dayIdx}:week${currentWeekIdx}` for current prescribed weight
- Checks heaviest weight across all sets (including `repsSuggested`) — carry-forward is what matters
- Wrapped in try/catch — safe fallback proceeds with normal stall detection

### Recovery Cards — Emoji Removal + Accent Border
- Removed all recovery emojis (🧖🚴🚿😴🥩🚶) from 3 locations: week-complete card, rest-day home tab, calendar rest-day sheet
- Replaced with `borderLeft: 3px solid var(--accent)` — matches ExploreView "What The Foundry Does" card style
- Simplified card layout: no flex row with icon; title + body only

### Daily Mobility Rename
- `MORNING_MOBILITY` → `DAILY_MOBILITY` constant
- UI labels: "MORNING MOBILITY · 3 MOVES" → "DAILY MOBILITY · 3 MOVES" in all 3 accordion headers
- Communicates frequency without prescribing time of day

### Stalling + Readiness Correlation — Fatigue Signal
- When a stall is detected, scans last 7 days of `foundry:readiness:` data
- Requires ≥ 3 logged days with avg score ≤ 2.5 to trigger `isFatigueSignal: true`
- All 4 stall push sites carry `isFatigueSignal` flag
- UI: new "FATIGUE SIGNAL" section in coaching card (amber header, between protecting and normal stalls)
- Copy: "Your readiness has been low recently. This plateau is likely fatigue, not a true stall. Prioritize sleep and recovery before pushing load."
- Wrapped in try/catch — silent fallback if readiness data unavailable

### Pro Paywall Strategy — Formalized
- Full strategy documented in Section 2 under "Pro Paywall Strategy"
- Branding rule: always "The Foundry" — never "AI"
- 5 Pro-gated features, 4 free-but-strategic features defined

### Today Card — Start Button
- Chevron circle replaced with "Start →" text in phase accent color
- Same tap target, clearer intent

### Re-Entry During Workout — Skip Overlays
- `showMesoOverlay` init now checks `ppl:sessionStart` — if workout already begun, skip coaching card + RIR + Begin Workout flow
- `stallCardDismissed` inits to `true` if `ppl:sessionStart` exists — no re-prompting stall card on re-entry
- Timer continues from stored start — no reset on remount

### Warmup Protocol Layout — Weight + Reps on One Line
- `generateWarmupSteps` now returns `{ label, reps, detail }` — reps split out of detail string
- Rendering: weight left-aligned, reps right-aligned on header row; description underneath
- Clearer at a glance: user sees "50 lbs (50%)" and "5 reps" without scanning the paragraph

### Swap Clears Previous Exercise Data
- `handleSwap` in DayView: deletes `weekData[exIdx]`, persists to localStorage via `saveDayWeek`, un-marks slot as done
- `handleSwap` in ExtraDayView: same pattern using `dataKey` storage
- Prevents stale suggested weight/reps from previous exercise bleeding into the swapped exercise

### Session Flow — Lifting Completes Before Cardio Prompt
- All-sets-done trigger now calls `openNoteReview()` directly instead of `setShowPostStrengthPrompt(true)`
- Workout complete modal fires first with full stats, quote, and session time
- New `showCardioPrompt` state fires after modal dismissal — "Add Cardio?" with Log Cardio / Done for Today
- Old "Strength Done" intermediate prompt removed from main DayView
- ExtraDayView retains its own post-strength prompt (separate flow)

### Cardio Session — Card-Based Redesign
- **Categories renamed**: HIIT → Quick & Intense, VO2 MAX + LACTATE THRESHOLD → Performance, LISS + MISS → Endurance, CIRCUIT → Conditioning
- **Pill chips → full cards**: each protocol shows name, duration, intensity pill, and full description visible without tapping
- **Recommended section**: "RECOMMENDED FOR YOUR GOAL" at top pulls 2–3 protocols from user's `profile.goal` via `recommendedFor` array; wrapped in tinted featured zone with cardio-color border
- **Compact cards**: description only shows when selected; unselected = name + duration + intensity on one line
- **"OR BROWSE ALL" divider**: pill badge between recommended zone and category list
- **Collapsible category accordions**: categories start collapsed; tap header to expand; auto-expands if selected protocol lives in that category; indented with vertical connector line
- **Category headers**: accent left border, bg-deep background, accent chevron
- **`ProtoCard` renderer**: shared component; `useCardioAccent` prop differentiates recommended vs category cards
- **Meso setup picker**: category headers updated to match; pills retained for compact inline picker
- **Type list updated**: added Stairs, Elliptical, Jump Rope; removed HIIT (training style, not modality)
- **Timer auto-fills duration**: `handleComplete` writes elapsed minutes to duration field on complete
- **Back button**: accent color for text and border

### Onboarding Rewrite — 7 Screens
- **Screen 0: Brand moment** — "THE FOUNDRY" text wordmark with accent underline (replaced broken base64 logo) + headlines scaled to 28/34px + body at 14px + "Built by a lifter, for lifters" italic + restore link. No input. Clean first impression.
- **Screen 1: Name** — standalone "What should we call you?" with single input. First commitment.
- **Screen 2: Goal** — unchanged cards with descriptions. Now uses name in header: "Let's build your program, {name}"
- **Screen 3: DOB** — standalone date inputs. Free tier callout triggers on qualifying age.
- **Screen 4: Experience** — standalone with trimmed descriptions. "Almost there, {name}" header.
- **Screen 5: Proof chart** — now lands AFTER user info. "Here's what happens, {name}" — animated progress chart + hit/miss/PR bullets. Proof is personalized because we know who they are.
- **Screen 6: Reveal** — stronger outcome-oriented copy. REVEAL_COPY rewritten per goal as outcomes not features. Checkmarks: "Week 1 starts where you are. Week 8 you'll surprise yourself." Not "auto-progressing weights every week."
- CTA labels per screen: Let's go → Next (×4) → I'm in → Build My Program
- Validation distributed: name on 1, goal on 2, DOB on 3, experience on 4

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

## 6 · Key Code Locations (v1.31.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~321 |
| loadDayWeekWithCarryover | ~3391 |
| getWeekSets (MEV→MAV→MRV) | ~3797 |
| archiveCurrentMeso (**readiness scan**) | ~3981 |
| buildMesoConfig | ~4130 |
| VOLUME_LANDMARKS | ~4373 |
| FOUNDRY_MOBILITY (module scope) | ~4389 |
| DAILY_MOBILITY (module scope) | ~4439 |
| getMobilityMoves (module scope) | ~4418 |
| **getReadinessScore** (module scope) | ~4430 |
| **getReadinessLabel** (module scope) | ~4438 |
| **FOUNDRY_APP_KEY** (plain script) | ~5558 |
| callFoundryAI (**readiness prompt block**) | ~5480 |
| autoSelectProgram | ~5700 |
| SetupPage (goal read-only) | ~5740 |
| WorkoutCompleteModal (cooldown accordion) | ~7560 |
| DayView (warmup + **readiness banner**) | ~10440 |
| ProgressView | ~12110 |
| ExploreView (accent-border feature cards) | ~13840 |
| PricingPage (**MESO 2+ callout**) | ~14490 |
| HomeView (**readiness card + forcedTab**) | ~14969 |
| TourOverlay (**tab-based navigation**) | ~17896 |
| OnboardingFlow | ~17960 |
| App root (**tourTab state**) | ~18478 |

---

## 7 · Next Session Priorities

1. **Verify tour fix live** — clear `ppl:toured` in localStorage, run through all 4 steps, confirm content visible behind each tooltip
2. **Verify `thefoundry.coach` live** — HTTPS enforced, full onboarding-to-meso test on custom domain
3. **Tyler distribution pilot** — 2–3 people from her banking network; "try this" link, watch for drop-off points
4. **Vite + Capacitor migration (v2.0)**

### Coaching Intelligence (The Moat)
- **DONE**: Rep ladder, last session context, cross-meso note, stalling detection (suppresses if current week already progressed), stalling + readiness fatigue correlation, 1RM estimates, goal-aware AI, fat loss BW-aware stall card, recovery + mobility system, experience-differentiated programming, MEV→MAV→MRV progression, experience-aware weight increments, per-muscle volume landmarks, deload weight targets, post-deload meso transition with AI seeding, warmup/cooldown nudges, Recovery & Readiness daily check-in, readiness → RIR overlay banner, readiness → meso 2 AI recovery profile
- **TODO**: Body map

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
- **`FOUNDRY_MOBILITY` + `DAILY_MOBILITY` are the single sources** — use `getMobilityMoves(tag)` at all call sites, never define inline
- **str_replace closing fragment risk** — old_str ending with `</>` consumes `)}` on same line; always verify depth = 0
- **Readiness data is best-effort** — guard with `totalLogged >= 5`; silent fallback if absent
- **Stalling detection checks current week** — suppress stall if auto-progression already broke the plateau
- **`showMesoOverlay` checks `ppl:sessionStart`** — skip overlay on re-entry if workout already begun
- **Swap must clear `weekData[exIdx]`** — stale suggested data from previous exercise bleeds into new exercise otherwise
- **Worker auth is app-level, not user-level** — `X-Foundry-Key` shared secret gates abuse; real per-user auth comes with Supabase at v2.0
- **`FOUNDRY_APP_KEY` in HTML is intentional** — it's not a user secret, it's an abuse gate; anyone reading source can see it, but it blocks casual abuse and bots. Real auth at v2.0.
- **Lifting completes before cardio prompt** — workout modal must fire first; cardio is a separate post-completion step, never intercepts the completion flow
- **Cardio categories are user-facing labels** — "Quick & Intense" not "HIIT"; protocol names (Tabata, Norwegian 4×4) stay technical for credibility
- **Onboarding = one question per screen** — each screen asks or shows one thing; proof chart comes after user info for personalized context
- **Tour navigates HomeView tabs, not App views** — tour `onNavigate` sets `tourTab` (App-level), HomeView syncs via `forcedTab` prop; `view` stays `"home"` throughout. Setting App `view` to "explore"/"schedule"/"progress" renders nothing.

---

## 9 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- No scope assumptions — don't combine items without explicit approval
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Read SYNOPSIS at start of every session before taking action
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_31_0.html)
- Outputs to /mnt/user-data/outputs/
- Tyler = James's wife, business banking, active beta tester (she/her)
- Sydney = Trainer tier pilot target (works at a gym)
- New storage keys use `foundry:` namespace
- **Domain**: thefoundry.coach — custom domain on GitHub Pages
- **Worker deploy**: `cd ~/foundry-worker && npx wrangler deploy --config wrangler.toml`

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
