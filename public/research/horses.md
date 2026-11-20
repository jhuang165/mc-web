# Horses (EntityHorse, id 100, obfuscated `wi`) - 1.7.10

Evidence: `tools/probes/HorseProbe.java` drives the unchanged obfuscated classes; `tools/verify-horse.mjs` writes `public/research/horse-reference.json`; `src/horse.test.js` and `src/horse-world.test.js` check the port against it. Not full parity.

## Probed (matches native)
- Spawn roll order: gaussian, type/colour/marking rolls, foal `nextInt(5)`, then health/speed/jump rolls; group spawn data.
- Taming: `nextInt(50)==0`, then `nextInt(100) < temper`; failure adds 5 temper, dismounts, angry sound uses two `nextFloat`.
- Jump power `w(p)`, first-tick velocity, fall damage `ceil(f(d*0.5)-3)`, mounted offset.
- Feeding (heal, foal growth, temper, golden items put tame adults in love; undead ignore food).
- Interact rule (fitted to all 280 probe rows), breeding child type/variant, drops (looting), living/hurt sounds, NBT read/write.

## Bytecode-derived / recalled (unverified)
- Rearing timeout of 20 ticks, client jump-key counter and `(int)(power*100)` send, `setLivingAnimations` pose, donkey/mule render scale.
- Overlay armour/marking rendering in `src/horse-renderer.js` (part boxes dumped from the probe; never viewed in a browser).

## Batch 88 (horse88): ridden ticks
Executed: `tools/probes/Horse88Probe.java` (`tools/verify-horse88.mjs`, `horse88-reference.json`) runs whole server `wi.h()` ticks with a rider and calls `wi.w(int)`, `cU()` and mountEntity between ticks; `src/horse88-b88.test.js` replays it tick for tick and the single `ride` moves of `horse-reference.json`. Corrected in the port:
- The rider's moveForward/moveStrafing are moved with directly (not decayed by 0.98, as the horse's own fields are).
- `bt` (jumpPower) and `br` (horseJumping) clear only after a ridden move on ground: a power stored in the air is dropped at the landing (no jump), and one left on a horse the rider got off in the air stays, while `br` stays set too, so the next ridden tick does not jump either.
- `bI` (jumpHeld) is cleared on every tick the horse is not rearing; yaw is wrapped by `% 360`; the forward push uses the MathHelper table; the gallop counter resets when forward <= 0; motionY uses the jumpStrength attribute with modifiers (0..2).
- stepHeight 0.5 and jumpMovementFactor 0.02 apply from the first unridden or unsaddled tick, before its move.
- Single player: the jump key is tracked off the horse (mounting with it held counts on), and the dismount tick runs the counter without a send.
Open: natively the sneak tick still makes one ridden move before the dismount; the first ridden tick of a freshly loaded horse uses `aiMoveSpeed` 0 natively for the air factor.

## Files
`src/horse.js` (rules), `src/horse-live.js` (engine wiring, riding), `src/horse-renderer.js`, tests.

## Gaps

Batch 69 (docs sweep): the first three bullets below are from the first horse slice and are partly closed. The horse inventory screen exists (`horse-inventory.md`), leads and knots are live (`horse-gear-live.js`, `leash.md`), the jump bar is wired (`horse-gear-live.js` header: "leads and leash knots, name tags, the death drops of the horse inventory and the jump bar"), horse step and living sounds exist (`mob-steps.js` `horseStep`, `horse-sounds-b57.test.js`), and horse spawning is replayed (`horse-spawn-b45.test.js`). Not re-checked: skeleton and zombie horse natural spawning, horse armour in dungeon chests, the shadow entry, the XP formula.
- Horse inventory GUI, armour and chest slot UI (equip from held item only), leads (item 420), mule breeding specifics.
- Skeleton/zombie horse natural spawning, horse armour in dungeon chests.
- HUD jump bar, horse step sounds, shadow entry.
- Renderer not visually verified (no browser allowed in this track).
- XP on death uses the animal formula, not probe-fitted.
