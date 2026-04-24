import { useState, type CSSProperties } from 'react';

// Numbered ledger tiles — 01..N in accent orange on the left, title + subtitle
// in the middle, chevron on the right. Same accent on every tile: no
// per-section color coding. The number is the identity.

interface Tile {
  id: string;
  title: string;
  subtitle: string;
}

const TOP_TILES: Tile[] = [
  { id: 'library',  title: 'Exercise Library', subtitle: '240 exercises · how-tos and video cues' },
  { id: 'programs', title: 'Sample Programs',  subtitle: 'Start from a proven 4–10 week block'    },
  { id: 'mobility', title: 'Mobility',         subtitle: 'Warm-ups, cool-downs, daily flows'      },
  { id: 'cardio',   title: 'Cardio',           subtitle: 'Steady state, intervals, conditioning'  },
  { id: 'system',   title: 'The System',       subtitle: 'Why The Foundry is built this way'      },
];

const LEARN_CARDS: Tile[] = [
  { id: 'foundry',       title: 'What The Foundry Does', subtitle: 'The full picture'               },
  { id: 'periodization', title: 'Linear Periodization',  subtitle: 'Why each week gets harder'      },
  { id: 'overload',      title: 'Progressive Overload',  subtitle: 'The engine behind all progress' },
];

export default function ExplorePreview() {
  const [showLearn, setShowLearn] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--ff-body)',
        maxWidth: 480,
        margin: '0 auto',
        padding: '20px 20px 40px 20px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 34,
          letterSpacing: '0.04em',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        EXPLORE
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Library, programs, and the thinking behind it all.
      </div>

      {!showLearn &&
        TOP_TILES.map((tile, i) => (
          <TileButton
            key={tile.id}
            tile={tile}
            index={i}
            onClick={() => {
              if (tile.id === 'system') setShowLearn(true);
            }}
          />
        ))}

      {showLearn && (
        <>
          <button
            onClick={() => setShowLearn(false)}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              marginBottom: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ← Explore
          </button>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 28,
              letterSpacing: '0.04em',
              marginBottom: 4,
              lineHeight: 1,
            }}
          >
            THE SYSTEM
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
            How The Foundry thinks about training.
          </div>
          {LEARN_CARDS.map((card, i) => (
            <TileButton key={card.id} tile={card} index={i} onClick={() => {}} />
          ))}
        </>
      )}
    </div>
  );
}

function TileButton({
  tile,
  index,
  onClick,
}: {
  tile: Tile;
  index: number;
  onClick: () => void;
}) {
  // Ledger-style tile: zero-padded index in accent orange on the left,
  // title + subtitle in the middle, chevron on the right. Same accent
  // color on every tile — the *number* is the identifier, not a color.
  const style: CSSProperties = {
    width: '100%',
    height: 76,
    padding: 0,
    marginBottom: 12,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: '64px 1fr auto',
    alignItems: 'stretch',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'inherit',
    transition: 'border-color 150ms, transform 120ms',
    textAlign: 'left',
  };
  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Numbered block */}
      <div
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-inset)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 30,
            letterSpacing: '0.04em',
            color: 'var(--accent)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Title + subtitle */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 20,
            letterSpacing: '0.05em',
            color: 'var(--text-primary)',
            lineHeight: 1,
            marginBottom: 5,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tile.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tile.subtitle}
        </div>
      </div>

      {/* Chevron */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingRight: 16,
          color: 'var(--text-muted)',
          fontSize: 22,
          lineHeight: 1,
        }}
        aria-hidden
      >
        ›
      </div>
    </button>
  );
}
