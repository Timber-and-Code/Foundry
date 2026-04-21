/**
 * Tests for SwapMenu — the full-height swap submenu that replaced the old
 * bottom-sheet SwapSheet.
 *
 * Focus is on the wrapper behaviour; the inner ExerciseBrowser has its
 * own dedicated test file.
 *
 *   - Renders nothing while `open` is false (no layout shift).
 *   - Header shows a 44pt+ BACK button and the SWAP EXERCISE title.
 *   - Subheader surfaces `Replacing: {name}` when provided.
 *   - Back button + Escape key both call `onClose`.
 *   - `dialog` role + `aria-labelledby` wired for screen readers.
 *   - SwapScopeSelector is rendered when `scopePending` is set.
 *   - Body scroll is locked while open.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SwapMenu from '../SwapMenu';

function renderMenu(overrides: Partial<Parameters<typeof SwapMenu>[0]> = {}) {
  const props: Parameters<typeof SwapMenu>[0] = {
    open: true,
    onClose: vi.fn(),
    replacingName: 'Flat Barbell Bench Press',
    exerciseGroups: {
      chest: [
        { id: 'db_incline_press', name: 'Incline DB Press', muscle: 'chest', equipment: 'dumbbell' },
      ],
    },
    autoExpandMuscle: 'chest',
    onSelect: vi.fn(),
    onCustomExercise: vi.fn(),
    scopePending: null,
    onScopeMeso: vi.fn(),
    onScopeWeek: vi.fn(),
    onScopeCancel: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SwapMenu {...props} />) };
}

describe('SwapMenu', () => {
  it('renders nothing while `open` is false', () => {
    const { container } = render(
      <SwapMenu
        open={false}
        onClose={() => {}}
        replacingName="x"
        exerciseGroups={{}}
        onSelect={() => {}}
        scopePending={null}
        onScopeMeso={() => {}}
        onScopeWeek={() => {}}
        onScopeCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the SWAP EXERCISE title and a big BACK button', () => {
    renderMenu();
    expect(screen.getByText('SWAP EXERCISE')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: /go back/i });
    // 44pt tap target — spec says minimum.
    expect(Number(back.style.minHeight.replace('px', ''))).toBeGreaterThanOrEqual(44);
    expect(Number(back.style.minWidth.replace('px', ''))).toBeGreaterThanOrEqual(44);
    expect(back.textContent).toMatch(/BACK/);
  });

  it('surfaces the replacing-name subheader', () => {
    renderMenu({ replacingName: 'Barbell Row' });
    expect(screen.getByText(/Replacing:/)).toBeInTheDocument();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
  });

  it('calls onClose when BACK is tapped', () => {
    const { props } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const { props } = renderMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('wires `dialog` role and aria-labelledby for screen readers', () => {
    renderMenu();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleNode = document.getElementById(labelledBy!);
    expect(titleNode).not.toBeNull();
    expect(titleNode!.textContent).toBe('SWAP EXERCISE');
  });

  it('renders the scope selector when scopePending is set', () => {
    renderMenu({ scopePending: { exerciseName: 'Flat Bench' } });
    // Scope copy from SwapScopeSelector.
    expect(screen.getByText(/Apply this swap to/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entire Meso/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /This Session Only/ })).toBeInTheDocument();
  });

  it('locks body scroll while open and restores on unmount', () => {
    const before = document.body.style.overflow;
    const { unmount } = renderMenu();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe(before);
  });

  it('forwards taps on an exercise row to onSelect', () => {
    const { props } = renderMenu();
    // `chest` is auto-expanded.
    fireEvent.click(screen.getByText('Incline DB Press'));
    expect(props.onSelect).toHaveBeenCalledWith('db_incline_press');
  });
});
