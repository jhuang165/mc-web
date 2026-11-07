// Minecraft Java 1.7.10 MobSpawnerBaseLogic (agq) as run by TileEntityMobSpawner (apj, apk),
// with EntityMob/EntityCreature/EntityLiving.getCanSpawnHere (yg.by, td.by, sw.by) and the
// TileEntityMobSpawnerRenderer (bmp) transform. Headless: the world, players, mobs and
// particles come through a context; see public/research/mob-spawner.md.
//
// Random streams. The server branch draws from World.rand, which in this port is
// weather.random (main.js); pass it as ctx.random. getCanSpawnHere draws from the new mob's
// Entity.rand (entities.js entityRandom). The client branch draws from WorldClient.rand,
// which here is scene.explosionParticles.worldRandom; pass it as ctx.random to tickClient.
import { readEntry, readSpawnData, pickWeighted, entryToJson, entryFromJson } from "./spawner-data.js";
import { spawnRidingChain } from "./spawner-riding.js";
const f = Math.fround;

// TileEntityMobSpawner's logic before NBT: spawnDelay 20, minSpawnDelay 200, maxSpawnDelay 800,
// spawnCount 4, maxNearbyEntities 6, activatingRangeFromPlayer 16, spawnRange 4.
export const SPAWNER_DEFAULTS = Object.freeze({ delay: 20, minSpawnDelay: 200, maxSpawnDelay: 800, spawnCount: 4, maxNearbyEntities: 6, requiredPlayerRange: 16, spawnRange: 4 });

// EntityList names (EntityId) for the port's ENTITY_TYPES keys. An EntityId outside this map
// is EntityList.createEntityByName returning null: updateSpawner returns before any roll.
export const SPAWNER_ENTITY_IDS = Object.freeze({ Enderman: "enderman", CaveSpider: "cave_spider", Spider: "spider", Zombie: "zombie", Skeleton: "skeleton", Creeper: "creeper", Pig: "pig", Cow: "cow", Sheep: "sheep", Chicken: "chicken", Wolf: "wolf", Ozelot: "ocelot", Silverfish: "silverfish", Witch: "witch", Slime: "slime", Blaze: "blaze", Ghast: "ghast" });
export const spawnerType = (entityId) => (Object.hasOwn(SPAWNER_ENTITY_IDS, entityId) ? SPAWNER_ENTITY_IDS[entityId] : null);
// getEntitiesWithinAABB(entity.getClass(), box) is Class.isAssignableFrom: EntityCaveSpider
// extends EntitySpider, so a Spider spawner counts cave spiders and a CaveSpider spawner does not
// count spiders. (EntityPigZombie and EntityMooshroom would join zombies and cows; neither exists here.)
const SUBTYPES = { spider: ["spider", "cave_spider"] };
export const countsAs = (spawnType, entityType) => (SUBTYPES[spawnType] ? SUBTYPES[spawnType].includes(entityType) : spawnType === entityType);

// AxisAlignedBB.getBoundingBox(x, y, z, x + 1, y + 1, z + 1).expand(spawnRange * 2, 4, spawnRange * 2).
export function spawnerBox(s) {
  const r = s.spawnRange * 2;
  return [s.x - r, s.y - 4, s.z - r, s.x + 1 + r, s.y + 5, s.z + 1 + r];
}
// AxisAlignedBB.intersectsWith: strict on every face.
export const boxesIntersect = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
// Entity.setPosition's box: half width as a float, yOffset and ySize 0 for mobs.
export function mobBox(x, y, z, width, height) {
  const w = f(f(width) / 2), h = f(height);
  return [x - w, y, z - w, x + w, y + h, z + w];
}
// Entity.setSize after placement (a foal, a baby zombie): the box keeps its minimum corner, so a (width, height) box centred on (x, y, z)
// shrinks to (newWidth, newHeight) from that corner. The entity's next move recentres it (resetPositionToBB).
export function anchoredShrunkBox(e, width, height, newWidth, newHeight) {
  const w = f(f(width) / 2), minX = e.x - w, minZ = e.z - w;
  return [minX, e.y, minZ, minX + f(newWidth), e.y + f(newHeight), minZ + f(newWidth)];
}
// The countNearby hook for a plain list of {type, x, y, z} with sizeOf(entity) -> [width, height].
export function countInBox(entities, type, box, sizeOf) {
  let n = 0;
  for (const e of entities) if (countsAs(type, e.type) && boxesIntersect(box, mobBox(e.x, e.y, e.z, ...sizeOf(e)))) n++;
  return n;
}

