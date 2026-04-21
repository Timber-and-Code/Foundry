import React from 'react';

/**
 * ShareCard — purpose-built 1080×1350 capture surface for the "Share this
 * workout" feature. Rendered OFF-SCREEN inside WorkoutCompleteModal and fed
 * to html-to-image to produce a branded PNG.
 *
 * Hard constraints:
 *   - Fixed 1080×1350 dimensions (IG portrait). Capture happens at export
 *     size regardless of viewport, so every value here is in absolute px,
 *     not rem / vw / responsive tokens.
 *   - All typography is declared inline with explicit font-family strings
 *     (matching the self-hosted /fonts/ files) so html-to-image embeds the
 *     right face on first paint.
 *   - Images must be same-origin (public/* is fine). No CORS-tainted canvas.
 *   - NO interactive elements. NO buttons. NO cool-down prompt. This card
 *     is static capture-only.
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

export interface ShareCardProps {
  dayLabel: string;
  weekIdx: number; // 0-indexed
  phase: string;
  phaseColor: string;
  stats: ShareCardStats;
  prs: ShareCardPR[];
  congratsHeadline: string;
  congratsSub: string;
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
    },
    ref,
  ) {
    const DISPLAY = "'Bebas Neue', 'Inter', system-ui, sans-serif";
    const BODY = "'InterVariable', 'Inter', system-ui, sans-serif";
    const AMBER = '#D4983C';

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
    // fits within the 1080px width. Cap at ~110px, floor at ~64px.
    const heroFontSize = hasPR
      ? Math.max(64, Math.min(110, Math.floor(1600 / heroNumber.length) * 2))
      : 138;

    return (
      <div
        ref={ref}
        data-testid="share-card"
        style={{
          width: 1080,
          height: 1350,
          background: '#0A0A0C',
          color: '#E8E4DC',
          fontFamily: BODY,
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 80px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
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
            marginTop: 48,
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

        {/* Hero block — flex-grow so it lives in the vertical center */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: heroFontSize,
              letterSpacing: '0.02em',
              color: '#E8E4DC',
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
              color: hasPR ? AMBER : '#9A8A78',
              textTransform: 'uppercase',
              marginTop: 8,
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
            background: '#1A1814',
            border: '1px solid rgba(232,228,220,0.08)',
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
                  color: '#E8E4DC',
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
                  color: '#9A8A78',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* PR callout — only when a PR was set AND we didn't already hero it,
            OR always when multiple PRs exist (first is hero, rest listed) */}
        {hasPR && prs.length > 1 && (
          <div
            data-testid="share-card-pr-callout"
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '18px 24px',
              background: 'rgba(212,152,60,0.1)',
              border: '1px solid rgba(212,152,60,0.4)',
              borderRadius: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill={AMBER}>
              <path d="M12 2l2.9 7 7.1.6-5.4 4.7 1.7 7.2L12 17.8 5.7 21.5l1.7-7.2L2 9.6 9.1 9 12 2z" />
            </svg>
            <div
              style={{
                fontSize: 22,
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

        {/* Non-hero PR callout path: single PR but we chose volume hero —
            won't happen today (hero ALWAYS prefers PR), but keeps the PR
            star visible in alt layouts. */}
        {!hasPR && stats.sets > 0 && null}

        {/* Congrats block — rule-delimited */}
        <div
          style={{
            marginTop: 36,
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 80,
              height: 2,
              background: phaseColor,
              margin: '0 auto 20px',
              opacity: 0.8,
            }}
          />
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 44,
              letterSpacing: '0.04em',
              color: '#E8E4DC',
              lineHeight: 1.1,
              fontWeight: 400,
              textTransform: 'uppercase',
            }}
          >
            {congratsHeadline}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 20,
              lineHeight: 1.45,
              color: '#A8A4A0',
              maxWidth: 780,
              margin: '14px auto 0',
            }}
          >
            {congratsSub}
          </div>
        </div>

        {/* Footer — F logo + URL, anchored bottom */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img
            src="/foundry-f.png"
            alt=""
            width={80}
            height={80}
            style={{
              width: 80,
              height: 80,
              objectFit: 'contain',
              // Same radial mask as WelcomeScreen so the F floats without its
              // baked rectangular background bleeding through.
              maskImage:
                'radial-gradient(ellipse at center, black 45%, transparent 78%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, black 45%, transparent 78%)',
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: '#7A7269',
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
