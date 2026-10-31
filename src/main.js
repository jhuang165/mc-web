import "./style.css";
import "./minecraft-ui.css";
import "./container-ui.css";
import {guiScale,stackCount,durabilityBar,tooltipLines} from "./gui.js";
import * as THREE from "three";
import {
  World,
  SIZE,
  HEIGHT,
  BLOCKS,
  PHYSICS,
  hashSeed,
  collides,
  raycast,
  fallingVelocity,
  WOOL,
  isLiquid,
  DYE,
  RED_FLOWER,
  YELLOW_FLOWER,
  isFlower,
} from "./world.js";
import { flowerCanStay, growGrass, JRandom } from "./flowers.js";
import { VoxelScene } from "./scene.js";
import { SoundBank, blockSound } from "./audio.js";
import { PlayerAnimation, SWING_SECONDS } from "./animation.js";
import { PlayerBody, PlayerRenderer, nextView, thirdPersonCamera, playerShadowCaster } from "./player-renderer.js";
import { FirstPerson, itemTexture } from "./first-person.js";
import {Experience,ExperienceOrbs,oreExperience,SMELT_EXPERIENCE} from "./experience.js";
import {ExperienceRenderer} from "./experience-renderer.js";
import {Farming,cropDrops} from "./farming.js";
import { EntityWorld, ENTITY_TYPES } from "./entities.js";
import { SHADOWS } from "./shadows.js";
import { MobRenderer } from "./mob-renderer.js";
import { ChestRenderer } from "./chest-renderer.js";
import { CHEST, canPlaceChest, placeChest, settleFacing, chestPair, tickLid } from "./chest.js";
import { Survival, ITEMS, MATERIALS } from "./survival.js";
import { ContainerScreen, makeStack, copyStack } from "./inventory.js";
import { CreativeScreen, CREATIVE_TABS, SEARCH, SURVIVAL_TAB, tabArea, itemTab, GUI_WIDTH } from "./creative.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { Fluids, waterAcceleration, entityWaterBox, inLava, liquidInBox } from "./fluids.js";
import { useBucket, milkCow, finishDrinking, isBucket, MILK_BUCKET, DRINK_TICKS } from "./buckets.js";
import { PlayerMotion, sneakEdge, moveWeights, isCritical, ATTACK_SLOWDOWN } from "./player-movement.js";

const cube = `<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="m16 1 15 8.5v17L16 35 1 26.5v-17Z" fill="currentColor"/><path d="m1 9.5 15 8.7 15-8.7M16 18v17" stroke="#192a22" stroke-width="1.5"/><path d="M8.5 5.2 23.5 14M8.5 14 23.5 5.2M8.5 14v16.7M23.5 14v16.7M1 18l15 8.5L31 18" stroke="#192a22" stroke-width="1" opacity=".4"/></svg>`;
const arrow = '<span aria-hidden="true">↗</span>';
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const storageKey = "blockworld.worlds.v1";
let worlds = [];
try {
  worlds = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (!Array.isArray(worlds)) worlds = [];
} catch {
  worlds = [];
}
let options = {
  sensitivity: 1,
  volume: 0.65,
  bobbing: true,
  fov: 75,
  distance: 155,
  sound: true,
  guiScale:0,
  // GameSettings.gammaSetting: 0 Moody (the 1.7.10 default) to 1 Bright.
  gamma: 0,
};
try {
  options = {
    ...options,
    ...JSON.parse(localStorage.getItem("blockworld.settings") || "{}"),
  };
} catch {}
// GameSettings.getKeyBinding for GAMMA.
const gammaLabel=g=>g<=0?"Moody":g>=1?"Bright":"+"+Math.round(g*100)+"%";
function updateGuiScale(){document.documentElement.style.setProperty('--gui-scale',guiScale(innerWidth,innerHeight,Number(options.guiScale)||0));}
window.addEventListener('resize',updateGuiScale);updateGuiScale();
let screen = "home",
  world,
  active,
  flying = false,
  grounded = false,
  yaw = 0,
  pitch = 0,
  velocity = new THREE.Vector3(),
  position = new THREE.Vector3(),
  previous = new THREE.Vector3(),
  keys = new Set(),
  target = null,
  elapsed = 0,
  accumulator = 0,
  lastFrame = performance.now(),
  lastSave = 0,
  frames = 0,
  fps = 0,
  fpsTime = 0,
  debug = false,
  dragging = false,
  dragDistance = 0,
  lockFallback = false,
  saved = true,
  lastJump = 0;
let eyeRay = null; // the view ray of the last frame, for the bucket's liquid trace
let fluids,farming,experience=new Experience(),xpOrbs=new ExperienceOrbs(),xpRenderer;
let sounds,
  firstPerson,
  mobs,
  mobRenderer,
  chestRenderer,
  aimedEntity = null,
  eating = null;
const animation = new PlayerAnimation();
// GameSettings.thirdPersonView: 0 first person, 1 behind, 2 in front (F5).
// Not saved, like 1.7.10.
let thirdPersonView = 0, playerRenderer;
const playerBody = new PlayerBody();
// Sprint/sneak state, move input and the sneak eye drop (player-movement.js).
const motion = new PlayerMotion();
let collidedH = false, walkFrozen = false;
let stepDistance = 0,
  wasInWater = false;
let scene;
let pointerX = 0,
  pointerY = 0;
let survival = new Survival({}, "creative"),
  mining = null,
  mineHeld = false,
  mineCooldown = 0,
  fallDistance = 0,
  containerView = null,
  f3Combo = false;
// Dropped items as EntityItem physics objects (see item-entities.js).
const items = new ItemEntities();
// Thrown snowballs and their particles (see projectiles.js).
const projectiles = new Projectiles();
$("#app").innerHTML = `
 <div id="viewport" aria-label="Interactive voxel world"></div><div id="vignette"></div>
 <main id="home" class="minecraft-home">
  <div class="title-screen"><div class="minecraft-logo" aria-label="Minecraft"><i></i><i></i></div><div class="title-buttons"><button class="button" id="enter">Singleplayer</button><button class="button" data-action="create">Create New World</button><button class="button" data-action="settings">Options...</button><button class="button" data-action="controls">Controls...</button></div><footer class="minecraft-footer"><span>Minecraft 1.7.10 · Web recreation</span><span>Copyright Mojang AB</span></footer></div>
  <section class="world-shelf"><h2>Select World</h2><div id="worlds" class="world-grid"></div><div class="world-buttons"><button class="button" data-action="create">Create New World</button><button class="button" id="import">Import World</button><button class="button" id="world-select-back">Cancel</button></div></section>
 </main>
 <section id="hud" class="hidden" aria-label="Game heads-up display"><div class="game-top"><button class="game-brand" id="pause-button">${cube}<span>BLOCKWORLD<small id="world-label"></small></span><span class="pause-symbol">Ⅱ</span></button><div class="game-status"><span class="status-dot"></span><span id="save-label">Saved on this device</span><button id="fullscreen" aria-label="Toggle fullscreen">⛶</button></div></div><div id="crosshair">＋</div><pre id="debug" class="hidden"></pre><div id="block-label"></div><div id="experience-hud" class="hidden"><div id="experience-level"></div><div class="experience-track"><div id="experience-fill"></div></div></div><div id="survival-hud" class="survival-hud hidden"></div><div id="mining-meter" class="mining-meter hidden" role="progressbar" aria-label="Mining progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><div id="damage-flash"></div><div id="flight-label" class="flight-label"><span id="mode-label">CREATIVE</span> <span>·</span> <b id="movement-label">WALKING</b></div><div class="hotbar" id="hotbar"></div><div class="game-help">W A S D <span>move</span> <i>·</i> SPACE <span>jump</span> <i>·</i> LMB <span>break</span> <i>·</i> RMB <span>use / place</span> <i>·</i> E <span>inventory</span> <i>·</i> ESC <span>pause</span></div><div id="mobile-controls"><div class="dpad"><button data-key="KeyW">↑</button><button data-key="KeyA">←</button><button data-key="KeyS">↓</button><button data-key="KeyD">→</button></div><div class="touch-actions"><button id="touch-break">Break</button><button id="touch-place">Use</button><button id="touch-inventory">Bag</button><button id="touch-fly">Fly</button><button data-key="Space">Jump</button></div></div></section>
 <div class="modal-overlay hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></div><div id="toast" role="status"></div><input id="file-input" type="file" accept=".json,application/json" hidden>
 <div id="loading"><span>Loading terrain</span></div>`;

