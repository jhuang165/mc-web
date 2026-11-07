// Native GuiContainer shell for the container screens (batch 22). The screens used to open inside the page `modal()` dialog, which carries a
// title bar and a close button that 1.7.10 does not have. This module holds the shared GuiContainer geometry and builds the chrome-free host.
//
// Evidence labels: bytecode-read = javap of the unchanged 1.7.10 jar (nothing executed); assumed = not from the jar.
// Values are recorded in public/research/container-screens-reference.json and pinned by container-screens.test.js.
//
// GuiContainer (bex), bytecode-read:
//   constructor: xSize = 176, ySize = 166. initGui: guiLeft = (width - xSize) / 2, guiTop = (height - ySize) / 2 (int division of the
//     ScaledResolution size, which is ceil(display / scale)). drawScreen: drawDefaultBackground() first, then the background layer at
//     (guiLeft, guiTop), then glTranslatef(guiLeft, guiTop) and drawGuiContainerForegroundLayer(mouseX, mouseY), where each title is
//     fontRenderer.drawString(text, x, y, 0x404040) (no shadow).
//   GuiScreen.drawDefaultBackground (bdw.c_): with a world, drawGradientRect(0, 0, width, height, -1072689136, -804253680), which is
//     0xC0101010 to 0xD0101010.
//   keyTyped (bex.a(char, int)): Escape (1) or key.inventory closes (EntityClientPlayerMP.closeScreen); then the hotbar keys act on the hovered
//     slot and key.drop drops it. Screens with a text field (GuiRepair, GuiContainerCreative's search) route the key to the field first.
// The title and "Inventory" label positions per screen are in SCREENS below; the file name of each class is in the reference JSON.
import { scaledSize } from "./menu-screens.js";
import { textWidth } from "./menu-screens.js";
import { bitmapHtml } from "./bitmap-text.js";

export const TEXT_COLOR = 0x404040;
/** GuiScreen.drawDefaultBackground gradient (bytecode-read, bdw.c_). */
export const BACKGROUND = { from: 0xc0101010, to: 0xd0101010 };
const css = (argb) => `rgba(${(argb >> 16) & 255},${(argb >> 8) & 255},${argb & 255},${((argb >>> 24) / 255).toFixed(4)})`;
export const backgroundCss = () => `linear-gradient(${css(BACKGROUND.from)},${css(BACKGROUND.to)})`;

const half = (n) => Math.trunc(n / 2);
const INV_Y = (ySize) => ySize - 96 + 2; // every "container.inventory" label: drawString(.., 8, ySize - 96 + 2, 0x404040)

/**
 * Per screen: xSize, ySize (a number or a function of the chest rows), and the foreground strings.
 * title: { x } left aligned, or { center: true } for xSize / 2 - getStringWidth / 2 (all int arithmetic); y is the top of the glyphs.
 * inventory: the "container.inventory" label, or null when the class draws none.
 */
