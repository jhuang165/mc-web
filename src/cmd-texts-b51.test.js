// b51ct: command texts as native chat components, replayed from public/research/cmd-texts-reference.json (tools/probes/CmdTextsProbe.java,
// the unchanged fr/fq/fn/fk classes) plus the invalid LastOutput load rows of cmd-output-reference.json.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { serializeComponent, translation, normalizeLastOutput, LastOutputError } from "./chat-component.js";
import { adminComponent, commandBlockSender, newCommandBlock } from "./command-block.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/cmd-texts-reference.json", import.meta.url)));
const out = JSON.parse(readFileSync(new URL("../public/research/cmd-output-reference.json", import.meta.url)));
const row = (n) => ref.texts.find((r) => r[0] === n)[1];

function capture(opts = {}) {
  const lines = [];
  const host = { name: "Player", cheats: true, rules: {}, print: (text, component) => lines.push({ text, json: component ? serializeComponent(component) : null }), position: () => ({ x: 0, y: 64, z: 0 }), ...opts };
  return { lines, run: (c) => createCommandRunner(host).run(c) };
}

test("help header, usage lines and footer are translations", () => {
  const c = capture();
  c.run("/help");
  assert.equal(c.lines[0].json, row("helpHeader1").replace('"5"', `"${c.lines[0].json.match(/"with":\["1","(\d+)"/)[1]}"`));
  assert.equal(c.lines.at(-1).json, row("helpFooter"));
  assert.match(c.lines[1].json, /^\{"translate":"commands\.[a-z.]+\.usage"\}$/);
  assert.ok(c.lines[1].json.startsWith(row("helpLine").slice(0, 14)));
  const p2 = capture(); p2.run("/help 2");
  assert.match(p2.lines[0].json, /^\{"color":"dark_green","translate":"commands.help.header","with":\["2","\d+"\]\}$/);
  assert.equal(p2.lines.some((l) => l.json === row("helpFooter")), false); // only page 1 has the footer
});

test("a numeric id shows the gray deprecatedId translation", () => {
  const c = capture({ give() {}, canUse: () => true });
  c.run("/give Player 1");
  const l = c.lines.find((x) => x.json?.includes("deprecatedId"));
  assert.equal(l.json, row("deprecatedItem").replace("minecraft:stone", JSON.parse(l.json).with[0]));
  assert.equal(JSON.parse(l.json).with[0], "minecraft:stone");
});

test("the gamerule query is a ChatComponentText", () => {
  const rules = { doFireTick: "true" };
  const c = capture({ rules, setGameRule: (k, v) => { rules[k] = v; } });
  c.run("/gamerule doFireTick");
  assert.equal(c.lines[0].json, row("gameruleQuery")); // Gson escapes = as \u003d
  assert.equal(row("gameruleQuery"), '"doFireTick \\u003d true"');
});

test("chat.type.admin is a gray italic translation around the message", () => {
  const give = translation("commands.give.success", "Stone", 5, "Player");
  assert.equal(serializeComponent(adminComponent("@", give)), row("adminGive"));
  const tp = translation("commands.tp.success.coordinates", "Player", 1.5, "64.0", -3);
  assert.equal(serializeComponent(adminComponent("Rcon", tp)).replace('"-3"', '"-3.0"'), row("adminTp"));
  const printed = [];
  const tile = { ...newCommandBlock(), customName: "@" };
  const host = { rules: { commandBlockOutput: "true" }, cheats: true, print: (t, c) => printed.push({ t, c }) };
  const s = commandBlockSender(host, tile, { x: 0, y: 0, z: 0 });
  s.feedback("x", give);
  assert.equal(serializeComponent(printed[0].c), row("adminGive"));
  assert.ok(printed[0].t.startsWith("§7§o["));
});

test("an invalid LastOutput fails the load as natively", () => {
  for (const [input, result] of out.loads) {
    if (String(result[1]).startsWith("!")) assert.throws(() => normalizeLastOutput(input), LastOutputError, input);
    else assert.doesNotThrow(() => normalizeLastOutput(input), input);
  }
});

test("loaders skip a block or cart whose LastOutput is invalid JSON", async () => {
  const { installCommandBlocks } = await import("./command-block.js");
  const { Minecarts } = await import("./minecarts.js");
  const blocks = installCommandBlocks({ registerBehaviour() {} }, { host: () => ({}) });
  blocks.restore([{ x: 1, y: 2, z: 3, command: "say a", lastOutput: "not json" }, { x: 4, y: 2, z: 3, command: "say b", lastOutput: '"ok"' }]);
  assert.deepEqual(blocks.save().map((b) => b.x), [4]); // only the valid block loaded
  assert.equal(blocks.tile(4, 2, 3).lastOutput, '"ok"');
  assert.equal(blocks.tile(1, 2, 3).command, ""); // the invalid one was not loaded: a fresh tile
  const good = { type: 6, x: 0.5, y: 5, z: 0.5, command: { command: "say", lastOutput: '"fine"' } };
  const bad = { ...good, x: 3.5, command: { command: "say", lastOutput: "{\"text\":1" } };
  const m = Minecarts.fromJSON({ carts: [good, bad] });
  assert.equal(m.carts.length, 1);
});

test("the gamerule list joins the sorted rule names with CommandBase.joinNiceString (lead, batch 51)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./commands.js", import.meta.url), "utf8");
  assert.match(src, /joinNiceString\(Object\.keys\(r\)\.sort\(\)\)/);
  const { joinNiceString } = await import("./commands-scoreboard.js");
  assert.equal(joinNiceString(["a", "b", "c"]), "a, b and c");
});
