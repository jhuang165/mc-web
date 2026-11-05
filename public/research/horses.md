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

## Files
`src/horse.js` (rules), `src/horse-live.js` (engine wiring, riding), `src/horse-renderer.js`, tests.

## Gaps
- Horse inventory GUI, armour and chest slot UI (equip from held item only), leads (item 420), mule breeding specifics.
- Skeleton/zombie horse natural spawning, horse armour in dungeon chests.
- HUD jump bar, horse step sounds, shadow entry.
- Renderer not visually verified (no browser allowed in this track).
- XP on death uses the animal formula, not probe-fitted.
