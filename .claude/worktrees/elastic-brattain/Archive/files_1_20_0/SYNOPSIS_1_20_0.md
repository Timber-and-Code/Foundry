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
| **Free** | $0 — permanently free for: Under 18 · Adults 62+ | Manual program builder, full tracking, exercise library, warmup guides, full cardio logging + guided timer |
| **Pro** | $12/mo · $99/yr (save 2 months) | AI program builder, cardio plan integrated into meso, goal-based recommendations, full history, sparklines, e1RM, all advanced features |
| **Trainer / Coach** | $29/mo · $249/yr — post-Capacitor | Client management, shared programs, coach dashboard |

### The Math to $100K
- 700 active Pro subscribers at $12/mo = $100,800 ARR
- Or: 850 annual at $99 + ~200 monthly = $102,550
- Tyler (James's wife, works in business banking) and James are active beta testers — currently mid-mesocycle
- Tyler's business banking network is the primary warm acquisition channel
- James's daughter and a friend are also beta testing
- Sydney (works at a gym) = target pilot for the Trainer tier
- Every trainer using the app is a distribution node — 10 trainers x 20 clients = 200 users from 10 conversations

### Revenue Opportunities (Surfaced & Standing)
- **AI builder paywall** — Free tier gets static generator, Pro gets AI. Post-Vite. `ppl:pro` reserved.
- **Cardio plan as Pro gate** — Free: log cardio any day, full guided timer, full protocol library. Pro: cardio scheduled into meso, goal-based recommendations, home tab integration.
- **Rest day Next Session as Pro gate** — free users see session label only; Pro see full exercise list + weights.
- **Sample programs as conversion funnel** — "Start this program" → "Get the AI-personalized version with Pro."
- **Free tier for Under 18 / 62+** — young users become paying adults; older users convert adult children.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~16,457 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| AI Key | Stored as Cloudflare Worker secret ANTHROPIC_API_KEY — never in source |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | ~/foundry-worker/worker.js + wrangler.toml on James's WSL2 machine |

**Critical invariant:** `exercises` useState MUST be declared before `prevWeekNotes` useMemo (~line 9051). Reversing causes black screen on Week 2+.

**Key distinction:** `activeWeek` (computed from completedDays — advances automatically) vs `currentWeek` (stored value). All user-facing week displays must use `activeWeek`.

**Hooks rule:** Never use React.useState or React.useEffect inside an IIFE in JSX — always extract as a proper named component.

**Vite/Capacitor migration:** Deferred to v2.0. Triggers: Pro paywall, App Store, Trainer tier.

---

## 4 · Version History

### v1.20.0 — Cardio System + Goal Framework + Onboarding Rewrite

**GOAL_OPTIONS** (plain script block, ~line 2867)
5 structured goals replacing the freetext textarea: Build Muscle, Build Strength, Lose Fat, Improve Fitness, Sport & Conditioning. Each has id, label, desc, and priority field. Asked once on step 1 (shared by both paths). AI path derives priority from goal at exit — no more hardcoded "both".

**CARDIO_WORKOUTS expanded** (plain script block, ~line 2900)
13 protocols across 6 categories, each with recommendedFor array mapping to goal IDs:
- HIIT: Tabata, 30/30s, HIIT Pyramid
- VO2 MAX: Norwegian 4x4, VO2 Max Intervals, Sprint Intervals
- LACTATE THRESHOLD: Lactate Threshold, Tempo Run
- LISS: Zone 2, Active Recovery
- MISS: Moderate Steady State
- CIRCUIT: Circuit Training, 20-Min AMRAP

**SetupPage — goal chips (both paths)**
Manual and AI paths share the goal selector on step 1. Goal removed from AI path as Q4 (was redundant). Experience is Q3 of 3 in AI path. Priority derived from GOAL_OPTIONS at exit.

**Cardio plan step — recommendations layer**
Appears above the 7-day picker when goal is set. Shows up to 3 recommended protocols with one-tap "Add" buttons. Auto-assigns to first available non-lifting day. Recovery note for 5+ day/week lifters.

**Onboarding rewrite (#21)**
- Screen 0: Pain hook ("You're putting in the work.") + value statement + $200/month coach framing + restore backup
- Screen 1: `OnboardingProgressScreen` component — animated bar chart (squat progression 8-week meso) + progression mechanic explainers. Proper named component — not IIFE (hooks requirement)
- Screen 2: Mock session card — "Your program is built. You bring the weights." Foundry-owned fields (sets, reps, rest, RIR) vs user weight field (blank dashed border)
- CTA: "Let's go →" / "Got it →" / "Build My Program →"

**TourOverlay — first-use coach spotlight**
4-stop sequential spotlight after first program is generated. Tooltip pinned to bottom above nav. Tap anywhere to advance. Null element skip (no stalling). No blur overlay. Blue border highlight on target.
Stops: Today card → Cardio card → Schedule nav → Progress nav.
Keys: `ppl:show_tour` (set on first program save), `ppl:toured` (prevents repeat).
`data-tour` attrs on all 4 targets.

**Past session read-only opacity**
Completed exercises in past (read-only) sessions: opacity 0.82 vs 0.55 in live sessions. Readable without washing out the live workout dimming UX.

**Bug fixes in v1.20.0**
- Rest timer fires after last exercise confirmed done — removed from handleDialogYes
- Minimized timer requires two taps to dismiss when done — single tap calls dismissRestTimer()
- Exercise history backdrop allows background scroll — onTouchMove preventDefault added
- Warmup modal bottom-anchored — now centered
- Cardio complete doesn't return home — auto-navigates after 400ms
- Schedule tab always expands current week — auto-expand useEffect removed
- Banner shows wrong week — uses activeWeek not currentWeek
- activeWeek not defined in App — computed at App scope
- ReadyDialog declaration mangled by str_replace — restored
- Old OnboardingFlow body orphaned after str_replace — removed
- `sel is not defined` in SetupPage AI path equipment map — missing const added
- Goal asked twice (step 1 + AI Q4) — Q4 removed, goal shared from step 1 form
- Available equipment label too small — bumped to fontSize:15 to match other question headers
- TourOverlay stalling when element not found — now auto-skips missing elements
- Tour blur obscuring highlighted element — backdropFilter removed

---

### v1.19.0 — Polish & Visual Systems
12px type floor, CSS variable contrast fixes, PR Tracker compact redesign, rest timer minimized improvements, Volume Check plain-language labels, Sets Logged chart removed.

### v1.18.0 — Explore Launch + CompleteDialog Overhaul
"Start this program" CTA on all 10 sample programs. CompleteDialog RPE redesign, Not yet/Done, +Add a Set, last-set timer sequencing. ErrorBoundary. iOS cache-busting. Black screen Week 2+ fix.

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON — includes goal (structured id), goalNote, cardioSchedule, priority |
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
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:bwlog | Bodyweight log array JSON |
| ppl:bwPromptSunday | BW check-in shown-flag (resets weekly) |
| ppl:bwGoal | Body weight goal (lbs, string) |
| ppl:skip:d{d}:w{w} | Skip flag for future meso day slot |
| ppl:currentWeek | Stored meso week index (use activeWeek for display) |
| ppl:theme | Dark/light theme preference |
| ppl:archive | Completed meso archive array (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override (swap) for slot |
| ppl:notes:d{d}:w{w} | Session-level note text |
| ppl:exnotes:d{d}:w{w} | Per-exercise notes JSON |
| ppl:cardio:d{d}:w{w} | Legacy cardio log (no longer written to) |
| ppl:extra:notes:YYYY-MM-DD | Extra session note |
| ppl:extra:exnotes:YYYY-MM-DD | Extra session per-exercise notes JSON |
| ppl:onboarded | Onboarding complete flag |
| ppl:onboarding_data | Name pre-fill for SetupPage |
| ppl:show_tour | Flag to show tour on next load (set on first program save) |
| ppl:toured | Tour complete — never show again |
| ppl:pro | Reserved — Pro tier flag (not yet active; post-Vite) |

---

## 6 · Key Code Locations (v1.20.0)

| Item | Location |
|------|---------|
| GOAL_OPTIONS array | ~line 2867 (plain script block) |
| CARDIO_WORKOUTS array | ~line 2900 (plain script block) |
| loadCardioSession / saveCardioSession | ~line 3056 |
| haptic() | ~line 3228 |
| PHASE_COLOR / TAG_ACCENT | ~line 3700 |
| callFoundryAI() / FOUNDRY_AI_WORKER_URL | ~line 4621 |
| autoSelectProgram() | ~line 4727 |
| SetupPage (goal chips, maybePromptCardio, cardio plan step) | ~line 4952 |
| CompleteDialog + RPE_OPTS | ~line 6757 |
| CardioIntervalTimer | ~line 7769 |
| CardioSessionView | ~line 8003 |
| ExtraDayView | ~line 8395 |
| DayView | ~line 8903 |
| exercises useState (MUST stay before prevWeekNotes useMemo) | ~line 9051 |
| prevWeekNotes useMemo | ~line 9071 |
| startRestTimer | ~line 9113 |
| handleDialogYes / handleDialogNo | ~line 9298 |
| WeekSection / DeloadSection | ~line 10893 |
| HomeView (Today card, cardio card, data-tour attrs) | ~line 12442 |
| TourOverlay | ~line 15435 |
| OnboardingProgressScreen | ~line 15553 |
| OnboardingFlow (3-screen rewrite) | ~line 15651 |
| App (activeWeek, showTour, view routing, event listeners) | ~line 15920 |
| ErrorBoundary | ~line 16360 |

---

## 7 · QA Tracker

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |
| — | goalNote passthrough | Optional freetext note saved to profile but not yet passed to callFoundryAI |

All other issues resolved.

---

## 8 · Product Roadmap (Priority Order)

1. **End-of-mesocycle retention** — "Start your next meso" prompt at meso completion. Beta testers finishing soon.
2. **Vite + Capacitor migration (v2.0)** — Unlocks Pro paywall, App Store, push notifications, Trainer tier.
3. **AI builder paywall** — Hard gate at path selection; PRO badge on AI card. Post-Vite. `ppl:pro` reserved.
4. **Trainer tier pilot** — Sydney's gym. Post-Capacitor.
5. **Cardio plan as Pro gate** — Free: log freely, full guided timer. Pro: meso-integrated plan, goal-based recommendations.
6. **Rest day Next Session as Pro gate**
7. **Sample program Pro upsell**
8. **Smart Rep Progression** — phase-aware rep suggestions for isolation/BW exercises, mode-switching at rep range ceiling.
9. **Stalling detection + coaching nudges**
10. **In-app referral** — 30 days free for both parties.
11. **Progress photos** — Camera upload pinned to date.
12. **Recovery & Readiness section**
13. **Push notifications** — Requires Capacitor.
14. **Foundry Whole Health** — Revisit at ~$30K ARR.

---

## 9 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays (EXERCISE_DB, QUOTES, SAMPLE_PROGRAMS, GOAL_OPTIONS, CARDIO_WORKOUTS) must live in a plain script tag — never in the Babel block
- `const` redeclaration across script tags is a hard JS error that crashes the entire app
- Components must be proper top-level named function declarations — never anonymous or inline
- **React hooks (useState, useEffect) cannot be called inside an IIFE in JSX** — always extract as a named component
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent invariant
- str_replace that replaces only a function signature leaves the old body orphaned — verify function count after large replacements
- `activeWeek` (computed from completedDays) and `currentWeek` (stored) are different — user-facing displays always use activeWeek
- Goal is asked once on step 1 and shared across both setup paths — never duplicate it in the AI path
- The real moat: coaching intelligence — stalling detection, phase-aware progression, RIR targets, coherent session flows

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Work section by section with clear status tracking after each item
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_20_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester mid-mesocycle (she/her)
- James's daughter + her friend also beta testing — keep ungated until post-Vite
