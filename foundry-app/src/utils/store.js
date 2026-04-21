// Import store locally for use in this file's functions, and re-export for consumers
import { store } from './storage';
export { store };

// Re-export training utilities so components can import from a single location
export {
  getWeekSets,
  generateWarmupSteps,
  getWarmupDetail,
  shuffle,
  loadBwLog,
  saveBwLog,
  addBwEntry,
  bwLoggedThisWeek,
  currentWeekSundayStr,
  markBwPromptShown,
  bwPromptShownThisWeek,
  saveSessionDuration,
  loadSessionDuration,
  loadSparklineData,
  loadCurrentWeek,
  saveCurrentWeek,
  loadCompleted,
  markComplete,
  loadProfile,
  saveProfile,
  isSkipped,
  setSkipped,
  getWorkoutDaysForWeek,
  ensureWorkoutDaysHistory,
  getScheduleOverrides,
  setScheduleOverride,
  clearScheduleOverride,
  buildSessionDateMap,
  ageFromDob,
  getTimeGreeting,
  resolveAccountTier,
  isEduEmail,
  computeMobilityStreak,
} from './training';

export * from './persistence';
export * from './analytics';
export * from './archive';
export { pullFromSupabase, pushToSupabase } from './sync';
