import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import EquipmentPicker, { EQUIPMENT_OPTIONS } from '../EquipmentPicker';

const ALL = EQUIPMENT_OPTIONS.map((o) => o.value);

describe('EquipmentPicker', () => {
  it('"All equipment" selects every option in one tap', () => {
    const onSetAll = vi.fn();
    render(<EquipmentPicker selected={['barbell']} onToggle={() => {}} onSetAll={onSetAll} />);
    const all = screen.getByRole('button', { name: /all equipment/i });
    expect(all).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(all);
    expect(onSetAll).toHaveBeenCalledWith(ALL);
  });

  it('shows All as on when everything is selected, and tapping it clears', () => {
    const onSetAll = vi.fn();
    render(<EquipmentPicker selected={[...ALL]} onToggle={() => {}} onSetAll={onSetAll} />);
    const all = screen.getByRole('button', { name: /all equipment/i });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(all);
    expect(onSetAll).toHaveBeenCalledWith([]);
  });

  it('individual items still toggle one at a time', () => {
    const onToggle = vi.fn();
    render(<EquipmentPicker selected={[]} onToggle={onToggle} onSetAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^cable$/i }));
    expect(onToggle).toHaveBeenCalledWith('cable');
  });
});
