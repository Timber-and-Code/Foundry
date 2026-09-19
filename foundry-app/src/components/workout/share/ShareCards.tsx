import React from 'react';
import { formatAnchorRow } from '../../../utils/anchorComparison';
import type { WorkoutCompleteStats } from '../WorkoutCompleteModal';

/**
 * The share image, as three templates on one 1080 × 1920 frame (Instagram /
 * Snapchat story size — the most common destination).
 *
 * Designed to be read at a glance on a phone: one hero number, three
 * supporting stats, a short list. The previous card put the whole session
 * (quote, every set of every exercise, comparison table) into one image,
 * which came out as unreadably small text.
 *
 * Capture constraints (html-to-image on WebKit): absolute px everywhere,
 * explicit font-family strings, same-origin images, no CSS masks, no
 * interactive elements.
 */

export type ShareTemplate = 'session' | 'pr' | 'progress';

export interface ShareCardData {
  dayLabel: string;
  weekIdx: number;
  phase: string;
  stats: WorkoutCompleteStats;
}

export const CARD_W = 1080;
export const CARD_H = 1920;

const DISPLAY = "'Bebas Neue', 'Inter', system-ui, sans-serif";
const BODY = "'InterVariable', 'Inter', system-ui, sans-serif";
const ORANGE = '#E8651A';
const CREAM = '#FBF7E4';
const MUTED = '#9C9184';
const UP = '#6FCB8B';

/** Which templates this session can fill. Session always; PR only with a PR;
 *  Progress only with a real week-over-week comparison (not in a deload). */
export function availableTemplates(stats: WorkoutCompleteStats): ShareTemplate[] {
  const out: ShareTemplate[] = [];
  if (stats.prs.length > 0) out.push('pr');
  out.push('session');
  if (!stats.isDeload && stats.anchorComparison.some((a) => a.prev > 0)) out.push('progress');
  return out;
}

export const TEMPLATE_LABEL: Record<ShareTemplate, string> = {
  pr: 'PR',
  session: 'Session',
  progress: 'Progress',
};

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 }));

function fmtDuration(secs: number | null): string | null {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Heaviest working set per exercise, e.g. "225 × 5". */
function topSets(stats: WorkoutCompleteStats, limit: number) {
  return (stats.breakdown ?? [])
    .map((ex) => {
      const working = ex.sets.filter((s) => !s.warmup && s.reps > 0);
      if (working.length === 0) return null;
      const top = working.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
      return { name: ex.name, anchor: !!ex.anchor, text: top.weight > 0 ? `${fmt(top.weight)} × ${top.reps}` : `${top.reps} reps` };
    })
    .filter((x): x is { name: string; anchor: boolean; text: string } => x !== null)
    .sort((a, b) => Number(b.anchor) - Number(a.anchor))
    .slice(0, limit);
}

function Frame({ children, eyebrow }: { children: React.ReactNode; eyebrow: string }) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#0A0908',
        color: CREAM,
        fontFamily: BODY,
        display: 'flex',
        flexDirection: 'column',
        padding: '120px 96px 110px',
        boxSizing: 'border-box',
      }}
    >
      {/* Forge glow, same language as the launch reveal. */}
      <div
        style={{
          position: 'absolute',
          left: -300,
          right: -300,
          top: -520,
          height: 1300,
          background: 'radial-gradient(closest-side, rgba(232,101,26,0.55), rgba(232,101,26,0.18) 55%, rgba(0,0,0,0) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -200,
          right: -200,
          bottom: -700,
          height: 1100,
          background: 'radial-gradient(closest-side, rgba(232,101,26,0.22), rgba(0,0,0,0) 100%)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 26 }}>
        <img src="/icon-512.png" alt="" width={104} height={104} style={{ width: 104, height: 104, borderRadius: 24 }} />
        <div style={{ fontFamily: DISPLAY, fontSize: 60, letterSpacing: '0.14em', lineHeight: 1 }}>THE FOUNDRY</div>
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 120,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: '0.2em',
          color: ORANGE,
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: MUTED,
        }}
      >
        <span>THEFOUNDRY.COACH</span>
      </div>
    </div>
  );
}

function StatRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'flex', borderTop: '2px solid rgba(251,247,228,0.12)', borderBottom: '2px solid rgba(251,247,228,0.12)' }}>
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{
            flex: 1,
            padding: '34px 0',
            textAlign: 'center',
            borderLeft: i === 0 ? 'none' : '2px solid rgba(251,247,228,0.12)',
          }}
        >
          <div style={{ fontFamily: DISPLAY, fontSize: 104, lineHeight: 1, letterSpacing: '0.02em' }}>{it.value}</div>
          <div style={{ marginTop: 12, fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', color: MUTED }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function sessionStats(stats: WorkoutCompleteStats) {
  const items = [
    { label: 'SETS', value: String(stats.sets) },
    { label: 'REPS', value: String(stats.reps) },
  ];
  const t = fmtDuration(stats.duration);
  if (t) items.push({ label: 'TIME', value: t });
  else items.push({ label: 'EXERCISES', value: String(stats.exercises) });
  return items;
}

function ListRows({ rows }: { rows: { name: string; right: string; rightColor?: string; sub?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 30 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 40, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 560 }}>{r.name}</div>
            {r.sub && <div style={{ marginTop: 6, fontSize: 28, color: MUTED, fontWeight: 600 }}>{r.sub}</div>}
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 64, lineHeight: 1, color: r.rightColor ?? CREAM, whiteSpace: 'nowrap' }}>{r.right}</div>
        </div>
      ))}
    </div>
  );
}

