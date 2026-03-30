# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.35.0 · March 2026**

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
- **`.btn-primary` CSS class has NO background-color** — every button using this class MUST set inline `background:"var(--btn-primary-bg)"`, `border:"1px solid var(--btn-primary-border)"`, `color:"var(--btn-primary-text)"` or it renders white

### Known Technical Debt
- **`ppl:` vs `foundry:` namespace split** — no migration path yet; keep running key list for Supabase mapping
- **~~Light theme CSS still exists~~** — REMOVED in v1.35.0
- **In-app export only saves `ppl:` keys** — misses `foundry:` readiness/email data; localStorage console dump needed for full migration
- **4 `.btn-primary` buttons still missing inline background** — lines 9438, 10617, 10661, 14509 (identified in v1.35.0 audit, fix queued)
- **Touch targets below 44px** — set checkmark buttons (28×28), various close/back buttons (~20×22px); needs remediation pass

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase + PostgreSQL + RLS + full namespace migration.

---

## 4 · What Was Built (v1.34.0 → v1.35.0)

### Onboarding Flow — Complete Overhaul
- **3 screens → 5 screens**: Split into dedicated screens for each decision point
  - Screen 0: "Enter The Forge" splash with silhouette door image
  - Screen 1: Name input with focus border glow
  - Screen 2: Experience level (Beginner / Intermediate / Advanced)
  - Screen 3: Primary goal (all 5 options from `GOAL_OPTIONS`)
  - Screen 4: "Ready to forge, {name}?" confirmation
- **Progress dots**: Active dot = 24px amber pill, completed = faded orange 8px, future = muted 8px
- **Back button**: 44×44px circle on every screen (1–4), backdrop blur, consistent positioning
- **Slide animations**: 220ms ease transitions with directional awareness (left/right)
- **Touch swipe navigation**: Swipe left/right to advance/go back
- **Shared CTA style**: `ctaBtnStyle` object ensures all onboarding buttons have correct amber background (fixes white button bug)

### Premium Image Treatment
- **All 5 screens at `opacity: 0.9`** — images dominate the viewport
- **Minimal gradient overlay**: Only darkens top (header text) and bottom (CTA area); center 35%–55% is `rgba(0,0,0, 0.0)` — zero overlay
- **Transparent option buttons**: Unselected = `background: transparent`, `border: transparent`, no backdrop filter. Only selected state gets a faint orange tint with blur
- **Triple-layer text shadows**: All text uses `0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)` for crisp legibility over vivid images
- **New Midjourney images**: FOUNDRY_GOAL_IMG (five-anvils semicircle), FOUNDRY_READY_IMG (anvil-with-sparks silhouette), FOUNDRY_DOOR_IMG swapped to archway-with-embers for better silhouette contrast

### Light Theme — Fully Removed
- Deleted `[data-theme="light"]` CSS variables block
- Deleted light theme shadow scale
- Removed `ThemeToggleCard` component
- Removed `setTheme` function from SetupPage
- Removed `_themeMode` variable
- Only `:root, [data-theme="dark"]` remains — dark-only app

### Goal Selection Unlocked in Meso Setup
- Removed `goalLocked` logic that prevented changing goals after onboarding
- Goal options always selectable with hint: "Pre-filled from onboarding — change anytime"

### Tour Overlay — Fixed and Enhanced
- **Root cause fix**: Tour was calling `onNavigate("explore")` etc., but those aren't valid App-level `view` values — only `"home"` renders content
- **Now drives actual tab navigation**: Tour passes `onTabChange` callback that calls HomeView's internal `goTo()` function via a ref bridge (`homeTabRef`)
- **Correct tab sequence**: Home (landing) → Schedule → Progress → Explore
- **Returns to Home** on finish or dismiss

### Brand Language Overhaul — "AI" → "The Foundry"
All user-facing "AI" references replaced:
- Onboarding: "The AI will build..." → "Your program is built around this choice"
- Ready screen: → "Next you'll dial in the details — equipment, schedule, and preferences. Then The Foundry builds your program."
- Meso setup: "AI will select exercises..." → "The Foundry will select exercises..."
- Loading overlay: "Our AI coach is selecting..." → "The Foundry is selecting..."
- Error messages: "AI took too long..." → "The Foundry took too long..."
- Meso 2 button: "Build Meso 2 with AI" → "Build Meso 2 with The Foundry"
- Setup CTA: "The Foundry Builds My Program" → "Build My Meso →"
- Cardio: "Save Plan" → "Add Plan"

### Bug Fixes
- **White "Enter The Forge" button**: `.btn-primary` CSS class has no `background-color`; added shared `ctaBtnStyle` with inline background
- **Tour overlay grey screens**: All tour steps were navigating to non-existent views; fixed with tab-level navigation
- **Cardio page white buttons**: Two `.btn-primary` buttons (leg balance CTA, cardio save plan) missing inline background — fixed
- **Door silhouette not visible**: Swapped FOUNDRY_DOOR_IMG to archway-embers image with clearer silhouette contrast
- **Feedback modal subtext too muted**: Changed from `var(--text-muted)` to `var(--text-secondary)` with text shadow

### Visual Polish
- **Cardio section header**: Toned down from `CARDIO_COLOR` yellow to `#E8651A` orange with subtle `rgba(232,101,26,0.06)` background
- **Experience/Goal descriptions**: Bumped to `#C0B8AC` with heavy text shadows for legibility
- **Radio circle borders**: Changed from dark `#3D3528` to `rgba(232,101,26,0.35)` — visible over images
- **Name input**: Glass treatment matching button style, focus glow on tap

