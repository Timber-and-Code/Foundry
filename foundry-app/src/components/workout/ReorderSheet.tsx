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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tokens } from '../../styles/tokens';
import { haptic } from '../../utils/helpers';
import type { Exercise } from '../../types';

/**
 * ReorderSheet — drag-to-reorder bottom sheet for the in-workout Focus Mode.
 *
 * - Long-press (~400ms) on a row to enter drag mode; tap to jump.
 * - Drag commits immediately via `onMove(fromIdx, toIdx)` (no Apply step) so
 *   the Focus card behind the sheet always reflects what the user sees.
 * - "+ Add exercise" defers to the parent (DayView) so it can reuse the
 *   existing SwapMenu instead of duplicating the picker UI here.
 *
 * Reorder is currently in-memory for the live session — matches the prior
 * up/down arrow behavior. Meso-template persistence is a separate feature.
 */
interface ReorderSheetProps {
  exercises: Exercise[];
  currentIdx: number;
  doneIndices: Set<number>;
  onClose: () => void;
  onMove: (fromIdx: number, toIdx: number) => void;
  onJump: (idx: number) => void;
  onAddExercise: () => void;
  /** Day label shown in the sheet header (e.g. "Push A", "Lower A"). */
  dayLabel?: string;
  /** Optional CTA. When provided, renders a primary "Complete Workout"
   *  button at the bottom of the sheet so completion lives alongside
   *  reorder/add — Focus Mode no longer surfaces a standalone Complete
   *  button (testers were tapping it thinking it completed one exercise). */
  onCompleteWorkout?: () => void;
}

interface SortableRowProps {
  exercise: Exercise;
  index: number;
  isCurrent: boolean;
  isDone: boolean;
  onJump: (idx: number) => void;
}

function SortableRow({ exercise, index, isCurrent, isDone, onJump }: SortableRowProps) {
  // dnd-kit needs a stable string id per row. exercise.id may be a number or
  // missing; fall back to the index so the SortableContext stays valid.
  const sortId = String(exercise.id ?? `idx-${index}`);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
  });

  const chipBg = isCurrent
    ? 'var(--accent)'
    : isDone
    ? 'var(--border)'
    : 'var(--border-subtle, var(--border))';
  const chipColor = isCurrent ? 'var(--bg-root, #0A0A0C)' : 'var(--text-muted)';
  const chipLabel = isDone ? 'Done' : isCurrent ? 'Now' : 'Up';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDone ? 0.55 : 1,
        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-subtle, var(--border))'}`,
        borderRadius: tokens.radius.md,
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
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onJump(index);
      }}
    >
      <span
        aria-hidden="true"
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
          fontSize: 16,
          fontWeight: 800,
          color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {exercise.sets ?? '?'} × {exercise.reps ?? '?'}
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          padding: '4px 9px',
          borderRadius: tokens.radius.pill,
          background: chipBg,
          color: chipColor,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {chipLabel}
      </span>
    </div>
  );
}

export default function ReorderSheet({
  exercises,
  currentIdx,
  doneIndices,
  onClose,
  onMove,
  onJump,
  onAddExercise,
  dayLabel,
  onCompleteWorkout,
}: ReorderSheetProps) {
  // Local copy so the drag preview animates smoothly. We commit each drag
  // result to parent state via onMove; the parent re-supplies `exercises`
  // and we re-sync below.
  const [items, setItems] = useState(exercises);
  useEffect(() => {
    setItems(exercises);
  }, [exercises]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = items.findIndex(
      (x, i) => String(x.id ?? `idx-${i}`) === String(active.id),
    );
    const toIdx = items.findIndex(
      (x, i) => String(x.id ?? `idx-${i}`) === String(over.id),
    );
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    onMove(fromIdx, toIdx);
    try { haptic('tap'); } catch { /* haptic unavailable */ }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-sheet-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(0,0,0,0.55)',
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
          maxWidth: 480,
          maxHeight: '85vh',
          background: 'var(--bg-card)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: `1px solid var(--border)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '10px 0 14px 0' }}>
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 4,
              background: 'var(--border)',
              margin: '0 auto',
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ padding: '0 20px 14px 20px' }}>
          <h2
            id="reorder-sheet-title"
            style={{
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: 0,
              color: 'var(--text-primary)',
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            }}
          >
            {dayLabel || "Today's Session"}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Tap to jump · Hold to drag · Reorder anytime
          </div>
        </div>

        <div style={{ padding: '0 16px 12px 16px', overflowY: 'auto', flex: 1 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={items.map((x, i) => String(x.id ?? `idx-${i}`))}
              strategy={verticalListSortingStrategy}
            >
              {items.map((ex, i) => (
                <SortableRow
                  key={String(ex.id ?? `idx-${i}`)}
                  exercise={ex}
                  index={i}
                  isCurrent={i === currentIdx}
                  isDone={doneIndices.has(i)}
                  onJump={(idx) => {
                    onJump(idx);
                    onClose();
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            onClick={() => {
              onAddExercise();
              onClose();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px',
              marginTop: 2,
              border: `1px dashed var(--accent-border, ${tokens.colors.accentBorder})`,
              borderRadius: tokens.radius.md,
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
              +
            </span>
            Add exercise
          </button>
        </div>

        <div
          style={{
            padding: '12px 16px 24px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {onCompleteWorkout && (
            <button
              onClick={() => {
                onClose();
                onCompleteWorkout();
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.lg,
                background: 'var(--bg-root)',
                border: 'none',
                color: 'var(--accent)',
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 400,
                cursor: 'pointer',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Complete Workout <span aria-hidden="true">→</span>
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              height: 44,
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
