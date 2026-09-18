// Checks docs/app-store-listing.md against App Store Connect's character limits.
import { readFileSync } from 'node:fs';
const md = readFileSync(new URL('../../docs/app-store-listing.md', import.meta.url), 'utf8');
const section = (h) => {
  const i = md.indexOf(`## ${h}`); if (i < 0) return '';
  const rest = md.slice(i + h.length + 3); const j = rest.search(/\n## /);
  return (j < 0 ? rest : rest.slice(0, j)).trim();
};
const bold = (s) => (s.match(/\*\*(.+?)\*\*/) || [])[1] || '';
const quote = (s) => s.split('\n').filter((l) => l.startsWith('> ')).map((l) => l.slice(2)).join('\n');
const desc = section('Description (4000)');
const checks = [
  ['App name', bold(section('App name (30)')), 30],
  ['Subtitle', bold(section('Subtitle (30)')), 30],
  ['Promotional text', quote(section('Promotional text (170)')), 170],
  ['Description', desc, 4000],
  ['Keywords', bold(section('Keywords (100)')), 100],
];
let ok = true;
for (const [name, text, max] of checks) {
  const n = [...text].length; const pass = n > 0 && n <= max; ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${n}/${max}`);
}
process.exit(ok ? 0 : 1);
