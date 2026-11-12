// b52cc: getFormattedText / getUnformattedText of the unchanged 1.7.10 component classes (tools/probes/ChatComponentProbe.java ->
// public/research/chat-component-reference.json), replayed over the port's trees, and the chat window drawing the component of command feedback.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { text as T, translation as TR, serializeComponent } from "./chat-component.js";
import { adminComponent } from "./command-block.js";
import { createCommandRunner } from "./commands.js";
import { ChatLog } from "./chat.js";
import { Chunk } from "./chunk-store.js";
import { NBT } from "./nbt.js";
import { chunkToNbt } from "./chunk-nbt.js";
import { encodeRegionChunk, writeRegion, regionAddress } from "./region-file.js";
import { importJavaRegionArea } from "./region-import.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/chat-component-reference.json", import.meta.url)));
const row = (n) => ref.rows.find((r) => r[0] === n);
const styled = (c, s) => { Object.assign(c.style, s); return c; };
const text = (s, st) => styled(T(s), st ?? {});
const trees = {
  helpHeader: () => styled(TR("commands.help.header", 1, 5), { color: "dark_green" }),
  helpLine: () => TR("commands.tp.usage"),
  helpFooter: () => styled(TR("commands.help.footer"), { color: "green" }),
  deprecatedId: () => styled(TR("commands.generic.deprecatedId", "minecraft:stone"), { color: "gray" }),
  deprecatedIdSibling: () => styled(TR("commands.generic.deprecatedId", "minecraft:stone"), { color: "gray" }).append(T(" (more)")),
  adminGive: () => adminComponent("@", TR("commands.give.success", "Stone", 5, "Player")),
  adminTp: () => adminComponent("Rcon", TR("commands.tp.success.coordinates", "Player", "1.5", "64.0", "-3.0")),
  usageError: () => styled(TR("commands.generic.usage", TR("commands.tp.usage")), { color: "red" }),
  nestedStyles: () => { const r = styled(T("root "), { bold: true }), m = text("mid ", { color: "red", italic: true }); m.append(T("inner ")); r.append(m); r.append(T("tail")); return r; },
  argumentStyle: () => styled(TR("commands.give.success", text("[Stone]", { italic: true }), 5, "Player"), { color: "aqua" }),
  ownColour: () => text("gold", { color: "yellow", bold: true }),
  achievement: () => TR("chat.type.achievement", "Player", text("[Taking Inventory]", { color: "green" })),
  announcement: () => TR("chat.type.announcement", "Server", "hello world"),
  chatText: () => TR("chat.type.text", "Player", "plain"),
  emptyRoot: () => { const r = T(""); r.append(text("first", { color: "red" })); r.append(T(" second")); return r; },
};

test("every executed row: JSON, getFormattedText and getUnformattedText match", () => {
  assert.equal(ref.rows.length, Object.keys(trees).length + 12); // 8 rows after the first 15 are b53ct (cmd-tell-b53.test.js), the last 4 b54cn (chat-names-b54.test.js)
  for (const [name, json, formatted, unformatted] of ref.rows.filter((r) => trees[r[0]])) {
    const c = trees[name]();
    assert.equal(serializeComponent(c), json, name + " json");
    assert.equal(c.formatted(), formatted, name + " formatted");
    assert.equal(c.unformatted(), unformatted, name + " unformatted");
  }
});

function chatHost(log, opts = {}) {
  // the singleplayer host's print: the component beside the text is what the chat window receives
  return { name: "Player", cheats: true, rules: {}, print: (t, component) => log.print(component ?? t), position: () => ({ x: 0, y: 64, z: 0 }), ...opts };
}

test("/help draws the component: header dark green, usage plain, footer green", () => {
  const log = new ChatLog();
  createCommandRunner(chatHost(log)).run("/help");
  const shown = [...log.history].reverse().map((h) => h.text); // the components the window holds
  assert.ok(shown.every((c) => typeof c !== "string"), "components, not sender strings");
  assert.equal(shown[0].formatted(), row("helpHeader")[2].replace("of §r§25", "of §r§2" + shown[0].unformatted().match(/of (\d+)/)[1]));
  assert.ok(!shown[1].formatted().startsWith("§"));
  assert.equal(shown.at(-1).formatted(), row("helpFooter")[2]);
});

test("a numeric id warning keeps the gray colour through the nested argument", () => {
  const log = new ChatLog();
  createCommandRunner(chatHost(log, { give() {}, canUse: () => true })).run("/give Player 1");
  const warn = log.history.map((h) => h.text).find((c) => c.unformatted().includes("numeric IDs"));
  assert.equal(warn.formatted(), row("deprecatedId")[2]);
});

test("/say and /me broadcast translations the window formats", () => {
  const log = new ChatLog();
  createCommandRunner(chatHost(log, { broadcast: (t, c) => log.print(c ?? t) })).run("/say hi there");
  assert.equal(log.history[0].text.formatted(), row("sayWords")[2].replace("Steve", "Player")); // b53ct: the words are siblings of an empty root
});

// AnvilChunkLoader.readChunkFromNBT has no handler around TileEntity.c / EntityList.a and ChunkProviderServer.safeLoadChunk catches Exception (bytecode-read):
// an invalid LastOutput fails the whole chunk, which is generated again.
const t = (type, value) => ({ type, value });
const compound = (f) => new Map(Object.entries(f));
const list = (elementType, items) => t(NBT.LIST, { elementType, items });
async function importOne(extra, missing = "generated") {
  const chunk = new Chunk(0, 0);
  chunk.setBlockState(1, 70, 1, 1, 0);
  const { regionX, regionZ, x, z } = regionAddress(0, 0);
  const bytes = writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { tileEntities: [], entities: [], tileTicks: [], ...extra }), { x, z })]);
  return importJavaRegionArea([{ filename: `r.${regionX}.${regionZ}.mca`, bytes }], { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: "survival", missing });
}
const control = (last) => compound({ id: t(NBT.STRING, "Control"), x: t(NBT.INT, 1), y: t(NBT.INT, 70), z: t(NBT.INT, 1), Command: t(NBT.STRING, "say hi"), LastOutput: t(NBT.STRING, last) });
test("a chunk with an invalid command block LastOutput is not imported", async () => {
  const ok = await importOne({ tileEntities: [control('"[01:02:03] hi"')] });
  assert.equal(ok.report.chunks.converted, 1);
  const bad = await importOne({ tileEntities: [control("not json")] });
  assert.equal(bad.report.chunks.converted, 0);
  assert.match(bad.report.chunks.missing[0].reason, /failed to load/);
});
test("a chunk holding a command block cart with an invalid LastOutput, even as a rider's mount, is not imported", async () => {
  const cart = (last) => compound({ id: t(NBT.STRING, "MinecartCommandBlock"), Pos: list(NBT.DOUBLE, [1.5, 71, 1.5]), Motion: list(NBT.DOUBLE, [0, 0, 0]), Command: t(NBT.STRING, "say"), LastOutput: t(NBT.STRING, last) });
  assert.equal((await importOne({ entities: [cart('"x"')] })).report.chunks.converted, 1);
  assert.equal((await importOne({ entities: [cart("{")] })).report.chunks.converted, 0);
  const rider = compound({ id: t(NBT.STRING, "Pig"), Pos: list(NBT.DOUBLE, [1.5, 71, 1.5]), Motion: list(NBT.DOUBLE, [0, 0, 0]), Riding: t(NBT.COMPOUND, cart("{")) });
  assert.equal((await importOne({ entities: [rider] })).report.chunks.converted, 0);
});
