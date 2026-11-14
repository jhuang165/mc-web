// GuiNewChat (the lines at the bottom left) and GuiChat (the input row) drawn with DOM elements; the model is chat.js.
// GuiIngame translates to (0, height - 48) and the chat adds (2, 20): the newest line's bottom edge sits 28 GUI pixels above
// the window's bottom; each line is 9 pixels high with a black rectangle of alpha / 2 and white text with a shadow. GuiChat
// draws its field at (4, height - 12) over a 50 % black rectangle from (2, height - 14) to (width - 2, height - 2).
import { RemoteTabCompletion } from "./multiplayer/client-tabcomplete.js"; // b69 mptabcomplete
import { ChatLog, SentHistory, TabCompletion, CHAT, allowedText, chatDelivered, linkUrlAllowed } from "./chat.js";
import { textHtml } from "./menu-ui.js";
import { hoverLines } from "./chat-component.js";

// One chat for the whole page: death, bed and command messages and plain chat all print here (showChatLine uses it too).
export const chat = new ChatLog();
// Wall-clock ticks (50 ms) stand in for GuiIngame.getUpdateCounter.
export const chatTick = () => Math.floor(performance.now() / 50);
// `system` is S02PacketChat's flag: command feedback and server notices are system messages, player chat is not; chat
// visibility drops them as nh.a(ft) does (Hidden drops all, Commands Only keeps the system ones).
// `text` may be a chat component (chat-component.js), as /tellraw and the achievement broadcast send.
export const printChat = (text, id = 0, system = true, links = []) => (chatDelivered(chat.settings.chatVisibility, system) ? chat.print(text, chatTick(), id, links) : []);

const STYLE = `
#chat-log{position:fixed;left:calc(2*var(--u));bottom:calc(28*var(--u));z-index:9;pointer-events:none;transform-origin:0 100%;font-size:calc(8*var(--u))}
#chat-log .chat-row{position:absolute;left:0;height:calc(9*var(--u));line-height:calc(9*var(--u));white-space:pre;overflow:hidden;color:#fff;padding-left:0}
#chat-log .chat-row span{text-shadow:var(--u) var(--u) 0 var(--sh,#3f3f3f)}
#chat-log .chat-bar{position:absolute;width:calc(2*var(--u));right:calc(-2*var(--u))}
#chat-log.open,#chat-input-box.open{z-index:32}
#chat-input-box{position:fixed;left:calc(2*var(--u));right:calc(2*var(--u));bottom:calc(2*var(--u));height:calc(12*var(--u));z-index:32;background:rgba(0,0,0,.5);display:none}
#chat-input-box.open{display:block}
#chat-input{position:absolute;left:calc(2*var(--u));right:0;top:0;bottom:0;width:calc(100% - 2*var(--u));background:transparent;border:0;outline:0;color:#e0e0e0;font-size:calc(8*var(--u));line-height:calc(12*var(--u));padding:0;margin:0;text-shadow:var(--u) var(--u) 0 #3f3f3f;caret-color:#fff}
`;

