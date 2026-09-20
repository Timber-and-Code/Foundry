/**
 * Beat2Preview — the new-lifter program preview.
 *
 * The rule: the last screen before a meso exists shows exactly what will be
 * trained. The coach pass used to run AT SAVE and replace the reviewed days
 * with its own, so a lifter approved one program and got another. Now it
 * runs first, lands in the list for review, and save installs what's shown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TrainingDay } from '../../../types';

const { aiMock } = vi.hoisted(() => ({ aiMock: vi.fn() }));

const ex = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, muscle: 'chest', anchor: false, sets: 3, reps: '8-12', rest: '2 min', warmup: '', ...extra,
});
const day = (label: string, exercises: unknown[]) =>
  ({ dayNum: 1, label, tag: 'UPPER', muscles: '', note: '', cardio: null, exercises }) as unknown as TrainingDay;

const STANDARD = [day('Upper A', [ex('bb_flat_bench', 'Standard Bench', { anchor: true, sets: 4 })])];
const COACHED = [day('Upper A', [ex('db_incline', 'Coach Incline Press', { anchor: true, sets: 5, reps: '5-8' })])];

vi.mock('../../../utils/program', () => ({ generateProgram: vi.fn(() => STANDARD) }));
vi.mock('../../../utils/api', () => ({ callFoundryAI: aiMock, CoachAuthRequiredError: class extends Error {} }));
vi.mock('../../../utils/trainingHistory', () => ({ getTrainedExerciseIds: () => new Set() }));
vi.mock('../../../data/exerciseDB', () => ({ getExerciseDB: () => [], useExerciseDB: () => [] }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import Beat2Preview from '../Beat2Preview';

const BEAT1 = { daysPerWeek: 1, workoutDays: [1], equipment: 'full_gym' as const, startDate: '2026-09-21' };

function renderPreview() {
  const onSave = vi.fn();
  render(<Beat2Preview beat1={BEAT1} onSave={onSave} onEditEssentials={() => {}} />);
  return onSave;
}

describe('Beat2Preview coach pass', () => {
  beforeEach(() => {
    aiMock.mockReset();
    localStorage.clear();
    // Most of these are about the pass itself: consent already given.
    localStorage.setItem('foundry:coach_ai_consent', '1');
  });

  // The coach is third-party AI (App Review 5.1.2(i)): nothing may be sent
  // until the lifter has been told what it is and agreed, once.
  it('asks before the first coach pass, and sends nothing if declined', async () => {
    localStorage.removeItem('foundry:coach_ai_consent');
    aiMock.mockResolvedValue({ days: COACHED });
    renderPreview();

    fireEvent.click(screen.getByRole('button', { name: /coach-tune my program/i }));
    expect(screen.getByText(/the coach is ai/i)).toBeInTheDocument();
    expect(screen.getByText(/anthropic/i)).toBeInTheDocument();
    expect(aiMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /build without the coach/i }));
    expect(aiMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('foundry:coach_ai_consent')).toBeNull();
    expect(screen.getByRole('button', { name: /save program/i })).toBeInTheDocument();
  });

  it('runs the coach once consent is given, and remembers it', async () => {
    localStorage.removeItem('foundry:coach_ai_consent');
    aiMock.mockResolvedValue({ days: COACHED });
    renderPreview();

    fireEvent.click(screen.getByRole('button', { name: /coach-tune my program/i }));
    fireEvent.click(screen.getByRole('button', { name: /use the coach/i }));
    expect(await screen.findByText('Coach Incline Press')).toBeInTheDocument();
    expect(localStorage.getItem('foundry:coach_ai_consent')).toBe('1');
  });

  it('tunes BEFORE save, shows the coached program, then saves exactly it', async () => {
    aiMock.mockResolvedValue({ days: COACHED });
    const onSave = renderPreview();
    expect(screen.getByText('Standard Bench')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /coach-tune my program/i }));
    expect(await screen.findByText('Coach Incline Press')).toBeInTheDocument();
    expect(screen.getByText(/COACH-TUNED/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^save program$/i }));
    expect(aiMock).toHaveBeenCalledTimes(1); // not again at save
    const saved = onSave.mock.calls[0][0];
    expect(saved.aiDays).toEqual(COACHED); // prescription intact, nothing swapped in after approval
  });

  it('a failed coach pass keeps the standard build and says so', async () => {
    // An empty coach program takes the same catch path as a network failure.
    // (A mocked rejection is reported by vitest even though the component
    // handles it — verified: one call, caught, message shown.)
    aiMock.mockResolvedValue({ days: [] });
    const onSave = renderPreview();
    fireEvent.click(screen.getByRole('button', { name: /coach-tune my program/i }));
    expect(await screen.findByText(/coach pass isn't available/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^save program$/i }));
    expect(onSave.mock.calls[0][0].aiDays).toEqual(STANDARD);
  });

  it('skipping the coach saves the standard build without calling it', async () => {
    const onSave = renderPreview();
    fireEvent.click(screen.getByRole('button', { name: /skip the coach/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(aiMock).not.toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].aiDays).toEqual(STANDARD);
  });
});
