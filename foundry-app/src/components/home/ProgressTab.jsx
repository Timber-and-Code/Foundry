import React from 'react';
import ProgressView from './ProgressView';

function ProgressTab({ displayWeek, completedDays, activeDays, goBack, goTo }) {
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
