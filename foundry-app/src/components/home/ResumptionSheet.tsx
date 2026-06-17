/**
 * ResumptionSheet — full-screen takeover shown when the lifter has been
 * absent from training for 7+ days. The four tiles let them choose how
 * to re-anchor the calendar grid (which is wall-clock-driven and so
 * silently advances past their actual progress over the layoff).
 *
 * Modeled on MesoCompleteSheet (same component owns the styling
 * reference). Not dismissable — they must pick. Onboarding parity:
 * the smart-default tile gets a 2px accent border so the lifter has a
 * "right answer" cue without losing agency.
 *
 * Wiring: parent renders <ResumptionSheet ... /> when
 *   detectResumptionGap(...) returns non-null AND !isResumptionHandled(gap).
 * The sheet marks the gap as handled before invoking onDismiss so a
 * stale re-render can't re-fire it.
 */
import { tokens } from '../../styles/tokens';
import type { Profile } from '../../types';
import {
  applyResumptionChoice,
  markResumptionHandled,
  type ResumptionGap,
  type ResumptionChoice,
} from '../../utils/resumption';

interface ResumptionSheetProps {
  gap: ResumptionGap;
  profile: Profile;
  completedDays: Set<string>;
  currentWeek: number;
  setProfile: (p: Profile) => void;
  setCompletedDays: (s: Set<string>) => void;
  setCurrentWeek: (w: number) => void;
  onDismiss: () => void;
}

interface TileDef {
  key: ResumptionChoice;
  title: string;
  body: string;
}

const TILES: TileDef[] = [
  {
    key: 'pick_up',
    title: 'Pick up where you left off',
    body: 'Resume your meso. No load changes.',
  },
  {
    key: 'repeat_last_week',
    title: 'Repeat last week',
    body: 'Re-do the week you just finished. Same loads, fresh slate.',
  },
  {
    key: 'recalibrate',
    title: 'Recalibrate (re-entry deload)',
    body: 'Same prescription, 15% lighter for one week, then back to full load.',
  },
  {
    key: 'restart_meso',
    title: 'Restart meso',
    body: 'Start over from week 1 with today as day 1. Your old data is archived.',
  },
];

/**
 * Smart default by gap length:
 *    7–13 days → repeat_last_week (likely just missed one week)
 *   14–20 days → recalibrate (long enough that loads will feel heavier)
 *   21+ days  → restart_meso (programming is probably stale)
 */
function smartDefault(gapDays: number): ResumptionChoice {
  if (gapDays < 14) return 'repeat_last_week';
  if (gapDays < 21) return 'recalibrate';
  return 'restart_meso';
}

export default function ResumptionSheet({
  gap,
  profile,
  completedDays,
  currentWeek,
  setProfile,
  setCompletedDays,
  setCurrentWeek,
  onDismiss,
}: ResumptionSheetProps) {
  const recommended = smartDefault(gap.gapDays);

  const handlePick = (choice: ResumptionChoice) => {
    try {
      applyResumptionChoice(choice, gap, {
        profile,
        completedDays,
        currentWeek,
        setProfile,
        setCompletedDays,
        setCurrentWeek,
      });
    } catch (e) {
      console.warn('[Foundry]', 'applyResumptionChoice failed', e);
    }
    markResumptionHandled(gap);
    // TODO: toast — "Calendar moved forward N days. Resuming X today."
    // Skipped for v1 since the sheet itself is the confirmation. Wire
    // through ToastContext when the copy is locked.
    onDismiss();
  };

  return (
    <main
      role="dialog"
      aria-modal="true"
      aria-labelledby="resumption-title"
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
          Welcome back
        </div>
        <h1
          id="resumption-title"
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
          WELCOME BACK
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
          Last lift: {gap.lastDayLabel} · {gap.gapDays} days ago
        </p>

        <div
          role="group"
          aria-labelledby="resumption-title"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {TILES.map((tile) => {
            const isDefault = tile.key === recommended;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => handlePick(tile.key)}
                style={{
                  textAlign: 'left',
                  padding: '16px 16px 18px',
                  borderRadius: tokens.radius.lg,
                  border: isDefault
                    ? `2px solid ${tokens.colors.accent}`
                    : `1px solid ${tokens.colors.accentBorder}`,
                  background: tokens.colors.bgCard,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                  minHeight: 132,
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
                  {tile.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                    lineHeight: 1.45,
                  }}
                >
                  {tile.body}
                </div>
              </button>
            );
          })}
        </div>

        {/* Narrow-screen single-column override — inline media query via
            window match isn't worth the complexity. Browsers without grid
            support fall back to flex via the outer container. */}
        <style>{`
          @media (max-width: 420px) {
            main[aria-labelledby='resumption-title'] [role='group'] {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </main>
  );
}
