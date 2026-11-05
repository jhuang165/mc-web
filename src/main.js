import { isStemCake, popDrops } from './stems-cake.js';
import { StreamStorage } from './streaming-storage.js';
import { isColoredBlock, carpetNeighbourChange, coloredPickDamage, COLORED_ITEM_OFFSET, CARPET } from './colored-blocks.js';
import { ContainerResidency } from './container-residency.js';
import { acquireWorldWriter } from './world-lock.js';
import { readWorldShelf, writeWorldShelf, deleteStoredWorld, readChunkEdits, readRuntimeState } from './world-storage.js';
import {PopulationBlocks} from './population-blocks.js';
import {hasSavedStructures as hasSavedPopulation} from './structure-simulation.js';
import {restorePopulation,restorePopulationColumns} from './population-runtime.js';
import {setPopulationBlockMapper} from './population-world.js';
import {isJavaLandscape, streamedWorldType} from "./java-world.js";
import { particleSetting } from "./particle-settings.js";
import "./style.css";
import "./minecraft-ui.css";
import "./container-ui.css";
import "./menu-screens.css";
import { Gui } from "./menu-ui.js";
import { createMenus } from "./menus.js";
import { folderName } from "./menu-screens.js";
import { canGoEndless, endlessCopy } from "./endless-world.js";
import {guiScale,stackCount,durabilityBar,tooltipLines,anvilName,anvilCost,pendingContainerStacks,withGlint,itemTint} from "./gui.js";
import { stackHasEffect } from "./armor-enchantments.js";
import {AnvilContainer,nativeStackToLive} from './anvil-container.js';
import {EnchantingContainer} from './enchanting-container.js';
import {MerchantContainer,merchantDecorationsHtml,offerItemAt} from './merchant-ui.js';
import {villagerInteract,villagerClearCustomer,villagerOffers,villagerUseRecipe,villagerHover} from './villager.js';
import {withinEnchantReach} from './enchanting-table.js';
import {damagedAnvilMetadata,ANVIL_DAMAGE_CHANCE} from './anvil.js';
import {treePickDamage} from './wood-types.js';
import { migrateSettings, renderDistanceBlocks, SOUND_CATEGORIES, soundLevel } from "./settings.js";
import { MouseLook, setAngles } from "./mouse-look.js";
import * as THREE from "three";
import {
  World,
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
  ANVIL,
  ENCHANTING_TABLE,
  WOODEN_DOOR,
  IRON_DOOR,
  BED,
  PUMPKIN,
} from "./world.js";
import { Plants, REEDS_ITEM, REED_BOUNDS, CACTUS_SELECTION } from "./plants.js";
import { FallingBlocks } from "./falling.js";
import { ladderBounds, ladderSupported, countsVertical } from "./ladders.js";
import { snowFalls } from "./snow.js";
import { flowerCanStay, JRandom } from "./flowers.js";
import { Trees } from "./trees.js";
import { VoxelScene } from "./scene.js";
import { SoundBank } from "./audio.js";
import { breakSound, placeSound, hitSound, footstepSound, placesSilently } from "./block-sounds.js";
import { Weather, isWet, canLightningStrikeAt } from "./weather.js";
import { tickWeatherSimulation } from "./weather-simulation.js";
import { PlayerAnimation, SWING_SECONDS } from "./animation.js";
import { PlayerBody, PlayerRenderer, nextView, thirdPersonCamera, playerShadowCaster } from "./player-renderer.js";
import { FirstPerson, itemTexture } from "./first-person.js";
import { InventoryPlayerView, PAPERDOLL_LAYOUTS } from "./inventory-player.js";
import {Experience,ExperienceOrbs,smeltExperience} from "./experience.js";
import {ExperienceRenderer} from "./experience-renderer.js";
import {plantedBlock,cropItem} from './crops.js';
import {Farming,cropDrops} from "./farming.js";
import { EntityWorld, ENTITY_TYPES, HOSTILE, heldAttackDamage, pushBox } from "./entities.js";
import { BedSleep, BED_DIR, BED_TEXT, Beds, activateBed, bedRespawnPosition, nextMorning, verifyRespawn } from "./bed.js";
import { deathMessage, showChatLine, PLAYER_NAME } from "./death-messages.js";
import { ChatUi, printChat } from "./chat-ui.js";
import { createCommandRunner, chatLine, tr } from "./commands.js";
import { LanSession, LAN_NOTICE } from "./lan.js";
import { createCommandHost, ruleOn } from "./command-host.js";
import { gameRule, setGameRuleSource } from "./game-rules.js";
import { mayHitBlock } from "./adventure.js";
import { SHADOWS } from "./shadows.js";
import { MobRenderer } from "./mob-renderer.js";
import { ChestRenderer } from "./chest-renderer.js";
import { CHEST, settleFacing, chestPair, tickLid } from "./chest.js";
import { isChestBlock, ENDER_CHEST, newEnderTile, enderDisplayParticles } from "./chest-blocks.js";
import { DISPENSER, DROPPER, PISTON_HEAD, isDispenserPiston, itemForBlock, headBaseId } from "./dispenser-piston.js";
import { DispenserContainer, DISPENSER_TITLE } from "./dispenser-container.js";
import { HopperContainer, Hoppers, HOPPER } from "./hopper.js";
import { Survival, ITEMS, burnTime, gameModeOf } from "./survival.js";
import { stackName } from "./item-names.js";
import { ContainerScreen, makeStack, copyStack } from "./inventory.js";
import { CreativeScreen, CREATIVE_TABS, SEARCH, SURVIVAL_TAB, tabArea, itemTab, GUI_WIDTH } from "./creative.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { Fishing } from "./fishing-simulation.js";
import { FISHING_ROD } from "./fishing-content.js";
import { WitchPotions } from "./witch-potions.js";
import {impactPlayerPearl} from './pearl-player.js';
import { Arrows, arrowTargets, bowStage, bowFov, easeFov, ARROW } from "./bow.js";
import { canSeeSky } from "./weather.js";
import { Fluids, eyeInWater } from "./fluids.js";
import { Fire } from "./fire.js";
import { difficultySetting, localDifficulty, InhabitedTime } from "./difficulty.js";
import { isInvisible } from "./mob-effects.js";
import { PortalTimer, splashBreak, NIGHT_VISION, BLINDNESS, NAUSEA, INVISIBILITY } from "./potion-fx.js";
import { primeTnt, TNT_SIZE, TNT_Y_OFFSET } from "./explosion.js";
import { TntRenderer } from "./tnt-renderer.js";
import { finishDrinking as finishBucketDrinking } from "./buckets.js";
import { finishDrinkingItem } from "./potion-use.js";
import { potionColor as damageColor, POTION_TYPES, durationString } from "./potions.js";
import { BREWING_STAND, brewingView, bubbleHeight } from "./brewing.js";
import { BrewingContainer } from "./brewing-container.js";
const finishDrinking = (player) => finishDrinkingItem(player, finishBucketDrinking);
import { captureBucketTarget } from "./buckets-simulation.js";
import { HUNGER, POISON } from "./status-effects.js";
import { PlayerMotion, fovMultiplier } from "./player-movement.js";
import { spawnRunningParticles, freshRandom } from "./particles.js";
import { enterWater, drownBubbles, burst, potionColor, potionParticles, itemCrumbs, boneMealSparkles } from "./fx.js";
import { JavaRandom } from "./lighting.js";
import { vitalsLayout, heartsHtml, foodHtml, REGENERATION, WITHER_EFFECT } from "./damage-hud.js";
import { hurtCameraRoll } from "./damage-fx.js";
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
import { shapedPick } from "./shaped-blocks.js";
import { stoneUtilityPick, serializePots, restorePots } from "./stone-utility.js";
import { capturePlayerAction, dispatchPlayerAction, captureReleaseAction, dispatchReleaseAction } from "./player-actions.js";
import { fromOriginal } from "./block-registry.js";
import { setOriginalBlockMapper } from "./mineshaft-world.js";
import { spawnerDisplayEntity } from "./mob-spawner.js";
import { watchSpawnerBlocks } from "./spawner-block.js";
import { Rails } from "./rails.js";
import { Torches } from "./torches.js";
import { RedstoneBlocks, isRedstoneBlock, itemOfBlock as redstoneItemOf } from "./redstone-blocks.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { createRecordHud } from "./jukebox.js";
import { Doors, WOODEN_DOOR_ITEM, IRON_DOOR_ITEM, blockItemId } from "./doors-panes.js";
import { MinecartRenderer } from "./minecart-renderer.js";
import { BoatRenderer } from "./boat-renderer.js";
import { Boats, BOAT_ITEM } from "./boats.js";
import { Hanging, pickHanging, hangingArrowTargets } from "./hanging.js";
import { HangingRenderer } from "./hanging-renderer.js";
import { Signs, isSign, signShouldPop, signDrops } from "./signs.js";
import { SignRenderer } from "./sign-renderer.js";
import { openSignEditor } from "./sign-editor.js";
import { applyHangingEdit } from "./hanging-interaction.js";
import { createPlayerRider, captureVehicleAction, dispatchVehicleAction, moveRidingPlayer, finishVehicleTick, restorePlayerVehicle, detachPlayerVehicle } from "./vehicle-simulation.js";
import { StreamPrefetch } from "./streaming-generator.js";
import { restoreStructureEntities, saveStructureEntities, tickMinecartSimulation, tickBoatSimulation, tickSpawnerSimulation, tickSpawnersClient, spawnerBurst, pickMinecart } from "./structure-simulation.js";
// Generation version 10 (live mineshafts) maps original block ids while a World is built; the
// entry module already holds the registry, so the mapper is set before any World exists.
setOriginalBlockMapper(fromOriginal);
setPopulationBlockMapper(fromOriginal);

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
// GuiScreenOptionsSounds has no mute switch: Master Volume is the only off control.
options.sound = true;
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
const editActionLog = []; // Development-only bounded edit/release action trace; never part of a save.
let eyeRay = null; // the view ray of the last frame, for the bucket's liquid trace
let fire,fluids,farming,experience=new Experience(),xpOrbs=new ExperienceOrbs(),xpRenderer,playerTicks=0;
let weather = new Weather(), trees, plants, falling;
const bedSleep = new BedSleep(); // EntityPlayer's sleeping state and bed spawn point (bed.js)
// EntityTNTPrimed entities (explosion.js primeTnt). Explosions draw ray lengths,
// drops, chained fuses and sound pitch from the saved weather.random World.rand.
let primed = [];
let populationBlocks;
let sounds,
  firstPerson,
  mobs,
  mobRenderer,
  chestRenderer,
  tntRenderer,
  aimedEntity = null,
  eating = null;
// Generated-structure entities (structure-simulation.js): mineshaft spawners and chest minecarts.
let spawners = null, minecarts = null, minecartRenderer = null, aimedCart = null;
// Boats (boats.js): their own system and renderer next to the minecarts.
let boats = new Boats(), boatRenderer = null;
// Paintings and item frames (hanging.js): live entities, their renderer and the one under the crosshair.
let hanging = new Hanging(), hangingRenderer = null, aimedHanging = null;
// Signs (signs.js): the tile entities (text) of every sign block, drawn by sign-renderer.js.
let signs = new Signs(), signRenderer = null;
// Live redstone and pistons (redstone-runtime.js), rebuilt for each world that loads.
let redstoneRuntime = null;
// Hopper tick host: the shared inventory-transfer.js stores, EntityItem pickup and live comparator notifications.
const hopperTiles = new Hoppers({
  get world() { return world; },
  chests: () => survival.chests,
  furnaces: () => survival.furnaces,
  dispensers: () => (survival.dispensers ??= {}),
  hoppers: () => (survival.hoppers ??= {}),
  brewing: () => (survival.brewing ??= {}),
  maxStack: (s) => survival.inventory.maxStack(s),
  burnTime,
  items: () => items.items,
  active: (x, z) => !world.streaming || world.isTicking(x, z),
  changed: (keys) => { saved = false; redstoneRuntime?.containerClosed(keys); },
});
let rider = createPlayerRider();
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
// Every system reads the game rules of the world being played (game-rules.js); a /gamerule edit applies on the next read.
setGameRuleSource((name) => ruleOn(active, name));
// gamerule doTileDrops: block drops are skipped while it is false (commands.js / command-host.js).
{ const dropBlock = items.dropBlock; items.dropBlock = function (...a) { return active && !ruleOn(active, "doTileDrops") ? undefined : dropBlock.apply(this, a); }; }
// Thrown snowballs and their particles (see projectiles.js).
const projectiles = new Projectiles();
// The fishing rod's bobber (fishing-simulation.js).
const fishing = new Fishing();
// Arrows in flight or stuck in blocks (bow.js) and the eased field-of-view modifier the
// bow draw drives (EntityRenderer.fovModifierHand and its previous value).
const arrows = new Arrows();
const bowFovState = { prev: 1, cur: 1 };
$("#app").innerHTML = `
 <div id="viewport" aria-label="Interactive voxel world"></div><div id="vignette"></div>
 <div id="gui" class="hidden"></div>
 <section id="hud" class="hidden" aria-label="Game heads-up display"><div class="game-top"><button class="game-brand" id="pause-button">${cube}<span>BLOCKWORLD<small id="world-label"></small></span><span class="pause-symbol">Ⅱ</span></button><div class="game-status"><span class="status-dot"></span><span id="save-label">Saved on this device</span><button id="fullscreen" aria-label="Toggle fullscreen">⛶</button></div></div><div id="crosshair">＋</div><pre id="debug" class="hidden"></pre><div id="block-label"></div><div id="experience-hud" class="hidden"><div id="experience-level"></div><div class="experience-track"><div id="experience-fill"></div></div></div><div id="survival-hud" class="survival-hud hidden"></div><div id="mining-meter" class="mining-meter hidden" role="progressbar" aria-label="Mining progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><div id="flight-label" class="flight-label"><span id="mode-label">CREATIVE</span> <span>·</span> <b id="movement-label">WALKING</b></div><div class="hotbar" id="hotbar"></div><div class="game-help">W A S D <span>move</span> <i>·</i> SPACE <span>jump</span> <i>·</i> LMB <span>break</span> <i>·</i> RMB <span>use / place</span> <i>·</i> E <span>inventory</span> <i>·</i> ESC <span>pause</span></div><div id="mobile-controls"><div class="dpad"><button data-key="KeyW">↑</button><button data-key="KeyA">←</button><button data-key="KeyS">↓</button><button data-key="KeyD">→</button></div><div class="touch-actions"><button id="touch-break">Break</button><button id="touch-place">Use</button><button id="touch-inventory">Bag</button><button id="touch-fly">Fly</button><button data-key="Space">Jump</button></div></div></section>
 <div class="modal-overlay hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></div><div id="toast" role="status"></div><input id="file-input" type="file" accept=".json,application/json" hidden>
 <div id="loading"><span>Loading terrain</span></div>`;
// Open to LAN for this tab (lan.js); it lasts until the world is left.
const lan = new LanSession();
// The 1.7.10 menu screens (menus.js) drawn over the game in #gui.
const menuContext = {
  get options() { return options; },
  get worlds() { return worlds; },
  splashes: "",
  saveOptions,
  soundLevel: (k) => soundLevel(options.soundLevels, k),
  makeRecord,
  launch: openWorld,
  exportWorld: chooseExport,
  importWorld: () => $("#file-input").click(),
  deleteWorld,
  renameWorld,
  makeEndless,
  resume,
  goHome,
  toggleFullscreen,
  inGame: () => screen !== "home",
  notice: toast,
  lanOpen: () => lan.public,
  // GuiShareToLan "Start LAN World": displayGuiScreen(null), shareToLAN, then commands.publish.started (or failed) in chat.
  shareToLan: (mode, cheats) => {
    resume();
    const port = lan.share(mode, cheats);
    printChat(port != null ? tr("commands.publish.started", port) : tr("commands.publish.failed"));
    printChat("§7" + LAN_NOTICE);
  },
  // Minecraft.displayGuiScreen(null): back to the game, or the title screen without a world.
  closeScreen: () => (screen === "home" ? gui.show(menus.mainMenu()) : resume()),
};
const gui = new Gui($("#gui"), {
  scale: () => guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0),
  // GuiButton.func_146113_a: gui.button.press at volume 0.25, pitch 1.
  sound: () => sounds?.play("gui.button.press", { volume: 0.25, pitch: 1 }),
  notice: toast,
  inGame: () => screen !== "home",
});
const menus = createMenus(gui, menuContext);
addEventListener("resize", () => gui.build());

