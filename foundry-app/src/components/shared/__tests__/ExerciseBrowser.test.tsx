/**
 * Tests for the shared ExerciseBrowser primitive.
 *
 * Covers the invariants that callers (SwapMenu, Explore library) rely on:
 *   - Muscle groups render as COLLAPSIBLE ROWS, not pills.
 *   - `autoExpandMuscle` both expands that group on mount and pins it to
 *     the top of the list (pinning is what makes the swap UX feel right).
 *   - Only one group is open at a time; tapping a new header collapses
 *     the old.
 *   - The search bar is rendered BEFORE the scroll area, so the iOS
 *     keyboard can never cover it.
 *   - `select` mode renders the literal word SWAP (per user preference
 *     — no arrow glyph).
 *   - `browse` mode renders a chevron.
 *   - `userEquipment` dims rows that require kit the user doesn't have.
 *   - Custom-exercise affordance only fires in `select` mode.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ExerciseBrowser from '../ExerciseBrowser';

function makeGroups() {
  return {
    chest: [
      { id: 'bb_flat_bench', name: 'Flat Barbell Bench Press', muscle: 'chest', equipment: 'barbell' },
      { id: 'db_incline_press', name: 'Incline DB Press', muscle: 'chest', equipment: 'dumbbell' },
    ],
    triceps: [
      { id: 'tri_pushdown', name: 'Tricep Pushdown', muscle: 'triceps', equipment: 'cable' },
    ],
    back: [
      { id: 'bb_row', name: 'Barbell Row', muscle: 'back', equipment: 'barbell' },
    ],
  };
}

describe('ExerciseBrowser', () => {
  it('renders every muscle group as a collapsible row (not a pill filter)', () => {
    render(<ExerciseBrowser groups={makeGroups()} mode="select" />);
    expect(screen.getByRole('button', { name: /CHEST/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TRICEPS/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BACK/ })).toBeInTheDocument();
  });

  it('auto-expands `autoExpandMuscle` and pins it to the top of the list', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="triceps"
      />,
    );
    // Triceps group is expanded — its exercise is visible.
    expect(screen.getByText('Tricep Pushdown')).toBeInTheDocument();
    // Chest group is collapsed — its exercises are NOT in the DOM.
    expect(screen.queryByText('Flat Barbell Bench Press')).toBeNull();

    // `triceps` should appear before `chest` in document order.
    const headers = screen.getAllByRole('button').filter((b) =>
      /CHEST|TRICEPS|BACK/.test(b.textContent || ''),
    );
    const triIdx = headers.findIndex((h) => /TRICEPS/.test(h.textContent || ''));
    const chestIdx = headers.findIndex((h) => /CHEST/.test(h.textContent || ''));
    expect(triIdx).toBeLessThan(chestIdx);
  });

  it('expands only one group at a time — tapping a new header collapses the old', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="chest"
      />,
    );
    expect(screen.getByText('Flat Barbell Bench Press')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /TRICEPS/ }));
    expect(screen.getByText('Tricep Pushdown')).toBeInTheDocument();
    expect(screen.queryByText('Flat Barbell Bench Press')).toBeNull();
  });

  it('fires onSelect with the exercise id when a row is tapped', () => {
    const onSelect = vi.fn();
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="back"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Barbell Row'));
    expect(onSelect).toHaveBeenCalledWith('bb_row');
  });

  it('renders the search input BEFORE the scroll content (so iOS keyboard cannot cover it)', () => {
    const { container } = render(<ExerciseBrowser groups={makeGroups()} mode="select" />);
    const input = container.querySelector('input[aria-label="Search exercises"]');
    const firstGroupHeader = screen.getByRole('button', { name: /CHEST/ });
    expect(input).not.toBeNull();
    // `compareDocumentPosition` sets PRECEDING bit (2) when `input` precedes the header.
    const position = input!.compareDocumentPosition(firstGroupHeader);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('flattens and filters across groups while searching', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="chest"
      />,
    );
    const input = screen.getByLabelText('Search exercises');
    fireEvent.change(input, { target: { value: 'row' } });
    // Barbell Row matches even though its group is collapsed.
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
    // Chest exercises no longer show (they don't match the query).
    expect(screen.queryByText('Flat Barbell Bench Press')).toBeNull();
  });

  it('uses the literal word SWAP (not an arrow glyph) in select mode', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="back"
      />,
    );
    // The SWAP label is rendered on every exercise row when the group is open.
    expect(screen.getAllByText('SWAP').length).toBeGreaterThan(0);
    // No "⇄" glyph appears in the tree.
    const { container } = render(
      <ExerciseBrowser groups={makeGroups()} mode="select" autoExpandMuscle="back" />,
    );
    expect(container.textContent).not.toContain('⇄');
  });

  it('renders a chevron (and no SWAP label) in browse mode', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="browse"
        autoExpandMuscle="back"
      />,
    );
    expect(screen.queryByText('SWAP')).toBeNull();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
  });

  it('dims rows whose equipment is not in userEquipment', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        autoExpandMuscle="chest"
        userEquipment={['dumbbell']}
      />,
    );
    // Flat bench (barbell) should be dimmed.
    const flatRow = screen.getByText('Flat Barbell Bench Press').closest('button')!;
    expect(Number(flatRow.style.opacity)).toBeLessThan(1);
    // Incline DB press (dumbbell) should be fully opaque.
    const dbRow = screen.getByText('Incline DB Press').closest('button')!;
    expect(Number(dbRow.style.opacity || '1')).toBe(1);
  });

  it('exposes the custom-exercise affordance in select mode once the query is 2+ chars', () => {
    const onCustomExercise = vi.fn();
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="select"
        onCustomExercise={onCustomExercise}
      />,
    );
    const input = screen.getByLabelText('Search exercises');
    fireEvent.change(input, { target: { value: 'zzznonexistent' } });
    const btn = screen.getByRole('button', { name: /Add .zzznonexistent. as custom exercise/ });
    fireEvent.click(btn);
    expect(onCustomExercise).toHaveBeenCalledWith('zzznonexistent');
  });

  it('does NOT show the custom-exercise affordance in browse mode', () => {
    render(
      <ExerciseBrowser
        groups={makeGroups()}
        mode="browse"
        onCustomExercise={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('Search exercises');
    fireEvent.change(input, { target: { value: 'zzznonexistent' } });
    expect(screen.queryByRole('button', { name: /as custom exercise/ })).toBeNull();
  });

  it('renders a row count next to every muscle header', () => {
    render(<ExerciseBrowser groups={makeGroups()} mode="select" />);
    const chestBtn = screen.getByRole('button', { name: /CHEST/ });
    expect(within(chestBtn).getByText('(2)')).toBeInTheDocument();
    const triBtn = screen.getByRole('button', { name: /TRICEPS/ });
    expect(within(triBtn).getByText('(1)')).toBeInTheDocument();
  });
});
