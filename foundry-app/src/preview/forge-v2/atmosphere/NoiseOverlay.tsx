/**
 * Film-grain texture above backgrounds. Mounted inside the preview shell,
 * not at the app root, so it never leaks into the live app.
 */
export function NoiseOverlay() {
  const svg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`;
  return (
    <div
      aria-hidden
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        opacity: 0.08,
        mixBlendMode: 'overlay',
        backgroundImage: `url("${svg}")`,
      }}
    />
  );
}
