import {isJavaLandscape} from "./java-world.js";
import { particleSetting } from "./particle-settings.js";
import "./style.css";
import "./minecraft-ui.css";
import "./container-ui.css";
import {guiScale,stackCount,durabilityBar,tooltipLines} from "./gui.js";
import { migrateSettings, optionLabel, renderDistanceBlocks, GUI_SCALE_NAMES, SOUND_CATEGORIES, soundLevel } from "./settings.js";
import { MouseLook, setAngles } from "./mouse-look.js";
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
  WOOL,
  isLiquid,
  DYE,
  RED_FLOWER,
  YELLOW_FLOWER,
  isFlower,
  isCrop,
  SNOW_LAYER,
  SAPLING,
  WEB,
  ICE,
  WATER,
  snowSelectionHeight,
  FIRE,
  LAVA,
  LADDER,
  TNT,
  SAND,
  CACTUS,
  REEDS,
} from "./world.js";
import { Plants, REEDS_ITEM, REED_BOUNDS, CACTUS_SELECTION, reedTarget, canPlaceReeds, cactusCanPlace } from "./plants.js";
import { FallingBlocks } from "./falling.js";
import { ladderBounds, canPlaceLadder, placedLadderMeta, ladderSupported, clickedSide, countsVertical } from "./ladders.js";
import { snowCanStay, snowFalls, stackedSnowMeta } from "./snow.js";
import { flowerCanStay, growGrass, JRandom } from "./flowers.js";
import { Trees, saplingCanStay, placedLeavesMeta } from "./trees.js";
import { VoxelScene } from "./scene.js";
import { SoundBank, blockSound, stepSound } from "./audio.js";
import { Weather, isWet, canLightningStrikeAt } from "./weather.js";
import { tickWeatherSimulation } from "./weather-simulation.js";
import { PlayerAnimation, SWING_SECONDS } from "./animation.js";
import { PlayerBody, PlayerRenderer, nextView, thirdPersonCamera, playerShadowCaster } from "./player-renderer.js";
import { FirstPerson, itemTexture } from "./first-person.js";
import {Experience,ExperienceOrbs,smeltExperience} from "./experience.js";
import {ExperienceRenderer} from "./experience-renderer.js";
import {plantedBlock,cropItem} from './crops.js';
import {Farming,cropDrops} from "./farming.js";
import { EntityWorld, ENTITY_TYPES } from "./entities.js";
import { deathMessage, showChatLine } from "./death-messages.js";
import { SHADOWS } from "./shadows.js";
import { MobRenderer } from "./mob-renderer.js";
import { ChestRenderer } from "./chest-renderer.js";
import { CHEST, canPlaceChest, placeChest, settleFacing, chestPair, tickLid } from "./chest.js";
import { Survival, ITEMS } from "./survival.js";
import { ContainerScreen, makeStack, copyStack } from "./inventory.js";
import { CreativeScreen, CREATIVE_TABS, SEARCH, SURVIVAL_TAB, tabArea, itemTab, GUI_WIDTH } from "./creative.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { Arrows, arrowTargets, releaseBow, canDraw, bowStage, bowFov, easeFov, BOW, ARROW } from "./bow.js";
import { canSeeSky } from "./weather.js";
import { Fluids, eyeInWater } from "./fluids.js";
import { Fire } from "./fire.js";
import { DIFFICULTY_NAMES, difficultySetting, localDifficulty, InhabitedTime } from "./difficulty.js";
import { isInvisible } from "./mob-effects.js";
import { primeTnt, TNT_SIZE, TNT_Y_OFFSET } from "./explosion.js";
import { TntRenderer } from "./tnt-renderer.js";
import { useBucket, milkCow, finishDrinking, isBucket, MILK_BUCKET, DRINK_TICKS } from "./buckets.js";
import { HUNGER, POISON } from "./status-effects.js";
import { PlayerMotion, isCritical, ATTACK_SLOWDOWN, fovMultiplier } from "./player-movement.js";
import { spawnRunningParticles, freshRandom } from "./particles.js";
import { enterWater, drownBubbles, burst, potionColor, potionParticles, itemCrumbs, boneMealSparkles } from "./fx.js";
import { JavaRandom } from "./lighting.js";
import { displayTicks } from "./display-ticks.js";
import { importedRuntime } from "./world-import.js";
import { tickBlockSystems } from "./world-tick.js";
import { captureMovementInput } from "./player-input.js";
import { movePlayer } from "./player-physics.js";
import { tickPlayerEnvironment, finishPlayerMovement } from "./player-environment.js";
import { tickEntitySimulation } from "./entity-simulation.js";
import { tickPlayerItemUse } from "./player-item-use.js";
import { tickLivingSimulation, drainMobEvents } from "./living-simulation.js";
import { tickPlayerMining } from "./player-mining.js";
import { applyExplosion } from "./explosion-simulation.js";
import { breakPlayerBlock } from "./block-break-simulation.js";

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
// Device preferences with the GameSettings defaults of 1.7.10 (settings.js): sensitivity 0..1,
// FOV in degrees, render distance in chunks (12, the 64-bit JVM default), invertMouse off and a
// level of 1 for every SoundCategory (soundLevel reads a missing category as 1).
let options = {
  settingsVersion: 3,
  sensitivity: 0.5,
  invertMouse: false,
  soundLevels: Object.fromEntries(SOUND_CATEGORIES.map(([k]) => [k, 1])),
  bobbing: true,
  fov: 70,
  distance: 12,
  sound: true,
  guiScale:0,
  particles:0,
  // GameSettings.difficulty: the EnumDifficulty id, Normal by default; singleplayer applies it
  // to the world being played.
  difficulty:2,
  // GameSettings.gammaSetting: 0 Moody (the 1.7.10 default) to 1 Bright.
  gamma: 0,
};
try {
  options = {
    ...options,
    ...migrateSettings(JSON.parse(localStorage.getItem("blockworld.settings") || "{}")),
  };
} catch {}
options.particles = particleSetting(options.particles);
options.difficulty = difficultySetting(options.difficulty);
// The difficulty in every system that reads World.difficultySetting.
function updateDifficulty() {
  const d = difficultySetting(options.difficulty);
  if (survival) survival.difficulty = d;
  if (mobs) mobs.difficulty = d;
  if (fire) fire.L.difficulty = d;
}
// Apply the saved client preference to current runtimes (weather is replaced on load).
function updateParticleOptions() {
  const setting = particleSetting(options.particles);
  scene.particles.setting = scene.explosionParticles.setting = scene.fx.setting = setting;
  projectiles.particleSetting = weather.particleSetting = setting;
  // RenderGlobal uses one client World.rand; keep it separate from server simulation.
  scene.particles.worldRandom = projectiles.particleRandom = scene.fx.worldRandom = scene.explosionParticles.worldRandom;
  const viewer = [position.x, position.y + PHYSICS.eye, position.z];
  scene.explosionParticles.viewer = projectiles.particleViewer = scene.fx.viewer = viewer;
}
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
  saved = true;
let eyeRay = null; // the view ray of the last frame, for the bucket's liquid trace
let fire,fluids,farming,experience=new Experience(),xpOrbs=new ExperienceOrbs(),xpRenderer,playerTicks=0;
let weather = new Weather(), trees, plants, falling;
// EntityTNTPrimed entities (explosion.js primeTnt). Explosions draw ray lengths,
// drops, chained fuses and sound pitch from the saved weather.random World.rand.
let primed = [];
let sounds,
  firstPerson,
  mobs,
  mobRenderer,
  chestRenderer,
  tntRenderer,
  aimedEntity = null,
  eating = null;
const animation = new PlayerAnimation();
// GameSettings.thirdPersonView: 0 first person, 1 behind, 2 in front (F5).
// Not saved, like 1.7.10.
let thirdPersonView = 0, playerRenderer;
const playerBody = new PlayerBody();
// Sprint/sneak state, move input and the sneak eye drop (player-movement.js).
const motion = new PlayerMotion();
// The player's Entity.rand (the sprint particle's offsets).
// Entity.rand of the player (java.util.Random, seeded from the clock).
const playerRandom = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
let collidedH = false, walkFrozen = false;
let stepDistance = 0,
  wasInWater = false;
let scene;
let pointerX = 0,
  pointerY = 0;
// Mouse movement gathered between frames (MouseHelper deltas), the cinematic camera filters, and
// GameSettings.smoothCamera: not saved to options.txt, so it starts off every session.
const mouseLook = new MouseLook(), mouseDelta = { x: 0, y: 0 };
let smoothCamera = false;
let inhabited = new InhabitedTime();
let survival = new Survival({}, "creative"),
  mining = null,
  mineHeld = false,
  mineCooldown = 0,
  fallDistance = 0,
  landedFall = 0,
  containerView = null,
  f3Combo = false;
