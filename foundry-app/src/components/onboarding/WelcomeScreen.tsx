import { store } from '../../utils/store';
import { emit } from '../../utils/events';
import { tokens } from '../../styles/tokens';

/**
 * WelcomeScreen — first-visit brand moment.
 *
 * Rendered by AuthGate when there is no Supabase session and the user
 * has not yet dismissed the welcome (foundry:welcomed !== '1'). Pure
 * brand: F logo, headline, tagline, single CTA. No auth, no decisions.
 *
 * Tapping "Get Started" sets foundry:welcomed='1' and fires the
 * 'foundry:welcomed' event so AuthGate re-renders into anonymous mode
 * without a page reload.
 */
export default function WelcomeScreen() {
  const handleGetStarted = () => {
    store.set('foundry:welcomed', '1');
    emit('foundry:welcomed');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '64px 24px 48px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Top spacer for vertical rhythm */}
      <div style={{ flex: '0 0 auto', height: 24 }} />

      {/* Center: logo + text */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          width: '100%',
        }}
      >
        <img
          src="/foundry-f.png"
          alt="Foundry"
          style={{
            width: 'clamp(220px, 64vw, 320px)',
            height: 'auto',
            // Feather the image's dark background into the page so the
            // rectangular edge disappears and the F floats freely.
            // NOTE: do NOT add a CSS drop-shadow filter here — it traces
            // the original rectangular alpha and leaks a halo through the
            // mask's faded edges. The image has its own baked ember glow.
            maskImage:
              'radial-gradient(ellipse at center, black 42%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 42%, transparent 78%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "'Bebas Neue', 'Inter', sans-serif",
              fontSize: 'clamp(40px, 11vw, 56px)',
              letterSpacing: '0.18em',
              fontWeight: 400,
              color: '#FBF7E4',
              textShadow: '0 2px 24px rgba(232,101,26,0.2)',
            }}
          >
            THE FOUNDRY
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 'clamp(14px, 3.6vw, 16px)',
              lineHeight: 1.55,
              color: tokens.colors.textSecondary,
              maxWidth: 320,
              fontWeight: 400,
            }}
          >
            Progress you can feel.
            <br />
            Programming you can trust.
          </p>
        </div>
      </div>

      {/* Bottom: CTA */}
      <div
        style={{
          flex: '0 0 auto',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={handleGetStarted}
          className="btn-primary"
          style={{
            width: '100%',
            maxWidth: 360,
            padding: '18px',
            fontSize: 'clamp(15px, 4vw, 17px)',
            fontWeight: 600,
            borderRadius: tokens.radius.xl,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: '1px solid var(--btn-primary-border)',
            boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
            cursor: 'pointer',
          }}
        >
          Get Started
        </button>
      </div>
    </main>
  );
}
