import type { CSSProperties } from 'react';

type Segment = 'done' | 'current' | 'upcoming';

interface StrikeTickProps {
  segments: Segment[];
  phaseColor: string;
  onSegmentTap?: (i: number) => void;
  height?: number;
}

/**
 * Horizontal progress bar split into equal segments. Done = phase color + glow,
 * current = white with pulse, upcoming = dim border color.
 */
export function StrikeTick({ segments, phaseColor, onSegmentTap, height = 3 }: StrikeTickProps) {
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {segments.map((s, i) => {
        const base: CSSProperties = {
          flex: 1,
          height,
          background: 'var(--fv-border-2)',
          transition: 'background 200ms',
          cursor: onSegmentTap ? 'pointer' : 'default',
        };
        if (s === 'done') {
          base.background = phaseColor;
          base.boxShadow = `0 0 4px ${phaseColor}aa`;
        } else if (s === 'current') {
          base.background = 'var(--fv-text-hi)';
          base.boxShadow = '0 0 6px var(--fv-text-hi)';
        }
        const el = (
          <div
            key={i}
            style={base}
            className={s === 'current' ? 'fv-pulse-glow' : undefined}
            onClick={onSegmentTap ? () => onSegmentTap(i) : undefined}
            role={onSegmentTap ? 'button' : undefined}
            aria-label={onSegmentTap ? `Jump to exercise ${i + 1}` : undefined}
            tabIndex={onSegmentTap ? 0 : undefined}
          />
        );
        return el;
      })}
    </div>
  );
}
