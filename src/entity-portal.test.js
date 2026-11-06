import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PortalState, Teleporter, GAME_IDS } from "./dimensions.js";
import { EntityPortals, placeAfterTravel, mobYawToMc, mcToMobYaw } from "./entity-portal.js";
import { DimensionLive, viewRecord, storedRecord } from "./dimension-live.js";
import { EntityWorld } from "./entities.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { JavaRandom } from "./java-random.js";

// tools/probes/EntityPortalProbe.java (tools/verify-entity-portal.mjs): the unchanged Entity.onEntityUpdate / setInPortal /
// travelToDimension, BlockPortal / BlockEndPortal collisions, ServerConfigurationManager.transferEntityToWorld and the PortalCooldown NBT.
const reference = JSON.parse(await readFile(new URL("../public/research/entity-portal-reference.json", import.meta.url)));
const of = (kind) => reference.records.filter((r) => r.kind === kind);
const ORIGINAL = { air: 0, obsidian: 49, portal: 90, endPortal: 119, bedrock: 7 };

test("reference file has every record kind", () => {
  assert.deepEqual(["trace", "collide", "transfer", "travel", "nbt"].map((k) => of(k).length), [10, 8, 30, 30, 5]);
});

test("PortalState replays the per-tick counters of a mob and of a Survival/Creative player", () => {
  for (const r of of("trace")) {
    const s = new PortalState(), isPlayer = r.entity !== "entity", creative = r.entity === "creative", riding = r.mode === "riding";
    for (const [tick, inBlock, counter, until, flag, op] of r.ticks) {
      let go = null;
      if (r.allowNether) go = s.tick(r.entity === "entity" ? 0 : 0, { isPlayer, creative, riding }); // update first
      if (inBlock && !riding) s.setInPortal(0, 0, 1, 0, { isPlayer }); // then the collision of the same tick
      const where = `${r.entity}/${r.mode} tick ${tick}`;
      assert.equal(s.portalCounter, counter, `${where} counter`);
      if (r.allowNether) {
        assert.equal(s.timeUntilPortal, until, `${where} cooldown`);
        assert.equal(s.inPortal, flag, `${where} flag`);
        assert.equal(go === null ? "" : "travel", op ? "travel" : "", `${where} travel`);
        if (go !== null) assert.equal(go, -1);
      }
    }
  }
});

test("a mob uses the same schedule through EntityPortals.step (travel the tick after the collision, cooldown 300)", () => {
  for (const r of of("trace").filter((t) => t.entity === "entity" && t.allowNether)) {
    const portals = new EntityPortals(), e = { type: "pig", x: 0.5, y: 5, z: 0.5, health: 10 };
    for (const [tick, inBlock, , until, , op] of r.ticks) {
      const riding = r.mode === "riding";
      const go = portals.step(e, "mob", { dim: 0, getId: () => (inBlock ? GAME_IDS.portal : 0), riding });
      assert.equal(!!go, !!op, `${r.mode} tick ${tick} travel`);
      if (go) { assert.equal(go.arg, -1); assert.equal(portals.cooldownAfter(e, go), 300); if (r.mode === "enter") break; }
      else assert.equal(e.portalCooldown | 0, until, `${r.mode} tick ${tick} cooldown`);
    }
  }
});

test("collision rules: the Nether portal sets inPortal, the End portal travels at once, riders do nothing", () => {
  for (const r of of("collide")) {
    const portals = new EntityPortals(), e = { type: "pig", x: 0.5, y: 5, z: 0.5, health: 10 };
    const idle = r.riding || r.ridden || r.remote;
    const nether = portals.step(e, "mob", { dim: 0, getId: () => GAME_IDS.portal, riding: r.riding || r.ridden });
    assert.equal(nether, null);
    assert.equal(portals.state(e).inPortal, !!r.netherSetsInPortal && !r.riding && !r.ridden);
    const end = new EntityPortals().step({ type: "pig", x: 0.5, y: 5, z: 0.5, health: 10 }, "mob", { dim: 0, getId: () => GAME_IDS.endPortal, riding: r.riding || r.ridden });
    if (!r.remote) assert.equal(end?.arg ?? null, r.endEvents.length ? 1 : null);
    void idle;
  }
});

