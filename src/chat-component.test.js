import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseChatJson, serializeComponent, componentParts, wrapComponent, partAt, fontWidth, fontTrim, TranslationError, langReady, hoverLines, text } from "./chat-component.js";
import { JsonReader, parseTree } from "./json-lenient.js";
import { tr } from "./commands.js";
import { chatWidth } from "./chat.js";

const ref = JSON.parse(await readFile(new URL("../public/research/commands-b13-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
await langReady;

const partRecord = (p) => {
  const s = { code: p.style.code() };
  if (p.style.click) s.click = [p.style.click.action, p.style.click.value];
  if (p.style.hover) s.hover = [p.style.hover.action, p.style.hover.value.formatted(), p.style.hover.value.unformatted()];
  return { cls: "text", text: p.text, style: s };
};

test("tellraw JSON parses, fails and renders as the 1.7.10 IChatComponent.Serializer on Gson 2.2.4", () => {
  const rs = records("tellraw");
  assert.ok(rs.length > 100);
  for (const r of rs) {
    const out = parseChatJson(r.input), what = JSON.stringify(r.input);
    if (r.outcome === "parse") {
      assert.ok("jsonError" in out, what + " should be a JSON error, got " + JSON.stringify(Object.keys(out)));
      assert.equal(tr("commands.tellraw.jsonException", out.jsonError), r.chat, what);
    } else if (r.outcome === "generic") assert.ok(out.generic, what + " should be a generic exception");
    else if (r.outcome === "null") assert.equal(out.component, null, what);
    else {
      assert.ok(out.component, what + " should parse: " + JSON.stringify(out));
      assert.equal(serializeComponent(out.component), r.json, what + " json");
      if (r.renderError) { assert.throws(() => out.component.formatted(), TranslationError, what); continue; }
      assert.equal(out.component.formatted(), r.formatted, what + " formatted");
      assert.equal(out.component.unformatted(), r.unformatted, what + " unformatted");
      assert.deepEqual(componentParts(out.component).map(partRecord), r.parts, what + " parts");
    }
  }
});

test("FontRenderer widths and trims count codes and bold as the JAR does", () => {
  for (const r of records("width")) if (!/[^\u0000-ÿ]/.test(r.text)) assert.equal(fontWidth(r.text), r.width, r.text);
  for (const r of records("trim")) assert.equal(fontTrim(r.text, r.limit), r.result, r.text + " " + r.limit);
});

test("GuiNewChat wraps a component part by part like func_146237_a", () => {
  for (const r of records("wrap")) {
    const c = parseChatJson(r.input).component;
    const lines = wrapComponent(c, Math.floor(Math.fround(chatWidth(r.chatWidth) / Math.fround(r.chatScale))), r.colours);
    assert.deepEqual(lines.map((l) => l.text), r.lines.map((l) => l.formatted), r.input);
    assert.deepEqual(lines.map((l) => l.parts.map((p) => p.style.code() + "|" + p.text)), r.lines.map((l) => l.parts.slice(1).map((p) => p.style.code + "|" + p.text)), r.input);
  }
});

test("chat clicks resolve to the piece under the cursor and hover text splits at newlines", () => {
  const c = parseChatJson('{"text":"long ","extra":[{"text":"link","underlined":true,"clickEvent":{"action":"open_url","value":"https://example.com/"}}]}').component;
  const [line] = wrapComponent(c, 320);
  assert.equal(partAt(line, 10).style.click, null);
  assert.deepEqual(partAt(line, fontWidth("long ") + 1).style.click, { action: "open_url", value: "https://example.com/" });
  assert.equal(partAt(line, 500), null);
  const h = parseChatJson('{"text":"h","hoverEvent":{"action":"show_text","value":{"text":"a\\nb","color":"red"}}}').component;
  assert.deepEqual(hoverLines(componentParts(h)[0].style.hover), ["§ca", "b§r"]);
  assert.deepEqual(hoverLines({ action: "show_item", value: text("{id:9999}") }, { item: () => null }), ["§cInvalid Item!"]);
});

test("the Gson reader reports positions like JsonReader", () => {
  assert.equal(parseTree("[1, 2]").elements.length, 2);
  const r = new JsonReader('{"a":1}');
  r.lenient = false;
  assert.equal(r.peek(), "BEGIN_OBJECT");
});
