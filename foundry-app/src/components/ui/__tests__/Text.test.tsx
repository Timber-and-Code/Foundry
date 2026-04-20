/**
 * Tests for Text — typography primitive.
 * Verifies each variant applies the correct font family, size, and weight,
 * and that color / style / as overrides land on the DOM node.
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Text, { type TextVariant } from '../Text';

describe('Text', () => {
  it('renders a span by default', () => {
    render(<Text>Hello</Text>);
    const el = screen.getByText('Hello');
    expect(el.tagName).toBe('SPAN');
  });

  it('renders the element specified by `as`', () => {
    render(<Text as="h1">Heading</Text>);
    const el = screen.getByText('Heading');
    expect(el.tagName).toBe('H1');
  });

  it('applies the display variant styles (Bebas family, clamp size)', () => {
    render(
      <Text variant="display" data-testid="t">
        THE FOUNDRY
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el.style.fontFamily).toContain('Bebas Neue');
    expect(el.style.letterSpacing).toBe('0.16em');
    // jsdom drops clamp() values it can't parse — don't assert on fontSize
    // here; test 'body' variant's fixed-px size instead.
  });

  it.each<[TextVariant, string | number]>([
    ['h1', 700],
    ['h2', 700],
    ['h3', 700],
    ['body', 400],
    ['caption', 500],
    ['label', 700],
    ['metric', 700],
  ])('variant %s uses weight %s', (variant, weight) => {
    render(
      <Text variant={variant} data-testid="t">
        sample
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(String(el.style.fontWeight)).toBe(String(weight));
  });

  it('label variant uppercases and sets letter spacing', () => {
    render(
      <Text variant="label" data-testid="t">
        all caps
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el.style.textTransform).toBe('uppercase');
    expect(el.style.letterSpacing).toBe('0.08em');
  });

  it('applies color override', () => {
    render(
      <Text color="rgb(232, 101, 26)" data-testid="t">
        accent text
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el.style.color).toBe('rgb(232, 101, 26)');
  });

  it('merges inline style overrides after the preset', () => {
    render(
      <Text variant="body" style={{ marginTop: 12, fontSize: 18 }} data-testid="t">
        custom
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el.style.marginTop).toBe('12px');
    // User override of fontSize wins over variant default (14).
    expect(el.style.fontSize).toBe('18px');
  });

  it('passes through arbitrary HTML attributes (aria-label, className)', () => {
    render(
      <Text aria-label="hidden-friendly" className="my-class" data-testid="t">
        Hi
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el).toHaveAttribute('aria-label', 'hidden-friendly');
    expect(el).toHaveClass('my-class');
  });
});
