// Batch 83 cmdexec83: replays cmd-exec-reference.json (tools/probes/CmdExec83Probe.java, executed on the unchanged 1.7.10 command classes with real
// EntityPlayerMP doubles): /kill, /tp moving players (relative coordinates, the y bounds, a riding player), /clear on a real inventory, the achievement give and
// scoreboard criteria Tab lists, the height checks of /summon, /setblock and /testforblock, and Entity.readFromNBT's keys for every summonable class.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCommandRunner, CommandException } from "./commands.js";
import { createCommandHost, clearMatcher } from "./command-host.js";
import { spTabComplete } from "./sp-tabcomplete.js";
import { serializeComponent, langReady } from "./chat-component.js";
import { itemStackFromNbt } from "./region-import.js";
import { originalStack } from "./item-component.js";
import { NBT } from "./nbt.js";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { Minecarts } from "./minecarts.js";
import { JavaRandom } from "./java-random.js";
import { BY_ID as ACHIEVEMENT_BY_ID } from "./achievements.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/cmd-exec-reference.json", import.meta.url)));
const isComponent = (a) => a && typeof a === "object" && typeof a.unformatted === "function";
// A component argument compares by its JSON (the native component's self-parented style overflows the text getters: "!StackOverflowError").
const nativeArg = (a) => (Array.isArray(a) ? JSON.parse(a[0]) : a);
const portArg = (a) => (isComponent(a) ? JSON.parse(serializeComponent(a)) : String(a));

// Native [id, count, damage] -> a port stack (a damage the catalogue has no variant for is rawDamage, as region import and pots keep it) and back.
const short = (v) => ({ type: NBT.SHORT, value: v });
function portStack(n) {
  if (!n) return null;
  const [id, count, damage] = n, tag = (d) => new Map([["id", short(id)], ["Count", { type: NBT.BYTE, value: count }], ["Damage", short(d)]]);
  const s = itemStackFromNbt(tag(damage));
  if (s) return s;
  return { ...itemStackFromNbt(tag(0)), rawDamage: damage };
}
const nativeStack = (s) => { if (!s) return null; const o = originalStack(s); return [o.id, s.count, Number.isInteger(s.rawDamage) ? s.rawDamage : o.damage]; };
// The setups' inventories, read from the rows whose /clear removes nothing (the state after equals the one before).
const invOf = (setup) => ref.run.find(([n, a, s]) => n === "clear" && s === setup && a.join(" ") === "Alex dirt")[3].state.inv;
const START = { alex: { x: 0.5, y: 64, z: 0.5 }, steve: { x: 10.25, y: 70, z: -3.75 } };
// b84 cmdfix84: the probe starts Alex at yaw 30 pitch 10 and Steve at yaw 90 pitch -20 (Minecraft degrees); the port keeps them as game radians (gameYaw / pitch up is negative).
const LOOK = { alex: { yaw: Math.PI - (30 * Math.PI) / 180, pitch: (-10 * Math.PI) / 180 }, steve: { yaw: Math.PI - (90 * Math.PI) / 180, pitch: (20 * Math.PI) / 180 } };
const degrees = (l) => ({ yaw: ((Math.PI - l.yaw) * 180) / Math.PI, pitch: (-l.pitch * 180) / Math.PI });

// A two-player server: forPlayer(name) gives the named player's own state operations (the dispatch REDIRECT), teleport dismounts a riding player first
// (server-broadcast.js playerHost), and /clear runs the real createCommandHost clear over the player's inventory.
function server(setup, log) {
  const online = setup === "solo" ? ["Alex"] : ["Alex", "Steve"];
  const inv = setup === "inv" || setup === "invCursor" ? invOf(setup) : { main: Array(36).fill(null), armor: Array(4).fill(null), cursor: null };
  const inventories = { Alex: { main: inv.main.map(portStack), armor: inv.armor.map(portStack), cursor: portStack(inv.cursor) }, Steve: { main: Array(36).fill(null), armor: Array(4).fill(null), cursor: null } };
  const st = { alex: { ...START.alex, ...LOOK.alex, riding: setup === "riding" }, steve: { ...START.steve, ...LOOK.steve, riding: false }, health: 20, achievements: { Alex: new Set(), Steve: new Set() } };
  const key = (n) => n.toLowerCase();
  const achievementsOf = (n) => ({ has: (id) => st.achievements[n].has(id), trigger: (id) => st.achievements[n].add(id) });
  const ops = (n) => {
    const real = createCommandHost({ survival: () => ({ inventory: inventories[n] }), refreshInventory() {} });
    return {
      position: () => ({ x: st[key(n)].x, y: st[key(n)].y, z: st[key(n)].z }),
      teleport: (x, y, z, look) => { const p = st[key(n)]; p.riding = false; Object.assign(p, { x, y, z }, look ?? {}); }, // b84 cmdfix84: look is the target player's rotation (/tp <player> <target>)
      kill: () => { if (n === "Alex") st.health = 0; },
      clear: (o, d) => real.clear(o, d),
      achievements: achievementsOf(n), stats: { increment() {} },
    };
  };
  const h = {
    name: "Alex", playerName: "Alex", cheats: true, rules: undefined, seed: () => "0",
    players: () => online.map((n) => ({ name: n, position: () => ops(n).position(), mode: 0, level: 0 })), playerNames: () => online,
    forPlayer: (n) => ops(n), positionOf: (n) => ops(n).position(), lookOf: (n) => ({ yaw: st[key(n)].yaw, pitch: st[key(n)].pitch }), dimensionOf: () => 0, deliver() {},
    print: (t, c) => log.sender.push(c ? serializeComponent(c) : t), targetPrint: () => {},
    feedback: (t, c = t) => log.admin.push([0, c.key, (c.args ?? []).map(portArg)]), // commands-extra.js passes the component alone
    inWorld: (x, y, z) => y >= 0 && y < 256,
    summon: () => true, setBlock: () => false, blockAt: () => ({ id: 0, meta: 0 }), tileAt: () => null, changed() {},
    ...ops("Alex"),
  };
  return { h, st, inventories };
}

