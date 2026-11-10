// Replays public/research/eye-height-reference.json: Entity.getEyeHeight (sa.g) of every concrete Entity class of the unchanged
// 1.7.10 JAR (tools/probes/EyeHeightProbe.java), and checks that the port reads the same table.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { livingEyeHeight, PLAYER_EYE_HEIGHT } from "./ai.js";
import { PLAYER_EYE_OFFSET } from "./enderman.js";

const f = Math.fround;
const ref = JSON.parse(readFileSync(new URL("../public/research/eye-height-reference.json", import.meta.url), "utf8"));
const by = Object.fromEntries(ref.classes.map((c) => [c.name, c]));
// Port mob type -> EntityXxx class; only types with a constructed record (real width and height).
const MOBS = { zombie: "EntityZombie", pigman: "EntityPigZombie", skeleton: "EntitySkeleton", creeper: "EntityCreeper", spider: "EntitySpider", cave_spider: "EntityCaveSpider",
  enderman: "EntityEnderman", blaze: "EntityBlaze", ghast: "EntityGhast", slime: "EntitySlime", magma_cube: "EntityMagmaCube", silverfish: "EntitySilverfish", witch: "EntityWitch",
  giant: "EntityGiantZombie", cow: "EntityCow", pig: "EntityPig", sheep: "EntitySheep", chicken: "EntityChicken", mooshroom: "EntityMooshroom", wolf: "EntityWolf", ocelot: "EntityOcelot",
  horse: "EntityHorse", villager: "EntityVillager", iron_golem: "EntityIronGolem", snow_golem: "EntitySnowman", squid: "EntitySquid", bat: "EntityBat", wither: "EntityWither", ender_dragon: "EntityDragon" };

test("the probe saw every Entity class and Entity.getEyeHeight is 0 unless overridden", () => {
  assert.equal(ref.classes.length, 95);
  const overrides = ref.classes.filter((c) => !["Entity"].includes(c.declaredInName) && !/FX$/.test(c.name)).map((c) => `${c.name}:${c.declaredInName}`);
  // Only EntityLivingBase (height * 0.85), EntityWolf (height * 0.8), EntityPlayer / EntityClientPlayerMP / EntityPlayerSP (0.12),
  // EntityPlayerMP (1.62) and EntityOtherPlayerMP (1.82) override it.
  assert.ok(overrides.every((o) => /:(EntityLivingBase|EntityWolf|EntityPlayer|EntityPlayerMP|EntityOtherPlayerMP)$/.test(o)), overrides.join());
  for (const c of ref.classes) if (c.declaredInName === "Entity" && c.how === "constructed") assert.equal(c.eye, 0, c.name);
  for (const n of ["EntityMinecartEmpty", "EntityMinecartChest", "EntityBoat", "EntityItem", "EntityPainting", "EntityItemFrame", "EntityArrow", "EntityXPOrb", "EntityTNTPrimed", "EntityFallingBlock"]) assert.equal(by[n].eye, 0, n);
});

test("livingEyeHeight replays every constructed living mob's native eye height", () => {
  let n = 0;
  for (const [type, cls] of Object.entries(MOBS)) {
    const c = by[cls];
    assert.ok(c, cls);
    if (c.how !== "constructed") continue;
    assert.equal(livingEyeHeight(type, f(c.height)), f(c.eye), `${type} ${c.height}`);
    n++;
  }
  assert.ok(n >= 26);
  assert.equal(livingEyeHeight("wolf", f(0.8)), f(0.64000005));
  assert.notEqual(livingEyeHeight("wolf", f(0.8)), livingEyeHeight("ocelot", f(0.8)), "a wolf's eye is 0.8 of its height, an ocelot's 0.85");
});

// Batch 34: every class is built through a real constructor (the horse reads an empty en_US.lang, EntityPlayerMP runs on server / world doubles,
// the client players on a no-op skin manager, dragon parts come from the dragon), so no record is formula-only any more.
test("all 95 classes were built with a real constructor and real sizes", () => {
  assert.equal(ref.classes.filter((c) => c.how === "constructed").length, 95);
  assert.equal(ref.classes.filter((c) => c.how !== "constructed").length, 0);
  assert.equal(by.EntityHorse.ctor, "(World)");
  assert.equal(by.EntityPlayerMP.ctor, "(MinecraftServer,WorldServer,GameProfile,ItemInWorldManager)");
  for (const c of ref.classes) assert.ok(c.width > 0 && c.height > 0, c.name);
});

