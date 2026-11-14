// Batch 73 sounds73: the reference list of every sound event name the 1.7.10 client constants carry (public/research/sound-events-reference.json,
// tools/build-sound-events-reference.mjs, bytecode-read) against the port's manifest and call sites.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ServerDispense } from "./multiplayer/server-dispense.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const ref = JSON.parse(read("../public/research/sound-events-reference.json"));
const manifest = JSON.parse(read("../public/audio/1.7.10/manifest.json"));
const rows = (event) => ref.rows.filter((r) => r.event === event);

test("the reference is the 1.7.10 client's and its sounds.json is the indexed one", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ref.soundsJsonSha1, "fce0bb3e14ade7b292a7c1d5fa785533d8106d82");
  assert.equal(ref.soundsJsonEvents.length, 229);
  assert.ok(ref.eventNames.length > 150 && ref.rows.length > 250);
});

test("the manifest holds every sounds.json event but random.wood_click, which no 1.7.10 class names", () => {
  const defined = new Set(ref.soundsJsonEvents), have = Object.keys(manifest.events);
  assert.deepEqual(have.filter((e) => !defined.has(e)), []);
  assert.deepEqual([...defined].filter((e) => !manifest.events[e] && !/^(music|records)\./.test(e)), ["random.wood_click"]);
  assert.ok(!ref.eventNames.includes("random.wood_click"));
});

test("names the client plays that sounds.json lacks are silent: Thorns' damage.thorns, the slime attack, the horse chest plop and the witch", () => {
  assert.deepEqual(ref.notInSoundsJson, ["damage.thorns", "mob.attack", "mob.chickenplop", "mob.witch.death", "mob.witch.hurt", "mob.witch.idle"]);
  for (const e of ref.notInSoundsJson) assert.equal(manifest.events[e], undefined);
  assert.ok(!Object.keys(manifest.files).some((f) => /witch/.test(f)));
  // EntitySlime plays mob.attack, not sounds.json's mob.slime.attack (which no class names).
  assert.equal(rows("mob.attack")[0].class, "EntitySlime");
  assert.ok(ref.soundsJsonNeverNamed.includes("mob.slime.attack"));
  assert.deepEqual(rows("mob.witch.idle").map((r) => r.role), ["return"]);
});

test("BlockCake and BlockCauldron hold no sound constant; food sounds are EntityPlayer.updateItemUse's eat and ItemFood.onEaten's burp", () => {
  assert.deepEqual(ref.rows.filter((r) => /^Block(Cake|Cauldron)$/.test(r.class)), []);
  assert.deepEqual(rows("random.eat").map((r) => r.class), ["EntityPlayer"]);
  const burp = rows("random.burp");
  assert.deepEqual(burp.map((r) => [r.class, r.args]), [["ItemFood", "0.5f rand.nextFloat 0.1f fmul 0.9f fadd"]]);
});

test("the arrow ding is S2B reason 6: random.successful_hit 0.18, 0.45", () => {
  const r = rows("random.successful_hit");
  assert.equal(r.length, 1);
  assert.equal(r[0].class, "NetHandlerPlayClient");
  assert.equal(r[0].args, "0.18f 0.45f iconst_0");
  assert.ok(manifest.events["random.successful_hit"]);
});

test("the port's sound names are all 1.7.10 names (or listed non-sound strings); removed phantom events stay out", () => {
  const known = new Set([...ref.eventNames, ...ref.soundsJsonEvents]);
  // Strings the scan catches that are not events: enchantment/lang keys, entity fields, a prefix argument.
  const notEvents = new Set(["portal.desc", "damage.all", "damage.undead", "damage.arthropods", "mob.leadWire", "fire.L.difficulty", "game.itemSystem", "game.orbSystem", "mob.rotationYaw"]);
  const files = [];
  (function walk(d) { for (const f of readdirSync(new URL(d, import.meta.url), { withFileTypes: true })) { const p = d + f.name; if (f.isDirectory()) walk(p + "/"); else if (/\.js$/.test(f.name) && !/\.test\.js$/.test(f.name)) files.push(p); } })("./");
  const re = /["'`]((?:ambient|creeper|damage|dig|fire|fireworks|game|liquid|minecart|mob|music|note|portal|random|records|step)\.[a-z0-9_.A-Z]+)["'`]/g;
  const unknown = [];
  for (const f of files) { const t = read(f); let m; while ((m = re.exec(t))) if (!known.has(m[1]) && !notEvents.has(m[1]) && !m[1].endsWith(".")) unknown.push(`${f}: ${m[1]}`); }
  assert.deepEqual(unknown, []);
  assert.ok(!files.some((f) => /["'`]liquid\.splash["'`]/.test(read(f))));
  // random.eat on a cake slice (BlockCake plays nothing) and the cauldron's splash are gone.
  assert.ok(!/["'`]random\.eat["'`]/.test(read("./player-edit-simulation.js")));
});

test("the server sends the ding only to a player shooter whose arrow hurt another player", () => {
  const mk = (id) => ({ id, name: id, position: { x: 1, y: 64, z: 2, copy() {} }, survival: { health: 20, damage() {}, setFire() {}, arrowCount: 0 }, dead: false });
  const a = mk("a"), b = mk("b");
  const players = new Map([["a", a], ["b", b]]);
  const arrow = { fire: 0, shooter: "player", mx: 0, mz: 0 };
  const host = (owner, hurt = true) => ({ sim: { players, damagePlayer: () => hurt, fx: [] }, ownerOf: () => owner, fx: [] });
  const hit = (h, victim) => ServerDispense.prototype.hitPlayer.call(h, arrow, victim, 4, null);
  assert.equal(hit(host(a), b), true);
  assert.deepEqual(a.soundsOut, [{ name: "random.successful_hit", x: 1, y: 64 + 1.74, z: 2, volume: Math.fround(0.18), pitch: Math.fround(0.45) }]);
  assert.equal(b.soundsOut, undefined);
  a.soundsOut = undefined;
  hit(host(a), a); // a self hit (the shooter is the victim) plays nothing
  hit(host(a, false), b); // a refused hit (PvP off) plays nothing
  hit(host(undefined), b); // a mob's or dispenser's arrow has no shooter to ding
  assert.equal(a.soundsOut, undefined);
});
