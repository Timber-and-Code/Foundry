/**
 * Tests for SessionLengthSheet — 3-option session duration picker.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionLengthSheet from '../SessionLengthSheet';

describe('SessionLengthSheet', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <SessionLengthSheet
        open={false}
        current="standard"
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders three options with duration + exercise target labels', () => {
    render(
      <SessionLengthSheet
        open
        current="standard"
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/^short$/i)).toBeInTheDocument();
    expect(screen.getByText(/^standard$/i)).toBeInTheDocument();
    expect(screen.getByText(/^long$/i)).toBeInTheDocument();
    // Duration summary present for each
    expect(screen.getByText(/~30–45 min/)).toBeInTheDocument();
    expect(screen.getByText(/~45–60 min/)).toBeInTheDocument();
    expect(screen.getByText(/~60–75 min/)).toBeInTheDocument();
  });

  it('fires onSelect with the chosen value and closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionLengthSheet
        open
        current="standard"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/^long$/i));
    expect(onSelect).toHaveBeenCalledWith('long');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the current session length with aria-pressed', () => {
    render(
      <SessionLengthSheet
        open
        current="short"
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const short = screen.getByText(/^short$/i).closest('button');
    expect(short).toHaveAttribute('aria-pressed', 'true');
    const long = screen.getByText(/^long$/i).closest('button');
    expect(long).toHaveAttribute('aria-pressed', 'false');
  });
});
