# dragonfx b51 track

Branch `batch51-dragonfx` from 119a6db93.

## Summary
- Beam texture scroll: RenderDragon.func_110827_a (bnl.a(xa, D, D, D, F, F)) reads the DRAGON's `ticksExisted` (`xa.aa`) + partialTicks for the V offset (`-ticks * 0.01`). The crystal's `wz.a` (innerRotation) only feeds the bob (`sin(t * 0.2)`). The port used the crystal's `age`; `beamTicks(cd, e, partial)` in `dragon-renderer.js` now uses the rendered dragon copy's `age` (else the live `ticksExisted`).
- Crystal End fire: EntityEnderCrystal.onUpdate (wz.h) has NO `isRemote` guard. It also writes data watcher 8 and tests `block != Blocks.fire` (not "is air"), in a WorldProviderEnd (`aqr`), so the existing `crystalTick` rule is right and the client copy natively does the same setBlock on the CLIENT world. NOT mirrored: the port has no client block layer (blocks are one shared world), so a copy's setBlock would write the server world. The visible native effect is only a client-only fire at the crystal's cell in the late-destroy tick after the server crystal exploded.
- Display tint: renderBlockAsItem (blm.a(aji, meta, brightness)) with useInventoryTint multiplies by `Block.getRenderColor(meta)` (`aji.i(int)`, grass block forced white). BlockTallGrass (anz.i): meta 0 white, else ColorizerGrass.getGrassColor(0.5, 1.0) (aha.a). `displayTint(id, meta)` in `cart-display-shape.js` gives that colour (same as the inventory icon, `itemGrassColor`) to the flat display material in `MinecartRenderer.buildCustom`.

## Evidence
- Bytecode-read (`javap -c -p` on bnl, wz, anz, blm). Nothing executed: a getRenderColor probe would only return the colormap pixel the port already replays (`biome-colors-reference.json`).
- Not covered: leaves (render type 0, "item" path) also take `getRenderColor` (foliage 0x48B518 / pine / birch) on a cart display block; not applied. No screenshot smoke taken.

## Verification
- `node --test src/dragonfx-b51.test.js src/cart-render2-b50.test.js src/dragon-renderer.test.js src/biome-colors.test.js src/dragon-client-b49.test.js` -> 22 pass, 0 fail. No full npm test.

## Follow-ups (proposed gap lines)
- The crystal copy's End fire needs a client block layer (not modelled); leaves' display tint on a cart missing; beam and tint unseen in a browser.
