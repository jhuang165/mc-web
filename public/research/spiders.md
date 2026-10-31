# Spiders — Minecraft Java 1.7.10

Version 0.18 adds ordinary spiders and a Survival source of string. `src/spider.js` contains the original attack, drop and leg-animation rules; `src/entities.js` integrates spawning, navigation, collision, combat and saves.

## Behavior

- `EntitySpider` (`yn`) is 1.4 × 0.9 (Java floats), with 16 health, movement attribute 0.8 and attack damage 2. It uses legacy `EntityCreature` AI, rather than the task lists of zombies/skeletons. Its ground acceleration is `0.1 * 0.16277136 / friction³`, its movement input is the 0.8 attribute, and its water acceleration is 0.02 (modern AI mobs use 0.04).
- It acquires a player within 16 blocks only when brightness is strictly below 0.5. At brightness strictly above 0.5, each visible-target attack update has a 1-in-100 chance to forget the target. At exactly 0.5 it neither acquires nor randomly forgets. Hitting a spider provokes it in daylight. Creative players are ignored. Sunlight does not burn spiders.
- At distance strictly between 2 and 6, a 1-in-10 roll requests a leap. The roll precedes the on-ground test. A grounded leap sets horizontal motion to normalized direction × 0.5 × `(double)0.8f` plus old motion × `(double)0.2f`, and vertical motion to `(double)0.4f`. Otherwise, distance below 2 and overlapping vertical boxes permits melee with a 20-tick cooldown.
- Horizontal collision sets the climbing flag after movement. On the next land movement, `isOnLadder` clamps horizontal velocity to ±`0.15f`, downward velocity to −0.15 and clears fall distance; another horizontal collision sets vertical velocity to 0.2 before gravity 0.08 and drag 0.98. This lets spiders climb solid walls. Water/lava use their separate movement branches.
- Ordinary drops: `nextInt(3)` string (0–2). A recent player hit also permits one spider eye when `nextInt(3) == 0 || nextInt(looting + 1) > 0`. The drop helper supports the original looting argument, although enchantments are unavailable. Kills use the existing 5-XP hostile reward path. Environmental kills cannot produce eyes without a recent player hit.
- The eye (internal item 326, original 375) restores 2 hunger with saturation modifier 0.8 and always applies Poison I for 100 ticks after a successful 32-tick eat. Its creative placement is Foodstuffs; the search list retains original registry order. Four string in a 2×2 square craft white wool in either crafting grid.

## Model and media

`ModelSpider` (`big`) supplies the head, middle body, rear body and eight 16×2×2 legs, with the original boxes and pivots at 1/16 scale. `spiderLegs` reproduces all eight Y/Z rotations with MathHelper's sine table and Java float operations; interpolation uses the existing mob renderer. `RenderSpider` (`bov`) supplies a shadow size of 1 and a 180° death roll. The original head eye texture is drawn with an additive unlit pass; the rest uses entity lighting. Nine original spider sound clips were imported and SHA-1 verified against the official asset index; say, hurt (the say event), death and step events are connected. Steps use volume 0.15 and the existing movement-distance cadence.

## Evidence

`node tools/verify-spiders.mjs` runs `tools/probes/SpiderProbe.java` against the unchanged client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`). [spider-reference.json](spider-reference.json) includes class hashes and 5,602 records:

- Constructor attributes and Poison immunity, plus eye food values.
- 600 seeded original drop rolls, with and without a player hit.
- 4,800 seeded attacks spanning brightness 0.49/0.5/0.51/1, range boundaries and grounded/airborne states.
- 40 original model poses (all eight legs).
- 120 original movement steps with a floor and a six-block wall.
- 40 original legacy swimming steps.

The probe's subclass supplies brightness and intercepts outgoing damage; it inherits the original attack/drop methods. Its world double supplies collision boxes and captures spawned item entities. Model angle methods run without rendering. The attack fixtures intentionally vary the supplied distance independently of the target coordinates to isolate branch boundaries.

`src/spider.test.js` replays these records and covers world integration, contact damage/cooldown, step events, daylight provocation, Creative immunity, night spawning, persistence, XP, eye eating and wool crafting. The food-effects probe now contains 117 cases (eight new original eye-effect threshold records). The inventory probe now contains 63 cases, including shift-crafting wool and workbench offsets, with zero mismatches. Muted browser checks confirmed the model/eyes, combat XP, eye consumption and Poison, milk returning a bucket, and a saved spider restored after reload, with no browser warnings/errors.

## Remaining differences

Full parity is unfinished. Spawn timing still uses the finite world's night clock, cap of three spiders and a grass-surface ring 24 blocks from the player, rather than the original general mob spawning pass. Legacy path refresh, wandering, look/body helper timing and despawning are adapted to the existing bounded navigator; the entire `EntityCreature.updateEntityActionState` has not been ported or probe-replayed. Climbing steering toward the target supplements paths that stop at a wall. Mob collision and damage resistance retain the existing simplifications. The eye pass is unlit rather than the original fixed-function lightmap value 61680. Spider jockeys, cave spiders, Hard-difficulty spawn effects, webs/web immunity interactions, mob potion delivery and enchantments remain unimplemented. The probe confirms native spider Poison immunity; there is no general mob status-effect system to apply it in yet.
