// Runs tripwire scenarios through the unchanged original BlockTripWireHook (aog) and BlockTripWire
// (aof) inside the real World/Chunk harness of tools/probes/RedstoneProbe.java and through
// src/redstone.js, checks that every per-tick block/metadata change, call-log entry, sound, drop,
// pending tick and the world Random agree, and writes public/research/tripwire-reference.json for
// src/tripwire.test.js. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the
// guava / log4j-api / commons-lang3 / netty-all library JARs (MC_PROBE_LIBS or a launcher/gradle cache).
// Batch 17 probes shears disarm (onBlockHarvested via a scripted player), random ticks (both blocks
// tick randomly), projectile/bat entity classes and their doesEntityNotTriggerPressurePlate answers.
// Which entity classes call Entity.func_145775_I (sa.I, the only caller of onEntityCollidedWithBlock
// for moving entities) is checked with javap over the original classes (collisionCallers below);
// not probed: the client-side setBlockBoundsBasedOnState and running those entities' onUpdate.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replayScenario } from "../src/redstone.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);

const AIR = 0, STONE = 1, GLASS = 20, WIRE = 55, LAMP = 123, HOOK = 131, STRING = 132, PLATE = 70;
function scenario(name, { size, ticks, seed = 1, cells = {}, events = [], note, floor = true }) {
  const [dx, dy, dz] = size,
    grid = [];
  for (let x = 0; x < dx; x++)
    for (let y = 0; y < dy; y++)
      for (let z = 0; z < dz; z++) grid.push(String(cells[`${x},${y},${z}`] ?? (floor && y === 0 ? STONE : AIR)));
  return { name, note, origin: [0, 0, 0], size, ticks, seed, sky: 15, skylightSubtracted: 0, angle: 0, noSky: false, grid: grid.join(","), events };
}
const put = (c, x, y, z, v) => ((c[`${x},${y},${z}`] = v), c);
// Direction index of a hook: 3 = attached block at -x (string toward +x), 1 = at +x, 0 = at -z (toward +z), 2 = at +z.
// A line along x at row z: stone anchors at x0 and x1, hooks just inside.
const xLine = (c, x0, x1, z, { attachedBits = 0, strings = true, stringMeta = 0 } = {}) => {
  put(c, x0, 1, z, STONE); put(c, x1, 1, z, STONE);
  put(c, x0 + 1, 1, z, `${HOOK}:${3 | attachedBits}`); put(c, x1 - 1, 1, z, `${HOOK}:${1 | attachedBits}`);
  if (strings) for (let x = x0 + 2; x <= x1 - 2; x++) put(c, x, 1, z, stringMeta ? `${STRING}:${stringMeta}` : STRING);
  return c;
};
const SCENARIOS = [];
// 1. placement in order hook, strings, hook (flags 3), then walk an entity across and away.
{
  const c = {};
  put(c, 0, 1, 2, STONE); put(c, 7, 1, 2, STONE);
  const ev = [[1, "placehook", 1, 1, 2, HOOK, 3], [2, "place", 2, 1, 2, STRING, 0], [3, "place", 3, 1, 2, STRING, 0], [4, "place", 4, 1, 2, STRING, 0], [5, "place", 5, 1, 2, STRING, 0], [6, "placehook", 6, 1, 2, HOOK, 1],
    [10, "entity", 3, 1, 2, 1], [10, "collide", 3, 1, 2], [30, "unentity", 3, 1, 2], [45, "air", 4, 1, 2]];
  SCENARIOS.push(scenario("placement-then-trip", { size: [8, 3, 5], ticks: 60, cells: c, events: ev, note: "hook, four strings, hook placed with flags 3 (the 3-flag onBlockAdded runs), an entity trips the line at tick 10 and leaves at 30, a string is broken at 45" }));
}
// 2. hooks first then strings last, string placed with flags 2 (generation style) after the line exists.
{
  const c = xLine(new Object(), 0, 7, 2, { strings: false });
  const ev = [[1, "place2", 2, 1, 2, STRING, 4], [2, "place2", 3, 1, 2, STRING, 4], [3, "place2", 4, 1, 2, STRING, 4], [4, "place2", 5, 1, 2, STRING, 4], [8, "entity", 4, 1, 2, 2], [8, "collide", 4, 1, 2], [24, "unentity", 4, 1, 2]];
  SCENARIOS.push(scenario("flags2-placement", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "hooks with unattached metadata, strings written with flags 2 and metadata 4 (no onBlockAdded for the string's neighbours), then tripped by a player" }));
}
// 3. raw (inert generated) state: hooks 7/5 and strings meta 4, as the jungle pyramid writes it.
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity", 3, 1, 2, 0], [3, "collide", 3, 1, 2], [20, "unentity", 3, 1, 2]];
  SCENARIOS.push(scenario("generated-state-trip", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "the inert metadata the structure generator writes (hooks facing|4, strings 4) behaves like a settled line when an item entity touches it" }));
}
// 4. z-axis line plus both power outputs: hook strong power into the anchor block, wire and lamp.
{
  const c = {};
  put(c, 2, 1, 0, STONE); put(c, 2, 1, 7, STONE);
  put(c, 2, 1, 1, `${HOOK}:${0 | 4}`); put(c, 2, 1, 6, `${HOOK}:${2 | 4}`);
  for (let z = 2; z <= 5; z++) put(c, 2, 1, z, `${STRING}:4`);
  put(c, 2, 2, 0, WIRE); put(c, 2, 2, -1 + 0, WIRE);
  delete c["2,2,-1"];
  put(c, 3, 2, 0, WIRE); put(c, 4, 2, 0, LAMP); put(c, 3, 1, 0, STONE); put(c, 4, 1, 0, STONE);
  put(c, 1, 1, 7, STONE); put(c, 1, 2, 7, WIRE); put(c, 0, 2, 7, LAMP); put(c, 0, 1, 7, STONE);
  const ev = [[2, "entity", 2, 1, 3, 1], [2, "collide", 2, 1, 3], [20, "unentity", 2, 1, 3]];
  SCENARIOS.push(scenario("z-line-power", { size: [6, 4, 8], ticks: 40, cells: c, events: ev, note: "z-axis line; the powered hook strongly powers its anchor block, driving wire and lamp on top of and beside it" }));
}
// 5. suspended strings and hooks (air floor).
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 0, stringMeta: 2 });
  for (let x = 2; x <= 5; x++) c[`${x},0,2`] = AIR;
  for (let x = 0; x < 8; x++) for (let z = 0; z < 5; z++) if (z !== 2 || x < 2 || x > 5) c[`${x},0,${z}`] = STONE;
  for (let x = 2; x <= 5; x++) for (let z = 0; z < 5; z++) c[`${x},0,${z}`] = AIR;
  const ev = [[1, "notify", 3, 1, 2, STONE], [5, "place", 3, 0, 2, STONE, 0], [10, "place", 5, 0, 2, STONE, 0]];
  SCENARIOS.push(scenario("suspended-line", { size: [8, 3, 5], ticks: 20, cells: c, events: ev, note: "strings over a hole stay suspended (metadata 2); placing a floor block under one drops it because the suspended bit no longer matches" }));
}
// 6. break paths while powered.
for (const [name, target, tick, note] of [
  ["break-hook-powered", [1, 1, 2], 14, "the powered hook is broken: far hook and strings lose attached/powered, the hook drops"],
  ["break-string-powered", [4, 1, 2], 14, "a string is broken while an entity trips the line"],
  ["break-anchor", [0, 1, 2], 14, "the anchor block of a hook is broken, so the hook drops and the line unattaches"],
  ["break-floor-string", [3, 0, 2], 14, "the floor under a string is broken: the string's suspended bit no longer matches and it drops"],
]) {
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity", 3, 1, 2, 1], [3, "collide", 3, 1, 2], [tick, "air", ...target]];
  SCENARIOS.push(scenario(name, { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note }));
}
// 7. gaps and obstructions.
{
  const c = xLine({}, 0, 8, 2, { strings: false });
  put(c, 2, 1, 2, STRING); put(c, 3, 1, 2, GLASS); put(c, 4, 1, 2, STRING); put(c, 5, 1, 2, STRING); put(c, 6, 1, 2, STRING);
  const ev = [[1, "place", 2, 1, 2, STRING, 0], [4, "air", 3, 1, 2], [6, "place", 3, 1, 2, STRING, 0], [10, "place", 4, 1, 2, GLASS, 0], [14, "air", 4, 1, 2], [16, "place", 4, 1, 2, STRING, 0]];
  SCENARIOS.push(scenario("gap-and-obstruction", { size: [9, 3, 5], ticks: 30, cells: c, events: ev, note: "a glass block in the line, replaced by a string, then another obstruction, a gap and a refill" }));
}
// 8. range limit: hooks 41 and 42 cells away.
for (const gap of [41, 42]) {
  const c = {};
  const x1 = 1 + gap;
  put(c, 0, 1, 1, STONE); put(c, x1 + 1, 1, 1, STONE);
  put(c, 1, 1, 1, `${HOOK}:3`); put(c, x1, 1, 1, `${HOOK}:1`);
  for (let x = 2; x < x1; x++) put(c, x, 1, 1, STRING);
  const ev = [[1, "notify", 1, 1, 1, STRING], [1, "place", 2, 1, 1, STRING, 0], [5, "entity", 20, 1, 1, 1], [5, "collide", 20, 1, 1], [25, "unentity", 20, 1, 1]];
  SCENARIOS.push(scenario(`range-${gap}`, { size: [x1 + 2, 3, 3], ticks: 40, cells: c, events: ev, note: `far hook ${gap} cells from the first hook (the scan covers 41)` }));
}
// 9. facing mismatch and same-facing hooks.
{
  const c = xLine({}, 0, 7, 2, { strings: true });
  put(c, 6, 1, 2, `${HOOK}:3`);
  const ev = [[1, "place", 3, 1, 2, STRING, 0], [5, "entity", 3, 1, 2, 1], [5, "collide", 3, 1, 2], [25, "unentity", 3, 1, 2]];
  SCENARIOS.push(scenario("same-facing-hooks", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "both hooks face the same way: no far hook is found and the line never attaches" }));
}
// 10. disarmed string (shears) tripping and two entities of different kinds.
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  put(c, 3, 1, 2, `${STRING}:${4 | 8}`);
  const ev = [[3, "entity", 4, 1, 2, 1], [3, "collide", 4, 1, 2], [20, "unentity", 4, 1, 2]];
  SCENARIOS.push(scenario("disarmed-string", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "one disarmed string (metadata |8) is part of an attached line; tripping another string unattaches the line and never powers the hooks" }));
}
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity", 3, 1, 2, 0], [3, "collide", 3, 1, 2], [6, "entity", 4, 1, 2, 2], [6, "collide", 4, 1, 2], [14, "unentity", 3, 1, 2], [22, "unentity", 4, 1, 2]];
  SCENARIOS.push(scenario("two-strings-tripped", { size: [8, 3, 5], ticks: 50, cells: c, events: ev, note: "an item trips one string, a player a second; the line stays powered until both leave" }));
}
// 11. plate next to a hook anchor and a hook re-placed over a live line.
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity", 3, 1, 2, 1], [3, "collide", 3, 1, 2], [8, "air", 6, 1, 2], [10, "placehook", 6, 1, 2, HOOK, 1], [30, "unentity", 3, 1, 2]];
  SCENARIOS.push(scenario("hook-replaced-while-powered", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "the far hook is broken while powered and placed again: the line re-attaches and powers again if an entity is still there" }));
}
// 12. batch 17: shears disarm (BlockTripWire.onBlockHarvested), random ticks, projectile and bat entity classes.
// harvest: arg 1 = held item (0 empty hand, 1 shears, 2 a stick).
for (const [name, held, withEntity, note] of [
  ["shears-harvest-break-powered", 1, true, "a player trips the line, then breaks a string while holding shears: onBlockHarvested sets metadata |8 (flags 4), breakBlock then reports the disarmed meta to the hooks"],
  ["stick-harvest-break-powered", 2, true, "the same break with a stick in hand: no disarm, the powered line is told the string vanished"],
  ["empty-harvest-break-powered", 0, true, "the same break with an empty hand: getCurrentEquippedItem is null, no disarm"],
  ["shears-harvest-break-idle", 1, false, "shears break an idle attached string"],
  ["stick-harvest-break-idle", 2, false, "a stick breaks an idle attached string"],
]) {
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [];
  if (withEntity) ev.push([3, "entity", 3, 1, 2, 1], [3, "collide", 3, 1, 2]);
  ev.push([14, "harvest", 4, 1, 2, held], [14, "air", 4, 1, 2]);
  SCENARIOS.push(scenario(name, { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note }));
}
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "harvest", 3, 1, 2, 1], [8, "entity", 3, 1, 2, 1], [8, "collide", 3, 1, 2], [20, "unentity", 3, 1, 2], [24, "harvest", 1, 1, 2, 1], [26, "harvest", 5, 1, 2, 1]];
  SCENARIOS.push(scenario("shears-disarm-without-break", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "shears harvest on a string without removing it (flags 4: no neighbour update), a player then trips the disarmed string; harvests on the hooks do nothing" }));
}
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "harvest", 3, 1, 2, 1], [5, "entity", 4, 1, 2, 1], [5, "collide", 4, 1, 2], [20, "unentity", 4, 1, 2], [22, "air", 3, 1, 2], [24, "place", 3, 1, 2, STRING, 0]];
  SCENARIOS.push(scenario("shears-disarm-then-replace", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "a disarmed string stays in an attached line: another string trips the line, the disarmed one is ignored; it is then broken and replaced by a fresh armed string" }));
}
// Random ticks: both blocks tick randomly (header tripwireEntities.tickRandomly) and call updateTick.
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  put(c, 3, 1, 2, `${STRING}:${4 | 1}`);
  const ev = [[2, "randomtick", 3, 1, 2], [6, "entity", 3, 1, 2, 1], [8, "randomtick", 3, 1, 2], [9, "randomtick", 4, 1, 2], [20, "unentity", 3, 1, 2], [22, "randomtick", 3, 1, 2]];
  SCENARIOS.push(scenario("random-tick-string", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "a string stored active (meta 5) with nobody on it is re-sensed by a random tick and cleared; an idle string's random tick does nothing; with an entity on it a random tick keeps it active and schedules the 10-tick re-sense" }));
}
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  put(c, 3, 1, 2, `${STRING}:${4 | 1}`);
  const ev = [[2, "randomtick", 1, 1, 2], [6, "randomtick", 6, 1, 2], [10, "air", 3, 1, 2], [12, "randomtick", 1, 1, 2]];
  SCENARIOS.push(scenario("random-tick-hook", { size: [8, 3, 5], ticks: 30, cells: c, events: ev, note: "random ticks on the hooks of a line that stores one active string: the hook updateTick path attaches/powers both ends; after the string is broken another tick unpowers them" }));
}
{
  const c = xLine({}, 0, 7, 2, { strings: true });
  const ev = [[2, "randomtick", 1, 1, 2], [6, "randomtick", 6, 1, 2], [10, "entity", 3, 1, 2, 2], [10, "collide", 3, 1, 2], [12, "randomtick", 1, 1, 2], [30, "unentity", 3, 1, 2]];
  SCENARIOS.push(scenario("random-tick-hook-unattached", { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "hooks and strings stored unattached (metadata 3/1 and 0): a random tick on a hook attaches the whole line" }));
}
// Entity classes in the sensing box: the entity is a scripted instance of the real class (entity2 kinds).
for (const [name, kind, note] of [
  ["arrow-trips", 3, "an arrow (0.5 wide box) in the string's cell trips it"],
  ["snowball-trips", 4, "an EntitySnowball colliding with the string"],
  ["egg-trips", 5, "an EntityEgg colliding with the string"],
  ["pearl-trips", 6, "an EntityEnderPearl colliding with the string"],
  ["potion-trips", 7, "an EntityPotion colliding with the string"],
  ["boat-trips", 9, "an EntityBoat (1.5 x 0.6 box) over the string trips it (it reaches Entity.func_145775_I through moveEntity)"],
  ["falling-block-trips", 10, "an EntityFallingBlock (0.98 box) over the string trips it (moveEntity reaches func_145775_I)"],
  ["exp-bottle-trips", 11, "an EntityExpBottle colliding with the string"],
  ["bat-ignored", 8, "an EntityBat answers true to doesEntityNotTriggerPressurePlate: the string never trips"],
]) {
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity2", 3, 1, 2, kind], [3, "collide", 3, 1, 2], [20, "unentity", 3, 1, 2]];
  SCENARIOS.push(scenario(name, { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note }));
}
{
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity2", 3, 1, 2, 1], [3, "collide", 3, 1, 2], [5, "entity2", 3, 1, 2, 4], [8, "unentity2", 3, 1, 2, 1], [20, "unentity2", 3, 1, 2, 4], [24, "entity2", 3, 1, 2, 8], [28, "entity2", 3, 1, 2, 3], [40, "unentity2", 3, 1, 2, 3], [44, "unentity2", 3, 1, 2, 8]];
  SCENARIOS.push(scenario("projectiles-keep-line-powered", { size: [8, 3, 5], ticks: 60, cells: c, events: ev, note: "a mob trips the line; a snowball joins (no collide call, as thrown entities never run Entity.func_145775_I) and the mob leaves: the scheduled re-sense keeps the line powered until the snowball goes; a bat then does not hold it, an arrow does" }));
}
// Sense-only classes (no Entity.func_145775_I call from thrown potions and bottles) hold a powered line: a mob trips it, the class joins, the mob leaves.
for (const [name, kind, note] of [["potion-sustains", 7, "an EntityPotion in the box"], ["exp-bottle-sustains", 11, "an EntityExpBottle in the box"], ["boat-sustains", 9, "an EntityBoat in the box"], ["falling-block-sustains", 10, "an EntityFallingBlock in the box"]]) {
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity2", 3, 1, 2, 1], [3, "collide", 3, 1, 2], [5, "entity2", 3, 1, 2, kind], [8, "unentity2", 3, 1, 2, 1], [30, "unentity2", 3, 1, 2, kind]];
  SCENARIOS.push(scenario(name + "-hold-line", { size: [8, 3, 5], ticks: 60, cells: c, events: ev, note: note + " keeps a mob-tripped line powered (getEntitiesWithinAABB takes every entity) until it leaves" }));
}
// Batch 19: a thrown potion or bottle idling in the string's cell (no collide call, as neither runs Entity.func_145775_I) never trips an idle string.
for (const [name, kind] of [["potion-idle", 7], ["exp-bottle-idle", 11]]) {
  const c = xLine({}, 0, 7, 2, { attachedBits: 4, stringMeta: 4 });
  const ev = [[3, "entity2", 3, 1, 2, kind], [20, "unentity2", 3, 1, 2, kind]];
  SCENARIOS.push(scenario(name, { size: [8, 3, 5], ticks: 40, cells: c, events: ev, note: "an idle " + (kind === 7 ? "EntityPotion" : "EntityExpBottle") + " in the string cell with no collide call: the line is never powered" }));
}

