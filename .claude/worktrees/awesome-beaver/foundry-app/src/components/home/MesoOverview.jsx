import React from 'react';
import { loadArchive, importData, exportData } from '../../utils/store';

// ── Sub-views ──────────────────────────────────────────────────────────────

function MesoOverviewContent() {
  return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Meso overview</div>;
}

function MesoHistory({ goBack }) {
  const archive = loadArchive?.() || [];
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px',
        }}
      >
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            fontSize: 18,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          Meso History
        </span>
      </div>
      {archive.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No archived mesocycles yet
        </div>
      ) : (
        <div
          style={{
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {archive.map((entry, idx) => (
            <div
              key={idx}
              style={{
                padding: 16,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {entry.profile?.split || 'Program'} — {entry.profile?.weeks || '?'} weeks
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                Archived {entry.date || 'unknown date'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklySummary({ activeDays, completedDays, goBack, profile }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px',
        }}
      >
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            fontSize: 18,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          Weekly Summary
        </span>
      </div>
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        Weekly summary view coming soon
      </div>
    </div>
  );
}

// ── SubHeader used by overview tab ────────────────────────────────────────

function SubHeader({ label, goBack }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 16px 12px',
        background: 'var(--bg-deep)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <button
        onClick={goBack}
        className="btn-ghost"
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
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Data Management tab content ────────────────────────────────────────────

function DataManagement({ goBack, setShowReset }) {
  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
      <SubHeader label="DATA MANAGEMENT" goBack={goBack} />
      <div
        style={{
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={exportData}
            className="btn-row"
            style={{
              width: '100%',
              padding: '16px',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 6,
                background: 'rgba(var(--accent-rgb),0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              ⬇
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--accent)',
                }}
              >
                Export backup
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                Download all your workout data as JSON
              </div>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</div>
          </button>
          <label
            style={{
              width: '100%',
              padding: '16px',
              cursor: 'pointer',
              background: 'transparent',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 6,
                background: 'rgba(var(--accent-rgb),0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              ⬆
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--accent)',
                }}
              >
                Import backup
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                Restore from a previously exported file
              </div>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</div>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                importData(file, (ok) => {
                  if (ok) {
                    alert('Data restored! Reloading...');
                    window.location.reload();
                  } else {
                    alert('Import failed — invalid backup file.');
                  }
                });
              }}
            />
          </label>
          <button
            onClick={() => setShowReset(true)}
            className="btn-danger"
            style={{
              width: '100%',
              padding: '16px',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 6,
                background: 'rgba(var(--accent-rgb),0.08)',
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
                  letterSpacing: '0.04em',
                  color: 'var(--danger)',
                }}
              >
                RST
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--danger)',
                }}
              >
                Reset meso cycle
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                Erase all progress and start fresh
              </div>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export: renders the correct sub-view based on tab ─────────────────

function MesoOverview({ tab, goBack, goTo, setShowReset, activeDays, completedDays, profile }) {
  if (tab === 'overview') {
    return (
      <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
        <SubHeader label="MESO OVERVIEW" goBack={goBack} />
        <MesoOverviewContent />
      </div>
    );
  }

  if (tab === 'datamgmt') {
    return <DataManagement goBack={goBack} setShowReset={setShowReset} />;
  }

  if (tab === 'history') {
    return <MesoHistory goBack={goBack} goTo={goTo} />;
  }

  if (tab === 'weekly') {
    return (
      <WeeklySummary
        activeDays={activeDays}
        completedDays={completedDays}
        goBack={goBack}
        profile={profile}
      />
    );
  }

  return null;
}

export default React.memo(MesoOverview);