const presets = [
  {
    name: "The Overworld",
    seed: "Overworld",
    biome: "meadow",
    description: "Rolling hills. A river. A fresh start.",
    tag: "MEADOW",
    icon: "↟",
  },
  {
    name: "Higher Ground",
    seed: "Summit 1710",
    biome: "alpine",
    description: "For a different point of view.",
    tag: "HIGHLANDS",
    icon: "△",
  },
  {
    name: "A Place Apart",
    seed: "Castaway",
    biome: "island",
    description: "A small escape, surrounded by blue.",
    tag: "ISLAND",
    icon: "≈",
  },
];
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(worlds));
    return true;
  } catch {
    toast("Device storage is full. Export your world to keep a copy.");
    return false;
  }
}
function renderWorlds() {
  const display = [...worlds];
  for (const p of presets) {
    if (display.length >= 3) break;
    if (!display.some((w) => w.seed === p.seed))
      display.push({ ...p, preset: true });
  }
  $("#worlds").innerHTML = display
    .map(
      (w, i) =>
        `<article class="world-card"><button class="world-open" data-world="${i}"><div class="world-thumb ${esc(w.biome)}"><span class="thumb-sun"></span><span class="thumb-hill h1"></span><span class="thumb-hill h2"></span><span class="thumb-tree t1"></span><span class="thumb-tree t2"></span><span class="thumb-tree t3"></span></div><div class="world-copy"><div class="world-meta"><span>${esc(w.tag || w.biome.toUpperCase())}</span><span>${w.mode === "survival" ? "SURVIVAL" : w.preset ? "READY TO EXPLORE" : "CREATIVE"}</span></div><h3>${esc(w.name)} </h3><p>${esc(w.preset ? w.description : relativeDate(w.updated))}</p></div></button>${!w.preset ? `<button class="world-more" data-manage="${i}" aria-label="Manage ${esc(w.name)}">···</button>` : ""}</article>`,
    )
    .join("");
  document.querySelectorAll("[data-world]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = display[+b.dataset.world];
        launch(w.preset ? makeRecord(w) : w);
      }),
  );
  document
    .querySelectorAll("[data-manage]")
    .forEach((b) => (b.onclick = () => manage(display[+b.dataset.manage])));
}
function relativeDate(d) {
  const diff = Date.now() - d;
  if (diff < 60000) return "Just explored";
  if (diff < 3600000) {
    const n = Math.floor(diff / 60000);
    return `${n} minute${n === 1 ? "" : "s"} ago`;
  }
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function makeRecord(p) {
  return {
    id: crypto.randomUUID(),
    name: p.name.slice(0, 40),
    seed: String(p.seed).slice(0, 80),
    biome: p.biome || "meadow",
    mode: p.mode === "survival" ? "survival" : "creative",
    generationVersion: 5,
    edits: [],
    updated: Date.now(),
    version: 1,
  };
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function sound(place, block = target ? world.get(...target.block) : 3) {
  sounds?.play(
    !place && block === 9 ? "random.glass" : "dig." + blockSound(block),
    { volume: place ? 0.8 : 1, pitch: 0.8 },
  );
}
function icon(id, damage = 0) {
  const item = ITEMS[id];
  if (!id || !item) return '<span class="empty-hand">·</span>';
  if(item.block)return `<img class="vanilla-item-icon vanilla-block-icon" src="${scene.textures.icon(id, damage)}" alt="" aria-hidden="true">`;
  // Leather armor multiplies its base layer by the default 0xA06540 dye; the overlay stays untinted.
  if (item.tint)
    return `<span class="vanilla-item-icon tinted-item" style="--tint:${item.tint};--base:url('/media/1.7.10/items/${item.texture}.png')" aria-hidden="true"><i></i><img src="/media/1.7.10/items/${item.overlay}.png" alt=""></span>`;
  if (!item.block && itemTexture(id, damage))
    return `<img class="vanilla-item-icon" src="${itemTexture(id, damage)}" alt="" aria-hidden="true">`;
  if (!item.block)
    return `<span class="item-icon ${item.kind ? "tool-icon" : ""}" style="--item:${item.color}" aria-hidden="true">${item.glyph}</span>`;
  return `<span class="block-icon b${id}" style="--block:${item.color};--top:${item.top || item.color}"><i></i></span>`;
}
const heldId = () => survival.held?.id || 0;
// Item, stack count and durability overlays, as RenderItem draws them.
function stackHtml(s, count = s?.count) {
  if (!s) return "";
  return icon(s.id, s.damage) + (count === 0 ? '<b class="item-count empty">0</b>' : stackCount(count)) + durabilityBar(s.damage, ITEMS[s.id]?.durability);
}
function stackLabel(s) {
  if (!s) return "Empty";
  const item = ITEMS[s.id];
  return esc(item?.variants?.[s.damage] ?? item?.name ?? "Item") + (s.count > 1 ? " ×" + s.count : "") + (item?.durability && s.damage ? `, durability ${item.durability - s.damage} of ${item.durability}` : "");
}
function renderHotbar() {
  const inv = survival.inventory;
  $("#hotbar").innerHTML = inv.main.slice(0, 9).map((s, i) =>
    `<button class="slot ${i === inv.current ? "selected" : ""}" data-slot="${i}" aria-label="Select ${s ? stackLabel(s) : "empty hand"}" aria-pressed="${i === inv.current}">${s ? stackHtml(s) : ""}<small>${i + 1}</small></button>`,
  ).join("");
  document
    .querySelectorAll("#hotbar [data-slot]")
    .forEach((b) => (b.onclick = () => selectSlot(+b.dataset.slot)));
}
function selectSlot(i) {
  survival.inventory.current = (i + 9) % 9;
  eating = null;
  mining = null;
  renderHotbar();
  showHeldName();
}
function showHeldName() {
  const held = survival.held;
  $("#block-label").textContent = ITEMS[held?.id]?.variants?.[held.damage] ?? ITEMS[heldId()]?.name ?? "Empty hand";
  $("#block-label").classList.add("visible");
  clearTimeout(showHeldName.timer);
  showHeldName.timer = setTimeout(
    () => $("#block-label").classList.remove("visible"),
    1300,
  );
}
function closeModal() {
  closeContainer();
  $("#modal").classList.add("hidden");
  $("#modal").innerHTML = "";
}
function modal(title, body, extra = "") {
  eating = null;
  keys.clear();
  if (screen === "playing") screen = "paused";
  if (document.pointerLockElement) document.exitPointerLock();
  $("#modal").innerHTML =
    `<div class="modal ${extra}"><div class="modal-top"><button class="close-button" aria-label="Close dialog">×</button></div><h2 id="modal-title">${title}</h2>${body}</div>`;
  $("#modal").classList.remove("hidden");
  $("#modal .close-button").onclick = () => {
    if (screen === "inventory") resume();
    else if (screen === "paused") pause();
    else if (screen !== "dead") closeModal();
  };
  $("#modal").querySelector("button,input")?.focus();
}
function createWorld() {
  modal(
    "Create New World",
    `<p class="modal-subtitle"></p><form id="create-form"><label>WORLD NAME<input id="new-name" maxlength="40" value="New World" required></label><div class="form-columns"><label>GAME MODE<select id="new-mode"><option value="survival">Survival</option><option value="creative">Creative</option></select></label><label>LANDSCAPE<select id="new-biome"><option value="meadow">Meadow</option><option value="alpine">Highlands</option><option value="island">Island</option></select></label></div><label>SEED <span>Same seed, same beginning.</span><input id="new-seed" maxlength="80" placeholder="Leave blank for a surprise"></label><p class="form-note">Survival starts empty-handed. Gather wood, craft tools, and watch your health and hunger. 128 × 128 blocks; custom terrain.</p><button class="button primary full">Create New World</button></form>`,
  );
  $("#create-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#new-name").value.trim();
    if (!name) return;
    launch(
      makeRecord({
        name,
        seed:
          $("#new-seed").value.trim() ||
          String(Math.floor(Math.random() * 2147483647)),
        biome: $("#new-biome").value,
        mode: $("#new-mode").value,
      }),
    );
  };
}
function controls() {
  modal(
    "Controls",
    `<p class="modal-subtitle">In Survival, start by punching a tree. In Creative, all materials are available.</p><div class="control-list">${[
      ["W A S D", "Move around"],
      ["MOUSE", "Look around"],
      ["SPACE", "Jump · double tap to fly in Creative"],
      ["SHIFT", "Sneak (hold) · descend while flying"],
      ["CTRL", "Sprint (requires food in Survival)"],
      ["LEFT CLICK", "Hold to mine · click in drag mode"],
      ["RIGHT CLICK", "Place, eat, or use a workstation"],
      ["1 – 9 / SCROLL", "Choose a slot"],
      ["Q / CTRL + Q", "Drop one item / the whole stack"],
      ["MIDDLE CLICK", "Pick the targeted block"],
      ["E", "Inventory & 2 × 2 crafting"],
      ["F3", "Coordinates, time & performance"],
      ["F5", "Cycle first person, behind and front view"],
      ["ESC", "Pause & save"],
    ]
      .map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`)
      .join(
        "",
      )}</div><p class="form-note">Inventories use the 1.7.10 slot rules. Left-click picks up or places a stack; right-click picks up half or places one. Drag a held stack across slots to share it evenly (left) or one each (right). Shift-click moves a stack between sections; double-click gathers matching items. Over a slot, 1 – 9 swaps with the hotbar and Q / Ctrl + Q drops. Click outside the window to throw the held stack. Right-click a crafting table for the 3 × 3 grid, a furnace to smelt or a chest to store items (two side by side form a large chest; a solid block on top keeps the lid shut); two damaged tools of one kind repair each other. F3 + H shows durability in tooltips.</p><p class="form-note">In Creative, E opens the 1.7.10 tabbed inventory. Click a tab or press T to search; the wheel or scrollbar scrolls. Click an item to take one (Shift: a full stack); click the same item again to add one, or anything else to delete the held stack. The chest tab shows your survival inventory; its X slot destroys the held item (Shift-click clears everything).</p><p class="form-note">To farm: break tall grass for seeds, right-click exposed grass/dirt with a hoe, then plant seeds on the tilled soil. Hold wheat to lead cows; feed two adults to breed a calf. Water within four blocks keeps soil hydrated. Bone meal advances growth; harvest mature golden wheat and craft three wheat into bread.</p><p class="form-note">If mouse capture is unavailable, drag to look and click once to mine the targeted block. Touch controls include a Fly button in Creative.</p>`,
  );
}
function notes() {
  modal(
    "Rebuilding 1.7.10, system by system.",
    `<p class="modal-subtitle">Minecraft Java 1.7.10 is the compatibility target. Full parity is still unfinished.</p><div class="notes"><span class="note-tag">VERIFIED AGAINST BYTECODE</span><p>REA inventories the original JAR. MCP mappings and javap locate the original movement, FoodStats, crafting, furnace, and world-clock implementations.</p><div class="facts"><div><b>20 Hz</b><span>Physics ticks</span></div><div><b>200</b><span>Ticks / smelt</span></div><div><b>24,000</b><span>Ticks / day</span></div></div><span class="note-tag">IMPLEMENTED IN THIS BUILD</span><p>Creative and Survival, health, hunger, saturation, exhaustion, experience orbs/levels, regeneration, fall damage, drowning, death and recoverable inventory drops. Broken blocks, mob kills and thrown stacks drop item entities that fall, merge and are picked up. The Java 36-slot inventory with cursor, drag-splitting, shift- and double-click rules; shaped crafting, a crafting table, a fuel-driven furnace and single/large chests on real slots; the tabbed creative inventory with search; wood, stone, iron, diamond and gold tools with per-item durability and repair; leather, chain, iron, gold and diamond armor. Original 1.7.10 block/item textures, HUD sprites, sun, moon and sound effects; hand swings, equip transitions, bobbing, eating, animated water, crack frames and entity shadows. Pigs, cows, sheep and night-time zombies with 1.7.10 movement and knockback, basic melee combat and food drops. Cows and sheep follow wheat and breed; sheep graze and can be sheared for coloured wool. Flowing water spreads and pushes items, players and mobs; snowballs can be thrown; F5 shows the player model with armor. Caves, ores and torches; 1.7.10 sky/block light, smooth lighting, lightmap, sky, stars, fog and fancy clouds. Wheat farming with five hoe tiers, seeds, moisture, eight growth stages, bone meal, harvesting and bread crafting.</p><span class="note-tag">MAJOR GAPS REMAIN</span><p>Original world generation and biomes, the complete block/item registry, most mobs and their full AI, other crops, advanced combat, lava, dyes, enchantments, hoppers and other storage, redstone, dimensions, structures, weather, void fog, Java saves, and multiplayer. The renderer, terrain, entity AI and several interactions remain simplified. Original sounds and textures retain Mojang/Microsoft ownership.</p><div class="note-links"><a href="/research/textures-and-farming.md" target="_blank" rel="noopener">Textures & farming ↗</a><a href="/research/animations-and-sounds.md" target="_blank" rel="noopener">Animation & audio ↗</a><a href="/research/investigation.md" target="_blank" rel="noopener">Investigation ↗</a><a href="/research/items.md" target="_blank" rel="noopener">Item drops ↗</a><a href="/research/creative.md" target="_blank" rel="noopener">Creative inventory ↗</a><a href="/research/shadows.md" target="_blank" rel="noopener">Entity shadows ↗</a><a href="/research/fluids.md" target="_blank" rel="noopener">Flowing water ↗</a><a href="/research/third-person.md" target="_blank" rel="noopener">Third person ↗</a><a href="/research/sheep.md" target="_blank" rel="noopener">Sheep & wool ↗</a><a href="/research/projectiles.md" target="_blank" rel="noopener">Snowballs ↗</a><a href="/research/parity.md" target="_blank" rel="noopener">Feature coverage ↗</a><a href="https://github.com/morluto/rea" target="_blank" rel="noopener">REA ↗</a></div></div>`,
    "notes-modal",
  );
}
function settings() {
  modal(
    "Options",
    `<p class="modal-subtitle">Original Minecraft 1.7.10 effects. Your preferences stay on this device.</p><div class="settings-list"><label>GUI Scale<select id="gui-scale">${[[0,"Auto"],[1,"Small"],[2,"Normal"],[3,"Large"],[4,"Larger"]].map(([v,label])=>`<option value="${v}" ${Number(options.guiScale||0)===v?"selected":""}>${label}</option>`).join("")}</select></label><label>Field of view <output id="fov-value">${options.fov}°</output><input type="range" id="fov" min="50" max="100" value="${options.fov}"></label><label>Mouse sensitivity <output id="sensitivity-value">${options.sensitivity.toFixed(1)}×</output><input type="range" id="sensitivity" min="0.2" max="2" step="0.1" value="${options.sensitivity}"></label><label>View distance <output id="distance-value">${options.distance} blocks</output><input type="range" id="distance" min="70" max="200" step="5" value="${options.distance}"></label><label>Brightness <output id="gamma-value">${gammaLabel(options.gamma)}</output><input type="range" id="gamma" min="0" max="1" step=".01" value="${options.gamma}"></label><label>Sound volume <output id="volume-value">${Math.round(options.volume * 100)}%</output><input type="range" id="volume" min="0" max="1" step=".05" value="${options.volume}"></label><label class="switch-label">Sounds<input type="checkbox" id="sound" ${options.sound ? "checked" : ""}></label><label class="switch-label">View bobbing<input type="checkbox" id="bobbing" ${options.bobbing ? "checked" : ""}></label><button class="button secondary full" id="test-sound">Test original sound <span>♪</span></button><p class="form-note" id="audio-status" role="status">${esc(sounds.status)}</p></div>`,
  );
  for (const key of [
    "fov",
    "sensitivity",
    "distance",
    "gamma",
    "volume",
    "sound",
    "bobbing",
  ])
    $("#" + key).oninput = (e) => {
      options[key] = ["sound", "bobbing"].includes(key)
        ? e.target.checked
        : +e.target.value;
      const out = $("#" + key + "-value");
      if (out)
        out.textContent =
          key === "fov"
            ? options[key] + "°"
            : key === "distance"
              ? options[key] + " blocks"
              : key === "gamma"
                ? gammaLabel(options[key])
              : key === "volume"
                ? Math.round(options[key] * 100) + "%"
                : options[key].toFixed(1) + "×";
      scene.camera.fov = options.fov;
      scene.camera.updateProjectionMatrix();
      scene.setDistance(options.distance);
      scene.setGamma(options.gamma);
      try {
        localStorage.setItem("blockworld.settings", JSON.stringify(options));
      } catch {}
    };
  $("#gui-scale").onchange=e=>{options.guiScale=+e.target.value;updateGuiScale();try{localStorage.setItem("blockworld.settings",JSON.stringify(options));}catch{}};
  $("#test-sound").onclick = async () => {
    if (!options.sound) {
      $("#audio-status").textContent = "Sounds are muted.";
      return;
    }
    sounds.unlock();
    const played = await sounds.play("random.click", { volume: 1 });
    $("#audio-status").textContent = played
      ? "Original sound played."
      : sounds.status;
  };
}

function save() {
  if (!active || !world || screen === "home") return;
  active.edits = [...world.edits];
  active.position = { x: position.x, y: position.y, z: position.z, yaw, pitch };
  active.player = survival.serialize();
  active.drops = items.serialize();
  active.projectiles = projectiles.serialize();
  // Items on the cursor or in a crafting grid return to the saved inventory, as closing the screen would.
  const pending = containerView ? [containerView.container.inv.cursor, ...(containerView.container.grid?.stacks || [])].filter(Boolean).map(copyStack) : [];
  if (pending.length) {
    const copy = new Survival(active.player, survival.mode),
      left = pending.filter((s) => (copy.inventory.add(s), s.count > 0));
    active.player = copy.serialize();
    if (left.length) active.drops.push(...left.map((stack) => ({ stack, x: position.x, y: position.y, z: position.z, age: 0, delay: 0 })));
  }
  active.mode = survival.mode;
  delete active.hotbar;
  delete active.selected;
  active.entities = mobs?.serialize() || [];
  active.farms=farming?.serialize()||[];
  active.experience=experience.serialize();active.xpOrbs=xpOrbs.serialize();
  active.updated = Date.now();
  const i = worlds.findIndex((w) => w.id === active.id);
  if (i < 0) worlds.unshift(active);
  else worlds[i] = active;
  saved = persist();
  $("#save-label").textContent = saved
    ? "Saved on this device"
    : "Export to save your changes";
  lastSave = elapsed;
}
function exportWorld(record = active) {
  if (record === active) save();
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { ...record, format: "blockworld", version: 1 },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    record.name.replace(/[^a-z0-9]/gi, "-").toLowerCase() + ".blockworld.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your world is ready to take with you.");
}
function manage(record) {
  modal(
    esc(record.name),
    `<p class="modal-subtitle">A little world worth keeping.</p><div class="menu-actions"><button class="button primary full" id="manage-play">Continue exploring </button><button class="button secondary full" id="manage-export">Export world <span>↓</span></button><button class="text-button danger" id="manage-delete">Delete from this device</button></div>`,
  );
  $("#manage-play").onclick = () => launch(record);
  $("#manage-export").onclick = () => exportWorld(record);
  $("#manage-delete").onclick = () => {
    modal(
      "Let this world go?",
      `<p class="modal-subtitle">“${esc(record.name)}” will be removed from this device. Export a copy first if you want to keep it.</p><div class="menu-actions"><button class="button primary full" id="confirm-delete">Delete world</button><button class="button secondary full" id="cancel-delete">Keep exploring</button></div>`,
    );
    $("#confirm-delete").onclick = () => {
      worlds = worlds.filter((w) => w.id !== record.id);
      persist();
      renderWorlds();
      closeModal();
    };
    $("#cancel-delete").onclick = () => manage(record);
  };
}
function requestLock() {
  if (screen !== "playing") return;
  try {
    const result = scene.renderer.domElement.requestPointerLock?.();
    result?.catch(() => {
      lockFallback = true;
      toast("Drag to look. Left click to mine. Right click to use.");
    });
  } catch {
    lockFallback = true;
  }
}
// Records before 0.7 kept the hotbar and selection beside an aggregate inventory.
function legacyPlayer(record) {
  const player = record.player && typeof record.player === "object" ? record.player : {};
  return Array.isArray(player.slots) ? player : { ...player, hotbar: record.hotbar, current: record.selected };
}
// BlockBush.onNeighborBlockChange: a flower whose ground or light is gone drops as an item.
// Fluids owns world.onChange, so this wraps it.
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER }, boneRandom = new JRandom(Date.now());
function watchFlowers() {
  const next = world.onChange;
  world.onChange = (x, y, z, old, now) => {
    next?.(x, y, z, old, now);
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const fx = x + dx, fy = y + dy, fz = z + dz, b = world.get(fx, fy, fz);
      if (!isFlower(b) || flowerCanStay(world, FLOWERS, fx, fy, fz)) continue;
      const meta = world.getMeta(fx, fy, fz);
      world.set(fx, fy, fz, 0);
      items.dropBlock([makeStack(b, 1, b === RED_FLOWER ? meta : 0)], fx, fy, fz);
      scene.updateBlock(fx, fz, fy);
    }
  };
}
function launch(record) {
  try {
    active = record;
    world = new World(record.seed, record.biome, record.generationVersion ?? 1);
    world.restore(record.edits || []);
    scene.setWorld(world);
    // Water washes away torches, wheat and tall grass (Block.dropBlockAsItem).
    fluids = new Fluids(world, { fizz: (x, y, z, pitch) => sounds.play("random.fizz", { volume: 0.5, pitch, position: { x, y, z } }), wash: (x, y, z, b) => { const d = b === 20 ? [{ id: 20, count: 1 }] : isFlower(b) ? [{ id: b, count: 1, damage: b === RED_FLOWER ? world.getMeta(x, y, z) : 0 }] : cropDrops(b); if (d?.length) items.dropBlock(d.map((e) => makeStack(e.id, e.count, e.damage || 0)), x, y, z); } });
    fluids.wake();
    watchFlowers();
    farming=new Farming(world,record.farms);
    experience=new Experience(record.experience);xpOrbs=new ExperienceOrbs(record.xpOrbs);
    mobs = new EntityWorld(world, record.entities);
    // World.getLightBrightness for EntityAI.getBlockPathWeight: daylight-reduced sky or block light.
    mobs.lightAt = (x, y, z) => (scene.light ? scene.light.level(x, y, z, scene.subtracted) : 15);
    mobRenderer.clear();
    animation.reset();
    eating = null;
    stepDistance = 0;
    wasInWater = false;
    survival = new Survival(legacyPlayer(record), record.mode || "creative");
    // Chest blocks saved without tile data get the facing onBlockAdded gives them.
    for (const [key, b] of world.edits) if (b === CHEST && !survival.chests[key]) settleFacing(world, survival.chests, ...key.split(",").map(Number));
    chestRenderer.sync(world, survival.chests);
    const p = record.position,
      valid =
        p &&
        [p.x, p.y, p.z].every(Number.isFinite) &&
        p.x > 1 &&
        p.x < SIZE - 1 &&
        p.z > 1 &&
        p.z < SIZE - 1 &&
        p.y >= 0 &&
        p.y < HEIGHT;
    position.copy(
      valid
        ? new THREE.Vector3(p.x, p.y, p.z)
        : new THREE.Vector3(...Object.values(world.spawn())),
    );
    if (collides(world, ...position.toArray()))
      position.copy(new THREE.Vector3(...Object.values(world.spawn())));
    previous.copy(position);
    yaw = valid && Number.isFinite(p.yaw) ? p.yaw : 0;
    pitch =
      valid && Number.isFinite(p.pitch)
        ? Math.max(-1.55, Math.min(1.55, p.pitch))
        : 0;
    playerBody.reset(position, yaw, pitch);
    // Saved item entities; piles from before 0.10 (and pre-0.7 death piles
    // that stored a whole inventory) become one entity per stack.
    items.load(
      (Array.isArray(record.drops) ? record.drops : []).map((d) =>
        d && !d.stack && !Array.isArray(d.stacks) && d.inventory
          ? { ...d, death: true, stacks: new Survival({ inventory: d.inventory, durability: d.durability }).inventory.main.filter(Boolean) }
          : d,
      ),
      (st) => survival.inventory.read(st),
      survival.time,
    );
    projectiles.load(record.projectiles);
    velocity.set(0, 0, 0);
    flying = false;
    grounded = false;
    motion.reset();
    collidedH = false;
    mining = null;
    mineHeld = false;
    mineCooldown = 0;
    fallDistance = 0;
    keys.clear();
    accumulator = 0;
    screen = "playing";
    $("#home").classList.add("hidden");
    $("#hud").classList.remove("hidden");
    $("#vignette").classList.add("in-game");
    $("#world-label").textContent = record.name;
    $("#mode-label").textContent = survival.mode.toUpperCase();
    $("#hud").classList.toggle("survival", !survival.creative);
    closeModal();
    renderHotbar();
    renderVitals();
    save();
    scene.setTime(survival.time);
    scene.camera.position.copy(position);scene.camera.position.y+=PHYSICS.eye;scene.camera.rotation.set(pitch,yaw,0,"YXZ");
    if (survival.health <= 0 && !survival.creative) die();
    else {
      requestLock();
      toast(
        survival.creative
          ? "Creative mode · Double-tap Space to fly."
          : "Survival mode · Punch a tree, then press E to craft.",
      );
    }
  } catch (e) {
    toast("Could not open this world: " + e.message);
  }
}
function resume() {
  if (survival.health <= 0 && !survival.creative) {
    screen = "playing";
    die();
    return;
  }
  closeModal();
  screen = "playing";
  keys.clear();
  requestLock();
}
function pause() {
  if (screen === "home" || screen === "dead") return;
  mining = null;
  mineHeld = false;
  screen = "paused";
  keys.clear();
  save();
  modal(
    "Game menu",
    `<p class="modal-subtitle"></p><div class="menu-actions"><button class="button primary full" id="resume">Back to Game</button><button class="button secondary full" data-action="settings">Options...</button><button class="button secondary full" data-action="controls">Controls...</button><button class="button secondary full" id="export-pause">Export world <span>↓</span></button><button class="text-button full" id="exit-world">Save and Quit to Title</button></div>`,
  );
  $("#resume").onclick = resume;
  $("#export-pause").onclick = () => exportWorld();
  $("#exit-world").onclick = goHome;
  bindActions();
}
function goHome() {
  save();
  screen = "home";
  closeModal();
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("#home").classList.remove("hidden","selecting");
  $("#hud").classList.add("hidden");
  $("#vignette").classList.remove("in-game");
  renderWorlds();
}
function inventory(station = false) {
  if (survival.creative && !station) {
    openCreative();
    return;
  }
  openContainer(station ? survival.openWorkbench() : survival.openInventory(), station ? "workbench" : "inventory");
}
// GuiContainerCreative: tabs, the scrolling 9 x 5 item grid, search and the survival inventory tab.
function openCreative() {
  const gui = new CreativeScreen(survival.inventory, {
    playerContainer: () => survival.openInventory(),
    tooltip: (s) => tooltipLines(ITEMS[s.id], s, options.advancedTooltips).map((l) => l.text),
  });
  openContainer(gui.container, "creative", null, gui);
}
function tabIcon(t) {
  const i = t.icon;
  if (i.id) return icon(i.id);
  if (i.potion) return `<span class="vanilla-item-icon tinted-item" style="--tint:#${i.potion.toString(16).padStart(6, "0")};--base:url('/media/1.7.10/items/potion_overlay.png')"><i></i><img src="/media/1.7.10/items/potion_bottle_drinkable.png" alt=""></span>`;
  // Animated strips (the compass) show their first frame.
  if (i.frames) return `<span class="vanilla-item-icon creative-strip" style="--strip:url('/media/1.7.10/${i.texture}.png');--frames:${i.frames}"></span>`;
  return `<img class="vanilla-item-icon" src="/media/1.7.10/${i.texture}.png" alt="">`;
}
// drawGuiContainerBackgroundLayer: unselected tabs, the tab background, search
// field and scrollbar, then the selected tab on top.
function renderCreativeBody() {
  const view = containerView,
    { gui, container } = view,
    selected = gui.tab,
    tabHtml = (t) => {
      const a = tabArea(t, t === selected);
      return `<button class="creative-tab${t === selected ? " selected" : ""}" data-creative-tab="${t.index}" aria-label="${esc(t.name)}" aria-pressed="${t === selected}" style="left:calc(${a.x}*var(--u));top:calc(${a.y}*var(--u));background-position:calc(${-a.u}*var(--u)) calc(${-a.v}*var(--u))!important"><span style="left:calc(${a.iconX - a.x}*var(--u));top:calc(${a.iconY - a.y}*var(--u))">${tabIcon(t)}</span></button>`;
    };
  $("#modal-title").textContent = selected.name;
  $("#modal-title").hidden = !selected.title;
  $("#modal .creative-body").innerHTML =
    CREATIVE_TABS.filter((t) => t !== selected).map(tabHtml).join("") +
    `<i class="creative-background" style="background-image:url('/media/1.7.10/gui/container/creative_inventory/tab_${selected.background}')"></i>` +
    (selected === SEARCH ? '<span class="creative-search" id="creative-search" role="textbox" aria-label="Search items"></span>' : "") +
    (selected.scrollbar ? '<i class="creative-scroll" id="creative-scroll"></i>' : "") +
    tabHtml(selected) +
    (selected === SURVIVAL_TAB ? '<div class="native-player creative-player" aria-hidden="true"><i class="player-head"></i><i class="player-body"></i><i class="player-arm left"></i><i class="player-arm right"></i><i class="player-leg left"></i><i class="player-leg right"></i></div>' : "") +
    slotsHtml(container);
  view.shown = [];
}
const CONTAINER_TITLES = { inventory: "Inventory", workbench: "Crafting", furnace: "Furnace", creative: "" },
  CONTAINER_CLASSES = { furnace: "furnace-modal", chest: "chest-modal", creative: "creative-modal" };
// Slots are addressed by list index: wrapped creative slots all keep slotNumber 0.
const slotsHtml = (container) => `<div class="container-slots">${container.slots.map((slot, i) => `<button class="container-slot" data-container-slot="${i}"${slot.type !== undefined ? ` data-armor="${["helmet", "chestplate", "leggings", "boots"][slot.type]}"` : ""}${slot.x < -1000 ? " hidden" : ""} style="left:calc(${slot.x}*var(--u));top:calc(${slot.y}*var(--u))"></button>`).join("")}</div>`;
function openContainer(container, kind, key = null, gui = new ContainerScreen(container)) {
  screen = "inventory";
  mining = null;
  mineHeld = false;
  const decorations =
    kind === "furnace"
      ? '<i class="furnace-flame" id="furnace-flame"></i><i class="furnace-arrow" id="furnace-arrow"></i>'
      : kind === "chest"
        ? '<i class="chest-bottom" aria-hidden="true"></i><span class="chest-bag-label">Inventory</span>'
        : `<span class="native-bag-label">Inventory</span><span class="native-crafting-label">Crafting</span>${kind === "inventory" ? '<div class="native-player" aria-hidden="true"><i class="player-head"></i><i class="player-body"></i><i class="player-arm left"></i><i class="player-arm right"></i><i class="player-leg left"></i><i class="player-leg right"></i></div>' : ""}`;
  modal(
    container.title ?? CONTAINER_TITLES[kind],
    kind === "creative" ? '<div class="creative-body"></div>' : slotsHtml(container) + decorations,
    CONTAINER_CLASSES[kind] ? `${CONTAINER_CLASSES[kind]} container-screen` : "inventory-modal native-inventory container-screen" + (kind === "workbench" ? " native-workbench" : ""),
  );
  if (kind === "chest") $("#modal .modal").style.setProperty("--rows", container.rows);
  $("#modal").insertAdjacentHTML("beforeend", '<div class="cursor-stack" id="cursor-stack" aria-hidden="true"></div><div class="slot-tooltip hidden" id="slot-tooltip" role="tooltip"></div>');
  document.activeElement?.blur();
  containerView = { container, gui, kind, key, hovered: null, x: innerWidth / 2, y: innerHeight / 2, gx: -1, gy: -1, shown: [] };
  const creative = kind === "creative",
    overlay = $("#modal"),
    javaButton = (b) => (b === 2 ? 1 : b === 1 ? 2 : b),
    // Pointer position in GUI pixels; creative tabs lie outside the 195 x 136 screen.
    at = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY),
        box = $("#modal .container-screen").getBoundingClientRect(),
        u = box.width / (creative ? GUI_WIDTH : 176),
        x = Math.floor((e.clientX - box.left) / u),
        y = Math.floor((e.clientY - box.top) / u);
      return { slot: container.slots[el?.closest("[data-container-slot]")?.dataset.containerSlot] ?? null, outside: creative ? x < 0 || y < 0 || e.clientX >= box.right || e.clientY >= box.bottom : !el?.closest(".container-screen"), x, y };
    },
    // GuiContainerCreative.mouseMovedOrUp: releasing the left button over a tab selects it.
    switchTab = (t) => {
      const before = gui.tab;
      gui.setTab(t);
      if (gui.tab !== before) renderCreativeBody();
    };
  if (creative) renderCreativeBody();
  overlay.onpointerdown = (e) => {
    if (!containerView || e.target.closest(".close-button")) return;
    e.preventDefault();
    const { slot, outside, x, y } = at(e), button = javaButton(e.button);
    if (creative && button === 0) {
      gui.press(x, y);
      if (gui.tabAt(x, y)) return refreshContainer();
    }
    gui.down(slot, button, { outside, shift: e.shiftKey, time: performance.now() });
    refreshContainer();
  };
  overlay.onpointermove = (e) => {
    if (!containerView) return;
    containerView.x = e.clientX;
    containerView.y = e.clientY;
    const { slot, x, y } = at(e);
    Object.assign(containerView, { hovered: slot, gx: x, gy: y });
    if (creative) {
      if (!(e.buttons & 1)) gui.release();
      gui.drag(y);
    }
    if (e.buttons) gui.move(slot);
    refreshContainer();
  };
  overlay.onpointerup = (e) => {
    if (!containerView) return;
    const { slot, outside, x, y } = at(e), button = javaButton(e.button), t = creative && button === 0 ? gui.tabAt(x, y) : null;
    if (creative && button === 0) gui.release();
    if (t) switchTab(t);
    else gui.up(slot, button, { outside, shift: e.shiftKey });
    refreshContainer();
  };
  overlay.onwheel = (e) => {
    if (!creative || !containerView) return;
    e.preventDefault();
    gui.wheel(-e.deltaY);
    refreshContainer();
  };
  overlay.oncontextmenu = (e) => e.preventDefault();
  // Keyboard activation of a focused slot or tab acts as a left click.
  overlay.onclick = (e) => {
    if (!containerView || e.detail !== 0) return;
    const tab = e.target.closest("[data-creative-tab]");
    if (creative && tab) return switchTab(CREATIVE_TABS[tab.dataset.creativeTab]), refreshContainer();
    const slot = container.slots[e.target.closest("[data-container-slot]")?.dataset.containerSlot];
    if (!slot) return;
    gui.down(slot, 0, { time: performance.now() });
    gui.up(slot, 0);
    refreshContainer();
  };
  refreshContainer();
}
function closeContainer() {
  if (!containerView) return;
  const { container } = containerView;
  containerView = null;
  const overlay = $("#modal");
  overlay.onpointerdown = overlay.onpointermove = overlay.onpointerup = overlay.onwheel = overlay.oncontextmenu = overlay.onclick = null;
  container.close();
  throwStacks(container.drops.splice(0));
  renderHotbar();
  saved = false;
}
// Draws every slot, the held stack and drag previews; only changed slots are rebuilt.
function refreshContainer() {
  if (!containerView) return;
  const view = containerView,
    { container, gui } = view,
    preview = gui.preview(),
    dragging = gui.dragging && gui.dragSlots.size > 1;
  container.slots.forEach((slot, i) => {
    const shown = preview.slots.get(slot) ?? slot.stack,
      over = preview.capped.has(slot),
      key = shown ? `${shown.id},${shown.count},${shown.damage},${over}` : "",
      b = document.querySelector(`[data-container-slot="${i}"]`);
    if (!b) return;
    b.classList.toggle("hovered", view.hovered === slot);
    b.classList.toggle("dragged", dragging && gui.dragSlots.has(slot));
    const label = stackLabel(slot.stack);
    if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
    if (view.shown[i] === key) return;
    view.shown[i] = key;
    b.innerHTML = stackHtml(shown);
    b.querySelector(".item-count")?.classList.toggle("full", over);
  });
  const bar = JSON.stringify(survival.inventory.main.slice(0, 9));
  if (view.hotbar !== bar) {
    view.hotbar = bar;
    renderHotbar();
  }
  const cursor = $("#cursor-stack"),
    held = preview.cursor;
  cursor.innerHTML = stackHtml(held);
  cursor.style.left = view.x + "px";
  cursor.style.top = view.y + "px";
  throwStacks(container.drops.splice(0));
  const tip = $("#slot-tooltip"),
    hovered = view.hovered?.stack;
  let lines = !container.inv.cursor && hovered ? tooltipLines(ITEMS[hovered.id], hovered, options.advancedTooltips) : [];
  if (view.kind === "creative") {
    // renderToolTip: the search tab names each item's own tab in bold blue.
    const own = hovered && gui.tab === SEARCH && itemTab(hovered.id);
    if (lines.length && own) lines.splice(1, 0, { text: own.name, color: "blue bold" });
    const label = gui.tabLabelAt(view.gx, view.gy);
    if (label) lines = [{ text: label.name }];
    else if (gui.overBin(view.gx, view.gy)) lines = [{ text: "Destroy Item" }];
    const scroll = $("#creative-scroll"), search = $("#creative-search");
    if (scroll) {
      scroll.style.top = `calc(${gui.scrollbarY()}*var(--u))`;
      scroll.classList.toggle("disabled", !gui.needsScroll());
    }
    const f = gui.field, typed = f.text + "\n" + f.cursor;
    if (search && search.dataset.typed !== typed) {
      const at = f.cursor === f.text.length;
      search.dataset.typed = typed;
      search.innerHTML = esc(f.text.slice(0, f.cursor)) + (at ? '<b class="caret end">_</b>' : '<b class="caret"></b>') + esc(f.text.slice(f.cursor));
      search.setAttribute("aria-label", "Search items: " + f.text);
    }
  }
  tip.classList.toggle("hidden", !lines.length);
  if (lines.length) {
    tip.innerHTML = lines.map((l, i) => `<span class="${i ? l.color || "gray" : "title"}">${esc(l.text) || "&nbsp;"}</span>`).join("");
    tip.style.left = view.x + "px";
    tip.style.top = view.y + "px";
  }
  if (view.kind === "furnace") {
    const f = survival.furnace(view.key),
      flame = f.burn > 0 ? Math.floor((f.burn * 13) / (f.burnTotal || 200)) : -1;
    $("#furnace-flame").style.setProperty("--flame", flame);
    $("#furnace-flame").hidden = flame < 0;
    $("#furnace-arrow").style.setProperty("--arrow", Math.floor((f.cook * 24) / 200) + 1);
  }
}
function renderVitals() {
  $('#experience-hud').classList.toggle('hidden',survival.creative);$('#experience-level').textContent=experience.level||'';$('#experience-fill').style.width=(experience.progress*100)+'%';$('#experience-hud').setAttribute('aria-label',`Experience level ${experience.level}, ${experience.points} of ${experience.level>=30?62+(experience.level-30)*7:experience.level>=15?17+(experience.level-15)*3:17} points`);
  $("#survival-hud").classList.toggle("hidden", survival.creative);
  if (survival.creative) return;
  const hearts = Array.from(
      { length: 10 },
      (_, i) =>
        `<span class="${survival.health > i * 2 + 1 ? "full" : survival.health > i * 2 ? "half" : "empty"}">♥</span>`,
    ).join(""),
    food = Array.from(
      { length: 10 },
      (_, i) =>
        `<span class="${survival.food > i * 2+1 ? "full" : survival.food>i*2?"half":"empty"}">◆</span>`,
    ).join(""),
    // GuiIngame: armor points above the hearts; air bubbles above hunger, with one popping.
    armor = survival.armorValue,
    armorRow = armor > 0 ? `<div class="armor-row" aria-label="Armor ${armor} of 20">${Array.from({ length: 10 }, (_, i) => `<span class="${i * 2 + 1 < armor ? "full" : i * 2 + 1 === armor ? "half" : "empty"}"></span>`).join("")}</div>` : "",
    bubbles = Math.max(0, Math.ceil(((survival.air - 2) * 10) / 300)),
    popping = Math.max(0, Math.ceil((survival.air * 10) / 300) - bubbles),
    air = survival.air < 300 ? `<div class="air" aria-label="Air ${Math.max(0, survival.air)} of 300">${"<span></span>".repeat(bubbles)}${'<span class="pop"></span>'.repeat(popping)}</div>` : "";
  $("#survival-hud").innerHTML =
    `<div class="vital-row"><div class="hearts" aria-label="Health ${Math.ceil(survival.health)} of 20">${hearts}</div><div class="hunger" aria-label="Hunger ${survival.food} of 20">${food}</div></div>${armorRow}${air}`;
  $("#damage-flash").classList.toggle("hurt", survival.hurtTicks > 4);
}
// EntityPlayer.dropOneItem / closing a screen with held items: thrown along
// the view with a 40-tick pickup delay.
function throwStacks(stacks) {
  if (!world) return;
  for (const s of stacks) if (s?.count > 0) items.dropPlayer(copyStack(s), position, yaw, pitch);
  saved = false;
}
function useFurnace(key) {
  openContainer(survival.openFurnace(key, smelted), "furnace", key);
}
// SlotFurnace.onCrafting: fractional experience rounds up by chance.
function smelted(stack, amount) {
  if (survival.creative) return;
  const f = SMELT_EXPERIENCE[stack.id] || 0;
  let n = amount;
  if (f === 0) n = 0;
  else if (f < 1) {
    const raw = Math.fround(amount * f);
    n = Math.floor(raw);
    if (n < Math.ceil(raw) && Math.random() < raw - n) n++;
  }
  xpOrbs.spawn(n, position);
}
// TileEntityChest.updateEntity for every chest with a moving or open lid.
function tickChests() {
  for (const [key, chest] of Object.entries(survival.chests)) {
    const [x, y, z] = key.split(",").map(Number);
    if (world.get(x, y, z) !== CHEST) {
      delete survival.chests[key];
      continue;
    }
    if (!chest.users && !chest.lid && !chest.prevLid) continue;
    const pair = chestPair(world, x, y, z),
      sound = tickLid(chest, pair.primary);
    if (sound) sounds.play(sound, { volume: 0.5, pitch: Math.random() * 0.1 + 0.9, position: { x: x + (pair.east ? 1 : 0.5), y: y + 0.5, z: z + (pair.south ? 1 : 0.5) } });
  }
  chestRenderer.sync(world, survival.chests);
  // Container.canInteractWith: the screen closes once its chest is gone.
  if (containerView?.kind === "chest" && containerView.container.keys.some((k) => world.get(...k.split(",").map(Number)) !== CHEST)) resume();
}
function updateFurnace() {
  if (containerView) refreshContainer();
}
function die() {
  if (screen === "dead") return;
  closeContainer();
  const reason = survival.lastDamage || "an accident";
  screen = "dead";
  keys.clear();
  mining = null;
  mineHeld = false;
  const stacks = survival.inventory.takeAll();
  // EntityPlayer.onDeath -> InventoryPlayer.dropAllItems scatters every stack.
  for (const s of stacks) items.dropPlayer(s, position, yaw, pitch, true, true);
  const deathScore=experience.score;xpOrbs.spawn(experience.death(),position);
  renderHotbar();renderVitals();$("#block-label").classList.remove("visible");
  save();
  modal(
    "You died!",
    `<p class="death-score">Score: <span>${deathScore}</span></p><div class="menu-actions"><button class="button primary full" id="respawn">Respawn</button><button class="button secondary full" id="death-home">Title screen</button></div>`,
    'death-modal',
  );
  $("#modal .close-button").hidden = true;
  const deathButtons=[$('#respawn'),$('#death-home')];for(const button of deathButtons)button.disabled=true;setTimeout(()=>{if(screen==='dead')for(const button of deathButtons)button.disabled=false;},1000);
  $("#respawn").onclick = () => {
    const time = survival.time;
    survival = new Survival({ time, slots: [], furnaces: survival.furnaces, chests: survival.chests }, "survival");
    experience=new Experience();
    position.copy(new THREE.Vector3(...Object.values(world.spawn())));
    previous.copy(position);
    playerBody.reset(position, yaw, pitch);
    velocity.set(0, 0, 0);
    fallDistance = 0;
    renderHotbar();
    renderVitals();
    resume();
    save();
  };
  $("#death-home").onclick = goHome;
}
function tickSurvival(inWater, oldPosition, inLavaNow = false) {
  const underwater =
    world.get(
      Math.floor(position.x),
      Math.floor(position.y + PHYSICS.eye),
      Math.floor(position.z),
    ) === 10;
  survival.tick({ underwater, inWater, inLava: inLavaNow });
  // Entity.onEntityUpdate: standing in lava halves the fall distance every tick.
  if (inLavaNow) fallDistance *= 0.5;
  if (!survival.creative) {
    const distance = Math.hypot(
      position.x - oldPosition.x,
      position.z - oldPosition.z,
    );
    survival.exhaust(distance * (inWater ? 0.015 : motion.sprinting ? 0.1 : 0.01));
  }
  // Entity.updateFallState: fallDistance grows while moving down in every mode (a
  // Creative player can land a critical hit), the damage is Survival only.
  if (!inWater && !flying)
    fallDistance += Math.max(0, oldPosition.y - position.y);
  if (grounded) {
    if (!survival.creative && fallDistance > 3)
      survival.damage(Math.ceil(fallDistance - 3), "a fall");
    fallDistance = 0;
  }
  if (inWater) fallDistance = 0;
  items.tick(world, (st) => survival.inventory.maxStack(st));
  if (survival.health > 0) {
    const picked = items.collect(position, PHYSICS.width, PHYSICS.height, (st) => survival.inventory.add(st));
    for (const { item } of picked) {
      sounds.play("random.pop", { volume: 0.2, pitch: ((Math.random() - Math.random()) * 0.7 + 1) * 2 });
      scene.drops.pickup(item, position);
      if (item.death && !items.items.some((e) => e.death)) toast("Recovered your dropped items.");
    }
    if (picked.length) {
      renderHotbar();
      saved = false;
    }
  }
  projectiles.tick(world, mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height), (e) => e !== "player" && thrownHit(mobs, e, position));
  // EntityEgg.onImpact: hatched chicks join the mob list.
  for (const h of projectiles.drain()) if (mobs) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
  if (mobs) handleEntityEvents();
  scene.setDrops(items.items);
  scene.setProjectiles(projectiles.balls, projectiles.particles);
  scene.setTime(survival.time);
  renderVitals();
  updateFurnace();
  if (survival.health <= 0 && !survival.creative) die();
}
function applyFarmUpdates(updates){const chunks=new Set();for(const[x,y,z]of updates)chunks.add([Math.floor(x/16)*16,Math.floor(z/16)*16].join(','));for(const key of chunks)scene.buildChunk(...key.split(',').map(Number));}
function handleEntityEvents() {
  for (const event of mobs.drain()) {
    if (event.sound)
      sounds.play(event.sound, { position: event.position, volume: event.volume ?? 0.6, pitch: event.pitch });
    if(event.xp&&!survival.creative)xpOrbs.spawn(event.xp,event.position);
    if(event.hearts)mobRenderer.hearts(event.position);
    if (event.drop) items.dropMob(event.drop, event.count, event.position, event.damage, event);
    // EntityAIEatGrass: Level event 2001 (block break sound and particles) for the
    // tall grass or the grass block that was eaten; the world edit is already made.
    if (event.eatGrass) {
      const { x, y, z, block } = event.eatGrass;
      scene.updateBlock(x, z, y);
      sounds.play("dig." + blockSound(block), { position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, volume: 1, pitch: 0.8 });
      scene.effects.burst([x, y, z], block);
      saved = false;
    }
  }
}
function beginEating(id) {
  if (survival.food >= 20) {
    toast("You are not hungry.");
    return;
  }
  if (survival.count(id) && !eating) eating = { id, ticks: 32 };
}
// ItemSnowball.onItemRightClick (aed.a): take one unless Creative, play
// random.bow at 0.5 volume and pitch 0.4 / (rand * 0.4 + 0.8), spawn the ball.
// Minecraft.rightClickMouse swings only for blocks that consume the click, and
// resets the equip animation (resetEquippedProgress2) only when the stack
// changed, so Creative throws neither swing nor dip the hand.
// ItemEgg.onItemRightClick (ack.a) is identical with an EntityEgg.
function throwSnowball(id = 312) {
  sounds.play("random.bow", { volume: 0.5, pitch: 0.4 / (Math.random() * 0.4 + 0.8) });
  if (id === 316) projectiles.throwEgg(position, yaw, pitch);
  else projectiles.throwSnowball(position, yaw, pitch);
  if (!survival.creative) {
    survival.take(id);
    animation.resetEquipped();
    renderHotbar();
    saved = false;
  }
}
// EntityCow.interact, ItemBucket.onItemRightClick and ItemBucketMilk.onItemRightClick.
function useBucketItem(id) {
  const before = copyStack(survival.held), drop = (s) => items.dropPlayer(s, position, yaw, pitch);
  let used = false;
  if (id === MILK_BUCKET) {
    // setItemInUse: always starts the 32-tick drink, even in Creative.
    if (!eating) eating = { id, ticks: DRINK_TICKS, drink: true };
    return;
  }
  if (aimedEntity?.entity.type === "cow" && aimedEntity.entity.health > 0 && milkCow(survival, { drop })) used = true;
  else if (eyeRay) {
    const hit = useBucket(world, survival, eyeRay.origin, eyeRay.dir, {
      drop,
      // World.func_147480_a: the replaced plant breaks with its drops, sound and particles.
      destroy: (x, y, z, b) => {
        fluids.wash(x, y, z, b);
        scene.effects.burst([x, y, z], b);
        sound(false, b);
      },
    });
    if (hit) {
      used = true;
      for (const [x, y, z] of hit.cells) scene.updateBlock(x, z, y);
    }
  }
  if (!used) return;
  // PlayerControllerMP.sendUseItem resets the equip animation when the stack changed.
  const now = survival.held;
  if (before?.id !== now?.id || before?.count !== now?.count) animation.resetEquipped();
  renderHotbar();
  saved = false;
}
function edit(place = false) {
  if (screen !== "playing") return;
  sounds.unlock();
  const id = heldId(),
    item = ITEMS[id];
  // PlayerControllerMP.onPlayerRightClick: onBlockActivated only runs unless the player is
  // sneaking with an item in hand, otherwise the click places/uses the item against the block.
  const activates = !(motion.sneaking && id);
  // A snowball in hand is thrown unless the aimed block takes the click first.
  const usesBlock = activates && !aimedEntity && target && [13, 14, CHEST].includes(world.get(...target.block));
  if (place && (id === 312 || id === 316) && (survival.creative || survival.count(id)) && !usesBlock) {
    throwSnowball(id);
    return;
  }
  // ItemBucket / ItemBucketMilk: Minecraft.rightClickMouse tries the aimed entity (a cow
  // takes an empty bucket) and block first, then onItemRightClick; neither swings.
  if (place && isBucket(item) && !usesBlock) {
    useBucketItem(id);
    return;
  }
  animation.swing();
  if (!place && aimedEntity) {
    mining = null;
    // attackTargetEntityWithCurrentItem: sprinting adds one knockback level, a falling
    // player (fallDistance > 0, airborne, not in water) lands a 1.5x critical.
    const critical = isCritical({ fallDistance, onGround: grounded, inWater: wasInWater });
    if (mobs.attack(aimedEntity.entity, id, survival, { x: position.x, z: position.z, yaw }, motion.sprinting ? 1 : 0, critical)) {
      if (motion.sprinting) {
        velocity.x *= ATTACK_SLOWDOWN;
        velocity.z *= ATTACK_SLOWDOWN;
        motion.sprinting = false;
      }
      handleEntityEvents();
      renderHotbar();
      saved = false;
    }
    return;
  }
  if(place&&aimedEntity){if(mobs.shear(aimedEntity.entity,id,survival)){handleEntityEvents();renderHotbar();saved=false;return;}if(mobs.feed(aimedEntity.entity,id,survival)){handleEntityEvents();renderHotbar();saved=false;}else if(mobs.dye(aimedEntity.entity,survival.held,survival)){handleEntityEvents();renderHotbar();saved=false;}else if(!survival.creative&&item?.food)beginEating(id);return;}
  // ItemArmor.onItemRightClick: equip into an empty armor slot.
  if (place && item?.armor !== undefined) {
    const inv = survival.inventory, slot = 39 - item.armor;
    if (!inv.getStack(slot)) {
      inv.setStack(slot, copyStack(inv.held));
      inv.main[inv.current] = null;
      renderHotbar();
      renderVitals();
      saved = false;
    }
    return;
  }
  if (!target) {
    if (place && !survival.creative && item?.food) beginEating(id);
    return;
  }
  const block = world.get(...target.block);
  if (place) {
    const [x,y,z]=target.block;
    if(item?.kind==='hoe'){
      if(!survival.creative&&!survival.count(id)){toast('Craft a hoe first.');return;}
      if(target.adjacent?.[1]!==y-1&&farming.till(x,y,z)){survival.wear(id);applyFarmUpdates(farming.drain());renderHotbar();sounds.play('step.gravel',{volume:.7});saved=false;}return;
    }
    if(id===309){if((survival.creative||survival.count(id))&&target.adjacent?.[1]===y+1&&farming.plant(x,y,z)){if(!survival.creative)survival.take(id);applyFarmUpdates(farming.drain());renderHotbar();saved=false;}return;}
    // ItemDye.onItemUse: damage 15 (bone meal) fertilizes crops (Farming) and grass (BlockGrass.func_149853_b).
    if(id===DYE&&survival.held?.damage===15){
      if(!survival.creative&&!survival.count(id))return;
      let used=false;
      if(block===1){for(const q of growGrass(world,FLOWERS,boneRandom,world.biome,x,y,z))scene.updateBlock(q[0],q[2],q[1]);used=true;}
      else if(farming.fertilize(x,y,z)){applyFarmUpdates(farming.drain());used=true;}
      if(used){if(!survival.creative)survival.inventory.decr(survival.inventory.current,1);renderHotbar();sounds.play('dig.grass',{volume:.4});saved=false;}
      return;
    }

    if (activates && block === 13) {
      inventory(true);
      return;
    }
    if (activates && block === 14) {
      useFurnace(target.block.join(","));
      return;
    }
    if (activates && block === CHEST) {
      const chest = survival.openChest(world, ...target.block);
      if (chest) openContainer(chest, "chest", target.block.join(","));
      return;
    }
    if (!survival.creative && item?.food) {
      beginEating(id);
      return;
    }
    const p = target.adjacent;
    if (!p || p[1] === 0 || p[1] >= HEIGHT - 1 || !world.inside(...p)) return;
    if (!item?.block || isLiquid(id)) {
      toast("Select a building block, food, or workstation.");
      return;
    }
    if (!survival.creative && !survival.count(id)) {
      toast("Gather this material first.");
      return;
    }
    if (id === CHEST && !canPlaceChest(world, ...p)) return;
    // BlockBush.canPlaceBlockAt: grass, dirt or farmland below, and enough light.
    if (isFlower(id) && !flowerCanStay(world, FLOWERS, ...p)) return;
    const old = world.get(...p), oldMeta = world.getMeta(...p),
      meta = id === WOOL || id === RED_FLOWER ? survival.held?.damage || 0 : 0;
    world.set(...p, id, false, meta);
    if (collides(world, ...position.toArray())) {
      world.set(...p, old, false, oldMeta);
      toast("Give yourself a little room to build.");
      return;
    }
    world.set(...p, id, true, meta);
    if (id === CHEST) placeChest(world, survival.chests, ...p, yaw);
    farming.observe(...p);
    if (!survival.creative) survival.take(id);
    scene.updateBlock(p[0], p[2], p[1]);
    renderHotbar();
    sound(true, id);
    saved = false;
  } else {
    // Creative breaks bedrock (Building Blocks lists it), except the world floor.
    if (block === 11 && (!survival.creative || target.block[1] === 0)) return;
    if (survival.creative) {
      if(item?.kind==='sword')return;
      breakBlock(target.block, true);
      mineCooldown = 5;
      return;
    }
    if(mining&&mining.tool===id&&mining.block.every((v,i)=>v===target.block[i]))return;
    const under=world.get(Math.floor(position.x),Math.floor(position.y+PHYSICS.eye),Math.floor(position.z))===10;
    if(survival.mining(block,id,under,grounded).progress>=1){breakBlock(target.block);return;}
    mining = {
      block: [...target.block],
      type: block,
      progress: 0,
      tool: id,
      auto: !mineHeld,
    };
  }
}
function breakBlock(p, creative = false) {
  const block = world.get(...p),
    key = p.join(","),
    m = MATERIALS[block] || {},
    tool = heldId();
  if (!block || (block === 11 && (!creative || p[1] === 0))) return false;
  const harvest = creative || survival.mining(block, tool).harvest;
  let drop = harvest ? (m.drop ?? block) : 0,
    count = m.count || 1;
  if (block === 5 && Math.random() < 0.005) drop = 200;
  const shearing=ITEMS[tool]?.kind==='shears'&&survival.count(tool)>0;
  if(shearing&&(block===5||block===39)){drop=block;count=1;}
  if(block===25&&Math.random()<.1){drop=313;count=1;}
  const crops=shearing&&block===39?null:cropDrops(block);const drops=crops??(drop?[{id:drop,count}]:[]);
  const f = survival.furnaces[key],
    chest = survival.chests[key],
    meta = world.getMeta(...p);
  if (!world.set(...p, 0)) return false;
  farming.observe(...p);
  const at = { x: p[0] + 0.5, y: p[1] + 0.1, z: p[2] + 0.5 };
  // BlockFurnace.breakBlock spills its contents whatever the game mode.
  if (f) {
    items.spill(f.items.filter(Boolean), ...p);
    delete survival.furnaces[key];
  }
  // BlockChest.breakBlock spills the contents on the ground in any mode.
  if (chest) {
    const stacks = chest.items.filter(Boolean).map(copyStack);
    items.spill(stacks, ...p);
    delete survival.chests[key];
  }
  if (!creative) {
    items.dropBlock(drops.map((d) => makeStack(d.id, d.count, d.id === block && (block === WOOL || block === RED_FLOWER) ? meta : 0)), ...p);
    if(drop)xpOrbs.spawn(oreExperience(block),at);
    survival.exhaust(0.025);
    survival.wearBlock(block,tool);
  }
  scene.updateBlock(p[0], p[2], p[1]);
  renderHotbar();
  sound(false, block);
  scene.effects.burst(p, block);
  saved = false;
  return true;
}
// Block.getItem for middle-click: farmland gives dirt, crops give seeds, water nothing.
const pickItem = (block) => (block === 29 || block === 30 ? 2 : block >= 31 && block <= 38 ? 309 : !isLiquid(block) && ITEMS[block] ? block : 0);
// EntityPlayer.dropOneItem: Q throws one item, Ctrl + Q the whole stack.
function dropHeld(all) {
  const inv = survival.inventory, s = inv.held;
  if (!s) return;
  throwStacks([inv.decr(inv.current, all ? s.count : 1)]);
  eating = null;
  renderHotbar();
}
// EntityLivingBase.renderBrokenItemStack plays the break sound.
function reportBrokenTool() {
  if (!survival.broken) return;
  sounds.play("random.break", { volume: 0.8, pitch: 0.8 + Math.random() * 0.4 });
  toast("Your " + (ITEMS[survival.broken]?.name || "tool").toLowerCase() + " broke.");
  survival.broken = 0;
  renderHotbar();
}
function tickMining() {
  if (screen !== "playing") return;
  if (mineCooldown > 0) {
    mineCooldown--;
    return;
  }
  if (aimedEntity) {mining=null;return;}
  if (!mining && mineHeld && target) edit(false);
  if (!mining) return;
  if (
    !target ||
    !target.block.every((v, i) => v === mining.block[i]) ||
    world.get(...mining.block) !== mining.type ||
    heldId() !== mining.tool ||
    (!mining.auto && !mineHeld)
  ) {
    mining = null;
    return;
  }
  const under =
    world.get(
      Math.floor(position.x),
      Math.floor(position.y + PHYSICS.eye),
      Math.floor(position.z),
    ) === 10;
  animation.swing();
  if (survival.time % 4 === 0) {
    sounds.play("dig." + blockSound(mining.type), { volume: 0.25, pitch: 0.5 });
    scene.effects.burst(mining.block, mining.type, 2);
  }
  mining.progress = Math.fround(mining.progress + survival.mining(
    mining.type,
    heldId(),
    under,
    grounded,
  ).progress);
  if (mining.progress >= 1) {
    const p = [...mining.block];
    mining = null;
    breakBlock(p);
    mineCooldown = 5;
  }
}
function movementTick() {
  previous.copy(position);
  // MovementInputFromOptions + EntityPlayerSP.onLivingUpdate: sneak scales input by 0.3 and
  // sprinting needs forward input >= 0.8, so sneaking ends a sprint (player-movement.js).
  const sneak = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const input = motion.update(
    {
      forward: (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      strafe: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      sneak,
    },
    {
      onGround: grounded,
      collidedH,
      canSprint: survival.creative || survival.food > 6,
      usingItem: !!eating,
      sprintKey: keys.has("ControlLeft") || keys.has("ControlRight"),
    },
  );
  const sprint = motion.sprinting;
  // Entity.moveEntity: a sneaking player on the ground takes no step sounds or walked distance.
  const sneakOnGround = sneak && grounded;
  walkFrozen = sneakOnGround;
  const oldPosition = position.clone();
  const { strafe: dx, forward: dz } = moveWeights(input);
  const inWater =
    world.get(
      Math.floor(position.x),
      Math.floor(position.y + 0.6),
      Math.floor(position.z),
    ) === 10;
  // Entity.handleLavaMovement (sa.P) on the player's box; EntityLivingBase.
  // moveEntityWithHeading only takes the lava branch outside water.
  const playerBox = (dy = 0) => {
    const r = PHYSICS.width / 2;
    return [position.x - r, position.y + dy, position.z - r, position.x + r, position.y + dy + PHYSICS.height, position.z + r];
  };
  const inLavaNow = inLava(world, playerBox()),
    lava = inLavaNow && !inWater && !flying;
  if (flying) {
    const speed = sprint ? 0.8 : 0.42;
    velocity.x = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * speed;
    velocity.z = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) * speed;
    velocity.y =
      ((keys.has("Space") ? 1 : 0) - (sneak ? 1 : 0)) *
      speed;
  } else {
    // Entity.handleWaterMovement: running water pushes the player along.
    const r = PHYSICS.width / 2,
      { push } = waterAcceleration(world, entityWaterBox([position.x - r, position.y, position.z - r, position.x + r, position.y + PHYSICS.height, position.z + r]));
    velocity.x += push[0];
    velocity.y += push[1];
    velocity.z += push[2];
    const friction = grounded
      ? Math.fround(0.6) * Math.fround(0.91)
      : Math.fround(0.91);
    const accel =
      (grounded
        ? (0.1 * 0.16277136) / (friction * friction * friction)
        : 0.02) * (sprint ? 1.3 : 1);
    // moveFlying(strafe, forward, 0.02f) in lava, whatever the ground or sprint.
    const accelNow = lava ? 0.02 : accel;
    velocity.x += (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * accelNow;
    velocity.z += (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) * accelNow;
    if (keys.has("Space") && grounded && !lava) {
      velocity.y = PHYSICS.jump;
      survival.exhaust(sprint ? 0.8 : 0.2);
      grounded = false;
      if (sprint) {
        velocity.x -= Math.sin(yaw) * 0.2;
        velocity.z -= Math.cos(yaw) * 0.2;
      }
    }
    if (inWater && keys.has("Space"))
      velocity.y = Math.min(0.16, velocity.y + 0.06);
    // EntityLivingBase.onLivingUpdate: jumping in lava pushes up by 0.04.
    else if (lava && keys.has("Space")) velocity.y += 0.04;
  }
  let landed = false;
  collidedH = false;
  // Entity.moveEntity's sneak edge loop shortens this tick's x/z move, not the motion.
  const moves = { x: velocity.x, y: velocity.y, z: velocity.z };
  if (sneakOnGround)
    [moves.x, moves.z] = sneakEdge(moves.x, moves.z, (ox, oz) => !collides(world, position.x + ox, position.y - 1, position.z + oz));
  for (const axis of ["y", "x", "z"]) {
    const delta = moves[axis],
      substeps = Math.max(1, Math.ceil(Math.abs(delta) / 0.2));
    for (let i = 0; i < substeps; i++) {
      const before = position[axis];
      position[axis] += delta / substeps;
      position.x = Math.max(0.31, Math.min(SIZE - 0.31, position.x));
      position.z = Math.max(0.31, Math.min(SIZE - 0.31, position.z));
      if (collides(world, ...position.toArray())) {
        position[axis] = before;
        let low = 0,
          high = Math.abs(delta / substeps);
        for (let k = 0; k < 12; k++) {
          const mid = (low + high) / 2;
          position[axis] = before + Math.sign(delta) * mid;
          if (collides(world, ...position.toArray())) high = mid;
          else low = mid;
        }
        position[axis] = before + Math.sign(delta) * low;
        velocity[axis] = 0;
        if (axis !== "y") collidedH = true;
        if (axis === "y" && delta < 0) landed = true;
        break;
      }
    }
  }
  grounded =
    landed || collides(world, position.x, position.y - 0.001, position.z);
  motion.endMove();
  if (!flying) {
    velocity.y = lava
      ? velocity.y * 0.5 - 0.02
      : inWater
      ? (velocity.y - 0.02) * 0.8
      : fallingVelocity(velocity.y);
    const f = lava
      ? 0.5
      : inWater
      ? 0.8
      : grounded
        ? Math.fround(Math.fround(0.6) * Math.fround(0.91))
        : Math.fround(0.91);
    velocity.x *= f;
    velocity.z *= f;
    if (Math.abs(velocity.x) < 0.005) velocity.x = 0;
    if (Math.abs(velocity.z) < 0.005) velocity.z = 0;
    if (lava) {
      // Step out of lava: pushed up 0.3 when blocked and the spot 0.6 higher is
      // clear of blocks and liquid (Entity.isOffsetPositionInLiquid).
      if (collidedH) {
        const dy = velocity.y + 0.6 - (position.y - oldPosition.y), moved = playerBox(dy);
        moved[0] += velocity.x; moved[3] += velocity.x; moved[2] += velocity.z; moved[5] += velocity.z;
        const clear = !collides(world, position.x + velocity.x, position.y + dy, position.z + velocity.z) && !liquidInBox(world, moved, 10) && !liquidInBox(world, moved, 42);
        if (clear) velocity.y = 0.30000001192092896;
      }
    }
  }
  if (position.y < 1 || position.y > HEIGHT + 40) {
    position.copy(new THREE.Vector3(...Object.values(world.spawn())));
    previous.copy(position);
    velocity.set(0, 0, 0);
    toast("Back on solid ground.");
  }
  $("#movement-label").textContent = flying
    ? "FLYING"
    : inWater
      ? "SWIMMING"
      : "WALKING";
  const beforeHealth = survival.health;
  tickSurvival(inWater, oldPosition, inLavaNow);
  applyFarmUpdates(farming.tick(survival.time,scene.daylight));
  if(fluids)scene.updateBlocks(fluids.tick());
  scene.setFurnaces(survival.furnaces);
  tickChests();
  mobs.tick(position, survival, heldId());
  const oldLevel=experience.level;if(survival.health>0&&!survival.creative&&xpOrbs.tick(world,position,experience)){sounds.play(experience.level>oldLevel&&experience.level%5===0?"random.levelup":"random.orb",{volume:.4});renderVitals();}
  handleEntityEvents();
  const distance = Math.hypot(
    position.x - oldPosition.x,
    position.z - oldPosition.z,
  );
  if (!sneakOnGround) stepDistance += distance;
  if (inWater && !wasInWater)
    sounds.play("game.player.swim.splash", { volume: 0.5 });
  wasInWater = inWater;
  if (stepDistance > 1.667 && (grounded || inWater) && !flying) {
    stepDistance = 0;
    const b = world.get(
      Math.floor(position.x),
      Math.floor(position.y - 0.05),
      Math.floor(position.z),
    );
    sounds.play(inWater ? "game.player.swim" : "step." + blockSound(b), {
      volume: inWater ? 0.3 : 0.22,
    });
  }
  if (survival.health < beforeHealth)
    sounds.play("game.player.hurt", { volume: 0.8 });
  if (eating) {
    if (heldId() !== eating.id)
      eating = null;
    else {
      eating.ticks--;
      if (!eating.drink && eating.ticks % 4 === 0)
        sounds.play("random.eat", {
          volume: 0.5,
          pitch: 0.9 + Math.random() * 0.2,
        });
      if (eating.drink) {
        // EntityPlayer.onUpdate: sound while the count is 25 or less and a multiple of 4
        // (count 32 down to 1), then ItemBucketMilk.onEaten when it reaches 0.
        const count = eating.ticks + 1;
        if (count <= 25 && count % 4 === 0) sounds.play("random.drink", { volume: 0.5, pitch: Math.random() * 0.1 + 0.9 });
        if (eating.ticks <= 0) {
          if (finishDrinking(survival)) { renderHotbar(); saved = false; }
          eating = null;
        }
      } else if (eating.ticks <= 0) {
        if (survival.eat(eating.id)) {
          sounds.play("random.burp", { volume: 0.5 });
          renderHotbar();
        }
        eating = null;
      }
    }
  }
  if (survival.health <= 0 && !survival.creative) die();
  tickMining();
  reportBrokenTool();
}
function bindActions() {
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        ({
          settings,
          controls,
          notes,
          create: createWorld,
          home: () => {
            if (screen !== "home") goHome();
            else closeModal();
          },
        })[b.dataset.action]?.();
      }),
  );
}
$("#enter").onclick = () => $("#home").classList.add("selecting");
$("#world-select-back").onclick = () => $("#home").classList.remove("selecting");
$("#pause-button").onclick = pause;
$("#fullscreen").onclick = () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else
      document.documentElement
        .requestFullscreen()
        .catch(() => toast("Fullscreen is unavailable in this browser."));
  } catch {
    toast("Fullscreen is unavailable in this browser.");
  }
};
$("#import").onclick = () => $("#file-input").click();
$("#file-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error("File is too large");
    const data = JSON.parse(await file.text());
    if (
      data.format !== "blockworld" ||
      data.version !== 1 ||
      typeof data.name !== "string" ||
      typeof data.seed !== "string" ||
      !["meadow", "alpine", "island"].includes(data.biome)
    )
      throw new Error("Choose a Blockworld export file");
    const check = new World(data.seed, data.biome, data.generationVersion ?? 1);
    check.restore(data.edits);
    const record = {
      ...makeRecord(data),
      edits: [...check.edits],
      position: data.position,
      generationVersion: data.generationVersion ?? 1,
      mode: data.mode === "survival" ? "survival" : "creative",
      player: new Survival(legacyPlayer(data), data.mode).serialize(),
      drops: data.drops,
      entities: data.entities,
      farms:data.farms,
      experience:data.experience,xpOrbs:data.xpOrbs,
    };
    worlds.unshift(record);
    persist();
    renderWorlds();
    toast("World imported.");
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
};

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (screen === "dead") return;
    if (screen === "inventory") resume();
    else if (screen === "playing") pause();
    else if (screen === "paused") {
      if ($("#resume")) resume();
      else pause();
    } else closeModal();
    return;
  }
  if (e.target.matches("input,select,textarea")) return;
  // GuiContainerCreative.keyTyped: T opens search; the search field takes keys before E and Q.
  if (screen === "inventory" && containerView?.kind === "creative") {
    const gui = containerView.gui, before = gui.tab;
    if (gui.typed({ code: e.code, key: e.key, ctrl: e.ctrlKey || e.metaKey }, containerView.hovered)) {
      e.preventDefault();
      if (gui.tab !== before) renderCreativeBody();
      refreshContainer();
      return;
    }
  }
  if (screen === "inventory" && e.code === "KeyE") {
    e.preventDefault();
    resume();
    return;
  }
  // GuiContainer.keyTyped: hotbar keys and Q act on the hovered slot.
  if (screen === "inventory" && containerView) {
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) containerView.gui.hotbarKey(containerView.hovered, +digit[1] - 1);
    if (e.code === "KeyQ") containerView.gui.dropKey(containerView.hovered, e.ctrlKey);
    if (digit || e.code === "KeyQ") {
      e.preventDefault();
      refreshContainer();
    }
    return;
  }
  if (screen !== "playing") return;
  if (["Space", "Tab", "KeyW", "KeyA", "KeyS", "KeyD", "F3", "F5"].includes(e.code))
    e.preventDefault();
  if (e.code === "F5" && !e.repeat) thirdPersonView = nextView(thirdPersonView);
  if (e.code === "KeyE" && !e.repeat) {
    inventory();
    return;
  }
  if (e.code === "F3" && !e.repeat) f3Combo = false;
  // F3 + H toggles advanced tooltips (durability) instead of the debug screen.
  if (e.code === "KeyH" && keys.has("F3") && !e.repeat) {
    f3Combo = true;
    options.advancedTooltips = !options.advancedTooltips;
    try {
      localStorage.setItem("blockworld.settings", JSON.stringify(options));
    } catch {}
    toast("Advanced tooltips: " + (options.advancedTooltips ? "shown" : "hidden"));
  }
  if (e.code === "KeyQ" && !e.repeat) dropHeld(e.ctrlKey);
  if (
    e.code.startsWith("Digit") &&
    +e.code.slice(5) >= 1 &&
    +e.code.slice(5) <= 9
  )
    selectSlot(+e.code.slice(5) - 1);
  if (e.code === "Space" && !e.repeat && survival.creative) {
    if (performance.now() - lastJump < 280) {
      flying = !flying;
      velocity.y = 0;
      lastJump = 0;
      toast(
        flying ? "Flight enabled · Space up · Shift down" : "Back to walking",
      );
    } else lastJump = performance.now();
  }
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  if (e.code === "F3" && keys.has("F3") && !f3Combo && screen === "playing") {
    debug = !debug;
    $("#debug").classList.toggle("hidden", !debug);
  }
  keys.delete(e.code);
});
window.addEventListener("blur", () => {
  keys.clear();
  if (screen === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "playing") pause();
});
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && screen === "playing" && !lockFallback)
    pause();
});
window.addEventListener("beforeunload", () => {
  if (active) save();
});
window.addEventListener(
  "wheel",
  (e) => {
    if (screen === "playing") {
      e.preventDefault();
      selectSlot(survival.inventory.current + (e.deltaY > 0 ? 1 : -1));
    }
  },
  { passive: false },
);
document.querySelectorAll("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    keys.add(b.dataset.key);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.key);
});
$("#touch-break").onclick = () => edit(false);
$("#touch-place").onclick = () => edit(true);
$("#touch-inventory").onclick = () => inventory();
$("#touch-fly").onclick = () => {
  if (survival.creative) {
    flying = !flying;
    velocity.y = 0;
    toast(flying ? "Flight enabled" : "Back to walking");
  }
};
function setupPointer() {
  const canvas = scene.renderer.domElement;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (screen !== "playing") return;
    if (e.button === 2) {
      edit(true);
      return;
    }
    if (e.button === 1) {
      const id = target && pickItem(world.get(...target.block));
      if (id) {
        survival.inventory.pick(id, survival.creative, id === WOOL || id === RED_FLOWER ? world.getMeta(...target.block) : undefined);
        mining = null;
        eating = null;
        renderHotbar();
        showHeldName();
      }
      return;
    }
    if (document.pointerLockElement === canvas) {
      mineHeld = true;
      edit(false);
      return;
    }
    if (!lockFallback && e.pointerType !== "touch") {
      requestLock();
      return;
    }
    dragging = true;
    dragDistance = 0;
    pointerX = e.clientX;
    pointerY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (dragging && dragDistance < 5 && e.pointerType !== "touch") edit(false);
    dragging = false;
    mineHeld = false;
    if (mining && !mining.auto) mining = null;
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
    mineHeld = false;
    mining = null;
  });
  window.addEventListener("pointermove", (e) => {
    if (screen !== "playing") return;
    if (document.pointerLockElement === canvas || dragging) {
      const dx =
          document.pointerLockElement === canvas
            ? e.movementX
            : e.clientX - pointerX,
        dy =
          document.pointerLockElement === canvas
            ? e.movementY
            : e.clientY - pointerY;
      pointerX = e.clientX;
      pointerY = e.clientY;
      yaw -= dx * 0.002 * options.sensitivity;
      pitch = Math.max(
        -1.55,
        Math.min(1.55, pitch - dy * 0.002 * options.sensitivity),
      );
      dragDistance += Math.abs(dx) + Math.abs(dy);
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || $("#modal").classList.contains("hidden")) return;
  const focusable = [
    ...$("#modal").querySelectorAll("button,a,input,select"),
  ].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrame) / 1000, 0.15);
  lastFrame = now;
  if (document.hidden) return;
  elapsed += dt;
  frames++;
  if (elapsed - fpsTime > 1) {
    fps = frames;
    frames = 0;
    fpsTime = elapsed;
  }
  if (screen === "playing" || screen === "inventory") {
    accumulator += dt;
    while (
      accumulator >= PHYSICS.tick &&
      (screen === "playing" || screen === "inventory")
    ) {
      movementTick();
      // The model stands at posY - yOffset, and posY is lowered by ySize (the sneak drop).
      const lowered = (p, drop) => ({ x: p.x, y: p.y - drop, z: p.z });
      playerBody.tick({ position: lowered(position, motion.ySize), previous: lowered(previous, motion.prevYSize), yaw, pitch, swinging: animation.swingTime < SWING_SECONDS });
      accumulator -= PHYSICS.tick;
    }
    const t = accumulator / PHYSICS.tick;
    scene.camera.position.lerpVectors(previous, position, t);
    // Entity.posY = minY + yOffset - ySize: sneaking lowers the eye by 0.08 (interpolated).
    scene.camera.position.y += PHYSICS.eye - motion.drop(t);
    const pose = animation.frame(dt, {
      item: heldId(),
      yaw, pitch,
      speed: Math.hypot(velocity.x, velocity.z),
      moving: keys.size > 0,
      grounded: grounded && !flying,
      bobbing: options.bobbing,
      // distanceWalkedModified does not advance while sneaking on the ground.
      freezeWalk: walkFrozen,
    });
    // The held wool's colour (stack damage) rides along with the displayed item.
    pose.meta = pose.item === WOOL || pose.item === RED_FLOWER || pose.item === DYE ? survival.held?.damage || 0 : 0;
    const b = pose.bob;
    scene.camera.position.x += b.x * Math.cos(yaw);
    scene.camera.position.z -= b.x * Math.sin(yaw);
    scene.camera.position.y += b.y;
    const hurt =
      (Math.sin(Math.pow(survival.hurtTicks / 10, 4) * Math.PI) *
        14 *
        Math.PI) /
      180;
    scene.camera.rotation.set(pitch + b.rx, yaw, b.rz - hurt, "YXZ");
    animate.pose = pose;
    const dir = new THREE.Vector3();
    scene.camera.getWorldDirection(dir);
    // Mining and picking start at the player's eye in every view.
    const aim = scene.camera.position.clone();
    if (thirdPersonView) {
      // EntityRenderer.orientCamera: back off from the eye, pulled in by the world.
      const cam = thirdPersonCamera(world, aim, yaw, pitch, thirdPersonView);
      scene.camera.position.set(...cam.position);
      scene.camera.rotation.set(cam.rotation.x + (thirdPersonView === 2 ? -b.rx : b.rx), cam.rotation.y, b.rz - hurt, "YXZ");
    }
    target = raycast(
      world,
      aim,
      dir,
      survival.creative ? 6 : 4.5,
    );
    eyeRay = { origin: [aim.x, aim.y, aim.z], dir: [dir.x, dir.y, dir.z] };
    aimedEntity = mobs.pick(
      aim,
      dir,
      survival.creative ? 5 : 3,
      target?.distance ?? 6,
    );
    scene.outline.visible = !!target && !aimedEntity;
    if (target) scene.outline.position.set(...target.block.map((v) => v + 0.5));
    $("#mining-meter").classList.toggle("hidden", !mining);
    if (mining) {
      $("#mining-meter").setAttribute(
        "aria-valuenow",
        String(Math.round(mining.progress * 100)),
      );
      $("#mining-meter i").style.width =
        Math.min(100, mining.progress * 100) + "%";
    }
    if (debug)
      $("#debug").textContent =
        `BLOCKWORLD / Java 1.7.10 study\n${fps} FPS · ${(scene.worldTriangles || 0).toLocaleString()} triangles\nXYZ: ${position.x.toFixed(2)} / ${position.y.toFixed(2)} / ${position.z.toFixed(2)}\nSeed: ${active.seed}\n${survival.mode} · day ${Math.floor(survival.time / 24000) + 1} · ${survival.time % 24000} ticks\nHealth ${survival.health} · food ${survival.food} · saturation ${survival.saturation.toFixed(1)}\n${world.edits.size} edited blocks · ${items.items.length} items · ${mobs?.entities.length || 0} mobs\n${aimedEntity ? aimedEntity.entity.type + " · " + aimedEntity.entity.health + " health" : target ? BLOCKS[world.get(...target.block)].name : "Looking into the distance"}`;
    if (elapsed - lastSave > 5) save();
    scene.effects.crack(mining?.block, mining?.progress);
  } else if (screen === "home") scene.preview(elapsed);
  const partial = Math.min(1, accumulator / PHYSICS.tick);
  if (mobs) mobRenderer.update(mobs.entities,dt,partial);
  playerRenderer?.update(playerBody, partial, {
    visible: thirdPersonView > 0 && ["playing", "inventory", "paused"].includes(screen),
    swing: animate.pose ? (animate.pose.progress < 1 ? animate.pose.progress : 0) : 0,
    armor: survival?.inventory?.armor ?? [],
    held: heldId(),
    heldDamage: survival.held?.damage || 0,
    hurt: survival.hurtTicks > 0,
    sneak: motion.sneaking,
  });
  chestRenderer?.update(screen === "playing" || screen === "inventory" ? accumulator / PHYSICS.tick : 1);
  if(xpRenderer)xpRenderer.update(xpOrbs.orbs,partial);
  scene.dropPartial = partial;
  scene.setShadows(screen === "home" ? [] : shadowCasters(scene.dropPartial), { x: position.x, y: position.y + PHYSICS.eye, z: position.z });
  scene.render(elapsed, dt);
  if (firstPerson && animate.pose)
    firstPerson.render(animate.pose, {
      visible: thirdPersonView === 0 && ["playing", "inventory", "paused"].includes(screen),
      light: scene.brightness(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z),
      view: scene.camera,
      time: elapsed,
      eating: eating ? Math.max(0,eating.ticks-accumulator/PHYSICS.tick) : null,
    });
}
// Entities that cast a shadow, as Java positions: an item's posY is 0.125
// above its box (yOffset); items, orbs and mobs are interpolated like their
// renderers, with `pos` the tick position for the shadow's distance test.
function shadowCasters(partial) {
  const list = [], lerp = (a, b) => a + (b - a) * partial;
  for (const e of items.items)
    if (e.stack) list.push({ ...SHADOWS.item, x: lerp(e.px, e.x), y: lerp(e.py, e.y) + 0.125, z: lerp(e.pz, e.z), pos: { x: e.x, y: e.y + 0.125, z: e.z }, height: 0.25 });
  for (const o of xpOrbs.orbs) list.push({ ...SHADOWS.orb, x: lerp(o.px, o.x), y: lerp(o.py, o.y), z: lerp(o.pz, o.z), pos: o, height: 0.5 });
  // The local player casts a shadow only when it is on screen.
  if (thirdPersonView > 0) list.push(playerShadowCaster(position, previous, partial, SHADOWS.player, motion.prevYSize, motion.ySize));
  for (const e of mobs?.entities ?? []) {
    const child = e.growingAge < 0;
    if (SHADOWS[e.type]) list.push({ ...SHADOWS[e.type], x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z), pos: e, height: ENTITY_TYPES[e.type].height * (child ? 0.5 : 1), child });
  }
  return list;
}
async function boot(){try {
  scene = new VoxelScene($("#viewport"));
  await scene.textures.ready;
  xpRenderer=new ExperienceRenderer(scene.scene);
  sounds = new SoundBank(
    () => options,
    () => ({ ...position, yaw }),
  );
  firstPerson = new FirstPerson(scene.renderer, scene.textures.texture, scene.lighting);
  mobRenderer = new MobRenderer(scene.scene, scene);
  playerRenderer = new PlayerRenderer(scene.scene, scene, scene.textures.texture);
  chestRenderer = new ChestRenderer(scene.scene, scene);
  document.addEventListener("pointerdown", () => sounds.unlock(), {
    once: true,
  });
  world = new World("Overworld");
  scene.setWorld(world);
  scene.camera.fov = options.fov;
  scene.camera.updateProjectionMatrix();
  scene.setDistance(options.distance);
  scene.setGamma(Number(options.gamma) || 0);
  setupPointer();
  // Development-only handle for browser checks; Vite strips it from builds.
  if (import.meta.env.DEV)
    window.__mc = { scene, get survival() { return survival; }, get world() { return world; }, position, look(p, y) { pitch = p; yaw = y; }, view(n) { thirdPersonView = n; }, playerBody, teleport(x, y, z) { position.set(x, y, z); }, items, projectiles, get mobs() { return mobs; }, breakBlock };
  scene.preview(0);
  scene.render(0);
  renderWorlds();
  renderHotbar();
  bindActions();
  $("#loading").classList.add("hidden");
  requestAnimationFrame(animate);
} catch (e) {
  $("#loading").innerHTML =
    `<div class="loading-cube">${cube}</div><h2>Couldn’t load the world.</h2><p>Try reloading in a current browser with WebGL enabled.</p><small>${esc(e.message)}</small>`;
}
}
boot();
