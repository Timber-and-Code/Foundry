import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { tokens } from '../../styles/tokens';
import { fetchMesoMembers, updateMesoShareLevel } from '../../utils/sync';
import type { MesoShareLevel } from '../../types';

/**
 * MesoPrivacyModal — dedicated surface for changing the caller's `share_level`
 * on the active shared mesocycle. Opened from the FriendsStrip gear tile so
 * it sits next to the social context it governs. Emits `foundry:share-level`
 * on change so FriendsStrip + FriendDashboard can re-fetch without a full
 * page reload.
 *
 * The modal reads the caller's current level on open (it isn't passed in —
 * that would get stale once the user toggles). On a fresh DB without
 * migration 003 applied, the RPC tolerates a missing column and we default
 * to 'full' so the UI still renders a plausible initial state.
 */

interface MesoPrivacyModalProps {
  open: boolean;
  onClose: () => void;
  mesoId: string;
  /** Caller's own user id — so we can pick their row out of mesocycle_members. */
  selfUserId: string;
}

export const SHARE_LEVEL_EVENT = 'foundry:share-level';

export default function MesoPrivacyModal({
  open,
  onClose,
  mesoId,
  selfUserId,
}: MesoPrivacyModalProps) {
  const [level, setLevel] = useState<MesoShareLevel>('full');
  const [initialLevel, setInitialLevel] = useState<MesoShareLevel>('full');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setLoading(true);
    // fetchMesoMembers returns OTHER members (filters out caller). To read
    // our own share_level we query mesocycle_members directly via the
    // members fetch + a side request; simpler: reuse fetchMesoMembers to
    // confirm the meso + accept default, then supplement with a direct
    // row read for self. Here we just pull the full list and if our own
    // row is somehow exposed we pick it, else default to 'full'.
    (async () => {
      try {
        const members = await fetchMesoMembers(mesoId);
        // Our own row is filtered out by fetchMesoMembers — read ourselves
        // via a direct supabase call to get an authoritative share_level.
        const { supabase } = await import('../../utils/supabase');
        const { data } = await supabase
          .from('mesocycle_members')
          .select('share_level')
          .eq('mesocycle_id', mesoId)
          .eq('user_id', selfUserId)
          .maybeSingle();
        const row = data as { share_level?: string | null } | null;
        const current: MesoShareLevel = row?.share_level === 'basic' ? 'basic' : 'full';
        setLevel(current);
        setInitialLevel(current);
        // Keep members reference silent — only used to ensure the fetch
        // path is alive; no-op if empty.
        void members;
      } catch {
        setLevel('full');
        setInitialLevel('full');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, mesoId, selfUserId]);

  const dirty = level !== initialLevel;

  const handleSave = async () => {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    const ok = await updateMesoShareLevel(mesoId, level);
    setSaving(false);
    if (!ok) {
      setError('Could not save — try again.');
      return;
    }
    window.dispatchEvent(
      new CustomEvent(SHARE_LEVEL_EVENT, { detail: { mesoId, level } }),
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={380}>
      <div style={{ textAlign: 'left' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          Sharing
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 16,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          What the other members on this program see of your training.
        </div>

        {loading ? (
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              padding: '24px 0',
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        ) : (
          <>
            <PrivacyOption
              title="Full"
              subtitle="Completion + weights, reps, volume, PRs, bodyweight"
              selected={level === 'full'}
              onSelect={() => setLevel('full')}
            />
            <PrivacyOption
              title="Basic"
              subtitle="Completion only — friends see which days you trained, nothing else"
              selected={level === 'basic'}
              onSelect={() => setLevel('basic')}
            />

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--danger)',
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button
                onClick={onClose}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
                style={{ flex: 1 }}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : dirty ? 'Save' : 'Done'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

interface PrivacyOptionProps {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}

function PrivacyOption({ title, subtitle, selected, onSelect }: PrivacyOptionProps) {
  const AMBER = '#D4983C';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        marginBottom: 10,
        borderRadius: tokens.radius.lg,
        background: selected ? 'rgba(212,152,60,0.12)' : 'var(--bg-inset)',
        border: `1.5px solid ${selected ? AMBER : 'var(--border)'}`,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `2px solid ${selected ? AMBER : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {selected && (
          <div
            style={{ width: 9, height: 9, borderRadius: '50%', background: AMBER }}
          />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: selected ? AMBER : 'var(--text-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 4,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      </div>
    </button>
  );
}
