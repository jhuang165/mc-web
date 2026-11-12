// Batch 49 (firearmor): which of armour (with its durability loss), Resistance, enchantment protection, absorption and hunger exhaustion each DamageSource goes through.
// Replays public/research/armor-source-reference.json (tools/probes/ArmorSourceProbe.java run by tools/verify-armor-sources.mjs, records tagged b49fa): the unchanged
// EntityPlayerMP.attackEntityFrom with armour worn, Protection enchantments, the Resistance potion and absorption, for every DamageSource the port uses on the player.
// Bytecode-read: sv.b (applyArmorCalculations: `if (!source.isUnblockable())`, then damageArmor), sv.c (applyPotionDamageCalculations: absolute sources return first,
// Resistance except for outOfWorld, then the enchantment step), sv.d / yz.d (absorption, then addExhaustion(source.hungerDamage)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival, VOID } from "./survival.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { enchantmentRandom, isUnblockable } from "./armor-enchantments.js";
import { armorReduced } from "./combat.js";
const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/armor-source-reference.json", import.meta.url)));
const records = reference.records;

// The probe's source name -> how this build hurts the player with it.
const HURT = {
  inFire: (s, n) => s.damage(n, "fire", true), onFire: (s, n) => s.damage(n, "burning"), lava: (s, n) => s.damage(n, "lava", true), inWall: (s, n) => s.damage(n, "suffocation"),
  drown: (s, n) => s.damage(n, "drowning"), starve: (s, n) => s.damage(n, "starvation"), cactus: (s, n) => s.damage(n, "a cactus", true), fall: (s, n) => s.damage(n, "a fall"),
  outOfWorld: (s, n) => s.damage(n, VOID), generic: (s, n) => s.damage(n), magic: (s, n) => s.damage(n, "magic"), wither: (s, n) => s.damage(n, "wither"),
  anvil: (s, n) => s.anvilDamage(n, "anvil"), fallingBlock: (s, n) => s.anvilDamage(n, "fallingBlock"),
  mob: (s, n) => s.scaledDamage(n, "a zombie"),
  arrow: (s, n) => s.damage(n, "an arrow", true), fireball: (s, n) => s.damage(n, "fireball", true, "fireball"), thrown: (s, n) => s.damage(n, "a snowball", true, "thrown"),
  indirectMagic: (s, n) => s.damage(n, "magic", false, "indirectMagic"), thorns: (s, n) => s.damage(n, "thorns", true, "thorns"), explosion: (s, n) => s.damage(n, "an explosion", true),
};
const BASE = [298, 306, 310]; // probe material -> vanilla helmet id; this build's armour ids are 400 + material * 4 + piece (leather 0, iron 2, diamond 4)
const PORT_MATERIAL = [0, 2, 4];
function wearer(r) {
  const s = new Survival({}, "survival");
  s.protection = 0;
  s.difficulty = 2;
  if (r.material >= 0) for (let i = 0; i < 4; i++) s.inventory.armor[i] = makeStack(400 + PORT_MATERIAL[r.material] * 4 + (3 - i), 1, 0, undefined, r.ench >= 0 ? { enchantments: [{ id: r.ench, lvl: r.level }] } : {});
  if (r.resistance >= 0) s.effects.add({ id: 11, duration: 1000, amplifier: r.resistance });
  s.absorption = f(r.absorption);
  s.inventory.random = new JavaRandom(7n); // Entity.rand of the probe's player: the anvil helmet wear draws from it
  enchantmentRandom.setSeed(BigInt(r.seed));
  return s;
}
const wornDamage = (s) => [0, 1, 2, 3].map((i) => (s.inventory.armor[i] ? s.inventory.armor[i].damage : null));

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.tag, "b49fa");
  assert.ok(records.length >= 650, String(records.length));
  assert.deepEqual(new Set(records.map((r) => r.source)), new Set(Object.keys(HURT)));
});

