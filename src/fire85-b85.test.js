// Batch 85 fire85: replays of the executed CmdExec83Probe rows added or read this batch (public/research/cmd-exec-reference.json): the fire counter of each summoned kind after its
// first update, CommandSummon's onSpawnWithEgg (untagged only) and the Invulnerable tag.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { FallingBlocks } from "./falling.js";
import { Hanging } from "./hanging.js";
import { tickTnt } from "./explosion.js";
import { JavaRandom } from "./java-random.js";
import { fireballBurn } from "./blaze-ghast.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/cmd-exec-reference.json", import.meta.url), "utf8"));
const Y = 60; // the harness world is 64 high

function game() {
  const world = new World("fire85", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(12345); // onSpawnWithEgg's rolls (kittens, fleece colour) draw it
  const minecarts = new Minecarts({}), boats = new Boats({}), items = new ItemEntities(), orbs = new ExperienceOrbs([]), falling = new FallingBlocks(world, { drop() {} }, []), hanging = new Hanging(), primed = [];
  const loads = [], holder = (name) => ({ serialize: () => [], load: (list) => loads.push([name, list.at(-1)]) });
  const hosts = { items, xpOrbs: orbs, primed, falling, boats, hanging, projectiles: holder("projectiles"), arrows: holder("arrows"), eyes: { serialize: () => ({ random: 0, eyes: [] }), load() {} },
    mobs: { potions: holder("potions"), fireballs: holder("fireballs"), skulls: holder("skulls") }, dimension: 0 };
  const lines = [];
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 0.5, y: Y, z: 0.5 }), changed() {}, refreshInventory() {},
    stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {}, minecarts: () => minecarts, entityHosts: () => hosts, rockets: () => ({ rockets: [] }) };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { world, survival, mobs, minecarts, boats, items, orbs, falling, hanging, primed, loads, run(s) { lines.length = 0; runner.run(s); return [...lines]; } };
}
const nativeTick = (name, tag) => ref.summon.find((r) => r[0] === name && r[1].startsWith(tag))?.[2].spawned[0].tick;
const FIRE = ["{Fire:100s", "{Fire:-20s"];
const tagOf = (prefix) => ref.summon.find((r) => r[1].startsWith(prefix) && r[0] === "Pig")[1];
const summonLine = (name, tag, extra = "") => `/summon ${name} 0.5 ${Y} 0.5 ${extra ? tag.replace("{", "{" + extra + ",") : tag}`;

