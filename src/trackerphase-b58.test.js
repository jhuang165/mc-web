// Batch 58 (trackerphase). Executed: tools/probes/TrackerJointProbe.java, tag b58tp (cases dimAge5 .. dimAge59, dimAgeLong, plus the b57 dimTick pair) with the real EntityTracker. World B ticks its tracker
// from the making of its entries with nobody watching (MinecraftServer.updateTimeLightAndEntities runs every WorldServer), so an entry that has lived N ticks when the player arrives is mid-phase: its
// updates fall on ticks % frequency of its own age, and its last sent position, motion and teleport count are those of its history. The port's `MobTracker.idleUpdate` is that silent tick; the
// arrival (`jointUpdate` with a joining player) then sends every entry already in the set, in the set's order. Replayed here: every packet of every tick from the arrival on.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker, OBJECT_KINDS } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-joint-reference.json", import.meta.url), "utf8"));
const player = { x: 0.5, y: 0, z: 0.5 };
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const LIST = { item: "item", arrow: "arrow", snowball: "snowball", orb: "orb", boat: "boat", cart0: "minecart", cart1: "minecart", painting: "painting", frame: "itemFrame" };
const ALL = new Set(["spawn", "move", "moveLook", "look", "teleport", "velocity", "head", "destroy"]); // as tracker-spawn-b57: the metadata packets (S1C, item stack) are not compared
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)?.[1] ?? "-1" + id) : id);

function host(spec, id, row) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = row;
  switch (spec.kind) {
    case "chicken": return { type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 4, onGround: true };
    case "item": return { entityId: id, x, y: y - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
    case "orb": return { id, x, posY: y, z, vx, vy, vz, y: y - 0.25, value: 5 };
    case "boat": case "cart0": case "cart1": return { entityId: id, x, posY: y, z, vx, vy, vz, yaw, pitch, type: spec.kind === "cart1" ? 1 : 0 };
    case "painting": case "frame": return { entityId: id, x: x + 0.5, y, z: z + 0.5, tx: x, ty: y, tz: z, dir: spec.dir, yaw: 0, art: 0 };
    default: return { id, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch };
  }
}

// World B's tracker pair from tick 1, silent until the arrival tick `D`. `idle(m)` may replace the silent tick (mutation checks). Returns the [tick, got, want] list of mismatching ticks from D on.
export function replayAge(name, { idle = null, only = null } = {}) {
  const rec = ref[name], D = rec.dimAt;
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  m.beforePlayer = (e) => e.beforeP === true; m.spawnEarly = (e) => e.earlyP === true;
  const r = { applied: [], who: new Map(), firstRow: new Map() };
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); r.firstRow.get(a[0])?.(); const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { r.applied.push(p); r.who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v, ...rec.meta[n] })).filter((s) => s.inB);
  const hosts = new Map(), bad = [];
  for (let tk = 1; tk <= rec.ticks.length; tk++) {
    const k = tk - 1, live = [], lists = {};
    for (const s of specs) {
      if (s.born > tk || (s.dies >= 0 && tk >= s.dies)) continue;
      let h = hosts.get(s.name);
      const withWorld = s.born === 0;
      if (!h) {
        h = host(s, s.id, s.rows[withWorld ? k : tk]);
        h.beforeP = withWorld; h.earlyP = !!s.net;
        hosts.set(s.name, h);
        if (withWorld) r.firstRow.set(h, () => { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[tk]), { beforeP: b, earlyP: e }); });
      } else { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[tk]), { beforeP: b, earlyP: e }); }
      if (s.kind === "chicken") live.push(h); else (lists[LIST[s.kind]] ??= []).push(h);
    }
    const joint = { tracker: o, lists, world: grass };
    if (tk < D) { (idle ?? ((mm, a, b, c) => mm.idleUpdate(a, b, c)))(m, live, () => [0.3, 0.7], joint); continue; }
    if (tk === D) {
      m.joinPlayer(rec.ids2.player);
      for (const s of specs) if (s.born < D && hosts.has(s.name)) hosts.get(s.name).beforeP = true; // the player joins the END of B's list: everything B held is before its slot
      // The arrival is in the network phase, before tick D's entity loop: the spawn packets of the entries kept since before carry the state of tick D - 1 (the host objects already hold tick D's).
      for (const t of [m, o]) for (const [h, en] of t.entries) {
        const s = specs.find((x) => hosts.get(x.name) === h), orig = en.entry.tryStart.bind(en.entry);
        if (!s) continue;
        en.entry.tryStart = () => { const now = { ...h }, b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[tk - 1]), { beforeP: b, earlyP: e }); orig(); Object.assign(h, now); };
      }
    }
    r.applied.length = 0;
    m.update(live, player, () => [0.3, 0.7], null, joint);
    const got = r.applied.map((p) => p.type + ":" + num(r.who.get(p))), want = rec.ticks[k][1].map((p) => p[0] + ":" + p[1]);
    const keep = (x) => ALL.has(x.split(":")[0]) && (!only || only(Number(x.split(":")[1])));
    const g = got.filter(keep), w = want.filter(keep);
    if (JSON.stringify(g) !== JSON.stringify(w)) bad.push([tk, g, w]);
  }
  return bad;
}

for (const name of ["dimAge5", "dimAge13", "dimAge30", "dimAge45", "dimAge59", "dimTick", "dimTickLast"]) {
  test(`${name}: every packet from the arrival on equals the real tracker's with B's entries run since their making`, () => {
    assert.deepEqual(replayAge(name).slice(0, 3), []);
  });
}

test("dimAgeLong: an arrival after 1195 ticks, across the 401st relative update (a teleport at 1201)", () => {
  assert.deepEqual(replayAge("dimAgeLong").slice(0, 3), []);
  const at = ref.dimAgeLong.ticks.find(([t]) => t === 1201)[1].map((p) => p[0]);
  assert.equal(at.filter((k) => k === "teleport").length, 3, "the chicken, boat and cart (every 3 ticks) teleport; items and orbs (every 20) do not");
});

test("the record: the same entity's update ticks follow its own age, not the arrival", () => {
  const first = (name) => { const r = ref[name], id = r.ids2.bc1; return r.ticks.find(([t, ev]) => t > r.dimAt && ev.some((p) => p[1] === id && p[0] !== "spawn" && p[0] !== "meta"))?.[0]; };
  const phases = ["dimAge13", "dimAge30", "dimAge45"].map((n) => first(n) % 3);
  assert.deepEqual(phases, [1, 1, 1], "bc1 updates on ticks 1, 4, 7, ... whenever the player arrives");
});

test("mutation check: starting the entries at the arrival (no silent tick) breaks the replay", () => {
  assert.ok(replayAge("dimAge30", { idle: () => {} }).length > 0);
});
