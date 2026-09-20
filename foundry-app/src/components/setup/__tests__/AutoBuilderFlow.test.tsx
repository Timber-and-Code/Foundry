import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AutoBuilderFlow, { type AutoBuilderFlowProps } from '../AutoBuilderFlow';

const base = (autoForm: Partial<AutoBuilderFlowProps['autoForm']> = {}, setAuto = vi.fn()) => {
  const props: AutoBuilderFlowProps = {
    form: { name: 'Alex', age: '30', gender: 'm', weight: '180', goal: 'build_muscle', goalNote: '', theme: 'dark' },
    setupDob: { month: '', day: '', year: '' },
    autoForm: {
      experience: null,
      split: null,
      daysPerWeek: null,
      mesoLength: null,
      equipment: [],
      startDate: '2026-09-20',
      ...autoForm,
    },
    aiLoading: false,
    error: '',
    sLabel: {},
    sec: {},
    inputStyle: {},
    setAuto,
    toggleAutoEquip: vi.fn(),
    setAiLoading: vi.fn(),
    setAiCoachNote: vi.fn(),
    setError: vi.fn(),
    maybePromptLegBalance: vi.fn(),
    planningNext: true,
  };
  return render(<AutoBuilderFlow {...props} />);
};

describe('AutoBuilderFlow — nothing hides below the fold', () => {
  it('the footer button names the first unanswered question, in order', () => {
    base();
    expect(screen.getByRole('button', { name: /next: training split/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build my meso/i })).toBeNull();
  });

  it('walks days → length → experience → equipment', () => {
    const { unmount } = base({ split: 'ppl' });
    expect(screen.getByRole('button', { name: /next: days per week/i })).toBeInTheDocument();
    unmount();
    const r2 = base({ split: 'ppl', daysPerWeek: 3 });
    expect(screen.getByRole('button', { name: /next: meso length/i })).toBeInTheDocument();
    r2.unmount();
    const r3 = base({ split: 'ppl', daysPerWeek: 3, mesoLength: 6 });
    expect(screen.getByRole('button', { name: /next: experience level/i })).toBeInTheDocument();
    r3.unmount();
    base({ split: 'ppl', daysPerWeek: 3, mesoLength: 6, experience: 'new' });
    expect(screen.getByRole('button', { name: /next: equipment/i })).toBeInTheDocument();
  });

  it('offers Build My Meso only once everything is answered', () => {
    base({ split: 'ppl', daysPerWeek: 3, mesoLength: 6, experience: 'new', equipment: ['barbell'] });
    expect(screen.getByRole('button', { name: /build my meso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split: done' })).toBeInTheDocument();
  });

  it('lets a returning lifter change experience, and shows legacy values selected', () => {
    const setAuto = vi.fn();
    base({ experience: 'experienced' }, setAuto);
    expect(screen.getByRole('button', { name: '3+ years' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '1–3 years' }));
    expect(setAuto).toHaveBeenCalledWith('experience', 'intermediate');
  });
});
