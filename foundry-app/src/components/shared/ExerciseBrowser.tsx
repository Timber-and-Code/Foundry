import { useMemo, useState, useEffect } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * Shape of a single exercise row. The browser only reads id / name /
 * muscle / equipment; callers can pass any richer record through the
 * generic typing if they need to.
 */
export interface ExerciseBrowserItem {
  id: string;
  name: string;
  muscle: string;
  equipment?: string | string[];
  // anything else is fine — the browser renders only the fields above
  [key: string]: unknown;
}

export interface ExerciseBrowserProps {
  /** Exercises grouped by muscle name (insertion order drives list order). */
  groups: Record<string, ExerciseBrowserItem[]>;
  /**
   * `'select'` — tapping a row fires `onSelect(id)` and closes the caller.
   * `'browse'` — tapping a row fires `onSelect(id)` (e.g. to open a detail
   * modal); both modes use the same UI.
   */
  mode: 'select' | 'browse';
  /** Called when a user taps an exercise row. */
  onSelect?: (exerciseId: string) => void;
  /** Muscle name that should be expanded on mount and pinned to the top. */
  autoExpandMuscle?: string;
  /** User's equipment list — rows requiring other kit are dimmed. */
  userEquipment?: string[];
  /**
   * When the user searches for something unknown, they can add it as a
   * `custom:` exercise. Only wired in `'select'` mode.
   */
  onCustomExercise?: (name: string) => void;
  /** Optional search placeholder override. */
  searchPlaceholder?: string;
}

/**
 * ExerciseBrowser — shared primitive behind the swap menu and the Explore
 * library. Renders a sticky search bar plus collapsible muscle-group rows.
 * The caller owns the frame (header, back button, overlay). See SwapMenu
 * and ExplorePage → library for concrete usage.
 *
 * Behaviour:
 *   - Search bar sticks to the top of the scroll area so the iOS keyboard
 *     never covers it.
 *   - When no search query is active, exactly one group is expanded at a
 *     time. Tapping another header collapses the current one.
 *   - `autoExpandMuscle` expands that group on mount AND hoists it to the
 *     top of the list so the user sees the most-relevant options first.
 *   - Typing into the search bar flattens the result list across groups
 *     so the user doesn't have to scroll through chevrons.
 *   - Exercises whose required equipment isn't in `userEquipment` are
 *     dimmed but still tappable.
 */
