import { useState, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { fetchMesoMembers } from '../../utils/sync';
import { useAuth } from '../../contexts/AuthContext';
import MesoPrivacyModal, { SHARE_LEVEL_EVENT } from './MesoPrivacyModal';
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
  const { user } = useAuth();
  const [members, setMembers] = useState<MesoMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    fetchMesoMembers(mesoId).then((m) => {
      setMembers(m);
      setLoaded(true);
    });
    // Share-level toggled elsewhere → re-read so the strip reflects the new
    // state (the strip doesn't directly render shareLevel today, but future
    // dashboard fetches branched off this data will).
    const onShare = () => {
      fetchMesoMembers(mesoId).then(setMembers);
    };
    window.addEventListener(SHARE_LEVEL_EVENT, onShare);
    return () => window.removeEventListener(SHARE_LEVEL_EVENT, onShare);
  }, [mesoId]);

  if (!loaded || members.length === 0) return null;

  return (
    <>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
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
                borderRadius: tokens.radius.full,
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
                    borderRadius: tokens.radius.full,
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

      {/* Privacy gear — trailing tile, only shown when we know who the user
          is (needed to read their own share_level row). Subtle styling so
          it reads as a control, not a peer avatar. */}
      {user?.id && (
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          aria-label="Change your sharing privacy"
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
            marginLeft: 4,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: tokens.radius.full,
              background: 'var(--bg-inset)',
              border: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            Privacy
          </div>
        </button>
      )}
    </div>

    {user?.id && (
      <MesoPrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        mesoId={mesoId}
        selfUserId={user.id}
      />
    )}
    </>
  );
}