// `columns`: the active streamed world's edited column records (world-storage.js).
async function persist(columns = []) {
  try {
    await writeWorldShelf(worlds, localStorage, storageKey, columns);
    return true;
  } catch {
    toast("Device storage is unavailable or full. Export your world to keep a copy.");
    return false;
  }
}
function makeRecord(p) {
  return {
    id: crypto.randomUUID(),
    name: p.name.slice(0, 40),
    // The save folder GuiCreateWorld derived from the name (menu-screens.js folderName).
    ...(typeof p.folder === "string" && p.folder ? { folder: p.folder.slice(0, 80) } : {}),
    seed: String(p.seed).slice(0, 80),
    biome: p.biome || "meadow",
    mode: p.mode === "survival" ? "survival" : "creative",
    // WorldInfo.allowCommands (GuiCreateWorld "Allow Cheats"). Records saved before 0.42.0 have no flag and read as
    // WorldInfo(NBTTagCompound) does: cheats on for a creative world, off for survival (commands.js cheatsAllowed).
    ...(typeof p.allowCommands === "boolean" ? { allowCommands: p.allowCommands } : {}),
    // Version 11 adds full Java population; 14 (finite) and 15 (streamed) add villages, strongholds and
    // temples. Saves retain their existing generator.
    // Default, Large Biomes and Amplified worlds are streamed (endless) with the matching WorldType generator.
    generationVersion: p.biome === "javaStreamed" ? 15 : isJavaLandscape(p.biome) ? 14 : 8,
    ...(p.biome === "javaStreamed" ? { worldType: streamedWorldType(p.worldType) } : {}),
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
// Block.SoundType through block-sounds.js: RenderGlobal.playAuxSFX 2001 for a break, ItemBlock.onItemUse for a placement
// (ItemDoor, ItemBed, ItemSign, ItemRedstone and ItemSeeds place silently), both at the cell's centre.
function sound(place, block = target ? world.get(...target.block) : 3) {
  if (place && placesSilently(block)) return;
  const s = place ? placeSound(block) : breakSound(block), cell = place ? target?.adjacent ?? target?.block : target?.block;
  sounds?.play(s.name, { volume: s.volume, pitch: s.pitch, position: cell && { x: cell[0] + 0.5, y: cell[1] + 0.5, z: cell[2] + 0.5 } });
}
function icon(id, damage = 0, stack) {
  const item = ITEMS[id];
  if (!id || !item) return '<span class="empty-hand">·</span>';
  // ItemPotion layers: potion_overlay tinted by the liquid colour under the untinted bottle (splash bottle for splash values).
  if (id === 385) return `<span class="vanilla-item-icon tinted-item" style="--tint:#${(damageColor(damage | 0) & 0xffffff).toString(16).padStart(6, "0")};--base:url('/media/1.7.10/items/potion_overlay.png')" aria-hidden="true"><i></i><img src="/media/1.7.10/items/${(damage | 0) & 16384 ? "potion_bottle_splash" : "potion_bottle_drinkable"}.png" alt=""></span>`;
  if(item.block)return `<img class="vanilla-item-icon vanilla-block-icon" src="${scene.textures.icon(id, damage)}" alt="" aria-hidden="true">`;
  // Leather armor multiplies its base layer by display.color; the overlay stays untinted.
  if (item.tint)
    return `<span class="vanilla-item-icon tinted-item" style="--tint:${itemTint(item,stack)};--base:url('/media/1.7.10/items/${item.texture}.png')" aria-hidden="true"><i></i><img src="/media/1.7.10/items/${item.overlay}.png" alt=""></span>`;
  if (!item.block && itemTexture(id, damage))
    return `<img class="vanilla-item-icon" src="${itemTexture(id, damage)}" alt="" aria-hidden="true">`;
  if (!item.block)
    return `<span class="item-icon ${item.kind ? "tool-icon" : ""}" style="--item:${item.color}" aria-hidden="true">${item.glyph}</span>`;
  return `<span class="block-icon b${id}" style="--block:${item.color};--top:${item.top || item.color}"><i></i></span>`;
}
const heldId = () => survival.held?.id || 0;
const recordHud = createRecordHud(document.body);
// Item, stack count and durability overlays, as RenderItem draws them.
function stackHtml(s, count = s?.count) {
  if (!s) return "";
  return withGlint(icon(s.id, s.damage, s), s, ITEMS[s.id]) + (count === 0 ? '<b class="item-count empty">0</b>' : stackCount(count)) + durabilityBar(s.damage, ITEMS[s.id]?.durability);
}
function stackLabel(s) {
  if (!s) return "Empty";
  const item = ITEMS[s.id];
  return (stackName(s, ITEMS) || "Item") + (s.count > 1 ? " ×" + s.count : "") + (item?.durability && s.damage ? `, durability ${item.durability - s.damage} of ${item.durability}` : "");
}
function renderHotbar() {
  const inv = survival.inventory;
  $("#hotbar").innerHTML = inv.main.slice(0, 9).map((s, i) =>
    `<button class="slot ${i === inv.current ? "selected" : ""}" data-slot="${i}" aria-label="Select ${s ? esc(stackLabel(s)) : "empty hand"}" aria-pressed="${i === inv.current}">${s ? stackHtml(s) : ""}<small>${i + 1}</small></button>`,
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
  clearTimeout(showHeldName.timer);
  // GuiIngame draws the highlighted item name only for a held stack: an empty hand (air) shows nothing.
  if (!held?.id || held.count <= 0) { $("#block-label").classList.remove("visible"); return; }
  $("#block-label").textContent = stackName(held, ITEMS) || ITEMS[held.id]?.name || "";
  $("#block-label").classList.add("visible");
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
function notes() {
  modal(
    "Rebuilding 1.7.10, system by system.",
    `<p class="modal-subtitle">Minecraft Java 1.7.10 is the compatibility target. Full parity is still unfinished.</p><div class="notes"><span class="note-tag">VERIFIED AGAINST BYTECODE</span><p>REA inventories the original JAR. MCP mappings and javap locate the original movement, FoodStats, crafting, furnace, and world-clock implementations.</p><div class="facts"><div><b>20 Hz</b><span>Physics ticks</span></div><div><b>200</b><span>Ticks / smelt</span></div><div><b>24,000</b><span>Ticks / day</span></div></div><span class="note-tag">IMPLEMENTED IN THIS BUILD</span><p>Creative and Survival, health, hunger, saturation, exhaustion, experience orbs/levels, regeneration, fall damage, drowning, death and recoverable inventory drops. Broken blocks, mob kills and thrown stacks drop item entities that fall, merge and are picked up. The Java 36-slot inventory with cursor, drag-splitting, shift- and double-click rules; shaped crafting, a crafting table, a fuel-driven furnace and single/large chests on real slots; the tabbed creative inventory with search; wood, stone, iron, diamond and gold tools with per-item durability and repair; leather, chain, iron, gold and diamond armor. Original 1.7.10 block/item textures, HUD sprites, sun, moon and sound effects; hand swings, equip transitions, bobbing, eating, animated water, crack frames and entity shadows. Pigs, cows, sheep, chickens and night-time zombies with 1.7.10 movement, knockback, pathfinding and AI task lists, melee combat with sprint knockback and critical hits, and food drops. Cows and sheep follow wheat and breed, pigs follow carrots and breed, chickens follow seeds and lay eggs; sheep graze, can be sheared and dyed. Sneaking slows you, lowers the view and stops you at edges. Flowing water and lava spread, mix into obsidian, cobblestone and stone, and lava burns players, mobs and items; buckets pick up and place liquids and milk cows; lakes and springs generate; flowers grow and craft into 16 dyes for wool; snowballs and eggs can be thrown; ladders can be placed and climbed; F5 shows the player model with armor. Rain and thunderstorms follow the original weather timers, darken the sky and light, and bring lightning that strikes and starts fires; fire spreads through wood, wool and leaves and is lit with flint and steel. The Snowy Tundra landscape has snowfall, snow layers and ice. Bows draw and fire arrows, and skeletons shoot back at night and burn by day. Oak saplings grow into trees, with bone meal or over time, and leaves decay and drop saplings and apples. Java worlds now use the original biome layers, terrain surfaces, caves and ravines at 256-block height; new Java worlds also generate mineshafts with cave-spider spawners and chest minecarts; ores, trees, lakes, dungeons, biome plants, animals and snow now generate too. Villages, strongholds and temples remain unfinished. Legacy landscapes keep their existing decoration. Torches; 1.7.10 sky/block light, smooth lighting, lightmap, sky, stars, fog and fancy clouds. Wheat, carrot and potato farming with five hoe tiers, moisture, eight growth stages, bone meal and harvesting; bread crafting and baked potatoes. Zombies rarely drop carrots, potatoes or iron when killed after a player hit. Creepers and TNT explode with block shielding, entity knockback, original puff/smoke effects and item drops; burning arrows light TNT and its fuse emits smoke. Sugar cane and cactus grow, paper/sugar/books craft, and sand/gravel fall and can be deflected by explosions.</p><span class="note-tag">MAJOR GAPS REMAIN</span><p>Streamed population and remaining Java structures, the complete block/item registry, most mobs and their full AI, other crops, advanced combat, enchantments, hoppers and other storage, redstone, dimensions, structures, other biomes, void fog, Java saves, and multiplayer. The renderer, terrain, entity AI and several interactions remain simplified. Original sounds and textures retain Mojang/Microsoft ownership.</p><div class="note-links"><a href="/research/textures-and-farming.md" target="_blank" rel="noopener">Textures & farming ↗</a><a href="/research/animations-and-sounds.md" target="_blank" rel="noopener">Animation & audio ↗</a><a href="/research/investigation.md" target="_blank" rel="noopener">Investigation ↗</a><a href="/research/items.md" target="_blank" rel="noopener">Item drops ↗</a><a href="/research/creative.md" target="_blank" rel="noopener">Creative inventory ↗</a><a href="/research/shadows.md" target="_blank" rel="noopener">Entity shadows ↗</a><a href="/research/fluids.md" target="_blank" rel="noopener">Flowing water ↗</a><a href="/research/third-person.md" target="_blank" rel="noopener">Third person ↗</a><a href="/research/sheep.md" target="_blank" rel="noopener">Sheep & wool ↗</a><a href="/research/projectiles.md" target="_blank" rel="noopener">Snowballs ↗</a><a href="/research/lava.md" target="_blank" rel="noopener">Lava ↗</a><a href="/research/buckets.md" target="_blank" rel="noopener">Buckets & lakes ↗</a><a href="/research/chickens.md" target="_blank" rel="noopener">Chickens & eggs ↗</a><a href="/research/dyes.md" target="_blank" rel="noopener">Flowers & dyes ↗</a><a href="/research/sneaking.md" target="_blank" rel="noopener">Sneaking & attacks ↗</a><a href="/research/pathfinding.md" target="_blank" rel="noopener">Pathfinding & AI ↗</a><a href="/research/weather.md" target="_blank" rel="noopener">Weather ↗</a><a href="/research/fire.md" target="_blank" rel="noopener">Fire ↗</a><a href="/research/snow.md" target="_blank" rel="noopener">Snow & ice ↗</a><a href="/research/bows.md" target="_blank" rel="noopener">Bows & skeletons ↗</a><a href="/research/crops.md" target="_blank" rel="noopener">Crops & pigs ↗</a><a href="/research/trees.md" target="_blank" rel="noopener">Saplings & trees ↗</a><a href="/research/ladders.md" target="_blank" rel="noopener">Ladders ↗</a><a href="/research/generation.md" target="_blank" rel="noopener">Java generation ↗</a><a href="/research/parity.md" target="_blank" rel="noopener">Feature coverage ↗</a><a href="https://github.com/morluto/rea" target="_blank" rel="noopener">REA ↗</a></div></div>`,
    "notes-modal",
  );
}
// GameSettings.setOptionValue / setOptionFloatValue: apply a change from the menu screens and
// save the device preferences (options.txt).
function saveOptions() {
  options.particles = particleSetting(options.particles);
  options.difficulty = difficultySetting(options.difficulty);
  options.guiScale = (Number(options.guiScale) || 0) & 3;
  scene.camera.fov = options.fov;
  scene.camera.updateProjectionMatrix();
  scene.setDistance(renderDistanceBlocks(options.distance));
  scene.setGamma(Number(options.gamma) || 0);
  sounds.updateVolumes();
  updateParticleOptions();
  updateDifficulty();
  updateGuiScale();
  try {
    localStorage.setItem("blockworld.settings", JSON.stringify(options));
  } catch {}
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser.");
  }
}
// GuiYesNo from GuiSelectWorld: remove the world from the shelf and its streamed chunks.
async function deleteWorld(record) {
  const before = worlds;
  worlds = worlds.filter((w) => w.id !== record.id);
  if (!await persist()) { worlds = before; return; }
  if (record.biome === 'javaStreamed') {
    try { await deleteStoredWorld(record.id); }
    catch { toast('World removed from the shelf; its stored data could not be cleared.'); }
  }
}
// Browser addition (endless-world.js): a streamed copy of a finite Java world, listed beside the original.
async function makeEndless(record) {
  if (!canGoEndless(record)) return;
  const name = `${record.name || "World"} (Endless)`.slice(0, 40), before = worlds;
  const copy = endlessCopy(record, { id: crypto.randomUUID(), name, folder: folderName(name, (s) => worlds.some((w) => w.folder === s)) });
  worlds = [copy, ...worlds];
  if (!await persist()) { worlds = before; return; }
  toast("Endless copy created.");
}
// GuiRenameWorld: the display name changes; the save folder keeps its name.
async function renameWorld(record, name) {
  record.folder ??= folderName(record.name || "World");
  record.name = name.slice(0, 40);
  if (active?.id === record.id) $("#world-label").textContent = record.name;
  await persist();
}

function save() {
  if (!active || !world || screen === "home") return;
  // Streamed worlds store edits per column: only the columns edited since the last save are written.
  const columns = world.streaming ? world.takeDirtyColumns().map((c) => ({ world: active.id, ...c })) : [];
  world.beginColumnSave(columns);
  if (!world.streaming) active.edits = [...world.edits];
  if (world.streaming) active.editSequence = world.nextEditOrder;
  if (world.population) active.populatedColumns = world.saveClaimedColumns();
  active.position = { x: position.x, y: position.y, z: position.z, yaw, pitch };
  active.player = survival.serialize();
  active.drops = items.serialize();
  active.projectiles = projectiles.serialize();
  active.fishing = fishing.serialize();
  active.thrownPotions = mobs?.potions?.serialize() ?? [];
  active.arrows = arrows.serialize();
  // EntityTNTPrimed.writeEntityToNBT keeps only the fuse (plus Entity's position and motion).
  active.tnt = primed.map((e) => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse }));
  active.weather = weather.save();
  active.bed = bedSleep.save();
  active.worldRandom = weather.saveSimulation();
  active.fluidTicks = fluids.save();
  active.fireTicks = fire.save();
  if (redstoneRuntime) { active.redstone = redstoneRuntime.save(); active.pistons = redstoneRuntime.pistons.save(); active.commandBlocks = redstoneRuntime.commandBlocks.save(); active.musicTiles = redstoneRuntime.music.save(); }
  // Chunk.InhabitedTime (one value stands for every chunk; see difficulty.js).
  active.inhabited = inhabited.save(survival.time);
  // Items on the cursor or in a crafting grid return to the saved inventory, as closing the screen would.
  const pending = pendingContainerStacks(containerView);
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
  active.villages = mobs?.villages.toJSON();
  active.farms=farming?.serialize()||[];
  active.pots=serializePots(world);
  active.experience=experience.serialize();active.xpOrbs=xpOrbs.serialize();
  active.falling=falling?.serialize()||[];
  active.fallingTicks = falling?.save();
  // Live spawner and minecart state; regeneration never refills them (structure-simulation.js).
  if (spawners || minecarts) Object.assign(active, saveStructureEntities({ spawners, minecarts }));
  // Boats and the mounted state: only written when a boat exists, so older saves stay byte-identical.
  if (boats?.carts.length) active.boats = boats.toJSON(); else delete active.boats;
  active.hanging = hanging.toJSON();
  if (signs.tiles.size) active.signs = signs.toJSON(); else delete active.signs;
  active.updated = Date.now();
  const savingContainers=containerResidency, containerSave=savingContainers?.beginSave(active.player);
  if(containerSave)active.containerScope=savingContainers.scope(containerSave);
  const i = worlds.findIndex((w) => w.id === active.id);
  if (i < 0) worlds.unshift(active);
  else worlds[i] = active;
  const savingId = active.id, savingWorld = world, savingStorage = streamStorage;
  $("#save-label").textContent = "Saving…";
  const completion = persist(columns).then(ok => {
    savingWorld.finishColumnSave(columns, ok);
    savingStorage?.trim();
    if(containerSave) {
      savingContainers.finishSave(containerSave,ok);
      if(containerResidency===savingContainers&&active?.id===savingId)savingContainers.pruneRecord(active);
    }
    if (active?.id !== savingId) return;
    saved = ok;
    $("#save-label").textContent = ok ? "Saved on this device" : "Export to save your changes";
  });
  lastSave = elapsed;
  return completion;
}
async function exportWorld(record = active) {
  const exportingWorld=record===active?world:null;
  if (exportingWorld) await save();
  try {record = structuredClone(await readRuntimeState(record));}
  catch(e) {toast('Could not read this world: '+e.message);return;}
  // Exports stay self-contained: a chunked world's edits are read back into the file.
  let edits = record.edits;
  if (record.chunked) {
    try { edits = await readChunkEdits(record.id);
      if(exportingWorld?.streaming)edits=[...new Map([...edits,...exportingWorld.edits])];
    }
    catch (e) { toast("Could not read this world: " + e.message); return; }
  }
  const { chunked, runtimeChunked, editSequence, ...rest } = record;
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { ...rest, edits, format: "blockworld", version: 1 },
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
let openingWorld=false, exportBusy=false;
function chooseExport(record=active) {
  if(exportBusy)return;
  gui.hide();
  const back=()=>{closeModal();if(screen==='home')gui.show(menus.selectWorld());else pause();};
  modal('Export World', '<p>Keep a browser backup, or download a Java 1.7.10 save with region files and conversion notes.</p><div class="menu-actions"><button class="button primary full" id="export-browser">Browser backup (.json)</button><button class="button secondary full" id="export-java">Java 1.7.10 save (.zip)</button></div>');
  $('#modal .close-button').onclick=back;
  $('#export-browser').onclick=()=>{back();exportWorld(record);};
  $('#export-java').onclick=async()=>{
    exportBusy=true;
    const buttons=$('#modal').querySelectorAll('button');for(const b of buttons)b.disabled=true;
    try {
      const exportingWorld=record===active?world:null;
      if(exportingWorld)await save();
      const snapshot=structuredClone(await readRuntimeState(record));
      if(snapshot.chunked) {snapshot.edits=await readChunkEdits(snapshot.id);if(exportingWorld?.streaming)snapshot.edits=[...new Map([...snapshot.edits,...exportingWorld.edits])];}
      const {exportJavaSave}=await import('./region-export.js');
      const result=await exportJavaSave(snapshot,{onProgress:(n,total)=>{$('#export-java').textContent=`Exporting ${n} / ${total} columns…`;}});
      const url=URL.createObjectURL(new Blob([result.zip],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=record.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()+'.java-1.7.10.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      back();toast(`Java save exported (${result.report.columns} columns). Unzip it into the Java saves folder; conversion notes are included.`);
    }catch(e){toast('Could not export Java save: '+e.message);for(const b of buttons)b.disabled=false;$('#export-java').textContent='Java 1.7.10 save (.zip)';}
    finally{exportBusy=false;}
  };
}
function requestLock() {
  if (screen !== "playing") return;
  try {
    const result = scene.renderer.domElement.requestPointerLock?.();
    result?.catch(() => {
      lockFallback = true;
      if (screen === "playing") toast("Drag to look. Left click to mine. Right click to use.");
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
    // TileEntitySign goes with its block; BlockSign.onNeighborBlockChange drops a sign whose support is gone.
    if (isSign(old) && !isSign(now)) signs.remove(x, y, z);
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const fx = x + dx, fy = y + dy, fz = z + dz, b = world.get(fx, fy, fz);
      if (isSign(b) && signShouldPop(world, fx, fy, fz)) {
        world.set(fx, fy, fz, 0);
        items.dropBlock(signDrops().map((d) => makeStack(d.id, d.count)), fx, fy, fz);
        scene.updateBlock(fx, fz, fy);
        continue;
      }
      if (isStemCake(b)) { const pop = popDrops(world, fx, fy, fz); if (pop) { world.set(fx, fy, fz, 0); items.dropBlock(pop.map((d) => makeStack(d.id, d.count)), fx, fy, fz); scene.updateBlock(fx, fz, fy); } continue; }
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
// Hydrate only the resident window before constructing block runtimes and lighting.
async function openWorld(record) {
  if(openingWorld)return;
  openingWorld=true;
  lan.close();
  try {
    const prepared=new World(record.seed,record.biome,record.generationVersion??1,record.worldType);
    if (!record.chunked) prepared.restore(record.edits??[]);
    prepared.restoreClaimedColumns(record.populatedColumns);
    const p=record.position;
    if(prepared.streaming&&p&&[p.x,p.z].every(Number.isFinite))prepared.streamAround(p.x,p.z);
    record=await readRuntimeState(record,prepared.streaming?{containerColumns:[...prepared.chunks.values()].map(c=>[c.x,c.z])}:{});
    const storage=prepared.streaming?new StreamStorage(prepared,record.id,{onError:e=>{pause();toast('Could not load saved columns. Reopen the world to retry: '+e.message);}}):null;
    prepared.nextEditOrder=Math.max(prepared.nextEditOrder,record.editSequence??(record.chunked?2000000:0));
    if(storage)await storage.ensure([...prepared.chunks.values()].map(c=>[c.x,c.z]));
    streamStorage?.dispose();streamStorage=storage;
    await launch(record,prepared);
  } catch(e) {toast('Could not open this world: '+e.message);}
  finally{openingWorld=false;}
}
async function launch(record, prepared) {
  try {
    active = record;
    world = prepared;
    startPrefetch();
    // Restore World.rand before constructing the block runtimes that share it.
    weather = new Weather().restore(record.weather).restoreSimulation(record.worldRandom);
    hideBedScreen();
    bedSleep.restore(record.bed); // the spawn point; a saved sleeping state is resumed after the player is placed
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
      sound:(event,{x,y,z,volume,pitch})=>sounds.play(event,{volume,pitch,position:{x,y,z}}),
      hurt:(box,amount)=>{
        const intersects=b=>box[3]>b[0]&&box[0]<b[3]&&box[4]>b[1]&&box[1]<b[4]&&box[5]>b[2]&&box[2]<b[5];
        if(intersects(pushBox(position,PHYSICS.width,PHYSICS.height)))survival.anvilDamage(amount);
        for(const e of mobs.entities){const size=ENTITY_TYPES[e.type];if(intersects(pushBox(e,size.width,size.height)))mobs.attackEntityFrom(e,amount,{name:'anvil'});}
        saved=false;
      },
    }, record.falling).watch();
    falling.load(record.fallingTicks);
    farming=new Farming(world,record.farms);
    restorePots(world,record.pots);
    // Rain moistens farmland (BlockFarmland.updateTick: canLightningStrikeAt(x, y + 1, z)).
    farming.rained = (x, y, z) => canLightningStrikeAt(weather, world, x, y + 1, z);
    weather.apply = applyWeatherEdit;
    fire.sharedRandomTicks = true;
    // One WorldServer random-tick stream: fire and still lava (fire.js), saplings and leaves (trees.js),
    // sugar cane and cactus (plants.js), then snow and ice melting in Weather.tickChunk itself.
    populationBlocks=new PopulationBlocks(world,{random:weather.random,drop:(stacks,x,y,z)=>items.dropBlock(stacks.map(d=>makeStack(d.id,d.count,d.damage||0)),x,y,z),apply:changes=>{scene.updateBlocks(changes);saved=false;}}).watch();
    world.populationBlocks=populationBlocks;
    weather.blockTick = (x, y, z, b) => populationBlocks.randomTick(x,y,z,b) || fire.randomTick(x, y, z, b) || trees.randomTick(x, y, z, b) || plants.randomTick(x, y, z, b);
    scene.weather = weather;
    // EntityLightningBolt's fire, and the ticks of the fires saved with the world.
    weather.fire = fire.strikes;
    fire.load(record.fireTicks);
    experience=new Experience(record.experience);xpOrbs=new ExperienceOrbs(record.xpOrbs);playerTicks=0;
    // Entity.isWet for orbs: rain only (EntityXPOrb.handleWaterMovement never sets inWater).
    xpOrbs.wet = (o) => isWet(weather, world, { x: o.x, y: o.posY, z: o.z, inWater: false }, 0.5);
    // BlockRailBase and BlockTorch.onNeighborBlockChange: unsupported rails and torches drop.
    const dropBlock = (stacks, x, y, z) => items.dropBlock(stacks.map((d) => makeStack(d.id, d.count, d.damage || 0)), x, y, z);
    new Rails(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; } }).watch();
    new Torches(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; } }).watch();
    // BlockDoor.onNeighborBlockChange: a door without its other half or a solid top below pops off as one item.
    // BlockCarpet.onNeighborBlockChange: a carpet whose support below is gone drops itself.
    { const next = world.onChange; world.onChange = (x, y, z, old, now) => { next?.(x, y, z, old, now); for (const dy of [1, 0]) { const d = carpetNeighbourChange(world, x, y + dy, z); if (d) { dropBlock([d], x, y + dy, z); scene.updateBlocks([[x, y + dy, z, CARPET, 0]]); saved = false; } } }; }
    new Doors(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; } }).watch();
    new Beds(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; } }).watch();
    // Redstone components (inert, no power): unsupported ones drop; a pressed stone button releases 20 ticks later.
    world.redstoneBlocks = new RedstoneBlocks(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; }, sound: (name, volume, pitch, x, y, z) => sounds.play(name, { volume, pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } }) }).watch();
    // Live redstone power and pistons (redstone-runtime.js). The inert RedstoneBlocks above keep only the tripwire
    // support rule; every block the engine ported (torches, plates, buttons, dust...) drops through its own behaviour.
    redstoneRuntime?.dispose();
    redstoneRuntime = createRedstoneRuntime({ world, scene, game: {
      commandHost: () => commandHost,
      music: {
        particle: (name, x, y, z, vx, vy, vz) => scene.fx.spawn(name, x, y, z, vx, vy, vz),
        // RenderGlobal.playRecord: the HUD line for a disc; the record music is not shipped (public/research/note-jukebox.md).
        play: (item) => { if (item) recordHud.show(item); },
        spawn: (stack, x, y, z) => items.spawn(makeStack(stack.id, stack.count, stack.damage || 0), x, y, z, { delay: 10 }),
      },
      sound: (name, x, y, z, volume, pitch) => sounds.play(name, { volume, pitch, position: { x, y, z } }),
      drop: (x, y, z, d) => items.dropBlock([makeStack(d.id, d.count, d.damage || 0)], x, y, z),
      primeTnt: (x, y, z) => lightTnt(x, y, z, null),
      markUnsaved: () => { saved = false; },
      player: () => ({ position, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0 }),
      mobs: () => mobs,
      items: () => items.items,
      arrows: () => arrows.list,
      orbs: () => xpOrbs.orbs,
      primed: () => primed,
      minecarts: () => minecarts,
      chests: () => survival.chests,
      furnaces: () => survival.furnaces,
      dispensers: () => (survival.dispensers ??= {}),
      hoppers: () => survival.hoppers ?? {},
      brewing: () => survival.brewing ?? {},
      transfer: () => hopperTiles.host,
      // Dispenser / dropper effects (dispense.js host): entities and blocks the engine cannot create itself.
      dispense: {
        rng: () => arrows.rng(),
        spawnItem: (stack, x, y, z, mx, my, mz) => { items.spawn(stack, x, y, z, { motion: [mx, my, mz] }); },
        arrow: (e) => { arrows.list.push(arrows.make(e, e.rand, { shooter: null, pickup: 1 })); },
        thrown: (kind, e) => {
          const ball = { x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, kind, px: e.x, py: e.y, pz: e.z, prevYaw: e.yaw, prevPitch: e.pitch, ticks: 0, rand: e.rand, random: e.rand, dead: false };
          if (kind === "potion") (mobs.potions?.projectiles ?? projectiles).balls.push({ ...ball, damage: e.damage, owner: null });
          else projectiles.balls.push(ball);
        },
        cart: (type, x, y, z) => { if (type === 1) minecarts.spawnChest({ type: 1, x, y, z, items: [] }); else minecarts.spawnEmpty({ x, y, z }); },
        spawnTnt: (x, y, z) => { primed.push(primeTnt(x + 0.5, y + 0.5, z + 0.5, { placer: null })); saved = false; },
        setLiquid: (x, y, z, id) => { const old = world.get(x, y, z); world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0); redstoneRuntime.fluidChanges([[x, y, z, old, world.get(x, y, z)]]); },
        setAir: (x, y, z) => { const old = world.get(x, y, z); world.set(x, y, z, 0, true, 0); redstoneRuntime.fluidChanges([[x, y, z, old, 0]]); },
        setFire: (x, y, z) => { fire.ignite(x, y, z); },
        breakBlock: (x, y, z) => { const b = world.get(x, y, z); if (b) fluids.wash(x, y, z, b); },
        boneMeal: (x, y, z, original) => original === 6 && trees.boneMeal(x, y, z) !== null,
      },
      maxStack: (st) => survival.inventory.maxStack(st),
      subtracted: () => scene.subtracted ?? 0,
      angle: () => scene.angle ?? 0,
      skyLight: (x, y, z) => (scene.light ? scene.light.skyAt(x, y, z) : 15),
    } });
    {
      const rb = world.redstoneBlocks, supported = rb.neighbourChanged.bind(rb), live = redstoneRuntime.redstone;
      rb.neighbourChanged = (x, y, z) => { if (!live.behaviours[live.getBlock(x, y, z)]) supported(x, y, z); };
    }
    world.redstoneApply = redstoneRuntime.applyEdit;
    redstoneRuntime.restore(record);
    // Mineshaft spawners and chest minecarts: generation records on a world's first launch, the
    // saved live state afterwards. A broken spawner block removes its tile entity.
    ({ spawners, minecarts } = (() => {
      const restored = restoreStructureEntities(record, world);
      for (const t of restored.pendingTicks) fluids.schedule(t.x, t.y, t.z, t.delay);
      return restored;
    })());
    watchSpawnerBlocks(world, spawners);
    boats = Boats.fromJSON(record.boats);
    if (boatRenderer) { boatRenderer.clear(); boatRenderer.boats = boats; }
    aimedCart = null;
    hanging = Hanging.fromJSON(record.hanging); aimedHanging = null; hangingRenderer?.clear();
    signs = Signs.fromJSON(record.signs); signRenderer?.clear();
    if (minecartRenderer) { minecartRenderer.clear(); minecartRenderer.minecarts = minecarts; }
    mobs = new EntityWorld(world, world.generationVersion>=11&&!hasSavedPopulation(record)?[]:record.entities);
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
    mobs.isRaining = () => weather.isRaining();
    mobs.shoot = (e, target, scale) => arrows.skeletonShoot(e, target, scale, mobs.difficulty);
    // EntityWitch splash potions (witch-potions.js); EntityWorld.tick advances them.
    mobs.potions = new WitchPotions(mobs);
    mobs.potions.load(record.thrownPotions);
    // World.rand for EntityLiving.onSpawnWithEgg, and World.func_147462_b at a block.
    mobs.worldRandom = weather.random;
    mobs.localDifficulty = (x, y, z) => localDifficulty(mobs.difficulty, survival.time, inhabited.value, world.isLoaded(x,z) && y >= 0 && y < world.height);
    arrows.wet = (a) => isWet(weather, world, { x: a.x, y: a.y, z: a.z, inWater: a.water }, 0.5);
    mobRenderer.clear();
    animation.reset();
    eating = null;
    stepDistance = 0;
    wasInWater = false;
    survival = new Survival(legacyPlayer(record), record.mode || "creative");
    containerResidency?.dispose();
    containerResidency=world.streaming?new ContainerResidency(world,record.id,survival,{scope:record.containerScope,onError:e=>{pause();toast('Could not load saved containers. Reopen the world to retry: '+e.message);}}):null;
    survival.furnaceActive = key => !world.streaming || world.isTicking(...[key.split(",")[0],key.split(",")[2]].map(Number));
    survival.furnaceChanged = key => redstoneRuntime?.containerClosed([key]);
    restorePopulation(record,world,survival,mobs);
    if (record.villages) mobs.villages.loadJSON(record.villages);
    materializeFresh();
    // A new EntityPlayerMP is spawn-protected for 60 ticks (damage is refused, Creative or not).
    survival.protection = 60;
    inhabited = new InhabitedTime(record.inhabited, survival.time);
    updateDifficulty();
    // Chest blocks saved without tile data get the facing onBlockAdded gives them.
    for (const [key, b] of world.edits) {
      if (isChestBlock(b) && !survival.chests[key]) settleFacing(world, survival.chests, ...key.split(",").map(Number));
      if (b === ENDER_CHEST) survival.enderTiles[key] ??= newEnderTile(); // lid state for the renderer (not saved)
    }
    chestRenderer.sync(world, survival.chests, undefined, survival.enderTiles);
    const p = record.position,
      valid =
        p &&
        [p.x, p.y, p.z].every(Number.isFinite) &&
        p.x > world.minX + 1 &&
        p.x < world.maxX - 1 &&
        p.z > world.minZ + 1 &&
        p.z < world.maxZ - 1 &&
        p.y >= 0 &&
        p.y < world.height;
    position.copy(
      valid
        ? new THREE.Vector3(p.x, p.y, p.z)
        : new THREE.Vector3(...Object.values(await spawnPosition())),
    );
    if (collides(world, ...position.toArray()))
      position.copy(new THREE.Vector3(...Object.values(await spawnPosition())));
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
    fishing.load(record.fishing);
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
    if (import.meta.env.DEV) editActionLog.length = 0;
    fallDistance = 0;
    rider = createPlayerRider();
    const vehicle = vehicleState();
    restorePlayerVehicle(vehicle);
    applyVehicleState(vehicle);
    previous.copy(position);
    playerBody.reset(position, yaw, pitch);
    keys.clear();
    accumulator = 0;
    screen = "playing";
    gui.hide();
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
    restoreSleep(record.bed);
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
    console.error(e);
    toast("Could not open this world: " + e.message);
  }
}
// ---- Chat and commands (chat-ui.js GuiChat/GuiNewChat, commands.js ServerCommandManager, command-host.js game state) ----
let chatOpen = false;
const commandHost = createCommandHost({
  active: () => active, world: () => world, weather: () => weather, mobs: () => mobs, survival: () => survival, experience: () => experience,
  position: () => ({ x: position.x, y: position.y, z: position.z }),
  seed: () => active.seed,
  commandTile: (x, y, z) => redstoneRuntime?.commandBlocks.tile(x, y, z),
  stackName: (s) => stackName(s, ITEMS) || ITEMS[s.id]?.name || "",
  dropStack: (s) => items.dropPlayer(s, position, yaw, pitch, true, true),
  refreshInventory: () => { renderHotbar(); renderVitals(); saved = false; },
  changed: () => { saved = false; },
  setTime: (t) => scene.setTime(t),
  teleport: (x, y, z) => { position.set(x, y, z); previous.copy(position); velocity.set(0, 0, 0); fallDistance = 0; saved = false; },
  setDifficulty: (d) => { options.difficulty = difficultySetting(d); updateDifficulty(); try { localStorage.setItem("blockworld.settings", JSON.stringify(options)); } catch {} },
  lan: () => lan.open,
  shareToLan: (mode, cheats) => lan.share(mode, cheats),
  setMode: (mode) => {
    survival.mode = mode;
    survival.inventory.creative = survival.creative;
    if (!survival.creative) flying = false;
    active.mode = mode;
    $("#mode-label").textContent = mode.toUpperCase();
    $("#hud").classList.toggle("survival", !survival.creative);
    renderHotbar(); renderVitals(); saved = false;
  },
  updateBlock: (x, y, z) => scene.updateBlock(x, z, y),
  destroyBlock: (x, y, z) => breakBlock([x, y, z], false),
});
const commands = createCommandRunner(commandHost);
const chatUi = new ChatUi(document, {
  // ServerConfigurationManager prints "<Player> message"; a leading "/" runs the command.
  submit: (text) => { if (text.startsWith("/")) commands.run(text); else printChat(chatLine(PLAYER_NAME, text)); },
  complete: (before) => commands.complete(before),
  close: () => closeChat(),
  stay: () => bedSleep.sleeping,
  visible: () => !!active && screen !== "home",
});
// GuiChat: no pause, but the pointer is released and the movement keys stop (the same state the sleep screen uses).
function openChat(prefill = "") {
  if (chatOpen || screen !== "playing" || gui.open || survival.health <= 0) return;
  chatOpen = true;
  screen = "inventory";
  mining = null; mineHeld = false; eating = null;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  chatUi.open(prefill);
}
function closeChat() {
  if (!chatOpen) return;
  chatOpen = false;
  chatUi.close();
  if (screen === "inventory" && !containerView) resume();
}
function resume() {
  chatOpen = false;
  chatUi.close();
  // GuiSleepMP: leaving the screen (Escape) sends the stop-sleeping action, wakeUpPlayer(true, true, false).
  if (bedSleep.sleeping) { bedWake(true, false); return; }
  if (survival.health <= 0) {
    screen = "playing";
    die();
    return;
  }
  closeModal();
  gui.hide();
  screen = "playing";
  keys.clear();
  requestLock();
}
// ---- Beds (bed.js): BlockBed.onBlockActivated, the sleeping pose, the sleep fade and waking up ----
let bedFade = null, bedButton = null, lastHealth = 0;
function showBedScreen() {
  if (!bedFade) {
    bedFade = document.createElement("div");
    bedFade.style.cssText = "position:fixed;inset:0;z-index:30;pointer-events:none;background:#101020;opacity:0;display:none";
    bedButton = document.createElement("button");
    bedButton.className = "button secondary";
    bedButton.textContent = BED_TEXT.leave; // multiplayer.stopSleeping
    // GuiSleepMP.initGui: a 200x20 button at (width / 2 - 100, height - 40), in GUI pixels.
    bedButton.style.cssText = "position:fixed;left:50%;bottom:calc(20*var(--u));transform:translateX(-50%);width:calc(200*var(--u));height:calc(20*var(--u));font-size:calc(8*var(--u));padding:0;z-index:31;display:none";
    bedButton.onclick = () => bedWake(true, false);
    document.body.append(bedFade, bedButton);
  }
  bedFade.style.display = "block";
  bedButton.style.display = "block";
  // GuiSleepMP extends GuiChat: the input field and the chat history are open above the Leave Bed button.
  chatOpen = true;
  chatUi.open();
}
function hideBedScreen() {
  if (bedButton) bedButton.style.display = "none";
  chatOpen = false;
  chatUi.close();
}
// GuiIngame.renderSleepFade: the 0x101020 wash follows sleepTimer and fades over the ten ticks after waking.
function updateBedFade() {
  if (!bedFade) return;
  const a = bedSleep.overlay;
  bedFade.style.opacity = String(a);
  if (a === 0 && !bedSleep.sleeping) bedFade.style.display = "none";
}
function enterSleep() {
  screen = "inventory";
  mining = null; mineHeld = false; eating = null;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  // The body lies on the mattress (top 9/16); the camera override in the frame loop supplies the lying view.
  position.set(bedSleep.pos.x, bedSleep.bed[1] + 0.5625, bedSleep.pos.z);
  previous.copy(position);
  velocity.set(0, 0, 0);
  showBedScreen();
}
// BlockBed.onBlockActivated for a click on either half; the server-side checks are in bed.js.
function useBed(x, y, z) {
  if (survival.health <= 0 || bedSleep.sleeping) return;
  const ctx = {
    player: { x: position.x, y: position.y, z: position.z, alive: true },
    daytime: (scene.subtracted ?? 0) < 4,
    // EntityMob within 8 x 5 x 8 of the head cell (strict box intersection).
    monsterNear: (b) => !!mobs?.entities.some((e) => {
      if (!HOSTILE.has(e.type) || e.health <= 0) return false;
      const size = ENTITY_TYPES[e.type], hw = size.width / 2;
      return e.x + hw > b[0] && e.x - hw < b[3] && e.y + size.height > b[1] && e.y < b[4] && e.z + hw > b[2] && e.z - hw < b[5];
    }),
    otherSleeperAt: () => false,
  };
  const out = activateBed(world, x, y, z, bedSleep, ctx);
  if (out.message) showChatLine(document, out.message);
  if (bedSleep.sleeping) { enterSleep(); saved = false; lastHealth = survival.health; }
}
// EntityPlayer.wakeUpPlayer(resetTimer, update, setSpawn): stand beside the bed (or above its head), clear the occupied bit.
function bedWake(resetTimer, setSpawn, leaveScreen = true) {
  const head = bedSleep.bed, feet = bedSleep.wake(world, resetTimer, setSpawn);
  if (!feet) return;
  if (head) scene.updateBlock(head[0], head[2], head[1]);
  position.set(feet.x, feet.y, feet.z);
  previous.copy(position);
  velocity.set(0, 0, 0);
  hideBedScreen();
  saved = false;
  if (leaveScreen && screen === "inventory" && !containerView) resume();
}
// The per-tick sleep timer, the damage wake-up and WorldServer.tick's night skip once everyone (the one player) is fully asleep.
function tickBed() {
  if (!bedSleep.sleeping && bedSleep.timer === 0) { updateBedFade(); return; }
  if (bedSleep.sleeping && survival.health < lastHealth) { lastHealth = survival.health; bedWake(true, false); return; }
  lastHealth = survival.health;
  const call = bedSleep.tick(world, (scene.subtracted ?? 0) < 4);
  if (call) bedWake(call[0], call[2]);
  else if (bedSleep.fullyAsleep) {
    // doDaylightCycle: worldTime + 24000 rounded down to a whole day; resetRainAndThunder; wakeAllPlayers.
    survival.time = nextMorning(survival.time);
    weather.rainTime = 0; weather.thunderTime = 0; weather.raining = false; weather.thundering = false;
    bedWake(false, true);
  }
  updateBedFade();
}
// A saved sleeping player lies down again when the bed is still there.
function restoreSleep(data) {
  if (!data?.sleeping || !Array.isArray(data.sleeping.bed) || world.get(...data.sleeping.bed) !== BED) return;
  const [x, y, z] = data.sleeping.bed;
  if (bedSleep.begin(world, x, y, z, { player: { x, y, z, alive: true }, daytime: false }) !== "OK") return;
  bedSleep.timer = Math.max(0, Math.min(100, data.sleeping.timer | 0));
  enterSleep();
}
function pause() {
  if (screen === "home" || screen === "dead") return;
  mining = null;
  mineHeld = false;
  eating = null;
  closeModal();
  screen = "paused";
  keys.clear();
  save();
  if (document.pointerLockElement) document.exitPointerLock();
  // GuiIngameMenu (menus.js).
  gui.show(menus.ingameMenu());
}
function goHome() {
  save();
  lan.close();
  hideBedScreen();
  screen = "home";
  closeModal();
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("#hud").classList.add("hidden");
  $("#vignette").classList.remove("in-game");
  gui.show(menus.mainMenu());
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
    "" +
    slotsHtml(container);
  view.shown = [];
  attachPaperdoll(selected === SURVIVAL_TAB ? "creative" : null);
}
const CONTAINER_TITLES = { inventory: "Inventory", workbench: "Crafting", furnace: "Furnace", creative: "", anvil: "Repair & Name", enchanting: "Enchant", merchant: "Villager" },
  CONTAINER_CLASSES = { furnace: "furnace-modal", chest: "chest-modal", dispenser: "dispenser-modal", brewing: "brewing-modal", hopper: "hopper-modal", creative: "creative-modal", anvil: "anvil-modal", enchanting: "enchanting-modal", merchant: "merchant-modal" };
