import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { useExerciseDB, getSamplePrograms } from '../../data/exerciseDB';
import { CARDIO_WORKOUTS, MOBILITY_PROTOCOLS } from '../../data/constants';
import ExerciseBrowser from './ExerciseBrowser';
import SamplePrograms from './SamplePrograms';
import LearnSection from './LearnSection';
import MobilityBrowser from './MobilityBrowser';
import CardioBrowser from './CardioBrowser';

type Section = 'home' | 'library' | 'programs' | 'mobility' | 'cardio' | 'learn';

interface ExplorePageProps {
  profile: Record<string, unknown> | null;
  onStartProgram?: (program: Record<string, unknown>) => void;
}

function ExplorePage({ profile, onStartProgram }: ExplorePageProps) {
  const EXERCISE_DB = useExerciseDB();
  const [section, setSection] = useState<Section>('home');

  if (section === 'library') return <ExerciseBrowser onBack={() => setSection('home')} />;
  if (section === 'programs')
    return (
      <SamplePrograms
        profile={profile}
        onBack={() => setSection('home')}
        onStartProgram={onStartProgram}
      />
    );
  if (section === 'mobility') return <MobilityBrowser onBack={() => setSection('home')} />;
  if (section === 'cardio') return <CardioBrowser onBack={() => setSection('home')} />;
  if (section === 'learn') return <LearnSection onBack={() => setSection('home')} />;

  const tiles: {
    id: Exclude<Section, 'home' | 'learn'>;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'library',
      title: 'Exercise Library',
      subtitle: `${EXERCISE_DB.length} exercises · how-tos and video cues`,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="4" height="4" />
          <rect x="10" y="3" width="4" height="4" />
          <rect x="17" y="3" width="4" height="4" />
          <rect x="3" y="10" width="4" height="4" />
          <rect x="10" y="10" width="4" height="4" />
          <rect x="17" y="10" width="4" height="4" />
          <rect x="3" y="17" width="4" height="4" />
          <rect x="10" y="17" width="4" height="4" />
          <rect x="17" y="17" width="4" height="4" />
        </svg>
      ),
    },
    {
      id: 'programs',
      title: 'Sample Programs',
      subtitle: `${getSamplePrograms().length} prebuilt mesos, ready to run`,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
    {
      id: 'mobility',
      title: 'Mobility',
      subtitle: `${MOBILITY_PROTOCOLS.length} routines — shoulders, hips, spine, full-body`,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 18 A9 9 0 0 1 21 18" />
          <path d="M7 18 A5 5 0 0 1 17 18" />
          <line x1="12" y1="18" x2="12" y2="13" />
          <circle cx="12" cy="11" r="1.5" />
        </svg>
      ),
    },
    {
      id: 'cardio',
      title: 'Cardio',
      subtitle: `${CARDIO_WORKOUTS.length} protocols from Zone 2 to Tabata`,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 12 7 12 9 6 12 18 15 9 17 12 21 12" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      {/* The System callout */}
      <div
        style={{
          margin: '20px 16px 0',
          padding: '18px 20px',
          background: 'rgba(var(--accent-rgb),0.07)',
          border: '1px solid rgba(var(--accent-rgb),0.2)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--accent)',
            marginBottom: 10,
          }}
        >
          THE SYSTEM
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Progressive overload, by the book.
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            marginBottom: 14,
          }}
        >
          Volume and intensity ramp each week until you peak, then you deload and reset. Every
          feature in the app exists to support that loop.
        </div>
        <button
          onClick={() => setSection('learn')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(var(--accent-rgb),0.35)',
            borderRadius: tokens.radius.sm,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--accent)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Read more →
        </button>
      </div>

      {/* 4-tile 2×2 grid */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              style={{
                padding: '18px 16px',
                borderRadius: tokens.radius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ marginBottom: 8 }}>{t.icon}</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {t.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {t.subtitle}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExplorePage;
