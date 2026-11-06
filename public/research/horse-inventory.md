# Horse inventory screen (GuiScreenHorseInventory)

Most of this screen already existed when this track started (`.shared-memory/PROJECT.md` still says "There is no horse GUI"; that line is out of date). Verified in the code, not rebuilt:

- `ContainerHorseInventory` (aam) with its saddle slot (aan), armour slot (aao) and the AnimalChest (zt): `HorseContainer` in `src/horse-gear.js`, replayed against `public/research/horse-gear-reference.json` (HorseGearProbe, container/slotValid/transfer/usable/drops rows). That covers slot positions (saddle 8,18; armour 8,36; chest 3 x 5 at 80,18; player slots at y 84/142), `isItemValid` per animal type, AnimalChest size (2, or 17 with a chest), shift-click routing and `canInteractWith`.
- Opening: sneak or saddle/armour right-click on a tame horse (`interactHorse` action "gui"), and the inventory key while riding (`main.js` `openHorse`).
- Chest on a donkey or mule by right-click with a chest block, the chest sound, and death drops of every stack plus the chest block (`horse-gear-live.js` `gearDeath`).
- Save/load: `horse.items` is kept in the mob record; the saddled and armour flags follow the stacks through `syncGear`.
- Background and slot art: `public/media/1.7.10/gui/container/horse.png` (original 1.7.10 asset, same provenance as the other container textures), with the chest and armour slot panels drawn from it (`container-ui.css`).

## Added here: the horse preview

bft.func_146976_a ends with `GuiInventory.func_147046_a(guiLeft + 51, guiTop + 60, 17, guiLeft + 51 - mouseX, guiTop + 75 - 50 - mouseY, horse)` (read with `javap -c -p bft`, after the horse.png quads: the chest panel when `wi.ck()` and the armour panel when `wi.cB()`). `src/horse-preview.js` draws the existing horse rig through the same pose maths as the inventory player (`paperdollPose`/`paperdollMatrix`) with anchor (51, 60), scale 17 and look point (51, 25). Saddle, chest bags, ears and armour follow the live record while the screen is open. `src/horse-preview.test.js` checks the constants.

## Gaps

- No new probe was written: HorseGearProbe already records the container evidence. The preview is a static rest pose (no limb swing, rear, eat or tail animation, no baby head offset) and has not been viewed in a browser; lighting uses the inventory-player item lights. Not full parity.