// MobSpawnerBaseLogic.isActivated (agq.f): World.getClosestPlayer(x + 0.5, y + 0.5, z + 0.5, range)
// accepts a player strictly inside the range. Server players are at their feet; the client's
// EntityClientPlayerMP posY is the eye (feet + 1.62), so tickClient wants eye positions.
export function isActivated(s, players) {
  const cx = s.x + 0.5, cy = s.y + 0.5, cz = s.z + 0.5, r = s.requiredPlayerRange;
  for (const p of players ?? []) {
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    if (r < 0 || dx * dx + dy * dy + dz * dz < r * r) return true;
  }
  return false;
}

// agq.e: the entity id the logic spawns, the SpawnData entry's Type when one is set, else EntityId.
export const entityIdOf = (s) => s.spawnData?.type ?? s.entityId;

// agq.j (resetTimer): a delay in [min, max), then, with SpawnPotentials, a weighted roll that makes one entry
// the SpawnData (WeightedRandom.getRandomItem), then addBlockEvent(mob_spawner, 1, 0), which sets
// the client's delay to minSpawnDelay (agq.b(1)).
export function resetTimer(s, ctx) {
  s.delay = s.maxSpawnDelay <= s.minSpawnDelay ? s.minSpawnDelay : s.minSpawnDelay + ctx.random.nextInt(s.maxSpawnDelay - s.minSpawnDelay);
  if (s.potentials?.length) s.spawnData = pickWeighted(ctx.random, s.potentials) ?? s.spawnData; // an all-zero weight total throws in the original; the port keeps the entry
  if (ctx.blockEvent) ctx.blockEvent(s, 1, 0);
  else receiveClientEvent(s, 1);
}
// agq.b(I) on the client copy: event 1 resets its delay.
export function receiveClientEvent(s, id) {
  if (id !== 1) return false;
  s.client.delay = s.minSpawnDelay;
  return true;
}

// The server half of agq.g (updateSpawner). ctx: random (World.rand), players [{x, y, z} feet],
// countNearby(type, box), createMob(type, x, y, z, yawDegrees) -> a mob not yet in the world,
// canSpawnHere(mob), and optional initMob(mob) (onSpawnWithEgg(null)), addMob(mob)
// (spawnEntityInWorld), spawnParticles(x, y, z) (playAuxSFX 2004 at the spawner),
// explosionParticles(mob) (spawnExplosionParticle, entity status 20), blockEvent(s, 1, 0) and spawnMount(id, tag, rider) (a SpawnData Riding mount, spawner-riding.js).
// Returns the mobs spawned this tick.
export function updateSpawner(s, ctx) {
  const out = [];
  if (!isActivated(s, ctx.players)) return out;
  const r = ctx.random;
  if (s.delay === -1) resetTimer(s, ctx);
  if (s.delay > 0) {
    s.delay--;
    return out;
  }
  let spawned = false;
  for (let i = 0; i < s.spawnCount; i++) {
    const type = spawnerType(entityIdOf(s));
    if (!type) return out;
    if (ctx.countNearby(type, spawnerBox(s)) >= s.maxNearbyEntities) {
      resetTimer(s, ctx);
      return out;
    }
    // Neither x nor z is centred on the block: the original adds the roll to the corner.
    let x = s.x + (r.nextDouble() - r.nextDouble()) * s.spawnRange;
    let y = s.y + r.nextInt(3) - 1;
    let z = s.z + (r.nextDouble() - r.nextDouble()) * s.spawnRange;
    const yaw = f(r.nextFloat() * 360);
    // A port-side refusal (null) spends the rolls and spawns nothing.
    const mob = ctx.createMob(type, x, y, z, yaw);
    if (mob && ctx.canSpawnHere(mob)) {
      // agq.a(sa) with SpawnData: onSpawnWithEgg is skipped and the Properties are read back over the written entity
      // (its Pos replaces the rolled position, after the getCanSpawnHere check at the rolled one).
      if (s.spawnData) { if (s.spawnData.props.size) ctx.applyProperties?.(mob, s.spawnData.props); } else ctx.initMob?.(mob);
      ctx.addMob?.(mob);
      out.push(mob);
      // The Riding loop of agq.a(sa) (spawner-riding.js): mounts spawn after the rider. A NullPointerException natively (an unmakeable id before a
      // makeable one) leaves the rider spawned and skips the effects and the timer reset; the port stops this tick the same way.
      if (s.spawnData && ctx.spawnMount && spawnRidingChain(mob, s.spawnData.props, ctx).crashed) {
        out.crashed = true;
        return out;
      }
      ctx.spawnParticles?.(s.x, s.y, s.z);
      ctx.explosionParticles?.(mob);
      spawned = true;
    }
  }
  if (spawned) resetTimer(s, ctx);
  return out;
}