// StatList.initCraftableStats (pp.b, bytecode-read) registers the stat.craftItem.* entries while iterating a HashSet of Item objects, which hash by identity:
// their order changes from one JVM run to the next. The rest of each list (and the set) is compared in order.
const stable = (list) => list.filter((x) => !x.startsWith("stat.craftItem."));
test("Tab lists of /achievement give and the scoreboard criteria match the executed server (StatList and AchievementList initialised)", () => {
  const bad = [];
  for (const [text, options = []] of ref.tab) {
    const runner = createCommandRunner(server("pair", { sender: [], admin: [] }).h);
    const got = spTabComplete("/" + text, { name: "Alex", playerNames: ["Alex", "Steve"], cheats: true, complete: (t) => runner.complete(t, true) });
    if (JSON.stringify([...got].sort()) !== JSON.stringify([...options].sort()) || JSON.stringify(stable(got)) !== JSON.stringify(stable(options))) bad.push(`${text}: ${got.length} ${JSON.stringify(got).slice(0, 160)} != ${options.length} ${JSON.stringify(options).slice(0, 160)}`);
  }
  assert.deepEqual(bad, []);
});

test("/kill, /tp, /clear, /achievement, /debug and the height checks match the executed command classes (errors, notifyAdmins, sender chat, player state)", () => {
  const bad = [];
  for (const [name, args, setup, out] of ref.run) {
    if (out.crash !== null) continue;
    const log = { sender: [], admin: [] }, { h, st, inventories } = server(setup, log);
    const runner = createCommandRunner(h);
    let thrown = null;
    try { runner.run("/" + [name, ...args].join(" ")); } catch (e) { if (!(e instanceof CommandException)) throw e; thrown = [e.key, e.args.map(String)]; }
    // runner.run reports a CommandException as red chat; the first red line is the thrown error.
    const want = out.thrown && [out.thrown[1], out.thrown[2]];
    const wantAdmin = out.admin.map(([, k, a]) => [0, k, a.map(nativeArg)]);
    // The sender's own chat: the achievement broadcast (chat.type.achievement) comes from the achievement trigger, not the command.
    const wantSender = out.chat.Alex.filter((c) => c[0] !== "packet" && !c[0].includes("chat.type.achievement")).map((c) => JSON.parse(c[0]));
    let gotSender = log.sender.map((s) => { try { return JSON.parse(s); } catch { return s; } });
    if (want) {
      const red = gotSender.find((c) => c?.color === "red");
      thrown = red ? [red.translate, (red.with ?? []).map((w) => (typeof w === "string" ? w : w.text))] : null;
      gotSender = gotSender.filter((c) => c !== red);
    }
    const diff = [];
    if (JSON.stringify(thrown) !== JSON.stringify(want)) diff.push(`thrown ${JSON.stringify(thrown)} != ${JSON.stringify(want)}`);
    if (JSON.stringify(log.admin) !== JSON.stringify(wantAdmin)) diff.push(`admin ${JSON.stringify(log.admin).slice(0, 300)} != ${JSON.stringify(wantAdmin).slice(0, 300)}`);
    if (JSON.stringify(gotSender) !== JSON.stringify(wantSender)) diff.push(`sender ${JSON.stringify(gotSender).slice(0, 300)} != ${JSON.stringify(wantSender).slice(0, 300)}`);
    const s = out.state;
    for (const who of ["alex", "steve"]) {
      const g = st[who], w = s[who];
      if (Math.abs(g.x - w.x) > 1e-9 || Math.abs(g.y - w.y) > 1e-6 || Math.abs(g.z - w.z) > 1e-9 || g.riding !== w.riding) diff.push(`${who} ${JSON.stringify(g)} != ${JSON.stringify(w)}`);
      // b84 cmdfix84 (executed): /tp <player> <target> leaves the teleported player with the target's yaw and pitch (setPlayerLocation); the coordinate forms keep the own rotation.
      const look = degrees(g);
      if (Math.abs(look.yaw - w.yaw) > 1e-4 || Math.abs(look.pitch - w.pitch) > 1e-4) diff.push(`${who} look ${JSON.stringify(look)} != yaw ${w.yaw} pitch ${w.pitch}`);
    }
    if ((st.health === 0) !== (s.health === 0)) diff.push(`health ${st.health} != ${s.health}`);
    const inv = inventories.Alex, gotInv = { main: inv.main.map(nativeStack), armor: inv.armor.map(nativeStack), cursor: nativeStack(inv.cursor) };
    if (JSON.stringify(gotInv) !== JSON.stringify(s.inv)) diff.push(`inv ${JSON.stringify(gotInv)} != ${JSON.stringify(s.inv)}`);
    for (const n of ["Alex", "Steve"]) {
      const got = [...st.achievements[n]].map((id) => "achievement." + id).sort(), w = [...s.achievements[n]].sort();
      if (JSON.stringify(got) !== JSON.stringify(w)) diff.push(`${n} achievements ${got.length} != ${w.length}`);
    }
    if (diff.length) bad.push(`/${name} ${args.join(" ")} [${setup}]: ${diff.join("; ")}`);
  }
  assert.deepEqual(bad, []);
});

