import React from 'react';
import { store } from '../../utils/store';

interface TourOverlayProps {
  onDone: () => void;
  onNavigate: (path: string) => void;
  onTabChange: (tab: string) => void;
}

export function TourOverlay({ onDone, onNavigate, onTabChange }: TourOverlayProps) {
  const [step, setStep] = React.useState(0);

  const STEPS = [
    {
      tab: 'landing',
      title: 'Home',
      body: "Your daily hub. Today's session, readiness check-in, recovery guidance, and cardio — all in one place. This is where you start every workout.",
    },
    {
      tab: 'schedule',
      title: 'Your Schedule',
      body: "Every week of your mesocycle laid out. Tap any session to open it. Skip days, check your calendar, and track what's done.",
    },
    {
      tab: 'progress',
      title: 'Track Your Progress',
      body: 'Volume landmarks, estimated 1RMs, and per-muscle tracking. This is where you watch the numbers move week over week.',
    },
    {
      tab: 'explore',
      title: 'Explore',
      body: 'Browse the exercise library, sample programs, and learn how periodization works. Everything The Foundry is built on lives here.',
    },
  ];

  React.useEffect(() => {
    if (onNavigate) onNavigate('home');
    if (onTabChange) onTabChange(STEPS[step].tab);
  }, [step]);

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      store.set('foundry:toured', '1');
      if (onTabChange) onTabChange('landing');
      onDone();
    }
  };

  const dismiss = () => {
    store.set('foundry:toured', '1');
    if (onTabChange) onTabChange('landing');
    onDone();
  };

  const current = STEPS[step];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 90,
          left: 16,
          right: 16,
          maxWidth: 440,
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--accent-blue)',
          borderRadius: 12,
          padding: '18px 20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          cursor: 'default',
          pointerEvents: 'auto',
        }}
      >
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 5,
                height: 5,
                borderRadius: 3,
                background: i <= step ? 'var(--accent-blue)' : 'var(--border-accent)',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {current.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {current.body}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={dismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: 0,
            }}
          >
            Skip tour
          </button>
          <button
            onClick={advance}
            className="btn-primary"
            style={{
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {step < STEPS.length - 1 ? 'Next →' : "Let's go ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}











export default TourOverlay;
