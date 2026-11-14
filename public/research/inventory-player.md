# Live player in the inventory (GuiInventory.func_147046_a)

Added in 0.42.0 by `src/inventory-player.js`. Parity is not claimed.

## Native-verified (javap of bfu / bfl, `tools/verify-inventory-player.mjs`, `public/research/inventory-player-reference.json`)
- GuiInventory.func_146976_a (bfu.a(FII)V) calls `func_147046_a(guiLeft + 51, guiTop + 75, 30, guiLeft + 51 - mouseX, guiTop + 75 - 50 - mouseY, thePlayer)`. The creative inventory tab (bfl.a(FII)V, tab "inventory") calls it with `guiLeft + 43, guiTop + 45, 20, guiLeft + 43 - mouseX, guiTop + 45 - 30 - mouseY`.
- func_147046_a: translate(x, y, 50), scale(-s, s, s), rotate 180 about z, rotate 135 / RenderHelper.enableStandardItemLighting / rotate -135 about y, rotate `-atan(my/40) * 20` about x, translate(0, yOffset, 0), then RenderManager.renderEntityWithPosYaw(entity, 0, 0, 0, 0, 1) with playerViewY = 180. The entity's fields are overwritten for the call and restored: renderYawOffset = atan(mx/40) * 20, rotationYaw = atan(mx/40) * 40, rotationPitch = -atan(my/40) * 20, rotationYawHead and its previous value = rotationYaw. mouseX/Y are the integer GUI-pixel coordinates; the float math was run in a JVM for offsets -400..400 (801 rows replayed by `src/inventory-player.test.js`).
- Partial tick 1 means no interpolation: limb swing, the attack swing, the hurt tint, the held item and armour layers come from the current state.

## Implemented as
- A private WebGL canvas (`.paperdoll-canvas`) that covers the GUI (176 x 166 or 195 x 136 GUI pixels) at any GUI scale, drawn once per frame while the survival inventory or the creative "Survival Inventory" tab is open (also while an item is on the cursor). It reuses `PlayerRenderer` (skin, armour layers, held item with enchant glint, hurt tint, sneak, swing, invisibility), so the third-person view and the GUI show the same model.
- The orthographic camera and matrix chain mirror the GL calls above; the two item lights are the RenderHelper directions run through the same matrices (mirror included); there is no lightmap and no fog, as in the GUI.

## Approximated or missing
- Fire on the player now uses the alternating, narrowing Render.renderEntityOnFire quad stack and original animated textures (0.43.0). GUI billboard yaw is 180 independently of the mouse-driven body yaw. Geometry/constants are bytecode-derived; browser lighting/depth/animation timing is approximate.
- Batch 69 (docs sweep): `shadows.js` has a `player` shadow entry (size 0.5, opaque 1) for the world view; the GUI preview shadow was not re-checked. Older text: entity shadow from doRenderShadowAndFire: not drawn.
- Stuck arrows, player fire and worn-armour enchant glint draw in both inventory views and third person. GUI shadow and cape remain missing.
- Cape / deadmau5 ears remain absent. Armour glint uses native tint, 1/3 texture scale, ±30 degree passes and age-based scrolling (0.02/0.08 per tick before the 1/3 scale); browser UV/depth composition is approximate.
- Hurt tint brightness uses the real player's world light as in RendererLivingEntity; depth precision, texture filtering and the canvas clip to the GUI rectangle (native draws over the whole screen) are not replayed exactly.
- Mouse X/Y use the last pointer position over the modal; before the first move it is the window centre.


## Stuck arrows (native-verified)

- Evidence: `tools/verify-stuck-arrows.mjs` runs the real ModelBiped and ModelBase.getRandomModelBox through `tools/probes/StuckArrowProbe.java` (9 entity ids x 12 arrows) and javap-checks the counter rules; output `public/research/stuck-arrows-reference.json`, replayed by `src/stuck-arrows.test.js`.
- Count: EntityLivingBase DataWatcher byte 9, not in NBT (not saved). EntityArrow increments it on a landed hit on a living entity (byte wrap); onUpdate decays it: timer = 20 * (30 - count), one arrow drops when it runs out. Port: `survival.arrowCount`/`arrowHitTimer`, `bow.js` damageTarget, reset on death.
- Render: Random(entityId), random ModelBox, point inside the box, yaw/pitch from atan2, drawn unlit through the part pivot, using the flying-arrow model and texture.
- Limits: the player now receives a nonzero runtime id for each lifetime rather than hard-coding 0; it remains stable while moving and changes on load/respawn. The browser allocator is not the native server's global construction order, so layouts need not match a particular Java session. Only RenderPlayer calls the stuck-arrow layer natively, so mobs show none and the port does not add any. The cape and ears have no pivot in the port, so arrows in them attach at the model origin.
