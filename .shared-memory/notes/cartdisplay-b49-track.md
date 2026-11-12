# cartdisplay b49 track

Branch `batch49-cartdisplay` from ac7027870 (0.77.0).

## Summary
- Custom display tile: the live cart carries the data watcher values (`dispRaw` = tile & 0xffff | data << 16, `dispOffset` default 6, `dispOn`), set through `setDisplayTile` / `setDisplayTileData` / `setDisplayTileOffset` in `src/cart-variants.js` (k, l, m of EntityMinecart, same order and side effects: each sets the flag). `object-tracker.js` metaValues now send 20-22 from them (were constant 0, 6, 0), so the copy's watcher carries them; `vehicleView` hands the renderer `display` {id, data, offset} (null when 22 is 0).
- `MinecartRenderer` draws the watched block when `display` is set (scale 0.75, translate offset / 16, renderBlockAsItem's 90 degree turn), replacing the type's own display; null leaves the existing per-type path. Cube/box geometry from the block atlas (as dropped blocks), chests (54, 130, 146) and the hopper (154) from their own models, air draws nothing; other render types (flowers, fluids) fall back to a cube (approximation).
- Persistence: `initVariant` / `variantJSON` / `variantNBT` carry CustomDisplayTile, DisplayTile, DisplayData, DisplayOffset; `/summon Minecart* {CustomDisplayTile:1b,...}` reads them (`cart-summon.js`). `minecarts.js` is untouched.
- TNT cart fuse: `tntIgnite` marks `igniteStatus`; the tracker sends S1A status 10 once (`observe`), the copy sets `fuse` 80 (`handleStatus`) and counts down in its tick (`fuse -1` at spawn; 0 stays, the explosion is under !isRemote). `vehicleView` lays `fuse` over the live cart, so `CartBlockRenderer.fuse` reads the copy. A cart primed before the copy existed (saved TNTFuse) stays at -1 on the client, as natively.
- Shadow: `SHADOWS.minecart` (size 0.5, opaque) and a main.js loop next to the boat's, from `vehicleViews` (height 0: `EntityMinecart.getShadowSize` is 0.0F).

## Evidence
- Executed (`tools/probes/CartDisplayProbe.java`, `tools/verify-cart-display.mjs` -> `public/research/cart-display-reference.json`, unchanged xl / xv on CartsProbe's world): the defaults of n/p/r/t and watchers 20-22 for types 0, 1, 2, 3, 5, 6; the k / l / m sequences (a data-only l keeps the default tile, k keeps the current data: furnace data 2 survives a chest id); the client TNT cart (isRemote): fuse -1, status 10 -> 80, 79... 0, stays 0, no explosion, smoke while above 0.
- Bytecode-read (`javap -c -p` on boi = RenderMinecart, xl, xv): RenderMinecart constructor shadowSize 0.5F; its draw uses n(), r(), p() and skips blocks whose render type is -1, scale 0.75 then translate (0, r / 16, 0); xl.Y() (getShadowSize) is 0.0F; NBT keys of xl.a(dh) / b(dh).
- Not confirmed: the on-screen look of a custom block cart (no browser smoke; geometry and texture helpers are those of dropped blocks and the existing chest/hopper cart models). The smoke particle of the client fuse is not spawned.

## Verification
- `node --test src/cart-display-b49.test.js` -> 8 pass, 0 fail.
- Targeted: `node --test src/object-tracker*.test.js src/vehicle-render-b48.test.js src/carts.test.js src/minecarts.test.js src/spawner-cart.test.js src/cart-*.test.js src/shadows*.test.js src/region-export*.test.js src/summon*.test.js` -> 176 pass, 0 fail. `node --check src/main.js`; `npm run build` ok. No full `npm test`.

## Follow-ups (proposed gap lines)
- Custom cart display of non-cube render types (flowers, fluids, doors, ...) is a plain cube; the client fuse's smoke particles are not spawned; the swell scales the whole cart model rather than only the block (existing).
- Aiming at carts still picks the live entity (b48 follow-up unchanged); the ridden cart is drawn live (no copy fuse/display then).
