/**
 * Tests for SplitSheet + SplitBody — the split picker used in Beat 2.
 * Verifies sheet visibility, selection, "Recommended" flag logic, and
 * the reusable `SplitBody` surface that the AccordionBar consumes.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SplitSheet, { SplitBody } from '../SplitSheet';

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
    expect(screen.getByText(/^traditional$/i)).toBeInTheDocument();
    expect(screen.getByText(/^custom$/i)).toBeInTheDocument();
  });

  it('does not mention "bro split" anywhere', () => {
    render(
      <SplitSheet
        open
        current="upper_lower"
        daysPerWeek={4}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/bro split/i)).not.toBeInTheDocument();
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
    // At 4 days: upper_lower (2-6), push_pull (2-6), full_body (2-5),
    // traditional (4-5), and custom all qualify. ppl (3/5/6) does NOT.
    let recommended = screen.getAllByText(/^recommended$/i);
    expect(recommended.length).toBe(5);

    // At 6 days: ppl (3/5/6) ✓, upper_lower (2-6) ✓, push_pull (2-6) ✓,
    // full_body (2-5) ✗, traditional (4-5-6) ✓, custom ✓ → 5 recommended.
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
    expect(recommended.length).toBe(5);
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

describe('SplitBody', () => {
  it('renders all six cards inline', () => {
    render(<SplitBody current="upper_lower" daysPerWeek={4} onSelect={() => {}} />);
    expect(screen.getByText(/push · pull · legs/i)).toBeInTheDocument();
    expect(screen.getByText(/^upper \/ lower$/i)).toBeInTheDocument();
    expect(screen.getByText(/^push \/ pull$/i)).toBeInTheDocument();
    expect(screen.getByText(/^full body$/i)).toBeInTheDocument();
    expect(screen.getByText(/^traditional$/i)).toBeInTheDocument();
    expect(screen.getByText(/^custom$/i)).toBeInTheDocument();
  });

  it('fires onSelect only (no onClose) when a card is tapped', () => {
    const onSelect = vi.fn();
    render(<SplitBody current="upper_lower" daysPerWeek={3} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/^traditional$/i));
    expect(onSelect).toHaveBeenCalledWith('traditional');
  });

  it('labels the traditional split without the "bro split" phrase', () => {
    render(<SplitBody current="upper_lower" daysPerWeek={4} onSelect={() => {}} />);
    expect(screen.getByText(/^traditional$/i)).toBeInTheDocument();
    expect(screen.queryByText(/bro split/i)).not.toBeInTheDocument();
  });
});
