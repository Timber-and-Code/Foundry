import React from 'react';
import { tokens } from '../../styles/tokens';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

const VARIANTS: Record<string, React.CSSProperties> = {
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

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const base = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        width: fullWidth ? '100%' : undefined,
        padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
        borderRadius: tokens.radius.lg,
        fontSize: tokens.fontSize.md,
        fontWeight: tokens.fontWeight.bold,
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
