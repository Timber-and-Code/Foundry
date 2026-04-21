/**
 * Tests for AccordionBar — the collapsible row used in Beat 2 preview.
 *
 * Covers:
 *  - header label + value render
 *  - children only render when open
 *  - aria-expanded flips with `open` prop
 *  - toggle handler fires on header click
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AccordionBar from '../AccordionBar';

describe('AccordionBar', () => {
  it('renders header label and value text', () => {
    render(
      <AccordionBar label="SPLIT" value="Upper / Lower" open={false} onToggle={() => {}}>
        <div>body-content</div>
      </AccordionBar>,
    );
    expect(screen.getByText('SPLIT')).toBeInTheDocument();
    expect(screen.getByText('Upper / Lower')).toBeInTheDocument();
  });

  it('hides children when closed', () => {
    render(
      <AccordionBar label="SPLIT" value="Upper / Lower" open={false} onToggle={() => {}}>
        <div>body-content</div>
      </AccordionBar>,
    );
    expect(screen.queryByText('body-content')).not.toBeInTheDocument();
  });

  it('renders children when open', () => {
    render(
      <AccordionBar label="SPLIT" value="Upper / Lower" open onToggle={() => {}}>
        <div>body-content</div>
      </AccordionBar>,
    );
    expect(screen.getByText('body-content')).toBeInTheDocument();
  });

  it('sets aria-expanded based on open prop', () => {
    const { rerender } = render(
      <AccordionBar label="SPLIT" value="Upper / Lower" open={false} onToggle={() => {}}>
        <div>body</div>
      </AccordionBar>,
    );
    const header = screen.getByRole('button');
    expect(header).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <AccordionBar label="SPLIT" value="Upper / Lower" open onToggle={() => {}}>
        <div>body</div>
      </AccordionBar>,
    );
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('fires onToggle when header clicked', () => {
    const onToggle = vi.fn();
    render(
      <AccordionBar label="SPLIT" value="Upper / Lower" open={false} onToggle={onToggle}>
        <div>body</div>
      </AccordionBar>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('wires aria-controls to the body id when open', () => {
    render(
      <AccordionBar label="SESSION" value="Standard" open onToggle={() => {}}>
        <div data-testid="body">content</div>
      </AccordionBar>,
    );
    const header = screen.getByRole('button');
    const controlsId = header.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const body = screen.getByTestId('body').parentElement;
    expect(body?.id).toBe(controlsId);
  });
});
