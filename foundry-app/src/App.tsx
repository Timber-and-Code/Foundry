import React, { useState, useEffect, useRef } from 'react';
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
import { ToastProvider } from './contexts/ToastContext';
import { PageSkeleton } from './components/ui/Skeleton';
const AuthPage = React.lazy(() => import('./components/auth/AuthPage'));
const WelcomeScreen = React.lazy(() => import('./components/onboarding/WelcomeScreen'));

// Data
import {
  getMeso,
  resetMesoCache,
} from './data/constants';

// Utils
import { migrateKeys } from './utils/storage';
import { on } from './utils/events';
import {
  store,
  loadProfile,
  saveProfile,
  loadCompleted,
  loadCurrentWeek,
  saveCurrentWeek,
} from './utils/store';

// Run key migration before any reads (ppl: → foundry:)
migrateKeys();

// Components
import FoundryBanner from './components/shared/FoundryBanner';
import { useSyncState } from './hooks/useSyncState';
import ErrorBoundary from './components/ErrorBoundary';
import MinimizedTimerBar from './components/MinimizedTimerBar';
import WeekCompleteModal from './components/WeekCompleteModal';
import type { Profile, TrainingDay } from './types';

// Hooks
import { useMesoState } from './hooks/useMesoState';

const OnboardingFlow = React.lazy(() => import('./components/onboarding/OnboardingFlow'));
const IntakeCard = React.lazy(() => import('./components/onboarding/IntakeCard'));
const HomeView = React.lazy(() => import('./components/home/HomeView'));
const NoMesoShell = React.lazy(() => import('./components/home/NoMesoShell'));
const DayView = React.lazy(() => import('./components/workout/DayView'));
const ExtraDayView = React.lazy(() => import('./components/workout/ExtraDayView'));
const CardioSessionView = React.lazy(() => import('./components/workout/CardioSessionView'));
const MobilitySessionView = React.lazy(() => import('./components/workout/MobilitySessionView'));
const TourOverlay = React.lazy(() => import('./components/tour/TourOverlay'));
const CoachMarkOrchestrator = React.lazy(
  () => import('./components/coach/CoachMarkOrchestrator'),
);
const ProfileDrawer = React.lazy(() => import('./components/settings/SettingsView'));
const SetupPage = React.lazy(() => import('./components/setup/SetupPage'));
const NotFoundPage = React.lazy(() => import('./components/NotFoundPage'));

// Onboarding v2 feature flag. Defaults ON for the TestFlight testing cut.
// Explicit opt-out via localStorage.setItem('foundry:onboarding_v2', '0') lets
// testers compare against the legacy flow without a rebuild. Existing users
// with foundry:onboarded=1 never hit this gate and are unaffected.
const isOnboardingV2Enabled = (): boolean => store.get('foundry:onboarding_v2') !== '0';

// ─── ROUTE WRAPPERS ───────────────────────────────────────────────────────────

interface DayViewRouteProps {
  onComplete: (dayIdx: number, weekIdx: number) => void;
  handleNextDay: (dayIdx: number, weekIdx: number) => void;
  completedDays: Set<string>;
  profile: Profile;
  activeDays: TrainingDay[];
  onProfileUpdate: (p: Partial<Profile>) => void;
}

function DayViewRoute({ onComplete, handleNextDay, completedDays, profile, activeDays, onProfileUpdate }: DayViewRouteProps) {
  const { dayIdx, weekIdx } = useParams();
  const navigate = useNavigate();
  return (
    <DayView
      dayIdx={parseInt(dayIdx!, 10)}
      weekIdx={parseInt(weekIdx!, 10)}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
      onComplete={() => onComplete(parseInt(dayIdx!, 10), parseInt(weekIdx!, 10))}
      onNextDay={() => handleNextDay(parseInt(dayIdx!, 10), parseInt(weekIdx!, 10))}
      onNavigateToDay={(d, w) => {
        window.scrollTo(0, 0);
        navigate(`/day/${d}/${w}`);
      }}
      completedDays={completedDays}
      profile={profile}
      activeDays={activeDays}
      onProfileUpdate={onProfileUpdate}
    />
  );
}

