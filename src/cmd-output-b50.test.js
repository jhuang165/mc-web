// b50cmdoutput: the command block / cart LastOutput as the native chat component JSON, replayed from cmd-output-reference.json
// (tools/probes/CmdOutputProbe.java on the unchanged CommandBlockLogic agp and IChatComponent.Serializer fk).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { commandBlockSender, newCommandBlock, readCommandBlock, writeCommandBlock, normalizeLastOutput, lastOutputPlainText } from "./command-block.js";
import { runCommandCart } from "./command-cart.js";
import { text, translation, serializeComponent } from "./chat-component.js";
import { NBT } from "./nbt.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/cmd-output-reference.json", import.meta.url), "utf8"));
const row = (name) => ref.outputs.find((r) => r[0] === name);
const T = "[12:34:56] ";
const unscrub = (s) => s.replaceAll("hh:mm:ss", "12:34:56");
const now = () => new Date(2020, 0, 1, 12, 34, 56);
const host = (extra = {}) => ({ name: "Player", position: () => ({ x: 0, y: 64, z: 0 }), print() {}, cheats: true, rules: {}, ...extra });
const sender = (tile, h = host()) => commandBlockSender(h, tile, { x: 1, y: 2, z: 3 }, { now });

test("the reference rows hold the native shapes", () => {
  assert.equal(row("text")[1], '{"extra":["done"],"text":"[hh:mm:ss] "}');
  assert.equal(row("notFound")[1], '{"extra":[{"color":"red","translate":"commands.generic.notFound"}],"text":"[hh:mm:ss] "}');
  assert.equal(row("trackOff")[1], null);
});

test("output components serialize as the executed JSON, in the stored LastOutput and the NBT", () => {
  const cases = {
    text: text("done"),
    tpCoords: translation("commands.tp.success.coordinates", "Player", "1.5", "64.0", "-3.0"),
    give: translation("commands.give.success", "Stone", 5, "Player"),
    numbers: translation("commands.xp.success", 10, "Player"),
    sibling: text("a").append(text("b")),
    emptyText: text(""),
    special: text("say \"hi\" <&> = ' §c é   \\ \n\t"),
  };
  for (const [name, comp] of Object.entries(cases)) {
    const tile = newCommandBlock();
    sender(tile).print("", comp);
    assert.equal(tile.lastOutput, unscrub(row(name)[1]), name);
    const tag = writeCommandBlock(tile, 0, 0, 0);
    assert.equal(tag.get("LastOutput").value, unscrub(row(name)[2]), name);
  }
  const green = text("ok"); green.style.color = "green";
  const t = newCommandBlock(); sender(t).print("", green);
  assert.equal(t.lastOutput, unscrub(row("greenText")[1]));
  const all = text("x"); Object.assign(all.style, { bold: true, italic: true, underlined: true, strikethrough: true, obfuscated: true, color: "red" }); all.append(text("y"));
  const a = newCommandBlock(); sender(a).print("", all);
  assert.equal(a.lastOutput, unscrub(row("styledAll")[1]));
  const arg = text("P"); arg.style.color = "gray";
  const b = newCommandBlock(); sender(b).print("", translation("commands.tp.success", arg, "T"));
  assert.equal(b.lastOutput, unscrub(row("styledArg")[1]));
});

test("commands send components: notFound, usage, tp, give, success", () => {
  const run = (line, h = host()) => { const tile = newCommandBlock(); createCommandRunner(sender(tile, h)).run(line); return tile.lastOutput; };
  assert.equal(run("nosuchcommand"), unscrub(row("notFound")[1]));
  // the b50 row wraps the usage in commands.generic.usage; the executed CommandHandler (cmd-chat-reference.json) prints the red usage translation itself
  assert.equal(run("tp"), unscrub(row("usage")[1]).replace('{"color":"red","translate":"commands.generic.usage","with":[{"translate":"commands.tp.usage"}]}', '{"color":"red","translate":"commands.tp.usage"}'));
  const tpHost = host({ teleport() {}, rules: {} });
  assert.equal(run("tp @p 1.5 64.0 -3.0", tpHost), unscrub(row("tpCoords")[1]));
  assert.equal(run("xp 10 Player", host({ addExperience() {}, addLevels() {} })), unscrub(row("numbers")[1]));
});

test("/say writes no output to the sender; TrackOutput false keeps null", () => {
  const tile = newCommandBlock();
  createCommandRunner(sender(tile)).run("say hi");
  assert.equal(tile.lastOutput, null);
  const off = { ...newCommandBlock(), trackOutput: false };
  createCommandRunner(sender(off)).run("nosuchcommand");
  assert.equal(off.lastOutput, null);
  assert.equal(writeCommandBlock(off, 0, 0, 0).has("LastOutput"), false);
});

test("a second message replaces the first", () => {
  const tile = newCommandBlock();
  sender(tile).print("one"); sender(tile).print("two");
  assert.equal(tile.lastOutput, unscrub(row("second")[1]));
});

test("the cart watcher 24 holds the same JSON", () => {
  const cart = { x: 0.5, posY: 0.5, z: 0.5, command: { ...newCommandBlock(), command: "nosuchcommand", watch24: "" } };
  runCommandCart(cart, { host: host() });
  assert.equal(cart.command.watch24, cart.command.lastOutput);
  assert.equal(cart.command.watch24, row("notFound")[1].replace("hh:mm:ss", cart.command.watch24.match(/\d\d:\d\d:\d\d/)[0]));
});

test("loading LastOutput strings matches the native re-serialization", () => {
  for (const [input, result] of ref.loads) {
    if (String(result[1]).startsWith("!")) { assert.throws(() => normalizeLastOutput(input), /Invalid LastOutput/, "invalid JSON ends the load, as natively: " + input); continue; }
    const scr = (v) => (typeof v === "string" ? v.replace(/\d\d:\d\d:\d\d/g, "hh:mm:ss") : v);
    const got = scr(normalizeLastOutput(input));
    if (result[1] === null) assert.equal(got, null, input);
    else if (String(result[1]).startsWith("!")) assert.equal(got, scr(input), "invalid JSON is kept, native throws: " + input);
    else assert.equal(got, result[1], input);
  }
});
test("an old-shape save reads, shows its text and writes the bare string", () => {
  const tag = new Map([["LastOutput", { type: NBT.STRING, value: '{"text":"[12:00:00] old"}' }]]);
  const tile = readCommandBlock(tag);
  assert.equal(tile.lastOutput, '"[12:00:00] old"');
  assert.equal(lastOutputPlainText('{"text":"[12:00:00] old"}'), "[12:00:00] old");
  assert.equal(lastOutputPlainText(tile.lastOutput), "[12:00:00] old");
  assert.equal(writeCommandBlock(tile, 0, 0, 0).get("LastOutput").value, '"[12:00:00] old"');
});

test("the GUI text flattens translations and styled parts", () => {
  assert.equal(lastOutputPlainText(unscrub(row("notFound")[1])), T + "Unknown command. Try /help for a list of commands");
  assert.equal(lastOutputPlainText(unscrub(row("greenText")[1])), T + "ok");
  assert.equal(lastOutputPlainText(unscrub(row("sibling")[1])), T + "ab");
  assert.equal(lastOutputPlainText("not json"), "not json");
  assert.equal(lastOutputPlainText(null), "");
});
test("serializeComponent keeps bare text bare", () => {
  assert.equal(serializeComponent(text("a")), '"a"');
});
