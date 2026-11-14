# Minecraft Java 1.7.10: animations and sounds

This update combines selected original media with newly implemented animation and gameplay code. It is still a partial recreation, not the original client running in a browser.

## Original media imported

- **135 original sound clips**, approximately 1.1 MB, selected for the implemented interactions: footsteps; material-specific digging and breaking; damage; swimming/splashing; eating/burping; item pickup; and pig, cow and zombie effects.
- **941 original PNG textures plus 13 animation metadata files**: the complete client texture tree, now including blocks, items, GUI sheets, colormaps, environment and entity art. Supported blocks, items and HUD elements use these files; importing a texture does not implement the associated feature. See [textures and farming](textures-and-farming.md). The fire sheet is retained for future work and is not currently rendered; daytime-burning zombies currently use damage/tint feedback.
- Original sound event definitions retain their variant selection, pitch, volume and weights where present. Not every 1.7.10 sound event or music track is included or wired up.
- Sound volume, mute and view-bobbing controls are available in Settings. Playback starts only after user interaction. Nearby mob sounds use approximate stereo positioning and distance attenuation.

The importer uses Mojang's exact version-specific asset index with SHA-1 `1863782e33ce7b584fc45b037325a1964e095d3e`. Each downloaded sound is checked against its indexed content hash. Textures are extracted unchanged from the client JAR with SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`.

Original Minecraft media remains © Mojang / Microsoft; it is not newly generated artwork or covered by the recreation's original code. The existing owner-private Site audience is preserved.

Machine-readable provenance: [sound manifest](../audio/1.7.10/manifest.json), [texture manifest](../media/1.7.10/provenance.json). `src/media.test.js` verifies every shipped file against those hashes.

## Recovered animation behavior

MCP mappings identify `bly` as ItemRenderer, `blt` as EntityRenderer, `bhm` as ModelBiped and `bhw` as ModelQuadruped. The stored bytecode listings expose:

| Behavior | Original evidence | Browser implementation |
| --- | --- | --- |
| Arm swing | `sv.j()` defaults to six ticks | A 0.3-second swing with the original half-cycle restart threshold; empty hands use the separate arm translations and 70° turn |
| Held-item swing | `bly.a(float)`: sine of progress squared; sine of square-root progress; translations −0.4, +0.2, −0.2 and rotations −20°, −20°, −80° | The original item matrix order, full translation amplitudes, 0.4 scale and sprite-local transforms now drive the rig; bare hands use their separate arc |
| Equip transition | `bly.a()`: per-tick change clamped to ±0.4 before changing the displayed stack | The previous item lowers before swapping and raising the new one |
| View bob | `blt.g(float)`: sine/cosine of walk distance × π, with translation 0.5 and rotation factors 3°/5° | Walking bob with an off switch; world/camera interpolation is approximate |
| Creature gait | `bhw.a(...)`: cosine of phase × 0.6662, multiplied by 1.4 and limb amplitude | Opposing leg pairs on the animal rigs and a related biped gait |
| Eating | `acx.d(ItemStack)` returns 32 ticks | Food is consumed after 1.6 seconds, with a hand/item eating motion and original effects |
| Block damage | Ten original `destroy_stage_0..9` PNGs | Frames advance with actual mining progress; cancellation removes the overlay |
| Water | Original 16 × 512 water sheet | The 32 original frames advance at 10 Hz, matching `frametime: 2`; fluid simulation: Batch 68 (docs sweep): implemented since this table was written (see `fluids.md`) |

Java's trigonometric lookup table and all floating-point intermediates are not emulated bit for bit. Model geometry, camera transforms, eating presentation and creature death presentation remain adaptations. These are recovered curves and original frames in a new renderer, not every animation copied exactly.

## Further gameplay added

Pigs and cows wander, react to hits and drop raw food. Zombies spawn near players at night, pursue and attack Survival players, and burn in daylight under an unobstructed sky. Entities and their health persist in saves. Legacy-style melee damage uses the selected weapon/material, wears tools and applies a brief target immunity period. Deaths have a short topple animation. Beef can be smelted to steak; gold pickaxes, axes, shovels and swords are now craftable.

Spawning, AI, collision, combat and loot are simplified. Cows now follow held wheat, breed, and produce calves. Pig breeding, full pathfinding, the rest of the mob roster, ranged combat, armor/enchantments/status effects, original entity networking and full fluid behavior remain unfinished. Rotten flesh currently restores its basic food values without the Hunger status effect. See [feature coverage](parity.md).

## Reproduce

```sh
node tools/investigate.mjs
node tools/import-vanilla-media.mjs
cd game
npm test
npm run build
```

Original class/JAR research inputs remain under ignored `tools/research`; original textures, selected sounds and their provenance are included in the private web build.

The 0.5 hand correction removes the added idle wobble, uses the original OpenGL post-multiplication order, restores full swing amplitude, and separates bare-arm, cube and extruded-sprite geometry. Equip motion lowers 0.6 units; eating uses the original 27th-power approach and cosine chew motion. A horizontal adjustment keeps the pose visible in narrow browser panels. See [UI, animation and XP notes](ui-animation-experience.md).
