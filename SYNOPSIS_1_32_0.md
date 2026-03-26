# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.32.0 · March 2026**

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
- Secrets: `ANTHROPIC_API_KEY`, `BREVO_API_KEY`
- `BREVO_LIST_ID = 2` hardcoded in worker.js
- **Security gap**: Worker auth prepped — `X-Foundry-Key` header guard in worker.js, app-side headers on both fetch calls, `FOUNDRY_APP_KEY` constant placeholder. Deploy tonight on WSL2.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~19,400 lines) |
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
- **`DAILY_MOBILITY` is the single source**: no inline `MORNING_MOVES` arrays anywhere
- **`FOUNDRY_ANVIL_IMG` must be declared BEFORE `FoundryBanner`**: base64 constant must precede the component that references it

### Known Technical Debt
- **`ppl:` vs `foundry:` namespace split** — no migration path yet; keep running key list for Supabase mapping
- **Worker auth prepped, not deployed** — worker.js + app headers ready; deploy tonight on WSL2
- **Light theme CSS still exists** — dead code, no UI to activate; harmless but could be pruned in a future cleanup pass

### Vite + Capacitor Migration (v2.0)
Deferred. Triggers: Pro paywall, App Store, push notifications, Trainer tier. Post-migration: Supabase + PostgreSQL + RLS + full namespace migration.

---

## 4 · What Was Built (v1.31.0 → v1.32.0)

### Forge Theme & Visual Identity — Complete Rebrand

**Color System — "Molten Core" Palette**
- Extracted from two Midjourney-generated images: anvil icon and figure+anvil hero image
- Dark theme root: `--bg-root: #0A0A0C`, `--accent: #E8651A` (molten orange), `--accent-rgb: 232,101,26`
- Phase colors mapped to Molten Core palette (CSS vars AND JS `PHASE_COLOR` synced):
  - Accumulation = Amber `#F29A52`
  - Intensification = Orange `#E8651A`
  - Peak = Hot `#E75831`
  - Deload = Ember `#C0392B`
- Light theme phase colors: `#C47A32`, `#B85016`, `#B84425`, `#962B1F`
- TAG_ACCENT (dark): `PUSH:#E8651A`, `PULL:#C0592B`, `LEGS:#D47830`, etc.
- DAY_COLORS: `["#E8651A", "#C87D4A", "#D4983C", "#C0592B"]`

**Warm UI Polish — All Neutral Grays Warmed**
- `--bg-card: #1A1814` (was `#1A1A1F`)
- `--bg-surface: #161412` (was `#161618`)
- `--bg-inset: #1A1610` (was `#111114`)
- `--border: #2E2A24` (was `#2A2A30`)
- `--border-accent: #3D3528` (was `#3D3D45`)
- `--text-secondary: #A89A8A` (was `#A0A0AA`)
- `--text-dim: #6A5E52` (was `#606068`)
- `--text-muted: #9A8A78` (was `#8A8A95`)

**Card Headers Warmed**
- "MESO PROGRESS", "READINESS", "TODAY" labels → all use `var(--phase-accum)` (Amber) instead of cold gray

**Header (FoundryBanner)**
- `FOUNDRY_ANVIL_IMG` base64 constant moved BEFORE `FoundryBanner` definition
- Anvil: 75×75px, borderRadius 14, `margin: "-6px 0"` (negative margin keeps header compact while icon stays large)
- Header padding: `0px 16px 0px`
- Title: `fontSize: 18`, `fontWeight: 800`
- Subtitle color: `var(--phase-accum)` (Amber)
- Profile icon: `#C0885A` default, `#F29A52` on hover
- Title color: `var(--text-primary)`

**Tab Bar**
- Inactive icons/labels: `#8A7A68` (warm taupe)
- Active icons/labels: `var(--accent)` (molten orange)

**Greeting**
- Bumped from `fontSize: 13` to `fontSize: 16` with `paddingBottom: 6`

