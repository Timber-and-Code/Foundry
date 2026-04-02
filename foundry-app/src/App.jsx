import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// Data
import { PHASE_COLOR, getMeso, getWeekPhase, buildMesoConfig, resetMesoCache } from './data/constants';
import { EXERCISE_DB } from './data/exercises';

// Utils
import { migrateKeys } from './utils/storage';
import { store, loadProfile, saveProfile, loadCompleted, markComplete, loadCurrentWeek, saveCurrentWeek, snapshotData, resetMeso, archiveCurrentMeso } from './utils/store';

// Run key migration before any reads (ppl: → foundry:)
migrateKeys();
import { generateProgram } from './utils/program';
import { parseRestSeconds, haptic } from './utils/helpers';

// Components
import FoundryBanner from './components/shared/FoundryBanner';

const OnboardingFlow = React.lazy(() => import('./components/onboarding/OnboardingFlow'));
const HomeView = React.lazy(() => import('./components/home/HomeView'));
const NoMesoShell = React.lazy(() => import('./components/home/NoMesoShell'));
const DayView = React.lazy(() => import('./components/workout/DayView'));
const ExtraDayView = React.lazy(() => import('./components/workout/ExtraDayView'));
const CardioSessionView = React.lazy(() => import('./components/workout/CardioSessionView'));
const MobilitySessionView = React.lazy(() => import('./components/workout/MobilitySessionView'));
const TourOverlay = React.lazy(() => import('./components/tour/TourOverlay'));
const ProfileDrawer = React.lazy(() => import('./components/settings/SettingsView'));
const SetupPage = React.lazy(() => import('./components/setup/SetupPage'));

