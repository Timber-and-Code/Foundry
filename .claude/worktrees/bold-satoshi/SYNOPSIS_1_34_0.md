# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.34.0 · March 2026**

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
- **Pricing page Pro callout** — "MESO 2+ INTELLIGENCE" block

### Pro Paywall Strategy (post-Vite activation)

**Principle:** Free users feel coached. Pro users feel like The Foundry *knows them* and builds for them.

**Branding rule:** Always "The Foundry" — never "AI."

**Pro-gated:**
1. **The Foundry Program Builder** — hard gate at path selection
2. **Meso 2+ Intelligence** — seeds from meso 1 performance data
3. **Next Session Full Preview** — full exercise/weight/volume preview on rest days
4. **Meso-Integrated Cardio Plan** — cardio woven into meso schedule
5. **Stalling + Recovery Coaching** — fatigue correlation insights

**Free (creates desire for Pro):**
- Recovery & Readiness check-in — stays free
- Per-muscle volume landmarks — stays free
- Readiness → RIR banner — stays free
- Sample programs — browsable free, gate on "Start"

### Brevo / Worker Infrastructure
- Worker folder: `~/foundry-worker/` — entry file `worker.js`, config `wrangler.toml`
- Worker name: `foundry-ai` — always deploy with `--config wrangler.toml`
- **CRITICAL**: `~/wrangler.jsonc` exists in home dir and overrides project config — ALWAYS use `--config wrangler.toml`
- Deploy: `cd ~/foundry-worker && npx wrangler deploy --config wrangler.toml`
- Worker URL: `https://foundry-ai.timberandcode3.workers.dev`
- Secrets: `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `FOUNDRY_APP_KEY`
- `BREVO_LIST_ID = 2` hardcoded in worker.js
- **Worker auth: LIVE** — `X-Foundry-Key` header guard deployed. `FOUNDRY_APP_KEY` constant in HTML (line ~5607) matches Cloudflare secret. App-level abuse gate; real per-user auth at v2.0 with Supabase.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~19,560 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace (legacy) |
| New keys | `foundry:` namespace going forward |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| Hosting | GitHub Pages — custom domain `thefoundry.coach` (GoDaddy DNS) |

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
- **`FOUNDRY_MOBILITY` = dynamic warmup, `FOUNDRY_COOLDOWN` = static stretches**: two separate data sets, never mix
- **`DAILY_MOBILITY` is the single source**: no inline `MORNING_MOVES` arrays anywhere
- **`FOUNDRY_ANVIL_IMG` must be declared BEFORE `FoundryBanner`**: base64 constant must precede the component that references it
- **CSS vars AND JS `PHASE_COLOR` must stay synced** — both used in different UI parts

### Known Technical Debt
- **`ppl:` vs `foundry:` namespace split** — no migration path yet; keep running key list for Supabase mapping
- **Light theme CSS still exists** — dead code, no UI to activate; harmless but could be pruned
- **In-app export only saves `ppl:` keys** — misses `foundry:` readiness/email data; localStorage console dump needed for full migration

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase + PostgreSQL + RLS + full namespace migration.

---

## 4 · What Was Built (v1.33.0 → v1.34.0)

### Midjourney Branding Assets
- **`FOUNDRY_PROFILE_IMG`** — base64 JPEG profile image (Midjourney-generated forge/anvil artwork), declared at ~line 18260, used in ProfileDrawer (~line 13928)
- **`FOUNDRY_ANVIL_IMG`** — base64 JPEG anvil/banner logo, declared at ~line 5546, used in FoundryBanner component (~line 5564)
- **`Foundry_AppIcon_1024.png`** — 1024×1024 app icon (Midjourney-generated), ready for Capacitor/App Store submission
- **Banner options** and **profile options** HTML mockup files created for design review (`foundry_banner_options.html`, `foundry_profile_options.html`)

### Phase Color Remap — "Forge Heating Up" Narrative
Phase colors remapped to tell a temperature story:
| Phase | Old | New | CSS Var |
|-------|-----|-----|---------|
| Accumulation | `#F29A52` amber | `#E8E4DC` warm white | `--phase-accum` |
| Intensification | `#E8651A` orange | `#E8651A` unchanged | `--phase-intens` |
| Peak | `#E75831` hot | `#D4983C` warm gold | `--phase-peak` |
| Deload | `#C0392B` ember | `#5B8FA8` cool slate | `--phase-deload` |

Updated in both CSS (dark + light theme) and JS `PHASE_COLOR` object.

### `pcAlpha()` Helper
Added at ~line 4437. Detects light/high-luminance colors (like warm white Accumulation) and boosts alpha by 2.5x for visibility on dark backgrounds. Applied to schedule week cards, week bar buttons, CURRENT pills, DeloadSection card.

