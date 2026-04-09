import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
}

// ─── ERROR BOUNDARY ─────────────────────────────────────────────────────────
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const errMsg = this.state.error?.message || String(this.state.error);
    const errStack = this.state.error?.stack || '';
    const compStack = this.state.info?.componentStack || '';
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          color: 'var(--text-primary)',
          fontFamily: "'Inter',system-ui,sans-serif",
          maxWidth: 480,
          margin: '0 auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 16,
          }}
        >
          <span style={{ fontSize: 28 }}>💥</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Something went wrong</div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 2,
              }}
            >
              The Foundry hit an unexpected error
            </div>
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--phase-peak)',
              marginBottom: 8,
            }}
          >
            ERROR
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
            }}
          >
            {errMsg}
          </div>
        </div>
        {import.meta.env.DEV ? (
          <>
            {errStack && (
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}
                >
                  STACK TRACE
                </div>
                <pre
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                >
                  {errStack}
                </pre>
              </div>
            )}
            {compStack && (
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}
                >
                  COMPONENT STACK
                </div>
                <pre
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                >
                  {compStack}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            Something went wrong. Please reload the app.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
            }}
          >
            Reload App
          </button>
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          If this keeps happening, try clearing your data and restarting.
        </div>
      </div>
    );
  }
}
