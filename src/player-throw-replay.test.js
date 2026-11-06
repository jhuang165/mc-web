// Port differential for SIM-01 bucket/throw/bow-release extraction. The "old" side
// compiles the verbatim main.js edit/useBucketItem/throwSnowball/releaseBowUse/flushArrows
// bodies and the player-actions/player-edit-simulation modules stored from 8901a28 in
// player-throw-port-reference.json. The "new" side compiles the same-named functions from the
// current src/main.js with the current modules. Both drive the same real World, Survival,
// EntityWorld, Projectiles, Arrows and ItemEntities through one input script under a shared
// seeded Math.random. This is port regression evidence, not native Java evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { World, WATER, RED_FLOWER, YELLOW_FLOWER } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { makeStack, copyStack } from "./inventory.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles } from "./projectiles.js";
import { Arrows, releaseBow, BOW, ARROW } from "./bow.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { useBucket, milkCow, MILK_BUCKET, DRINK_TICKS, BUCKET, WATER_BUCKET, LAVA_BUCKET } from "./buckets.js";
import { captureBucketTarget } from "./buckets-simulation.js";
import * as currentActions from "./player-actions.js";

const BASELINE = "8901a28";
const reference = JSON.parse(readFileSync(new URL("./player-throw-port-reference.json", import.meta.url), "utf8"));
const currentMain = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Top-level `function name(` up to its matching body brace (default parameters skipped).
function extract(source, name) {
  const start = source.indexOf(`\nfunction ${name}(`) + 1;
  assert.ok(start > 0, `main.js defines ${name}`);
  let p = source.indexOf("(", start), depth = 0;
  for (; p < source.length; p++) if (source[p] === "(") depth++; else if (source[p] === ")" && --depth === 0) break;
  const open = source.indexOf("{", p);
  for (let j = open, d = 0; j < source.length; j++) {
    if (source[j] === "{") d++;
    else if (source[j] === "}" && --d === 0) return source.slice(start, j + 1);
  }
  throw new Error(`unterminated ${name}`);
}

