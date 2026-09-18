import { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { emit, on } from '../../utils/events';
import { archiveCurrentMeso, resetMesoAfterCompletion } from '../../utils/archive';
import { loadNextMesoDraft } from '../../utils/nextMeso';
import { formatSplitName } from '../../utils/splitLabel';
import type { Profile } from '../../types';

interface MesoCompleteSheetProps {
  profile: Profile | null;
}

interface CardDef {
  key: 'repeat' | 'new' | 'sample';
  title: string;
  body: string;
}

const CARDS: CardDef[] = [
  {
    key: 'repeat',
    title: 'Repeat this meso',
    body: 'Run it back with progressive overload. Anchor lifts start heavier because you did the work.',
  },
  {
    key: 'new',
    title: 'Build a new meso',
    body: 'Fresh split, fresh plan. The Foundry tunes it to where you are now.',
  },
  {
    key: 'sample',
    title: 'Try a Foundry program',
    body: 'Browse curated mesos built by experienced coaches. One-tap start.',
  },
];

/**
 * MesoCompleteSheet — full-screen takeover shown on HomeView when the
 * user has completed the final week of their current meso and no new
 * meso is queued. NOT dismissable — the whole point is "what's next".
 *
 * Repeat and Build new are NON-DESTRUCTIVE: they open setup on top of the
 * finished meso (`foundry:build-next-meso`), which is only archived and
 * retired when the new one starts — same path as a meso planned during the
 * deload. Backing out, or closing the app mid-setup, lands back here with
 * the meso and its summary intact. Archiving on tap used to wipe the
 * session keys up front while the profile survived, so any exit restarted
 * the SAME program at week 1 and the summary was gone.
 *
 *   foundry:build-next-meso   → SetupPage (after-meso) → startPlannedMeso
 *   foundry:view-meso-summary → reopen the end-of-meso recap
 *   foundry:browse-samples    → archive + clear + navigate to Explore Samples
 */
export default function MesoCompleteSheet({ profile }: MesoCompleteSheetProps) {
  // A meso planned during the deload goes first and starts in one tap. App
  // owns starting it (archive, retire, install) — see startPlannedMeso.
  const [draft] = useState(loadNextMesoDraft);
  const [starting, setStarting] = useState(false);
  useEffect(() => on('foundry:start-planned-meso-failed', () => setStarting(false)), []);

  useEffect(() => {
    // Gate so the event doesn't re-emit on rerender.
    if (store.get('foundry:meso_complete_shown') !== '1') {
      store.set('foundry:meso_complete_shown', '1');
    }
  }, []);

  const handleChoice = (key: CardDef['key']) => {
    if (key === 'repeat' || key === 'new') {
      emit('foundry:build-next-meso', { fresh: key === 'new' });
      return;
    }
    try {
      archiveCurrentMeso(profile);
    } catch (e) {
      console.warn('[Foundry]', 'archiveCurrentMeso failed', e);
    }
    // The finished meso's session keys (done flags, day blobs, stored week)
    // must not carry into the next program — the archive snapshot above is
    // now the only copy. Remote row keeps status='completed'; only the
    // active-meso pointer is detached.
    resetMesoAfterCompletion();
    store.remove('foundry:meso_transition');
    store.remove('foundry:meso_complete_shown');
    emit('foundry:browse-samples');
  };

  return (
    <main
      role="dialog"
      aria-modal="true"
      aria-labelledby="meso-complete-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 480,
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
          Mesocycle complete
        </div>
        <h1
          id="meso-complete-title"
          style={{
            margin: 0,
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 'clamp(34px, 9vw, 44px)',
            letterSpacing: '0.14em',
            lineHeight: 1.05,
            color: '#FBF7E4',
            marginBottom: 14,
          }}
        >
          WHAT'S NEXT?
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: tokens.colors.textSecondary,
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          {profile?.name ? `Good work, ${profile.name.split(/\s+/)[0]}. ` : 'Good work. '}
          Pick the next block. The Foundry keeps every rep on record either way.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {draft && (
            <button
              type="button"
              disabled={starting}
              onClick={() => {
                setStarting(true);
                emit('foundry:start-planned-meso');
              }}
              style={{
                textAlign: 'left',
                padding: '18px 18px 20px',
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.colors.accent}`,
                background: 'rgba(232,101,26,0.10)',
                color: tokens.colors.textPrimary,
                cursor: starting ? 'default' : 'pointer',
                opacity: starting ? 0.7 : 1,
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: tokens.colors.accent, marginBottom: 6 }}>
                YOUR PLAN
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.01em' }}>
                  {starting ? 'Starting…' : 'Start your planned meso'}
                </div>
                <span aria-hidden="true" style={{ color: tokens.colors.accent, fontSize: 16, fontWeight: 700 }}>
                  →
                </span>
              </div>
              <div style={{ fontSize: 13, color: tokens.colors.textMuted, lineHeight: 1.5 }}>
                {[
                  formatSplitName(draft.profile.splitType),
                  `${draft.profile.workoutDays?.length || draft.profile.daysPerWeek || draft.program.length} days/wk`,
                  draft.profile.mesoLength ? `${draft.profile.mesoLength} weeks + deload` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                . Built during your deload — week 1 is ready.
              </div>
            </button>
          )}
          {CARDS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => handleChoice(c.key)}
              style={{
                textAlign: 'left',
                padding: '18px 18px 20px',
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.colors.accentBorder}`,
                background: tokens.colors.bgCard,
                color: tokens.colors.textPrimary,
                cursor: 'pointer',
                transition: 'all 180ms ease',
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.01em',
                  }}
                >
                  {c.title}
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    color: tokens.colors.accent,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  →
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tokens.colors.textMuted,
                  lineHeight: 1.5,
                }}
              >
                {c.body}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => emit('foundry:view-meso-summary')}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 20,
            minHeight: 44,
            padding: '12px 16px',
            borderRadius: tokens.radius.lg,
            border: `1px solid ${tokens.colors.accentBorder}`,
            background: 'transparent',
            color: tokens.colors.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          VIEW MESO SUMMARY
        </button>
      </div>
    </main>
  );
}
