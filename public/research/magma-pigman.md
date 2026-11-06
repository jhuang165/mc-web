# Magma cube and zombie pigman (Minecraft Java 1.7.10)

Evidence: `tools/probes/MagmaPigmanProbe.java` drives the unchanged original classes (yf MagmaCube, ym Slime, yh PigZombie, yq Zombie, wo Pig, xh LightningBolt, amp BlockPortal, bho ModelMagmaCube) and `tools/verify-magma-pigman.mjs` writes `magma-pigman-reference.json` (41 records, class sha256 digests included). `src/magma-pigman.test.js` and `src/magma-pigman-world.test.js` check the port against it. Items not probed are marked "bytecode-derived".

## Magma cube ("LavaSlime", id 62)
- Size, health size^2, width/height 0.6*size; Java Size tag is size-1. Slime code in `slime.js` is reused.
- Jump motion 0.42 + size*0.1; jump delay (nextInt(20)+10)*4 before the slime's own division; squish decay 0.9; landing sound always plays; jump sound `mob.magmacube.small|big`, hurt and death stay `mob.slime.*`.
- Armour size*3, contact damage size+2 at any size, always fully lit, "flame" particle, fire immune, ignores lava, no fall damage.
- Drops (size above 1 only): nextInt(4)-2 plus nextInt(looting+1) magma cream. XP and splitting follow the slime.
- ModelMagmaCube: core plus 8 slices from `magmacube.png` (dump in the reference).

## Zombie pigman ("PigZombie", id 57)
- 20 HP, speed 0.5, attack 5, follow range 40, armour 2, fire immune, legacy AI (bk false). Speed boost +0.45 (operation 0) while it has a target.
- Anger: angerLevel 400+nextInt(400) and sound delay nextInt(40). A player hit angers every pigman in the 32-block box, then itself, each on its own rand. Anger never decays. Angry sound `mob.zombiepig.zpigangry` at volume 2.
- Held golden sword only (0.085 drop chance). Drops: nextInt(2+looting) rotten flesh, nextInt(2+looting) gold nuggets, shared rare roll gives a gold ingot, sword with the skeleton-bow damage rule. XP 5, plus 1+nextInt(3) with a sword.
- NBT: Anger, Equipment, DropChances; no HurtBy tag exists in 1.7.10.
- Lightning on a pig (baby too) removes it and creates an adult pigman with the sword, no damage. `portalPigmanSpawn` ports BlockPortal.updateTick's roll (nextInt(2000) < difficulty); the lead wires it up.

## Gaps
- Natural spawning in the Nether goes through the SpawnerAnimals port with BiomeGenHell's and the fortress lists ([natural spawning](natural-spawning.md)); live portal pigmen are not called yet.
- Pigman think loop, path refresh and idle wander timing are adapted from the legacy spider flow, not probed tick-for-tick; non-player targets are not modelled; no group reinforcement (reinforcements 0 in the original).
- Baby pigmen roll as in the original but render and behave as adults.
- Water acceleration of the pigman and magma lava particles/landing particle behaviour are adapted, not probed.
- Sword is a flat sprite, not the 3D held item.
- `mob.magmacube.*` and `mob.zombiepig.*` audio files are not imported (the lead runs `tools/import-vanilla-media.mjs`; its regex already includes them).
- Fire immunity guards and the lightning/portal hooks are bytecode-derived plus world tests, not full probe records.