function SessionCard({ data }: { data: ShareCardData }) {
  const { stats } = data;
  const lifts = topSets(stats, 4);
  return (
    <Frame eyebrow={`Week ${data.weekIdx + 1} · ${data.phase}`}>
      <div style={{ marginTop: 18, fontFamily: DISPLAY, fontSize: 190, lineHeight: 0.9, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {data.dayLabel}
      </div>
      <div style={{ marginTop: 70, display: 'flex', alignItems: 'baseline', gap: 24 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 250, lineHeight: 0.85, color: ORANGE }}>{fmt(Math.round(stats.volume))}</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>LB<br />MOVED</div>
      </div>
      <div style={{ marginTop: 70 }}>
        <StatRow items={sessionStats(stats)} />
      </div>
      {lifts.length > 0 && (
        <div style={{ marginTop: 70 }}>
          <ListRows rows={lifts.map((l) => ({ name: l.name, right: l.text }))} />
        </div>
      )}
    </Frame>
  );
}

function PrCard({ data }: { data: ShareCardData }) {
  const { stats } = data;
  const [pr, ...more] = stats.prs;
  const gain = pr.newBest - pr.prevBest;
  return (
    <Frame eyebrow="New personal record">
      <div style={{ marginTop: 26, fontFamily: DISPLAY, fontSize: 120, lineHeight: 0.95, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {pr.name}
      </div>
      <div style={{ marginTop: 60, display: 'flex', alignItems: 'flex-end', gap: 26 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 420, lineHeight: 0.78, color: ORANGE }}>{fmt(pr.newBest)}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 110, lineHeight: 1, paddingBottom: 12 }}>LB</div>
      </div>
      {pr.prevBest > 0 && gain > 0 && (
        <div style={{ marginTop: 40, fontSize: 44, fontWeight: 700 }}>
          <span style={{ color: UP }}>+{fmt(gain)} lb</span>
          <span style={{ color: MUTED }}> from {fmt(pr.prevBest)}</span>
        </div>
      )}
      <div style={{ marginTop: 'auto', marginBottom: 80 }}>
        {more.length > 0 && (
          <div style={{ marginBottom: 50 }}>
            <ListRows rows={more.slice(0, 2).map((p) => ({ name: p.name, right: `${fmt(p.newBest)} LB`, rightColor: ORANGE, sub: 'Also a PR today' }))} />
          </div>
        )}
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.14em', color: MUTED, marginBottom: 20 }}>
          {data.dayLabel.toUpperCase()} · WEEK {data.weekIdx + 1}
        </div>
        <StatRow items={sessionStats(stats)} />
      </div>
    </Frame>
  );
}

function ProgressCard({ data }: { data: ShareCardData }) {
  const { stats } = data;
  const rows = stats.anchorComparison
    .filter((a) => a.prev > 0)
    .slice(0, 5)
    .map((a) => {
      const r = formatAnchorRow(a, stats.isDeload);
      return {
        name: a.name,
        sub: `${fmt(a.prev)} → ${fmt(a.today)} lb`,
        right: r.chip === 'held' ? 'HELD' : `${r.chip} LB`,
        rightColor: r.tone === 'up' ? UP : r.tone === 'down' ? '#E0705A' : MUTED,
      };
    });
  const totalUp = stats.anchorComparison.reduce((s, a) => s + (a.prev > 0 && a.delta > 0 ? a.delta : 0), 0);
  return (
    <Frame eyebrow={`Week ${data.weekIdx + 1} vs week ${data.weekIdx}`}>
      <div style={{ marginTop: 18, fontFamily: DISPLAY, fontSize: 150, lineHeight: 0.9, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {data.dayLabel}
      </div>
      {totalUp > 0 && (
        <div style={{ marginTop: 60, display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 250, lineHeight: 0.85, color: ORANGE }}>+{fmt(totalUp)}</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>LB ADDED<br />THIS WEEK</div>
        </div>
      )}
      <div style={{ marginTop: 80 }}>
        <ListRows rows={rows} />
      </div>
      <div style={{ marginTop: 'auto', marginBottom: 80 }}>
        <StatRow items={sessionStats(stats)} />
      </div>
    </Frame>
  );
}

export const ShareCardView = React.forwardRef<HTMLDivElement, { template: ShareTemplate; data: ShareCardData }>(
  function ShareCardView({ template, data }, ref) {
    return (
      <div ref={ref} style={{ width: CARD_W, height: CARD_H }}>
        {template === 'pr' && data.stats.prs.length > 0 ? (
          <PrCard data={data} />
        ) : template === 'progress' ? (
          <ProgressCard data={data} />
        ) : (
          <SessionCard data={data} />
        )}
      </div>
    );
  },
);
