# Chest/bed/icon fold and sleeping player render (2026-11-07)

## What changed
- a5d7ed5 folds in canonical `game/`'s uncommitted edits on top of 0.54.0:
  - chest item models and GUI icons (`src/chest-icon.js`);
  - the native Leave Bed GUI button and the bed-entry camera glide;
  - the multiplayer-paused main menu;
  - 17 handoff notes.
- 155a53a shows the sleeping player lying in bed, matching 1.7.10. This was read from the bytecode of RenderPlayer (bop), RenderGlobal (bma) and EntityRenderer.orientCamera (blt.h).
  - `sleepingTransform` in `src/player-renderer.js`:
    - feet at the entity position plus BedSleep.offset (1.8 toward the foot);
    - rotations: Ry(bK = 90/0/270/180), then Rz(90), then Ry(270);
    - drawn at y = posY - 0.2.
  - Visibility: the model shows in first person while sleeping, following RenderGlobal's isPlayerSleeping condition.
  - F5 skips the camera back-off while sleeping.
  - Bed eye position: posY + 0.12. orientCamera lifts 0.3, the yaw/pitch rotations cancel, then it translates by yOffset - 1.62 + 1 = -0.42. That leaves the eye just above the lying head, looking level toward the bed foot.
  - Not native:
    - the head is drawn straight (native keeps the frozen head yaw and pitch);
    - the bed-entry glide.
  - Documented in `public/research/bed.md`.
  - The dev-only `window.__mc` gains `useBed`, `bedSleep` and `playerRenderer`.

## Verification
- `npm test`: 4585 pass, 0 fail.
- `npm run build`: ok.
- Bridge unittest: OK.
- Muted headless Chrome (`?silent`, master volume 0), all four bed directions on :5261 and on :5179:
  - the body lies on its back with the head on the pillow;
  - the first-person bed view shows the face, body and legs.
- Screenshots and script: `artifacts/sleep-pose/`.

## Deployment
- github/main fast-forwarded 84aa037 → 155a53a.
- Canonical `game/`:
  - its folded dirty edits were discarded; backups are in `artifacts/fold-chest-bed/`;
  - fast-forwarded to 155a53a;
  - the running localhost:5179 Vite server (PID 70791) serves the new code without a restart.

## Follow-ups
- Head yaw and pitch while sleeping.
- No player shadow at the bed position.
- Remote players sleeping (multiplayer is paused).