function ExerciseBrowser({
  groups,
  mode,
  onSelect,
  autoExpandMuscle,
  userEquipment,
  onCustomExercise,
  searchPlaceholder = 'Search exercises...',
}: ExerciseBrowserProps) {
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(autoExpandMuscle ?? null);

  // Keep `autoExpandMuscle` authoritative if the caller changes it while
  // the browser is mounted (e.g. the user picks a different exercise to
  // swap before dismissing).
  useEffect(() => {
    if (autoExpandMuscle) setOpenGroup(autoExpandMuscle);
  }, [autoExpandMuscle]);

  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  // Muscle order — autoExpandMuscle pinned to the top, rest in insertion order.
  const muscleOrder = useMemo(() => {
    const all = Object.keys(groups);
    if (!autoExpandMuscle || !all.includes(autoExpandMuscle)) return all;
    return [autoExpandMuscle, ...all.filter((m) => m !== autoExpandMuscle)];
  }, [groups, autoExpandMuscle]);

  /** Flat list of results across all groups — used in search mode. */
  const flatResults = useMemo(() => {
    if (!isSearching) return [] as Array<ExerciseBrowserItem & { _muscle: string }>;
    const out: Array<ExerciseBrowserItem & { _muscle: string }> = [];
    for (const muscle of muscleOrder) {
      for (const ex of groups[muscle] || []) {
        const eq = typeof ex.equipment === 'string'
          ? ex.equipment
          : Array.isArray(ex.equipment) ? ex.equipment.join(' ') : '';
        if (
          ex.name.toLowerCase().includes(q) ||
          ex.muscle.toLowerCase().includes(q) ||
          eq.toLowerCase().includes(q)
        ) {
          out.push({ ...ex, _muscle: muscle });
        }
      }
    }
    return out;
  }, [groups, muscleOrder, q, isSearching]);

  const equipmentMatch = (ex: ExerciseBrowserItem): boolean => {
    if (!userEquipment || userEquipment.length === 0) return true;
    const eq = typeof ex.equipment === 'string' ? ex.equipment : '';
    if (eq === 'bodyweight') return true;
    return userEquipment.includes(eq);
  };

  const equipmentLabel = (ex: ExerciseBrowserItem): string | null => {
    const eq = typeof ex.equipment === 'string'
      ? ex.equipment
      : Array.isArray(ex.equipment) ? ex.equipment[0] : '';
    return eq || null;
  };

  const handlePick = (id: string) => {
    if (onSelect) onSelect(id);
  };

  const toggleGroup = (muscle: string) => {
    setOpenGroup((prev) => (prev === muscle ? null : muscle));
  };

  const searchTrimmed = search.trim();
  const showCustomAffordance =
    mode === 'select' && !!onCustomExercise && searchTrimmed.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Sticky search bar ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px 10px',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg-root)',
          borderBottom: '1px solid var(--border-subtle, var(--border))',
        }}
      >
        <div style={{ position: 'relative' }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            &#x1F50D;
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search exercises"
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 4,
              }}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* ── Flat search results ────────────────────────────────────────── */}
      {isSearching && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {flatResults.length === 0 && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              <div>No exercises match &ldquo;{search}&rdquo;</div>
              {showCustomAffordance && (
                <button
                  onClick={() => {
                    onCustomExercise?.(searchTrimmed);
                    setSearch('');
                  }}
                  style={{
                    marginTop: 12,
                    padding: '10px 20px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background: 'rgba(var(--accent-rgb),0.14)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  + Add &ldquo;{searchTrimmed}&rdquo; as custom exercise
                </button>
              )}
            </div>
          )}

          {flatResults.map((ex) => {
            const eqMatch = equipmentMatch(ex);
            const eq = equipmentLabel(ex);
            return (
              <button
                key={ex.id}
                onClick={() => handlePick(ex.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle, var(--border))',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  color: 'var(--text-primary)',
                  opacity: eqMatch ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>{ex.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{ex._muscle}</span>
                  {eq && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{eq}</span>
                    </>
                  )}
                  {!eqMatch && eq && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '1px 6px',
                        borderRadius: tokens.radius.pill,
                        border: '1px solid var(--border)',
                        color: 'var(--text-dim, var(--text-muted))',
                      }}
                    >
                      requires {eq}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {flatResults.length > 0 && showCustomAffordance && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle, var(--border))' }}>
              <button
                onClick={() => {
                  onCustomExercise?.(searchTrimmed);
                  setSearch('');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'none',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Don&rsquo;t see it? Add &ldquo;{searchTrimmed}&rdquo; as custom exercise
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Accordion muscle groups ────────────────────────────────────── */}
      {!isSearching && (
        <div style={{ padding: '4px 0' }}>
          {muscleOrder.map((muscle) => {
            const items = groups[muscle] || [];
            if (items.length === 0) return null;
            const open = openGroup === muscle;
            const label = muscle.toUpperCase();

            return (
              <div key={muscle}>
                {/* Header row */}
                <button
                  onClick={() => toggleGroup(muscle)}
                  aria-expanded={open}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    minHeight: 48,
                    background: open ? 'var(--bg-surface)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle, var(--border))',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        transition: 'transform 0.15s',
                        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                        fontSize: 11,
                        opacity: 0.6,
                        width: 10,
                      }}
                    >
                      &#9656;
                    </span>
                    <span>{label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        letterSpacing: 0,
                      }}
                    >
                      ({items.length})
                    </span>
                  </span>
                </button>

                {/* Body — exercise rows, not pills */}
                {open && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--bg-inset)',
                      borderBottom: '1px solid var(--border-subtle, var(--border))',
                    }}
                  >
                    {items.map((ex) => {
                      const eqMatch = equipmentMatch(ex);
                      const eq = equipmentLabel(ex);
                      return (
                        <button
                          key={ex.id}
                          onClick={() => handlePick(ex.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '12px 16px 12px 36px',
                            minHeight: 48,
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            opacity: eqMatch ? 1 : 0.55,
                          }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {ex.name}
                            </span>
                            {eq && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {eq}
                                {!eqMatch && ' · requires ' + eq}
                              </span>
                            )}
                          </span>
                          {mode === 'select' ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                padding: '4px 10px',
                                borderRadius: tokens.radius.sm,
                                border: '1px solid var(--accent)',
                                color: 'var(--accent)',
                                background: 'rgba(var(--accent-rgb),0.08)',
                                flexShrink: 0,
                              }}
                            >
                              SWAP
                            </span>
                          ) : (
                            <span
                              aria-hidden="true"
                              style={{
                                fontSize: 16,
                                color: 'var(--text-dim, var(--text-muted))',
                                flexShrink: 0,
                              }}
                            >
                              &#8250;
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom affordance, non-search mode */}
          {showCustomAffordance && (
            <div style={{ padding: '12px 16px' }}>
              <button
                onClick={() => {
                  onCustomExercise?.(searchTrimmed);
                  setSearch('');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'none',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Don&rsquo;t see it? Add &ldquo;{searchTrimmed}&rdquo; as custom exercise
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExerciseBrowser;
