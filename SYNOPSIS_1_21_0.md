# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.21.0 · March 2026**

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
- Tyler (James's wife, works in business banking) and James are active beta testers — currently Week 4 of 8
- Tyler's business banking network is the primary warm acquisition channel
- James's daughter and a friend are also beta testing
- Sydney (works at a gym) = target pilot for the Trainer tier

### Revenue Opportunities (Surfaced & Standing)
- **AI builder paywall** — Free tier gets static generator, Pro gets AI. Post-Vite. `ppl:pro` reserved.
- **Cardio plan as Pro gate** — Free: log freely, full guided timer. Pro: meso-integrated plan, goal-based recommendations.
- **Rest day Next Session as Pro gate** — free users see session label only; Pro see full exercise list + weights.
- **Sample programs as conversion funnel** — "Start this program" → "Get the AI-personalized version with Pro."
- **Free tier for Under 18 / 62+** — young users become paying adults; older users convert adult children.
- **Pricing page** — should exist inside the app before paywall goes live.
- **Email capture** — "Weekly training summary" CTA gives re-engagement list before Capacitor push notifications.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~17,082 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker at foundry-ai.timberandcode3.workers.dev |
| AI Key | Stored as Cloudflare Worker secret ANTHROPIC_API_KEY — never in source |
| Hosting | GitHub Pages — timber-and-code.github.io/Foundry |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | ~/foundry-worker/worker.js + wrangler.toml on James's WSL2 machine |

**Critical invariant:** `exercises` useState MUST be declared before `prevWeekNotes` useMemo. Reversing causes black screen on Week 2+.

**Key distinction:** `activeWeek` (computed from completedDays) vs `currentWeek` (stored). All user-facing displays use `activeWeek`. Passing `currentWeek` to WeekSection was the source of 4 bugs in v1.21.0.

**Hooks rule:** Never use React.useState or React.useEffect inside an IIFE in JSX — always extract as a proper named component.

**Timer architecture (v1.21):** Rest timer state lives in App. Props: `restTimer`, `restTimerMinimized`, `setRestTimerMinimized`, `startRestTimer`, `dismissRestTimer` passed to DayView. Global minimized bar at App level (zIndex 500). `timerDayRef` tracks session for navigate-back.

**Today-done detection (v1.21):** Uses `ppl:completedDate:d${d}:w${w}` written by `markComplete()`. Do NOT use `findIndex` of first incomplete — that advances to next day the moment a session finishes.

**Brace balance check — mandatory before every ship:**
```
node --input-type=module -e "import{readFileSync}from'fs';const s=readFileSync('file.html','utf8').match(/<script type=\"text\/babel\">([\s\S]*)<\/script>\s*<\/body>/)[1];let d=0;for(const c of s){if(c==='{')d++;else if(c==='}')d--;}console.log('depth:',d);"
```

**Vite/Capacitor migration:** Deferred to v2.0. Post-migration data layer: Supabase (auth + PostgreSQL + RLS). Sprint plan: 1=Vite, 2=Supabase auth, 3=data migration dual-write, 4=localStorage removed.

---

## 4 · Version History

### v1.21.0 — Session Flow Redesign + Bug Sweep + Product Depth

**8 bug fixes:**
1. Past session display — opacity 1 in readOnly mode. Full contrast, non-editable.
2. CURRENT badge — WeekSection/DeloadSection receive `activeWeek` not `currentWeek`.
3. Skip on Home tab — button + confirm modal on Today card, same `setSkipped()` as Schedule tab.
4. Phase card day-pill — `onSelectDayWeek(i, activeWeek)` not `onSelectDay(i)`.
5. "Too Low" → "MV" (Maintenance Volume) — blue (`#2563a8`/`#5ba8ff`) replacing red.
6. Rest timer persistence — lifted to App, survives tab navigation.
7. Minimized timer — green full countdown, red final 15%. Tap navigates back to DayView.
8. Session complete weekIdx — `completionWeekIdx` snapshot. ExtraDayView hardcoded 0 fixed.

**Session flow redesign:**
- Pre-workout overlay: phase pill + focus block unified into one card (pill = header, focus = body).
- Completion screen: Card 1 (stats + PRs) + Card 2 (quote, no label). "THIS WEEK" removed.
- Quote fires at session close. No motivational subtext anywhere.

**Rest card (post-session home):**
- `markComplete()` writes `ppl:completedDate` — today-done detected by date match not findIndex.
- Three variants: cardio pending (CTA), cardio done (clean), no cardio (clean).
- Collapsed "Next Session" row below with expand chevron.
- `RECOVERY_TIPS` array (14 tips) in plain script block. Stable via `useState` in HomeView.
- `showNextSession` resets on `activeWeek` change.

**Meso retrospective:**
- Replaces dead-end "Meso Complete / Done" modal.
- Anchor lift progression (W1 → peak, delta), sessions completed/total, total PRs, total volume.
- "Start Next Meso →" wired to `handleReset`. Data computed in `handleComplete` when `isFinal`.

**Post-session anchor comparison:**
- VS LAST WEEK card on completion screen. Anchor lifts: prev → today + delta.
- Renders only when weekIdx > 0 and prior week data exists. Clean on Week 1.

**Equipment-aware swap sheet:**
- Defaults to `profile.equipment` filter. Toggle pill to show all.
- Empty state has "Show all →" inline link.

**Exercise Library filter panel:**
- Replaced pill rows with Filters button + collapsible panel.
- Four sections: Muscle Group, Equipment, Movement (friendly labels), Split Tag.
- Apply button shows live count. Active filter chips when panel closed.

**Explore tab icons (Lucide SVG):**
- Exercise Library: grid-3x3. Sample Programs: layers. Learn the System: lightbulb.
- Subtitle: "How To's & Supporting Videos".

**Visual polish:**
- Setup labels: `var(--phase-intens)` replacing `var(--accent)`.
- Cardio dark: `#6ee7a0`. Cardio light: `#1a8a52`.
- Tour spotlight: box-shadow cutout (9999px) — element shows through.

---

### v1.20.0 — Cardio System + Goal Framework + Onboarding Rewrite
Cardio (8 protocols, guided timer). GOAL_OPTIONS (5 goals). Onboarding 3-screen rewrite. TourOverlay 4-stop spotlight.

### v1.19.0 — Polish & Visual Systems
Type floor, contrast fixes, PR Tracker redesign, rest timer improvements, Volume Check labels.

### v1.18.0 — Explore Launch + CompleteDialog Overhaul
Sample programs, CompleteDialog RPE redesign, ErrorBoundary, iOS cache-busting.

---

## 5 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON |
| ppl:done:d{d}:w{w} | Session completion flag |
| ppl:completedDate:d{d}:w{w} | **v1.21** ISO date of completion. Used for today-done home tab detection. Cleared by resetMeso(). |
| ppl:day{d}:week{w} | Set/rep data |
| ppl:sess:lift:d{d}:w{w} | Session duration (minutes) |
| ppl:sessionStart:d{d}:w{w} | Session start timestamp |
| ppl:strengthEnd:d{d}:w{w} | Strength phase end timestamp |
| ppl:extra:YYYY-MM-DD | Extra session object |
| ppl:extra:done/start/end/data:YYYY-MM-DD | Extra session flags/data |
| ppl:cardio:session:YYYY-MM-DD | Standalone cardio session |
| ppl:bwlog | Bodyweight log array |
| ppl:skip:d{d}:w{w} | Skip flag |
| ppl:currentWeek | Stored week index (use activeWeek for display) |
| ppl:theme | Theme preference |
| ppl:archive | Completed meso archive (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override |
| ppl:notes/exnotes:d{d}:w{w} | Session + exercise notes |
| ppl:onboarded / ppl:show_tour / ppl:toured | Onboarding + tour flags |
| ppl:pro | Reserved — Pro tier (post-Vite) |

---

## 6 · Key Code Locations (v1.21.0)

| Item | Approx Line |
|------|------------|
| CONGRATS array | ~2734 |
| RECOVERY_TIPS array | ~2745 |
| GOAL_OPTIONS / CARDIO_WORKOUTS | ~2867 / ~2900 |
| markComplete (writes completedDate) | ~3432 |
| resetMeso (clears completedDate) | ~3485 |
| PHASE_COLOR / TAG_ACCENT | ~3834 |
| SwapModal (equipment-aware) | ~7242 |
| WorkoutCompleteModal (2-card + anchor comparison) | ~6829 |
| DayView (timer props in signature) | ~9140 |
| exercises useState (MUST stay before prevWeekNotes) | ~9180 |
| handleSetLogged / startRestTimer calls | ~9340 |
| HomeView (recovery tip, rest card, showNextSession) | ~12679 |
| HomeView today-done detection (completedDate) | ~13090 |
| ExplorePage (filter panel, Lucide icons) | ~11979 |
| App timer state/refs/callbacks | ~15929 |
| App handleComplete (meso retrospective) | ~16314 |
| App global minimized timer bar | ~16599 |
| App weekCompleteModal (retrospective render) | ~16471 |
| ErrorBoundary | ~16620 |

---

## 7 · QA Tracker

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| — | Post-strength "Log Cardio" timing | onBack() + 80ms delay — test on device |
| — | goalNote passthrough | Not yet passed to callFoundryAI |

### Resolved in v1.21.0
All 8 bugs listed above. Plus: DB RDL missing from swap sheet, SwapModal showing all equipment.

---

## 8 · Product Roadmap (Priority Order)

1. **Vite + Capacitor migration (v2.0)** — App Store, Pro paywall, Trainer tier. Supabase post-migration.
2. **Pricing page inside the app** — Information architecture before paywall goes live.
3. **Email capture** — "Weekly training summary" re-engagement before push notifications.
4. **AI builder paywall** — Post-Vite. `ppl:pro` reserved.
5. **Trainer tier pilot** — Sydney's gym. Post-Capacitor.
6. **Cardio plan as Pro gate**
7. **Smart Rep Progression** — phase-aware rep suggestions for isolation/BW.
8. **Stalling detection + coaching nudges**
9. **In-app referral** — 30 days free for both parties.
10. **Warm-up timer** — Guided timed walk-through of ramp sets.
11. **Progress photos** — Camera upload pinned to date.
12. **Push notifications** — Requires Capacitor.
13. **Foundry Whole Health** — Revisit at ~$30K ARR.

---

## 9 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays must live in a plain script tag — never in the Babel block
- `const` redeclaration across script tags crashes the entire app silently
- Components must be proper top-level named function declarations
- React hooks cannot be called inside an IIFE in JSX
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — permanent invariant
- **Brace balance check is mandatory before every ship** — depth must be 0
- str_replace including closing `}}` or `/>` in old_str can silently delete the following element
- `activeWeek` (computed) ≠ `currentWeek` (stored) — always use activeWeek for display
- Today-done detection requires `ppl:completedDate` — not findIndex of first incomplete
- Global state surviving tab navigation must live in App — timer is the canonical example
- The real moat: coaching intelligence — stalling detection, phase-aware progression, RIR targets

---

## 10 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (Foundry_1_21_0.html)
- Outputs always copied to /mnt/user-data/outputs/
- Tyler = James's wife, works in business banking, active beta tester Week 4/8 (she/her)
- James's daughter + her friend also beta testing — keep ungated until post-Vite
- Sydney (works at a gym) = Trainer tier pilot target
