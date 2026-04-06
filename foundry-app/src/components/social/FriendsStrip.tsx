import { useState, useEffect } from 'react';
import { fetchMesoMembers } from '../../utils/sync';
import type { MesoMember } from '../../types';

interface FriendsStripProps {
  mesoId: string;
  onSelectFriend: (member: MesoMember) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

export default function FriendsStrip({ mesoId, onSelectFriend }: FriendsStripProps) {
  const [members, setMembers] = useState<MesoMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMesoMembers(mesoId).then((m) => {
      setMembers(m);
      setLoaded(true);
    });
  }, [mesoId]);

  if (!loaded || members.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        padding: '8px 0 12px',
        marginBottom: 8,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {members.map((m) => {
        const trainedToday = isToday(m.latestActivity?.completedAt ?? null);
        const activity = m.latestActivity;

        return (
          <button
            key={m.userId}
            onClick={() => onSelectFriend(m)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              minWidth: 56,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--bg-inset)',
                border: trainedToday ? '2px solid var(--accent)' : '2px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: trainedToday ? 'var(--accent)' : 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              {getInitials(m.name)}
              {trainedToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#4CAF50',
                    border: '2px solid var(--bg-card)',
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                maxWidth: 56,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.name.split(' ')[0]}
            </div>
            {activity && (
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text-dim)',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                D{activity.dayIdx + 1} W{activity.weekIdx + 1}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
