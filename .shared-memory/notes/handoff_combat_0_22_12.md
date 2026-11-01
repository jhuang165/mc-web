# 0.22.12 — PLAYER-01 mob hurt, death, rewards and pushing (claude-code, 2026-11-01)

Changed:
- New `src/combat.js`: armorReduced, soundVolume and soundPitch, mobDrops, experiencePoints, applyEntityCollision, boxesMeet.
- entities.js:
  - attackEntityFrom and damageEntity, onDeath (one drop event per item), deathUpdate (XP at death tick 20), dying, push, pushBox, pushable, setEntityRandom;
  - named damage sources;
  - the onEntityUpdate tick order;
  - the zombie and skeleton sun check on entityRandom;
  - the player's push.
- bow.js and main.js pass the attacker type and source names.
- New CombatProbe.java and verify-combat.mjs, which write combat-reference.json (1,113 records). combat.test.js replays all of them exactly.
- Docs: public/research/combat.md (new), difficulty.md (gap updated), parity.md, parity-roadmap.md (PLAYER-01 row and a 0.22.12 paragraph), README, PROJECT.md.

Tests: npm test 645/645; npm run build OK; git diff --check clean.

Browser check (port 5181, audio stubbed, scratch world):
- a cow dropped leather and beef;
- a sheep dropped wool and emitted an XP event of 2 at death tick 20;
- two stacked pigs pushed apart from 0.05 to 1.56 blocks;
- no console errors.

Open (PLAYER-01 stays Partial):
- looting;
- suffocation (inWall);
- mob-versus-mob revenge;
- chunk-order entity updates;
- Creative kills spawn no XP orbs: main.js handleEntityEvents gates on `!survival.creative`, but the original drops orbs in every mode;
- skeleton equipment is assumed to be a bow;
- records do not exist in this build;
- player-side damage sources.
