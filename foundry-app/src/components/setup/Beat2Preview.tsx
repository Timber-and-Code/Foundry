import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar from '../shared/PhaseBar';
import type { Beat1Values } from './Beat1Essentials';

/**
 * PHASE 2 SCAFFOLD — Beat 2 live preview with sticky chip row.
 *
 * This is a stub. TODO(phase-2):
 *   1. Call generateProgram(profileFromBeat1, EXERCISE_DB) to build the
 *      preview data.
 *   2. Render day-by-day accordion (see DayAccordion.tsx).
 *   3. Wire split/length/session chip bottom sheets (SplitSheet,
 *      MesoLengthSheet, SessionLengthSheet).
 *   4. Inline exercise swap via the existing SwapSheet.
 *   5. 2-anchor-per-day rule on the [⋯] menu.
 *   6. On "Save program", call saveProfile(p) — same contract as the
 *      legacy SetupPage.onComplete path. Then show ProgramReady.
 *   7. anchor_strength_bias consumption belongs in program.ts; wire the
 *      flag on Beat 2's program generation, not here.
 */
interface Beat2Props {
  beat1: Beat1Values;
  onSave: () => void;
  onEditEssentials: () => void;
}

type SplitType = 'ppl' | 'upper_lower' | 'push_pull' | 'full_body' | 'traditional' | 'custom';
type Length = 4 | 6 | 8;
type Session = 'short' | 'standard' | 'long';

const SPLIT_LABEL: Record<SplitType, string> = {
  ppl: 'Push / Pull / Legs',
  upper_lower: 'Upper / Lower',
  push_pull: 'Push / Pull',
  full_body: 'Full Body',
  traditional: 'Traditional',
  custom: 'Custom',
};

const SESSION_LABEL: Record<Session, string> = {
  short: '~30–45 min',
  standard: '~45–60 min',
  long: '~60–75 min',
};

export default function Beat2Preview({ beat1, onSave, onEditEssentials: _onEditEssentials }: Beat2Props) {
  const [split, setSplit] = useState<SplitType>('upper_lower');
  const [length, setLength] = useState<Length>(6);
  const [session, setSession] = useState<Session>('standard');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        padding: '20px 20px 120px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', 'Inter', sans-serif",
          fontSize: 28,
          letterSpacing: '0.12em',
          marginBottom: 16,
        }}
      >
        YOUR PROGRAM
      </div>

      {/* Sticky chip row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          position: 'sticky',
          top: 0,
          background: tokens.colors.bgRoot,
          paddingBottom: 8,
          zIndex: 2,
        }}
      >
        <Chip label={SPLIT_LABEL[split]} onClick={() => {
          // TODO(phase-2): open SplitSheet bottom sheet with 6 cards
          const order: SplitType[] = ['upper_lower', 'ppl', 'push_pull', 'full_body', 'traditional', 'custom'];
          setSplit(order[(order.indexOf(split) + 1) % order.length]);
        }} />
        <Chip label={`${length} WEEKS`} onClick={() => {
          // TODO(phase-2): open MesoLengthSheet bottom sheet
          const order: Length[] = [4, 6, 8];
          setLength(order[(order.indexOf(length) + 1) % order.length]);
        }} />
        <Chip label={SESSION_LABEL[session]} onClick={() => {
          // TODO(phase-2): open SessionLengthSheet bottom sheet
          const order: Session[] = ['short', 'standard', 'long'];
          setSession(order[(order.indexOf(session) + 1) % order.length]);
        }} />
      </div>

      <PhaseBar variant="static" />

      <div
        style={{
          marginTop: 28,
          padding: 16,
          background: tokens.colors.bgCard,
          borderRadius: tokens.radius.md,
          border: `1px dashed ${tokens.colors.accentBorder}`,
          color: tokens.colors.textMuted,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: tokens.colors.accent }}>Phase 2 scaffold.</strong>
        {' '}This screen is a shell. The full live preview (day accordion,
        exercise swap, per-day session duration labels, 2-anchor cap) ships
        with the Phase 2 merge.
        <br /><br />
        Current Beat 1 values: <code>{beat1.daysPerWeek}</code> days ·{' '}
        <code>{beat1.equipment}</code> · starting <code>{beat1.startDate}</code>.
      </div>

      <button
        type="button"
        onClick={onSave}
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 40px)',
          maxWidth: 440,
          padding: '16px',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderRadius: tokens.radius.xl,
          background: tokens.colors.btnPrimaryBg,
          border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
          color: tokens.colors.btnPrimaryText,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
          zIndex: 5,
        }}
      >
        Save program
      </button>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: tokens.radius.pill,
        background: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.accentBorder}`,
        color: tokens.colors.textPrimary,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label} <span aria-hidden="true" style={{ color: tokens.colors.accent }}>▾</span>
    </button>
  );
}
