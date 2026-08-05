import React, { Suspense, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../../contexts/AuthContext';
import { store, resolveAccountTier, resetMeso } from '../../utils/store';
import { emit } from '../../utils/events';
import { archiveMesocycleRemote, deleteAccountRemote } from '../../utils/sync';
import { archiveCurrentMeso, loadArchive } from '../../utils/archive';
import { summarizeLifetime } from '../../utils/progressAggregation';
import { useSyncState, useSyncDirtyCount } from '../../hooks/useSyncState';
import { getMeso } from '../../data/constants';
import { formatSplitName } from '../../utils/splitLabel';
import type { Profile, WorkoutSet } from '../../types';
// Type-only — erased at build, so regenerateDays stays lazily imported.
import type { RegenerateOptions } from '../../utils/regenerateDays';

const AccountSection = React.lazy(() => import('../auth/UserMenu'));
const AboutModal = React.lazy(() => import('./AboutModal'));
const HealthSection = React.lazy(() => import('./HealthSection'));

const FOUNDRY_AI_WORKER_URL = import.meta.env.VITE_FOUNDRY_AI_WORKER_URL;
const FOUNDRY_APP_KEY = import.meta.env.VITE_FOUNDRY_APP_KEY;
const APP_VERSION = import.meta.env.VITE_APP_VERSION;


interface ProfileDrawerProps {
  saved: Profile;
  onClose: () => void;
  onSave: (data: Partial<Profile>) => void;
}

// Sync state, expressed as a dot beside your name rather than a labelled row.
const SYNC_DOT: Record<string, string> = {
  idle: 'var(--text-dim)',
  syncing: '#60a5fa',
  synced: '#4ade80',
  offline: 'var(--warning, #ff9800)',
};
const SYNC_WORD: Record<string, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
};

