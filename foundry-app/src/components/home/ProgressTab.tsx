import ProgressView from './ProgressView';
import type { TrainingDay } from '../../types';

interface ProgressTabProps {
  displayWeek: number;
  completedDays: Set<string>;
  activeDays: TrainingDay[];
  goTo: (week: number | string) => void;
}

function ProgressTab({ displayWeek, completedDays, activeDays, goTo }: ProgressTabProps) {
  return (
    <ProgressView
      currentWeek={displayWeek}
      completedDays={completedDays}
      activeDays={activeDays}
      goTo={goTo}
    />
  );
}

export default ProgressTab;
