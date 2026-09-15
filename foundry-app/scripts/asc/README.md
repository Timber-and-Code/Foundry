# App Store Connect helpers

Small JWT client + the three things a TestFlight cut needs afterwards. These
existed twice before as throwaway scratch files and were rewritten from
scratch both times — hence living in the repo now.

Requires `~/.appstoreconnect/private_keys/AuthKey_3TYJRGM968.p8`. That key must
be **Admin** role: the team has no local iOS Distribution certificate (cloud
signing only), and cloud signing from the CLI fails on App Manager keys.

```bash
cd foundry-app/scripts/asc

node find-build.mjs                  # recent builds + their states
node find-build.mjs 2.15.1           # just one version

node set-notes.mjs <buildId> notes.txt   # "What to Test", then reads it back
node push-external.mjs <buildId>         # external group + beta review
```

## Two traps these exist to avoid

**"What to Test" cannot be set at upload time.** Placing
`TestFlight/WhatToTest.en-US.txt` next to `-exportPath` is silently ignored by
`xcodebuild -exportArchive` when `destination` is `upload`. Builds 2.13.0 b2,
2.13.1 b1 and 2.14.0 b1 all shipped with empty notes that way. Set them through
the API once the build reaches `processingState: VALID`, and read them back — a
200 on the PATCH is not proof.

**Uploading only reaches internal testers.** The build must also be assigned to
the `Foundry_Testers` group and submitted for beta review. 2.14.0, 2.14.1 and
2.14.2 all sat at `externalBuildState: READY_FOR_BETA_SUBMISSION` while the
upload log and the internal install both looked fine. Treat a cut as incomplete
until that field reads `WAITING_FOR_BETA_REVIEW` or `IN_BETA_TESTING`.

`push-external.mjs` prints that state as its last line for exactly this reason.
