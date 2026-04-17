/**
 * Design system tokens — single source of truth for all hardcoded style values.
 * Mirrors the CSS custom properties defined in theme.css.
 *
 * Usage:
 *   import { tokens } from '../styles/tokens';
 *   style={{ backgroundColor: tokens.colors.bgCard, borderRadius: tokens.radius.md }}
 */
export const tokens = {
  colors: {
    // Backgrounds
    bgRoot:    '#0A0A0C',
    bgDeep:    '#060608',
    bgSurface: '#141416',
    bgCard:    '#1A1814',
    bgInset:   '#0A0A0C',
    bgInput:   '#161618',

    // Overlay
    overlay:      'rgba(0,0,0,0.82)',
    overlayLight: 'rgba(0,0,0,0.6)',
    overlayHeavy: 'rgba(0,0,0,0.88)',
    overlayMed:   'rgba(0,0,0,0.75)',

    // Brand / accent
    accent:         '#E8651A',
    accentMuted:    'rgba(232,101,26,0.15)',
    accentSubtle:   'rgba(232,101,26,0.1)',
    accentBorder:   'rgba(232,101,26,0.3)',
    accentDim:      'rgba(232,101,26,0.7)',
    accentRgb:      '232,101,26',

    // Text
    textPrimary:   '#E8E4DC',
    textSecondary: '#A8A4A0',
    textMuted:     '#9A8A78',
    textDim:       '#8A8580',

    // Phase colours
    phaseAccum:   '#E8E4DC',
    phaseIntens:  '#E8651A',
    phasePeak:    '#D4983C',
    phaseDeload:  '#5B8FA8',

    // Buttons
    btnPrimaryBg:     '#C0392B',
    btnPrimaryBorder: '#E8651A',
    btnPrimaryText:   '#E8E4DC',

    // Warm gold / mobility / cardio-rest
    gold:         '#D4983C',
    goldDim:      '#D4983C20',
    goldBorder:   '#D4983C55',
    goldSubtle:   '#D4983C10',
    goldMedium:   '#D4983C44',
    goldAccent:   '#D4983C30',

    // Amber / hover accent
    amber:        '#F29A52',

    // Cardio intensity
    cardioHard:   '#E75831',

    // Amber highlight (ExerciseCard PR glow)
    amberHighlight: 'rgba(255, 193, 7, 0.1)',

    // Status
    dangerBg:     'rgba(220,38,38,0.1)',
    dangerBorder: 'rgba(220,38,38,0.3)',
    dangerText:   '#f87171',
    danger:       '#f44336',
    success:      '#4caf50',
    warning:      '#ff9800',
  },

  spacing: {
    xxs: 2,
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  24,
    xxl: 32,
    xxxl: 40,
  },

  radius: {
    xs:   2,
    sm:   4,
    md:   6,
    lg:   8,
    xl:   12,
    xxl:  14,
    round: 20,
    pill: 999,
    full: '50%',
  },

  fontSize: {
    xxs:  10,
    xs:   11,
    sm:   12,
    md:   13,
    base: 14,
    lg:   17,
    xl:   22,
    xxl:  28,
    hero: 36,
  },

  // Role-based type scale — prefer these over raw fontSize values.
  // Floor is 13 (pill); all prose is 14+.
  font: {
    title:   24, // Page / tab titles
    section: 18, // Major section headers
    card:    16, // Card headings, phase / exercise names
    caps:    14, // ALL-CAPS small-caps labels (pair with letterSpacing 0.1em, weight 700)
    body:    14, // Default body, descriptions, guidance, metadata
    pill:    13, // Tiny badges / status chips
    stat:    20, // Inline numeric emphasis
    statLg:  28, // Hero numerics
  },

  fontWeight: {
    normal:   '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    black:    '800',
  },

  zIndex: {
    sheet:   300,
    modal:   300,
    toast:   400,
    overlay: 500,
  },
} as const;

export type Tokens = typeof tokens;
