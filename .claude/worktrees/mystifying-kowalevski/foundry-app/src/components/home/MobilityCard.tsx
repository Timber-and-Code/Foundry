import { tokens } from '../../styles/tokens';
import { loadMobilitySession } from '../../utils/store';

interface MobilityCardProps {
  todayCardioStr: string;
  onOpenMobility: (dateStr: string) => void;
}

function MobilityCard({ todayCardioStr, onOpenMobility }: MobilityCardProps) {
  const MOBILITY_COLOR = tokens.colors.gold;
  const todayMobilitySession = loadMobilitySession(todayCardioStr);
  return (
    <button
      onClick={() => onOpenMobility(todayCardioStr)}
      style={{
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        padding: '12px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke={MOBILITY_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2" />
          <path d="M12 8v4l3 3" />
        </svg>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          {todayMobilitySession?.completed
            ? 'Mobility done today ✓'
            : 'Add a mobility session'}
        </span>
      </div>
      <span
        style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          fontWeight: 700,
        }}
      >
        +
      </span>
    </button>
  );
}

export default MobilityCard;
