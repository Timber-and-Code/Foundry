import React, { Suspense, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../../contexts/AuthContext';
import { store, resolveAccountTier } from '../../utils/store';
import { emit } from '../../utils/events';
import { archiveMesocycleRemote } from '../../utils/sync';
import { getMeso } from '../../data/constants';
import type { Profile, WorkoutSet, TrainingDay } from '../../types';

const AccountSection = React.lazy(() => import('../auth/UserMenu'));
const SaveProgressSheet = React.lazy(() => import('../auth/SaveProgressSheet'));
const AboutModal = React.lazy(() => import('./AboutModal'));

const FOUNDRY_AI_WORKER_URL = import.meta.env.VITE_FOUNDRY_AI_WORKER_URL;
const FOUNDRY_APP_KEY = import.meta.env.VITE_FOUNDRY_APP_KEY;
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

const SPLIT_LABELS: Record<string, string> = {
  ppl: 'Push / Pull / Legs',
  upper_lower: 'Upper / Lower',
  full_body: 'Full Body',
  push_pull: 'Push / Pull',
};

interface ProfileDrawerProps {
  saved: Profile;
  onClose: () => void;
  onSave: (data: Partial<Profile>) => void;
}

export function ProfileDrawer({ saved, onClose, onSave }: ProfileDrawerProps) {
  const { logout, user } = useAuth();
  const [weight, setWeight] = useState(saved.weight || '');
  const [editingWeight, setEditingWeight] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSyncSheet, setShowSyncSheet] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  // ── Meso context ──────────────────────────────────────────────────────────
  const meso = (() => {
    try { return getMeso(); } catch { /* no active meso */ return null; }
  })();
  const currentWeek = parseInt(store.get('foundry:currentWeek') || '0');
  const totalWeeks = meso?.weeks || saved.mesoLength || null;
  const phase = meso?.phases?.[currentWeek] || '';
  const splitLabel = (() => {
    // Derive from actual day tags in the stored program (most accurate)
    try {
      const raw = store.get('foundry:storedProgram');
      if (raw) {
        const days = JSON.parse(raw);
        const tags = [...new Set(days.map((d: TrainingDay) => d.tag).filter(Boolean))];
        if (tags.length > 0) return tags.join(' / ');
      }
    } catch { /* JSON parse fallback */ }
    const st = meso?.splitType || saved.splitType || '';
    return SPLIT_LABELS[st] || st.toUpperCase().replace(/_/g, ' ');
  })();

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

  // ── Reset helpers ─────────────────────────────────────────────────────────
  const deleteCurrentMeso = async () => {
    // Mark the meso as abandoned in Supabase and clear active_meso_id
    // BEFORE wiping localStorage, so the remote pointer is gone first.
    await archiveMesocycleRemote();

    const fixedKeys = [
      'foundry:profile',
      'foundry:completedDays',
      'foundry:currentWeek',
      'foundry:storedProgram',
      'foundry:ts:foundry:profile',
      'foundry:ts:foundry:completedDays',
      'foundry:ts:foundry:currentWeek',
    ];
    fixedKeys.forEach((k) => store.remove(k));
    const dynamicKeys = store.keys('foundry:').filter((k) =>
      k.startsWith('foundry:completedSets:') ||
      k.startsWith('foundry:setLog:') ||
      k.startsWith('foundry:skipped:') ||
      k.startsWith('foundry:sessionNotes:') ||
      k.startsWith('foundry:exerciseNotes:')
    );
    dynamicKeys.forEach((k) => store.remove(k));
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

  const handleDeleteCurrentMeso = () => {
    if (!window.confirm('Delete your current meso? Your profile, workout history from prior cycles, and past cycle carryover will be preserved. You\'ll be taken to the meso builder to rebuild.')) return;
    if (!window.confirm('Are you sure? All progress in your current meso — sets, completions, notes — will be permanently deleted.')) return;
    deleteCurrentMeso();
  };

  const handleDeleteAllFoundryData = () => {
    if (!window.confirm('Delete ALL Foundry data on this device? This wipes your profile, active meso, and all workout history from this device.')) return;
    if (!window.confirm('Are you REALLY sure? You\'ll also be signed out. Your Supabase account and its data are preserved — signing in again will restore everything.')) return;
    if (!window.confirm('Last chance. This cannot be undone without signing back in. Continue?')) return;
    deleteAllFoundryData();
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
            </div>
          </div>

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
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Week {currentWeek + 1} of {totalWeeks}{totalWeeks && ` (${totalWeeks - 1} + Deload)`}
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

          {/* Body weight — tap to edit */}
          <div
            style={{
              ...fieldRowStyle,
              cursor: 'pointer',
            }}
            onClick={() => !editingWeight && setEditingWeight(true)}
          >
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Body Weight</span>
            {editingWeight ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
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
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 6px',
                    textAlign: 'right',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>lbs</span>
              </div>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                {saved.weight ? `${saved.weight} lbs` : 'Tap to set'}
              </span>
            )}
          </div>
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
              { label: 'Sessions', value: String(stats.sessions) },
              { label: 'Working Sets', value: String(stats.totalSets) },
              { label: 'Streak', value: String(stats.streak) },
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
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 5, letterSpacing: '0.06em' }}>
                  {label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Account */}
          {divider}
          {sectionLabel('ACCOUNT')}
          <Suspense fallback={null}>
            <AccountSection />
          </Suspense>

          {/* Sync across devices — always available for anonymous users */}
          {!user && (
            <button
              type="button"
              onClick={() => setShowSyncSheet(true)}
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

          {/* Foundry Pro / Tier Status */}
          {divider}
          {(() => {
            const tierResult = resolveAccountTier(saved);
            if (tierResult.qualifiesForFree) {
              const reasonLabel = tierResult.reason === 'student' ? 'Student'
                : tierResult.reason === 'under_18' ? 'Under 18'
                : tierResult.reason === 'senior' ? '62+' : '';
              return (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: tokens.radius.xl,
                    border: '1px solid var(--phase-accum)44',
                    background: 'var(--phase-accum)08',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--phase-accum)', letterSpacing: '0.04em' }}>
                      Free Tier
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                      color: 'var(--phase-accum)', background: 'var(--phase-accum)22',
                      border: '1px solid var(--phase-accum)44', borderRadius: tokens.radius.sm,
                      padding: '1px 6px',
                    }}>
                      {reasonLabel.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 3, display: 'block' }}>
                    {tierResult.reason === 'student'
                      ? `Verified via ${saved.studentEmail || '.edu email'}`
                      : `The Foundry is permanently free for ${reasonLabel.toLowerCase()} users`}
                  </span>
                </div>
              );
            }
            return null;
          })()}
          {!resolveAccountTier(saved).qualifiesForFree && (
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

          {/* Support */}
          {divider}
          {sectionLabel('SUPPORT')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setShowFeedback(true)}
              style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Send Feedback</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Write</span>
            </button>
          </div>

          {/* About */}
          {divider}
          {sectionLabel('ABOUT')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setShowAbout(true)}
              style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>The Foundry</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Read</span>
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
              <button
                onClick={handleDeleteCurrentMeso}
                style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete Current Meso</span>
                <span style={{ fontSize: 13, color: 'var(--warning, #ff9800)', fontWeight: 500 }}>Delete</span>
              </button>
              <button
                onClick={handleDeleteAllFoundryData}
                style={{ ...fieldRowStyle, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-inset)' }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete All Foundry Data</span>
                <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>Delete</span>
              </button>
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

      {/* Sync-across-devices sheet (anonymous users only) */}
      {showSyncSheet && (
        <Suspense fallback={null}>
          <SaveProgressSheet trigger="settings" onDismiss={() => setShowSyncSheet(false)} />
        </Suspense>
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