// Sparse world around the probe's: stone up to the floor, the recorded blocks over it.
const FLOOR = { 0: 60, "-1": 31, 1: 40 };
function sparse(dim, seed, blocks = []) {
  const cells = new Map(blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id])), writes = [];
  return {
    dimension: dim, time: 0, actualHeight: dim === -1 ? 128 : 256, seed: BigInt(seed), writes,
    get(x, y, z) { const v = cells.get(`${x},${y},${z}`); if (v !== undefined) return v; return y >= 0 && y <= FLOOR[dim] ? 1 : 0; },
    set(x, y, z, id, meta = 0, flags = 3) { cells.set(`${x},${y},${z}`, id); writes.push([x, y, z, id, meta, flags]); },
    notify() {},
  };
}
const teleporterOf = (w) => new Teleporter(w, { ids: ORIGINAL, isSolid: (id) => id === 1 || id === 49 });
const near = (a, b, label) => b.forEach((v, i) => assert.ok(Math.abs(a[i] - v) < 1e-4, `${label}[${i}] ${a[i]} vs ${v}`));
const arr = (e) => [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.yaw, e.pitch];

test("transferEntityToWorld replay for non-players: scaling, Teleporter placement, End platform", () => {
  for (const r of of("transfer")) {
    const w = sparse(r.to, r.seed, r.blocks), [x, y, z, vx, vz, yaw] = r.before;
    const { e } = placeAfterTravel({ from: r.from, arg: r.to, entity: { x, y, z, vx, vy: 0, vz, yaw, pitch: 0, teleportDirection: r.teleportDirection }, teleporter: teleporterOf(w), spawn: { x: 3, z: -5 }, heightAt: () => 64 });
    near(arr(e), [...r.after.slice(0, 6), r.after[6] % 360, r.after[7]], `transfer #${r.index} ${r.from}->${r.to}`);
  }
});

test("travelToDimension replay: Nether, Overworld, End and the End exit to the spawn point", () => {
  const height = (x, z) => 64 + ((((x * 7 + z * 13) % 9) + 9) % 9);
  for (const r of of("travel")) {
    const spawn = r.ops.filter((o) => o.op === "spawn").pop(), dim = spawn.dim;
    const w = sparse(dim, r.seed), [x, y, z, vx, vz, yaw, tdir] = r.before;
    const res = placeAfterTravel({ from: r.from, arg: r.to, entity: { x, y, z, vx, vy: 0, vz, yaw, pitch: 0, teleportDirection: tdir }, teleporter: teleporterOf(w), spawn: { x: 3, z: -5 }, heightAt: height });
    assert.equal(res.to, dim, `travel #${r.index} target dimension`);
    near(arr(res.e), spawn.entity, `travel #${r.index} ${r.from}->${r.to}`);
    assert.equal(spawn.cooldown, 300);
  }
});

test("PortalCooldown NBT round trip: saved as an int, restored, copied; the portal counter is not saved", () => {
  const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  for (const r of of("nbt")) {
    assert.equal(r.read, r.cooldown); assert.equal(r.copied, r.cooldown); assert.equal(r.counterAfterRead, 0);
    const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, portalCooldown: r.cooldown }], () => 0.5);
    const saved = mobs.serialize()[0];
    assert.equal(saved.portalCooldown ?? 0, r.cooldown);
    assert.equal(new EntityWorld(air, [saved], () => 0.5).entities[0].portalCooldown ?? 0, r.cooldown);
  }
});

test("mob yaw conversion round-trips", () => { assert.ok(Math.abs(mobYawToMc(mcToMobYaw(123)) - 123) < 1e-9); });

