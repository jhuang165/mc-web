import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Projectiles, GaussianRandom } from "./projectiles.js";
import { WitchPotions } from "./witch-potions.js";

// public/research/entity-list-reference.json `launches` (tools/probes/EntityListProbe.java, batch 46): the unchanged EntityThrowable(World, EntityLivingBase)
// constructor of EntitySnowball, EntityEgg, EntityEnderPearl, EntityPotion and EntityExpBottle on a player shell. The entity's Random is unseeded, so each record
// carries the state it had before the aim (recovered by stepping the LCG back until three nextGaussian draws end in the state the constructor left).
const launches = JSON.parse(readFileSync(new URL("../public/research/entity-list-reference.json", import.meta.url))).launches;
const PI = Math.PI;

// the port's yaw and pitch are radians looking along (-sin yaw cos pitch, sin pitch, -cos yaw cos pitch); Minecraft's are degrees with yaw' = 180 - yaw, pitch' = -pitch
const portView = ([, , , mcYaw, mcPitch]) => ({ yaw: ((180 - mcYaw) * PI) / 180, pitch: (-mcPitch * PI) / 180 });

function throwAs(rec, rng) {
  const [x, y, z] = rec.from, feet = { x, y, z }, { yaw, pitch } = portView(rec.from);
  const p = new Projectiles(() => 0.5);
  p.rng = () => rng;
  if (rec.type <= 1) return p.throwSnowball(feet, yaw, pitch, rec.type === 0 ? "snowball" : "egg");
  if (rec.type === 2) return p.throwEnderPearl(feet, yaw, pitch);
  const w = new WitchPotions({ joined() {} }, () => 0.5);
  w.projectiles.rng = () => rng;
  return rec.type === 3 ? w.throwFromPlayer(feet, yaw, pitch, 16421) : w.throwFromPlayer(feet, yaw, pitch, 0, "expBottle", 0.7);
}

for (const rec of launches) {
  test(`native player throw launch ${rec.name}`, () => {
    const rng = new GaussianRandom(0);
    rng.seed = BigInt(rec.seed); rng.spare = undefined; // the state before the constructor's aim
    const ball = throwAs(rec, rng), [ex, ey, ez, evx, evy, evz, eyaw, epitch] = rec.entity;
    assert.deepEqual([ball.x, ball.y, ball.z, ball.mx, ball.my, ball.mz, ball.yaw, ball.pitch], [ex, ey, ez, evx, evy, evz, eyaw, epitch]);
    assert.equal(rng.seed.toString(), rec.after.seed, "the same draws leave the random in the same state");
    assert.equal(rng.spare ?? null, rec.after.gaussian);
  });
}

test("the records cover each thrown class from several views, and all draw exactly three gaussians", () => {
  assert.equal(launches.length, 25);
  assert.deepEqual([...new Set(launches.map((r) => r.type))], [0, 1, 2, 3, 4]);
});
