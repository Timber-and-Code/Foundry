import React from 'react';
import ProgressView from './ProgressView';

interface ProgressTabProps {
  displayWeek: number;
  completedDays: number[];
  activeDays: number[];
  goBack: () => void;
  goTo: (week: number) => void;
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
