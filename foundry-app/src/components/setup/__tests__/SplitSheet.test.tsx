/**
 * Tests for SplitSheet — bottom sheet split picker for Beat 2.
 * Verifies visibility, selection, and the "Recommended" flag logic.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SplitSheet from '../SplitSheet';

describe('SplitSheet', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <SplitSheet
        open={false}
        current="upper_lower"
        daysPerWeek={4}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all six split cards when open', () => {
    render(
      <SplitSheet
        open
        current="upper_lower"
        daysPerWeek={4}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/push · pull · legs/i)).toBeInTheDocument();
    expect(screen.getByText(/upper \/ lower/i)).toBeInTheDocument();
    expect(screen.getByText(/^push \/ pull$/i)).toBeInTheDocument();
    expect(screen.getByText(/^full body$/i)).toBeInTheDocument();
    expect(screen.getByText(/traditional/i)).toBeInTheDocument();
    expect(screen.getByText(/^custom$/i)).toBeInTheDocument();
  });

  it('marks recommended flags based on daysPerWeek', () => {
    const { rerender } = render(
      <SplitSheet
        open
        current="upper_lower"
        daysPerWeek={4}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    // At 4 days: upper_lower, push_pull, full_body, traditional, custom all qualify.
    // ppl does NOT (its validDays are [3, 5, 6]).
    let recommended = screen.getAllByText(/^recommended$/i);
    expect(recommended.length).toBe(5);

    // At 6 days: ppl, full_body (no, 2-5), custom. Actually: ppl ✓, upper_lower ✗ (2/4),
    // push_pull ✗ (4), full_body ✗ (2-5), traditional ✗ (4-5), custom ✓.
    // Expect 2 recommended.
    rerender(
      <SplitSheet
        open
        current="ppl"
        daysPerWeek={6}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    recommended = screen.getAllByText(/^recommended$/i);
    expect(recommended.length).toBe(2);
  });

  it('fires onSelect then onClose when a card is tapped', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <SplitSheet
        open
        current="upper_lower"
        daysPerWeek={3}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/push · pull · legs/i));
    expect(onSelect).toHaveBeenCalledWith('ppl');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the current split with aria-pressed', () => {
    render(
      <SplitSheet
        open
        current="full_body"
        daysPerWeek={3}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const fullBody = screen.getByText(/^full body$/i).closest('button');
    expect(fullBody).toHaveAttribute('aria-pressed', 'true');
    const ppl = screen.getByText(/push · pull · legs/i).closest('button');
    expect(ppl).toHaveAttribute('aria-pressed', 'false');
  });
});
