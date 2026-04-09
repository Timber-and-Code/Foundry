import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';

const LEARN_CARDS = [
  {
    id: 'foundry',
    emoji: '⚙️',
    title: 'What The Foundry Does',
    subtitle: 'The full picture',
    content: [
      {
        heading: 'Your program, built for you',
        body: "The Foundry generates a complete training program based on your experience level, available equipment, training days, and goals. You don't pick exercises or decide on sets and reps — the app does that, following a proven structure that gets harder each week.",
      },
      {
        heading: 'It tracks everything automatically',
        body: 'Every time you finish a workout, The Foundry logs your weights, reps, and sets. It compares what you did to what was prescribed. It checks your volume against landmarks for each muscle group. It flags new PRs. It carries your weights forward to next week and tells you whether to go heavier or hold.',
      },
      {
        heading: 'The loop',
        body: "Build program → Train for 4–10 weeks → Each week is heavier than the last → Final week is your peak → Deload → Start the next meso stronger. That's it. Every feature in the app exists to support that loop.",
      },
      {
        heading: 'What you actually do',
        body: "Show up. Open the day. Log your sets. The Foundry handles the structure. Your only job is to push hard enough — the app tells you exactly what 'hard enough' means.",
      },
    ],
  },
  {
    id: 'periodization',
    emoji: '📊',
    title: 'Linear Periodization',
    subtitle: 'Why each week gets harder',
    content: [
      {
        heading: 'What periodization means',
        body: "Periodization is the practice of deliberately varying your training over time — rather than doing the same workouts indefinitely. The word comes from 'period': a structured block with a beginning, middle, and end.",
      },
      {
        heading: 'Linear means one direction',
        body: 'In linear periodization, one variable moves in a single direction across the training block. In The Foundry, both volume (sets per muscle group) and intensity (how close to failure you train) increase week over week. Week 1 is your easiest week. The final working week before deload is your hardest.',
      },
      {
        heading: 'Why this works',
        body: 'Your body adapts to stress. If the stress stays the same, adaptation slows and then stops. By increasing load progressively, you stay ahead of adaptation — your body has to keep growing and strengthening to keep up. Linear periodization applies this principle at the program level: each week the total demand is greater than the week before.',
      },
      {
        heading: 'The deload',
        body: "After the final hard week, a deload drops volume and intensity sharply. This isn't a rest week — it's a recovery week. Fatigue clears, the nervous system resets, and you come back into the next meso with a higher baseline. The deload is what makes the next cycle possible.",
      },
      {
        heading: 'Mesos compound over time',
        body: 'Each mesocycle ends with you slightly stronger, slightly more muscular, and with more capacity for work than when you started. The next meso starts where this one ended. Over months and years, this compounding is what produces meaningful physical change.',
      },
    ],
  },
  {
    id: 'overload',
    emoji: '📈',
    title: 'Progressive Overload',
    subtitle: 'The engine behind all progress',
    content: [
      {
        heading: 'The core principle',
        body: 'Progressive overload means systematically increasing the demands placed on your muscles over time. If you lift the same weight for the same reps forever, your body stops adapting. Progress requires more — more weight, more reps, more sets, or less rest — applied gradually and consistently.',
      },
      {
        heading: 'How The Foundry applies it',
        body: "The app tracks two forms of overload simultaneously: load progression (weights increase when you complete all prescribed reps) and volume progression (working sets per muscle group increase across mesocycle phases). You don't have to think about it — the app tracks whether you hit your reps and tells you what to do next week.",
      },
      {
        heading: 'Weight carry-forward logic',
        body: "At the start of each new week, The Foundry pulls your weights from the previous week. If you hit the top of your prescribed rep range on every working set, it nudges the weight up: +5 lbs for barbells, +2.5 lbs for everything else. If you didn't reach the top of the range on any set, the weight stays the same — grind out those reps first. Bodyweight exercises never get a load increase — volume drives overload there.",
      },
      {
        heading: "Why you can't skip the easy weeks",
        body: "Week 1 of a meso feels light. That's intentional. The weights are moderate, the RIR is high, and your body isn't yet fatigued. Each subsequent week builds on that base. If you go too hard in week 1, you won't have room to progress through weeks 3 and 4 — you'll plateau or burn out before the peak.",
      },
      {
        heading: 'The reps-in-reserve anchor',
        body: "Progressive overload isn't just about load — it's about effort. The Foundry uses RIR (Reps In Reserve) to control how close to failure you train each week. As the meso progresses, RIR targets drop: you train harder, closer to your limit. This means overload happens at both the weight level and the effort level simultaneously.",
      },
    ],
  },
];

