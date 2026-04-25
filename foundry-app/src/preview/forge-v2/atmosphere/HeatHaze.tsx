import type { Phase } from '../fixtures';
import { PHASE_COLORS } from '../fixtures';

interface HeatHazeProps {
  phase?: Phase;
  /** 'focus' biases the anchor slightly left to signal active training */
  variant?: 'default' | 'focus';
}

/**
 * Radial phase-color gradient anchored to the top of the container. Mounted
 * inside the preview shell so phase atmosphere is scoped to the sandbox.
 */
export function HeatHaze({ phase = 'Intensification', variant = 'default' }: HeatHazeProps) {
  const color = PHASE_COLORS[phase];
  const anchor = variant === 'focus' ? '30% 0%' : '50% 0%';
  return (
    <div
      aria-hidden
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 384,
        zIndex: 1,
        background: `radial-gradient(ellipse at ${anchor}, ${color}22 0%, transparent 65%)`,
        transition: 'background 800ms ease-out',
      }}
    />
  );
}
