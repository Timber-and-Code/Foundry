import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>404</h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Page not found
      </p>
      <Link
        to="/"
        style={{
          color: 'var(--accent, #E8651A)',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
