# The Foundry

> Periodized strength training. Built like a coach thinks.

**[Launch App](https://timber-and-code.github.io/Foundry/)** · [Synopsis](./SYNOPSIS.md)

---

The Foundry is a progressive overload training PWA that generates personalized mesocycles, auto-progresses weights, and tracks volume landmarks — the kind of structured programming that used to require a $200/month coach.

No account required. No app store. Open it in your browser and start training.

## What it does

- Builds periodized 4–8 week training blocks (Push / Pull / Legs and custom splits)
- Auto-progresses weight based on rep performance each week
- Tracks volume per muscle group against MEV / MAV / MRV landmarks
- Generates warmup ramps from your working weight
- Rest timer, cardio logging, bodyweight tracking, session duration
- AI-powered program builder and exercise swap suggestions
- e1RM estimates with loading suggestions in Progress tab
- Post-workout summary after every session

## Free forever

- **Under 18** — no paywall, no credit card
- **Adults 62+** — no paywall, no credit card

Strength training at those ages matters most. It should cost nothing.

## Stack

Single HTML file. React 18 via Babel CDN. All data in localStorage. No backend, no login, no tracking.

```
Foundry_1_13_0.html   — current build
SYNOPSIS.md           — living project document, updated every session
```

## Status

Active development. Currently v1.13.0. Moving to React + Vite (v2.0) → Capacitor → App Store.

---

Built by [Timber-and-Code](https://github.com/Timber-and-Code)
