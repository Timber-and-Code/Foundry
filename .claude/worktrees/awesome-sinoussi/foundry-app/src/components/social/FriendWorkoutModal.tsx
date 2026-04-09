import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { fetchFriendWorkout } from '../../utils/sync';
import { tokens } from '../../styles/tokens';
import type { MesoMember, FriendWorkoutData } from '../../types';

interface FriendWorkoutModalProps {
  open: boolean;
  member: MesoMember | null;
  mesoId: string;
  dayIdx: number;
  weekIdx: number;
  onClose: () => void;
}

export default function FriendWorkoutModal({
  open,
  member,
  mesoId,
  dayIdx,
  weekIdx,
  onClose,
}: FriendWorkoutModalProps) {
  const [data, setData] = useState<FriendWorkoutData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !member) return;
    setLoading(true);
    setData(null);
    fetchFriendWorkout(member.userId, mesoId, dayIdx, weekIdx).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [open, member?.userId, mesoId, dayIdx, weekIdx]);

  return (
    <Modal open={open} onClose={onClose} maxWidth={400}>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {member?.name || 'Friend'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Day {dayIdx + 1} &middot; Week {weekIdx + 1}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Loading workout...
          </div>
        )}

        {!loading && data && data.exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            No workout logged yet for this session.
          </div>
        )}

        {!loading && data && data.exercises.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            {data.exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ex.name}
                  </div>
                  {ex.muscle && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        background: 'var(--accent-subtle)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {ex.muscle}
                    </div>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ textAlign: 'left', padding: '2px 0', fontWeight: 600 }}>Set</th>
                      <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 600 }}>Wt</th>
                      <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 600 }}>Reps</th>
                      <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 600 }}>RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((set, si) => (
                      <tr key={si} style={{ color: 'var(--text-primary)' }}>
                        <td style={{ padding: '3px 0', color: 'var(--text-muted)' }}>{si + 1}</td>
                        <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 600 }}>
                          {set.weight || '-'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 600 }}>
                          {set.reps || '-'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {set.rpe ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
