import React from 'react';
import { tokens } from '../../styles/tokens';

/**
 * Text variant presets. Each preset bakes family + size + weight + letter
 * spacing + line height so component authors stop choosing them ad-hoc.
 *
 * Adding new variants is cheap; renaming is expensive (requires touching
 * every call site) — prefer additive changes.
 */
export type TextVariant =
  | 'display'    // Hero display — Bebas Neue, clamp 36–56px
  | 'h1'         // Page titles — Inter 700, 22-28px
  | 'h2'         // Section headings — Inter 700, 18px
  | 'h3'         // Card titles — Inter 700, 16px
  | 'body'       // Default prose — Inter 400, 14px
  | 'bodyLg'    // Larger prose — Inter 400, 15-17px
  | 'caption'    // Supporting metadata — Inter 500, 12px
  | 'label'      // Form labels, ALL CAPS pill — Inter 700 uppercase, 11px
  | 'metric';    // Numeric readouts — tabular, 22px

interface VariantStyle {
  fontFamily: string;
  fontSize: number | string;
  fontWeight: React.CSSProperties['fontWeight'];
  letterSpacing?: string;
  textTransform?: React.CSSProperties['textTransform'];
  lineHeight?: number | string;
}

const VARIANT_STYLES: Record<TextVariant, VariantStyle> = {
  display: {
    fontFamily: tokens.fontFamily.display,
    fontSize: 'clamp(36px, 9vw, 56px)',
    fontWeight: 400,
    letterSpacing: '0.16em',
    lineHeight: 1.0,
  },
  h1: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 'clamp(22px, 6vw, 28px)',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    lineHeight: 1.15,
  },
  h2: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  h3: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  body: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.55,
  },
  bodyLg: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.55,
  },
  caption: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.01em',
    lineHeight: 1.4,
  },
  label: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },
  metric: {
    fontFamily: tokens.fontFamily.body,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.1,
  },
};

type TextElement = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';

interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color' | 'style'> {
  variant?: TextVariant;
  as?: TextElement;
  color?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Text — typography primitive. Applies a variant preset (family + size
 * + weight + spacing + line-height) with optional color + style overrides.
 *
 * Migrates inline `"'Inter', system-ui, sans-serif"` strings to a single
 * source. Default renders a `<span>`; pass `as="h1"` etc. for semantics.
 */
export default function Text({
  variant = 'body',
  as = 'span',
  color,
  style,
  children,
  ...rest
}: TextProps) {
  const preset = VARIANT_STYLES[variant];
  const Tag = as as React.ElementType;
  return (
    <Tag
      {...rest}
      style={{
        ...preset,
        ...(color ? { color } : null),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
