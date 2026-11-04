// Ender pearl adapter for the 1.7.10 EntityEnderPearl (zm), on the shared
// EntityThrowable (zk) flight implementation. This stays independent of the
// browser runtime; callers supply player, world, impact and sound/particle hooks.
import { launch } from "./projectiles.js";

export const ENDER_PEARL = Object.freeze({ itemId: 378, speed: 1.5, inaccuracy: 1, impactDamage: 5, particleCount: 32 });

// ItemEnderPearl (aco) uses the same EntityThrowable(world, player) constructor
// as snowballs and eggs. `launch` ports that constructor's eye offset and
// setThrowableHeading math and accepts the entity's java.util.Random adapter.
export function launchEnderPearl(random, feet, yaw, pitch, owner = "player") {
  if (owner !== "player") throw new TypeError("Ender pearl owner must be the local player token");
  return { ...launch(random, feet, yaw, pitch), kind: "enderPearl", owner, random, rand: random, ticks: 0, dead: false };
}

// EntityEnderPearl.onImpact (zm.a), reconstructed from the unchanged class:
// the hit entity receives zero thrown damage before 32 portal particles;
// teleport/dismount/fall reset and
// 5 fall damage require server-side, connected EntityPlayerMP in
// this world. Server-side setDead happens after the owner branch, regardless
// of whether its teleport gates pass. Hooks keep game/runtime dependencies explicit.
export function impactEnderPearl(pearl, { world, owner, hit = null }, hooks = {}) {
  const result = { impacted: true, teleported: false, damaged: false, hit };
  if (hit) {
    hooks.hit?.(hit, { source: "thrown", projectile: pearl, thrower: owner, amount: 0 });
    result.entityHit = true;
  }
  const random = pearl.random;
  for (let i = 0; i < ENDER_PEARL.particleCount; i++) {
    // Native argument order is x, y + nextDouble()*2, z, nextGaussian(), 0,
    // nextGaussian(); the middle zero consumes no Gaussian draw.
    const particle = { kind: "portal", x: pearl.x, y: pearl.y + (random?.nextDouble?.() ?? 0) * 2, z: pearl.z,
      mx: random?.nextGaussian?.() ?? 0, my: 0, mz: random?.nextGaussian?.() ?? 0 };
    hooks.particle?.(particle);
  }

  if (!world?.remote && owner?.kind === "playerMP" && owner.connected && owner.world === world) {
    if (owner.riding) hooks.dismount?.(owner);
    hooks.teleport?.(owner, pearl.x, pearl.y, pearl.z);
    owner.fallDistance = 0;
    result.teleported = true;
    result.damaged = hooks.damage?.(owner, { source: "fall", amount: ENDER_PEARL.impactDamage }) ?? false;
  }
  if (!world?.remote) pearl.dead = true;
  return result;
}

// Browser adapter snapshot, matching the current Projectiles serializer shape.
// Native EntityThrowable NBT also carries ownerName, inGround and shake; only
// ticksInAir is omitted. Keeping the distinction explicit avoids presenting the
// browser JSON projection as a complete native entity save.
export function serializeEnderPearl(pearl) {
  if (pearl.owner !== "player") throw new Error("Cannot save ender pearl without local owner token");
  return { x: pearl.x, y: pearl.y, z: pearl.z, mx: pearl.mx, my: pearl.my, mz: pearl.mz,
    yaw: pearl.yaw ?? 0, pitch: pearl.pitch ?? 0, kind: "enderPearl", owner: pearl.owner };
}