function ExtraViewRoute({ profile, activeDays, onProfileUpdate }: { profile: Profile; activeDays: TrainingDay[]; onProfileUpdate: (p: Partial<Profile>) => void }) {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  return (
    <ExtraDayView
      dateStr={dateStr!}
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

function CardioViewRoute({ profile }: { profile: Profile }) {
  const { dateStr, protocolId } = useParams();
  const navigate = useNavigate();
  return (
    <CardioSessionView
      dateStr={dateStr!}
      plannedProtocolId={protocolId === 'none' ? null : (protocolId ?? null)}
      profile={profile}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
    />
  );
}

function MobilityViewRoute({ profile }: { profile: Profile }) {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  return (
    <MobilitySessionView
      dateStr={dateStr!}
      profile={profile}
      onBack={() => {
        window.scrollTo(0, 0);
        navigate('/');
      }}
    />
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
const SaveProgressSheet = React.lazy(() => import('./components/auth/SaveProgressSheet'));
const MesoCompleteSheet = React.lazy(() => import('./components/setup/MesoCompleteSheet'));

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [onboarded, setOnboarded] = useState(() => !!store.get('foundry:onboarded'));
  const [openWeekly, setOpenWeekly] = useState(false);
  // showSetup defaults to true when the user is onboarded but has no profile
  // yet — that's the "first meso build in progress" state, and should
  // survive reloads. Otherwise a page reload mid-setup lands on NoMesoShell
  // which auto-saves a generic profile when a sample program is selected.
  const [showSetup, setShowSetup] = useState(
    () => !!store.get('foundry:onboarded') && !store.get('foundry:profile'),
  );
  const [showTour, setShowTour] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  const [saveProgressTrigger, setSaveProgressTrigger] = useState<
    'first_set' | 'first_week_done' | 'meso_complete' | 'settings'
  >('settings');
  // Phase 2 — when the current meso is fully complete and no new meso
  // has been started yet, MesoCompleteSheet takes over HomeView.
  const [showMesoComplete, setShowMesoComplete] = useState(
    () => store.get('foundry:meso_complete_shown') === '1',
  );
  const v2 = isOnboardingV2Enabled();
  const syncState = useSyncState();
  const homeTabRef = useRef<((tab: string) => void) | null>(null);

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
    startRestTimer: _startRestTimer,
    dismissRestTimer,
    timerDayRef,
  } = useRestTimer();

  // Listen for cardio open requests from DayView
  useEffect(() => {
    const unsub = on('foundry:openCardio', (detail) => {
      const { dateStr, protocolId } = detail;
      if (dateStr) {
        navigate(`/cardio/${dateStr}/${protocolId || 'none'}`);
      }
    });
    return unsub;
  }, [navigate]);

  // Listen for "delete current meso" requests from SettingsView. The drawer
  // has already wiped the meso-specific localStorage keys; we clear the
  // in-memory profile/meso cache and flip showSetup=true so the early-return
  // gate below routes the user straight to SetupPage with their onboarding
  // fallbacks (name, goal, experience) still intact.
  useEffect(() => {
    const unsub = on('foundry:resetToSetup', () => {
      resetMesoCache();
      setProfile(null);
      setCompletedDays(new Set());
      setCurrentWeek(0);
      setShowSetup(true);
      navigate('/');
    });
    return unsub;
  }, [navigate, setProfile, setCompletedDays, setCurrentWeek]);

  // Show legacy tour if flagged (only when v2 is OFF; v2 replaces TourOverlay
  // with CoachMarkOrchestrator)
  useEffect(() => {
    if (v2) return;
    if (store.get('foundry:show_tour') === '1' && !store.get('foundry:toured')) {
      store.remove('foundry:show_tour');
      setTimeout(() => setShowTour(true), 800);
    }
  }, [profile, v2]);

  // Onboarding v2: bridge first-set-logged, first-week-done, and
  // meso-complete events to the SaveProgressSheet triggers. Cap at 3 auto
  // prompts (one per milestone) via foundry:save_progress_prompts.
  useEffect(() => {
    if (!v2) return;
    const open = (trigger: 'first_set' | 'first_week_done' | 'meso_complete') => {
      if (user) return; // already authed
      if (store.get('foundry:save_progress_dismissed') === '1') return;
      const promptsRaw = store.get('foundry:save_progress_prompts');
      const prompts = promptsRaw ? parseInt(promptsRaw, 10) : 0;
      if (prompts >= 3) return;
      store.set('foundry:save_progress_prompts', String(prompts + 1));
      setSaveProgressTrigger(trigger);
      setTimeout(() => setShowSaveProgress(true), 2000);
    };
    // SaveProgressSheet trigger fires after the user has completed their
    // second exercise — a natural pause that doesn't collide with the RPE
    // coach mark on the first exercise's last set. The 'first_set' trigger
    // key is retained for copy/analytics continuity.
    const unsubExercise = on('foundry:second-exercise-complete', () => open('first_set'));
    const unsubWeek = on('foundry:first-week-done', () => open('first_week_done'));
    const unsubMeso = on('foundry:meso-complete', () => open('meso_complete'));
    // Manual requests from surfaces like AnonLocalBanner or Settings'
    // "Sync across devices" row. Not counted against the 3-prompt auto cap.
    const unsubRequest = on('foundry:save-sheet-request', ({ trigger }) => {
      if (user) return;
      setSaveProgressTrigger(trigger);
      setShowSaveProgress(true);
    });
    return () => {
      unsubExercise();
      unsubWeek();
      unsubMeso();
      unsubRequest();
    };
  }, [v2, user]);

  // Phase 2 — MesoCompleteSheet takeover. The `foundry:meso-complete`
  // event fires once from useMesoState when the final week's last day
  // is marked done. We latch on it and also hydrate from localStorage so
  // reloads mid-flow still land on the sheet.
  useEffect(() => {
    const unsub = on('foundry:meso-complete', () => {
      setShowMesoComplete(true);
      store.set('foundry:meso_complete_shown', '1');
    });
    return unsub;
  }, []);

  // Three takeover-sheet actions route here:
  //   repeat-meso     → MesoCompleteSheet archived + kept meso_transition; land on Setup
  //   new-meso        → MesoCompleteSheet archived + cleared transition; fresh Setup
  //   browse-samples  → archived + cleared; jump user to Explore tab samples
  useEffect(() => {
    const unsubRepeat = on('foundry:repeat-meso', () => {
      setShowMesoComplete(false);
      resetMesoCache();
      setProfile(null);
      setCompletedDays(new Set());
      setCurrentWeek(0);
      setShowSetup(true);
      navigate('/');
    });
    const unsubNew = on('foundry:new-meso', () => {
      setShowMesoComplete(false);
      resetMesoCache();
      setProfile(null);
      setCompletedDays(new Set());
      setCurrentWeek(0);
      setShowSetup(true);
      navigate('/');
    });
    const unsubSamples = on('foundry:browse-samples', () => {
      setShowMesoComplete(false);
      resetMesoCache();
      setProfile(null);
      setCompletedDays(new Set());
      setCurrentWeek(0);
      // Flag read by the Explore tab on next mount so it opens samples
      // directly instead of the default view.
      store.set('foundry:pending_samples', '1');
      setShowSetup(false);
      navigate('/');
      // Defer the tab switch a frame so HomeView mounts first.
      requestAnimationFrame(() => homeTabRef.current?.('explore'));
    });
    return () => {
      unsubRepeat();
      unsubNew();
      unsubSamples();
    };
  }, [navigate, setProfile, setCompletedDays, setCurrentWeek]);

  // ── Onboarding gate ──
  // Early returns use React.lazy components — must wrap in Suspense
  const suspenseFallback = (
    <div style={{ minHeight: '100vh', background: '#141414' }}>
      <PageSkeleton />
    </div>
  );

  if (!profile && !onboarded) {
    if (v2) {
      return (
        <React.Suspense fallback={suspenseFallback}>
          <IntakeCard
            onDone={() => {
              setOnboarded(true);
              setShowSetup(true);
            }}
          />
        </React.Suspense>
      );
    }
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
            saveProfile(newProfile as unknown as Profile);
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
          onComplete={(p: Profile) => {
            saveProfile(p);
            store.remove('foundry:storedProgram');
            // Clear any latched meso-complete state from a prior meso so the
            // overlay doesn't re-show on top of the fresh program.
            store.remove('foundry:meso_complete_shown');
            store.remove('foundry:meso_complete_emitted');
            setShowMesoComplete(false);
            // v2 replaces TourOverlay with CoachMarkOrchestrator (no show_tour flag)
            if (!v2 && !store.get('foundry:toured')) {
              store.set('foundry:show_tour', '1');
            }
            resetMesoCache();
            setProfile(loadProfile());
            setCompletedDays(loadCompleted(getMeso()));
            setCurrentWeek(loadCurrentWeek());
            setShowSetup(false);
            // Land on Home, not whatever route the URL was before onboarding
            // (e.g. /day/0/0 persisted from a prior session + localStorage clear).
            navigate('/');
            // Legacy behavior: prompt on meso-save. v2 drops this trigger and
            // waits for first-set-logged / first-week-done instead.
            if (!v2 && !user && !store.get('foundry:save_progress_dismissed')) {
              setSaveProgressTrigger('settings');
              setTimeout(() => setShowSaveProgress(true), 800);
            }
          }}
        />
      </React.Suspense>
    );
  }

  const handleNextDay = (dayIdx: number, weekIdx: number) => {
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

  const handleProfileUpdate = (updates: Partial<Profile>) => {
    if ('split' in updates || 'days' in updates) {
      store.remove('foundry:storedProgram');
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
      <a href="#main-content" className="skip-link">Skip to content</a>
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
            subtitle={(() => {
              const tags = [...new Set(activeDays.map((d: TrainingDay) => d.tag).filter(Boolean))];
              const splitLabel = tags.length > 0 ? tags.join(' / ') : (({ ppl: 'PPL', upper_lower: 'UPPER / LOWER', full_body: 'FULL BODY', push_pull: 'PUSH / PULL' } as Record<string, string>)[getMeso().splitType] || getMeso().splitType?.toUpperCase().replace(/_/g, ' ') || 'PPL');
              return `${splitLabel} · WEEK ${activeWeek + 1}`;
            })()}
            onProfileTap={isHome ? () => setShowProfileDrawer(true) : undefined}
            syncState={syncState}
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
                  setProfile(updated as Profile);
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
        <main id="main-content">
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
                onOpenCardio={(dateStr, protocolId) => {
                  void navigate(`/cardio/${dateStr}/${protocolId || 'none'}`);
                }}
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </main>

        {showTour && !v2 && (
          <TourOverlay
            onDone={() => setShowTour(false)}
            onNavigate={() => navigate('/')}
            onTabChange={(tab) => homeTabRef.current && homeTabRef.current(tab)}
          />
        )}

        {v2 && onboarded && (
          <React.Suspense fallback={null}>
            <CoachMarkOrchestrator />
          </React.Suspense>
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
                setCurrentWeek(ref.weekIdx ?? currentWeek);
                navigate(`/day/${ref.dayIdx}/${ref.weekIdx}`);
              }
              setRestTimerMinimized(false);
            }}
          />
        )}

        {/* Save your progress — deferred auth for anonymous users */}
        {showSaveProgress && (
          <React.Suspense fallback={null}>
            <SaveProgressSheet
              trigger={saveProgressTrigger}
              onDismiss={() => setShowSaveProgress(false)}
            />
          </React.Suspense>
        )}

        {/* Phase 2 end-of-meso takeover. Rendered as a fixed overlay so
            it sits on top of whatever view is behind. Not dismissable — the
            sheet itself wires archive + transition handling for its 3
            action cards. */}
        {showMesoComplete && (
          <React.Suspense fallback={null}>
            <MesoCompleteSheet profile={profile} />
          </React.Suspense>
        )}
      </div>
    </React.Suspense>
  );
}

