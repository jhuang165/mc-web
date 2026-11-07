// Replays combat-tracker-reference.json (tools/verify-combat-tracker.mjs, CombatTrackerProbe.java): the unchanged 1.7.10 CombatTracker
// and DamageSource executed on a real EntityPlayerMP over a scenario matrix. Each scenario's hits go through Survival.damage and the
// message after every hit (the func_151521_b preview) and the death message are compared with the native text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival, VOID } from "./survival.js";
import { trackerMessage, deathMessage, DEATH_TEXT, FELL_TEXT } from "./death-messages.js";
import { EN_US } from "./lang-en-us.js";
const reference = JSON.parse(readFileSync(new URL("../public/research/combat-tracker-reference.json", import.meta.url)));
const records = reference.records.filter((r) => r.case === "combat");

const PLAIN = { inFire: "fire", onFire: "burning", lava: "lava", inWall: "suffocation", drown: "drowning", starve: "starvation", cactus: "a cactus",
  fall: "a fall", outOfWorld: VOID, generic: "an accident", magic: "magic", wither: "wither", anvil: "anvil", fallingBlock: "fallingBlock" };
const ATTACKERS = {
  zombie: { type: "zombie" }, zombieBob: { type: "zombie", customName: "Bob" }, zombieSword: { type: "zombie", equipment: [{ id: 267, displayName: "Sting" }] },
  skeleton: { type: "skeleton" }, skeletonBow: { type: "skeleton", equipment: [{ id: 261, displayName: "Bow of Doom" }] },
  ghast: { type: "ghast" }, creeper: { type: "creeper" }, witch: { type: "witch" },
  alex: { type: "player", isPlayer: true, customName: "Alex" }, alexSword: { type: "player", isPlayer: true, customName: "Alex", equipment: [{ id: 276, displayName: "Sting" }] }, // the probe holds it in InventoryPlayer.getCurrentItem
  wolf: { type: "wolf" }, wolfBob: { type: "wolf", customName: "Bob" }, wolfTamed: { type: "wolf", tamed: true }, wolfTamedBob: { type: "wolf", tamed: true, customName: "Bob" },
};
const replayable = () => true;

function hitArgs(spec) {
  if (spec in PLAIN) return [PLAIN[spec], false, undefined, undefined, undefined];
  const [kind, who] = spec.split(":"), from = ATTACKERS[who];
  switch (kind) {
    case "mob": case "player": return ["a " + who, true, kind, from, undefined];
    case "thorns": return ["thorns", true, "thorns", from, undefined];
    case "thrown": return ["thrown", true, "thrown", from, undefined];
    case "arrow": return ["an arrow", true, undefined, who === "self" || who === "null" ? undefined : from, who === "self" ? { self: true } : undefined];
    case "fireball": return ["fireball", true, "fireball", from, undefined];
    case "explosion": return ["an explosion", true, "explosion", from, undefined];
    case "indirectMagic": return ["magic", false, "indirectMagic", from, undefined];
  }
  throw new Error(spec);
}

function replay(r) {
  const p = new Survival({}, "survival");
  p.food = 10; p.saturation = 0; p.protection = 0;
  const ctx = { name: "Player" }, previews = [];
  let now = 0, env = null, ground = 0;
  for (const op of r.ops) {
    const [tick, kind, a, b] = op.split(" ");
    while (now < +tick) {
      now++; p.ticks = now; p.hurtTicks = Math.max(0, p.hurtTicks - 1);
      p.combat.tick(now);
    }
    if (kind === "env") { env = a === "none" ? null : a === "vine" ? "vines" : a; continue; }
    if (kind === "R") { ground = +a; continue; }
    const fall = kind === "fall";
    const [reason, blockable, source, from, via] = hitArgs(fall ? "fall" : a);
    p.combatSite = env; p.combatFall = fall ? +a : ground;
    const accepted = !!p.damage(Math.fround(+(fall ? b : b)), reason, blockable, source, from, via);
    previews.push({ accepted, preview: p.combat.entries.length ? trackerMessage(p.combat, "Player") : "Player died", entries: p.combat.entries.length, health: p.health });
  }
  return previews;
}

test("the port reproduces every native scenario of the CombatTracker matrix", () => {
  let replayed = 0;
  for (const r of records.filter(replayable)) {
    const got = replay(r);
    r.hits.forEach((h, i) => {
      const label = `${r.name} @${h.op}`;
      assert.equal(got[i].accepted, h.accepted, label + " accepted");
      assert.equal(got[i].entries, h.entries, label + " entries");
      assert.equal(got[i].preview, h.preview.text, label + " preview");
    });
    if (r.message) assert.equal(got.at(-1).preview, r.message.text, r.name + " death message");
    replayed++;
  }
  assert.ok(replayed >= 400, `replayed ${replayed}`);
});

test("English fallbacks are the en_US values", () => {
  for (const [k, v] of Object.entries(DEATH_TEXT)) assert.equal(EN_US["death.attack." + k], v, k);
  for (const [k, v] of Object.entries(FELL_TEXT)) assert.equal(EN_US["death.fell." + k], v, k);
  assert.equal(Object.keys(DEATH_TEXT).length + Object.keys(FELL_TEXT).length, Object.keys(EN_US).filter((k) => k.startsWith("death.")).length);
});

test("single-hit lines: held item in brackets, ownerless projectiles, falls over 5 blocks", () => {
  assert.equal(deathMessage("an arrow", "Alex", { attacker: ATTACKERS.skeletonBow }), "Alex was shot by Skeleton using [Bow of Doom]");
  assert.equal(deathMessage("a zombie", "Alex", { source: "mob", attacker: ATTACKERS.zombieSword }), "Alex was slain by Zombie"); // death.attack.mob has no .item key
  assert.equal(deathMessage("fireball", "Alex", { source: "fireball" }), "Alex burned to death");
  assert.equal(deathMessage("an arrow", "Alex", {}), "Alex was shot by arrow");
  assert.equal(deathMessage("a fall", "Alex"), "Alex hit the ground too hard");
  const p = new Survival({}, "survival");
  p.combatFall = 8; p.combatSite = "vines";
  p.damage(20, "a fall");
  assert.equal(trackerMessage(p.combat, "Alex"), "Alex fell off some vines");
});

test("a lethal hit clears the earlier entries, and the revenge target names the fighter for 100 ticks", () => {
  const p = new Survival({}, "survival");
  p.damage(2, "a zombie", true, "mob", ATTACKERS.zombie);
  for (let i = 0; i < 12; i++) { p.ticks++; p.hurtTicks = Math.max(0, p.hurtTicks - 1); }
  p.damage(20, "lava");
  assert.equal(p.combat.entries.length, 1);
  assert.equal(trackerMessage(p.combat, "Player"), "Player tried to swim in lava to escape Zombie");
});
