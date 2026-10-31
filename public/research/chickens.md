# Chickens, eggs and chicken meat

Target: Minecraft Java 1.7.10. Names are the obfuscated classes of the unchanged client JAR (`tools/research/`, not shipped), read with `javap -c -p` against `joined-1.7.10.srg`. Full parity is not claimed.

## Sources

| Name | Obfuscated | Used for |
| --- | --- | --- |
| EntityChicken | `wg` | constructor, `aD` attributes, `e()` (`onLivingUpdate`), `b(F)` (fall), `b(ZI)` (`dropFewItems`), `c(add)` (breeding item), `a(rx)` (`createChild`), `t/aT/aU` sounds, `a(IIILaji;)` step |
| EntityAnimal, EntityAgeable | `wf`, `rx` | breeding, `c(I)` set age, `f()` isChild |
| EntityEgg, EntityThrowable | `zl`, `zk` | `zl.a(MovingObjectPosition)` `onImpact`; flight is `zk.h()` (already in `src/projectiles.js`) |
| ItemEgg | `ack` | right click spawns an `EntityEgg`, plays `random.bow` |
| ModelChicken, RenderChicken | `bhh`, `bng` | boxes, rotations, child layout, `handleRotationFloat` (`bng.a(wg, F)`), shadow 0.3 |
| Items | `ade` | `aK` egg, `G` feather, `bf` chicken, `bg` cooked chicken; `ade.N` seeds is the tempt item |

## Evidence

`node tools/verify-chicken.mjs` compiles `tools/probes/ChickenProbe.java` (on the `MobMoveProbe` world double: stone below y 0) and runs it on the original classes. It builds a real `new wg(world)`, empties its AI task lists and records `public/research/chicken-reference.json`:

- `facts`: size, `maxHealth` and speed attribute, the extremes of the first egg timer over 4000 constructions, `wingRotDelta`, age.
- `fall`: 80 ticks of `wg.e()` (drop from y 6, a `motionY = 0.42` hop after tick 40, landing): `onGround`, y, `motionY`, `bp` wingRotation, `bq` destPos, `br` oFlapSpeed, `bs` oFlap, `bt` wingRotDelta.
- `eggtimer`: six seeded `Entity.rand`, `bu = 1`: the `mob.chicken.plop` pitch, the dropped egg and the next timer. `child`: a -24000 chick ticks without laying.
- `drops`: `wg.b(ZI)` for 300 seeds, burning and not (feather stacks of 1 each, raw or cooked chicken).
- `hatch`: `zl.a` on a block for 4000 `Entity.rand` seeded `i * 2654435761` (consecutive small seeds never roll `nextInt(8) == 0`): chicks spawned (3510 none, 477 one, 13 four) and 8 `snowballpoof` particles every time, plus a chick sample (age -24000, egg position, yaw, pitch 0).

`src/chicken.test.js` (20 tests) replays the fall rows exactly (floats compared with `Math.fround`), the plop pitch and next timer from a Java `Random` port, all 4000 hatch rolls through `Projectiles.layEggs`, and checks the drops, breeding, items, spawn share and save behaviour. The inventory probe was extended with the new item ids (`tools/inventory-replay.mjs`, `MC_IDS`): smelting 365 to 366 and fuel values were re-verified against the original registry (61 cases, 0 mismatches).

## Ported

- EntityChicken: 0.3 x 0.7 (floats), 4 health, speed 0.25; AI speeds panic 1.4, mate 1.0, tempt 1.0, follow parent 1.1, wander 1.0. Wing fields, the 0.3 `destPos` step, `wingRotDelta` snapping to 1 in the air and decaying by 0.9, `wingRotation += 2 * wingRotDelta`, and the 0.6 damping of downward motion (slow fall). `fall(F)` does nothing, so there is no fall damage.
- Egg laying: `timeUntilNextEgg = nextInt(6000) + 6000` at construction (not saved, so a loaded chicken rolls again); adults count it down, at 0 play `mob.chicken.plop` (volume 1, pitch `(r - r) * 0.2 + 1`), drop one egg and roll again. Chicks do not count down.
- Drops: `nextInt(3)` feathers plus one raw chicken, cooked when burning; hurt and death both play `mob.chicken.hurt`; adult kills give animal XP like the other animals.
- Breeding: wheat seeds (id 309) tempt, feed and breed; the chick is a child (`-24000`) with the shared parent cooldown, hearts and XP.
- Thrown eggs: `ItemEgg` throws an `EntityEgg` through the existing `EntityThrowable` port (same launch, gravity 0.03, drag, block and mob sweep). A 0-damage hit; at impact `nextInt(8) == 0` hatches a chick, and `nextInt(32) == 0` among those makes it four, each a child at the egg's position and yaw; eight `snowballpoof` particles (the snowball icon, as in the original); the throw sound is `random.bow`. Eggs save and load with their kind. `GaussianRandom.nextInt` is `java.util.Random.nextInt(bound)`.
- Items (internal ids 316 to 319, mapped to Minecraft 344, 288, 365, 366 in the inventory and creative checks): egg, feather, raw chicken (food 2, saturation 0.3), cooked chicken (food 6, saturation 0.6) with their items-atlas icons. Furnace smelting raw to cooked chicken. Creative tab placement follows `creative-reference.json` (food and materials tabs, and the search tab).
- Model and render: `ModelChicken` boxes and pivots as in the bytecode (head, bill and chin at (0, 15, -4), body turned pi / 2, legs, wings at (+-4, 13, 0)), leg swing `cos(limbSwing * 0.6662) * 1.4 * amount`, wing rotateAngleZ = +-`(sin(flap) + 1) * flapSpeed` through `chickenFlap` with the `MathHelper` sine table, `chicken.png`, a chick draws its head, bill and chin at full size 5 down and 2 back while the rest is halved, shadow size 0.3.
- Spawning: fresh worlds seed passive mobs at the weights sheep 12, pig 10, chicken 10, cow 8.
- Sounds: `mob.chicken.say`, `hurt`, `step` and `plop` are imported through `tools/import-vanilla-media.mjs` (the regex now includes `chicken`) and appended to `public/audio/1.7.10/manifest.json`; the other manifest entries were left untouched.

## Missing

- Raw chicken's 30 percent Hunger effect (0 to 600 ticks of food poisoning): there are no status effects yet.
- Chicken jockeys (`bv` / `bZ`), the jockey's 10 XP, and the zombie-baby riding that creates them.
- `mob.chicken.step` is imported but unplayed: no mob has step sounds wired.
- Only wheat seeds exist, so pumpkin and melon seeds do not tempt or breed chickens (any `ItemSeeds` does in 1.7.10).
- Chicks drop nothing here, following the existing adult-only convention; 1.7.10's `dropFewItems` has no age check.
- Burning is not wired for chickens in the render and fire code, only for the cooked-meat drop test; no looting.
- Hatched chicks and bred chicks stop at the 40-mob cap.
- Simplified mob loop: no pathfinding or `EntityAILookIdle` / `WatchClosest`, no periodic spawning or despawning, chickens spawn only when a world is created.
- Egg splash particles in water, and eggs that hit a mob only apply 0 damage and knockback via the shared snowball hit.
- `public/research/sheep.md` still says chickens do not exist yet.
