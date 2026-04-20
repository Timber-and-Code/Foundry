import { useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { emit } from '../../utils/events';
import { archiveCurrentMeso } from '../../utils/archive';
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
 * Each card fires one of three window events that App.tsx listens for:
 *   foundry:repeat-meso    → archive + retain meso_transition → SetupPage
 *   foundry:new-meso       → archive + clear meso_transition → SetupPage
 *   foundry:browse-samples → archive + clear + navigate to Explore Samples
 *
 * Archiving happens inline so the transition context is always fresh at
 * the moment of choice.
 */
export default function MesoCompleteSheet({ profile }: MesoCompleteSheetProps) {
  useEffect(() => {
    // Gate so the event doesn't re-emit on rerender.
    if (store.get('foundry:meso_complete_shown') !== '1') {
      store.set('foundry:meso_complete_shown', '1');
    }
  }, []);

  const handleChoice = (key: CardDef['key']) => {
    try {
      archiveCurrentMeso(profile);
    } catch (e) {
      console.warn('[Foundry]', 'archiveCurrentMeso failed', e);
    }
    if (key === 'new' || key === 'sample') {
      store.remove('foundry:meso_transition');
    }
    store.remove('foundry:meso_complete_shown');
    if (key === 'repeat') emit('foundry:repeat-meso');
    else if (key === 'new') emit('foundry:new-meso');
    else emit('foundry:browse-samples');
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
      </div>
    </main>
  );
}
