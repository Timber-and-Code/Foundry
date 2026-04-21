import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import ShareCard, {
  type ShareCardProps,
} from '../ShareCard';

const baseProps: ShareCardProps = {
  dayLabel: 'Push A',
  weekIdx: 1, // UI will display Week 2
  phase: 'Accumulation',
  phaseColor: '#E8E4DC',
  stats: { sets: 28, reps: 340, volume: 14500, duration: 47 * 60 },
  prs: [],
  congratsHeadline: 'PAID IN FULL',
  congratsSub: "The rep count doesn't care how you felt. You showed up.",
};

describe('ShareCard', () => {
  it('renders the wordmark, meta line, and footer URL', () => {
    render(<ShareCard {...baseProps} />);
    expect(screen.getByText('THE FOUNDRY')).toBeInTheDocument();
    expect(screen.getByText(/Push A/)).toBeInTheDocument();
    expect(screen.getByText(/Week 2/)).toBeInTheDocument();
    expect(screen.getByText(/Accumulation/)).toBeInTheDocument();
    expect(screen.getByText('thefoundry.coach')).toBeInTheDocument();
  });

  it('renders TOTAL VOLUME as the hero when no PRs set', () => {
    render(<ShareCard {...baseProps} />);
    expect(screen.getByText('14,500 LBS')).toBeInTheDocument();
    expect(screen.getByText('TOTAL VOLUME')).toBeInTheDocument();
  });

  it('renders the PR as the hero when a PR is set', () => {
    render(
      <ShareCard
        {...baseProps}
        prs={[{ name: 'Bench', weight: 185, reps: 8 }]}
      />,
    );
    expect(screen.getByText('BENCH 185×8')).toBeInTheDocument();
    expect(screen.getByText('NEW PERSONAL RECORD')).toBeInTheDocument();
  });

  it('renders the 4-col stat grid with SETS/REPS/VOL/TIME', () => {
    render(<ShareCard {...baseProps} />);
    expect(screen.getByText('SETS')).toBeInTheDocument();
    expect(screen.getByText('REPS')).toBeInTheDocument();
    expect(screen.getByText('VOL')).toBeInTheDocument();
    expect(screen.getByText('TIME')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('14.5K')).toBeInTheDocument();
    expect(screen.getByText('47m')).toBeInTheDocument();
  });

  it('renders the congrats headline + sub', () => {
    render(<ShareCard {...baseProps} />);
    expect(screen.getByText('PAID IN FULL')).toBeInTheDocument();
    expect(
      screen.getByText(/rep count doesn't care how you felt/),
    ).toBeInTheDocument();
  });

  it('shows a multi-PR callout when more than one PR exists', () => {
    render(
      <ShareCard
        {...baseProps}
        prs={[
          { name: 'Bench', weight: 185, reps: 8 },
          { name: 'Row', weight: 155, reps: 10 },
        ]}
      />,
    );
    expect(screen.getByTestId('share-card-pr-callout')).toBeInTheDocument();
    expect(screen.getByText(/2 New PRs This Session/i)).toBeInTheDocument();
  });

  it('forwards ref to the capture-ready root node', () => {
    const ref = createRef<HTMLDivElement>();
    render(<ShareCard {...baseProps} ref={ref} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current?.getAttribute('data-testid')).toBe('share-card');
  });
});