// The client half of agq.g: a smoke and a flame particle at one random point in the block, the
// delay counts down, and the display mob turns 1000 / (delay + 200) degrees per tick.
// ctx: random (WorldClient.rand), players [{x, y, z} eyes], particle(name, x, y, z).
export function updateSpawnerClient(s, ctx) {
  if (!isActivated(s, ctx.players)) return;
  const r = ctx.random, c = s.client;
  const x = f(s.x + r.nextFloat()), y = f(s.y + r.nextFloat()), z = f(s.z + r.nextFloat());
  ctx.particle?.("smoke", x, y, z);
  ctx.particle?.("flame", x, y, z);
  if (c.delay > 0) c.delay--;
  c.prevRotation = c.rotation;
  c.rotation = (c.rotation + f(1000 / f(c.delay + 200))) % 360;
}

// World.provider.lightBrightnessTable for the Overworld (WorldProvider.generateLightBrightnessTable, 0 base).
export const SPAWN_BRIGHTNESS = Array.from({ length: 16 }, (_, i) => {
  const k = f(1 - f(i / 15));
  return f(f(f(1 - k) / f(f(k * 3) + 1)) * 1);
});
// EntityMob.getCanSpawnHere (yg.by) at the mob's floored position and box floor:
// difficulty is not Peaceful; isValidLightLevel (savedSky > rand.nextInt(32) fails; the
// block light value, read with skylightSubtracted 10 while thundering, must be at most
// rand.nextInt(8)); EntityLiving: no living entity in the box, no colliding block (or
// boat/minecart) box and no liquid; EntityCreature: 0.5 - brightness >= 0.
// env: difficulty, skyLight(x, y, z) (saved EnumSkyBlock.Sky), lightValue(x, y, z) (World.getBlockLightValue),
// thundering, thunderLightValue(x, y, z), entityCollision(box), blockCollision(box), liquid(box), and optionally
// brightness (the provider's lightBrightnessTable; the Overworld's by default).
// rand is the mob's Entity.rand.
export function monsterCanSpawnHere(mob, env, rand) {
  if (env.difficulty === 0) return false;
  const x = Math.floor(mob.x), y = Math.floor(mob.y), z = Math.floor(mob.z);
  if (env.skyLight(x, y, z) > rand.nextInt(32)) return false;
  const light = env.thundering ? env.thunderLightValue(x, y, z) : env.lightValue(x, y, z);
  if (light > rand.nextInt(8)) return false;
  const box = mobBox(mob.x, mob.y, mob.z, mob.width, mob.height);
  if (env.entityCollision(box) || env.blockCollision(box) || env.liquid(box)) return false;
  return f(f(0.5) - (env.brightness ?? SPAWN_BRIGHTNESS)[env.lightValue(x, y, z)]) >= 0;
}

