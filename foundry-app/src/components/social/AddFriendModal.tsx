import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { tokens } from '../../styles/tokens';
import {
  createFriendInvite,
  previewFriendInvite,
  acceptFriendInvite,
} from '../../utils/sync';
import type { FriendInvitePreview, MesoShareLevel } from '../../types';

/**
 * AddFriendModal — dual-purpose entry point for the follow-a-friend
 * feature. Two tabs:
 *
 *  - "Invite"    → shows the caller's friend invite code alongside a big
 *                  native Share button (iOS/Android share sheet with
 *                  pre-filled message + /friend/CODE deep link). Desktop
 *                  fallback copies the same message to the clipboard.
 *  - "Enter code" → paste or type the 8-char code, preview the inviter's
 *                  name, pick a share_level, confirm. Also what the
 *                  /friend/:code deep-link route pre-fills.
 *
 * The modal emits `foundry:friends-changed` on successful acceptance so
 * any FriendsSection in view can re-fetch the list without a full reload.
 */

export const FRIENDS_CHANGED_EVENT = 'foundry:friends-changed';

interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional initial code (supplied by the /friend/:code deep link
   *  route). When set, the modal opens on the "Enter code" tab and
   *  auto-previews so the user just has to hit Accept. */
  initialCode?: string;
}

type Tab = 'invite' | 'enter';

export default function AddFriendModal({
  open,
  onClose,
  initialCode,
}: AddFriendModalProps) {
  const [tab, setTab] = useState<Tab>(initialCode ? 'enter' : 'invite');

  // Reset on each open so state from a prior session doesn't leak through.
  useEffect(() => {
    if (!open) return;
    setTab(initialCode ? 'enter' : 'invite');
  }, [open, initialCode]);

  return (
    <Modal open={open} onClose={onClose} maxWidth={400}>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          Add a Friend
        </div>

        {/* Tabs — hidden when a deep-link code is supplied to keep the flow
            single-purpose (accept this specific invite). */}
        {!initialCode && (
          <div
            role="tablist"
            style={{
              display: 'flex',
              gap: 6,
              padding: 4,
              background: 'var(--bg-inset)',
              borderRadius: tokens.radius.lg,
              marginBottom: 18,
            }}
          >
            <TabButton
              label="Invite"
              active={tab === 'invite'}
              onClick={() => setTab('invite')}
            />
            <TabButton
              label="Enter code"
              active={tab === 'enter'}
              onClick={() => setTab('enter')}
            />
          </div>
        )}

        {tab === 'invite' && <InvitePanel onClose={onClose} />}
        {tab === 'enter' && (
          <EnterCodePanel initialCode={initialCode} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}

// ─── Tab button ─────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const AMBER = '#D4983C';
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 12px',
        borderRadius: tokens.radius.md,
        background: active ? 'rgba(212,152,60,0.15)' : 'transparent',
        border: `1px solid ${active ? AMBER : 'transparent'}`,
        color: active ? AMBER : 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── "Invite" panel ─────────────────────────────────────────────────────

function InvitePanel({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    createFriendInvite().then((c) => {
      setCode(c);
      setLoading(false);
    });
  }, []);

  const shareUrl = code ? `https://thefoundry.coach/friend/${code}` : '';
  const shareText = code
    ? `Let's train together on The Foundry. Use code ${code} to add me as a friend: ${shareUrl}`
    : '';

  const handleShare = async () => {
    if (!code) return;

    // 1. Web Share API — preferred path. Works on iOS/Android WKWebView
    //    and mobile Safari. Hands the OS share sheet with pre-filled text.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Join me on The Foundry',
          text: shareText,
          url: shareUrl,
        });
        onClose();
        return;
      }
    } catch (err) {
      // AbortError = user cancelled; anything else → fall through.
      if (err instanceof Error && err.name === 'AbortError') return;
    }

    // 2. Capacitor native plugin fallback for older WKWebView builds.
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'Join me on The Foundry',
          text: shareText,
          url: shareUrl,
          dialogTitle: 'Share invite',
        });
        onClose();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // 3. Desktop — copy to clipboard.
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — leave the code visible for manual copy.
    }
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent.
    }
  };

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        Share this code with a friend — when they enter it, you'll both see
        each other's progress.
      </div>

      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '28px 0',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          Generating code…
        </div>
      )}

      {!loading && code && (
        <>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy invite code"
            title="Tap to copy"
            style={{
              width: '100%',
              padding: '18px 0',
              marginBottom: 14,
              borderRadius: tokens.radius.lg,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: '#D4983C',
              fontSize: 28,
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.25em',
              cursor: 'pointer',
            }}
          >
            {code}
          </button>

          <Button onClick={handleShare} variant="primary" fullWidth>
            Share invite
          </Button>

          <div
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontSize: 11,
              color: copied ? '#6ABE63' : 'var(--text-muted)',
              minHeight: 16,
              letterSpacing: '0.04em',
            }}
          >
            {copied ? 'Copied to clipboard' : 'Valid for 30 days · tap code to copy'}
          </div>
        </>
      )}

      {!loading && !code && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '24px 0',
          }}
        >
          Could not generate an invite code. Try again later.
        </div>
      )}
    </div>
  );
}

