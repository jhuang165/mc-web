# Mob models (0.22.10)

`tools/probes/ModelProbe.java` and `tools/verify-models.mjs` construct the unchanged 1.7.10 model classes and write [model-reference.json](model-reference.json). ModelBox builds its quads without OpenGL, so nothing is patched. The probe reads every `ModelRenderer` and float field by reflection, including:

- rotation point, angles, offsets, mirror, show/hidden and texture size;
- each box's uninflated bounds, its inflation (read from corner 0) and its texture offset (read back from the quad UVs).

The 11 records are ModelPig (bhu), ModelCow (bhi), ModelSheep2 and ModelSheep1 (fur), ModelChicken, ModelZombie (bip, 64 × 64), ModelSkeleton, ModelSpider, ModelCreeper, the creeper armor model (`ModelCreeper(2.0F)`) and `ModelBiped(0)`.

`src/models.test.js` checks the rigs against those records. Each rig is put at rest (limb, wing and head angles zeroed). Then every drawn box's world bounds and texture offset are compared with the original box after its rotation point and rest angle (the quadruped body's π/2 and the chicken body's π/2) and inflation.

The mapping to three.js is (x, 24 − y, −z) / 16, plus RendererLivingEntity's 1/128 lift.

## What changed

- **Cow.** The cow was a resized generic quadruped: a narrow body and short legs, which made it look like a shorn sheep. It is now built from ModelCow:
  - head 8 × 8 × 6 at (0, 4, −8), with two 1 × 3 × 1 horns at uv (22, 0);
  - body 12 × 18 × 10 at (0, 5, 2), uv (18, 4), with the 4 × 6 × 1 udder at uv (52, 0) on the same part;
  - legs 4 × 12 × 4 at (±4, 12, 7 | −6).
- **Pig.** The pig is now built from ModelPig:
  - head 8 × 8 × 8 with the 4 × 3 × 1 snout at uv (16, 16);
  - body 10 × 16 × 8 at uv (28, 8);
  - legs 4 × 6 × 4.
- **Zombie.** The zombie is ModelZombie on the 64 × 64 skin: ModelBiped boxes, legs at ±1.9 and 4-wide arms.
- **Skeleton and zombie torso.** The body sat on the wrong pivot and was buried 1.5 blocks into the ground. It is now at (0, 0, 0) as in ModelBiped.
- **Unchanged.** Sheep, chicken, spider and creeper already matched; they gained the 1/128 lift.
- **Not drawn.** The biped headwear is left out: zombie.png and skeleton.png are fully transparent there (the test decodes both PNGs).
- **Children.**
  - Quadrupeds draw the head full size, moved down by `childYOffset` and back by `childZOffset` (pig 4 / 4, cow 8 / 6), and the body at half size about the feet.
  - Biped children (baby zombies, which this build does not spawn) scale the head by 0.75 against the body's 0.5.
  - The player's third-person `BIPED` table is also compared with `ModelBiped(0)`.

The renderers add no scale for the pig, cow or zombie. RenderSkeleton applies 1.2 only to wither skeletons, which this build does not have.

Not covered: animation curves beyond the rest pose (they were checked against the `setRotationAngles` bytecode earlier, not run in a probe), armor layers on mobs and the remaining mob roster.
