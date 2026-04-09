import React from 'react';
import { store } from '../../utils/store';

const workerUrl = import.meta.env.VITE_FOUNDRY_AI_WORKER_URL;

export function PricingPage({ onClose }) {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [emailError, setEmailError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) { setEmailError(true); return; }
    setEmailError(false);
    setSubmitting(true);
    // Always write to localStorage as fallback
    try { localStorage.setItem("foundry:pro_email", trimmed); } catch {}
    // POST to Worker — fire and move on; localStorage is the safety net
    try {
      await fetch((workerUrl || "") + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
    } catch { /* silent — localStorage already saved it */ }
    setSubmitting(false);
    setSubmitted(true);
  };

  const FREE_FEATURES = [
    "Full mesocycle program builder",
    "Auto weight progression every session",
    "Volume landmark tracking (MEV → MV)",
    "Cardio logging + guided interval timer",
    "Exercise library + swap sheet",
    "Session notes + PR detection",
    "Meso history + retrospective",
    "Permanently free under 18 and 62+",
  ];

  const PRO_FEATURES = [
    "The Foundry builds your program — personalized to your level, split, and goals",
    "Meso 2+ intelligence — your next program is built from what you actually lifted",
    "Next session preview — every exercise, weight, and target before you walk in",
    "Cardio plan woven into your mesocycle",
    "Stalling + recovery coaching — know when it's fatigue, not failure",
    "Full progress charts, e1RM estimates, and unlimited history",
  ];

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:400,
      background:"var(--bg-root)", overflowY:"auto",
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"16px 20px 14px",
        background:"var(--bg-deep)",
        borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:10,
      }}>
        <button onClick={onClose} style={{
          background:"transparent", border:"none", cursor:"pointer",
          color:"var(--accent)", fontSize:22, lineHeight:1, padding:"2px 4px",
          display:"flex", alignItems:"center", minWidth:44, minHeight:44, justifyContent:"center",
        }}>‹</button>
        <span style={{fontSize:17, fontWeight:800, color:"var(--text-primary)", letterSpacing:"-0.01em"}}>Plans</span>
      </div>

      <div style={{padding:"24px 20px 48px", maxWidth:440, margin:"0 auto", display:"flex", flexDirection:"column", gap:16}}>

        {/* Hero headline */}
        <div style={{textAlign:"center", padding:"8px 0 4px"}}>
          <div style={{fontSize:24, fontWeight:900, color:"var(--text-primary)", letterSpacing:"-0.02em", lineHeight:1.2, marginBottom:8}}>
            A $200/month coach.<br/>
            <span style={{color:"var(--phase-peak)"}}>For $12.</span>
          </div>
          <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6}}>
            The Foundry plans your training, auto-progresses your weights, and tracks every set — so you can just show up and lift.
          </div>
        </div>

        {/* ── FREE TIER ── */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, overflow:"hidden",
        }}>
          <div style={{padding:"18px 20px 14px"}}>
            <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.1em", color:"var(--text-muted)", marginBottom:6}}>FREE</div>
            <div style={{fontSize:22, fontWeight:900, color:"var(--text-primary)", marginBottom:2}}>$0</div>
            <div style={{fontSize:12, color:"var(--text-secondary)"}}>Forever. No catch.</div>
          </div>
          <div style={{borderTop:"1px solid var(--border)", padding:"14px 20px 18px", display:"flex", flexDirection:"column", gap:8}}>
            {FREE_FEATURES.map((f, i) => (
              <div key={i} style={{display:"flex", alignItems:"flex-start", gap:10}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:1}}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{fontSize:13, color:"var(--text-muted)", lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRO TIER ── */}
        <div style={{
          background:"linear-gradient(145deg, #1A1410 0%, #12100C 100%)",
          border:"1px solid var(--phase-peak)66",
          borderRadius:12, overflow:"hidden",
          boxShadow:`0 4px 32px rgba(212,152,60,0.12)`,
        }}>
          {/* PRO badge */}
          <div style={{
            background:"var(--phase-peak)", padding:"6px 20px",
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <span style={{fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:"#000"}}>PRO</span>
            <span style={{fontSize:11, fontWeight:700, color:"#000", opacity:0.7}}>Most popular</span>
          </div>

          <div style={{padding:"18px 20px 14px"}}>
            <div style={{display:"flex", alignItems:"flex-end", gap:16, marginBottom:4}}>
              {/* Monthly */}
              <div>
                <div style={{fontSize:28, fontWeight:900, color:"var(--text-primary)", lineHeight:1}}>$12</div>
                <div style={{fontSize:12, color:"var(--text-secondary)"}}>/month</div>
              </div>
              <div style={{width:1, height:36, background:"var(--border)"}} />
              {/* Annual */}
              <div>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <div style={{fontSize:28, fontWeight:900, color:"var(--phase-peak)", lineHeight:1}}>$99</div>
                  <span style={{
                    fontSize:10, fontWeight:800, letterSpacing:"0.06em",
                    color:"var(--phase-peak)", background:"var(--phase-peak)22",
                    border:"1px solid var(--phase-peak)44",
                    borderRadius:4, padding:"2px 6px",
                  }}>SAVE 2 MO</span>
                </div>
                <div style={{fontSize:12, color:"var(--text-secondary)"}}>/year</div>
              </div>
            </div>
          </div>

          <div style={{borderTop:"1px solid var(--phase-peak)22", padding:"14px 20px 20px", display:"flex", flexDirection:"column", gap:8}}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{display:"flex", alignItems:"flex-start", gap:10}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--phase-peak)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:1}}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{fontSize:13, color:"var(--text-primary)", lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>

          {/* Meso intelligence callout */}
          <div style={{
            margin:"0 20px 16px",
            padding:"14px 16px",
            background:"rgba(212,152,60,0.07)",
            border:"1px solid var(--phase-peak)44",
            borderLeft:"3px solid var(--phase-peak)",
            borderRadius:6,
          }}>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.1em", color:"var(--phase-peak)", marginBottom:6}}>MESO 2+ INTELLIGENCE</div>
            <div style={{fontSize:12, color:"var(--text-secondary)", lineHeight:1.7}}>
              Your second program isn't built from scratch — it's built from your actual meso 1 data. Peak weights, volume, stalling patterns, and your recovery profile. <strong style={{color:"var(--text-primary)"}}>The Foundry knows what you lifted.</strong>
            </div>
          </div>

          {/* CTA */}
          <div style={{padding:"0 20px 20px"}}>
            {submitted ? (
              <div style={{
                background:"var(--phase-peak)18", border:"1px solid var(--phase-peak)44",
                borderRadius:8, padding:"14px 16px", textAlign:"center",
              }}>
                <div style={{fontSize:15, fontWeight:800, color:"var(--phase-peak)", marginBottom:4}}>You're on the list</div>
                <div style={{fontSize:12, color:"var(--text-secondary)"}}>Check your inbox to confirm — then you're in.</div>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                <div style={{fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:2}}>
                  Get notified when Pro launches — be first in line.
                </div>
                <div style={{display:"flex", gap:8}}>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(false); }}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    style={{
                      flex:1, background:"rgba(255,255,255,0.06)",
                      border:`1px solid ${emailError ? "#e05252" : "var(--phase-peak)44"}`,
                      borderRadius:8, padding:"12px 14px",
                      fontSize:14, color:"var(--text-primary)",
                      outline:"none", fontFamily:"inherit",
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      padding:"12px 18px", borderRadius:8, cursor: submitting ? "default" : "pointer",
                      background:"var(--phase-peak)",
                      border:"none",
                      color:"#000", fontSize:13, fontWeight:800,
                      letterSpacing:"0.02em", flexShrink:0,
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >{submitting ? "..." : "Notify me"}</button>
                </div>
                {emailError && (
                  <div style={{fontSize:12, color:"#e05252"}}>Enter a valid email address</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── TRAINER TIER ── */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, overflow:"hidden", opacity:0.65,
        }}>
          <div style={{padding:"18px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                <div style={{fontSize:12, fontWeight:800, letterSpacing:"0.1em", color:"var(--text-muted)"}}>TRAINER</div>
                <span style={{fontSize:10, fontWeight:800, letterSpacing:"0.06em", color:"var(--phase-deload)", background:"var(--phase-deload)22", border:"1px solid var(--phase-deload)44", borderRadius:4, padding:"1px 6px"}}>COMING SOON</span>
              </div>
              <div style={{fontSize:22, fontWeight:900, color:"var(--text-primary)", marginBottom:2}}>$29<span style={{fontSize:13, fontWeight:600, color:"var(--text-dim)"}}>/month</span></div>
              <div style={{fontSize:12, color:"var(--text-secondary)"}}>For coaches and gym professionals</div>
            </div>
          </div>
          <div style={{borderTop:"1px solid var(--border)", padding:"14px 20px 18px", display:"flex", flexDirection:"column", gap:8}}>
            {["Client management dashboard", "Share programs with clients", "Coach notes per client session", "Everything in Pro"].map((f, i) => (
              <div key={i} style={{display:"flex", alignItems:"flex-start", gap:10}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--phase-deload)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:1}}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{fontSize:13, color: i === 3 ? "var(--text-muted)" : "var(--text-secondary)", lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BUILT BY STORY ── */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, padding:"24px 20px",
        }}>
          <div style={{
            fontSize:11, fontWeight:800, letterSpacing:"0.12em",
            color:"var(--text-muted)", marginBottom:16, textTransform:"uppercase",
          }}>Built for the long game.</div>

          <p style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.8, marginBottom:14}}>
            Most systems fail people — and that failure is exactly what keeps so many from becoming who they want to be. Not lack of effort. Not lack of heart. The system let them down. I've lived that. I've watched people I care about live that. And I got tired of it.
          </p>
          <p style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.8, marginBottom:14}}>
            The Foundry is my answer to that. Not just a tracker, not just a program — a system that thinks ahead, holds the line, and refuses to let you down. One that meets you where you are and walks every rep of the journey with you.
          </p>
          <p style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.8, marginBottom:14}}>
            My goal is to live past 100. Not just exist — thrive. Strong, sharp, and fully alive for every year of it. And the more people I can bring with me on that journey, the better off every single one of us will be.
          </p>
          <p style={{fontSize:13, color:"var(--text-primary)", fontWeight:700, lineHeight:1.8, marginBottom:20}}>
            There's room for all of us at the top.
          </p>

          <div style={{
            display:"flex", alignItems:"center", gap:12,
            borderTop:"1px solid var(--border-subtle)", paddingTop:16,
          }}>
            <div style={{
              width:40, height:40, borderRadius:"50%", flexShrink:0,
              background:"linear-gradient(135deg, #2E2418 0%, #1A1410 100%)",
              border:"1px solid var(--border-accent)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16,
            }}></div>
            <div>
              <div style={{fontSize:13, fontWeight:700, color:"var(--text-primary)"}}>James</div>
              <div style={{fontSize:12, color:"var(--text-muted)"}}>Founder, The Foundry</div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div style={{textAlign:"center", fontSize:12, color:"var(--text-muted)", lineHeight:1.7, padding:"4px 0"}}>
          Free tier is permanently free for users under 18 and adults 62+.<br/>
          No credit card required to get notified.
        </div>

      </div>
    </div>
  );
}

