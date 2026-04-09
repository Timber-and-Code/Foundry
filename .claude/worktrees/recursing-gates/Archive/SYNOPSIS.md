# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.18.0 · March 2026**

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

### Revenue Opportunities Surfaced This Session
- **Sample programs as a conversion funnel** — "Start this program" is the highest-intent moment in the free user journey. Prime candidate for a Pro interstitial: "Get the AI-personalized version of this program with Pro."
- **Rest day "Next Session" preview as a Pro gate** — free users see session label only; Pro users see full exercise list, prescribed weights, and volume targets.

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

**Vite/Capacitor migration:** Deferred until App Store push (v2.0 sprint). No current bottleneck.

---

## 4 · Current Version — v1.18.0

### What shipped this session

**Bug fix — DayView workout-load failure (carried from v1.17.0 patch)**
- Root cause: truncated `AddExerciseModal` block caused a JSX brace imbalance
- Fix confirmed: `showAddExercise && (<AddExerciseModal ... />)` present and closed at ~line 9083; brace balance = 0

**Bug fix — Black screen on Week 2+ (critical)**
- Root cause: `exercises` useState was declared 130 lines after `prevWeekNotes` useMemo that referenced it. Babel compiles `const` to `var`, hoisting the declaration as `undefined`. The useMemo bailed early on `weekIdx === 0` (Week 1), hiding the crash. Week 2+ hit `undefined.map()` — black screen.
- Fix: moved `exercises` useState above `prevWeekNotes` useMemo. Added `(day.exercises || [])` defensive fallback.
- NOTE: this hook ordering is invariant — exercises useState MUST remain declared before prevWeekNotes useMemo or the crash returns.

**ErrorBoundary**
- Class component wrapping `<App />` at the root render
- Any unhandled React render error now shows: error message, stack trace, component stack, Reload + Try Again buttons, "Screenshot this and send to James"
- Eliminated two evenings of blind black-screen debugging — first crash immediately showed the exact error

**iOS PWA cache-busting**
- `Cache-Control: no-cache`, `Pragma: no-cache`, `Expires: 0` meta tags added
- Forces iOS Safari home screen bookmark to fetch fresh HTML on each load instead of serving stale cached builds

**#20 — Explore: "Start this program" CTA**
- All 10 sample programs in Explore → Programs now have a fully wired launch flow
- `buildAiDaysFromSample(prog)` maps exercise name strings to full EXERCISE_DB objects; first exercise per day = anchor; graceful fallback for name mismatches
- `StartSampleProgramModal` — bottom sheet with program name, metadata badges, attribution line for classic programs (Arnold, PHUL, StrongLifts, Bro Split), start date picker defaulting to today
- Active meso guard: two-tap confirm with red button escalation on second tap
- Button gated by `onStartProgram` prop — hidden in any render context without a launch callback
- Works from both the active-meso Explore tab and NoMesoShell (no program state)

**CompleteDialog UX overhaul**
- RPE colors pulled from full neon to muted readable tones: steel blue / teal-green / amber
- Glow on selection: single soft halo at 40% opacity, no text-shadow blowout
- Labels use the button's own muted color when selected
- "Exercise complete?" and "How was the exertion?" both fontSize:13, fontWeight:600, sentence case — same visual weight, actually readable
- No/YES replaced with solid **Not yet** / **Done ✓** buttons

**+ Add a Set in CompleteDialog**
- Always visible above Not yet / Done ✓ — discoverable without needing to tap "Not yet" first
- Phase-gated: Deload → button replaced with one-line explanation. Peak → amber border + "(peak week — use sparingly)" note. Accumulation/Intensification → clean ghost button.
- On tap: increments `exercises[exIdx].sets` by 1, copies last logged weight to new slot, clears `dialogShownRef` so dialog re-fires when new set is filled

**"Not yet" fix**
- Previously: closed dialog, exercise stayed un-grayed but no re-fire path
- Now: clears last set's reps, removes exercise from `dialogShownRef`, closes dialog — user re-logs the set, dialog fires again

**Last-set timer sequencing**
- Previously: last-set checkmark fired DONE? dialog AND rest timer simultaneously
- Now: last-set checkmark fires DONE? dialog only — timer is deferred
- On last-set dialogs: "Not yet" is hidden — only Add Set and Done ✓ shown
- Done ✓ marks exercise complete then fires rest timer using next exercise's rest period
- Non-last sets: timer still fires immediately on checkmark, no dialog

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

---

## 6 · Key Code Locations (v1.18.0)

| Item | Location |
|------|---------|
| FOUNDRY_AI_WORKER_URL | ~line 4475 |
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
| NoMesoShell (onStartProgram threaded) | ~line 14535 |
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
| — | DayView AddExerciseModal JSX truncation → workout load failure — restored, brace balance = 0 |
| — | exercises useState after prevWeekNotes useMemo → black screen Week 2+ — order fixed, ErrorBoundary added |
| — | iOS PWA cache serving stale HTML — cache-busting meta tags added |
| — | CompleteDialog RPE buttons neon / hard to read — colors muted, glow reduced |
| — | No/YES buttons low contrast and ambiguous — replaced with solid Not yet / Done ✓ |
| — | "Not yet" left exercise grayed with no re-fire path — now clears last set reps + removes from dialogShownRef |
| — | No way to add sets mid-exercise — + Add a Set in CompleteDialog, phase-gated |
| — | Last-set timer fired simultaneously with DONE? dialog — timer deferred to after Done ✓ |
| — | Last-set DONE? showed "Not yet" unnecessarily — hidden on isLastSet dialogs |

### Feature Gaps (remaining)
| # | Issue | Notes |
|---|-------|-------|
| 17 | Verify past sessions open in editable DayView | Likely already works — needs manual confirmation |
| 21 | Onboarding: new user explore walkthrough | Last major feature — discuss before building |

---

## 8 · Product Roadmap (Priority Order)

1. **Paywall on AI builder** — Free tier gets static generator, Pro gets AI. Clearest monetization lever.
2. **Onboarding share prompt** — Post-program-generation nudge. Low effort, word-of-mouth capture.
3. **Rest day Next Session detail as Pro gate** — Free: session label only. Pro: full exercise list + weights.
4. **Sample program Pro upsell** — "Start this program" → "Get the AI-personalized version with Pro." High-intent moment.
5. **Progress photos** — Camera upload pinned to date. Retention driver and differentiator.
6. **Trainer tier** — Sydney's gym = pilot.
7. **Recovery & Readiness section** — Sleep, stress, HRV.
8. **Body weight benchmarks** — Entry point for users without working weights.
9. **Push notifications** — Requires Capacitor native wrap first.
10. **In-app referral code** — Give friend 30 days free, get 30 days free.

Vite + Capacitor = v2.0 sprint. Trigger: when starting App Store push.

---

## 9 · Standing Instructions

- Ask before making changes not explicitly requested
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app. User uploads manually
- GitHub upload page: https://github.com/Timber-and-Code/Foundry/upload/main
- Working file is Foundry_1_18_0.html going forward
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, beta tester, currently Week 3 of 8-week meso. Refer to Tyler with she/her.
