import React, { useState, useEffect, useMemo } from 'react';

// Data imports
import {
  TAG_ACCENT,
  PHASE_COLOR,
  VOLUME_LANDMARKS,
  RECOVERY_TIPS,
  GOAL_OPTIONS,
  getMeso,
  getWeekPhase,
  getWeekRir,
  getProgTargets,
  getMesoRows,
  randomQuote,
  randomCongrats,
  CONGRATS,
} from '../../data/constants';
import { EXERCISE_DB } from '../../data/exercises';
import {
  FOUNDRY_GOAL_IMG,
  FOUNDRY_STEEL_IMG,
} from '../../data/images-onboarding';
import {
  FOUNDRY_EMPTY_IMG,
  FOUNDRY_COMPLETE_IMG,
} from '../../data/images-home';

// Utils imports
import {
  store,
  loadDayWeek,
  loadDayWeekWithCarryover,
  loadCardioLog,
  loadCardioSession,
  loadMobilitySession,
  loadNotes,
  loadExNotes,
  loadExtraExNotes,
  hasAnyNotes,
  hasAnyExtraNotes,
  loadExerciseHistory,
  detectSessionPRs,
  detectStallingLifts,
  getWeekSets,
  loadBwLog,
  saveBwLog,
  addBwEntry,
  bwLoggedThisWeek,
  currentWeekSundayStr,
  markBwPromptShown,
  bwPromptShownThisWeek,
  saveSessionDuration,
  loadSessionDuration,
  loadSparklineData,
  loadCurrentWeek,
  saveCurrentWeek,
  loadCompleted,
  markComplete,
  loadProfile,
  saveProfile,
  isSkipped,
  setSkipped,
  clearAllSkips,
  getWorkoutDaysForWeek,
  ensureWorkoutDaysHistory,
  resetMeso,
  archiveCurrentMeso,
  loadArchive,
  deleteArchiveEntry,
  loadExOverride,
  saveExOverride,
  getReadinessScore,
} from '../../utils/store';
import { haptic } from '../../utils/helpers';
import HammerIcon from '../shared/HammerIcon';
import ExplorePage from '../explore/ExplorePage';

// Sub-component imports (will need to create these separately)
import { PricingPage } from '../settings/PricingPage';
// import { ResetDialog } from './ResetDialog';
// import { EditScheduleSheet } from './EditScheduleSheet';
// And other sub-components...

