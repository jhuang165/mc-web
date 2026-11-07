// BossStatus (bln) and GuiIngame.func_73828_d (bbv.d): the boss health bar at the top of the screen. A boss renderer calls
// setBossStatus(entity, name) every frame it draws the boss (RenderWither, RenderDragon); the bar then shows for 100 more frames (the
// counter runs down once per drawn frame). Reusable: the Ender dragon track calls the same function. The draw loop runs by itself
// in the browser (requestAnimationFrame), so no hook in main.js is needed; the numbers are pure and tested.
const f = Math.fround;
export const BAR = Object.freeze({ width: 182, height: 5, y: 12, nameY: 2, backV: 74, fillV: 79, frames: 100, scale: 183 });
export const status = { healthScale: 1, length: 0, name: null, darkenSky: false };
// BossStatus.setBossStatus(IBossDisplayData, boolean): health / max health, 100 frames, the name, whether the sky darkens.
export function setBossStatus(entity, name, darkenSky = false) {
  const max = entity.maxHealth ?? entity.maxhealth ?? 300;
  status.healthScale = f(f(Math.max(0, entity.health)) / f(max));
  status.length = BAR.frames;
  status.name = name;
  status.darkenSky = darkenSky;
}
// GuiIngame.func_73828_d: nothing when the status has no name or ran out; else the fill width and one frame consumed.
export function barFrame() {
  if (!status.name || status.length <= 0) return null;
  status.length--;
  return { width: BAR.width, fill: Math.trunc(f(status.healthScale * BAR.scale)), name: status.name, y: BAR.y, nameY: BAR.nameY };
}
export function clearBossStatus() { status.length = 0; status.name = null; }
import { bitmapHtml } from "./bitmap-text.js";
import { font } from "./font-renderer.js";
let el = null, started = false;
function build() {
  const style = document.createElement("style");
  const icons = "url('/media/1.7.10/gui/icons.png') no-repeat";
  style.textContent = `#boss-bar{position:fixed;left:50%;top:calc(2*var(--u,2px));transform:translateX(-50%);width:calc(182*var(--u,2px));pointer-events:none;z-index:4;text-align:center;image-rendering:pixelated;display:none;color:#fff;font-family:Minecraft,monospace;text-shadow:calc(1*var(--u,2px)) calc(1*var(--u,2px)) 0 #3f3f3f}
#boss-bar .boss-name{white-space:pre;height:calc(10*var(--u,2px));line-height:calc(8*var(--u,2px));font-size:calc(8*var(--u,2px))}
#boss-bar .boss-track,#boss-bar .boss-fill{height:calc(5*var(--u,2px));background:${icons} 0 calc(-74*var(--u,2px))/calc(256*var(--u,2px)) calc(256*var(--u,2px))}
#boss-bar .boss-fill{background-position:0 calc(-79*var(--u,2px));max-width:calc(183/182*100%)}`;
  document.head.append(style);
  el = document.createElement("div");
  el.id = "boss-bar";
  el.innerHTML = '<div class="boss-name"></div><div class="boss-track"><div class="boss-fill"></div></div>';
  document.body.append(el);
}
function loop() {
  requestAnimationFrame(loop);
  const frame = barFrame();
  if (!el) { if (!frame) return; build(); }
  if (!frame) { el.style.display = "none"; return; }
  el.style.display = "block";
  if (el.firstChild.dataset.name !== frame.name + font.version) { el.firstChild.dataset.name = frame.name + font.version; el.firstChild.innerHTML = bitmapHtml(frame.name, 0xffffff); } // GuiIngame draws the name with drawStringWithShadow
  el.lastChild.firstChild.style.width = frame.fill / BAR.width * 100 + "%";
}
// Starts the draw loop once (browser only).
export function startBossBar() {
  if (started || typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  started = true;
  requestAnimationFrame(loop);
}