export const SCREENS = {
  // GuiInventory (bfu): only "container.crafting" at (86, 16); it draws no inventory label.
  inventory: { cls: "GuiInventory (bfu)", xSize: 176, ySize: 166, title: { text: "Crafting", x: 86, y: 16 }, inventory: null, fixedTitle: true },
  // GuiCrafting (bfj): "container.crafting" at (28, 6), inventory at (8, ySize - 94).
  workbench: { cls: "GuiCrafting (bfj)", xSize: 176, ySize: 166, title: { text: "Crafting", x: 28, y: 6 }, inventory: { x: 8 }, fixedTitle: true },
  // GuiChest (bfi): ySize = 222 - 108 + rows * 18, title left at (8, 6).
  chest: { cls: "GuiChest (bfi)", xSize: 176, ySize: ({ rows = 3 } = {}) => 222 - 108 + rows * 18, title: { x: 8, y: 6 }, inventory: { x: 8 } },
  // GuiFurnace (bfr): title centred.
  furnace: { cls: "GuiFurnace (bfr)", xSize: 176, ySize: 166, title: { center: true, y: 6 }, inventory: { x: 8 } },
  // GuiDispenser (bfy): title centred.
  dispenser: { cls: "GuiDispenser (bfy)", xSize: 176, ySize: 166, title: { center: true, y: 6 }, inventory: { x: 8 } },
  // GuiHopper (bfs): ySize 133, title left.
  hopper: { cls: "GuiHopper (bfs)", xSize: 176, ySize: 133, title: { x: 8, y: 6 }, inventory: { x: 8 } },
  // GuiBrewingStand (bfg): title centred.
  brewing: { cls: "GuiBrewingStand (bfg)", xSize: 176, ySize: 166, title: { center: true, y: 6 }, inventory: { x: 8 } },
  // GuiEnchantment (bfq): "container.enchant" at (12, 5).
  enchanting: { cls: "GuiEnchantment (bfq)", xSize: 176, ySize: 166, title: { text: "Enchant", x: 12, y: 5 }, inventory: { x: 8 } },
  // GuiRepair (bey): "container.repair" at (60, 6); no inventory label. The cost line is drawn in the foreground by the DOM host.
  anvil: { cls: "GuiRepair (bey)", xSize: 176, ySize: 166, title: { text: "Repair & Name", x: 60, y: 6 }, inventory: null, fixedTitle: true },
  // GuiBeacon (bez): 230 x 219; no title, "tile.beacon.primary" centred at x 62 and ".secondary" at x 169, y 10, 0xE0E0E0 (drawCenteredString,
  // with shadow). Those two strings are produced by pyramid-gui.js beaconDecorationsHtml.
  beacon: { cls: "GuiBeacon (bez)", xSize: 230, ySize: 219, title: null, inventory: null, owned: true },
  // GuiMerchant (bfv): title centred; the inventory label is part of merchant-ui.js merchantDecorationsHtml.
  merchant: { cls: "GuiMerchant (bfv)", xSize: 176, ySize: 166, title: { center: true, y: 6 }, inventory: { x: 8, owned: true } },
  // GuiScreenHorseInventory (bft): title (8, 6), inventory (8, ySize - 94).
  horse: { cls: "GuiScreenHorseInventory (bft)", xSize: 176, ySize: 166, title: { x: 8, y: 6 }, inventory: { x: 8 } },
  // GuiContainerCreative (bfl): 195 x 136; the selected tab's name at (8, 6) while that tab shows its title.
  creative: { cls: "GuiContainerCreative (bfl)", xSize: 195, ySize: 136, title: { x: 8, y: 6 }, inventory: null },
};
export const CONTAINER_KINDS = Object.keys(SCREENS);

/** xSize and ySize of a screen (`rows` for the chest). */
export function screenSize(kind, opts = {}) {
  const s = SCREENS[kind] ?? SCREENS.inventory;
  return { xSize: s.xSize, ySize: typeof s.ySize === "function" ? s.ySize(opts) : s.ySize };
}

/** GuiContainer.initGui: guiLeft / guiTop in GUI units for a display of `width` x `height` pixels at GUI scale `scale`. */
export function guiOrigin(kind, width, height, scale, opts = {}) {
  const { w, h } = scaledSize(width, height, scale), { xSize, ySize } = screenSize(kind, opts);
  return { guiLeft: half(w - xSize), guiTop: half(h - ySize), xSize, ySize, scaledWidth: w, scaledHeight: h };
}

/**
 * The foreground labels of a screen, positions relative to guiLeft / guiTop. `title` is the localized (or entity) name; `inventory` the
 * localized "Inventory". Strings owned by a decoration module (merchant inventory, beacon) are left out.
 */
export function labelLayout(kind, { title = "", inventory = "Inventory", rows = 3, width = textWidth } = {}) {
  const s = SCREENS[kind];
  if (!s) return [];
  const { xSize, ySize } = screenSize(kind, { rows }), out = [];
  if (s.title) {
    const text = title;
    out.push({ id: "title", text, x: s.title.center ? half(xSize) - half(width(text)) : s.title.x, y: s.title.y });
  }
  if (s.inventory && !s.inventory.owned) out.push({ id: "inventory", text: inventory, x: s.inventory.x, y: INV_Y(ySize) });
  return out;
}

