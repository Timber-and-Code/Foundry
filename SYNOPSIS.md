# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.13.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

Every feature decision, pricing tier, and growth initiative must be evaluated against this target. A beautiful app that doesn't convert is a hobby. We are building a business.

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
- Tyler's existing trainer/client network is the primary warm acquisition channel
- Every trainer using the app is a distribution node — 10 trainers × 20 clients = 200 users from 10 conversations

---

## 3 · Technical Foundation

| Property | Value |
|----------|-------|
| Architecture | Single HTML file — React 18 via Babel standalone, no build step |
| Storage | All data in localStorage under `ppl:` namespace |
| Deployment | GitHub Pages — push to main = live |
| API | Anthropic `claude-sonnet-4-20250514` for AI program builder |
| Migration target | React + Vite at v2.0 (mechanical, no new features) |
| Post-migration | Capacitor wrap → iOS + Android → App Store |

**Current file:** `Foundry_1_13_0.html` / `index.html` on GitHub Pages

---

## 4 · Features Shipped

### v1.13.0 (current)

| Feature | Detail |
|---------|--------|
| Rest timer | Centered splash modal, countdown, dismiss. Fires after sets 1–(N-1) only — skips after last set. |
| Post-workout summary | Sets / reps / volume / duration / phase cue |
| PR Sparklines | Progress tab only — 8-week trend per exercise |
| Bodyweight log | Weekly check-in, chart in Progress tab |
| Session duration | Strength timing only. Stamps at last exercise confirmed done. Separate from cardio. |
| e1RM | Progress tab — 75% and 85% loading suggestions |
| RPE logging | Stored per set. Prompted in DONE? dialog — Easy / Good / Hard. No strip on card. |
| Post-strength prompt | After last exercise: "Log Cardio →" or "Finished for Today" |
| Assisted Pull-up / Chin-up | Exercise DB entries with `assisted: true`. Weight column shows "ASSIST ↓". |
| AI program builder | UI complete. Currently runs local rule-based generation. Real AI backend pre-App Store. |

---

## 5 · Standing Product Decisions

| Decision | Rationale |
|----------|-----------|
| Free tier for under-18 and 62+ | Moral stance + acquisition. Young athletes build habits. Older adults need it most. |
| RPE in DONE? dialog, not card strip | Reduces noise during logging. Natural moment to reflect is after the exercise, not mid-set. |
| No sparklines on exercise card | Card is for logging. Analysis lives in Progress tab. |
| Session duration = strength only | Cardio is separate. Don't inflate strength session metrics with treadmill time. |
| AI backend server-side only | Never expose API key client-side. Cloudflare Worker / Vercel proxy pre-App Store. |
| Stay in Claude.ai chat until v2.0 | Single-file stage doesn't justify losing persistent memory. Migrate when project splits into files. |

| **Next major** | v2.0 React + Vite migration → Capacitor → App Store |

---

## 6 · Roadmap — What's Next

### Completed This Session (post-1.13.0)

| Feature | Status |
|---------|--------|
| Assisted Pull-up + Assisted Chin-up in exercise DB | ✓ |
| Weight column shows "ASSIST ↓" for assisted exercises | ✓ |
| Rest timer skips after last set — goes straight to DONE? prompt | ✓ |
| RPE picker added to DONE? dialog — Easy / Good / Hard, saves to last set | ✓ |
| Post-strength cardio prompt — "Log Cardio" or "Finished for Today" | ✓ |
| Session duration stamps at strength end, not cardio end | ✓ |

### Remaining Build Queue (v1.13.x)

| Feature | Rationale |
|---------|-----------|
| AI builder error handling | Retry button + graceful fallback to pre-built program |
| 5-day PPL leg warning | Detect PPLPP layout, surface volume gap, offer fix |
| Fatigue signal | Flag stalling anchor lifts over 2+ consecutive weeks |

### Platform Milestones

| Phase | Scope |
|-------|-------|
| v1.13.x → feature complete | AI error handling, 5-day PPL fix, fatigue signal |
| v2.0 — April Wk 3 | React + Vite migration. Mechanical. No new features during this phase. |
| **AI Backend — pre-App Store** | Cloudflare Worker or Vercel serverless proxy. API key lives server-side. One route: take builder params → call Anthropic → return program JSON. ~40 lines. Unblocks real AI generation before store submission. |
| Capacitor — April Wk 3 | Wrap for iOS + Android. Native haptics, push notifications. |
| Store Launch — April Wk 4 | Soft launch to Tyler's client network. Then paid acquisition + referral loop. |

---

## 7 · Ongoing Development Directive

**STANDING INSTRUCTION:** Proactively raise ideas each session that advance the $100K revenue target or meaningfully improve the product — pricing angles, growth levers, feature differentiation, monetization. Don't wait to be asked. Deliver an updated `SYNOPSIS.md` at the end of every build session.

### Ideas to Keep Raising
- Age-appropriate defaults — lower RIR, fewer sets, more recovery days for under-18 and 62+
- Team / school licensing — a coach account managing 20 athletes is a $29/mo sale
- Trainer referral program — affiliate cut for every paying user they bring in
- Shareable programs — "Tyler's 12-Week Block" as a link. Marketing and retention in one feature.
- Annual plan prominence — $99/yr vs $12/mo. Annual subscribers churn at 1/3 the rate.
- Streak / consistency nudges — "You've trained 11 of the last 14 days" in the summary modal
- Post-workout share card — Instagram-friendly summary. Free marketing from every session.

---

## 8 · Key Code Locations (1.13.0 + session patches)

| Item | Location |
|------|----------|
| `callFoundryAI()` | ~line 3855 — fully written, not yet wired to real API call |
| `handleAutoSubmit()` | ~line 4110 — runs local generation, passes to `onComplete()` |
| `CompleteDialog` | ~line 5626 — RPE picker (Easy/Good/Hard) + YES/No |
| `RPE_OPTS` | Just above `CompleteDialog` |
| `handleDialogYes(rpe)` | ~line 6985 — saves RPE to last set, stamps `strengthEndRef` on last exercise |
| `strengthEndRef` | In DayView state — stamped when last exercise confirmed done |
| `showPostStrengthPrompt` | Modal: "Log Cardio →" or "Finished for Today" |
| `loadBwLog / saveBwLog` | After `loadExerciseHistory()` ~line 436 |
| `loadSparklineData()` | Same block |
| `ExerciseSparkline` component | Just before `ExerciseCard` — dead code, not rendered |
| `doComplete()` | Uses `strengthEndRef` for duration, then computes stats |
| Assisted exercises | `pullups_assisted`, `chinups_assisted` in EXERCISE_DB. Flag: `assisted: true` |
| ASSIST ↓ label | In ExerciseCard set row weight column — checks `exercise.assisted` |
