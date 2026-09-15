import fs from 'node:fs';
import { asc } from './asc-lib.mjs';

const [buildId, notesPath] = process.argv.slice(2);
if (!buildId || !notesPath) {
  console.error('usage: node set-notes.mjs <buildId> <path/to/notes.txt>');
  process.exit(2);
}

const text = fs.readFileSync(notesPath, 'utf8').trim();
if (text.length > 4000) throw new Error(`whatsNew is ${text.length} chars, max 4000`);

const existing = await asc('GET', `/v1/builds/${buildId}/betaBuildLocalizations`);
const enUS = existing.data.find((l) => l.attributes.locale === 'en-US');

if (enUS) {
  await asc('PATCH', `/v1/betaBuildLocalizations/${enUS.id}`, {
    data: { type: 'betaBuildLocalizations', id: enUS.id, attributes: { whatsNew: text } },
  });
  console.log(`PATCHed existing localization ${enUS.id}`);
} else {
  const created = await asc('POST', '/v1/betaBuildLocalizations', {
    data: {
      type: 'betaBuildLocalizations',
      attributes: { locale: 'en-US', whatsNew: text },
      relationships: { build: { data: { type: 'builds', id: buildId } } },
    },
  });
  console.log(`POSTed new localization ${created.data.id}`);
}

// A 200 on the write is NOT proof — read it back. Builds have shipped with
// empty notes despite a successful-looking write.
const after = await asc('GET', `/v1/builds/${buildId}/betaBuildLocalizations`);
const got = after.data.find((l) => l.attributes.locale === 'en-US')?.attributes.whatsNew ?? '';
console.log(`readback: ${got.length} chars (sent ${text.length})`);
console.log(got === text ? 'VERIFIED: exact match' : 'MISMATCH - notes did NOT stick');
if (got !== text) process.exit(1);