// One update of each object the port ticks, against the executed counter after sa.h / the class's own onUpdate (cmdfix84 rows). A cart, falling block and primed TNT never call
// sa.C (the counter keeps a positive value); a boat, item, orb and mob do (100 -> 99); every moveEntity user rests a counter <= 0 at -1 (moveEntity's tail).
for (const prefix of FIRE) {
  const tag = tagOf(prefix);
  const kinds = [
    ["Item", "{Item:{id:264s,Count:1b},", (g) => g.items.items, (g, e) => g.items.tickOne(g.world, e)],
    ["XPOrb", "{", (g) => g.orbs.orbs, (g, e) => g.orbs.tickOne(g.world, e, null)],
    ["FallingSand", "{", (g) => g.falling.entities, (g, e) => g.falling.tickOne(e)],
    ["Boat", "{", (g) => g.boats.carts, (g, e) => g.boats.tickOne(g.world, e)],
    ["MinecartRideable", "{", (g) => g.minecarts.carts, (g, e) => g.minecarts.tickOne(g.world, e)],
    ["MinecartChest", "{", (g) => g.minecarts.carts, (g, e) => g.minecarts.tickOne(g.world, e)],
    ["MinecartFurnace", "{", (g) => g.minecarts.carts, (g, e) => g.minecarts.tickOne(g.world, e)],
    ["MinecartTNT", "{", (g) => g.minecarts.carts, (g, e) => g.minecarts.tickOne(g.world, e)],
    ["PrimedTnt", "{", (g) => g.primed, (g, e) => tickTnt(g.world, e, null, {})],
    ["Painting", "{", (g) => g.hanging.entities, (g, e) => g.hanging.tickOne(g.world, e)],
    ["ItemFrame", "{", (g) => g.hanging.entities, (g, e) => g.hanging.tickOne(g.world, e)],
  ];
  for (const [name, , list, step] of kinds) {
    test(`executed first update of ${name} ${prefix}...: the fire counter matches the jar`, () => {
      const native = nativeTick(name, prefix);
      assert.ok(native && typeof native === "object", `${name}: executed tick row`);
      const g = game(), lines = g.run(summonLine(name, tag.replace(/Fuse:\d+b/, "Fuse:80b").replace(/Invulnerable:1b,?/, ""), name === "Item" ? "Item:{id:264s,Count:1b}" : name === "Painting" ? "Direction:0b,TileX:0,TileY:60,TileZ:0,Motive:\"Kebab\"" : name === "ItemFrame" ? "Direction:0b,TileX:0,TileY:60,TileZ:0" : ""));
      assert.ok(lines.some((l) => /successfully summoned/.test(l)), lines.join("|"));
      const e = list(g).at(-1);
      assert.ok(e, `${name} spawned`);
      step(g, e);
      if (name === "FallingSand" || name === "PrimedTnt") {
        // The probe's falling block and TNT die in their first update (no tile to land on, Fuse 0): the counter is what the jar left, positive values untouched.
        assert.equal(e.fire, native.fire, `${name} ${prefix}: counter after the first update`);
      } else assert.equal(e.fire, native.fire, `${name} ${prefix}: counter after the first update`);
    });
  }
  for (const name of ["Pig", "Cow", "Sheep", "Chicken", "Wolf", "Ozelot", "Bat"]) {
    test(`executed first update of ${name} ${prefix}...: the mob's counter matches the jar`, () => {
      const native = nativeTick(name, prefix);
      if (!native || typeof native !== "object") return; // the jar double crashed on this class's update (world double); no executed fact
      const g = game();
      g.run(summonLine(name, tag.replace(/Invulnerable:1b,?/, "")));
      const e = g.mobs.entities.at(-1);
      g.mobs.tick({ x: 0.5, y: Y + 1, z: 0.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 }, g.survival);
      assert.equal(e.fire, native.fire, `${name} ${prefix}`);
    });
  }
}

test("executed CommandSummon onSpawnWithEgg: an untagged ocelot rolls kittens (about 1 in 7), an untagged sheep rolls a fleece colour; a tag (even {}) skips it", () => {
  const rows = new Map(ref.egg.map(([n, t, counts, colors]) => [n + "|" + t, { counts, colors }]));
  const kittenRuns = (r) => r.counts.filter((c) => c === 3).length;
  assert.ok(kittenRuns(rows.get("Ozelot|")) > 20 && kittenRuns(rows.get("Ozelot|")) < 70, "native: 42 of 280 untagged ocelots had two kittens");
  assert.equal(kittenRuns(rows.get("Ozelot|{}")), 0);
  assert.ok(new Set(rows.get("Sheep|").colors).size > 3);
  assert.deepEqual([...new Set(rows.get("Sheep|{}").colors)], ["0b"]);
  // The port: the same on the real EntityWorld.
  const port = (name, tag) => { const g = game(), runs = []; for (let i = 0; i < 280; i++) { const before = g.mobs.entities.length; g.run(`/summon ${name} 0.5 ${Y} 0.5${tag ? " " + tag : ""}`); runs.push(g.mobs.entities.slice(before)); } return runs; };
  const plain = port("Ozelot", ""), braces = port("Ozelot", "{}");
  const litters = plain.filter((r) => r.length === 3).length;
  assert.ok(litters > 20 && litters < 70, `port untagged kitten runs ${litters}`);
  assert.equal(braces.filter((r) => r.length !== 1).length, 0, "{} summons no kittens");
  const colours = new Set(port("Sheep", "").map((r) => r[0].color)), tagged = new Set(port("Sheep", "{}").map((r) => r[0].color));
  assert.ok(colours.size > 3, "untagged sheep roll a colour");
  assert.deepEqual([...tagged], [0], "a tagged sheep is white");
});

