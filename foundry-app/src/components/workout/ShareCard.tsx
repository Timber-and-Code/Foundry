import React from 'react';

/**
 * ShareCard — 1080-wide capture surface for the "Share this workout" feature.
 * Rendered OFF-SCREEN inside WorkoutCompleteModal and fed to html-to-image to
 * produce a branded PNG. Height is flow-sized (not locked to 1350) so the
 * entire workout summary — stats, per-exercise sets, anchor comparison, PRs,
 * quote — lands in the image. The post-training cool-down prompt is the one
 * thing from the modal that does NOT ship in the share.
 *
 * Hard constraints:
 *   - Fixed 1080px width (IG / stories). Capture happens at export size
 *     regardless of viewport, so every value here is in absolute px, not
 *     rem / vw / responsive tokens.
 *   - All typography is declared inline with explicit font-family strings
 *     (matching the self-hosted /fonts/ files) so html-to-image embeds the
 *     right face on first paint.
 *   - Images must be same-origin (public/* is fine). No CORS-tainted canvas.
 *     We use `/icon-512.png` (alpha-baked F, same art as the iOS app icon)
 *     so no mask-image is required — html-to-image silently drops CSS masks
 *     on WebKit, which was why the F was missing from shares.
 *   - NO interactive elements. NO buttons. NO cool-down prompt.
 */

export interface ShareCardPR {
  name: string;
  weight: number;
  reps: number;
}

export interface ShareCardStats {
  sets: number;
  reps: number;
  volume: number; // lbs
  duration: number | null; // seconds
}

export interface ShareCardBreakdownSet {
  reps: number;
  weight: number;
  warmup?: boolean;
}

export interface ShareCardBreakdownExercise {
  name: string;
  anchor?: boolean;
  sets: ShareCardBreakdownSet[];
}

export interface ShareCardAnchorDelta {
  name: string;
  today: number;
  prev: number;
  delta: number;
}

export interface ShareCardQuote {
  text: string;
  author: string;
}

