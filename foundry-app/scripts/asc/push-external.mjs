import { asc, EXTERNAL_GROUP } from './asc-lib.mjs';
const buildId = process.argv[2];

// 1. Assign to Foundry_Testers (external). Uploading alone only reaches internal.
try {
  await asc('POST', `/v1/betaGroups/${EXTERNAL_GROUP}/relationships/builds`, {
    data: [{ type: 'builds', id: buildId }],
  });
  console.log('assigned to Foundry_Testers');
} catch (e) {
  console.log(`assign: ${e.message.split('\n')[1] ?? e.message}`);
}

// 2. Submit for Apple's beta review.
try {
  const r = await asc('POST', '/v1/betaAppReviewSubmissions', {
    data: {
      type: 'betaAppReviewSubmissions',
      relationships: { build: { data: { type: 'builds', id: buildId } } },
    },
  });
  console.log(`beta review submission ${r.data.id}`);
} catch (e) {
  console.log(`submit: ${e.message.split('\n')[1] ?? e.message}`);
}

// 3. The only thing that counts: externalBuildState must leave
//    READY_FOR_BETA_SUBMISSION.
const v = await asc('GET', `/v1/builds/${buildId}?include=buildBetaDetail`);
const d = v.included.find((i) => i.type === 'buildBetaDetails').attributes;
console.log(`internal=${d.internalBuildState} external=${d.externalBuildState}`);
console.log(d.externalBuildState === 'READY_FOR_BETA_SUBMISSION'
  ? 'INCOMPLETE — external testers will NOT get this build'
  : 'external push confirmed');
