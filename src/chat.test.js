import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ChatLog, SentHistory, TabCompletion, CHAT, chatWidth, chatHeight, allowedText, formatFrom } from "./chat.js";

const ref = JSON.parse(await readFile(new URL("../public/research/commands-reference.json", import.meta.url)));

test("the chat constants are the 1.7.10 client's GuiNewChat values", () => {
  const c = ref.chat;
  assert.equal(CHAT.maxLines, c.maxLines);
  assert.equal(CHAT.maxSent, c.maxSent);
  assert.equal(CHAT.lineHeight, c.lineHeight);
  assert.equal(CHAT.fadeTicks, c.fadeTicks);
  assert.equal(CHAT.inputMaxLength, c.inputMaxLength);
  assert.deepEqual(CHAT.defaults, c.defaults);
  assert.equal(chatWidth(c.defaults.chatWidth), c.width);
  assert.equal(chatHeight(c.defaults.chatHeightFocused), c.heightFocused);
  assert.equal(chatHeight(c.defaults.chatHeightUnfocused), c.heightUnfocused);
});

test("a message wraps to the chat width and 100 lines are kept, newest first", () => {
  const log = new ChatLog();
  log.print("§aone", 0);
  assert.equal(log.lines[0].text, "§aone");
  const wrapped = log.print("word ".repeat(80), 0);
  assert.ok(wrapped.length > 1);
  for (let i = 0; i < 150; i++) log.print("line " + i, 0);
  assert.equal(log.lines.length, 100);
  assert.equal(log.lines[0].text, "line 149");
  assert.equal(log.visibleLines(true), 20);
  assert.equal(log.visibleLines(false), 10);
});

test("lines fade over the last 20 ticks of 200 and stay while the chat is open", () => {
  const log = new ChatLog();
  log.print("hello", 0);
  assert.equal(log.draw(100, false)[0].alpha, 255);
  const mid = log.draw(190, false)[0].alpha;
  assert.equal(mid, Math.trunc(255 * 0.25)); // (10 * (1 - 190 / 200))^2 = 0.25
  assert.equal(log.draw(200, false).length, 0);
  assert.equal(log.draw(5000, true)[0].alpha, 255);
});

test("only 10 lines show unfocused and 20 focused; the scroll position moves the window", () => {
  const log = new ChatLog();
  for (let i = 0; i < 30; i++) log.print("m" + i, 0);
  assert.equal(log.draw(0, false).length, 10);
  assert.equal(log.draw(0, true).length, 20);
  log.scroll(7);
  assert.equal(log.draw(0, true)[0].text, "m22");
  log.scroll(-100);
  assert.equal(log.scrollPos, 0);
});

test("sent history walks up and down and restores the typed text; repeats are stored once", () => {
  const log = new ChatLog();
  log.addSent("a"); log.addSent("a"); log.addSent("b");
  assert.deepEqual(log.sent, ["a", "b"]);
  const h = new SentHistory(log);
  assert.equal(h.step(-1, "typing"), "b");
  assert.equal(h.step(-1, "b"), "a");
  assert.equal(h.step(-1, "a"), "a");
  assert.equal(h.step(1, "a"), "b");
  assert.equal(h.step(1, "b"), "typing");
  for (let i = 0; i < 150; i++) log.addSent("s" + i);
  assert.equal(log.sent.length, 100);
});

test("Tab cycles through the candidates and lists them when there are several", () => {
  const tab = new TabCompletion(), printed = [];
  const complete = () => ["/give", "/gamemode"];
  let r = tab.next("/g", 2, complete, (t) => printed.push(t));
  assert.equal(r.text, "/give");
  r = tab.next(r.text, r.cursor, complete, (t) => printed.push(t));
  assert.equal(r.text, "/gamemode");
  r = tab.next(r.text, r.cursor, complete, (t) => printed.push(t));
  assert.equal(r.text, "/give");
  assert.deepEqual(printed, ["/give, /gamemode", "/give, /gamemode", "/give, /gamemode"]);
  assert.equal(new TabCompletion().next("/zz", 3, () => [], () => {}), null);
});

test("typed text drops section signs and control characters; a colour carries over a wrap", () => {
  assert.equal(allowedText("a§b\u0001c\u007f"), "abc");
  assert.equal(formatFrom("§aone §ctwo"), "§c");
  assert.equal(formatFrom("§aone §rtwo"), "");
});
