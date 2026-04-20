/**
 * Tests for MesoLengthSheet — 3-option mesocycle length picker.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import MesoLengthSheet from '../MesoLengthSheet';

describe('MesoLengthSheet', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <MesoLengthSheet open={false} current={6} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders three options when open', () => {
    render(
      <MesoLengthSheet open current={6} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText(/^4 weeks$/i)).toBeInTheDocument();
    expect(screen.getByText(/^6 weeks$/i)).toBeInTheDocument();
    expect(screen.getByText(/^8 weeks$/i)).toBeInTheDocument();
  });

  it('fires onSelect with the chosen length and closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MesoLengthSheet open current={6} onSelect={onSelect} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText(/^8 weeks$/i));
    expect(onSelect).toHaveBeenCalledWith(8);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the current length with aria-pressed', () => {
    render(
      <MesoLengthSheet open current={6} onSelect={() => {}} onClose={() => {}} />,
    );
    const six = screen.getByText(/^6 weeks$/i).closest('button');
    expect(six).toHaveAttribute('aria-pressed', 'true');
    const four = screen.getByText(/^4 weeks$/i).closest('button');
    expect(four).toHaveAttribute('aria-pressed', 'false');
  });
});