// ─── "Enter code" panel ─────────────────────────────────────────────────

function EnterCodePanel({
  initialCode,
  onClose,
}: {
  initialCode?: string;
  onClose: () => void;
}) {
  const ALLOWED = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const [code, setCode] = useState(initialCode ? initialCode.toUpperCase() : '');
  const [preview, setPreview] = useState<FriendInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shareLevel, setShareLevel] = useState<MesoShareLevel>('full');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const handleCodeChange = (val: string) => {
    const filtered = val
      .toUpperCase()
      .split('')
      .filter((c) => ALLOWED.includes(c))
      .join('')
      .slice(0, 8);
    setCode(filtered);
    setError('');
  };

  const handleLookup = async () => {
    if (code.length < 8) return;
    setPreviewLoading(true);
    setError('');
    const p = await previewFriendInvite(code);
    setPreviewLoading(false);
    if (!p) {
      setError('Invalid or expired code.');
      return;
    }
    setPreview(p);
  };

  // Auto-preview if the deep link handed us a full code.
  useEffect(() => {
    if (initialCode && initialCode.length >= 8 && !preview) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const handleAccept = async () => {
    if (!preview) return;
    setAccepting(true);
    setError('');
    const result = await acceptFriendInvite(preview.code, shareLevel);
    setAccepting(false);
    if (!result.success) {
      setError(result.error || 'Could not accept the invite.');
      return;
    }
    window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
    onClose();
  };

  return (
    <div>
      {!preview && (
        <>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 16,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            Enter the 8-character code your friend shared with you.
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABCD1234"
            autoFocus
            aria-label="Friend invite code"
            style={{
              width: '100%',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.2em',
              padding: '12px 16px',
              borderRadius: tokens.radius.lg,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--danger)',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}
          <Button
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={code.length < 8 || previewLoading}
            style={{ marginTop: 16 }}
          >
            {previewLoading ? 'Looking up…' : 'Look up'}
          </Button>
        </>
      )}

      {preview && (
        <>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            Add {preview.inviterName} as a friend?
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 18,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            Pick how much {preview.inviterName} and future mutual-friend
            surfaces can see from you. You can change this later.
          </div>

          <ShareLevelOption
            title="Full"
            subtitle="Completion + weights, reps, volume, PRs, bodyweight"
            selected={shareLevel === 'full'}
            onSelect={() => setShareLevel('full')}
          />
          <ShareLevelOption
            title="Basic"
            subtitle="Completion only — friends see which days you trained, nothing else"
            selected={shareLevel === 'basic'}
            onSelect={() => setShareLevel('basic')}
          />

          {error && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--danger)',
                marginTop: 10,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button
              onClick={() => {
                setPreview(null);
                setError('');
              }}
              variant="secondary"
              style={{ flex: 1 }}
              disabled={accepting}
            >
              Back
            </Button>
            <Button
              onClick={handleAccept}
              variant="primary"
              style={{ flex: 1 }}
              disabled={accepting}
            >
              {accepting ? 'Accepting…' : 'Add friend'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ShareLevelOption({
  title,
  subtitle,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
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
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: AMBER }} />
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