// ---- the live path ----
const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const makeRoot = (extra = {}) => ({ id: "w1", seed: "42", biome: "javaStreamed", chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} }, ...extra });
const makeLive = (root) => {
  let dirty = 0;
  const live = new DimensionLive({ active: () => root, worlds: () => [root], dirty: () => dirty++, save: async () => {}, sound() {}, player: () => ({ x: 64.5, y: 5, z: 64.5, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  return { live, dirty: () => dirty };
};
const portalWorld = (dim = 0) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y >= 4 && y <= 7 ? GAME_IDS.portal : y < 0 ? 1 : 0) });

test("a mob in an Overworld portal ends up in the Nether's saved entities at the teleported position", async () => {
  const root = makeRoot(), { live, dirty } = makeLive(root);
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }], () => 0.5), world = portalWorld(0);
  const stay = { id: "mob-2", type: "pig", x: 10.5, y: 5, z: 10.5, health: 10 };
  mobs.entities.push(mobs.restore(stay));
  live.tickEntities(world, { mobs });
  assert.equal(mobs.entities.length, 2, "the collision tick only sets inPortal");
  live.tickEntities(world, { mobs });
  assert.equal(mobs.entities.length, 1, "the next tick travels");
  await live.settle();
  const inbox = root.portalArrivals[-1];
  assert.equal(inbox.entities.length, 1);
  const rec = inbox.entities[0];
  assert.equal(rec.type, "pig"); assert.equal(rec.portalCooldown, 300);
  assert.ok(Math.abs(rec.x - 8) < 40 && Math.abs(rec.z - 8) < 40, `${rec.x},${rec.z}`);
  assert.ok(inbox.writes.length > 0, "the Teleporter built a portal for it");
  assert.ok(dirty() > 0);
  // The saved Nether view receives it; the root's inbox is cleared once the view is stored.
  const view = viewRecord(root, -1);
  assert.equal(view.pendingArrivals, inbox);
  live.deliverArrivals({ set() {} }, view);
  assert.equal(view.entities.length, 1); assert.equal(view.pendingArrivals, undefined);
  const stored = storedRecord(view, root);
  assert.equal(stored.portalArrivals, undefined);
  assert.equal(stored.dimensions[-1].state.entities.length, 1);
  assert.equal(stored.dimensions[-1].state.entities[0].portalCooldown, 300);
  // It spawns in the Nether and stays there: the cooldown stops an immediate bounce back while it stands in the portal.
  const nether = new EntityWorld({ ...air, dimension: -1 }, stored.dimensions[-1].state.entities.map((e) => ({ ...e, x: 64.5, y: 5, z: 64.5 })), () => 0.5);
  assert.equal(nether.entities.length, 1);
  assert.equal(nether.entities[0].portalCooldown, 300);
  for (let i = 0; i < 6; i++) { live.tickEntities(portalWorld(-1), { mobs: nether }); assert.equal(nether.entities.length, 1); assert.equal(nether.entities[0].portalCooldown, 300); }
});

test("a leashed mob loses its holder and a lead drops in the new dimension", async () => {
  const root = makeRoot(), { live } = makeLive(root);
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, leash: { holder: "player" } }], () => 0.5), world = portalWorld(0);
  live.tickEntities(world, { mobs }); live.tickEntities(world, { mobs });
  await live.settle();
  const inbox = root.portalArrivals[-1];
  assert.equal(inbox.entities[0].leash, undefined);
  assert.equal(inbox.drops.length, 1);
  assert.equal(inbox.drops[0].stack.count, 1);
});

test("dropped items and experience orbs travel too and keep their cooldown", async () => {
  const root = makeRoot(), { live } = makeLive(root), items = new ItemEntities(() => 0.5), xpOrbs = new ExperienceOrbs();
  items.spawn({ id: 4, count: 3, damage: 0 }, 64.5, 5.125, 64.5, { motion: [0, 0, 0] });
  xpOrbs.spawn(3, { x: 64.5, y: 5.25, z: 64.5 });
  const world = portalWorld(0);
  live.tickEntities(world, { items, xpOrbs }); live.tickEntities(world, { items, xpOrbs });
  await live.settle();
  assert.equal(items.items.length, 0); assert.equal(xpOrbs.orbs.length, 0);
  const inbox = root.portalArrivals[-1];
  assert.equal(inbox.drops.length, 1); assert.equal(inbox.xpOrbs.length, 1);
  assert.equal(inbox.drops[0].portalCooldown, 300); assert.equal(inbox.xpOrbs[0].portalCooldown, 300);
  const loaded = new ItemEntities(() => 0.5); loaded.load(inbox.drops, (s) => s, 0);
  assert.equal(loaded.items[0].portalCooldown, 300); assert.equal(loaded.items[0].stack.count, 3);
  assert.equal(new ExperienceOrbs(inbox.xpOrbs).orbs[0].portalCooldown, 300);
});

