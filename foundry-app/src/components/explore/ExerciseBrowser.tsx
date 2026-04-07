import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { EXERCISE_DB } from '../../data/exercises';
import HammerIcon from '../shared/HammerIcon';
import ExerciseDetailModal from './ExerciseDetailModal';

const TAG_COLORS: Record<string, string> = {
  PUSH: '#E8651A',
  PULL: '#4EA8DE',
  LEGS: '#6BCB77',
};

const ALL_TAGS = ['ALL', 'PUSH', 'PULL', 'LEGS'];
const ALL_EQUIPS = [
  'ALL',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
];
const ALL_MUSCLES = [
  'ALL',
  'Chest',
  'Back',
  'Lats',
  'Shoulders',
  'Traps',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Abs',
  'Obliques',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'LowerBack',
];
const PATTERN_MAP: Record<string, string> = {
  ALL: 'All',
  push: 'Press',
  pull: 'Row/Pull',
  squat: 'Squat',
  hinge: 'Hinge',
  carry: 'Carry',
  isolation: 'Isolation',
};
const ALL_PATTERNS = ['ALL', 'push', 'pull', 'squat', 'hinge', 'carry', 'isolation'];

const equipLabels: Record<string, string> = {
  ALL: 'All',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
};
const muscleLabels: Record<string, string> = {
  ALL: 'All Muscles',
  Chest: 'Chest',
  Back: 'Back',
  Lats: 'Lats',
  Shoulders: 'Shoulders',
  Traps: 'Traps',
  Biceps: 'Biceps',
  Triceps: 'Triceps',
  Forearms: 'Forearms',
  Core: 'Core',
  Abs: 'Abs',
  Obliques: 'Obliques',
  Quads: 'Quads',
  Hamstrings: 'Hamstrings',
  Glutes: 'Glutes',
  Calves: 'Calves',
  LowerBack: 'Lower Back',
};
const tagLabels: Record<string, string> = { ALL: 'All', PUSH: 'Push', PULL: 'Pull', LEGS: 'Legs' };

const FilterRow = ({
  label,
  options,
  value,
  labelMap,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  labelMap?: Record<string, string>;
  onChange: (value: string) => void;
}) => (
  <div style={{ marginBottom: 14 }}>
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt: string) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '5px 12px',
              borderRadius: tokens.radius.round,
              border: '1px solid',
              borderColor: active ? 'var(--phase-intens)' : 'var(--border)',
              background: active ? 'rgba(232,101,26,0.15)' : 'transparent',
              color: active ? 'var(--phase-intens)' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {labelMap ? labelMap[opt] || opt : opt}
          </button>
        );
      })}
    </div>
  </div>
);

interface ExerciseBrowserProps {
  onBack: () => void;
}

