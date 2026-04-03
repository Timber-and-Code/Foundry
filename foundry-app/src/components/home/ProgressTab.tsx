import ProgressView from './ProgressView';

interface ProgressTabProps {
  displayWeek: number;
  completedDays: Set<string>;
  activeDays: any[];
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
