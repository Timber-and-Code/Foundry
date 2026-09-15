import { asc, APP_ID } from './asc-lib.mjs';
const want = process.argv[2];   // e.g. "2.15.1"
const r = await asc('GET',
  `/v1/builds?filter[app]=${APP_ID}&limit=8&sort=-uploadedDate&include=buildBetaDetail,preReleaseVersion`);
const detail = Object.fromEntries((r.included ?? []).filter(i => i.type === 'buildBetaDetails').map(i => [i.id, i.attributes]));
const pre = Object.fromEntries((r.included ?? []).filter(i => i.type === 'preReleaseVersions').map(i => [i.id, i.attributes]));
for (const b of r.data) {
  const v = pre[b.relationships?.preReleaseVersion?.data?.id]?.version ?? '?';
  const d = detail[b.relationships?.buildBetaDetail?.data?.id] ?? {};
  const line = `${v} (${b.attributes.version})  id=${b.id}  processing=${b.attributes.processingState}  internal=${d.internalBuildState}  external=${d.externalBuildState}  uploaded=${b.attributes.uploadedDate}`;
  if (!want || v === want) console.log(line);
}
