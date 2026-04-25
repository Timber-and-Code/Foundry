import { useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Exercise } from '../forge-v2/fixtures';
import { useExerciseDB, type ExerciseEntry } from '../../data/exerciseDB';

export type ApplyScope = 'week' | 'meso';
export type DayTag = 'PUSH' | 'PULL' | 'LEGS' | 'CORE';

interface ReorderSheetLiteProps {
  exercises: Exercise[];
  currentIdx: number;
  dayTag: DayTag;
  onClose: () => void;
  onApply: (next: Exercise[], nextCurrentIdx: number, scope: ApplyScope) => void;
  onJump: (id: string) => void;
}

function exerciseStatus(ex: Exercise): 'done' | 'current' | 'upcoming' {
  const allDone = ex.sets.every((s) => s.done);
  const someDone = ex.sets.some((s) => s.done);
  if (allDone) return 'done';
  if (someDone) return 'current';
  return 'upcoming';
}

function ReorderRow({
  exercise,
  index,
  isCurrent,
  onJump,
}: {
  exercise: Exercise;
  index: number;
  isCurrent: boolean;
  onJump: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  });
  const status = exerciseStatus(exercise);
  const isDone = status === 'done';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDone ? 0.55 : 1,
    border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-subtle)'}`,
    borderRadius: 10,
    background: isDragging ? 'rgba(232,101,26,0.08)' : 'var(--bg-card)',
    boxShadow: isDragging
      ? '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,101,26,0.35)'
      : 'none',
    scale: isDragging ? '1.02' : '1',
    padding: '12px 14px',
    marginBottom: 8,
    display: 'grid',
    gridTemplateColumns: '18px 28px 1fr auto',
    alignItems: 'center',
    gap: 12,
    cursor: isDragging ? 'grabbing' : 'pointer',
    touchAction: 'none',
    fontFamily: 'var(--ff-body)',
  } as const;

  const chipBg = isCurrent
    ? 'var(--accent)'
    : isDone
    ? 'var(--border)'
    : 'var(--border-subtle)';
  const chipColor = isCurrent ? 'var(--bg-root)' : 'var(--text-muted)';
  const chipLabel = isDone ? 'Done' : isCurrent ? 'Now' : 'Up';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onJump(exercise.id);
      }}
    >
      <span
        aria-hidden
        style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          opacity: 0.5,
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        ⋮⋮
      </span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 16,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {exercise.setsTarget} × {exercise.repLow}–{exercise.repHigh}
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          padding: '4px 9px',
          borderRadius: 999,
          background: chipBg,
          color: chipColor,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {chipLabel}
      </span>
    </div>
  );
}

