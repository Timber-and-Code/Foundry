import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
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

// ─── ROUTE WRAPPERS ───────────────────────────────────────────────────────────

interface DayViewRouteProps {
  onComplete: (v: any) => void;
  handleNextDay: (v: any) => void;
  completedDays: any[];
  profile: any;
  activeDays: any[];
  onProfileUpdate: (p: any) => void;
}

function DayViewRoute({ onComplete, handleNextDay, completedDays, profile, activeDays, onProfileUpdate }: DayViewRouteProps) {
  const { dayIdx, weekIdx } = useParams();
  const navigate = useNavigate();
  return (
    <DayView
      dayIdx={parseInt(dayIdx, 10)}
      weekIdx={parseInt(weekIdx, 10)}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
      onComplete={onComplete}
      onNextDay={handleNextDay}
      completedDays={completedDays}
      profile={profile}
      activeDays={activeDays}
      onProfileUpdate={onProfileUpdate}
    />
  );
}

function ExtraViewRoute({ profile, activeDays, onProfileUpdate }: { profile: any; activeDays: any[]; onProfileUpdate: (p: any) => void }) {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  return (
    <ExtraDayView
      dateStr={dateStr}
      profile={profile}
      activeDays={activeDays}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
      onProfileUpdate={onProfileUpdate}
    />
  );
}

function CardioViewRoute({ profile }: { profile: any }) {
  const { dateStr, protocolId } = useParams();
  const navigate = useNavigate();
  return (
    <CardioSessionView
      dateStr={dateStr}
      plannedProtocolId={protocolId === 'none' ? null : protocolId}
      profile={profile}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
    />
  );
}

function MobilityViewRoute({ profile }: { profile: any }) {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  return (
    <MobilitySessionView
      dateStr={dateStr}
      profile={profile}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
    />
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [onboarded, setOnboarded] = useState(() => !!store.get('foundry:onboarded'));
  const [openWeekly, setOpenWeekly] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
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
  } = useMesoState({ setView: () => navigate('/'), setOnboarded });

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
        navigate(`/cardio/${dateStr}/${protocolId || 'none'}`);
      }
    };
    window.addEventListener('foundry:openCardio', handler);
    return () => window.removeEventListener('foundry:openCardio', handler);
  }, [navigate]);

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
      navigate(`/day/${nextDayIdx}/${weekIdx}`);
    } else {
      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().weeks - 1) {
        setCurrentWeek(nextWeek);
        saveCurrentWeek(nextWeek);
        navigate(`/day/0/${nextWeek}`);
      } else {
        navigate('/');
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

  const isHome = location.pathname === '/';

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
            onProfileTap={isHome ? () => setShowProfileDrawer(true) : undefined}
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
              navigate('/');
            }}
            onReset={() => {
              setWeekCompleteModal(null);
              handleReset();
            }}
          />
        )}

        {/* Views */}
        <Routes>
          <Route
            path="/"
            element={
              <HomeView
                tabRef={homeTabRef}
                currentWeek={currentWeek}
                setCurrentWeek={setCurrentWeek}
                onSelectDay={(i) => navigate(`/day/${i}/${currentWeek}`)}
                onSelectDayWeek={(dayIdx, weekIdx) => {
                  setCurrentWeek(weekIdx);
                  navigate(`/day/${dayIdx}/${weekIdx}`);
                }}
                onOpenExtra={(dateStr) => navigate(`/extra/${dateStr}`)}
                onOpenCardio={(dateStr, protocolId) =>
                  navigate(`/cardio/${dateStr}/${protocolId || 'none'}`)
                }
                onOpenMobility={(dateStr) => navigate(`/mobility/${dateStr}`)}
                completedDays={completedDays}
                profile={profile}
                activeDays={activeDays}
                onReset={handleReset}
                openWeekly={openWeekly}
                onOpenWeeklyHandled={() => setOpenWeekly(false)}
                onProfileUpdate={handleProfileUpdate}
              />
            }
          />
          <Route
            path="/day/:dayIdx/:weekIdx"
            element={
              <DayViewRoute
                onComplete={handleComplete}
                handleNextDay={handleNextDay}
                completedDays={completedDays}
                profile={profile}
                activeDays={activeDays}
                onProfileUpdate={handleProfileUpdate}
              />
            }
          />
          <Route
            path="/extra/:dateStr"
            element={
              <ExtraViewRoute
                profile={profile}
                activeDays={activeDays}
                onProfileUpdate={handleProfileUpdate}
              />
            }
          />
          <Route
            path="/cardio/:dateStr/:protocolId"
            element={<CardioViewRoute profile={profile} />}
          />
          <Route
            path="/mobility/:dateStr"
            element={<MobilityViewRoute profile={profile} />}
          />
        </Routes>

        {showTour && (
          <TourOverlay
            onDone={() => setShowTour(false)}
            onNavigate={() => navigate('/')}
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
                navigate(`/day/${ref.dayIdx}/${ref.weekIdx}`);
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
      <BrowserRouter>
        <AuthProvider>
          <RestTimerProvider>
            <AuthGate />
          </RestTimerProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
