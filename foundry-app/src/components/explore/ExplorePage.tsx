import React, { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { useExerciseDB, getSamplePrograms } from '../../data/exerciseDB';
import { CARDIO_WORKOUTS, MOBILITY_PROTOCOLS } from '../../data/constants';
import { store } from '../../utils/store';
import ExerciseBrowser from './ExerciseBrowser';
import SamplePrograms from './SamplePrograms';
import LearnSection from './LearnSection';
import MobilityBrowser from './MobilityBrowser';
import CardioBrowser from './CardioBrowser';
import type { Profile } from '../../types';

type Section = 'home' | 'library' | 'programs' | 'mobility' | 'cardio' | 'learn';

interface ExplorePageProps {
  profile: Profile | null;
  onStartProgram?: (program: Record<string, unknown>) => void;
  onProfileUpdate?: (updates: Partial<Profile>) => void;
}

function ExplorePage({ profile, onStartProgram, onProfileUpdate }: ExplorePageProps) {
  const EXERCISE_DB = useExerciseDB();
  // Deep-link: when MesoCompleteSheet routes here via "Try a Foundry
  // program", it sets foundry:pending_samples. Open the programs
  // view directly on mount so the user doesn't land on the Explore
  // home and have to tap in.
  const [section, setSection] = useState<Section>(() =>
    store.get('foundry:pending_samples') === '1' ? 'programs' : 'home',
  );
  useEffect(() => {
    if (store.get('foundry:pending_samples') === '1') {
      store.remove('foundry:pending_samples');
    }
  }, []);

  if (section === 'library') return <ExerciseBrowser onBack={() => setSection('home')} />;
  if (section === 'programs')
    return (
      <SamplePrograms
        profile={profile as unknown as Record<string, unknown> | null}
        onBack={() => setSection('home')}
        onStartProgram={onStartProgram}
      />
    );
  if (section === 'mobility') return <MobilityBrowser onBack={() => setSection('home')} />;
  if (section === 'cardio')
    return (
      <CardioBrowser
        onBack={() => setSection('home')}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
      />
    );
  if (section === 'learn') return <LearnSection onBack={() => setSection('home')} />;

  const tiles: {
    id: Exclude<Section, 'home'>;
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
    {
      id: 'learn',
      title: 'The System',
      subtitle: 'Periodization, volume landmarks, progression — the why behind it all',
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      <div style={{ padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            style={{
              padding: '16px 18px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              textAlign: 'left',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              width: '100%',
            }}
          >
            <div style={{ flexShrink: 0 }}>{t.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 3,
                }}
              >
                {t.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                {t.subtitle}
              </div>
            </div>
            <span
              aria-hidden="true"
              style={{
                color: 'var(--text-dim)',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ExplorePage;
