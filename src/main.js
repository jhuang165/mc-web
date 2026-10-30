import "./style.css";
import * as THREE from "three";
import {
  World,
  SIZE,
  HEIGHT,
  BLOCKS,
  HOTBAR,
  PHYSICS,
  hashSeed,
  collides,
  raycast,
  fallingVelocity,
} from "./world.js";
import { VoxelScene } from "./scene.js";
import { SoundBank, blockSound } from "./audio.js";
import { PlayerAnimation } from "./animation.js";
import { FirstPerson, itemTexture } from "./first-person.js";
import { EntityWorld } from "./entities.js";
import { MobRenderer } from "./mob-renderer.js";
import {
  Survival,
  ITEMS,
  RECIPES,
  MATERIALS,
  matchRecipe,
  ingredients,
  SMELTING,
  FUELS,
} from "./survival.js";

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
};
try {
  options = {
    ...options,
    ...JSON.parse(localStorage.getItem("blockworld.settings") || "{}"),
  };
} catch {}
let screen = "home",
  world,
  active,
  selected = 0,
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
let sounds,
  firstPerson,
  mobs,
  mobRenderer,
  aimedEntity = null,
  eating = null;
const animation = new PlayerAnimation();
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
  gridSize = 2,
  craftGrid = [],
  inventoryIngredient = 0,
  inventorySearch = "",
  openFurnaceKey = null,
  droppedInventories = [];
