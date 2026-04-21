/**
 * Tests for MobilityBrowser — verifies the Warmup / Recovery / Targeted
 * sub-tabs filter protocols by category and that cards show the description.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Stub data constants to a small, predictable fixture so tab-filter assertions
// don't drift when the real data set changes.
vi.mock('../../../data/constants', () => ({
  MOBILITY_PROTOCOLS: [
    { id: 'w1', name: 'Warmup One', duration: '3 min', category: 'warmup', description: 'Warm up desc 1', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 'w2', name: 'Warmup Two', duration: '3 min', category: 'warmup', description: 'Warm up desc 2', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 'w3', name: 'Warmup Three', duration: '3 min', category: 'warmup', description: 'Warm up desc 3', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 'r1', name: 'Recovery One', duration: '8 min', category: 'recovery', description: 'Recovery desc 1', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 'r2', name: 'Recovery Two', duration: '8 min', category: 'recovery', description: 'Recovery desc 2', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 't1', name: 'Targeted One', duration: '10 min', category: 'targeted', description: 'Targeted desc 1', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
    { id: 't2', name: 'Targeted Two', duration: '10 min', category: 'targeted', description: 'Targeted desc 2', moves: [{ name: 'm', reps: '1', cue: 'c' }] },
  ],
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

// MobilityProtocolDetail imports useNavigate, useToast, and store/constants
// barrels we don't need exercised here. The browser owns tab-filtering; the
// detail is covered in its own test. Stub it to a minimal marker.
vi.mock('../MobilityProtocolDetail', () => ({
  default: ({ protocolId, onBack }: { protocolId: string; onBack: () => void }) => (
    <div>
      <span data-testid="detail-id">{protocolId}</span>
      <button onClick={onBack}>Back from detail</button>
    </div>
  ),
}));

import MobilityBrowser from '../MobilityBrowser';

function renderBrowser(onBack = vi.fn()) {
  return render(
    <MemoryRouter>
      <MobilityBrowser onBack={onBack} />
    </MemoryRouter>
  );
}

describe('MobilityBrowser', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders three sub-tabs (Warmup / Recovery / Targeted) with tablist role', () => {
    renderBrowser();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('WARMUP');
    expect(tabs[1]).toHaveTextContent('RECOVERY');
    expect(tabs[2]).toHaveTextContent('TARGETED');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('defaults to the Warmup tab and shows only warmup protocols', () => {
    renderBrowser();
    const warmupTab = screen.getByRole('tab', { name: /WARMUP/ });
    expect(warmupTab).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByText('Warmup One')).toBeInTheDocument();
    expect(screen.getByText('Warmup Two')).toBeInTheDocument();
    expect(screen.getByText('Warmup Three')).toBeInTheDocument();
    expect(screen.queryByText('Recovery One')).not.toBeInTheDocument();
    expect(screen.queryByText('Targeted One')).not.toBeInTheDocument();
  });

  it('filters to recovery protocols when Recovery tab is selected', () => {
    renderBrowser();
    fireEvent.click(screen.getByRole('tab', { name: /RECOVERY/ }));

    expect(screen.queryByText('Warmup One')).not.toBeInTheDocument();
    expect(screen.getByText('Recovery One')).toBeInTheDocument();
    expect(screen.getByText('Recovery Two')).toBeInTheDocument();
    expect(screen.queryByText('Targeted One')).not.toBeInTheDocument();
  });

  it('filters to targeted protocols when Targeted tab is selected', () => {
    renderBrowser();
    fireEvent.click(screen.getByRole('tab', { name: /TARGETED/ }));

    expect(screen.queryByText('Warmup One')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery One')).not.toBeInTheDocument();
    expect(screen.getByText('Targeted One')).toBeInTheDocument();
    expect(screen.getByText('Targeted Two')).toBeInTheDocument();
  });

  it('renders protocol descriptions on each card', () => {
    renderBrowser();
    expect(screen.getByText('Warm up desc 1')).toBeInTheDocument();
  });

  it('opens protocol detail when a card is tapped', () => {
    renderBrowser();
    fireEvent.click(screen.getByText('Warmup One'));
    expect(screen.getByTestId('detail-id')).toHaveTextContent('w1');
  });
});
