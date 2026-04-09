import React from 'react';
import { tokens } from '../../styles/tokens';
import { GOAL_OPTIONS } from '../../data/constants';
import { store, importData } from '../../utils/store';
import { emit } from '../../utils/events';
import {
  FOUNDRY_IRON_IMG,
  FOUNDRY_STEEL_IMG,
  FOUNDRY_GOAL_IMG,
  FOUNDRY_READY_IMG,
} from '../../data/images-onboarding';

/**
 * OnboardingFlow - Multi-screen onboarding experience
 *
 * Screens:
 *  0: Path choice (Full Tour / Jump Right In / existing account sign-in)
 *  1: Name input + restore data option
 *  2: Experience selection
 *  3: Goal selection
 *  4: Ready confirmation
 *
 * Features:
 *  - Slide animations with swipe support
 *  - Progress dots
 *  - Touch swipe navigation
 *  - localStorage persistence via store utility
 */
interface OnboardingFlowProps {
  onDone: () => void;
}

export default function OnboardingFlow({ onDone }: OnboardingFlowProps) {
  const TOTAL = 5;
  const [screen, setScreen] = React.useState(0);
  const [animDir, setAnimDir] = React.useState(1);
  const [animating, setAnimating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [name, setName] = React.useState('');
  const [experience, setExperience] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [nameFocused, setNameFocused] = React.useState(false);

  const goTo = (idx: number, dir = 1) => {
    if (animating) return;
    setError('');
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setScreen(idx);
      setAnimating(false);
    }, 220);
  };

  const advance = () => {
    setError('');
    if (screen === 0) {
      goTo(1, 1);
      return;
    }
    if (screen === 1 && !name.trim()) {
      setError('Please enter your name to continue.');
      return;
    }
    if (screen === 2 && !experience) {
      setError('Please select your experience level.');
      return;
    }
    if (screen === 3 && !goal) {
      setError('Please select a goal.');
      return;
    }
    if (screen < TOTAL - 1) {
      goTo(screen + 1, 1);
    } else {
      store.set('foundry:onboarding_data', JSON.stringify({ name: name.trim(), experience }));
      store.set('foundry:onboarding_goal', goal);
      store.set('foundry:onboarded', '1');
      onDone();
    }
  };

  const goBack = () => {
    if (screen > 0) goTo(screen - 1, -1);
  };

  const touchStart = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && screen < TOTAL - 1) advance();
    if (dx > 0 && screen > 0) goBack();
  };

  const slideStyle = {
    transition: animating ? 'none' : 'opacity 0.22s ease, transform 0.22s ease',
    opacity: animating ? 0 : 1,
    transform: animating ? `translateX(${animDir * 24}px)` : 'translateX(0)',
  };

  /* Shared CTA button style */
  const ctaBtnStyle = {
    width: '85%',
    padding: '16px',
    fontSize: 'clamp(15px, 4vw, 18px)',
    fontWeight: 600,
    borderRadius: tokens.radius.xl,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: '1px solid var(--btn-primary-border)',
    boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
  };

  /* Progress dots — tappable for navigating back to visited screens */
  const ProgressDots = () => (
    <div
      style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        paddingTop: 16,
        paddingBottom: 8,
      }}
    >
      {Array.from({ length: TOTAL }, (_, i) => {
        const canTap = i < screen;
        return (
          <button
            key={i}
            onClick={() => canTap && goTo(i, -1)}
            style={{
              width: i === screen ? 28 : 12,
              height: 12,
              borderRadius: tokens.radius.md,
              background:
                i === screen
                  ? '#E8651A'
                  : i < screen
                    ? 'rgba(232,101,26,0.5)'
                    : 'rgba(138,122,104,0.4)',
              transition: 'all 0.25s ease',
              border: 'none',
              padding: 0,
              cursor: canTap ? 'pointer' : 'default',
              /* generous touch target without visual bloat */
              position: 'relative',
            }}
            aria-label={canTap ? `Go back to step ${i + 1}` : `Step ${i + 1}`}
          />
        );
      })}
    </div>
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter',system-ui,sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* SCREEN 0: PATH CHOICE — Full Tour / Jump Right In / Sign in */}
      {screen === 0 && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            background: tokens.colors.bgRoot,
            padding: '48px 24px 32px',
            overflow: 'hidden',
          }}
        >
          {/* Background: molten stone blocks. Heavy gradient overlay keeps
              headline + cards readable while letting the glow show through
              in the middle third of the screen. */}
          <img
            src="/pick-your-path.png"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(to bottom, rgba(10,10,12,0.92) 0%, rgba(10,10,12,0.65) 18%, rgba(10,10,12,0.3) 38%, rgba(10,10,12,0.3) 55%, rgba(10,10,12,0.75) 78%, rgba(10,10,12,0.95) 100%)',
            }}
          />
          {/* Inner wrapper so all content sits above the backdrop layers */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
          {/* Heading */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
              paddingTop: 24,
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue','Inter',sans-serif",
                fontSize: 'clamp(32px, 8.5vw, 44px)',
                letterSpacing: '0.16em',
                color: '#FBF7E4',
                lineHeight: 1.1,
              }}
            >
              PICK YOUR PATH
            </div>
          </div>

          {/* Path choice cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              width: '100%',
              maxWidth: 420,
              alignSelf: 'center',
            }}
          >
            <button
              onClick={() => goTo(1, 1)}
              style={{
                textAlign: 'left',
                padding: '20px 22px',
                borderRadius: tokens.radius.xl,
                // Frosted glass: dark base with subtle amber warmth, backdrop
                // blur so the lava image behind the card is quieted enough for
                // the description text to read cleanly.
                background:
                  'linear-gradient(135deg, rgba(26,22,18,0.62), rgba(14,12,10,0.55))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${tokens.colors.accentBorder}`,
                color: tokens.colors.textPrimary,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 4px 24px rgba(232,101,26,0.18)',
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: '#FBF7E4',
                }}
              >
                Full Tour
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                Learn how Foundry adapts to your training and drives real
                progress.
              </div>
            </button>

            <button
              onClick={() => goTo(1, 1)}
              style={{
                textAlign: 'left',
                padding: '20px 22px',
                borderRadius: tokens.radius.xl,
                // Identical frosted glass + amber halo to Full Tour. The
                // two cards must match exactly so they read as the same
                // family; only the border color is slightly different.
                background:
                  'linear-gradient(135deg, rgba(26,22,18,0.62), rgba(14,12,10,0.55))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid rgba(255,255,255,0.1)`,
                color: tokens.colors.textPrimary,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 4px 24px rgba(232,101,26,0.18)',
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: '#FBF7E4',
                }}
              >
                Jump Right In
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                Skip the intro and go straight to building your first meso.
              </div>
            </button>
          </div>

          {/* Sign-in escape hatch for returning users */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: tokens.colors.textMuted,
              }}
            >
              Already have an account?
            </div>
            <button
              onClick={() => {
                store.set('foundry:wants_auth', '1');
                emit('foundry:wants_auth');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: tokens.colors.accent,
                fontSize: 14,
                fontWeight: 600,
                padding: '6px 12px',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Sign in
            </button>
          </div>
          </div>
        </div>
      )}

      {/* SCREEN 1: NAME + RESTORE */}
      {screen === 1 && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          <img
            src={FOUNDRY_IRON_IMG}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 45%',
              opacity: 0.9,
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '60px 24px 40px',
              ...slideStyle,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue','Inter',sans-serif",
                    fontSize: 'clamp(32px, 8vw, 42px)',
                    letterSpacing: '0.1em',
                    color: '#FBF7E4',
                    lineHeight: 1.1,
                    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  }}
                >
                  What should
                  <br />
                  we call you?
                </div>
              </div>
              <input
                type="text"
                placeholder="Your name"
                aria-label="Your name"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') advance();
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: tokens.radius.xl,
                  fontSize: 'clamp(16px, 4.2vw, 20px)',
                  background: 'rgba(26,24,20,0.08)',
                  border: nameFocused ? '1px solid #E8651A' : '1px solid rgba(232,101,26,0.15)',
                  color: '#FBF7E4',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  WebkitBackdropFilter: 'blur(12px)',
                  backdropFilter: 'blur(12px)',
                  transition: 'border-color 0.2s ease',
                  boxShadow: nameFocused ? '0 0 12px rgba(232,101,26,0.15)' : 'none',
                }}
              />
              {error && (
                <div
                  style={{
                    fontSize: 'clamp(13px, 3.5vw, 16px)',
                    color: 'var(--danger)',
                    fontWeight: 600,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>
                Continue
              </button>
              <label
                style={{
                  fontSize: 'clamp(13px, 3.5vw, 16px)',
                  color: '#E8651A',
                  cursor: 'pointer',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Restore existing data
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    importData(file, (ok: boolean) => {
                      if (ok) {
                        store.set('foundry:onboarded', '1');
                        window.location.reload();
                      } else
                        alert("Couldn't read that file. Make sure it's a Foundry backup (.json).");
                    });
                  }}
                />
              </label>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: EXPERIENCE */}
      {screen === 2 && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          <img
            src={FOUNDRY_STEEL_IMG}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              opacity: 0.9,
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '52px 20px 40px',
              ...slideStyle,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue','Inter',sans-serif",
                    fontSize: 'clamp(32px, 8vw, 42px)',
                    letterSpacing: '0.1em',
                    color: '#FBF7E4',
                    lineHeight: 1.1,
                    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  }}
                >
                  How long have you
                  <br />
                  been training?
                </div>
                <div
                  style={{
                    fontSize: 'clamp(15px, 4vw, 19px)',
                    color: '#C0B8AC',
                    marginTop: 6,
                    fontWeight: 400,
                    textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)',
                  }}
                >
                  This shapes your starting volume and intensity
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label="Training experience level"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {[
                  {
                    id: 'new',
                    label: 'Beginner',
                    desc: 'Less than 1 year of consistent lifting',
                  },
                  {
                    id: 'intermediate',
                    label: 'Intermediate',
                    desc: '1–3 years with structured programming',
                  },
                  {
                    id: 'advanced',
                    label: 'Advanced',
                    desc: '3+ years of serious training',
                  },
                ].map((opt) => {
                  const sel = experience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setExperience(opt.id)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: tokens.radius.xl,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: sel ? 'rgba(232,101,26,0.15)' : 'transparent',
                        border: `1px solid ${sel ? 'rgba(232,101,26,0.6)' : 'transparent'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        WebkitBackdropFilter: sel ? 'blur(20px)' : 'none',
                        backdropFilter: sel ? 'blur(20px)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: tokens.radius.full,
                          flexShrink: 0,
                          border: `2px solid ${sel ? '#E8651A' : 'rgba(232,101,26,0.35)'}`,
                          background: sel ? '#E8651A' : 'transparent',
                          boxShadow: sel ? 'inset 0 0 0 3px rgba(26,24,20,0.8)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      />
                      <div>
                        <span
                          style={{
                            fontSize: 'clamp(16px, 4.2vw, 20px)',
                            color: sel ? '#FBF7E4' : '#E8E4DC',
                            fontWeight: sel ? 600 : 500,
                            display: 'block',
                            textShadow:
                              '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            fontSize: 'clamp(13px, 3.5vw, 16px)',
                            color: '#C0B8AC',
                            marginTop: 2,
                            display: 'block',
                            textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)',
                          }}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && (
                <div
                  style={{
                    fontSize: 'clamp(13px, 3.5vw, 16px)',
                    color: 'var(--danger)',
                    fontWeight: 600,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>
                Continue
              </button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: GOAL */}
      {screen === 3 && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          <img
            src={FOUNDRY_GOAL_IMG}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              opacity: 0.9,
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '52px 20px 40px',
              ...slideStyle,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue','Inter',sans-serif",
                    fontSize: 'clamp(32px, 8vw, 42px)',
                    letterSpacing: '0.1em',
                    color: '#FBF7E4',
                    lineHeight: 1.1,
                    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  }}
                >
                  What's your
                  <br />
                  primary goal?
                </div>
                <div
                  style={{
                    fontSize: 'clamp(15px, 4vw, 19px)',
                    color: '#C0B8AC',
                    marginTop: 6,
                    fontWeight: 400,
                    textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)',
                  }}
                >
                  Your program is built around this choice
                </div>
              </div>
              <div role="radiogroup" aria-label="Primary training goal" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {GOAL_OPTIONS.map((opt) => {
                  const sel = goal === opt.id;
                  return (
                    <button
                      key={opt.id}
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setGoal(opt.id)}
                      style={{
                        padding: '13px 16px',
                        borderRadius: tokens.radius.xl,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: sel ? 'rgba(232,101,26,0.15)' : 'transparent',
                        border: `1px solid ${sel ? 'rgba(232,101,26,0.6)' : 'transparent'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        WebkitBackdropFilter: sel ? 'blur(20px)' : 'none',
                        backdropFilter: sel ? 'blur(20px)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: tokens.radius.full,
                          flexShrink: 0,
                          border: `2px solid ${sel ? '#E8651A' : 'rgba(232,101,26,0.35)'}`,
                          background: sel ? '#E8651A' : 'transparent',
                          boxShadow: sel ? 'inset 0 0 0 3px rgba(26,24,20,0.8)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      />
                      <div>
                        <span
                          style={{
                            fontSize: 'clamp(16px, 4.2vw, 20px)',
                            color: sel ? '#FBF7E4' : '#E8E4DC',
                            fontWeight: sel ? 600 : 500,
                            display: 'block',
                            textShadow:
                              '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            fontSize: 'clamp(13px, 3.5vw, 16px)',
                            color: '#C0B8AC',
                            marginTop: 2,
                            display: 'block',
                            textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)',
                          }}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && (
                <div
                  style={{
                    fontSize: 'clamp(13px, 3.5vw, 16px)',
                    color: 'var(--danger)',
                    fontWeight: 600,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>
                Continue
              </button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 4: READY — handoff to meso setup */}
      {screen === 4 && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          <img
            src={FOUNDRY_READY_IMG}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 50%',
              opacity: 0.9,
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background:
                'linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '52px 24px 40px',
              ...slideStyle,
            }}
          >
            <div>
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontFamily: "'Bebas Neue','Inter',sans-serif",
                    fontSize: 'clamp(38px, 10vw, 52px)',
                    letterSpacing: '0.15em',
                    color: '#FBF7E4',
                    lineHeight: 1.1,
                    textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(232,101,26,0.25)',
                  }}
                >
                  THE FIRE
                  <br />
                  IS LIT
                </div>
                <div
                  style={{
                    fontSize: 'clamp(16px, 4.2vw, 20px)',
                    color: '#E8E4DC',
                    marginTop: 16,
                    lineHeight: 1.6,
                    maxWidth: 340,
                    fontWeight: 400,
                    textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)',
                  }}
                >
                  Progress you can feel. Programming you can trust. A few
                  details and The Foundry builds your first meso.
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                width: '100%',
              }}
            >
              <button
                onClick={advance}
                className="btn-primary"
                style={{
                  ...ctaBtnStyle,
                  fontSize: 'clamp(16px, 4.2vw, 20px)',
                  padding: '18px',
                }}
              >
                Build My Program
              </button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
