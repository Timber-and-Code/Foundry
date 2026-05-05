/**
 * Tests for HomeCardioCard (Group D / C3) — day-mode adaptive rendering,
 * preset chips behaviour, designer routing, and "logged today" pill.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
}));

import HomeCardioCard from '../HomeCardioCard';
import { saveCardioPreset } from '../../../utils/persistence';
import type { Profile, CardioPreset } from '../../../types';

const baseProfile: Profile = {
  experience: 'intermediate',
  goal: 'build_muscle',
};

function renderCard(overrides: Partial<React.ComponentProps<typeof HomeCardioCard>> = {}) {
  const defaults: React.ComponentProps<typeof HomeCardioCard> = {
    dayMode: 'cardio_only',
    dateStr: '2026-05-05',
    todayCardioSlot: null,
    todayCardioSession: null,
    profile: baseProfile,
    onOpenCardio: vi.fn(),
  };
  return render(<HomeCardioCard {...defaults} {...overrides} />);
}

describe('HomeCardioCard — day-mode rendering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rest day → renders nothing', () => {
    const { container } = renderCard({ dayMode: 'rest' });
    expect(container.firstChild).toBeNull();
  });

  it('lift_only day → renders compact strip (not the full card)', () => {
    renderCard({ dayMode: 'lift_only' });
    expect(screen.getByTestId('home-cardio-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('home-cardio-full')).not.toBeInTheDocument();
    expect(screen.getByText(/\+ ADD CARDIO/i)).toBeInTheDocument();
  });

  it('cardio_only day → renders the full card', () => {
    renderCard({ dayMode: 'cardio_only' });
    expect(screen.getByTestId('home-cardio-full')).toBeInTheDocument();
    expect(screen.queryByTestId('home-cardio-strip')).not.toBeInTheDocument();
  });

  it('lift+cardio day → renders the full card', () => {
    renderCard({ dayMode: 'lift+cardio' });
    expect(screen.getByTestId('home-cardio-full')).toBeInTheDocument();
  });

  it('completed today → collapses to logged pill regardless of dayMode', () => {
    renderCard({
      dayMode: 'cardio_only',
      todayCardioSession: { completed: true, type: 'Bike', duration: 30 },
    });
    expect(screen.getByTestId('home-cardio-logged')).toBeInTheDocument();
    expect(screen.queryByTestId('home-cardio-full')).not.toBeInTheDocument();
  });
});

describe('HomeCardioCard — composition + presets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('default composition is rendered as the Bebas line', () => {
    renderCard({ dayMode: 'cardio_only', profile: { experience: 'new', goal: 'build_muscle' } });
    // Default for build_muscle goal is the easy walk (Endurance) built-in.
    // Full card uses Bebas styling — text content is the composition line.
    const card = screen.getByTestId('home-cardio-full');
    expect(card.textContent).toMatch(/EASY · WALK · LISS · 35 MIN/i);
  });

  it('uses today scheduled slot when present', () => {
    renderCard({
      dayMode: 'cardio_only',
      todayCardioSlot: { dayOfWeek: 1, protocol: 'tempo_run' },
    });
    const card = screen.getByTestId('home-cardio-full');
    expect(card.textContent).toMatch(/HARD · RUN · TEMPO · 25 MIN/i);
  });

  it('empty user presets → shows the "Save your first session" CTA', () => {
    renderCard({ dayMode: 'cardio_only' });
    expect(screen.getByTestId('home-cardio-empty-presets')).toBeInTheDocument();
  });

  it('non-empty user presets → renders chips by label', () => {
    saveCardioPreset({
      id: 'usr_1',
      label: 'Sunday Bike',
      intensity: 'moderate',
      modality: 'bike',
      protocol: 'zone2',
      target: { kind: 'duration', minutes: 30 },
      isUserSaved: true,
    } satisfies CardioPreset);
    saveCardioPreset({
      id: 'usr_2',
      label: 'Hill Sprints',
      intensity: 'hard',
      modality: 'run',
      protocol: 'sprint_intervals',
      target: { kind: 'duration', minutes: 15 },
      isUserSaved: true,
    } satisfies CardioPreset);
    renderCard({ dayMode: 'cardio_only' });
    expect(screen.getByRole('button', { name: 'Sunday Bike' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hill Sprints' })).toBeInTheDocument();
  });

  it('tapping a preset chip swaps the displayed composition', () => {
    saveCardioPreset({
      id: 'usr_1',
      label: 'Sunday Bike',
      intensity: 'moderate',
      modality: 'bike',
      protocol: 'zone2',
      target: { kind: 'duration', minutes: 45 },
      isUserSaved: true,
    } satisfies CardioPreset);
    renderCard({
      dayMode: 'cardio_only',
      todayCardioSlot: { dayOfWeek: 1, protocol: 'tempo_run' },
    });
    // Initial state: tempo_run from slot.
    expect(screen.getByTestId('home-cardio-full').textContent).toMatch(/HARD · RUN · TEMPO · 25 MIN/i);
    fireEvent.click(screen.getByRole('button', { name: 'Sunday Bike' }));
    expect(screen.getByTestId('home-cardio-full').textContent).toMatch(/MODERATE · BIKE · ZONE 2 · 45 MIN/i);
  });
});

describe('HomeCardioCard — designer routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Edit pencil routes to the Designer (full-screen replaces card)', () => {
    renderCard({ dayMode: 'cardio_only' });
    fireEvent.click(screen.getByLabelText('Edit cardio composition'));
    // Designer header lives on the screen now; full card is gone.
    expect(screen.getByText('DESIGN CARDIO')).toBeInTheDocument();
    expect(screen.queryByTestId('home-cardio-full')).not.toBeInTheDocument();
  });

  it('lift_only strip → tap to expand into the Designer', () => {
    renderCard({ dayMode: 'lift_only' });
    fireEvent.click(screen.getByTestId('home-cardio-strip'));
    expect(screen.getByText('DESIGN CARDIO')).toBeInTheDocument();
  });

  it('Start button calls onOpenCardio with the slot protocol id', () => {
    const onOpenCardio = vi.fn();
    renderCard({
      dayMode: 'cardio_only',
      todayCardioSlot: { dayOfWeek: 1, protocol: 'tempo_run' },
      onOpenCardio,
    });
    fireEvent.click(screen.getByLabelText('Start cardio session'));
    expect(onOpenCardio).toHaveBeenCalledWith('2026-05-05', 'tempo_run');
  });

  it('Start button passes null protocolId after Designer composition is applied', () => {
    const onOpenCardio = vi.fn();
    renderCard({
      dayMode: 'cardio_only',
      todayCardioSlot: { dayOfWeek: 1, protocol: 'tempo_run' },
      onOpenCardio,
    });
    // Open designer + commit a tweaked composition.
    fireEvent.click(screen.getByLabelText('Edit cardio composition'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByLabelText('Start cardio session'));
    expect(onOpenCardio).toHaveBeenCalledWith('2026-05-05', null);
  });
});
