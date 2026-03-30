# HomeView Component Extraction

## Overview
The `HomeView` component is the main dashboard/hub of the Foundry fitness app. It's a comprehensive, feature-rich component that manages workout tracking, progress visualization, exercise library browsing, and detailed training analytics.

## Source
- **File**: `/sessions/affectionate-eloquent-lamport/mnt/Foundry/Foundry_1_35_0.html`
- **Lines**: 15204-17194
- **Destination**: `./HomeView.jsx`

## File Statistics
- **Total Lines**: 2080
- **File Size**: 121 KB
- **Component Type**: React Functional Component
- **Export Type**: ES6 Default Export

## Component Props

| Prop | Type | Purpose |
|------|------|---------|
| `tabRef` | React.MutableRefObject | Navigation ref for parent control |
| `currentWeek` | number | Currently selected week |
| `setCurrentWeek` | function | Week update callback |
| `onSelectDay` | function | Day selection handler |
| `onSelectDayWeek` | function | Day+week combo selection |
| `onOpenExtra` | function | Extra session modal trigger |
| `onOpenCardio` | function | Cardio logging trigger |
| `onOpenMobility` | function | Mobility session trigger |
| `completedDays` | Set\<string\> | Set of completed session keys (`${dayIdx}:${weekIdx}`) |
| `onReset` | function | Meso reset handler |
| `activeDays` | array | Days in the current split |
| `profile` | object | User profile (split, goals, dates, etc.) |
| `openWeekly` | boolean | Signal to open weekly tab |
| `onOpenWeeklyHandled` | function | Callback when weekly tab opened |
| `onProfileUpdate` | function | Profile changes callback |

## State Management

### Primary State Variables (23 useState hooks)
- **Tab Navigation**: `tab` (landing/progress/schedule/explore)
- **UI Modals**: `showReset`, `showPricing`, `showEditSchedule`
- **Add Workout Flow**: `addWorkoutModal`, `addWorkoutStep`, `addWorkoutType`, `addWorkoutDayType`
- **Rest/Recovery**: `showRestDay`, `selectedExtraDate`
- **Views**: `expandedWeek`, `calendarOffset`, `skipVersion`, `showSkipConfirm`, `showNextSession`
- **Mobility/Recovery**: `showMorningMobility`, `showRecoveryMorning`, `showRecoveryTag`, `recoveryTip`
- **Notes**: `noteViewer`
- **Readiness**: `readiness`, `readinessOpen`

### Key Refs
- `isTodayRef`: Tracks if today card is currently visible
- `showDayRef`: Reference to currently displayed day
- `showDayAccentRef`: Current accent color string

## Core Features

### 1. **Tab Navigation System**
- **Landing**: Week overview, current day cards, progress summary
- **Progress**: Training analytics, PR detection, stalling lift alerts
- **Schedule**: Calendar view with week/month navigation
- **Explore**: Exercise library browser with detail sheets

### 2. **Progress Tracking**
- Week completion percentage (week_done/week_total)
- Meso cycle progress (done_sessions/total_sessions)
- Muscle group volume distribution (PUSH/PULL/LEGS)
- Phase-specific RIR targets

### 3. **Workout Management**
- Add workout modal with multi-step flow (type → day type)
- Rest day management (past vs. future)
- Skip/unskip sessions with confirmation
- Session duration logging
- Bodyweight tracking and prompts

### 4. **Analytics & Tracking**
- PR detection per exercise with historical trends
- Stalling lift identification
- Sparkline data for exercise progression
- Session notes (session-level + exercise-level)
- Cardio and mobility session logging

### 5. **Recovery Features**
- Daily readiness check-in (sleep, soreness, energy)
- Recovery tips rotation
- Morning/tag mobility sessions
- Rest day recommendations

### 6. **Exercise Management**
- Exercise library browser
- Exercise detail sheets with images
- Exercise history and PR tracking
- Custom exercise overrides

## Computed Values (useMemo Dependencies)

### Week-Level Computations
- `activeWeek`: First incomplete week in meso cycle
- `calendarWeek`: Week based on current date vs. program start
- `displayWeek`: min(activeWeek, calendarWeek) — what to display
- `phase`, `pc`, `rir`: Week metadata from constants
- `weekDone`, `weekTotal`, `weekPct`: Week completion status
- `weekMuscles`: Volume count by muscle group

### Meso-Level Computations
- `totalSessions`: MESO.weeks × MESO.days
- `doneSessions`: Size of completedDays set
- `mesoPct`: Cycle progress percentage

### Session-Level Detection
- `hasActiveWorkout`: Boolean flag for in-progress sessions (checks last 14 days)

## Sub-Components

### Internally Defined
- `SubHeader`: Navigation header with back button and label
- `ProgressBar`: Animated progress bar with custom color

### Referenced (to be imported/created)
- `ResetDialog`: Meso reset confirmation modal
- `EditScheduleSheet`: Schedule customization interface
- Exercise detail modals (images, history, notes)
- Chart/analytics components
- Training session UIs (cardio, mobility)

## Import Dependencies

### React Hooks
```javascript
import { useState, useEffect, useMemo } from 'react';
```

### Data Layer
```javascript
import { TAG_ACCENT, PHASE_COLOR, WEEK_PHASE, WEEK_RIR, MESO, ... } from '../../data/constants';
import { EXERCISE_DB } from '../../data/exercises';
import { FOUNDRY_GOAL_IMG, ICON_HAMMER, ... } from '../../data/images';
```

### Utility Functions
```javascript
import { store, loadDayWeek, loadProfile, markComplete, ... } from '../../utils/store';
import { HammerIcon } from '../shared/HammerIcon';
```

## Styling Approach
- Inline CSS with CSS variables: `var(--accent)`, `var(--bg-card)`, etc.
- Flexbox layouts throughout
- Responsive sheet modals with drag handles
- Smooth animations (slideUp 0.22s, width transitions 0.6s)
- Z-index management for modals (200-300 range)

## Key Algorithms

### Active Week Detection
Loops through completed days to find the first non-100%-complete week.

### Calendar Week Calculation
Projects forward from program start date, counting workout days only, to determine current calendar position.

### PR Detection
Scans session data for new max lifts, tracks trends (improving/declining/flat), and calculates volume landmarks.

### Readiness Scoring
Aggregates sleep quality, soreness level, and energy into a single readiness score; stores in localStorage with date key.

## Notes & Caveats

1. **Large Component**: This is the app's largest single component at ~2000 lines. Consider breaking into smaller sub-components as the codebase grows.

2. **Local Storage**: Heavily relies on `store` (localStorage wrapper) for session state. Ensure sync/conflict handling if adding cloud sync.

3. **Hard-coded Constants**: Many layout values (padding, gaps, font sizes) are inline. Consider extracting to a spacing/theme module.

4. **State Complexity**: 23 useState hooks manage multiple concerns. Could benefit from useReducer for add workout flow or context for tab state.

5. **Missing Sub-Components**: Several modals/sheets are referenced but not defined here. Create these as separate files and import them.

6. **Performance**: Heavy use of useMemo for computed values is good, but watch for unnecessary re-renders with child components.

7. **Accessibility**: Ensure all buttons have proper ARIA labels and keyboard navigation support.