### Full Cool Color Purge
- 21 instances of `#48bb78` green → `#D4983C` warm gold
- 19 instances of `rgba(91,155,213,...)` blue → warm orange
- `#7c6af7` mobility purple → warm gold
- Pricing page navy gradients → dark forge tones (`#1A1410`, `#12100C`)
- Go Pro banner midnight → warm forge gradient
- Volume legend MV dot → `#8A6030` warm bronze

Only intentional cool tone remaining: Deload slate `#5B8FA8` + splash screen anvil metal.

### RPE/Feel Colors Warmed
- Easy: blue → `#E8E4DC` warm white
- Good: teal → `#D4983C` warm gold
- Hard: `#cc8800` → `#E75831` hot red-orange

### Readiness Moved Into Workout Flow
- **Workout days**: Readiness check-in is now Step 0 of the meso overlay (before coaching cards / RIR / Begin Workout). "HOW ARE YOU FEELING?" with Sleep/Soreness/Energy buttons. Auto-advances after all three filled (400ms delay).
- **Rest days**: Readiness stays on the home tab as before.
- Home tab readiness card: Added workout-day detection IIFE; returns `null` on active workout days.
- DayView: Added `dvReadiness`, `setDvReadiness`, `dvReadinessFilled`, `showReadinessStep`, `updateDvReadiness` state.
- Readiness banner in overlay updated to use `dvReadiness` state instead of re-reading localStorage.

### SLEEP/SORENESS/ENERGY Labels → Amber
Changed from `var(--text-muted)` to `#F29A52` amber for visual pop.

### Readiness Button Contrast
- Unselected border: `var(--border)` → `var(--border-accent)`
- Unselected text: `var(--text-secondary)` → `var(--text-primary)`
- Unselected background: `var(--bg-inset)` → `var(--bg-deep,#0e0c0a)`

### Nav Bar Inactive Icons Brightened
`#8A7A68` → `#A89A8A` (5 instances)

### Warmup/Cooldown Content Split
Pre-workout = dynamic movements, post-workout = static stretches.

**`FOUNDRY_MOBILITY` (warmup, dynamic):**
- PUSH: Arm Circles → Wall Slides, Band Pull-Aparts, Push-Up to Downward Dog
- PULL: Cat-Cow to Thread the Needle, Band Face Pulls, Scapular Pull-Ups
- LEGS: Hip Circles to Leg Swings, Bodyweight Squats with Pause, Walking Lunges with Twist

**`FOUNDRY_COOLDOWN` (new, static stretches):**
- PUSH: Pec Doorway Stretch, Thoracic Extension Over Foam Roller, Overhead Lat Stretch
- PULL: Cross-Body Shoulder Stretch, Bicep Wall Stretch, Overhead Lat Stretch
- LEGS: Hip Flexor Lunge Stretch, Pigeon Pose, Hamstring Floor Stretch, 90/90 Hip Switch

Added `getCooldownMoves(tag)` function. Cooldown section and rest-day recovery cards now use `FOUNDRY_COOLDOWN`. Warmup uses `FOUNDRY_MOBILITY` / `getMobilityMoves`.

**`DAILY_MOBILITY`**: Restored 90/90 Hip Switch (movement-based, 5 reps each side).

### SetupPage DOB Dropdowns Fixed
Day and Year fields in SetupPage changed from `<input type="number">` to `<select>` dropdowns matching onboarding style (chevron SVG, appearance reset, proper options).

### Worker Auth Deployed
- Key generated via `openssl rand -hex 32`
- Secret set: `npx wrangler secret put FOUNDRY_APP_KEY --config wrangler.toml`
- Worker deployed: `npx wrangler deploy --config wrangler.toml`
- HTML `FOUNDRY_APP_KEY` constant updated with real key
- Worker version: `1fe5052d-8ce5-42b0-b4dc-754e7f8e5430`

### Custom Domain Configured
- `thefoundry.coach` set as custom domain in GitHub Pages settings
- DNS propagation in progress
- localStorage migration via export/import needed when switching origins

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
| foundry:meso_transition | Meso transition context incl. readinessSummary |
| **foundry:readiness:YYYY-MM-DD** | `{ sleep, soreness, energy }` — daily readiness |

---

## 6 · Key Code Locations (v1.34.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~321 |
| loadDayWeekWithCarryover | ~3391 |
| getWeekSets (MEV→MAV→MRV) | ~3851 |
| archiveCurrentMeso (**readiness scan**) | ~4035 |
| buildMesoConfig | ~4197 |
| PHASE_COLOR (JS) | ~4434 |
| pcAlpha() helper | ~4437 |
| VOLUME_LANDMARKS | ~4441 |
| FOUNDRY_MOBILITY (dynamic warmup) | ~4476 |
| DAILY_MOBILITY | ~4497 |
| FOUNDRY_COOLDOWN (static stretches) | ~4501 |
| getCooldownMoves | ~4524 |
| getMobilityMoves | ~4530 |
| getReadinessScore | ~4542 |
| getReadinessLabel | ~4550 |
| FOUNDRY_APP_KEY | ~5607 |
| FOUNDRY_ANVIL_IMG | ~5519 |
| FOUNDRY_PROFILE_IMG | ~18260 |
| FoundryBanner | ~5521 |
| callFoundryAI | ~5580 |
| SetupPage (**DOB dropdowns fixed**) | ~5850 |
| WorkoutCompleteModal | ~7580 |
| DayView (**readiness in workout flow**) | ~10460 |
| ProgressView | ~12130 |
| ProfileDrawer | ~13730 |
| ExploreView | ~13860 |
| PricingPage | ~14510 |
| HomeView (**readiness hidden on workout days**) | ~14820 |
| OnboardingFlow | ~18080 |
| App root | ~18500 |

