import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// Data
import { PHASE_COLOR, TAG_ACCENT, getProgTargets, getWeekPhase } from '../../data/constants';

// Utils
import {
  store,
  getWarmupDetail,
  generateWarmupSteps,
  loadArchive,
  loadExerciseHistory,
} from '../../utils/store';
import HammerIcon from '../shared/HammerIcon';

function ExerciseCard({ exercise, exIdx, dayIdx, weekIdx, weekData, onUpdateSet, onWeightAutoFill, onLastSetFilled, expanded, onToggle, done, readOnly, onSwapClick, onSetLogged, bodyweight, note, onNoteChange }) {
  const goal = getProgTargets()[exercise.progression]?.[weekIdx];
  const goalColor = weekIdx < 2 ? "var(--text-muted)" : weekIdx < 4 ? "var(--phase-accum)" : weekIdx < 5 ? "var(--phase-intens)" : "var(--danger)";
  const [showHistory, setShowHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!(note && note.trim()));

  // Load prev week raw data for "Last session" context hints
  const prevWeekRaw = useMemo(() => {
    if (weekIdx === 0) return {};
    try {
      const raw = store.get(`ppl:day${dayIdx}:week${weekIdx - 1}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, [dayIdx, weekIdx]);

  // Cross-meso context note — week 0 only
  // Finds the same exercise in the most recent archived meso's last working week
  const crossMesoNote = useMemo(() => {
    if (weekIdx !== 0) return null;
    try {
      const archive = loadArchive();
      if (!archive.length) return null;
      const recent = archive[0];
      // Last working week = mesoWeeks - 1 (skip deload which is index mesoWeeks)
      const lastWorkingWeek = recent.mesoWeeks - 1;
      // Find sessions for this exercise name in the last working week
      const exName = exercise.name.toLowerCase();
      let bestWeight = 0, bestReps = 0;
      recent.sessions.forEach(sess => {
        if (sess.w !== lastWorkingWeek) return;
        const exData = sess.data;
        // Check all exercise slots in that session
        Object.values(exData).forEach((exSets, idx) => {
          // Match by exercise name via override or program position
          const ovId = recent.sessions.find(s2 => s2.d === sess.d && s2.w === sess.w)
            ?.exOvs?.[idx];
          // We don't have the exercise name easily — match by finding the best set
          // with meaningful weight across the session and compare to current exercise
          // Simple approach: look for data under same exIdx in same day position
          if (idx === exIdx) {
            Object.values(exSets || {}).forEach(sd => {
              if (!sd || !sd.weight || !sd.reps || sd.warmup) return;
              const w = parseFloat(sd.weight);
              const r = parseInt(sd.reps);
              if (w > bestWeight || (w === bestWeight && r > bestReps)) {
                bestWeight = w; bestReps = r;
              }
            });
          }
        });
      });
      if (bestWeight > 0 && bestReps > 0) {
        return `Last meso: ${bestWeight} lbs × ${bestReps}`;
      }
      return null;
    } catch { return null; }
  }, [weekIdx, exIdx, exercise.name]);

  const [doneSets, setDoneSets] = React.useState(() => {
    const exData = weekData[exIdx] || {};
    const restored = new Set();
    for (let s = 0; s < exercise.sets; s++) {
      const sd = exData[s] || {};
      // Only restore as done if user explicitly confirmed — not from suggested reps
      if (sd.confirmed === true) restored.add(s);
    }
    return restored;
  });
  const handleWeightBlur = (s, value) => {
    if (s === 0 && value.trim() !== "" && !isNaN(parseFloat(value))) {
      onWeightAutoFill(exIdx, value, exercise.sets);
    }
  };

  const handleRepsChange = (s, value) => {
    onUpdateSet(exIdx, s, "reps", value);
    // Un-done the set if user edits it
    setDoneSets(prev => { const n = new Set(prev); n.delete(s); return n; });
  };

  const handleRepsBlur = (s, value) => {
    // No-op: set completion now driven by explicit checkmark tap
  };

  const handleSetCheckmark = (s) => {
    if (doneSets.has(s)) {
      // Uncheck — re-enable editing, clear confirmed flag
      setDoneSets(prev => { const n = new Set(prev); n.delete(s); return n; });
      onUpdateSet(exIdx, s, "confirmed", false);
      return;
    }
    const setData = (weekData[exIdx] || {})[s] || {weight:"", reps:""};
    // Only allow check if reps are entered
    if (!setData.reps || setData.reps === "") return;
    // Write confirmed flag so doneSets restores correctly on remount
    // Also clear repsSuggested so stall detection counts this as real data
    onUpdateSet(exIdx, s, "confirmed", true);
    setDoneSets(prev => new Set([...prev, s]));
    // Track that user confirmed at least one set — used for "Last set filled" tracking
    onLastSetFilled(exIdx, s);
  };

  // Compute stall detection based on previous week's set data and this week's input
  const {stallWarning, stallTarget} = useMemo(() => {
    const curr = (weekData[exIdx] || {})[0] || {};
    const reps = parseInt(curr.reps || 0);
    const weight = parseFloat(curr.weight || 0);
    const prevData = prevWeekRaw[exIdx] || {};
    // Default: match prev week's best
    let stallTarget = null, stallWarning = false;
    for (let ps = 0; ps < (exercise.sets || 4); ps++) {
      const psd = prevData[ps] || {};
      if (!psd.reps || !psd.weight || psd.warmup) continue;
      const pw = parseFloat(psd.weight);
      const pr = parseInt(psd.reps);
      if (!stallTarget || pw > stallTarget.w || (pw === stallTarget.w && pr > stallTarget.r)) {
        stallTarget = {w:pw, r:pr};
      }
    }
    // Stall if weight drops and reps don't increase enough to compensate
    if (stallTarget && weight > 0) {
      const prevRepsEquiv = stallTarget.r * (stallTarget.w / weight); // Reps equivalent at new weight
      if (weight < stallTarget.w - 2 && reps < prevRepsEquiv) {
        stallWarning = true;
      }
    }
    return {stallTarget, stallWarning};
  }, [weekData, exIdx, prevWeekRaw, exercise.sets]);

  // Load history sparkline on expanded
  useEffect(() => {
    if (!expanded) return;
    try {
      const rows = [];
      // Last 3 weeks in current meso
      for (let w = weekIdx - 1; w >= Math.max(0, weekIdx - 3); w--) {
        const rawData = store.get(`ppl:day${dayIdx}:week${w}`);
        if (!rawData) continue;
        const parsed = JSON.parse(rawData);
        const exData = parsed[exIdx] || {};
        const weights = [], reps = [];
        for (const [setIdx, sd] of Object.entries(exData)) {
          if (!sd.weight || !sd.reps || sd.warmup) continue;
          weights.push(parseFloat(sd.weight));
          reps.push(parseInt(sd.reps));
        }
        if (weights.length > 0) {
          rows.push({
            w: w,
            maxW: Math.max(...weights),
            maxR: Math.max(...reps),
            sets: weights.length
          });
        }
      }
      setHistoryRows(rows);
    } catch {}
  }, [expanded, weekIdx, exIdx, dayIdx]);

  const handleHistoryClick = () => {
    setShowHistory(!showHistory);
  };

  const handleHowToClick = () => {
    setShowHowTo(!showHowTo);
  };

  const handleWarmupClick = () => {
    setShowWarmupModal(!showWarmupModal);
  };

  const workingWeight = useMemo(() => {
    const exData = weekData[exIdx] || {};
    for (let s = 0; s < exercise.sets; s++) {
      const w = exData[s]?.weight;
      if (w && !isNaN(parseFloat(w))) {
        return parseFloat(w);
      }
    }
    // Fall back to previous week
    const psd = prevWeekRaw[exIdx] || {};
    for (let s = 0; s < exercise.sets; s++) {
      const w = psd[s]?.weight;
      if (w && !isNaN(parseFloat(w))) {
        return parseFloat(w);
      }
    }
    return 185; // Default fallback
  }, [weekData, exIdx, prevWeekRaw, exercise.sets]);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12, overflow: "hidden", transition: "border-color 0.2s" }}>
      {/* ── HEADER (clickable to expand) ── */}
      <div onClick={() => onToggle()} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card-hover)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {/* Icon / Status */}
          <div style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>
            {done ? "✓" : exercise.cardio ? "♪" : "💪"}
          </div>

          {/* Title + Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {exercise.name}
            </span>
            {exercise.anchor && <HammerIcon size={16} style={{ marginTop: 1 }} />}
            {exercise.modifier && (
              <span style={{ fontSize: 11, background: "var(--bg-inset)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>
                {exercise.modifier}
              </span>
            )}
          </div>
        </div>

        {/* Goal + Expand arrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: goalColor }}>
            {goal}
          </div>
          <span style={{ fontSize: 16, color: "var(--text-secondary)" }}>
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </div>

      {/* ── EXPANDED CONTENT ── */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          {/* Exercise meta */}
          {exercise.description && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              {exercise.description}
            </div>
          )}

          {/* Warmup & How To buttons */}
          {exercise.warmup && !done && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button onClick={handleWarmupClick} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, padding: "10px 12px", borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🔥 Warmup Guide
              </button>
              <button onClick={() => setWarmupOpen(!warmupOpen)} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, padding: "10px 12px", borderRadius: 6, background: warmupOpen ? "rgba(var(--accent-rgb),0.15)" : "var(--bg-inset)", border: warmupOpen ? "1px solid var(--text-accent)" : "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🏋️ 2 Ramp Sets
              </button>
              <button onClick={handleHowToClick} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, padding: "10px 12px", borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🎬 How To Video
              </button>
            </div>
          )}
          {/* Ramp sets detail (toggles open/closed) */}
          {warmupOpen && exercise.warmup && !done && (
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", background: "var(--bg-inset)", padding: 12, borderRadius: 6, marginBottom: 12, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, color: "var(--text-accent)", marginBottom: 6 }}>Ramp-Up Sets</div>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                {generateWarmupSteps(exercise, workingWeight).map((step, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Stall warning */}
          {stallWarning && (
            <div style={{ background: "rgba(255, 193, 7, 0.1)", border: "1px solid var(--danger)", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12, color: "var(--danger)", lineHeight: 1.5 }}>
              ⚠ Weight drop detected. Last week: {stallTarget?.w} × {stallTarget?.r}
            </div>
          )}

          {/* Previous week hint */}
          {prevWeekRaw[exIdx] && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, padding: "8px", background: "var(--bg-inset)", borderRadius: 4 }}>
              Last session: {Object.values(prevWeekRaw[exIdx] || {}).find(sd => sd.weight && sd.reps && !sd.warmup) ? `${Object.values(prevWeekRaw[exIdx])[0]?.weight} × ${Object.values(prevWeekRaw[exIdx])[0]?.reps}` : "—"}
            </div>
          )}

          {/* Cross-meso note */}
          {crossMesoNote && (
            <div style={{ fontSize: 12, color: "var(--text-accent)", marginBottom: 12, padding: "8px", background: "var(--bg-inset)", borderRadius: 4 }}>
              {crossMesoNote}
            </div>
          )}

          {/* Set logging grid */}
          {!done && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8, fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                <div>Weight (lbs)</div>
                <div>Reps</div>
                <div>RPE</div>
                <div>✓</div>
              </div>
              {Array.from({ length: exercise.sets }).map((_, s) => {
                const sd = (weekData[exIdx] || {})[s] || {};
                const isDone = doneSets.has(s);
                return (
                  <div key={s} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 6, opacity: isDone ? 0.6 : 1 }}>
                    <input
                      type="number"
                      placeholder="—"
                      value={sd.weight || ""}
                      onChange={(e) => onUpdateSet(exIdx, s, "weight", e.target.value)}
                      onBlur={(e) => handleWeightBlur(s, e.target.value)}
                      disabled={isDone || readOnly}
                      style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                    />
                    <input
                      type="number"
                      placeholder="—"
                      value={sd.reps || ""}
                      onChange={(e) => handleRepsChange(s, e.target.value)}
                      onBlur={(e) => handleRepsBlur(s, e.target.value)}
                      disabled={isDone || readOnly}
                      style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                    />
                    <input
                      type="number"
                      placeholder="—"
                      value={sd.rpe || ""}
                      onChange={(e) => onUpdateSet(exIdx, s, "rpe", e.target.value)}
                      disabled={isDone || readOnly}
                      style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                    />
                    <button
                      onClick={() => handleSetCheckmark(s)}
                      disabled={readOnly}
                      style={{ width: 32, height: 32, border: isDone ? "2px solid var(--success)" : "1px solid var(--border)", borderRadius: 4, background: isDone ? "var(--success)" : "var(--bg-inset)", color: isDone ? "white" : "var(--text-primary)", cursor: readOnly ? "default" : "pointer", fontSize: 14, fontWeight: 700 }}
                    >
                      {isDone ? "✓" : ""}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleHistoryClick} style={{ flex: 1, minWidth: 100, fontSize: 12, padding: "8px 12px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer" }}>
              📊 History
            </button>
            <button onClick={handleHowToClick} style={{ flex: 1, minWidth: 100, fontSize: 12, padding: "8px 12px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer" }}>
              🎬 How To Video
            </button>
            {!done && !readOnly && (
              <button onClick={() => onSwapClick(exIdx)} style={{ flex: 1, minWidth: 100, fontSize: 12, padding: "8px 12px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-accent)", cursor: "pointer" }}>
                🔄 Swap
              </button>
            )}
          </div>

          {/* Notes section */}
          {noteOpen && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <textarea
                placeholder="Add notes..."
                value={note || ""}
                onChange={(e) => onNoteChange(exIdx, e.target.value)}
                style={{ width: "100%", minHeight: 80, padding: "8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-inset)", color: "var(--text-primary)", fontSize: 12, resize: "vertical", outline: "none" }}
              />
            </div>
          )}

          {/* History Modal */}
          {showHistory && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowHistory(false)}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, maxWidth: 400, width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{exercise.name} - History</div>
                {historyRows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyRows.map((row, idx) => (
                      <div key={idx} style={{ padding: 10, background: "var(--bg-inset)", borderRadius: 4, fontSize: 12 }}>
                        Week {row.w}: {row.maxW} lbs × {row.maxR} reps ({row.sets} sets)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No history available</div>
                )}
                <button onClick={() => setShowHistory(false)} style={{ marginTop: 16, width: "100%", padding: "8px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* How-To Modal */}
          {showHowTo && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowHowTo(false)}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, maxWidth: 400, width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{exercise.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 16 }}>HOW TO VIDEO</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                  {exercise.howTo || "Video guide coming soon"}
                </div>
                <button onClick={() => setShowHowTo(false)} style={{ width: "100%", padding: "8px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Warmup Modal */}
          {showWarmupModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowWarmupModal(false)}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, maxWidth: 400, width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Warmup Guide</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                  {getWarmupDetail(exercise.warmup, exercise.name)?.detail}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Steps:</div>
                <ol style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16, paddingLeft: 20 }}>
                  {generateWarmupSteps(exercise, workingWeight).map((step, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>{step}</li>
                  ))}
                </ol>
                <button onClick={() => setShowWarmupModal(false)} style={{ width: "100%", padding: "8px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExerciseCard;
