# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.16.0 · March 2026**

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
- Tyler's business banking network is the primary warm acquisition channel
- Every trainer using the app is a distribution node — 10 trainers × 20 clients = 200 users from 10 conversations
- James's niece Sydney (works at a gym) = target for trainer tier pilot + real-user feedback

### Revenue Opportunities Surfaced This Session
- **Rest day "Next Session" preview as a Pro gate** — free users see session label only; Pro users see full exercise list, prescribed weights, and volume targets. Hits users at peak motivation (thinking about tomorrow's workout). Low-friction gate, high perceived value.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~14,679 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker → `https://foundry-ai.timberandcode3.workers.dev` |
| AI Key | Stored as Cloudflare Worker secret `ANTHROPIC_API_KEY` — never in source |
| Hosting | GitHub Pages — `https://timber-and-code.github.io/Foundry` |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | `~/foundry-worker/worker.js` + `wrangler.toml` on James's WSL2 machine |

**Vite/Capacitor migration:** Deferred until App Store push (v2.0 sprint). No current bottleneck.

---

## 4 · Current Version — v1.16.0

### What's New in v1.16.0

**#24 — Font-weight 900 now loaded**
- Google Fonts Inter subset updated to include weight 900
- All numeric displays, timer, GO button, stat values now render at true intended weight

**#18 — Exercise history: week context + reverse chronological**
- History modal rows now show WEEK N · PHASE · RIR (e.g. WEEK 4 · INTENSIFICATION · 1-2 RIR)
- Most recent week appears first

**#15 — PR callout in workout complete modal**
- detectSessionPRs() utility — runs at doComplete() for both meso and extra sessions
- Compares today's best weight per exercise against all prior logged weeks/sessions
- Gold trophy PR section in WorkoutCompleteModal; single PR inline, multiple as card-list with delta
- All exercises (not just anchors), weight-only, meso + extra sessions

**#16 — Bodyweight trend: goal weight + history list**
- BwChart renders for single-entry (no blank state)
- Inline goal weight field saves to ppl:bwGoal; renders as gold dashed line on sparkline
- GOAL: X lbs with "Reached!" or "On track" indicator
- Tap-to-expand HISTORY panel: all entries reverse-chronological with per-entry delta

**#19 — Haptic feedback**
- haptic(type) utility with patterns: tap, done, complete, victory
- Set logged → tap; exercise done → done; rest timer → done; workout complete → complete; PRs hit or BW goal reached → victory
- iOS Safari silently ignores navigator.vibrate — activates at Capacitor wrap (v2.0)

**#23 — Rest day content**
- Tapping any non-session calendar day opens a rest day bottom sheet
- 10 curated rest-day quotes (deterministic by date), Recovery Essentials (Sleep/Protein/Walk)
- Targeted mobility by yesterday's session tag (PUSH/PULL/LEGS), next session preview
- Add Extra Session CTA for today/future days; past days show content only

**#22 — Edit Schedule + Skip Day**

Skip Day:
- Skip toggle on future, un-started meso days in WeekSection (Deload week exempt)
- Skipped days render dimmed with SKIPPED badge; Restore to undo
- Stored in ppl:skip:d{d}:w{w}; does not affect past completions

Edit Schedule (day-of-week remap):
- "Edit Schedule" button in Schedule tab header opens 7-day picker sheet
- Must select same count as current schedule; count validator with live feedback
- On save: scope prompt — "This week only (WN)" or "Rest of meso"
  - This week only: appends remap entry + automatic revert entry for next week
  - Rest of meso: single entry applies from current week forward permanently
- Changes immediately reflected on calendar and WeekSection day labels

workoutDaysHistory data model:
- profile.workoutDaysHistory = [{ fromWeek: 0, days: [...] }, ...] — ordered era entries
- getWorkoutDaysForWeek(profile, weekIdx) — returns last entry where fromWeek <= weekIdx
- ensureWorkoutDaysHistory(profile) — bootstraps from legacy profile.workoutDays on first remap
- All session walks updated to use per-week days (main calendar, rest day mobility, next-session)
- isWorkoutDay in calendar derived from sessionDateMap membership — always accurate post-remap
- Full backwards compatibility: no history falls back to profile.workoutDays

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON (now includes workoutDaysHistory) |
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

## 6 · Key Code Locations (v1.16.0)

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
| WorkoutCompleteModal (PR callout) | ~line 6200 |
| ExtraDayView | ~line 7515 |
| DayView | ~line 8016 |
| ExerciseCard (haptic tap on set log) | ~line 6816 |
| WeekSection (skip toggle) | ~line 9955 |
| BwChart (goal weight + history) | ~line 9480 |
| HomeView | ~line 11368 |
| Edit Schedule sheet | ~line 12770 |
| Rest day sheet | ~line 12560 |
| Calendar grid + history-aware session walk | ~line 12145 |
| App view routing | ~line 14580 |

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
| 22 | No way to update schedule mid-meso — skip toggle + Edit Schedule with history model |
| 23 | No rest day content — bottom sheet with quotes, recovery, mobility, next session |
| 24 | font-weight 900 not loaded — Google Fonts subset updated |

### Feature Gaps (remaining)
| # | Issue | Notes |
|---|-------|-------|
| 17 | Verify past sessions open in editable DayView | Likely already works — needs manual confirmation |
| 20 | Explore sample programs: Start this program button | Deferred — discuss alongside #21 |
| 21 | Onboarding: new user explore walkthrough | Deferred — discuss before building, last feature |

---

## 8 · Product Roadmap (Priority Order)

1. Paywall on AI builder — Free tier gets static generator, Pro gets AI. Clearest monetization lever.
2. Onboarding share prompt — Post-program-generation nudge. Low effort, word-of-mouth capture.
3. Rest day Next Session detail as Pro gate — Free: session label only. Pro: full exercise list + weights.
4. Progress photos — Camera upload pinned to date. Retention driver and differentiator.
5. Trainer tier — Sydney's gym = pilot.
6. Recovery & Readiness section — Sleep, stress, HRV.
7. Body weight benchmarks — Entry point for users without working weights.
8. Push notifications — Requires Capacitor native wrap first.
9. In-app referral code — Give friend 30 days free, get 30 days free.

Vite + Capacitor = v2.0 sprint. Trigger: when starting App Store push.

---

## 9 · Standing Instructions

- Ask before making changes not explicitly requested
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app. User uploads manually
- GitHub upload page: https://github.com/Timber-and-Code/Foundry/upload/main
- Working file is Foundry_1_16_0.html going forward
- Outputs always copied to /mnt/user-data/outputs/
