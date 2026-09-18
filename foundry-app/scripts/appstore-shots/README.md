# App Store screenshots

Regenerates the 12 captioned App Store images for iPhone 6.9" (1320×2868) and
iPad 13" (2064×2752) from the running dev server.

```bash
cd foundry-app && npm run dev -- --port 3000 --host 127.0.0.1   # in another shell
cd scripts/appstore-shots
node shots.mjs raw iphone && node shots.mjs raw ipad      # raw app screens (seeded example lifter "Alex")
node compose.mjs raw final                                # captions + frame at exact store sizes
```

- `shots.mjs` seeds localStorage with a curated upper/lower program and history, then drives
  each scene. The coach-tuned scene mocks the coach worker response (the real endpoint isn't
  reachable from a dev machine). The review scene seeds `Math.random` (`SEED`, default 7)
  so the generated program is repeatable.
- Captions and upload order live in `compose.mjs` (`SCREENS`).
- Apple allows **max 10 screenshots per device** — trim before upload.
- Uses system Chrome via `playwright-core`; output PNGs are not committed.
