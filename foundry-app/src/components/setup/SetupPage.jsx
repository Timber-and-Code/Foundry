import React from 'react';
import { store } from '../../utils/store';
import { callFoundryAI } from '../../utils/api';
import { EXERCISE_DB } from '../../data/exercises';
import { GOAL_OPTIONS } from '../../data/constants';
import FoundryBanner from '../shared/FoundryBanner';
import HammerIcon from '../shared/HammerIcon';

export function SetupPage({ onComplete }) {
  const ALL_EQUIPMENT = ["barbell", "dumbbell", "bodyweight", "kettlebell", "band", "machine", "cable"];
  const EQUIP_META = {
    barbell:    { label:"BARBELL",     icon:"BB" },
    dumbbell:   { label:"DUMBBELLS",   icon:"DB" },
    cable:      { label:"CABLE",       icon:"CA" },
    machine:    { label:"MACHINES",    icon:"MC" },
    bodyweight: { label:"BODYWEIGHT",  icon:"BW" },
    band:       { label:"BANDS",       icon:"BD" },
    kettlebell: { label:"KETTLEBELL",  icon:"KB" },
  };
  const SPLIT_CONFIG = {
    ppl:         { label:"Push · Pull · Legs", validDays:[3,5,6], defaultDays:{ 3:[1,3,5], 5:[1,2,3,5,6], 6:[1,2,3,4,5,6] }, desc:"Each muscle group hit 1–2×/week. The gold standard for hypertrophy and strength." },
    upper_lower: { label:"Upper / Lower",       validDays:[2,4],   defaultDays:{ 2:[1,4],   4:[1,2,4,5] },                     desc:"Upper body + lower body rotation. 2 sessions per muscle group. Great recovery balance." },
    full_body:   { label:"Full Body",            validDays:[2,3,4,5], defaultDays:{ 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,4,5] }, desc:"Push, pull, and legs every session. High frequency, great for beginners and busy schedules." },
    push_pull:   { label:"Push / Pull",          validDays:[4],     defaultDays:{ 4:[1,2,4,5] },                               desc:"4-day push/pull with legs folded in. No dedicated leg day." },
  };
  // Which splits are compatible with a given day count
  const splitsForDays = (n) => Object.entries(SPLIT_CONFIG).filter(([,c]) => c.validDays.includes(n)).map(([k]) => k);
  const DAY_NAMES = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
  const todayStr  = new Date().toISOString().split('T')[0];

  const [step, setStep]       = useState(1);
  const [pathMode, setPathMode] = useState(null); // null | "auto" | "manual"
  const [manualExStep, setManualExStep] = useState(false); // show exercise picker
  const [manualPairStep, setManualPairStep] = useState(false); // show superset pairing step
  const [dayExercises, setDayExercises] = useState({}); // {dayIndex: [exerciseId, ...]}
  const [dayPairs, setDayPairs] = useState({}); // {dayIndex: [[aIdx,bIdx], ...]}
  const [pairPickFirst, setPairPickFirst] = useState(null); // {dayIdx, exIdx} — first pick in a pairing action
  const [cardioDays, setCardioDays] = useState(new Set()); // set of day indices marked as cardio-only
  const [error, setError]     = useState("");
  const [form, setForm]       = useState(() => {
    let saved = {};
    try { saved = JSON.parse(store.get("foundry:onboarding_data") || "{}"); } catch(e) {}
    const savedGoal = store.get("foundry:onboarding_goal") || "";
    // ── Meso 2+ pre-fill from transition context ──────────────────────────────
    let transition = null;
    try { transition = JSON.parse(store.get("foundry:meso_transition") || "null"); } catch {}
    const tp = transition?.profile || null;
    return {
      name: saved.name || tp?.name || "", age: saved.age ? String(saved.age) : tp?.age ? String(tp.age) : "", gender: tp?.gender || "", weight: tp?.weight || "",
      goal: savedGoal || tp?.goal || "",
      mesoLength: tp?.mesoLength || 6,
      sessionDuration: tp?.sessionDuration || 60,
      equipment: tp?.equipment || [],
      theme: localStorage.getItem("foundry:theme") || "dark",
      startDate: todayStr,
      splitType: tp?.splitType || "ppl",
      workoutDays: tp?.workoutDays || [1,2,3,4,5,6],
      daysPerWeek: tp?.daysPerWeek || 6,
    };
  });
  // DOB state — initialized from onboarding data if present, falls back to profile birthdate
  const [setupDob, setSetupDob] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(store.get("foundry:onboarding_data") || "{}"); } catch(e) {}
    if (saved.dob && saved.dob.month) return saved.dob;
    // Fall back to profile birthdate string (YYYY-MM-DD) for returning users
    try {
      const profile = JSON.parse(store.get("foundry:profile") || "{}");
      if (profile.birthdate) {
        const parts = profile.birthdate.split("-");
        if (parts.length === 3) {
          return { year: parts[0], month: String(parseInt(parts[1])), day: String(parseInt(parts[2])) };
        }
      }
    } catch(e) {}
    return { month:"", day:"", year:"" };
  });
  const SETUP_MONTHS = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCoachNote, setAiCoachNote] = useState("");
  const [legBalancePrompt, setLegBalancePrompt] = useState(null);
  const [showCardioStep, setShowCardioStep] = useState(false);
  const [pendingProfile, setPendingProfile] = useState(null);
  const [cardioSchedule, setCardioSchedule] = useState([]);
  const [expandedCardioDow, setExpandedCardioDow] = useState(null);

  // Auto-builder specific state
  const [autoForm, setAutoForm] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(store.get("foundry:onboarding_data") || "{}"); } catch(e) {}
    return {
      experience: saved.experience || null,
      split: null,
      daysPerWeek: null,
      mesoLength: null,
      equipment:  [],
      startDate:  todayStr,
    };
  });

  // Intercept all onComplete exits — show optional cardio plan screen first
  const maybePromptCardio = (built) => {
    setPendingProfile(built);
    setShowCardioStep(true);
    window.scrollTo(0,0);
  };
  const toggleCardioDow = (dow) => {
    setCardioSchedule(prev => {
      const exists = prev.find(s => s.dayOfWeek === dow);
      if (exists) { setExpandedCardioDow(null); return prev.filter(s => s.dayOfWeek !== dow); }
      setExpandedCardioDow(dow);
      return [...prev, { dayOfWeek: dow, protocol: "zone2" }];
    });
  };
  const setCardioProtocol = (dow, protocol) => {
    setCardioSchedule(prev => prev.map(s => s.dayOfWeek === dow ? { ...s, protocol } : s));
  };
  const setAuto = (k,v) => setAutoForm(f => ({...f, [k]:v}));
  const toggleAutoEquip = (item) => {
    setAutoForm(f => {
      const has = f.equipment.includes(item);
      if (has && f.equipment.length === 1) return f;
      return {...f, equipment: has ? f.equipment.filter(e=>e!==item) : [...f.equipment, item]};
    });
  };

  const set = (k,v) => setForm(f => ({...f, [k]:v}));

  const setSplit = (split) => {
    const cfg  = SPLIT_CONFIG[split];
    const best = cfg.validDays[cfg.validDays.length - 1];
    setForm(f => ({...f, splitType:split, workoutDays:cfg.defaultDays[best], daysPerWeek:best}));
  };

  const setDayCount = (n) => {
    const compatible = splitsForDays(n);
    const split = compatible.includes(form.splitType) ? form.splitType : compatible[0] || form.splitType;
    const cfg   = SPLIT_CONFIG[split];
    const days  = cfg?.defaultDays[n] || form.workoutDays;
    setForm(f => ({...f, daysPerWeek:n, workoutDays:days, splitType:split}));
  };

  const toggleEquipment = (item) => {
    setForm(f => {
      const has = f.equipment.includes(item);
      if (has && f.equipment.length === 1) return f;
      return {...f, equipment: has ? f.equipment.filter(e=>e!==item) : [...f.equipment, item]};
    });
  };

  const toggleDay = (dayNum) => {
    setForm(f => {
      const has  = f.workoutDays.includes(dayNum);
      if (has && f.workoutDays.length === 1) return f;
      const next = has ? f.workoutDays.filter(d=>d!==dayNum) : [...f.workoutDays, dayNum].sort((a,b)=>a-b);
      return {...f, workoutDays:next, daysPerWeek:next.length};
    });
  };

  const goNext = () => {
    setError("");
    if (step === 1) {
      if (!form.name.trim()) { setError("Please enter your name."); return; }
      if (!form.gender)      { setError("Please select a gender."); return; }
      setPathMode(null); // reset path choice if going back and forward
    }
    setStep(2); window.scrollTo(0,0);
  };

  const handleAutoSubmit = async () => {
    setError("");
    if (!autoForm.split)            { setError("Select a training split."); return; }
    if (!autoForm.daysPerWeek)      { setError("Select how many days per week."); return; }
    if (!autoForm.mesoLength)       { setError("Select a meso length."); return; }
    // experience pre-filled from onboarding — not validated here
    if (autoForm.equipment.length === 0) { setError("Select at least one equipment type."); return; }

    const sessMap = { beginner:60, intermediate:75, experienced:90 };
    const daysMap = {
      ppl:         { 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,5,6], 6:[1,2,3,4,5,6] },
      upper_lower: { 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,5,6] },
      full_body:   { 2:[1,4], 3:[1,3,5], 4:[1,2,4,5] },
    };
    const workoutDays = (daysMap[autoForm.split] || daysMap.ppl)[autoForm.daysPerWeek] || [1,2,3,4,5,6];
    const goalOption = GOAL_OPTIONS.find(g => g.id === form.goal);
    const derivedPriority = goalOption?.priority || "both";
    const derivedGoal = goalOption ? goalOption.label : `${autoForm.experience} ${autoForm.split} program`;

    const built = {
      name: form.name, age: String(ageFromDob(setupDob) || form.age || ""), gender: form.gender,
      dob: setupDob,
      weight: form.weight, theme: form.theme,
      startDate: autoForm.startDate,
      goal: form.goal || "",
      goalLabel: derivedGoal,
      equipment: autoForm.equipment,
      experience: autoForm.experience,
      priority: derivedPriority,
      splitType: autoForm.split,
      daysPerWeek: autoForm.daysPerWeek,
      workoutDays,
      mesoLength: autoForm.mesoLength,
      sessionDuration: sessMap[autoForm.experience] || 60,
      autoBuilt: true,
    };
    setAiLoading(true);
    setAiCoachNote("");
    setError("");

    try {
      const result = await callFoundryAI({
        split: autoForm.split,
        daysPerWeek: autoForm.daysPerWeek,
        mesoLength: autoForm.mesoLength,
        experience: autoForm.experience,
        equipment: autoForm.equipment,
        name: form.name,
        gender: form.gender,
        goal: form.goal || "",
        goalNote: form.goalNote || "",
      });

      const aiBuilt = {
        name: form.name, age: String(ageFromDob(setupDob) || form.age || ""), gender: form.gender,
        dob: setupDob,
        weight: form.weight, theme: form.theme,
        startDate: autoForm.startDate,
        goal: form.goal || "",
        goalLabel: derivedGoal,
        equipment: autoForm.equipment,
        experience: autoForm.experience,
        priority: derivedPriority,
        splitType: autoForm.split,
        daysPerWeek: autoForm.daysPerWeek,
        workoutDays,
        mesoLength: autoForm.mesoLength,
        sessionDuration: sessMap[autoForm.experience] || 60,
        autoBuilt: true,
        aiDays: result.days,
        aiCoachNote: result.coachNote,
      };

      if (result.coachNote) setAiCoachNote(result.coachNote);
      setAiLoading(false);
      maybePromptLegBalance(aiBuilt);

    } catch (err) {
      setAiLoading(false);
      const isTimeout = err.name === "AbortError";
      setError(isTimeout
        ? "The Foundry took too long to respond — using a program built from your selections instead."
        : "Couldn't reach The Foundry — using a program built from your selections instead."
      );
      // Fallback: build locally from selections, still a solid program
      maybePromptLegBalance(built);
    }
  };

  // Helper: intercept 5-day PPL before calling onComplete — ask about leg balance
  const maybePromptLegBalance = (built) => {
    if (built.splitType === "ppl" && (built.daysPerWeek === 5 || built.workoutDays?.length === 5)) {
      setLegBalancePrompt(built);
    } else {
      maybePromptCardio(built);
    }
  };

  const handleSubmit = () => {
    setError("");
    if (form.equipment.length === 0) { setError("Select at least one equipment type."); return; }
    const cfg = SPLIT_CONFIG[form.splitType];
    if (cfg && !cfg.validDays.includes(form.workoutDays.length)) {
      setError(`${cfg.label} needs ${cfg.validDays.join(" or ")} training days — you have ${form.workoutDays.length} selected.`);
      return;
    }
    maybePromptLegBalance(form);
  };

  // ── Shared style atoms ─────────────────────────────────────────────────
  const inputStyle = {
    width:"100%", background:"var(--bg-input)", border:"1px solid var(--border-accent)",
    borderRadius:6, color:"var(--text-primary)", fontSize:16, padding:"16px",
    outline:"none", fontFamily:"inherit", marginTop:8, boxSizing:"border-box",
  };
  const sLabel = { fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--phase-intens)", display:"block", marginBottom:0 };
  const sec    = { marginBottom:24 };

  // ── Schedule preview (used in step 2) ─────────────────────────────────
  const sessionSeq = () => {
    const n = form.workoutDays.length;
    if (form.splitType === "ppl")
      return n >= 6 ? ["PUSH", "PULL", "LEGS"]
           : n >= 5 ? ["PUSH", "PULL", "LEGS"]
           :          ["PUSH", "PULL", "LEGS"];
    if (form.splitType === "upper_lower")
      return n >= 4 ? ["UPPER", "LOWER"] : ["UPPER", "LOWER"];
    if (form.splitType === "full_body")
      return ["FULL A", "FULL B", "FULL C"].slice(0, n);
    if (form.splitType === "push_pull")
      return ["PUSH A", "PULL A", "PUSH B", "PULL B"].slice(0, n);
    return [];
  };
  const tagColor = (tag) =>
    tag.startsWith("PUSH") ? "var(--tag-push)"
    : tag.startsWith("PULL") ? "var(--tag-pull)"
    : tag.startsWith("LEGS") ? "var(--tag-legs)"
    : tag.startsWith("UPPER") ? "var(--phase-peak)"
    : tag.startsWith("LOWER") ? "var(--accent-blue)"
    : "var(--phase-deload)";

  const mesoEnd = (() => {
    if (!form.startDate) return null;
    const s = new Date(form.startDate + "T00:00:00");
    const e = new Date(s.getTime() + form.mesoLength * 7 * 86400000 - 86400000);
    return e.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
  })();

  const SchedulePreview = () => {
    const seq = sessionSeq();
    return (
      <div style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden"}}>
        <div style={{padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span style={{fontSize:12, fontWeight:600, letterSpacing:"0.04em", color:"var(--text-muted)"}}>Weekly schedule</span>
          <span style={{fontSize:12, fontWeight:700, color:"var(--accent)"}}>{form.workoutDays.length}×/WEEK</span>
        </div>
        <div style={{display:"flex", padding:"8px"}}>
          {DAY_NAMES.map((d, i) => {
            const idx   = form.workoutDays.indexOf(i);
            const isOn  = idx !== -1;
            const label = isOn ? seq[idx] : null;
            return (
              <div key={i} style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                padding:"8px 2px", borderRadius:9, margin:"0 1px",
                background: isOn ? "rgba(var(--accent-rgb),0.07)" : "transparent",
              }}>
                <span style={{fontSize:12, fontWeight:700, color: isOn ? "var(--text-secondary)" : "var(--text-dim)", letterSpacing:"0.06em"}}>{d}</span>
                {isOn
                  ? <span style={{fontSize:12, fontWeight:700, color:tagColor(label), letterSpacing:"0.03em", textAlign:"center", lineHeight:1.3}}>{label}</span>
                  : <span style={{fontSize:12, color:"var(--border-accent)"}}>REST</span>}
              </div>
            );
          })}
        </div>
        {mesoEnd && (
          <div style={{padding:"8px 16px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-muted)"}}>
            <span>Start <b style={{color:"var(--text-primary)"}}>{new Date(form.startDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</b></span>
            <span>End <b style={{color:"var(--text-primary)"}}>{mesoEnd}</b></span>
          </div>
        )}
      </div>
    );
  };

  // ── Progress header ────────────────────────────────────────────────────
  const Header = () => {
    const isPathSelect = step === 2 && pathMode === null;
    const isAutoInputs = step === 2 && pathMode === "auto";
    const isManual     = step === 2 && pathMode === "manual";
    const progressPct  = step === 1 ? "33%" : isPathSelect ? "55%" : "100%";
    const title = step === 1 ? "About You" : isPathSelect ? "Build Mode" : isAutoInputs ? "Quick Build" : "Your Program";
    const subtitle = step === 1 ? "Step 1 of 2" : isPathSelect ? "Step 2 of 2" : isAutoInputs ? "Foundry Auto-Build" : "Manual Setup";

    const handleBack = () => {
      setError("");
      if (manualPairStep) { setManualPairStep(false); window.scrollTo(0,0); return; }
      if (manualExStep) { setManualExStep(false); window.scrollTo(0,0); return; }
      if (isAutoInputs || isPathSelect) {
        if (isAutoInputs) setPathMode(null);
        else { setStep(1); setPathMode(null); }
        window.scrollTo(0,0);
      } else {
        setStep(1); window.scrollTo(0,0);
      }
    };

    return (
      <div style={{padding:"20px 20px 0"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          <div>
            <div style={{fontSize:12, fontWeight:600, letterSpacing:"0.05em", color:"var(--phase-intens)"}}>
              {subtitle}
            </div>
            <div style={{fontSize:18, fontWeight:700, color:"var(--text-primary)", marginTop:4, letterSpacing:"0.01em"}}>
              {title}
            </div>
          </div>
          {step === 2 && (
            <button onClick={handleBack} style={{
              background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:6,
              padding:"8px 16px", cursor:"pointer", fontSize:12, fontWeight:600,
              color:"var(--text-secondary)", letterSpacing:"0.02em",
            }}>‹ Back</button>
          )}
        </div>
        <div style={{height:3, background:"var(--bg-surface)", borderRadius:99, overflow:"hidden"}}>
          <div style={{
            height:"100%", borderRadius:99, background:"var(--accent)",
            width: progressPct,
            transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}/>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <>
    <div style={{minHeight:"100vh", background:"var(--bg-root)", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto"}}>

      {/* Foundry Banner */}
      <FoundryBanner subtitle="MESOCYCLE SETUP" />
      {/* Meso 2+ continuation banner */}
      {(() => {
        let t = null;
        try { t = JSON.parse(store.get("foundry:meso_transition") || "null"); } catch {}
        if (!t) return null;
        return (
          <div style={{
            margin:"12px 20px 0", padding:"10px 14px",
            background:"var(--phase-accum)11", border:"1px solid var(--phase-accum)33",
            borderRadius:8, display:"flex", alignItems:"center", gap:10,
          }}>
            <div style={{flex:1}}>
              <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--phase-accum)", marginBottom:2}}>MESO 2 — CONTINUING YOUR PROGRESS</div>
              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.5}}>
                Your previous settings are pre-loaded. Change anything you want, then build.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Content */}
      <div style={{flex:1, overflowY:"auto"}}>
        <Header />

        {/* ─── STEP 1 ─── */}
        {step === 1 && (
          <div style={{padding:"24px 20px 40px"}}>

            {/* Name */}
            <div style={sec}>
              <label style={sLabel}>Your name *</label>
              <input type="text" placeholder="First name" value={form.name}
                onChange={e=>set("name",e.target.value)} style={inputStyle} autoFocus />
            </div>

            {/* Gender */}
            <div style={sec}>
              <label style={sLabel}>Gender *</label>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
                {[["m", "Male ♂"],["f", "Female ♀"]].map(([val,lbl]) => (
                  <button key={val} onClick={()=>set("gender",val)} style={{
                    padding:"16px", borderRadius:6, cursor:"pointer",
                    fontWeight:700, fontSize:14, letterSpacing:"0.03em",
                    background: form.gender===val ? "rgba(var(--accent-rgb),0.14)" : "var(--bg-card)",
                    border:`1px solid ${form.gender===val ? "var(--accent)" : "var(--border)"}`,
                    color: form.gender===val ? "var(--accent)" : "var(--text-primary)",
                    transition:"all 0.15s",
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Date of Birth + Weight */}
            <div style={{...sec}}>
              <div style={{marginBottom:16}}>
                <label style={sLabel}>Date of Birth</label>
                <div style={{display:"grid", gridTemplateColumns:"2fr 1fr 1.5fr", gap:8, marginTop:8}}>
                  {/* Month */}
                  <select
                    value={setupDob.month}
                    onChange={e => setSetupDob(d => ({...d, month: e.target.value}))}
                    style={{
                      ...inputStyle, marginTop:0, padding:"14px 10px",
                      appearance:"none", WebkitAppearance:"none",
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:28,
                    }}
                  >
                    <option value="">Month</option>
                    {SETUP_MONTHS.map((m, i) => (
                      <option key={i} value={String(i+1)}>{m}</option>
                    ))}
                  </select>
                  {/* Day */}
                  <select
                    value={setupDob.day}
                    onChange={e => setSetupDob(d => ({...d, day: e.target.value}))}
                    style={{
                      ...inputStyle, marginTop:0, padding:"14px 10px",
                      appearance:"none", WebkitAppearance:"none",
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:28,
                    }}
                  >
                    <option value="">Day</option>
                    {Array.from({length:31},(_,i)=>i+1).map(d => <option key={d} value={String(d)}>{d}</option>)}
                  </select>
                  {/* Year */}
                  <select
                    value={setupDob.year}
                    onChange={e => setSetupDob(d => ({...d, year: e.target.value}))}
                    style={{
                      ...inputStyle, marginTop:0, padding:"14px 10px",
                      appearance:"none", WebkitAppearance:"none",
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:28,
                    }}
                  >
                    <option value="">Year</option>
                    {Array.from({length:new Date().getFullYear()-1929},(_,i)=>new Date().getFullYear()-i).map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </div>
                {/* Free tier callout — live as DOB changes */}
                {(() => {
                  const age = ageFromDob(setupDob);
                  if (age === null) return null;
                  const isYoung = age < 18, isSenior = age >= 62;
                  if (!isYoung && !isSenior) return null;
                  return (
                    <div style={{
                      marginTop:10, padding:"10px 12px", borderRadius:6,
                      background:"var(--phase-accum)12", border:"1px solid var(--phase-accum)44",
                      display:"flex", alignItems:"center", gap:8,
                    }}>
                      
                      <span style={{fontSize:12, color:"var(--phase-accum)", fontWeight:600, lineHeight:1.4}}>
                        {isYoung
                          ? "The Foundry is permanently free for users under 18."
                          : "The Foundry is permanently free for adults 62 and over."}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label style={sLabel}>Weight (lbs)</label>
                <input type="number" inputMode="decimal" placeholder="e.g. 185"
                  value={form.weight} onChange={e=>set("weight",e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Goal */}
            {(() => {
              const onboardingGoal = store.get("foundry:onboarding_goal");
              return (
                <div style={sec}>
                  <label style={sLabel}>Goal for this meso</label>
                  {onboardingGoal && form.goal && (
                    <div style={{fontSize:11, color:"var(--text-muted)", marginTop:4, marginBottom:2}}>Pre-filled from onboarding — change anytime</div>
                  )}
                  {(
                    <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:8}}>
                      {GOAL_OPTIONS.map(g => {
                        const sel = form.goal === g.id;
                        return (
                          <button key={g.id} onClick={() => set("goal", sel ? "" : g.id)} style={{
                            padding:"14px 16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                            background: sel ? "rgba(var(--accent-rgb),0.10)" : "var(--bg-card)",
                            border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                            transition:"all 0.15s",
                            display:"flex", alignItems:"center", gap:12,
                          }}>
                            <div style={{
                              width:8, height:8, borderRadius:"50%", flexShrink:0,
                              background: sel ? "var(--accent)" : "var(--border)",
                              transition:"background 0.15s",
                            }}/>
                            <div>
                              <div style={{fontSize:14, fontWeight:700, color: sel ? "var(--accent)" : "var(--text-primary)", marginBottom:2}}>{g.label}</div>
                              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.4}}>{g.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <textarea
                    placeholder="Anything else? (optional — e.g. powerlifting meet in 12 weeks, coming back from injury...)"
                    value={typeof form.goal === "string" && !GOAL_OPTIONS.find(g => g.id === form.goal) ? form.goal : form.goalNote || ""}
                    onChange={e => set("goalNote", e.target.value)}
                    style={{...inputStyle, minHeight:64, resize:"vertical", lineHeight:1.6, marginTop:10}}
                  />
                </div>
              );
            })()}

            {/* Error */}
            {error && <div style={{background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:6, padding:"12px 16px", marginBottom:16, fontSize:13, color:"var(--danger)"}}>{error}</div>}

            <button onClick={goNext} className="btn-primary" style={{
              width:"100%", padding:"20px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)",
              border:"1px solid var(--btn-primary-border)",
              color:"var(--btn-primary-text)", fontSize:16, fontWeight:800, letterSpacing:"0.04em",
              boxShadow:"0 4px 24px rgba(var(--accent-rgb),0.3)",
            }}>Continue →</button>

          </div>
        )}

        {/* ─── PATH SELECT ─── */}
        {step === 2 && pathMode === null && (
          <div style={{padding:"24px 20px 40px"}}>
            <p style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:20}}>
              Hey <strong style={{color:"var(--text-primary)"}}>{form.name}</strong> — how do you want to build your meso?
            </p>

            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              <button
                onClick={() => { setPathMode("auto"); window.scrollTo(0,0); }}
                className="btn-card"
                style={{
                  width:"100%", textAlign:"left", cursor:"pointer",
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  borderRadius:8, padding:"18px 20px", transition:"all 0.15s",
                }}
              >
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:800, letterSpacing:"0.03em", color:"var(--text-primary)", marginBottom:4}}>
                      The Foundry builds my meso
                    </div>
                    <div style={{fontSize:12, color:"var(--text-muted)", lineHeight:1.5}}>
                      Answer 3 questions · The Foundry selects your exercises, sets, reps, and progressions
                    </div>
                  </div>
                  <div style={{
                    fontSize:12, fontWeight:700, letterSpacing:"0.06em", padding:"3px 8px",
                    borderRadius:5, background:"rgba(var(--accent-rgb),0.15)", color:"var(--accent)",
                    flexShrink:0, marginLeft:12,
                  }}>AUTO</div>
                </div>
              </button>

              <button
                onClick={() => { setPathMode("manual"); window.scrollTo(0,0); }}
                className="btn-card"
                style={{
                  width:"100%", textAlign:"left", cursor:"pointer",
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  borderRadius:8, padding:"18px 20px", transition:"all 0.15s",
                }}
              >
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:800, letterSpacing:"0.03em", color:"var(--text-primary)", marginBottom:4}}>
                      I'll build my own meso
                    </div>
                    <div style={{fontSize:12, color:"var(--text-muted)", lineHeight:1.5}}>
                      Choose split, days, meso length · select target muscles per day
                    </div>
                  </div>
                  <div style={{
                    fontSize:12, fontWeight:700, letterSpacing:"0.06em", padding:"3px 8px",
                    borderRadius:5, background:"var(--bg-surface)", color:"var(--text-muted)",
                    flexShrink:0, marginLeft:12,
                  }}>MANUAL</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─── AUTO BUILDER INPUTS ─── */}
        {step === 2 && pathMode === "auto" && (
          <div style={{padding:"24px 20px 40px"}}>

            {/* AI Loading overlay */}
            {aiLoading && (
              <div style={{
                position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:24, padding:32,
              }}>
                <FoundryBanner subtitle="BUILDING YOUR PROGRAM" />
                <div style={{textAlign:"center"}}>
                  <div style={{
                    width:64, height:64, borderRadius:"50%",
                    border:"3px solid var(--border)", borderTopColor:"var(--accent)",
                    animation:"spin 1s linear infinite", margin:"0 auto 20px",
                  }}/>
                  <div style={{fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"0.02em"}}>
                    The Foundry is building your meso...
                  </div>
                  <div style={{fontSize:12, color:"var(--text-muted)", marginTop:8, lineHeight:1.6, maxWidth:280}}>
                    The Foundry is selecting exercises, setting progressive overload targets, and sequencing your training week.
                  </div>
                </div>
              </div>
            )}

            {/* Q1: Training Split */}
            <div style={sec}>
              <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--accent)", marginBottom:6}}>QUESTION 1 OF 3</div>
              <label style={{...sLabel, fontSize:15, letterSpacing:"0.01em", color:"var(--text-primary)"}}>What training split?</label>
              <div style={{fontSize:12, color:"var(--text-muted)", marginTop:4, marginBottom:12}}>
                How your weekly sessions are organized
              </div>
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {[
                  ["full_body", "FULL BODY", "Every session", "Push + pull + legs every workout. High frequency, great for beginners and time-constrained schedules. Each muscle trained 2-3×/week."],
                  ["upper_lower", "UPPER / LOWER", "2-session rotation", "Upper body and lower body alternate. Each area trained 2× per week. Excellent balance of frequency and recovery."],
                  ["ppl", "PUSH / PULL / LEGS", "Classic 3-way split", "Chest-shoulders-triceps, back-biceps, legs. The gold standard for hypertrophy. Each muscle hit 1-2×/week on 3-6 days."],
                  ["push_pull", "PUSH / PULL", "4-day split", "Push and pull alternate with legs integrated into each session. No dedicated leg day, 4 days per week."],
                ].map(([val, label, badge, desc]) => {
                  const sel = autoForm.split === val;
                  return (
                    <button key={val} onClick={() => setAuto("split", val)} className="btn-card" style={{
                      padding:"18px 16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(var(--accent-rgb),0.10)" : "var(--bg-card)",
                      border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      transition:"all 0.15s",
                    }}>
                      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:6}}>
                        {sel && <div style={{width:8,height:8,borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>}
                        <span style={{fontSize:14, fontWeight:800, letterSpacing:"0.03em", color: sel ? "var(--accent)" : "var(--text-primary)"}}>{label}</span>
                        <span style={{
                          marginLeft:"auto", fontSize:12, fontWeight:700, letterSpacing:"0.05em",
                          padding:"3px 8px", borderRadius:6,
                          background: sel ? "rgba(var(--accent-rgb),0.18)" : "var(--bg-surface)",
                          color: sel ? "var(--accent)" : "var(--text-muted)",
                          whiteSpace:"nowrap",
                        }}>{badge}</span>
                      </div>
                      <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.55, paddingLeft: sel ? 18 : 0}}>{desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q2: Days/week + Meso length */}
            <div style={sec}>
              <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--accent)", marginBottom:6}}>QUESTION 2 OF 3</div>
              <label style={{...sLabel, fontSize:15, letterSpacing:"0.01em", color:"var(--text-primary)"}}>Volume & duration</label>
              <div style={{fontSize:12, color:"var(--text-muted)", marginTop:4, marginBottom:14}}>
                How often will you train, and how long is this block?
              </div>
              {/* DAYS PER WEEK */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-secondary)", marginBottom:8}}>DAYS PER WEEK</div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8}}>
                  {[2,3,4,5,6].map(n => {
                    const validForSplit = !autoForm.split || {
                      full_body: [2,3,4], upper_lower: [2,3,4,5], ppl: [3,5,6], push_pull: [4]
                    }[autoForm.split]?.includes(n);
                    const sel = autoForm.daysPerWeek === n;
                    return (
                      <button key={n} onClick={()=>!autoForm.split||validForSplit?setAuto("daysPerWeek",n):null}
                        className="btn-toggle" style={{
                        padding:"12px 4px", borderRadius:6, cursor: validForSplit||!autoForm.split?"pointer":"not-allowed",
                        textAlign:"center",
                        background: sel ? "rgba(var(--accent-rgb),0.14)" : validForSplit||!autoForm.split ? "var(--bg-card)" : "var(--bg-inset)",
                        border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        opacity: !autoForm.split||validForSplit ? 1 : 0.35,
                      }}>
                        <span style={{fontSize:14, fontWeight:800, color:sel?"var(--accent)":"var(--text-primary)"}}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* MESO LENGTH */}
              <div>
                <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-secondary)", marginBottom:8}}>MESO LENGTH</div>
                <div style={{display:"flex", gap:8}}>
                  {[
                    [4, "4 wk"],
                    [6, "6 wk"],
                    [8, "8 wk"],
                    [12,"12 wk"],
                  ].map(([n, label]) => {
                    const sel = autoForm.mesoLength === n;
                    return (
                      <button key={n} onClick={()=>setAuto("mesoLength",n)}
                        className="btn-toggle" style={{
                        flex:1, padding:"12px 4px", borderRadius:6, cursor:"pointer", textAlign:"center",
                        background: sel ? "rgba(var(--accent-rgb),0.14)" : "var(--bg-card)",
                        border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      }}>
                        <span style={{fontSize:14, fontWeight:800, color:sel?"var(--accent)":"var(--text-primary)"}}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Experience — pre-filled from onboarding, shown read-only */}
            {autoForm.experience && (
              <div style={sec}>
                <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--accent)", marginBottom:6}}>QUESTION 3 OF 3</div>
                <label style={{...sLabel, fontSize:15, letterSpacing:"0.01em", color:"var(--text-primary)"}}>Experience level</label>
                <div style={{marginTop:10, padding:"14px 16px", borderRadius:8, background:"rgba(var(--accent-rgb),0.08)", border:"1px solid var(--accent)44", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <span style={{fontSize:14, fontWeight:700, color:"var(--text-primary)"}}>
                    {autoForm.experience === "new" ? "Under 1 year" : autoForm.experience === "intermediate" ? "1–3 years" : "3+ years"}
                  </span>
                  <span style={{fontSize:12, color:"var(--text-muted)"}}>set during onboarding</span>
                </div>
              </div>
            )}

            {/* Equipment */}
            <div style={sec}>
              <label style={{...sLabel, fontSize:15, letterSpacing:"0.01em", color:"var(--text-primary)"}}>Available equipment *</label>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
                {["barbell","dumbbell","bodyweight","kettlebell","band","machine","cable"].map(val => {
                  const names = { barbell:"Barbell", dumbbell:"Dumbbells", bodyweight:"Bodyweight", kettlebell:"Kettlebell", band:"Bands", machine:"Machines", cable:"Cable" };
                  const sel = autoForm.equipment.includes(val);
                  return (
                    <button key={val} onClick={()=>toggleAutoEquip(val)} className="btn-toggle" style={{
                      padding:"12px 14px", borderRadius:6, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(var(--accent-rgb),0.14)" : "var(--bg-card)",
                      border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      transition:"all 0.15s",
                      display:"flex", alignItems:"center", gap:10,
                    }}>
                      <div style={{
                        width:18, height:18, borderRadius:4, flexShrink:0, border:`1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        background: sel ? "var(--accent)" : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:13, fontWeight:700, color: sel ? "var(--accent)" : "var(--text-primary)"}}>{names[val]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start date */}
            <div style={sec}>
              <label style={sLabel}>Start date</label>
              <input type="date" value={autoForm.startDate}
                onChange={e => setAuto("startDate", e.target.value)}
                style={{...inputStyle, colorScheme: "dark"}}
              />
            </div>

            {/* Program summary preview */}
            {autoForm.split && autoForm.daysPerWeek && autoForm.mesoLength && autoForm.experience && (
              <div style={{
                background:"rgba(var(--accent-rgb),0.06)", border:"1px solid rgba(var(--accent-rgb),0.25)",
                borderRadius:8, padding:"18px 16px", marginBottom:24,
              }}>
                <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.06em", color:"var(--accent)", marginBottom:12}}>
                  THE FOUNDRY WILL DESIGN
                </div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                  {[
                    ["Split", ({ppl:"Push · Pull · Legs", upper_lower:"Upper / Lower", full_body:"Full Body"})[autoForm.split]],
                    ["Length", `${autoForm.mesoLength}-week meso`],
                    ["Frequency", `${autoForm.daysPerWeek} days/week`],
                    ["Level", autoForm.experience.charAt(0).toUpperCase()+autoForm.experience.slice(1)],
                  ].map(([k,v]) => (
                    <div key={k} style={{background:"var(--bg-card)", borderRadius:8, padding:"10px 12px"}}>
                      <div style={{fontSize:12, color:"var(--text-muted)", fontWeight:700, letterSpacing:"0.04em", marginBottom:3}}>{k.toUpperCase()}</div>
                      <div style={{fontSize:12, color:"var(--text-primary)", fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12, color:"var(--text-secondary)", marginTop:12, lineHeight:1.5}}>
                  The Foundry will select exercises, set progression targets, and sequence your week for maximum results.
                </div>
              </div>
            )}

            {/* Error */}
            {error && <div style={{background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:6, padding:"12px 16px", marginBottom:16, fontSize:13, color:"var(--danger)"}}>{error}</div>}

            <button onClick={handleAutoSubmit} disabled={aiLoading} className="btn-primary" style={{
              width:"100%", padding:"20px", borderRadius:6, cursor: aiLoading ? "not-allowed" : "pointer",
              background:"var(--btn-primary-bg)",
              border:"1px solid var(--btn-primary-border)",
              color:"var(--btn-primary-text)", fontSize:17, fontWeight:800, letterSpacing:"0.04em",
              boxShadow:"0 4px 24px rgba(var(--accent-rgb),0.35)",
              opacity: aiLoading ? 0.7 : 1,
            }}>
              {aiLoading ? "Building..." : "Build My Meso →"}
            </button>
          </div>
        )}

        {/* ─── STEP 2 MANUAL ─── */}
        {step === 2 && pathMode === "manual" && !manualExStep && (
          <div style={{padding:"24px 20px 40px"}}>

            {/* Training split */}
            <div style={sec}>
              <label style={sLabel}>Training split *</label>
              <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:8}}>
                {[
                  ["full_body", "Full Body", "All muscle groups every session. 2–3 days/week."],
                  ["upper_lower", "Upper / Lower", "Upper and lower body alternate. 2 or 4 days/week."],
                  ["ppl", "Push / Pull / Legs", "Classic 3-way split. 3, 5, or 6 days/week."],
                ].map(([key, label, desc]) => {
                  const sel = form.splitType === key;
                  const validDaysForSplit = SPLIT_CONFIG[key]?.validDays || [];
                  return (
                    <button key={key} onClick={()=>{ setSplit(key); setDayExercises({}); }} className="btn-card" style={{
                      padding:"16px", borderRadius:8, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(var(--accent-rgb),0.1)" : "var(--bg-card)",
                      border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                    }}>
                      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4}}>
                        <span style={{fontSize:13, fontWeight:700, color:sel?"var(--accent)":"var(--text-primary)"}}>{label}</span>
                        <span style={{
                          marginLeft:"auto", fontSize:12, fontWeight:600, letterSpacing:"0.04em",
                          padding:"2px 8px", borderRadius:4,
                          background: sel ? "rgba(var(--accent-rgb),0.15)" : "var(--bg-surface)",
                          color: sel ? "var(--accent)" : "var(--text-muted)",
                        }}>{validDaysForSplit.join("/")}d</span>
                      </div>
                      <div style={{fontSize:12, color:"var(--text-muted)", lineHeight:1.5}}>{desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Days per week */}
            <div style={sec}>
              <label style={sLabel}>Days per week *</label>
              <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginTop:8}}>
                {[2,3,4,5,6].map(n => {
                  const validDays = SPLIT_CONFIG[form.splitType]?.validDays || [2,3,4,5,6];
                  const valid = validDays.includes(n);
                  const active = form.workoutDays.length === n;
                  return (
                    <button key={n} onClick={()=>valid?setDayCount(n):null} style={{
                      padding:"16px 4px", borderRadius:6, cursor: valid ? "pointer" : "not-allowed",
                      fontWeight:700, fontSize:16, letterSpacing:"0.02em",
                      background: active ? "rgba(var(--accent-rgb),0.14)" : valid ? "var(--bg-card)" : "var(--bg-inset)",
                      border:`1px solid ${active ? "var(--accent)" : valid ? "var(--border)" : "var(--border)"}`,
                      color: active ? "var(--accent)" : valid ? "var(--text-primary)" : "var(--text-dim)",
                      opacity: valid ? 1 : 0.35,
                      transition:"all 0.15s",
                    }}>
                      {n}
                      <div style={{fontSize:12, fontWeight:700, marginTop:4, color: active ? "var(--accent)" : "var(--text-secondary)", opacity: valid ? 1 : 0.7}}>DAYS</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meso length */}
            <div style={sec}>
              <label style={sLabel}>Meso cycle length *</label>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:8}}>
                {[[4,"SHORT"],[6,"STANDARD"],[8,"EXTENDED"],[12,"LONG"]].map(([n,tag]) => (
                  <button key={n} onClick={()=>set("mesoLength",n)} style={{
                    padding:"14px 4px", borderRadius:6, cursor:"pointer", textAlign:"center",
                    fontWeight:700, fontSize:18, letterSpacing:"0.02em",
                    background: form.mesoLength===n ? "rgba(var(--accent-rgb),0.14)" : "var(--bg-card)",
                    border:`1px solid ${form.mesoLength===n ? "var(--accent)" : "var(--border)"}`,
                    color: form.mesoLength===n ? "var(--accent)" : "var(--text-primary)",
                    transition:"all 0.15s",
                  }}>
                    {n}
                    <div style={{fontSize:12,fontWeight:700,marginTop:4,letterSpacing:"0.04em", color: form.mesoLength===n ? "var(--accent)" : "var(--text-secondary)"}}>{tag}</div>
                  </button>
                ))}
              </div>
              <div style={{fontSize:12, color:"var(--text-muted)", marginTop:8}}>
                {form.mesoLength===4 && "Sharp, focused push. Great for a specific block."}
                {form.mesoLength===6 && "Standard — the sweet spot for most trainees."}
                {form.mesoLength===8 && "Extended accumulation before peaking. More volume base."}
                {form.mesoLength===12 && "Full periodization — max accumulation + long peak. Commitment required."}
              </div>
            </div>

            {/* Equipment */}
            <div style={sec}>
              <label style={{...sLabel, fontSize:15, letterSpacing:"0.01em", color:"var(--text-primary)"}}>Available equipment *</label>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
                {["barbell","dumbbell","bodyweight","kettlebell","band","machine","cable"].map(val => {
                  const names = { barbell:"Barbell", dumbbell:"Dumbbells", bodyweight:"Bodyweight", kettlebell:"Kettlebell", band:"Bands", machine:"Machines", cable:"Cable" };
                  const sel = form.equipment.includes(val);
                  return (
                    <button key={val} onClick={()=>toggleEquipment(val)} className="btn-toggle" style={{
                      padding:"12px 14px", borderRadius:6, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(var(--accent-rgb),0.14)" : "var(--bg-card)",
                      border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      transition:"all 0.15s",
                      display:"flex", alignItems:"center", gap:10,
                    }}>
                      <div style={{
                        width:18, height:18, borderRadius:4, flexShrink:0, border:`1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        background: sel ? "var(--accent)" : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:13, fontWeight:700, color: sel ? "var(--accent)" : "var(--text-primary)"}}>{names[val]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Which days */}
            <div style={sec}>
              <label style={sLabel}>Which days?</label>
              <div style={{fontSize:12, color:"var(--text-muted)", marginTop:4, marginBottom:8}}>Tap to customise</div>
              <div style={{display:"flex", gap:4}}>
                {[["Su",0],["M",1],["Tu",2],["W",3],["Th",4],["F",5],["Sa",6]].map(([lbl,num]) => {
                  const sel = form.workoutDays.includes(num);
                  return (
                    <button key={num} onClick={()=>toggleDay(num)} className="btn-toggle" style={{
                      flex:1, padding:"12px 0", borderRadius:9, cursor:"pointer",
                      fontWeight:700, fontSize:12, letterSpacing:"0.02em",
                      background: sel ? "rgba(var(--accent-rgb),0.16)" : "var(--bg-card)",
                      border:`1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      color: sel ? "var(--accent)" : "var(--text-primary)",
                    }}>{lbl}</button>
                  );
                })}
              </div>
            </div>

            {/* Start date */}
            <div style={sec}>
              <label style={sLabel}>Start date *</label>
              <input type="date" value={form.startDate}
                onChange={e=>set("startDate",e.target.value)}
                style={{...inputStyle, colorScheme:"dark"}}
              />
              {mesoEnd && (
                <div style={{fontSize:12, color:"var(--text-muted)", marginTop:8}}>
                  Ends <b style={{color:"var(--text-primary)"}}>{mesoEnd}</b> · {form.mesoLength} weeks
                </div>
              )}
            </div>

            {/* Error */}
            {error && <div style={{background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:6, padding:"12px 16px", marginBottom:16, fontSize:13, color:"var(--danger)"}}>{error}</div>}

            <button onClick={() => {
              setError("");
              if (form.equipment.length === 0) { setError("Select at least one equipment type."); return; }
              const splitValidDays = SPLIT_CONFIG[form.splitType]?.validDays;
              if (splitValidDays && !splitValidDays.includes(form.workoutDays.length)) {
                setError(`${SPLIT_CONFIG[form.splitType]?.label || form.splitType} needs ${splitValidDays.join(" or ")} training days — you have ${form.workoutDays.length} selected.`); return;
              }
              setManualExStep(true);
              window.scrollTo(0,0);
            }} className="btn-primary" style={{
              width:"100%", padding:"20px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)",
              border:"1px solid var(--btn-primary-border)",
              color:"var(--btn-primary-text)", fontSize:16, fontWeight:800, letterSpacing:"0.04em",
              boxShadow:"0 4px 24px rgba(var(--accent-rgb),0.35)",
            }}>Choose Exercises →</button>
          </div>
        )}

        {/* ─── MANUAL: SUPERSET PAIRING STEP ─── */}
        {step === 2 && pathMode === "manual" && manualPairStep && (() => {
          const splitDayTemplates = {
            ppl: {
              3: [["Push Day","PUSH"],["Pull Day","PULL"],["Legs Day","LEGS"]],
              5: [["Push Day 1","PUSH"],["Pull Day 1","PULL"],["Legs Day","LEGS"],["Push Day 2","PUSH"],["Pull Day 2","PULL"]],
              6: [["Push 1","PUSH"],["Pull 1","PULL"],["Legs 1","LEGS"],["Push 2","PUSH"],["Pull 2","PULL"],["Legs 2","LEGS"]],
            },
            upper_lower: { 2:[["Upper Body","UPPER"],["Lower Body","LOWER"]], 4:[["Upper A","UPPER"],["Lower A","LOWER"],["Upper B","UPPER"],["Lower B","LOWER"]] },
            full_body: { 2:[["Full Body A","FULL"],["Full Body B","FULL"]], 3:[["Full Body A","FULL"],["Full Body B","FULL"],["Full Body C","FULL"]] },
          };
          const numDays = form.workoutDays?.length || form.daysPerWeek || 6;
          const dayTemplates = (splitDayTemplates[form.splitType]?.[numDays]) ||
            Array.from({length:numDays},(_,i)=>[`Day ${i+1}`,"FULL"]);
          const tagColors = { PUSH:"var(--tag-push)", PULL:"var(--tag-pull)", LEGS:"var(--tag-legs)", UPPER:"var(--phase-intens)", LOWER:"var(--phase-accum)", FULL:"var(--accent)" };

          const togglePair = (dayIdx, exIdx) => {
            if (pairPickFirst === null) {
              // First pick
              setPairPickFirst({ dayIdx, exIdx });
            } else if (pairPickFirst.dayIdx !== dayIdx || pairPickFirst.exIdx === exIdx) {
              // Different day or same exercise — cancel
              setPairPickFirst(null);
            } else {
              // Second pick in same day — create pair (ensure a < b)
              const a = Math.min(pairPickFirst.exIdx, exIdx);
              const b = Math.max(pairPickFirst.exIdx, exIdx);
              setDayPairs(prev => {
                const existing = prev[dayIdx] || [];
                // Remove any existing pairs involving a or b
                const filtered = existing.filter(([pa,pb]) => pa !== a && pb !== b && pa !== b && pb !== a);
                return { ...prev, [dayIdx]: [...filtered, [a, b]] };
              });
              setPairPickFirst(null);
            }
          };

          const removePair = (dayIdx, a, b) => {
            setDayPairs(prev => ({
              ...prev,
              [dayIdx]: (prev[dayIdx] || []).filter(([pa,pb]) => !(pa === a && pb === b)),
            }));
          };

          const isPaired = (dayIdx, exIdx) => {
            return (dayPairs[dayIdx] || []).some(([a,b]) => a === exIdx || b === exIdx);
          };

          const getPairLabel = (dayIdx, exIdx) => {
            const pair = (dayPairs[dayIdx] || []).find(([a,b]) => a === exIdx || b === exIdx);
            if (!pair) return null;
            return pair[0] === exIdx ? "A" : "B";
          };

          return (
            <div style={{padding:"24px 20px 40px"}}>
              <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:6}}>
                <strong style={{color:"var(--text-primary)"}}>Optional:</strong> pair exercises as supersets. Tap two exercises in the same day to link them — the rest timer fires after both sets are complete.
              </div>
              <div style={{fontSize:12, color:"var(--text-muted)", marginBottom:24, lineHeight:1.5}}>
                Best pairings: push + pull (bench + row), curl + pushdown, quad + hamstring. Don't pair two heavy compounds.
              </div>

              {dayTemplates.map(([dayLabel, dayTag], dayIdx) => {
                const exIds = dayExercises[dayIdx] || [];
                const accent = tagColors[dayTag] || "var(--accent)";
                const pairs = dayPairs[dayIdx] || [];

                return (
                  <div key={dayIdx} style={{
                    background:"var(--bg-card)", border:`1px solid var(--border)`,
                    borderRadius:8, overflow:"hidden", marginBottom:14,
                    borderLeft:`3px solid ${accent}`,
                  }}>
                    <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-surface)", display:"flex", alignItems:"center", gap:10}}>
                      <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.06em", padding:"2px 7px", borderRadius:4, background:accent+"22", color:accent}}>{dayTag}</span>
                      <span style={{fontSize:12, fontWeight:700, color:"var(--text-primary)"}}>{dayLabel}</span>
                      {pairs.length > 0 && <span style={{marginLeft:"auto", fontSize:12, color:"var(--phase-intens)", fontWeight:700}}>{pairs.length} superset{pairs.length>1?"s":""}</span>}
                    </div>
                    <div style={{padding:"12px 14px", display:"flex", flexDirection:"column", gap:6}}>
                      {exIds.map((id, i) => {
                        const ex = EXERCISE_DB.find(e => e.id === id);
                        if (!ex) return null;
                        const paired = isPaired(dayIdx, i);
                        const label = getPairLabel(dayIdx, i);
                        const isPicking = pairPickFirst?.dayIdx === dayIdx && pairPickFirst?.exIdx === i;
                        const isFirst = i === 0;

                        // Find partner name for paired exercises
                        let partnerName = "";
                        if (paired) {
                          const pair = (dayPairs[dayIdx] || []).find(([a,b]) => a === i || b === i);
                          const partnerIdx = pair ? (pair[0] === i ? pair[1] : pair[0]) : -1;
                          const partnerId = partnerIdx >= 0 ? exIds[partnerIdx] : null;
                          const partnerEx = partnerId ? EXERCISE_DB.find(e => e.id === partnerId) : null;
                          partnerName = partnerEx?.name || "";
                        }

                        return (
                          <button key={id} onClick={() => !isFirst && togglePair(dayIdx, i)} style={{
                            display:"flex", alignItems:"center", gap:10, textAlign:"left",
                            padding:"9px 12px", borderRadius:6, cursor: isFirst ? "default" : "pointer",
                            background: isPicking ? "rgba(232,101,26,0.15)" : paired ? "rgba(232,101,26,0.08)" : "var(--bg-surface)",
                            border: `1px solid ${isPicking ? "var(--phase-intens)" : paired ? "rgba(232,101,26,0.4)" : "var(--border)"}`,
                            transition:"all 0.12s", width:"100%",
                          }}>
                            {isFirst ? (
                              <HammerIcon size={16} />
                            ) : label ? (
                              <span style={{
                                fontSize:12, fontWeight:800, minWidth:16, textAlign:"center",
                                color:"var(--phase-intens)", background:"rgba(232,101,26,0.2)",
                                padding:"1px 5px", borderRadius:3,
                              }}>{label}</span>
                            ) : (
                              <span style={{fontSize:12, color:"var(--text-dim)", minWidth:16, textAlign:"center"}}>{i+1}</span>
                            )}
                            <div style={{flex:1, minWidth:0}}>
                              <div style={{fontSize:12, fontWeight:600, color: paired ? "var(--text-primary)" : "var(--text-secondary)"}}>{ex.name}</div>
                              {paired && partnerName && (
                                <div style={{fontSize:12, color:"var(--phase-intens)", marginTop:1}}>↕ superset with {partnerName}</div>
                              )}
                            </div>
                            {paired && (
                              <button onClick={e => { e.stopPropagation(); const pair = (dayPairs[dayIdx]||[]).find(([a,b])=>a===i||b===i); if(pair) removePair(dayIdx,pair[0],pair[1]); }} style={{
                                background:"transparent", border:"none", cursor:"pointer",
                                fontSize:14, color:"var(--text-muted)", padding:"2px 4px",
                              }}>×</button>
                            )}
                            {isPicking && <span style={{fontSize:12, color:"var(--phase-intens)", fontWeight:700, flexShrink:0}}>← tap partner</span>}
                            {!isFirst && !paired && !isPicking && <span style={{fontSize:16, color:"var(--border)", flexShrink:0}}>○</span>}
                            {isFirst && <span style={{fontSize:12, color:"var(--text-muted)", flexShrink:0}}>anchor (no pair)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, marginTop:8}}>
                <button onClick={()=>{setManualPairStep(false); window.scrollTo(0,0);}} className="btn-ghost" style={{
                  padding:"18px", borderRadius:6, cursor:"pointer",
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  color:"var(--text-secondary)", fontSize:14, fontWeight:700,
                }}>‹ Back</button>
                <button onClick={() => {
                  const goalOption = GOAL_OPTIONS.find(g => g.id === form.goal);
                  const profile = {
                    ...form,
                    priority: goalOption?.priority || "both",
                    manualDayExercises: dayExercises,
                    manualDayPairs: dayPairs,
                    manualCardioDays: [...cardioDays],
                    manualBuilt: true,
                  };
                  maybePromptCardio(profile);
                }} className="btn-primary" style={{
                  padding:"18px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)",
                  border:"1px solid var(--btn-primary-border)",
                  color:"var(--btn-primary-text)", fontSize:16, fontWeight:800, letterSpacing:"0.04em",
                  boxShadow:"0 4px 24px rgba(var(--accent-rgb),0.3)",
                }}>Start Training →</button>
              </div>
            </div>
          );
        })()}

        {/* ─── MANUAL: EXERCISE PICKER PER DAY ─── */}
        {step === 2 && pathMode === "manual" && manualExStep && (() => {
          const splitDayTemplates = {
            ppl: {
              3: [["Push Day","PUSH"],["Pull Day","PULL"],["Legs Day","LEGS"]],
              5: [["Push Day 1","PUSH"],["Pull Day 1","PULL"],["Legs Day","LEGS"],["Push Day 2","PUSH"],["Pull Day 2","PULL"]],
              6: [["Push 1","PUSH"],["Pull 1","PULL"],["Legs 1","LEGS"],["Push 2","PUSH"],["Pull 2","PULL"],["Legs 2","LEGS"]],
            },
            upper_lower: {
              2: [["Upper Body","UPPER"],["Lower Body","LOWER"]],
              4: [["Upper A","UPPER"],["Lower A","LOWER"],["Upper B","UPPER"],["Lower B","LOWER"]],
            },
            full_body: {
              2: [["Full Body A","FULL"],["Full Body B","FULL"]],
              3: [["Full Body A","FULL"],["Full Body B","FULL"],["Full Body C","FULL"]],
            },
          };

          const numDays = form.workoutDays.length;
          const dayTemplates = (splitDayTemplates[form.splitType]?.[numDays]) ||
            Array.from({length:numDays},(_,i)=>[`Day ${i+1}`,"FULL"]);

          const tagColors = {PUSH:"var(--tag-push)",PULL:"var(--tag-pull)",LEGS:"var(--tag-legs)",UPPER:"var(--phase-peak)",LOWER:"var(--accent-blue)",FULL:"var(--phase-deload)"};

          // Group exercises by muscle for a given tag
          const getExercisesForTag = (dayTag) => {
            let tagFilter;
            if (dayTag === "PUSH") tagFilter = ["PUSH"];
            else if (dayTag === "PULL") tagFilter = ["PULL"];
            else if (dayTag === "LEGS") tagFilter = ["LEGS"];
            else if (dayTag === "UPPER") tagFilter = ["PUSH","PULL"];
            else if (dayTag === "LOWER") tagFilter = ["LEGS"];
            else tagFilter = ["PUSH","PULL","LEGS"]; // FULL
            const exs = EXERCISE_DB.filter(e => tagFilter.includes(e.tag));
            // Group by muscle
            const groups = {};
            exs.forEach(e => {
              if (!groups[e.muscle]) groups[e.muscle] = [];
              groups[e.muscle].push(e);
            });
            return groups;
          };

          const toggleExercise = (dayIdx, exId) => {
            setDayExercises(prev => {
              const current = prev[dayIdx] || [];
              const exists = current.includes(exId);
              return { ...prev, [dayIdx]: exists ? current.filter(id => id !== exId) : [...current, exId] };
            });
          };

          // Validate: every day must have >= 3 exercises
          const allDaysValid = dayTemplates.every((_, i) => cardioDays.has(i) || (dayExercises[i] || []).length >= 3);

          return (
            <div style={{padding:"24px 20px 40px"}}>
              <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:20}}>
                Pick exercises for each training day. The first exercise you select becomes the <strong style={{color:"var(--accent)"}}>anchor lift</strong> <HammerIcon size={14} style={{marginLeft:2}} />. Select at least 3 per day.
              </div>

              {dayTemplates.map(([dayLabel, dayTag], dayIdx) => {
                const selected = dayExercises[dayIdx] || [];
                const isCardio = cardioDays.has(dayIdx);
                const cardioColor = TAG_ACCENT["CARDIO"];
                const accent = isCardio ? cardioColor : (tagColors[dayTag] || "var(--accent)");
                const exGroups = getExercisesForTag(dayTag);
                const count = selected.length;
                const countColor = count < 3 ? "var(--danger)" : count <= 6 ? "var(--accent)" : "var(--text-muted)";

                return (
                  <div key={dayIdx} style={{
                    background:"var(--bg-card)", border:`1px solid ${isCardio ? cardioColor+"44" : "var(--border)"}`,
                    borderRadius:8, overflow:"hidden", marginBottom:16,
                    borderLeft:`3px solid ${accent}`,
                  }}>
                    {/* Day header */}
                    <div style={{
                      padding:"12px 16px", borderBottom:"1px solid var(--border-subtle)",
                      display:"flex", alignItems:"center", gap:10,
                      background: isCardio ? `${cardioColor}0d` : "var(--bg-surface)",
                    }}>
                      <span style={{
                        fontSize:12, fontWeight:800, letterSpacing:"0.06em", padding:"3px 8px",
                        borderRadius:6, background:accent+"22", color:accent,
                      }}>{isCardio ? "CARDIO" : dayTag}</span>
                      <span style={{fontSize:13, fontWeight:700, color:"var(--text-primary)"}}>{isCardio ? "Cardio Day" : dayLabel}</span>
                      {/* Cardio toggle */}
                      <button onClick={() => setCardioDays(prev => {
                        const next = new Set(prev);
                        next.has(dayIdx) ? next.delete(dayIdx) : next.add(dayIdx);
                        return next;
                      })} style={{
                        marginLeft:"auto", fontSize:12, fontWeight:700, letterSpacing:"0.04em",
                        padding:"3px 10px", borderRadius:4, cursor:"pointer", border:"none",
                        background: isCardio ? `${cardioColor}22` : "var(--bg-deep)",
                        color: isCardio ? cardioColor : "var(--text-muted)",
                        outline: isCardio ? `1px solid ${cardioColor}55` : "1px solid var(--border)",
                      }}>♥ {isCardio ? "CARDIO DAY ✓" : "MAKE CARDIO"}</button>
                      {!isCardio && (
                        <span style={{
                          fontSize:12, fontWeight:700, letterSpacing:"0.04em",
                          padding:"2px 8px", borderRadius:4,
                          background: count < 3 ? "rgba(var(--danger-rgb,220,38,38),0.1)" : "rgba(var(--accent-rgb),0.12)",
                          color: countColor,
                        }}>{count} selected{count < 3 ? " — min 3" : count > 6 ? " — consider trimming" : ""}</span>
                      )}
                    </div>

                    {/* Cardio day — simple info, no exercise picker */}
                    {isCardio ? (
                      <div style={{padding:"16px", display:"flex", alignItems:"center", gap:10, background:`${cardioColor}08`}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cardioColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                        <span style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.5}}>
                          Dedicated cardio day — you'll log type, duration, and intensity during the session.
                        </span>
                      </div>
                    ) : (
                    <>
                    {/* Selected order strip */}
                    {selected.length > 0 && (
                      <div style={{padding:"10px 16px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-inset)"}}>
                        <div style={{fontSize:12, fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.05em", marginBottom:6}}>ORDER</div>
                        <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
                          {selected.map((id, i) => {
                            const ex = EXERCISE_DB.find(e => e.id === id);
                            if (!ex) return null;
                            return (
                              <span key={id} style={{
                                fontSize:12, fontWeight:700, padding:"3px 8px", borderRadius:99,
                                background: i === 0 ? accent+"33" : "var(--bg-surface)",
                                border:`1px solid ${i === 0 ? accent : "var(--border)"}`,
                                color: i === 0 ? accent : "var(--text-secondary)",
                              }}>
                                {i === 0 ? <><HammerIcon size={13} style={{marginRight:3}} /></> : `${i+1}. `}{ex.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Exercise groups */}
                    <div style={{padding:"12px 16px"}}>
                      {Object.entries(exGroups).map(([muscle, exs]) => (
                        <div key={muscle} style={{marginBottom:12}}>
                          <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-muted)", marginBottom:6}}>{muscle.toUpperCase()}</div>
                          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                            {exs.map(ex => {
                              const isSel = selected.includes(ex.id);
                              const isAnchor = selected[0] === ex.id;
                              return (
                                <button
                                  key={ex.id}
                                  onClick={() => toggleExercise(dayIdx, ex.id)}
                                  style={{
                                    padding:"6px 12px", borderRadius:6, cursor:"pointer",
                                    fontSize:12, fontWeight: isSel ? 700 : 500,
                                    background: isAnchor ? accent+"33" : isSel ? "rgba(var(--accent-rgb),0.1)" : "var(--bg-surface)",
                                    border:`1px solid ${isAnchor ? accent : isSel ? "rgba(var(--accent-rgb),0.4)" : "var(--border)"}`,
                                    color: isAnchor ? accent : isSel ? "var(--text-primary)" : "var(--text-muted)",
                                    transition:"all 0.12s",
                                  }}
                                >
                                  {isAnchor ? <HammerIcon size={13} style={{marginRight:3}} /> : ""}{ex.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    </> /* end !isCardio */
                    )}
                  </div>
                );
              })}

              {error && <div style={{background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:6, padding:"12px 16px", marginBottom:16, fontSize:13, color:"var(--danger)"}}>{error}</div>}

              <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:10}}>
                <button onClick={()=>{setManualExStep(false); window.scrollTo(0,0);}} className="btn-ghost" style={{
                  padding:"18px", borderRadius:6, cursor:"pointer",
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  color:"var(--text-secondary)", fontSize:14, fontWeight:700,
                }}>‹ Back</button>
                <button onClick={() => {
                  setError("");
                  if (!allDaysValid) { setError("Each day needs at least 3 exercises selected."); return; }
                  setManualPairStep(true);
                  window.scrollTo(0,0);
                }} className="btn-primary" style={{
                  padding:"18px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)",
                  border:"1px solid var(--btn-primary-border)",
                  color:"var(--btn-primary-text)", fontSize:16, fontWeight:800, letterSpacing:"0.04em",
                  boxShadow:"0 4px 24px rgba(var(--accent-rgb),0.3)",
                  opacity: allDaysValid ? 1 : 0.5,
                }}>Start Training →</button>
              </div>
            </div>
          );
        })()}


      </div>
    </div>

    {/* ── 5-Day PPL Leg Balance Prompt ── */}
    {legBalancePrompt && (
      <div style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      }}>
        <div style={{
          background:"var(--card-bg)", border:"1px solid var(--border)",
          borderRadius:14, padding:28, maxWidth:360, width:"100%",
        }}>
          <div style={{fontSize:13, fontWeight:700, letterSpacing:"0.1em", color:"var(--accent)", marginBottom:10}}>
            COACH NOTE
          </div>
          <div style={{fontSize:17, fontWeight:700, color:"var(--text)", marginBottom:12, lineHeight:1.35}}>
            Your Push and Pull days are getting twice the weekly volume as Legs.
          </div>
          <div style={{fontSize:14, color:"var(--text-dim)", lineHeight:1.55, marginBottom:24}}>
            Want to add a leg accessory block to Pull Day 2 to balance it out? Think leg press, hamstring curls, and calves — nothing crazy, just enough to close the gap.
          </div>
          <button
            onClick={() => { maybePromptCardio({ ...legBalancePrompt, pplLegBalance: true }); setLegBalancePrompt(null); }}
            className="btn-primary"
            style={{ width:"100%", marginBottom:10, padding:"14px 0", fontSize:15, fontWeight:700, background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)", borderRadius:8 }}
          >
            Yes, balance it out
          </button>
          <button
            onClick={() => { maybePromptCardio({ ...legBalancePrompt, pplLegBalance: false }); setLegBalancePrompt(null); }}
            style={{
              width:"100%", padding:"12px 0", fontSize:14, fontWeight:600,
              background:"transparent", border:"1px solid var(--border)",
              borderRadius:8, color:"var(--text-dim)", cursor:"pointer",
            }}
          >
            Keep as-is
          </button>
        </div>
      </div>
    )}
    {/* ── Cardio Plan Step ── */}
    {showCardioStep && (() => {
      const CARDIO_COLOR = TAG_ACCENT["CARDIO"];
      const DAY_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const DAY_SHORT = ["Su","M","Tu","W","Th","F","Sa"];
      const liftingDows = new Set(
        (pendingProfile?.workoutDays || []).map(d => ((d - 1 + 7) % 7))
      );

      // Compute recommended protocols based on goal + lifting day count
      const profileGoal = pendingProfile?.goal || "";
      const liftDayCount = (pendingProfile?.workoutDays || []).length;
      const recommendedProtos = CARDIO_WORKOUTS.filter(w =>
        w.recommendedFor && w.recommendedFor.includes(profileGoal)
      ).slice(0, 3);

      // Build suggested schedule from recommendations — avoid lifting days when possible
      const applyRecommendation = (proto) => {
        // Find available non-lifting days first, then lifting days as fallback
        const allDows = [1,2,3,4,5,6,0];
        const available = allDows.filter(d => !liftingDows.has(d));
        const candidates = available.length > 0 ? available : allDows.filter(d => liftingDows.has(d));
        // Pick first candidate not already scheduled
        const target = candidates.find(d => !cardioSchedule.find(s => s.dayOfWeek === d));
        if (target === undefined) return;
        setCardioSchedule(prev => {
          // Don't add if already have this protocol
          if (prev.find(s => s.protocol === proto.id)) return prev;
          const dow = candidates.find(d => !prev.find(s => s.dayOfWeek === d));
          if (dow === undefined) return prev;
          return [...prev, { dayOfWeek: dow, protocol: proto.id }];
        });
      };

      return (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"var(--bg-root)", overflowY:"auto",
          fontFamily:"'Inter',system-ui,sans-serif",
          color:"var(--text-primary)",
        }}>
          <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 16px 80px" }}>

            {/* Header */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.02em", marginBottom:6 }}>
                Add a cardio plan?
              </div>
              <div style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.5 }}>
                Optional. Pick which days you'll do cardio and assign a protocol. You can change this any time.
              </div>
            </div>

            {/* Recommendations — shown when we have a goal */}
            {recommendedProtos.length > 0 && (
              <div style={{
                background:"var(--bg-card)",
                border:`1px solid ${CARDIO_COLOR}44`,
                borderRadius:10, overflow:"hidden",
                marginBottom:20,
              }}>
                <div style={{
                  padding:"10px 14px",
                  background:"rgba(232,101,26,0.06)",
                  borderBottom:"1px solid rgba(232,101,26,0.14)",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"#E8651A" }}>
                    RECOMMENDED FOR {(GOAL_OPTIONS.find(g => g.id === profileGoal)?.label || "your goal").toUpperCase()}
                  </span>
                </div>
                <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                  {recommendedProtos.map(proto => {
                    const alreadyAdded = !!cardioSchedule.find(s => s.protocol === proto.id);
                    return (
                      <div key={proto.id} style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        gap:10,
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                            <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{proto.label}</span>
                            <span style={{
                              fontSize:11, fontWeight:700, letterSpacing:"0.06em",
                              color:"var(--text-muted)", background:"var(--bg-inset)",
                              border:"1px solid var(--border)", borderRadius:4, padding:"1px 6px",
                            }}>{proto.category}</span>
                          </div>
                          <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.4 }}>
                            {proto.description.split(".")[0]}.
                          </div>
                        </div>
                        <button
                          onClick={() => alreadyAdded ? null : applyRecommendation(proto)}
                          style={{
                            flexShrink:0,
                            padding:"6px 12px", borderRadius:6, cursor: alreadyAdded ? "default" : "pointer",
                            fontSize:12, fontWeight:700, letterSpacing:"0.04em",
                            background: alreadyAdded ? `${CARDIO_COLOR}18` : `${CARDIO_COLOR}22`,
                            border:`1px solid ${alreadyAdded ? CARDIO_COLOR+"55" : CARDIO_COLOR+"44"}`,
                            color: alreadyAdded ? CARDIO_COLOR : CARDIO_COLOR,
                          }}
                        >{alreadyAdded ? "Added ✓" : "Add"}</button>
                      </div>
                    );
                  })}
                </div>
                {liftDayCount >= 5 && (
                  <div style={{
                    padding:"8px 14px 12px",
                    fontSize:12, color:"var(--text-muted)", lineHeight:1.5,
                    borderTop:"1px solid var(--border)",
                  }}>
                    You're lifting {liftDayCount}x/week — keep cardio sessions short and low-intensity to manage recovery.
                  </div>
                )}
              </div>
            )}

            {/* Day grid */}
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-muted)", marginBottom:10 }}>
              ALL DAYS
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
              {DAY_FULL.map((name, dow) => {
                const slot    = cardioSchedule.find(s => s.dayOfWeek === dow);
                const active  = !!slot;
                const isLift  = liftingDows.has(dow);
                const proto   = active ? CARDIO_WORKOUTS.find(w => w.id === slot.protocol) : null;

                return (
                  <div key={dow} style={{
                    background:"var(--bg-card)",
                    border:`1px solid ${active ? CARDIO_COLOR+"55" : "var(--border)"}`,
                    borderRadius:10, overflow:"hidden",
                    transition:"border-color 0.15s",
                  }}>
                    {/* Row header — checkbox toggles day, chevron expands protocol picker */}
                    <div style={{
                      width:"100%", background: active ? `${CARDIO_COLOR}0d` : "transparent",
                      padding:"13px 16px",
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      transition:"background 0.15s",
                    }}>
                      <button onClick={() => toggleCardioDow(dow)} style={{
                        background:"none", border:"none", cursor:"pointer", padding:0,
                        display:"flex", alignItems:"center", gap:10,
                      }}>
                        {/* Checkbox */}
                        <div style={{
                          width:20, height:20, borderRadius:5,
                          background: active ? CARDIO_COLOR : "var(--bg-inset)",
                          border:`2px solid ${active ? CARDIO_COLOR : "var(--border)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0, transition:"all 0.15s",
                        }}>
                          {active && <span style={{ fontSize:12, color:"#000", fontWeight:900, lineHeight:1 }}>✓</span>}
                        </div>
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontSize:14, fontWeight:700, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {name}
                          </div>
                          {isLift && (
                            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:1 }}>Lifting day</div>
                          )}
                        </div>
                      </button>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        {active && proto && (
                          <div style={{
                            fontSize:12, fontWeight:700, letterSpacing:"0.04em",
                            color: CARDIO_COLOR, background:`${CARDIO_COLOR}18`,
                            border:`1px solid ${CARDIO_COLOR}44`,
                            borderRadius:5, padding:"3px 8px", flexShrink:0,
                          }}>{proto.label}</div>
                        )}
                        {active && (
                          <button onClick={() => setExpandedCardioDow(expandedCardioDow === dow ? null : dow)} style={{
                            background:"none", border:"none", cursor:"pointer", padding:"2px",
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: expandedCardioDow === dow ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s"}}><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Protocol picker — visible when day is explicitly expanded */}
                    {active && expandedCardioDow === dow && (
                      <div style={{
                        padding:"0 16px 14px",
                        borderTop:`1px solid ${CARDIO_COLOR}22`,
                        display:"flex", flexDirection:"column", gap:10,
                      }}>
                        <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-muted)", marginTop:10 }}>PROTOCOL</div>
                        {["Quick & Intense","Endurance","Performance","Conditioning"].map(cat => (
                          <div key={cat}>
                            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:6 }}>{cat.toUpperCase()}</div>
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                              {CARDIO_WORKOUTS.filter(w => w.category === cat).map(w => {
                                const sel = slot.protocol === w.id;
                                return (
                                  <button key={w.id}
                                    onClick={() => setCardioProtocol(dow, w.id)}
                                    style={{
                                      padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700,
                                      letterSpacing:"0.04em", cursor:"pointer", border:"none",
                                      background: sel ? CARDIO_COLOR+"28" : "var(--bg-deep)",
                                      color: sel ? CARDIO_COLOR : "var(--text-muted)",
                                      outline: sel ? `1px solid ${CARDIO_COLOR}55` : "1px solid transparent",
                                      transition:"all 0.14s",
                                    }}
                                  >{w.label} · {w.defaultDuration}m</button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {/* Protocol description */}
                        {proto && (
                          <div style={{
                            fontSize:12, color:"var(--text-secondary)", lineHeight:1.5,
                            background:"var(--bg-inset)", borderRadius:6, padding:"8px 10px",
                            border:"1px solid var(--border)",
                          }}>{proto.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Buttons */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10 }}>
              <button
                onClick={() => { store.set("foundry:meso_transition",""); onComplete(pendingProfile); }}
                style={{
                  padding:"18px", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:700,
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  color:"var(--text-secondary)",
                }}
              >Skip</button>
              <button
                onClick={() => { store.set("foundry:meso_transition",""); onComplete({ ...pendingProfile, cardioSchedule }); }}
                className="btn-primary"
                style={{
                  padding:"18px", borderRadius:8, cursor:"pointer", fontSize:15, fontWeight:800,
                  letterSpacing:"0.04em", background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)",
                  boxShadow: cardioSchedule.length > 0 ? "0 4px 24px rgba(var(--accent-rgb),0.3)" : "none",
                }}
              >
                {cardioSchedule.length > 0
                  ? `Add Plan (${cardioSchedule.length} day${cardioSchedule.length > 1 ? "s" : ""}) →`
                  : "Start Training →"}
              </button>
            </div>
          </div>
        </div>
      );
    })()}
  </>
  );
}


export default SetupPage;
