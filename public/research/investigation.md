# Minecraft Java 1.7.10 → browser: investigation

Target requested: Minecraft Java 1.7.10. Investigation date: October 30, 2026.

## Artifact identity

- Client from Mojang's version metadata: https://launcher.mojang.com/v1/objects/e80d9b3bf5085002218d4be59e668bac718abbc6/client.jar
- Client size: 5,256,245 bytes.
- SHA-1, verified against the official manifest: `e80d9b3bf5085002218d4be59e668bac718abbc6`.
- SHA-256, independently reported by REA: `a4fc2284657544e0f4bcc964f927c2fda3e3a205178ed1d5d58883aaf9780cce`.
- Mapping source: https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp/1.7.10/mcp-1.7.10-srg.zip
- Analysis tool: https://github.com/morluto/rea, npm `rea-agents@6.8.0`.

## What REA actually did

`rea inspect-artifact minecraft-1.7.10.jar --detail summary --evidence_output rea-1.7.10-evidence.json --json`

REA recognized a ZIP/JAR and inventoried 2,848 file occurrences and 2,825 unique artifact nodes. It reported zero integrity contradictions. Full inventory evidence was retained locally. Its own limits explicitly state that container inspection does not establish runtime behavior. **REA did not decompile Java or automatically translate the client.**

Container evidence ID: `ev_d158c3b195b8a20e56b5d1e0bd446675a35bf3d015e5e876cf35369017128fd9`.

The next investigation step used the published MCP SRG mapping archive to identify classes and methods, and the JDK's `javap -c -p` to inspect Java instructions. The original game was not launched. A later isolated FoodStats probe executes one unchanged class with minimal dependency test doubles; see below.

## Located classes and methods

| Obfuscated symbol | Mapped identity |
| --- | --- |
| `sa` | `net.minecraft.entity.Entity` |
| `sv` | `net.minecraft.entity.EntityLivingBase` |
| `yz` | `net.minecraft.entity.player.EntityPlayer` |
| `sv.bj()V` | `func_70664_aZ`, jump |
| `sv.e(FF)V` | `func_70612_e`, moveEntityWithHeading |
| `sa.M`, `sa.N` | width and height fields |
| `sa.v`, `sa.w`, `sa.x` | horizontal X, vertical Y, horizontal Z velocity |

## Recovered behavior

| Finding | Bytecode evidence | Browser use |
| --- | --- | --- |
| Initial jump impulse `0.41999998688697815` | `sv.bj`, offset 1, double constant before writing `w` | Jump impulse; this is float32 `0.42` widened to double |
| Gravity `0.08` | `sv.e(FF)`, offset 703, subtract from `w` | Vertical velocity subtraction each grounded-world tick |
| Vertical drag `0.9800000190734863` | `sv.e(FF)`, offset 742, multiply `w` | Velocity recurrence after movement |
| Horizontal drag float32 `0.91` | `sv.e(FF)`, offsets 314, 360, 407, 453 | Air drag and ground slipperiness factor |
| Ground acceleration normalization float32 `0.16277136` | `sv.e(FF)`, offset 364, divide by friction cubed | Ground movement acceleration |
| Base width float32 `0.6`, height float32 `1.8` | `sa` constructor, offsets 41 and 47 | Simplified player collision box |
| Physics frequency `20.0` | `bao` (Minecraft) constructor, offset 9, passed to `bbr` (Timer) | Fixed 20 Hz controller |

The controller updates at 20 Hz and interpolates camera positions between ticks. The recovered airborne vertical recurrence is:

```text
positionY += velocityY
velocityY = (velocityY - 0.08) * 0.9800000190734863
```

Without obstacles or effects, a jump starting with the observed impulse reaches approximately 1.2522 blocks. A regression check verifies that result. This verifies the implemented recurrence, not equivalence of the entire game.

The original method also contains water, lava, ladders, effects, entity-specific conditions, and world-loading branches. Those branches were not fully reconstructed. The browser's flight, swimming, camera controls, collision resolution, and terrain generator are simplified new implementations. Java float rounding is preserved for selected constants, not every intermediate operation.

## Web implementation and limits

New code uses Three.js WebGL, chunked exposed-face meshes, a generated pixel atlas, seeded custom terrain, ray-selected mining and building, and localStorage edits. No Minecraft code, classes, sounds, or textures are redistributed.

Available: Creative and Survival modes, gravity, jumping, flight, collision, health, hunger, food, fall damage, drowning, death/respawn and recoverable item piles, shaped crafting, a fuel-driven furnace, tool tiers/durability, custom caves/ores, torches, a day/night cycle, local saves, import/export, settings, and diagnostics.

Not available: mobs, combat, farming, full block/item/recipe registries, redstone, multiplayer, Java world files, the Java protocol, original world generation, or complete Java 1.7.10 behavior. See [feature coverage](parity.md) for the complete gap list. Full Java 1.7.10 compatibility remains the target, not a claim of completion.

Reproduction commands and source are in the repository README and `tools/investigate.mjs`. Original downloaded inputs and raw REA evidence remain local, outside the published build.


## Survival and workstation investigation

The follow-on investigation identifies `zr` as FoodStats, `yz` as EntityPlayer, `apg` as TileEntityFurnace, `aqo` as WorldProvider, and `afe`/`afk`/`afl` as the crafting manager/tool/weapon recipe classes.

Observed FoodStats rules: initial food 20, saturation 5; exhaustion triggers a drain only when strictly greater than 4, consuming saturation before food. At food 18 or higher, natural regeneration heals one health point every 80 ticks and adds 3 exhaustion. Normal-difficulty starvation damages every 80 ticks and stops at one health point. Feeding adds `nutrition * saturationModifier * 2` saturation, capped at the resulting food level. Player jump exhaustion is 0.8 when sprinting and 0.2 otherwise.

The original furnace increments its cooking counter to 200 before producing output. Coal provides 1,600 burning ticks, wooden blocks 300, and sticks 100. WorldProvider uses time modulo 24,000 for the day cycle. The tool recipe constructor contains pickaxe, shovel, axe and hoe patterns; this build implements the first three plus swords. Hoes and gold tools are still missing.

### Original-bytecode comparison

`node tools/verify-food-stats.mjs` verifies the JAR SHA-1, compiles our small player/world test doubles, extracts the unchanged `zr.class` into an ignored probe directory, and executes FoodStats against those dependencies. It does not launch or modify the signed game JAR. Seven scenarios cover initial state, exhaustion exactly at and just above the boundary, apple nutrition/saturation, regeneration at 79 and 80 ticks, and Normal starvation. The JavaScript implementation passes all 28 numeric comparisons within 1e-6.

[Reference results and exact class SHA-256](foodstats-reference.json) are included as data, with no original class or source in the published app. These results validate only the isolated scenarios; they do not establish full game parity.

`node tools/extract-registry.mjs` extracts all 171 base block ID/name registrations from the original Block registration bytecode. [Registry data](block-registry-1.7.10.json) supports a concrete content backlog. Metadata variants and block-specific behavior are not covered by that inventory.
