import { useState, useEffect, useMemo } from 'react';

// Data
import { PHASE_COLOR, getMeso, getWeekPhase, getWeekRir } from '../../data/constants';
import { tokens } from '../../styles/tokens';

// Utils
import {
  store,
  getWorkoutDaysForWeek,
  setSkipped,
  saveProfile,
} from '../../utils/store';
import { on } from '../../utils/events';
import { useAuth } from '../../contexts/AuthContext';

// Shared UI
import Modal from '../ui/Modal';
import Button from '../ui/Button';

// Sub-components
import HomeTab from './HomeTab';
import ScheduleTab, { type NoteViewerData } from './ScheduleTab';
import ProgressTab from './ProgressTab';
import MesoOverview from './MesoOverview';
import AnalyticsView from '../analytics/AnalyticsView';
import ExplorePage from '../explore/ExplorePage';
import { PricingPage } from '../settings/PricingPage';
import ShareMesoModal from '../social/ShareMesoModal';
import JoinMesoFlow from '../social/JoinMesoFlow';
import type { Profile, TrainingDay } from '../../types';

interface HomeViewProps {
  tabRef: React.MutableRefObject<((key: string) => void) | null>;
  currentWeek: number;
  setCurrentWeek: (v: number) => void;
  onSelectDay: (v: number) => void;
  onSelectDayWeek: (dayIdx: number, weekIdx: number) => void;
  onOpenExtra: (v: string) => void;
  onOpenCardio: (dateStr: string, protocolId?: string | null) => void;
  onOpenMobility: (v: string) => void;
  completedDays: Set<string>;
  onReset: () => void;
  activeDays: TrainingDay[];
  profile: Profile;
  openWeekly: boolean;
  onOpenWeeklyHandled: () => void;
  onProfileUpdate: (v: Profile) => void;
}