test("a real horse is 1.4 x 1.6 with eye height * 0.85; the wolf formula is 0.8", () => {
  const h = by.EntityHorse;
  assert.deepEqual([f(h.width), f(h.height), f(h.eye)], [f(1.4), f(1.6), f(f(1.6) * f(0.85))]);
  assert.equal(h.declaredInName, "EntityLivingBase");
  assert.equal(f(by.EntityWolf.eye), f(f(by.EntityWolf.height) * f(0.8)));
});

test("real player sizes: 0.6 x 1.8 for every player class, eye 1.62 server / 0.12 client / 1.82 other-player, unchanged by the sneak flag", () => {
  for (const [name, eye] of [["EntityPlayerMP", 1.62], ["EntityPlayerSP", 0.12], ["EntityClientPlayerMP", 0.12], ["EntityOtherPlayerMP", 1.82]]) {
    const c = by[name];
    assert.deepEqual([f(c.width), f(c.height), f(c.eye), f(c.sneakEye), f(c.sneakHeight)], [f(0.6), f(1.8), f(eye), f(eye), f(1.8)], name);
  }
});

test("particles: Entity.getEyeHeight is 0 and every EntityFX is a 0.2 / 0.02 / 0.01 sized cube", () => {
  const fx = ref.classes.filter((c) => /FX$/.test(c.name));
  assert.ok(fx.length >= 30);
  for (const c of fx) { assert.equal(c.eye, 0, c.name); assert.equal(c.width, c.height, c.name); assert.ok([f(0.2), f(0.02), f(0.01)].includes(f(c.width)), `${c.name} ${c.width}`); }
  assert.equal(by.EntityLightningBolt.eye, 0);
  assert.equal(by.EntityDragonPart.eye, 0);
});

test("the player's eye: server player 1.62 over the feet at every mob call site, client players 0.12", () => {
  assert.equal(by.EntityPlayerMP.eye, 1.62);
  assert.equal(f(by.EntityPlayerSP.eye), f(0.12));
  assert.equal(f(by.EntityClientPlayerMP.eye), f(0.12));
  assert.equal(PLAYER_EYE_HEIGHT, f(by.EntityPlayerMP.eye));
  assert.equal(PLAYER_EYE_OFFSET, PLAYER_EYE_HEIGHT);
});

// EntitySenses.canSee -> EntityLivingBase.canEntityBeSeen: a block ray from the mob's posY + getEyeHeight to the target's posY + getEyeHeight, and the
// target here is the server's EntityPlayerMP (posY the feet, eye 1.62). A stone block at y 1 (spanning 1 to 2) between a zombie (eye 1.53) and a player
// standing on the same floor (eye 1.62) blocks the line; with EntityPlayer's 0.12 the line would dive to 0.12 and pass under it (the old port).
test("a zombie's sight to the player runs from eye 1.53 to feet + 1.62", async () => {
  const { EntityWorld } = await import("./entities.js");
  const wall = new Set(["66,1,64"]);
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0 || wall.has(`${x},${y},${z}`), get: (x, y, z) => (y < 0 || wall.has(`${x},${y},${z}`) ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [{ id: "m0", health: 20, type: "zombie", x: 64.5, y: 0, z: 64.5 }], () => 0.99), z = w.entities[0];
  const survival = { health: 20, creative: false, time: 6000, inventory: { armor: [null, null, null, null] }, effects: { has: () => false } };
  w.ai.beginTick({ x: 68.5, y: 0, z: 64.5 }, survival, 0);
  const brain = w.ai.brain(z);
  assert.equal(brain.eyeHeight, f(f(1.8) * f(0.85)));
  assert.equal(w.ai.player.eyeHeight, f(1.62));
  assert.equal(brain.canSee(w.ai.player), false, "the block at y 1 is in the line from 1.53 to 1.62");
  wall.clear();
  brain.senseCache.clear();
  assert.equal(brain.canSee(w.ai.player), true);
  wall.add("66,2,64"); // above the line (y 2 to 3): both eyes are below it
  brain.senseCache.clear();
  assert.equal(brain.canSee(w.ai.player), true);
});