$("#app").innerHTML = `
 <div id="viewport" aria-label="Interactive voxel world"></div><div id="vignette"></div>
 <main id="home">
  <header class="header"><a class="brand" href="#" aria-label="Blockworld home">${cube}<span>BLOCKWORLD<small>JAVA → BROWSER</small></span></a><nav aria-label="Main navigation"><button class="nav active" data-action="home">Play <span class="nav-dot"></span></button><button class="nav" data-action="notes">Field notes ${arrow}</button><button class="nav" data-action="controls">How to play ${arrow}</button></nav><button class="icon-button settings-button" data-action="settings" aria-label="Settings">⚙</button></header>
  <section class="hero"><div class="eyebrow"><span class="status-dot"></span> YOUR NEXT ADVENTURE, ONE BLOCK AWAY</div><h1>A small world.<br>Endless <em>possibilities.</em></h1><p>Get a little lost. Build something unexpected.<br>A familiar kind of freedom, right in your browser.</p><div class="hero-actions"><button class="button primary" id="enter">Enter your world <span>→</span></button><button class="button glass" data-action="create"><span>＋</span> Create a world</button></div><div class="hero-detail"><span class="tiny-cube">◇</span> No install. Just imagination.<span class="detail-separator">/</span> Creative & survival</div></section>
  <div class="scene-caption"><span class="caption-cross">＋</span><div>THE OVERWORLD<small>Somewhere worth getting lost.</small></div><span class="coordinate">64° N · 128° W</span></div>
  <section class="world-shelf"><div class="shelf-heading"><div><span class="eyebrow dark">PICK UP WHERE YOU LEFT OFF</span><h2>Your little corner of everything.</h2></div><button class="text-button" id="import">Import world <span>↓</span></button></div><div id="worlds" class="world-grid"></div><div class="shelf-footer"><span><i class="status-dot"></i> Worlds stay on this device</span><button class="text-button" data-action="controls">The world is yours. Here’s how to play <span>→</span></button></div></section>
  <footer class="site-footer"><span>An experiment in play.</span><span>INSPIRED BY JAVA 1.7.10 <i>·</i> INDEPENDENT BROWSER RECREATION</span><button data-action="notes">Made of blocks & curiosity ${arrow}</button></footer>
 </main>
 <section id="hud" class="hidden" aria-label="Game heads-up display"><div class="game-top"><button class="game-brand" id="pause-button">${cube}<span>BLOCKWORLD<small id="world-label"></small></span><span class="pause-symbol">Ⅱ</span></button><div class="game-status"><span class="status-dot"></span><span id="save-label">Saved on this device</span><button id="fullscreen" aria-label="Toggle fullscreen">⛶</button></div></div><div id="crosshair">＋</div><pre id="debug" class="hidden"></pre><div id="block-label"></div><div id="survival-hud" class="survival-hud hidden"></div><div id="mining-meter" class="mining-meter hidden" role="progressbar" aria-label="Mining progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><div id="damage-flash"></div><div id="flight-label" class="flight-label"><span id="mode-label">CREATIVE</span> <span>·</span> <b id="movement-label">WALKING</b></div><div class="hotbar" id="hotbar"></div><div class="game-help">W A S D <span>move</span> <i>·</i> SPACE <span>jump</span> <i>·</i> LMB <span>break</span> <i>·</i> RMB <span>use / place</span> <i>·</i> E <span>inventory</span> <i>·</i> ESC <span>pause</span></div><div id="mobile-controls"><div class="dpad"><button data-key="KeyW">↑</button><button data-key="KeyA">←</button><button data-key="KeyS">↓</button><button data-key="KeyD">→</button></div><div class="touch-actions"><button id="touch-break">Break</button><button id="touch-place">Use</button><button id="touch-inventory">Bag</button><button id="touch-fly">Fly</button><button data-key="Space">Jump</button></div></div></section>
 <div class="modal-overlay hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></div><div id="toast" role="status"></div><input id="file-input" type="file" accept=".json,application/json" hidden>
 <div id="loading"><div class="loading-cube">${cube}</div><span>Making a little room for imagination…</span></div>`;

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
        `<article class="world-card"><button class="world-open" data-world="${i}"><div class="world-thumb ${esc(w.biome)}"><span class="thumb-sun"></span><span class="thumb-hill h1"></span><span class="thumb-hill h2"></span><span class="thumb-tree t1"></span><span class="thumb-tree t2"></span><span class="thumb-tree t3"></span></div><div class="world-copy"><div class="world-meta"><span>${esc(w.tag || w.biome.toUpperCase())}</span><span>${w.mode === "survival" ? "SURVIVAL" : w.preset ? "READY TO EXPLORE" : "CREATIVE"}</span></div><h3>${esc(w.name)} <span>↗</span></h3><p>${esc(w.preset ? w.description : relativeDate(w.updated))}</p></div></button>${!w.preset ? `<button class="world-more" data-manage="${i}" aria-label="Manage ${esc(w.name)}">···</button>` : ""}</article>`,
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
    generationVersion: 2,
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
function icon(id) {
  const item = ITEMS[id];
  if (!id || !item) return '<span class="empty-hand">·</span>';
  if (!item.block && itemTexture(id))
    return `<img class="vanilla-item-icon" src="${itemTexture(id)}" alt="" aria-hidden="true">`;
  if (!item.block)
    return `<span class="item-icon ${item.kind ? "tool-icon" : ""}" style="--item:${item.color}" aria-hidden="true">${item.glyph}</span>`;
  return `<span class="block-icon b${id}" style="--block:${item.color};--top:${item.top || item.color}"><i></i></span>`;
}
function renderHotbar() {
  $("#hotbar").innerHTML = HOTBAR.map((id, i) => {
    const item = ITEMS[id],
      count = survival.count(id),
      durability = item?.durability && survival.durability[id];
    return `<button class="slot ${i === selected ? "selected" : ""} ${!survival.creative && count === 0 ? "depleted" : ""}" data-slot="${i}" aria-label="Select ${id ? item?.name || "Empty hand" : "Empty hand"}" aria-pressed="${i === selected}">${icon(id)}<small>${i + 1}</small>${!survival.creative && count ? `<b class="stack-count">${count}</b>` : ""}${durability ? `<i class="durability-bar" style="--durability:${(durability / item.durability) * 100}%"></i>` : ""}</button>`;
  }).join("");
  document
    .querySelectorAll("[data-slot]")
    .forEach((b) => (b.onclick = () => selectSlot(+b.dataset.slot)));
}
function selectSlot(i) {
  selected = (i + 9) % 9;
  eating = null;
  mining = null;
  renderHotbar();
  $("#block-label").textContent = HOTBAR[selected]
    ? ITEMS[HOTBAR[selected]]?.name || "Empty hand"
    : "Empty hand";
  $("#block-label").classList.add("visible");
  clearTimeout(selectSlot.timer);
  selectSlot.timer = setTimeout(
    () => $("#block-label").classList.remove("visible"),
    1300,
  );
}
function closeModal() {
  $("#modal").classList.add("hidden");
  $("#modal").innerHTML = "";
  openFurnaceKey = null;
}
function modal(title, body, extra = "") {
  eating = null;
  keys.clear();
  if (screen === "playing") screen = "paused";
  if (document.pointerLockElement) document.exitPointerLock();
  $("#modal").innerHTML =
    `<div class="modal ${extra}"><div class="modal-top"><span class="eyebrow dark">BLOCKWORLD / ${screen === "home" ? "THE FIELD GUIDE" : "TAKE A BREATHER"}</span><button class="close-button" aria-label="Close dialog">×</button></div><h2 id="modal-title">${title}</h2>${body}</div>`;
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
    "Every world starts somewhere.",
    `<p class="modal-subtitle">Choose your beginning. Build freely, or earn every block.</p><form id="create-form"><label>WORLD NAME<input id="new-name" maxlength="40" value="My little world" required></label><div class="form-columns"><label>GAME MODE<select id="new-mode"><option value="survival">Survival</option><option value="creative">Creative</option></select></label><label>LANDSCAPE<select id="new-biome"><option value="meadow">Meadow</option><option value="alpine">Highlands</option><option value="island">Island</option></select></label></div><label>SEED <span>Same seed, same beginning.</span><input id="new-seed" maxlength="80" placeholder="Leave blank for a surprise"></label><p class="form-note">Survival starts empty-handed. Gather wood, craft tools, and watch your health and hunger. 128 × 128 blocks; custom terrain.</p><button class="button primary full">Create & explore <span>→</span></button></form>`,
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
    "A few keys. A whole world.",
    `<p class="modal-subtitle">In Survival, start by punching a tree. In Creative, all materials are available.</p><div class="control-list">${[
      ["W A S D", "Move around"],
      ["MOUSE", "Look around"],
      ["SPACE", "Jump · double tap to fly in Creative"],
      ["SHIFT", "Descend while flying"],
      ["CTRL", "Sprint (requires food in Survival)"],
      ["LEFT CLICK", "Hold to mine · click in drag mode"],
      ["RIGHT CLICK", "Place, eat, or use a workstation"],
      ["1 – 9 / SCROLL", "Choose a slot"],
      ["E", "Inventory & 2 × 2 crafting"],
      ["F3", "Coordinates, time & performance"],
      ["ESC", "Pause & save"],
    ]
      .map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`)
      .join(
        "",
      )}</div><p class="form-note">Right-click a crafting table for the 3 × 3 grid or a furnace to smelt. Put materials into the crafting grid, then take the result. Click an occupied grid cell to clear it.</p><p class="form-note">If mouse capture is unavailable, drag to look and click once to mine the targeted block. Touch controls include a Fly button in Creative.</p>`,
  );
}
function notes() {
  modal(
    "Rebuilding 1.7.10, system by system.",
    `<p class="modal-subtitle">Minecraft Java 1.7.10 is the compatibility target. Full parity is still unfinished.</p><div class="notes"><span class="note-tag">VERIFIED AGAINST BYTECODE</span><p>REA inventories the original JAR. MCP mappings and javap locate the original movement, FoodStats, crafting, furnace, and world-clock implementations.</p><div class="facts"><div><b>20 Hz</b><span>Physics ticks</span></div><div><b>200</b><span>Ticks / smelt</span></div><div><b>24,000</b><span>Ticks / day</span></div></div><span class="note-tag">IMPLEMENTED IN THIS BUILD</span><p>Creative and Survival, health, hunger, saturation, exhaustion, regeneration, fall damage, drowning, death and recoverable inventory drops. Shaped crafting, a crafting table, a fuel-driven furnace, wood, stone, iron, diamond and gold tools with durability. Original 1.7.10 effects and selected textures; hand swings, equip transitions, bobbing, eating, animated water and crack frames. Pigs, cows, night-time zombies, basic melee combat and food drops. Caves, ores, torches, and a day/night lighting cycle.</p><span class="note-tag">MAJOR GAPS REMAIN</span><p>Original world generation and biomes, the complete block/item registry, most mobs and their full AI, farming, advanced combat, armor, enchantments, redstone, dimensions, structures, weather, Java saves, and multiplayer. The renderer, block textures, terrain, inventory layout, entity AI and several interactions remain simplified. Selected original sounds and textures retain Mojang/Microsoft ownership.</p><div class="note-links"><a href="/research/animations-and-sounds.md" target="_blank" rel="noopener">Animation & audio ↗</a><a href="/research/investigation.md" target="_blank" rel="noopener">Investigation ↗</a><a href="/research/parity.md" target="_blank" rel="noopener">Feature coverage ↗</a><a href="https://github.com/morluto/rea" target="_blank" rel="noopener">REA ↗</a></div></div>`,
    "notes-modal",
  );
}
function settings() {
  modal(
    "Make yourself comfortable.",
    `<p class="modal-subtitle">Original Minecraft 1.7.10 effects. Your preferences stay on this device.</p><div class="settings-list"><label>Field of view <output id="fov-value">${options.fov}°</output><input type="range" id="fov" min="50" max="100" value="${options.fov}"></label><label>Mouse sensitivity <output id="sensitivity-value">${options.sensitivity.toFixed(1)}×</output><input type="range" id="sensitivity" min="0.2" max="2" step="0.1" value="${options.sensitivity}"></label><label>View distance <output id="distance-value">${options.distance} blocks</output><input type="range" id="distance" min="70" max="200" step="5" value="${options.distance}"></label><label>Sound volume <output id="volume-value">${Math.round(options.volume * 100)}%</output><input type="range" id="volume" min="0" max="1" step=".05" value="${options.volume}"></label><label class="switch-label">Sounds<input type="checkbox" id="sound" ${options.sound ? "checked" : ""}></label><label class="switch-label">View bobbing<input type="checkbox" id="bobbing" ${options.bobbing ? "checked" : ""}></label><button class="button secondary full" id="test-sound">Test original sound <span>♪</span></button><p class="form-note" id="audio-status" role="status">${esc(sounds.status)}</p></div>`,
  );
  for (const key of [
    "fov",
    "sensitivity",
    "distance",
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
              : key === "volume"
                ? Math.round(options[key] * 100) + "%"
                : options[key].toFixed(1) + "×";
      scene.camera.fov = options.fov;
      scene.camera.updateProjectionMatrix();
      scene.setDistance(options.distance);
      try {
        localStorage.setItem("blockworld.settings", JSON.stringify(options));
      } catch {}
    };
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
  active.mode = survival.mode;
  active.hotbar = [...HOTBAR];
  active.selected = selected;
  active.drops = droppedInventories;
  active.entities = mobs?.serialize() || [];
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
    `<p class="modal-subtitle">A little world worth keeping.</p><div class="menu-actions"><button class="button primary full" id="manage-play">Continue exploring <span>→</span></button><button class="button secondary full" id="manage-export">Export world <span>↓</span></button><button class="text-button danger" id="manage-delete">Delete from this device</button></div>`,
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
      toast("Drag to look · click to break · right-click to build");
    });
  } catch {
    lockFallback = true;
  }
}
function launch(record) {
  try {
    active = record;
    world = new World(record.seed, record.biome, record.generationVersion ?? 1);
    world.restore(record.edits || []);
    scene.setWorld(world);
    mobs = new EntityWorld(world, record.entities);
    mobRenderer.clear();
    animation.reset();
    eating = null;
    stepDistance = 0;
    wasInWater = false;
    survival = new Survival(record.player, record.mode || "creative");
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
    const defaultBar = survival.creative
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
      : Array(9).fill(0);
    HOTBAR.splice(0, 9, ...defaultBar);
    if (Array.isArray(record.hotbar) && record.hotbar.length === 9)
      record.hotbar.forEach((id, i) => {
        if (ITEMS[id]) HOTBAR[i] = id;
      });
    selected = Number.isInteger(record.selected)
      ? Math.max(0, Math.min(8, record.selected))
      : 0;
    droppedInventories = (Array.isArray(record.drops) ? record.drops : [])
      .slice(0, 32)
      .filter(
        (d) =>
          d.position &&
          [d.position.x, d.position.y, d.position.z, d.expires].every(
            Number.isFinite,
          ),
      )
      .map((d) => ({
        ...d,
        inventory: new Survival({ inventory: d.inventory }, "survival")
          .inventory,
        durability: new Survival({ durability: d.durability }, "survival")
          .durability,
      }));
    velocity.set(0, 0, 0);
    flying = false;
    grounded = false;
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
    "The world can wait.",
    `<p class="modal-subtitle">${esc(active.name)} <span class="middle-dot">·</span> ${saved ? "Your changes are saved." : "Export your world to preserve your changes."}</p><div class="menu-actions"><button class="button primary full" id="resume">Back to your world <span>→</span></button><button class="button secondary full" data-action="settings">Settings <span>⚙</span></button><button class="button secondary full" data-action="controls">How to play <span>↗</span></button><button class="button secondary full" id="export-pause">Export world <span>↓</span></button><button class="text-button full" id="exit-world">Save & return home <span>←</span></button></div>`,
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
  $("#home").classList.remove("hidden");
  $("#hud").classList.add("hidden");
  $("#vignette").classList.remove("in-game");
  renderWorlds();
}
function inventory(station = false) {
  gridSize = station ? 3 : 2;
  craftGrid = Array(gridSize * gridSize).fill(0);
  inventoryIngredient = 0;
  inventorySearch = "";
  screen = "inventory";
  mining = null;
  mineHeld = false;
  renderInventory();
}
function renderInventory() {
  const guideOpen = $(".recipe-guide")?.open || false;
  const creative = survival.creative,
    all = Object.values(ITEMS).filter(
      (i) => i.id && i.id !== 10 && i.id !== 11,
    ),
    owned = creative ? all : all.filter((i) => survival.count(i.id));
  const result = matchRecipe(craftGrid, gridSize);
  modal(
    creative
      ? "A world of materials."
      : gridSize === 3
        ? "The crafting table."
        : "Inventory & crafting.",
    `<p class="modal-subtitle">${creative ? "Choose any material or tool for your selected slot." : "Choose an ingredient, then click cells to arrange a recipe. Click a filled cell to clear it."}</p><div class="inventory-layout"><div><input class="inventory-search" id="inventory-search" aria-label="Search inventory" placeholder="Find a material…" value="${esc(inventorySearch)}"><div class="inventory-grid bag-grid" id="bag-grid">${owned.map((i) => `<button data-item="${i.id}" data-name="${esc(i.name.toLowerCase())}" class="${inventoryIngredient === i.id ? "ingredient-selected" : ""}" title="${esc(i.name)}"><span>${icon(i.id)}</span><span>${esc(i.name)}</span>${!creative ? `<b>${survival.count(i.id)}</b>` : ""}</button>`).join("") || '<p class="empty-inventory">Empty hands, endless beginnings.<br>Punch an oak log to gather wood.</p>'}</div></div>${!creative ? `<div class="crafting-panel"><div class="eyebrow dark">CRAFTING · ${gridSize} × ${gridSize}</div><div class="crafting-grid" style="--grid-size:${gridSize}">${craftGrid.map((id, i) => `<button data-cell="${i}" aria-label="Crafting cell ${i + 1}: ${id ? ITEMS[id]?.name || "empty" : "empty"}">${id ? icon(id) : ""}</button>`).join("")}</div><div class="craft-arrow">↓</div><button class="craft-result" id="craft-result" ${!survival.canCraft(result) ? "disabled" : ""} aria-label="${result ? "Craft " + ITEMS[result.output].name : "No matching recipe"}">${result ? icon(result.output) : "<span>?</span>"}<span>${result ? `${result.count} × ${ITEMS[result.output].name}` : "Arrange a recipe"}</span></button><p class="form-note ingredient-note">${inventoryIngredient ? "Ingredient: " + esc(ITEMS[inventoryIngredient].name) : "Select an ingredient on the left."}</p><button class="text-button" id="clear-grid">Clear grid ↺</button></div>` : ""}</div>${
      !creative
        ? `<details class="recipe-guide" ${guideOpen ? "open" : ""}><summary>Recipe guide · ${gridSize === 2 ? "2 × 2 recipes" : "all crafting recipes"}</summary><div class="recipe-list">${RECIPES.filter(
            (r) => r.width <= gridSize && r.height <= gridSize,
          )
            .map(
              (r) =>
                `<button data-recipe="${r.id}">${icon(r.output)}<span>${r.count} × ${r.name}<small>${Object.entries(
                  ingredients(r),
                )
                  .map(([id, n]) => `${n} ${ITEMS[id].name}`)
                  .join(
                    " · ",
                  )}</small></span><b>${survival.canCraft(r) ? "✓" : "＋"}</b></button>`,
            )
            .join("")}</div></details>`
        : ""
    }<button class="button primary full inventory-back" id="inventory-back">Back to your world <span>→</span></button>`,
    "inventory-modal",
  );
  $("#inventory-search").oninput = (e) => {
    inventorySearch = e.target.value;
    document
      .querySelectorAll("[data-item]")
      .forEach(
        (b) =>
          (b.hidden = !b.dataset.name.includes(inventorySearch.toLowerCase())),
      );
  };
  document.querySelectorAll("[data-item]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = +b.dataset.item;
        if (creative) survival.add(id, ITEMS[id].stack);
        HOTBAR[selected] = id;
        inventoryIngredient = id;
        renderHotbar();
        if (creative) {
          resume();
          selectSlot(selected);
        } else renderInventory();
      }),
  );
  document.querySelectorAll("[data-cell]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.cell;
        if (craftGrid[i]) craftGrid[i] = 0;
        else if (inventoryIngredient) {
          const used = craftGrid.filter(
            (id) => id === inventoryIngredient,
          ).length;
          if (used >= survival.count(inventoryIngredient)) {
            toast("Every ingredient needs a collected item.");
            return;
          }
          craftGrid[i] = inventoryIngredient;
        }
        renderInventory();
      }),
  );
  document.querySelectorAll("[data-recipe]").forEach(
    (b) =>
      (b.onclick = () => {
        const r = RECIPES.find((r) => r.id === b.dataset.recipe);
        craftGrid = Array(gridSize * gridSize).fill(0);
        for (let y = 0; y < r.height; y++)
          for (let x = 0; x < r.width; x++)
            craftGrid[y * gridSize + x] = r.pattern[y * r.width + x];
        renderInventory();
        $("#craft-result").focus();
      }),
  );
  document
    .querySelectorAll("[data-item]")
    .forEach(
      (b) =>
        (b.hidden = !b.dataset.name.includes(inventorySearch.toLowerCase())),
    );
  if ($("#craft-result"))
    $("#craft-result").onclick = () => {
      if (survival.craft(matchRecipe(craftGrid, gridSize))) {
        renderInventory();
        renderHotbar();
        sound(true);
        save();
      }
    };
  if ($("#clear-grid"))
    $("#clear-grid").onclick = () => {
      craftGrid.fill(0);
      renderInventory();
    };
  $("#inventory-back").onclick = resume;
}
function renderVitals() {
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
        `<span class="${survival.food > i * 2 ? "full" : "empty"}">◆</span>`,
    ).join("");
  $("#survival-hud").innerHTML =
    `<div class="vital-row"><div class="hearts" aria-label="Health ${survival.health} of 20">${hearts}</div><div class="hunger" aria-label="Hunger ${survival.food} of 20">${food}</div></div>${survival.air < 300 ? `<div class="air" aria-label="Air ${Math.max(0, survival.air)} of 300">${"◉".repeat(Math.max(0, Math.ceil(survival.air / 30)))}</div>` : ""}`;
  $("#damage-flash").classList.toggle("hurt", survival.hurtTicks > 4);
}
function acquire(id, n = 1) {
  const added = survival.add(id, n);
  if (added) {
    if (!HOTBAR.includes(id)) {
      const slot = HOTBAR.findIndex((b) => !b || !survival.count(b));
      if (slot >= 0) HOTBAR[slot] = id;
    }
    renderHotbar();
  }
  return added;
}
function useFurnace(key) {
  openFurnaceKey = key;
  screen = "inventory";
  mining = null;
  mineHeld = false;
  renderFurnace();
}
function renderFurnace() {
  const key = openFurnaceKey;
  if (!key) return;
  const f = survival.furnace(key),
    inputs = Object.keys(SMELTING)
      .map(Number)
      .filter((id) => survival.count(id)),
    fuels = Object.keys(FUELS)
      .map(Number)
      .filter((id) => survival.count(id));
  modal(
    "A little heat goes a long way.",
    `<p class="modal-subtitle">One smelt takes 10 seconds. Coal fuels eight smelts; wood fuels one and a half.</p><div class="furnace-panel"><div class="furnace-slots"><div><span class="eyebrow dark">INPUT</span><button class="furnace-slot" data-unload="input" aria-label="Take furnace input">${icon(f.input)}<b data-furnace-count="input">${f.inputCount || ""}</b></button><span id="furnace-input-name">${f.input ? ITEMS[f.input]?.name || "Empty" : "Empty"}</span></div><div class="smelt-progress"><span id="furnace-fire">♨</span><progress id="furnace-progress" max="200" value="${f.cook}" aria-label="Smelting progress"></progress><small id="furnace-time">${(f.cook / 20).toFixed(1)} / 10s</small></div><div><span class="eyebrow dark">OUTPUT</span><button class="furnace-slot" data-unload="output" aria-label="Take furnace output">${icon(f.output)}<b data-furnace-count="output">${f.outputCount || ""}</b></button><span id="furnace-output-name">${f.output ? ITEMS[f.output]?.name || "Empty" : "Empty"}</span></div></div><div class="furnace-fuel"><button class="furnace-slot" data-unload="fuel" aria-label="Take furnace fuel">${icon(f.fuel)}<b data-furnace-count="fuel">${f.fuelCount || ""}</b></button><div><span class="eyebrow dark">FUEL</span><p id="furnace-fuel-time">${(f.burn / 20).toFixed(1)}s remaining</p></div></div></div><div class="form-columns furnace-loaders"><label>LOAD INPUT<select id="smelt-input">${inputs.map((id) => `<option value="${id}">${ITEMS[id].name} (${survival.count(id)})</option>`).join("") || '<option value="0">Gather an ore or sand</option>'}</select><button id="load-input" class="button secondary full" ${!inputs.length ? "disabled" : ""}>Add one →</button></label><label>LOAD FUEL<select id="smelt-fuel">${fuels.map((id) => `<option value="${id}">${ITEMS[id].name} (${survival.count(id)})</option>`).join("") || '<option value="0">Gather coal or wood</option>'}</select><button id="load-fuel" class="button secondary full" ${!fuels.length ? "disabled" : ""}>Add one →</button></label></div><p class="form-note">Click a slot to take its contents. The furnace keeps working while its screen is open; pausing stops the world.</p><button class="button primary full" id="furnace-back">Back to your world <span>→</span></button>`,
    "furnace-modal",
  );
  for (const slot of ["input", "fuel"])
    $("#load-" + slot).onclick = () => {
      if (survival.loadFurnace(key, slot, +$("#smelt-" + slot).value)) {
        renderFurnace();
        renderHotbar();
        save();
      }
    };
  document.querySelectorAll("[data-unload]").forEach(
    (b) =>
      (b.onclick = () => {
        survival.unloadFurnace(key, b.dataset.unload);
        renderFurnace();
        renderHotbar();
        save();
      }),
  );
  $("#furnace-back").onclick = resume;
}
function updateFurnace() {
  if (!openFurnaceKey || !$("#furnace-progress")) return;
  const f = survival.furnace(openFurnaceKey);
  $("#furnace-progress").value = f.cook;
  $("#furnace-time").textContent = (f.cook / 20).toFixed(1) + " / 10s";
  $("#furnace-fuel-time").textContent =
    (f.burn / 20).toFixed(1) + "s remaining";
  $("#furnace-fire").classList.toggle("burning", f.burn > 0);
  for (const slot of ["input", "fuel", "output"]) {
    const b = $(`[data-unload="${slot}"]`);
    if (b) b.innerHTML = icon(f[slot]) + `<b>${f[slot + "Count"] || ""}</b>`;
    const name = $("#furnace-" + slot + "-name");
    if (name)
      name.textContent = f[slot] ? ITEMS[f[slot]]?.name || "Empty" : "Empty";
  }
}
function die() {
  if (screen === "dead") return;
  const reason = survival.lastDamage || "an accident";
  screen = "dead";
  keys.clear();
  mining = null;
  mineHeld = false;
  if (Object.keys(survival.inventory).length) {
    droppedInventories.push({
      position: { x: position.x, y: position.y, z: position.z },
      inventory: { ...survival.inventory },
      durability: { ...survival.durability },
      expires: survival.time + 6000,
    });
    survival.inventory = {};
    survival.durability = {};
  }
  save();
  modal(
    "You died.",
    `<p class="modal-subtitle">Lost to ${esc(reason)}. Your items remain where you fell for five minutes of world time.</p><div class="menu-actions"><button class="button primary full" id="respawn">Respawn <span>→</span></button><button class="button secondary full" id="death-home">Save & return home <span>←</span></button></div>`,
  );
  $("#modal .close-button").hidden = true;
  $("#respawn").onclick = () => {
    const time = survival.time;
    survival = new Survival({ time }, "survival");
    position.copy(new THREE.Vector3(...Object.values(world.spawn())));
    previous.copy(position);
    velocity.set(0, 0, 0);
    fallDistance = 0;
    HOTBAR.fill(0);
    renderHotbar();
    renderVitals();
    resume();
    save();
  };
  $("#death-home").onclick = goHome;
}
function tickSurvival(inWater, oldPosition) {
  const underwater =
    world.get(
      Math.floor(position.x),
      Math.floor(position.y + PHYSICS.eye),
      Math.floor(position.z),
    ) === 10;
  survival.tick({ underwater });
  if (!survival.creative) {
    const distance = Math.hypot(
      position.x - oldPosition.x,
      position.z - oldPosition.z,
    );
    survival.exhaust(
      distance *
        (inWater
          ? 0.015
          : keys.has("ControlLeft") && survival.food > 6
            ? 0.1
            : 0.01),
    );
    if (!inWater && !flying)
      fallDistance += Math.max(0, oldPosition.y - position.y);
    if (grounded) {
      if (fallDistance > 3)
        survival.damage(Math.ceil(fallDistance - 3), "a fall");
      fallDistance = 0;
    }
    if (inWater) fallDistance = 0;
  }
  for (const drop of droppedInventories) {
    if (drop.expires <= survival.time) continue;
    if (
      Math.hypot(
        position.x - drop.position.x,
        position.y - drop.position.y,
        position.z - drop.position.z,
      ) < 2
    ) {
      let count = 0;
      for (const [id, n] of Object.entries(drop.inventory)) {
        const added = acquire(+id, n);
        drop.inventory[id] -= added;
        if (drop.inventory[id] <= 0) delete drop.inventory[id];
        if (added && drop.durability[id])
          survival.durability[id] = Math.min(
            survival.durability[id] || ITEMS[id].durability,
            drop.durability[id],
          );
        count += added;
      }
      if (count) toast("Recovered your dropped items.");
    }
  }
  droppedInventories = droppedInventories.filter(
    (d) => d.expires > survival.time && Object.keys(d.inventory).length,
  );
  scene.setDrops(droppedInventories);
  scene.setTime(survival.time);
  renderVitals();
  updateFurnace();
  if (survival.health <= 0 && !survival.creative) die();
}
function handleEntityEvents() {
  for (const event of mobs.drain()) {
    if (event.sound)
      sounds.play(event.sound, { position: event.position, volume: 0.6 });
    if (event.drop) {
      const left = event.count - acquire(event.drop, event.count);
      if (left)
        droppedInventories.push({
          position: event.position,
          inventory: { [event.drop]: left },
          durability: {},
          expires: survival.time + 6000,
        });
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
function edit(place = false) {
  if (screen !== "playing") return;
  animation.swing();
  sounds.unlock();
  const id = HOTBAR[selected],
    item = ITEMS[id];
  if (!place && aimedEntity) {
    mining = null;
    if (mobs.attack(aimedEntity.entity, id, survival, position)) {
      handleEntityEvents();
      renderHotbar();
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
    if (block === 13) {
      inventory(true);
      return;
    }
    if (block === 14) {
      useFurnace(target.block.join(","));
      return;
    }
    if (!survival.creative && item?.food) {
      beginEating(id);
      return;
    }
    const p = target.adjacent;
    if (!p || p[1] === 0 || p[1] >= HEIGHT - 1 || !world.inside(...p)) return;
    if (!item?.block || id === 10 || id === 11) {
      toast("Select a building block, food, or workstation.");
      return;
    }
    if (!survival.creative && !survival.count(id)) {
      toast("Gather this material first.");
      return;
    }
    const old = world.get(...p);
    world.set(...p, id, false);
    if (collides(world, ...position.toArray())) {
      world.set(...p, old, false);
      toast("Give yourself a little room to build.");
      return;
    }
    world.set(...p, id);
    if (!survival.creative) survival.take(id);
    scene.updateBlock(p[0], p[2]);
    renderHotbar();
    sound(true, id);
    saved = false;
  } else {
    if (block === 11) return;
    if (survival.creative) {
      breakBlock(target.block, true);
      mineCooldown = 5;
      return;
    }
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
    tool = HOTBAR[selected];
  if (!block || block === 11) return false;
  const harvest = creative || survival.mining(block, tool).harvest;
  let drop = harvest ? (m.drop ?? block) : 0,
    count = m.count || 1;
  if (block === 5 && Math.random() < 0.005) drop = 200;
  if (block === 21) count = 3;
  if (!creative && drop && survival.room(drop) < count) {
    toast("No room for this drop. Make room in your inventory.");
    mining = null;
    return false;
  }
  const f = survival.furnaces[key];
  if (f) {
    const needed = {};
    for (const slot of ["input", "fuel", "output"])
      if (f[slot] && f[slot + "Count"])
        needed[f[slot]] = (needed[f[slot]] || 0) + f[slot + "Count"];
    if (
      !creative &&
      Object.entries(needed).some(
        ([id, n]) => survival.room(+id) < n + (+id === drop ? count : 0),
      )
    ) {
      toast("Empty this furnace before breaking it.");
      mining = null;
      return false;
    }
    for (const [id, n] of Object.entries(needed)) acquire(+id, n);
    delete survival.furnaces[key];
  }
  if (!world.set(...p, 0)) return false;
  if (!creative) {
    if (drop) acquire(drop, count);
    survival.exhaust(0.025);
    if (survival.wear(tool))
      toast("Your " + ITEMS[tool].name.toLowerCase() + " broke.");
  }
  scene.updateBlock(p[0], p[2]);
  renderHotbar();
  sound(false, block);
  scene.effects.burst(p, block);
  saved = false;
  return true;
}
function tickMining() {
  if (screen !== "playing") return;
  if (mineCooldown > 0) {
    mineCooldown--;
    return;
  }
  if (aimedEntity) return;
  if (!mining && mineHeld && target) edit(false);
  if (!mining) return;
  if (
    !target ||
    !target.block.every((v, i) => v === mining.block[i]) ||
    world.get(...mining.block) !== mining.type ||
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
  mining.progress += survival.mining(
    mining.type,
    HOTBAR[selected],
    under,
    grounded,
  ).progress;
  if (mining.progress >= 1) {
    const p = [...mining.block];
    mining = null;
    breakBlock(p);
    mineCooldown = 5;
  }
}
function movementTick() {
  previous.copy(position);
  const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
    strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    sprint =
      (keys.has("ControlLeft") || keys.has("ControlRight")) &&
      (survival.creative || survival.food > 6);
  const oldPosition = position.clone();
  let dx = strafe,
    dz = forward;
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx = (dx / Math.max(1, len)) * 0.98;
    dz = (dz / Math.max(1, len)) * 0.98;
  }
  const inWater =
    world.get(
      Math.floor(position.x),
      Math.floor(position.y + 0.6),
      Math.floor(position.z),
    ) === 10;
  if (flying) {
    const speed = sprint ? 0.8 : 0.42;
    velocity.x = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * speed;
    velocity.z = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) * speed;
    velocity.y =
      ((keys.has("Space") ? 1 : 0) -
        (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1 : 0)) *
      speed;
  } else {
    const friction = grounded
      ? Math.fround(0.6) * Math.fround(0.91)
      : Math.fround(0.91);
    const accel =
      (grounded
        ? (0.1 * 0.16277136) / (friction * friction * friction)
        : 0.02) * (sprint ? 1.3 : 1);
    velocity.x += (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * accel;
    velocity.z += (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) * accel;
    if (keys.has("Space") && grounded) {
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
  }
  let landed = false;
  for (const axis of ["y", "x", "z"]) {
    const delta = velocity[axis],
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
        if (axis === "y" && delta < 0) landed = true;
        break;
      }
    }
  }
  grounded =
    landed || collides(world, position.x, position.y - 0.001, position.z);
  if (!flying) {
    velocity.y = inWater
      ? (velocity.y - 0.02) * 0.8
      : fallingVelocity(velocity.y);
    const f = inWater
      ? 0.8
      : grounded
        ? Math.fround(Math.fround(0.6) * Math.fround(0.91))
        : Math.fround(0.91);
    velocity.x *= f;
    velocity.z *= f;
    if (Math.abs(velocity.x) < 0.005) velocity.x = 0;
    if (Math.abs(velocity.z) < 0.005) velocity.z = 0;
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
  tickSurvival(inWater, oldPosition);
  mobs.tick(position, survival);
  handleEntityEvents();
  const distance = Math.hypot(
    position.x - oldPosition.x,
    position.z - oldPosition.z,
  );
  stepDistance += distance;
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
    if (HOTBAR[selected] !== eating.id || !survival.count(eating.id))
      eating = null;
    else {
      eating.ticks--;
      if (eating.ticks % 4 === 0)
        sounds.play("random.eat", {
          volume: 0.5,
          pitch: 0.9 + Math.random() * 0.2,
        });
      if (eating.ticks <= 0) {
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
$("#enter").onclick = () => launch(worlds[0] || makeRecord(presets[0]));
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
      player: new Survival(data.player, data.mode).serialize(),
      hotbar: Array.isArray(data.hotbar) ? data.hotbar : undefined,
      selected: data.selected,
      drops: data.drops,
      entities: data.entities,
    };
    worlds.unshift(record);
    persist();
    renderWorlds();
    toast("World imported. Your next chapter is ready.");
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
  if (screen === "inventory" && e.code === "KeyE") {
    e.preventDefault();
    resume();
    return;
  }
  if (screen !== "playing") return;
  if (["Space", "Tab", "KeyW", "KeyA", "KeyS", "KeyD", "F3"].includes(e.code))
    e.preventDefault();
  if (e.code === "KeyE" && !e.repeat) {
    inventory();
    return;
  }
  if (e.code === "F3" && !e.repeat) {
    debug = !debug;
    $("#debug").classList.toggle("hidden", !debug);
  }
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
window.addEventListener("keyup", (e) => keys.delete(e.code));
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
      selectSlot(selected + (e.deltaY > 0 ? 1 : -1));
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
      if (target) {
        const b = world.get(...target.block);
        if (b > 0 && b < 10) {
          HOTBAR[selected] = b;
          renderHotbar();
        }
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
      accumulator -= PHYSICS.tick;
    }
    const t = accumulator / PHYSICS.tick;
    scene.camera.position.lerpVectors(previous, position, t);
    scene.camera.position.y += PHYSICS.eye;
    const pose = animation.frame(dt, {
      item:
        survival.creative || survival.count(HOTBAR[selected])
          ? HOTBAR[selected]
          : 0,
      speed: Math.hypot(velocity.x, velocity.z),
      moving: keys.size > 0,
      grounded: grounded && !flying,
      bobbing: options.bobbing,
    });
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
    target = raycast(
      world,
      scene.camera.position,
      dir,
      survival.creative ? 6 : 4.5,
    );
    aimedEntity = mobs.pick(
      scene.camera.position,
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
        `BLOCKWORLD / Java 1.7.10 study\n${fps} FPS · ${(scene.worldTriangles || 0).toLocaleString()} triangles\nXYZ: ${position.x.toFixed(2)} / ${position.y.toFixed(2)} / ${position.z.toFixed(2)}\nSeed: ${active.seed}\n${survival.mode} · day ${Math.floor(survival.time / 24000) + 1} · ${survival.time % 24000} ticks\nHealth ${survival.health} · food ${survival.food} · saturation ${survival.saturation.toFixed(1)}\n${world.edits.size} edited blocks · ${droppedInventories.length} item piles · ${mobs?.entities.length || 0} mobs\n${aimedEntity ? aimedEntity.entity.type + " · " + aimedEntity.entity.health + " health" : target ? BLOCKS[world.get(...target.block)].name : "Looking into the distance"}`;
    if (elapsed - lastSave > 5) save();
    scene.effects.crack(mining?.block, mining?.progress);
  } else if (screen === "home") scene.preview(elapsed);
  if (mobs) mobRenderer.update(mobs.entities);
  scene.render(elapsed, dt);
  if (firstPerson && animate.pose)
    firstPerson.render(animate.pose, {
      visible: ["playing", "inventory", "paused"].includes(screen),
      daylight: scene.daylight,
      time: elapsed,
      eating: eating ? (32 - eating.ticks) / 20 : 0,
    });
}
try {
  scene = new VoxelScene($("#viewport"));
  sounds = new SoundBank(
    () => options,
    () => ({ ...position, yaw }),
  );
  firstPerson = new FirstPerson(scene.renderer, scene.material.map);
  mobRenderer = new MobRenderer(scene.scene);
  document.addEventListener("pointerdown", () => sounds.unlock(), {
    once: true,
  });
  world = new World("Overworld");
  scene.setWorld(world);
  scene.camera.fov = options.fov;
  scene.camera.updateProjectionMatrix();
  scene.setDistance(options.distance);
  setupPointer();
  scene.preview(0);
  scene.render(0);
  renderWorlds();
  renderHotbar();
  bindActions();
  $("#loading").classList.add("hidden");
  requestAnimationFrame(animate);
} catch (e) {
  $("#loading").innerHTML =
    `<div class="loading-cube">${cube}</div><h2>This world needs WebGL.</h2><p>Enable hardware acceleration or open this page in a current desktop browser.</p><small>${esc(e.message)}</small>`;
}