// TileEntityMobSpawnerRenderer.func_147517_a (bmp.a(agq, DDDF)) as a column-major 4x4 (three.js
// Matrix4.fromArray): translate(x + 0.5, y, z + 0.5), translate(0, 0.4, 0), rotate((prev +
// (rot - prev) * partial) * 10 degrees about y), rotate -30 degrees about x, translate(0, -0.4, 0),
// scale 0.4375. The mob is then drawn at the origin with yaw and pitch 0 under the spawner's
// block light (the dispatcher's lightmap); RenderCaveSpider adds its own 0.7.
export function spawnerMobMatrix(s, partial = 1) {
  const c = s.client, a = (f(f(c.prevRotation + (c.rotation - c.prevRotation) * f(partial)) * 10) * Math.PI) / 180;
  const b = (-30 * Math.PI) / 180, k = f(0.4375), lift = f(0.4);
  const cy = Math.cos(a), sy = Math.sin(a), cx = Math.cos(b), sx = Math.sin(b);
  // R = Ry(a) * Rx(b), rows.
  const R = [[cy, sy * sx, sy * cx], [0, cx, -sx], [-sy, cy * sx, cy * cx]];
  // T(x + .5, y + .4, z + .5) * R * T(0, -.4, 0) * S(k)
  const t = [s.x + 0.5 - R[0][1] * lift, s.y + lift - R[1][1] * lift, s.z + 0.5 - R[2][1] * lift];
  return [R[0][0] * k, R[1][0] * k, R[2][0] * k, 0, R[0][1] * k, R[1][1] * k, R[2][1] * k, 0, R[0][2] * k, R[1][2] * k, R[2][2] * k, 0, t[0], t[1], t[2], 1];
}
// The cached display entity (agq.h, created by EntityList with no spawn rolls), for MobRenderer:
// at the origin, never ticked, yaw/pitch/limb swing 0, lit by the spawner block.
export function spawnerDisplayEntity(s, partial = 1) {
  const type = spawnerType(entityIdOf(s));
  if (!type) return null;
  const zero = { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, rotationYaw: 0, prevRotationYaw: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0, rotationPitch: 0, prevRotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0 };
  return { id: `spawner-${s.x},${s.y},${s.z}`, type, health: 1, age: 0, hurt: 0, death: 0, growingAge: 0, effects: [], ...zero, displayMatrix: spawnerMobMatrix(s, partial), lightPos: { x: s.x, y: s.y, z: s.z } };
}

const short = (v) => (v << 16) >> 16;
const num = (v) => typeof v === "number" && Number.isFinite(v);
export function makeSpawner(x, y, z) {
  return { x, y, z, entityId: "Pig", ...SPAWNER_DEFAULTS, spawnData: null, potentials: [], client: { delay: SPAWNER_DEFAULTS.delay, rotation: 0, prevRotation: 0 } };
}
// MobSpawnerBaseLogic.readFromNBT (agq.a(dh)): EntityId and Delay always; Min/MaxSpawnDelay and
// SpawnCount only with MinSpawnDelay; MaxNearbyEntities and RequiredPlayerRange together;
// SpawnRange on its own. Values are NBT shorts.
// SpawnPotentials then SpawnData come as the JSON entries of spawner-data.js (or Map entries).
export function readNBT(s, t) {
  if (typeof t.EntityId === "string") s.entityId = t.EntityId;
  if (Array.isArray(t.SpawnPotentials)) s.potentials = t.SpawnPotentials.map((e) => (e instanceof Map ? readEntry(e) : entryFromJson(e))).filter(Boolean);
  else s.potentials = [];
  if (t.SpawnData instanceof Map) s.spawnData = readSpawnData(t.SpawnData, s.entityId);
  else if (t.SpawnData && typeof t.SpawnData === "object") s.spawnData = entryFromJson({ ...t.SpawnData, type: s.entityId });
  else s.spawnData = null;
  if (num(t.Delay)) s.delay = short(t.Delay);
  if (num(t.MinSpawnDelay)) {
    s.minSpawnDelay = short(t.MinSpawnDelay);
    s.maxSpawnDelay = short(t.MaxSpawnDelay ?? 0);
    s.spawnCount = short(t.SpawnCount ?? 0);
  }
  if (num(t.MaxNearbyEntities)) {
    s.maxNearbyEntities = short(t.MaxNearbyEntities);
    s.requiredPlayerRange = short(t.RequiredPlayerRange ?? 0);
  }
  if (num(t.SpawnRange)) s.spawnRange = short(t.SpawnRange);
  s.client.delay = s.delay;
}