export interface ShareCardProps {
  dayLabel: string;
  weekIdx: number; // 0-indexed
  phase: string;
  phaseColor: string;
  stats: ShareCardStats;
  prs: ShareCardPR[];
  congratsHeadline: string;
  congratsSub: string;
  /** Per-exercise set-by-set log — working sets only are rendered. */
  breakdown?: ShareCardBreakdownExercise[];
  /** Anchor comparison vs prior week, rendered when weekIdx > 0. */
  anchorComparison?: ShareCardAnchorDelta[];
  /** Motivational quote rendered below the summary, above the footer. */
  quote?: ShareCardQuote;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(secs: number | null): string {
  if (!secs || secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ─── Component ──────────────────────────────────────────────────────────────

const ShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard(
    {
      dayLabel,
      weekIdx,
      phase,
      phaseColor,
      stats,
      prs,
      congratsHeadline,
      congratsSub,
      breakdown,
      anchorComparison,
      quote,
    },
    ref,
  ) {
    const DISPLAY = "'Bebas Neue', 'Inter', system-ui, sans-serif";
    const BODY = "'InterVariable', 'Inter', system-ui, sans-serif";
    const AMBER = '#D4983C';
    const TEXT = '#E8E4DC';
    const DIM = '#9A8A78';
    const CARD_BG = '#1A1814';
    const BORDER = 'rgba(232,228,220,0.08)';

    const firstPR = prs[0];
    const hasPR = !!firstPR;
    const heroNumber = hasPR
      ? `${firstPR.name.toUpperCase()} ${firstPR.weight}×${firstPR.reps}`
      : `${Math.round(stats.volume).toLocaleString()} LBS`;
    const heroLabel = hasPR ? 'NEW PERSONAL RECORD' : 'TOTAL VOLUME';

    const gridItems: { label: string; value: string }[] = [
      { label: 'SETS', value: String(stats.sets) },
      { label: 'REPS', value: String(stats.reps) },
      { label: 'VOL', value: compactNumber(stats.volume) },
      { label: 'TIME', value: formatDuration(stats.duration) },
    ];

    // Hero autoshrinks for long PR names so "BARBELL BENCH PRESS 225×8" still
    // fits within the 1080px width. Cap at ~108px, floor at ~56px.
    const heroFontSize = hasPR
      ? Math.max(56, Math.min(108, Math.floor(1600 / heroNumber.length) * 2))
      : 124;

    // Working sets only — warm-ups aren't useful in a share and compete with
    // the heavier sets for space. Drop exercises that logged only warm-ups.
    const workingBreakdown = (breakdown || [])
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => !s.warmup) }))
      .filter((ex) => ex.sets.length > 0);

    const hasAnchorDeltas = !!anchorComparison && anchorComparison.length > 0;

    return (
      <div
        ref={ref}
        data-testid="share-card"
        style={{
          width: 1080,
          background: '#0A0A0C',
          color: TEXT,
          fontFamily: BODY,
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px 56px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          gap: 32,
        }}
      >
        {/* Ambient corner glow — gives the card a forge-warmth without any
            external imagery. Radial gradient layered as a pseudo-background. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -300,
            right: -300,
            width: 800,
            height: 800,
            background:
              'radial-gradient(circle, rgba(232,101,26,0.18) 0%, rgba(232,101,26,0) 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Wordmark — anchored top */}
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 72,
            letterSpacing: '0.18em',
            color: '#FBF7E4',
            textAlign: 'center',
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          THE FOUNDRY
        </div>

        {/* Phase meta — phase-colored */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: phaseColor,
            textTransform: 'uppercase',
          }}
        >
          {dayLabel} &middot; Week {weekIdx + 1} &middot; {phase}
        </div>

        {/* Congrats headline + sub */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 56,
              letterSpacing: '0.04em',
              color: TEXT,
              lineHeight: 1.05,
              fontWeight: 400,
              textTransform: 'uppercase',
            }}
          >
            {congratsHeadline}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              lineHeight: 1.45,
              color: '#A8A4A0',
              maxWidth: 860,
              margin: '14px auto 0',
            }}
          >
            {congratsSub}
          </div>
        </div>

        {/* Hero — PR if any, else total volume */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '24px 0 8px',
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: heroFontSize,
              letterSpacing: '0.02em',
              color: TEXT,
              lineHeight: 1,
              fontWeight: 400,
              textAlign: 'center',
              textShadow: '0 2px 32px rgba(232,101,26,0.35)',
            }}
          >
            {heroNumber}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '0.24em',
              color: hasPR ? AMBER : DIM,
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            {heroLabel}
          </div>
        </div>

        {/* 4-col stat grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: '28px 12px',
          }}
        >
          {gridItems.map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 56,
                  letterSpacing: '0.02em',
                  color: TEXT,
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  color: DIM,
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Per-exercise workout breakdown — reps × weight for every working
            set. Anchor exercises get the amber diamond bullet. Split into a
            two-column grid when there are more than 4 exercises so the card
            doesn't balloon vertically on high-volume sessions. */}
        {workingBreakdown.length > 0 && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: '24px 28px',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '0.24em',
                color: DIM,
                textTransform: 'uppercase',
                marginBottom: 18,
              }}
            >
              Workout Summary
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  workingBreakdown.length > 4 ? 'repeat(2, 1fr)' : '1fr',
                columnGap: 32,
                rowGap: 18,
              }}
            >
              {workingBreakdown.map((ex, i) => (
                <div key={i} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 20,
                      fontWeight: 700,
                      color: TEXT,
                      marginBottom: 8,
                    }}
                  >
                    {ex.anchor && (
                      <span
                        aria-hidden="true"
                        style={{ color: AMBER, fontSize: 16, lineHeight: 1 }}
                      >
                        ◆
                      </span>
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ex.name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {ex.sets.map((s, si) => (
                      <span
                        key={si}
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          padding: '5px 10px',
                          borderRadius: 999,
                          background: '#0F0D0A',
                          border: `1px solid ${BORDER}`,
                          color: TEXT,
                        }}
                      >
                        {s.weight > 0 ? `${s.weight} × ${s.reps}` : `${s.reps} reps`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anchor comparison vs last week */}
        {hasAnchorDeltas && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: '24px 28px',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '0.24em',
                color: DIM,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              Vs Last Week
            </div>
            {anchorComparison!.map((a, i) => {
              const sign = a.delta > 0 ? '+' : '';
              const color =
                a.delta > 0 ? '#6ABE63' : a.delta < 0 ? '#E76A5C' : DIM;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderTop: i > 0 ? `1px solid ${BORDER}` : undefined,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 800, color }}>
                    {sign}
                    {a.delta} lbs
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Multi-PR callout — first PR is already in the hero, additional PRs
            summarise here so the star appears when multiple were set. */}
        {hasPR && prs.length > 1 && (
          <div
            data-testid="share-card-pr-callout"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '20px 24px',
              background: 'rgba(212,152,60,0.1)',
              border: '1px solid rgba(212,152,60,0.4)',
              borderRadius: 16,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill={AMBER}>
              <path d="M12 2l2.9 7 7.1.6-5.4 4.7 1.7 7.2L12 17.8 5.7 21.5l1.7-7.2L2 9.6 9.1 9 12 2z" />
            </svg>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: AMBER,
                textTransform: 'uppercase',
              }}
            >
              {prs.length} New PRs This Session
            </div>
          </div>
        )}

        {/* Motivational quote — closing beat before the footer */}
        {quote && (
          <div
            style={{
              padding: '8px 24px 8px 36px',
              borderLeft: `4px solid ${phaseColor}`,
              position: 'relative',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -16,
                left: 12,
                fontSize: 96,
                lineHeight: 1,
                color: phaseColor,
                opacity: 0.35,
                fontFamily: 'Georgia, serif',
                pointerEvents: 'none',
              }}
            >
              &ldquo;
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: TEXT,
                lineHeight: 1.4,
                position: 'relative',
              }}
            >
              {quote.text}
            </div>
            <div
              style={{
                fontSize: 16,
                color: phaseColor,
                marginTop: 14,
                fontWeight: 800,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              — {quote.author}
            </div>
          </div>
        )}

        {/* Footer — F logo + URL, anchored bottom. /foundry-f.png is the
            ember-edged metallic F mark (matches WorkoutCompleteModal and
            WelcomeScreen). The image has its own baked dark background +
            ember glow, so no CSS mask or filter is needed — that matters
            here because html-to-image silently drops mask-image and can
            mangle drop-shadow filters during capture, which was why the
            F was missing from earlier shares. */}
        <div
          style={{
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <img
            src="/foundry-f.png"
            alt=""
            width={200}
            height={200}
            style={{
              width: 200,
              height: 200,
              objectFit: 'contain',
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.24em',
              color: DIM,
              textTransform: 'uppercase',
            }}
          >
            thefoundry.coach
          </div>
        </div>
      </div>
    );
  },
);

export default ShareCard;
