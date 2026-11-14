# Cape and deadmau5 ears (batch 70)

Source: 1.7.10 `RenderPlayer.renderSpecials` (`bop`), `ModelBiped` (`bhm`), `EntityPlayer` (`yz`), `EntityOtherPlayerMP` (`bll`), `AbstractClientPlayer` (`blg`).

- **Ears** (bytecode-read): drawn when the name equals `deadmau5` and the skin texture is present (`blg.o()`). Box `(-3,-6,-1, 6,6,1)` at texture (24, 0), once per side: rotate by (rotationYaw - renderYawOffset) about Y and by the pitch about X, translate `(0.375 * (2i - 1), 0, 0)` then `(0, -0.375, 0)`, rotate back by -pitch (X) and -yaw (Y), scale 1.3333334, draw with the head's rotation angles and rotation point 0. No invisibility or sneak test.
- **Cape** (bytecode-read): drawn when a cape texture exists (`blg.n()`), the player is not invisible and `getHideCape()` is false. Box `(-5,0,-1, 10,16,1)` at texture (0, 0) on a 64 x 32 sheet. After `translate(0, 0, 0.125)`: rotate X by `6 + f13 / 2 + f12`, Z by `f14 / 2`, Y by `-f14 / 2`, Y by 180. `f12` is the vertical chase difference times 10, clamped to -6..32, plus `sin(walk * 6) * 32 * cameraYaw` (+25 when sneaking); `f13`/`f14` come from the horizontal chase difference rotated by the body yaw, times 100 (`f13` not below 0).
- **Chasing position** (executed): `EntityPlayer.onUpdate` keeps a position that follows the entity by a quarter of the gap each tick and snaps when the gap passes 10 on any axis. `public/research/cape-reference.json` (tools/probes/CapeChaseProbe.java, tools/verify-cape.mjs) is the real class run through `onUpdate`; `src/cape-b70.test.js` replays chase, cameraYaw and distanceWalkedModified exactly.
- **Remote players** (bytecode-read): `EntityOtherPlayerMP` never moves through `moveEntity` and its motion stays 0, so its cameraYaw and walked distance stay 0; only the chase swing and the sneak offset move a remote cape.
- **Show Cape** (bytecode-read): the setting is sent in C15PacketClientSettings; the server sets `getHideCape` (metadata 16 bit 1), which hides the cape for all viewers.

Port: `src/cape.js` (maths), `PlayerBody.cape`, `PlayerRenderer.setCape(texture)`, `PlayerRenderer.name` / `hasSkin` (ears). Batch 71: accounts carry an optional uploaded 64 x 32 cape (`/api/cape`, `/api/capes/<hash>.png`), player rows carry `cape` and `hideCape`, the client sends `capeSettings {show}`, and the Show Cape button works. No Mojang cape ships.

Batch 73 (docs sweep, 2026-11-14): no gap claim here. Added after this doc: `sp-cape.js` (single-player cape, batch 72), `cape-wire.js` and the `capeSettings` message; the Show Cape setting is sent for server players.