// Slots are addressed by list index: wrapped creative slots all keep slotNumber 0.
const slotsHtml = (container) => `<div class="container-slots">${container.slots.map((slot, i) => `<button class="container-slot" data-container-slot="${i}"${slot.type !== undefined ? ` data-armor="${["helmet", "chestplate", "leggings", "boots"][slot.type]}"` : ""}${slot.x < -1000 ? " hidden" : ""} style="left:calc(${slot.x}*var(--u));top:calc(${slot.y}*var(--u))"></button>`).join("")}</div>`;
// GuiCommandBlock: Creative + command permission required; text and tracking changes are applied on Done only.
function openCommandBlock(x, y, z) {
  if (!survival.creative || !commandHost.cheats) return;
  const tile = redstoneRuntime.commandBlocks.tile(x, y, z);
  screen = "inventory"; mining = null; mineHeld = false;
  document.exitPointerLock?.();
  modal("Set Console Command for Block", `<label>Console Command<input id="command-block-input" maxlength="32767" autocomplete="off" spellcheck="false"></label><p>@p - nearest player<br>@r - random player<br>@a - all players</p><div style="display:flex;gap:8px;align-items:end"><label style="flex:1;min-width:0">Previous Output<input id="command-block-output" readonly></label><button class="button" id="command-block-track" style="width:40px;margin-bottom:2px"></button></div><div class="menu-actions" style="display:flex;gap:8px;margin-top:24px"><button class="button" id="command-block-done" style="flex:1">Done</button><button class="button" id="command-block-cancel" style="flex:1">Cancel</button></div>`);
  const input = $("#command-block-input"), done = $("#command-block-done"), track = $("#command-block-track");
  input.value = tile.command;
  let tracking = tile.trackOutput;
  const output = () => { try { return JSON.parse(tile.lastOutput)?.text ?? ""; } catch { return tile.lastOutput ?? ""; } };
  const refresh = () => { track.textContent = tracking ? "O" : "X"; track.setAttribute("aria-label", "Track output: " + (tracking ? "on" : "off")); $("#command-block-output").value = tracking ? output() : "-"; done.disabled = !input.value.trim(); };
  track.onclick = () => { tracking = !tracking; refresh(); };
  input.oninput = refresh;
  done.onclick = () => { tile.command = input.value; tile.trackOutput = tracking; if (!tracking) tile.lastOutput = null; saved = false; resume(); };
  $("#command-block-cancel").onclick = resume;
  input.onkeydown = e => { if (e.key === "Enter" && !done.disabled) { e.preventDefault(); done.click(); } };
  refresh(); input.focus();
}
function openContainer(container, kind, key = null, gui = new ContainerScreen(container)) {
  screen = "inventory";
  mining = null;
  mineHeld = false;
  const decorations =
    kind === "enchanting"
      ? `${[0, 1, 2].map((i) => `<button class="enchant-option off" data-enchant-option="${i}" style="top:calc(${14 + 19 * i}*var(--u))" aria-label="Enchantment option ${i + 1}"><i class="enchant-icon"></i><b class="enchant-level"></b></button>`).join("")}<span class="enchant-shelves" id="enchant-shelves" aria-live="polite"></span>`
      : kind === "merchant"
      ? merchantDecorationsHtml()
      : kind === "anvil"
      ? '<i class="anvil-name-background" id="anvil-name-background"></i><input id="anvil-name" aria-label="Item name" maxlength="40" autocomplete="off" spellcheck="false" disabled><span id="anvil-cost" class="anvil-cost" aria-live="polite"></span><i class="anvil-error" id="anvil-error" hidden></i>'
      : kind === "brewing"
      ? '<i class="brewing-bubbles" id="brewing-bubbles"></i><i class="brewing-arrow" id="brewing-arrow"></i><span class="chest-bag-label">Inventory</span>'
      : kind === "furnace"
      ? '<i class="furnace-flame" id="furnace-flame"></i><i class="furnace-arrow" id="furnace-arrow"></i>'
      : kind === "chest" || kind === "dispenser" || kind === "hopper"
        ? '<i class="chest-bottom" aria-hidden="true"></i><span class="chest-bag-label">Inventory</span>'
        : `<span class="native-bag-label">Inventory</span><span class="native-crafting-label">Crafting</span>`;
  modal(
    container.title ?? CONTAINER_TITLES[kind],
    kind === "creative" ? '<div class="creative-body"></div>' : slotsHtml(container) + decorations,
    CONTAINER_CLASSES[kind] ? `${CONTAINER_CLASSES[kind]} container-screen` : "inventory-modal native-inventory container-screen" + (kind === "workbench" ? " native-workbench" : ""),
  );
  if (kind === "inventory") $("#modal .container-screen")?.insertAdjacentHTML("beforeend", '<div class="effect-list" id="effect-list"></div>');
  attachPaperdoll(kind === "inventory" ? "inventory" : null);
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
    if (e.target.closest('#anvil-name')) return;
    const stepper = e.target.closest("[data-merchant-step]");
    if (stepper) {
      // GuiMerchant.actionPerformed: the arrow buttons select the previous or next offer (MC|TrSel).
      e.preventDefault();
      if (!stepper.disabled && container.step(+stepper.dataset.merchantStep)) sounds?.play("gui.button.press", { volume: 0.25, pitch: 1 });
      return refreshContainer();
    }
    const option = e.target.closest("[data-enchant-option]");
    if (option) {
      // GuiEnchantment.mouseClicked: any button on an option sends enchantItem.
      e.preventDefault();
      if (container.enchant(+option.dataset.enchantOption)) saved = false;
      return refreshContainer();
    }
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
    if (e.target.closest('#anvil-name') || e.target.closest("[data-enchant-option]") || e.target.closest("[data-merchant-step]")) return;
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
    const stepper = e.target.closest("[data-merchant-step]");
    if (stepper) {
      if (!stepper.disabled && container.step(+stepper.dataset.merchantStep)) sounds?.play("gui.button.press", { volume: 0.25, pitch: 1 });
      return refreshContainer();
    }
    const option = e.target.closest("[data-enchant-option]");
    if (option) {
      if (container.enchant(+option.dataset.enchantOption)) saved = false;
      return refreshContainer();
    }
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
// GuiInventory.func_147046_a: the live player in the survival inventory and the creative inventory tab (inventory-player.js).
let paperdoll = null;
function attachPaperdoll(mode) {
  const screenEl = $("#modal .container-screen"), slots = screenEl?.querySelector(".container-slots") ?? null;
  if (!mode || !slots || !scene) return paperdoll?.detach();
  paperdoll ??= new InventoryPlayerView(scene);
  paperdoll.attach(slots.parentNode, slots, mode);
}
function paperdollFrame() {
  const box = $("#modal .container-screen")?.getBoundingClientRect();
  if (!paperdoll?.mode || !box || !containerView) return;
  const unit = box.width / PAPERDOLL_LAYOUTS[paperdoll.mode].width;
  paperdoll.frame(
    Math.floor((containerView.x - box.left) / unit),
    Math.floor((containerView.y - box.top) / unit),
    unit,
    {
      swing: animate.pose ? (animate.pose.progress < 1 ? animate.pose.progress : 0) : 0,
      armor: survival?.inventory?.armor ?? [],
      held: heldId(),
      heldDamage: survival.held?.damage || 0,
      heldColor: survival.held?.color,
      heldGlint: stackHasEffect(survival.held, ITEMS[survival.held?.id]),
      hurt: survival.hurtTime > 0,
      sneak: motion.sneaking,
      arrowCount: survival.arrowCount,
      arrowEntityId: playerBody.entityId,
      burning: survival.fire > 0,
      fireViewYaw: 180,
      invisible: survival.effects.has(INVISIBILITY),
    },
    playerBody,
    position,
  );
}
function closeContainer() {
  paperdoll?.detach();
  if (!containerView) return;
  const { container, kind, key } = containerView;
  containerView = null;
  if (kind === "chest") redstoneRuntime?.containerClosed(container.keys); else if (key) redstoneRuntime?.containerClosed([key]);
  const overlay = $("#modal");
  overlay.onpointerdown = overlay.onpointermove = overlay.onpointerup = overlay.onwheel = overlay.oncontextmenu = overlay.onclick = null;
  container.close();
  if (kind === "chest") redstoneRuntime?.chestViewersChanged(container.keys); // a trapped chest's power follows its viewers
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
  if(view.kind==='anvil'){
    const left=container.inputs.getStack(0), cost=anvilCost(container);
    $('#anvil-name').disabled=!left;
    $('#anvil-name-background').classList.toggle('active',!!left);
    $('#anvil-cost').textContent=cost.text;
    $('#anvil-cost').classList.toggle('unavailable',cost.unavailable);
    $('#anvil-error').hidden=!(left||container.inputs.getStack(1))||!!container.output;
  }
  if (view.kind === "merchant") renderMerchantView(view);
  if (view.kind === "enchanting") {
    const levels = container.levels, shelves = `Bookshelves: ${container.bookshelves}`;
    for (const b of document.querySelectorAll("[data-enchant-option]")) {
      const i = +b.dataset.enchantOption, state = levels[i] === 0 ? "off" : container.canEnchant(i) ? "on" : "poor";
      b.className = `enchant-option ${state}`;
      b.setAttribute("aria-disabled", String(state !== "on"));
      b.querySelector(".enchant-level").textContent = levels[i] ? String(levels[i]) : "";
      b.setAttribute("aria-label", levels[i] ? `Enchantment option ${i + 1}: level ${levels[i]}${state === "poor" ? " (not enough experience levels)" : ""}` : `Enchantment option ${i + 1}: unavailable`);
    }
    if ($("#enchant-shelves").textContent !== shelves) $("#enchant-shelves").textContent = shelves;
  }
  let contentChanged = false;
  container.slots.forEach((slot, i) => {
    const shown = preview.slots.get(slot) ?? slot.stack,
      over = preview.capped.has(slot),
      key = shown ? `${shown.id},${shown.count},${shown.damage},${shown.color},${over},${stackHasEffect(shown, ITEMS[shown.id])}` : "",
      b = document.querySelector(`[data-container-slot="${i}"]`);
    if (!b) return;
    b.classList.toggle("hovered", view.hovered === slot);
    b.classList.toggle("dragged", dragging && gui.dragSlots.has(slot));
    const label = stackLabel(slot.stack);
    if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
    if (view.shown[i] === key) return;
    view.shown[i] = key;
    contentChanged = true;
    b.innerHTML = stackHtml(shown);
    b.querySelector(".item-count")?.classList.toggle("full", over);
  });
  // World.func_147453_f: an open chest, furnace, dispenser or hopper screen reports content changes to comparators live.
  if (contentChanged && redstoneRuntime) {
    if (view.kind === "chest" && container.keys) redstoneRuntime.containerClosed(container.keys);
    else if (view.key && ["furnace", "dispenser", "hopper", "brewing"].includes(view.kind)) redstoneRuntime.containerClosed([view.key]);
  }
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
  if (view.kind === "merchant" && !container.inv.cursor && !hovered) {
    // GuiMerchant.drawScreen: the three offer items show their own tooltips.
    const offered = offerItemAt(container.view(), view.gx, view.gy)?.live;
    if (offered) lines = tooltipLines(ITEMS[offered.id], offered, options.advancedTooltips);
  }
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
    // The title keeps its rarity colour (an enchanted book's yellow name); later lines default to gray.
    tip.innerHTML = lines.map((l, i) => `<span class="${i ? l.color || "gray" : "title" + (l.color ? " " + l.color : "")}${l.italic ? " italic" : ""}">${esc(l.text) || "&nbsp;"}</span>`).join("");
    tip.style.left = view.x + "px";
    tip.style.top = view.y + "px";
  }
  if (view.kind === "inventory") {
    // GuiInventory.func_146102_a: the active potion effects, listed left of the screen (icon, name with level, remaining time).
    const list = $("#effect-list"), active = [...survival.effects.active.values()].sort((a, b) => a.id - b.id);
    if (list) {
      const html = active.map((e) => {
        const t = POTION_TYPES[e.id], roman = ["", " II", " III", " IV", " V"][e.amplifier] ?? ` ${e.amplifier + 1}`;
        return `<div class="effect-row"><i class="effect-icon" style="--ix:${(t.icon % 8) * 18};--iy:${198 + Math.floor(t.icon / 8) * 18}"></i><span class="effect-name">${esc(t.name + roman)}</span><span class="effect-time">${durationString(e.duration)}</span></div>`;
      }).join("");
      if (view.effectHtml !== html) { view.effectHtml = html; list.innerHTML = html; list.style.setProperty("--rows", active.length); }
    }
  }
  if (view.kind === "brewing") {
    // GuiBrewingStand.drawGuiContainerBackgroundLayer: the arrow grows over the brew, the bubbles follow the 7-step table.
    const stand = view.container.stand;
    $("#brewing-arrow").style.setProperty("--arrow", stand.progress());
    $("#brewing-bubbles").style.setProperty("--bubble", bubbleHeight(stand.brewTime));
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
  // GuiIngame.renderPlayerStats (damage-hud.js): the hurt blink, low-health jiggle, regeneration wave, Absorption and hunger shake.
  const vitals = vitalsLayout({ health: survival.health, maxHealth: survival.maxHealth, absorption: survival.absorption || 0, hurtResistantTime: survival.clientResist, updateCounter: survival.ticks, poison: survival.effects.has(POISON), wither: survival.effects.has(WITHER_EFFECT), regeneration: survival.effects.has(REGENERATION), food: survival.food, saturation: survival.saturation, hunger: survival.effects.has(HUNGER) }),
    hearts = heartsHtml(vitals.hearts),
    food = foodHtml(vitals.food),
    // GuiIngame: armor points above the hearts; air bubbles above hunger, with one popping.
    armor = survival.armorValue,
    armorRow = armor > 0 ? `<div class="armor-row" style="--lift:${vitals.lift}" aria-label="Armor ${armor} of 20">${Array.from({ length: 10 }, (_, i) => `<span class="${i * 2 + 1 < armor ? "full" : i * 2 + 1 === armor ? "half" : "empty"}"></span>`).join("")}</div>` : "",
    bubbles = Math.max(0, Math.ceil(((survival.air - 2) * 10) / 300)),
    popping = Math.max(0, Math.ceil((survival.air * 10) / 300) - bubbles),
    air = survival.air < 300 ? `<div class="air" aria-label="Air ${Math.max(0, survival.air)} of 300">${"<span></span>".repeat(bubbles)}${'<span class="pop"></span>'.repeat(popping)}</div>` : "";
  $("#survival-hud").innerHTML =
    `<div class="vital-row"><div class="hearts${survival.effects.has(POISON) ? ' poisoned' : ''}" aria-label="Health ${Math.ceil(survival.health)} of 20${survival.effects.has(POISON) ? ', Poison' : ''}">${hearts}</div><div class="hunger${survival.effects.has(HUNGER) ? ' afflicted' : ''}" aria-label="Hunger ${survival.food} of 20${survival.effects.has(HUNGER) ? ', Hunger effect' : ''}">${food}</div></div>${armorRow}${air}`;
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
// EntityVillager.interact -> EntityPlayerMP.displayGUIMerchant: the villager takes the player as its customer
// and the offers are generated on first access. Closing the screen releases the customer (MerchantContainer.close).
function useMerchant(entity) {
  const holdingEgg = false; // spawn eggs are not usable on mobs in this build
  const brain = mobs?.ai?.brain(entity);
  if (!brain || !villagerInteract(brain, holdingEgg, "Player")) return false;
  const merchant = { offers: () => villagerOffers(brain), useRecipe: (r) => { villagerUseRecipe(brain, r); saved = false; handleEntityEvents(); }, hover: (has) => villagerHover(brain, has), close: () => villagerClearCustomer(entity) };
  openContainer(new MerchantContainer(survival.inventory, merchant), "merchant");
  villagerOffers(brain);
  refreshContainer();
  return true;
}
// GuiMerchant: the selected offer's three items, the spent-offer crosses and the two arrow buttons.
function renderMerchantView(view) {
  const info = view.container.view(), recipe = info.recipe;
  for (const key of ["buy", "buyB", "sell"]) {
    const el = document.querySelector(`[data-merchant-offer="${key}"]`), item = recipe?.[key];
    if (!el) continue;
    const shown = item ? (item.live ?? null) : null, html = item ? (shown ? stackHtml(shown, item.count) : '<span class="unknown-item" title="Not available in this build">?</span>') : "";
    if (el.dataset.shown !== html) { el.dataset.shown = html; el.innerHTML = html; }
  }
  for (const cross of document.querySelectorAll("[data-merchant-cross]")) cross.hidden = !recipe?.disabled;
  for (const step of document.querySelectorAll("[data-merchant-step]")) step.disabled = !(+step.dataset.merchantStep > 0 ? info.next : info.previous);
  handleEntityEvents();
}
function useAnvil(key){
  const [x,y,z]=key.split(',').map(Number);
  const itemName=native=>{const stack=nativeStackToLive(native);return stack?stackName(stack,ITEMS):'';};
  let container;
  container=new AnvilContainer({inventory:survival.inventory,creative:()=>survival.creative,
    experienceLevel:()=>experience.level,
    payExperienceLevels:cost=>{experience.addLevels(-cost);renderVitals();saved=false;},
    itemName,
    onInputChanged:({current,currentNative})=>{
      const name=current?anvilName(current.displayName??itemName(currentNative)):'';
      const field=$('#anvil-name');if(field)field.value=name;
      container.setName(current&&typeof current.displayName==='string'?name:'');
    },
    onUse:({creative})=>{
      let broken=false;
      if(!creative&&world.get(x,y,z)===ANVIL&&survival.inventory.random.nextFloat()<ANVIL_DAMAGE_CHANCE){
        const meta=damagedAnvilMetadata(world.getMeta(x,y,z));broken=meta<0;
        world.set(x,y,z,broken?0:ANVIL,true,broken?0:meta);scene.updateBlock(x,z,y);
      }
      sounds.play(broken?'random.anvil_break':'random.anvil_use',{volume:1,pitch:1,position:{x:x+.5,y:y+.5,z:z+.5}});
      saved=false;
    },
  });
  openContainer(container,'anvil',key);
  const field=$('#anvil-name');
  field.oninput=()=>{field.value=anvilName(field.value);container.setName(field.value);refreshContainer();};
}
// BlockEnchantmentTable.onBlockActivated: ContainerEnchantment with the saved player Random as its rand.
function useEnchantingTable(key) {
  const [x, y, z] = key.split(",").map(Number);
  openContainer(
    new EnchantingContainer({
      inventory: survival.inventory, world, x, y, z, creative: () => survival.creative,
      experienceLevel: () => experience.level,
      payExperienceLevels: (cost) => { experience.addLevels(-cost); renderVitals(); saved = false; },
      onUse: () => { saved = false; },
    }),
    "enchanting",
    key,
  );
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
    if (world.streaming && !world.isLoaded(x,z)) continue;
    if (!isChestBlock(world.get(x, y, z))) {
      delete survival.chests[key];
      continue;
    }
    if (!chest.users && !chest.lid && !chest.prevLid) continue;
    const pair = chestPair(world, x, y, z),
      sound = tickLid(chest, pair.primary);
    if (sound) sounds.play(sound, { volume: 0.5, pitch: Math.random() * 0.1 + 0.9, position: { x: x + (pair.east ? 1 : 0.5), y: y + 0.5, z: z + (pair.south ? 1 : 0.5) } });
  }
  // TileEntityEnderChest.updateEntity: the same lid step, the sound at the block centre.
  for (const [key, tile] of Object.entries(survival.enderTiles)) {
    const [x, y, z] = key.split(",").map(Number);
    if (world.streaming && !world.isLoaded(x, z)) continue;
    if (world.get(x, y, z) !== ENDER_CHEST) { delete survival.enderTiles[key]; continue; }
    if (!tile.users && !tile.lid && !tile.prevLid) continue;
    const sound = tickLid(tile, true);
    if (sound) sounds.play(sound, { volume: 0.5, pitch: Math.random() * 0.1 + 0.9, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
  }
  chestRenderer.sync(world, survival.chests, undefined, survival.enderTiles);
  // Container.canInteractWith: the screen closes once its chest is gone.
  if (containerView?.kind === "hopper" && world.get(...containerView.key.split(",").map(Number)) !== HOPPER) resume();
  if (containerView?.kind === "brewing" && world.get(...containerView.key.split(",").map(Number)) !== BREWING_STAND) resume();
  if (containerView?.kind === "dispenser" && ![DISPENSER, DROPPER].includes(world.get(...containerView.key.split(",").map(Number)))) resume();
  if (containerView?.kind === "chest" && containerView.container.keys?.some((k) => { const b = world.get(...k.split(",").map(Number)); return !isChestBlock(b) && b !== ENDER_CHEST; })) resume();
  if (containerView?.kind === "enchanting") {
    // ContainerEnchantment.canInteractWith: the table must still exist and be within 8 blocks.
    const [x, y, z] = containerView.key.split(",").map(Number);
    if (world.get(x, y, z) !== ENCHANTING_TABLE || !withinEnchantReach(position, x, y, z)) resume();
  }
  if(containerView?.kind==='anvil'){
    const [x,y,z]=containerView.key.split(',').map(Number);
    if(world.get(x,y,z)!==ANVIL||(position.x-x-.5)**2+(position.y-y-.5)**2+(position.z-z-.5)**2>64)resume();
  }
}
// TileEntityBrewingStand.updateEntity for every loaded stand: the 400-tick brew, bottle bits as metadata (flag 2), comparator updates.
function tickBrewingStands() {
  for (const [key, data] of Object.entries(survival.brewing ?? {})) {
    const [x, y, z] = key.split(",").map(Number);
    if (world.get(x, y, z) !== BREWING_STAND) { if (!world.streaming || world.isTicking(x, z)) delete survival.brewing[key]; continue; }
    if (world.streaming && !world.isTicking(x, z)) continue;
    const view = brewingView(data), before = data.brewTime | 0, bits = view.tick();
    if (bits !== null || world.getMeta(x, y, z) !== view.bottleBits()) {
      world.set(x, y, z, BREWING_STAND, true, view.bottleBits());
      scene.updateBlock(x, z, y);
    }
    if (bits !== null || (before > 0 && !(data.brewTime | 0))) { saved = false; redstoneRuntime?.containerClosed([key]); }
    else if (!before && (data.brewTime | 0)) saved = false;
  }
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
  if (bedSleep.sleeping) bedWake(true, false, false);
  const vehicle = vehicleState();
  detachPlayerVehicle(vehicle);
  applyVehicleState(vehicle);
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
  // gamerule keepInventory: the inventory is not dropped and the experience is kept (EntityPlayerMP.clonePlayer copies both).
  const keep = !ruleOn(active, "keepInventory");
  const stacks = keep ? survival.inventory.takeAll() : [];
  // EntityPlayer.onDeath -> InventoryPlayer.dropAllItems scatters every stack.
  for (const s of stacks) items.dropPlayer(s, position, yaw, pitch, true, true);
  // EntityLivingBase.onDeathUpdate (not overridden by EntityPlayer) leaves the orbs only while gamerule doMobLoot is true.
  const deathScore=experience.score;if(keep){const dropped=experience.death();if(gameRule("doMobLoot"))xpOrbs.spawn(dropped,position);}
  renderHotbar();renderVitals();$("#block-label").classList.remove("visible");
  save();
  modal(
    "You died!",
    `<p class="death-score">Score: <span>${deathScore}</span></p><div class="menu-actions"><button class="button primary full" id="respawn">Respawn</button><button class="button secondary full" id="death-home">Title screen</button></div>`,
    'death-modal',
  );
  $("#modal .close-button").hidden = true;
  const deathButtons=[$('#respawn'),$('#death-home')];for(const button of deathButtons)button.disabled=true;setTimeout(()=>{if(screen==='dead')for(const button of deathButtons)button.disabled=false;},1000);
  $("#respawn").onclick = async () => {
    for(const button of deathButtons)button.disabled=true;
    try {
    let spawn=await spawnPosition();
    // EntityPlayer.verifyRespawnCoordinates: a bed spawn point must still be a bed with a free cell beside it.
    if (bedSleep.spawn) {
      const [bx, by, bz] = bedSleep.spawn;
      if (world.streaming && !world.isLoaded(bx, bz) && streamStorage) { await streamStorage.ensure(streamStorage.columns(bx, bz)); const change = world.streamAround(bx, bz); if (change) { scene.syncChunks(change); materializeFresh(); } }
      const cell = verifyRespawn(world, bedSleep.spawn, false);
      if (cell) spawn = bedRespawnPosition(cell);
      else { bedSleep.spawn = null; showChatLine(document, BED_TEXT.notValid); }
    } else if (active.playerSpawn) spawn = { x: active.playerSpawn[0] + 0.5, y: active.playerSpawn[1], z: active.playerSpawn[2] + 0.5 }; // /spawnpoint
    const time = survival.time;
    const kept = ruleOn(active, "keepInventory") && { slots: survival.inventory.serialize(), armor: survival.inventory.serializeArmor() };
    survival = new Survival({ time, slots: [], ...kept, furnaces: survival.furnaces, chests: survival.chests, dispensers: survival.dispensers, hoppers: survival.hoppers, brewing: survival.brewing }, survival.mode);
    survival.protection = 60;
    survival.furnaceActive = key => !world.streaming || world.isTicking(...[key.split(",")[0],key.split(",")[2]].map(Number));
    survival.furnaceChanged = key => redstoneRuntime?.containerClosed([key]);
    updateDifficulty();
    if (!kept) experience=new Experience();
    position.copy(new THREE.Vector3(...Object.values(spawn)));
    previous.copy(position);
    playerBody.reset(position, yaw, pitch);
    velocity.set(0, 0, 0);
    fallDistance = 0;
    motion.inWeb = false;
    renderHotbar();
    renderVitals();
    resume();
    save();
    } catch(e) {toast('Could not load the respawn area. Reopen the world to retry: '+e.message);}
    finally {if(screen==='dead')for(const button of deathButtons)button.disabled=false;}
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
// EntityPlayerSP.timeInPortal: Nausea longer than 60 ticks winds the screen warp up (potion-fx.js).
const portalTimer = new PortalTimer();
function tickSurvival(inWater, oldPosition, inLavaNow = false) {
  // Game rules the Survival object reads (gamerule naturalRegeneration / doDaylightCycle).
  survival.naturalRegeneration = ruleOn(active, "naturalRegeneration");
  survival.timeFrozen = !ruleOn(active, "doDaylightCycle");
  portalTimer.tick(survival.effects.get(NAUSEA)?.duration ?? 0);
  tickPlayerEnvironment({ world, weather, position, survival, motion, flying }, { inWater, inLavaNow }, {
    tickWeather,
    slow: (f) => { velocity.x *= f; velocity.z *= f; }, // BlockSoulSand.onEntityCollidedWithBlock
    afterSurvival: () => {
      // Drowning bubbles and potion particles run before the block-collision tail.
      const posY = position.y + Math.fround(PHYSICS.eye);
      if (survival.drowned) {
        survival.drowned = false;
        drownBubbles(scene.fx, { x: position.x, y: posY, z: position.z, mx: velocity.x, my: velocity.y, mz: velocity.z }, playerRandom);
      }
      potionParticles(scene.fx, { x: position.x, y: posY, z: position.z, yOffset: Math.fround(PHYSICS.eye), width: PHYSICS.width, height: PHYSICS.height }, potionColor(survival.effects.active.values()), playerRandom, { invisible: survival.effects.has(INVISIBILITY) });
    },
    fizz: () => sounds.play("random.fizz", { volume: 0.7, pitch: 1.6 + (Math.random() - Math.random()) * 0.4 }),
  });
  // Scheduled sand and gravel updates and the falling-block entities (WorldServer.tick).
  if (falling) {
    falling.tick();
    world.redstoneBlocks?.tick();
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
  // MobSpawnerBaseLogic.updateSpawner on the client: smoke and flame, the display mob's spin.
  tickSpawnersClient({ spawners, random: scene.explosionParticles.worldRandom, eye: { x: position.x, y: position.y + Math.fround(PHYSICS.eye), z: position.z } },
    { particle: (name, x, y, z) => scene.fx.spawn(name, x, y, z) });
  const movement = { world, position, survival, motion, grounded, fallDistance, landedFall };
  finishPlayerMovement(movement, { inWater, inLavaNow, oldPosition }, {
    trample: trampleFarmland,
    fallSound: (s) => sounds?.play(s.name, { volume: s.volume, pitch: s.pitch }),
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
    projectilePearlImpact: ({pearl,hit}) => {
      const state={world,position,previous,survival,rider,minecarts,fallDistance,landedFall};
      impactPlayerPearl(state,pearl,hit,{
        hit:(e,source)=>e!=="player"&&mobs?.attackEntityFrom(e,source.amount,{
          name:'thrown',player:!!source.thrower,attacker:'projectile',
          ...(source.thrower?{from:{x:position.x,z:position.z}}:{}),
        }),
        particle:p=>scene.fx.spawn('portal',p.x,p.y,p.z,p.mx,p.my,p.mz),
        teleport:({from,to})=>{
          // Count the physical movement preceding the teleport, not its displacement.
          oldPosition.x+=to.x-from.x;oldPosition.y+=to.y-from.y;oldPosition.z+=to.z-from.z;
        },
        markUnsaved:()=>{saved=false;},
      });
      ({fallDistance,landedFall}=state);
    },
    // EntityEgg.onImpact: hatched chicks join the mob list before mob events drain.
    projectileEvent: h => {
      if (h.sound) sounds.play(h.sound, { position: h.position, volume: h.volume, pitch: h.pitch });
      else if (mobs) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
    },
    handleEntityEvents,
    arrowOptions: () => ({ targets: [...arrowTargets(mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height), survival.creative), ...hangingArrowTargets(hanging)],
      hanging, mobs, survival, player: position, igniteTnt: (x, y, z, placer) => {
        lightTnt(x, y, z, placer);
        if (world.set(x, y, z, 0)) scene.updateBlocks([[x, y, z, TNT, 0]]);
      } }),
    arrowsCollected: () => { renderHotbar(); saved = false; },
    flushArrows,
  });
  fishing.tick(fishingHost());
  // EntityMinecartChest.onUpdate and the player's and mobs' pushes against carts; spilled
  // contents and the broken cart's items become item entities.
  if (tickMinecartSimulation({ world, minecarts, mobs, position, velocity, rider, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0 }, {
    drop: (d) => { if (d.stack) items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay, motion: d.motion }); },
  }).length) saved = false;
  // EntityBoat.onUpdate: buoyancy, rider input, breakage; its splash particles and cleared snow or lily pads.
  if (tickBoatSimulation({ world, boats, mobs, position, velocity, rider, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0 }, {
    drop: (d) => { if (d.stack) items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay, motion: d.motion }); },
    particle: ([kind, x, y, z, mx, my, mz]) => scene.fx.spawn(kind, x, y, z, mx, my, mz),
    splash: (b, volume, pitch) => sounds.play("game.neutral.swim.splash", { volume, pitch, position: { x: b.x, y: b.posY, z: b.z } }),
    clear: (x, y, z, block) => {
      if (block === SNOW_LAYER) { if (world.set(x, y, z, 0)) scene.updateBlock(x, z, y); } else breakBlock([x, y, z]);
      saved = false;
    },
  }).length) saved = false;
  // EntityHanging.onUpdate: the surface check every 100 ticks; broken ones drop their items.
  hanging.tick(world, { active: (e) => !world.streaming || world.isTicking(e.x, e.z) });
  spawnHangingDrops();
  const vehicle = vehicleState();
  finishVehicleTick(vehicle);
  applyVehicleState(vehicle);
  if (containerView?.container.cart && !minecarts.usable(containerView.container.cart, position)) resume();
  scene.setFishing(fishing.active ? { hook: fishing.hook, first: !thirdPersonView, sneaking: !!motion.sneaking } : null);
  scene.setDrops(items.items);
  scene.setProjectiles(mobs?.potions?.balls?.length ? [...projectiles.balls, ...mobs.potions.balls] : projectiles.balls, projectiles.particles);
  scene.setTime(survival.time);
  renderVitals();
  updateFurnace();
  if (survival.health <= 0) die();
}
// What the fishing hook needs from the running game (fishing-simulation.js).
function fishingHost() {
  return {
    world, position, yaw, pitch, survival, mobs, itemRand, fx: scene.fx, worldRand: weather.random,
    canLightningStrike: (x, y, z) => canLightningStrikeAt(weather, world, x, y, z),
    canSeeSky: (x, y, z) => canSeeSky(world, x, y, z),
    sound: (name, volume, pitch, hook) => sounds.play(name, { volume, pitch, ...(hook ? { position: { x: hook.x, y: hook.y, z: hook.z } } : {}) }),
    targets: () => mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height),
    hit: (e) => thrownHit(mobs, e, position),
    pull: (e, [dx, dy, dz]) => { if (Number.isFinite(e.vx)) { e.vx += dx; e.vy += dy; e.vz += dz; } },
    drop: (stack, x, y, z, motion) => items.spawn(stack, x, y, z, { motion }),
    orb: (n) => xpOrbs.spawn(n, { x: position.x, y: position.y + 0.5, z: position.z + 0.5 }),
    wear: (n) => { if (!survival.creative) survival.wear(FISHING_ROD, n); renderHotbar(); reportBrokenTool(); saved = false; },
  };
}
// The sounds the arrows made (the bow's, the hits', the pickup's) and the arrows to draw.
function flushArrows() {
  for (const e of arrows.drain())
    sounds.play(e.sound, e.position ? { volume: e.volume, pitch: e.pitch, position: e.position } : { volume: e.volume, pitch: e.pitch });
  scene.setArrows(arrows.list);
}
// ItemBow.onPlayerStoppedUsing: the right button was let go after `eating.ticks` ticks of
// draw. The captured release dispatches immediately to player-throw-simulation.js.
function releaseBowUse() {
  const action = captureReleaseAction();
  traceAction(action);
  const state = { screen, eating, survival, arrows, position, yaw, pitch };
  dispatchReleaseAction(state, action, { flushArrows, renderHotbar, markUnsaved: () => { saved = false; } });
  eating = state.eating;
}
function trampleFarmland(entity, distance) {
  const x = Math.floor(entity.x), y = Math.floor(entity.y - 0.2), z = Math.floor(entity.z);
  if (farming.trample(x, y, z, distance, Math.random, entity === position || gameRule("mobGriefing"))) {
    applyFarmUpdates(farming.drain());
    saved = false;
  }
}
function applyFarmUpdates(updates){const chunks=new Set();for(const[x,y,z]of updates)chunks.add([Math.floor(x/16)*16,Math.floor(z/16)*16].join(','));for(const key of chunks)scene.buildChunk(...key.split(',').map(Number));}
// Shared synchronous event routing, also used immediately after player attacks/interaction.
function mobEventHooks() {
  return {
    sound: (event, raw) => {
      sounds.play(event.sound, { position: event.position, volume: event.volume, pitch: event.pitch });
      // World event 2002 (EntityPotion.onImpact): the glass and spell particles at the impact block.
      if (raw?.splashBreak) splashBreak(scene.fx, scene.fx.worldRandom, raw.splashBreak.damage, raw.splashBreak.x, raw.splashBreak.y, raw.splashBreak.z);
    },
    explode: explodeAt,
    // A villager's EntityAIOpenDoor swung a door: redraw both halves.
    doorUpdate: (cells) => { for (const [x, y, z] of cells) scene.updateBlock(x, z, y); saved = false; },
    // A silverfish hid in or released a monster egg (EntitySilverfish.updateEntityActionState).
    blockEdit: (cells, event) => {
      for (const [x, y, z] of cells) scene.updateBlock(x, z, y);
      const b = event.blockBreak;
      if (b) {
        const s = breakSound(b.block);
        sounds.play(s.name, { position: { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }, volume: s.volume, pitch: s.pitch });
        scene.particles.destroyBlock(world, b.x, b.y, b.z, b.block);
      }
      saved = false;
    },
    // EntityAIEatGrass: the edit already happened; level event 2001 updates its presentation.
    eatGrass: ({ x, y, z, block }) => {
      scene.updateBlock(x, z, y);
      const s = breakSound(block);
      sounds.play(s.name, { position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, volume: s.volume, pitch: s.pitch });
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
// Development-only bounded trace of captured edit/release actions with their player tick.
function traceAction(action) {
  if (!import.meta.env.DEV) return;
  editActionLog.push({ tick: survival.time, action });
  if (editActionLog.length > 256) editActionLog.shift();
}
// Browser adapters transfer live references and scalar movement state synchronously.
function vehicleState() {
  return { screen, world, minecarts, boats, rider, position, previous, velocity, motion, survival, yaw, eating,
    grounded, collidedH, flying, fallDistance, landedFall };
}
function applyVehicleState(state) {
  ({ grounded, collidedH, flying, fallDistance, landedFall } = state);
}
function spawnHangingDrops() {
  for (const d of hanging.drain()) { items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }); saved = false; }
}
function edit(place = false) {
  if (screen !== "playing") return;
  if(target?.block)world.populationBlocks?.touch(...target.block);
  // A painting or item frame under the crosshair, or a held painting/frame item on a wall (hanging-interaction.js).
  if (applyHangingEdit({ hanging, world, survival, heldId: heldId(), place, target, aimed: aimedHanging }, {
    swing: () => animation.swing(),
    renderHotbar,
    markUnsaved: () => { saved = false; },
  })) { mining = null; saved = false; spawnHangingDrops(); return; }
  // A chest minecart under the crosshair (nearer than any block or mob): attack or open it.
  if (aimedCart && !aimedCart.cart.dead) {
    mining = null;
    const state = vehicleState();
    const action = captureVehicleAction({ cartId: aimedCart.cart.id, boat: !!aimedCart.cart.boat, place, sneak: captureMovementInput(keys).sneak, heldTool: heldId() });
    traceAction(action);
    const done = dispatchVehicleAction(state, action, {
      swing: () => animation.swing(),
      damage: () => heldAttackDamage(heldId(), survival),
      openContainer: (container) => openContainer(container, "chest"),
      toast,
      markUnsaved: () => { saved = false; },
    });
    applyVehicleState(state);
    if (done.handled) {
      renderVitals();
      saved = false;
      return;
    }
  }
  const state = { screen, heldTool: heldId(), world, survival, position, velocity, motion, mobs, minecarts,
    farming, trees, fire, fluids, items, projectiles, grounded, fallDistance, wasInWater, yaw, pitch,
    eating, mining, mineCooldown, mineHeld, flowers: FLOWERS, boneRandom, itemRand, signs };
  // A right click with a bucket also captures the bucket's own fluid-aware trace along the
  // last frame's eye ray (ItemBucket: 5 blocks, liquids only when empty).
  const bucket = place ? captureBucketTarget(world, state.heldTool, eyeRay) : null;
  const action = capturePlayerAction({ place, target, aimedEntity, heldTool: state.heldTool, bucket });
  traceAction(action);
  const syncContainerState = () => {
    state.screen = screen;
    state.mining = mining;
    state.mineHeld = mineHeld;
  };
  const acted = dispatchPlayerAction(state, action, {
    apply: world.redstoneApply,
    unlock: () => sounds.unlock(),
    swing: () => animation.swing(),
    resetEquipped: () => animation.resetEquipped(),
    destroyParticles: (x, y, z, block, meta) => scene.particles.destroyBlock(world, x, y, z, block, meta),
    criticalHit: entity => { scene.fx.crit2(() => mobs.fxTarget(entity)); },
    enchantmentCriticalHit: entity => { scene.fx.crit2(() => mobs.fxTarget(entity), true); },
    handleEntityEvents,
    useFishingRod: () => fishing.use(fishingHost()),
    renderHotbar,
    renderVitals,
    markUnsaved: () => { saved = false; },
    playSound: (name, options) => sounds.play(name, options),
    scheduleFalling:(x,y,z)=>falling.schedule(x,y,z,ANVIL),
    sound,
    reportBrokenTool,
    toast,
    applyFarmUpdates,
    updateBlock: (x, z, y) => scene.updateBlock(x, z, y),
    updateBlocks: changes => scene.updateBlocks(changes),
    boneMealSparkles: (block, x, y, z, height, random) => { boneMealSparkles(scene.fx, block, x, y, z, height, random); },
    lightTnt,
    openInventory: station => { inventory(station); syncContainerState(); },
    useFurnace: key => { useFurnace(key); syncContainerState(); },
    useAnvil: key => { useAnvil(key); syncContainerState(); },
    useBed,
    openSignEditor: (tile) => { screen = "inventory"; mining = null; mineHeld = false; openSignEditor({ show: (title, html) => modal(title, html), close: resume, markUnsaved: () => { saved = false; } }, signs, tile, world); syncContainerState(); },
    useCommandBlock: openCommandBlock,
    // ItemRecord.onItemUse / BlockJukebox / BlockNote.onBlockActivated; the disc leaves the stack outside Creative.
    useNoteJukebox: (x, y, z, held) => {
      const r = redstoneRuntime?.music.use(x, y, z, held);
      if (!r?.handled) return false;
      if (r.consumed && !survival.creative) { survival.take(held); renderHotbar(); }
      saved = false;
      return true;
    },
    blockClicked: (x, y, z) => { if (!survival.creative) { redstoneRuntime?.music.click(x, y, z); saved = false; } },
    openMerchant: entity => { const opened = useMerchant(entity); if (opened) syncContainerState(); return opened; },
    useEnchantingTable: key => { useEnchantingTable(key); syncContainerState(); },
    openChest: (chest, key) => { openContainer(chest, "chest", key); redstoneRuntime?.chestViewersChanged(chest.keys); syncContainerState(); },
    openBrewing: (tile, key) => { openContainer(new BrewingContainer(survival.inventory, brewingView(tile), () => { saved = false; }), "brewing", key); syncContainerState(); },
    openHopper: (hopper, key) => { openContainer(new HopperContainer(survival.inventory, hopper, () => { saved = false; }), "hopper", key); syncContainerState(); },
    openDispenser: (dispenser, key, _block, title = DISPENSER_TITLE) => { openContainer(Object.assign(new DispenserContainer(survival.inventory, dispenser, () => { saved = false; }), { title }), "dispenser", key); syncContainerState(); },
    breakBlock,
    clientEyeInWater,
    // ItemBoat.onItemRightClick: a water trace along the view ray (works on land too); the boat is taken
    // from the stack except in Creative.
    placeBoat: () => {
      if (!eyeRay || !boats.place(world, { eye: eyeRay.origin, dir: eyeRay.dir, yaw: Math.fround(180 - yaw * 180 / Math.PI) })) return false;
      if (!survival.creative) survival.take(BOAT_ITEM, 1);
      animation.swing(); renderHotbar(); saved = false;
      return true;
    },
  });
  ({ eating, mining, mineCooldown } = state);
  // BlockPumpkin.onBlockAdded: a pumpkin set on an iron T builds a player-created iron golem.
  const put = acted?.placement;
  if (put?.placed && put.block === PUMPKIN && put.position) {
    const [px, py, pz] = Array.isArray(put.position) ? put.position : [put.position.x, put.position.y, put.position.z];
    const cleared = mobs.tryBuildIronGolem(px, py, pz);
    if (cleared) { for (const [x, y, z] of cleared) scene.updateBlock(x, z, y); saved = false; }
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
function explodeAt(x, y, z, size, { exploder = null, attacker = null, smoking = true } = {}) {
  applyExplosion({ world, weather, mobs, items, xpOrbs, arrows, projectiles, falling, primed, hanging,
    survival, position, velocity, farming }, { x, y, z, size, exploder, attacker, smoking }, {
    brokenTool: reportBrokenTool,
    burst: (...args) => scene.explosionParticles.burst(...args),
    sound: (name, options) => sounds.play(name, options),
    updateBlocks: changes => scene.updateBlocks(changes),
    syncChests: () => chestRenderer.sync(world, survival.chests, undefined, survival.enderTiles),
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
    releaseSilverfish: (x, y, z) => mobs.spawnSilverfishAt?.(x, y, z),
  });
}
// Block.getItem for middle-click: farmland gives dirt, crops give seeds, water nothing.
const pickItem = (block, meta = 0) => block === 139 ? 1139 : block === 177 || block === 178 ? block + 1000 : isColoredBlock(block) ? block + COLORED_ITEM_OFFSET : isDispenserPiston(block) ? (block === PISTON_HEAD ? itemForBlock(headBaseId(meta)) : itemForBlock(block)) : isRedstoneBlock(block) ? redstoneItemOf(block) : (block === 29 || block === 30 ? 2 : block === WOODEN_DOOR ? WOODEN_DOOR_ITEM : block === IRON_DOOR ? IRON_DOOR_ITEM : block === REEDS ? REEDS_ITEM : isCrop(block) ? cropItem(block) : !isLiquid(block) && ITEMS[block] ? blockItemId(block) : 0);
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
  const state = { playing: screen === "playing", mineHeld, target, aimedEntity: aimedEntity || aimedCart || aimedHanging, mining,
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
    // PlayerControllerMP.onPlayerDamageBlock: the step sound at (volume + 1) / 8, frequency * 0.5, at the block.
    digSound: (type, cell) => {
      const s = hitSound(type);
      sounds.play(s.name, { volume: s.volume, pitch: s.pitch, position: cell && { x: cell[0] + 0.5, y: cell[1] + 0.5, z: cell[2] + 0.5 } });
    },
    breakBlock,
    hitParticles: (x, y, z, side) => scene.particles.hitBlock(world, x, y, z, side),
    mayHit: (x, y, z) => mayHitBlock(survival, world.get(x, y, z), world.getMeta(x, y, z), heldId()),
  });
  mining = state.mining;
  mineCooldown = state.cooldown;
}
// Streamed population (version 13): chests, animals, spawners, carts and liquid ticks of columns that
// just became resident for the first time. Resident columns already claimed are never handed over again.
function materializeFresh() {
  containerResidency?.admit();
  const columns = world.claimFreshColumns();
  if (columns.length) {
    const handed = restorePopulationColumns(columns, { world, survival, mobs, spawners, minecarts, fluids });
    if (handed.animals || handed.chests || handed.dispensers || handed.pots || handed.spawners || handed.carts || handed.ticks) saved = false;
  }
  // Chest models follow the resident columns (chests of columns that left the window are removed).
  chestRenderer?.sync(world, survival.chests, undefined, survival.enderTiles);
}
// Streamed worlds build upcoming cells/columns in a worker (streaming-generator.js); without one,
// generation stays synchronous.
let streamPrefetch = null, streamStorage = null, containerResidency = null;
function startPrefetch() {
  streamPrefetch?.dispose();
  streamPrefetch = null;
  if (!world.streaming || typeof Worker !== "function") return;
  try {
    streamPrefetch = new StreamPrefetch(world, new Worker(new URL("./streaming-worker.js", import.meta.url), { type: "module" }));
  } catch (e) {
    console.error(`streaming-generator: no worker, generating on the main thread: ${e.message}`);
  }
}
async function spawnPosition() {
  if(streamStorage)await streamStorage.ensure(streamStorage.columns(64,64));
  if(containerResidency)await containerResidency.ensure(containerResidency.columns(64,64));
  const change = world.streaming && world.streamAround(64,64);
  if (change) { scene.syncChunks(change); materializeFresh(); }
  return world.spawn();
}
function movementTick(controls) {
  if(containerResidency) {
    if(containerResidency.update(position.x,position.z).length)containerResidency.pruneRecord(active);
    if(!containerResidency.ready(position.x,position.z))return;
  }
  if(streamStorage) {
    streamStorage.update(position.x,position.z);
    if(!streamStorage.ready(position.x,position.z))return;
  }
  // While the worker is still building the next square, the shift waits as long as the player is
  // inside the ticking area; past it the square is generated here.
  const hold = streamPrefetch && world.isTicking(position.x, position.z) && !streamPrefetch.ready(position.x, position.z);
  const change = !hold && world.streamAround(position.x,position.z);
  if (change) { scene.syncChunks(change); materializeFresh(); }
  const state = { world, position, previous, velocity, motion, survival, yaw, eating, minecarts, boats, rider,
    grounded, collidedH, flying, fallDistance, landedFall };
  const { inWater, inLavaNow, sneakOnGround, oldPosition } = moveRidingPlayer(state, controls,
    { trace: traceAction, markUnsaved: () => { saved = false; } }) ?? movePlayer(state, controls, toast);
  ({ grounded, collidedH, flying, fallDistance, landedFall } = state);
  streamPrefetch?.update(position.x, position.z);
  walkFrozen = sneakOnGround;
  $("#movement-label").textContent = rider.vehicle ? "RIDING" : flying
    ? "FLYING"
    : inWater
      ? "SWIMMING"
      : "WALKING";
  tickSurvival(inWater, oldPosition, inLavaNow);
  tickBlockSystems({ farming, fluids, fire },
    { time: survival.time, daylight: scene.daylight, x: position.x, z: position.z },
    { farming: applyFarmUpdates, fluids: changes => { scene.updateBlocks(changes); redstoneRuntime?.fluidChanges(changes); }, fire: changes => scene.updateBlocks(changes) });
  // Scheduled block updates, block events and the piston tile loop run after the fluid and fire ticks and before the mobs.
  // TileEntityHopper.updateEntity for every loaded hopper (the tile-entity loop runs before the scheduled updates).
  hopperTiles.tick();
  tickBrewingStands();
  redstoneRuntime?.tick();
  recordHud.tick();
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
  // MobSpawnerBaseLogic.updateSpawner on the server (tile entities tick after the entities).
  if (mobs && spawners?.size) {
    const level = (x, y, z, sub) => (scene.light ? scene.light.level(x, y, z, sub) : 15);
    const spawned = tickSpawnerSimulation({ spawners, mobs, minecarts, random: weather.random,
      feet: survival.health > 0 ? { x: position.x, y: position.y, z: position.z } : null }, {
      skyLight: (x, y, z) => (scene.light ? scene.light.skyAt(x, y, z) : 15),
      lightValue: (x, y, z) => level(x, y, z, scene.subtracted ?? 0),
      thunderLightValue: (x, y, z) => level(x, y, z, 10),
      thundering: () => weather.isThundering(),
    }, { spawnParticles: (x, y, z) => spawnerBurst(x, y, z, scene.explosionParticles.worldRandom, (name, px, py, pz) => scene.fx.spawn(name, px, py, pz)) });
    if (spawned.length) { handleEntityEvents(); saved = false; }
  }
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
    const sx = Math.floor(position.x), sy = Math.floor(position.y - 0.05), sz = Math.floor(position.z);
    const b = onLadderStep ? LADDER : world.get(sx, sy, sz);
    if (inWater) sounds.play("game.player.swim", { volume: 0.3 });
    else {
      // Entity.func_145780_a: Block.SoundType volume * 0.15 at its frequency; a snow layer on top substitutes the snow
      // type and liquids stay silent (block-sounds.js).
      const s = footstepSound(b, onLadderStep ? 0 : world.get(sx, sy + 1, sz));
      if (s) sounds.play(s.name, { volume: s.volume, pitch: s.pitch });
    }
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
          notes,
          home: () => {
            if (screen !== "home") goHome();
            else closeModal();
          },
        })[b.dataset.action]?.();
      }),
  );
}
$("#pause-button").onclick = pause;
$("#fullscreen").onclick = toggleFullscreen;
$("#file-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 128 * 1024 * 1024) throw new Error("File is too large");
    const data = JSON.parse(await file.text());
    if (
      data.format !== "blockworld" ||
      data.version !== 1 ||
      typeof data.name !== "string" ||
      typeof data.seed !== "string" ||
      (!["meadow", "alpine", "island", "snowy"].includes(data.biome) && !isJavaLandscape(data.biome))
    )
      throw new Error("Choose a Blockworld export file");
    const check = new World(data.seed, data.biome, data.generationVersion ?? 1, data.worldType);
    check.restore(data.edits);
    const record = {
      ...makeRecord(data),
      ...importedRuntime(data),
      edits: [...check.edits],
      generationVersion: data.generationVersion ?? 1,
      mode: gameModeOf(data.mode),
      player: new Survival(legacyPlayer(data), data.mode).serialize(),
    };
    worlds.unshift(record);
    if (!await persist()) throw new Error('World imported in memory. Export a copy because device storage is unavailable.');
    if (gui.screen?.id === "select-world") gui.build();
    toast("World imported.");
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
};