test("an End portal sends a mob to the End platform at (100, 49, 0)", async () => {
  const root = makeRoot(), { live } = makeLive(root);
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }], () => 0.5);
  const world = { dimension: 0, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.endPortal : 0) };
  live.tickEntities(world, { mobs });
  await live.settle();
  const rec = root.portalArrivals[1].entities[0];
  assert.deepEqual([rec.x, rec.y, rec.z], [100, 49, 0]);
  assert.equal(rec.portalCooldown, undefined, "End portal travel writes no cooldown");
});

test("the player's tamed wolf and leashed mobs do not follow through a portal", async () => {
  const wolf = { id: "mob-1", type: "wolf", x: 64.5, y: 5, z: 65.5, health: 20, owner: "Steve", leash: undefined };
  const cow = { id: "mob-2", type: "cow", x: 66.5, y: 5, z: 64.5, health: 10, leash: { holder: "player" } };
  const root = makeRoot({ entities: [wolf, cow] });
  let opened = null;
  const live = new DimensionLive({ active: () => root, worlds: () => [root], save: async () => {}, sound() {}, player: () => ({ x: 64.5, y: 5, z: 64.5, yaw: 0 }), openWorld: async (r) => { opened = r; } });
  assert.equal(await live.travel(-1), true);
  assert.equal(opened.dimension, -1);
  assert.equal(root.portalArrivals, undefined, "nothing is carried along by the player");
  assert.equal(root.entities.length, 2);
  assert.equal(viewRecord(root, -1).entities, undefined, "the Nether view starts without them");
  assert.equal(root.entities[1].leash.holder, "player", "the leashed cow stays in the Overworld with its leash");
});

test("the Teleporter is shared per target dimension so a second mob reuses the first one's portal", async () => {
  const root = makeRoot(), { live } = makeLive(root);
  const mobs = new EntityWorld(air, [], () => 0.5);
  for (let i = 0; i < 2; i++) mobs.entities.push(mobs.restore({ id: `mob-${i + 1}`, type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }));
  const world = portalWorld(0);
  live.tickEntities(world, { mobs }); live.tickEntities(world, { mobs });
  await live.settle();
  const inbox = root.portalArrivals[-1];
  assert.equal(inbox.entities.length, 2);
  assert.ok(Math.abs(inbox.entities[0].x - inbox.entities[1].x) < 3 && Math.abs(inbox.entities[0].z - inbox.entities[1].z) < 3);
  const frames = new Set(inbox.writes.filter((w) => w[3] === GAME_IDS.portal).map((w) => w.slice(0, 3).join())).size;
  assert.ok(frames > 0 && frames <= 6, `only one portal was built (${frames} portal cells)`);
  void JavaRandom;
});

test("a spider jockey in an End portal or a Nether portal stays put: neither mob travels and no link dangles", async () => {
  for (const [world, key] of [[{ dimension: 0, get: (x, y, z) => (x === 64 && z === 64 && y >= 4 && y <= 7 ? GAME_IDS.endPortal : 0) }, 1], [portalWorld(0), -1]]) {
    const root = makeRoot(), { live } = makeLive(root);
    const mobs = new EntityWorld(air, [
      { id: "mob-1", type: "spider", x: 64.5, y: 5, z: 64.5, health: 16 },
      { id: "mob-2", type: "skeleton", x: 64.5, y: 5.2, z: 64.5, health: 20, riding: "mob-1" },
    ], () => 0.5);
    for (let i = 0; i < 4; i++) live.tickEntities(world, { mobs });
    await live.settle();
    assert.equal(mobs.entities.length, 2);
    assert.equal(root.portalArrivals?.[key], undefined);
    const [spider, skeleton] = mobs.entities;
    assert.equal(skeleton.ridingEntity, spider);
    assert.equal(spider.riddenBy, skeleton);
  }
});