// ---- Native run ----
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "tripwire-probe"),
  clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "authlib-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RedstoneProbe.java"), path.join(root, "probes/TripwireHolder.java")]);
const input = SCENARIOS.map((s) => `scenario ${s.name} ${s.origin.join(" ")} ${s.size.join(" ")} ${s.ticks} ${s.seed} ${s.sky} ${s.skylightSubtracted} ${s.angle} ${s.noSky ? 1 : 0}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
const child = spawn("java", ["-cp", cp, "RedstoneProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));

const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)),
  blocks = lines.shift();
assert.equal(blocks.kind, "blocks");
assert.equal(lines.length, SCENARIOS.length);
const f32 = Math.fround;
function compare(s, native, mine) {
  for (let t = 0; t < s.ticks; t++) {
    assert.equal(mine.calls[t], native.calls[t], `${s.name}: call log at tick ${t + 1}`);
    assert.deepEqual(mine.frames[t], native.frames[t], `${s.name}: block changes at tick ${t + 1}`);
  }
  assert.equal(mine.final, native.final, `${s.name}: final region`);
  assert.deepEqual(mine.pending, native.pending, `${s.name}: pending ticks`);
  assert.equal(mine.sounds.length, native.sounds.length, `${s.name}: sounds`);
  mine.sounds.forEach((m, i) => {
    const n = native.sounds[i];
    assert.deepEqual(m.slice(0, 5), n.slice(0, 5), `${s.name}: sound ${i}`);
    assert.equal(m[5], f32(n[5]), `${s.name}: sound ${i} volume`);
    assert.equal(m[6], f32(n[6]), `${s.name}: sound ${i} pitch`);
  });
  assert.deepEqual(mine.drops, native.drops, `${s.name}: drops`);
  assert.equal(mine.rng, native.rng, `${s.name}: world Random after the run`);
}
let changes = 0, sounds = 0, drops = 0, ticks = 0;
const results = [];
for (const [i, native] of lines.entries()) {
  const s = SCENARIOS[i];
  assert.equal(native.name, s.name);
  compare(s, native, replayScenario(s));
  ticks += s.ticks;
  changes += native.frames.reduce((n, f) => n + f.length, 0);
  sounds += native.sounds.length;
  drops += native.drops.length;
  const { kind, name, tiles, ...rest } = native;
  results.push({ ...s, ...rest });
}
// javap check: which entity classes reach Entity.func_145775_I (sa.I) from their own code. sa.d is moveEntity.
const { stdout: javapOut } = await exec("javap", ["-p", "-c", "-cp", classes, ...["sa", "zc", "zk", "zj", "zl", "zm", "zn", "zo", "xk", "xl", "xs", "xw", "xj", "xi", "sq", "zf", "zg", "we"]], { maxBuffer: 1 << 26 });
const collisionCallers = {};
for (const chunk of javapOut.split(/\n(?=(?:public |final |abstract )*class )/)) {
  const m = /class (\w+)/.exec(chunk);
  if (!m) continue;
  collisionCallers[m[1]] = { doBlockCollisions: /Method (?:\w+\.)?I:\(\)V/.test(chunk), moveEntity: /Method (?:\w+\.)?d:\(DDD\)V/.test(chunk) };
}
assert.ok(collisionCallers.sa.doBlockCollisions && collisionCallers.zc.doBlockCollisions && collisionCallers.xk.moveEntity);
assert.ok(!collisionCallers.zk.doBlockCollisions && !collisionCallers.zk.moveEntity && !collisionCallers.zg.moveEntity, "EntityThrowable and fireballs never collide with blocks");
assert.equal(blocks.tripwireEntities.tickRandomly[131], true);
assert.equal(blocks.tripwireEntities.tickRandomly[132], true);
assert.equal(blocks.tripwireEntities.tickRandomly[1], false);
assert.deepEqual(Object.entries(blocks.tripwireEntities.ignoresPlates).filter(([, v]) => v).map(([k]) => k), ["bat"]);
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aog: "BlockTripWireHook", aof: "BlockTripWire", ahb: "World", apx: "Chunk", ahs: "NextTickListEntry", aji: "Block" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Same harness as redstone-reference.json (RedstoneProbe: real World/Chunk, copied WorldServer pending ticks, recorded sounds/drops, scripted entity list with strict AABB intersection). Native BlockTripWireHook and BlockTripWire run unchanged. Events: place (setBlock flags 3), place2 (flags 2), placehook (setBlock flags 3 then Block.onPostBlockPlaced(meta), as ItemBlock.placeBlockAt), air, entity (0 item, 1 mob, 2 player: 0.25 box on the cell floor), unentity, collide (onEntityCollidedWithBlock, null entity), notify. Batch 17 events: entity2 (kinds 0 item, 1 mob, 2 player, 3 arrow, 4 snowball, 5 egg, 6 ender pearl, 7 thrown potion, 8 bat, 9 boat, 10 falling block, 11 thrown experience bottle: real class instances), unentity2 (by kind), harvest (Block.onBlockHarvested with a TripwireHolder player: 0 empty hand, 1 shears, 2 stick), randomtick (Block.updateTick with the world Random). Not probed: selection bounds, Entity.func_145775_I call sites (bytecode-read; javap-checked below). Per tick: changed region cells, call log (E event, s setBlock, m setBlockMetadataWithNotify, n notify, t schedule, u updateTick, p sound, e drop, T tick), sounds, drops, pending ticks, world Random nextInt.",
  tripwireEntities: blocks.tripwireEntities,
  collisionCallers,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/tripwire-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${ticks} ticks, ${changes} cell changes, ${sounds} sounds, ${drops} drops identical to the original classes.`);
