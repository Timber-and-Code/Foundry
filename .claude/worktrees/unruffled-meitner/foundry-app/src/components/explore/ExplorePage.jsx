import React, { useState } from 'react';
import { EXERCISE_DB, SAMPLE_PROGRAMS } from '../../data/exercises';
import { GOAL_OPTIONS } from '../../data/constants';
import HammerIcon from '../shared/HammerIcon';

// Build AI days array from a sample program's day definitions
const buildAiDaysFromSample = (prog) => {
  if (!prog || !prog.days) return [];
  return prog.days.map(day => ({
    label: day.label || day.name || "Day",
    tag: day.tag || "PUSH",
    exercises: (day.exercises || []).map(ex => ({
      name: ex.name || ex,
      sets: ex.sets || 3,
      repRange: ex.repRange || "8-12",
      progression: ex.progression || "standard",
      warmup: ex.warmup || null,
    })),
  }));
};

// Modal for starting a sample program
const StartSampleProgramModal = ({ prog, hasActiveMeso, onConfirm, onCancel }) => {
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onCancel}>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:24,maxWidth:400,width:"90%"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:800,color:"var(--text-primary)",marginBottom:4}}>{prog.label}</div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>{prog.splitType} · {prog.daysPerWeek} days/wk · {prog.weeks} weeks</div>
        {hasActiveMeso && (
          <div style={{fontSize:12,color:"var(--danger)",background:"rgba(255,0,0,0.08)",border:"1px solid var(--danger)",borderRadius:6,padding:10,marginBottom:16,lineHeight:1.5}}>
            ⚠ This will replace your current mesocycle. Your existing data will be archived.
          </div>
        )}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",display:"block",marginBottom:6}}>Start Date</label>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg-inset)",color:"var(--text-primary)",fontSize:14}} />
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"12px",borderRadius:8,background:"var(--bg-inset)",border:"1px solid var(--border)",color:"var(--text-primary)",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onConfirm(startDate)} style={{flex:1,padding:"12px",borderRadius:8,background:"var(--btn-primary-bg)",border:"1px solid var(--btn-primary-border)",color:"var(--btn-primary-text)",fontSize:13,fontWeight:700,cursor:"pointer"}}>Start Program</button>
        </div>
      </div>
    </div>
  );
};