test("clearMatcher: the original Item and, given a data value, getItemDamage (rawDamage for a damage the catalogue has no variant for)", () => {
  const stone = portStack([1, 10, 0]), stone1 = portStack([1, 5, 1]), charcoal = portStack([263, 4, 1]), sword = portStack([276, 1, 10]);
  assert.equal(stone1.rawDamage, 1);
  assert.deepEqual([stone, stone1, charcoal, sword, null].map(clearMatcher(-1, -1)), [true, true, true, true, false]);
  assert.deepEqual([stone, stone1, charcoal, sword].map(clearMatcher(1, -1)), [true, true, false, false]);
  assert.deepEqual([stone, stone1].map(clearMatcher(1, 1)), [false, true]);
  assert.deepEqual([charcoal].map(clearMatcher(263, 1)), [true]);
  assert.deepEqual([sword].map(clearMatcher(276, 10)), [true]);
  assert.deepEqual([sword].map(clearMatcher(276, 0)), [false]);
});

// /summon through the command host (summon-coverage.test.js harness): the real EntityWorld for mobs, Minecarts for carts, recording hosts for the rest.
function game() {
  const world = new World("cmdexec83", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  const lines = [], minecarts = new Minecarts({}), rockets = { rockets: [] }, calls = { items: [], orbs: [], primed: [], falling: [], boats: [], loads: [] };
  const holder = (name) => ({ serialize: () => [], load: (list) => calls.loads.push([name, list.at(-1)]) });
  const hosts = {
    items: { spawn: (stack, x, y, z, o) => { const e = { stack, x, y, z, ...o }; calls.items.push(e); return e; } },
    xpOrbs: { orbs: calls.orbs }, primed: calls.primed,
    falling: { entities: calls.falling, entityRandom: () => new JavaRandom(1) },
    boats: { spawnBoat: (o) => { const b = { ...o }; calls.boats.push(b); return b; } },
    projectiles: holder("projectiles"), arrows: holder("arrows"), eyes: { serialize: () => ({ random: 0, eyes: [] }), load: (s) => calls.loads.push(["eyes", s.eyes.at(-1)]) },
    mobs: { potions: holder("potions"), fireballs: holder("fireballs"), skulls: holder("skulls") }, dimension: 0,
  };
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }),
    position: () => ({ x: 0.5, y: 64, z: 0.5 }), changed() {}, refreshInventory() {}, stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {},
    minecarts: () => minecarts, entityHosts: () => hosts, rockets: () => rockets };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { mobs, minecarts, calls, rockets, run(s) { lines.length = 0; runner.run(s); return [...lines]; } };
}
const nbtNumber = (s) => (s === undefined ? 0 : Number(String(s).replace(/[bsfdL]$/, "")));

