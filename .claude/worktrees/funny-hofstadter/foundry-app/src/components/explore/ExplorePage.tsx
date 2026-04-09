import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { EXERCISE_DB, SAMPLE_PROGRAMS } from '../../data/exercises';
import { ExerciseBrowser } from './ExerciseBrowser';
import { SamplePrograms } from './SamplePrograms';
import { LearnSection } from './LearnSection';

interface ExplorePageProps {
  profile: any;
  onStartProgram?: (program: any) => void;
}

const FEATURES = [
  {
    title: 'Foundry Program Builder',
    desc: 'Answer 3 questions. The Foundry designs your entire mesocycle — exercises, sets, reps, progression, all of it.',
  },
  {
    title: 'Progressive Overload',
    desc: 'Every week gets harder. Volume landmarks and phase-aware intensity targets tell you exactly how hard to push each muscle group.',
  },
  {
    title: 'PR Tracking',
    desc: 'Every anchor lift tracked across all weeks. Sparkline history, trend arrows, peak week detection.',
  },
  {
    title: 'Rest Timer',
    desc: 'Auto-fires on every working set. Color-coded countdown with audio and haptic alerts at zero.',
  },
  {
    title: 'Volume Landmarks',
    desc: 'MEV, MAV, and MRV ranges per muscle group. Know exactly where you are in your training capacity.',
  },
  {
    title: 'Meso History',
    desc: 'Every completed cycle archived with PRs, volume, and profile snapshot. Your training record, always.',
  },
];

function ExplorePage({ profile, onStartProgram }: ExplorePageProps) {
  const [section, setSection] = useState('home'); // home | library | programs | learn

  if (section === 'library') {
    return <ExerciseBrowser onBack={() => setSection('home')} />;
  }

  if (section === 'programs') {
    return (
      <SamplePrograms
        profile={profile}
        onStartProgram={onStartProgram}
        onBack={() => setSection('home')}
      />
    );
  }

  if (section === 'learn') {
    return <LearnSection onBack={() => setSection('home')} />;
  }

  // ── Home section ─────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      {/* Hero */}
      <div
        style={{
          padding: '28px 20px 24px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--phase-intens)',
            marginBottom: 8,
          }}
        >
          THE FOUNDRY
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          Built to make you stronger.{'\n'}Week by week.
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Structured mesocycle training where volume and intensity progress week by week.
          Progressive overload, volume landmarks, and phase-aware intensity — all in one place.
        </div>
      </div>

      {/* Training philosophy callout */}
      <div
        style={{
          margin: '16px 16px 0',
          padding: '16px 18px',
          background: 'rgba(var(--accent-rgb),0.07)',
          border: '1px solid rgba(var(--accent-rgb),0.2)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            marginBottom: 8,
          }}
        >
          THE METHODOLOGY
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          The Foundry runs on{' '}
          <strong style={{ color: 'var(--text-primary)' }}>linear periodization</strong> — volume
          and intensity ramp each week until you peak, then you deload and reset. Every meso is
          designed to leave you stronger than when you started.
        </div>
        <button
          onClick={() => setSection('learn')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(var(--accent-rgb),0.35)',
            borderRadius: tokens.radius.sm,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Learn more →
        </button>
      </div>

      {/* Quick links */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={() => setSection('library')}
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
            <div style={{ marginBottom: 8 }}>
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
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              Exercise Library
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {EXERCISE_DB.length} exercises · How To's & Supporting Videos
            </div>
          </button>
          <button
            onClick={() => setSection('programs')}
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
            <div style={{ marginBottom: 8 }}>
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
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              Sample Programs
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {SAMPLE_PROGRAMS.length} prebuilt mesos to browse
            </div>
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}
        >
          WHAT THE FOUNDRY DOES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: tokens.radius.lg,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExplorePage;
