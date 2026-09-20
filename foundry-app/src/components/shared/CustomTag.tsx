import { tokens } from '../../styles/tokens';

/**
 * Marks a lift the user added themselves. The exercise keeps its real name;
 * this is the only thing that says "custom" on screen.
 */
export default function CustomTag({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: sm ? 9 : 10,
        fontWeight: 800,
        letterSpacing: '0.1em',
        lineHeight: 1,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
        borderRadius: tokens.radius.xs,
        padding: sm ? '3px 5px' : '4px 6px',
      }}
    >
      Custom
    </span>
  );
}