// The stored modules import the current dependencies by absolute URL; the old
// player-actions module imports the old player-edit-simulation module.
async function oldActions() {
  const toUrl = (text, map) => text.replace(/from (['"])(\.\/[^'"]+)\1/g, (_, q, path) => `from ${q}${map[path] ?? new URL(path, import.meta.url).href}${q}`);
  const data = (text) => "data:text/javascript," + encodeURIComponent(text).replaceAll("'", "%27");
  const editUrl = data(toUrl(reference.modules["src/player-edit-simulation.js"].text, {}));
  return import(data(toUrl(reference.modules["src/player-actions.js"].text, { "./player-edit-simulation.js": editUrl })));
}

const MUTABLE = ["screen", "eating", "mining", "mineCooldown", "mineHeld", "saved", "grounded", "fallDistance",
  "wasInWater", "yaw", "pitch", "target", "aimedEntity", "eyeRay", "survival"];

// Compile main.js functions in one closure so they share its `let` bindings.
function compile(functions, bindings) {
  const names = Object.keys(bindings).filter((n) => !MUTABLE.includes(n));
  const body = functions.map((fn) => fn.replaceAll("import.meta.env.DEV", "__DEV__")).join("\n");
  const source = `let ${MUTABLE.map((n) => `${n} = __init.${n}`).join(", ")};\n${body}\n` +
    `return { edit, releaseBowUse, read: () => ({ ${MUTABLE.join(", ")} }), write(o) { ${MUTABLE.map((n) => `if (Object.hasOwn(o, "${n}")) ${n} = o.${n};`).join(" ")} } };`;
  return new Function("__init", "__DEV__", ...names, source)(bindings, true, ...names.map((n) => bindings[n]));
}

function withRandom(seed, fn) {
  const prior = Math.random;
  let state = seed >>> 0, draws = 0;
  Math.random = () => { draws++; state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  try { return { value: fn(), draws: () => draws }; } finally { Math.random = prior; }
}

const X = 40, Z = 40, FLOOR = 10;
const down = () => ({ origin: [X + 0.5, FLOOR + 2.62, Z + 0.5], dir: [0, -1, 0] });

function system(actions, functions) {
  const world = new World("player-throw-replay");
  for (let x = X - 8; x < X + 8; x++)
    for (let z = Z - 8; z < Z + 8; z++) for (let y = 1; y < 30; y++) world.set(x, y, z, y <= FLOOR ? 3 : 0, false);
  world.set(X, FLOOR, Z, WATER, false);
  world.set(X + 2, FLOOR + 1, Z, RED_FLOWER, false, 3);
  world.set(X - 2, FLOOR, Z, 13, false);
  const slots = [makeStack(312, 3), makeStack(316, 2), makeStack(BUCKET, 2), makeStack(WATER_BUCKET), makeStack(MILK_BUCKET),
    makeStack(BOW), makeStack(ARROW, 5), makeStack(LAVA_BUCKET), null];
  const survival = new Survival({ slots, food: 10 }, "survival");
  const log = [];
  const items = new ItemEntities(() => Math.random()), projectiles = new Projectiles(), arrows = new Arrows();
  const mobs = new EntityWorld(world, [], () => 0.5), cow = mobs.create("cow", X + 0.5, FLOOR + 1, Z + 2.5);
  mobs.entities.push(cow);
  const fluids = { wash: (x, y, z, b) => { log.push(["wash", x, y, z, b]); items.dropBlock([makeStack(b, 1, b === RED_FLOWER ? world.getMeta(x, y, z) : 0)], x, y, z); } };
  const position = { x: X + 0.5, y: FLOOR + 1, z: Z + 0.5, toArray() { return [this.x, this.y, this.z]; } };
  const editActionLog = [];
  const bindings = {
    screen: "playing", eating: null, mining: null, mineCooldown: 0, mineHeld: false, saved: true, grounded: true,
    fallDistance: 0, wasInWater: false, yaw: 0, pitch: Math.PI / 2, target: null, aimedEntity: null, eyeRay: null, survival,
    // main.js edit() first checks for an aimed chest minecart (none in these replays).
    aimedCart: null, eyes: null, maps: null, rockets: null, minecarts: null, boats: null, rider: null, BOAT_ITEM: 495,
    heldId: () => bindings.compiled.read().survival.held?.id || 0,
    world, position, velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false }, mobs,
    signs: null, farming: { observe() {}, drain: () => [] }, trees: {}, fire: {}, fluids, items, projectiles, arrows,
    FLOWERS: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, boneRandom: new JavaRandom(1), itemRand: new JavaRandom(2),
    applyHangingEdit: () => false, hanging: null, aimedHanging: null, spawnHangingDrops: () => {}, // paintings and frames: hanging.test.js
    editActionLog, ITEMS, BOW, ARROW, copyStack, useBucket, milkCow, MILK_BUCKET, DRINK_TICKS, releaseBow, captureBucketTarget,
    ...actions,
    sounds: { unlock: () => log.push("unlock"), play: (name, options) => log.push(["play", name, options]) },
    animation: { swing: () => log.push("swing"), resetEquipped: () => log.push("reset") },
    scene: {
      updateBlock: (...args) => log.push(["update", ...args]),
      updateBlocks: (changes) => log.push(["updates", changes]),
      setArrows: (list) => log.push(["arrows", list.length]),
      particles: { destroyBlock: (_world, ...args) => log.push(["particles", ...args]) },
      fx: { crit2: () => log.push("crit2") },
    },
    sound: (...args) => log.push(["sound", ...args]),
    renderHotbar: () => log.push("hotbar"), renderVitals: () => log.push("vitals"), toast: (m) => log.push(["toast", m]),
    applyFarmUpdates: () => log.push("farm"), reportBrokenTool: () => log.push("broken"), lightTnt: () => log.push("tnt"),
    inventory: (station) => log.push(["inventory", station]), useFurnace: () => log.push("furnace"),
    openCommandBlock: () => log.push("command-block"), touchRedstoneOre: () => {}, // main.js touchRedstoneOre (redstone-ore.test.js)
    useBed: (...args) => log.push(["bed", ...args]),
    openContainer: () => log.push("chest"), breakBlock: (...args) => log.push(["break", ...args]),
    clientEyeInWater: () => false, handleEntityEvents: () => log.push("events"), boneMealSparkles: () => log.push("sparkles"),
  };
  bindings.compiled = compile(functions, bindings);
  return { world, survival, items, projectiles, arrows, cow, log, editActionLog, game: bindings.compiled };
}

// Each step sets the browser inputs of one frame, then the input handler runs.
const SCRIPT = [
  { slot: 0, place: true },                                       // snowball
  { slot: 1, place: true, yaw: 0.7, pitch: -0.3 },                // egg
  { slot: 2, place: true, eyeRay: down(), pitch: Math.PI / 2 },   // empty bucket picks the source
  { slot: 3, place: true, eyeRay: { origin: [X + 2.5, FLOOR + 2.62, Z + 0.5], dir: [0, -1, 0] } }, // water replaces flower
  { slot: 2, place: true, aimCow: true, eyeRay: down() },         // milk the cow (stack of one bucket left)
  { slot: 4, place: true, eyeRay: down() },                       // milk bucket starts drinking
  { clearEating: true, release: true },                           // release with no bow draw
  { slot: 5, place: true },                                       // bow draw begins
  { drawTicks: 20, release: true },                               // full-power crit shot
  { slot: 5, place: true },
  { drawTicks: 1, release: true },                                // too short: no arrow
  { slot: 5, place: true },
  { drawTicks: 12, slot: 0, release: true },                      // switched away: draw ends only
  { slot: 0, place: true, target: { block: [X - 2, FLOOR, Z], adjacent: [X - 2, FLOOR + 1, Z], distance: 2 } }, // workbench first
  { slot: 3, place: true, eyeRay: null },                         // emptied bucket, no eye ray yet: nothing
  { creative: true, slot: 0, place: true, yaw: -1.1, pitch: 0.2 },// Creative keeps the snowball
  { slot: 7, place: true, eyeRay: down(), pitch: Math.PI / 2 },   // Creative lava keeps the bucket
  { slot: 3, place: true, aimCow: true, eyeRay: down() },         // Creative cow: the ray picks the lava
  { slot: 5, place: true },
  { drawTicks: 30, release: true },                               // Creative shot keeps its arrows
  { slot: 3, place: false, target: { block: [X + 3, FLOOR, Z], adjacent: [X + 3, FLOOR + 1, Z], distance: 3 } }, // left click
];

function run(actions, functions) {
  const states = [];
  let s;
  const result = withRandom(9001, () => {
    s = system(actions, functions);
    for (const step of SCRIPT) {
      const { game, survival } = s, o = {};
      if (step.creative) { survival.mode = "creative"; survival.inventory.creative = true; }
      if (step.slot !== undefined) survival.inventory.current = step.slot;
      for (const k of ["yaw", "pitch", "eyeRay"]) if (Object.hasOwn(step, k)) o[k] = step[k];
      o.target = step.target ?? null;
      o.aimedEntity = step.aimCow ? { entity: s.cow, distance: 2 } : null;
      if (step.clearEating) o.eating = null;
      if (step.drawTicks !== undefined) o.eating = { ...game.read().eating, ticks: step.drawTicks };
      game.write(o);
      if (step.release) game.releaseBowUse();
      else game.edit(step.place);
      const v = game.read();
      states.push(JSON.parse(JSON.stringify({
        eating: v.eating, mining: v.mining, mineCooldown: v.mineCooldown, saved: v.saved,
        inventory: survival.serialize().slots, current: survival.inventory.current,
        blocks: [s.world.get(X, FLOOR, Z), s.world.get(X + 2, FLOOR + 1, Z), s.world.getMeta(X + 2, FLOOR + 1, Z), s.world.get(X, FLOOR + 1, Z)],
        projectiles: s.projectiles.serialize(), arrows: s.arrows.serialize(), crits: s.arrows.list.map((a) => a.crit), items: s.items.serialize(), log: s.log.splice(0),
      })));
    }
  });
  return { states, draws: result.draws(), trace: s.editActionLog };
}

test("stored 8901a28 sources are verbatim and hash-checked", () => {
  assert.equal(reference.commit, BASELINE);
  assert.match(reference.blobSha256, /^[a-f0-9]{64}$/);
  for (const [path, module] of Object.entries(reference.modules)) assert.equal(sha256(module.text), module.blobSha256, path);
  let pinned = null;
  try { pinned = execFileSync("git", ["show", `${BASELINE}:src/main.js`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* no history */ }
  if (pinned === null) return;
  assert.equal(sha256(pinned), reference.blobSha256);
  for (const [name, body] of Object.entries(reference.functions)) assert.equal(extract(pinned, name), body, name);
  for (const path of Object.keys(reference.modules))
    assert.equal(execFileSync("git", ["show", `${BASELINE}:${path}`], { encoding: "utf8" }), reference.modules[path].text, path);
});

test("bucket, throw and bow-release input replays match the pre-extraction main.js", async () => {
  const old = run(await oldActions(), ["edit", "useBucketItem", "throwSnowball", "releaseBowUse", "flushArrows"].map((n) => reference.functions[n]));
  const next = run(currentActions, ["traceAction", "edit", "releaseBowUse", "flushArrows"].map((n) => extract(currentMain, n)));
  assert.equal(next.states.length, SCRIPT.length);
  for (let i = 0; i < SCRIPT.length; i++) assert.deepEqual(next.states[i], old.states[i], `step ${i}`);
  assert.equal(next.draws, old.draws, "Math.random draw count");

  // The scenario exercised every path it claims.
  const flat = old.states.flatMap((s) => s.log);
  assert.equal(old.states[0].projectiles.length, 1);
  assert.equal(old.states[1].projectiles[1].kind, "egg");
  assert.deepEqual(old.states[2].blocks.slice(0, 1), [0]);
  assert.ok(flat.some((e) => e[0] === "wash") && flat.some((e) => e[0] === "particles"));
  assert.deepEqual(old.states[5].eating, { id: MILK_BUCKET, ticks: DRINK_TICKS, drink: true });
  assert.equal(old.states[8].arrows.length, 1);
  assert.deepEqual(old.states[8].crits, [true]);
  assert.equal(old.states[10].arrows.length, 1);
  assert.equal(old.states[12].eating, null);
  assert.deepEqual(old.states[13].log.slice(-1), [["inventory", true]]);
  assert.equal(old.states[19].arrows.length, 2);
  assert.equal(old.states[19].arrows[1].pickup, 2);

  // The new development trace records each edit with its captured bucket trace and each release.
  assert.deepEqual(next.trace.map((r) => r.action.type), SCRIPT.map((s) => (s.release ? "player-release-use" : "player-edit")));
  assert.deepEqual(next.trace[2].action.bucket, { ...JSON.parse(JSON.stringify({ ray: down() })), liquid: true, hit: { block: [X, FLOOR, Z], side: 1 } });
  assert.deepEqual(next.trace[14].action.bucket, { ray: null, liquid: true, hit: null });
  assert.equal(next.trace[20].action.bucket, null, "left clicks capture no bucket trace");
  assert.deepEqual(JSON.parse(JSON.stringify(next.trace)), next.trace);
});