// ─── ERROR BOUNDARY ─────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const errMsg = this.state.error?.message || String(this.state.error);
    const errStack = this.state.error?.stack || "";
    const compStack = this.state.info?.componentStack || "";
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg-root)", color: "var(--text-primary)",
        fontFamily: "'Inter',system-ui,sans-serif", maxWidth: 480, margin: "0 auto",
        padding: 24, display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16 }}>
          <span style={{ fontSize: 28 }}>💥</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Something went wrong</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>The Foundry hit an unexpected error</div>
          </div>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--phase-peak)", marginBottom: 8 }}>ERROR</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word", fontFamily: "monospace" }}>{errMsg}</div>
        </div>
        {import.meta.env.DEV ? (
          <>
            {errStack && (
              <div style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", maxHeight: 220, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>STACK TRACE</div>
                <pre style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", lineHeight: 1.5 }}>{errStack}</pre>
              </div>
            )}
            {compStack && (
              <div style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", maxHeight: 160, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>COMPONENT STACK</div>
                <pre style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", lineHeight: 1.5 }}>{compStack}</pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
            Something went wrong. Please reload the app.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={() => window.location.reload()} className="btn-primary"
            style={{ flex: 1, padding: "13px", borderRadius: 6, fontSize: 14, fontWeight: 700, background: "var(--btn-primary-bg)", border: "1px solid var(--btn-primary-border)", color: "var(--btn-primary-text)" }}>
            Reload App
          </button>
          <button onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{ flex: 1, padding: "13px", borderRadius: 6, fontSize: 14, fontWeight: 700, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}>
            Try Again
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
          If this keeps happening, try clearing your data and restarting.
        </div>
      </div>
    );
  }
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [view, setView] = useState("home");
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(loadCurrentWeek);
  const [completedDays, setCompletedDays] = useState(() => loadCompleted(getMeso()));
  const [onboarded, setOnboarded] = useState(() => !!store.get("foundry:onboarded"));
  const [weekCompleteModal, setWeekCompleteModal] = useState(null);
  const [openWeekly, setOpenWeekly] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedExtraDate, setSelectedExtraDate] = useState(null);
  const [selectedCardioDate, setSelectedCardioDate] = useState(null);
  const [selectedCardioProtocol, setSelectedCardioProtocol] = useState(null);
  const [selectedMobilityDate, setSelectedMobilityDate] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const homeTabRef = useRef(null);

  // ── Global rest timer ──
  const [restTimer, setRestTimer] = useState(null);
  const [restTimerMinimized, setRestTimerMinimized] = useState(false);
  const restIntervalRef = useRef(null);
  const restEndTimeRef = useRef(null);
  const timerDayRef = useRef(null);

  const fireTimerComplete = useCallback(() => {
    try { haptic("done"); } catch {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  const startRestTimer = useCallback((restStr, exName, dayIdx, weekIdx) => {
    const secs = parseRestSeconds(restStr);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    const endTime = Date.now() + secs * 1000;
    restEndTimeRef.current = endTime;
    if (dayIdx !== undefined) timerDayRef.current = { dayIdx, weekIdx };
    setRestTimerMinimized(false);
    setRestTimer({ remaining: secs, total: secs, exName });
    restIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      setRestTimer(prev => {
        if (!prev) { clearInterval(restIntervalRef.current); return null; }
        if (remaining <= 0) {
          clearInterval(restIntervalRef.current);
          fireTimerComplete();
          return { ...prev, remaining: 0 };
        }
        return { ...prev, remaining };
      });
    }, 500);
  }, [fireTimerComplete]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && restEndTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        setRestTimer(prev => {
          if (!prev) return null;
          if (remaining <= 0) {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            fireTimerComplete();
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining };
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fireTimerComplete]);

  const dismissRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restEndTimeRef.current = null;
    timerDayRef.current = null;
    setRestTimer(null);
    setRestTimerMinimized(false);
  }, []);

  // Listen for cardio open requests from DayView
  useEffect(() => {
    const handler = (e) => {
      const { dateStr, protocolId } = e.detail || {};
      if (dateStr) {
        setSelectedCardioDate(dateStr);
        setSelectedCardioProtocol(protocolId || null);
        setView("cardio");
      }
    };
    window.addEventListener("foundry:openCardio", handler);
    return () => window.removeEventListener("foundry:openCardio", handler);
  }, []);

  // Show tour once after first program generated
  useEffect(() => {
    if (store.get("foundry:show_tour") === "1" && !store.get("foundry:toured")) {
      store.remove ? store.remove("foundry:show_tour") : localStorage.removeItem("foundry:show_tour");
      setTimeout(() => setShowTour(true), 800);
    }
  }, []);

  // ── Onboarding gate ──
  // Early returns use React.lazy components — must wrap in Suspense
  const suspenseFallback = <div style={{minHeight:'100vh',background:'#141414',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#e5e5e5',fontSize:14}}>Loading...</div></div>;

  if (!profile && !onboarded) {
    return <React.Suspense fallback={suspenseFallback}><OnboardingFlow onDone={() => { setOnboarded(true); setShowSetup(true); }} /></React.Suspense>;
  }

  if (!profile && !showSetup) {
    return <React.Suspense fallback={suspenseFallback}><NoMesoShell onSetup={() => setShowSetup(true)} onStartProgram={newProfile => { saveProfile(newProfile); window.location.reload(); }} /></React.Suspense>;
  }

  if (!profile) {
    return <React.Suspense fallback={suspenseFallback}><SetupPage onComplete={p => {
      saveProfile(p);
      localStorage.removeItem('foundry:storedProgram');
      if (!store.get("foundry:toured")) store.set("foundry:show_tour", "1");
      window.location.reload();
    }} /></React.Suspense>;
  }

  // ── Completion handler ──
  const handleComplete = (dayIdx, weekIdx) => {
    markComplete(dayIdx, weekIdx);
    const newCompleted = new Set([...completedDays, `${dayIdx}:${weekIdx}`]);
    setCompletedDays(newCompleted);

    const weekFinished = Array.from({ length: getMeso().days }, (_, d) => d)
      .every(d => newCompleted.has(`${d}:${weekIdx}`));

    if (weekFinished) {
      snapshotData();
      let totalSets = 0;
      const _storedProg = store.get('foundry:storedProgram');
      const prog = (_storedProg ? JSON.parse(_storedProg) : generateProgram(loadProfile())).slice(0, getMeso().days);
      const bw = parseFloat(loadProfile()?.weight || 0);
      let totalVolume = 0;
      let prCount = 0;

      prog.forEach((day, d) => {
        const raw = store.get(`foundry:day${d}:week${weekIdx}`);
        if (!raw) return;
        try {
          const wd = JSON.parse(raw);
          day.exercises.forEach((ex, exIdx) => {
            const exData = wd[exIdx] || {};
            let thisBest = 0;
            Object.values(exData).forEach(s => {
              if (!s || !s.reps || s.reps === "" || s.repsSuggested) return;
              totalSets++;
              const w = parseFloat(s.weight || 0);
              const r = parseInt(s.reps);
              if (!r) return;
              const eff = ex.bw ? (bw + w) : w;
              totalVolume += eff * r;
              if (eff * r > thisBest) thisBest = eff * r;
            });
            let priorBest = 0;
            for (let pw = 0; pw < weekIdx; pw++) {
              const pr = store.get(`foundry:day${d}:week${pw}`);
              if (!pr) continue;
              try {
                const pwd = JSON.parse(pr);
                Object.values(pwd[exIdx] || {}).forEach(s => {
                  if (!s || !s.reps) return;
                  const w = parseFloat(s.weight || 0);
                  const r = parseInt(s.reps);
                  const eff = ex.bw ? (bw + w) : w;
                  if (eff * r > priorBest) priorBest = eff * r;
                });
              } catch {}
            }
            if (thisBest > priorBest && priorBest > 0) prCount++;
          });
        } catch {}
      });

      const isFinal = weekIdx === getMeso().weeks;

      // Meso retrospective data (isFinal only)
      let mesoAnchorGains = [];
      let mesoTotalVolume = 0;
      let mesoTotalPRs = 0;
      let mesoCompletedSessions = 0;
      const mesoTotalSessions = getMeso().weeks * getMeso().days;

      if (isFinal) {
        for (let w = 0; w < getMeso().weeks; w++) {
          for (let d = 0; d < getMeso().days; d++) {
            if (newCompleted.has(`${d}:${w}`)) mesoCompletedSessions++;
          }
        }
        for (let w = 0; w <= getMeso().weeks; w++) {
          prog.forEach((day, d) => {
            const raw = store.get(`foundry:day${d}:week${w}`);
            if (!raw) return;
            try {
              const wd = JSON.parse(raw);
              day.exercises.forEach((ex, exIdx) => {
                const exData = wd[exIdx] || {};
                let thisBest = 0;
                Object.values(exData).forEach(s => {
                  if (!s || !s.reps) return;
                  const weight = parseFloat(s.weight || 0);
                  const reps = parseInt(s.reps);
                  if (!reps) return;
                  const eff = ex.bw ? (bw + weight) : weight;
                  mesoTotalVolume += eff * reps;
                  if (eff * reps > thisBest) thisBest = eff * reps;
                });
                if (w > 0) {
                  let priorBest = 0;
                  for (let pw = 0; pw < w; pw++) {
                    const pr = store.get(`foundry:day${d}:week${pw}`);
                    if (!pr) continue;
                    try {
                      const pwd = JSON.parse(pr);
                      Object.values(pwd[exIdx] || {}).forEach(s => {
                        if (!s || !s.reps) return;
                        const weight = parseFloat(s.weight || 0);
                        const reps = parseInt(s.reps);
                        const eff = ex.bw ? (bw + weight) : weight;
                        if (eff * reps > priorBest) priorBest = eff * reps;
                      });
                    } catch {}
                  }
                  if (thisBest > priorBest && priorBest > 0) mesoTotalPRs++;
                }
              });
            } catch {}
          });
        }

        // Anchor lift progression
        prog.forEach((day, d) => {
          day.exercises.forEach((ex, exIdx) => {
            if (!ex.anchor) return;
            const w1Raw = store.get(`foundry:day${d}:week0`);
            let w1Best = 0;
            if (w1Raw) {
              try {
                const w1d = JSON.parse(w1Raw);
                Object.values(w1d[exIdx] || {}).forEach(s => {
                  if (!s || !s.weight) return;
                  const w = parseFloat(s.weight);
                  if (w > w1Best) w1Best = w;
                });
              } catch {}
            }
            let peakBest = 0;
            let peakWeek = 0;
            for (let w = 0; w < getMeso().weeks; w++) {
              const raw = store.get(`foundry:day${d}:week${w}`);
              if (!raw) continue;
              try {
                const wd = JSON.parse(raw);
                Object.values(wd[exIdx] || {}).forEach(s => {
                  if (!s || !s.weight) return;
                  const weight = parseFloat(s.weight);
                  if (weight > peakBest) { peakBest = weight; peakWeek = w; }
                });
              } catch {}
            }
            const ovId = store.get(`foundry:exov:d${d}:ex${exIdx}`);
            const dbEx = ovId ? EXERCISE_DB.find(e => e.id === ovId) : null;
            const exName = dbEx ? dbEx.name : ex.name;
            if (w1Best > 0 && peakBest > 0) {
              mesoAnchorGains.push({ name: exName, start: w1Best, peak: peakBest, delta: parseFloat((peakBest - w1Best).toFixed(1)), peakWeek: peakWeek + 1 });
            }
          });
        });
        const seen = new Set();
        mesoAnchorGains = mesoAnchorGains.filter(g => { if (seen.has(g.name)) return false; seen.add(g.name); return true; });
      }

      setWeekCompleteModal({
        weekIdx, sessions: getMeso().days, totalSessions: getMeso().days,
        sets: totalSets, volume: Math.round(totalVolume), prs: prCount, isFinal,
        anchorGains: mesoAnchorGains, mesoTotalVolume: Math.round(mesoTotalVolume),
        mesoTotalPRs, mesoCompletedSessions, mesoTotalSessions,
      });

      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().weeks) {
        setCurrentWeek(nextWeek);
        saveCurrentWeek(nextWeek);
      }
    }
  };

  const handleReset = () => {
    archiveCurrentMeso(profile, { generateProgram, EXERCISE_DB });
    resetMeso();
    localStorage.removeItem("foundry:profile");
    localStorage.removeItem("foundry:storedProgram");
    window.location.reload();
  };

  const handleNextDay = (dayIdx, weekIdx) => {
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx <= getMeso().days - 1) {
      setSelectedDay(nextDayIdx);
    } else {
      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().weeks - 1) {
        setCurrentWeek(nextWeek);
        saveCurrentWeek(nextWeek);
        setSelectedDay(0);
      } else {
        setView("home");
      }
    }
  };

  // Compute active days from profile
  const activeDays = useMemo(() => {
    if (!profile) return [];
    const stored = store.get('foundry:storedProgram');
    const base = stored ? JSON.parse(stored) : (() => {
      const result = generateProgram(profile);
      store.set('foundry:storedProgram', JSON.stringify(result));
      return result;
    })();
    const days = base.slice(0, getMeso().days);
    const added = profile.addedDayExercises || {};
    return days.map((day, dayIdx) => {
      const extraIds = added[dayIdx] || [];
      if (extraIds.length === 0) return day;
      const extraExs = extraIds
        .map(id => EXERCISE_DB.find(e => e.id === id))
        .filter(Boolean)
        .map(e => ({
          id: e.id, name: e.name, muscle: e.muscle, muscles: e.muscles,
          equipment: e.equipment, tag: e.tag, anchor: false,
          sets: e.sets, reps: e.reps, rest: e.rest, warmup: "1 feeler set",
          progression: e.pattern === "isolation" ? "reps" : "weight",
          description: e.description || "", videoUrl: e.videoUrl || "",
          bw: !!e.bw, addedMidMeso: true,
        }));
      return { ...day, exercises: [...day.exercises, ...extraExs] };
    });
  }, [profile]);

  const activeWeek = (() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_, i) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks;
  })();

  const handleProfileUpdate = (updates) => {
    if ('split' in updates || 'days' in updates) {
      localStorage.removeItem('foundry:storedProgram');
    }
    const updated = { ...profile, ...updates };
    setProfile(updated);
    saveProfile(updated);
  };

  return (
    <React.Suspense fallback={<div style={{minHeight:'100vh',background:'#141414',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#e5e5e5',fontSize:14}}>Loading...</div></div>}>
      <div style={{ minHeight: "100vh", background: "var(--bg-root)", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif", maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
          <FoundryBanner
            subtitle={`${profile.name ? profile.name.toUpperCase() + " · " : ""}${getMeso().weeks}WK ${(getMeso().splitType || "ppl").toUpperCase().replace(/_/g, " ")} · WEEK ${activeWeek + 1}`}
            onProfileTap={view === "home" ? () => setShowProfileDrawer(true) : undefined}
          />
        </div>

        {/* Profile Drawer */}
        {showProfileDrawer && (() => {
          const raw = store.get("foundry:profile");
          const saved = raw ? JSON.parse(raw) : {};
          return (
            <ProfileDrawer
              saved={saved}
              onClose={() => setShowProfileDrawer(false)}
              onSave={(updated) => {
                store.set("foundry:profile", JSON.stringify(updated));
                setProfile(updated);
              }}
            />
          );
        })()}

        {/* Week Complete Modal */}
        {weekCompleteModal && (
          <WeekCompleteModal
            modal={weekCompleteModal}
            profile={profile}
            onDismiss={() => setWeekCompleteModal(null)}
            onViewSummary={() => { setWeekCompleteModal(null); setOpenWeekly(true); setView("home"); }}
            onReset={() => { setWeekCompleteModal(null); handleReset(); }}
          />
        )}

        {/* Views */}
        {view === "home" && (
          <HomeView
            tabRef={homeTabRef}
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            onSelectDay={i => { setSelectedDay(i); setView("day"); }}
            onSelectDayWeek={(dayIdx, weekIdx) => { setCurrentWeek(weekIdx); setSelectedDay(dayIdx); setView("day"); }}
            onOpenExtra={(dateStr) => { setSelectedExtraDate(dateStr); setView("extra"); }}
            onOpenCardio={(dateStr, protocolId) => { setSelectedCardioDate(dateStr); setSelectedCardioProtocol(protocolId || null); setView("cardio"); }}
            onOpenMobility={(dateStr) => { setSelectedMobilityDate(dateStr); setView("mobility"); }}
            completedDays={completedDays}
            profile={profile}
            activeDays={activeDays}
            onReset={handleReset}
            openWeekly={openWeekly}
            onOpenWeeklyHandled={() => setOpenWeekly(false)}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {view === "day" && selectedDay !== null && (
          <DayView
            dayIdx={selectedDay} weekIdx={currentWeek}
            onBack={() => { window.scrollTo(0, 0); setView("home"); }}
            onComplete={handleComplete} onNextDay={handleNextDay}
            completedDays={completedDays} profile={profile} activeDays={activeDays}
            onProfileUpdate={handleProfileUpdate}
            restTimer={restTimer} restTimerMinimized={restTimerMinimized}
            setRestTimerMinimized={setRestTimerMinimized}
            startRestTimer={startRestTimer} dismissRestTimer={dismissRestTimer}
          />
        )}

        {view === "extra" && selectedExtraDate && (
          <ExtraDayView
            dateStr={selectedExtraDate} profile={profile} activeDays={activeDays}
            onBack={() => { window.scrollTo(0, 0); setView("home"); setSelectedExtraDate(null); }}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {view === "cardio" && selectedCardioDate && (
          <CardioSessionView
            dateStr={selectedCardioDate} plannedProtocolId={selectedCardioProtocol} profile={profile}
            onBack={() => { window.scrollTo(0, 0); setView("home"); setSelectedCardioDate(null); setSelectedCardioProtocol(null); }}
          />
        )}

        {view === "mobility" && selectedMobilityDate && (
          <MobilitySessionView
            dateStr={selectedMobilityDate} profile={profile}
            onBack={() => { window.scrollTo(0, 0); setView("home"); setSelectedMobilityDate(null); }}
          />
        )}

        {showTour && (
          <TourOverlay
            onDone={() => setShowTour(false)}
            onNavigate={setView}
            onTabChange={(tab) => homeTabRef.current && homeTabRef.current(tab)}
          />
        )}

        {/* Global minimized timer bar */}
        {restTimer && restTimerMinimized && <MinimizedTimerBar
          restTimer={restTimer}
          onTap={(done) => {
            if (done) { dismissRestTimer(); return; }
            const ref = timerDayRef.current;
            if (ref) { setCurrentWeek(ref.weekIdx); setSelectedDay(ref.dayIdx); setView("day"); }
            setRestTimerMinimized(false);
          }}
        />}
      </div>
    </React.Suspense>
  );
}

// ── Minimized Timer Bar (extracted for readability) ──
function MinimizedTimerBar({ restTimer, onTap }) {
  const { remaining, total, exName } = restTimer;
  const pct = total > 0 ? remaining / total : 0;
  const done = remaining === 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${String(secs).padStart(2, '0')}`;
  const barColor = done ? 'var(--phase-accum)' : pct > 0.15 ? '#D4A03C' : '#a03333';
  const barPct = total > 0 ? (1 - pct) : 1;

  return (
    <div onClick={() => onTap(done)} style={{
      position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 500,
      background: barColor, borderTop: `3px solid ${barColor}`,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      cursor: 'pointer', userSelect: 'none', maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct * 100}%`, background: 'rgba(0,0,0,0.22)', transition: 'width 1s linear' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'rgba(0,0,0,0.8)', fontVariantNumeric: 'tabular-nums', minWidth: 54, lineHeight: 1 }}>
            {done ? 'GO!' : timeStr}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.75)', lineHeight: 1 }}>{done ? 'Rest complete' : 'Resting'}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: 1 }}>{exName}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.7)', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 6, padding: '7px 12px', whiteSpace: 'nowrap' }}>
          {done ? 'DISMISS ✓' : 'RETURN ↑'}
        </div>
      </div>
    </div>
  );
}

// ── Week Complete Modal (extracted for readability) ──
function WeekCompleteModal({ modal, profile, onDismiss, onViewSummary, onReset }) {
  if (modal.isFinal) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid rgba(212,152,60,0.33)", borderRadius: 12, padding: "28px 24px 24px", width: "100%", maxWidth: 400, boxShadow: "0 32px 80px rgba(0,0,0,0.85)", margin: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: 8 }}>MESO COMPLETE</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 6 }}>
              {profile?.name ? `${profile.name} — ` : ""}{getMeso().weeks} Weeks. Done.
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {modal.mesoCompletedSessions}/{modal.mesoTotalSessions} sessions completed
            </div>
          </div>

          {modal.anchorGains?.length > 0 && (
            <div style={{ background: "var(--bg-deep)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(212,152,60,0.05)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--phase-peak)" }}>STRENGTH GAINED</div>
              </div>
              <div style={{ padding: "6px 0" }}>
                {modal.anchorGains.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < modal.anchorGains.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{g.start} lbs → {g.peak} lbs</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, marginLeft: 12, color: g.delta > 0 ? "var(--phase-accum)" : "var(--text-muted)" }}>
                      {g.delta > 0 ? `+${g.delta}` : g.delta === 0 ? "—" : g.delta} lbs
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
            {[
              { label: "SESSIONS", value: `${modal.mesoCompletedSessions}/${modal.mesoTotalSessions}` },
              { label: "TOTAL PRs", value: modal.mesoTotalPRs },
              { label: "VOLUME", value: modal.mesoTotalVolume >= 1000 ? `${(modal.mesoTotalVolume / 1000).toFixed(0)}k` : modal.mesoTotalVolume, unit: "lbs" },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ background: "var(--bg-deep)", borderRadius: 8, border: "1px solid var(--border)", padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--phase-peak)", lineHeight: 1 }}>{value}</div>
                {unit && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{unit}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", color: "var(--phase-accum)", marginBottom: 5 }}>WHAT HAPPENS NEXT</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Fatigue from this block clears in 3–5 days. Your first session of meso 2 will feel stronger than your last peak week — that's supercompensation. Start Week 1 conservatively at ~85% of your peak weights.
              </div>
            </div>
            <button onClick={onReset} className="btn-primary" style={{ width: "100%", padding: "15px", fontSize: 14, fontWeight: 800, borderRadius: 8, letterSpacing: "0.04em", background: "var(--phase-peak)", border: "1px solid var(--phase-peak)", color: "#000" }}>
              Build Meso 2 →
            </button>
            <button onClick={onDismiss} style={{ width: "100%", padding: "12px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-final week complete
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓️</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {profile?.name ? `Strong week, ${profile.name}.` : `Week ${modal.weekIdx + 1} Done`}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
            {`Week ${modal.weekIdx + 1} · ${modal.sessions} sessions completed`}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 22 }}>
          {[
            { label: "SETS", value: modal.sets },
            { label: "VOLUME", value: modal.volume >= 1000 ? `${(modal.volume / 1000).toFixed(1)}k` : modal.volume, unit: "lbs" },
            { label: "PRs", value: modal.prs || 0 },
          ].map(({ label, value, unit }) => (
            <div key={label} style={{ background: "var(--bg-inset)", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--phase-intens)", lineHeight: 1 }}>{value}</div>
              {unit && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 1 }}>{unit}</div>}
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onViewSummary} className="btn-primary" style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 700, borderRadius: 8, background: "var(--btn-primary-bg)", border: "1px solid var(--btn-primary-border)", color: "var(--btn-primary-text)" }}>
            View Week Summary →
          </button>
          <button onClick={onDismiss} style={{ width: "100%", padding: "12px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)" }}>
            Continue Training
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