function HomeView({ tabRef, currentWeek, setCurrentWeek, onSelectDay, onSelectDayWeek, onOpenExtra, onOpenCardio, onOpenMobility, completedDays, onReset, activeDays, profile, openWeekly, onOpenWeeklyHandled, onProfileUpdate }) {
  // Default to Explore if no sessions logged yet — gives new users something useful to land on
  const [tab, setTab] = useState("landing");
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [addWorkoutModal, setAddWorkoutModal] = useState(null); // { dateStr } | null
  const [addWorkoutStep, setAddWorkoutStep] = useState("type"); // "type" | "daytype"
  const [addWorkoutType, setAddWorkoutType] = useState(null); // "manual" | "foundry"
  const [addWorkoutDayType, setAddWorkoutDayType] = useState(null);
  const [showRestDay, setShowRestDay] = useState(null); // { dateStr, isPast } | null
  const [selectedExtraDate, setSelectedExtraDate] = useState(null); // dateStr for extra session
  const [calendarOffset, setCalendarOffset] = useState(0); // months offset from current month
  const [noteViewer, setNoteViewer] = useState(null); // { type: "meso"|"extra", ... } | null
  const [skipVersion, setSkipVersion] = useState(0); // bumped on skip toggle to force re-render
  const [showEditSchedule, setShowEditSchedule] = useState(false); // Edit Schedule sheet
  const [showSkipConfirm, setShowSkipConfirm] = useState(null); // { dayIdx, weekIdx } | null
  const [showNextSession, setShowNextSession] = useState(false); // collapsed after day complete
  const [showMorningMobility, setShowMorningMobility] = useState(true); // morning mobility open by default on today card
  const [showRecoveryMorning, setShowRecoveryMorning] = useState(false);  // morning mobility on recovery card
  const [showRecoveryTag, setShowRecoveryTag] = useState(false);          // tag mobility on recovery card
  const isTodayRef = React.useRef(false); // set inside today-card IIFE, read by mobility card outside it
  const showDayRef = React.useRef(null);
  const showDayAccentRef = React.useRef("var(--accent)");
  const [recoveryTip] = useState(() => RECOVERY_TIPS[Math.floor(Math.random() * RECOVERY_TIPS.length)]);

  const todayReadinessKey = (() => { const d = new Date(); return `foundry:readiness:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const [readiness, setReadiness]         = useState(() => { try { return JSON.parse(store.get(todayReadinessKey) || "null"); } catch { return null; } });
  const [readinessOpen, setReadinessOpen] = useState(() => { try { const r = JSON.parse(store.get(todayReadinessKey) || "null"); return !r || !r.sleep || !r.soreness || !r.energy; } catch { return true; } });

  const updateReadiness = (key, val) => {
    const next = { ...(readiness || {}), [key]: val };
    store.set(todayReadinessKey, JSON.stringify(next));
    setReadiness(next);
    const score = getReadinessScore(next);
    if (score !== null) setReadinessOpen(false);
  };

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // If parent requests weekly tab, navigate there once
  useEffect(() => {
    if (openWeekly) {
      setTab("weekly");
      window.scrollTo(0, 0);
      if (onOpenWeeklyHandled) onOpenWeeklyHandled();
    }
  }, [openWeekly]);

  const goTo   = (key) => { setTab(key); window.scrollTo(0,0); };
  const goBack = ()    => { setTab("landing"); window.scrollTo(0,0); };
  if (tabRef) tabRef.current = goTo;

  // Detect any in-progress (started but not completed) session
  const hasActiveWorkout = useMemo(() => {
    // Regular meso sessions
    for (let w = 0; w <= getMeso().weeks; w++) {
      for (let d = 0; d < getMeso().days; d++) {
        const start = store.get(`ppl:sessionStart:d${d}:w${w}`);
        const done  = store.get(`ppl:done:d${d}:w${w}`);
        if (start && done !== "1") return true;
      }
    }
    // Extra sessions — check last 14 days
    for (let i = 0; i < 14; i++) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const dateStr = dt.toISOString().slice(0, 10);
      const start = store.get(`ppl:extra:start:${dateStr}`);
      const done  = store.get(`ppl:extra:done:${dateStr}`);
      if (start && done !== "1") return true;
    }
    return false;
  }, [tab]); // re-evaluate whenever tab changes (user navigated away mid-workout)



  const SubHeader = ({ label }) => (
    <div style={{display:"flex", alignItems:"center", gap:12, padding:"16px 16px 12px", background:"var(--bg-deep)", borderBottom:"1px solid var(--border)"}}>
      <button onClick={goBack} className="btn-ghost" style={{
        background:"transparent", border:"none", cursor:"pointer",
        color:"var(--accent)", fontSize:20, lineHeight:1, padding:"2px 4px",
        display:"flex", alignItems:"center", minWidth:44, minHeight:44, justifyContent:"center",
      }}>‹</button>
      <span style={{fontSize:12, fontWeight:600, letterSpacing:"0.05em", color:"var(--text-secondary)"}}>{label}</span>
    </div>
  );

  // ── Landing data ──
  // "current week" = first week that is not fully completed
  const activeWeek = useMemo(() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_, i) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks; // deload
  }, [completedDays, activeDays]);

  useEffect(() => { setShowNextSession(false); }, [activeWeek]);

  // Calendar week — what week the schedule says we're in based on today's date vs startDate
  const calendarWeek = useMemo(() => {
    const startDate = profile?.startDate ? new Date(profile.startDate + "T00:00:00") : null;
    if (!startDate || activeDays.length === 0) return activeWeek;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    let lastWk = 0;
    let sessionCount = 0;
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

  // displayWeek — what to show on screen. Never jumps ahead of the calendar.
  const displayWeek = Math.min(activeWeek, calendarWeek);

  const phase = getWeekPhase()[Math.min(displayWeek, getMeso().weeks - 1)] || "Deload";
  const pc    = PHASE_COLOR[phase];
  const rir   = getWeekRir()[Math.min(displayWeek, getMeso().weeks - 1)] || "N/A";

  // Week summary for displayWeek
  const weekDone  = activeDays.filter((_, i) => completedDays.has(`${i}:${displayWeek}`)).length;
  const weekTotal = activeDays.length;
  const weekPct   = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
  const weekMuscles = { PUSH:0, PULL:0, LEGS:0 };
  activeDays.forEach((day, dayIdx) => {
    if (!completedDays.has(`${dayIdx}:${displayWeek}`)) return;
    const wd = loadDayWeek(dayIdx, displayWeek);
    day.exercises.forEach((ex, exIdx) => {
      const filled = Object.values(wd[exIdx] || {}).filter(s => s && s.reps && s.reps !== "").length;
      if (filled > 0) weekMuscles[day.tag] += filled;
    });
  });

  // Meso summary
  const totalSessions = getMeso().weeks * getMeso().days;
  const doneSessions  = completedDays.size;
  const mesoPct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;

  // Progress bar component — animates from 0 on mount
  const ProgressBar = ({ pct: p, color }) => {
    const [width, setWidth] = React.useState(0);
    React.useEffect(() => {
      const t = requestAnimationFrame(() => setWidth(p));
      return () => cancelAnimationFrame(t);
    }, [p]);
    return (
      <div style={{height:4, background:"var(--bg-inset)", borderRadius:2, overflow:"hidden", marginTop:6}}>
        <div style={{height:"100%", width:`${width}%`, background:color, borderRadius:2, transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)"}} />
      </div>
    );
  };

  // ── Stub components (to be extracted into separate files) ──
  const ResetDialog = ({ onCancel, onConfirmed }) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onCancel}>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:24,maxWidth:360,width:"90%",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:800,color:"var(--text-primary)",marginBottom:8}}>Reset Mesocycle?</div>
        <div style={{fontSize:13,color:"var(--text-secondary)",marginBottom:20,lineHeight:1.5}}>This will archive your current meso and start fresh. Your data will be saved in history.</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"12px",borderRadius:8,background:"var(--bg-inset)",border:"1px solid var(--border)",color:"var(--text-primary)",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
          <button onClick={onConfirmed} style={{flex:1,padding:"12px",borderRadius:8,background:"var(--danger)",border:"1px solid var(--danger)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Reset</button>
        </div>
      </div>
    </div>
  );

  const ProgressPage = (props) => (
    <div style={{padding:20,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>Progress view coming soon</div>
  );

  const WeekSection = ({ weekIdx, isExpanded, onToggle, activeDays, completedDays, onSelectDay, workoutDays }) => (
    <div style={{marginBottom:8}}>
      <div onClick={onToggle} style={{cursor:"pointer",padding:"12px 16px",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>Week {weekIdx + 1}</span>
        <span style={{fontSize:12,color:"var(--text-muted)"}}>{isExpanded ? "▼" : "▶"}</span>
      </div>
      {isExpanded && (
        <div style={{padding:"8px 0",display:"flex",flexDirection:"column",gap:4}}>
          {activeDays.map((day, i) => {
            const done = completedDays.has(`${i}:${weekIdx}`);
            return (
              <div key={i} onClick={() => !done && onSelectDay(i, weekIdx)} style={{padding:"10px 16px",fontSize:12,color:done?"var(--text-muted)":"var(--text-primary)",cursor:done?"default":"pointer",background:done?"var(--bg-inset)":"transparent",borderRadius:4}}>
                {done ? "✓ " : ""}{day.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const DeloadSection = (props) => (
    <div style={{padding:"12px 16px",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,marginBottom:8}}>
      <span style={{fontSize:13,fontWeight:700,color:"var(--text-accent)"}}>Deload Week</span>
    </div>
  );

  const MesoOverview = () => (
    <div style={{padding:16,fontSize:12,color:"var(--text-muted)"}}>Meso overview</div>
  );

  const MesoHistory = ({ goBack }) => {
    const archive = loadArchive?.() || [];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px"}}>
          <button onClick={goBack} style={{background:"none",border:"none",color:"var(--text-accent)",fontSize:18,cursor:"pointer",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <span style={{fontSize:16,fontWeight:800,color:"var(--text-primary)"}}>Meso History</span>
        </div>
        {archive.length === 0 ? (
          <div style={{padding:20,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>No archived mesocycles yet</div>
        ) : (
          <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
            {archive.map((entry, idx) => (
              <div key={idx} style={{padding:16,background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{entry.profile?.split || "Program"} — {entry.profile?.weeks || "?"} weeks</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Archived {entry.date || "unknown date"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const WeeklySummary = ({ activeDays, completedDays, goBack, profile }) => (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px"}}>
        <button onClick={goBack} style={{background:"none",border:"none",color:"var(--text-accent)",fontSize:18,cursor:"pointer",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <span style={{fontSize:16,fontWeight:800,color:"var(--text-primary)"}}>Weekly Summary</span>
      </div>
      <div style={{padding:20,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>Weekly summary view coming soon</div>
    </div>
  );

  const generateExtraWorkout = (dayTypeId, prof) => {
    return { label: dayTypeId, exercises: [] };
  };

  return (
    <div style={{paddingBottom:140}}>
      {showReset && (
        <ResetDialog
          onCancel={() => setShowReset(false)}
          onConfirmed={() => { setShowReset(false); onReset(); }}
        />
      )}
      {/* ── ADD WORKOUT MODAL ── */}
      {addWorkoutModal && (() => {
        const { dateStr } = addWorkoutModal;
        const splitType = profile?.splitType || "ppl";
        const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });

        // What day type options to show based on split
        const dayTypeOptions =
          splitType === "ppl" ? [
            { id:"push",  label:"Push",      desc:"Chest · Shoulders · Triceps" },
            { id:"pull",  label:"Pull",      desc:"Back · Biceps · Rear Delts" },
            { id:"legs",  label:"Legs",      desc:"Quads · Hamstrings · Glutes" },
            { id:"fullbody", label:"Full Body", desc:"Full compound session" },
          ] : splitType === "upper_lower" ? [
            { id:"upper", label:"Upper Body", desc:"Chest · Back · Shoulders · Arms" },
            { id:"lower", label:"Lower Body", desc:"Quads · Hamstrings · Glutes" },
            { id:"fullbody", label:"Full Body", desc:"Full compound session" },
          ] : [
            { id:"fullbody", label:"Full Body", desc:"Full compound session" },
            { id:"push",  label:"Push Focus", desc:"Chest · Shoulders · Triceps" },
            { id:"pull",  label:"Pull Focus",  desc:"Back · Biceps · Rear Delts" },
            { id:"legs",  label:"Legs Focus",  desc:"Quads · Hamstrings · Glutes" },
          ];

        const closeModal = () => {
          setAddWorkoutModal(null);
          setAddWorkoutStep("type");
          setAddWorkoutType(null);
          setAddWorkoutDayType(null);
        };

        const handleFoundryBuild = (dayTypeId) => {
          const day = generateExtraWorkout(dayTypeId, profile);
          store.set(`ppl:extra:${dateStr}`, JSON.stringify(day));
          closeModal();
          onOpenExtra(dateStr);
        };

        return (
          <div style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:500,
            backdropFilter:"blur(6px)",
            display:"flex", alignItems:"center", justifyContent:"center", padding:24,
          }}>
            <div style={{
              background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:12, padding:"28px 24px", maxWidth:340, width:"100%",
              boxShadow:"var(--shadow-xl)",
              animation:"dialogIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              {/* Header */}
              <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.1em", color:"var(--text-muted)", marginBottom:4}}>ADD WORKOUT</div>
              <div style={{fontSize:16, fontWeight:800, color:"var(--text-primary)", marginBottom:4}}>{dateLabel}</div>

              {addWorkoutStep === "type" && (
                <>
                  <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.5, marginBottom:22}}>
                    How do you want to set up this session?
                  </div>
                  <div style={{display:"flex", flexDirection:"column", gap:10}}>
                    <button
                      onClick={() => {
                        setAddWorkoutType("foundry");
                        setAddWorkoutStep("daytype");
                      }}
                      style={{
                        padding:"16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                        background:"var(--accent)11", border:"1px solid var(--accent)55",
                        color:"var(--text-primary)",
                      }}
                    >
                      <div style={{fontSize:14, fontWeight:800, color:"var(--accent)", marginBottom:2}}> Foundry Build</div>
                      <div style={{fontSize:12, color:"var(--text-secondary)"}}>Auto-generate a workout based on your equipment and level</div>
                    </button>
                    <button
                      onClick={() => {
                        store.set(`ppl:extra:${dateStr}`, JSON.stringify({ isExtra:true, isManual:true, label:"Manual Session", exercises:[], dateStr }));
                        closeModal();
                        onOpenExtra(dateStr);
                      }}
                      style={{
                        padding:"16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                        background:"var(--bg-surface)", border:"1px solid var(--border)",
                        color:"var(--text-primary)",
                      }}
                    >
                      <div style={{fontSize:14, fontWeight:800, marginBottom:2}}>Manual</div>
                      <div style={{fontSize:12, color:"var(--text-secondary)"}}>Log a workout your own way — freeform notes</div>
                    </button>
                  </div>
                  <button onClick={closeModal} style={{
                    width:"100%", marginTop:12, padding:"12px", borderRadius:8, cursor:"pointer",
                    background:"transparent", border:"none", color:"var(--text-muted)", fontSize:13,
                  }}>Cancel</button>
                </>
              )}

              {addWorkoutStep === "daytype" && (
                <>
                  <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.5, marginBottom:18}}>
                    What kind of session?
                  </div>
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    {dayTypeOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleFoundryBuild(opt.id)}
                        style={{
                          padding:"13px 16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                          background:"var(--bg-surface)", border:"1px solid var(--border)",
                          color:"var(--text-primary)",
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                        }}
                      >
                        <div>
                          <div style={{fontSize:13, fontWeight:800}}>{opt.label}</div>
                          <div style={{fontSize:12, color:"var(--text-muted)", marginTop:2}}>{opt.desc}</div>
                        </div>
                        <span style={{fontSize:16, color:"var(--text-muted)"}}>›</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setAddWorkoutStep("type")} style={{
                    width:"100%", marginTop:12, padding:"12px", borderRadius:8, cursor:"pointer",
                    background:"transparent", border:"none", color:"var(--text-muted)", fontSize:13,
                  }}>← Back</button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── LANDING ── */}
      {tab === "landing" && (() => {
        // Find next incomplete day this week
        const nextDayIdx = activeDays.findIndex((_, i) => !completedDays.has(`${i}:${activeWeek}`));
        const nextDay = nextDayIdx >= 0 ? activeDays[nextDayIdx] : null;
        const nextDayAccent = nextDay ? TAG_ACCENT[nextDay.tag] : "var(--accent)";

        // Cardio plan for today
        const todayCardioStr = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        })();
        const todayDow = new Date().getDay(); // 0=Sun
        const cardioSchedule = profile?.cardioSchedule || [];
        const todayCardioSlot = cardioSchedule.find(s => s.dayOfWeek === todayDow) || null;
        const todayCardioSession = loadCardioSession(todayCardioStr);
        const CARDIO_COLOR = TAG_ACCENT["CARDIO"];

        // no navItems array needed — layout is hand-crafted below

        return (
          <div style={{padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:12}}>

            {/* ── GREETING ── */}
            {profile?.name && (
              <div style={{
                fontSize:16, fontWeight:500, color:"var(--text-secondary)",
                letterSpacing:"0.01em", paddingBottom:6,
              }}>
                {getTimeGreeting()}, <span style={{color:"var(--text-primary)", fontWeight:700}}>{profile.name}</span>.
              </div>
            )}

            {/* ── DASHBOARD ── */}
            <div style={{display:"flex", flexDirection:"column", gap:10}}>

              {/* ─ TOP ROW: Meso ring + week status ─ */}
              <div style={{display:"flex", gap:10}}>

                {/* Meso progress ring — tappable to go to Progress */}
                <button onClick={() => goTo("progress")} style={{
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  borderRadius:8, padding:"14px 16px",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  gap:6, flexShrink:0, width:104, boxShadow:"var(--shadow-sm)",
                  cursor:"pointer",
                  transition:"border-color 0.15s, transform 0.12s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
                  onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
                  onMouseUp={e => e.currentTarget.style.transform = "translateY(-1px)"}
                >
                  {(() => {
                    const r = 26, circ = 2 * Math.PI * r;
                    const dash = circ * (mesoPct / 100);
                    return (
                      <svg width="64" height="64" viewBox="0 0 64 64" style={{overflow:"visible"}}>
                        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="5"/>
                        <circle cx="32" cy="32" r={r} fill="none" stroke={pc} strokeWidth="5"
                          strokeDasharray={`${dash} ${circ}`}
                          strokeDashoffset={circ * 0.25}
                          strokeLinecap="round"
                          style={{transition:"stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)"}}
                        />
                        <text x="32" y="35" textAnchor="middle" fontSize="13" fontWeight="800"
                          fill="var(--text-primary)" fontFamily="inherit">{mesoPct}%</text>
                      </svg>
                    );
                  })()}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--phase-accum)"}}>MESO PROGRESS</div>
                    <div style={{fontSize:12, color:"var(--text-secondary)", fontWeight:500}}>{doneSessions}/{totalSessions}</div>
                  </div>
                </button>

                {/* Current week card */}
                <div style={{
                  flex:1, background:"var(--bg-card)", border:`1px solid ${pc}55`,
                  borderRadius:8, padding:"14px 14px", boxShadow:`0 2px 10px ${pc}18`,
                  display:"flex", flexDirection:"column", gap:8,
                }}>
                  {/* Phase + week */}
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>
                      <div style={{
                        fontSize:15, fontWeight:700, letterSpacing:"0.06em",
                        color:pc, background:pc+"18", padding:"3px 7px", borderRadius:4,
                      }}>{phase.toUpperCase()}</div>
                      <div style={{fontSize:12, color:"var(--text-secondary)", fontWeight:600, letterSpacing:"0.04em"}}>WK {displayWeek+1}/{getMeso().weeks}</div>
                    </div>
                    {phase !== "Accumulation" && (
                      <div style={{fontSize:12, color:"var(--text-secondary)", fontWeight:600}}>{rir}</div>
                    )}
                  </div>

                  {/* Day pills */}
                  <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                    {activeDays.map((day, i) => {
                      const done = completedDays.has(`${i}:${displayWeek}`);
                      const isNext = !done && activeDays.slice(0, i).every((_, j) => completedDays.has(`${j}:${displayWeek}`));
                      const tc = TAG_ACCENT[day.tag];
                      return (
                        <button key={i} onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(i, activeWeek); }}
                          style={{
                            flex:1, minWidth:0, padding:"6px 4px",
                            borderRadius:5, border:`1px solid`,
                            borderColor: done ? tc+"60" : isNext ? tc : pc+"55",
                            background: done ? tc+"1a" : isNext ? tc+"12" : pc+"08",
                            cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                          }}>
                          <div style={{
                            fontSize:12, fontWeight:800, letterSpacing:"0.04em",
                            color: done ? tc : isNext ? tc : "var(--text-muted)",
                          }}>{{PUSH:"PU",PULL:"PL",LEGS:"LE",UPPER:"UP",LOWER:"LO",FULL:"FB"}[day.tag]||day.tag.slice(0,2)}</div>
                          <div style={{fontSize:12, lineHeight:1}}>
                            {done ? <span style={{color:tc}}>✓</span> : isNext ? <span style={{color:tc, fontSize:12}}>●</span> : <span style={{color:"var(--text-muted)", fontSize:12}}>·</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Week progress bar */}
                  <div style={{display:"flex", alignItems:"center", gap:6}}>
                    <div style={{flex:1, height:5, background:"var(--border)", borderRadius:3, overflow:"hidden"}}>
                      <div style={{height:"100%", width:`${weekPct}%`, background:pc, borderRadius:3, transition:"width 0.5s ease"}} />
                    </div>
                    <div style={{fontSize:12, color:"var(--text-secondary)", fontWeight:600, flexShrink:0}}>{weekDone}/{weekTotal}</div>
                  </div>
                </div>
              </div>

              {/* ─ RECOVERY & READINESS CARD (rest days / done days only) ─ */}
              {(() => {
                // Determine if today is an active workout day (not yet done)
                const _startDate = profile?.startDate ? new Date(profile.startDate + "T00:00:00") : null;
                const _todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
                let _isWorkoutToday = false;
                if (_startDate && activeDays.length > 0) {
                  const _total = (getMeso().weeks + 1) * activeDays.length;
                  let _sc = 0, _cursor = new Date(_startDate);
                  for (let _d = 0; _d < 400 && _sc < _total; _d++) {
                    const _wkIdx = Math.floor(_sc / activeDays.length);
                    if (getWorkoutDaysForWeek(profile, _wkIdx).includes(_cursor.getDay())) {
                      if (_cursor.toISOString().slice(0,10) === _todayStr) {
                        const _dIdx = _sc % activeDays.length;
                        const _done = completedDays.has(`${_dIdx}:${_wkIdx}`);
                        if (!_done) _isWorkoutToday = true;
                      }
                      _sc++;
                    }
                    _cursor.setDate(_cursor.getDate() + 1);
                  }
                }
                // On active workout days, hide readiness from home — it's in the workout flow now
                if (_isWorkoutToday) return null;

                const score = getReadinessScore(readiness);
                const rl    = getReadinessLabel(score);
                const SIGNALS = [
                  { key:"sleep",    label:"Sleep",   opts:[{val:"poor",label:"Poor"},{val:"ok",label:"OK"},{val:"good",label:"Good"}] },
                  { key:"soreness", label:"Soreness",opts:[{val:"high",label:"High"},{val:"moderate",label:"Moderate"},{val:"low",label:"Low"}] },
                  { key:"energy",   label:"Energy",  opts:[{val:"low",label:"Low"},{val:"moderate",label:"Moderate"},{val:"high",label:"High"}] },
                ];
                const allFilled = readiness?.sleep && readiness?.soreness && readiness?.energy;
                return (
                  <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                    {/* Header — always visible */}
                    <button onClick={() => setReadinessOpen(o => !o)} style={{
                      width:"100%", background:"var(--bg-inset)", border:"none",
                      borderBottom: readinessOpen ? "1px solid var(--border)" : "none",
                      padding:"10px 16px", cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left",
                    }}>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"var(--phase-accum)"}}>READINESS</span>
                        {allFilled && rl && (
                          <span style={{
                            fontSize:11, fontWeight:800, letterSpacing:"0.06em",
                            color:rl.color, background:rl.color+"22",
                            border:`1px solid ${rl.color}44`, borderRadius:4, padding:"2px 7px",
                          }}>{rl.label}</span>
                        )}
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: readinessOpen ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    {/* Body — expanded */}
                    {readinessOpen && (
                      <div style={{padding:"12px 16px", display:"flex", flexDirection:"column", gap:12}}>
                        {SIGNALS.map(sig => (
                          <div key={sig.key}>
                            <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.07em", color:"#F29A52", marginBottom:6}}>{sig.label.toUpperCase()}</div>
                            <div style={{display:"flex", gap:6}}>
                              {sig.opts.map(opt => {
                                const sel = readiness?.[sig.key] === opt.val;
                                return (
                                  <button key={opt.val} onClick={() => updateReadiness(sig.key, opt.val)} style={{
                                    flex:1, padding:"9px 6px", borderRadius:6, cursor:"pointer",
                                    fontSize:12, fontWeight:700, letterSpacing:"0.02em",
                                    background: sel ? "rgba(var(--accent-rgb),0.18)" : "var(--bg-deep,#0e0c0a)",
                                    border:`1px solid ${sel ? "var(--accent)" : "var(--border-accent)"}`,
                                    color: sel ? "var(--accent)" : "var(--text-primary)",
                                    transition:"all 0.12s",
                                  }}>{opt.label}</button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {allFilled && rl && (
                          <div style={{
                            marginTop:4, padding:"10px 12px", borderRadius:6,
                            background:rl.color+"18", border:`1px solid ${rl.color}44`,
                            borderLeft:`3px solid ${rl.color}`,
                          }}>
                            <div style={{fontSize:12, fontWeight:700, color:rl.color, marginBottom:2}}>{rl.label}</div>
                            <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{rl.advice}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsed summary — score + advice inline */}
                    {!readinessOpen && allFilled && rl && (
                      <div style={{padding:"8px 16px"}}>
                        <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.5}}>{rl.advice}</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ─ TODAY card ─ */}
              {(() => {
                // Build sessionDateMap from startDate — same logic as Schedule tab
                const todayDateStr3 = todayCardioStr;
                const startDate = profile?.startDate ? new Date(profile.startDate + "T00:00:00") : null;
                const sessionDateMap = {};
                if (startDate && activeDays.length > 0) {
                  const total = (getMeso().weeks + 1) * activeDays.length;
                  let sc = 0, cursor = new Date(startDate);
                  for (let d = 0; d < 400 && sc < total; d++) {
                    const wkIdx = Math.floor(sc / activeDays.length);
                    if (getWorkoutDaysForWeek(profile, wkIdx).includes(cursor.getDay())) {
                      sessionDateMap[cursor.toISOString().slice(0,10)] = `${sc % activeDays.length}:${wkIdx}`;
                      sc++;
                    }
                    cursor.setDate(cursor.getDate() + 1);
                  }
                }

                // What does the calendar say about today?
                const calendarEntry    = sessionDateMap[todayDateStr3];
                const isCalendarWorkoutDay = calendarEntry != null;
                const calDayIdx  = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[0]) : -1;
                const calWeekIdx = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[1]) : -1;

                // Is today's scheduled session already done?
                const calendarSessionDone = isCalendarWorkoutDay && completedDays.has(calendarEntry);

                // All sessions in displayWeek done? (between-weeks rest state)
                const displayWeekAllDone = activeDays.every((_, i) => completedDays.has(`${i}:${displayWeek}`));

                // Rest if: not a workout day, OR today's session already done, OR week done with no session today
                const isRestState = !isCalendarWorkoutDay || calendarSessionDone || displayWeekAllDone;
                const isRestDay   = !isCalendarWorkoutDay && !todayCardioSlot;

                // Session details for lifting card
                const todayMesoDay    = isCalendarWorkoutDay ? activeDays[calDayIdx] : null;
                const showDayWeek     = isCalendarWorkoutDay ? calWeekIdx : activeWeek;
                const showDay         = (!isRestState && todayMesoDay) ? todayMesoDay : nextDay;
                const showDayIdx      = (!isRestState && todayMesoDay) ? calDayIdx : nextDayIdx;
                const showDayAccent   = showDay ? TAG_ACCENT[showDay.tag] : nextDayAccent;
                const isToday         = isCalendarWorkoutDay && !calendarSessionDone;

                const preview = showDay?.exercises || [];
                const lastWeekData = (() => {
                  for (let w = (isToday ? calWeekIdx : activeWeek) - 1; w >= 0; w--) {
                    const raw = store.get(`ppl:day${showDayIdx}:week${w}`);
                    if (raw) try { return JSON.parse(raw); } catch {}
                  }
                  return {};
                })();

                // ── REST / RECOVERY state ────────────────────────────────────
                if (isRestState || isRestDay) {
                  // ── Shared mobility data ──────────────────────────────────────
                  // Resolve mobility tag: done session today → use that tag;
                  // otherwise scan back for the most recently completed session regardless of gap
                  let homeMobilityTag = null;
                  if (calendarSessionDone && calDayIdx >= 0) {
                    homeMobilityTag = activeDays[calDayIdx]?.tag || null;
                  } else {
                    outer: for (let w = displayWeek; w >= 0; w--) {
                      for (let d = activeDays.length - 1; d >= 0; d--) {
                        if (completedDays.has(`${d}:${w}`)) {
                          homeMobilityTag = activeDays[d]?.tag || null;
                          break outer;
                        }
                      }
                    }
                  }
                  const homeMobilityMoves = homeMobilityTag && FOUNDRY_COOLDOWN[homeMobilityTag] ? FOUNDRY_COOLDOWN[homeMobilityTag] : null;

                  // ── Week complete — all sessions done, no next scheduled day ──
                  if (displayWeekAllDone && !nextDay) {
                    const lastDayTag = (() => {
                      for (let d = activeDays.length - 1; d >= 0; d--) {
                        if (completedDays.has(`${d}:${displayWeek}`)) return activeDays[d]?.tag || null;
                      }
                      return null;
                    })();
                    const weekCompleteMoves = lastDayTag && FOUNDRY_COOLDOWN[lastDayTag] ? FOUNDRY_COOLDOWN[lastDayTag] : null;
                    return (
                      <div data-tour="today-card" style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                        <div style={{padding:"12px 16px", background:"var(--phase-accum)0d", borderBottom:"1px solid var(--phase-accum)22", display:"flex", alignItems:"center", gap:8}}>
                          
                          <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"var(--phase-accum)"}}>WEEK COMPLETE</span>
                        </div>
                        <div style={{padding:"14px 16px"}}>
                          <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:8}}>ACTIVE RECOVERY</div>
                          {[
                            { title:"Sauna or Steam", body:"Even 15–20 minutes of heat exposure improves circulation and helps clear soreness. If you have access, this is one of the best week-end recovery tools available." },
                            { title:"Easy Cardio", body:"A 20–30 min easy bike, walk, or swim keeps blood moving without adding stress. Keep intensity below 6/10 — this is recovery, not training." },
                            { title:"Cold Finish", body:"End your shower cold for 30–60 seconds. Reduces inflammation, improves mood, and signals your nervous system that it's time to recover." },
                          ].map((item, i) => (
                            <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)", borderLeft:"3px solid var(--accent)"}}>
                              <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{item.title}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{item.body}</div>
                            </div>
                          ))}
                          <button onClick={() => setShowRecoveryMorning(p => !p)} style={{width:"100%", background:"transparent", border:"none", borderTop:"1px solid var(--border-subtle)", padding:"10px 0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, textAlign:"left"}}>
                            <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)"}}>DAILY MOBILITY · 3 MOVES</div>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showRecoveryMorning ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                          {showRecoveryMorning && DAILY_MOBILITY.map((move, i) => (
                            <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)"}}>
                              <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{move.name}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{move.cue}</div>
                            </div>
                          ))}
                          {weekCompleteMoves && (
                            <>
                              <button onClick={() => setShowRecoveryTag(p => !p)} style={{width:"100%", background:"transparent", border:"none", borderTop:"1px solid var(--border-subtle)", padding:"10px 0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4, textAlign:"left"}}>
                                <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)"}}>{lastDayTag} MOBILITY · 3 MOVES</div>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showRecoveryTag ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                              {showRecoveryTag && weekCompleteMoves.map((move, i) => (
                                <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)"}}>
                                  <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{move.name}</div>
                                  <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{move.cue}</div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── Rest day + session done: full recovery card ───────────────
                  const nextDayForCollapse = nextDay;
                  const nextDayIdxForCollapse = nextDayIdx;
                  const doneLabel = calendarSessionDone ? (activeDays[calDayIdx]?.label || "") : (activeDays[activeDays.length - 1]?.label || "");
                  return (
                    <div style={{display:"flex", flexDirection:"column", gap:8}}>
                      <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                        <div style={{padding:"12px 16px", background: calendarSessionDone ? "var(--phase-accum)0d" : "var(--bg-inset)", borderBottom: calendarSessionDone ? "1px solid var(--phase-accum)22" : "1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                          <div style={{display:"flex", alignItems:"center", gap:8}}>
                            {calendarSessionDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--phase-accum)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.08em", color: calendarSessionDone ? "var(--phase-accum)" : "var(--text-muted)"}}>{calendarSessionDone ? "TODAY · DONE" : "REST DAY"}</span>
                          </div>
                          {doneLabel && calendarSessionDone && <span style={{fontSize:12, color:"var(--text-muted)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140}}>{doneLabel}</span>}
                        </div>
                        <div style={{padding:"14px 16px"}}>
                          <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:8}}>RECOVERY ESSENTIALS</div>
                          {[
                            { title:"Sleep", body:"8+ hours is the only thing that actually repairs muscle tissue. No supplement replaces it. Tonight, make sleep the priority." },
                            { title:"Protein", body:"Hit your target today even without training. Muscle protein synthesis continues in recovery — shortchanging protein now blunts your gains." },
                            { title:"Walk", body:"20–30 minutes of easy walking clears metabolic waste and keeps blood moving through sore tissue. Low intensity, high return." },
                          ].map((item, i) => (
                            <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)", borderLeft:"3px solid var(--accent)"}}>
                              <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{item.title}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{item.body}</div>
                            </div>
                          ))}
                          <button onClick={() => setShowRecoveryMorning(p => !p)} style={{width:"100%", background:"transparent", border:"none", borderTop:"1px solid var(--border-subtle)", padding:"10px 0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, textAlign:"left"}}>
                            <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)"}}>DAILY MOBILITY · 3 MOVES</div>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showRecoveryMorning ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                          {showRecoveryMorning && DAILY_MOBILITY.map((move, i) => (
                            <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)"}}>
                              <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{move.name}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{move.cue}</div>
                            </div>
                          ))}
                          {homeMobilityMoves && (
                            <>
                              <button onClick={() => setShowRecoveryTag(p => !p)} style={{width:"100%", background:"transparent", border:"none", borderTop:"1px solid var(--border-subtle)", padding:"10px 0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4, textAlign:"left"}}>
                                <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)"}}>{homeMobilityTag} MOBILITY · 3 MOVES</div>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showRecoveryTag ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                              {showRecoveryTag && homeMobilityMoves.map((move, i) => (
                                <div key={i} style={{padding:"10px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:6, border:"1px solid var(--border-subtle)"}}>
                                  <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{move.name}</div>
                                  <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6}}>{move.cue}</div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      {nextDayForCollapse && (
                        <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                          <button onClick={() => setShowNextSession(p => !p)} style={{width:"100%", background:"transparent", border:"none", padding:"12px 16px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                            <div>
                              <div style={{fontSize:11, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-muted)", marginBottom:2}}>NEXT SESSION</div>
                              <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)"}}>{nextDayForCollapse.label}</div>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showNextSession ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                          {showNextSession && (
                            <div style={{borderTop:"1px solid var(--border-subtle)"}}>
                              <button onClick={() => { goBack(); setCurrentWeek(activeWeek); onSelectDay(nextDayIdxForCollapse); }} style={{width:"100%", background:"transparent", border:"none", cursor:"pointer", padding:"0"}}>
                                {nextDayForCollapse.exercises.map((ex, ei) => {
                                  const ovId = store.get(`ppl:exov:d${nextDayIdxForCollapse}:ex${ei}`) || null;
                                  const dbEx = ovId ? EXERCISE_DB.find(e => e.id === ovId) : null;
                                  return (
                                    <div key={ei} style={{display:"flex", padding:"8px 16px", borderBottom: ei < nextDayForCollapse.exercises.length - 1 ? "1px solid var(--border-subtle)" : "none", textAlign:"left"}}>
                                      <div style={{flex:1, minWidth:0}}>
                                        <div style={{fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{dbEx ? dbEx.name : ex.name}</div>
                                        <div style={{fontSize:12, color:"var(--text-secondary)", marginTop:1}}>{ex.sets} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ""}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </button>
                              <div style={{padding:"10px 12px", borderTop:"1px solid var(--border-subtle)"}}>
                                <button onClick={() => { goBack(); setCurrentWeek(activeWeek); onSelectDay(nextDayIdxForCollapse); }} style={{width:"100%", padding:"10px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)", fontSize:13, fontWeight:700, letterSpacing:"0.04em"}}>Start {nextDayForCollapse.label} →</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } // end if (isRestState || isRestDay)

                // ── Lifting day card ──────────────────────────────────────────
                isTodayRef.current = isToday;
                showDayRef.current = showDay;
                showDayAccentRef.current = showDayAccent;
                return (<>
                  <div data-tour="today-card" style={{background:"var(--bg-card)", border:`1px solid ${showDayAccent}30`, borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                    <button onClick={(e) => { e.stopPropagation(); goBack(); setCurrentWeek(showDayWeek); onSelectDay(showDayIdx); }}
                      style={{width:"100%", background:`linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`, border:"none", cursor:"pointer", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${showDayAccent}18`}}
                      onMouseEnter={e => e.currentTarget.style.background = showDayAccent+"14"}
                      onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`}
                    >
                      <div style={{textAlign:"left"}}>
                        <div style={{fontSize:12, color:"var(--phase-accum)", fontWeight:700, letterSpacing:"0.06em", marginBottom:2}}>{isToday ? "TODAY" : "NEXT SESSION"}</div>
                        <div style={{fontSize:15, fontWeight:700, color:"var(--text-primary)"}}>Week {showDayWeek + 1} · Day {showDayIdx + 1}</div>
                        <div style={{fontSize:12, color:"var(--text-secondary)", marginTop:1}}>{showDay.label}</div>
                      </div>
                      <div style={{flexShrink:0, fontSize:13, fontWeight:800, color:showDayAccent, letterSpacing:"0.02em"}}>Start →</div>
                    </button>
                    <div style={{padding:"8px 0 4px"}}>
                      {preview.map((ex, ei) => {
                        const prevData = lastWeekData[ei];
                        const prevSets = prevData ? Object.values(prevData).filter(s => s && s.weight && parseFloat(s.weight) > 0) : [];
                        const prevWeight = prevSets.length > 0 ? prevSets[0].weight : null;
                        const ovId = store.get(`ppl:exov:d${showDayIdx}:ex${ei}`) || null;
                        const dbEx = ovId ? EXERCISE_DB.find(e => e.id === ovId) : null;
                        return (
                          <div key={ei} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px", borderBottom: ei < preview.length - 1 ? "1px solid var(--border-subtle)" : "none"}}>
                            <div style={{flex:1, minWidth:0}}>
                              <div style={{fontSize:13, fontWeight:600, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{dbEx ? dbEx.name : ex.name}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", marginTop:1}}>{ex.sets} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ""}</div>
                            </div>
                            {prevWeight && (
                              <div style={{flexShrink:0, marginLeft:10, textAlign:"right"}}>
                                <div style={{fontSize:12, fontWeight:700, color:"var(--text-primary)"}}>{prevWeight}</div>
                                <div style={{fontSize:12, color:"var(--text-secondary)"}}>last wk</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {isToday && (
                      <div style={{borderTop:"1px solid var(--border-subtle)", padding:"8px 12px"}}>
                        <button onClick={e => { e.stopPropagation(); setShowSkipConfirm({ dayIdx: showDayIdx, weekIdx: showDayWeek }); }}
                          style={{width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-muted)", fontSize:12, fontWeight:700, letterSpacing:"0.04em", padding:"8px", cursor:"pointer"}}
                        >Skip Today's Session</button>
                      </div>
                    )}
                  </div>
                </>
                );
              })()}

            </div>

            {/* ── CARDIO CARD ─────────────────────────────────────────────── */}
            {(() => {
              // Planned cardio today
              if (todayCardioSlot) {
                const proto = CARDIO_WORKOUTS.find(w => w.id === todayCardioSlot.protocol);
                const done  = todayCardioSession?.completed;
                return (
                  <button
                    data-tour="cardio-card"
                    onClick={() => onOpenCardio(todayCardioStr, todayCardioSlot.protocol)}
                    style={{
                      width:"100%", background:"var(--bg-card)",
                      border:`1px solid ${done ? "#D4983C44" : CARDIO_COLOR+"44"}`,
                      borderRadius:8, overflow:"hidden",
                      boxShadow:"var(--shadow-sm)", cursor:"pointer", textAlign:"left",
                    }}
                  >
                    <div style={{
                      padding:"12px 16px",
                      background: done ? "#D4983C10" : `${CARDIO_COLOR}0d`,
                      borderBottom:`1px solid ${done ? "#D4983C30" : CARDIO_COLOR+"22"}`,
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                    }}>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={done ? "#D4983C" : CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                        <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.08em", color: done ? "#D4983C" : CARDIO_COLOR}}>
                          {done ? "CARDIO DONE ✓" : "CARDIO TODAY"}
                        </span>
                      </div>
                      {!done && (
                        <span style={{
                          fontSize:12, fontWeight:800, letterSpacing:"0.06em",
                          color: CARDIO_COLOR, background:`${CARDIO_COLOR}18`,
                          border:`1px solid ${CARDIO_COLOR}44`,
                          borderRadius:6, padding:"4px 10px",
                        }}>START ▶</span>
                      )}
                    </div>
                    <div style={{padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:14, fontWeight:700, color:"var(--text-primary)", marginBottom:2}}>
                          {proto ? proto.label : todayCardioSlot.protocol}
                        </div>
                        <div style={{fontSize:12, color:"var(--text-secondary)"}}>
                          {proto ? proto.description.split(".")[0] + "." : "Cardio session"}
                        </div>
                      </div>
                      {proto?.intervals && !done && (
                        <div style={{display:"flex", gap:5, flexShrink:0, marginLeft:10}}>
                          {[
                            {label:"WORK", val:`${proto.intervals.workSecs}s`, color:"#E75831"},
                            {label:"REST", val:`${proto.intervals.restSecs}s`, color:"#D4983C"},
                          ].map(({label, val, color}) => (
                            <div key={label} style={{
                              fontSize:11, fontWeight:800, letterSpacing:"0.05em",
                              color, background:`${color}18`,
                              border:`1px solid ${color}44`,
                              borderRadius:4, padding:"2px 6px", whiteSpace:"nowrap",
                            }}>{label} {val}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              }

              // No planned cardio — show soft "Add Cardio" CTA
              return (
                <button
                  data-tour="cardio-card"
                  onClick={() => onOpenCardio(todayCardioStr, null)}
                  style={{
                    width:"100%", background:"var(--bg-card)",
                    border:"1px solid var(--border)", borderRadius:8,
                    padding:"12px 16px", cursor:"pointer", textAlign:"left",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    boxShadow:"var(--shadow-xs)",
                  }}
                >
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--text-secondary)"}}>
                      {todayCardioSession?.completed
                        ? "Cardio logged today ✓"
                        : "Add a cardio session"}
                    </span>
                  </div>
                  <span style={{fontSize:14, color:"var(--text-muted)", fontWeight:700}}>+</span>
                </button>
              );
            })()}

              {/* ── PRE-WORKOUT MOBILITY CARD ─────────────────────────────── */}
              {isTodayRef.current && (() => {
                const sessionTag = showDayRef.current?.tag || null;
                const tagAccent  = showDayAccentRef.current || "var(--accent)";
                return (
                  <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", boxShadow:"var(--shadow-sm)"}}>
                    <button onClick={() => setShowMorningMobility(p => !p)} style={{width:"100%", background:"var(--bg-inset)", border:"none", borderBottom:"1px solid var(--border)", padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left"}}>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)"}}>BEFORE YOU TRAIN</span>
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        {sessionTag && <span style={{fontSize:11, fontWeight:700, color:tagAccent, background:tagAccent+"18", border:(`1px solid ${tagAccent}33`), borderRadius:4, padding:"2px 8px", letterSpacing:"0.06em"}}>{sessionTag}</span>}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showMorningMobility ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s", flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </button>
                    {showMorningMobility && (
                      <div style={{padding:"12px 16px"}}>
                        <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:8}}>DAILY MOBILITY · 3 MOVES</div>
                        {DAILY_MOBILITY.map((move, i) => (
                          <div key={i} style={{padding:"9px 12px", borderRadius:7, background:"var(--bg-deep)", marginBottom:5, border:"1px solid var(--border-subtle)"}}>
                            <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:2}}>{move.name}</div>
                            <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.55}}>{move.cue}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* ── MOBILITY SOFT CTA ── */}
            {(() => {
              const MOBILITY_COLOR = "#D4983C";
              const todayMobilityStr = (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              })();
              const todayMobilitySession = loadMobilitySession(todayMobilityStr);
              return (
                <button
                  onClick={() => onOpenMobility(todayMobilityStr)}
                  style={{
                    width:"100%", background:"var(--bg-card)",
                    border:"1px solid var(--border)", borderRadius:8,
                    padding:"12px 16px", cursor:"pointer", textAlign:"left",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    boxShadow:"var(--shadow-xs)",
                  }}
                >
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MOBILITY_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/>
                      <path d="M12 8v4l3 3"/>
                    </svg>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--text-secondary)"}}>
                      {todayMobilitySession?.completed
                        ? "Mobility done today ✓"
                        : "Add a mobility session"}
                    </span>
                  </div>
                  <span style={{fontSize:14, color:"var(--text-muted)", fontWeight:700}}>+</span>
                </button>
              );
            })()}

            {/* ── GO PRO banner ── */}
            <button onClick={() => setShowPricing(true)} style={{
              width:"100%", background:"linear-gradient(135deg, #1A1410 0%, #221C14 50%, #2E2418 100%)",
              border:"1px solid var(--phase-peak)55",
              borderRadius:8, padding:"16px",
              display:"flex", alignItems:"center", gap:14,
              cursor:"pointer", textAlign:"left",
              boxShadow:`0 2px 16px rgba(212,152,60,0.15)`,
              transition:"transform 0.12s, border-color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--phase-peak)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--phase-peak)55"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{
                width:42, height:42, borderRadius:8, flexShrink:0,
                background:"var(--phase-peak)22", border:"1px solid var(--phase-peak)44",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--phase-peak)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>
                </svg>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:3}}>
                  <span style={{fontSize:14, fontWeight:800, color:"var(--text-primary)"}}>The Foundry Pro</span>
                  <span style={{fontSize:10, fontWeight:800, letterSpacing:"0.08em", color:"var(--phase-peak)", background:"var(--phase-peak)22", border:"1px solid var(--phase-peak)44", borderRadius:4, padding:"1px 6px"}}>GET EARLY ACCESS</span>
                </div>
                <div style={{fontSize:12, color:"var(--text-secondary)"}}>The Foundry builds your program · coaching intelligence · full history</div>
              </div>
              <div style={{fontSize:20, color:"var(--phase-peak)", flexShrink:0}}>›</div>
            </button>

            <div style={{height:8}} />
          </div>
        );
      })()}

      {/* ── PRICING OVERLAY ── */}
      {showPricing && (
        <PricingPage onClose={() => setShowPricing(false)} />
      )}

      {/* ── SKIP CONFIRM MODAL ── */}
      {showSkipConfirm && (
        <div style={{position:"fixed", inset:0, zIndex:280, background:"rgba(0,0,0,0.78)", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>
          <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, padding:"24px", maxWidth:320, width:"100%", boxShadow:"var(--shadow-xl)"}}>
            <div style={{fontSize:16, fontWeight:800, color:"var(--text-primary)", marginBottom:8}}>Skip today's session?</div>
            <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:20}}>
              This session will be marked as skipped. You can restore it from the Schedule tab at any time.
            </div>
            <div style={{display:"flex", gap:8}}>
              <button
                onClick={() => {
                  setSkipped(showSkipConfirm.dayIdx, showSkipConfirm.weekIdx, true);
                  setSkipVersion(v => v + 1);
                  setShowSkipConfirm(null);
                }}
                style={{flex:1, padding:"12px", borderRadius:8, cursor:"pointer", background:"var(--danger)", border:"1px solid var(--danger)", color:"#fff", fontSize:13, fontWeight:700}}
              >Skip It</button>
              <button
                onClick={() => setShowSkipConfirm(null)}
                style={{flex:1, padding:"12px", borderRadius:8, cursor:"pointer", background:"transparent", border:"1px solid var(--border)", color:"var(--text-secondary)", fontSize:13, fontWeight:600}}
              >Keep It</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROGRESS sub-page ── */}
      {tab === "progress" && (
        <ProgressPage
          activeWeek={displayWeek}
          phase={phase}
          pc={pc}
          rir={rir}
          weekDone={weekDone}
          weekTotal={weekTotal}
          weekPct={weekPct}
          weekMuscles={weekMuscles}
          mesoPct={mesoPct}
          doneSessions={doneSessions}
          totalSessions={totalSessions}
          completedDays={completedDays}
          activeDays={activeDays}
          goBack={goBack}
          goTo={goTo}
          profile={profile}
        />
      )}

            {/* ── SCHEDULE ── */}
      {tab === "schedule" && (
        <div style={{animation:"tabFadeIn 0.15s ease-out"}}>
          {/* Schedule header with Edit Schedule button */}
          <div style={{display:"flex", alignItems:"center", gap:12, padding:"16px 16px 12px", background:"var(--bg-deep)", borderBottom:"1px solid var(--border)"}}>
            <button onClick={goBack} className="btn-ghost" style={{background:"transparent", border:"none", cursor:"pointer", color:"var(--accent)", fontSize:20, lineHeight:1, padding:"2px 4px", display:"flex", alignItems:"center", minWidth:44, minHeight:44, justifyContent:"center"}}>‹</button>
            <span style={{fontSize:12, fontWeight:600, letterSpacing:"0.05em", color:"var(--text-secondary)", flex:1}}>SCHEDULE</span>
            <button
              onClick={() => setShowEditSchedule(true)}
              style={{
                padding:"6px 12px", borderRadius:6, cursor:"pointer",
                background:"var(--accent)11", border:"1px solid var(--accent)44",
                color:"var(--accent)", fontSize:12, fontWeight:700, letterSpacing:"0.04em",
              }}
            >⚙ Edit Schedule</button>
          </div>
          {/* ── CALENDAR ── */}
          <div style={{padding:"12px 0 0"}}>
            {/* ── SCHEDULE CARD — real month calendar ── */}
            {(() => {
              // Build calendar for the displayed month (offset from today)
              const today = new Date();
              const displayDate = new Date(today.getFullYear(), today.getMonth() + calendarOffset, 1);
              const year  = displayDate.getFullYear();
              const month = displayDate.getMonth(); // 0-indexed
              const monthName = displayDate.toLocaleDateString("en-US", { month:"long", year:"numeric" });
              const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
              const daysInMonth = new Date(year, month + 1, 0).getDate();

              // workoutDays per-week come from workoutDaysHistory via getWorkoutDaysForWeek()

              // Map calendar dates → meso session completedDays key
              // Start from profile.startDate, walk workout days in order.
              // Uses workoutDaysHistory so remapped weeks map to correct calendar dates.
              const startDate = profile?.startDate ? new Date(profile.startDate + "T00:00:00") : null;
              const sessionDateMap = {}; // "YYYY-MM-DD" → "dayIdx:weekIdx"
              if (startDate && activeDays.length > 0) {
                const totalSessions = (getMeso().weeks + 1) * activeDays.length;
                let sessionCount = 0;
                let cursor = new Date(startDate);
                for (let d = 0; d < 400 && sessionCount < totalSessions; d++) {
                  const wkIdx  = Math.floor(sessionCount / activeDays.length);
                  const curWkDays = getWorkoutDaysForWeek(profile, wkIdx);
                  if (curWkDays.includes(cursor.getDay())) {
                    const dayIdx = sessionCount % activeDays.length;
                    const key = cursor.toISOString().slice(0, 10);
                    sessionDateMap[key] = `${dayIdx}:${wkIdx}`;
                    sessionCount++;
                  }
                  cursor.setDate(cursor.getDate() + 1);
                }
              }

              const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const todayStr = today.toISOString().slice(0, 10);

              // Build grid cells: leading blanks + days
              const cells = [];
              for (let b = 0; b < firstDay; b++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);

              return (
                <div style={{
                  width:"100%", background:"var(--bg-card)", border:"none",
                  borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)",
                  padding:"14px 12px", textAlign:"left",
                  boxShadow:"var(--shadow-sm)",
                }}
                >
                  {/* Header */}
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      <div style={{width:26, height:26, borderRadius:5, background:"var(--phase-intens)15", display:"flex", alignItems:"center", justifyContent:"center"}}>
                        {icons.schedule("var(--phase-intens)")}
                      </div>
                      <div>
                        <div style={{fontSize:15, fontWeight:700, color:"var(--text-primary)", lineHeight:1.2}}>Schedule</div>
                        <div style={{fontSize:13, color:"var(--text-secondary)", fontWeight:600, marginTop:2}}>{monthName}</div>
                      </div>
                    </div>
                    {/* Month navigation — clamped to meso date range */}
                    {(() => {
                      // Compute min offset (month of meso start) and max offset (month of meso end + 1)
                      const startD = profile?.startDate ? new Date(profile.startDate + "T00:00:00") : null;
                      const minOffset = startD
                        ? (startD.getFullYear() - today.getFullYear()) * 12 + (startD.getMonth() - today.getMonth())
                        : -6;
                      // Meso end: startDate + (weeks+1)*7 days approx
                      const totalDays = ((getMeso().weeks || 6) + 1) * 7 + 30;
                      const endD = startD ? new Date(startD.getTime() + totalDays * 86400000) : null;
                      const maxOffset = endD
                        ? (endD.getFullYear() - today.getFullYear()) * 12 + (endD.getMonth() - today.getMonth())
                        : 6;
                      const canGoBack = calendarOffset > minOffset;
                      const canGoForward = calendarOffset < maxOffset;
                      return (
                        <div style={{display:"flex", alignItems:"center", gap:2}}>
                          <button
                            onClick={() => canGoBack && setCalendarOffset(o => o - 1)}
                            style={{
                              width:32, height:32, borderRadius:6, border:"1px solid var(--border)",
                              background:"var(--bg-inset)", cursor: canGoBack ? "pointer" : "default",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              color: canGoBack ? "var(--text-secondary)" : "var(--text-dim)",
                              fontSize:16, fontWeight:700, opacity: canGoBack ? 1 : 0.3,
                            }}
                          >‹</button>
                          {calendarOffset !== 0 && (
                            <button
                              onClick={() => setCalendarOffset(0)}
                              style={{
                                padding:"4px 8px", borderRadius:6, border:"1px solid var(--phase-intens)55",
                                background:"var(--phase-intens)11", cursor:"pointer",
                                fontSize:12, fontWeight:800, letterSpacing:"0.05em",
                                color:"var(--phase-intens)",
                              }}
                            >TODAY</button>
                          )}
                          <button
                            onClick={() => canGoForward && setCalendarOffset(o => o + 1)}
                            style={{
                              width:32, height:32, borderRadius:6, border:"1px solid var(--border)",
                              background:"var(--bg-inset)", cursor: canGoForward ? "pointer" : "default",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              color: canGoForward ? "var(--text-secondary)" : "var(--text-dim)",
                              fontSize:16, fontWeight:700, opacity: canGoForward ? 1 : 0.3,
                            }}
                          >›</button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Day-of-week headers */}
                  <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2, marginBottom:4}}>
                    {DOW.map(d => (
                      <div key={d} style={{
                        textAlign:"center", fontSize:12, fontWeight:700,
                        letterSpacing:"0.03em", color:"var(--text-secondary)", paddingBottom:4,
                      }}>{d}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2}}>
                    {cells.map((day, ci) => {
                      if (day === null) return <div key={`b${ci}`} />;

                      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                      const dow = (firstDay + day - 1) % 7;
                      const isWorkoutDay = !!sessionKey;
                      const sessionKey  = sessionDateMap[dateStr];
                      const isDone      = sessionKey ? completedDays.has(sessionKey) : false;
                      const isToday     = dateStr === todayStr;
                      const isPast      = dateStr < todayStr;
                      // Check for extra workout stored for this date
                      const extraKey = `ppl:extra:${dateStr}`;
                      const hasExtra = !!store.get(extraKey);
                      // Check for cardio session
                      const cardioSession = loadCardioSession(dateStr);
                      const hasCardio = !!cardioSession;
                      const cardioDone = cardioSession?.completed === true;

                      // Notes badge
                      let hasNotes = false;
                      let notesMeta = null;
                      if (isDone && sessionKey) {
                        const [dIdx, wIdx] = sessionKey.split(":").map(Number);
                        hasNotes = hasAnyNotes(dIdx, wIdx);
                        if (hasNotes) notesMeta = { type:"meso", dayIdx:dIdx, weekIdx:wIdx };
                      } else if (hasExtra && store.get(`ppl:extra:done:${dateStr}`) === "1") {
                        hasNotes = hasAnyExtraNotes(dateStr);
                        if (hasNotes) notesMeta = { type:"extra", dateStr };
                      }

                      // Derive phase color from the session's weekIdx
                      const sessionWeekIdx = sessionKey ? parseInt(sessionKey.split(":")[1]) : null;
                      const sessionPhase = sessionWeekIdx !== null ? (getWeekPhase()[sessionWeekIdx] || "Accumulation") : "Accumulation";
                      const sessionPc = sessionWeekIdx !== null ? (PHASE_COLOR[sessionPhase] || "var(--phase-intens)") : "var(--phase-intens)";

                      let bg = "transparent";
                      let dateColor = "var(--text-secondary)";
                      let borderColor = "transparent";
                      if (sessionKey && !isDone) {
                        bg = isPast ? sessionPc+"28" : sessionPc+"30";
                        dateColor = isPast ? sessionPc+"cc" : sessionPc;
                        borderColor = isPast ? sessionPc+"55" : sessionPc+"88";
                      } else if (isWorkoutDay && !sessionKey && !isDone) {
                        bg = "var(--bg-inset)";
                        dateColor = "var(--text-secondary)";
                      }
                      if (isDone) {
                        bg = sessionPc+"44";
                        dateColor = sessionPc;
                        borderColor = sessionPc+"99";
                      }

                      return (
                        <div
                          key={day}
                          onClick={() => {
                            if (sessionKey) {
                              const [dIdx, wIdx] = sessionKey.split(":").map(Number);
                              onSelectDayWeek(dIdx, wIdx);
                            } else if (hasExtra) {
                              onOpenExtra(dateStr);
                            } else if (hasCardio) {
                              onOpenCardio(dateStr, cardioSession?.protocolId || null);
                            } else if (!isPast || dateStr === todayStr) {
                              setShowRestDay({ dateStr, isPast: false });
                            } else if (isPast) {
                              // Past rest days — show rest content
                              setShowRestDay({ dateStr, isPast: true });
                            }
                          }}
                          style={{
                            aspectRatio:"1", borderRadius:5,
                            background:bg,
                            border: isToday
                              ? `2px solid ${isDone ? sessionPc : sessionKey ? sessionPc : "var(--phase-intens)"}`
                              : `1px solid ${borderColor}`,
                            display:"flex", flexDirection:"column",
                            alignItems:"center", justifyContent:"center", gap:1,
                            position:"relative",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{
                            fontSize: sessionKey ? 13 : 11,
                            fontWeight: isToday || sessionKey ? 800 : 500,
                            color: isToday ? (isDone ? sessionPc : sessionKey ? sessionPc : "var(--phase-intens)") : dateColor,
                            lineHeight:1,
                          }}>{day}</div>
                          {hasExtra && !hasNotes && (
                            <div style={{
                              width:5, height:5, borderRadius:"50%",
                              background:"var(--accent)", opacity:0.9,
                              position:"absolute", top:2, right:2,
                            }}/>
                          )}
                          {/* Cardio dot — bottom-right, green */}
                          {hasCardio && (
                            <div style={{
                              width:5, height:5, borderRadius:"50%",
                              background: cardioDone ? "#D4983C" : TAG_ACCENT["CARDIO"],
                              opacity: 0.9,
                              position:"absolute", bottom:2, right:2,
                            }}/>
                          )}
                          {hasNotes && (
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                // Load note data and open viewer
                                if (notesMeta.type === "meso") {
                                  const { dayIdx:dIdx, weekIdx:wIdx } = notesMeta;
                                  const day = activeDays[dIdx];
                                  setNoteViewer({
                                    type:"meso", dayIdx:dIdx, weekIdx:wIdx,
                                    label: day ? `${day.label} — W${wIdx+1}` : `Day ${dIdx+1} W${wIdx+1}`,
                                    exercises: day ? day.exercises : [],
                                    sessionNote: loadNotes(dIdx, wIdx),
                                    exNotes: loadExNotes(dIdx, wIdx),
                                  });
                                } else {
                                  const extra = (() => { try { return JSON.parse(store.get(`ppl:extra:${notesMeta.dateStr}`) || "null"); } catch { return null; } })();
                                  setNoteViewer({
                                    type:"extra", dateStr:notesMeta.dateStr,
                                    label: extra ? extra.label : "Extra Session",
                                    exercises: extra ? extra.exercises : [],
                                    sessionNote: store.get(`ppl:extra:notes:${notesMeta.dateStr}`) || "",
                                    exNotes: loadExtraExNotes(notesMeta.dateStr),
                                  });
                                }
                              }}
                              style={{
                                position:"absolute", top:2, right:2,
                                fontSize:12, lineHeight:1, cursor:"pointer",
                                filter:"drop-shadow(0 0 2px rgba(0,0,0,0.4))",
                              }}
                              title="View notes"
                            >📝</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{marginTop:10, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6}}>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      {[["Accumulation","var(--phase-accum)"],["Intensification","var(--phase-intens)"],["Peak","var(--phase-peak)"],["Deload","var(--phase-deload)"]].map(([label, color]) => (
                        <div key={label} style={{display:"flex", alignItems:"center", gap:3}}>
                          <div style={{width:10, height:10, borderRadius:3, background:color}}/>
                          <span style={{fontSize:12, color:"var(--text-muted)", fontWeight:600}}>{label.slice(0,3).toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      <div style={{display:"flex", alignItems:"center", gap:4}}>
                        <div style={{width:5, height:5, borderRadius:"50%", background:"var(--accent)"}}/>
                        <div style={{fontSize:12, color:"var(--text-muted)"}}>Extra</div>
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:4}}>
                        <div style={{width:5, height:5, borderRadius:"50%", background:"#D4983C"}}/>
                        <div style={{fontSize:12, color:"var(--text-muted)"}}>Cardio</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── MESO OVERVIEW NAV CARD ── */}
          <div style={{padding:"8px 12px 0"}}>
            {/* ── MESO OVERVIEW card — full width ── */}
            <button onClick={() => goTo("overview")} style={{
              width:"100%", background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:8, padding:"14px 16px", cursor:"pointer", textAlign:"left",
              boxShadow:"var(--shadow-sm)", transition:"border-color 0.15s, transform 0.12s",
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--phase-deload)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.99)"}
              onMouseUp={e => e.currentTarget.style.transform = "translateY(-1px)"}
            >
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div style={{width:26, height:26, borderRadius:5, background:"var(--phase-deload)18", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  {icons.overview("var(--phase-deload)")}
                </div>
                <div>
                  <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)", lineHeight:1.2}}>Meso Overview</div>
                  <div style={{fontSize:12, color:"var(--text-muted)", marginTop:1}}>Phases & session breakdown</div>
                </div>
              </div>
              {/* Phase strip */}
              <div style={{display:"flex", gap:2, alignItems:"center", marginLeft:12}}>
                {Array.from({length: getMeso().weeks}, (_, w) => {
                  const wColor = PHASE_COLOR[getWeekPhase()[w]] || "var(--accent)";
                  const isActive = w === activeWeek;
                  return <div key={w} style={{width: isActive ? 10 : 6, height:6, borderRadius:2, background:wColor, opacity: isActive ? 1 : 0.45, transition:"width 0.2s"}} />;
                })}
              </div>
            </button>

          </div>

          {/* ── WEEKLY SESSIONS ── */}
          <div style={{padding:"8px 16px 0"}}>
            <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-muted)", padding:"8px 0 10px"}}>SESSIONS BY WEEK</div>
          </div>
          <div style={{padding:"0 16px"}}>
            {Array.from({length: getMeso().weeks}, (_,w) => (
              <WeekSection
                key={w} weekIdx={w} currentWeek={activeWeek}
                onSelectDay={(dayIdx, weekIdx) => {
                  setCurrentWeek(weekIdx);
                  saveCurrentWeek(weekIdx);
                  onSelectDay(dayIdx);
                }}
                completedDays={completedDays}
                isExpanded={expandedWeek === w}
                onToggle={() => setExpandedWeek(expandedWeek === w ? null : w)}
                activeDays={activeDays}
                workoutDays={getWorkoutDaysForWeek(profile, w)}
                onSkipToggle={() => setSkipVersion(v => v + 1)}
              />
            ))}
            <DeloadSection
              currentWeek={activeWeek}
              completedDays={completedDays}
              isExpanded={expandedWeek === getMeso().weeks}
              onToggle={() => setExpandedWeek(expandedWeek === getMeso().weeks ? null : getMeso().weeks)}
              activeDays={activeDays}
              workoutDays={getWorkoutDaysForWeek(profile, getMeso().weeks)}
            />
          </div>
        </div>
      )}

      {/* ── MESO OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{animation:"tabFadeIn 0.15s ease-out"}}>
          <SubHeader label="MESO OVERVIEW" />
          <MesoOverview />
        </div>
      )}

      {/* ── DATA MANAGEMENT ── */}
      {tab === "datamgmt" && (
        <div style={{animation:"tabFadeIn 0.15s ease-out"}}>
          <SubHeader label="DATA MANAGEMENT" />
          <div style={{padding:"20px 16px", display:"flex", flexDirection:"column", gap:12}}>
            <div style={{
              background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:8, overflow:"hidden",
            }}>
              <button onClick={exportData} className="btn-row" style={{
                width:"100%", padding:"16px", cursor:"pointer", background:"transparent",
                border:"none", borderBottom:"1px solid var(--border)",
                display:"flex", alignItems:"center", gap:16, textAlign:"left",
              }}>
                <div style={{width:38,height:38,borderRadius:6,background:"rgba(var(--accent-rgb),0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⬇</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.02em",color:"var(--accent)"}}>Export backup</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Download all your workout data as JSON</div>
                </div>
                <div style={{color:"var(--text-dim)",fontSize:18}}>›</div>
              </button>
              <label style={{
                width:"100%", padding:"16px", cursor:"pointer", background:"transparent",
                borderBottom:"1px solid var(--border)",
                display:"flex", alignItems:"center", gap:16, boxSizing:"border-box",
              }}>
                <div style={{width:38,height:38,borderRadius:6,background:"rgba(var(--accent-rgb),0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⬆</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.02em",color:"var(--accent)"}}>Import backup</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Restore from a previously exported file</div>
                </div>
                <div style={{color:"var(--text-dim)",fontSize:18}}>›</div>
                <input type="file" accept=".json" style={{display:"none"}} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  importData(file, (ok) => {
                    if (ok) { alert("Data restored! Reloading..."); window.location.reload(); }
                    else { alert("Import failed — invalid backup file."); }
                  });
                }} />
              </label>
              <button onClick={()=>setShowReset(true)} className="btn-danger" style={{
                width:"100%", padding:"16px", cursor:"pointer", background:"transparent",
                border:"none", display:"flex", alignItems:"center", gap:16, textAlign:"left",
              }}>
                <div style={{width:38,height:38,borderRadius:6,background:"rgba(var(--accent-rgb),0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:12,fontWeight:800,letterSpacing:"0.04em",color:"var(--danger)"}}>RST</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.02em",color:"var(--danger)"}}>Reset meso cycle</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Erase all progress and start fresh</div>
                </div>
                <div style={{color:"var(--text-dim)",fontSize:18}}>›</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MESO HISTORY ── */}
      {tab === "history" && (
        <MesoHistory goBack={goBack} goTo={goTo} />
      )}

      {/* ── WEEKLY SUMMARY ── */}
      {tab === "weekly" && (
        <WeeklySummary activeDays={activeDays} completedDays={completedDays} goBack={goBack} profile={profile} />
      )}

      {tab === "explore" && (
        <ExplorePage profile={profile} onStartProgram={newProfile => { saveProfile(newProfile); window.location.reload(); }} />
      )}

      {/* ── BOTTOM TAB BAR ── */}
      {["landing","progress","schedule","explore"].includes(tab) && (
        <div style={{
          position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:480, zIndex:100,
          background:"var(--bg-card)", borderTop:"1px solid var(--border)",
          boxShadow:"0 -4px 20px rgba(0,0,0,0.3)",
          display:"flex", alignItems:"stretch",
          paddingBottom:"env(safe-area-inset-bottom, 0px)",
        }}>
          {[
            { key:"landing",  label:"Home",     icon:(active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"var(--accent)":"#A89A8A"} strokeWidth={active?2.5:1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
                <polyline points="9 21 9 12 15 12 15 21"/>
              </svg>
            )},
            { key:"progress", label:"Progress",  icon:(active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"var(--accent)":"#A89A8A"} strokeWidth={active?2.5:1.75} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            )},
            { key:"schedule", label:"Schedule",  icon:(active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"var(--accent)":"#A89A8A"} strokeWidth={active?2.5:1.75} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
            )},
            { key:"explore",  label:"Explore",   icon:(active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"var(--accent)":"#A89A8A"} strokeWidth={active?2.5:1.75} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            )},
          ].map(({ key, label, icon }) => {
            const active = tab === key;
            const showDot = key === "landing" && hasActiveWorkout;
            return (
              <button key={key} onClick={()=>goTo(key)} style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:4, padding:"10px 0 10px",
                background:"transparent", border:"none", cursor:"pointer",
                position:"relative",
              }}
              data-tour={key === "schedule" ? "nav-schedule" : key === "progress" ? "nav-progress" : undefined}
              >
                {/* Icon wrapper — position:relative so dot can anchor to it */}
                <div style={{position:"relative", display:"inline-flex"}}>
                  {icon(active)}
                  {showDot && (
                    <span style={{
                      position:"absolute", top:-1, right:-3,
                      width:7, height:7, borderRadius:"50%",
                      background:"var(--phase-peak)",
                      boxShadow:"0 0 5px var(--phase-peak)",
                      animation:"livePulse 1.6s ease-in-out infinite",
                      border:"1.5px solid var(--bg-card)",
                    }} />
                  )}
                </div>
                <span style={{
                  fontSize:12, fontWeight: active ? 700 : 500,
                  letterSpacing:"0.04em",
                  color: active ? "var(--accent)" : "#A89A8A",
                  transition:"color 0.15s",
                }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── REST DAY SHEET ── */}
      {showRestDay && (() => {
        // Deterministic quote by date so it doesn't change on re-render
        const dateHash = showRestDay.dateStr.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const restQuote = REST_QUOTES[dateHash % REST_QUOTES.length];

        // Figure out yesterday's session for targeted mobility
        const todayStr2 = new Date().toISOString().slice(0,10);
        const isToday = showRestDay.dateStr === todayStr2;
        const displayLabel = isToday ? "Today · Rest Day" : showRestDay.dateStr;

        // Find yesterday's session tag to target mobility
        let mobilityTag = null;
        let mobilityMoves = [];
        if (profile?.startDate && activeDays.length > 0) {
          const yesterday = new Date(showRestDay.dateStr + "T00:00:00");
          yesterday.setDate(yesterday.getDate() - 1);
          const yStr = yesterday.toISOString().slice(0,10);
          const startDate2 = new Date(profile.startDate + "T00:00:00");
          let sessionCount2 = 0;
          let cursor2 = new Date(startDate2);
          const totalSessions2 = (getMeso().weeks + 1) * activeDays.length;
          for (let d = 0; d < 400 && sessionCount2 < totalSessions2; d++) {
            const wkIdx2 = Math.floor(sessionCount2 / activeDays.length);
            const curWkDays2 = getWorkoutDaysForWeek(profile, wkIdx2);
            if (curWkDays2.includes(cursor2.getDay())) {
              const key2 = cursor2.toISOString().slice(0, 10);
              if (key2 === yStr) {
                const dayI = sessionCount2 % activeDays.length;
                mobilityTag = activeDays[dayI]?.tag || null;
                break;
              }
              sessionCount2++;
            }
            cursor2.setDate(cursor2.getDate() + 1);
          }
        }
        if (mobilityTag && FOUNDRY_COOLDOWN[mobilityTag]) {
          mobilityMoves = FOUNDRY_COOLDOWN[mobilityTag];
        } else {
          // Default: one from each
          mobilityMoves = [FOUNDRY_MOBILITY.PUSH[0], FOUNDRY_MOBILITY.PULL[0], FOUNDRY_MOBILITY.LEGS[0]];
        }

        // Next training day preview
        let nextSessionLabel = null;
        if (profile?.startDate && activeDays.length > 0) {
          const startDate3 = new Date(profile.startDate + "T00:00:00");
          let sessionCount3 = 0;
          let cursor3 = new Date(startDate3);
          const totalSessions3 = (getMeso().weeks + 1) * activeDays.length;
          const fromDate = new Date(showRestDay.dateStr + "T00:00:00");
          fromDate.setDate(fromDate.getDate() + 1);
          for (let d = 0; d < 400 && sessionCount3 < totalSessions3; d++) {
            const wkIdx3 = Math.floor(sessionCount3 / activeDays.length);
            const curWkDays3 = getWorkoutDaysForWeek(profile, wkIdx3);
            if (curWkDays3.includes(cursor3.getDay())) {
              const key3 = cursor3.toISOString().slice(0, 10);
              if (cursor3 >= fromDate) {
                const dayI = sessionCount3 % activeDays.length;
                const wkI  = Math.floor(sessionCount3 / activeDays.length);
                const nd = activeDays[dayI];
                if (nd) nextSessionLabel = `${nd.label} · W${wkI+1} · ${nd.exercises?.length || 0} exercises`;
                break;
              }
              sessionCount3++;
            }
            cursor3.setDate(cursor3.getDate() + 1);
          }
        }

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
            onClick={() => setShowRestDay(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:"14px 14px 0 0", width:"100%", maxWidth:480,
              maxHeight:"85vh", overflowY:"auto", WebkitOverflowScrolling:"touch",
              animation:"slideUp 0.25s cubic-bezier(0.34,1.1,0.64,1)",
            }}>
              {/* Handle */}
              <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
                <div style={{width:36,height:4,borderRadius:2,background:"var(--border)"}}/>
              </div>

              <div style={{padding:"8px 20px 36px"}}>
                {/* Header */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.12em",color:"var(--text-muted)",marginBottom:4}}>REST DAY</div>
                    <div style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",lineHeight:1.2}}>{displayLabel}</div>
                  </div>
                  <button onClick={() => setShowRestDay(null)} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:22,lineHeight:1,padding:"2px 6px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>

                {/* Quote */}
                <div style={{background:"var(--bg-inset)",borderRadius:8,padding:"14px 16px",marginBottom:16,border:"1px solid var(--border)"}}>
                  <div style={{fontSize:12,color:"var(--text-primary)",lineHeight:1.7,fontStyle:"italic",marginBottom:6}}>
                    "{restQuote.text}"
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--accent)",textAlign:"right"}}>— {restQuote.author}</div>
                </div>

                {/* Recovery essentials */}
                <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.08em",color:"var(--text-muted)",marginBottom:10}}>RECOVERY ESSENTIALS</div>
                {[
                  { title:"Sleep", body:"8+ hours is the only thing that actually repairs muscle tissue. No supplement replaces it. Tonight, make sleep the priority." },
                  { title:"Protein", body:"Hit your target today even without training. Muscle protein synthesis continues in recovery — shortchanging protein now blunts your gains from yesterday." },
                  { title:"Walk", body:"20–30 minutes of easy walking clears metabolic waste and keeps blood moving through sore tissue. Low intensity, high return." },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding:"12px 14px",borderRadius:8,
                    background:"var(--bg-deep)",marginBottom:8,
                    border:"1px solid var(--border-subtle)",
                    borderLeft:"3px solid var(--accent)",
                  }}>
                    <div style={{fontSize:13,fontWeight:800,color:"var(--text-primary)",marginBottom:3}}>{item.title}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6}}>{item.body}</div>
                  </div>
                ))}

                {/* Mobility */}
                <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.08em",color:"var(--text-muted)",marginTop:16,marginBottom:10}}>
                  MOBILITY{mobilityTag ? ` · POST-${mobilityTag}` : ""}
                </div>
                {mobilityMoves.map((move, i) => (
                  <div key={i} style={{
                    padding:"12px 14px",borderRadius:8,
                    background:"var(--bg-deep)",marginBottom:8,
                    border:"1px solid var(--border-subtle)",
                  }}>
                    <div style={{fontSize:13,fontWeight:800,color:"var(--text-primary)",marginBottom:3}}>{move.name}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6}}>{move.cue}</div>
                  </div>
                ))}

                {/* Next session preview */}
                {nextSessionLabel && (
                  <div style={{
                    marginTop:16,padding:"12px 14px",borderRadius:8,
                    background:"var(--accent)0d",border:"1px solid var(--accent)33",
                  }}>
                    <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.07em",color:"var(--accent)",marginBottom:4}}>UP NEXT</div>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{nextSessionLabel}</div>
                  </div>
                )}

                {/* Add session CTA — only for today/future */}
                {!showRestDay.isPast && (
                  <button
                    onClick={() => {
                      setShowRestDay(null);
                      setAddWorkoutModal({ dateStr: showRestDay.dateStr });
                      setAddWorkoutStep("type");
                      setAddWorkoutType(null);
                      setAddWorkoutDayType(null);
                    }}
                    style={{
                      width:"100%",marginTop:20,padding:"14px",borderRadius:8,
                      background:"transparent",border:"1px solid var(--border)",
                      color:"var(--text-secondary)",fontSize:13,fontWeight:700,
                      cursor:"pointer",letterSpacing:"0.03em",
                    }}
                  >+ Add Extra Session</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EDIT SCHEDULE SHEET ── */}
      {showEditSchedule && (() => {
        const DOW_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const currentDays = getWorkoutDaysForWeek(profile, currentWeek);
        const requiredCount = currentDays.length;

        const EditScheduleSheet = () => {
          const [selected, setSelected] = React.useState([...currentDays]);
          const [confirmScope, setConfirmScope] = React.useState(false); // show scope prompt
          const [pendingDays, setPendingDays] = React.useState(null);
          const countOk = selected.length === requiredCount;

          const toggleDay = (dow) => {
            setSelected(prev =>
              prev.includes(dow)
                ? prev.filter(d => d !== dow).sort((a,b)=>a-b)
                : [...prev, dow].sort((a,b)=>a-b)
            );
          };

          const handleSave = () => {
            if (!countOk) return;
            setPendingDays([...selected]);
            setConfirmScope(true);
          };

          const applyRemap = (scope) => {
            // Bootstrap history if needed
            const p = ensureWorkoutDaysHistory(profile);
            const history = [...(p.workoutDaysHistory || [])];
            const priorDays = getWorkoutDaysForWeek(p, currentWeek);

            // Remove any existing entries at or after currentWeek
            const pruned = history.filter(e => e.fromWeek < currentWeek);

            if (scope === "week") {
              // This week only: add remap entry + revert entry next week
              pruned.push({ fromWeek: currentWeek, days: pendingDays });
              pruned.push({ fromWeek: currentWeek + 1, days: priorDays });
            } else {
              // Rest of meso: add single remap entry from current week forward
              pruned.push({ fromWeek: currentWeek, days: pendingDays });
            }

            // Sort history by fromWeek
            pruned.sort((a, b) => a.fromWeek - b.fromWeek);

            const updated = { ...p, workoutDaysHistory: pruned, workoutDays: pendingDays };
            saveProfile(updated);
            // Bubble up to App so profile state refreshes
            if (onProfileUpdate) onProfileUpdate({ workoutDaysHistory: pruned, workoutDays: pendingDays });
            setShowEditSchedule(false);
          };

          if (confirmScope) {
            return (
              <div style={{padding:"8px 20px 36px"}}>
                <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20}}>
                  <div>
                    <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.12em", color:"var(--text-muted)", marginBottom:4}}>EDIT SCHEDULE</div>
                    <div style={{fontSize:17, fontWeight:800, color:"var(--text-primary)"}}>Apply to which weeks?</div>
                  </div>
                  <button onClick={() => setShowEditSchedule(false)} style={{background:"transparent", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:22, lineHeight:1, padding:"2px 6px", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center"}}>✕</button>
                </div>
                <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:20}}>
                  You're moving training to <strong style={{color:"var(--text-primary)"}}>{pendingDays.map(d => DOW_FULL[d]).join(", ")}</strong>. Should this apply to just this week, or to all remaining weeks?
                </div>
                <div style={{display:"flex", flexDirection:"column", gap:10}}>
                  <button onClick={() => applyRemap("week")} style={{
                    padding:"16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                    background:"var(--accent)11", border:"1px solid var(--accent)55",
                  }}>
                    <div style={{fontSize:14, fontWeight:800, color:"var(--accent)", marginBottom:2}}>This week only (W{currentWeek + 1})</div>
                    <div style={{fontSize:12, color:"var(--text-secondary)"}}>Reverts to current schedule next week.</div>
                  </button>
                  <button onClick={() => applyRemap("meso")} style={{
                    padding:"16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                    background:"var(--bg-surface)", border:"1px solid var(--border)",
                  }}>
                    <div style={{fontSize:14, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>Rest of meso</div>
                    <div style={{fontSize:12, color:"var(--text-secondary)"}}>Applies from W{currentWeek + 1} through the end of this cycle.</div>
                  </button>
                </div>
                <button onClick={() => setConfirmScope(false)} style={{
                  width:"100%", marginTop:12, padding:"12px", borderRadius:8,
                  background:"transparent", border:"none", color:"var(--text-muted)",
                  fontSize:13, cursor:"pointer",
                }}>← Back</button>
              </div>
            );
          }

          return (
            <div style={{padding:"8px 20px 36px"}}>
              {/* Header */}
              <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8}}>
                <div>
                  <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.12em", color:"var(--text-muted)", marginBottom:4}}>EDIT SCHEDULE</div>
                  <div style={{fontSize:17, fontWeight:800, color:"var(--text-primary)"}}>Choose training days</div>
                </div>
                <button onClick={() => setShowEditSchedule(false)} style={{background:"transparent", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:22, lineHeight:1, padding:"2px 6px", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center"}}>✕</button>
              </div>
              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:20}}>
                Select {requiredCount} day{requiredCount !== 1 ? "s" : ""} per week.
                Currently: <span style={{color:"var(--text-primary)", fontWeight:700}}>{currentDays.map(d => DOW_FULL[d]).join(", ")}</span>
              </div>

              {/* 7-day toggle grid */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6, marginBottom:20}}>
                {DOW_FULL.map((name, dow) => {
                  const isSel = selected.includes(dow);
                  return (
                    <button
                      key={dow}
                      onClick={() => toggleDay(dow)}
                      style={{
                        padding:"10px 4px", borderRadius:8, cursor:"pointer",
                        background: isSel ? "var(--accent)22" : "var(--bg-deep)",
                        border: `1px solid ${isSel ? "var(--accent)" : "var(--border)"}`,
                        color: isSel ? "var(--accent)" : "var(--text-muted)",
                        fontSize:12, fontWeight:800, letterSpacing:"0.02em",
                        transition:"all 0.12s",
                      }}
                    >{name.slice(0,2)}</button>
                  );
                })}
              </div>

              {/* Count indicator */}
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 14px", borderRadius:8, marginBottom:20,
                background: countOk ? "var(--phase-accum)11" : "var(--danger)11",
                border: `1px solid ${countOk ? "var(--phase-accum)44" : "var(--danger)44"}`,
              }}>
                <span style={{fontSize:12, color:"var(--text-secondary)"}}>
                  {selected.length} of {requiredCount} days selected
                </span>
                {countOk
                  ? <span style={{fontSize:12, fontWeight:700, color:"var(--phase-accum)"}}>✓ Ready</span>
                  : <span style={{fontSize:12, fontWeight:700, color:"var(--danger)"}}>
                      {selected.length < requiredCount ? `Need ${requiredCount - selected.length} more` : `Deselect ${selected.length - requiredCount}`}
                    </span>
                }
              </div>

              <button
                onClick={handleSave}
                disabled={!countOk}
                style={{
                  width:"100%", padding:"14px", borderRadius:8, cursor: countOk ? "pointer" : "not-allowed",
                  background: countOk ? "var(--btn-primary-bg)" : "var(--bg-deep)",
                  border: `1px solid ${countOk ? "var(--btn-primary-border)" : "var(--border)"}`,
                  color: countOk ? "var(--btn-primary-text)" : "var(--text-dim)",
                  fontSize:14, fontWeight:800, letterSpacing:"0.06em",
                  opacity: countOk ? 1 : 0.5,
                }}
              >SAVE SCHEDULE</button>
            </div>
          );
        };

        return (
          <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:400, display:"flex", alignItems:"flex-end", justifyContent:"center"}}
            onClick={() => setShowEditSchedule(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:"14px 14px 0 0", width:"100%", maxWidth:480,
              maxHeight:"85vh", overflowY:"auto", WebkitOverflowScrolling:"touch",
              animation:"slideUp 0.25s cubic-bezier(0.34,1.1,0.64,1)",
            }}>
              <div style={{display:"flex", justifyContent:"center", padding:"12px 0 4px"}}>
                <div style={{width:36, height:4, borderRadius:2, background:"var(--border)"}}/>
              </div>
              <EditScheduleSheet />
            </div>
          </div>
        );
      })()}

      {/* ── NOTE VIEWER SHEET ── */}
      {noteViewer && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={() => setNoteViewer(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:"var(--bg-card)",border:"1px solid var(--border)",
            borderRadius:"14px 14px 0 0",width:"100%",maxWidth:480,
            padding:"24px 20px 40px",maxHeight:"75vh",overflowY:"auto",
          }}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.12em",color:"var(--text-muted)",marginBottom:4}}>SESSION NOTES</div>
                <div style={{fontSize:16,fontWeight:800,color:"var(--text-primary)"}}>{noteViewer.label}</div>
              </div>
              <button onClick={() => setNoteViewer(null)} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:20,lineHeight:1,padding:"2px 4px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Per-exercise notes */}
            {noteViewer.exercises.map((ex, i) => {
              const n = (noteViewer.exNotes || {})[i] || "";
              if (!n.trim()) return null;
              return (
                <div key={i} style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--text-secondary)",letterSpacing:"0.04em",marginBottom:4}}>{ex.name}</div>
                  <div style={{fontSize:13,color:"var(--text-primary)",lineHeight:1.6,background:"var(--bg-inset)",borderRadius:6,padding:"10px 12px"}}>{n}</div>
                </div>
              );
            })}

            {/* Session note */}
            {noteViewer.sessionNote && noteViewer.sessionNote.trim() && (
              <div style={{marginTop:4}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-secondary)",letterSpacing:"0.04em",marginBottom:4}}>SESSION</div>
                <div style={{fontSize:13,color:"var(--text-primary)",lineHeight:1.6,background:"var(--bg-inset)",borderRadius:6,padding:"10px 12px"}}>{noteViewer.sessionNote}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default HomeView;
