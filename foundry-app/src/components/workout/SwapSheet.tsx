import React from 'react';
import Sheet from '../ui/Sheet';
import ExercisePicker from '../ui/ExercisePicker';
import SwapScopeSelector from './SwapScopeSelector';
interface ExerciseItem {
  id: string;
  name: string;
  muscle: string;
  equipment?: string | string[];
  [key: string]: unknown;
}

interface SwapSheetProps {
  open: boolean;
  onClose: () => void;
  replacingName: string;
  exerciseGroups: Record<string, ExerciseItem[]>;
  autoExpandMuscle?: string;
  userEquipment?: string[];
  onSelect: (newExId: string) => void;
  onCustomExercise?: (name: string) => void;
  /** When set, the scope selector is shown instead of the picker. */
  scopePending: { exerciseName: string } | null;
  onScopeMeso: () => void;
  onScopeWeek: () => void;
  onScopeCancel: () => void;
}

function SwapSheet({
  open,
  onClose,
  replacingName,
  exerciseGroups,
  autoExpandMuscle,
  userEquipment,
  onSelect,
  onCustomExercise,
  scopePending,
  onScopeMeso,
  onScopeWeek,
  onScopeCancel,
}: SwapSheetProps) {
  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px 4px' }}>
          <button
            onClick={onClose}
            aria-label="Go back"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Swap Exercise
          </div>
          <div style={{ width: 56 }} aria-hidden="true" />
        </div>
        <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {replacingName ? `Replacing: ${replacingName}` : 'Select a replacement'}
        </div>
        <ExercisePicker
          exercises={exerciseGroups}
          selected={[]}
          onToggle={onSelect}
          onReorder={() => {}}
          userEquipment={userEquipment}
          autoExpandMuscle={autoExpandMuscle}
          onCustomExercise={onCustomExercise}
        />
      </Sheet>

      {scopePending && (
        <SwapScopeSelector
          exerciseName={scopePending.exerciseName}
          onMeso={onScopeMeso}
          onWeek={onScopeWeek}
          onCancel={onScopeCancel}
        />
      )}
    </>
  );
}

export default React.memo(SwapSheet);