test("every record: health, armour wear, absorption and exhaustion match the unchanged attackEntityFrom", () => {
  const failures = [];
  for (const r of records) {
    const s = wearer(r);
    const accepted = !!HURT[r.source](s, f(r.amount));
    const got = { accepted, health: s.health, absorbed: s.absorption, armor: wornDamage(s), exhaustion: f(s.exhaustion) };
    const want = { accepted: r.accepted, health: f(r.health), absorbed: f(r.absorbed), armor: r.armor, exhaustion: f(r.exhaustion) };
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${r.case}/${r.source}/${r.amount}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
  assert.equal(failures.length, 0, failures.length + " of " + records.length + "\n" + failures.slice(0, 40).join("\n"));
});

test("the caller's blockable flag no longer decides armour: the DamageSource does", () => {
  const worn = () => { const s = new Survival({}, "survival"); s.protection = 0; for (let i = 0; i < 4; i++) s.inventory.armor[i] = makeStack(408 + (3 - i), 1, 0); return s; };
  const burning = worn(); burning.damage(4, "burning", true); // onFire is setDamageBypassesArmor, whatever the caller passes
  assert.equal(burning.health, 16);
  assert.deepEqual(wornDamage(burning), [0, 0, 0, 0], "no durability lost");
  const fire = worn(); fire.damage(4, "fire", false); // inFire is not
  assert.equal(fire.health, f(20 - f(f(4 * 10) / 25)));
  assert.deepEqual(wornDamage(fire), [1, 1, 1, 1]);
  for (const key of ["onFire", "inWall", "drown", "starve", "fall", "outOfWorld", "generic", "magic", "wither", "indirectMagic"]) assert.equal(isUnblockable(key), true, key);
  for (const key of ["inFire", "lava", "cactus", "anvil", "fallingBlock", "explosion", "arrow", "fireball", "thrown", "thorns", "mob"]) assert.equal(isUnblockable(key), false, key);
});

test("starvation is absolute: Resistance and enchantments do not touch it; outOfWorld ignores Resistance only", () => {
  const s = new Survival({}, "survival"); s.protection = 0; s.effects.add({ id: 11, duration: 1000, amplifier: 4 });
  s.damage(3, "starvation");
  assert.equal(s.health, 17);
  const v = new Survival({}, "survival"); v.protection = 0; v.effects.add({ id: 11, duration: 1000, amplifier: 4 });
  v.damage(4, VOID);
  assert.equal(v.health, 16);
  const m = new Survival({}, "survival"); m.protection = 0; m.effects.add({ id: 11, duration: 1000, amplifier: 4 });
  m.damage(4, "magic");
  assert.equal(m.health, 20, "Resistance V takes it all");
});

test("a hit adds 0.3 exhaustion unless it bypasses armour, is absolute, or is absorbed completely", () => {
  const hurt = (reason, amount = 2, absorption = 0) => { const s = new Survival({}, "survival"); s.protection = 0; s.absorption = absorption; s.damage(amount, reason); return f(s.exhaustion); };
  assert.equal(hurt("a zombie"), f(0.3));
  assert.equal(hurt("lava"), f(0.3));
  assert.equal(hurt("a fall"), 0);
  assert.equal(hurt("burning"), 0);
  assert.equal(hurt("starvation"), 0);
  assert.equal(hurt("a zombie", 2, 4), 0, "fully absorbed: addExhaustion is never reached");
  assert.equal(hurt("a zombie", 2, 1), f(0.3));
});

test("mobs use the same bypass-armour sources as the player (combat.js armorReduced)", () => {
  for (const key of ["onFire", "inWall", "drown", "starve", "fall", "outOfWorld", "generic", "magic", "wither", "indirectMagic"]) assert.equal(armorReduced("zombie", 10, key), 10, key);
  for (const key of ["inFire", "lava", "cactus", "anvil", "fallingBlock", "explosion", "arrow", "fireball", "thrown", "thorns", "mob", "player"]) assert.equal(armorReduced("zombie", 10, key), f(f(10 * 23) / 25), key); // a zombie's 2 natural points
});
