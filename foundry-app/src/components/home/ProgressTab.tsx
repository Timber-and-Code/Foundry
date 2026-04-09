import ProgressView from './ProgressView';
import type { TrainingDay } from '../../types';

interface ProgressTabProps {
  displayWeek: number;
  completedDays: Set<string>;
  activeDays: TrainingDay[];
  goBack: () => void;
  goTo: (week: number | string) => void;
}

function ProgressTab({ displayWeek, completedDays, activeDays, goBack, goTo }: ProgressTabProps) {
  return (
    <ProgressView
      currentWeek={displayWeek}
      completedDays={completedDays}
      activeDays={activeDays}
      goBack={goBack}
      goTo={goTo}
    />
  );
}

export default ProgressTab;
