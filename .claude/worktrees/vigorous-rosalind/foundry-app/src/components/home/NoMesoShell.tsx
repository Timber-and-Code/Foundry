import FoundryBanner from '../shared/FoundryBanner';
import ExplorePage from '../explore/ExplorePage';
import { FOUNDRY_EMPTY_IMG } from '../../data/images-home';

interface NoMesoShellProps {
  onSetup: () => void;
  onStartProgram: (programId: any) => void;
}

function NoMesoShell({ onSetup, onStartProgram }: NoMesoShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter',system-ui,sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FoundryBanner subtitle="EXPLORE" />

      {/* Explore content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Empty state hero */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 20px 12px',
            textAlign: 'center',
            background:
              'radial-gradient(ellipse at center bottom, rgba(232,101,26,0.08) 0%, transparent 70%)',
          }}
        >
          <img
            src={typeof FOUNDRY_EMPTY_IMG !== 'undefined' ? FOUNDRY_EMPTY_IMG : ''}
            alt=""
            style={{
              width: 180,
              height: 180,
              objectFit: 'cover',
              marginBottom: 12,
              borderRadius: 16,
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
              filter: 'drop-shadow(0 0 20px rgba(232,101,26,0.15))',
              opacity: 0.8,
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--phase-accum)',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            THE FOUNDRY IS WAITING
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Your next program is one tap away.
          </div>
        </div>
        <ExplorePage profile={null} onStartProgram={onStartProgram} />
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}
      >
        <button
          onClick={onSetup}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '15px',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}
        >
          Build My Program →
        </button>
        <div
          style={{
            textAlign: 'center',
            marginTop: 8,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Browse the library above, then set up when you're ready.
        </div>
      </div>
    </div>
  );
}

export default NoMesoShell;