function HomeView({
  tabRef,
  currentWeek,
  setCurrentWeek,
  onSelectDay,
  onSelectDayWeek,
  onOpenExtra,
  onOpenCardio,
  onOpenMobility,
  completedDays,
  onReset,
  activeDays,
  profile,
  openWeekly,
  onOpenWeeklyHandled,
  onProfileUpdate,
}: HomeViewProps) {
  // ── Tab navigation ─────────────────────────────────────────────────────
  const [tab, setTab] = useState('landing');
  const goTo = (key: string | number) => {
    setTab(String(key));
    window.scrollTo(0, 0);
  };
  const goBack = () => {
    setTab('landing');
    window.scrollTo(0, 0);
  };
  if (tabRef) tabRef.current = goTo;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (openWeekly) {
      setTab('weekly');
      window.scrollTo(0, 0);
      if (onOpenWeeklyHandled) onOpenWeeklyHandled();
    }
  }, [openWeekly]);

  // ── Auth ────────────────────────────────────────────────────────────────
  const { user } = useAuth();

  // ── Overlay / modal state ───────────────────────────────────────────────
  const [showReset, setShowReset] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Allow pricing modal to be triggered from anywhere via custom event
  useEffect(() => {
    const unsub = on('foundry:showPricing', () => setShowPricing(true));
    return unsub;
  }, []);
  const [showSkipConfirm, setShowSkipConfirm] = useState<{ dayIdx: number; weekIdx: number } | null>(null);
  const [skipVersion, setSkipVersion] = useState(0);
  const [addWorkoutModal, setAddWorkoutModal] = useState<string | null>(null);
  const [addWorkoutStep, setAddWorkoutStep] = useState('type');
  const [_addWorkoutType, setAddWorkoutType] = useState<string | null>(null);
  const [_addWorkoutDayType, setAddWorkoutDayType] = useState<string | null>(null);

  // ── Schedule tab state ──────────────────────────────────────────────────
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [showRestDay, setShowRestDay] = useState<{ dateStr: string; isPast?: boolean } | null>(null);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [noteViewer, setNoteViewer] = useState<NoteViewerData | null>(null);

  // ── Home tab UI state ───────────────────────────────────────────────────
  const [showNextSession, setShowNextSession] = useState(true);
  const [showMorningMobility, setShowMorningMobility] = useState(true);
  const [showRecoveryMorning, setShowRecoveryMorning] = useState(false);
  const [showRecoveryTag, setShowRecoveryTag] = useState(false);

  // ── Derived / computed values ───────────────────────────────────────────

  // Active workout detection
  const hasActiveWorkout = useMemo(() => {
    for (let w = 0; w <= getMeso().weeks; w++) {
      for (let d = 0; d < getMeso().days; d++) {
        const start = store.get(`foundry:sessionStart:d${d}:w${w}`);
        const done = store.get(`foundry:done:d${d}:w${w}`);
        if (start && done !== '1') return true;
      }
    }
    for (let i = 0; i < 14; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const dateStr = dt.toISOString().slice(0, 10);
      const start = store.get(`foundry:extra:start:${dateStr}`);
      const done = store.get(`foundry:extra:done:${dateStr}`);
      if (start && done !== '1') return true;
    }
    return false;
  }, [tab]);

  const activeWeek = useMemo(() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_, i) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks;
  }, [completedDays, activeDays]);

  const calendarWeek = useMemo(() => {
    const startDate = profile?.startDate ? new Date(profile.startDate + 'T00:00:00') : null;
    if (!startDate || activeDays.length === 0) return activeWeek;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let lastWk = 0,
      sessionCount = 0;
    let cursor = new Date(startDate);
    const total = (getMeso().weeks + 1) * activeDays.length;
    for (let d = 0; d < 400 && sessionCount < total; d++) {
      const wkIdx = Math.floor(sessionCount / activeDays.length);
      const curWkDays = getWorkoutDaysForWeek(profile, wkIdx);
      const key = cursor.toISOString().slice(0, 10);
      if (curWkDays.includes(cursor.getDay())) {
        if (key <= todayStr) lastWk = wkIdx;
        sessionCount++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return lastWk;
  }, [profile, activeDays, activeWeek]);

  const displayWeek = Math.min(activeWeek, calendarWeek);

  const phase = getWeekPhase()[Math.min(displayWeek, getMeso().weeks - 1)] || 'Deload';
  const pc = (PHASE_COLOR as Record<string, string>)[phase];
  const rir = getWeekRir()[Math.min(displayWeek, getMeso().weeks - 1)] || 'N/A';

  const weekDone = activeDays.filter((_, i) => completedDays.has(`${i}:${displayWeek}`)).length;
  const weekTotal = activeDays.length;
  const weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  const totalSessions = getMeso().weeks * getMeso().days;
  const doneSessions = completedDays.size;
  const mesoPct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;

  // ── Add Workout Modal ───────────────────────────────────────────────────

  const generateExtraWorkout = (dayTypeId: string) => ({
    label: dayTypeId,
    exercises: [],
  });

  const AddWorkoutModal = () => {
    if (!addWorkoutModal) return null;
    const dateStr = addWorkoutModal;
    const splitType = profile?.splitType || 'ppl';
    const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    const dayTypeOptions =
      splitType === 'ppl'
        ? [
            { id: 'push', label: 'Push', desc: 'Chest · Shoulders · Triceps' },
            { id: 'pull', label: 'Pull', desc: 'Back · Biceps · Rear Delts' },
            { id: 'legs', label: 'Legs', desc: 'Quads · Hamstrings · Glutes' },
            {
              id: 'fullbody',
              label: 'Full Body',
              desc: 'Full compound session',
            },
          ]
        : splitType === 'upper_lower'
          ? [
              {
                id: 'upper',
                label: 'Upper Body',
                desc: 'Chest · Back · Shoulders · Arms',
              },
              {
                id: 'lower',
                label: 'Lower Body',
                desc: 'Quads · Hamstrings · Glutes',
              },
              {
                id: 'fullbody',
                label: 'Full Body',
                desc: 'Full compound session',
              },
            ]
          : [
              {
                id: 'fullbody',
                label: 'Full Body',
                desc: 'Full compound session',
              },
              {
                id: 'push',
                label: 'Push Focus',
                desc: 'Chest · Shoulders · Triceps',
              },
              {
                id: 'pull',
                label: 'Pull Focus',
                desc: 'Back · Biceps · Rear Delts',
              },
              {
                id: 'legs',
                label: 'Legs Focus',
                desc: 'Quads · Hamstrings · Glutes',
              },
            ];

    const closeModal = () => {
      setAddWorkoutModal(null);
      setAddWorkoutStep('type');
      setAddWorkoutType(null);
      setAddWorkoutDayType(null);
    };

    const handleFoundryBuild = (dayTypeId: string) => {
      const day = generateExtraWorkout(dayTypeId);
      store.set(`foundry:extra:${dateStr}`, JSON.stringify(day));
      closeModal();
      onOpenExtra(dateStr);
    };

    return (
      <Modal open={!!addWorkoutModal} onClose={closeModal} maxWidth={340} zIndex={500} blur>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          ADD WORKOUT
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {dateLabel}
        </div>

        {addWorkoutStep === 'type' && (
          <>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 22,
              }}
            >
              How do you want to set up this session?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  setAddWorkoutType('foundry');
                  setAddWorkoutStep('daytype');
                }}
                style={{
                  padding: '16px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'var(--accent)11',
                  border: '1px solid var(--accent)55',
                  color: 'var(--text-primary)',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--accent)',
                    marginBottom: 2,
                  }}
                >
                  {' '}
                  Foundry Build
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Auto-generate a workout based on your equipment and level
                </div>
              </button>
              <button
                onClick={() => {
                  store.set(
                    `foundry:extra:${dateStr}`,
                    JSON.stringify({
                      isExtra: true,
                      isManual: true,
                      label: 'Manual Session',
                      exercises: [],
                      dateStr,
                    })
                  );
                  closeModal();
                  onOpenExtra(dateStr);
                }}
                style={{
                  padding: '16px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Manual</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Log a workout your own way — freeform notes
                </div>
              </button>
            </div>
            <Button variant="ghost" onClick={closeModal} fullWidth style={{ marginTop: 12 }}>
              Cancel
            </Button>
          </>
        )}

        {addWorkoutStep === 'daytype' && (
          <>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 18,
              }}
            >
              What kind of session?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleFoundryBuild(opt.id)}
                  style={{
                    padding: '13px 16px',
                    borderRadius: tokens.radius.lg,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.label}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}
                    >
                      {opt.desc}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setAddWorkoutStep('type')}
              fullWidth
              style={{ marginTop: 12 }}
            >
              ← Back
            </Button>
          </>
        )}
      </Modal>
    );
  };

  // ── Reset dialog ────────────────────────────────────────────────────────
  const ResetDialog = () => (
    <Modal open={showReset} onClose={() => setShowReset(false)} maxWidth={360} zIndex={100}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          Reset Mesocycle?
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          This will archive your current meso and start fresh. Your data will be saved in history.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={() => setShowReset(false)} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowReset(false);
              onReset();
            }}
            style={{ flex: 1 }}
          >
            Reset
          </Button>
        </div>
      </div>
    </Modal>
  );

  // ── Bottom tab bar ──────────────────────────────────────────────────────
  const MAIN_TABS = [
    {
      key: 'landing',
      label: 'Home',
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--accent)' : '#A89A8A'}
          strokeWidth={active ? 2.5 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          <polyline points="9 21 9 12 15 12 15 21" />
        </svg>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--accent)' : '#A89A8A'}
          strokeWidth={active ? 2.5 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--accent)' : '#A89A8A'}
          strokeWidth={active ? 2.5 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      ),
    },
    {
      key: 'explore',
      label: 'Explore',
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? 'var(--accent)' : '#A89A8A'}
          strokeWidth={active ? 2.5 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 140 }}>
      {/* Global overlays */}
      {showReset && <ResetDialog />}
      <AddWorkoutModal />
      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
      <ShareMesoModal open={showShare} onClose={() => setShowShare(false)} />
      <JoinMesoFlow open={showJoin} onClose={() => setShowJoin(false)} onJoined={() => window.location.reload()} />

      {/* Skip confirm modal */}
      {showSkipConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="skip-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 280,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: '24px',
              maxWidth: 320,
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div
              id="skip-dialog-title"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              Skip today's session?
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              This session will be marked as skipped. You can restore it from the Schedule tab at
              any time.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setSkipped(showSkipConfirm.dayIdx, showSkipConfirm.weekIdx, true);
                  setSkipVersion((v) => v + 1);
                  setShowSkipConfirm(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Skip It
              </button>
              <button
                onClick={() => setShowSkipConfirm(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Keep It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab content ── */}
      {tab === 'landing' && (
        <>
          <HomeTab
            profile={profile}
            activeDays={activeDays}
            completedDays={completedDays}
            activeWeek={activeWeek}
            displayWeek={displayWeek}
            phase={phase}
            pc={pc}
            rir={rir}
            weekDone={weekDone}
            weekTotal={weekTotal}
            weekPct={weekPct}
            mesoPct={mesoPct}
            doneSessions={doneSessions}
            totalSessions={totalSessions}
            showRecoveryMorning={showRecoveryMorning}
            setShowRecoveryMorning={setShowRecoveryMorning}
            showRecoveryTag={showRecoveryTag}
            setShowRecoveryTag={setShowRecoveryTag}
            showNextSession={showNextSession}
            setShowNextSession={setShowNextSession}
            showMorningMobility={showMorningMobility}
            setShowMorningMobility={setShowMorningMobility}
            goTo={goTo}
            goBack={goBack}
            onSelectDayWeek={onSelectDayWeek}
            setShowSkipConfirm={setShowSkipConfirm}
            onOpenCardio={onOpenCardio}
            onOpenMobility={onOpenMobility}
            setShowPricing={setShowPricing}
          />

          {/* Train with Friends */}
          {user && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '0 20px 16px',
              }}
            >
              <Button
                onClick={() => setShowShare(true)}
                variant="secondary"
                style={{ flex: 1, fontSize: 13 }}
              >
                Share Program
              </Button>
              <Button
                onClick={() => setShowJoin(true)}
                variant="secondary"
                style={{ flex: 1, fontSize: 13 }}
              >
                Join a Friend
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'progress' && (
        <ProgressTab
          displayWeek={displayWeek}
          completedDays={completedDays}
          activeDays={activeDays}
          goTo={goTo}
        />
      )}

      {tab === 'analytics' && (
        <AnalyticsView
          completedDays={completedDays}
          activeDays={activeDays}
          goBack={() => goTo('progress')}
        />
      )}

      {tab === 'schedule' && (
        <ScheduleTab
          profile={profile}
          activeDays={activeDays}
          completedDays={completedDays}
          activeWeek={activeWeek}
          currentWeek={currentWeek}
          calendarOffset={calendarOffset}
          setCalendarOffset={setCalendarOffset}
          expandedWeek={expandedWeek}
          setExpandedWeek={setExpandedWeek}
          showRestDay={showRestDay}
          setShowRestDay={setShowRestDay}
          showEditSchedule={showEditSchedule}
          setShowEditSchedule={setShowEditSchedule}
          noteViewer={noteViewer}
          setNoteViewer={setNoteViewer}
          skipVersion={skipVersion}
          setSkipVersion={setSkipVersion}
          goTo={goTo}
          onSelectDay={onSelectDay}
          onSelectDayWeek={onSelectDayWeek}
          onOpenExtra={onOpenExtra}
          onOpenCardio={onOpenCardio}
          setCurrentWeek={setCurrentWeek}
          onProfileUpdate={onProfileUpdate}
          setAddWorkoutModal={setAddWorkoutModal}
          setAddWorkoutStep={setAddWorkoutStep}
          setAddWorkoutType={setAddWorkoutType}
          setAddWorkoutDayType={setAddWorkoutDayType}
        />
      )}

      {['overview', 'history', 'weekly'].includes(tab) && (
        <MesoOverview
          tab={tab}
          goBack={goBack}
          goTo={goTo}
          activeDays={activeDays}
          completedDays={completedDays}
          profile={profile}
        />
      )}

      {tab === 'explore' && (
        <ExplorePage
          profile={profile as unknown as Record<string, unknown> | null}
          onStartProgram={(newProfile) => {
            saveProfile(newProfile as unknown as Profile);
            window.location.reload();
          }}
        />
      )}

      {/* ── Bottom tab bar ── */}
      {['landing', 'progress', 'schedule', 'explore'].includes(tab) && (
        <nav
          role="tablist"
          aria-label="Main navigation"
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 480,
            zIndex: 100,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'stretch',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {MAIN_TABS.map(({ key, label, icon }) => {
            const active = tab === key;
            const showDot = key === 'landing' && hasActiveWorkout;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                aria-label={label}
                onClick={() => goTo(key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '10px 0 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                data-tour={
                  key === 'schedule'
                    ? 'nav-schedule'
                    : key === 'progress'
                      ? 'nav-progress'
                      : undefined
                }
              >
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  {icon(active)}
                  {showDot && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -1,
                        right: -3,
                        width: 7,
                        height: 7,
                        borderRadius: tokens.radius.full,
                        background: 'var(--phase-peak)',
                        boxShadow: '0 0 5px var(--phase-peak)',
                        animation: 'livePulse 1.6s ease-in-out infinite',
                        border: '1.5px solid var(--bg-card)',
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: '0.04em',
                    color: active ? 'var(--accent)' : '#A89A8A',
                    transition: 'color 0.15s',
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default HomeView;
