import React, { useState } from 'react';
import { store } from '../../utils/store';
import { FOUNDRY_PROFILE_IMG } from '../../data/images-profile';

const FOUNDRY_AI_WORKER_URL = import.meta.env.VITE_FOUNDRY_AI_WORKER_URL;
const FOUNDRY_APP_KEY = import.meta.env.VITE_FOUNDRY_APP_KEY;
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

export function ProfileDrawer({ saved, onClose, onSave }) {
  const savedBd = saved.birthdate ? saved.birthdate.split('-') : [];
  const [form, setForm] = useState({
    name: saved.name || '',
    weight: saved.weight || '',
    gender: saved.gender || '',
  });
  const [birthYear, setBirthYear] = useState(savedBd[0] || '');
  const [birthMonth, setBirthMonth] = useState(savedBd[1] ? parseInt(savedBd[1]).toString() : '');
  const [birthDay, setBirthDay] = useState(savedBd[2] ? parseInt(savedBd[2]).toString() : '');
  const [didSave, setDidSave] = useState(false);
  const [showEditFields, setShowEditFields] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(''); // "sending" | "sent" | "error"

  const handleSendFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackStatus('sending');
    try {
      const res = await fetch(FOUNDRY_AI_WORKER_URL + '/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Foundry-Key': FOUNDRY_APP_KEY,
        },
        body: JSON.stringify({
          message: feedbackMsg.trim(),
          appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
          device: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackStatus('sent');
        setFeedbackMsg('');
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackStatus('');
        }, 2000);
      } else {
        setFeedbackStatus('error');
      }
    } catch {
      setFeedbackStatus('error');
    }
  };

  const handleSave = () => {
    let age = saved.age || '';
    let birthdate = saved.birthdate || '';
    if (birthMonth && birthDay && birthYear) {
      birthdate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
      const bd = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
      const now = new Date();
      age = String(
        now.getFullYear() -
          bd.getFullYear() -
          (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0)
      );
    }
    onSave({ ...saved, ...form, age, birthdate });
    setDidSave(true);
    setTimeout(() => setDidSave(false), 2000);
  };

  const handleExport = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('foundry:')) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foundry_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 18 - i);

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 12px',
    outline: 'none',
    fontFamily: 'inherit',
  };
  const selectStyle = {
    ...inputStyle,
    width: 'auto',
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
  };
  const labelStyle = {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.14em',
    color: 'var(--text-dim)',
    marginBottom: 3,
    textTransform: 'uppercase',
  };
  const fieldRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 12px',
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  };
  const fieldLabelStyle = { fontSize: 11, color: 'var(--text-muted)' };
  const fieldValueStyle = {
    fontSize: 12,
    color: 'var(--text-primary)',
    fontWeight: 500,
  };

  const splitLabels = {
    ppl: 'Push / Pull / Legs',
    upper_lower: 'Upper / Lower',
    full_body: 'Full Body',
  };
  const expLabels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  // Load meso info
  const mesoData = (() => {
    try {
      return JSON.parse(localStorage.getItem('foundry:meso'));
    } catch (e) {
      return null;
    }
  })();
  const onboardData = (() => {
    try {
      return JSON.parse(localStorage.getItem('foundry:onboarding_data'));
    } catch (e) {
      return null;
    }
  })();
  const experience = saved.experience || (onboardData && onboardData.experience) || '';
  const currentWeek = parseInt(localStorage.getItem('foundry:currentWeek') || '0') + 1;
  const totalWeeks = mesoData ? mesoData.weeks : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '82%',
          maxWidth: 360,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)',
          overflowY: 'auto',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px 8px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
            }}
          >
            PROFILE
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              cursor: 'pointer',
              width: 28,
              height: 28,
              color: 'var(--text-muted)',
              fontSize: 14,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Hero banner with branding iron background */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 200,
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <img
            src={typeof FOUNDRY_PROFILE_IMG !== 'undefined' ? FOUNDRY_PROFILE_IMG : ''}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              opacity: 0.45,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, rgba(26,24,20,0.2) 0%, rgba(26,24,20,0.3) 35%, rgba(26,24,20,0.85) 75%, rgba(26,24,20,0.98) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 20,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Bebas Neue','Inter',sans-serif",
                fontSize: 22,
                color: '#FBF7E4',
                border: '2px solid rgba(251,247,228,0.2)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              {(form.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#FBF7E4',
                  textShadow: '0 1px 8px rgba(0,0,0,0.8)',
                }}
              >
                {form.name || 'Athlete'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--phase-accum)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
              >
                {expLabels[experience] || 'Not set'} · {splitLabels[saved.splitType] || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
          }}
        >
          {/* Training section */}
          <div style={labelStyle}>TRAINING</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={fieldRowStyle}>
              <span style={fieldLabelStyle}>Experience</span>
              <span style={fieldValueStyle}>{expLabels[experience] || 'Not set'}</span>
            </div>
            <div style={fieldRowStyle}>
              <span style={fieldLabelStyle}>Split</span>
              <span style={fieldValueStyle}>{splitLabels[saved.splitType] || '—'}</span>
            </div>
            {totalWeeks && (
              <div style={fieldRowStyle}>
                <span style={fieldLabelStyle}>Current Meso</span>
                <span style={fieldValueStyle}>
                  Week {currentWeek} of {totalWeeks}
                </span>
              </div>
            )}
            {saved.weight && (
              <div style={fieldRowStyle}>
                <span style={fieldLabelStyle}>Body Weight</span>
                <span style={fieldValueStyle}>{saved.weight} lbs</span>
              </div>
            )}
          </div>

          {/* Edit profile toggle */}
          <button
            onClick={() => setShowEditFields(!showEditFields)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Edit Profile</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {showEditFields ? '▲' : '▼'}
            </span>
          </button>

          {showEditFields && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                paddingTop: 4,
              }}
            >
              <div>
                <div style={labelStyle}>NAME</div>
                <input
                  type="text"
                  placeholder="First name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>DATE OF BIRTH</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    style={{ ...selectStyle, flex: 2, minWidth: 0 }}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    style={{ ...selectStyle, flex: 1.5, minWidth: 0 }}
                  >
                    <option value="">Year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div style={labelStyle}>BODY WEIGHT (LBS)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 185"
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>GENDER</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    ['m', 'Male'],
                    ['f', 'Female'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setForm((f) => ({ ...f, gender: val }))}
                      style={{
                        flex: 1,
                        padding: '9px 6px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background:
                          form.gender === val ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-inset)',
                        border: `1px solid ${form.gender === val ? 'var(--accent)' : 'var(--border)'}`,
                        color: form.gender === val ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'all 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSave}
                style={{
                  padding: '13px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: didSave ? 'var(--phase-accum)' : 'var(--btn-primary-bg)',
                  border: `1px solid ${didSave ? 'var(--phase-accum)' : 'var(--btn-primary-border)'}`,
                  color: 'var(--btn-primary-text)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {didSave ? '✓ Saved' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Data section */}
          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.2), transparent)',
              margin: '4px 0',
            }}
          />
          <div style={{ ...labelStyle, marginTop: 4 }}>DATA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={handleExport}
              style={{
                ...fieldRowStyle,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-inset)',
              }}
            >
              <span style={fieldLabelStyle}>Export Backup</span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                Download
              </span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Reset ALL Foundry data? This cannot be undone.')) {
                  const keys = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k.startsWith('foundry:')) keys.push(k);
                  }
                  keys.forEach((k) => localStorage.removeItem(k));
                  window.location.reload();
                }
              }}
              style={{
                ...fieldRowStyle,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-inset)',
              }}
            >
              <span style={fieldLabelStyle}>Reset All Data</span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--danger)',
                  fontWeight: 500,
                }}
              >
                Reset
              </span>
            </button>
          </div>

          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.2), transparent)',
              margin: '4px 0',
            }}
          />
          <div style={{ ...labelStyle, marginTop: 4 }}>SUPPORT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setShowFeedback(true)}
              style={{
                ...fieldRowStyle,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-inset)',
              }}
            >
              <span style={fieldLabelStyle}>Send Feedback</span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                Write
              </span>
            </button>
          </div>

          {/* Feedback Modal */}
          {showFeedback && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && feedbackStatus !== 'sending') {
                  setShowFeedback(false);
                  setFeedbackStatus('');
                }
              }}
            >
              <div
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 14,
                  padding: 20,
                  width: '100%',
                  maxWidth: 360,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}
                >
                  Send Feedback
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginBottom: 12,
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  Bug reports, feature ideas, anything — it goes straight to the developer.
                </div>
                <textarea
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={5}
                  disabled={feedbackStatus === 'sending' || feedbackStatus === 'sent'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    padding: '10px 12px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    minHeight: 100,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      setShowFeedback(false);
                      setFeedbackStatus('');
                    }}
                    disabled={feedbackStatus === 'sending'}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendFeedback}
                    disabled={
                      !feedbackMsg.trim() ||
                      feedbackStatus === 'sending' ||
                      feedbackStatus === 'sent'
                    }
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      background:
                        feedbackStatus === 'sent' ? 'var(--deload-phase)' : 'var(--accent)',
                      border: 'none',
                      fontFamily: 'inherit',
                      color: feedbackStatus === 'sent' ? '#fff' : '#000',
                      cursor:
                        !feedbackMsg.trim() || feedbackStatus === 'sending'
                          ? 'not-allowed'
                          : 'pointer',
                      opacity: !feedbackMsg.trim() && feedbackStatus !== 'sent' ? 0.4 : 1,
                    }}
                  >
                    {feedbackStatus === 'sending'
                      ? 'Sending…'
                      : feedbackStatus === 'sent'
                        ? 'Sent ✓'
                        : feedbackStatus === 'error'
                          ? 'Failed — Retry'
                          : 'Send'}
                  </button>
                </div>
                {feedbackStatus === 'error' && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--danger)',
                      textAlign: 'center',
                      marginTop: 8,
                    }}
                  >
                    Something went wrong. Try again.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Version */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--text-dim)',
              marginTop: 12,
              paddingBottom: 20,
            }}
          >
            The Foundry v{typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────

// ─── SAMPLE PROGRAM HELPERS ───────────────────────────────────────────────────
// Converts SAMPLE_PROGRAMS day objects (exercise name strings) into fully-formed
// day objects matching the aiDays shape that generateProgram returns as-is.

export default ProfileDrawer;
