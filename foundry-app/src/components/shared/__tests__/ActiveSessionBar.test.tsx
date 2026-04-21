/**
 * Tests for ActiveSessionBar — renders when a session is active, hides when
 * null or when the user is already on the session's route, and navigates on
 * tap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Supabase client construction at module scope requires env vars that aren't
// set in vitest — stub it out before the provider pulls in the store barrel.
vi.mock('../../../utils/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));
vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
  pullFromSupabase: vi.fn(),
  pushToSupabase: vi.fn(),
  upsertWorkoutSessionRemote: vi.fn(),
  upsertWorkoutSetRemote: vi.fn(),
  deleteWorkoutSetRemote: vi.fn(),
  getOrCreateWorkoutSessionId: vi.fn(() => 'test-session'),
  syncExerciseSwapRemote: vi.fn(),
  debouncedSync: vi.fn(),
}));

import { ActiveSessionProvider } from '../../../contexts/ActiveSessionContext';
import ActiveSessionBar from '../ActiveSessionBar';

const STORAGE_KEY = 'foundry:active_session';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="pathname">{loc.pathname}</span>;
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <ActiveSessionProvider>
        <ActiveSessionBar />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
}

describe('ActiveSessionBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders nothing when there is no active session', () => {
    const { container } = renderAt('/');
    // No session → bar should render nothing (outside of the routes probe).
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders a lifting session label + SET counter', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'lifting',
        label: 'PUSH DAY',
        route: '/day/0/0',
        startedAt: Date.now() - 14 * 60 * 1000,
        setsDone: 2,
        totalSets: 12,
      }),
    );
    renderAt('/');
    const bar = screen.getByRole('status');
    expect(bar).toHaveTextContent(/PUSH DAY/);
    expect(bar).toHaveTextContent(/SET 3\/12/);
  });

  it('renders a cardio session with duration fraction', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'cardio',
        label: 'Zone 2',
        route: '/cardio/2026-04-21/zone2',
        startedAt: Date.now() - 5 * 60 * 1000,
        durationMin: 30,
      }),
    );
    renderAt('/');
    const bar = screen.getByRole('status');
    expect(bar).toHaveTextContent(/ZONE 2/);
    expect(bar).toHaveTextContent(/\/ 30:00/);
  });

  it('hides when the current route matches the session route', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'lifting',
        label: 'PUSH DAY',
        route: '/day/0/0',
        startedAt: Date.now(),
        setsDone: 0,
        totalSets: 12,
      }),
    );
    renderAt('/day/0/0');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('navigates to the session route when tapped', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'lifting',
        label: 'PUSH DAY',
        route: '/day/0/0',
        startedAt: Date.now(),
        setsDone: 0,
        totalSets: 12,
      }),
    );
    renderAt('/');
    expect(screen.getByTestId('pathname').textContent).toBe('/');
    fireEvent.click(screen.getByRole('status').querySelector('button')!);
    expect(screen.getByTestId('pathname').textContent).toBe('/day/0/0');
  });

  it('shows a dismiss button once the session has been idle >15min and clears on click', () => {
    const STALE_BUT_NOT_EXPIRED = 20 * 60 * 1000;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'lifting',
        label: 'PUSH DAY',
        route: '/day/0/0',
        startedAt: Date.now() - STALE_BUT_NOT_EXPIRED,
        setsDone: 4,
        totalSets: 12,
      }),
    );
    renderAt('/');
    const dismiss = screen.getByRole('button', { name: /dismiss inactive session/i });
    expect(dismiss).toBeInTheDocument();
    fireEvent.click(dismiss);
    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not show the dismiss button on a freshly-active session', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'lifting',
        label: 'PUSH DAY',
        route: '/day/0/0',
        startedAt: Date.now() - 30 * 1000,
        setsDone: 1,
        totalSets: 12,
      }),
    );
    renderAt('/');
    expect(screen.queryByRole('button', { name: /dismiss inactive session/i })).toBeNull();
  });
});
