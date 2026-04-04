import React, { useState, useRef, useCallback, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { EXERCISE_DB } from '../../data/exercises';
import HammerIcon from '../shared/HammerIcon';

/* ── types ─────────────────────────────────────────────────────────────────── */
interface ExerciseItem {
  id: string;
  name: string;
  muscle: string;
  equipment?: string | string[];
  [key: string]: any;
}

interface ExercisePickerProps {
  /** Exercises grouped by muscle name */
  exercises: Record<string, ExerciseItem[]>;
  /** Ordered list of selected exercise IDs */
  selected: string[];
  /** Toggle an exercise on/off */
  onToggle: (exId: string) => void;
  /** Called when the selected list is reordered via drag */
  onReorder: (newOrder: string[]) => void;
  /** User's equipment list — exercises not matching are grayed out */
  userEquipment?: string[];
  /** Auto-expand this muscle group on mount (for swap) */
  autoExpandMuscle?: string;
  /** Accent colour override */
  accent?: string;
}

/* ── component ─────────────────────────────────────────────────────────────── */
export default function ExercisePicker({
  exercises,
  selected,
  onToggle,
  onReorder,
  userEquipment,
  autoExpandMuscle,
  accent = tokens.colors.accent,
}: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(autoExpandMuscle ?? null);

  /* ── drag state ───────────────────────────────────────────────────────────── */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; idx: number } | null>(null);
  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── search filter ────────────────────────────────────────────────────────── */
  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  const filteredGroups: Record<string, ExerciseItem[]> = {};
  const muscleOrder = Object.keys(exercises);

  for (const muscle of muscleOrder) {
    const exs = exercises[muscle];
    if (isSearching) {
      const matched = exs.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscle.toLowerCase().includes(q) ||
          (typeof e.equipment === 'string' && e.equipment.toLowerCase().includes(q)),
      );
      if (matched.length > 0) filteredGroups[muscle] = matched;
    } else {
      filteredGroups[muscle] = exs;
    }
  }

  /* auto-expand all matching groups while searching */
  const visibleMuscles = Object.keys(filteredGroups);

  const isGroupOpen = (muscle: string) => {
    if (isSearching) return visibleMuscles.includes(muscle);
    return openGroup === muscle;
  };

  const toggleGroup = (muscle: string) => {
    if (isSearching) return; // groups are auto-controlled while searching
    setOpenGroup((prev) => (prev === muscle ? null : muscle));
  };

  /* ── equipment check ──────────────────────────────────────────────────────── */
  const equipmentMatch = (ex: ExerciseItem): boolean => {
    if (!userEquipment || userEquipment.length === 0) return true;
    const eq = typeof ex.equipment === 'string' ? ex.equipment : '';
    if (eq === 'bodyweight') return true;
    return userEquipment.includes(eq);
  };

  /* ── count helpers ────────────────────────────────────────────────────────── */
  const countForMuscle = (muscle: string): number => {
    const exs = exercises[muscle] || [];
    return exs.filter((e) => selected.includes(e.id)).length;
  };

  /* ── drag-to-reorder handlers ─────────────────────────────────────────────── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, idx };
      setDragIdx(idx);
      setOverIdx(idx);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current === null) return;
      // find which pill we're over
      const x = e.clientX;
      const y = e.clientY;
      for (let i = 0; i < pillRefs.current.length; i++) {
        const el = pillRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          setOverIdx(i);
          break;
        }
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (dragRef.current === null) return;
      const fromIdx = dragRef.current.idx;
      const toIdx = overIdx ?? fromIdx;
      dragRef.current = null;
      setDragIdx(null);
      setOverIdx(null);

      if (fromIdx !== toIdx) {
        const newOrder = [...selected];
        const [moved] = newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, moved);
        onReorder(newOrder);
      }
    },
    [selected, overIdx, onReorder],
  );

  /* ── clear search on unmount ──────────────────────────────────────────────── */
  useEffect(() => {
    if (autoExpandMuscle) setOpenGroup(autoExpandMuscle);
  }, [autoExpandMuscle]);

  /* ── render ───────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 8px', position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card)' }}>
        <div style={{ position: 'relative' }}>
          <span
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
            placeholder="Search exercises..."
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

      {/* ── Selected strip ──────────────────────────────────────────────────── */}
      {selected.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-inset)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            SELECTED ({selected.length})
            <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
              hold &amp; drag to reorder
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              touchAction: 'none',
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {selected.map((id, i) => {
              const ex = EXERCISE_DB.find((e: any) => e.id === id);
              if (!ex) return null;
              const isAnchor = i === 0;
              const isDragging = dragIdx === i;
              const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <div
                  key={id}
                  ref={(el) => { pillRefs.current[i] = el; }}
                  onPointerDown={(e) => handlePointerDown(e, i)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 6px 3px 8px',
                    borderRadius: tokens.radius.pill,
                    background: isAnchor ? accent + '33' : 'var(--bg-surface)',
                    border: `1px solid ${isOver ? accent : isAnchor ? accent : 'var(--border)'}`,
                    color: isAnchor ? accent : 'var(--text-secondary)',
                    cursor: 'grab',
                    userSelect: 'none',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                    transform: isDragging ? 'scale(1.08)' : 'none',
                    boxShadow: isDragging ? `0 4px 16px rgba(0,0,0,0.4)` : 'none',
                    zIndex: isDragging ? 10 : 1,
                    opacity: isDragging ? 0.9 : 1,
                  }}
                >
                  {isAnchor ? (
                    <HammerIcon size={12} />
                  ) : (
                    <span style={{ opacity: 0.5 }}>{i + 1}.</span>
                  )}
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ex.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: '0 2px',
                      lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Accordion muscle groups ─────────────────────────────────────────── */}
      <div style={{ padding: '4px 0' }}>
        {muscleOrder.map((muscle) => {
          const exs = filteredGroups[muscle];
          const hidden = isSearching && !exs;
          if (hidden) return null;

          const open = isGroupOpen(muscle);
          const count = countForMuscle(muscle);
          const items = exs || [];

          return (
            <div key={muscle}>
              {/* Header */}
              <button
                onClick={() => toggleGroup(muscle)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: isSearching ? 'default' : 'pointer',
                  color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      transition: 'transform 0.15s',
                      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                      fontSize: 10,
                      opacity: isSearching ? 0.3 : 0.6,
                    }}
                  >
                    &#9656;
                  </span>
                  <span>{muscle.toUpperCase()}</span>
                </div>
                {count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{count}</span>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: accent,
                      }}
                    />
                  </div>
                )}
              </button>

              {/* Body */}
              {open && (
                <div
                  style={{
                    padding: '8px 16px 12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-inset)',
                  }}
                >
                  {items.map((ex) => {
                    const isSel = selected.includes(ex.id);
                    const isAnchor = selected[0] === ex.id;
                    const eqMatch = equipmentMatch(ex);

                    return (
                      <button
                        key={ex.id}
                        onClick={() => onToggle(ex.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: tokens.radius.md,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: isSel ? 700 : 500,
                          background: isAnchor
                            ? accent + '33'
                            : isSel
                              ? 'rgba(var(--accent-rgb),0.1)'
                              : 'var(--bg-surface)',
                          border: `1px solid ${
                            isAnchor
                              ? accent
                              : isSel
                                ? 'rgba(var(--accent-rgb),0.4)'
                                : 'var(--border)'
                          }`,
                          color: isAnchor
                            ? accent
                            : isSel
                              ? 'var(--text-primary)'
                              : eqMatch
                                ? 'var(--text-muted)'
                                : 'var(--text-dim)',
                          opacity: eqMatch ? 1 : 0.45,
                          transition: 'all 0.12s',
                        }}
                      >
                        {isAnchor && <HammerIcon size={13} style={{ marginRight: 3 }} />}
                        {ex.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isSearching && visibleMuscles.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No exercises match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
