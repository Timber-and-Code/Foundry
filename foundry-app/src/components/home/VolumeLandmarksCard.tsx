import { tokens } from '../../styles/tokens';
import { VOLUME_LANDMARKS } from '../../data/constants';
import {
  flattenMuscleSets,
  getLandmarkStatus,
  VOLUME_LEGEND,
  BAND_MV,
  BAND_OPT,
  BAND_EXCEED,
  TICK_COLOR,
} from '../../utils/analyticsData';

type Landmark = { mev: number; mavLow: number; mavHigh: number; mrv: number };

interface Props {
  byTag: Record<string, Record<string, number>>;
  title: string;
}

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
  if (entries.length === 0) return null;

  const lblOpt = 'var(--phase-accum)';

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
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          {title || 'Volume check'}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {VOLUME_LEGEND.map(([c, label], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: tokens.radius.xs,
                  background: c,
                  opacity: 0.75,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px 6px' }}>
        {entries.map(([muscle, sets], idx) => {
          const lm = (VOLUME_LANDMARKS as Record<string, Landmark>)[muscle];
          const status = getLandmarkStatus(sets as number, lm)!;
          const scale = lm.mrv + 5;
          const mevPct = (lm.mev / scale) * 100;
          const mrvPct = (lm.mrv / scale) * 100;
          const fillPct = Math.min(((sets as number) / scale) * 100, 99);
          const isLast = idx === entries.length - 1;
          const optMid = (mevPct + mrvPct) / 2;
          return (
            <div
              key={muscle}
              style={{
                padding: '11px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {muscle}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: status.color,
                    minWidth: 20,
                    textAlign: 'right',
                    lineHeight: 1,
                  }}
                >
                  {sets as number}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: status.color,
                    background: status.bg,
                    border: `1px solid ${status.border}`,
                    padding: '3px 9px',
                    borderRadius: tokens.radius.sm,
                    minWidth: 64,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {status.label}
                </div>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 14,
                  borderRadius: tokens.radius.sm,
                  overflow: 'hidden',
                  background: 'var(--bg-inset)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${mevPct}%`,
                    background: BAND_MV,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mevPct}%`,
                    top: 0,
                    height: '100%',
                    width: `${mrvPct - mevPct}%`,
                    background: BAND_OPT,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mrvPct}%`,
                    top: 0,
                    height: '100%',
                    right: 0,
                    background: BAND_EXCEED,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mevPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK_COLOR,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mrvPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK_COLOR,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${fillPct}%`,
                    background: status.fill,
                    opacity: 0.72,
                    borderRadius: `${tokens.radius.sm}px 0 0 ${tokens.radius.sm}px`,
                    transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              </div>
              <div style={{ position: 'relative', height: 14, marginTop: 3 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: `${optMid}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 12,
                    color: lblOpt,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lm.mev}–{lm.mrv} optimal
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
