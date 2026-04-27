import { tokens } from '../../styles/tokens';
import { VOLUME_LANDMARKS } from '../../data/constants';
import {
  flattenMuscleSets,
  getLandmarkStatus,
} from '../../utils/analyticsData';
import EmptyState from '../ui/EmptyState';

type Landmark = { mev: number; mavLow: number; mavHigh: number; mrv: number };

interface Props {
  byTag: Record<string, Record<string, number>>;
  title: string;
}

/**
 * Compact muscle-volume tracker. One row per muscle: name, sets ·
 * MEV X · MRV Y meta, and a 6px progress bar with an MEV tick.
 *
 * Replaces the prior multi-band 14px bar with status pill + legend
 * card, which read as too dense at the per-muscle scale. The single
 * orange tick at MEV gives the lifter a clear "have I cleared the
 * minimum?" read; sets count colors itself by zone (muted under MEV,
 * accent in optimal, hot orange when exceeding MRV).
 *
 * Mirrors the preview at src/preview/hybrid/ProgressPreview.tsx
 * VolumeRow().
 */
export default function VolumeLandmarksCard({ byTag, title }: Props) {
  const muscleSets = flattenMuscleSets(byTag);
  const entries = Object.entries(muscleSets)
    .filter(([m, s]) => s > 0 && (VOLUME_LANDMARKS as Record<string, Landmark>)[m])
    .sort((a, b) => {
      const sa = getLandmarkStatus(a[1], (VOLUME_LANDMARKS as Record<string, Landmark>)[a[0]]);
      const sb = getLandmarkStatus(b[1], (VOLUME_LANDMARKS as Record<string, Landmark>)[b[0]]);
      const priority = (s: NonNullable<ReturnType<typeof getLandmarkStatus>>) =>
        s.label === 'Exceeding' ? 0 : s.label === 'MV' ? 1 : 2;
      return priority(sa!) - priority(sb!) || (b[1] as number) - (a[1] as number);
    });

  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        title="No sets logged yet"
        body="Finish a workout to see your weekly volume versus MEV/MRV landmarks."
      />
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border-subtle, var(--border))',
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.0,
            textTransform: 'uppercase',
          }}
        >
          {title || 'Volume check'}
        </div>
      </div>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {entries.map(([muscle, sets]) => {
          const lm = (VOLUME_LANDMARKS as Record<string, Landmark>)[muscle];
          const setCount = sets as number;
          // Bar scales to MRV (anything past clamps to 100% via the cap).
          const pct = Math.min(100, Math.round((setCount / lm.mrv) * 100));
          // Color the count by zone — muted under MEV, accent inside the
          // optimal band, hotter orange when above MRV (overreach).
          const color =
            setCount === 0
              ? 'var(--text-muted)'
              : setCount < lm.mev
              ? 'var(--text-secondary)'
              : setCount > lm.mrv
              ? '#E8651A'
              : 'var(--accent)';
          // Tick at the MEV point — the only landmark we surface visually,
          // since the lifter's main question is "have I cleared the floor?"
          const mevPct = (lm.mev / lm.mrv) * 100;
          return (
            <div key={muscle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                  }}
                >
                  {muscle}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ color, fontWeight: 700 }}>{setCount}</span>
                  {' · MEV '}
                  {lm.mev}
                  {' · MRV '}
                  {lm.mrv}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 6,
                  background: 'var(--border-subtle, var(--border))',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: color,
                    transition: 'width 200ms',
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${mevPct}%`,
                    top: -2,
                    bottom: -2,
                    width: 1,
                    background: 'var(--text-primary)',
                    opacity: 0.3,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
