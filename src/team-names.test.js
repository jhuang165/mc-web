// Replays team-names-reference.json (tools/verify-team-names.mjs, TeamNameProbe.java): scoreboard-team formatted names in the unchanged
// 1.7.10 CombatTracker death messages and chat.type.text, executed on the real EntityPlayerMP with a real Scoreboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival, VOID } from "./survival.js";
import { Scoreboard } from "./scoreboard.js";
import "./death-messages.js"; // registers the known death.* lang keys (setKnownKeys)
import { deathComponent, chatTextComponent, withTeamName } from "./team-names.js";
const reference = JSON.parse(readFileSync(new URL("../public/research/team-names-reference.json", import.meta.url)));

const CONFIGS = {
  none: [],
  victimColor: [["Red", "§c", "§r", "Player"]],
  victimAffix: [["Mod", "§l[Mod] §a", " §7(x)", "Player"]],
  victimAndAlex: [["Red", "§c", "§r", "Player"], ["Blue", "§9", "§r", "Alex"]],
  alexOnly: [["Blue", "§9[B] ", "§r", "Alex"]],
  mobNameOnly: [["Green", "§a", "§r", "Bob"]],
  everyone: [["Red", "§c", "§r", "Player"], ["Blue", "§9", "§r", "Alex"], ["Green", "§a", "§r", "Bob"]],
};
function board(config) {
  const b = new Scoreboard();
  for (const [name, prefix, suffix, member] of CONFIGS[config]) {
    const t = b.team(name) ?? b.createTeam(name);
    b.setTeam(t, { prefix, suffix });
    b.joinTeam(member, name);
  }
  return b;
}
const PLAIN = { drown: "drowning", lava: "lava", fall: "a fall" };
const ATTACKERS = {
  zombie: { type: "zombie" }, zombieBob: { type: "zombie", customName: "Bob" }, zombieSword: { type: "zombie", equipment: [{ id: 267, displayName: "Sting" }] },
  skeleton: { type: "skeleton" }, ghast: { type: "ghast" }, creeper: { type: "creeper" }, witch: { type: "witch" },
  alex: { type: "player", isPlayer: true, customName: "Alex" }, alexSword: { type: "player", isPlayer: true, customName: "Alex", equipment: [{ id: 276, displayName: "Sting" }] },
};
function hitArgs(spec, b) {
  if (spec in PLAIN) return [PLAIN[spec], false, undefined, undefined, undefined];
  const [kind, who] = spec.split(":"), from = withTeamName(ATTACKERS[who], b);
  switch (kind) {
    case "mob": case "player": return ["a " + who, true, kind, from, undefined];
    case "thorns": return ["thorns", true, "thorns", who === "self" ? undefined : from, who === "self" ? { self: true } : undefined];
    case "arrow": return ["an arrow", true, undefined, who === "self" ? undefined : from, who === "self" ? { self: true } : undefined];
    case "fireball": return ["fireball", true, "fireball", who === "self" ? undefined : from, who === "self" ? { self: true } : undefined];
    case "explosion": return ["an explosion", true, "explosion", from, undefined];
    case "indirectMagic": return ["magic", false, "indirectMagic", from, undefined];
  }
  throw new Error(spec);
}
function replay(r) {
  const b = board(r.config), p = new Survival({}, "survival");
  p.food = 10; p.saturation = 0; p.protection = 0;
  let now = 0;
  for (const op of r.ops) {
    const [tick, kind, a, c] = op.split(" ");
    while (now < +tick) { now++; p.ticks = now; p.hurtTicks = Math.max(0, p.hurtTicks - 1); p.combat.tick(now); }
    const fall = kind === "fall";
    const [reason, blockable, source, from, via] = hitArgs(fall ? "fall" : a, b);
    p.combatSite = null; p.combatFall = fall ? +a : 0;
    p.damage(Math.fround(+c), fall ? "a fall" : reason, blockable, source, from, via);
  }
  return deathComponent(p.combat, b.formatName("Player"), {});
}

test("team-formatted names in death messages replay the native text and getFormattedText for 322 scenarios", () => {
  let n = 0, formatted = 0;
  for (const r of reference.records.filter((x) => x.name !== "chat")) {
    const c = replay(r), label = r.config + " " + r.name;
    assert.equal(c.unformatted(), r.preview.text, label + " text");
    assert.equal(c.formatted(), r.preview.formatted, label + " formatted");
    n++;
    if (/§/.test(r.preview.text)) formatted++;
  }
  assert.ok(n >= 320 && formatted > 150, JSON.stringify({ n, formatted }));
});

test("a mob is never team-formatted, even when a team lists its custom name; a player attacker is", () => {
  const rec = (config, name) => reference.records.find((x) => x.config === config && x.name === name).preview;
  assert.equal(rec("everyone", "zombie-bob-fatal").args[1], "Bob");
  assert.equal(rec("mobNameOnly", "zombie-bob-fatal").args[0], "Player");
  assert.equal(rec("victimAndAlex", "player-alex-fatal").args[1], "§9Alex§r");
  const b = board("everyone");
  assert.equal(withTeamName(ATTACKERS.zombieBob, b), ATTACKERS.zombieBob);
  assert.equal(withTeamName(ATTACKERS.alex, b).formattedName, "§9Alex§r");
});

test("chat.type.text with the team-formatted sender replays the native chat component", () => {
  for (const config of Object.keys(CONFIGS)) {
    const native = reference.records.find((x) => x.config === config && x.name === "chat").preview, c = chatTextComponent(board(config).formatName("Player"), "hello");
    assert.equal(c.unformatted(), native.text, config);
    assert.equal(c.formatted(), native.formatted, config);
  }
});