---

## 7 · Phase CSS Variables (Dark / Light)

| Phase | Dark | Light |
|-------|------|-------|
| `--phase-accum` | `#E8E4DC` (warm white) | `#C4BEB6` |
| `--phase-intens` | `#E8651A` (molten orange) | `#B85016` |
| `--phase-peak` | `#D4983C` (warm gold) | `#B07C2E` |
| `--phase-deload` | `#5B8FA8` (cool slate) | `#4A7A90` |

---

## 8 · Next Session Priorities

1. **Vite + Capacitor migration (v2.0)** — gates App Store, paywall, push notifications, Trainer tier
2. **Supabase + user accounts + payments** — can't charge without these
3. **Push notifications** — #1 retention tool
4. **Real device testing** — hasn't been done systematically
5. **Distribution strategy & product roadmap discussion** — docs ready to pressure-test
6. **SLEEP/SORENESS/ENERGY label rendering** — may be browser issue; test on actual device before changes

### Coaching Intelligence (The Moat)
- **DONE**: Rep ladder, last session context, cross-meso note, stalling detection, stalling + readiness fatigue correlation, 1RM estimates, goal-aware AI, fat loss BW-aware stall card, recovery + mobility system, experience-differentiated programming, MEV→MAV→MRV progression, experience-aware weight increments, per-muscle volume landmarks, deload weight targets, post-deload meso transition with AI seeding, warmup/cooldown nudges (dynamic warmup / static cooldown split), Recovery & Readiness daily check-in, readiness → workout flow integration, readiness → RIR overlay banner, readiness → meso 2 AI recovery profile, worker auth deployed, Forge Theme rebrand (phase colors, cool color purge, pcAlpha helper), Midjourney branding assets (profile, banner, app icon)
- **TODO**: Body map, Vite migration, real device testing

---

## 9 · Architectural Principles & Hard-Won Lessons

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
- **Warmup vs cooldown data**: `FOUNDRY_MOBILITY` = dynamic pre-workout, `FOUNDRY_COOLDOWN` = static post-workout. `getMobilityMoves(tag)` for warmup, `getCooldownMoves(tag)` for cooldown. Rest-day recovery cards use `FOUNDRY_COOLDOWN`.
- **`DAILY_MOBILITY` is the single source** — no inline `MORNING_MOVES` arrays
- **str_replace closing fragment risk** — old_str ending with `</>` consumes `)}` on same line; always verify depth = 0
- **Readiness data is best-effort** — guard with `totalLogged >= 5`; silent fallback if absent
- **Stalling detection checks current week** — suppress stall if auto-progression already broke the plateau
- **`showMesoOverlay` checks `ppl:sessionStart`** — skip overlay on re-entry if workout already begun
- **Swap must clear `weekData[exIdx]`** — stale suggested data from previous exercise bleeds into new exercise otherwise
- **Worker auth is app-level, not user-level** — `X-Foundry-Key` shared secret gates abuse; real per-user auth with Supabase at v2.0
- **`FOUNDRY_APP_KEY` in HTML is intentional** — abuse gate, not user secret; real auth at v2.0
- **Lifting completes before cardio prompt** — workout modal fires first; cardio is post-completion
- **Cardio categories are user-facing labels** — "Quick & Intense" not "HIIT"
- **Onboarding = one question per screen**
- **`FOUNDRY_ANVIL_IMG` before `FoundryBanner`** — base64 constants must precede components that reference them
- **Radial mask fade for hero images** — `maskImage: radial-gradient(ellipse at center, black 40%, transparent 75%)`
- **Readiness in workout flow** — on workout days, readiness is Step 0 of meso overlay (before coaching/RIR). On rest days, stays on home tab. DayView has its own `dvReadiness` state that writes to the same `foundry:readiness:YYYY-MM-DD` key.
- **Domain switch breaks localStorage** — origin-scoped; export/import required when changing from GitHub Pages URL to custom domain

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- No scope assumptions — don't combine items without explicit approval
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Read SYNOPSIS at start of every session before taking action
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_34_0.html)
- Outputs to /mnt/user-data/outputs/
- Tyler = James's wife, business banking, active beta tester (she/her)
- Sydney = Trainer tier pilot target (works at a gym)
- New storage keys use `foundry:` namespace

---

## 11 · Supabase Migration Key Map

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
