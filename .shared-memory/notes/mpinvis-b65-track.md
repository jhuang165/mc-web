# Batch 65 mpinvis: other players' invisibility and name tags

## Summary
- `src/multiplayer/simulation.js` `presence()`: adds `invisible: true` (entity flag 0 bit 5) while the player has Invisibility (effect 14). No new wire message; it rides the existing player list.
- `src/player-renderer.js`: the body material gets a `fade` alpha factor. `update({ invisible, ghost })`: invisible hides the body; invisible plus `ghost` draws it at alpha 0.15, no depth write, alpha test 1/255. Single player (own body, paper doll, mobs) keeps `ghost` false, so nothing changes there. `mob-renderer.js` untouched.
- `src/multiplayer/remote-labels.js`: pure rules `invisibleToViewer`, `tagPlan`, `tagHeights`, and `paintTagRow` (dim and bright passes). `drawScoreLabel` is gone.
- `src/multiplayer/presence.js`: each name tag is now two sprites per row (dim pass without depth test, bright pass depth-tested) for the name and for the belowName row. `placeTags` runs per frame from the viewer's own entry (`this.me`, taken from the player list). Ghost is `invisible && !invisibleToViewer`.
- `src/mpinvis-b65.test.js`: 7 tests.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `boh.a` (renderModel): not invisible draws; invisible and `!isInvisibleToPlayer` draws with glColor4f(1,1,1,0.15), depthMask false, blend 770/771, alpha func 1/255; otherwise only setRotationAngles. `sa.d(yz)` (Entity.isInvisibleToPlayer) returns isInvisible; `yz.d(yz)`: false if not invisible; false if viewer has the same team and `seeFriendlyInvisibles`; else true. `boh.b(sv)` (func_110813_b): GUI enabled, not the viewer, not invisible to the viewer, no rider. `boh.b(sv,DDD)` (passSpecialRender): sneaking max 32 blocks (distance squared), else 64; sneaking branch: translate y + height + 0.5, then 0.25 lower, depth test left on, background alpha 0.25, text 553648127 (0x20FFFFFF) only. Standing branch (`bno.a`, func_147906_a): depth test off with background alpha 0.25 and the 0x20FFFFFF text, then depth test on and text in -1. `bbu.b(String,int,int,int)` = drawString with shadow false, so the tag text is unshadowed. `bop.a` (func_96449_a): belowName only when distance squared < 100 and slot 2 has an objective; drawn through func_147906_a at the usual spot (or 1.5 lower when sleeping), then y rises by fontHeight * 1.15 * scale and the name draws above. `bop` (RenderPlayer) lowers a sneaking non-local model by 0.125 and does not draw the cape when invisible.
- Armour and held items: `bop.a` draws them from `shouldRenderPass`/`renderEquippedItems`, and `boh.a` (the invisible check) wraps only the main model call, so they still draw for an invisible player (also what the single player code already assumed). Bytecode-read of the call structure; not executed.
- Executed: none. No Java probe: the render calls need an OpenGL context. Server flag and the plan rules are replayed by node tests.
- Recalled: the sprite row spacing (`TAG_ROW`) is the native 1.15 line spacing applied to this port's sprite height, not the native pixel size.

## Verification
- `node --test src/mpinvis-b65.test.js`: 7 pass. `src/mpscoreboard-b64.test.js`: 11 pass. `player-renderer`, `mp-dig-b57`, `mpeating-b58`, `heldrender-b63`, `babyrender-b64`, `multiplayer`, `mpstate-b59`: 26, 8, 5, 3, 22, 5, 12 pass.
- `node --check` on every touched file. `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser shows: the 0.15 alpha look (blend order against other transparent sprites), dim and bright tag passes, sneaking tag position and the lowered score row.
- The tag has no GUI-hidden (F1) check and no rider check in the client: `riddenBy` is supported by `tagPlan` but presence does not pass it (players cannot be ridden here).
- Tag size stays the port's canvas size, not the native font scale; the sneak `-0.125` is applied to the tag only (the model's own sneak offset is in the pose code).
- Mobs in multiplayer (`remote-mobs.js`) are not given team or invisibility flags from the server; single player mobs unchanged.
