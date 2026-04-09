import React, { useState, useEffect, useRef, Suspense } from 'react';
import { RestTimerProvider, useRestTimer } from './contexts/RestTimerContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
const AuthPage = React.lazy(() => import('./components/auth/AuthPage'));
const UserMenu = React.lazy(() => import('./components/auth/UserMenu'));

// Data
import {
  PHASE_COLOR,
  getMeso,
  getWeekPhase,
  buildMesoConfig,
  resetMesoCache,
} from './data/constants';
import { EXERCISE_DB } from './data/exercises';

// Utils
import { migrateKeys } from './utils/storage';
import {
  store,
  loadProfile,
  saveProfile,
  loadCompleted,
  markComplete,
  loadCurrentWeek,
  saveCurrentWeek,
  snapshotData,
  resetMeso,
  archiveCurrentMeso,
} from './utils/store';

// Run key migration before any reads (ppl: → foundry:)
migrateKeys();
import { generateProgram } from './utils/program';

// Components
import FoundryBanner from './components/shared/FoundryBanner';
import ErrorBoundary from './components/ErrorBoundary';
import MinimizedTimerBar from './components/MinimizedTimerBar';
import WeekCompleteModal from './components/WeekCompleteModal';

// Hooks
import { useMesoState } from './hooks/useMesoState';

