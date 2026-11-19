# mppredict85 (batch 85) track

Branch `batch85-mppredict85`, cut from release 0.113.0.

## Summary

1. **Multiplayer client now runs `sendUseItem`'s own `onItemRightClick` on its world.** New `src/client-item-use.js` (`clientUseItem`), wired in `main.js` `predictMultiplayerUse()`, called from the multiplayer branch of `edit()` only when the click swung nothing (`onPlayerRightClick` false) and aimed at no entity. It writes the client world with `world.put` + `scene.updateBlocks` (as S23 does) and the stack with `applyHeldPlan`.
   - Lily pad: pad above the traced source water at once, one taken unless Creative, no swing. `lily-use.js` gained `lilyPadCell` (shared with `useLilyPad`).
   - Buckets (empty and full): the existing executed `dryBucketUse` / `heldPlan` now also run on the multiplayer client.
   - Glass bottle: one taken from a traced water cell even in Creative (abl has no creative test; the server's `useGlassBottle` matches); a lone bottle becomes the water bottle, else the potion is given.
   - Boat: one taken (unless Creative) when the boat fits (dry `Boats.place` on a scratch instance, plus the client's entity copies); no entity is spawned.
   - Snowball, egg, ender pearl, exp bottle, splash potion: one taken unless Creative (the pearl returns early in Creative).
2. **Nothing on the client** (checked, nothing predicted): ender eye, spawn egg, fishing rod (swing only, already in `rightClickSwings`), bow / food / drinkable potion (use animation only, `client-use-predict.js`), written books (screen only).
3. **S2F**: `applySlots` writes the absolute stack, so a client change and the server's equal change never add up. If the server refuses, the client keeps its ghost count exactly as native does (the server sends no slot packet when its stack is unchanged).

## Evidence

- Bytecode-read (1.7.10 jar): `aej` (lily), `abo` (bucket), `abl` (glass bottle), `abj` (boat: spawn under `ahb.E`, decrement outside), `aco` / `aed` / `ack` / `acp` / `adp` (throwables: decrement unless creative, spawn under `ahb.E`; pearl returns first in creative), `acn` (eye: decrement and spawn both under `!isRemote`), `aee` (spawn egg returns at once on a client), `acv` (rod), `acl` (empty map, no guard), `ahb.a(yz,III)` = `iconst_1` (canMineBlock true on a client world).
- Port-read: `applySlots`, `ServerInventory`, `useGlassBottle`. Executed: none new (bucket rows reuse the b58 probe).

## Verification

- `node --test src/mppredict85-b85.test.js`: 7/7. Neighbours (39 files matching lily-use / client-prediction / right-click-swing / main.js source checks / mpplace / spswing, concurrency 1): 336/336.

## Follow-ups

- Empty map (acl): the client swaps in a filled map with an id from its own map counter, which S2F replaces; not predicted.
- Full inventory when a bucket or bottle gives an item: native drops an EntityItem client side; here the give is skipped (server's entity).
- Browser-only: the lily pad / bucket / boat feel, the hotbar flicker on a server refusal.