export class MobSpawners {
  constructor() {
    this.spawners = new Map();
  }
  static key(x, y, z) {
    return `${x},${y},${z}`;
  }
  // A generator record {x, y, z, entityId} (or a gen-world tile's `name`), or NBT-named fields.
  add(record) {
    const x = record.x, y = record.y, z = record.z;
    if (![x, y, z].every(Number.isInteger)) return null;
    const s = makeSpawner(x, y, z);
    const id = record.entityId ?? record.name;
    if (typeof id === "string") s.entityId = id;
    readNBT(s, record);
    for (const k of Object.keys(SPAWNER_DEFAULTS)) if (k !== "delay" && Number.isInteger(record[k])) s[k] = short(record[k]);
    if (Number.isInteger(record.delay)) s.delay = s.client.delay = short(record.delay);
    this.spawners.set(MobSpawners.key(x, y, z), s);
    return s;
  }
  remove(x, y, z) {
    return this.spawners.delete(MobSpawners.key(x, y, z));
  }
  get(x, y, z) {
    return this.spawners.get(MobSpawners.key(x, y, z)) ?? null;
  }
  values() {
    return [...this.spawners.values()];
  }
  get size() {
    return this.spawners.size;
  }
  // World.updateEntities ticks loaded tile entities in the order they were added.
  // ctx.isLoaded(x, y, z), when given, skips spawners outside loaded chunks.
  tick(ctx) {
    const out = [];
    for (const s of this.spawners.values()) if (!ctx.isLoaded || ctx.isLoaded(s.x, s.y, s.z)) out.push(...updateSpawner(s, ctx));
    return out;
  }
  tickClient(ctx) {
    for (const s of this.spawners.values()) if (!ctx.isLoaded || ctx.isLoaded(s.x, s.y, s.z)) updateSpawnerClient(s, ctx);
  }
  // writeToNBT names; the client rotation is not saved (the original rebuilds it at 0).
  toJSON() {
    return this.values().map((s) => ({ x: s.x, y: s.y, z: s.z, ...spawnerJSON(s) }));
  }
  static fromJSON(json) {
    const out = new MobSpawners();
    if (Array.isArray(json))
      for (const t of json) {
        if (!t || typeof t !== "object" || ![t.x, t.y, t.z].every(Number.isInteger)) continue;
        const s = makeSpawner(t.x, t.y, t.z);
        readNBT(s, t);
        out.spawners.set(MobSpawners.key(t.x, t.y, t.z), s);
      }
    return out;
  }
}

// writeToNBT names; a SpawnData entry (or SpawnPotentials) is JSON through spawner-data.js.
export function spawnerJSON(s) {
  const out = { EntityId: s.entityId, Delay: s.delay, MinSpawnDelay: s.minSpawnDelay, MaxSpawnDelay: s.maxSpawnDelay, SpawnCount: s.spawnCount, MaxNearbyEntities: s.maxNearbyEntities, RequiredPlayerRange: s.requiredPlayerRange, SpawnRange: s.spawnRange };
  if (s.spawnData) out.SpawnData = entryToJson(s.spawnData);
  if (s.potentials?.length) out.SpawnPotentials = s.potentials.map(entryToJson);
  return out;
}
