# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.19.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

---

## 2 · Pricing Model & Path to $100K

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 — always free for: Under 18 · Adults 62+ | Manual program builder, full tracking, exercise library, warmup guides |
| **Pro** | $12/mo · $99/yr (save 2 months) | AI program builder, full history, sparklines, e1RM, all advanced features |
| **Trainer / Coach** | $29/mo · $249/yr — post-Capacitor | Client management, shared programs, coach dashboard |

### The Math to $100K
- 700 active Pro subscribers at $12/mo = $100,800 ARR
- Or: 850 annual at $99 + ~200 monthly = $102,550
- Tyler (James's wife) and James are active beta testers — currently on Week 3 of an 8-week meso
- Tyler's business banking network is the primary warm acquisition channel
- Every trainer using the app is a distribution node — 10 trainers × 20 clients = 200 users from 10 conversations
- James's niece Sydney (works at a gym) = target for trainer tier pilot + real-user feedback
- James's daughter and her friend are also beta testing — keep all features ungated until post-Vite

### Revenue Opportunities Surfaced
- **Sample programs as a conversion funnel** — "Start this program" is the highest-intent moment in the free user journey. Prime candidate for a Pro interstitial: "Get the AI-personalized version of this program with Pro."
- **Rest day "Next Session" preview as a Pro gate** — free users see session label only; Pro users see full exercise list, prescribed weights, and volume targets.
- **AI builder paywall** — Free tier gets `autoSelectProgram()` (static algorithm, real program). Pro gets `callFoundryAI()` (Claude Sonnet, personalized). Gate mechanism designed: Option A (hard block at path selection, PRO badge on AI card). **Implementation deferred post-Vite migration** — beta users currently testing ungated. `ppl:pro` key reserved for future use.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~15,100 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker → `https://foundry-ai.timberandcode3.workers.dev` |
| AI Key | Stored as Cloudflare Worker secret `ANTHROPIC_API_KEY` — never in source |
| Hosting | GitHub Pages — `https://timber-and-code.github.io/Foundry` |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | `~/foundry-worker/worker.js` + `wrangler.toml` on James's WSL2 machine |

**Vite/Capacitor migration:** Deferred until App Store push (v2.0 sprint). No current bottleneck. This is also the trigger for: AI builder paywall, Trainer tier, RevenueCat/Stripe subscription management.

---

## 4 · Current Version — v1.19.0

### What shipped this session

**UI Typography & Color Sweep (full)**

Root cause: 173 occurrences of `fontSize:10` and 147 of `fontSize:11` across the app, combined with `--text-muted` and `--text-dim` CSS variables that were too dark in dark mode to meet minimum readability contrast.

**CSS variable fixes:**
- Dark `--text-muted`: `#6a6e72` → `#8c9098` (contrast on cards: ~2.5:1 → ~4.2:1)
- Dark `--text-dim`: `#3a3e42` → `#585d62` (was nearly invisible at ~1.8:1)
- Light `--text-dim`: `#9a9ea2` → `#7a7e82` (was too faint in light mode)

**Type floor established at 12px:**
- All `fontSize:9` → `fontSize:11`
- All `fontSize:10` → `fontSize:12`
- All `fontSize:11` → `fontSize:12`
- Result: 0 occurrences of sub-12px text remaining; 461 at 12px, 138 at 13px, 66 at 14px

**This Week · Sets Logged card (specific fixes):**
- "THIS WEEK · SETS LOGGED" label: `text-muted` → `text-secondary`
- PUSH/PULL/LEGS bar labels: hardcoded dark hex colors split into `color` (text, now phase-accum/intens/peak) and `barColor` (fill gradient, keeps original dark hex). Labels are now readable against dark cards.
- Set count numbers: `text-secondary` → `text-primary`, 12 → 13px

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON (includes workoutDaysHistory) |
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
| ppl:bwlog | Bodyweight log array JSON |
| ppl:bwPromptSunday | BW check-in shown-flag (resets weekly) |
| ppl:bwGoal | Body weight goal (lbs, string) |
| ppl:skip:d{d}:w{w} | Skip flag for future meso day slot |
| ppl:currentWeek | Current meso week index |
| ppl:theme | Dark/light theme preference |
| ppl:archive | Completed meso archive array (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override (swap) for slot |
| ppl:notes:d{d}:w{w} | Session-level note text |
| ppl:exnotes:d{d}:w{w} | Per-exercise notes JSON |
| ppl:cardio:d{d}:w{w} | Cardio log for session |
| ppl:extra:notes:YYYY-MM-DD | Extra session session-level note |
| ppl:extra:exnotes:YYYY-MM-DD | Extra session per-exercise notes JSON |
| ppl:pro | *(reserved)* Pro tier flag — not yet gated. Set to "1" to enable Pro path. |

---

## 6 · Key Code Locations (v1.19.0)

| Item | Location |
|------|---------|
| FOUNDRY_AI_WORKER_URL | ~line 4621 |
| callFoundryAI() | ~line 4623 |
| autoSelectProgram() | ~line 4727 |
| PHASE_COLOR JS constant | ~line 3029 |
| QUOTES array (233 quotes) | ~line 3416 |
| loadExerciseHistory() | ~line 453 |
| detectSessionPRs() | ~line 469 |
| haptic() + HAPTIC patterns | ~line 580 |
| isSkipped() / setSkipped() / clearAllSkips() | ~line 675 |
| getWorkoutDaysForWeek() / ensureWorkoutDaysHistory() | ~line 691 |
| buildAiDaysFromSample() | ~line 10860 |
| StartSampleProgramModal | ~line 10897 |
| RPE_OPTS + CompleteDialog | ~line 6483 |
| ExerciseCard (last-set timer deferral, handleSetCheckmark) | ~line 7005 |
| WorkoutCompleteModal (PR callout) | ~line 6200 |
| ExtraDayView | ~line 7515 |
| DayView | ~line 8135 |
| exercises useState (MUST stay before prevWeekNotes useMemo) | ~line 8285 |
| handleLastSetFilled / handleDialogYes / handleDialogNo / handleAddSet | ~line 8555 |
| AddExerciseModal in DayView | ~line 9083 |
| WeekSection (skip toggle) | ~line 10100 |
| BwChart (goal weight + history) | ~line 9630 |
| ExplorePage (onStartProgram wired) | ~line 11002 |
| HomeView (landing tab, This Week card) | ~line 11701 |
| OnboardingFlow (3 screens — rewrite pending) | ~line 14293 |
| NoMesoShell (onStartProgram threaded) | ~line 14650 |
| ErrorBoundary | ~line 14911 |
| App render (wrapped in ErrorBoundary) | ~line 14998 |

---

## 7 · QA Tracker

### Resolved
| # | Issue |
|---|-------|
| 1 | AI Worker URL was placeholder — now live |
| 2 | Day locking blocked out-of-order logging — removed |
| 3 | Leave prompt 6-quote hardcoded array — now uses full 233-quote library |
| 4 | Rest timer skipped last set — fixed |
| 5 | Meso History header small/dimmed — fixed |
| 7 | No in-progress indicator on bottom nav — pulsing dot added |
| 8 | BW check-in fired on exercise expand — moved to beginWorkout() |
| 9 | Edit Workout button disappears — confirmed fixed |
| 10 | Session notes buried — per-exercise strips + post-session review + calendar badge |
| 11 | Week Complete modal underutilized — redesigned with stat row + primary CTA |
| 12 | Calendar navigated infinitely past — clamped to meso date range |
| 13 | Swap UI didn't confirm week — Week N Only label added |
| 15 | No PR callout in workout complete modal — detectSessionPRs() + gold trophy callout |
| 16 | BW trend not visualized — goal weight, history list, single-entry state |
| 18 | Exercise history no week context — Phase + RIR shown, most recent first |
| 19 | No haptic feedback — haptic() wired to 5 key moments |
| 20 | Explore sample programs: no Start CTA — buildAiDaysFromSample + StartSampleProgramModal fully wired |
| 22 | No way to update schedule mid-meso — skip toggle + Edit Schedule with history model |
| 23 | No rest day content — bottom sheet with quotes, recovery, mobility, next session |
| 24 | font-weight 900 not loaded — Google Fonts subset updated |
| — | DayView AddExerciseModal JSX truncation → workout load failure — restored |
| — | exercises useState after prevWeekNotes useMemo → black screen Week 2+ — order fixed, ErrorBoundary added |
| — | iOS PWA cache serving stale HTML — cache-busting meta tags added |
| — | CompleteDialog RPE buttons neon / hard to read — colors muted, glow reduced |
| — | No/YES buttons low contrast — replaced with solid Not yet / Done ✓ |
| — | "Not yet" left exercise grayed with no re-fire path — fixed |
| — | No way to add sets mid-exercise — + Add a Set in CompleteDialog, phase-gated |
| — | Last-set timer fired simultaneously with DONE? dialog — timer deferred |
| — | Last-set DONE? showed "Not yet" unnecessarily — hidden on isLastSet dialogs |
| — | UI typography sweep: 320+ sub-12px text instances eliminated, CSS vars lifted for dark mode contrast |

### Feature Gaps (remaining)
| # | Issue | Notes |
|---|-------|-------|
| 17 | Verify past sessions open in editable DayView | Likely works — needs manual confirmation |
| 21 | Onboarding rewrite | Next session: Screen 0 (problem/solution), Screen 1 (progression viz), Screen 2 (dynamic experience subtext) + Option B first-use coach overlay on home tab |

---

## 8 · Product Roadmap (Priority Order)

1. **Onboarding rewrite** — 3-screen rework + first-use tooltip overlay. Next session.
2. **Paywall on AI builder** — Option A (hard gate at path select, PRO badge). **Post-Vite.** `ppl:pro` key reserved.
3. **Onboarding share prompt** — Post-program-generation nudge. Low effort, word-of-mouth capture.
4. **Rest day Next Session detail as Pro gate** — Free: session label only. Pro: full exercise list + weights.
5. **Sample program Pro upsell** — "Start this program" → "Get the AI-personalized version with Pro."
6. **Progress photos** — Camera upload pinned to date. Retention driver and differentiator.
7. **Trainer tier** — Sydney's gym = pilot. Post-Capacitor.
8. **Recovery & Readiness section** — Sleep, stress, HRV.
9. **Body weight benchmarks** — Entry point for users without working weights.
10. **Push notifications** — Requires Capacitor native wrap first.
11. **In-app referral code** — Give friend 30 days free, get 30 days free.

**v2.0 sprint trigger:** Vite + Capacitor when starting App Store push. Also gates: AI paywall, Trainer tier, RevenueCat/Stripe.

---

## 9 · Standing Instructions

- Ask before making changes not explicitly requested
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app. User uploads manually
- GitHub upload page: https://github.com/Timber-and-Code/Foundry/upload/main
- Working file going forward: Foundry_1_19_0.html
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, beta tester, currently Week 3 of 8-week meso. She/her.
- James's daughter + her friend also beta testing — keep ungated until post-Vite
- Hook ordering invariant: exercises useState MUST remain declared before prevWeekNotes useMemo (~line 8285) or Week 2+ black screen returns
