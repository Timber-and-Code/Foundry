/**
 * Previous Meso Cycles page — replaces the legacy MesoHistory placeholder.
 *
 * Lists archived mesos (newest first), each card expandable to show per-muscle
 * lift breakdowns + cardio + bw deltas. Ported from the sandbox preview impl
 * at archive/preview-experiments:foundry-app/src/preview/hybrid/ProgressPreview.tsx.
 */
import { useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { loadArchive } from '../../utils/store';
import { useExerciseDB } from '../../data/exerciseDB';
import { aggregatePreviousMesos, type PrevMeso } from '../../utils/progressAggregation';

interface PreviousMesosPageProps {
  goBack: () => void;
}

export default function PreviousMesosPage({ goBack }: PreviousMesosPageProps) {
  const db = useExerciseDB();
  const previousMesos = useMemo<PrevMeso[]>(() => {
    try {
      const archive = loadArchive();
      return aggregatePreviousMesos(archive, db);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to load previous mesos', e);
      return [];
    }
  }, [db]);

  const [expandedMeso, setExpandedMeso] = useState<string | null>(() =>
    previousMesos[0]?.id ?? null,
  );

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={goBack}
          className="btn-ghost"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
          aria-label="Back to Progress"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          PREVIOUS MESO CYCLES
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {previousMesos.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            No archived mesocycles yet. Finish a meso and start a new one to populate this view.
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 16,
              }}
            >
              Every past meso — lifts by muscle, cardio, PRs.
            </div>
            {previousMesos.map((m) => {
              const open = expandedMeso === m.id;
              const numStr = String(m.number).padStart(2, '0');
              return (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle, var(--border))',
                    borderRadius: tokens.radius.lg,
                    marginBottom: 12,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setExpandedMeso(open ? null : m.id)}
                    aria-expanded={open}
                    aria-controls={`prev-meso-${m.id}`}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                          fontSize: 20,
                          letterSpacing: '0.04em',
                          color: 'var(--text-primary)',
                          textTransform: 'uppercase',
                          lineHeight: 1,
                        }}
                      >
                        Meso {numStr}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {m.dates} · {m.phaseSummary}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                          fontSize: 16,
                          color: 'var(--accent)',
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                        }}
                      >
                        {m.sessions.done}/{m.sessions.total}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          marginTop: 2,
                        }}
                      >
                        {open ? 'Hide' : 'View'}
                      </div>
                    </div>
                  </button>
                  {open && (
                    <div
                      id={`prev-meso-${m.id}`}
                      style={{
                        padding: '4px 14px 16px 14px',
                        borderTop: '1px solid var(--border-subtle, var(--border))',
                      }}
                    >
                      {m.liftsByMuscle.length === 0 ? (
                        <div
                          style={{
                            padding: '12px 0',
                            fontSize: 13,
                            color: 'var(--text-muted)',
                          }}
                        >
                          No per-lift data available for this meso (legacy archive without
                          exercise IDs).
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                              fontSize: 11,
                              letterSpacing: '0.16em',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              margin: '12px 0 8px 0',
                            }}
                          >
                            Lifts by muscle
                          </div>
                          {m.liftsByMuscle.map((grp) => (
                            <div key={grp.muscle} style={{ marginBottom: 12 }}>
                              <div
                                style={{
                                  fontFamily:
                                    "'Bebas Neue', 'Inter', system-ui, sans-serif",
                                  fontSize: 13,
                                  letterSpacing: '0.08em',
                                  color: 'var(--accent)',
                                  textTransform: 'uppercase',
                                  marginBottom: 4,
                                }}
                              >
                                {grp.muscle}
                              </div>
                              {grp.lifts.map((l, i) => (
                                <div
                                  key={l.name}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    padding: '5px 0',
                                    borderBottom:
                                      i < grp.lifts.length - 1
                                        ? '1px solid var(--border-subtle, var(--border))'
                                        : 'none',
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        color: 'var(--text-primary)',
                                        fontWeight: 600,
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {l.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {l.start} → {l.end} lb · PR {l.pr}
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      fontFamily:
                                        "'Bebas Neue', 'Inter', system-ui, sans-serif",
                                      fontSize: 16,
                                      color: 'var(--accent)',
                                      fontVariantNumeric: 'tabular-nums',
                                      lineHeight: 1,
                                    }}
                                  >
                                    {l.end - l.start > 0 ? '+' : ''}
                                    {l.end - l.start}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      )}

                      <div
                        style={{
                          fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                          fontSize: 11,
                          letterSpacing: '0.16em',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          margin: '6px 0 6px 0',
                        }}
                      >
                        Cardio
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {m.cardio.sessions} sessions · {m.cardio.totalMin} min
                        </div>
                        {m.bwDelta && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            BW {m.bwDelta}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
