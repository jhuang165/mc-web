// Batch 70 mpclicks: entity-click reach (nh.a(ja) bytecode-read: posY to posY, 36 or 9 without sight), a boat pushed by a piston is blocked by hanging entities (xi.h),
// an arrow summoned stuck in the End, and mapData through a real socket. Facts: .shared-memory/notes/mpclicks-b70-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { useEntityInReach } from "./multiplayer/use-entity-reach.js";
import { Hanging } from "./hanging.js";
import { pistonPushExtras } from "./piston-push.js";
import { Boats } from "./boats.js";
import { Minecarts, Y_OFFSET } from "./minecarts.js";
import { serverPosY } from "./sleeper-eye.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OK = "Object successfully summoned";
function fixture() {
  const world = new World("b70-mpclicks");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "creative" }), inbox = {};
  sim.mobs.mobs.entities.length = 0;
  const social = new ServerSocial({ simulation: sim, ops: ["Alex"], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const say = (line) => { inbox.a = []; social.command("a", line); return (inbox.a ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, p, say, world };
}

// ---- (1) use-entity reach ----
test("useEntityInReach: posY to posY under 36, under 9 without sight; a sleeper starts from minY + 0.2", () => {
  const world = new World("b70-reach");
  for (let x = 0; x <= 20; x++) for (let z = 0; z <= 20; z++) for (let y = 0; y <= 20; y++) world.put(x, y, z, y === 0 ? 3 : 0, 0, false);
  const p = { position: { x: 5.5, y: 1, z: 5.5 }, sleeping: false };
  const at = (dx, dy, eye = 0) => ({ x: 5.5 + dx, y: 1 + dy, z: 5.5, eye });
  assert.equal(useEntityInReach(world, p, at(5.9, 0)), true, "5.9 < 6");
  assert.equal(useEntityInReach(world, p, at(6, 0)), false, "36 is refused (strict <)");
  assert.equal(useEntityInReach(world, p, at(5.9, 2)), false, "posY difference counts: 5.9^2 + 4 > 36");
  assert.equal(useEntityInReach(world, p, at(5.9, 0.5)), true, "5.9^2 + .25 = 35.06, in sight");
  // behind a wall: 5 away is over 9, so the sight test applies
  for (let y = 1; y <= 5; y++) world.put(8, y, 5, 1, 0, false);
  assert.equal(useEntityInReach(world, p, at(5, 0, 1.0)), false, "wall between the eyes: limit 9");
  assert.equal(useEntityInReach(world, p, at(2.9, 0, 1.0)), true, "inside 9 needs no sight");
  world.put(8, 3, 5, 0, 0, false); world.put(8, 2, 5, 0, 0, false); world.put(8, 1, 5, 0, 0, false); world.put(8, 4, 5, 0, 0, false); world.put(8, 5, 5, 0, 0, false);
  assert.equal(useEntityInReach(world, p, at(5, 0, 1.0)), true, "wall removed: seen, limit 36");
  // a sleeper's posY is minY + 0.2: a target 6.1 above the box floor is 5.9 above posY
  const s = { position: { x: 5.5, y: 1, z: 5.5 }, sleeping: true };
  assert.ok(Math.abs(serverPosY(1, true) - 1.2) < 1e-6);
  assert.equal(useEntityInReach(world, s, at(0, 6.1)), true, "5.9^2 = 34.8 from posY 1.2");
  assert.equal(useEntityInReach(world, p, at(0, 6.1)), false, "6.1^2 = 37.2 from posY 1.0");
});

// ---- (2) a pushed boat vs hanging entities ----
test("a boat pushed into a painting stops at it; a minecart passes through (EntityBoat.getCollisionBox, not EntityMinecart's)", () => {
  const world = { get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0, set() {} };
  const run = (kind) => {
    const h = new Hanging({ ids: undefined });
    // a painting facing 0 hangs on the z = 11 wall cell; it occupies cells around x = 10..11 at z ~ 10.9 .. 11
    const painting = h.make("painting", 0, 10, 0, 10); h.entities.push(painting);
    const boats = new Boats(), carts = new Minecarts();
    const box = painting.bb;
    const cz = (box[2] + box[5]) / 2, cx = (box[0] + box[3]) / 2;
    const veh = kind === "boat" ? boats.spawnBoat({ x: cx - 3, y: 0, z: cz }, { seed: 1 }) : carts.spawnEmpty({ x: cx - 3, y: Y_OFFSET, z: cz }, { seed: 1 });
    const extras = pistonPushExtras(world, { minecarts: () => carts, boatSystem: () => boats, hanging: () => h, hangingDrops: () => {}, mobs: () => null, player: () => null });
    const mover = extras.find((x) => x.entity === veh);
    const before = veh.x;
    mover.move(4, 0, 0);
    return { moved: veh.x - before, painting, veh, box };
  };
  const boat = run("boat"), cart = run("cart");
  assert.ok(boat.moved < 4 - 1e-6, `boat blocked, moved ${boat.moved}`);
  assert.ok(boat.moved > 0, "it moves up to the painting");
  assert.ok(boat.veh.bb[3] <= boat.box[0] + 1e-6, "its east face stops at the painting's west face");
  assert.ok(Math.abs(cart.moved - 4) < 1e-6, `cart not blocked, moved ${cart.moved}`);
});

// ---- (3) an arrow stuck in the End through /summon ----
test("/summon Arrow with xTile/zTile in the End: the stuck arrow stays in the block at the shifted cell", () => {
  const f = fixture(); f.sim.dimensions.arrive(f.p, 1);
  const w = f.p.world;
  assert.deepEqual([w.originX, w.originZ], [-128, -128]);
  const lx = 133, lz = 133, ly = 60; // native (5, 60, 5)
  w.put(lx, ly, lz, 3, 0, false); // the port's id for original stone (java-projectiles fromOriginal)
  assert.deepEqual(f.say(`/summon Arrow 5.5 60.5 5.5 {xTile:5,yTile:60,zTile:5,inTile:1,inData:0,inGround:1b,pickup:0b,life:0}`), [OK]);
  const lanes = [f.sim.dispense, f.sim.dimensions.end?.n?.dispense].filter(Boolean);
  const arrows = lanes.flatMap((d) => d.arrows?.list ?? []);
  const a = arrows.find((x) => Math.abs(x.x - 133.5) < 1e-6);
  assert.ok(a, "the arrow is at the local place");
  assert.deepEqual([a.xTile, a.yTile, a.zTile], [lx, ly, lz], "tile mapped by the End origin");
  assert.equal(a.inGround, true);
  assert.equal(a.inTile, 3);
  for (let i = 0; i < 5; i++) f.sim.tick();
  assert.equal(a.inGround, true, "the block at the shifted cell holds it; unshifted it would fall");
  assert.equal(a.dead, false);
  w.put(lx, ly, lz, 0, 0, false);
  for (let i = 0; i < 3; i++) f.sim.tick();
  assert.equal(a.inGround, false, "removing the block at the shifted cell releases it");
});

// ---- (4) maps: the S34 payload has no frame ids (ayi.a(byte[]) keys "icon-<i>", bytecode-read), and mapData over a real socket ----
test("mapData through a real WebSocket: a held map reaches the client copy with its colours, scale and icons keyed icon-<i>", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os"), path = await import("node:path"), { once } = await import("node:events");
  const { WebSocket } = await import("ws");
  const { createDedicatedServer } = await import("../server/server.js");
  const { PROTOCOL } = await import("./multiplayer/protocol.js");
  const { mapStore, MapStore, ITEM_EMPTY_MAP, ITEM_FILLED_MAP, MAP_BYTES } = await import("./maps.js");
  const { applyMapMessage } = await import("./multiplayer/client-maps.js");
  const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179";
  const world = new World("b70-mapsocket");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : y === 10 && (x + z) % 7 === 0 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false, gameMode: "survival" });
  mapStore.load(null);
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-mpclicks-"));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation: sim, tickMs: 10, saveMs: 60000 });
  let ws = null;
  t.after(async () => { try { ws?.close(); } catch {} await app.close(); await rm(dir, { recursive: true, force: true }); mapStore.load(null); });
  const session = (await app.accounts.register({ invite: token, name: "Alice", password: "correct horse" }, token)).session;
  ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin });
  const seen = [];
  ws.on("message", (d) => seen.push(JSON.parse(d)));
  await once(ws, "open");
  ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session }));
  const until = async (pred, label) => { for (let i = 0; i < 800; i++) { const m = seen.find(pred); if (m) return m; await new Promise((r) => setTimeout(r, 10)); } throw new Error("timeout: " + label); };
  const welcome = await until((m) => m.type === "welcome", "welcome");
  const p = sim.players.get(welcome.id);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  p.survival.inventory.main.fill(null); p.survival.inventory.current = 0;
  p.survival.inventory.main[0] = { id: ITEM_EMPTY_MAP, count: 1, damage: 0 };
  assert.equal(sim.maps.useEmpty(p), true);
  assert.equal(p.survival.inventory.main[0].id, ITEM_FILLED_MAP);
  const serverData = sim.maps.store.get(p.survival.inventory.main[0].damage);
  assert.ok(serverData);
  const client = new MapStore();
  client.remote = true;
  let applied = 0, next = 0;
  const same = () => { const c = client.get(serverData.id); return c && c.scale === serverData.scale && c.colors.every((v, i) => v === serverData.colors[i]); };
  for (let i = 0; i < 800 && !same(); i++) {
    for (; next < seen.length; next++) if (seen[next].type === "mapData") applied += applyMapMessage(seen[next], client);
    if (!same()) await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(applied > 0, "mapData arrived");
  const copy = client.get(serverData.id);
  assert.ok(copy, "the client created the map it was sent");
  assert.equal(copy.scale, serverData.scale);
  assert.equal(copy.colors.length, MAP_BYTES);
  assert.ok(same(), "every column of the server's colours reached the client");
  assert.ok(copy.colors.some((v) => v !== 0), "not an empty map");
  const keys = [...copy.decorations.keys()];
  assert.ok(keys.length >= 1 && keys.every((k, i) => k === `icon-${i}`), `client icons are keyed icon-<i> like ayi.a(byte[]): ${keys}`);
  assert.equal(copy.decorations.size, serverData.decorations.size, "one icon per server decoration (the player's marker)");
});
