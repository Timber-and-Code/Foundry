// Captioned App Store images at Apple's exact sizes.
// node compose.mjs <rawDir> <outDir>
import { chromium } from '/Users/tnc3/Desktop/Foundry/foundry-app/node_modules/playwright-core/index.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const [RAW, OUT] = process.argv.slice(2);
const SIZES = {
  iphone: { w: 440, h: 956, dsf: 3, px: '1320 × 2868' },
  ipad: { w: 1032, h: 1376, dsf: 2, px: '2064 × 2752' },
};

// App Store order: strongest first. [file, headline, subline]
const SCREENS = [
  ['01-home', 'Know exactly what to lift today', 'Every session planned, with last week’s numbers ready.'],
  ['02-workout', 'Every set starts from last week', 'Targets that climb as you do.'],
  ['04-review', 'Review your program before it starts', 'Swap any lift. Train exactly what you approve.'],
  ['05-coach', 'Coach-tuned, then yours', 'Your coach builds it. You make the final call.'],
  ['03-history', 'Watch every lift climb', 'Top sets and PRs, week by week.'],
  ['08-recap', 'See what the block built', 'Every mesocycle ends with a full summary.'],
  ['07-progress', 'Progress by muscle', 'Strength gained, body weight and estimated 1RMs.'],
  ['06-schedule', 'Your week, planned', 'Move, skip or add a session in a tap.'],
  ['09-next', 'Finish strong. Plan what’s next.', 'Repeat the block, build a new one, or try a program.'],
  ['10-previous', 'Every block on record', 'Your lifts by muscle, across every mesocycle.'],
  ['11-cardio', 'Cardio that fits your lifting', 'From easy walks to Tabata, around your training days.'],
  ['12-mobility', 'Mobility, guided', 'Warm-ups matched to the day’s lifts.'],
];

const page = (device, img, headline, sub) => {
  const s = SIZES[device];
  const ipad = device === 'ipad';
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;600&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${s.w}px; height: ${s.h}px; overflow: hidden; }
  body {
    background:
      radial-gradient(120% 55% at 50% -8%, rgba(232,101,26,0.34) 0%, rgba(232,101,26,0.08) 45%, rgba(0,0,0,0) 70%),
      linear-gradient(#141110, #0a0909 60%);
    color: #fbf7e4; font-family: 'Inter', system-ui, sans-serif; position: relative;
  }
  .cap { position: absolute; left: 0; right: 0; top: ${ipad ? 70 : 54}px; padding: 0 ${ipad ? 90 : 30}px; text-align: center; }
  .eyebrow { font: 600 ${ipad ? 13 : 10}px/1 'Inter', sans-serif; letter-spacing: 0.28em; color: #e8651a; text-transform: uppercase; margin-bottom: ${ipad ? 16 : 12}px; }
  h1 { font: 400 ${ipad ? 64 : 42}px/0.98 'Bebas Neue', Impact, sans-serif; letter-spacing: 0.035em; text-transform: uppercase; text-wrap: balance; }
  p { margin-top: ${ipad ? 16 : 12}px; font: 500 ${ipad ? 19 : 14}px/1.4 'Inter', sans-serif; color: #b9ae9f; text-wrap: balance; }
  .shot { position: absolute; left: 50%; transform: translateX(-50%); top: ${ipad ? 300 : 238}px;
    width: ${ipad ? 82 : 82}%; border-radius: ${ipad ? 28 : 34}px; overflow: hidden;
    border: ${ipad ? 2 : 1.5}px solid rgba(232,101,26,0.35);
    box-shadow: 0 30px 80px rgba(0,0,0,0.65), 0 0 0 ${ipad ? 10 : 7}px #050505; }
  .shot img { display: block; width: 100%; }
</style></head><body>
  <div class="cap"><div class="eyebrow">The Foundry</div><h1>${headline}</h1><p>${sub}</p></div>
  <div class="shot"><img src="data:image/png;base64,${img}"></div>
</body></html>`;
};

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const device of Object.keys(SIZES)) {
  const s = SIZES[device];
  mkdirSync(`${OUT}/${device}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf });
  const p = await ctx.newPage();
  let n = 1;
  for (const [file, headline, sub] of SCREENS) {
    const img = readFileSync(`${RAW}/${device}/${file}.png`).toString('base64');
    writeFileSync('/tmp/compose.html', page(device, img, headline, sub));
    await p.goto('file:///tmp/compose.html');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const name = `${String(n).padStart(2, '0')}-${file.slice(3)}`;
    await p.screenshot({ path: `${OUT}/${device}/${name}.png` });
    console.log(device, name);
    n++;
  }
  await ctx.close();
}
await browser.close();
