import { useEffect, useState } from 'react';
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
  if (section === 'mobility')
    return (
      <MobilityBrowser
        onBack={() => setSection('home')}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
      />
    );
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
  }[] = [
    {
      id: 'library',
      title: 'Exercise Library',
      subtitle: `${EXERCISE_DB.length} exercises · how-tos and video cues`,
    },
    {
      id: 'programs',
      title: 'Sample Programs',
      subtitle: `${getSamplePrograms().length} prebuilt mesos, ready to run`,
    },
    {
      id: 'mobility',
      title: 'Mobility',
      subtitle: `${MOBILITY_PROTOCOLS.length} routines — shoulders, hips, spine, full-body`,
    },
    {
      id: 'cardio',
      title: 'Cardio',
      subtitle: `${CARDIO_WORKOUTS.length} protocols from Zone 2 to Tabata`,
    },
    {
      id: 'learn',
      title: 'The System',
      subtitle: 'Periodization, volume landmarks, progression — the why behind it all',
    },
  ];

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      <div style={{ padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tiles.map((t, i) => (
          <NumberedTile
            key={t.id}
            index={i}
            title={t.title}
            subtitle={t.subtitle}
            onClick={() => setSection(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function NumberedTile({
  index,
  title,
  subtitle,
  onClick,
}: {
  index: number;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        height: 76,
        padding: 0,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '64px 1fr auto',
        alignItems: 'stretch',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
        textAlign: 'left',
      }}
    >
      <div
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-inset, var(--bg-deep))',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 30,
            letterSpacing: '0.04em',
            color: 'var(--accent)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 20,
            letterSpacing: '0.05em',
            color: 'var(--text-primary)',
            lineHeight: 1,
            marginBottom: 5,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingRight: 16,
          color: 'var(--text-muted, var(--text-dim))',
          fontSize: 22,
          lineHeight: 1,
        }}
        aria-hidden
      >
        ›
      </div>
    </button>
  );
}

export default ExplorePage;
