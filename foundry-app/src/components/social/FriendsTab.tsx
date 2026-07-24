import { useCallback, useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { listFriends } from '../../utils/sync';
import { useAuth } from '../../contexts/AuthContext';
import type { Friend } from '../../types';
import AddFriendModal, { FRIENDS_CHANGED_EVENT } from './AddFriendModal';
import FriendDashboardModal from './FriendDashboardModal';

/**
 * FriendsTab — the dedicated home for the social features (forge-v2).
 * Vertical friends list with an at-a-glance activity line per friend
 * (last workout recency + their active meso), tapping through to the
 * existing FriendDashboardModal in follow-only mode. Add-friend lives
 * here as the primary CTA (invite code + native share via AddFriendModal).
 *
 * The Home strip (FriendsSection) stays — this tab is the full surface.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'no workouts yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'no workouts yet';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'trained just now';
  if (mins < 60) return `trained ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `trained ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'trained yesterday';
  if (days < 7) return `trained ${days}d ago`;
  const wks = Math.round(days / 7);
  return `trained ${wks}w ago`;
}

/** Trained today (local calendar day) → the glance line gets the flame. */
function trainedToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function FriendsTab() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dashboardFriend, setDashboardFriend] = useState<Friend | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    listFriends().then((list) => {
      setFriends(list);
      setLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const AMBER = '#D4983C';

  return (
    <div style={{ padding: '16px 20px 0', animation: 'tabFadeIn 0.15s ease-out' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.0,
          }}
        >
          FRIENDS
        </div>
        {user && (
          <button
            onClick={() => setAddOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--accent)44',
              background: 'var(--accent)11',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.06em',
              fontFamily: 'inherit',
            }}
          >
            + ADD FRIEND
          </button>
        )}
      </div>

      {/* Signed-out state */}
      {!user && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            padding: '28px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            Train with friends
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Follow friends, share mesos, and see each other&rsquo;s progress. Sign in from the
            profile icon up top to get started.
          </div>
        </div>
      )}

      {/* Empty state */}
      {user && loaded && friends.length === 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            padding: '28px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            No friends yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
            Send an invite code and follow each other&rsquo;s training — completion grids, volume,
            and PRs, with privacy you control.
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              marginTop: 4,
              padding: '12px 24px',
              borderRadius: tokens.radius.lg,
              border: '1px solid var(--btn-primary-border)',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            Invite a friend
          </button>
        </div>
      )}

      {/* Friends list */}
      {user && friends.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {friends.map((f) => {
            const hot = trainedToday(f.lastWorkout?.completedAt ?? null);
            return (
              <button
                key={f.userId}
                type="button"
                onClick={() => setDashboardFriend(f)}
                aria-label={`Open ${f.name}'s dashboard`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: tokens.radius.full,
                    background: `${AMBER}22`,
                    border: `1.5px solid ${hot ? AMBER : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 800,
                    color: AMBER,
                    flexShrink: 0,
                  }}
                >
                  {initials(f.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {f.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: hot ? AMBER : 'var(--text-muted)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {hot ? '🔥 trained today' : relativeTime(f.lastWorkout?.completedAt ?? null)}
                    {f.activeMesoName ? ` · ${f.activeMesoName}` : ''}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.xs,
                    padding: '2px 6px',
                    flexShrink: 0,
                  }}
                  title={
                    f.shareLevel === 'full'
                      ? 'Shares sets + bodyweight with you'
                      : 'Shares completion only'
                  }
                >
                  {f.shareLevel === 'full' ? 'FULL' : 'BASIC'}
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-dim)', fontSize: 16 }}>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AddFriendModal open={addOpen} onClose={() => setAddOpen(false)} />

      {dashboardFriend && (
        <FriendDashboardModal
          open={!!dashboardFriend}
          onClose={() => setDashboardFriend(null)}
          /* Same MesoMember-shaped cast the Home strip uses — the dashboard
             only reads userId + name from it in follow-only mode. */
          member={{
            userId: dashboardFriend.userId,
            name: dashboardFriend.name,
            mesoId: dashboardFriend.activeMesoId ?? '',
            role: 'member',
            shareLevel: dashboardFriend.shareLevel,
            joinedAt: dashboardFriend.createdAt,
            latestActivity: dashboardFriend.lastWorkout ?? null,
          }}
          mesoId={undefined}
          totalWeeks={0}
          daysPerWeek={0}
        />
      )}
    </div>
  );
}