function ExplorePage({ profile, onStartProgram }) {
  const [section, setSection]   = useState("home");   // home | library | programs | learn
  const [learnOpen, setLearnOpen] = useState(null);   // which learn card is expanded
  const [glossaryOpen, setGlossaryOpen] = useState(null); // which glossary term is expanded
  const [libFilter, setLibFilter] = useState({ tag:"ALL", equip:"ALL", muscle:"ALL", pattern:"ALL", search:"" });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showHowTo, setShowHowTo] = useState(null);   // exercise object
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [startModalProg, setStartModalProg]   = useState(null); // program to launch

  // SAMPLE_PROGRAMS — defined in plain <script> above

  // ── Feature cards ────────────────────────────────────────────────────────
  const FEATURES = [
    { icon:"", title:"Foundry Program Builder", desc:"Answer 3 questions. The Foundry designs your entire mesocycle — exercises, sets, reps, progression, all of it." },
    { icon:"", title:"Progressive Overload", desc:"Every week gets harder. Volume landmarks and phase-aware intensity targets tell you exactly how hard to push each muscle group." },
    { icon:"", title:"PR Tracking", desc:"Every anchor lift tracked across all weeks. Sparkline history, trend arrows, peak week detection." },
    { icon:"", title:"Rest Timer", desc:"Auto-fires on every working set. Color-coded countdown with audio and haptic alerts at zero." },
    { icon:"", title:"Volume Landmarks", desc:"MEV, MAV, and MRV ranges per muscle group. Know exactly where you are in your training capacity." },
    { icon:"", title:"Meso History", desc:"Every completed cycle archived with PRs, volume, and profile snapshot. Your training record, always." },
  ];

  const TAG_COLORS = { PUSH:"var(--push-accent,#5C1615)", PULL:"var(--pull-accent,#4A3020)", LEGS:"var(--legs-accent,#3D2A1A)" };
  const ALL_TAGS   = ["ALL","PUSH","PULL","LEGS"];
  const ALL_EQUIPS = ["ALL","barbell","dumbbell","cable","machine","bodyweight","kettlebell","band"];
  const ALL_MUSCLES = ["ALL","Chest","Back","Lats","Shoulders","Traps","Biceps","Triceps","Forearms","Core","Abs","Obliques","Quads","Hamstrings","Glutes","Calves","LowerBack"];
  const PATTERN_MAP = { ALL:"All", push:"Press", pull:"Row/Pull", squat:"Squat", hinge:"Hinge", carry:"Carry", isolation:"Isolation" };
  const ALL_PATTERNS = ["ALL","push","pull","squat","hinge","carry","isolation"];

  // Count active (non-ALL) filters for badge
  const activeFilterCount = [libFilter.tag, libFilter.equip, libFilter.muscle, libFilter.pattern].filter(v => v !== "ALL").length;

  // ── Filtered exercises ───────────────────────────────────────────────────
  const filteredEx = React.useMemo(() => {
    return EXERCISE_DB.filter(e => {
      if (libFilter.tag !== "ALL" && e.tag !== libFilter.tag) return false;
      if (libFilter.equip !== "ALL" && e.equipment !== libFilter.equip) return false;
      if (libFilter.muscle !== "ALL" && !(e.muscles || [e.muscle]).includes(libFilter.muscle)) return false;
      if (libFilter.pattern !== "ALL" && e.pattern !== libFilter.pattern) return false;
      if (libFilter.search) {
        const q = libFilter.search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.muscle?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [libFilter]);

  // ── How To Modal (reuses ExerciseCard's modal design) ───────────────────
  const HowToModal = ({ ex, onClose }) => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300,
      display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"var(--bg-card)", borderRadius:"12px 12px 0 0",
        border:"1px solid var(--border)", borderBottom:"none",
        width:"100%", maxWidth:480, maxHeight:"80vh", display:"flex", flexDirection:"column",
      }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{fontSize:14, fontWeight:800, color:"var(--text-primary)"}}>{ex.name}</div>
            <div style={{fontSize:12, color:TAG_COLORS[ex.tag]||"var(--accent)", marginTop:2, fontWeight:700, letterSpacing:"0.06em"}}>
              {ex.tag} · {ex.muscle}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:22,cursor:"pointer",padding:"4px 8px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{overflowY:"auto", flex:1, WebkitOverflowScrolling:"touch", padding:"20px"}}>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
            {ex.anchor && <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.06em",background:"rgba(var(--accent-rgb),0.15)",color:"var(--accent)",padding:"3px 8px",borderRadius:4, display:"inline-flex", alignItems:"center", gap:4}}><HammerIcon size={13} /> ANCHOR</span>}
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.06em",background:"var(--bg-inset)",color:"var(--text-secondary)",padding:"3px 8px",borderRadius:4}}>{ex.equipment?.toUpperCase()}</span>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.06em",background:"var(--bg-inset)",color:"var(--text-secondary)",padding:"3px 8px",borderRadius:4}}>{ex.sets} × {ex.reps}</span>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.06em",background:"var(--bg-inset)",color:"var(--text-secondary)",padding:"3px 8px",borderRadius:4}}>⏱ {ex.rest}</span>
          </div>
          {ex.description
            ? <p style={{fontSize:14, lineHeight:1.7, color:"var(--text-secondary)", margin:0}}>{ex.description}</p>
            : <p style={{fontSize:13, color:"var(--text-muted)", textAlign:"center", margin:"24px 0"}}>Description coming soon.</p>
          }
        </div>
        {ex.videoUrl && (
          <div style={{padding:"12px 20px 20px", borderTop:"1px solid var(--border)", flexShrink:0}}>
            <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                width:"100%", padding:"11px 16px", borderRadius:8,
                background:"#ff000018", border:"1px solid #ff000044",
                color:"#ff4444", fontSize:13, fontWeight:700, letterSpacing:"0.04em", textDecoration:"none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8z"/>
                <polygon fill="white" points="9.6,15.6 15.8,12 9.6,8.4"/>
              </svg>
              WATCH ON YOUTUBE
            </a>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  if (section === "library") {
    const equipLabels = { ALL:"All", barbell:"Barbell", dumbbell:"Dumbbell", cable:"Cable", machine:"Machine", bodyweight:"Bodyweight", kettlebell:"Kettlebell", band:"Band" };
    const muscleLabels = { ALL:"All Muscles", Chest:"Chest", Back:"Back", Lats:"Lats", Shoulders:"Shoulders", Traps:"Traps", Biceps:"Biceps", Triceps:"Triceps", Forearms:"Forearms", Core:"Core", Abs:"Abs", Obliques:"Obliques", Quads:"Quads", Hamstrings:"Hamstrings", Glutes:"Glutes", Calves:"Calves", LowerBack:"Lower Back" };
    const tagLabels = { ALL:"All", PUSH:"Push", PULL:"Pull", LEGS:"Legs" };
    const FilterRow = ({ label, options, value, labelMap, onChange }) => (
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:8}}>{label}</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {options.map(opt => {
            const active = value === opt;
            return (
              <button key={opt} onClick={() => onChange(opt)} style={{
                padding:"5px 12px", borderRadius:20, border:"1px solid",
                borderColor: active ? "var(--phase-intens)" : "var(--border)",
                background: active ? "rgba(232,101,26,0.15)" : "transparent",
                color: active ? "var(--phase-intens)" : "var(--text-secondary)",
                fontSize:12, fontWeight: active ? 700 : 500, cursor:"pointer",
                transition:"all 0.12s",
              }}>{labelMap ? (labelMap[opt] || opt) : opt}</button>
            );
          })}
        </div>
      </div>
    );
    return (
      <div style={{animation:"tabFadeIn 0.15s ease-out", paddingBottom:90}}>
        {showHowTo && <HowToModal ex={showHowTo} onClose={()=>setShowHowTo(null)} />}
        {/* Sub-header */}
        <div style={{display:"flex", alignItems:"center", gap:12, padding:"14px 16px 12px", background:"var(--bg-deep)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, zIndex:10}}>
          <button onClick={()=>{ setSection("home"); setShowFilterPanel(false); }} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--accent)",fontSize:20,lineHeight:1,padding:"2px 4px",display:"flex",alignItems:"center",minWidth:44,minHeight:44,justifyContent:"center"}}>‹</button>
          <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-secondary)"}}>EXERCISE LIBRARY</span>
          <span style={{marginLeft:"auto", fontSize:12, color:"var(--text-muted)"}}>{filteredEx.length} exercises</span>
        </div>

        {/* Search + Filter button row */}
        <div style={{padding:"12px 16px 0", display:"flex", gap:8, alignItems:"center"}}>
          <input
            type="text" placeholder="Search by name or muscle..."
            value={libFilter.search}
            onChange={e=>setLibFilter(f=>({...f,search:e.target.value}))}
            style={{flex:1, padding:"10px 14px", borderRadius:8, border:"1px solid var(--border)",
              background:"var(--bg-card)", color:"var(--text-primary)", fontSize:13,
              boxSizing:"border-box", outline:"none"}}
          />
          <button
            onClick={() => setShowFilterPanel(p => !p)}
            style={{
              flexShrink:0, padding:"10px 14px", borderRadius:8, cursor:"pointer",
              border:`1px solid ${showFilterPanel || activeFilterCount > 0 ? "var(--phase-intens)" : "var(--border)"}`,
              background: showFilterPanel || activeFilterCount > 0 ? "rgba(232,101,26,0.12)" : "var(--bg-card)",
              color: showFilterPanel || activeFilterCount > 0 ? "var(--phase-intens)" : "var(--text-secondary)",
              fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6,
              position:"relative",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                minWidth:16, height:16, borderRadius:8, background:"var(--phase-intens)",
                color:"#000", fontSize:10, fontWeight:800, display:"flex", alignItems:"center",
                justifyContent:"center", padding:"0 4px",
              }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Active filter chips — shown when filters active but panel closed */}
        {!showFilterPanel && activeFilterCount > 0 && (
          <div style={{display:"flex", gap:6, padding:"8px 16px 0", flexWrap:"wrap", alignItems:"center"}}>
            {libFilter.tag !== "ALL" && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",borderRadius:20,background:"rgba(232,101,26,0.15)",border:"1px solid var(--phase-intens)44",fontSize:11,fontWeight:700,color:"var(--phase-intens)"}}>
                {tagLabels[libFilter.tag]}
                <button onClick={()=>setLibFilter(f=>({...f,tag:"ALL"}))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--phase-intens)",fontSize:16,lineHeight:1,padding:"4px",minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:2}}>×</button>
              </div>
            )}
            {libFilter.equip !== "ALL" && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",borderRadius:20,background:"rgba(232,101,26,0.15)",border:"1px solid var(--phase-intens)44",fontSize:11,fontWeight:700,color:"var(--phase-intens)"}}>
                {equipLabels[libFilter.equip]}
                <button onClick={()=>setLibFilter(f=>({...f,equip:"ALL"}))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--phase-intens)",fontSize:16,lineHeight:1,padding:"4px",minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:2}}>×</button>
              </div>
            )}
            {libFilter.muscle !== "ALL" && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",borderRadius:20,background:"rgba(232,101,26,0.15)",border:"1px solid var(--phase-intens)44",fontSize:11,fontWeight:700,color:"var(--phase-intens)"}}>
                {muscleLabels[libFilter.muscle] || libFilter.muscle}
                <button onClick={()=>setLibFilter(f=>({...f,muscle:"ALL"}))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--phase-intens)",fontSize:16,lineHeight:1,padding:"4px",minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:2}}>×</button>
              </div>
            )}
            {libFilter.pattern !== "ALL" && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",borderRadius:20,background:"rgba(232,101,26,0.15)",border:"1px solid var(--phase-intens)44",fontSize:11,fontWeight:700,color:"var(--phase-intens)"}}>
                {PATTERN_MAP[libFilter.pattern]}
                <button onClick={()=>setLibFilter(f=>({...f,pattern:"ALL"}))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--phase-intens)",fontSize:16,lineHeight:1,padding:"4px",minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:2}}>×</button>
              </div>
            )}
            <button onClick={()=>setLibFilter(f=>({...f,tag:"ALL",equip:"ALL",muscle:"ALL",pattern:"ALL"}))} style={{padding:"3px 10px",borderRadius:20,background:"transparent",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:11,fontWeight:600,cursor:"pointer"}}>Clear all</button>
          </div>
        )}

        {/* Collapsible filter panel */}
        {showFilterPanel && (
          <div style={{margin:"10px 16px 0", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:"16px 16px 8px"}}>
            <FilterRow label="MUSCLE GROUP" options={ALL_MUSCLES} value={libFilter.muscle} labelMap={muscleLabels} onChange={v=>setLibFilter(f=>({...f,muscle:v}))} />
            <FilterRow label="EQUIPMENT" options={ALL_EQUIPS} value={libFilter.equip} labelMap={equipLabels} onChange={v=>setLibFilter(f=>({...f,equip:v}))} />
            <FilterRow label="MOVEMENT" options={ALL_PATTERNS} value={libFilter.pattern} labelMap={PATTERN_MAP} onChange={v=>setLibFilter(f=>({...f,pattern:v}))} />
            <FilterRow label="SPLIT TAG" options={ALL_TAGS} value={libFilter.tag} labelMap={tagLabels} onChange={v=>setLibFilter(f=>({...f,tag:v}))} />
            <div style={{display:"flex", gap:8, marginTop:4, marginBottom:6}}>
              {activeFilterCount > 0 && (
                <button onClick={()=>setLibFilter(f=>({...f,tag:"ALL",equip:"ALL",muscle:"ALL",pattern:"ALL"}))} style={{flex:1, padding:"9px", borderRadius:6, cursor:"pointer", background:"transparent", border:"1px solid var(--border)", color:"var(--text-muted)", fontSize:12, fontWeight:600}}>
                  Clear
                </button>
              )}
              <button onClick={()=>setShowFilterPanel(false)} style={{flex:2, padding:"9px", borderRadius:6, cursor:"pointer", background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)", fontSize:13, fontWeight:700, letterSpacing:"0.04em"}}>
                Apply{activeFilterCount > 0 ? ` (${filteredEx.length})` : ""}
              </button>
            </div>
          </div>
        )}
        {/* Exercise list */}
        <div style={{padding:"10px 16px 16px", display:"flex", flexDirection:"column", gap:8}}>
          {filteredEx.length === 0 && (
            <div style={{padding:"48px 20px", textAlign:"center", color:"var(--text-muted)", fontSize:13}}>No exercises match that filter.</div>
          )}
          {filteredEx.map(ex => {
            const tc = TAG_COLORS[ex.tag] || "var(--accent)";
            return (
              <button key={ex.id} onClick={()=>setShowHowTo(ex)} style={{
                width:"100%", textAlign:"left", background:"var(--bg-card)",
                border:"1px solid var(--border)", borderRadius:8, padding:"12px 14px",
                cursor:"pointer", display:"flex", alignItems:"center", gap:12,
                boxShadow:"var(--shadow-xs)",
              }}>
                <div style={{width:36, height:36, borderRadius:6, background:tc+"1a",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <span style={{fontSize:12, fontWeight:800, color:tc, letterSpacing:"0.04em"}}>{ex.tag}</span>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                    {ex.anchor && <HammerIcon size={14} style={{marginRight:3}} />}{ex.name}
                  </div>
                  <div style={{fontSize:12, color:"var(--text-secondary)", marginTop:2}}>
                    {ex.muscle} · {ex.equipment} · {ex.sets}×{ex.reps}
                  </div>
                </div>
                <span style={{color:"var(--text-dim)", fontSize:18, flexShrink:0}}>›</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (section === "programs") {
    return (
      <div style={{animation:"tabFadeIn 0.15s ease-out", paddingBottom:90}}>
        <div style={{display:"flex", alignItems:"center", gap:12, padding:"14px 16px 12px", background:"var(--bg-deep)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, zIndex:10}}>
          <button onClick={()=>setSection("home")} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--accent)",fontSize:20,lineHeight:1,padding:"2px 4px",display:"flex",alignItems:"center",minWidth:44,minHeight:44,justifyContent:"center"}}>‹</button>
          <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-secondary)"}}>SAMPLE PROGRAMS</span>
        </div>
        <div style={{padding:"16px", display:"flex", flexDirection:"column", gap:12}}>
          <div style={{fontSize:12, color:"var(--text-muted)", lineHeight:1.6, padding:"0 4px 4px"}}>
            Browse example mesocycles to understand program structure. These are for reference — start a meso to build your own.
          </div>
          {SAMPLE_PROGRAMS.map(prog => {
            const isOpen = expandedProgram === prog.id;
            return (
              <div key={prog.id} style={{background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden"}}>
                <button onClick={()=>setExpandedProgram(isOpen ? null : prog.id)} style={{
                  width:"100%", textAlign:"left", background:"transparent", border:"none",
                  padding:"16px", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:12,
                }}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:800, color:"var(--text-primary)", marginBottom:4}}>{prog.label}</div>
                    <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                      <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-secondary)", background:"var(--bg-inset)", padding:"2px 8px", borderRadius:4}}>{prog.weeks} WEEKS</span>
                      <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-secondary)", background:"var(--bg-inset)", padding:"2px 8px", borderRadius:4}}>{prog.daysPerWeek} DAYS/WK</span>
                      <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.05em", color:"var(--text-secondary)", background:"var(--bg-inset)", padding:"2px 8px", borderRadius:4}}>{prog.split.toUpperCase()}</span>
                    </div>
                  </div>
                  <span style={{color:"var(--text-dim)", fontSize:20, flexShrink:0, transform:isOpen?"rotate(90deg)":"none", transition:"transform 0.2s", marginTop:2}}>›</span>
                </button>
                {isOpen && (
                  <div style={{borderTop:"1px solid var(--border)"}}>
                    <div style={{padding:"14px 16px", background:"var(--bg-inset)", borderBottom:"1px solid var(--border)"}}>
                      <p style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.65, margin:0}}>{prog.description}</p>
                    </div>
                    {prog.days.map((day, di) => {
                      const tc = TAG_COLORS[day.tag] || "var(--accent)";
                      return (
                        <div key={di} style={{padding:"12px 16px", borderBottom: di < prog.days.length-1 ? "1px solid var(--border-subtle)" : "none"}}>
                          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                            <span style={{fontSize:12, fontWeight:800, letterSpacing:"0.06em", color:tc, background:tc+"1a", padding:"2px 8px", borderRadius:4}}>{day.tag}</span>
                            <span style={{fontSize:12, fontWeight:700, color:"var(--text-primary)"}}>{day.label}</span>
                          </div>
                          <div style={{display:"flex", flexDirection:"column", gap:3}}>
                            {day.exercises.map((ex, ei) => (
                              <div key={ei} style={{fontSize:12, color:"var(--text-secondary)", paddingLeft:8, display:"flex", alignItems:"center", gap:6}}>
                                <div style={{width:4, height:4, borderRadius:"50%", background: ei===0 ? tc : "var(--border)", flexShrink:0}}/>
                                {ei===0 ? <strong style={{color:"var(--text-primary)", display:"inline-flex", alignItems:"center", gap:4}}>{ex} <HammerIcon size={13} /></strong> : ex}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {onStartProgram && (
                      <div style={{padding:"14px 16px"}}>
                        <button
                          onClick={() => setStartModalProg(prog)}
                          className="btn-primary"
                          style={{
                            width:"100%", padding:"12px", fontSize:13, fontWeight:700,
                            borderRadius:6, letterSpacing:"0.02em",
                            background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)",
                          }}
                        >
                          Start this program →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      {startModalProg && (
        <StartSampleProgramModal
          prog={startModalProg}
          hasActiveMeso={!!profile}
          onConfirm={startDate => {
            const experienceMap = { Beginner:"beginner", Intermediate:"intermediate", Advanced:"experienced", Experienced:"experienced" };
            const aiDays = buildAiDaysFromSample(startModalProg);
            const newProfile = {
              name:    profile?.name    || "",
              age:     profile?.age     || "",
              gender:  profile?.gender  || "",
              weight:  profile?.weight  || "",
              theme:   profile?.theme   || "dark",
              birthdate: profile?.birthdate || "",
              startDate,
              splitType:       startModalProg.splitType,
              daysPerWeek:     startModalProg.daysPerWeek,
              workoutDays:     startModalProg.defaultDays,
              mesoLength:      startModalProg.weeks,
              experience:      experienceMap[startModalProg.level] || "intermediate",
              equipment:       ["barbell","dumbbell","cable","machine","bodyweight","band","kettlebell"],
              sessionDuration: 60,
              aiDays,
              sampleProgramId: startModalProg.id,
              goal: startModalProg.label,
              autoBuilt: false,
            };
            saveProfile(newProfile);
            window.location.reload();
          }}
          onClose={() => setStartModalProg(null)}
        />
      )}
      </div>
    );
  }

  // ── Learn section ────────────────────────────────────────────────────────
  if (section === "learn") {
    const LEARN_CARDS = [
      {
        id: "foundry",
        emoji: "⚙️",
        title: "What The Foundry Does",
        subtitle: "The full picture",
        content: [
          {
            heading: "Your program, built for you",
            body: "The Foundry generates a complete training program based on your experience level, available equipment, training days, and goals. You don't pick exercises or decide on sets and reps — the app does that, following a proven structure that gets harder each week.",
          },
          {
            heading: "It tracks everything automatically",
            body: "Every time you finish a workout, The Foundry logs your weights, reps, and sets. It compares what you did to what was prescribed. It checks your volume against landmarks for each muscle group. It flags new PRs. It carries your weights forward to next week and tells you whether to go heavier or hold.",
          },
          {
            heading: "The loop",
            body: "Build program → Train for 4–10 weeks → Each week is heavier than the last → Final week is your peak → Deload → Start the next meso stronger. That's it. Every feature in the app exists to support that loop.",
          },
          {
            heading: "What you actually do",
            body: "Show up. Open the day. Log your sets. The Foundry handles the structure. Your only job is to push hard enough — the app tells you exactly what 'hard enough' means.",
          },
        ],
      },
      {
        id: "periodization",
        emoji: "📊",
        title: "Linear Periodization",
        subtitle: "Why each week gets harder",
        content: [
          {
            heading: "What periodization means",
            body: "Periodization is the practice of deliberately varying your training over time — rather than doing the same workouts indefinitely. The word comes from 'period': a structured block with a beginning, middle, and end.",
          },
          {
            heading: "Linear means one direction",
            body: "In linear periodization, one variable moves in a single direction across the training block. In The Foundry, both volume (sets per muscle group) and intensity (how close to failure you train) increase week over week. Week 1 is your easiest week. The final working week before deload is your hardest.",
          },
          {
            heading: "Why this works",
            body: "Your body adapts to stress. If the stress stays the same, adaptation slows and then stops. By increasing load progressively, you stay ahead of adaptation — your body has to keep growing and strengthening to keep up. Linear periodization applies this principle at the program level: each week the total demand is greater than the week before.",
          },
          {
            heading: "The deload",
            body: "After the final hard week, a deload drops volume and intensity sharply. This isn't a rest week — it's a recovery week. Fatigue clears, the nervous system resets, and you come back into the next meso with a higher baseline. The deload is what makes the next cycle possible.",
          },
          {
            heading: "Mesos compound over time",
            body: "Each mesocycle ends with you slightly stronger, slightly more muscular, and with more capacity for work than when you started. The next meso starts where this one ended. Over months and years, this compounding is what produces meaningful physical change.",
          },
        ],
      },
      {
        id: "overload",
        emoji: "📈",
        title: "Progressive Overload",
        subtitle: "The engine behind all progress",
        content: [
          {
            heading: "The core principle",
            body: "Progressive overload means systematically increasing the demands placed on your muscles over time. If you lift the same weight for the same reps forever, your body stops adapting. Progress requires more — more weight, more reps, more sets, or less rest — applied gradually and consistently.",
          },
          {
            heading: "How The Foundry applies it",
            body: "The app tracks two forms of overload simultaneously: load progression (weights increase when you complete all prescribed reps) and volume progression (working sets per muscle group increase across mesocycle phases). You don't have to think about it — the app tracks whether you hit your reps and tells you what to do next week.",
          },
          {
            heading: "Weight carry-forward logic",
            body: "At the start of each new week, The Foundry pulls your weights from the previous week. If you hit the top of your prescribed rep range on every working set, it nudges the weight up: +5 lbs for barbells, +2.5 lbs for everything else. If you didn't reach the top of the range on any set, the weight stays the same — grind out those reps first. Bodyweight exercises never get a load increase — volume drives overload there.",
          },
          {
            heading: "Why you can't skip the easy weeks",
            body: "Week 1 of a meso feels light. That's intentional. The weights are moderate, the RIR is high, and your body isn't yet fatigued. Each subsequent week builds on that base. If you go too hard in week 1, you won't have room to progress through weeks 3 and 4 — you'll plateau or burn out before the peak.",
          },
          {
            heading: "The reps-in-reserve anchor",
            body: "Progressive overload isn't just about load — it's about effort. The Foundry uses RIR (Reps In Reserve) to control how close to failure you train each week. As the meso progresses, RIR targets drop: you train harder, closer to your limit. This means overload happens at both the weight level and the effort level simultaneously.",
          },
        ],
      },
    ];

    const GLOSSARY = [
      { term:"Mesocycle", short:"A structured training block, typically 4–10 weeks.", detail:"The Foundry is organized around mesocycles. Each meso has a start date, a fixed number of weeks, a training split, and a built-in progression structure. When a meso ends, you archive it, take a deload, and start a new one — usually at a slightly higher baseline." },
      { term:"RIR — Reps In Reserve", short:"How many reps you had left before true failure.", detail:"RIR 4 means you finished a set with 4 more reps in the tank. RIR 1 means you were one rep from failure. The Foundry prescribes specific RIR targets by week: high early in the meso (lower intensity), low toward the end (higher intensity). RIR controls fatigue accumulation so you peak at the right time." },
      { term:"MEV — Minimum Effective Volume", short:"The fewest weekly sets needed to make progress.", detail:"MEV is the lower bound of productive training for a given muscle group. Training below MEV means you're not doing enough work to drive adaptation. The Foundry uses MEV as the floor for early-meso weeks." },
      { term:"MAV — Maximum Adaptive Volume", short:"The sweet spot. Where you make the best gains.", detail:"MAV is the range where training stimulus is high and recovery is manageable. This is where the bulk of a mesocycle should sit. The Foundry targets MAV in the middle and final working weeks." },
      { term:"MRV — Maximum Recoverable Volume", short:"The most volume your body can actually recover from.", detail:"Exceeding MRV means you're doing more work than your body can recover from between sessions. Gains slow or reverse, injury risk rises, and fatigue accumulates faster than fitness. The Foundry uses MRV as a hard ceiling — it won't program you above it." },
      { term:"Deload", short:"A planned low-intensity week to reset fatigue.", detail:"A deload drops volume and intensity sharply — typically 40–60% of normal working volume — to allow accumulated fatigue to clear. It's not a rest week; you still train. After a proper deload, strength and performance typically bounce back higher than pre-deload levels. The Foundry adds a deload week at the end of every mesocycle." },
      { term:"Anchor Lift", short:"The primary compound exercise for each training day.", detail:"Anchor lifts (marked with the hammer icon) are the barbell and heavy compound movements that form the backbone of each session: squats, bench press, deadlifts, overhead press, rows. Your anchor lift logs are used to calculate PRs and track long-term strength progress. Volume and intensity prescriptions are most important for anchor lifts." },
      { term:"Working Sets", short:"The sets that count. Warm-ups excluded.", detail:"Working sets are the sets performed at your actual training weight, at the prescribed intensity. Warm-up sets are not working sets — they exist to prepare your nervous system and joints, not to drive adaptation. The Foundry excludes warm-up sets from all volume calculations, PR tracking, and progression logic." },
      { term:"Split", short:"How you divide muscle groups across the week.", detail:"A training split determines which muscles you train on which days. The Foundry supports PPL (Push/Pull/Legs), Upper/Lower, Full Body, and Push/Pull. PPL trains each muscle group 2× per week on a 6-day schedule. Full Body trains everything 2–3× per week at lower volume per session. The right split depends on how many days you can train." },
      { term:"Volume Landmark", short:"Your per-muscle-group weekly set range.", detail:"Volume landmarks (MEV, MAV, MRV) are personalized to each muscle group because different muscles recover differently and respond to different amounts of work. Quads can handle 15–20+ sets per week. Rear delts might only need 10–12. The Foundry tracks current weekly sets per muscle and shows you where you are relative to your landmarks." },
      { term:"Peak Week", short:"The final, hardest working week before deload.", detail:"Peak week is the climax of the mesocycle — highest volume, lowest RIR, maximum intensity. It's designed to push you to your performance limit. After peak week, a deload allows recovery, and you'll often hit new PRs in the first session of the next meso as fatigue clears and fitness expresses itself." },
    ];

    const toggleLearn = (id) => setLearnOpen(learnOpen === id ? null : id);
    const toggleGloss = (t)  => setGlossaryOpen(glossaryOpen === t ? null : t);

    return (
      <div style={{animation:"tabFadeIn 0.15s ease-out", paddingBottom:90}}>
        {/* Sub-header */}
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"14px 16px 12px",
          background:"var(--bg-deep)", borderBottom:"1px solid var(--border)",
          position:"sticky", top:0, zIndex:10,
        }}>
          <button onClick={()=>setSection("home")} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--accent)",fontSize:20,lineHeight:1,padding:"2px 4px",display:"flex",alignItems:"center",minWidth:44,minHeight:44,justifyContent:"center"}}>‹</button>
          <span style={{fontSize:12, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-secondary)"}}>LEARN THE SYSTEM</span>
        </div>

        <div style={{padding:"16px", display:"flex", flexDirection:"column", gap:10}}>

          {/* ── Learn cards ── */}
          {LEARN_CARDS.map(card => {
            const isOpen = learnOpen === card.id;
            return (
              <div key={card.id} style={{
                background:"var(--bg-card)", border:"1px solid var(--border)",
                borderRadius:8, overflow:"hidden",
              }}>
                <button onClick={()=>toggleLearn(card.id)} style={{
                  width:"100%", textAlign:"left", background:"transparent", border:"none",
                  padding:"16px", cursor:"pointer", display:"flex", alignItems:"center", gap:14,
                }}>
                  <div style={{
                    width:42, height:42, borderRadius:8, flexShrink:0,
                    background:"rgba(var(--accent-rgb),0.18)", border:"1px solid rgba(var(--accent-rgb),0.35)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:22,
                  }}>{card.emoji}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:800, color:"var(--text-primary)", marginBottom:2}}>{card.title}</div>
                    <div style={{fontSize:12, color:"var(--text-muted)"}}>{card.subtitle}</div>
                  </div>
                  <span style={{
                    color:"var(--text-dim)", fontSize:20, flexShrink:0,
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition:"transform 0.2s",
                  }}>›</span>
                </button>
                {isOpen && (
                  <div style={{borderTop:"1px solid var(--border)"}}>
                    {card.content.map((section, i) => (
                      <div key={i} style={{
                        padding:"16px 16px",
                        borderBottom: i < card.content.length-1 ? "1px solid var(--border-subtle)" : "none",
                      }}>
                        <div style={{
                          fontSize:12, fontWeight:700, letterSpacing:"0.07em",
                          color:"var(--phase-intens)", marginBottom:8, textTransform:"uppercase",
                        }}>{section.heading}</div>
                        <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.7}}>
                          {section.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Glossary ── */}
          <div style={{
            marginTop:4,
            fontSize:12, fontWeight:700, letterSpacing:"0.08em",
            color:"var(--text-muted)", padding:"4px 0 8px",
          }}>GLOSSARY</div>

          {GLOSSARY.map(item => {
            const isOpen = glossaryOpen === item.term;
            return (
              <div key={item.term} style={{
                background:"var(--bg-card)", border:"1px solid var(--border)",
                borderRadius:8, overflow:"hidden",
              }}>
                <button onClick={()=>toggleGloss(item.term)} style={{
                  width:"100%", textAlign:"left", background:"transparent", border:"none",
                  padding:"13px 16px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:12,
                }}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:2}}>{item.term}</div>
                    <div style={{fontSize:12, color:"var(--text-muted)", lineHeight:1.45}}>{item.short}</div>
                  </div>
                  <span style={{
                    color:"var(--text-dim)", fontSize:18, flexShrink:0,
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition:"transform 0.2s",
                  }}>›</span>
                </button>
                {isOpen && (
                  <div style={{
                    padding:"0 16px 14px",
                    borderTop:"1px solid var(--border-subtle)",
                    paddingTop:12,
                  }}>
                    <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.7}}>
                      {item.detail}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Home section ─────────────────────────────────────────────────────────
  return (
    <div style={{animation:"tabFadeIn 0.15s ease-out", paddingBottom:90}}>
      {/* Hero */}
      <div style={{padding:"28px 20px 24px", background:"var(--bg-deep)", borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.12em", color:"var(--phase-intens)", marginBottom:8}}>THE FOUNDRY</div>
        <div style={{fontSize:22, fontWeight:900, color:"var(--text-primary)", letterSpacing:"-0.01em", lineHeight:1.2, marginBottom:12}}>
          Built to make you stronger.{"\n"}Week by week.
        </div>
        <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.7}}>
          Structured mesocycle training where volume and intensity progress week by week. Progressive overload, volume landmarks, and phase-aware intensity — all in one place.
        </div>
      </div>

      {/* Training philosophy callout */}
      <div style={{margin:"16px 16px 0", padding:"16px 18px", background:"rgba(var(--accent-rgb),0.07)", border:"1px solid rgba(var(--accent-rgb),0.2)", borderRadius:8}}>
        <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--accent)", marginBottom:8}}>THE METHODOLOGY</div>
        <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.7, marginBottom:12}}>
          The Foundry runs on <strong style={{color:"var(--text-primary)"}}>linear periodization</strong> — volume and intensity ramp each week until you peak, then you deload and reset. Every meso is designed to leave you stronger than when you started.
        </div>
        <button onClick={()=>setSection("learn")} style={{
          background:"transparent", border:"1px solid rgba(var(--accent-rgb),0.35)",
          borderRadius:5, padding:"7px 14px", fontSize:12, fontWeight:700,
          color:"var(--accent)", cursor:"pointer", letterSpacing:"0.05em",
        }}>Learn more →</button>
      </div>

      {/* Quick links */}
      <div style={{padding:"16px"}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <button onClick={()=>setSection("library")} style={{
            padding:"18px 16px", borderRadius:8, cursor:"pointer", textAlign:"left",
            background:"var(--bg-card)", border:"1px solid var(--border)",
            boxShadow:"var(--shadow-sm)",
          }}>
            <div style={{marginBottom:8}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="4" height="4"/><rect x="10" y="3" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/><rect x="3" y="17" width="4" height="4"/><rect x="10" y="17" width="4" height="4"/><rect x="17" y="17" width="4" height="4"/>
              </svg>
            </div>
            <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:4}}>Exercise Library</div>
            <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.5}}>{EXERCISE_DB.length} exercises · How To's & Supporting Videos</div>
          </button>
          <button onClick={()=>setSection("programs")} style={{
            padding:"18px 16px", borderRadius:8, cursor:"pointer", textAlign:"left",
            background:"var(--bg-card)", border:"1px solid var(--border)",
            boxShadow:"var(--shadow-sm)",
          }}>
            <div style={{marginBottom:8}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <div style={{fontSize:13, fontWeight:800, color:"var(--text-primary)", marginBottom:4}}>Sample Programs</div>
            <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.5}}>{SAMPLE_PROGRAMS.length} prebuilt mesos to browse</div>
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{padding:"0 16px 16px"}}>
        <div style={{fontSize:12, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-muted)", marginBottom:12}}>WHAT THE FOUNDRY DOES</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding:"14px 16px",
              background:"var(--bg-card)",
              border:"1px solid var(--border)",
              borderLeft:"3px solid var(--accent)",
              borderRadius:8,
            }}>
              <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.55}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExplorePage;
