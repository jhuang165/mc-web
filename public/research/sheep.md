# Sheep, shearing and wool

Target: Minecraft Java 1.7.10. Names are the obfuscated classes of the unchanged client JAR (`tools/research/`, not shipped). Full parity is not claimed.

## Evidence

`node tools/verify-sheep.mjs` runs `tools/probes/SheepProbe.java` on the original classes and records `public/research/sheep-reference.json`: `EntitySheep.fleeceColorTable` (`wp.bp`), 2,000 colour rolls of `func_70895_a(Random)` (`wp.a`) from `java.util.Random(42)`, and the child colour for all 256 parent pairs, taken from `CraftingManager.findMatchingRecipe` on a 2 x 1 grid of dyes exactly as `func_90014_a` builds it. `src/sheep.test.js` replays the rolls with a Java `Random` port and checks all 256 mixes.

## Ported

- EntitySheep (`wp`): 0.9 x 1.3, 8 health, speed `(double)0.23f`; AI speeds panic 1.25, mate 1.0, tempt 1.1 (wheat `ade.O`), follow parent 1.1, wander 1.0; say, hurt and death all play `mob.sheep.say`, steps `mob.sheep.step`. Fleece colour is the low four bits of datawatcher byte 16, `sheared` is bit 16. Natural colour: 5% black, 5% grey, 5% light grey, 3% brown, then 1 in 500 pink, else white.
- Shearing (`wp.a(yz)`): shears (`ade.aZ`) on an unsheared adult set `sheared`, drop 1 to 3 wool of the fleece colour 1.0 up with `motionY += rand * 0.05` and `motionX/Z += (rand - rand) * 0.1`, play `mob.sheep.shear` and cost the shears 1 durability (not in Creative). Lambs cannot be sheared. A killed unsheared sheep drops 1 wool of its colour (`wp.b`); there is no mutton in 1.7.10.
- EntityAIEatGrass (`ud`, mutex 7): evaluated every third tick, 1 in 1000 (1 in 50 for a lamb) with tall grass at the feet or grass below; 40-tick timer, at 4 the tall grass is removed without a drop or the grass block becomes dirt (level event 2001), then `eatGrassBonus` (`wp.p`) clears `sheared` and ages a lamb by 60 seconds. Swimming, panic, mating, tempting and following a parent interrupt it.
- Head animation: `func_70894_j` (`wp.p(F)`) drops the head pivot by `9 * value` and `func_70890_k` (`wp.q(F)`) sets the pitch, exactly as in the bytecode. Lambs use ModelQuadruped's child layout (head 8 down, 4 back at full size, body halved).
- Breeding with wheat creates a lamb whose colour is the dye mix of the parents, else a random parent. Fresh worlds seed sheep, pigs and cows at the passive spawn weights 12 : 10 : 10 : 8 for sheep, pigs, chickens and cows ([chickens](chickens.md)). Colour, shear state and the herd persist in saves.
- Renderer: `ModelSheep2` (`bhy`, `sheep.png`) plus the fur pass `ModelSheep1` (`bhx`, `sheep_fur.png`) with the model's own box coordinates, inflated 0.6 / 1.75 / 0.5, tinted by the fleece table and hidden once sheared; shadow size 0.7.
- Wool: the existing id 19 block now carries metadata 0 to 15 (`BlockColored`, `wool_colored_<dye name>`). Stacks keep the colour as damage; it merges, picks (middle click), places, breaks (`damageDropped`), appears in the 16 creative entries in `creative-reference.json` order, in the search tab, in held, dropped and chunk meshes, and in tooltips.

## Gaps

- No dyes yet, so sheep cannot be recoloured and the dye recipes themselves are not craftable; only the mix table exists. The `jeb_` sheep name is ignored.
- Wool is not yet a crafting input or output (beds, carpets, paintings).
- Sheep AI follows the existing simplified mob loop (no pathfinding, head turning limits, or per-task tick rates other than eat grass's third-tick check). Sheep spawn only when a world is created, with no despawn or periodic spawning.
- The wool block-break particles use the registry block colour rather than the metadata colour.
