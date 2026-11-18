// Batch 80 potspacks80: flower pot tall grass / cobweb reads and the pot-meta grass tint; pack.mcmeta loading (JsonParser, PackMetadataSectionSerializer,
// JsonUtils.getInt, the repository's "not listed" rule) and translate descriptions. Pack rows: pack-meta-reference.json (Executed, PackMetaProbe over the
// unchanged ResourcePackRepository.Entry). Pot render and drop rules: Bytecode-read (RenderBlocks.func_147752_a, BlockTallGrass anz, BlockFlowerPot ald).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { potFromNbt, potNbtOf, potPlantOf, potDrawDamage, potInsertion, potPlantTinted, setPotContents, potContents, serializePots, restorePots, potDrops, potPick } from "./stone-utility.js";
import { parsePackMcmeta, packInfo, folderPack, descriptionText } from "./resource-packs.js";
import { packRowDescription } from "./resource-packs-ui.js";
import { langReady } from "./chat-component.js";
import { EN_US } from "./lang-en-us.js";
import { lang } from "./lang.js";
import { itemFromOriginal } from "./region-import.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/research/${f}`, import.meta.url), "utf8"));

test("tall grass pots read from NBT draw BlockTallGrass.getIcon(0, Data): deadbush, tallgrass, fern, then icons[0]", () => {
  assert.deepEqual([...Array(16).keys()].map((d) => potDrawDamage(31, d)), [0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(potFromNbt({ Item: 31, Data: -1 }), { id: 0, damage: 0, item: 31, data: -1 }); // negative index: the client throws; b81: kept undrawn
  assert.deepEqual(potFromNbt({ Item: 31, Data: 0 }), { id: 83, damage: 0 });
  assert.deepEqual(potFromNbt({ Item: 31, Data: 1 }), { id: 39, damage: 0 });
  assert.deepEqual(potFromNbt({ Item: 31, Data: 2 }), { id: 84, damage: 0 });
  assert.deepEqual(potFromNbt({ Item: 31, Data: 7 }), { id: 83, damage: 0, data: 7 });
  assert.deepEqual(potFromNbt({ Item: 30, Data: 0 }), { id: 51, damage: 0 }); // cobweb: render type 1, drawn crossed
  assert.deepEqual(potFromNbt({ Item: 30, Data: 4 }), { id: 51, damage: 0, data: 4 });
  const world = { pots: new Map(), getMeta: () => 0 };
  for (let d = 0; d < 16; d++) for (const item of [30, 31]) {
    const c = potFromNbt({ Item: item, Data: d });
    assert.deepEqual(potNbtOf(c), { Item: item, Data: d }, `export ${item}:${d}`);
    setPotContents(world, 0, 0, 0, c);
    world.pots = new Map(); restorePots(world, JSON.parse(JSON.stringify(serializePots({ pots: new Map([["0,0,0", c]]) }))));
    assert.deepEqual(potNbtOf(potContents(world, 0, 0, 0)), { Item: item, Data: d }, `save ${item}:${d}`);
  }
});

test("a click still only plants what BlockFlowerPot.func_149928_a accepts (no tall grass 0/1, no cobweb)", () => {
  for (const id of [39, 83, 51]) assert.equal(potInsertion(id, 0), null);
  assert.deepEqual(potInsertion(84, 0), { content: { id: 84, damage: 0 }, meta: 2 });
  const accepted = new Set(read("pot-sweep-reference.json").rows.filter((r) => r.kind === "potAccept").map((r) => `${r.id}:${r.damage}`));
  for (const d of [0, 1]) assert.equal(accepted.has(`31:${d}`), false);
});

test("break and pick give the stored native stack where the port can hold it", () => {
  const world = { pots: new Map(), getMeta: () => 0 };
  for (const [item, data] of [[31, 0], [31, 1], [31, 2], [30, 0], [38, 4], [6, 5]]) {
    setPotContents(world, 0, 0, 0, potFromNbt({ Item: item, Data: data }));
    const want = itemFromOriginal(item, data);
    assert.deepEqual(potDrops(world, 0, 0, 0)[0], { id: want.id, count: 1, damage: want.damage }, `${item}:${data}`);
    assert.deepEqual(potPick(world, 0, 0, 0), { id: want.id, damage: want.damage });
  }
  // Unrepresentable native stacks (tall grass 3-15, red flower 9-15...): b81 drops the item at damage 0 with rawDamage = Data (export writes 31:9 back).
  setPotContents(world, 0, 0, 0, potFromNbt({ Item: 31, Data: 9 }));
  assert.equal(itemFromOriginal(31, 9), null);
  assert.deepEqual(potDrops(world, 0, 0, 0)[0], { id: 83, count: 1, damage: 0, rawDamage: 9 });
});

test("BlockTallGrass.colorMultiplier reads the pot's metadata: 0 is white, anything else the grass colour", () => {
  const fern = { id: 84, damage: 0 }, shrub = { id: 83, damage: 0 }, grass = { id: 39, damage: 0 };
  assert.equal(potPlantTinted(fern, 0), false);
  assert.equal(potPlantTinted(fern, 2), true);
  assert.equal(potPlantTinted(fern, 11), true);
  assert.equal(potPlantTinted(shrub, 5), true);
  assert.equal(potPlantTinted(grass, 0), false);
  assert.equal(potPlantTinted({ id: 79, damage: 0 }, 10), false); // dead bush (item 32) is BlockDeadBush: white
  assert.equal(potPlantTinted({ id: 51, damage: 0 }, 3), false);
  assert.equal(potPlantTinted(null, 3), false);
});

test("pack.mcmeta rows replay the unchanged ResourcePackRepository.Entry load and row text", async () => {
  await langReady;
  const ref = read("pack-meta-reference.json");
  assert.ok(ref.rows.length >= 50);
  const synthetic = Object.entries(ref.lang).filter(([k]) => EN_US[k] == null);
  for (const [k, v] of synthetic) EN_US[k] = v;
  try {
    for (const [mcmeta, loadError, packFormat, row, rowError] of ref.rows) {
      const info = mcmeta === "<missing>" ? await packInfo(folderPack("p", {})) : parsePackMcmeta(mcmeta);
      assert.equal(info.listed, loadError == null, `listed ${mcmeta} (${loadError})`);
      if (loadError != null) continue;
      if (packFormat != null) assert.equal(info.packFormat, packFormat, `format ${mcmeta}`);
      if (rowError != null) { assert.ok(info.drawError, `draw error ${mcmeta}`); assert.equal(packRowDescription(info), ""); }
      else { assert.equal(info.drawError, undefined, mcmeta); assert.equal(packRowDescription(info), row, mcmeta); }
    }
  } finally { for (const [k] of synthetic) delete EN_US[k]; }
});

test("translate descriptions use the current table and fall back to English when the current format fails", async () => {
  await langReady;
  const saved = lang.table;
  try {
    lang.table = { "resourcePack.title": "Packs %s", "death.attack.player": "%x broken" };
    assert.equal(descriptionText({ translate: "resourcePack.title", with: ["A"] }).formatted, "Packs §rA§r");
    // ChatComponentTranslation.ensureInitialized: the current pattern fails, translateToFallback (en_US) is used.
    assert.equal(descriptionText({ translate: "death.attack.player", with: ["A", "B"] }).formatted, "A§r was slain by §rB§r");
  } finally { lang.table = saved; }
  assert.equal(descriptionText({ translate: "no.such.key" }).formatted, "no.such.key§r");
});
