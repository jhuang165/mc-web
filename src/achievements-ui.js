// GuiAchievement (the "Achievement get!" toast) and GuiAchievements (the draggable, zoomable tree), ported from the
// 1.7.10 beh / bei classes (see public/research/achievements.md). The pure parts (toast slide, background tile, scroll
// physics, tooltip text) are exported for src/achievements.test.js; the DOM and canvas drawing is below them.
import { onResourcesRefreshed } from "./resource-refresh.js";
import { versioned } from "./media-version.js";
import { lwjglCode } from "./keybindings.js";
import { ACHIEVEMENTS, BY_ID, BOUNDS, STRINGS } from "./achievements.js";
import { JavaRandom } from "./java-random.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { textWidth, splitLines, t } from "./menu-screens.js";
import { textHtml } from "./menu-ui.js";

export const TOAST_MS = 3000, HINT_DELAY_MS = 2500;
export const TOAST_W = 160, TOAST_H = 32;

// beh.a(): where the 160 x 32 frame sits: x = width - 160, y = -(int)(e * 36); null when the toast is finished.
export function toastState(toast, now, width) {
  if (!toast) return null;
  let d = (now - toast.start) / TOAST_MS;
  if (toast.hint) { if (d > 0.5) d = 0.5; if (d < 0) return null; }
  else if (d < 0 || d > 1) return null;
  let e = d * 2;
  if (e > 1) e = 2 - e;
  e *= 4;
  e = 1 - e;
  if (e < 0) e = 0;
  e *= e;
  e *= e;
  return { x: width - TOAST_W, y: 0 - Math.trunc(e * 36) };
}

// The browser item for an achievement icon (original ids -> this build's through original-items.js).
export function iconItem(a) {
  return ORIGINAL_ITEMS[`${a.item}:${a.damage}`] ?? ORIGINAL_ITEMS[a.item] ?? a.item;
}

// GuiAchievements.drawScreen background: the tile for column a, row b of the random block field.
export function backgroundTile(hash, a, b, random = new JavaRandom(0)) {
  random.setSeed((hash + a + b * 16) | 0);
  const v = random.nextInt(1 + b) + Math.trunc(b / 2);
  if (v > 37 || b === 35) return "bedrock";
  if (v === 22) return random.nextInt(2) === 0 ? "diamond_ore" : "redstone_ore";
  if (v === 10) return "iron_ore";
  if (v === 8) return "coal_ore";
  if (v > 4) return "stone";
  if (v > 0) return "dirt";
  return "sand";
}

const clamp = (v, lo, hi) => (v < lo ? lo : v >= hi ? hi - 1 : v);
// GuiAchievements' scroll state: u/v the position, s/t the previous tick, w/x the drag target, r the zoom.
export class AchievementView {
  constructor() {
    this.min = { x: BOUNDS.minColumn * 24 - 112, y: BOUNDS.minRow * 24 - 112 };
    this.max = { x: BOUNDS.maxColumn * 24 - 77, y: BOUNDS.maxRow * 24 - 77 };
    const start = BY_ID.openInventory;
    this.u = this.s = this.w = start.column * 24 - 70 - 12;
    this.v = this.t = this.x = start.row * 24 - 70;
    this.r = 1;
    this.dragging = false;
    this.last = { x: 0, y: 0 };
  }
  // Called every frame with whether the primary button is held inside the 224 x 155 view.
  drag(mx, my, held) {
    if (held) {
      if (this.dragging) {
        this.u -= (mx - this.last.x) * this.r;
        this.v -= (my - this.last.y) * this.r;
        this.s = this.w = this.u;
        this.t = this.x = this.v;
      } else this.dragging = true;
      this.last = { x: mx, y: my };
    } else this.dragging = false;
    this.fit();
  }
  fit() {
    this.u = clamp(this.u, this.min.x, this.max.x);
    this.v = clamp(this.v, this.min.y, this.max.y);
    this.w = clamp(this.w, this.min.x, this.max.x);
    this.x = clamp(this.x, this.min.y, this.max.y);
  }
  // Mouse wheel: scrolling down zooms out by a quarter step, up zooms in; the view stays centred.
  wheel(direction) {
    const old = this.r;
    this.r = Math.min(2, Math.max(1, this.r + (direction > 0 ? 0.25 : -0.25)));
    if (this.r === old) return;
    this.u -= (this.r * 256 - old * 256) * 0.5;
    this.v -= (this.r * 202 - old * 202) * 0.5;
    this.s = this.w = this.u;
    this.t = this.x = this.v;
    this.fit();
  }
  // updateScreen, 20 times a second.
  tick() {
    this.s = this.u;
    this.t = this.v;
    const dx = this.w - this.u, dy = this.x - this.v;
    if (dx * dx + dy * dy < 4) { this.u += dx; this.v += dy; } else { this.u += dx * 0.85; this.v += dy * 0.85; }
  }
  position(partial) {
    return {
      x: clamp(Math.floor(this.s + (this.u - this.s) * partial), this.min.x, this.max.x),
      y: clamp(Math.floor(this.t + (this.v - this.t) * partial), this.min.y, this.max.y),
    };
  }
}

