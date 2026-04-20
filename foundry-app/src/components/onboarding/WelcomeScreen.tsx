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

  const handleSignIn = () => {
    // Route straight to AuthPage without first going through onboarding.
    store.set('foundry:welcomed', '1');
    store.set('foundry:wants_auth', '1');
    emit('foundry:welcomed');
    emit('foundry:wants_auth');
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
      {/* Top: logo + title, anchored near the top. Tagline is a separate
          flex child below so it centers in the remaining space between
          this group and the CTA. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          width: '100%',
        }}
      >
        <img
          src="/foundry-f.png"
          alt="The Foundry"
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

        <h1
          style={{
            margin: 0,
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 'clamp(40px, 11vw, 56px)',
            letterSpacing: '0.18em',
            fontWeight: 400,
            color: '#FBF7E4',
            textShadow: '0 2px 24px rgba(232,101,26,0.2)',
            textAlign: 'center',
          }}
        >
          THE FOUNDRY
        </h1>
      </div>

      {/* Middle: tagline centered in remaining space. flex:1 here
          (not space-between gaps) because the top group is visually
          much taller than the CTA — equal gaps would still read as
          "tagline hugs the CTA". flex:1 gives true visual center. */}
      <div
        style={{
          flex: '1 1 auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: 'center',
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

      {/* Bottom: CTA */}
      <div
        style={{
          flex: '0 0 auto',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleGetStarted}
            className="btn-primary"
            style={{
              width: '100%',
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
          <button
            onClick={handleSignIn}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              fontSize: 13,
              color: tokens.colors.textSecondary,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Already have an account? <span style={{ color: tokens.colors.accent, textDecoration: 'underline' }}>Sign in</span>
          </button>
        </div>
      </div>
    </main>
  );
}
