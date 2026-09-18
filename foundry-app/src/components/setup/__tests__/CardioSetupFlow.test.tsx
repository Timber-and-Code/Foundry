/**
 * workoutDays is getDay() order (0 = Sunday). The cardio step shifted it by
 * one, labelling Sun/Mon/Wed/Thu as lifting days for a Mon/Tue/Thu/Fri lifter.
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CardioSetupFlow from '../CardioSetupFlow';

describe('CardioSetupFlow lifting-day labels', () => {
  it('marks exactly the lifter\'s training days', () => {
    render(
      <CardioSetupFlow
        pendingProfile={{ experience: 'intermediate', workoutDays: [1, 2, 4, 5], goal: 'build_muscle' } as never}
        onComplete={() => {}}
      />,
    );
    const lifting = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].filter((d) => {
      const row = screen.getByText(d).parentElement!;
      return /Lifting day/.test(row.textContent || '');
    });
    expect(lifting).toEqual(['Monday', 'Tuesday', 'Thursday', 'Friday']);
  });
});