/**
 * GuiContainer.keyTyped: what a key does on an open container screen. `inventoryKey` is whether the key is the bound key.inventory;
 * `textFocused` is a focused text field (anvil name, creative search), which takes the key first.
 */
export function containerKeyAction({ escape = false, inventoryKey = false, textFocused = false } = {}) {
  if (escape) return "close"; // Escape (key code 1) closes whatever has focus
  if (inventoryKey && !textFocused) return "close";
  return null;
}

/** The label markup: glyph text (bitmap-text drawLabels fills each span from its text), positioned in GUI units against the panel. */
export function labelsHtml(kind, opts = {}) {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return labelLayout(kind, opts)
    .filter((l) => l.text !== "" || (kind === "creative" && l.id === "title"))
    .map((l) => `<span class="gui-label${l.id === "title" ? "" : " gui-label-inventory"}"${l.id === "title" ? ' id="modal-title"' : ""} style="left:calc(${l.x}*var(--u));top:calc(${l.y}*var(--u))">${esc(l.text)}</span>`)
    .join("");
}

/** Host markup for a chrome-free GuiContainer: no title bar, no close button; the panel is positioned by placeShell. */
export function shellHtml(extra, body) {
  return `<div class="modal gui-shell-panel ${extra}">${body}</div>`;
}

const scaleOf = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gui-scale")) || 1;

/**
 * Show the host: the overlay gets the drawDefaultBackground gradient and the panel the guiLeft / guiTop offsets. `kind` "screen" (the book)
 * is a plain GuiScreen: panel at x trunc((scaledWidth - width) / 2), y 0. Returns a function that removes the resize listener.
 */
export function placeShell(overlay, kind, opts = {}) {
  overlay.classList.add("gui-shell");
  overlay.removeAttribute("aria-labelledby");
  overlay.setAttribute("aria-label", opts.label ?? "");
  const panel = overlay.querySelector(".gui-shell-panel");
  const place = () => {
    const scale = scaleOf(), u = `${scale}px`;
    if (kind === "screen") {
      const { w } = scaledSize(innerWidth, innerHeight, scale), width = opts.width ?? 320;
      panel.style.left = `${half(w - width) * scale}px`;
      panel.style.top = "0px";
      return;
    }
    const o = guiOrigin(kind, innerWidth, innerHeight, scale, opts);
    panel.style.left = `${o.guiLeft * scale}px`;
    panel.style.top = `${o.guiTop * scale}px`;
    panel.dataset.guiLeft = String(o.guiLeft);
    panel.dataset.guiTop = String(o.guiTop);
    panel.style.setProperty("--gui-unit", u);
  };
  place();
  addEventListener("resize", place);
  return () => removeEventListener("resize", place);
}

/**
 * GuiBeacon (bez) foreground: drawCenteredString(tile.beacon.primary, 62, 10, 0xE0E0E0) and (.secondary, 169, 10, 0xE0E0E0), drawn with the
 * shadow, centred at x - getStringWidth / 2 (bytecode-read). pyramid-gui.js emits the two spans; this redraws them as glyph text.
 */
export const BEACON_LABELS = { y: 10, color: 0xe0e0e0, xs: [62, 169] };
export function beaconLabelX(center, width) { return center - half(width); }
export function drawBeaconLabels(root) {
  root.querySelectorAll(".beacon-label").forEach((el, i) => {
    const text = el.textContent, x = beaconLabelX(BEACON_LABELS.xs[i] ?? 62, textWidth(text));
    el.classList.add("mc-text");
    el.style.cssText = `left:calc(${x}*var(--u));top:calc(${BEACON_LABELS.y}*var(--u));width:auto;transform:none`;
    el.innerHTML = bitmapHtml(text, BEACON_LABELS.color);
  });
}