export function ProfileDrawer({ saved, onClose, onSave }: ProfileDrawerProps) {
  const { logout, user } = useAuth();
  const syncState = useSyncState();
  const dirtyCount = useSyncDirtyCount();
  const [weight, setWeight] = useState(saved.weight || '');
  const [editingWeight, setEditingWeight] = useState(false);
  const [showData, setShowData] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  // Account deletion is two-step on purpose: reveal the panel, then type
  // DELETE. See handleDeleteAccount.
  const [refreshingDays, setRefreshingDays] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Meso context ──────────────────────────────────────────────────────────
  const meso = (() => {
    try { return getMeso(); } catch { /* no active meso */ return null; }
  })();
  const currentWeek = parseInt(store.get('foundry:currentWeek') || '0');
  const totalWeeks = meso?.totalWeeks || saved.mesoLength || null;
  const phase = meso?.phases?.[currentWeek] || '';
  // Single source of truth: profile.splitType. Day-tag inference was
  // collapsing Upper/Lower mesos into "PUSH / PULL / LEGS" because
  // tags overlap across splits.
  const splitLabel = formatSplitName(meso?.splitType || saved.splitType);

  // ── Training stats ────────────────────────────────────────────────────────
  const stats = (() => {
    let sessions = 0;
    let totalSets = 0;
    const days = meso?.days || 6;
    const weeks = totalWeeks || 6;

    for (let w = 0; w <= currentWeek; w++) {
      for (let d = 0; d < days; d++) {
        if (store.get(`foundry:done:d${d}:w${w}`) === '1') {
          sessions++;
          // Count working sets
          try {
            const raw = store.get(`foundry:day${d}:week${w}`);
            if (raw) {
              const dayData = JSON.parse(raw);
              Object.values(dayData).forEach((exSets) => {
                Object.values((exSets as Record<string, WorkoutSet>) || {}).forEach((s: WorkoutSet) => {
                  if (s && s.confirmed && !s.warmup) totalSets++;
                });
              });
            }
          } catch { /* skip */ }
        }
      }
    }

    // Streak: count consecutive completed sessions backwards from current week
    let streak = 0;
    outer: for (let w = currentWeek; w >= 0; w--) {
      for (let d = days - 1; d >= 0; d--) {
        if (store.get(`foundry:done:d${d}:w${w}`) === '1') {
          streak++;
        } else if (w < currentWeek || d < days - 1) {
          // Only break on non-current incomplete sessions
          break outer;
        }
      }
    }

    return { sessions, totalSets, streak, totalPossible: days * weeks };
  })();

  // Tier, reduced to a chip. resolveAccountTier was being called twice in the
  // render below; once is enough.
  const tierResult = resolveAccountTier(saved);
  const tierChip = tierResult.qualifiesForFree
    ? tierResult.reason === 'student' ? 'FREE · STUDENT'
      : tierResult.reason === 'under_18' ? 'FREE · UNDER 18'
      : tierResult.reason === 'senior' ? 'FREE · 62+' : 'FREE'
    : null;

  // How far into THIS week you are — the half the meso card never showed.
  // "Week 2 of 6" tells you nothing about whether today is your first
  // session or your last.
  const weekProgress = (() => {
    const days = meso?.days || saved.workoutDays?.length || 0;
    if (!days) return null;
    let done = 0;
    for (let d = 0; d < days; d++) {
      if (store.get(`foundry:done:d${d}:w${currentWeek}`) === '1') done++;
    }
    return { done, days };
  })();

  // ── Lifetime totals ───────────────────────────────────────────────────────
  // Archive + the cycle in progress. Sets are counted the same way in both
  // halves (non-warmup, real numbers) so the total means one thing.
  const lifetime = (() => {
    try {
      const past = summarizeLifetime(loadArchive());
      const cycles = past.cycles + 1; // the one you're in
      const sessions = past.sessions + stats.sessions;
      const setCount = past.sets + stats.totalSets;
      if (past.cycles === 0) return null;

      const n = (v: number) => v.toLocaleString();
      const headline =
        `${cycles} cycle${cycles === 1 ? '' : 's'} · ` +
        `${n(sessions)} session${sessions === 1 ? '' : 's'} · ` +
        `${n(setCount)} set${setCount === 1 ? '' : 's'}`;

      let since: string | null = null;
      if (past.since) {
        const d = new Date(past.since.slice(0, 10) + 'T00:00:00');
        if (!Number.isNaN(d.getTime())) {
          since = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }
      return { headline, since };
    } catch (e) {
      console.warn('[Foundry]', 'Failed to summarise lifetime totals', e);
      return null;
    }
  })();

  // ── Reset helpers ─────────────────────────────────────────────────────────
  // Ending a cycle is a forward move ("Start New Meso"), not a delete. The
  // finished cycle is KEPT: archiveCurrentMeso writes it to foundry:archive,
  // which is what feeds Previous Meso Cycles, Lifts by Muscle, and the
  // "Last meso: N lbs" note on week 1 of the next cycle.
  const startNewMeso = async () => {
    // MUST run before anything wipes localStorage — archiveCurrentMeso reads
    // the foundry:day{d}:week{w} keys that resetMeso() is about to clear.
    //
    // This call used to be missing here while useMesoState.handleReset had
    // it, so whether your finished cycle survived depended on which button
    // ended it. Cycles ended from this drawer left no archive entry at all,
    // and the next meso opened with no history for lifts trained for months.
    try {
      archiveCurrentMeso(saved);
    } catch (e) {
      console.warn('[Foundry]', 'archiveCurrentMeso failed on new-meso start', e);
    }

    // Mark the meso as abandoned in Supabase and clear active_meso_id
    // BEFORE wiping localStorage, so the remote pointer is gone first.
    await archiveMesocycleRemote();

    const fixedKeys = [
      'foundry:profile',
      'foundry:completedDays',
      'foundry:storedProgram',
      'foundry:ts:foundry:profile',
      'foundry:ts:foundry:completedDays',
      'foundry:ts:foundry:currentWeek',
    ];
    fixedKeys.forEach((k) => store.remove(k));
    // Sweep every per-session key of the meso — day blobs, done flags,
    // day_v2 mirrors, session ids, overrides — and zero the stored week.
    // active_meso_id is already gone, so the remote archive inside is a
    // no-op.
    resetMeso();
    onClose();
    emit('foundry:resetToSetup');
  };

  const deleteAllFoundryData = async () => {
    store.keys('foundry:')
      .filter((k) => k !== 'foundry:welcomed')
      .forEach((k) => store.remove(k));
    try { await logout(); } catch { /* swallow */ }
    onClose();
    window.location.reload();
  };

  // One confirm, not two. The old copy led with "Delete your current meso?"
  // and then asked whether you were sure you wanted it "permanently deleted"
  // — which described the wrong thing twice: the cycle is archived, and its
  // logged sets stay in Supabase either way. Stacked scary prompts for a
  // routine action train people to click through the ones that matter.
  const handleStartNewMeso = () => {
    const done = stats.sessions;
    if (
      !window.confirm(
        `Start a new mesocycle?\n\nThis cycle${done ? ` — ${done} session${done === 1 ? '' : 's'} logged —` : ''} moves to your history, where it keeps feeding "last meso" weights and Lifts by Muscle. Nothing you logged is deleted.\n\nYou'll go to the builder to set up the new cycle.`,
      )
    )
      return;
    startNewMeso();
  };

  const handleDeleteAllFoundryData = () => {
    if (!window.confirm('Delete ALL Foundry data on this device? This wipes your profile, active meso, and all workout history from this device.')) return;
    if (!window.confirm('Are you REALLY sure? You\'ll also be signed out. Your Supabase account and its data are preserved — signing in again will restore everything.')) return;
    if (!window.confirm('Last chance. This cannot be undone without signing back in. Continue?')) return;
    deleteAllFoundryData();
  };

  // Rebuild the days you haven't started yet, leaving logged ones alone.
  //
  // Always previews first. This is destructive for the days it replaces, and
  // on a shared mesocycle it changes what your training partner sees too —
  // so the confirm names the exact days rather than asking in the abstract.
  const handleRefreshUpcoming = async () => {
    if (refreshingDays) return;
    setRefreshingDays(true);
    try {
      const { regenerateUntouchedDays } = await import('../../utils/regenerateDays');
      const { getExerciseDB } = await import('../../data/exerciseDB');
      const exerciseDB = getExerciseDB() as unknown as NonNullable<
        RegenerateOptions['exerciseDB']
      >;

      const preview = regenerateUntouchedDays(saved, { exerciseDB });
      if (!preview.program || preview.regenerated.length === 0) {
        window.alert(
          'Nothing to rebuild — every day in this cycle already has logged work, so none can be changed without losing it.',
        );
        return;
      }

      const names = preview.regenerated
        .map((i) => preview.program?.[i]?.label || `Day ${i + 1}`)
        .join(', ');
      const kept = preview.preserved.length;
      if (
        !window.confirm(
          `Rebuild ${names}?\n\nThese days have no logged sets, so nothing you've done is lost. ${kept} day${kept === 1 ? '' : 's'} you've already trained will be left exactly as ${kept === 1 ? 'it is' : 'they are'}.\n\nThe new days use your training history to keep your main lifts consistent, and fix the missing arm and calf work.`,
        )
      )
        return;

      const result = regenerateUntouchedDays(saved, { exerciseDB, commit: true });
      emit('foundry:pull-complete'); // re-read the stored program

      // Push the new days, or the next pull rebuilds foundry:storedProgram
      // from the untouched remote rows and quietly undoes all of this.
      // Awaited: the alert must not claim success before the write lands, and
      // a rebuild that stays local is exactly the bug this fixes.
      const mesoId = store.get('foundry:active_meso_id');
      let pushed = true;
      if (mesoId) {
        const { syncDayExercisesRemote } = await import('../../utils/sync');
        for (const dayIdx of result.regenerated) {
          const day = result.program?.[dayIdx];
          if (day?.exercises?.length) {
            const ok = await syncDayExercisesRemote(mesoId, dayIdx, day.exercises);
            if (!ok) pushed = false;
          }
        }
      }

      window.alert(
        pushed
          ? `Rebuilt ${names}. Open the Schedule tab to see the new sessions.`
          : `Rebuilt ${names} on this device, but they couldn't be saved to your account — they may revert next time you sync. Check your connection and rebuild again.`,
      );
    } catch (e) {
      console.warn('[Foundry]', 'refresh upcoming days failed', e);
      window.alert('Could not rebuild those days. Nothing was changed.');
    } finally {
      setRefreshingDays(false);
    }
  };

  // Account deletion — App Store Guideline 5.1.1(v). Distinct from "Delete
  // All Foundry Data", which is device-local and reversible by signing back
  // in. This erases the server copy and the login itself.
  //
  // Gated on typing DELETE rather than a chain of window.confirm()s: three
  // stacked confirms are three reflexive OKs, and this is the one action in
  // the app with nothing behind it.
  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;

    setDeletingAccount(true);
    try {
      const result = await deleteAccountRemote();

      if (result.failures.length > 0 && !result.rowsDeleted) {
        // Say what actually happened. Wiping the device now would hide the
        // fact that server data survived and leave no way back to retry.
        window.alert(
          `Your account was not fully deleted.\n\nCouldn't remove: ${result.failures.join(', ')}.\n\nNothing has been erased from this device, so you can try again. If it keeps failing, send feedback from this drawer.`,
        );
        setDeletingAccount(false);
        return;
      }

      if (!result.authUserDeleted) {
        // Rows are gone but the login remains — the deploy-state of the edge
        // function is not something the user should have to reason about, so
        // tell them plainly what is and isn't done.
        window.alert(
          'Your workout data has been deleted from the server.\n\nYour login could not be removed automatically — send feedback from this drawer and it will be finished manually. No training data remains.',
        );
      }

      await deleteAllFoundryData();
    } catch (e) {
      console.warn('[Foundry]', 'account deletion failed', e);
      window.alert('Account deletion failed. Nothing was erased from this device — please try again.');
      setDeletingAccount(false);
    }
  };

  const handleExport = () => {
    const data: Record<string, string | null> = {};
    store.keys('foundry:').forEach((k) => { data[k] = store.get(k); });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foundry_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWeightSave = () => {
    const val = parseFloat(String(weight));
    if (!isNaN(val) && val > 0) {
      onSave({ ...saved, weight });
    }
    setEditingWeight(false);
  };

  const handleSendFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackStatus('sending');
    try {
      const res = await fetch(FOUNDRY_AI_WORKER_URL + '/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Foundry-Key': FOUNDRY_APP_KEY,
        },
        body: JSON.stringify({
          message: feedbackMsg.trim(),
          appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
          device: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackStatus('sent');
        setFeedbackMsg('');
        setTimeout(() => { setShowFeedback(false); setFeedbackStatus(''); }, 2000);
      } else {
        setFeedbackStatus('error');
      }
    } catch {
      setFeedbackStatus('error');
    }
  };

  const divider = (
    <div style={{
      height: 1,
      background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.2), transparent)',
      margin: '4px 0',
    }} />
  );

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--text-dim)',
      marginBottom: 4,
      marginTop: 6,
      textTransform: 'uppercase' as const,
    }}>
      {text}
    </div>
  );

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 12px',
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: tokens.radius.lg,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: tokens.colors.overlayMed,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '82%',
          maxWidth: 360,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)',
          overflowY: 'auto',
        }}
      >
        {/* ── Close button ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 18px 0' }}>
          <button
            onClick={onClose}
            aria-label="Close profile drawer"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.full,
              cursor: 'pointer',
              width: 36,
              height: 36,
              color: 'var(--text-muted)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* ── Header: Name + Meso Info + Weight ── */}
        <div style={{ padding: '4px 20px 16px' }}>
          {/* Avatar + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: tokens.radius.full,
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Bebas Neue','Inter',sans-serif",
                fontSize: 20,
                color: '#FBF7E4',
                border: '2px solid rgba(251,247,228,0.15)',
                flexShrink: 0,
              }}
            >
              {(saved.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}>
                {saved.name || 'Athlete'}
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 3,
                fontWeight: 500,
              }}>
                {saved.experience ? (saved.experience.charAt(0).toUpperCase() + saved.experience.slice(1)) : ''}
                {saved.experience && splitLabel ? ' · ' : ''}
                {splitLabel}
              </div>
              {/* Sync state and tier belong next to your identity, not filed
                  under settings. Sync is TRUST — "is my training safe" is an
                  identity question, and it was buried in a lazily-loaded
                  sub-component four sections down. Tier is a receipt for a
                  decision made once at signup; it used to occupy a full
                  bordered card, permanently. Both are chips now. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                {user && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: SYNC_DOT[syncState] || 'var(--text-dim)',
                        flexShrink: 0,
                      }}
                    />
                    {dirtyCount > 0 && syncState !== 'syncing'
                      ? `${dirtyCount} pending`
                      : SYNC_WORD[syncState] || 'Sync'}
                  </span>
                )}
                {tierChip && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                    color: 'var(--phase-accum)', background: 'var(--phase-accum)22',
                    border: '1px solid var(--phase-accum)44', borderRadius: tokens.radius.sm,
                    padding: '1px 6px',
                  }}>
                    {tierChip}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Everything else in this drawer is scoped to the current cycle,
              so nothing in the app answered "how much have I actually done".
              Only rendered once there is an archive to total — a brand-new
              lifter gets a zeroed brag line otherwise. */}
          {lifetime && (
            <div style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              padding: '10px 14px',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {lifetime.headline}
              </div>
              {lifetime.since && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  since {lifetime.since}
                </div>
              )}
            </div>
          )}

          {/* Meso context */}
          {totalWeeks && (
            <div style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              padding: '10px 14px',
              marginBottom: 10,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                {/* The "(5 + Deload)" suffix was here. It restated the number
                    you had just read in a second decomposition, next to a
                    phase chip that already says which kind of week this is.
                    Replaced with the half that was actually missing: where
                    you are INSIDE the week. */}
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Week {currentWeek + 1} of {totalWeeks}
                  {weekProgress && (
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                      {' · '}{weekProgress.done} of {weekProgress.days} done
                    </span>
                  )}
                </span>
                {phase && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--phase-accum)',
                    background: 'rgba(var(--accent-rgb),0.1)',
                    border: '1px solid rgba(var(--accent-rgb),0.2)',
                    borderRadius: tokens.radius.sm,
                    padding: '2px 8px',
                  }}>
                    {phase.toUpperCase()}
                  </span>
                )}
              </div>
              {/* Mini progress bar */}
              <div style={{
                height: 4,
                borderRadius: tokens.radius.xs,
                background: 'var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(((currentWeek + 1) / totalWeeks) * 100)}%`,
                  background: 'var(--accent)',
                  borderRadius: tokens.radius.xs,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {/* Body weight — tap to edit.
              Was a <div onClick>, which CLAUDE.md's own accessibility
              convention forbids: unreachable by keyboard, invisible to
              VoiceOver as a control. While editing it renders as a plain
              container so the button doesn't wrap the input. */}
          {editingWeight ? (
            <div style={fieldRowStyle}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Body Weight</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  aria-label="Body weight in pounds"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleWeightSave(); }}
                  onBlur={handleWeightSave}
                  style={{
                    width: 64,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--accent)',
                    borderRadius: tokens.radius.sm,
                    color: 'var(--text-primary)',
                    fontSize: 16, // <16 makes iOS Safari zoom the drawer on focus
                    fontWeight: 600,
                    padding: '4px 6px',
                    textAlign: 'right',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>lbs</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingWeight(true)}
              style={{ ...fieldRowStyle, cursor: 'pointer', width: '100%', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Body Weight</span>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                {saved.weight ? `${saved.weight} lbs` : 'Tap to set'}
              </span>
            </button>
          )}
        </div>

        {/* ── Content sections ── */}
        <div style={{ padding: '0 18px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>

          {/* Training Stats */}
          {divider}
          {sectionLabel('THIS MESO')}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}>
            {[
              // `stats.totalPossible` was computed on every render and never
              // read — it is exactly the denominator this tile was missing.
              // "Sessions 14" doesn't say whether you're ahead or behind.
              { label: 'Sessions', value: `${stats.sessions}/${stats.totalPossible}` },
              { label: 'Working Sets', value: String(stats.totalSets) },
              // Renamed from "Streak", which named nothing: streak of days?
              // weeks? sessions? It counts consecutive completed sessions.
              { label: 'In a row', value: String(stats.streak) },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontSize: value.length > 4 ? 17 : 22,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 5, letterSpacing: '0.06em' }}>
                  {label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Start a new cycle. Deliberately NOT inside the collapsed DATA
              section next to the destructive actions — finishing a block and
              starting the next one is the most routine thing a lifter does
              here, and burying it under "DATA ▸ Delete Current Meso" framed a
              normal training milestone as data loss. */}
          <button
            onClick={handleStartNewMeso}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '12px 14px',
              borderRadius: tokens.radius.lg,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Start new mesocycle
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Keeps this cycle in your history
              </span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
              →
            </span>
          </button>

          {/* Sits directly under "Start new mesocycle" because it is the
              cheaper version of the same intent — "this program isn't right"
              — and most people reaching for a reset only need this. */}
          <button
            onClick={handleRefreshUpcoming}
            disabled={refreshingDays}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: tokens.radius.lg,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              cursor: refreshingDays ? 'wait' : 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Rebuild upcoming days
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Only days you haven&rsquo;t trained yet
              </span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
              {refreshingDays ? '…' : '↻'}
            </span>
          </button>

          {/* Account */}
          {divider}
          {sectionLabel('ACCOUNT')}
          <Suspense fallback={null}>
            <AccountSection />
          </Suspense>

          {/* Sync across devices — always available for anonymous users.
              Routes to the full-screen AuthPage instead of a bottom sheet:
              the bottom-sheet variant gets covered by the iOS keyboard so
              users couldn't see what they were typing. AuthPage already
              handles keyboard inset + scrollIntoView correctly. */}
          {!user && (
            <button
              type="button"
              onClick={() => {
                store.set('foundry:wants_auth', '1');
                emit('foundry:wants_auth');
                onClose();
              }}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '14px 16px',
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.accentBorder}`,
                background: tokens.colors.bgCard,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: tokens.colors.textPrimary, letterSpacing: '0.01em' }}>
                  Sync across devices
                </span>
                <span style={{ fontSize: 11, color: tokens.colors.textMuted, fontWeight: 500 }}>
                  Create an account to back up your training and sync.
                </span>
              </div>
              <span aria-hidden="true" style={{ color: tokens.colors.accent, fontSize: 16, fontWeight: 800 }}>
                →
              </span>
            </button>
          )}

          {/* Foundry Pro.
              The Free Tier card that used to sit here was a permanent
              bordered receipt for a decision made once at signup; it is a
              chip on the avatar row now. Pro stays exactly as it was — it is
              revenue, and it belongs on the seam between the personal half of
              this drawer and the plumbing half, where it reads as an offer
              rather than a setting. */}
          {divider}
          {!tierResult.qualifiesForFree && (
          <button
            onClick={() => { onClose(); emit('foundry:showPricing'); }}
            style={{
              cursor: 'pointer',
              padding: '16px',
              borderRadius: tokens.radius.xl,
              border: '1px solid rgba(212,152,60,0.35)',
              background: 'linear-gradient(135deg, #1A1410 0%, #251D13 50%, #1A1410 100%)',
              boxShadow: '0 2px 20px rgba(212,152,60,0.12), inset 0 1px 0 rgba(212,152,60,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 2,
              marginBottom: 2,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#D4983C', letterSpacing: '0.04em' }}>
                Foundry Pro
              </span>
              <span style={{ fontSize: 11, color: '#C4A46A', fontWeight: 500 }}>
                Coaching dashboard, train with friends & more
              </span>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#1A1410',
              background: 'linear-gradient(135deg, #D4983C, #E8B14A)',
              borderRadius: tokens.radius.md,
              padding: '6px 12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginLeft: 12,
            }}>
              UPGRADE
            </span>
          </button>
          )}

          {/* Apple Health */}
          <Suspense fallback={null}>
            <HealthSection />
          </Suspense>

          {/* ── The app half ──
              SUPPORT and ABOUT were a divider plus an all-caps header each,
              for one button each: three rows of chrome to deliver one row of
              content, twice. One unlabelled list instead.

              About leads it. It is not a legal page — it's the thesis that
              makes the rest of the app legible ("You don't pick sets and
              reps. You don't guess when to deload."), and it was the very
              last row above the version footer, so the only people who ever
              saw it were people already digging through settings. */}
          {divider}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setShowAbout(true)}
              style={{
                padding: '12px 14px',
                borderRadius: tokens.radius.lg,
                border: '1px solid var(--border)',
                background: 'var(--bg-inset)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  How The Foundry trains you
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Why the program looks the way it does
                </span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>
                →
              </span>
            </button>
            <button
              onClick={() => setShowFeedback(true)}
              style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Send feedback</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Write</span>
            </button>
          </div>

          {/* Data — collapsed by default */}
          {divider}
          <button
            onClick={() => setShowData(!showData)}
            aria-expanded={showData}
            style={{
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.14em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase' as const,
            }}>
              DATA
            </span>
            <span aria-hidden="true" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {showData ? '▲' : '▼'}
            </span>
          </button>
          {showData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={handleExport}
                style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Export Backup</span>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Download</span>
              </button>
              {/* Device-local wipe. Named for what it actually does — the
                  server copy survives and signing in restores it. */}
              <button
                onClick={handleDeleteAllFoundryData}
                style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign out &amp; clear this device</span>
                <span style={{ fontSize: 13, color: 'var(--warning, #ff9800)', fontWeight: 500 }}>Clear</span>
              </button>

              {/* Account deletion — required by App Store Guideline 5.1.1(v).
                  Only meaningful with an account; anonymous users have no
                  server-side anything to erase. */}
              {user && (
                <>
                  <button
                    onClick={() => { setShowDeleteAccount((v) => !v); setConfirmText(''); }}
                    aria-expanded={showDeleteAccount}
                    style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete account</span>
                    <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
                      {showDeleteAccount ? 'Cancel' : 'Permanent'}
                    </span>
                  </button>

                  {showDeleteAccount && (
                    <div
                      style={{
                        border: '1px solid var(--danger)',
                        borderRadius: tokens.radius.lg,
                        background: 'rgba(220,38,38,0.06)',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        This erases your account and every workout you have logged, on
                        all devices. <strong>It cannot be undone.</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Want a copy first? Close this and tap <strong>Export Backup</strong> above.
                      </div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Type DELETE to confirm
                        <input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-label="Type DELETE to confirm account deletion"
                          style={{
                            width: '100%',
                            marginTop: 6,
                            padding: '10px 12px',
                            fontSize: 16, // <16 makes iOS Safari zoom the drawer on focus
                            borderRadius: tokens.radius.md,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </label>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                        style={{
                          padding: '12px 16px',
                          borderRadius: tokens.radius.lg,
                          border: 'none',
                          background:
                            confirmText.trim().toUpperCase() === 'DELETE' && !deletingAccount
                              ? 'var(--danger)'
                              : 'var(--bg-inset)',
                          color:
                            confirmText.trim().toUpperCase() === 'DELETE' && !deletingAccount
                              ? '#fff'
                              : 'var(--text-dim)',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor:
                            confirmText.trim().toUpperCase() === 'DELETE' && !deletingAccount
                              ? 'pointer'
                              : 'not-allowed',
                        }}
                      >
                        {deletingAccount ? 'Deleting…' : 'Delete my account permanently'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Version */}
          <div style={{
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--text-dim)',
            marginTop: 12,
            paddingBottom: 20,
          }}>
            The Foundry v{typeof APP_VERSION !== 'undefined' ? APP_VERSION : '2.1.0'}
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: tokens.colors.overlayMed,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && feedbackStatus !== 'sending') {
              setShowFeedback(false);
              setFeedbackStatus('');
            }
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: tokens.radius.xxl,
              padding: 20,
              width: '100%',
              maxWidth: 360,
              border: '1px solid var(--border)',
            }}
          >
            <div
              id="feedback-dialog-title"
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}
            >
              Send Feedback
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Bug reports, feature ideas, anything — it goes straight to the developer.
            </div>
            <textarea
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              aria-label="Feedback message"
              placeholder="What's on your mind?"
              rows={5}
              disabled={feedbackStatus === 'sending' || feedbackStatus === 'sent'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                color: 'var(--text-primary)',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                minHeight: 100,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setShowFeedback(false); setFeedbackStatus(''); }}
                disabled={feedbackStatus === 'sending'}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: tokens.radius.lg,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendFeedback}
                disabled={!feedbackMsg.trim() || feedbackStatus === 'sending' || feedbackStatus === 'sent'}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: tokens.radius.lg,
                  fontSize: 13,
                  fontWeight: 600,
                  background: feedbackStatus === 'sent' ? 'var(--deload-phase)' : 'var(--accent)',
                  border: 'none',
                  fontFamily: 'inherit',
                  color: feedbackStatus === 'sent' ? '#fff' : '#000',
                  cursor: !feedbackMsg.trim() || feedbackStatus === 'sending' ? 'not-allowed' : 'pointer',
                  opacity: !feedbackMsg.trim() && feedbackStatus !== 'sent' ? 0.4 : 1,
                }}
              >
                {feedbackStatus === 'sending' ? 'Sending…' : feedbackStatus === 'sent' ? 'Sent ✓' : feedbackStatus === 'error' ? 'Failed — Retry' : 'Send'}
              </button>
            </div>
            {feedbackStatus === 'error' && (
              <div style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', marginTop: 8 }}>
                Something went wrong. Try again.
              </div>
            )}
          </div>
        </div>
      )}

      {/* About The Foundry modal */}
      {showAbout && (
        <Suspense fallback={null}>
          <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />
        </Suspense>
      )}
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────

// ─── SAMPLE PROGRAM HELPERS ───────────────────────────────────────────────────
// Converts SAMPLE_PROGRAMS day objects (exercise name strings) into fully-formed
// day objects matching the aiDays shape that generateProgram returns as-is.

export default ProfileDrawer;
