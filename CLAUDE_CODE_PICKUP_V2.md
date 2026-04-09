# Claude Code Pickup v2 — Path to 10/10 (continued)

**Date:** April 8, 2026
**Last session score estimate:** ~9.5 (up from 9.2)
**Target:** 9.85+

---

## What was shipped last session

- All 6 failing tests fixed → 248/248 pass
- All empty catch blocks annotated (toast for save failures, console.warn for parse fallbacks)
- Component-layer localStorage routed through store barrel (added store.remove + store.keys)
- `window.__foundryPendingCompletion` hack replaced with React ref
- Session duration picker + superset UI + inverse volume scaling

**Do NOT re-audit or redo these items.**

---

## What to do this session (in priority order)

### 1. DayView split — PARTIALLY DONE (another agent shipped commit 22aa0f5)

Already extracted into separate files:
- `src/components/workout/CardioPromptModal.tsx` (41 lines)
- `src/components/workout/UnfinishedPromptModal.tsx` (41 lines)
- `src/components/workout/NoteReviewSheet.tsx` (101 lines)
- `src/components/workout/SwapScopeSelector.tsx` (94 lines)
- `src/hooks/useWorkoutTimer.ts` (93 lines — shared timer hook)

DayView reduced by ~400 lines, ExtraDayView by ~150 lines.

**What's still needed:**
- Extract `CompletionFlow` (stats calculation + WorkoutCompleteModal orchestration)
- Extract `SwapSheet` (exercise swap UI + picker — SwapScopeSelector is just the scope part)
- Extract `useWorkoutSession` hook for shared set logging, notes, swap, completion logic between DayView and ExtraDayView
- Check that 248/248 tests still pass after the other agent's changes
- MesoOverview.tsx was also updated with proper types (Profile, TrainingDay)

### 2. Narrow remaining `:any` types — IN PROGRESS (concurrent agent working on this)

A concurrent agent is actively narrowing `:any` across the codebase (Phase 2C). Check `git log --oneline -10` at session start to see how far it got. If it finished, verify with:
```bash
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | wc -l
```
Target: near zero. If some remain, finish them off.

### 3. Typed event emitter

Create `src/utils/events.ts` (~30 lines):
```typescript
type EventMap = {
  'foundry:openCardio': void;
  'foundry:resetToSetup': void;
  'foundry:welcomed': void;
  'foundry:wants_auth': void;
  'foundry:showPricing': void;
  'foundry:pull-complete': void;
  'foundry:toast': { msg: string; type?: 'info' | 'error' | 'success' };
};
```
Replace all `window.dispatchEvent(new CustomEvent(...))` and `window.addEventListener(...)` calls.

### 4. Cardio history view

`loadCardioLog()` exists in `persistence.js` but is never called. Add a "Cardio History" section to ProgressView showing past sessions (date, protocol, duration, intensity). Data lives in `foundry:cardio:session:YYYY-MM-DD` localStorage keys.

### 5. Quick cleanup

- **Remove zod dependency** — only `schemas.ts` (46 lines) uses it, manual validators in `validate.ts` work fine
- **Add `tokens.radius.full = '50%'`** to `src/styles/tokens.ts`, replace 19 hardcoded `borderRadius: '50%'` instances

---

## Verification

After each phase:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 248/248 pass
3. Commit after each phase

## Preferences
- Don't ask permission, just do it
- Run vitest before every push
- Commit after every phase
- Update memory after shipping