window.addEventListener("keydown", (e) => {
  if(exportBusy){e.preventDefault();return;}
  // An open menu screen takes every key (GuiScreen.handleKeyboardInput).
  if (gui.open) {
    gui.key(e);
    return;
  }
  // KeyBinding key.smoothCamera (unbound by default; Options > Controls can bind it).
  if (screen === "playing" && options.keys?.["key.smoothCamera"] && e.code === options.keys["key.smoothCamera"] && !e.repeat) smoothCamera = !smoothCamera;
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
  // KeyBinding key.chat (T) opens the chat; key.command (/) opens it with "/" typed.
  if (!e.repeat && (e.code === (options.keys?.["key.chat"] ?? "KeyT") || e.code === (options.keys?.["key.command"] ?? "Slash"))) {
    e.preventDefault();
    openChat(e.code === (options.keys?.["key.command"] ?? "Slash") ? "/" : "");
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
    if (options.keys?.["key.smoothCamera"] === "Mouse" + e.button) smoothCamera = !smoothCamera;
    if (e.button === 2) {
      edit(true);
      return;
    }
    if (e.button === 1) {
      const stonePick = target && (stoneUtilityPick(world, ...target.block) ?? shapedPick(world.get(...target.block), world.getMeta(...target.block)));
      const id = stonePick?.id ?? (target && pickItem(world.get(...target.block), world.getMeta(...target.block)));
      if (id) {
        survival.inventory.pick(id, survival.creative, stonePick ? stonePick.damage : isColoredBlock(world.get(...target.block)) ? coloredPickDamage(world.get(...target.block), world.getMeta(...target.block)) : treePickDamage(id, world.getMeta(...target.block)) ?? (id === WOOL || id === RED_FLOWER || id === 2 || id === 6 || id === 56 || id === 58 ? world.getMeta(...target.block) : undefined));
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
  // Minecraft.isGamePaused: the game menu stops the world unless the LAN server is public (lan.js).
  const running = () => screen === "playing" || screen === "inventory" || (screen === "paused" && !lan.paused(true));
  if (running()) {
    accumulator += dt;
    while (accumulator >= PHYSICS.tick && running()) {
      updateParticleOptions();
      // --- Block particles (particles.js): Entity.onEntityUpdate's sprint particle uses the
      // pre-move position, last tick's motion and in-water flag, before movementTick moves the
      // player; EffectRenderer.updateEffects then runs after this tick's spawns. ---
      if (motion.sprinting) spawnRunningParticles(scene.particles, world, { x: position.x, y: position.y, z: position.z, mx: velocity.x, mz: velocity.z, sprinting: true, inWater: wasInWater, ySize: motion.ySize }, playerRandom, [position.x, position.y + PHYSICS.eye, position.z]);
      movementTick(captureMovementInput(bedSleep.sleeping ? new Set() : keys)); // a sleeping player ignores the keys
      tickBed();
      populationBlocks?.touch(Math.floor(position.x),Math.floor(position.y-.01),Math.floor(position.z));
      scene.effectRenderer.tick(world);
      // The model stands at posY - yOffset, and posY is lowered by ySize (the sneak drop).
      const lowered = (p, drop) => ({ x: p.x, y: p.y - drop, z: p.z });
      playerBody.tick({ position: lowered(position, motion.ySize), previous: lowered(previous, motion.prevYSize), yaw, pitch, swinging: animation.swingTime < SWING_SECONDS, riding: !!rider.vehicle });
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
    pose.meta = pose.item === WOOL || pose.item === RED_FLOWER || pose.item === DYE || [2,6,56,58,4,5,7,48,70,71].includes(pose.item) ? survival.held?.damage || 0 : 0;
    const b = pose.bob;
    scene.camera.position.x += b.x * Math.cos(yaw);
    scene.camera.position.z -= b.x * Math.sin(yaw);
    scene.camera.position.y += b.y;
    // EntityRenderer.hurtCameraEffect with the frame's partial tick (damage-fx.js); the roll is a GL angle, which
    // the camera's z rotation shares, so `- hurt` below adds it.
    const hurt = -(hurtCameraRoll({ hurtTime: survival.hurtTime, health: survival.health }, Math.min(1, accumulator / PHYSICS.tick)) * Math.PI) / 180;
    scene.camera.rotation.set(pitch + b.rx, yaw, b.rz - hurt, "YXZ");
    if (bedSleep.sleeping) {
      // EntityRenderer.orientCamera while sleeping: the view lies on the mattress looking along the bed towards its foot (approximation of the native offsets).
      const [hx, hz] = BED_DIR[bedSleep.facing];
      scene.camera.position.set(bedSleep.pos.x, bedSleep.pos.y - 0.1, bedSleep.pos.z);
      scene.camera.rotation.set(0, Math.atan2(hx, hz), 0, "YXZ");
    }
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
    // EntityRenderer.getMouseOver: the nearest entity box (a cart grown by its 0.1 border) wins.
    aimedCart = pickMinecart(minecarts, aim, dir, survival.creative ? 5 : 3, target?.distance ?? 6, rider.vehicle);
    const aimedBoat = pickMinecart(boats, aim, dir, survival.creative ? 5 : 3, target?.distance ?? 6, rider.vehicle);
    if (aimedBoat && (!aimedCart || aimedBoat.distance < aimedCart.distance)) aimedCart = aimedBoat;
    if (aimedCart && aimedEntity && aimedEntity.distance <= aimedCart.distance) aimedCart = null;
    if (aimedCart) aimedEntity = null;
    // EntityRenderer.getMouseOver: a painting or frame (box grown by 0.1) nearer than the block and any mob/cart.
    aimedHanging = pickHanging(hanging, aim, dir, survival.creative ? 5 : 3, target?.distance ?? 6);
    if (aimedHanging && ((aimedEntity && aimedEntity.distance <= aimedHanging.distance) || (aimedCart && aimedCart.distance <= aimedHanging.distance))) aimedHanging = null;
    if (aimedHanging) { aimedEntity = null; aimedCart = null; }
    scene.outline.visible = !!target && !aimedEntity && !aimedCart && !aimedHanging;
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
        `BLOCKWORLD / Java 1.7.10 study\n${fps} FPS · ${(scene.worldTriangles || 0).toLocaleString()} triangles\nXYZ: ${position.x.toFixed(2)} / ${position.y.toFixed(2)} / ${position.z.toFixed(2)}\nSeed: ${active.seed}\n${survival.mode} · day ${Math.floor(survival.time / 24000) + 1} · ${survival.time % 24000} ticks\nHealth ${survival.health} · food ${survival.food} · saturation ${survival.saturation.toFixed(1)}\n${world.streaming ? world.chunks.size+" loaded chunks · " : ""}${world.edits.size} ${world.streaming ? "cached edited blocks" : "edited blocks"} · ${Object.keys(survival.chests).length + Object.keys(survival.furnaces).length} containers · ${items.items.length} items · ${mobs?.entities.length || 0} mobs\n${aimedEntity ? aimedEntity.entity.type + " · " + aimedEntity.entity.health + " health" : target ? (ITEMS[world.get(...target.block)]?.name ?? BLOCKS[world.get(...target.block)].name) : "Looking into the distance"}`;
    if (elapsed - lastSave > 5) save();
    scene.effects.crack(mining?.block, mining?.progress);
  } else if (screen === "dead") {
    // GuiGameOver does not pause the game. Here only EntityLivingBase.onDeathUpdate and the
    // particles keep ticking (the rest of the world waits on the death screen): at deathTime
    // 20 the client player, still 0.6 x 1.8 (onDeath's setSize runs on the server), goes up
    // in 20 "explode" from posY, which is its eye.
    accumulator += dt;
    while (accumulator >= PHYSICS.tick) {
      survival.hurtTime = Math.max(0, survival.hurtTime - 1);
      if (++deathTime === 20) burst(scene.fx, "explode", 20, { x: position.x, y: position.y + Math.fround(PHYSICS.eye), z: position.z, width: PHYSICS.width, height: PHYSICS.height }, playerRandom);
      scene.effectRenderer.tick(world);
      accumulator -= PHYSICS.tick;
    }
    // EntityRenderer.hurtCameraEffect: a dead view rolls 40 - 8000 / (deathTime + partial + 200)
    // degrees about the view axis (the same sign convention as the hurt tilt and view bob).
    const roll = (hurtCameraRoll({ hurtTime: survival.hurtTime, health: 0, deathTime }, Math.min(1, accumulator / PHYSICS.tick)) * Math.PI) / 180;
    scene.camera.rotation.z = roll;
  } else if (screen === "home") scene.preview(elapsed);
  const partial = Math.min(1, accumulator / PHYSICS.tick);
  // TileEntityMobSpawnerRenderer: the spinning display mob of each spawner within 64 blocks.
  const shown = spawners?.size && screen !== "home" ? spawners.values().filter((sp) => (sp.x + 0.5 - position.x) ** 2 + (sp.y + 0.5 - position.y) ** 2 + (sp.z + 0.5 - position.z) ** 2 < 4096).map((sp) => spawnerDisplayEntity(sp, partial)).filter(Boolean) : [];
  if (mobs) mobRenderer.update([...(world.streaming ? mobs.entities.filter(e=>world.isLoaded(e.x,e.z)) : mobs.entities), ...shown],dt,partial);
  minecartRenderer?.update(screen === "home" || !minecarts ? [] : minecarts.carts.filter(e=>!world.streaming||world.isLoaded(e.x,e.z)), partial, world);
  boatRenderer?.update(screen === "home" ? [] : boats.carts.filter(e=>!world.streaming||world.isLoaded(e.x,e.z)), partial, world);
  hangingRenderer?.update(screen === "home" ? [] : hanging.entities.filter(e => !world.streaming || world.isLoaded(e.x, e.z)));
  signRenderer?.update(screen === "home" ? [] : [...signs.tiles.values()], world, position);
  tntRenderer?.update(screen === "home" ? [] : primed, partial);
  redstoneRuntime?.frame(screen === "home" ? 1 : partial);
  recordHud.frame(partial);
  playerRenderer?.update(playerBody, partial, {
    visible: thirdPersonView > 0 && ["playing", "inventory", "paused"].includes(screen),
    swing: animate.pose ? (animate.pose.progress < 1 ? animate.pose.progress : 0) : 0,
    armor: survival?.inventory?.armor ?? [],
    held: heldId(),
    heldDamage: survival.held?.damage || 0,
    heldColor: survival.held?.color,
    heldGlint: stackHasEffect(survival.held, ITEMS[survival.held?.id]),
    hurt: survival.hurtTime > 0,
    sneak: motion.sneaking,
    riding: !!rider.vehicle,
    arrowCount: survival.arrowCount,
    arrowEntityId: playerBody.entityId,
    burning: survival.fire > 0,
    fireViewYaw: 180 - yaw * 180 / Math.PI,
    invisible: survival.effects.has(INVISIBILITY),
  });
  if (screen === "inventory") paperdollFrame();
  chestRenderer?.update(running() ? accumulator / PHYSICS.tick : 1);
  if(xpRenderer)xpRenderer.update(xpOrbs.orbs,partial);
  scene.dropPartial = partial;
  scene.particleView = { yaw, pitch, mirror: thirdPersonView === 2 };
  // EntityRenderer's potion terms (potion-fx.js): Night Vision / Blindness durations, the Nausea warp amount and the player's feet height.
  const potionEffects = screen === "home" ? null : survival?.effects;
  scene.potionView = potionEffects ? { nightVision: potionEffects.get(NIGHT_VISION)?.duration ?? 0, blindness: potionEffects.get(BLINDNESS)?.duration ?? 0, nausea: potionEffects.has(NAUSEA), warp: portalTimer.amount(partial), feetY: position.y } : null;
  scene.setShadows(screen === "home" ? [] : shadowCasters(scene.dropPartial), { x: position.x, y: position.y + PHYSICS.eye, z: position.z });
  // EntityRenderer.getFOVModifier multiplies the field of view by the eased modifier.
  const fov = options.fov * (bowFovState.prev + (bowFovState.cur - bowFovState.prev) * partial);
  if (Math.abs(scene.camera.fov - fov) > 1e-9) {
    scene.camera.fov = fov;
    scene.camera.updateProjectionMatrix();
  }
  // The title and world screens cover the view; a paused world still draws behind its menu.
  if (screen !== "home") scene.render(elapsed, dt);
  if (firstPerson && animate.pose)
    firstPerson.render(animate.pose, {
      // EntityRenderer.renderHand: first person only, and never while the player is sleeping.
      visible: thirdPersonView === 0 && !bedSleep.sleeping && ["playing", "inventory", "paused"].includes(screen),
      light: scene.brightness(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z),
      view: scene.camera,
      time: elapsed,
      eating: eating && !eating.bow ? Math.max(0,eating.ticks-accumulator/PHYSICS.tick) : null,
      // The bow's icon follows the whole ticks of draw; its pull uses the ticks - 1 + partial.
      bow: eating?.bow ? { stage: bowStage(eating.ticks), draw: eating.ticks - 1 + partial } : null,
      glint: stackHasEffect(survival.held, ITEMS[survival.held?.id]),
      color: survival.held?.color,
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
  if (thirdPersonView > 0 && !survival.effects.has(INVISIBILITY)) list.push(playerShadowCaster(position, previous, partial, SHADOWS.player, motion.prevYSize, motion.ySize));
  for (const e of mobs?.entities ?? []) {
    const child = e.growingAge < 0;
    // RendererLivingEntity passes Render.doRenderShadowAndFire no shadow for an invisible mob.
    if (SHADOWS[e.type] && !isInvisible(e)) list.push({ ...SHADOWS[e.type], x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z), pos: e, height: ENTITY_TYPES[e.type].height * (child ? 0.5 : 1), child });
  }
  return list;
}
async function boot(){try {
  await acquireWorldWriter();
  // Read the shelf under ownership: another tab may have finished a save while
  // this page was starting up, before the browser granted its lock.
  try {const shelf=JSON.parse(localStorage.getItem(storageKey)||'[]');worlds=Array.isArray(shelf)?shelf:[];}catch{worlds=[];}
  worlds = await readWorldShelf(worlds);
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
  minecartRenderer = new MinecartRenderer(scene.scene, scene, null);
  boatRenderer = new BoatRenderer(scene.scene, scene, boats);
  hangingRenderer = new HangingRenderer(scene.scene, scene);
  signRenderer = new SignRenderer(scene.scene, scene);
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
    window.__mc = { scene, get editActions() { return structuredClone(editActionLog); }, get survival() { return survival; }, get world() { return world; }, get streamStorage() { return streamStorage; }, get containerResidency() { return containerResidency; }, position, velocity, motion, get flying() { return flying; }, get grounded() { return grounded; }, look(p, y) { pitch = p; yaw = y; }, view(n) { thirdPersonView = n; }, playerBody, teleport(x, y, z) { position.set(x, y, z); }, items, projectiles, arrows, get mobs() { return mobs; }, get rider() { return rider; }, get minecarts() { return minecarts; }, get boats() { return boats; }, get hanging() { return hanging; }, get aimedHanging() { return aimedHanging; }, fishing, get target() { return target; }, get redstone() { return redstoneRuntime; }, get spawners() { return spawners; }, get aimedCart() { return aimedCart; }, save, breakBlock, get weather() { return weather; }, commands, chatUi, get chatOpen() { return chatOpen; }, get commandHost() { return commandHost; }, openChat, closeChat, get fire() { return fire; }, get trees() { return trees; }, get plants() { return plants; }, get falling() { return falling; }, get primed() { return primed; }, get xpOrbs() { return xpOrbs; }, get experience() { return experience; }, get sounds() { return sounds; }, explodeAt, lightTnt };
  scene.preview(0);
  // The title screen's splash texts (assets/minecraft/texts/splashes.txt).
  menuContext.splashes = await fetch("/media/1.7.10/texts/splashes.txt").then((r) => (r.ok ? r.text() : "")).catch(() => "");
  gui.show(menus.mainMenu());
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
