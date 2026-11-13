# Batch 56 track: horsepose

## Summary
- The horse is drawn from ModelHorse.setLivingAnimations (`bhs.a`), ported in `src/horse-model.js` and bit-exact (Math.fround at every op, MathHelper sin/cos from lighting.js). `src/horse-renderer.js` applies the pose through a per-part pivot hierarchy: head/neck lean, rearing, mouth, front/back legs while rearing, tail swing, saddle/rein angles.
- The ridden horse (client copy) is drawn from `c.horse` (batch 54/55 counters); other horses from their own `e.horseAnim`. The preview (`horse-preview.js`) calls the same `custom`.
- Foal/render group scales and translations (ModelHorse.render), and donkey 0.87 / mule 0.92 (RenderHorse.preRenderCallback) are applied; `mob-renderer.js` skips its own 0.5 baby scale for rigs with `ownGrowth`.
- The tail roll nextInt(200) is now drawn on the horse copy's own Random (`c.rand`, made lazily by `copyRandom` in horse-copy.js; `stepHorseCopy`), and on the live horse (entities.js sets `e.horseAnim.tail = 1` from the existing draw).
- Eating flag 32 stoppers ported in horse-live.js: rearing (p(true) -> o(false)) and mounting (i(yz) -> o(false), p(false)).

## Evidence
Executed (tools/probes/HorseModelProbe.java, tools/verify-horse-model.mjs -> public/research/horse-model-reference.json):
- 240 deterministic rows: one persistent ModelHorse, random type/saddled/chested/rider/age/yaw/pitch/ticksExisted/partial/swing/amount/counters; all 39 parts' c d e f g h after the call.
- `tail`: real wi.h() on a client world double with a logging Random, 600 ticks, seed 2 (3 hits of 200:0). Per tick the draws are 1000 (living sound) then 200 (tail roll); bp goes 2..8 then 0 on the hit tick onward.
Bytecode-read only: ModelHorse.render group transforms (ci, 0.5+ci*0.5, head translate by prevHeadLean), which parts are visible, donkey/mule scale, `bq` never started (referenced only in wi.h()), eating stoppers (p(true), i(yz), 50-tick counter).

## Verification
- `node --test src/horse*.test.js src/entities.test.js src/entity-tracker.test.js src/tracker-mounts.test.js src/cave-spider.test.js src/mob-equipment.test.js src/models.test.js src/villager.test.js`: 329 pass, 0 fail.
- `npm run build`: ok. Full `npm test` not run; no browser check.

## Follow-ups
- The copy's Random lacks Entity.onEntityUpdate's living-sound nextInt(1000) draw, so its stream is a subset of Java's (the real stream is unseeded, so unobservable).
- Metadata delay for flags is not modelled.
- The eating stop on falling > 6 (o(F), caller unattributed) is not ported; no unit test for the rear/mount eating stoppers.
- Render transforms are not checked visually.
