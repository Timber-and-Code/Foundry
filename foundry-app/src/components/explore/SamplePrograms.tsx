import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { SAMPLE_PROGRAMS } from '../../data/exercises';
import { saveProfile } from '../../utils/store';
import HammerIcon from '../shared/HammerIcon';

const TAG_COLORS: Record<string, string> = {
  PUSH: '#E8651A',
  PULL: '#4EA8DE',
  LEGS: '#6BCB77',
};

// Build AI days array from a sample program's day definitions
const buildAiDaysFromSample = (prog: Record<string, unknown>) => {
  if (!prog || !prog.days) return [];
  return (prog.days as Record<string, unknown>[]).map((day: Record<string, unknown>) => ({
    label: day.label || day.name || 'Day',
    tag: day.tag || 'PUSH',
    exercises: ((day.exercises || []) as Record<string, unknown>[]).map((ex: Record<string, unknown>) => ({
      name: ex.name || ex,
      sets: ex.sets || 3,
      repRange: ex.repRange || '8-12',
      progression: ex.progression || 'standard',
      warmup: ex.warmup || null,
    })),
  }));
};

// Modal for starting a sample program
const StartSampleProgramModal = ({
  prog,
  hasActiveMeso,
  onConfirm,
  onCancel,
}: {
  prog: Record<string, unknown>;
  hasActiveMeso: boolean;
  onConfirm: (startDate: string) => void;
  onCancel: () => void;
}) => {
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayLight,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xl,
          padding: 24,
          maxWidth: 400,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {prog.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {prog.splitType} · {prog.daysPerWeek} days/wk · {prog.weeks} weeks
        </div>
        {hasActiveMeso && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--danger)',
              background: 'rgba(255,0,0,0.08)',
              border: '1px solid var(--danger)',
              borderRadius: tokens.radius.md,
              padding: 10,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            ⚠ This will replace your current mesocycle. Your existing data will be archived.
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(startDate)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Start Program
          </button>
        </div>
      </div>
    </div>
  );
};

interface SampleProgramsProps {
  profile: Record<string, unknown> | null;
  onBack: () => void;
  onStartProgram?: (program: Record<string, unknown>) => void;
}

function SamplePrograms({ profile, onBack, onStartProgram }: SampleProgramsProps) {
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [startModalProg, setStartModalProg] = useState<(typeof SAMPLE_PROGRAMS)[number] | null>(
    null
  );

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
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
          SAMPLE PROGRAMS
        </span>
      </div>
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            padding: '0 4px 4px',
          }}
        >
          Browse example mesocycles to understand program structure. These are for reference —
          start a meso to build your own.
        </div>
        {SAMPLE_PROGRAMS.map((prog) => {
          const isOpen = expandedProgram === prog.id;
          return (
            <div
              key={prog.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedProgram(isOpen ? null : prog.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {prog.label}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-inset)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {prog.weeks} WEEKS
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-inset)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {prog.daysPerWeek} DAYS/WK
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-inset)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {prog.split.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 20,
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                    marginTop: 2,
                  }}
                >
                  ›
                </span>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: 'var(--bg-inset)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {prog.description}
                    </p>
                  </div>
                  {prog.days.map((day, di) => {
                    const tc = TAG_COLORS[day.tag] || 'var(--accent)';
                    return (
                      <div
                        key={di}
                        style={{
                          padding: '12px 16px',
                          borderBottom:
                            di < prog.days.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: '0.06em',
                              color: tc,
                              background: tc + '1a',
                              padding: '2px 8px',
                              borderRadius: tokens.radius.sm,
                            }}
                          >
                            {day.tag}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {day.label}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                        >
                          {day.exercises.map((ex, ei) => (
                            <div
                              key={ei}
                              style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                paddingLeft: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: '50%',
                                  background: ei === 0 ? tc : 'var(--border)',
                                  flexShrink: 0,
                                }}
                              />
                              {ei === 0 ? (
                                <strong
                                  style={{
                                    color: 'var(--text-primary)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  {ex} <HammerIcon size={13} />
                                </strong>
                              ) : (
                                ex
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {onStartProgram && (
                    <div style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => setStartModalProg(prog)}
                        className="btn-primary"
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: tokens.radius.md,
                          letterSpacing: '0.02em',
                          background: 'var(--btn-primary-bg)',
                          border: '1px solid var(--btn-primary-border)',
                          color: 'var(--btn-primary-text)',
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
          onConfirm={(startDate: string) => {
            const experienceMap: Record<string, string> = {
              Beginner: 'beginner',
              Intermediate: 'intermediate',
              Advanced: 'experienced',
              Experienced: 'experienced',
            };
            const aiDays = buildAiDaysFromSample(startModalProg);
            const newProfile = {
              name: profile?.name || '',
              age: profile?.age || '',
              gender: profile?.gender || '',
              weight: profile?.weight || '',
              theme: profile?.theme || 'dark',
              birthdate: profile?.birthdate || '',
              startDate,
              splitType: startModalProg.splitType,
              daysPerWeek: startModalProg.daysPerWeek,
              workoutDays: startModalProg.defaultDays,
              mesoLength: startModalProg.weeks,
              experience: experienceMap[startModalProg.level] || 'intermediate',
              equipment: [
                'barbell',
                'dumbbell',
                'cable',
                'machine',
                'bodyweight',
                'band',
                'kettlebell',
              ],
              sessionDuration: 60,
              aiDays,
              sampleProgramId: startModalProg.id,
              goal: startModalProg.label,
              autoBuilt: false,
            };
            saveProfile(newProfile);
            window.location.reload();
          }}
          onCancel={() => setStartModalProg(null)}
        />
      )}
    </div>
  );
}

export default SamplePrograms;
