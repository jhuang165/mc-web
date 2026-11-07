// Replays player-damage-reference.json (tools/verify-player-damage.mjs, PlayerDamageProbe.java):
// hurt-window top-ups and the hurt/death statuses they send, spawn protection and Creative
// against every DamageSource (the void passes both), the void below y -64 and death messages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival, VOID } from "./survival.js";
import { makeStack } from "./inventory.js";
import { deathMessage, DEATH_TEXT, PLAYER_NAME } from "./death-messages.js";
const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/player-damage-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);

// DamageSource type -> this build's Survival.damage reason and whether armour applies.
const SOURCES = {
  inFire: ["fire", true], onFire: ["burning", false], lava: ["lava", true], inWall: ["suffocation", false],
  drown: ["drowning", false], starve: ["starvation", false], cactus: ["a cactus", true], fall: ["a fall", false],
  outOfWorld: [VOID, false], generic: ["an accident", false], mob: ["a zombie", true],
};
function player(setup) {
  const p = new Survival({}, setup.creative ? "creative" : "survival");
  // FoodStats.onUpdate does not run in the probe: keep the food below natural regeneration.
  p.food = 10;
  p.saturation = 0;
  if (setup.health !== undefined) p.health = f(setup.health);
  p.protection = setup.protection ?? 0;
  if (setup.armor) {
    for (let i = 0; i < 4; i++) p.inventory.setStack(36 + i, makeStack(408 + i, 1, 0));
    assert.equal(p.armorValue, 15);
  }
  return p;
}
// Mob hits go through the difficulty scaling (Normal: unchanged) then armour.
const hit = (p, source, amount) => {
  const [reason, blockable] = SOURCES[source];
  return source === "mob" ? p.scaledDamage(f(amount), reason) : p.damage(f(amount), reason, blockable);
};
// hurtResistantTime is 10 + hurtTicks while the window is open.
const resistMatches = (p, resist) => (p.hurtTicks > 0 ? p.hurtTicks + 10 === resist : resist <= 10);

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(Object.fromEntries(["hits", "protection", "void"].map((c) => [c, records(c).length])), { hits: 30, protection: 77, void: 9 });
});

test("hurt-window hits and top-ups match the original; only fresh hits send the hurt status and sound", () => {
  let topUps = 0, fresh = 0, deaths = 0;
  for (const r of records("hits").filter((s) => s.type === "player")) {
    const p = player(r.setup);
    let h = 0;
    for (let t = 0; h < r.hits.length || t < r.ticks.length; t++) {
      for (; h < r.hits.length && r.hits[h].tick === t; h++) {
        const e = r.hits[h], at = `${r.name} hit ${h}`, before = p.health;
        p.hurtSounds.length = 0;
        p.hurtTime = 0;
        assert.equal(hit(p, e.source, e.amount), e.accepted, at);
        assert.equal(p.health, f(e.health), at);
        assert.ok(resistMatches(p, e.resist), at);
        assert.equal(p.hurtAmount, f(e.last), at);
        // Status 2 (EntityLivingBase.handleHealthUpdate: the client's hurt sound and hurtTime 10) only
        // for a hit that opens a window; the server's own hurt or death sound goes to everyone else.
        const status2 = e.events.includes("status|2");
        assert.equal(p.hurtSounds.includes("game.player.hurt"), status2, at);
        assert.equal(e.events.some((q) => q.startsWith("except|game.player.")), status2, at);
        // A top-up is accepted without status 2; setPlayerSPHealth still restarts the client's hurtTime.
        if (e.accepted && !status2) topUps++;
        if (status2) fresh++;
        assert.equal(p.hurtTime, e.accepted && (status2 || p.health < before) ? 10 : 0, at);
        // onDeath sends status 3, which plays game.player.die on the client (the probe stubs the
        // player's onDeath; the zombie records below show status 3 after a top-up kill too).
        assert.equal(p.hurtSounds.includes("game.player.die"), e.health <= 0 && e.accepted, at);
        if (e.health <= 0) {
          assert.equal(t, r.deadAt, at);
          deaths++;
        }
      }
      if (p.health <= 0 || t >= r.ticks.length) break;
      p.tick();
      const s = r.ticks[t], at = `${r.name} tick ${t}`;
      assert.equal(p.health, f(s.health), at);
      assert.ok(resistMatches(p, s.resist), at);
    }
  }
  assert.ok(topUps >= 7 && fresh >= 30 && deaths >= 22, `${topUps} ${fresh} ${deaths}`);
});

test("a mob's top-up kill plays no death sound but still sends status 3", () => {
  const fatal = records("hits").find((r) => r.name === "topup-fatal-zombie").hits.at(-1);
  assert.deepEqual(fatal.events, ["status|3"]);
  const fresh = records("hits").find((r) => r.name === "fresh-fatal-zombie").hits[0];
  assert.deepEqual(fresh.events, ["status|2", "sound|mob.zombie.death|1.0", "status|3"]);
});

test("spawn protection and Creative refuse every source but the void, which also bypasses armour", () => {
  let checked = 0;
  for (const r of records("protection")) {
    const p = player(r.setup), at = `${r.source} ${JSON.stringify(r.setup)}`;
    assert.equal(hit(p, r.source, r.amount), r.accepted, at);
    assert.equal(p.health, f(r.health), at);
    assert.equal(p.hurtSounds.includes("game.player.hurt"), r.events.includes("status|2"), at);
    checked++;
  }
  assert.equal(checked, 77);
  for (const setup of [{ protection: 60 }, { creative: true }, { armor: true, protection: 60 }])
    assert.equal(records("protection").find((r) => r.source === "outOfWorld" && JSON.stringify(r.setup) === JSON.stringify(setup)).health, 16);
});

test("below y -64 the player takes outOfWorld 4 every 10 ticks, protected, armoured or in Creative", () => {
  let deaths = 0;
  for (const r of records("void").filter((s) => s.type === "player")) {
    const p = player(r.setup);
    for (let t = 0; t < r.ticks.length; t++) {
      const s = r.ticks[t], at = `${r.name} tick ${t}`;
      p.tick({ outOfWorld: r.y < -64 });
      assert.equal(p.health, f(s.health), at);
      assert.ok(resistMatches(p, s.resist), at);
      if (p.health > 0) continue;
      assert.equal(t, r.deadAt, at);
      assert.equal(p.lastDamage, VOID);
      assert.equal(deathMessage(p.lastDamage), r.message.text, at);
      deaths++;
      break;
    }
    if (r.deadAt < 0) assert.ok(p.health > 0, r.name);
  }
  assert.equal(deaths, 5);
});

test("a death message of one hit alone reads the original text for every source (combat-tracker.test.js replays the full matrix)", () => {
  let single = 0;
  for (const r of records("hits").filter((s) => s.name.startsWith("death-"))) {
    const last = r.hits.at(-1), [reason] = SOURCES[last.source];
    assert.equal(r.message.args[0], PLAYER_NAME, r.name);
    if (r.hits.length === 1 && last.source !== "mob") { assert.equal(deathMessage(reason), r.message.text, r.name); single++; }
  }
  assert.ok(single >= 6, `${single} single-hit deaths`);
  assert.equal(deathMessage("suffocation"), "Player suffocated in a wall");
  // Survival records the reason of the killing hit.
  const p = player({ health: 1 });
  p.tick({ inWall: true });
  assert.equal(p.health, 0);
  assert.equal(p.died, true);
  assert.equal(deathMessage(p.lastDamage), "Player suffocated in a wall");
});
