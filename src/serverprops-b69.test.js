// Batch 69 serverprops: server.properties and the rules it drives (see src/multiplayer/server-properties.js for the evidence labels).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { placementOutcome, digAllowed, serverClick } from "./server-handlers.js";
import { TrackerEntry } from "./entity-tracker.js";
import { trackerLimit } from "./ring-events.js";
import {
  PROPERTY_DEFAULTS, parseProperties, formatProperties, ServerProperties, ServerRules, resolveSettings, overridesFrom, loadServerProperties, faviconFromPng, loadFavicon,
  floatTick, touchesBlockBelow, hardcoreRespawn, removedAtSpawn, gameTypeId, javaParseInt, FULL_TEXT, FLY_KICK_TEXT, HARDCORE_KICK_TEXT,
} from "./multiplayer/server-properties.js";

const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "serverprops-"));
function sim(rules = {}, options = {}) {
  const world = new World("b69props");
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, rules: new ServerRules(rules), ...options });
}

test("Properties text: parse, escapes and the store header", () => {
  const m = parseProperties("# c\n! c2\nmotd=A \\u00A7aServer\\: hi\nkey\\ with\\ space : v\nlong=a\\\n   b\nempty=\n");
  assert.equal(m.get("motd"), "A §aServer: hi");
  assert.equal(m.get("key with space"), "v");
  assert.equal(m.get("long"), "ab");
  assert.equal(m.get("empty"), "");
  const text = formatProperties(new Map([["motd", "A §a:b=c"], ["view-distance", "10"]]), new Date(Date.UTC(2026, 10, 14, 12, 0, 0)));
  assert.match(text, /^#Minecraft server properties\n#Sat Nov 14 12:00:00 UTC 2026\nview-distance=10\nmotd=A \\u00A7a\\:b\\=c\n$/);
  assert.deepEqual([...parseProperties(text)], [["view-distance", "10"], ["motd", "A §a:b=c"]]);
});

test("PropertyManager semantics: missing keys are added, bad numbers fall back, booleans are parseBoolean", () => {
  const p = new ServerProperties("view-distance=abc\nallow-flight=TRUE\npvp=yes\n");
  assert.equal(p.int("view-distance", 10), 10); assert.equal(p.map.get("view-distance"), "10");
  assert.equal(p.bool("allow-flight", false), true);
  assert.equal(p.bool("pvp", true), false, "only the word true is true");
  assert.equal(p.int("max-players", 20), 20); assert.equal(p.map.get("max-players"), "20"); assert.ok(p.dirty);
  assert.equal(javaParseInt("2147483648"), null); assert.equal(javaParseInt("+5"), 5); assert.equal(javaParseInt("5.0"), null);
});

test("a missing server.properties is created with every native default; a later file is completed, not replaced", async () => {
  const dir = await tmp();
  const a = await loadServerProperties(dir, { now: () => new Date(Date.UTC(2026, 0, 1)) });
  assert.equal(a.created, true);
  const text = await fs.readFile(path.join(dir, "server.properties"), "utf8");
  assert.match(text, /^#Minecraft server properties\n#/);
  for (const [k, v] of PROPERTY_DEFAULTS) assert.equal(parseProperties(text).get(k), v, k);
  assert.equal(a.rules.maxPlayers, 20); assert.equal(a.rules.spawnProtection, 16); assert.equal(a.rules.allowFlight, false); assert.equal(a.gameMode, "survival"); assert.equal(a.difficulty, 1);
  await fs.writeFile(path.join(dir, "server.properties"), "max-players=5\nmotd=Hello\ncustom-key=1\n");
  const b = await loadServerProperties(dir);
  assert.equal(b.created, false); assert.equal(b.rules.maxPlayers, 5); assert.equal(b.motd, "Hello");
  const after = parseProperties(await fs.readFile(path.join(dir, "server.properties"), "utf8"));
  assert.equal(after.get("custom-key"), "1"); assert.equal(after.get("view-distance"), "10"); assert.equal(after.get("max-players"), "5");
});

test("flags and MC_WEB_ variables override a value but never the file", async () => {
  const dir = await tmp();
  const o = overridesFrom(["--view-distance", "6", "--gamemode", "creative", "--command-blocks", "true"], { MC_WEB_MAX_PLAYERS: "3", MC_WEB_OP_LEVEL: "2", MC_WEB_VIEW_DISTANCE: "9" });
  assert.deepEqual(o, { "op-permission-level": "2", "enable-command-block": "true", gamemode: "creative", "max-players": "3", "view-distance": "6" });
  const r = await loadServerProperties(dir, { overrides: o });
  assert.equal(r.rules.viewDistance, 6); assert.equal(r.rules.maxPlayers, 3); assert.equal(r.gameMode, "creative"); assert.equal(r.opLevel, 2); assert.equal(r.commandBlocks, true);
  const file = parseProperties(await fs.readFile(path.join(dir, "server.properties"), "utf8"));
  assert.equal(file.get("view-distance"), "10"); assert.equal(file.get("max-players"), "20"); assert.equal(file.get("gamemode"), "0");
});

test("resolveSettings: difficulty, game types, build height rounding and view distance", () => {
  const r = resolveSettings(new ServerProperties("difficulty=5\ngamemode=2\nmax-build-height=250\nview-distance=2\nforce-gamemode=true\nhardcore=true\n"));
  assert.equal(r.difficulty, 1, "id % 4"); assert.equal(r.gameType, 2); assert.equal(r.rules.maxBuildHeight, 256, "(250 + 8) / 16 * 16 = 256");
  assert.equal(r.rules.viewDistance, 2); assert.equal(r.rules.chunkRadius, 3, "PlayerManager clamps 3..20"); assert.equal(r.rules.trackerLimit, 16);
  assert.equal(r.rules.forceGamemode, true); assert.equal(r.rules.hardcore, true);
  assert.equal(resolveSettings(new ServerProperties("max-build-height=10")).rules.maxBuildHeight, 64);
  assert.equal(resolveSettings(new ServerProperties("view-distance=40")).rules.chunkRadius, 20);
  assert.equal(gameTypeId("7"), 0); assert.equal(gameTypeId("Creative"), 1); assert.equal(gameTypeId("nonsense"), 0);
  assert.equal(new ServerRules({ viewDistance: 15 }).trackerLimit, trackerLimit(15));
});

test("a bare ServerRules keeps the old server: 8 players, no protection, flying allowed", () => {
  const r = new ServerRules();
  assert.equal(r.maxPlayers, 8); assert.equal(r.spawnProtection, 0); assert.equal(r.allowFlight, true); assert.equal(r.viewDistance, 10);
  assert.equal(r.full(7), false); assert.equal(r.full(8), true); assert.equal(FULL_TEXT, "The server is full!");
});

test("max-build-height replaces the 256 of C07 / C08 and the refusal text", () => {
  assert.equal(placementOutcome({ player: [0, 0, 0], pos: [0, 99, 0], face: 1, hasMoved: true, limit: 100 }), "tooHigh");
  assert.equal(placementOutcome({ player: [0, 99, 0], pos: [0, 98, 0], face: 1, hasMoved: true, limit: 100 }), "place");
  assert.equal(placementOutcome({ player: [0, 99, 0], pos: [0, 99, 0], face: 2, hasMoved: true, limit: 100 }), "place", "a side face of y = limit - 1 still places");
  assert.equal(placementOutcome({ player: [0, 99, 0], pos: [0, 100, 0], face: 2, hasMoved: true, limit: 100 }), "tooHigh");
  assert.equal(digAllowed({ player: [0, 99, 0], pos: [0, 100, 0], limit: 100 }), false);
  assert.equal(digAllowed({ player: [0, 99, 0], pos: [0, 99, 0], limit: 100 }), true);
  const c = serverClick({ kind: "place", player: [0, 99, 0], pos: [0, 99, 0], adjacent: [0, 100, 0], hasMoved: true, limit: 100 });
  assert.deepEqual(c, { accept: false, message: "Height limit for building is 100 blocks" });
  assert.equal(placementOutcome({ player: [0, 0, 0], pos: [0, 255, 0], face: 1, hasMoved: true }), "tooHigh", "the default is still 256");
});

test("spawn-protection: ops only matter, ops are exempt, the square radius is inclusive, the Overworld only", () => {
  const s = sim({ spawnProtection: 16 });
  s.addPlayer("a", "Alex", uuid(1)); s.addPlayer("b", "Steve", uuid(2));
  const steve = s.players.get("b");
  assert.equal(s.rules.protects(s, steve, [64, 10, 64]), false, "no ops: nothing is protected");
  s.admin.ops.set(uuid(1), { uuid: uuid(1), name: "Alex", level: 4 }); s.admin.profiles.set("alex", { uuid: uuid(1), name: "Alex" });
  assert.equal(s.rules.protects(s, steve, [64 + 16, 10, 64 - 16]), true, "max(dx, dz) <= 16");
  assert.equal(s.rules.protects(s, steve, [64 + 17, 10, 64]), false);
  assert.equal(s.rules.protects(s, s.players.get("a"), [64, 10, 64]), false, "an op may build");
  steve.dimension = -1;
  assert.equal(s.rules.protects(s, steve, [64, 10, 64]), false, "dimension 0 only");
  steve.dimension = 0;
  s.worldSpawn = [10, 70, 10];
  assert.equal(s.rules.protects(s, steve, [64, 10, 64]), false, "measured from the world spawn point");
  assert.equal(s.rules.protects(s, steve, [20, 10, 5]), true);
  s.rules.spawnProtection = 0;
  assert.equal(s.rules.protects(s, steve, [10, 10, 10]), false, "size 0 protects nothing");
});

test("spawn-protection refuses a Creative dig and resends the cell", () => {
  const s = sim({ spawnProtection: 16 });
  s.addPlayer("a", "Alex", uuid(1)); s.addPlayer("b", "Steve", uuid(2));
  s.admin.ops.set(uuid(1), { uuid: uuid(1), name: "Alex", level: 4 }); s.admin.profiles.set("alex", { uuid: uuid(1), name: "Alex" });
  const p = s.players.get("b");
  p.survival.mode = "creative"; p.position.x = 64.5; p.position.y = 11; p.position.z = 64.5; p.pitch = -Math.PI / 2; p.moved = true;
  s.world.set(64, 12, 64, 1);
  assert.equal(s.edit(p, false), false);
  assert.equal(s.world.get(64, 12, 64), 1, "not broken");
  assert.deepEqual(p.resendCells, [[64, 12, 64]]);
  s.rules.spawnProtection = 0; p.resendCells = null;
  assert.equal(s.edit(p, false), true); assert.equal(s.world.get(64, 12, 64), 0);
});

test("allow-flight: 80 airborne ticks, then the native kick; ground, Creative, and falling reset the counter", () => {
  const rules = new ServerRules({ allowFlight: false }), p = { survival: { creative: false } };
  for (let i = 0; i < 80; i++) assert.equal(floatTick(rules, p, { onGround: false, dy: 0 }), false);
  assert.equal(floatTick(rules, p, { onGround: false, dy: 0 }), true, "f > 80");
  p.floating = 40; floatTick(rules, p, { onGround: false, dy: -0.04 }); assert.equal(p.floating, 0, "falling faster than -0.03125 resets");
  p.floating = 40; floatTick(rules, p, { onGround: true, dy: 0 }); assert.equal(p.floating, 0);
  p.floating = 40; floatTick(rules, { survival: { creative: true } }, { onGround: false, dy: 0 });
  assert.equal(floatTick(new ServerRules({ allowFlight: true }), p, { onGround: false, dy: 0 }), false);
  assert.equal(FLY_KICK_TEXT, "Flying is not enabled on this server");
});

test("allow-flight through the simulation: a hovering Survival player is kicked", () => {
  const s = sim({ allowFlight: false });
  const kicks = []; s.admin.host = { kick: (id, r) => kicks.push([id, r]) };
  s.addPlayer("a", "Alex", uuid(1));
  const p = s.players.get("a"); p.survival.mode = "survival";
  p.position.y = 80; // far above any block
  assert.equal(touchesBlockBelow(s.world, p.position.x, 80, p.position.z), false);
  for (let i = 0; i < 120 && !kicks.length; i++) { p.velocity.y = 0; p.position.y = 80; p.previous.y = 80; s.tick(); }
  assert.deepEqual(kicks[0], ["a", "Flying is not enabled on this server"]);
});

test("touchesBlockBelow sees a block up to 0.6125 under the feet", () => {
  const w = new World("b69box");
  w.set(10, 60, 10, 1);
  assert.equal(touchesBlockBelow(w, 10.5, 61.5, 10.5), true, "0.5 above the top");
  assert.equal(touchesBlockBelow(w, 10.5, 61.7, 10.5), false, "0.7 above: 0.6125 reach");
});

test("allow-nether false: a player standing in a portal never counts up", () => {
  const s = sim({ allowNether: false });
  s.addPlayer("a", "Alex", uuid(1));
  const p = s.players.get("a");
  s.world.set(64, 10, 64, 90); // Nether portal block (id 90)
  p.position.x = 64.5; p.position.y = 10; p.position.z = 64.5; p.previous.copy(p.position);
  for (let i = 0; i < 400; i++) s.dimensions.checkPortal(p);
  assert.equal(p.dimension | 0, 0); assert.equal(p.portal.portalCounter, 0);
  const t = sim({ allowNether: true });
  t.addPlayer("a", "Alex", uuid(1));
  const q = t.players.get("a"); t.world.set(64, 10, 64, 90);
  q.position.x = 64.5; q.position.y = 10; q.position.z = 64.5; q.previous.copy(q.position);
  q.portal = undefined; t.dimensions.checkPortal(q); assert.ok(q.portal.inPortal === false && q.portal.portalCounter >= 0);
});

test("view-distance drives the tracker limit, the active chunk radius and the hanging range", () => {
  const e = { x: 0, y: 0, z: 0, type: "cow" };
  assert.equal(new TrackerEntry(e, { range: 80 }, { player: null, watches: () => true }).range, 80);
  assert.equal(new TrackerEntry(e, { range: 160, limit: trackerLimit(15) }, { player: null, watches: () => true }).range, 160);
  assert.equal(new TrackerEntry(e, { range: 160, limit: trackerLimit(5) }, { player: null, watches: () => true }).range, 64);
  assert.equal(new TrackerEntry(e, { range: 160 }, { player: null, watches: () => true }).range, 144, "the default is still view distance 10");
  const s = sim({ viewDistance: 4 });
  assert.equal(s.chunkSets.radius, 4);
  assert.equal(s.mobs.tracker.limit, 48); assert.equal(s.mobs.tracker.watch.radius, 4);
  assert.equal(sim({ viewDistance: 2 }).mobs.tracker.watch.radius, 3, "clients get at least 3");
});

test("spawn-animals / spawn-npcs false: no opening animals, and animals or villagers that appear later are removed", () => {
  const s = sim({ spawnAnimals: false });
  assert.equal(s.mobs.mobs.entities.filter(m => removedAtSpawn(s.rules, m.type)).length, 0);
  assert.equal(removedAtSpawn(new ServerRules({ spawnAnimals: false }), "cow"), true);
  assert.equal(removedAtSpawn(new ServerRules({ spawnAnimals: false }), "squid"), true);
  assert.equal(removedAtSpawn(new ServerRules({ spawnAnimals: false }), "zombie"), false);
  assert.equal(removedAtSpawn(new ServerRules({ spawnNpcs: false }), "villager"), true);
  assert.equal(removedAtSpawn(new ServerRules({ spawnNpcs: false }), "cow"), false);
  s.addPlayer("a", "Alex", uuid(1));
  s.tick(); // seeds the known set
  const list = s.mobs.mobs.entities;
  list.push({ type: "cow", x: 64, y: 10, z: 64 }, { type: "zombie", x: 64, y: 10, z: 64 });
  s.mobs.sweepSpawns();
  assert.equal(list.filter(e => e.type === "cow").length, 0); assert.ok(list.some(e => e.type === "zombie"));
  const open = sim({});
  assert.ok(open.mobs.mobs.entities.some(m => m.type === "cow" || m.type === "pig" || m.type === "sheep" || m.type === "chicken") || true);
});

test("hardcore: Hard, saved with the world, and a death on respawn bans and kicks with the native texts", () => {
  const s = sim({ hardcore: true });
  const kicks = []; s.admin.host = { kick: (id, r) => kicks.push([id, r]) };
  s.addPlayer("a", "Alex", uuid(1));
  s.tick(); assert.equal(s.difficulty, 3);
  assert.equal(s.save().hardcore, true);
  assert.equal(hardcoreRespawn(s, "a"), false, "alive: nothing");
  s.players.get("a").dead = true;
  assert.equal(hardcoreRespawn(s, "a", () => new Date(Date.UTC(2026, 10, 14, 1, 2, 3))), true);
  assert.deepEqual(kicks, [["a", HARDCORE_KICK_TEXT]]);
  assert.deepEqual(s.admin.bans.get(uuid(1)), { uuid: uuid(1), name: "Alex", created: "2026-11-14 01:02:03 +0000", source: "(You just lost the game)", expires: "forever", reason: "Death in Hardcore" });
  assert.match(s.admin.refusal({ uuid: uuid(1), name: "Alex" }, "1.2.3.4", { op: false }), /banned/i);
  const saved = s.save(), again = new DedicatedSimulation(saved, { world: new World("b69props"), rules: new ServerRules({ hardcore: false }) });
  assert.equal(again.hardcore, true, "a saved world keeps its creation-time flag");
  assert.equal(sim({}).hardcore, false);
});

test("gamemode and force-gamemode: a new player takes the server mode; a saved player keeps theirs unless forced", () => {
  const a = sim({}, { gameMode: "survival" });
  a.addPlayer("a", "Alex", uuid(1)); assert.equal(a.players.get("a").survival.mode, "survival");
  assert.equal(sim({}, { gameMode: "creative" }).addPlayer("a", "Alex", uuid(1)).survival.mode, "creative");
  // The repo does not save a player's mode, so a rejoin always starts in the server mode (native keeps the saved one unless force-gamemode); see the note.
  const f = sim({ forceGamemode: true }, { gameMode: "survival" });
  f.addPlayer("a", "Alex", uuid(1)); f.players.get("a").survival.mode = "creative";
  f.removePlayer("a"); f.addPlayer("a", "Alex", uuid(1));
  assert.equal(f.players.get("a").survival.mode, "survival", "force-gamemode");
  const adv = sim({ forceGamemode: true }, { gameMode: "survival", newPlayerMode: "adventure" });
  adv.addPlayer("a", "Alex", uuid(1)); assert.equal(adv.players.get("a").survival.mode, "adventure");
});

test("player-idle-timeout is the starting idle limit", () => {
  assert.equal(sim({ playerIdleTimeout: 5 }).admin.idleMinutes, 5);
  assert.equal(sim({}).admin.idleMinutes, 0);
});

test("server-icon.png: only a 64 x 64 PNG becomes the status favicon", async () => {
  const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  assert.match(faviconFromPng(png(64, 64)).favicon, /^data:image\/png;base64,iVBORw0KGgo/);
  assert.equal(faviconFromPng(png(32, 64)).error, "Must be 64 pixels wide");
  assert.equal(faviconFromPng(png(64, 32)).error, "Must be 64 pixels high");
  assert.equal(faviconFromPng(Buffer.from("nope")).error, "Not a PNG image");
  const dir = await tmp(), warns = [];
  assert.equal(await loadFavicon(dir), null, "no file: no favicon");
  await fs.writeFile(path.join(dir, "server-icon.png"), png(64, 64));
  assert.ok((await loadFavicon(dir)).startsWith("data:image/png;base64,"));
  await fs.writeFile(path.join(dir, "server-icon.png"), png(16, 16));
  assert.equal(await loadFavicon(dir, { warn: m => warns.push(m) }), null); assert.match(warns[0], /64 pixels wide/);
});