// The link and node colours for one achievement (GuiAchievements.drawScreen).
export function nodeStyle(unlocked, canUnlock, depth) {
  if (depth > 4) return null;
  return { brightness: unlocked ? 0.75 : canUnlock ? 1 : depth < 3 ? 0.3 : depth === 3 ? 0.2 : 0.1 };
}
export const linkColor = (unlocked, canUnlock) => (unlocked ? 0xa0a0a0 : canUnlock ? 0x00ff00 : 0x000000);

// The tooltip box of a hovered node: { lines: [{ text, x, y, color, shadow }], box: [x, y, w, h] } relative to (tx, ty).
export function tooltipFor(a, achievements, keyName = "E") {
  const unlocked = achievements.has(a.id), can = achievements.canUnlock(a.id), depth = achievements.depth(a.id);
  if (depth >= 4) return null;
  const nameColor = can ? (a.special ? 0xffff80 : 0xffffff) : a.special ? 0x808040 : 0x808080;
  const desc = a.description.replace("%1$s", keyName);
  const lines = [];
  let w, h, bottom;
  if (can) {
    w = Math.max(textWidth(a.name), 120);
    h = splitLines(desc, w).length * 9 + (unlocked ? 12 : 0);
    bottom = h + 3 + 12;
    lines.push({ text: a.name, x: 0, y: 0, color: nameColor, shadow: true });
    splitLines(desc, w).forEach((text, i) => lines.push({ text, x: 0, y: 12 + 9 * i, color: 0xa0a0a0, shadow: false }));
    if (unlocked) lines.push({ text: STRINGS.taken, x: 0, y: h + 4, color: 0x9090ff, shadow: true });
  } else {
    const name = depth === 3 ? STRINGS.unknown : a.name;
    const req = STRINGS.requires.replace("%1$s", BY_ID[a.parent].name);
    w = Math.max(textWidth(name), 120);
    const split = splitLines(req, w);
    bottom = split.length * 9 + 12 + 3;
    lines.push({ text: name, x: 0, y: 0, color: nameColor, shadow: true });
    split.forEach((text, i) => lines.push({ text, x: 0, y: 12 + 9 * i, color: 0x705050, shadow: false }));
  }
  return { lines, box: [-3, -3, w + 6, bottom + 3] };
}