const GLOSSARY = [
  {
    term: 'Mesocycle',
    short: 'A structured training block, typically 4–10 weeks.',
    detail:
      'The Foundry is organized around mesocycles. Each meso has a start date, a fixed number of weeks, a training split, and a built-in progression structure. When a meso ends, you archive it, take a deload, and start a new one — usually at a slightly higher baseline.',
  },
  {
    term: 'RIR — Reps In Reserve',
    short: 'How many reps you had left before true failure.',
    detail:
      'RIR 4 means you finished a set with 4 more reps in the tank. RIR 1 means you were one rep from failure. The Foundry prescribes specific RIR targets by week: high early in the meso (lower intensity), low toward the end (higher intensity). RIR controls fatigue accumulation so you peak at the right time.',
  },
  {
    term: 'MEV — Minimum Effective Volume',
    short: 'The fewest weekly sets needed to make progress.',
    detail:
      "MEV is the lower bound of productive training for a given muscle group. Training below MEV means you're not doing enough work to drive adaptation. The Foundry uses MEV as the floor for early-meso weeks.",
  },
  {
    term: 'MAV — Maximum Adaptive Volume',
    short: 'The sweet spot. Where you make the best gains.',
    detail:
      'MAV is the range where training stimulus is high and recovery is manageable. This is where the bulk of a mesocycle should sit. The Foundry targets MAV in the middle and final working weeks.',
  },
  {
    term: 'MRV — Maximum Recoverable Volume',
    short: 'The most volume your body can actually recover from.',
    detail:
      "Exceeding MRV means you're doing more work than your body can recover from between sessions. Gains slow or reverse, injury risk rises, and fatigue accumulates faster than fitness. The Foundry uses MRV as a hard ceiling — it won't program you above it.",
  },
  {
    term: 'Deload',
    short: 'A planned low-intensity week to reset fatigue.',
    detail:
      "A deload drops volume and intensity sharply — typically 40–60% of normal working volume — to allow accumulated fatigue to clear. It's not a rest week; you still train. After a proper deload, strength and performance typically bounce back higher than pre-deload levels. The Foundry adds a deload week at the end of every mesocycle.",
  },
  {
    term: 'Anchor Lift',
    short: 'The primary compound exercise for each training day.',
    detail:
      'Anchor lifts (marked with the hammer icon) are the barbell and heavy compound movements that form the backbone of each session: squats, bench press, deadlifts, overhead press, rows. Your anchor lift logs are used to calculate PRs and track long-term strength progress. Volume and intensity prescriptions are most important for anchor lifts.',
  },
  {
    term: 'Working Sets',
    short: 'The sets that count. Warm-ups excluded.',
    detail:
      'Working sets are the sets performed at your actual training weight, at the prescribed intensity. Warm-up sets are not working sets — they exist to prepare your nervous system and joints, not to drive adaptation. The Foundry excludes warm-up sets from all volume calculations, PR tracking, and progression logic.',
  },
  {
    term: 'Split',
    short: 'How you divide muscle groups across the week.',
    detail:
      'A training split determines which muscles you train on which days. The Foundry supports PPL (Push/Pull/Legs), Upper/Lower, Full Body, and Push/Pull. PPL trains each muscle group 2× per week on a 6-day schedule. Full Body trains everything 2–3× per week at lower volume per session. The right split depends on how many days you can train.',
  },
  {
    term: 'Volume Landmark',
    short: 'Your per-muscle-group weekly set range.',
    detail:
      'Volume landmarks (MEV, MAV, MRV) are personalized to each muscle group because different muscles recover differently and respond to different amounts of work. Quads can handle 15–20+ sets per week. Rear delts might only need 10–12. The Foundry tracks current weekly sets per muscle and shows you where you are relative to your landmarks.',
  },
  {
    term: 'Peak Week',
    short: 'The final, hardest working week before deload.',
    detail:
      "Peak week is the climax of the mesocycle — highest volume, lowest RIR, maximum intensity. It's designed to push you to your performance limit. After peak week, a deload allows recovery, and you'll often hit new PRs in the first session of the next meso as fatigue clears and fitness expresses itself.",
  },
];

interface LearnSectionProps {
  onBack: () => void;
}

export function LearnSection({ onBack }: LearnSectionProps) {
  const [learnOpen, setLearnOpen] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState<string | null>(null);

  const toggleLearn = (id: string) => setLearnOpen(learnOpen === id ? null : id);
  const toggleGloss = (t: string) => setGlossaryOpen(glossaryOpen === t ? null : t);

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      {/* Sub-header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-secondary)',
          }}
        >
          LEARN THE SYSTEM
        </span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Learn cards */}
        {LEARN_CARDS.map((card) => {
          const isOpen = learnOpen === card.id;
          return (
            <div
              key={card.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggleLearn(card.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: tokens.radius.lg,
                    flexShrink: 0,
                    background: 'rgba(var(--accent-rgb),0.18)',
                    border: '1px solid rgba(var(--accent-rgb),0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  {card.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      marginBottom: 2,
                    }}
                  >
                    {card.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.subtitle}</div>
                </div>
                <span
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 20,
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                >
                  ›
                </span>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {card.content.map((section, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '16px 16px',
                        borderBottom:
                          i < card.content.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          color: 'var(--phase-intens)',
                          marginBottom: 8,
                          textTransform: 'uppercase',
                        }}
                      >
                        {section.heading}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.7,
                        }}
                      >
                        {section.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Glossary */}
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            padding: '4px 0 8px',
          }}
        >
          GLOSSARY
        </div>

        {GLOSSARY.map((item) => {
          const isOpen = glossaryOpen === item.term;
          return (
            <div
              key={item.term}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggleGloss(item.term)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '13px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: 2,
                    }}
                  >
                    {item.term}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {item.short}
                  </div>
                </div>
                <span
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 18,
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                >
                  ›
                </span>
              </button>
              {isOpen && (
                <div
                  style={{
                    padding: '0 16px 14px',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
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
