# Oak saplings, tree growth, leaf decay and leaf drops (1.7.10)

Evidence: `javap -p -c` on the 1.7.10 client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`, names mapped
through `joined-1.7.10.srg`) and `tools/probes/TreeProbe.java`, which runs the unchanged original classes on a fake
`World` (allocated without constructors, like the snow and weather probes). `node tools/verify-trees.mjs` regenerates
`public/research/trees-reference.json`; `src/trees.test.js` replays it against `src/trees.js`.

Evidence kinds used below: **probe** = the original classes were executed and the browser port matches their output;
**bytecode** = transcribed from `javap` only, not executed (the original needs GameRules, a real chunk provider, or a
code path the probe does not reach).

## Original classes

| Obfuscated | Name | Used for |
| --- | --- | --- |
| `anj` | BlockSapling | `a(...)` updateTick, `c` mark (bit 8), `d` grow, `func_149852_a`/`149853_b` bone meal |
| `ajr` / `ajo` | BlockBush / IGrowable | `checkAndDropBlock`, `canBlockStay`, the bone-meal interface |
| `alt` / `aml` / `aod` | BlockLeaves / BlockOldLeaf / BlockLeavesBase | decay scan, breakBlock marks, drops |
| `alx` / `amm` | BlockLog / BlockOldLog | breakBlock marks within 4 |
| `asq` / `arc` / `arn` | WorldGenTrees / WorldGenAbstractTree / WorldGenerator | the oak generator |
| `ard` | WorldGenBigTree | the 1-in-10 big oak (live in 256-high worlds through `tree-growth.js`; see [wood types](wood-types.md)) |
| `acj` / `adg` | ItemDye / ItemLeaves | bone meal use, shears/leaf item |
| `aji` / `ajn` / `ahb` / `mt` | Block / Blocks / World / WorldServer | drop loop, registry, setBlock flags, random ticks |
| `apx` | Chunk | `func_150807_a` calls the old block's breakBlock when the id changes |

## Ported

- **Block 48, "Oak sapling"** (Minecraft id 6, meta 0). A crossed plant that blocks nothing, hardness 0, ticks randomly,
  drops itself. Placement needs `canPlaceOn` (grass, dirt, farmland; bytecode of `ajr.j`). There is no light rule in
  `canBlockStay` in this build.
- **WorldGenTrees (`asq.generate`)**, oak only: height `nextInt(3) + 4`, the build-area check with the 1 / 2 radius rule,
  ground check, leaf layers with the corner coin flip, trunk, replace rules (air, leaves, grass, dirt, logs, saplings).
  Probe: 264 fixture/seed rows (grass, dirt, farmland, sand, obstacles in the check area, ceilings, high base) match
  result, setBlock count, a digest of the ordered `setBlock` calls and the next `Random` value.
- **Sapling tick (`anj.a`)**: support loss drops the sapling (`checkAndDropBlock`), then, with block light of the cell
  above >= 9 and `nextInt(7) == 0`, the first hit sets bit 8 and the second grows. Growth clears the cell (flag 4),
  generates the tree, and puts the sapling back with `meta & 7` if it did not fit. Probe: 308 tick-by-tick runs of up to
  80 ticks (marks, grows, failures, support loss, light 8 and 9) match events, drops, resulting cells and the next
  `Random` value. The drop draws four floats (chance check and three position floats) as in `Block.dropBlockAsItemWithChance`.
- **Bone meal on a sapling**: `func_149852_a` (`canFertilize`, true) then `nextFloat() < 0.45`, then the same mark/grow
  step; the stack is used whether or not it worked. Probe: the first 40 rolls for seeds 0 to 199 and 120 apply-until-grown runs.
- **Leaf decay (`alt.a`)**: only for meta bit 8 without bit 4; a 9 x 9 x 9 scan (range 4) with logs 0, leaves -2, other
  -1 and four propagation passes; centre >= 0 keeps the leaf and clears bit 8, otherwise it drops items (fortune 0) and
  becomes air. Probe: a leaf-cube per metadata value and 32 trees with their logs removed, round by round.
- **breakBlock marks**: leaves mark leaf blocks within 1, logs within 4 (bit 8, flag 4). Probe: both cubes. The
  `Chunk.func_150807_a` call applies to any flag when the id changes (bytecode); `Trees.edit` calls it for world changes
  that are not already notifying.
- **Leaf drops**: `nextInt(20) == 0` (40 for jungle) sapling, then `nextInt(200) == 0` apple (oak only,
  meta & 3 == 0), three position floats per stack. Probe: 4000 calls on one `Random` (sapling 6, apple 260).
- **Random ticks**: 3 per chunk section per tick for sections that contain a randomly ticking block, cells from
  `lcg = lcg * 3 + 1013904223`, `j = lcg >> 2`, x = `j & 15`, z = `(j >> 8) & 15`, y = `(j >> 16) & 15` (bytecode of
  `WorldServer.func_147456_g`; the test checks the picks). Active chunks come from the weather module's player radius.
- **Items**: placed leaves carry bit 4 (no decay), shears give the leaves block, creative and survival lists include the sapling.
- **World generation version 7** (introduced tree generation; current new-world default is version 8): trees come from the ported generator with a per-tree `Random`
  at the same positions as before. Versions up to 6 are byte-identical to previous builds.

## Gaps (not parity)

- In legacy 64-high finite worlds (generation version < 11) the 1-in-10 `WorldGenBigTree` (`ard`) draw is still made but a
  normal oak is generated instead (reported as `"big"` in the events); 256-high and generation 11+ worlds grow every sapling type
  through `growSapling` in `tree-growth.js`, replayed by `sapling-types-reference.json` ([wood types](wood-types.md)).
- Weather/fluid/fire/tree updates share the restored world stream since 0.22.5, but initial seeding and full native tick order remain adapted. Native sequences match only for the stated Random/scenario, not for a Java world seed.
- Legacy finite worlds are 64 high; Java and streamed worlds use the original 256 build height.
- Meta writes on a cell that has become air after a drop are skipped.
- Old saves keep their hand-made trees; their leaves have no bit 4 and will decay once marked, as with natural leaves.
- Shears damage on leaves, silk touch and fortune on leaf drops, birch/spruce/jungle saplings and leaves are not modeled.
- Worldgen v7 does not apply the log/leaf breakBlock marks; v7 also moves flowers and tall grass indirectly because the
  new crowns occupy different cells.
- Sapling light is the browser's own light value, not the original chunk's light update queue.

## Shared world random and reloads (0.22.5)

The game injects the restored Weather World.rand into Trees, sharing it with fluid/fire/weather updates. Sapling rolls, oak growth, leaf drops and tree bone meal now consume that stream instead of an independent clock-seeded generator. The standalone tree generator/tests retain their explicitly seeded inputs. The standalone Trees.lcg is not used by the game’s shared Weather.tickChunk loop.

Original WorldServer call-site bytecode passes its world Random to random and scheduled Block.updateTick calls; existing native tree algorithm replays remain unchanged. A controlled 160-step port regression interleaves lava slowdown, weather draws, fire queues, sapling growth and leaf decay/drop checks, then reloads multiple times through the shared import payload; blocks, metadata, queues, effects/drops and random state match uninterrupted execution. This does not verify full native cross-system tick ordering, Java world RNG serialization or Java-seed terrain parity. Other random sources remain open, and upgrading changes future rolls from the previously independent streams while retaining saved terrain.
