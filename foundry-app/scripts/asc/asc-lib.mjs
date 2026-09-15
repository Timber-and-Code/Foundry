import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const KEY_ID = '3TYJRGM968';                                  // Admin role — required
export const ISSUER = '8d29c5fa-d475-42b8-92d9-1f82d14d3833';
export const APP_ID = '6762534411';
export const EXTERNAL_GROUP = 'a5648134-d10a-4321-9993-2dcd1bb10b03'; // Foundry_Testers

/**
 * ASC wants ES256 JOSE signatures (r||s, 32 bytes each). Node's sign()
 * emits ASN.1 DER, which ASC rejects with a bare 401 and no explanation.
 * Node 16+ can do the conversion for us via dsaEncoding.
 */
function jwt() {
  const keyPath = path.join(os.homedir(), '.appstoreconnect/private_keys', `AuthKey_${KEY_ID}.p8`);
  const key = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const iat = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const body = b64({ iss: ISSUER, iat, exp: iat + 1200, aud: 'appstoreconnect-v1' });
  const sig = crypto
    .createSign('SHA256')
    .update(`${head}.${body}`)
    .sign({ key, dsaEncoding: 'ieee-p1363' })       // ieee-p1363 == JOSE r||s
    .toString('base64url');
  return `${head}.${body}.${sig}`;
}

export async function asc(method, endpoint, body) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.appstoreconnect.apple.com${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail}`).join('; ') || text;
    throw new Error(`${method} ${endpoint} -> ${res.status}\n${detail}`);
  }
  return json;
}