test("/summon keeps Entity.readFromNBT's Fire, OnGround, FallDistance and Air on the classes the port runs those counters for", () => {
  const bad = [], open = new Set(), checked = new Set();
  for (const [name, tag, out] of ref.summon) {
    const g = game(), lines = g.run(`/summon ${name} 0.5 10 0.5 ${tag}`); // the harness world is 64 high (the probe summoned at y 64: no key here depends on it)
    const nativeOk = out.admin.some((a) => a[1] === "commands.summon.success"), portOk = lines.some((l) => /Object successfully summoned/.test(l));
    if (nativeOk !== portOk) { bad.push(`${name} ${tag}: success ${portOk} != ${nativeOk} ${lines.join(" | ")}`); continue; }
    if (!nativeOk) continue;
    const n = out.spawned[0], fire = n.fire, nbt = n.nbt;
    const mob = tag ? g.mobs.entities.at(-1) : g.mobs.entities[0], load = g.calls.loads.at(-1)?.[1];
    let e = null, fields = ["fire"];
    if (mob) { e = mob; fields = ["fire", "onGround", "fallDistance", "air"]; }
    else if (g.calls.items.length) { e = g.calls.items.at(-1); fields = ["fire", "onGround"]; }
    else if (g.calls.orbs.length) { e = g.calls.orbs.at(-1); fields = ["fire", "onGround"]; }
    else if (g.calls.primed.length) { e = g.calls.primed.at(-1); fields = ["fire", "onGround", "fallDistance"]; }
    else if (g.calls.boats.length) { e = g.calls.boats.at(-1); fields = ["fire", "onGround", "fallDistance"]; }
    else if (g.rockets.rockets.length) { e = g.rockets.rockets.at(-1); fields = ["fire", "onGround"]; }
    else if (load && ["projectiles", "potions"].includes(g.calls.loads.at(-1)[0])) {
      // A throwable keeps only a positive counter (java-projectiles.js: it never moves with moveEntity, so a negative counter never burns or saves back).
      if ((load.fire ?? 0) !== fire) bad.push(`${name} ${tag}: fire ${load.fire} != ${fire}`);
      checked.add(name);
      continue;
    } else if (g.calls.falling.length) { e = g.calls.falling.at(-1); fields = ["fire"]; // b84 cmdfix84: FallingSand keeps Fire (never calls Entity.onUpdate)
    } else if (g.minecarts.carts?.length) { e = g.minecarts.carts.at(-1); fields = ["fire"]; // b84 cmdfix84: carts keep Fire (moveEntity rests a negative counter at -1 after the first update: see the note)
    } else if (load && ["arrows", "fireballs", "eyes"].includes(g.calls.loads.at(-1)[0])) {
      if ((load.fire ?? 0) !== fire) bad.push(`${name} ${tag}: fire ${load.fire} != ${fire}`); // b84 cmdfix84: arrows, fireballs and eyes keep the raw short
      checked.add(name);
      continue;
    } else { open.add(name); continue; } // FallingSand, carts, hanging entities, arrows, fireballs, eyes, crystals: no port fire counter on the record
    checked.add(name);
    const want = { fire, onGround: nbtNumber(nbt.OnGround) !== 0, fallDistance: Math.fround(nbtNumber(nbt.FallDistance)), air: nbtNumber(nbt.Air) };
    for (const f of fields) if (e[f] !== want[f]) bad.push(`${name} ${tag}: ${f} ${e[f]} != ${want[f]}`);
    if (mob) {
      const m = /\[0:(-?[\d.E]+)d,1:(-?[\d.E]+)d,2:(-?[\d.E]+)d,\]/.exec(nbt.Motion);
      // Living mobs: the motion read back after readFromNBT (|v| > 10 is 0); the port keeps it in vx/vy/vz.
      if (m && [mob.vx, mob.vy, mob.vz].some((v, i) => Math.abs(v - Number(m[i + 1])) > 1e-9)) bad.push(`${name} ${tag}: motion ${[mob.vx, mob.vy, mob.vz]} != ${m.slice(1)}`);
      const custom = nbt.CustomName ? JSON.parse(nbt.CustomName) : ""; // EntityLiving writes CustomName (empty too)
      if ((mob.customName ?? "") !== (custom ?? "")) bad.push(`${name} ${tag}: customName ${mob.customName} != ${custom}`);
    }
  }
  assert.deepEqual(bad, []);
  console.log(`checked: ${[...checked].join(" ")}\nno port counter: ${[...open].join(" ")}`);
  // The probe's Item rows carry no Item stack (EntityItem kills itself on its first update; the port does not spawn it): one with a stack here.
  const g = game();
  g.run("/summon Item 0.5 10 0.5 {Item:{id:264s,Count:1b},Fire:-20s,OnGround:1b}");
  assert.deepEqual([g.calls.items[0].fire, g.calls.items[0].loadedFire, g.calls.items[0].onGround], [-20, -20, true]);
  assert.ok(checked.has("FallingSand") && checked.has("MinecartChest") && checked.has("PrimedTnt") && checked.has("Pig") && checked.size >= 30, [...open].join(" "));
});
