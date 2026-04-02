/**
 * Button — standard app button.
 * Props:
 *   children   {node}      Button label / content.
 *   onClick    {function}  Click handler.
 *   variant    {string}    "primary" | "secondary" | "danger" | "ghost" (default "primary").
 *   disabled   {boolean}   Disabled state.
 *   fullWidth  {boolean}   Stretch to 100% width.
 *   style      {object}    Extra inline style overrides.
 */
const VARIANTS = {
  primary: {
    background: 'var(--btn-primary-bg)',
    border: '1px solid var(--btn-primary-border)',
    color: 'var(--btn-primary-text)',
  },
  secondary: {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
  danger: {
    background: 'var(--danger)',
    border: '1px solid var(--danger)',
    color: '#fff',
  },
  ghost: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
  },
};

export default function Button({ children, onClick, variant = 'primary', disabled = false, fullWidth = false, style }) {
  const base = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        width: fullWidth ? '100%' : undefined,
        padding: '12px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