export function ReorderSheetLite({
  exercises,
  currentIdx,
  dayTag,
  onClose,
  onApply,
  onJump,
}: ReorderSheetLiteProps) {
  const [items, setItems] = useState(exercises);
  const [scope, setScope] = useState<ApplyScope>('meso');
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const currentId = exercises[currentIdx]?.id;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((x) => x.id === active.id);
      const newIdx = prev.findIndex((x) => x.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleApply = () => {
    const nextIdx = items.findIndex((x) => x.id === currentId);
    onApply(items, nextIdx >= 0 ? nextIdx : 0, scope);
  };

  const addExerciseFromDB = (entry: ExerciseEntry) => {
    const newEx: Exercise = {
      id: `added-${entry.id}-${Date.now()}`,
      name: entry.name.toUpperCase(),
      setsTarget: 3,
      repLow: 8,
      repHigh: 12,
      rpeTarget: 8,
      target: '—',
      lastWeek: '—',
      sets: [
        { weight: '', reps: '', rpe: '', done: false },
        { weight: '', reps: '', rpe: '', done: false },
        { weight: '', reps: '', rpe: '', done: false },
      ],
    };
    setItems((prev) => [...prev, newEx]);
    setAddPickerOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hybrid-reorder-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'var(--overlay)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          maxWidth: 440,
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--ff-body)',
        }}
      >
        <div style={{ padding: '10px 0 14px 0' }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 4,
              background: 'var(--border)',
              margin: '0 auto',
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ padding: '0 20px 12px 20px' }}>
          <h2
            id="hybrid-reorder-title"
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 24,
              letterSpacing: '0.02em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Edit Session
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Tap to jump · Hold to reorder
          </div>
        </div>

        {/* Scope picker — segmented control */}
        <div style={{ padding: '0 16px 14px 16px' }}>
          <div
            role="tablist"
            aria-label="Apply scope"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              padding: 3,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
            }}
          >
            <ScopeTab active={scope === 'week'} onClick={() => setScope('week')}>
              This week only
            </ScopeTab>
            <ScopeTab active={scope === 'meso'} onClick={() => setScope('meso')}>
              Rest of meso
            </ScopeTab>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
            {scope === 'week'
              ? 'Changes apply only to this week’s session. Future weeks use the original plan.'
              : 'Changes apply to every remaining week in this mesocycle.'}
          </div>
        </div>

        <div style={{ padding: '0 16px 12px 16px', overflowY: 'auto', flex: 1 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              {items.map((ex, i) => (
                <ReorderRow
                  key={ex.id}
                  exercise={ex}
                  index={i}
                  isCurrent={ex.id === currentId}
                  onJump={(id) => {
                    onJump(id);
                    onClose();
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add exercise row */}
          <button
            onClick={() => setAddPickerOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px',
              marginTop: 2,
              border: '1px dashed var(--border)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--ff-body)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            Add exercise
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            padding: '12px 16px 24px 16px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--ff-body)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            style={{
              height: 44,
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--bg-root)',
              fontFamily: 'var(--ff-body)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            Apply {scope === 'week' ? 'to this week' : 'to meso'}
          </button>
        </div>

        {addPickerOpen && (
          <AddPicker
            dayTag={dayTag}
            existingIds={items.map((x) => x.id)}
            onClose={() => setAddPickerOpen(false)}
            onPick={addExerciseFromDB}
          />
        )}
      </div>
    </div>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '9px 10px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg-root)' : 'var(--text-secondary)',
        fontFamily: 'var(--ff-body)',
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
      }}
    >
      {children}
    </button>
  );
}

function AddPicker({
  dayTag,
  existingIds,
  onClose,
  onPick,
}: {
  dayTag: DayTag;
  existingIds: string[];
  onClose: () => void;
  onPick: (entry: ExerciseEntry) => void;
}) {
  const db = useExerciseDB();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Filter by the current day's tag, exclude movements already in the
  // session (comparing against base IDs — preview IDs are prefixed once
  // added), then filter by search query if present.
  const baseAddedIds = new Set(
    existingIds
      .map((id) => id.replace(/^added-/, '').replace(/-\d+$/, ''))
      .filter(Boolean),
  );
  const q = query.trim().toLowerCase();
  const filtered = db
    .filter((e) => e.tag === dayTag)
    .filter((e) => !baseAddedIds.has(e.id))
    .filter((e) =>
      q === ''
        ? true
        : e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q),
    );

  // Bucket by primary muscle for easier scanning
  const buckets = filtered.reduce<Record<string, ExerciseEntry[]>>((acc, e) => {
    const key = e.muscle || 'Other';
    (acc[key] ??= []).push(e);
    return acc;
  }, {});
  const bucketNames = Object.keys(buckets).sort();

  const loading = db.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hybrid-add-title"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '80%',
          background: 'var(--bg-surface)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: '2px solid var(--accent)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--ff-body)',
        }}
      >
        <div style={{ padding: '14px 20px 8px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 4,
            }}
          >
            <h3
              id="hybrid-add-title"
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 22,
                letterSpacing: '0.02em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Add exercise
            </h3>
            <button
              onClick={onClose}
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {dayTag} movements
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 20px 12px 20px' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--ff-body)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ padding: '0 16px 22px 16px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading exercise library…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No {dayTag.toLowerCase()} movements match “{query}”.
            </div>
          )}
          {bucketNames.map((muscle) => (
            <div key={muscle} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 4px 6px',
                }}
              >
                {muscle}
              </div>
              {buckets[muscle].map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onPick(entry)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    marginBottom: 6,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--ff-body)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ff-display)',
                      fontSize: 17,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {entry.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {Array.isArray(entry.equipment)
                      ? entry.equipment[0]
                      : entry.equipment ?? ''}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
