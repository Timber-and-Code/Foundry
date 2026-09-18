import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { removeFriend, updateFriendShareLevel } from '../../utils/sync';
import { emit } from '../../utils/events';
import { FRIENDS_CHANGED_EVENT } from './AddFriendModal';
import type { MesoShareLevel } from '../../types';

interface FriendshipControlsProps {
  friendId: string;
  friendName: string;
  /** The friendship's sharing level — mutual, the same for both people. */
  myShareLevel: MesoShareLevel;
  /** Called after the friendship is removed — the caller closes its sheet. */
  onRemoved: () => void;
}

const LEVELS: { value: MesoShareLevel; label: string; detail: string }[] = [
  { value: 'full', label: 'Full', detail: "You both see each other's workouts, weights, reps and body weight" },
  { value: 'basic', label: 'Basic', detail: 'You both see only which days the other trained' },
];

/**
 * A friendship's controls: its sharing level (mutual — one level for both
 * people, migration 014) and a way out. Nothing in the app exposed either
 * before: once connected, there was no way to stop sharing with someone.
 */
export default function FriendshipControls({ friendId, friendName, myShareLevel, onRemoved }: FriendshipControlsProps) {
  const [level, setLevel] = useState<MesoShareLevel>(myShareLevel);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const first = friendName.split(/\s+/)[0] || 'this friend';

  const changeLevel = async (next: MesoShareLevel) => {
    if (next === level || saving) return;
    const prev = level;
    setLevel(next);
    setSaving(true);
    const ok = await updateFriendShareLevel(friendId, next);
    setSaving(false);
    if (!ok) {
      setLevel(prev);
      emit('foundry:toast', { message: "Couldn't change sharing. Check your connection and try again.", type: 'error' });
      return;
    }
    window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
  };

  const remove = async () => {
    setRemoving(true);
    const ok = await removeFriend(friendId);
    setRemoving(false);
    if (!ok) {
      emit('foundry:toast', { message: "Couldn't remove friend. Check your connection and try again.", type: 'error' });
      return;
    }
    window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
    emit('foundry:toast', { message: `Removed ${first}. You no longer see each other's training.`, type: 'success' });
    onRemoved();
  };

  return (
    <section
      aria-labelledby="friendship-controls-title"
      style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}
    >
      <div
        id="friendship-controls-title"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Sharing with {first}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
        Sharing is mutual. Changing it changes what you both see.
      </p>
      <div role="radiogroup" aria-labelledby="friendship-controls-title" style={{ display: 'grid', gap: 8 }}>
        {LEVELS.map((l) => {
          const on = level === l.value;
          return (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving}
              onClick={() => changeLevel(l.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: tokens.radius.md,
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-card)',
                color: 'var(--text-primary)',
                textAlign: 'left',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'transparent',
                  boxShadow: on ? 'inset 0 0 0 3px var(--bg-card)' : 'none',
                }}
              />
              <span style={{ display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{l.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            marginTop: 16,
            width: '100%',
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: tokens.radius.md,
            border: '1px solid var(--danger, #e05252)',
            background: 'transparent',
            color: 'var(--danger, #e05252)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Remove {first}
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-labelledby="remove-friend-title"
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: tokens.radius.md,
            border: '1px solid var(--danger, #e05252)',
            background: 'var(--danger-bg, rgba(224,82,82,0.08))',
          }}
        >
          <div id="remove-friend-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Remove {first}?
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            You'll both stop seeing each other's training. To reconnect, one of you would need to send a new invite code.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={removing}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: tokens.radius.md,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: tokens.radius.md,
                border: '1px solid var(--danger, #e05252)',
                background: 'var(--danger, #e05252)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: removing ? 'wait' : 'pointer',
              }}
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