export class ChatUi {
  // hooks: submit(text), complete(textBeforeCursor) -> string[], remote() -> boolean and request(textBeforeCursor) (connected: C14), close(), visible() -> boolean
  constructor(doc, hooks, log = chat) {
    this.doc = doc;
    this.hooks = hooks;
    this.log = log;
    this.isOpen = false;
    this.history = new SentHistory(log);
    this.tab = new TabCompletion();
    this.remoteTab = new RemoteTabCompletion(); // b69 mptabcomplete: the connected flow (hooks.remote() true): C14 / S3A
    const style = doc.createElement("style");
    style.textContent = STYLE;
    this.box = doc.createElement("div");
    this.box.id = "chat-log";
    this.box.setAttribute("role", "log");
    this.inputBox = doc.createElement("div");
    this.inputBox.id = "chat-input-box";
    this.input = doc.createElement("input");
    this.input.id = "chat-input";
    this.input.type = "text";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.maxLength = CHAT.inputMaxLength;
    this.input.setAttribute("aria-label", "Chat");
    this.inputBox.append(this.input);
    doc.head.append(style);
    doc.body.append(this.box, this.inputBox);
    this.input.addEventListener("keydown", (e) => this.key(e));
    this.input.addEventListener("input", () => {
      const clean = allowedText(this.input.value);
      if (clean !== this.input.value) this.input.value = clean;
      this.resetTab();
    });
    this.box.addEventListener("wheel", () => {});
    // GuiChat.mouseClicked: a left click on a component with a ClickEvent (chatLinks on); Shift inserts its text instead.
    const at = (e) => {
      const u = parseFloat(doc.defaultView.getComputedStyle(this.box).fontSize) / 8, s = this.log.settings.chatScale || 1;
      return u > 0 ? [(e.clientX - 2 * u) / (u * s) - 2, (doc.defaultView.innerHeight - 28 * u - e.clientY) / (u * s)] : null;
    };
    doc.addEventListener("pointerdown", (e) => {
      if (!this.isOpen || e.button !== 0 || this.log.settings.chatLinks === false || this.log.settings.chatVisibility === 2) return;
      const p = at(e);
      const click = p && this.log.clickAt(p[0], p[1]);
      if (click) this.click(click, e.shiftKey);
    });
    // GuiChat.drawScreen: the HoverEvent of the component under the mouse as a tooltip (show_text, show_achievement, show_item).
    this.tip = doc.createElement("div");
    this.tip.className = "slot-tooltip hidden";
    this.tip.id = "chat-tooltip";
    this.tip.setAttribute("role", "tooltip");
    doc.body.append(this.tip);
    doc.addEventListener("pointermove", (e) => {
      const p = this.isOpen && this.log.settings.chatVisibility !== 2 ? at(e) : null;
      const lines = p ? hoverLines(this.log.hoverAt(p[0], p[1]), this.hooks.hoverInfo ?? {}) : null;
      if (!lines?.length) { this.tip.classList.add("hidden"); return; }
      this.tip.innerHTML = lines.map((l, i) => `<span${i === 0 ? ' class="title"' : ""}>${textHtml(l) || "&nbsp;"}</span>`).join("");
      this.tip.style.left = e.clientX + "px";
      this.tip.style.top = e.clientY + "px";
      this.tip.classList.remove("hidden");
    });
    doc.addEventListener("wheel", (e) => {
      if (!this.isOpen) return;
      e.preventDefault();
      // GuiChat.handleMouseInput: the wheel is clamped to one notch and multiplied by 7 unless Shift is held.
      const n = Math.sign(-e.deltaY) * (e.shiftKey ? 1 : 7);
      this.log.scroll(n);
      this.render();
    }, { passive: false });
    log.listeners.add(() => this.render());
    this.timer = setInterval(() => this.render(), 50);
    this.render();
  }
  // GuiChat.func_146407_a: OPEN_URL (http/https only, behind GuiConfirmOpenLink when chatLinksPrompt), SUGGEST_COMMAND, RUN_COMMAND.
  click(click, shift = false) {
    if (shift) { this.input.setRangeText(allowedText(click.text ?? ""), this.input.selectionStart ?? this.input.value.length, this.input.selectionEnd ?? this.input.value.length, "end"); return; }
    if (click.action === "open_url") {
      if (!linkUrlAllowed(click.value)) { console.warn("Unsupported protocol: " + click.value); return; }
      if (this.log.settings.chatLinksPrompt !== false) this.hooks.confirmLink?.(click.value);
      else this.hooks.openLink?.(click.value);
    } else if (click.action === "suggest_command") this.input.value = allowedText(click.value);
    else if (click.action === "run_command") this.hooks.submit(click.value);
  }
  resetTab() { this.tab.reset(); this.remoteTab.reset(); }
  // S3APacketTabComplete (GuiChat.func_146406_a): the server's strings for the text last sent.
  tabReply(options) {
    if (!this.isOpen || !Array.isArray(options)) return;
    const value = this.input.value, cursor = this.input.selectionStart ?? value.length;
    this.applyTab(this.remoteTab.reply(options.filter((o) => typeof o === "string"), value, cursor, (t) => this.log.print(t, chatTick(), 1)));
  }
  applyTab(out) {
    if (out) { this.input.value = out.text.slice(0, CHAT.inputMaxLength); this.input.setSelectionRange(out.cursor, out.cursor); }
  }
  open(prefill = "") {
    this.isOpen = true;
    this.history.reset();
    this.resetTab();
    this.log.resetScroll();
    this.input.value = allowedText(prefill);
    this.inputBox.classList.add("open");
    this.box.classList.add("open");
    this.input.focus();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.render();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.input.value = "";
    this.input.blur();
    this.inputBox.classList.remove("open");
    this.box.classList.remove("open");
    this.log.resetScroll();
    this.tip.classList.add("hidden");
    this.render();
  }
  key(e) {
    e.stopPropagation();
    const code = e.code;
    if (code !== "Tab") this.resetTab();
    if (code === "Escape") { e.preventDefault(); this.hooks.close(); return; }
    if (code === "Enter" || code === "NumpadEnter") {
      e.preventDefault();
      const text = this.input.value.trim();
      // GuiChat.keyTyped: a non-empty message joins the sent history and is sent; the screen closes either way.
      if (text) { this.log.addSent(text); this.hooks.submit(text); }
      // GuiSleepMP.keyTyped sends the message but keeps the bed screen (and its field) open; GuiChat closes.
      if (this.hooks.stay?.()) { this.input.value = ""; this.history.reset(); } else this.hooks.close();
      return;
    }
    if (code === "ArrowUp" || code === "ArrowDown") {
      e.preventDefault();
      this.input.value = this.history.step(code === "ArrowUp" ? -1 : 1, this.input.value);
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
      return;
    }
    if (code === "PageUp" || code === "PageDown") {
      e.preventDefault();
      this.log.scroll((code === "PageUp" ? 1 : -1) * (this.log.visibleLines(true) - 1));
      this.render();
      return;
    }
    if (code === "Tab") {
      e.preventDefault();
      const cursor = this.input.selectionStart ?? this.input.value.length, print = (t) => this.log.print(t, chatTick(), 1);
      if (this.hooks.remote?.()) this.applyTab(this.remoteTab.press(this.input.value, cursor, (t) => this.hooks.request(t), print)); // b69 mptabcomplete: ask the server
      else this.applyTab(this.tab.next(this.input.value, cursor, (t) => this.hooks.complete(t), print));
    }
  }
  render() {
    // GuiNewChat.drawChat returns at once when chatVisibility is HIDDEN.
    const visible = this.hooks.visible?.() !== false && this.log.settings.chatVisibility !== 2;
    this.inputBox.style.visibility = visible ? "" : "hidden";
    const rows = visible ? this.log.draw(chatTick(), this.isOpen) : [];
    const scale = this.log.settings.chatScale;
    // Obfuscated (§k) text changes its glyphs on every frame, so such rows are redrawn each time.
    const sig = rows.map((r) => r.row + ":" + r.alpha + ":" + r.text).join("|") + "@" + this.log.scrollPos + this.isOpen + scale + ":" + this.log.width + (rows.some((r) => /§k/i.test(r.text)) ? Math.random() : "");
    if (sig === this.sig) return;
    this.sig = sig;
    this.box.style.transform = scale === 1 ? "" : `scale(${scale})`;
    const width = this.log.width + 4;
    this.box.style.width = `calc(${width}*var(--u))`;
    let html = "";
    for (const r of rows) {
      const a = r.alpha / 255;
      html += `<div class="chat-row" style="bottom:calc(${r.row * CHAT.lineHeight}*var(--u));width:calc(${width}*var(--u));background:rgba(0,0,0,${(a / 2).toFixed(3)})"><span style="display:inline-block;padding-left:calc(2*var(--u));opacity:${a.toFixed(3)}">${textHtml(r.text)}</span></div>`;
    }
    const bar = this.isOpen && visible ? this.log.scrollBar(true) : null;
    if (bar) html += `<div class="chat-bar" style="bottom:calc(${bar.offset}*var(--u));height:calc(${bar.height}*var(--u));background:${bar.newMessages ? "#cc3333" : "#3333aa"};opacity:${(bar.alpha / 255).toFixed(3)}"></div>`;
    this.box.innerHTML = html;
  }
  destroy() { clearInterval(this.timer); this.box.remove(); this.inputBox.remove(); this.tip.remove(); }
}
