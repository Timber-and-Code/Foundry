/**
 * Generates and sets the app icon (foundry crucible) as favicon
 * Draws a 512x512 canvas with molten core, handles, and pour stream
 */
export function generateAppIcon() {
  try {
    const sz = 512;
    const c = document.createElement('canvas');
    c.width = sz;
    c.height = sz;
    const ctx = c.getContext('2d');
    const s = sz / 100;

    // Background: dark rounded square
    ctx.fillStyle = '#111316';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, sz, sz, sz * 0.18);
    } else {
      ctx.rect(0, 0, sz, sz);
    }
    ctx.fill();

    // Outer steel ring
    const rg = ctx.createRadialGradient(50 * s, 40 * s, 10 * s, 50 * s, 40 * s, 38 * s);
    rg.addColorStop(0, '#5a6070');
    rg.addColorStop(0.5, '#2e3240');
    rg.addColorStop(1, '#1a1d24');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(50 * s, 40 * s, 35 * s, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark ring
    ctx.fillStyle = '#0e1012';
    ctx.beginPath();
    ctx.arc(50 * s, 40 * s, 28 * s, 0, Math.PI * 2);
    ctx.fill();

    // Molten core
    const mg = ctx.createRadialGradient(47 * s, 36 * s, 2 * s, 50 * s, 40 * s, 26 * s);
    mg.addColorStop(0, '#ffcc44');
    mg.addColorStop(0.25, '#ff8c00');
    mg.addColorStop(0.6, '#cc4400');
    mg.addColorStop(1, '#6a1200');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(50 * s, 40 * s, 24 * s, 0, Math.PI * 2);
    ctx.fill();

    // Left handle
    ctx.fillStyle = '#3a4050';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8 * s, 36 * s, 9 * s, 8 * s, 2 * s);
    } else {
      ctx.rect(8 * s, 36 * s, 9 * s, 8 * s);
    }
    ctx.fill();
    ctx.fillStyle = '#5a6070';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8 * s, 36 * s, 9 * s, 3 * s, [2 * s, 2 * s, 0, 0]);
    } else {
      ctx.rect(8 * s, 36 * s, 9 * s, 3 * s);
    }
    ctx.fill();

    // Right handle
    ctx.fillStyle = '#3a4050';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(83 * s, 36 * s, 9 * s, 8 * s, 2 * s);
    } else {
      ctx.rect(83 * s, 36 * s, 9 * s, 8 * s);
    }
    ctx.fill();
    ctx.fillStyle = '#5a6070';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(83 * s, 36 * s, 9 * s, 3 * s, [2 * s, 2 * s, 0, 0]);
    } else {
      ctx.rect(83 * s, 36 * s, 9 * s, 3 * s);
    }
    ctx.fill();

    // Pour stream
    const pg = ctx.createLinearGradient(50 * s, 64 * s, 50 * s, 95 * s);
    pg.addColorStop(0, '#ffaa00');
    pg.addColorStop(0.5, '#dd5500');
    pg.addColorStop(1, '#7a1a00');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(44 * s, 64 * s);
    ctx.quadraticCurveTo(42 * s, 76 * s, 41 * s, 83 * s);
    ctx.quadraticCurveTo(40 * s, 90 * s, 44 * s, 93 * s);
    ctx.quadraticCurveTo(50 * s, 97 * s, 56 * s, 93 * s);
    ctx.quadraticCurveTo(60 * s, 90 * s, 59 * s, 83 * s);
    ctx.quadraticCurveTo(58 * s, 76 * s, 56 * s, 64 * s);
    ctx.closePath();
    ctx.fill();

    // Pour highlight
    ctx.strokeStyle = 'rgba(255,220,80,0.55)';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(47.5 * s, 64 * s);
    ctx.quadraticCurveTo(46 * s, 76 * s, 45 * s, 85 * s);
    ctx.stroke();

    // Ring top highlight
    ctx.strokeStyle = 'rgba(140,155,175,0.45)';
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(50 * s, 40 * s, 35 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    const png = c.toDataURL('image/png');
    document.querySelectorAll('link[rel="apple-touch-icon"],link[rel="icon"]').forEach((el) => {
      el.href = png;
    });
  } catch (e) {
    // Silently fail if canvas drawing is not supported
  }
}
