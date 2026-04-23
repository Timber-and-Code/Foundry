import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { tokens } from '../../styles/tokens';
import { fetchFriendMesoSummary } from '../../utils/sync';
import type { MesoMember } from '../../types';
import type { FriendMesoSummary } from '../../utils/sync';

/**
 * FriendDashboardModal — aggregate view of a friend's progress on the
 * shared mesocycle. Opened from the FriendsStrip (via onSelectFriend in
 * HomeView / WorkoutSplash).
 *
 * Respects share_level:
 *   - `full`  → completion grid + volume-by-week bars + top PRs
 *   - `basic` → completion grid + last workout only; PRs/volume hidden
 *               behind a "Basic sharing" notice so the user knows there's
 *               more data, just not visible.
 *
 * This modal intentionally pulls everything in one round trip via
 * fetchFriendMesoSummary so the UI renders in one paint and we don't
 * flicker through partial states.
 */

interface FriendDashboardModalProps {
  open: boolean;
  onClose: () => void;
  member: MesoMember | null;
  mesoId: string;
  /** Total weeks in the active mesocycle (including deload). Used to size
   *  the completion grid — passed in so this modal doesn't need to import
   *  getMeso() and create a circular dep through constants. */
  totalWeeks: number;
  /** Days-per-week in the active mesocycle. Same reasoning as totalWeeks. */
  daysPerWeek: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.round(days / 7);
  return `${wks}w ago`;
}

export default function FriendDashboardModal({
  open,
  onClose,
  member,
  mesoId,
  totalWeeks,
  daysPerWeek,
}: FriendDashboardModalProps) {
  const [summary, setSummary] = useState<FriendMesoSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !member) return;
    setLoading(true);
    setSummary(null);
    fetchFriendMesoSummary(member.userId, mesoId).then((res) => {
      setSummary(res);
      setLoading(false);
    });
  }, [open, member?.userId, mesoId]);

  const AMBER = '#D4983C';
  const doneSet = new Set(summary?.completedDays ?? []);
  const maxVolume = summary
    ? Math.max(1, ...summary.volumeByWeek.map((v) => v.volume))
    : 1;

  return (
    <Modal open={open} onClose={onClose} maxWidth={420}>
      <div>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: tokens.radius.full,
              background: 'var(--bg-inset)',
              border: `2px solid ${AMBER}`,
              color: AMBER,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(member?.name || 'Friend')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {member?.name || 'Friend'}
            </div>
            {summary?.lastWorkout && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Last workout: D{summary.lastWorkout.dayIdx + 1} W
                {summary.lastWorkout.weekIdx + 1} &middot;{' '}
                {relativeTime(summary.lastWorkout.completedAt)}
              </div>
            )}
            {summary && !summary.lastWorkout && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Hasn't trained on this program yet.
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Loading…
          </div>
        )}

        {!loading && summary && (
          <>
            {/* Completion grid — one row per week, columns per workout day. */}
            <SectionHeader>Completion</SectionHeader>
            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                padding: 12,
                marginBottom: 14,
                overflowX: 'auto',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `auto repeat(${daysPerWeek}, 1fr)`,
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                {/* Top row: blank + day numbers */}
                <div />
                {Array.from({ length: daysPerWeek }, (_, i) => (
                  <div
                    key={`h-${i}`}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textAlign: 'center',
                    }}
                  >
                    D{i + 1}
                  </div>
                ))}
                {Array.from({ length: totalWeeks }, (_, w) => (
                  <>
                    <div
                      key={`wk-${w}`}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.06em',
                        paddingRight: 4,
                      }}
                    >
                      W{w + 1}
                    </div>
                    {Array.from({ length: daysPerWeek }, (_, d) => {
                      const done = doneSet.has(`${d}:${w}`);
                      return (
                        <div
                          key={`d-${w}-${d}`}
                          aria-label={done ? `Day ${d + 1}, week ${w + 1} complete` : undefined}
                          style={{
                            height: 18,
                            borderRadius: 4,
                            background: done ? AMBER : 'transparent',
                            border: done ? 'none' : '1px solid var(--border)',
                          }}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            {/* Volume bars — full only */}
            {summary.shareLevel === 'full' && summary.volumeByWeek.length > 0 && (
              <>
                <SectionHeader>Weekly Volume</SectionHeader>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-end',
                    height: 80,
                    marginBottom: 14,
                    padding: '8px 12px',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.lg,
                  }}
                >
                  {summary.volumeByWeek.map((v) => (
                    <div
                      key={v.weekIdx}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      aria-label={`Week ${v.weekIdx + 1}: ${Math.round(v.volume).toLocaleString()} lbs`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(4, (v.volume / maxVolume) * 54)}px`,
                          background: AMBER,
                          borderRadius: 3,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        W{v.weekIdx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* PR list — full only */}
            {summary.shareLevel === 'full' && summary.prs.length > 0 && (
              <>
                <SectionHeader>Top PRs</SectionHeader>
                <div
                  style={{
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.lg,
                    padding: '8px 12px',
                    marginBottom: 14,
                  }}
                >
                  {summary.prs.map((pr, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          marginRight: 8,
                        }}
                      >
                        {pr.exerciseName}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: AMBER,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pr.weight} × {pr.reps}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          letterSpacing: '0.06em',
                          marginLeft: 10,
                          minWidth: 28,
                          textAlign: 'right',
                        }}
                      >
                        W{pr.weekIdx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Basic sharing notice */}
            {summary.shareLevel === 'basic' && (
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(212,152,60,0.08)',
                  border: '1px solid rgba(212,152,60,0.3)',
                  borderRadius: tokens.radius.lg,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: AMBER, fontWeight: 700, letterSpacing: '0.06em' }}>
                  BASIC SHARING ·
                </span>{' '}
                {member?.name || 'Your friend'} is only sharing completion — weights,
                reps, volume, and PRs are hidden.
              </div>
            )}

            {/* Empty state for brand-new friend */}
            {summary.completedDays.length === 0 && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                Nothing logged yet on this program.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.14em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
