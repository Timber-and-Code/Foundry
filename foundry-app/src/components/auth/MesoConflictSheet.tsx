/**
 * MesoConflictSheet — full-screen takeover shown after sign-in when the
 * user built a meso while signed out AND their account already has an
 * active meso. The sync pull is deferred until they choose which one
 * survives (see AuthContext's SIGNED_IN handler + detectSignInMesoConflict).
 *
 * Not dismissable — sync stays deferred until a choice is made, and
 * whichever meso loses is archived/abandoned, never silently deleted.
 * Modeled on MesoCompleteSheet/ResumptionSheet.
 */
import { useState } from 'react';
import { tokens } from '../../styles/tokens';

interface MesoConflictSheetProps {
  onKeepLocal: () => Promise<void>;
  onRestoreAccount: () => Promise<void>;
}

interface CardDef {
  key: 'keep_local' | 'restore_account';
  title: string;
  body: string;
}

const CARDS: CardDef[] = [
  {
    key: 'keep_local',
    title: 'Keep the meso I just built',
    body: "This becomes your active meso and syncs to your account. Your account's previous meso is archived.",
  },
  {
    key: 'restore_account',
    title: "Restore my account's meso",
    body: 'Pick up your saved meso where you left off. The one you built while signed out is discarded.',
  },
];

export default function MesoConflictSheet({
  onKeepLocal,
  onRestoreAccount,
}: MesoConflictSheetProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handlePick = (key: CardDef['key']) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const fn = key === 'keep_local' ? onKeepLocal : onRestoreAccount;
    // The parent unmounts the sheet when the chain settles; clearing busy
    // here only matters on failure, so the user can retry. A rejection means
    // the choice did NOT take — surface it rather than leaving the sheet
    // sitting there looking idle, because the alternative (falling through
    // to the pull) is the silent clobber this sheet exists to prevent.
    fn()
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };

  return (
    <main
      role="dialog"
      aria-modal="true"
      aria-labelledby="meso-conflict-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: tokens.fontFamily.body,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '56px 24px 40px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tokens.colors.accent,
            marginBottom: 10,
          }}
        >
          Signed in
        </div>
        <h1
          id="meso-conflict-title"
          style={{
            margin: 0,
            fontFamily: tokens.fontFamily.display,
            fontSize: 28,
            letterSpacing: '0.14em',
            lineHeight: 1.05,
            color: tokens.colors.accent,
            marginBottom: 14,
          }}
        >
          TWO MESOS FOUND
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: tokens.colors.textSecondary,
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          You built a meso while signed out, and your account already has one
          in progress. Which one do you want to train on?
        </p>

        <div
          role="group"
          aria-labelledby="meso-conflict-title"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              disabled={busy}
              onClick={() => handlePick(card.key)}
              style={{
                textAlign: 'left',
                padding: '16px 16px 18px',
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.colors.accentBorder}`,
                background: tokens.colors.bgCard,
                color: tokens.colors.textPrimary,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.6 : 1,
                transition: 'all 180ms ease',
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontFamily: tokens.fontFamily.display,
                  fontSize: 18,
                  letterSpacing: '0.06em',
                  color: '#FBF7E4',
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: tokens.colors.textMuted,
                  lineHeight: 1.45,
                }}
              >
                {card.body}
              </div>
            </button>
          ))}
        </div>

        {busy && (
          <p
            aria-live="polite"
            style={{
              margin: 0,
              marginTop: 18,
              fontSize: 12,
              color: tokens.colors.textSecondary,
            }}
          >
            Syncing your choice…
          </p>
        )}

        {failed && !busy && (
          <p
            role="alert"
            style={{
              margin: 0,
              marginTop: 18,
              fontSize: 13,
              color: tokens.colors.danger,
              lineHeight: 1.45,
            }}
          >
            Couldn&apos;t save that choice — you may be offline. Nothing was
            changed. Check your connection and pick again.
          </p>
        )}
      </div>
    </main>
  );
}