const px = (n) => `calc(${n}*var(--u))`;
const el = (tag, cls, css = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };
const SPRITE = "/media/1.7.10/gui/achievement/achievement_background.png";
const BLOCKS = ["sand", "bedrock", "stone", "dirt", "iron_ore", "coal_ore", "diamond_ore", "redstone_ore"];
let sheet = null, textures = null;
const load = (src) => { const i = new Image(); i.src = versioned(src); return i; };
onResourcesRefreshed(() => { sheet = null; textures = null; });
const assets = () => {
  sheet ??= load(SPRITE);
  textures ??= Object.fromEntries(BLOCKS.map((n) => [n, load(`/media/1.7.10/blocks/${n}.png`)]));
  return { sheet, textures };
};
const STYLE = `
.ach-toast{position:fixed;right:0;top:0;z-index:60;pointer-events:none;image-rendering:pixelated;display:none}
.ach-toast div{position:absolute}
.ach-sprite{background:url('${SPRITE}') no-repeat;image-rendering:pixelated}
.ach-icon{pointer-events:none}
.ach-icon .vanilla-item-icon{position:absolute;left:0;top:0;width:100%;height:100%}
.ach-view{overflow:hidden}
.ach-view canvas{position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated}
.ach-content{transform-origin:0 0}
.ach-frame{pointer-events:none}
.ach-tip{pointer-events:none}
`;
let styled = false;
const ensureStyle = () => {
  if (styled || typeof document === "undefined") return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = STYLE;
  document.head.append(s);
};

// The toast and the hint, drawn top right over the game with the GUI scale (gui.scale()).
export class AchievementToast {
  constructor({ scale, icon, keyName = () => "E", playing = () => true }) {
    Object.assign(this, { scale, icon, keyName, playing });
    this.toast = null;
    this.raf = 0;
    this.tick = this.tick.bind(this);
  }
  show(a, now = performance.now()) { this.set({ a, start: now, hint: false }); }
  // GuiAchievement.func_146256_a: a permanent notice (the "Taking Inventory" hint) that waits 2.5 s, then stays.
  hint(a, now = performance.now()) { this.set({ a, start: now + HINT_DELAY_MS, hint: true }); }
  clear() { this.toast = null; this.paint(null); }
  set(toast) {
    ensureStyle();
    this.toast = toast;
    this.built = null;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }
  build(toast) {
    const root = (this.root ??= el("div", "ach-toast"));
    if (!root.isConnected) document.body.append(root);
    const a = toast.a;
    root.replaceChildren();
    root.append(el("div", "ach-sprite", `left:0;top:0;width:${px(160)};height:${px(32)};background-position:${px(-96)} ${px(-202)};background-size:${px(256)} ${px(256)}`));
    const icon = el("div", "ach-icon", `left:${px(8)};top:${px(8)};width:${px(16)};height:${px(16)}`);
    icon.innerHTML = this.icon(iconItem(a), a.damage);
    root.append(icon);
    const text = (s, x, y, color) => { const t = el("div", "mc-text flat", `left:${px(x)};top:${px(y)}`); t.innerHTML = textHtml(s, color); root.append(t); };
    if (toast.hint) {
      text(a.name, 30, 7, 0xffffff);
      splitLines(a.description.replace("%1$s", this.keyName()), 120).forEach((l, i) => text(l, 30, 18 + 9 * i, 0xffffff));
    } else {
      text(STRINGS.get, 30, 7, 0xffff00);
      text(a.name, 30, 18, 0xffffff);
    }
    this.built = toast;
  }
  paint(state) {
    const root = this.root;
    if (!root) return;
    if (!state || !this.playing()) { root.style.display = "none"; return; }
    root.style.setProperty("--u", `${this.scale()}px`);
    root.style.cssText += `;display:block;top:${state.y * this.scale()}px;width:${160 * this.scale()}px;height:${32 * this.scale()}px`;
  }
  tick(now) {
    const state = toastState(this.toast, now, 160);
    // A finished toast goes away; a hint stays (hidden until its delay has passed).
    if (this.toast && !this.toast.hint && !state) this.toast = null;
    if (this.toast && this.built !== this.toast) this.build(this.toast);
    this.paint(this.toast ? state : null);
    this.raf = this.toast ? requestAnimationFrame(this.tick) : 0;
  }
}