// Dropped items as EntityItem physics objects (see item-entities.js).
const items = new ItemEntities();
// Thrown snowballs and their particles (see projectiles.js).
const projectiles = new Projectiles();
// Arrows in flight or stuck in blocks (bow.js) and the eased field-of-view modifier the
// bow draw drives (EntityRenderer.fovModifierHand and its previous value).
const arrows = new Arrows();
const bowFovState = { prev: 1, cur: 1 };
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
    generationVersion: isJavaLandscape(p.biome) ? 9 : 8,
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
    !place && (block === 9 || block === 47) ? "random.glass" : "dig." + blockSound(block),
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
    `<p class="modal-subtitle"></p><form id="create-form"><label>WORLD NAME<input id="new-name" maxlength="40" value="New World" required></label><div class="form-columns"><label>GAME MODE<select id="new-mode"><option value="survival">Survival</option><option value="creative" selected>Creative</option></select></label><label>LANDSCAPE<select id="new-biome"><option value="java" selected>Java Overworld</option><option value="javaAmplified">Java Amplified</option><option value="javaLargeBiomes">Java Large Biomes</option><option value="meadow">Meadow</option><option value="alpine">Highlands</option><option value="island">Island</option><option value="snowy">Snowy Tundra</option></select></label></div><label>SEED <span>Same seed, same beginning.</span><input id="new-seed" maxlength="80" placeholder="Leave blank for a surprise"></label><p class="form-note">Java worlds: 128 × 128 × 256 blocks, with caves and ravines. Trees, ores and structures are not generated yet; Creative is recommended. Meadow, Highlands, Island and Snowy Tundra keep their decorated terrain.</p><button class="button primary full">Create New World</button></form>`,
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
      ["CTRL / W W", "Sprint: hold Ctrl or double-tap W (food above 3 hunger icons in Survival)"],
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
      )}</div><p class="form-note">Inventories use the 1.7.10 slot rules. Left-click picks up or places a stack; right-click picks up half or places one. Drag a held stack across slots to share it evenly (left) or one each (right). Shift-click moves a stack between sections; double-click gathers matching items. Over a slot, 1 – 9 swaps with the hotbar and Q / Ctrl + Q drops. Click outside the window to throw the held stack. Right-click a crafting table for the 3 × 3 grid, a furnace to smelt or a chest to store items (two side by side form a large chest; a solid block on top keeps the lid shut); two damaged tools of one kind repair each other. F3 + H shows durability in tooltips.</p><p class="form-note">In Creative, E opens the 1.7.10 tabbed inventory. Click a tab or press T to search; the wheel or scrollbar scrolls. Click an item to take one (Shift: a full stack); click the same item again to add one, or anything else to delete the held stack. The chest tab shows your survival inventory; its X slot destroys the held item (Shift-click clears everything).</p><p class="form-note">To farm: break tall grass for seeds, right-click exposed grass/dirt with a hoe, then plant seeds on the tilled soil. Hold wheat to lead cows and sheep, seeds for chickens, or carrots for pigs; feed two adults to breed. Plant carrots or potatoes directly on tilled soil. Mature roots provide more for replanting; bake potatoes in a furnace. Zombies rarely drop the first carrots and potatoes. Water within four blocks keeps soil hydrated. Bone meal advances growth; harvest mature golden wheat and craft three wheat into bread.</p><p class="form-note">If mouse capture is unavailable, drag to look and click once to mine the targeted block. Touch controls include a Fly button in Creative.</p>`,
  );
}
function notes() {
  modal(
    "Rebuilding 1.7.10, system by system.",
    `<p class="modal-subtitle">Minecraft Java 1.7.10 is the compatibility target. Full parity is still unfinished.</p><div class="notes"><span class="note-tag">VERIFIED AGAINST BYTECODE</span><p>REA inventories the original JAR. MCP mappings and javap locate the original movement, FoodStats, crafting, furnace, and world-clock implementations.</p><div class="facts"><div><b>20 Hz</b><span>Physics ticks</span></div><div><b>200</b><span>Ticks / smelt</span></div><div><b>24,000</b><span>Ticks / day</span></div></div><span class="note-tag">IMPLEMENTED IN THIS BUILD</span><p>Creative and Survival, health, hunger, saturation, exhaustion, experience orbs/levels, regeneration, fall damage, drowning, death and recoverable inventory drops. Broken blocks, mob kills and thrown stacks drop item entities that fall, merge and are picked up. The Java 36-slot inventory with cursor, drag-splitting, shift- and double-click rules; shaped crafting, a crafting table, a fuel-driven furnace and single/large chests on real slots; the tabbed creative inventory with search; wood, stone, iron, diamond and gold tools with per-item durability and repair; leather, chain, iron, gold and diamond armor. Original 1.7.10 block/item textures, HUD sprites, sun, moon and sound effects; hand swings, equip transitions, bobbing, eating, animated water, crack frames and entity shadows. Pigs, cows, sheep, chickens and night-time zombies with 1.7.10 movement, knockback, pathfinding and AI task lists, melee combat with sprint knockback and critical hits, and food drops. Cows and sheep follow wheat and breed, pigs follow carrots and breed, chickens follow seeds and lay eggs; sheep graze, can be sheared and dyed. Sneaking slows you, lowers the view and stops you at edges. Flowing water and lava spread, mix into obsidian, cobblestone and stone, and lava burns players, mobs and items; buckets pick up and place liquids and milk cows; lakes and springs generate; flowers grow and craft into 16 dyes for wool; snowballs and eggs can be thrown; ladders can be placed and climbed; F5 shows the player model with armor. Rain and thunderstorms follow the original weather timers, darken the sky and light, and bring lightning that strikes and starts fires; fire spreads through wood, wool and leaves and is lit with flint and steel. The Snowy Tundra landscape has snowfall, snow layers and ice. Bows draw and fire arrows, and skeletons shoot back at night and burn by day. Oak saplings grow into trees, with bone meal or over time, and leaves decay and drop saplings and apples. Java worlds now use the original biome layers, terrain surfaces, caves and ravines at 256-block height; trees, ores and structures are not generated there yet. Legacy landscapes keep their existing decoration. Torches; 1.7.10 sky/block light, smooth lighting, lightmap, sky, stars, fog and fancy clouds. Wheat, carrot and potato farming with five hoe tiers, moisture, eight growth stages, bone meal and harvesting; bread crafting and baked potatoes. Zombies rarely drop carrots, potatoes or iron when killed after a player hit. Creepers and TNT explode with block shielding, entity knockback, original puff/smoke effects and item drops; burning arrows light TNT and its fuse emits smoke. Sugar cane and cactus grow, paper/sugar/books craft, and sand/gravel fall and can be deflected by explosions.</p><span class="note-tag">MAJOR GAPS REMAIN</span><p>Java population/decorators and infinite chunk streaming, the complete block/item registry, most mobs and their full AI, other crops, advanced combat, enchantments, hoppers and other storage, redstone, dimensions, structures, other biomes, void fog, Java saves, and multiplayer. The renderer, terrain, entity AI and several interactions remain simplified. Original sounds and textures retain Mojang/Microsoft ownership.</p><div class="note-links"><a href="/research/textures-and-farming.md" target="_blank" rel="noopener">Textures & farming ↗</a><a href="/research/animations-and-sounds.md" target="_blank" rel="noopener">Animation & audio ↗</a><a href="/research/investigation.md" target="_blank" rel="noopener">Investigation ↗</a><a href="/research/items.md" target="_blank" rel="noopener">Item drops ↗</a><a href="/research/creative.md" target="_blank" rel="noopener">Creative inventory ↗</a><a href="/research/shadows.md" target="_blank" rel="noopener">Entity shadows ↗</a><a href="/research/fluids.md" target="_blank" rel="noopener">Flowing water ↗</a><a href="/research/third-person.md" target="_blank" rel="noopener">Third person ↗</a><a href="/research/sheep.md" target="_blank" rel="noopener">Sheep & wool ↗</a><a href="/research/projectiles.md" target="_blank" rel="noopener">Snowballs ↗</a><a href="/research/lava.md" target="_blank" rel="noopener">Lava ↗</a><a href="/research/buckets.md" target="_blank" rel="noopener">Buckets & lakes ↗</a><a href="/research/chickens.md" target="_blank" rel="noopener">Chickens & eggs ↗</a><a href="/research/dyes.md" target="_blank" rel="noopener">Flowers & dyes ↗</a><a href="/research/sneaking.md" target="_blank" rel="noopener">Sneaking & attacks ↗</a><a href="/research/pathfinding.md" target="_blank" rel="noopener">Pathfinding & AI ↗</a><a href="/research/weather.md" target="_blank" rel="noopener">Weather ↗</a><a href="/research/fire.md" target="_blank" rel="noopener">Fire ↗</a><a href="/research/snow.md" target="_blank" rel="noopener">Snow & ice ↗</a><a href="/research/bows.md" target="_blank" rel="noopener">Bows & skeletons ↗</a><a href="/research/crops.md" target="_blank" rel="noopener">Crops & pigs ↗</a><a href="/research/trees.md" target="_blank" rel="noopener">Saplings & trees ↗</a><a href="/research/ladders.md" target="_blank" rel="noopener">Ladders ↗</a><a href="/research/generation.md" target="_blank" rel="noopener">Java generation ↗</a><a href="/research/parity.md" target="_blank" rel="noopener">Feature coverage ↗</a><a href="https://github.com/morluto/rea" target="_blank" rel="noopener">REA ↗</a></div></div>`,
    "notes-modal",
  );
}
function settings() {
  modal(
    "Options",
    `<p class="modal-subtitle">Original Minecraft 1.7.10 effects. Your preferences stay on this device.</p><div class="settings-list"><label>GUI Scale<select id="gui-scale">${GUI_SCALE_NAMES.map((label,v)=>`<option value="${v}" ${Number(options.guiScale||0)===v?"selected":""}>${label}</option>`).join("")}</select></label><label>Difficulty<select id="difficulty">${DIFFICULTY_NAMES.map((label,v)=>`<option value="${v}" ${options.difficulty===v?"selected":""}>${label}</option>`).join("")}</select></label><label>Particles<select id="particles">${["All","Decreased","Minimal"].map((label,v)=>`<option value="${v}" ${options.particles===v?"selected":""}>${label}</option>`).join("")}</select></label><label>FOV <output id="fov-value">${optionLabel("fov",options.fov)}</output><input type="range" id="fov" min="30" max="110" step="1" value="${options.fov}"></label><label>Sensitivity <output id="sensitivity-value">${optionLabel("sensitivity",options.sensitivity)}</output><input type="range" id="sensitivity" min="0" max="1" step="0.005" value="${options.sensitivity}"></label><label class="switch-label">Invert Mouse<input type="checkbox" id="invertMouse" ${options.invertMouse ? "checked" : ""}></label><label class="switch-label" title="key.smoothCamera is unbound by default in 1.7.10; this switch stands in for the key and is not saved">Toggle Cinematic Camera<input type="checkbox" id="smooth-camera" ${smoothCamera ? "checked" : ""}></label><label>Render Distance <output id="distance-value">${optionLabel("distance",options.distance)}</output><input type="range" id="distance" min="2" max="16" step="1" value="${options.distance}"></label><label>Brightness <output id="gamma-value">${gammaLabel(options.gamma)}</output><input type="range" id="gamma" min="0" max="1" step=".01" value="${options.gamma}"></label>${SOUND_CATEGORIES.map(([k,label])=>`<label>${label}: <output id="sound-${k}-value">${optionLabel("volume",soundLevel(options.soundLevels,k))}</output><input type="range" id="sound-${k}" min="0" max="1" step=".01" value="${soundLevel(options.soundLevels,k)}"></label>`).join("")}<label class="switch-label">Sounds<input type="checkbox" id="sound" ${options.sound ? "checked" : ""}></label><label class="switch-label">View bobbing<input type="checkbox" id="bobbing" ${options.bobbing ? "checked" : ""}></label><button class="button secondary full" id="test-sound">Test original sound <span>♪</span></button><p class="form-note" id="audio-status" role="status">${esc(sounds.status)}</p></div>`,
  );
  for (const key of [
    "fov",
    "sensitivity",
    "distance",
    "gamma",
    "sound",
    "bobbing",
    "invertMouse",
  ])
    $("#" + key).oninput = (e) => {
      options[key] = ["sound", "bobbing", "invertMouse"].includes(key)
        ? e.target.checked
        : +e.target.value;
      const out = $("#" + key + "-value");
      if (out)
        out.textContent = key === "gamma" ? gammaLabel(options[key]) : optionLabel(key, options[key]);
      scene.camera.fov = options.fov;
      scene.camera.updateProjectionMatrix();
      scene.setDistance(renderDistanceBlocks(options.distance));
      scene.setGamma(options.gamma);
      try {
        localStorage.setItem("blockworld.settings", JSON.stringify(options));
      } catch {}
    };
  // GameSettings.setSoundLevel: store the level and regain playing sounds (SoundManager).
  for (const [k] of SOUND_CATEGORIES)
    $("#sound-" + k).oninput = (e) => {
      options.soundLevels = { ...options.soundLevels, [k]: +e.target.value };
      $("#sound-" + k + "-value").textContent = optionLabel("volume", options.soundLevels[k]);
      sounds.updateVolumes();
      try { localStorage.setItem("blockworld.settings", JSON.stringify(options)); } catch {}
    };
  $("#smooth-camera").onchange = (e) => { smoothCamera = e.target.checked; };
  $("#difficulty").onchange=e=>{options.difficulty=difficultySetting(+e.target.value);updateDifficulty();try{localStorage.setItem("blockworld.settings",JSON.stringify(options));}catch{}};
  $("#particles").onchange=e=>{options.particles=particleSetting(+e.target.value);updateParticleOptions();try{localStorage.setItem("blockworld.settings",JSON.stringify(options));}catch{}};
  $("#gui-scale").onchange=e=>{options.guiScale=+e.target.value&3;updateGuiScale();try{localStorage.setItem("blockworld.settings",JSON.stringify(options));}catch{}};
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
  active.arrows = arrows.serialize();
  // EntityTNTPrimed.writeEntityToNBT keeps only the fuse (plus Entity's position and motion).
  active.tnt = primed.map((e) => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse }));
  active.weather = weather.save();
  active.worldRandom = weather.saveSimulation();
  active.fluidTicks = fluids.save();
  active.fireTicks = fire.save();
  // Chunk.InhabitedTime (one value stands for every chunk; see difficulty.js).
  active.inhabited = inhabited.save(survival.time);
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
  active.falling=falling?.serialize()||[];
  active.fallingTicks = falling?.save();
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
// BlockBush.onNeighborBlockChange: flowers and crops drop when their support is lost.
// Fluids owns world.onChange, so this wraps it.
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER }, boneRandom = new JRandom(Date.now());
// Item.itemRand, the static Random of every Item.
const itemRand = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
// EntityLivingBase.deathTime of the client player, counted on the death screen.
let deathTime = 0;
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
    // BlockCrops.canBlockStay requires farmland beneath the plant.
    const cy=y+1,cb=world.get(x,cy,z);
    if(isCrop(cb)&&![29,30].includes(world.get(x,y,z))){
      const drops=cropDrops(cb,Math.random,world.getMeta(x,cy,z));
      world.set(x,cy,z,0);
      items.dropBlock(drops.map(d=>makeStack(d.id,d.count)),x,cy,z);
      scene.updateBlock(x,z,cy);
    }
    // BlockLadder.onNeighborBlockChange: a ladder whose wall is no longer a normal cube drops itself.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = x + dx, lz = z + dz;
      if (world.get(lx, y, lz) !== LADDER || ladderSupported(world, lx, y, lz)) continue;
      world.set(lx, y, lz, 0);
      items.dropBlock([makeStack(LADDER, 1)], lx, y, lz);
      scene.updateBlock(lx, lz, y);
    }
    // BlockSnow.onNeighborBlockChange: a layer that can no longer stand vanishes without a drop.
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const fx = x + dx, fy = y + dy, fz = z + dz;
      if (world.get(fx, fy, fz) !== SNOW_LAYER || !snowFalls(world, fx, fy, fz)) continue;
      world.set(fx, fy, fz, 0);
      scene.updateBlock(fx, fz, fy);
    }
  };
}
// WorldServer's weather edits (freezing, snowfall, melting) go through the same tracked set and relight path as the player's.
function applyWeatherEdit(w, x, y, z, block, meta) {
  const old = w.get(x, y, z);
  w.set(x, y, z, block, true, meta);
  scene.updateBlocks([[x, y, z, old, block]]);
  saved = false;
}
function launch(record) {
  try {
    active = record;
    world = new World(record.seed, record.biome, record.generationVersion ?? 1);
    world.restore(record.edits || []);
    // Restore World.rand before constructing the block runtimes that share it.
    weather = new Weather().restore(record.weather).restoreSimulation(record.worldRandom);
    scene.setWorld(world);
    // Block light for canBlockFreeze/canSnowAt/melting is the scene's light volume.
    world.blockLight = (x, y, z) => scene.light.blockAt(x, y, z);
    // Water washes away torches, wheat and tall grass (Block.dropBlockAsItem).
    fluids = new Fluids(world, { random: weather.random, fizz: (x, y, z, pitch) => sounds.play("random.fizz", { volume: 0.5, pitch, position: { x, y, z } }), wash: (x, y, z, b) => { const d = b === WEB ? [{ id: 321, count: 1 }] : b === 20 ? [{ id: 20, count: 1 }] : isFlower(b) ? [{ id: b, count: 1, damage: b === RED_FLOWER ? world.getMeta(x, y, z) : 0 }] : b === SAPLING ? [{ id: b, count: 1, damage: world.getMeta(x, y, z) & 7 }] : cropDrops(b,Math.random,world.getMeta(x,y,z)); if (d?.length) items.dropBlock(d.map((e) => makeStack(e.id, e.count, e.damage || 0)), x, y, z); } });
    fluids.load(record.fluidTicks);
    watchFlowers();
    // BlockFire and the static-lava ignition roll: scheduled and random ticks (fire.js). Fire reaches the
    // weather through a closure that follows the active world's runtime.
    // BlockTNT.func_150114_a for TNT that burns away (BlockFire.tryCatchFire, metadata 1, no placer).
    fire = new Fire(world, { weather: () => weather, stillLava: (x, y, z) => !fluids.pending.has(fluids.key(x, y, z, LAVA)), primeTnt: (x, y, z) => lightTnt(x, y, z, null) });
    fire.watch();
    // Saplings, tree growth and leaf decay (trees.js); it wraps world.onChange after the flowers do.
    trees = new Trees(world, {
      random: weather.random,
      light: (x, y, z) => (scene.light ? scene.light.level(x, y, z, scene.subtracted) : 15),
      apply: (changes) => { scene.updateBlocks(changes); saved = false; },
      drop: (stacks, x, y, z) => items.dropBlock(stacks.map((d) => makeStack(d.id, d.count, d.damage || 0)), x, y, z),
    }).watch();
    // Sugar cane and cactus support, growth and breaking (plants.js), then falling sand and gravel
    // (falling.js); both wrap world.onChange after the trees.
    plants = new Plants(world, {
      drop: (stacks, x, y, z) => items.dropBlock(stacks.map((d) => makeStack(d.id, d.count, d.damage || 0)), x, y, z),
      broken: (x, y, z, b, meta = 0) => { sound(false, b); scene.particles.destroyBlock(world, x, y, z, b, meta); },
      apply: (changes) => { scene.updateBlocks(changes); saved = false; },
    }).watch();
    // Entity.entityDropItem(stack, 0): EntityItem at the falling block's position, pickup delay 10.
    falling = new FallingBlocks(world, {
      drop: (stack, x, posY, z) => items.spawn(makeStack(stack.id, stack.count, stack.damage || 0), x, posY, z, { delay: 10 }),
      apply: (changes) => { scene.updateBlocks(changes); saved = false; },
    }, record.falling).watch();
    falling.load(record.fallingTicks);
    farming=new Farming(world,record.farms);
    // Rain moistens farmland (BlockFarmland.updateTick: canLightningStrikeAt(x, y + 1, z)).
    farming.rained = (x, y, z) => canLightningStrikeAt(weather, world, x, y + 1, z);
    weather.apply = applyWeatherEdit;
    fire.sharedRandomTicks = true;
    // One WorldServer random-tick stream: fire and still lava (fire.js), saplings and leaves (trees.js),
    // sugar cane and cactus (plants.js), then snow and ice melting in Weather.tickChunk itself.
    weather.blockTick = (x, y, z, b) => fire.randomTick(x, y, z, b) || trees.randomTick(x, y, z, b) || plants.randomTick(x, y, z, b);
    scene.weather = weather;
    // EntityLightningBolt's fire, and the ticks of the fires saved with the world.
    weather.fire = fire.strikes;
    fire.load(record.fireTicks);
    experience=new Experience(record.experience);xpOrbs=new ExperienceOrbs(record.xpOrbs);playerTicks=0;
    // Entity.isWet for orbs: rain only (EntityXPOrb.handleWaterMovement never sets inWater).
    xpOrbs.wet = (o) => isWet(weather, world, { x: o.x, y: o.posY, z: o.z, inWater: false }, 0.5);
    mobs = new EntityWorld(world, record.entities);
    mobs.fx = scene.fx;
    mobs.onLand = (entity, distance) => trampleFarmland(entity, distance);
    // World.getLightBrightness for EntityAI.getBlockPathWeight: daylight-reduced sky or block light.
    mobs.lightAt = (x, y, z) => (scene.light ? scene.light.level(x, y, z, scene.subtracted) : 15);
    // Entity.isWet: rain puts out burning mobs and stops zombies burning in the sun.
    mobs.wet = (e, height) => isWet(weather, world, e, height);
    // World.isDaytime (skylightSubtracted < 4) and Chunk.canBlockSeeTheSky for the skeleton's
    // sunburn and its sun tasks; EntitySkeleton's arrows come from bow.js.
    mobs.isDaytime = () => (scene.subtracted ?? 0) < 4;
    mobs.canSeeSky = (x, y, z) => canSeeSky(world, x, y, z);
    mobs.shoot = (e, target, scale) => arrows.skeletonShoot(e, target, scale, mobs.difficulty);
    // World.rand for EntityLiving.onSpawnWithEgg, and World.func_147462_b at a block.
    mobs.worldRandom = weather.random;
    mobs.localDifficulty = (x, y, z) => localDifficulty(mobs.difficulty, survival.time, inhabited.value, x >= 0 && z >= 0 && x < SIZE && z < SIZE && y >= 0 && y < world.height);
    arrows.wet = (a) => isWet(weather, world, { x: a.x, y: a.y, z: a.z, inWater: a.water }, 0.5);
    mobRenderer.clear();
    animation.reset();
    eating = null;
    stepDistance = 0;
    wasInWater = false;
    survival = new Survival(legacyPlayer(record), record.mode || "creative");
    // A new EntityPlayerMP is spawn-protected for 60 ticks (damage is refused, Creative or not).
    survival.protection = 60;
    inhabited = new InhabitedTime(record.inhabited, survival.time);
    updateDifficulty();
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
        p.y < world.height;
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
        ? Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch))
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
    primed = (Array.isArray(record.tnt) ? record.tnt : []).filter((t) => t && [t.x, t.y, t.z, t.vx, t.vy, t.vz, t.fuse].every(Number.isFinite)).map((t) => Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse }), { vx: t.vx, vy: t.vy, vz: t.vz }));
    tntRenderer?.clear();
    arrows.load(record.arrows);
    scene.setArrows(arrows.list);
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
    if (survival.health <= 0) die();
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
  if (survival.health <= 0) {
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
    `<div class="vital-row"><div class="hearts${survival.effects.has(POISON) ? ' poisoned' : ''}" aria-label="Health ${Math.ceil(survival.health)} of 20${survival.effects.has(POISON) ? ', Poison' : ''}">${hearts}</div><div class="hunger${survival.effects.has(HUNGER) ? ' afflicted' : ''}" aria-label="Hunger ${survival.food} of 20${survival.effects.has(HUNGER) ? ', Hunger effect' : ''}">${food}</div></div>${armorRow}${air}`;
  $("#damage-flash").classList.toggle("hurt", survival.hurtTime > 4);
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
  const f = smeltExperience(stack);
  let n = amount;
  if (f === 0) n = 0;
  else if (f < 1) {
    const raw = Math.fround(amount * f);
    n = Math.floor(raw);
    if (n < Math.ceil(raw) && Math.random() < raw - n) n++;
  }
  // SlotFurnace.onCrafting: at (posX, posY + 0.5, posZ + 0.5) of the player.
  xpOrbs.spawn(n, { x: position.x, y: position.y + 0.5, z: position.z + 0.5 });
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
// The client's hurt (status 2, fresh hits only) and death (status 3) sounds:
// EntityLivingBase.handleHealthUpdate, volume getSoundVolume() 1, pitch (r - r) * 0.2 + 1.
function playHurtSounds() {
  for (const name of survival.hurtSounds.splice(0))
    sounds.play(name, { volume: 1, pitch: (Math.random() - Math.random()) * 0.2 + 1 });
}
function die() {
  if (screen === "dead") return;
  playHurtSounds();
  // EntityPlayerMP.onDeath broadcasts the death message to chat at the moment of death.
  const message = survival.died && deathMessage(survival.lastDamage);
  survival.died = false;
  if (message) showChatLine(document, message);
  closeContainer();
  const reason = survival.lastDamage || "an accident";
  screen = "dead";
  deathTime = 0;
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
    survival = new Survival({ time, slots: [], furnaces: survival.furnaces, chests: survival.chests }, survival.mode);
    survival.protection = 60;
    updateDifficulty();
    experience=new Experience();
    position.copy(new THREE.Vector3(...Object.values(world.spawn())));
    previous.copy(position);
    playerBody.reset(position, yaw, pitch);
    velocity.set(0, 0, 0);
    fallDistance = 0;
    motion.inWeb = false;
    renderHotbar();
    renderVitals();
    resume();
    save();
  };
  $("#death-home").onclick = goHome;
}
// One weather tick: timers, lightning (flash, damage, sound) and the client's rain
// splashes and rain sound (see weather.js).
function tickWeather() {
  tickWeatherSimulation({ world, weather, mobs, survival }, position, PHYSICS.width, PHYSICS.height);
  weather.rainParticles(world, { x: position.x, y: position.y + PHYSICS.eye, z: position.z }, (kind, x, y, z) => scene.fx.addDirect(kind, x, y, z));
  for (const e of weather.drain()) {
    // Thunder is volume 10000 in vanilla, so it carries at any distance; the
    // rain loop and the explosion are placed where they happen.
    const far = e.sound === "ambient.weather.thunder";
    sounds.play(e.sound, { volume: Math.min(1, e.volume), pitch: e.pitch, position: far ? null : { x: e.x, y: e.y, z: e.z } });
  }
}
function tickSurvival(inWater, oldPosition, inLavaNow = false) {
  tickPlayerEnvironment({ world, weather, position, survival, motion, flying }, { inWater, inLavaNow }, {
    tickWeather,
    afterSurvival: () => {
      // Drowning bubbles and potion particles run before the block-collision tail.
      const posY = position.y + Math.fround(PHYSICS.eye);
      if (survival.drowned) {
        survival.drowned = false;
        drownBubbles(scene.fx, { x: position.x, y: posY, z: position.z, mx: velocity.x, my: velocity.y, mz: velocity.z }, playerRandom);
      }
      potionParticles(scene.fx, { x: position.x, y: posY, z: position.z, yOffset: Math.fround(PHYSICS.eye), width: PHYSICS.width, height: PHYSICS.height }, potionColor(survival.effects.active.values()), playerRandom);
    },
    fizz: () => sounds.play("random.fizz", { volume: 0.7, pitch: 1.6 + (Math.random() - Math.random()) * 0.4 }),
  });
  // Scheduled sand and gravel updates and the falling-block entities (WorldServer.tick).
  if (falling) {
    falling.tick();
    scene.setFalling?.(falling.entities);
  }
  // WorldClient.doVoidFogParticles: Block.randomDisplayTick around the viewer (torch and
  // furnace flames, fire smoke and crackle, water and lava particles, sounds and drips).
  displayTicks(world, Math.floor(position.x), Math.floor(position.y + PHYSICS.eye), Math.floor(position.z), {
    rand: scene.explosionParticles.worldRandom,
    fx: scene.fx,
    canStrike: (x, y, z) => canLightningStrikeAt(weather, world, x, y, z),
    lit: (x, y, z) => scene.litFurnaces.has(`${x},${y},${z}`),
    sound: (name, x, y, z, volume, pitch) => sounds.play(name, { volume, pitch, position: { x, y, z } }),
  });
  const movement = { world, position, survival, motion, grounded, fallDistance, landedFall };
  finishPlayerMovement(movement, { inWater, inLavaNow, oldPosition }, {
    trample: trampleFarmland,
    landingDust: (x, y, z, count) => scene.particles.landingDust(world, x, y, z, count, [position.x, position.y + PHYSICS.eye, position.z]),
  });
  ({ fallDistance, landedFall } = movement);
  tickEntitySimulation({ world, items, primed, projectiles, arrows, mobs, survival, position,
    width: PHYSICS.width, height: PHYSICS.height }, {
    maxStack: st => survival.inventory.maxStack(st),
    smoke: (x, y, z) => scene.explosionParticles.spawn("smoke", x, y, z),
    explodeTnt: explodeAt,
    itemPicked: ({ item }) => {
      sounds.play("random.pop", { volume: 0.2, pitch: ((Math.random() - Math.random()) * 0.7 + 1) * 2 });
      scene.drops.pickup(item, position);
      if (item.death && !items.items.some((e) => e.death)) toast("Recovered your dropped items.");
    },
    itemsCollected: () => { renderHotbar(); saved = false; },
    projectileTargets: () => mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height),
    projectileHit: e => e !== "player" && thrownHit(mobs, e, position),
    // EntityEgg.onImpact: hatched chicks join the mob list before mob events drain.
    projectileEvent: h => {
      if (h.sound) sounds.play(h.sound, { position: h.position, volume: h.volume, pitch: h.pitch });
      else if (mobs) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
    },
    handleEntityEvents,
    arrowOptions: () => ({ targets: arrowTargets(mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height), survival.creative),
      mobs, survival, player: position, igniteTnt: (x, y, z, placer) => {
        lightTnt(x, y, z, placer);
        if (world.set(x, y, z, 0)) scene.updateBlocks([[x, y, z, TNT, 0]]);
      } }),
    arrowsCollected: () => { renderHotbar(); saved = false; },
    flushArrows,
  });
  scene.setDrops(items.items);
  scene.setProjectiles(projectiles.balls, projectiles.particles);
  scene.setTime(survival.time);
  renderVitals();
  updateFurnace();
  if (survival.health <= 0) die();
}
// The sounds the arrows made (the bow's, the hits', the pickup's) and the arrows to draw.
function flushArrows() {
  for (const e of arrows.drain())
    sounds.play(e.sound, e.position ? { volume: e.volume, pitch: e.pitch, position: e.position } : { volume: e.volume, pitch: e.pitch });
  scene.setArrows(arrows.list);
}
// ItemBow.onPlayerStoppedUsing: the right button was let go after `eating.ticks` ticks of draw.
function releaseBowUse() {
  const draw = eating;
  if (!draw?.bow) return;
  eating = null;
  if (screen !== "playing" || heldId() !== BOW) return;
  if (releaseBow({ survival, arrows, ticks: draw.ticks, feet: position, yaw, pitch })) {
    flushArrows();
    renderHotbar();
    saved = false;
  }
}
function trampleFarmland(entity, distance) {
  const x = Math.floor(entity.x), y = Math.floor(entity.y - 0.2), z = Math.floor(entity.z);
  if (farming.trample(x, y, z, distance)) {
    applyFarmUpdates(farming.drain());
    saved = false;
  }
}
function applyFarmUpdates(updates){const chunks=new Set();for(const[x,y,z]of updates)chunks.add([Math.floor(x/16)*16,Math.floor(z/16)*16].join(','));for(const key of chunks)scene.buildChunk(...key.split(',').map(Number));}
// Shared synchronous event routing, also used immediately after player attacks/interaction.
function mobEventHooks() {
  return {
    sound: event => sounds.play(event.sound, { position: event.position, volume: event.volume, pitch: event.pitch }),
    explode: explodeAt,
    // EntityAIEatGrass: the edit already happened; level event 2001 updates its presentation.
    eatGrass: ({ x, y, z, block }) => {
      scene.updateBlock(x, z, y);
      sounds.play("dig." + blockSound(block), { position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, volume: 1, pitch: 0.8 });
      scene.particles.destroyBlock(world, x, y, z, block);
      saved = false;
    },
  };
}
function handleEntityEvents() {
  drainMobEvents({ mobs, xpOrbs, items }, mobEventHooks());
}
// EntityPlayer.updateItemUse for food: n "iconcrack" crumbs and random.eat from Entity.rand.
const playerEye = () => ({ x: position.x, y: position.y + Math.fround(PHYSICS.eye) + Math.fround(0.12), z: position.z, yaw: Math.fround(180 - (yaw * 180) / Math.PI), pitch: Math.fround((-pitch * 180) / Math.PI) });
// EntityPlayer.getBreakSpeed's isInsideOfMaterial(water) on the client player, whose posY is
// the eye (yOffset 1.62F) and getEyeHeight 0.12F.
const clientEyeInWater = () => eyeInWater(world, position.x, playerEye().y, position.z);
function eatEffects(id, n) {
  itemCrumbs(scene.fx, n, "iconcrack_" + id, playerEye(), playerRandom);
  sounds.play("random.eat", { volume: 0.5 + 0.5 * playerRandom.nextInt(2), pitch: (playerRandom.nextFloat() - playerRandom.nextFloat()) * 0.2 + 1 });
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
        scene.particles.destroyBlock(world, x, y, z, b, world.getMeta(x, y, z));
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
  // ItemBow.onItemRightClick (abm.a): with an arrow (or in Creative) the draw begins and
  // runs while the button is held (setItemInUse); nothing else happens, and no swing.
  if (place && id === BOW && !usesBlock) {
    if (!eating && canDraw(survival)) eating = { id: BOW, ticks: 0, bow: true };
    return;
  }
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
      // EntityPlayerSP.onCriticalHit after a successful critical: the Crit2FX emitter.
      if (critical) {
        const e = aimedEntity.entity;
        scene.fx.crit2(() => mobs.fxTarget(e));
      }
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
  // EntityCreeper.interact (xz.a(yz)): flint and steel plays fire.ignite at the creeper's
  // position + 0.5 (pitch 0.8 to 1.2), ignites it (datawatcher 18) and wears the item by 1.
  if (place && aimedEntity && item?.kind === "flint_and_steel" && aimedEntity.entity.type === "creeper" && aimedEntity.entity.health > 0) {
    const e = aimedEntity.entity;
    sounds.play("fire.ignite", { volume: 1, pitch: Math.random() * 0.4 + 0.8, position: { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 } });
    e.ignited = true;
    if (!survival.creative) survival.wear(id);
    reportBrokenTool();
    renderHotbar();
    saved = false;
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
    if(plantedBlock(id)){if((survival.creative||survival.count(id))&&target.adjacent?.[1]===y+1&&farming.plant(x,y,z,id)){if(!survival.creative)survival.take(id);applyFarmUpdates(farming.drain());renderHotbar();saved=false;return;}if(id===309)return;}
    // ItemDye.onItemUse: damage 15 (bone meal) fertilizes crops (Farming) and grass (BlockGrass.func_149853_b).
    if(id===DYE&&survival.held?.damage===15){
      if(!survival.creative&&!survival.count(id))return;
      let used=false;
      if(block===SAPLING){trees.boneMeal(x,y,z);used=true;}
      else if(block===1){for(const q of growGrass(world,FLOWERS,boneRandom,world.biome,x,y,z))scene.updateBlock(q[0],q[2],q[1]);used=true;}
      else if(farming.fertilize(x,y,z)){applyFarmUpdates(farming.drain());used=true;}
      if(used){if(!survival.creative)survival.inventory.decr(survival.inventory.current,1);renderHotbar();sounds.play('dig.grass',{volume:.4});saved=false;
        // Level event 2005 on the cell as it is now (BlockSapling 0.8 high, BlockCrops 0.25).
        const now=world.get(x,y,z);boneMealSparkles(scene.fx,now,x,y,z,now===SAPLING?Math.fround(0.8):isCrop(now)?Math.fround(0.25):1,itemRand);}
      return;
    }

    // BlockTNT.onBlockActivated (aob): flint and steel primes the block (func_150114_a with
    // metadata 1 and the player as placer), sets it to air and damages the item by 1.
    if (activates && block === TNT && item?.kind === "flint_and_steel") {
      lightTnt(x, y, z, "player");
      world.set(x, y, z, 0);
      farming.observe(x, y, z);
      scene.updateBlock(x, z, y);
      if (!survival.creative) survival.wear(id);
      reportBrokenTool();
      renderHotbar();
      saved = false;
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
    // ItemFlintAndSteel.onItemUse (acw.a): the cell on the clicked face, if it is air, gets fire with
    // fire.ignite (volume 1, pitch 0.8 to 1.2); the item always loses 1 durability (not in Creative).
    if (item?.kind === "flint_and_steel") {
      const q = target.adjacent;
      if (!q || q[1] === 0 || q[1] >= (world.height === 256 ? 256 : world.height - 1) || !world.inside(...q)) return;
      if (world.get(...q) === 0) {
        sounds.play("fire.ignite", { volume: 1, pitch: Math.random() * 0.4 + 0.8, position: { x: q[0] + 0.5, y: q[1] + 0.5, z: q[2] + 0.5 } });
        fire.ignite(...q);
        scene.updateBlocks(fire.drain());
      }
      if (!survival.creative) survival.wear(id);
      reportBrokenTool();
      renderHotbar();
      saved = false;
      return;
    }
    if (!survival.creative && item?.food) {
      beginEating(id);
      return;
    }
    // ItemSnow.onItemUse: the snow item clicked on a layer below full height adds a layer there.
    const here = target.block, hereMeta = block === SNOW_LAYER ? world.getMeta(...here) : 0, stacked = stackedSnowMeta(hereMeta);
    if (id === SNOW_LAYER && block === SNOW_LAYER && stacked !== null && (survival.creative || survival.count(id))) {
      world.set(...here, SNOW_LAYER, false, stacked);
      if (collides(world, ...position.toArray())) {
        world.set(...here, SNOW_LAYER, false, hereMeta);
        toast("Give yourself a little room to build.");
        return;
      }
      world.set(...here, SNOW_LAYER, true, stacked);
      if (!survival.creative) survival.take(id);
      scene.updateBlock(here[0], here[2], here[1]);
      renderHotbar();
      sounds.play("dig.snow", { position: { x: here[0] + 0.5, y: here[1] + 0.5, z: here[2] + 0.5 }, volume: 1, pitch: 0.8 });
      saved = false;
      return;
    }
    // ItemReed.onItemUse (abi.a): sugar cane goes in a one-layer snow or tall-grass cell, otherwise
    // on the clicked face, where the cell is replaceable and BlockReed.canPlaceBlockAt holds.
    if (id === REEDS_ITEM) {
      const q = reedTarget(world, here, target.adjacent);
      if (!q || q[1] === 0 || q[1] >= (world.height === 256 ? 256 : world.height - 1) || !world.inside(...q)) return;
      if (!survival.creative && !survival.count(id)) return;
      if (!canPlaceReeds(world, ...q)) return;
      world.set(...q, REEDS, true, 0);
      if (!survival.creative) survival.take(id);
      scene.updateBlock(q[0], q[2], q[1]);
      renderHotbar();
      sound(true, REEDS);
      saved = false;
      return;
    }
    // ItemBlock.onItemUse: a one-layer snow cell is replaced in place (the side becomes "top").
    const p = block === SNOW_LAYER && !hereMeta ? [...here] : target.adjacent;
    if (!p || p[1] === 0 || p[1] >= (world.height === 256 ? 256 : world.height - 1) || !world.inside(...p)) return;
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
    // BlockSapling.canPlaceBlockAt (BlockBush): grass, dirt or farmland below; BlockBush.canBlockStay has no light test in 1.7.10.
    if (id === SAPLING && !saplingCanStay(world, ...p)) return;
    // BlockSnow.canPlaceBlockAt: never on ice, otherwise leaves, a full layer or an opaque cube.
    if (id === SNOW_LAYER && !snowCanStay(world, ...p)) return;
    // BlockLadder.canPlaceBlockAt: a normal cube beside the cell; onBlockPlaced picks the wall from the clicked face.
    if (id === LADDER && !canPlaceLadder(world, ...p)) return;
    // BlockCactus.canPlaceBlockAt: nothing solid beside it, cactus or sand below.
    if (id === CACTUS && !cactusCanPlace(world, ...p)) return;
    const old = world.get(...p), oldMeta = world.getMeta(...p),
      meta = id === WOOL || id === RED_FLOWER || id === 2 || id === 6 || id === 56 || id === 58 ? survival.held?.damage || 0 : id === 5 ? placedLeavesMeta() : id === LADDER ? placedLadderMeta(world, ...p, clickedSide(target.block, p)) : 0;
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
    // World.extinguishFire (ahb.a(yz, x, y, z, side)), called when the hit starts: fire on the clicked
    // face is put out with a hiss (aux 1004: random.fizz, volume 0.5, pitch 2.6 +- 0.8). Creative stops
    // there (ItemInWorldManager.onBlockClicked); Survival goes on to dig the block.
    const burning = target.adjacent;
    if (burning && world.get(...burning) === FIRE && (survival.creative || !(mining && mining.block.every((v, i) => v === target.block[i])))) {
      fire.extinguish(...burning);
      sounds.play("random.fizz", { volume: 0.5, pitch: 2.6 + (Math.random() - Math.random()) * 0.8, position: { x: burning[0] + 0.5, y: burning[1] + 0.5, z: burning[2] + 0.5 } });
      scene.updateBlocks(fire.drain());
      saved = false;
      if (survival.creative) {
        mineCooldown = 5;
        return;
      }
    }
    // Creative breaks bedrock (Building Blocks lists it), the floor at y 0 included.
    if (block === 11 && !survival.creative) return;
    if (survival.creative) {
      if(item?.kind==='sword')return;
      breakBlock(target.block, true);
      mineCooldown = 5;
      return;
    }
    if(mining&&mining.tool===id&&mining.block.every((v,i)=>v===target.block[i]))return;
    const under=clientEyeInWater();
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
// BlockTNT.func_150114_a: an EntityTNTPrimed at the block centre (fuse 80) and
// game.tnt.primed (volume 1, pitch 1). `placer` is "player" or null.
function lightTnt(x, y, z, placer) {
  const e = primeTnt(x + 0.5, y + 0.5, z + 0.5, { placer });
  primed.push(e);
  sounds.play("game.tnt.primed", { volume: 1, pitch: 1, position: { x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z } });
  saved = false;
}
// World.newExplosion(exploder, x, y, z, size, false, true) on the integrated server:
// Explosion.doExplosionA (rays in explosion.js; orchestration in explosion-simulation.js),
// then doExplosionB(true). DamageSource.setExplosionSource names the attacker: the creeper
// itself, or the TNT's placer. The block edits run through world.set like breakBlock:
// containers spill, farmland and crops update, and the edits are saved.
function explodeAt(x, y, z, size, { exploder = null, attacker = null } = {}) {
  applyExplosion({ world, weather, mobs, items, xpOrbs, arrows, projectiles, falling, primed,
    survival, position, velocity, farming }, { x, y, z, size, exploder, attacker }, {
    brokenTool: reportBrokenTool,
    burst: (...args) => scene.explosionParticles.burst(...args),
    sound: (name, options) => sounds.play(name, options),
    updateBlocks: changes => scene.updateBlocks(changes),
    syncChests: () => chestRenderer.sync(world, survival.chests),
    renderVitals,
    markDirty: () => { saved = false; },
  });
}
function breakBlock(p, creative = false) {
  return breakPlayerBlock({ world, survival, items, xpOrbs, farming, trees, heldTool: heldId() }, p, {
    creative,
    updateBlock: (x, z, y) => scene.updateBlock(x, z, y),
    renderHotbar,
    playBlockSound: sound,
    destroyParticles: (...args) => scene.particles.destroyBlock(...args),
    markUnsaved: () => { saved = false; },
  });
}
// Block.getItem for middle-click: farmland gives dirt, crops give seeds, water nothing.
const pickItem = (block) => (block === 29 || block === 30 ? 2 : block === REEDS ? REEDS_ITEM : isCrop(block) ? cropItem(block) : !isLiquid(block) && ITEMS[block] ? block : 0);
// EntityPlayer.dropOneItem: Q throws one item, Ctrl + Q the whole stack.
function dropHeld(all) {
  const inv = survival.inventory, s = inv.held;
  if (!s) return;
  throwStacks([inv.decr(inv.current, all ? s.count : 1)]);
  eating = null;
  renderHotbar();
}
// EntityLivingBase.renderBrokenItemStack plays the break sound and throws 5 crumbs of it.
function reportBrokenTool() {
  if (!survival.broken) return;
  sounds.play("random.break", { volume: 0.8, pitch: 0.8 + Math.random() * 0.4 });
  itemCrumbs(scene.fx, 5, "iconcrack_" + survival.broken, playerEye(), playerRandom);
  toast("Your " + (ITEMS[survival.broken]?.name || "tool").toLowerCase() + " broke.");
  survival.broken = 0;
  renderHotbar();
}
// Minecraft.sendClickBlockToController: PlayerControllerMP.onPlayerDamageBlock, then
// EffectRenderer.addBlockHitEffects on the face being hit every tick the button is held on
// a block, during the hit delay and in Creative too; a block broken this tick is air by then.
function tickMining() {
  const state = { playing: screen === "playing", mineHeld, target, aimedEntity, mining,
    cooldown: mineCooldown, survival, heldTool: heldId(), grounded };
  tickPlayerMining(state, {
    getBlock: (x, y, z) => world.get(x, y, z),
    eyeInWater: clientEyeInWater,
    edit: place => {
      edit(place);
      // edit can start mining or break instantly; keep its mutations in this same tick.
      return { mining, cooldown: mineCooldown };
    },
    swing: () => animation.swing(),
    digSound: type => sounds.play("dig." + blockSound(type), { volume: 0.25, pitch: 0.5 }),
    breakBlock,
    hitParticles: (x, y, z, side) => scene.particles.hitBlock(world, x, y, z, side),
  });
  mining = state.mining;
  mineCooldown = state.cooldown;
}
function movementTick(controls) {
  const state = { world, position, previous, velocity, motion, survival, yaw, eating,
    grounded, collidedH, flying, fallDistance, landedFall };
  const { inWater, inLavaNow, sneakOnGround, oldPosition } = movePlayer(state, controls, toast);
  ({ grounded, collidedH, flying, fallDistance, landedFall } = state);
  walkFrozen = sneakOnGround;
  $("#movement-label").textContent = flying
    ? "FLYING"
    : inWater
      ? "SWIMMING"
      : "WALKING";
  tickSurvival(inWater, oldPosition, inLavaNow);
  tickBlockSystems({ farming, fluids, fire },
    { time: survival.time, daylight: scene.daylight, x: position.x, z: position.z },
    { farming: applyFarmUpdates, fluids: changes => scene.updateBlocks(changes), fire: changes => scene.updateBlocks(changes) });
  scene.setFurnaces(survival.furnaces);
  tickChests();
  const living = { world, position, survival, inhabited, mobs, xpOrbs, experience, items,
    playerTicks, width: PHYSICS.width, height: PHYSICS.height };
  playerTicks = tickLivingSimulation(living, {
    ...mobEventHooks(),
    heldItem: heldId,
    levelUpSound: volume => sounds.play("random.levelup", { volume, pitch: 1 }),
    experienceCollected: () => { renderVitals(); saved = false; },
    orbSound: s => sounds.play(s.name, { volume: s.volume, pitch: s.pitch,
      position: s.name === "random.orb" ? undefined : { x: s.x, y: s.y, z: s.z } }),
  });
  // Entity.moveEntity: the vertical part of the move counts only with a ladder 0.2 below the feet.
  const onLadderStep = !flying && countsVertical(world, position.x, position.y, position.z);
  const distance = Math.hypot(
    position.x - oldPosition.x,
    onLadderStep ? position.y - oldPosition.y : 0,
    position.z - oldPosition.z,
  );
  if (!sneakOnGround) stepDistance += distance;
  // Entity.handleWaterMovement: the splash volume follows the entry speed.
  if (inWater && !wasInWater) {
    const s = enterWater(scene.fx, { x: position.x, z: position.z, minY: position.y, width: PHYSICS.width, mx: velocity.x, my: velocity.y, mz: velocity.z }, playerRandom);
    sounds.play("game.player.swim.splash", { volume: s.volume, pitch: s.pitch });
  }
  wasInWater = inWater;
  if (stepDistance > 1.667 && (grounded || inWater || onLadderStep) && !flying) {
    stepDistance = 0;
    const b = onLadderStep ? LADDER : world.get(
      Math.floor(position.x),
      Math.floor(position.y - 0.05),
      Math.floor(position.z),
    );
    sounds.play(inWater ? "game.player.swim" : "step." + stepSound(b), {
      volume: inWater ? 0.3 : 0.22,
    });
  }
  playHurtSounds();
  eating = tickPlayerItemUse(eating, heldId(), survival, {
    foodEffects: eatEffects,
    finishDrinking,
    sound: (name, options) => sounds.play(name, options),
    renderHotbar,
    markUnsaved: () => { saved = false; },
    random: Math.random,
  }).use;
  if (survival.health <= 0) die();
  // EntityRenderer.updateFovModifierHand: once a tick, toward getFOVMultiplier (flight, sprint, bow).
  easeFov(bowFovState, fovMultiplier({ flying, sprinting: motion.sprinting, bow: eating?.bow ? bowFov(eating.ticks) : 1 }));
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
      (!["meadow", "alpine", "island", "snowy"].includes(data.biome) && !isJavaLandscape(data.biome))
    )
      throw new Error("Choose a Blockworld export file");
    const check = new World(data.seed, data.biome, data.generationVersion ?? 1);
    check.restore(data.edits);
    const record = {
      ...makeRecord(data),
      ...importedRuntime(data),
      edits: [...check.edits],
      generationVersion: data.generationVersion ?? 1,
      mode: data.mode === "survival" ? "survival" : "creative",
      player: new Survival(legacyPlayer(data), data.mode).serialize(),
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
  // Ctrl is the 1.7.10 sprint key, so Ctrl with a movement key must not reach the browser
  // (Ctrl+W still closes the tab in some browsers; double-tapping W sprints as well).
  if (["Space", "Tab", "KeyW", "KeyA", "KeyS", "KeyD", "F3", "F5"].includes(e.code) || (e.ctrlKey && !e.metaKey && /^Key[A-Z]$|^Space$/.test(e.code)))
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
        survival.inventory.pick(id, survival.creative, id === WOOL || id === RED_FLOWER || id === 2 || id === 6 || id === 56 || id === 58 ? world.getMeta(...target.block) : undefined);
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
    if (e.button === 2) releaseBowUse();
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
      // Gathered until the frame applies it (MouseHelper.mouseXYChange); CSS pixels, y down.
      mouseDelta.x += dx;
      mouseDelta.y += dy;
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
      updateParticleOptions();
      // --- Block particles (particles.js): Entity.onEntityUpdate's sprint particle uses the
      // pre-move position, last tick's motion and in-water flag, before movementTick moves the
      // player; EffectRenderer.updateEffects then runs after this tick's spawns. ---
      if (motion.sprinting) spawnRunningParticles(scene.particles, world, { x: position.x, y: position.y, z: position.z, mx: velocity.x, mz: velocity.z, sprinting: true, inWater: wasInWater, ySize: motion.ySize }, playerRandom, [position.x, position.y + PHYSICS.eye, position.z]);
      movementTick(captureMovementInput(keys));
      scene.effectRenderer.tick(world);
      // The model stands at posY - yOffset, and posY is lowered by ySize (the sneak drop).
      const lowered = (p, drop) => ({ x: p.x, y: p.y - drop, z: p.z });
      playerBody.tick({ position: lowered(position, motion.ySize), previous: lowered(previous, motion.prevYSize), yaw, pitch, swinging: animation.swingTime < SWING_SECONDS });
      // EntityRenderer.updateRenderer: the cinematic camera filters advance once per tick.
      mouseLook.tick(options.sensitivity, smoothCamera);
      accumulator -= PHYSICS.tick;
    }
    const t = accumulator / PHYSICS.tick;
    // EntityRenderer.updateCameraAndRender: this frame's mouse movement turns the player while the
    // game has focus (mouse-look.js: sensitivity curve, invertMouse, smoothCamera, +-90 degree pitch).
    if (screen === "playing") {
      const [turnYaw, turnPitch] = mouseLook.frame(mouseDelta.x, -mouseDelta.y, t, { sensitivity: options.sensitivity, invertMouse: options.invertMouse, smoothCamera });
      ({ yaw, pitch } = setAngles({ yaw, pitch }, turnYaw, turnPitch));
    }
    mouseDelta.x = mouseDelta.y = 0;
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
    pose.meta = pose.item === WOOL || pose.item === RED_FLOWER || pose.item === DYE || [2,6,56,58].includes(pose.item) ? survival.held?.damage || 0 : 0;
    const b = pose.bob;
    scene.camera.position.x += b.x * Math.cos(yaw);
    scene.camera.position.z -= b.x * Math.sin(yaw);
    scene.camera.position.y += b.y;
    const hurt =
      (Math.sin(Math.pow(survival.hurtTime / 10, 4) * Math.PI) *
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
    if (target) {
      // setBlockBoundsBasedOnState: a snow layer's box is (meta + 1) / 8 high and a ladder's is its
      // plate; other blocks keep the full cube here. The outline is the box grown by 0.002.
      const b = world.get(...target.block), meta = world.getMeta(...target.block),
        [x0, y0, z0, x1, y1, z1] = b === SNOW_LAYER ? [0, 0, 0, 1, snowSelectionHeight(meta), 1] : b === LADDER ? ladderBounds(meta) : b === CACTUS ? CACTUS_SELECTION : b === REEDS ? REED_BOUNDS : [0, 0, 0, 1, 1, 1];
      scene.outline.scale.set((x1 - x0 + 0.004) / 1.004, (y1 - y0 + 0.004) / 1.004, (z1 - z0 + 0.004) / 1.004);
      scene.outline.position.set(target.block[0] + (x0 + x1) / 2, target.block[1] + (y0 + y1) / 2, target.block[2] + (z0 + z1) / 2);
    }
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
  } else if (screen === "dead") {
    // GuiGameOver does not pause the game. Here only EntityLivingBase.onDeathUpdate and the
    // particles keep ticking (the rest of the world waits on the death screen): at deathTime
    // 20 the client player, still 0.6 x 1.8 (onDeath's setSize runs on the server), goes up
    // in 20 "explode" from posY, which is its eye.
    accumulator += dt;
    while (accumulator >= PHYSICS.tick) {
      if (++deathTime === 20) burst(scene.fx, "explode", 20, { x: position.x, y: position.y + Math.fround(PHYSICS.eye), z: position.z, width: PHYSICS.width, height: PHYSICS.height }, playerRandom);
      scene.effectRenderer.tick(world);
      accumulator -= PHYSICS.tick;
    }
    // EntityRenderer.hurtCameraEffect: a dead view rolls 40 - 8000 / (deathTime + partial + 200)
    // degrees about the view axis (the same sign convention as the hurt tilt and view bob).
    const roll = ((40 - 8000 / (deathTime + accumulator / PHYSICS.tick + 200)) * Math.PI) / 180;
    scene.camera.rotation.z = roll;
  } else if (screen === "home") scene.preview(elapsed);
  const partial = Math.min(1, accumulator / PHYSICS.tick);
  if (mobs) mobRenderer.update(mobs.entities,dt,partial);
  tntRenderer?.update(screen === "home" ? [] : primed, partial);
  playerRenderer?.update(playerBody, partial, {
    visible: thirdPersonView > 0 && ["playing", "inventory", "paused"].includes(screen),
    swing: animate.pose ? (animate.pose.progress < 1 ? animate.pose.progress : 0) : 0,
    armor: survival?.inventory?.armor ?? [],
    held: heldId(),
    heldDamage: survival.held?.damage || 0,
    hurt: survival.hurtTime > 0,
    sneak: motion.sneaking,
  });
  chestRenderer?.update(screen === "playing" || screen === "inventory" ? accumulator / PHYSICS.tick : 1);
  if(xpRenderer)xpRenderer.update(xpOrbs.orbs,partial);
  scene.dropPartial = partial;
  scene.particleView = { yaw, pitch, mirror: thirdPersonView === 2 };
  scene.setShadows(screen === "home" ? [] : shadowCasters(scene.dropPartial), { x: position.x, y: position.y + PHYSICS.eye, z: position.z });
  // EntityRenderer.getFOVModifier multiplies the field of view by the eased modifier.
  const fov = options.fov * (bowFovState.prev + (bowFovState.cur - bowFovState.prev) * partial);
  if (Math.abs(scene.camera.fov - fov) > 1e-9) {
    scene.camera.fov = fov;
    scene.camera.updateProjectionMatrix();
  }
  scene.render(elapsed, dt);
  if (firstPerson && animate.pose)
    firstPerson.render(animate.pose, {
      visible: thirdPersonView === 0 && ["playing", "inventory", "paused"].includes(screen),
      light: scene.brightness(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z),
      view: scene.camera,
      time: elapsed,
      eating: eating && !eating.bow ? Math.max(0,eating.ticks-accumulator/PHYSICS.tick) : null,
      // The bow's icon follows the whole ticks of draw; its pull uses the ticks - 1 + partial.
      bow: eating?.bow ? { stage: bowStage(eating.ticks), draw: eating.ticks - 1 + partial } : null,
    });
}
// Entities that cast a shadow, as Java positions: an item's posY is 0.125
// above its box (yOffset); items, orbs and mobs are interpolated like their
// renderers, with `pos` the tick position for the shadow's distance test.
function shadowCasters(partial) {
  const list = [], lerp = (a, b) => a + (b - a) * partial;
  for (const e of items.items)
    if (e.stack) list.push({ ...SHADOWS.item, x: lerp(e.px, e.x), y: lerp(e.py, e.y) + 0.125, z: lerp(e.pz, e.z), pos: { x: e.x, y: e.y + 0.125, z: e.z }, height: 0.25 });
  // RenderTNTPrimed: shadowSize 0.5 under the box (posY is its centre).
  for (const e of primed) list.push({ ...SHADOWS.tnt, x: lerp(e.px, e.x), y: lerp(e.py, e.y) + TNT_Y_OFFSET, z: lerp(e.pz, e.z), pos: { x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z }, height: TNT_SIZE });
  for (const o of xpOrbs.orbs) list.push({ ...SHADOWS.orb, x: lerp(o.px, o.x), y: lerp(o.py, o.y) + 0.25, z: lerp(o.pz, o.z), pos: { x: o.x, y: o.posY, z: o.z }, height: 0.5 });
  // The local player casts a shadow only when it is on screen.
  if (thirdPersonView > 0) list.push(playerShadowCaster(position, previous, partial, SHADOWS.player, motion.prevYSize, motion.ySize));
  for (const e of mobs?.entities ?? []) {
    const child = e.growingAge < 0;
    // RendererLivingEntity passes Render.doRenderShadowAndFire no shadow for an invisible mob.
    if (SHADOWS[e.type] && !isInvisible(e)) list.push({ ...SHADOWS[e.type], x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z), pos: e, height: ENTITY_TYPES[e.type].height * (child ? 0.5 : 1), child });
  }
  return list;
}
async function boot(){try {
  scene = new VoxelScene($("#viewport"));
  scene.weather = weather;
  projectiles.useEffects(scene.effectRenderer);
  projectiles.spawner = scene.fx;
  arrows.fx = scene.fx;
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
  tntRenderer = new TntRenderer(scene.scene, scene);
  document.addEventListener("pointerdown", () => sounds.unlock(), {
    once: true,
  });
  world = new World("Overworld");
  scene.setWorld(world);
  scene.camera.fov = options.fov;
  scene.camera.updateProjectionMatrix();
  scene.setDistance(renderDistanceBlocks(options.distance));
  scene.setGamma(Number(options.gamma) || 0);
  updateParticleOptions();
  setupPointer();
  // Development-only handle for browser checks; Vite strips it from builds.
  if (import.meta.env.DEV)
    window.__mc = { scene, get survival() { return survival; }, get world() { return world; }, position, velocity, motion, get flying() { return flying; }, get grounded() { return grounded; }, look(p, y) { pitch = p; yaw = y; }, view(n) { thirdPersonView = n; }, playerBody, teleport(x, y, z) { position.set(x, y, z); }, items, projectiles, arrows, get mobs() { return mobs; }, breakBlock, get weather() { return weather; }, get fire() { return fire; }, get trees() { return trees; }, get plants() { return plants; }, get falling() { return falling; }, get primed() { return primed; }, get xpOrbs() { return xpOrbs; }, get experience() { return experience; }, explodeAt, lightTnt };
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
