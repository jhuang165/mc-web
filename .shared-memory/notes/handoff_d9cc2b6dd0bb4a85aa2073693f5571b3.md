Saddled pigs, riding and the carrot on a stick (commit 7df6f34, pushed to github main). Rules in src/pig-saddle.js are replayed from PigSaddleProbe (public/research/pig-saddle-reference.json; it runs the unchanged wo/ub/adt/abp classes). The live wiring is src/pig-saddle-live.js:
- saddle use and hit (the hit uses the saddle up in Creative)
- the pig mount through the horse-live.js seat, with the pig offset
- the stick boost and the AI's stick wear, so a broken stick becomes a fishing rod
Other changes:
- ai.js: the native pig task list, with ControlledByPlayer at priority 2, mutex 7.
- entities.js: moveWith(); a ridden pig's fall is passed to the rider.
- Saddle drop, /summon Saddle NBT, region export Saddle.
- Item 2100 (original 398), plus its recipe.
- The ModelPig(0.5F) saddle layer in mob-renderer.js.
- GuiIngame mount hearts replace the food row; a cart or boat shows no food row; air bubbles follow the armour lift.
- The jump bar shows for any ridden horse (isRidingHorse).
Docs: pig-saddle.md, horse-gear.md, parity.md, PROJECT.md.
Tests: npm test 3091/3091 pass, and npm run build passes. The village-live iron golem test failed once under full-suite load, then passed on rerun and alone.
Browser check (localhost:5180, audio stubbed): the mount hearts, the saddle layer and riding all work, with a clean console.
Gaps:
- no flyPig achievement
- the rider's fall skips Jump Boost and the fall sounds
- region import has no farm-animal path
- the saddled-pig lightning case was not probed
- not pixel-compared with the original client