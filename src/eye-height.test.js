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
  villager: "EntityVillager", iron_golem: "EntityIronGolem", snow_golem: "EntitySnowman", squid: "EntitySquid", bat: "EntityBat", wither: "EntityWither", ender_dragon: "EntityDragon" };

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

test("marker heights fix the formulas of classes that cannot be constructed on the double", () => {
  for (const [cls, k] of [["EntityHorse", 0.85], ["EntityWolf", 0.8]]) for (const [h, eye] of by[cls].markers ?? []) assert.equal(f(eye), f(h * f(k)), cls);
});

test("the player's eye: server player 1.62 over the feet at every mob call site, client players 0.12", () => {
  assert.equal(by.EntityPlayerMP.markers[0][1], 1.62);
  assert.equal(f(by.EntityPlayerSP.markers[0][1]), f(0.12));
  assert.equal(f(by.EntityClientPlayerMP.markers[0][1]), f(0.12));
  assert.equal(PLAYER_EYE_HEIGHT, f(by.EntityPlayerMP.markers[0][1]));
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