const OnboardingFlow = React.lazy(() => import('./components/onboarding/OnboardingFlow'));
const HomeView = React.lazy(() => import('./components/home/HomeView'));
const NoMesoShell = React.lazy(() => import('./components/home/NoMesoShell'));
const DayView = React.lazy(() => import('./components/workout/DayView'));
const ExtraDayView = React.lazy(() => import('./components/workout/ExtraDayView'));
const CardioSessionView = React.lazy(() => import('./components/workout/CardioSessionView'));
const MobilitySessionView = React.lazy(() => import('./components/workout/MobilitySessionView'));
const TourOverlay = React.lazy(() => import('./components/tour/TourOverlay'));
const ProfileDrawer = React.lazy(() => import('./components/settings/SettingsView'));
const SetupPage = React.lazy(() => import('./components/setup/SetupPage'));

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function App() {
  const [view, setView] = useState('home');
  const [selectedDay, setSelectedDay] = useState(null);
  const [onboarded, setOnboarded] = useState(() => !!store.get('foundry:onboarded'));
  const [openWeekly, setOpenWeekly] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedExtraDate, setSelectedExtraDate] = useState(null);
  const [selectedCardioDate, setSelectedCardioDate] = useState(null);
  const [selectedCardioProtocol, setSelectedCardioProtocol] = useState(null);
  const [selectedMobilityDate, setSelectedMobilityDate] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const homeTabRef = useRef(null);

  const {
    profile,
    setProfile,
    completedDays,
    setCompletedDays,
    currentWeek,
    setCurrentWeek,
    weekCompleteModal,
    setWeekCompleteModal,
    activeDays,
    activeWeek,
    handleComplete,
    handleReset,
  } = useMesoState({ setView, setOnboarded });

  // ── Global rest timer ──
  const {
    restTimer,
    restTimerMinimized,
    setRestTimerMinimized,
    startRestTimer,
    dismissRestTimer,
    timerDayRef,
  } = useRestTimer();

  // Listen for cardio open requests from DayView
  useEffect(() => {
    const handler = (e) => {
      const { dateStr, protocolId } = e.detail || {};
      if (dateStr) {
        setSelectedCardioDate(dateStr);
        setSelectedCardioProtocol(protocolId || null);
        setView('cardio');
      }
    };
    window.addEventListener('foundry:openCardio', handler);
    return () => window.removeEventListener('foundry:openCardio', handler);
  }, []);

  // Show tour once after first program generated
  useEffect(() => {
    if (store.get('foundry:show_tour') === '1' && !store.get('foundry:toured')) {
      store.remove
        ? store.remove('foundry:show_tour')
        : localStorage.removeItem('foundry:show_tour');
      setTimeout(() => setShowTour(true), 800);
    }
  }, []);

  // ── Onboarding gate ──
  // Early returns use React.lazy components — must wrap in Suspense
  const suspenseFallback = (
    <div
      style={{
        minHeight: '100vh',
        background: '#141414',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#e5e5e5', fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!profile && !onboarded) {
    return (
      <React.Suspense fallback={suspenseFallback}>
        <OnboardingFlow
          onDone={() => {
            setOnboarded(true);
            setShowSetup(true);
          }}
        />
      </React.Suspense>
    );
  }

  if (!profile && !showSetup) {
    return (
      <React.Suspense fallback={suspenseFallback}>
        <NoMesoShell
          onSetup={() => setShowSetup(true)}
          onStartProgram={(newProfile) => {
            saveProfile(newProfile);
            resetMesoCache();
            setProfile(loadProfile());
            setCompletedDays(loadCompleted(getMeso()));
            setCurrentWeek(loadCurrentWeek());
          }}
        />
      </React.Suspense>
    );
  }

  if (!profile) {
    return (
      <React.Suspense fallback={suspenseFallback}>
        <SetupPage
          onComplete={(p) => {
            saveProfile(p);
            localStorage.removeItem('foundry:storedProgram');
            if (!store.get('foundry:toured')) store.set('foundry:show_tour', '1');
            resetMesoCache();
            setProfile(loadProfile());
            setCompletedDays(loadCompleted(getMeso()));
            setCurrentWeek(loadCurrentWeek());
            setShowSetup(false);
          }}
        />
      </React.Suspense>
    );
  }

  const handleNextDay = (dayIdx, weekIdx) => {
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx <= getMeso().days - 1) {
      setSelectedDay(nextDayIdx);
    } else {
      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().weeks - 1) {
        setCurrentWeek(nextWeek);
        saveCurrentWeek(nextWeek);
        setSelectedDay(0);
      } else {
        setView('home');
      }
    }
  };

  const handleProfileUpdate = (updates) => {
    if ('split' in updates || 'days' in updates) {
      localStorage.removeItem('foundry:storedProgram');
    }
    const updated = { ...profile, ...updates };
    setProfile(updated);
    saveProfile(updated);
  };

  return (
    <React.Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#141414',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: '#e5e5e5', fontSize: 14 }}>Loading...</div>
        </div>
      }
    >
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          color: 'var(--text-primary)',
          fontFamily: "'Inter',system-ui,sans-serif",
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <FoundryBanner
            subtitle={`${profile.name ? profile.name.toUpperCase() + ' · ' : ''}${getMeso().weeks}WK ${(getMeso().splitType || 'ppl').toUpperCase().replace(/_/g, ' ')} · WEEK ${activeWeek + 1}`}
            onProfileTap={view === 'home' ? () => setShowProfileDrawer(true) : undefined}
            userMenu={<Suspense fallback={null}><UserMenu /></Suspense>}
          />
        </div>

        {/* Profile Drawer */}
        {showProfileDrawer &&
          (() => {
            const raw = store.get('foundry:profile');
            const saved = raw ? JSON.parse(raw) : {};
            return (
              <ProfileDrawer
                saved={saved}
                onClose={() => setShowProfileDrawer(false)}
                onSave={(updated) => {
                  store.set('foundry:profile', JSON.stringify(updated));
                  setProfile(updated);
                }}
              />
            );
          })()}

        {/* Week Complete Modal */}
        {weekCompleteModal && (
          <WeekCompleteModal
            modal={weekCompleteModal}
            profile={profile}
            onDismiss={() => setWeekCompleteModal(null)}
            onViewSummary={() => {
              setWeekCompleteModal(null);
              setOpenWeekly(true);
              setView('home');
            }}
            onReset={() => {
              setWeekCompleteModal(null);
              handleReset();
            }}
          />
        )}

        {/* Views */}
        {view === 'home' && (
          <HomeView
            tabRef={homeTabRef}
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            onSelectDay={(i) => {
              setSelectedDay(i);
              setView('day');
            }}
            onSelectDayWeek={(dayIdx, weekIdx) => {
              setCurrentWeek(weekIdx);
              setSelectedDay(dayIdx);
              setView('day');
            }}
            onOpenExtra={(dateStr) => {
              setSelectedExtraDate(dateStr);
              setView('extra');
            }}
            onOpenCardio={(dateStr, protocolId) => {
              setSelectedCardioDate(dateStr);
              setSelectedCardioProtocol(protocolId || null);
              setView('cardio');
            }}
            onOpenMobility={(dateStr) => {
              setSelectedMobilityDate(dateStr);
              setView('mobility');
            }}
            completedDays={completedDays}
            profile={profile}
            activeDays={activeDays}
            onReset={handleReset}
            openWeekly={openWeekly}
            onOpenWeeklyHandled={() => setOpenWeekly(false)}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {view === 'day' && selectedDay !== null && (
          <DayView
            dayIdx={selectedDay}
            weekIdx={currentWeek}
            onBack={() => {
              window.scrollTo(0, 0);
              setView('home');
            }}
            onComplete={handleComplete}
            onNextDay={handleNextDay}
            completedDays={completedDays}
            profile={profile}
            activeDays={activeDays}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {view === 'extra' && selectedExtraDate && (
          <ExtraDayView
            dateStr={selectedExtraDate}
            profile={profile}
            activeDays={activeDays}
            onBack={() => {
              window.scrollTo(0, 0);
              setView('home');
              setSelectedExtraDate(null);
            }}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {view === 'cardio' && selectedCardioDate && (
          <CardioSessionView
            dateStr={selectedCardioDate}
            plannedProtocolId={selectedCardioProtocol}
            profile={profile}
            onBack={() => {
              window.scrollTo(0, 0);
              setView('home');
              setSelectedCardioDate(null);
              setSelectedCardioProtocol(null);
            }}
          />
        )}

        {view === 'mobility' && selectedMobilityDate && (
          <MobilitySessionView
            dateStr={selectedMobilityDate}
            profile={profile}
            onBack={() => {
              window.scrollTo(0, 0);
              setView('home');
              setSelectedMobilityDate(null);
            }}
          />
        )}

        {showTour && (
          <TourOverlay
            onDone={() => setShowTour(false)}
            onNavigate={setView}
            onTabChange={(tab) => homeTabRef.current && homeTabRef.current(tab)}
          />
        )}

        {/* Global minimized timer bar */}
        {restTimer && restTimerMinimized && (
          <MinimizedTimerBar
            restTimer={restTimer}
            onTap={(done) => {
              if (done) {
                dismissRestTimer();
                return;
              }
              const ref = timerDayRef.current;
              if (ref) {
                setCurrentWeek(ref.weekIdx);
                setSelectedDay(ref.dayIdx);
                setView('day');
              }
              setRestTimerMinimized(false);
            }}
          />
        )}
      </div>
    </React.Suspense>
  );
}

function AuthGate() {
  const { user, loading, authUnavailable } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#e5e5e5', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // Supabase unreachable — bypass auth, use localStorage-only flow
  if (authUnavailable) {
    return <App />;
  }

  if (!user) {
    return (
      <React.Suspense fallback={null}>
        <AuthPage />
      </React.Suspense>
    );
  }

  return <App />;
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RestTimerProvider>
          <AuthGate />
        </RestTimerProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
