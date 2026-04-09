# The Foundry

**Science-driven strength training, forged for you.**

The Foundry is a progressive web app that builds personalized periodized training programs. It generates mesocycles calibrated to your experience level and goals, auto-progresses weights session to session, tracks volume landmarks per muscle group, and adapts based on your recovery and readiness — delivering what a $200/month personal trainer would, at a fraction of the cost.

Live at [thefoundry.coach](https://thefoundry.coach)

---

## What It Does

The Foundry takes your experience level, training goal, available equipment, and schedule — then builds a complete mesocycle with periodized volume progression (MEV → MAV → MRV), intelligent exercise selection, and a built-in deload week. Every session, it suggests weights and reps based on your last performance, detects stalling, and adjusts.

**Onboarding** walks you through five screens: name, experience, goal, and a confirmation — each backed by full-bleed Midjourney forge imagery. Then you configure equipment, schedule, and preferences before The Foundry builds your program.

**During a workout**, you get coaching cards with context from your last session, a rep ladder that tells you exactly what to hit, rest timers, and exercise swap options. When you finish, The Foundry logs everything and sets up your next session.

**Between workouts**, you check in with sleep, soreness, and energy ratings. The Foundry uses this readiness data to adjust your RIR targets and feeds it into your next mesocycle's programming.

---

## Key Features

**Program Generation** — Periodized mesocycles (4–8 weeks + deload) with volume progression tailored to experience level. Supports Push/Pull/Legs, Upper/Lower, and Full Body splits at 2–6 days per week.

**Intelligent Progression** — Auto-suggests weights and reps each session based on prior performance. Detects stalling and offers deload or swap recommendations. Experience-aware weight increments (smaller jumps for beginners).

**Volume Landmarks** — Per-muscle MEV, MAV, and MRV tracking with visual progress bars. See exactly where you stand relative to your growth thresholds.

**Recovery & Readiness** — Daily sleep, soreness, and energy check-ins. Readiness score influences RIR recommendations and feeds into meso 2+ programming via recovery profiles.

**Exercise Library** — 150+ exercises with muscle group tags, equipment requirements, and swap suggestions. The Foundry selects exercises that match your equipment and goals.

**Cardio Integration** — Post-meso cardio scheduling with protocol options (steady state, intervals, conditioning). Woven into your weekly calendar.

**Mobility System** — Dynamic warmup protocols (pre-workout) and static cooldown stretches (post-workout), split by training day type.

**1RM Estimates** — Tracks estimated one-rep maxes across compound lifts with trend visualization.

**Progress Tracking** — Volume per muscle group over time, session completion rates, bodyweight logging, and meso archive history.

**Guided Tour** — Interactive walkthrough that navigates you through each tab (Home, Schedule, Progress, Explore) on first launch.

---

## Tech Stack

The Foundry is a single HTML file (~19,500 lines) running React 18 from CDN with no bundler or build step. All state lives in localStorage. The AI program builder runs on a Cloudflare Worker backed by Anthropic's Claude API.

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, single HTML file, no bundler |
| Styling | CSS custom properties, inline styles |
| State | localStorage (`ppl:` legacy, `foundry:` new) |
| AI Backend | Cloudflare Worker + Claude API |
| Hosting | GitHub Pages |
| Domain | thefoundry.coach (GoDaddy DNS) |
| Email | Brevo API (early access list) |
| Images | Midjourney-generated, base64-embedded |

---

## Getting Started

No build step required. Open the HTML file in any modern browser.

To start fresh: open the browser console and run `localStorage.clear(); location.reload();` — this resets all data and shows the onboarding flow.

### Development

Since this is a single HTML file with no dependencies, development is straightforward: edit the file, refresh the browser.

For the AI program builder to work, you need the Cloudflare Worker running with an Anthropic API key. See the worker setup section in the SYNOPSIS for details.

---

## Project Structure

```
Foundry/
  Foundry_1_35_0.html     # The entire app (current version)
  SYNOPSIS_1_35_0.md       # Detailed project synopsis and technical reference
  README.md                # This file
  Archive/                 # Previous versions and their synopses
```

---

## Pricing

| Tier | Price | Access |
|------|-------|--------|
| Free | $0 | Under 18 and adults 62+ — permanently free |
| Pro | $12/mo or $99/yr | Full program builder, meso 2+ intelligence, advanced coaching |
| Trainer | $29/mo or $249/yr | Multi-client management (coming soon) |

---

## Roadmap

**Current (v1.35.0)** — Premium onboarding, forge branding, tour navigation, "The Foundry" brand language, dark-only theme.

**Next** — Vite + Capacitor migration (enables App Store, push notifications, paywall), Supabase user accounts, payment integration.

**Future** — Body map visualization, trainer tier with multi-client dashboards, push notification reminders, advanced recovery analytics.

---

## License

Proprietary. All rights reserved.

Built by [Timber & Code](https://github.com/Timber-and-Code).