### Version
- `APP_VERSION` updated from `"1.34.0"` to `"1.35.0"`

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
| ppl:toured | "1" when tour complete |
| ppl:pro | Reserved — Pro tier (post-Vite) |
| foundry:pro_email | Pro email capture |
| foundry:meso_transition | Meso transition context incl. readinessSummary |
| **foundry:readiness:YYYY-MM-DD** | `{ sleep, soreness, energy }` — daily readiness |

---

## 6 · Key Code Locations (v1.35.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~321 |
| loadDayWeekWithCarryover | ~3391 |
| getWeekSets (MEV→MAV→MRV) | ~3851 |
| archiveCurrentMeso (**readiness scan**) | ~4035 |
| buildMesoConfig | ~4197 |
| PHASE_COLOR (JS, dark-only) | ~4434 |
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
| FoundryBanner | ~5521 |
| callFoundryAI | ~5580 |
| SetupPage (goal unlocked) | ~5850 |
| CardioSetupPage (Add Plan CTA) | ~7376 |
| WorkoutCompleteModal | ~7580 |
| DayView (readiness in workout flow) | ~10460 |
| ProgressView | ~12130 |
| ProfileDrawer | ~13730 |
| ExploreView | ~13860 |
| FeedbackModal (text-secondary fix) | ~14004 |
| PricingPage | ~14510 |
| HomeView (tab ref, readiness hidden) | ~15158 |
| TourOverlay (tab navigation) | ~18096 |
| FOUNDRY_DOOR_IMG (archway-embers) | ~18198 |
| FOUNDRY_GOAL_IMG (five-anvils) | ~18199 |
| FOUNDRY_READY_IMG (anvil-sparks) | ~18200 |
| FOUNDRY_PROFILE_IMG | ~18260 |
| OnboardingFlow (5 screens) | ~18205 |
| App root (homeTabRef) | ~18577 |

---

## 7 · Phase CSS Variables (Dark Only)

| Phase | Value |
|-------|-------|
| `--phase-accum` | `#E8E4DC` (warm white) |
| `--phase-intens` | `#E8651A` (molten orange) |
| `--phase-peak` | `#D4983C` (warm gold) |
| `--phase-deload` | `#5B8FA8` (cool slate) |

---

## 8 · Next Session Priorities

1. **Fix remaining white buttons** — 4 `.btn-primary` instances missing inline background (lines 9438, 10617, 10661, 14509)
2. **Touch target remediation** — set checkmarks (28×28), close/back buttons (~20×22) need 44×44 minimum
3. **Vite + Capacitor migration (v2.0)** — gates App Store, paywall, push notifications, Trainer tier
4. **Supabase + user accounts + payments** — can't charge without these
5. **Push notifications** — #1 retention tool
6. **Real device testing** — hasn't been done systematically
7. **Distribution strategy & product roadmap discussion** — docs ready to pressure-test

### Coaching Intelligence (The Moat)
- **DONE**: Rep ladder, last session context, cross-meso note, stalling detection, stalling + readiness fatigue correlation, 1RM estimates, goal-aware program builder, fat loss BW-aware stall card, recovery + mobility system, experience-differentiated programming, MEV→MAV→MRV progression, experience-aware weight increments, per-muscle volume landmarks, deload weight targets, post-deload meso transition with seeding, warmup/cooldown nudges (dynamic warmup / static cooldown split), Recovery & Readiness daily check-in, readiness → workout flow integration, readiness → RIR overlay banner, readiness → meso 2 recovery profile, worker auth deployed, Forge Theme rebrand (phase colors, cool color purge, pcAlpha helper), Midjourney branding assets (profile, banner, app icon, onboarding screens), 5-screen premium onboarding, tour with tab navigation, "The Foundry" brand language throughout
- **TODO**: Body map, Vite migration, real device testing, touch target audit fix

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
- **Warmup vs cooldown data**: `FOUNDRY_MOBILITY` = dynamic pre-workout, `FOUNDRY_COOLDOWN` = static post-workout
- **`DAILY_MOBILITY` is the single source** — no inline `MORNING_MOVES` arrays
- **str_replace closing fragment risk** — old_str ending with `</>` consumes `)}` on same line
- **Readiness data is best-effort** — guard with `totalLogged >= 5`; silent fallback if absent
- **Stalling detection checks current week** — suppress stall if auto-progression already broke the plateau
- **`showMesoOverlay` checks `ppl:sessionStart`** — skip overlay on re-entry if workout already begun
- **Swap must clear `weekData[exIdx]`** — stale suggested data bleeds into new exercise otherwise
- **Worker auth is app-level, not user-level** — `X-Foundry-Key` shared secret; real per-user auth at v2.0
- **Lifting completes before cardio prompt** — workout modal fires first; cardio is post-completion
- **Cardio categories are user-facing labels** — "Quick & Intense" not "HIIT"
- **Onboarding = one question per screen** — never combine decisions
- **`.btn-primary` has NO background-color in CSS** — every usage MUST set inline background/border/color
- **Tour overlay drives tab navigation via ref** — `homeTabRef.current = goTo` in HomeView, tour calls `onTabChange` which invokes the ref
- **Image-heavy screens: zero overlay in the middle** — gradient only at top/bottom edges for text; let the image breathe
- **Transparent interactive elements over images** — use triple-layer text shadows instead of opaque card backgrounds
- **Brand language: "The Foundry" everywhere** — never "AI" in user-facing copy

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- No scope assumptions — don't combine items without explicit approval
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Read SYNOPSIS at start of every session before taking action
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_35_0.html)
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
| ppl:toured | users | toured_at (timestamp) |
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