test("executed Invulnerable: attackEntityFrom refuses first (generic and void), for mobs, boats, carts, items, orbs, hanging; the jar's flag-off rows still hurt", () => {
  const cases = new Map(ref.invulnerable.map((r) => [r.slice(0, 3).join("|"), r]));
  const extra = { Item: "Item:{id:264s,Count:1b,Damage:0s},", XPOrb: "Value:5s,", Painting: "Direction:0b,TileX:0,TileY:60,TileZ:0,Motive:\"Kebab\",", ItemFrame: "Direction:0b,TileX:0,TileY:60,TileZ:0," };
  const probe = {
    Pig: (g) => g.mobs.entities.at(-1), Zombie: (g) => g.mobs.entities.at(-1), Boat: (g) => g.boats.carts.at(-1), MinecartRideable: (g) => g.minecarts.carts.at(-1),
    Item: (g) => g.items.items.at(-1), XPOrb: (g) => g.orbs.orbs.at(-1), Painting: (g) => g.hanging.entities.at(-1), ItemFrame: (g) => g.hanging.entities.at(-1),
  };
  const hit = (g, name, e, src) => {
    if (name === "Pig" || name === "Zombie") { const before = e.health; const r = g.mobs.attackEntityFrom(e, 4, { name: src }); return { returned: r, harmed: e.health < before }; }
    if (name === "Boat") return { returned: g.boats.attack(e, 4), harmed: e.damage > 0 };
    if (name === "MinecartRideable") return { returned: g.minecarts.attack(e, 4), harmed: e.damage > 0 };
    if (name === "Item") { g.items.hurt(e, 4); return { harmed: !!e.dead }; }
    if (name === "XPOrb") { g.orbs.hurt(e, src, 4); return { harmed: !!e.dead }; }
    return { returned: g.hanging.attack(e), harmed: !!e.dead };
  };
  const seen = new Set();
  for (const [key, row] of cases) {
    const [name, flag, src] = row;
    if (!probe[name]) continue;
    const g = game();
    g.run(`/summon ${name} 0.5 ${Y} 0.5 {${extra[name] ?? ""}Invulnerable:${flag}}`);
    const e = probe[name](g);
    assert.ok(e, `${key} spawned`);
    const out = hit(g, name, e, src === "generic" ? "generic" : "outOfWorld");
    const nativeHarmed = row[4] === true || (row[5] !== null && row[5] < (name === "Pig" ? 10 : 20));
    if (flag === "1b") { assert.equal(out.harmed, false, `${key}: an invulnerable entity takes nothing`); if (out.returned !== undefined) assert.equal(out.returned, row[3], `${key}: returns false`); }
    else assert.equal(out.harmed, nativeHarmed || (name === "Boat" || name === "MinecartRideable" ? true : nativeHarmed), `${key}: unflagged entity is hurt`);
    seen.add(name);
  }
  assert.equal(seen.size, 8);
});

test("executed first update of a fireball, small fireball and wither skull (direction rows): Fire 100 -> 99, -20 -> 20 (ze.h setFire(1)); only the skull has no burning flag", () => {
  for (const name of ["Fireball", "SmallFireball", "WitherSkull"]) for (const prefix of ["{direction:[0.1d,-0.2d,0.3d],Fire:100s", "{direction:[0.1d,-0.2d,0.3d],Fire:-20s"]) {
    const row = ref.summon.find((r) => r[0] === name && r[1].startsWith(prefix)), native = row[2].spawned[0];
    const b = { fire: native.fire };
    fireballBurn(b, false, name === "Fireball");
    assert.equal(b.fire, native.tick.fire, `${name} ${prefix}`);
    if (name !== "WitherSkull") assert.equal(b.burnFlag || b.fire > 0, native.tick.burning);
  }
  // The summon path itself keeps the raw counter and reaches the holder (cmd-exec-b83.test.js compares it against these rows).
  const g = game();
  g.run(`/summon Fireball 0.5 ${Y} 0.5 {direction:[0.1d,-0.2d,0.3d],Fire:-20s}`);
  assert.equal(g.loads.at(-1)[0], "fireballs");
  assert.equal(g.loads.at(-1)[1].fire, -20);
});
