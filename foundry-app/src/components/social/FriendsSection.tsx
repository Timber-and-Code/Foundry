import { useCallback, useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { listFriends } from '../../utils/sync';
import type { Friend } from '../../types';
import AddFriendModal, { FRIENDS_CHANGED_EVENT } from './AddFriendModal';
import FriendDashboardModal from './FriendDashboardModal';

/**
 * FriendsSection — horizontal scroll of the user's followed friends on the
 * Home view. Each tile → FriendDashboardModal resolving the friend's own
 * active meso. Trailing "+" tile opens AddFriendModal (invite code +
 * native share).
 *
 * Only renders when there are friends OR we want to surface the add CTA.
 * To avoid a dead strip on brand-new accounts, we still render the
 * "Add friend" tile so the feature is discoverable without drilling into
 * settings — but we suppress the section entirely if the list is empty
 * AND the user hasn't asked to show it. A small caller-controlled prop
 * (`alwaysShow`) lets Home keep the header + tile visible.
 */

interface FriendsSectionProps {
  /** When true, the section renders even with zero friends so the empty
   *  state + Add button are visible. Default true on Home. */
  alwaysShow?: boolean;
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
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  const wks = Math.round(days / 7);
  return `${wks}w`;
}

export default function FriendsSection({ alwaysShow = true }: FriendsSectionProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dashboardFriend, setDashboardFriend] = useState<Friend | null>(null);

  const refresh = useCallback(() => {
    listFriends().then((list) => {
      setFriends(list);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
  }, [refresh]);

  if (!loaded) return null;
  if (friends.length === 0 && !alwaysShow) return null;

  const AMBER = '#D4983C';

  return (
    <div style={{ padding: '0 20px', marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Friends
        </div>
        {friends.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim, var(--text-muted))',
              letterSpacing: '0.04em',
            }}
          >
            {friends.length}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
        }}
      >
        {friends.map((f) => (
          <button
            key={f.userId}
            type="button"
            onClick={() => setDashboardFriend(f)}
            aria-label={`Open ${f.name}'s dashboard`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              minWidth: 64,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.full,
                background: 'var(--bg-inset)',
                border: `2px solid ${AMBER}`,
                color: AMBER,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {initials(f.name)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-primary)',
                fontWeight: 600,
                maxWidth: 64,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {f.name.split(' ')[0]}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {f.lastWorkout ? relativeTime(f.lastWorkout.completedAt) : '—'}
            </div>
          </button>
        ))}

        {/* Add-friend tile — always rendered so the feature is discoverable
            even on an empty list. */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add a friend"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            minWidth: 64,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: tokens.radius.full,
              background: 'var(--bg-inset)',
              border: '2px dashed var(--border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 300,
              lineHeight: 1,
            }}
          >
            +
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            Add
          </div>
          <div style={{ height: 11 }} />
        </button>
      </div>

      <AddFriendModal open={addOpen} onClose={() => setAddOpen(false)} />

      {dashboardFriend && (
        <FriendDashboardModal
          open={dashboardFriend !== null}
          onClose={() => setDashboardFriend(null)}
          /* The dashboard expects a MesoMember-shaped payload, but the
             only fields it actually reads are userId + name. Cast the
             Friend row into that shape without fabricating the other
             fields we don't need. */
          member={{
            userId: dashboardFriend.userId,
            name: dashboardFriend.name,
            mesoId: dashboardFriend.activeMesoId ?? '',
            role: 'member',
            shareLevel: dashboardFriend.shareLevel,
            joinedAt: dashboardFriend.createdAt,
            latestActivity: dashboardFriend.lastWorkout ?? null,
          }}
          /* No shared mesoId — signals follow-only mode. Dashboard will
             resolve the friend's own active meso via fetchFriendMesoSummary
             and self-size the completion grid from its payload. */
          mesoId={undefined}
          totalWeeks={0}
          daysPerWeek={0}
        />
      )}
    </div>
  );
}
