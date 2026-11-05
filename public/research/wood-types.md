# Wood types: live saplings 0-5, big oaks, logs and leaves (1.7.10)

Evidence: `tools/probes/SaplingTypesProbe.java` (on top of `TreeProbe`'s fake World) runs the unchanged 1.7.10
`BlockSapling.func_149878_d` (`anj.d`), `BlockOldLeaf`/`BlockNewLeaf` drops and the real tree generators.
`node tools/verify-sapling-types.mjs` (with `MC_RESEARCH` set) writes `sapling-types-reference.json`;
`src/sapling-types.test.js` replays it through `Trees.growTree` and the harvest code.

## Native replay (probe)

- **Growth, 1296 rows**: six sapling types x four soils/ceilings (grass, dirt, sand, a stone roof) x 12 layouts (single,
  2x2 with the clicked sapling in each of the four corners, two L shapes, a 2x2 with one foreign sapling, a 2x3 block) x
  6 seeds. Every row matches the original on the digest of all changed cells (including the leaf decay-check bits the
  log writes leave on neighbouring leaves) and on the next `Random` int. This covers the 1-in-10 `WorldGenBigTree` oak
  roll, spruce (`WorldGenTaiga2` or the 2x2 `WorldGenMegaPineTree`), birch (`WorldGenForest`), jungle (`WorldGenTrees`
  with `4 + nextInt(7)` height, vines and cocoa, or the 2x2 `WorldGenMegaJungle`), acacia (`WorldGenSavannaTree`), dark oak
  (`WorldGenCanopyTree`, 2x2 only, otherwise nothing happens and the sapling stays) and the restore of every sapling when
  the tree does not fit. The code is `src/tree-growth.js` (`growSapling`), which reuses the native-replayed generators.
- **Leaf drops, 40 rows x 3000 calls**: `BlockOldLeaf` (18) and `BlockNewLeaf` (161), metadata 0-3 and 12, fortune 0-3.
  Sapling item damage is `meta & 3` (+4 for block 161), chance 1/20 (jungle 1/40), minus `2 << fortune` (floor 10);
  apples only from oak (18, type 0) and dark oak (161, type 1) at 1/200 minus `10 << fortune` (floor 40). Matched by
  `harvestBlock` (fortune) and `leafDrops` (fortune 0, the leaf decay path).

## Bytecode only (no probe)

- `BlockRotatedPillar.func_149660_a` (`ang.a`, inherited by BlockLog and BlockNewLog): placing a log gives
  `(damage & 3) | axis`, axis 0 for the top/bottom face, 8 for north/south, 4 for west/east. `src/wood-types.js`; the
  placement code now uses it (logs were always placed upright before). Orientation textures already existed.
- Creative middle-click now copies the wood type (`getDamageValue`: logs and leaves `meta & 3`, planks, saplings `meta & 7`);
  the held-item model gets the same damage.

## Already present before this track (verified, not changed)

Item ids 4/70 (logs), 5/71 (leaves), 7 (planks), 48 (sapling) with damage variants in the Creative listing in native order,
original textures including the spruce/birch foliage tints, damage-to-metadata placement, leaf decay across all log
types, sapling drops carrying their type, shears keeping the leaf type.

## Remaining differences

- Legacy 64-high finite worlds (generation version < 11, height < 256) keep the old oak stand-in for the big-oak roll
  (a 256-high Java world uses the real `WorldGenBigTree`); other types grow there truncated at height 64.
- The browser's sapling light is its own light value, not the original chunk light queue (see trees.md).
- The probe uses a flat synthetic world; real terrain neighbours (water, slopes) are only covered by the generator replays.
- Log placement orientation is bytecode-transcribed, not executed. Dispensers/pistons do not place logs.
- Full parity is not claimed.
