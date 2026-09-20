/**
 * Shown under every "Create Account" button. App Review 5.1.1(i) wants the
 * policy reachable from where the account is made, not only from Settings.
 */
export default function PrivacyNote() {
  return (
    <p
      style={{
        margin: '10px 0 0',
        fontSize: 11,
        lineHeight: 1.5,
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      By creating an account you agree to our{' '}
      <a
        href="https://thefoundry.coach/privacy"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
      >
        Privacy Policy
      </a>
      .
    </p>
  );
}
