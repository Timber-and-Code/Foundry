# Claude Code Pickup V2 — Foundry Path to 10/10

**Last updated:** 2026-04-08
**Score:** 9.2 → ~9.8 after all V2 work

---

## ✅ DONE (do not redo)

### Session 1 (pickup doc)
| Item | Commit | Notes |
|------|--------|-------|
| Session duration picker | `bcaa00f` | 30/45/60/75/90m in both AutoBuilder + ManualBuilder |
| Superset partner badge | `bcaa00f` | ExerciseCard shows superset indicator |
| `:any` narrowing (partial) | `bcaa00f` | ProgressView, ExplorePage |

### Session 2 (path to 10/10)
| Item | Commit | Notes |
|------|--------|-------|
| 6 failing tests fixed | `61405ad` | 248/248 pass — sync mock chain + parseRestSeconds |
| Empty catches annotated | `96e9987` | console.warn for save failures, comments for parse fallbacks |
| localStorage routed through store | `72b2a28` | store.remove + store.keys added; infra files intentionally direct |
| window.__foundryPendingCompletion removed | `d9fd832` | Replaced with React ref in DayView |
| DayView partial split | `22aa0f5` | Extracted: CardioPromptModal, UnfinishedPromptModal, NoteReviewSheet, SwapScopeSelector, useWorkoutTimer |

### Session 3 (this session — V2 completion)
| Item | Notes |
|------|-------|
| Typed event emitter | `src/utils/events.ts` — emit() + on() with FoundryEventMap. All 8 events typed, all 12+ dispatch/listen sites migrated |
| SwapSheet extraction | `src/components/workout/SwapSheet.tsx` — Sheet+ExercisePicker+SwapScopeSelector UI |
| Completion flow extraction | `src/hooks/useCompletionFlow.ts` — all completion state + logic (stats, PRs, anchors, remote sync) |
| Zod removed | Deleted `schemas.ts` (imported by zero files), uninstalled `zod` dependency |
| borderRadius token | `tokens.radius.full = '50%'` — all 19 instances across 12 files replaced |
| Cardio history view | ProgressView now shows expandable cardio session history (loads from `foundry:cardio:session:*` keys) |
| `:any` narrowing complete | 0 remaining type-annotation `:any` in codebase |

### Already resolved (don't redo)
- Service Worker: EXISTS via VitePWA/Workbox (review incorrectly said missing)
- borderRadius "376 values": actually only 19, all `'50%'` for circles — now tokenized
- Sync tests: ALL passing (218/218)
- Empty catches: ALL annotated
- window hack: REMOVED
- localStorage routing: Component layer done, infrastructure files (sync/persistence/archive) intentionally direct

---

## DayView status

**Before:** 1559 lines
**After:** 1397 lines (−162)

**Extracted components/hooks:**
- `CardioPromptModal.tsx` — post-workout cardio prompt
- `UnfinishedPromptModal.tsx` — incomplete workout warning
- `NoteReviewSheet.tsx` — session note editing
- `SwapScopeSelector.tsx` — week vs meso scope picker
- `SwapSheet.tsx` — exercise swap picker + scope selector
- `useWorkoutTimer.ts` — session timer logic
- `useCompletionFlow.ts` — completion state + stats + remote sync

**Not extracted (intentionally):**
- `useWorkoutSession` — remaining session state (weekData, expandedIdx, BW modal, exercise cards) is too tightly coupled to render logic. Extracting would just shuffle state into a hook with 20+ return values without improving clarity. DayView at 1397 lines is manageable.

---

## Remaining work for 10/10

### Low priority
1. **Lazy-import sync.ts** — 2403 LOC, 484KB bundle contribution. SKIPPED in session 2 because sync.ts is deeply imported by persistence/training/store chain. Would need dynamic import + loading state in multiple callsites.
2. **`loadCardioLog()` unused** — `persistence.ts:138` — only used in archive.ts. The new cardio history uses `loadCardioSession()` which is the date-keyed version. `loadCardioLog()` (day/week-keyed) may be dead code — verify before removing.

### Nice to have
3. **Bundle splitting** — exercise DB is 241KB (55KB gzip). Could lazy-load on first gym visit.
4. **E2E tests** — no Playwright/Cypress coverage yet.

---

## Architecture notes

- **DayView** has two render paths: pre-workout (showMesoOverlay, begin workout) and in-workout (timer, cards, complete button). Both share swap logic via SwapSheet.
- **Completion flow**: handleComplete → unfinished check → note review → doCompleteWithStats → WorkoutCompleteModal → cardio prompt → onBack
- **Event bus**: All 8 events flow through typed `emit()`/`on()` in `src/utils/events.ts`. Zero raw `window.dispatchEvent` calls remain for Foundry events.