// GuiAchievements. ctx: { achievements, icon(id, damage), keyName(), username }, plus the screen callbacks.
export function achievementsScreen({ achievements, icon, keyName, hash, back, close, inventoryKey, show }) {
  const view = new AchievementView();
  const mouse = { x: -1, y: -1, down: false };
  let base = 0, ticks = 0, canvas = null, content = null, tip = null, layout = null, tipKey = "";
  const tint = new Map();
  // A sprite rectangle multiplied by a colour, cached.
  const tinted = (sx, sy, sw, sh, rgb) => {
    const key = `${sx},${sy},${sw},${sh},${rgb}`;
    let c = tint.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = sw; c.height = sh;
      const g = c.getContext("2d");
      g.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      g.globalCompositeOperation = "multiply";
      g.fillStyle = `#${rgb.toString(16).padStart(6, "0")}`;
      g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = "destination-in";
      g.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      tint.set(key, c);
    }
    return c;
  };
  const gray = (b) => { const v = Math.round(b * 255); return (v << 16) | (v << 8) | v; };

  function draw(partial) {
    const g = canvas.getContext("2d"), { x: X, y: Y } = view.position(partial), r = view.r;
    const k = layout.u * (devicePixelRatio || 1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#000";
    g.fillRect(0, 0, canvas.width, canvas.height);
    if (!sheet.complete) return;
    g.setTransform(k / r, 0, 0, k / r, 0, 0);
    // The tiled random block background.
    const v10 = (X + 288) >> 4, v11 = (Y + 288) >> 4, v12 = (X + 288) % 16, v13 = (Y + 288) % 16;
    for (let i = 0; i * (16 / r) - v13 < 155; i++) {
      const shade = 0.6 - ((v11 + i) / 25) * 0.3;
      for (let j = 0; j * (16 / r) - v12 < 224; j++) {
        const img = textures[backgroundTile(hash, v10 + j, v11 + i, rng)];
        if (!img.complete) continue;
        g.drawImage(img, j * 16 - v12, i * 16 - v13, 16, 16);
        g.fillStyle = `rgba(0,0,0,${1 - shade})`;
        g.fillRect(j * 16 - v12, i * 16 - v13, 16, 16);
      }
    }
    // Links, then arrows tinted by the link colour.
    for (const a of ACHIEVEMENTS) {
      const p = a.parent && BY_ID[a.parent];
      if (!p || achievements.depth(a.id) > 4) continue;
      const x = a.column * 24 - X + 11, y = a.row * 24 - Y + 11, px2 = p.column * 24 - X + 11, py = p.row * 24 - Y + 11;
      const rgb = linkColor(achievements.has(a.id), achievements.canUnlock(a.id));
      g.fillStyle = `#${rgb.toString(16).padStart(6, "0")}`;
      g.fillRect(Math.min(x, px2), y, Math.abs(px2 - x) + 1, 1);
      g.fillRect(px2, Math.min(y, py), 1, Math.abs(py - y) + 1);
      if (x > px2) g.drawImage(tinted(114, 234, 7, 11, rgb || 0), x - 11 - 7, y - 5);
      else if (x < px2) g.drawImage(tinted(107, 234, 7, 11, rgb || 0), x + 11, y - 5);
      else if (y > py) g.drawImage(tinted(96, 234, 11, 7, rgb || 0), x - 5, y - 11 - 7);
      else if (y < py) g.drawImage(tinted(96, 241, 11, 7, rgb || 0), x - 5, y + 11);
    }
    // Node frames.
    hover = null;
    const mx = (mouse.x - layout.left - 16) * r, my = (mouse.y - layout.top - 17) * r;
    const inView = mouse.x >= layout.left + 16 && mouse.y >= layout.top + 17 && mouse.x < layout.left + 240 && mouse.y < layout.top + 172;
    for (const a of ACHIEVEMENTS) {
      const x = a.column * 24 - X, y = a.row * 24 - Y;
      const depth = achievements.depth(a.id), style = nodeStyle(achievements.has(a.id), achievements.canUnlock(a.id), depth);
      const node = nodes.get(a.id);
      const visible = style && x >= -24 && y >= -24 && x <= 224 * r && y <= 155 * r;
      node.style.display = visible ? "" : "none";
      if (!visible) continue;
      g.drawImage(tinted(a.special ? 26 : 0, 202, 26, 26, gray(style.brightness)), x - 2, y - 2);
      node.style.filter = achievements.canUnlock(a.id) ? "" : "brightness(0.1)";
      if (inView && mx >= x && mx <= x + 22 && my >= y && my <= y + 22) hover = a;
    }
    content.style.transform = `translate(${(-X / r) * layout.u}px,${(-Y / r) * layout.u}px) scale(${1 / r})`;
  }
  let hover = null, rng = new JavaRandom(0), sheet = null, textures = null, nodes = new Map();

  function showTip() {
    const key = hover ? `${hover.id}|${mouse.x}|${mouse.y}|${achievements.has(hover.id)}` : "";
    if (key === tipKey) return;
    tipKey = key;
    tip.replaceChildren();
    const info = hover && tooltipFor(hover, achievements, keyName());
    if (!info) return;
    const tx = mouse.x + 12, ty = mouse.y - 4, [bx, by, bw, bh] = info.box;
    tip.append(el("div", "", `left:${px(tx + bx)};top:${px(ty + by)};width:${px(bw)};height:${px(bh)};background:#000000c0`));
    for (const l of info.lines) {
      const t = el("div", "mc-text" + (l.shadow ? "" : " flat"), `left:${px(tx + l.x)};top:${px(ty + l.y)}`);
      t.innerHTML = textHtml(l.text, l.color);
      tip.append(t);
    }
  }

  return {
    id: "achievements",
    escape: close,
    key(e) {
      // GuiAchievements.keyTyped: the key.inventory code closes the screen.
      if (lwjglCode(e) !== inventoryKey()) return false;
      close();
      return true;
    },
    // GuiScreen.handleMouseInput: the wheel zooms anywhere on the screen.
    wheel(direction) { view.wheel(direction); },
    init(g, w, h) {
      ensureStyle();
      ({ sheet, textures } = assets());
      const left = Math.trunc((w - 256) / 2), top = Math.trunc((h - 202) / 2);
      layout = { left, top, u: g.u };
      nodes = new Map();
      const area = el("div", "ach-view", `left:${px(left + 16)};top:${px(top + 17)};width:${px(224)};height:${px(155)}`);
      canvas = el("canvas");
      canvas.width = Math.round(224 * g.u * (devicePixelRatio || 1));
      canvas.height = Math.round(155 * g.u * (devicePixelRatio || 1));
      content = el("div", "ach-content", "left:0;top:0;width:0;height:0");
      for (const a of ACHIEVEMENTS) {
        const n = el("div", "ach-icon", `left:${px(a.column * 24 + 3)};top:${px(a.row * 24 + 3)};width:${px(16)};height:${px(16)}`);
        n.innerHTML = icon(iconItem(a), a.damage);
        content.append(n);
        nodes.set(a.id, n);
      }
      area.append(canvas, content);
      g.layer.append(area);
      g.image("ach-frame ach-sprite", left, top, 256, 202).style.backgroundSize = `${px(256)} ${px(256)}`;
      g.text(t("gui.achievements"), left + 15, top + 5, { color: 0x404040, shadow: false });
      g.button({ x: Math.trunc(w / 2) + 24, y: Math.trunc(h / 2) + 74, w: 80, h: 20 }, t("gui.done"), () => show(back()));
      tip = el("div", "ach-tip", "left:0;top:0");
      g.layer.append(tip);
      tipKey = "";
      // GuiAchievements.mouseClicked is the default one; dragging reads Mouse.isButtonDown(0) each frame.
      const at = (e) => { const m = g.mouse(e); mouse.x = m.x; mouse.y = m.y; };
      area.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        at(e);
        mouse.down = true;
        g.drag = { move: at, up: () => { mouse.down = false; } };
      });
      area.addEventListener("pointermove", at);
      g.layer.addEventListener("pointermove", at);
      base = 0;
    },
    frame(now) {
      base ||= now;
      while (now - base >= 50) { base += 50; view.tick(); }
      const inside = mouse.x >= layout.left + 16 && mouse.y >= layout.top + 17 && mouse.x < layout.left + 240 && mouse.y < layout.top + 172;
      view.drag(mouse.x, mouse.y, mouse.down && inside);
      draw((now - base) / 50);
      showTip();
    },
    close() { tint.clear(); },
    background: () => "default",
  };
}