**Figure+Anvil Hero Image — 4 Placements with Radial Mask Fade**
All use `maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)"` + ember `drop-shadow` glow:
1. **Onboarding screen 0**: 220px, strong ember glow, replaces old 160px version
2. **Profile drawer**: 200px, between header and fields, subtle ember glow
3. **Meso completion modal**: 240px, replaces old star icon, strongest glow
4. **Empty state (NoMesoShell)**: 160px at 70% opacity, "READY TO FORGE?" text below

**Light Mode Removed**
- Theme toggle (`ThemeToggleCard`) and its divider removed from ProfileDrawer
- Light theme CSS still exists (dead code, harmless) but no UI to activate it

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

## 6 · Key Code Locations (v1.32.0)

| Item | Approx Line |
|------|------------|
| EXERCISE_DB (plain script) | ~321 |
| loadDayWeekWithCarryover | ~3391 |
| getWeekSets (MEV→MAV→MRV) | ~3851 |
| archiveCurrentMeso (**readiness scan**) | ~4035 |
| buildMesoConfig | ~4197 |
| PHASE_COLOR (JS) | ~4432 |
| VOLUME_LANDMARKS | ~4441 |
| FOUNDRY_MOBILITY (module scope) | ~4459 |
| DAILY_MOBILITY (module scope) | ~4477 |
| getMobilityMoves (module scope) | ~4485 |
| getReadinessScore (module scope) | ~4497 |
| getReadinessLabel (module scope) | ~4505 |
| FOUNDRY_ANVIL_IMG | ~5502 |
| FoundryBanner | ~5504 |
| callFoundryAI (**readiness prompt block**) | ~5565 |
| autoSelectProgram | ~5792 |
| SetupPage | ~5832 |
| WorkoutCompleteModal | ~7560 |
| DayView (warmup + readiness banner) | ~10440 |
| ProgressView | ~12110 |
| ThemeToggleCard (dead code, no UI) | ~13552 |
| ProfileDrawer (**figure hero image**) | ~13708 |
| ExploreView | ~13840 |
| PricingPage | ~14490 |
| HomeView (**readiness card, warm headers**) | ~14800 |
| FOUNDRY_WELCOME_IMG | ~18000 |
| OnboardingFlow (**forge figure, radial fade**) | ~18060 |
| NoMesoShell (**empty state figure**) | ~18438 |
| App root | ~18476 |
| MESO COMPLETE modal (**figure replaces star**) | ~18935 |

---

## 7 · Phase CSS Variables (Dark / Light)

| Phase | Dark | Light |
|-------|------|-------|
| `--phase-accum` | `#F29A52` (Amber) | `#C47A32` |
| `--phase-intens` | `#E8651A` (Orange) | `#B85016` |
| `--phase-peak` | `#E75831` (Hot) | `#B84425` |
| `--phase-deload` | `#C0392B` (Ember) | `#962B1F` |

---

## 8 · Next Session Priorities

1. **Worker auth deploy** — WSL2 tonight: generate key, set secret, deploy worker.js, update HTML placeholder, upload to GitHub
2. **Vite + Capacitor migration (v2.0)**

### Coaching Intelligence (The Moat)
- **DONE**: Rep ladder, last session context, cross-meso note, stalling detection (suppresses if current week already progressed), stalling + readiness fatigue correlation, 1RM estimates, goal-aware AI, fat loss BW-aware stall card, recovery + mobility system, experience-differentiated programming, MEV→MAV→MRV progression, experience-aware weight increments, per-muscle volume landmarks, deload weight targets, post-deload meso transition with AI seeding, warmup/cooldown nudges, Recovery & Readiness daily check-in, readiness → RIR overlay banner, readiness → meso 2 AI recovery profile
- **TODO**: Body map, Worker auth deploy (tonight)

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
- **`FOUNDRY_ANVIL_IMG` before `FoundryBanner`** — base64 image constants must be declared before components that reference them
- **CSS vars AND JS `PHASE_COLOR` must stay synced** — both are used in different parts of the UI; changing one without the other causes visual inconsistency
- **Radial mask fade for hero images** — `maskImage: radial-gradient(ellipse at center, black 40%, transparent 75%)` eliminates hard edges; combine with `drop-shadow` for ember glow effect

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- No scope assumptions — don't combine items without explicit approval
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Read SYNOPSIS at start of every session before taking action
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_32_0.html)
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
