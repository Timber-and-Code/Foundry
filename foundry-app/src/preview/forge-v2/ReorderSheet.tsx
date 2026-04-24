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
import type { Exercise } from './fixtures';

interface ReorderSheetProps {
  exercises: Exercise[];
  currentIdx: number;
  onClose: () => void;
  onApply: (nextExercises: Exercise[], nextCurrentIdx: number) => void;
  onJump: (exerciseId: string) => void;
  phaseColor: string;
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
  phaseColor,
  onJump,
}: {
  exercise: Exercise;
  index: number;
  isCurrent: boolean;
  phaseColor: string;
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
    opacity: isDone ? 0.45 : 1,
    border: `1px solid ${isCurrent ? phaseColor : 'var(--fv-border-1)'}`,
    background: isDragging ? 'rgba(232,101,26,0.08)' : 'var(--fv-surface-1)',
    boxShadow: isDragging ? `0 8px 24px rgba(0,0,0,0.5), 0 0 16px ${phaseColor}66` : 'none',
    transformOrigin: 'center',
    scale: isDragging ? '1.02' : '1',
    padding: '12px 14px',
    marginBottom: 6,
    display: 'grid',
    gridTemplateColumns: '20px 32px 1fr auto',
    alignItems: 'center',
    gap: 12,
    cursor: isDragging ? 'grabbing' : 'pointer',
    touchAction: 'none',
  } as const;

  const chipBg = isCurrent ? phaseColor : isDone ? 'var(--fv-border-2)' : 'var(--fv-border-1)';
  const chipText = isCurrent ? 'var(--fv-bg-deep)' : 'var(--fv-text-4)';
  const chipLabel = isDone ? 'DONE' : isCurrent ? 'NOW' : 'UP';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // dnd-kit swallows the click during drag; pointer-sensor tap fires as click
        if (isDragging) return;
        e.stopPropagation();
        onJump(exercise.id);
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: 'var(--fv-font-ui)',
          color: 'var(--fv-border-2)',
          fontSize: 14,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        ⋮⋮
      </span>
      <span
        style={{
          fontFamily: 'var(--fv-font-display)',
          fontSize: 18,
          color: isCurrent ? phaseColor : 'var(--fv-text-5)',
          letterSpacing: '0.01em',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--fv-font-display)',
            fontSize: 16,
            letterSpacing: '0.02em',
            color: 'var(--fv-text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--fv-text-5)',
            textTransform: 'uppercase',
          }}
        >
          {exercise.setsTarget} × {exercise.repLow}–{exercise.repHigh}
        </span>
      </div>
      <span
        style={{
          fontSize: 9,
          letterSpacing: '0.25em',
          padding: '4px 8px',
          background: chipBg,
          color: chipText,
          fontWeight: 600,
        }}
      >
        {chipLabel}
      </span>
    </div>
  );
}

export function ReorderSheet({
  exercises,
  currentIdx,
  onClose,
  onApply,
  onJump,
  phaseColor,
}: ReorderSheetProps) {
  const [items, setItems] = useState(exercises);
  const currentId = exercises[currentIdx]?.id;

  // Long-press 400ms activates drag; tap (< 400ms) still fires onClick
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
    onApply(items, nextIdx >= 0 ? nextIdx : 0);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fv-reorder-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fv-rise 200ms ease-out',
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
          maxWidth: 420,
          maxHeight: '85vh',
          background: 'linear-gradient(180deg, #1a1412 0%, #0f0c0b 100%)',
          borderTop: '1px solid var(--fv-border-1)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fv-slide-up 300ms ease-out',
        }}
      >
        <div style={{ padding: '10px 0 14px 0' }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 3,
              background: 'var(--fv-border-3)',
              margin: '0 auto',
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ padding: '0 20px 14px 20px' }}>
          <h2
            id="fv-reorder-title"
            style={{
              fontFamily: 'var(--fv-font-display)',
              fontSize: 24,
              letterSpacing: '0.02em',
              margin: 0,
              color: 'var(--fv-text-hi)',
            }}
          >
            REORDER SESSION
          </h2>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.25em',
              color: 'var(--fv-text-4)',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            Tap to jump · Hold to reorder
          </div>
        </div>

        <div
          style={{
            padding: '0 16px 12px 16px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              {items.map((ex, i) => (
                <ReorderRow
                  key={ex.id}
                  exercise={ex}
                  index={i}
                  isCurrent={ex.id === currentId}
                  phaseColor={phaseColor}
                  onJump={(id) => {
                    onJump(id);
                    onClose();
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            padding: '12px 16px 24px 16px',
            borderTop: '1px solid var(--fv-border-1)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 44,
              border: '1px solid var(--fv-border-3)',
              color: 'var(--fv-text-2)',
              fontFamily: 'var(--fv-font-display)',
              fontSize: 16,
              letterSpacing: '0.05em',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleApply}
            style={{
              height: 44,
              background: phaseColor,
              color: 'var(--fv-bg-deep)',
              fontFamily: 'var(--fv-font-display)',
              fontSize: 16,
              letterSpacing: '0.05em',
              boxShadow: `0 0 20px ${phaseColor}44`,
            }}
          >
            APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