function AuthGate() {
  const { user, loading, authUnavailable } = useAuth();
  // Track welcome + explicit auth-request state. Persisted to localStorage
  // so it survives reloads; driven by custom events so AuthGate can react
  // without a page reload when WelcomeScreen or OnboardingFlow updates it.
  const [welcomed, setWelcomed] = useState(() => store.get('foundry:welcomed') === '1');
  const [wantsAuth, setWantsAuth] = useState(() => store.get('foundry:wants_auth') === '1');

  useEffect(() => {
    const unsubWelcomed = on('foundry:welcomed', () => setWelcomed(true));
    const unsubWantsAuth = on('foundry:wants_auth', () => setWantsAuth(true));
    return () => {
      unsubWelcomed();
      unsubWantsAuth();
    };
  }, []);

  // Once signed in, clear the explicit auth-request flag so a future
  // sign-out drops back to anonymous mode instead of re-gating on AuthPage.
  useEffect(() => {
    if (user && wantsAuth) {
      store.remove('foundry:wants_auth');
      setWantsAuth(false);
    }
  }, [user, wantsAuth]);

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

  // No session: welcome → anonymous app → auth (only on explicit request)
  if (!user) {
    if (!welcomed) {
      return (
        <React.Suspense fallback={null}>
          <WelcomeScreen />
        </React.Suspense>
      );
    }
    if (wantsAuth) {
      return (
        <React.Suspense fallback={null}>
          <AuthPage />
        </React.Suspense>
      );
    }
    // Anonymous mode: full app in localStorage-only. Sync layer no-ops
    // until the user explicitly signs in via the onboarding path-choice
    // screen or the user menu.
    return <App />;
  }

  return <App />;
}

export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <RestTimerProvider>
              <AuthGate />
            </RestTimerProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
