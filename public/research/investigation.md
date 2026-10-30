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

The next investigation step used the published MCP SRG mapping archive to identify classes and methods, and the JDK's `javap -c -p` to inspect Java instructions. This is static inspection; the original game was not executed.

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

Available: creative building, gravity, jumping, flight, collision, water, inventory, world seeds, local saves, import/export, settings, and diagnostics.

Not available: survival, mobs, crafting, redstone, multiplayer, Java world files, the Java protocol, original world generation, or complete Java 1.7.10 behavior. This is a bounded creative prototype informed by a real artifact investigation, not a completed Minecraft port.

Reproduction commands and source are in the repository README and `tools/investigate.mjs`. Original downloaded inputs and raw REA evidence remain local, outside the published build.
