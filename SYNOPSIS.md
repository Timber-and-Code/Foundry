# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.13.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

Every feature decision, pricing tier, and growth initiative must be evaluated against this target. A beautiful app that does not convert is a hobby. We are building a business.

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
- Every trainer using the app is a distribution node — 10 trainers x 20 clients = 200 users from 10 conversations
- Trainer tier at $29/mo = 2.4x a Pro subscription with zero extra feature cost

---

## 3 · Free Access: Youth & Seniors

**Under 18 — Free Forever**
A 16-year-old who builds their first program on The Foundry is a paying Pro user at 22. Future: school/team licensing model.

**Adults 62+ — Free Forever**
Strength training after 60 reduces fall risk, maintains bone density, extends functional independence. This group is profoundly underserved. An older adult who loves the app tells their adult children. The adult children pay Pro.

---

## 4 · Technical Foundation

| | |
|---|---|
| **Stack** | React 18 (Babel CDN) · Single HTML file · localStorage · Anthropic API (Claude Sonnet) |
| **Storage** | All keys under ppl: namespace · No backend · Export/import backup always functional |
| **AI** | Claude API for program generation · Superset suggestions · Swap recommendations |
| **File** | Single .html file. No splitting until Capacitor. |
| **Versioning** | MAJOR.MINOR.PATCH — e.g. Foundry_1_13_0.html |
| **Next major** | v2.0 React + Vite migration -> Capacitor -> App Store |

### Hard Rules — Never Break
- Single file always. No splitting until Capacitor.
- Warmup sets excluded from ALL calculations — volume, PRs, progression, history.
- All localStorage keys under ppl: namespace.
- Export / import backup must remain functional at all times.
- Deliver an updated SYNOPSIS.md at the end of every build session.

---

## 5 · What's Built — v1.12 Through v1.13.0

| Feature | Notes |
|---------|-------|
| Light mode QA | 20 screens audited |
| No-meso Explore flow | NoMesoShell with sticky Build My Program CTA |
| Weight auto-suggest | Carry-forward from prior week + +5lb nudge |
| Onboarding revamp | 3 screens: brand splash, the loop, quick intro |
| Supersets | Manual pairing, AI antagonist suggestions, deferred rest timer |
| Cardio logging | CardioBlock: type/duration/intensity |
| Deload week treatment | DELOAD WEEK pill, explanation banner, recovery subtitle |
| Warmup ramp autogen | generateWarmupSteps() — computes actual lbs from set 0 |
| Rest timer splash | Centered full-overlay modal with SVG ring. Blue -> amber -> red. |
| Post-workout summary splash | Sets · Reps · Volume · Time · Phase cue · Quote. Centered modal. |
| PR Sparklines | SVG line chart per exercise in Progress tab. PR badge on all-time best. |
| Bodyweight log | Weekly check-in prompt. Trend chart in Progress with delta. 52-entry rolling. |
| Session duration tracking | Timestamp on mount -> delta on complete. Bar chart in Progress. |
| e1RM in Progress tab | Epley formula. Anchor lifts with 75%/85% loading suggestions. PR badge. |
| RPE logging | Stored per set. Not currently surfaced in UI — parked for future. |

---

## 6 · Roadmap — What's Next

### Remaining Build Queue (v1.13.x)

| Feature | Rationale |
|---------|-----------|
| AI builder error handling | Retry button + graceful fallback to pre-built program |
| 5-day PPL leg warning | Detect PPLPP layout, surface volume gap, offer fix |
| Fatigue signal | Flag stalling anchor lifts over 2+ consecutive weeks |

### Platform Milestones

| Phase | Scope |
|-------|-------|
| v1.13.x -> feature complete | AI error handling, 5-day PPL fix, fatigue signal |
| v2.0 — April Wk 3 | React + Vite migration. Mechanical. No new features during this phase. |
| Capacitor — April Wk 3 | Wrap for iOS + Android. Native haptics, push notifications. |
| Store Launch — April Wk 4 | Soft launch to Tyler's client network. Then paid acquisition + referral loop. |

---

## 7 · Ongoing Development Directive

**STANDING INSTRUCTION:** Proactively raise ideas each session that advance the $100K revenue target. Deliver an updated SYNOPSIS.md at the end of every build session.

### Ideas to Keep Raising
- Age-appropriate defaults — lower RIR, fewer sets, more recovery days for under-18 and 62+
- Team / school licensing — a coach account managing 20 athletes is a $29/mo sale
- Trainer referral program — affiliate cut for every paying user they bring in
- Shareable programs — Tyler's 12-Week Block as a link. Marketing and retention in one feature.
- Annual plan prominence — $99/yr vs $12/mo. Annual subscribers churn at 1/3 the rate.
- Progress share card — shareable PR card or meso completion card. Organic social loop.
- Corporate wellness — $99/employee/yr. 50 employees = $5K from one conversation.

---

## 8 · Key Architecture Reference

| Function | Role |
|----------|------|
| generateProgram() | Builds day/exercise array from profile. Source of truth for program structure. |
| toEx() | Converts DB exercise -> program exercise object. All fields must thread through here. |
| loadDayWeekWithCarryover() | Loads week data with weight carry-forward + nudge logic. |
| generateWarmupSteps() | Computes actual lbs for warmup ramp from set 0 working weight. |
| calcMuscleSetsByTag() | Volume landmark computation per muscle group. |
| loadSparklineData() | Returns [{week, bestWeight, bestReps, e1rm}] for sparklines + e1RM card. |
| addBwEntry() | Adds bodyweight log entry. One per calendar day, 52-entry rolling window. |
| saveSessionDuration() | Stores lifting session duration in minutes per day/week. |
| startRestTimer() | Fires rest countdown. Centered splash modal with SVG ring. |
| WorkoutCompleteModal | Post-session splash: stats grid + phase cue + quote. |

---

*End of Synopsis — v1.13.0 · March 2026*