function ExerciseBrowser({ onBack }: ExerciseBrowserProps) {
  const [libFilter, setLibFilter] = useState({
    tag: 'ALL',
    equip: 'ALL',
    muscle: 'ALL',
    pattern: 'ALL',
    search: '',
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showHowTo, setShowHowTo] = useState<(typeof EXERCISE_DB)[number] | null>(null);

  const activeFilterCount = [
    libFilter.tag,
    libFilter.equip,
    libFilter.muscle,
    libFilter.pattern,
  ].filter((v) => v !== 'ALL').length;

  const filteredEx = useMemo(() => {
    return EXERCISE_DB.filter((e) => {
      if (libFilter.tag !== 'ALL' && e.tag !== libFilter.tag) return false;
      if (libFilter.equip !== 'ALL' && e.equipment !== libFilter.equip) return false;
      if (libFilter.muscle !== 'ALL' && !(e.muscles || [e.muscle]).includes(libFilter.muscle))
        return false;
      if (libFilter.pattern !== 'ALL' && e.pattern !== libFilter.pattern) return false;
      if (libFilter.search) {
        const q = libFilter.search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.muscle?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [libFilter]);

  // Lazy loading: show 30 at a time, load more as user scrolls
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [libFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredEx.length));
  }, [filteredEx.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, visibleCount]);

  const visibleEx = filteredEx.slice(0, visibleCount);

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      {showHowTo && <ExerciseDetailModal ex={showHowTo} onClose={() => setShowHowTo(null)} />}
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
          onClick={() => {
            onBack();
            setShowFilterPanel(false);
          }}
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
          EXERCISE LIBRARY
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          {filteredEx.length} exercises
        </span>
      </div>

      {/* Search + Filter button row */}
      <div
        style={{
          padding: '12px 16px 0',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search by name or muscle..."
          value={libFilter.search}
          onChange={(e) => setLibFilter((f) => ({ ...f, search: e.target.value }))}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: tokens.radius.lg,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 13,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <button
          onClick={() => setShowFilterPanel((p) => !p)}
          style={{
            flexShrink: 0,
            padding: '10px 14px',
            borderRadius: tokens.radius.lg,
            cursor: 'pointer',
            border: `1px solid ${showFilterPanel || activeFilterCount > 0 ? 'var(--phase-intens)' : 'var(--border)'}`,
            background:
              showFilterPanel || activeFilterCount > 0
                ? 'rgba(232,101,26,0.12)'
                : 'var(--bg-card)',
            color:
              showFilterPanel || activeFilterCount > 0
                ? 'var(--phase-intens)'
                : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            position: 'relative',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                minWidth: 16,
                height: 16,
                borderRadius: tokens.radius.lg,
                background: 'var(--phase-intens)',
                color: '#000',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips -- shown when filters active but panel closed */}
      {!showFilterPanel && activeFilterCount > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 16px 0',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {libFilter.tag !== 'ALL' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px 3px 10px',
                borderRadius: tokens.radius.round,
                background: 'rgba(232,101,26,0.15)',
                border: '1px solid var(--phase-intens)44',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--phase-intens)',
              }}
            >
              {tagLabels[libFilter.tag]}
              <button
                onClick={() => setLibFilter((f) => ({ ...f, tag: 'ALL' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--phase-intens)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '4px',
                  minWidth: 28,
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </div>
          )}
          {libFilter.equip !== 'ALL' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px 3px 10px',
                borderRadius: tokens.radius.round,
                background: 'rgba(232,101,26,0.15)',
                border: '1px solid var(--phase-intens)44',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--phase-intens)',
              }}
            >
              {equipLabels[libFilter.equip]}
              <button
                onClick={() => setLibFilter((f) => ({ ...f, equip: 'ALL' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--phase-intens)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '4px',
                  minWidth: 28,
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </div>
          )}
          {libFilter.muscle !== 'ALL' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px 3px 10px',
                borderRadius: tokens.radius.round,
                background: 'rgba(232,101,26,0.15)',
                border: '1px solid var(--phase-intens)44',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--phase-intens)',
              }}
            >
              {muscleLabels[libFilter.muscle] || libFilter.muscle}
              <button
                onClick={() => setLibFilter((f) => ({ ...f, muscle: 'ALL' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--phase-intens)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '4px',
                  minWidth: 28,
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </div>
          )}
          {libFilter.pattern !== 'ALL' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px 3px 10px',
                borderRadius: tokens.radius.round,
                background: 'rgba(232,101,26,0.15)',
                border: '1px solid var(--phase-intens)44',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--phase-intens)',
              }}
            >
              {PATTERN_MAP[libFilter.pattern]}
              <button
                onClick={() => setLibFilter((f) => ({ ...f, pattern: 'ALL' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--phase-intens)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '4px',
                  minWidth: 28,
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </div>
          )}
          <button
            onClick={() =>
              setLibFilter((f) => ({
                ...f,
                tag: 'ALL',
                equip: 'ALL',
                muscle: 'ALL',
                pattern: 'ALL',
              }))
            }
            style={{
              padding: '3px 10px',
              borderRadius: tokens.radius.round,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Collapsible filter panel */}
      {showFilterPanel && (
        <div
          style={{
            margin: '10px 16px 0',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.xl,
            padding: '16px 16px 8px',
          }}
        >
          <FilterRow
            label="MUSCLE GROUP"
            options={ALL_MUSCLES}
            value={libFilter.muscle}
            labelMap={muscleLabels}
            onChange={(v: string) => setLibFilter((f) => ({ ...f, muscle: v }))}
          />
          <FilterRow
            label="EQUIPMENT"
            options={ALL_EQUIPS}
            value={libFilter.equip}
            labelMap={equipLabels}
            onChange={(v: string) => setLibFilter((f) => ({ ...f, equip: v }))}
          />
          <FilterRow
            label="MOVEMENT"
            options={ALL_PATTERNS}
            value={libFilter.pattern}
            labelMap={PATTERN_MAP}
            onChange={(v: string) => setLibFilter((f) => ({ ...f, pattern: v }))}
          />
          <FilterRow
            label="SPLIT TAG"
            options={ALL_TAGS}
            value={libFilter.tag}
            labelMap={tagLabels}
            onChange={(v: string) => setLibFilter((f) => ({ ...f, tag: v }))}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 6 }}>
            {activeFilterCount > 0 && (
              <button
                onClick={() =>
                  setLibFilter((f) => ({
                    ...f,
                    tag: 'ALL',
                    equip: 'ALL',
                    muscle: 'ALL',
                    pattern: 'ALL',
                  }))
                }
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowFilterPanel(false)}
              style={{
                flex: 2,
                padding: '9px',
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              Apply{activeFilterCount > 0 ? ` (${filteredEx.length})` : ''}
            </button>
          </div>
        </div>
      )}
      {/* Exercise list */}
      <div
        style={{
          padding: '10px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {filteredEx.length === 0 && (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No exercises match that filter.
          </div>
        )}
        {visibleEx.map((ex) => {
          const tc = TAG_COLORS[ex.tag] || 'var(--accent)';
          return (
            <button
              key={ex.id}
              onClick={() => setShowHowTo(ex)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: tokens.radius.md,
                  background: tc + '1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: tc,
                    letterSpacing: '0.04em',
                  }}
                >
                  {ex.tag}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ex.anchor && <HammerIcon size={14} style={{ marginRight: 3 }} />}
                  {ex.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                  }}
                >
                  {ex.muscle} · {ex.equipment} · {ex.sets}×{ex.reps}
                </div>
              </div>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ›
              </span>
            </button>
          );
        })}
        {/* Lazy-load sentinel */}
        {visibleCount < filteredEx.length && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}
        {filteredEx.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', padding: '8px 0' }}>
            Showing {Math.min(visibleCount, filteredEx.length)} of {filteredEx.length}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExerciseBrowser;
