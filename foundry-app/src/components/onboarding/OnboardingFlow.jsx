import React, { useState, useRef } from 'react';
import { GOAL_OPTIONS } from '../../data/constants';
import { store, importData } from '../../utils/store';
import {
  FOUNDRY_DOOR_IMG,
  FOUNDRY_IRON_IMG,
  FOUNDRY_STEEL_IMG,
  FOUNDRY_GOAL_IMG,
  FOUNDRY_READY_IMG,
} from '../../data/images-onboarding';

/**
 * OnboardingFlow - Multi-screen onboarding experience
 *
 * Screens:
 *  0: Door splash (intro)
 *  1: Name input + restore data option
 *  2: Experience selection
 *  3: Goal selection
 *  4: Ready confirmation
 *
 * Features:
 *  - Slide animations with swipe support
 *  - Progress dots
 *  - Touch swipe navigation
 *  - localStorage persistence via store utility
 */
export default function OnboardingFlow({ onDone }) {
  const TOTAL = 5;
  const [screen, setScreen]         = React.useState(0);
  const [animDir, setAnimDir]       = React.useState(1);
  const [animating, setAnimating]   = React.useState(false);
  const [error, setError]           = React.useState("");
  const [name, setName]             = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [goal, setGoal]             = React.useState("");
  const [nameFocused, setNameFocused] = React.useState(false);

  const goTo = (idx, dir = 1) => {
    if (animating) return;
    setError("");
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => { setScreen(idx); setAnimating(false); }, 220);
  };

  const advance = () => {
    setError("");
    if (screen === 0) { goTo(1, 1); return; }
    if (screen === 1 && !name.trim()) { setError("Please enter your name to continue."); return; }
    if (screen === 2 && !experience) { setError("Please select your experience level."); return; }
    if (screen === 3 && !goal) { setError("Please select a goal."); return; }
    if (screen < TOTAL - 1) {
      goTo(screen + 1, 1);
    } else {
      store.set("ppl:onboarding_data", JSON.stringify({ name: name.trim(), experience }));
      store.set("ppl:onboarding_goal", goal);
      store.set("ppl:onboarded", "1");
      onDone();
    }
  };

  const goBack = () => { if (screen > 0) goTo(screen - 1, -1); };

  const touchStart = React.useRef(null);
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && screen < TOTAL - 1) advance();
    if (dx > 0 && screen > 0) goBack();
  };

  const slideStyle = {
    transition: animating ? "none" : "opacity 0.22s ease, transform 0.22s ease",
    opacity: animating ? 0 : 1,
    transform: animating ? `translateX(${animDir * 24}px)` : "translateX(0)",
  };

  /* Shared back button with proper 44px touch target */
  const BackButton = () => (
    <button onClick={goBack} style={{
      background:"rgba(26,24,20,0.5)", border:"1px solid rgba(46,42,36,0.5)",
      cursor:"pointer", color:"var(--accent)", fontSize:18, fontWeight:700,
      lineHeight:1, width:44, height:44, borderRadius:22,
      display:"flex", alignItems:"center", justifyContent:"center",
      alignSelf:"flex-start", textShadow:"0 1px 4px rgba(0,0,0,0.8)",
      WebkitBackdropFilter:"blur(8px)", backdropFilter:"blur(8px)",
      flexShrink:0,
    }}>&#8249;</button>
  );

  /* Shared CTA button style */
  const ctaBtnStyle = {
    width:"85%", padding:"16px", fontSize:"clamp(15px, 4vw, 18px)", fontWeight:600, borderRadius:12,
    letterSpacing:"0.06em", textTransform:"uppercase",
    background:"var(--btn-primary-bg)", color:"var(--btn-primary-text)",
    border:"1px solid var(--btn-primary-border)",
    boxShadow:"0 4px 24px rgba(232,101,26,0.35)",
  };

  /* Progress dots */
  const ProgressDots = () => (
    <div style={{display:"flex", gap:8, justifyContent:"center", paddingTop:16, paddingBottom:8}}>
      {Array.from({length: TOTAL}, (_, i) => (
        <div key={i} style={{
          width: i === screen ? 24 : 8, height:8, borderRadius:4,
          background: i === screen ? "#E8651A" : i < screen ? "rgba(232,101,26,0.5)" : "rgba(138,122,104,0.4)",
          transition:"all 0.25s ease",
        }}/>
      ))}
    </div>
  );

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{
      minHeight:"100vh", background:"var(--bg-root)", color:"var(--text-primary)",
      fontFamily:"'Inter',system-ui,sans-serif", maxWidth:480, margin:"0 auto",
      display:"flex", flexDirection:"column", overflow:"hidden",
    }}>

      {/* SCREEN 0: THE FORGE DOOR */}
      {screen === 0 && (
        <div style={{flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:"100vh", overflow:"hidden"}}>
          <img src={FOUNDRY_DOOR_IMG} alt=""
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 40%", opacity:0.9, zIndex:0}} />
          <div style={{position:"absolute", inset:0, zIndex:1,
            background:"linear-gradient(to bottom, rgba(10,10,12,0.88) 0%, rgba(10,10,12,0.6) 12%, rgba(10,10,12,0.05) 30%, rgba(10,10,12,0.0) 45%, rgba(10,10,12,0.05) 60%, rgba(10,10,12,0.5) 78%, rgba(10,10,12,0.92) 90%, rgba(10,10,12,0.98) 100%)"}} />
          <div style={{position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", paddingTop:60, gap:6}}>
            <div style={{fontFamily:"'Bebas Neue','Inter',sans-serif", fontSize:"clamp(38px, 10vw, 52px)", letterSpacing:"0.2em", color:"#FBF7E4",
              textShadow:"0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(232,101,26,0.25)"}}>THE FOUNDRY</div>
            <div style={{fontSize:"clamp(13px, 3.5vw, 17px)", letterSpacing:"0.2em", textTransform:"uppercase", color:"#F29A52", fontWeight:500,
              textShadow:"0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)"}}>Forge Your Physique</div>
            <div style={{fontSize:"clamp(13px, 3.5vw, 17px)", letterSpacing:"0.2em", textTransform:"uppercase", color:"#F29A52", fontWeight:500,
              textShadow:"0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)"}}>Forge Your Fitness</div>
          </div>
          <div style={{position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"0 24px 48px"}}>
            <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>Enter The Forge</button>
            <div style={{fontSize:"clamp(11px, 3vw, 14px)", color:"#8A7A68", letterSpacing:"0.06em", textTransform:"uppercase"}}>Science-driven strength training</div>
            <ProgressDots />
          </div>
        </div>
      )}

      {/* SCREEN 1: NAME + RESTORE */}
      {screen === 1 && (
        <div style={{flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:"100vh", overflow:"hidden"}}>
          <img src={FOUNDRY_IRON_IMG} alt=""
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 45%", opacity:0.9, zIndex:0}} />
          <div style={{position:"absolute", inset:0, zIndex:1,
            background:"linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)"}} />
          <div style={{position:"relative", zIndex:2, flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"60px 24px 40px", ...slideStyle}}>
            <div style={{display:"flex", flexDirection:"column", gap:28}}>
              <BackButton />
              <div>
                <div style={{fontFamily:"'Bebas Neue','Inter',sans-serif", fontSize:"clamp(32px, 8vw, 42px)", letterSpacing:"0.1em", color:"#FBF7E4", lineHeight:1.1, textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>
                  What should<br/>we call you?
                </div>
              </div>
              <input type="text" placeholder="Your name" value={name} autoFocus
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") advance(); }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={{
                  width:"100%", padding:"14px 16px", borderRadius:10, fontSize:"clamp(16px, 4.2vw, 20px)",
                  background:"rgba(26,24,20,0.08)",
                  border: nameFocused ? "1px solid #E8651A" : "1px solid rgba(232,101,26,0.15)",
                  color:"#FBF7E4", outline:"none", boxSizing:"border-box",
                  fontFamily:"inherit", fontWeight:500,
                  WebkitBackdropFilter:"blur(12px)", backdropFilter:"blur(12px)",
                  transition:"border-color 0.2s ease",
                  boxShadow: nameFocused ? "0 0 12px rgba(232,101,26,0.15)" : "none",
                }}
              />
              {error && <div style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"var(--danger)", fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{error}</div>}
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>Continue</button>
              <label style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"#E8651A", cursor:"pointer", textShadow:"0 1px 4px rgba(0,0,0,0.8)", display:"inline-flex", alignItems:"center", gap:6}}>
                Restore existing data
                <input type="file" accept=".json" style={{display:"none"}} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  importData(file, (ok) => {
                    if (ok) { store.set("ppl:onboarded","1"); window.location.reload(); }
                    else alert("Couldn't read that file. Make sure it's a Foundry backup (.json).");
                  });
                }}/>
              </label>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: EXPERIENCE */}
      {screen === 2 && (
        <div style={{flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:"100vh", overflow:"hidden"}}>
          <img src={FOUNDRY_STEEL_IMG} alt=""
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center center", opacity:0.9, zIndex:0}} />
          <div style={{position:"absolute", inset:0, zIndex:1,
            background:"linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)"}} />
          <div style={{position:"relative", zIndex:2, flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"52px 20px 40px", ...slideStyle}}>
            <div style={{display:"flex", flexDirection:"column", gap:18}}>
              <BackButton />
              <div>
                <div style={{fontFamily:"'Bebas Neue','Inter',sans-serif", fontSize:"clamp(32px, 8vw, 42px)", letterSpacing:"0.1em", color:"#FBF7E4", lineHeight:1.1, textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>
                  How long have you<br/>been training?
                </div>
                <div style={{fontSize:"clamp(15px, 4vw, 19px)", color:"#C0B8AC", marginTop:6, fontWeight:400, textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)"}}>
                  This shapes your starting volume and intensity
                </div>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:4}}>
                {[
                  { id:"new",          label:"Beginner",     desc:"Less than 1 year of consistent lifting" },
                  { id:"intermediate", label:"Intermediate", desc:"1–3 years with structured programming" },
                  { id:"advanced",     label:"Advanced",     desc:"3+ years of serious training" },
                ].map(opt => {
                  const sel = experience === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setExperience(opt.id)} style={{
                      padding:"14px 16px", borderRadius:10, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(232,101,26,0.15)" : "transparent",
                      border: `1px solid ${sel ? "rgba(232,101,26,0.6)" : "transparent"}`,
                      display:"flex", alignItems:"center", gap:12,
                      WebkitBackdropFilter: sel ? "blur(20px)" : "none", backdropFilter: sel ? "blur(20px)" : "none",
                      transition:"all 0.15s ease",
                    }}>
                      <div style={{width:18, height:18, borderRadius:"50%", flexShrink:0,
                        border: `2px solid ${sel ? "#E8651A" : "rgba(232,101,26,0.35)"}`,
                        background: sel ? "#E8651A" : "transparent",
                        boxShadow: sel ? "inset 0 0 0 3px rgba(26,24,20,0.8)" : "none",
                        transition:"all 0.15s ease",
                      }}/>
                      <div>
                        <span style={{fontSize:"clamp(16px, 4.2vw, 20px)", color:sel ? "#FBF7E4" : "#E8E4DC", fontWeight:sel ? 600 : 500, display:"block", textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)"}}>{opt.label}</span>
                        <span style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"#C0B8AC", marginTop:2, display:"block", textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)"}}>{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && <div style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"var(--danger)", fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{error}</div>}
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", width:"100%"}}>
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>Continue</button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: GOAL */}
      {screen === 3 && (
        <div style={{flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:"100vh", overflow:"hidden"}}>
          <img src={FOUNDRY_GOAL_IMG} alt=""
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center center", opacity:0.9, zIndex:0}} />
          <div style={{position:"absolute", inset:0, zIndex:1,
            background:"linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)"}} />
          <div style={{position:"relative", zIndex:2, flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"52px 20px 40px", ...slideStyle}}>
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              <BackButton />
              <div>
                <div style={{fontFamily:"'Bebas Neue','Inter',sans-serif", fontSize:"clamp(32px, 8vw, 42px)", letterSpacing:"0.1em", color:"#FBF7E4", lineHeight:1.1, textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>
                  What's your<br/>primary goal?
                </div>
                <div style={{fontSize:"clamp(15px, 4vw, 19px)", color:"#C0B8AC", marginTop:6, fontWeight:400, textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)"}}>
                  Your program is built around this choice
                </div>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap:7}}>
                {GOAL_OPTIONS.map(opt => {
                  const sel = goal === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setGoal(opt.id)} style={{
                      padding:"13px 16px", borderRadius:10, cursor:"pointer", textAlign:"left",
                      background: sel ? "rgba(232,101,26,0.15)" : "transparent",
                      border: `1px solid ${sel ? "rgba(232,101,26,0.6)" : "transparent"}`,
                      display:"flex", alignItems:"center", gap:12,
                      WebkitBackdropFilter: sel ? "blur(20px)" : "none", backdropFilter: sel ? "blur(20px)" : "none",
                      transition:"all 0.15s ease",
                    }}>
                      <div style={{width:18, height:18, borderRadius:"50%", flexShrink:0,
                        border: `2px solid ${sel ? "#E8651A" : "rgba(232,101,26,0.35)"}`,
                        background: sel ? "#E8651A" : "transparent",
                        boxShadow: sel ? "inset 0 0 0 3px rgba(26,24,20,0.8)" : "none",
                        transition:"all 0.15s ease",
                      }}/>
                      <div>
                        <span style={{fontSize:"clamp(16px, 4.2vw, 20px)", color:sel ? "#FBF7E4" : "#E8E4DC", fontWeight:sel ? 600 : 500, display:"block", textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)"}}>{opt.label}</span>
                        <span style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"#C0B8AC", marginTop:2, display:"block", textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)"}}>{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && <div style={{fontSize:"clamp(13px, 3.5vw, 16px)", color:"var(--danger)", fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{error}</div>}
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", width:"100%"}}>
              <button onClick={advance} className="btn-primary" style={ctaBtnStyle}>Continue</button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 4: READY — handoff to meso setup */}
      {screen === 4 && (
        <div style={{flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:"100vh", overflow:"hidden"}}>
          <img src={FOUNDRY_READY_IMG} alt=""
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 50%", opacity:0.9, zIndex:0}} />
          <div style={{position:"absolute", inset:0, zIndex:1,
            background:"linear-gradient(to bottom, rgba(10,10,12,0.7) 0%, rgba(10,10,12,0.15) 18%, rgba(10,10,12,0.0) 35%, rgba(10,10,12,0.0) 55%, rgba(10,10,12,0.4) 75%, rgba(10,10,12,0.92) 100%)"}} />
          <div style={{position:"relative", zIndex:2, flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"52px 24px 40px", ...slideStyle}}>
            <div>
              <BackButton />
              <div style={{marginTop:14}}>
                <div style={{fontFamily:"'Bebas Neue','Inter',sans-serif", fontSize:"clamp(34px, 9vw, 46px)", letterSpacing:"0.15em", color:"#FBF7E4", lineHeight:1.15,
                  textShadow:"0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(232,101,26,0.2)"}}>
                  Ready to forge,<br/>{name.trim() || "lifter"}?
                </div>
                <div style={{fontSize:"clamp(16px, 4.2vw, 20px)", color:"#E8E4DC", marginTop:10, lineHeight:1.6, maxWidth:320, fontWeight:400,
                  textShadow:"0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.7)"}}>
                  Next you'll dial in the details — equipment, schedule, and preferences. Then The Foundry builds your program.
                </div>
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:12, width:"100%"}}>
              <button onClick={advance} className="btn-primary" style={{...ctaBtnStyle, fontSize:"clamp(16px, 4.2vw, 20px)", padding:"18px"}}>Build My Program</button>
              <ProgressDots />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
