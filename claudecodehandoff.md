# Foundry — Claude Code Handoff

**Date:** April 5, 2026
**Repo:** C:\Users\TIMBE\Documents\AI PROJECT\FOUNDRY
**GitHub:** Timber-and-Code/Foundry
**Live:** thefoundry.coach
**Current Score:** 9.3/10 (v6 review) — likely higher now after Wave 1+2

---

## What Just Shipped (Waves 1 & 2)

### Pushed to main:
- Toast notification system (ToastContext + Toast component, wired into auth + sync failures)
- program.js → program.ts (last .js util converted)
- Bundle size budget in CI (fails if any chunk > 200KB gzip)
- CSP headers via Cloudflare Pages _headers file
- borderRadius → tokens (partial — 4 files done)
- ExplorePage split (2,111 → 5 files, build passed in worktree but may not have merged)
- `: any` narrowing (234 eliminated, 83 remaining — done in worktree but may not have merged)

### May need re-application in Claude Code:
The ExplorePage split and `: any` narrowing were done in worktree branches. The merge session only merged the toast commit. You may need to redo these two in Claude Code. Check with:
```bash
grep -c ": any" foundry-app/src/components/**/*.tsx 2>/dev/null | sort -t: -k2 -nr | head -10
wc -l foundry-app/src/components/explore/ExplorePage.tsx
```
If `: any` count is still ~300+ or ExplorePage is still 2000+ lines, redo them.

---

## What's Left for 10/10

### Wave 3 (2-4 hours each):
1. **Service Worker** — Add Workbox for offline asset caching. Register in main.tsx. Precache app shell + lazy chunks.
2. **Multi-device sync conflict resolution** — Add timestamps to writes, compare on pull, merge at field level.

### Wave 4 (1 hour):
3. **Color contrast audit** — Run axe-core on all screens, fix muted text on dark backgrounds.

### If not merged from worktrees:
4. **ExplorePage split** — Break into ExerciseBrowser, SamplePrograms, LearnSection, ExerciseDetailModal
5. **Narrow `: any`** — Target files: ScheduleTab, ExtraDayView, DayView, HomeView, ExerciseCard, ExplorePage, HomeTab

### Remaining polish:
6. **Clean up worktree branches** — `git branch | findstr claude` shows 60+ branches. Safe to delete: `git branch -D <branch>` for each.
7. **Fix flaky analytics.test.js** — Worker timeout issue in Vitest.
8. **Remaining borderRadius hardcodes** — ~370 still exist across component files.

---

## Build & Deploy

```bash
# Build (WSL2)
cd /mnt/c/Users/TIMBE/Documents/'AI PROJECT'/FOUNDRY/foundry-app
npm run build

# Test
npm test              # unit tests (vitest)
npm run test:e2e      # playwright (needs dev server running)
npm run test:coverage # coverage report

# Push (auto-deploys)
cd ..
git add foundry-app/ .github/
git commit -m "description"
git push origin main
```

---

## Key Architecture

```
src/
├── App.tsx (452 lines — shell)
├── hooks/useMesoState.ts (320 lines — core state)
├── contexts/
│   ├── AuthContext.tsx (Supabase auth)
│   ├── RestTimerContext.tsx (isolated timer)
│   └── ToastContext.tsx (notifications) ← NEW
├── components/
│   ├── ui/ (Button, Modal, Sheet, Skeleton, Toast)
│   ├── auth/ (AuthPage, UserMenu)
│   ├── home/ (HomeView, HomeTab, ScheduleTab, ProgressTab, MesoOverview, etc.)
│   ├── workout/ (DayView, ExerciseCard, CardioSessionView, etc.)
│   ├── explore/ (ExplorePage + sub-components if split landed)
│   ├── setup/ (SetupPage, AutoBuilderFlow, ManualBuilderFlow, CardioSetupFlow)
│   └── ErrorBoundary.tsx, MinimizedTimerBar.tsx, WeekCompleteModal.tsx
├── utils/
│   ├── store.ts (barrel re-export)
│   ├── persistence.ts, analytics.ts, archive.ts (split from store)
│   ├── sync.ts (Supabase sync + offline queue)
│   ├── program.ts (program generation)
│   ├── validate.ts (Zod schemas)
│   ├── supabase.ts (client)
│   └── helpers.ts, training.ts, api.ts, constants.ts
├── types/index.ts (12 interfaces)
├── styles/tokens.ts (design tokens)
└── __tests__/ (11 test files, 210+ tests)
```

---

## Supabase
- **URL:** https://iwresyrdyalwkowyxxwr.supabase.co
- **Auth:** Email + password, no email confirmation
- **Tables:** user_profiles, mesocycles, training_days, training_day_exercises, workout_sessions, workout_sets, readiness_checkins, body_weight_log, session_prs, cardio_sessions, notes
- **RLS:** All tables, auth.uid() scoped

---

## Preferences
- Don't ask permission — just do it
- Build in WSL2 (Node.js not on native Windows)
- Run vitest before every push
- Use grep + targeted reads, not full file reads
