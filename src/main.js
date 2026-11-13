import { refreshResources, onResourcesRefreshed } from "./resource-refresh.js"; // first: registers every pack-dependent texture as it loads
import { isStemCake, popDrops } from './stems-cake.js';
import { maxHealthOf } from "./mob-riding.js";
import { hasVoidParticles } from "./void-fog.js";
import { StreamStorage } from './streaming-storage.js';
import { isColoredBlock, carpetNeighbourChange, coloredPickDamage, COLORED_ITEM_OFFSET, CARPET } from './colored-blocks.js';
import { ContainerResidency } from './container-residency.js';
import { acquireWorldWriter } from './world-lock.js';
import { readWorldShelf, writeWorldShelf, deleteStoredWorld, readChunkEdits, readRuntimeState, chunkRecords, writeBaseColumns, readBaseColumns, listBaseColumns } from './world-storage.js';
import {PopulationBlocks} from './population-blocks.js';
import {hasSavedStructures as hasSavedPopulation} from './structure-simulation.js';
import {restorePopulation,restorePopulationColumns} from './population-runtime.js';
import {setPopulationBlockMapper} from './population-world.js';
import {isJavaLandscape, streamedWorldType, javaSeed} from "./java-world.js";
import { particleSetting } from "./particle-settings.js";
import "./style.css";
import "./minecraft-ui.css";
import "./container-ui.css";
import "./menu-screens.css";
import { Gui, textHtml } from "./menu-ui.js";
import { createMenus } from "./menus.js";
import { commandBlockScreen } from "./command-block-screen.js";
import { folderName, LANG, t as langT } from "./menu-screens.js";
import { initResourcePacks } from "./resource-packs.js";
import { worldDifficulty, deleteWorldStorage, HARDCORE_KICK } from "./hardcore.js";
import { importSaveFolder, entriesFromFileList, entriesFromDirectoryHandle, indexSave } from "./save-folder-import.js";
import { importWholeSave, regionFiles } from "./whole-save-import.js";
import { canGoEndless, endlessCopy } from "./endless-world.js";
import {guiScale,durabilityBar,tooltipLines,anvilName,anvilCost,pendingContainerStacks,withGlint,itemTint} from "./gui.js";
import { stackHasEffect } from "./armor-enchantments.js";
import { ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, spawnEggIconHtml } from "./spawn-eggs.js";
import { spawnEggMob } from "./spawn-egg-use.js";
import { isThrowable } from "./player-throw-simulation.js";
import { ITEM_POTION } from "./item-passes.js";
import {AnvilContainer,nativeStackToLive} from './anvil-container.js';
import {EnchantingContainer} from './enchanting-container.js';
import {MerchantContainer,merchantDecorationsHtml,offerItemAt} from './merchant-ui.js';
import {villagerInteract,villagerClearCustomer,villagerOffers,villagerUseRecipe,villagerHover} from './villager.js';
import {withinEnchantReach} from './enchanting-table.js';
import {damagedAnvilMetadata,ANVIL_DAMAGE_CHANCE} from './anvil.js';
import {treePickDamage} from './wood-types.js';
import { migrateSettings, renderDistanceBlocks, SOUND_CATEGORIES, soundLevel, CHAT_SETTING_DEFAULTS } from "./settings.js";
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
  JACK_O_LANTERN,
  normalCube as isNormalCube,
  selectionBounds,
} from "./world.js";
import { Plants, REEDS_ITEM, REED_BOUNDS, CACTUS_SELECTION } from "./plants.js";
import { FallingBlocks } from "./falling.js";
import { ForeignTicks, attachTickTree } from "./tile-ticks.js";
import { ladderBounds, ladderSupported, countsVertical } from "./ladders.js";
import { snowFalls } from "./snow.js";
import { flowerCanStay, JRandom } from "./flowers.js";
import { Trees } from "./trees.js";
import { VoxelScene } from "./scene.js";
import { SoundBank } from "./audio.js";
import { randomSuperSecretEvent, SUPER_SECRET_SOUND } from "./post-shaders.js";
import { breakSound, placeSound, hitSound, footstepSound, placesSilently } from "./block-sounds.js";
import { Weather, isWet, canLightningStrikeAt, simulationKey } from "./weather.js";
import { tickWeatherSimulation } from "./weather-simulation.js";
import { PlayerAnimation, SWING_SECONDS } from "./animation.js";
import { showsPumpkinBlur } from "./wearable-heads.js";
import { PlayerBody, PlayerRenderer, STEVE_URL, nextView, thirdPersonCamera, playerShadowCaster, sleeperShadowCaster } from "./player-renderer.js";
import { FirstPerson, itemTexture, setCompassTextureFrame } from "./first-person.js";
import { ITEM_COMPASS, COMPASS_FRAMES, COMPASS_STRIP, compassAngle, createCompass, tickCompass, setCompassWorld } from "./compass.js";
import { compassFrameCount, spriteEpoch } from "./sprite-frames.js";
import { InventoryPlayerView, PAPERDOLL_LAYOUTS } from "./inventory-player.js";
import { HorsePreviewView, HORSE_PREVIEW_LAYOUT } from "./horse-preview.js";
import {Experience,ExperienceOrbs,smeltExperience} from "./experience.js";
import {ExperienceRenderer} from "./experience-renderer.js";
import {plantedBlock,cropItem} from './crops.js';
import { NetherLive } from './nether-portal-live.js'; // nether portal lighting/removal and nether wart
import {Farming,cropDrops,farmNeighbourChange} from "./farming.js";
import { EntityWorld, ENTITY_TYPES, HOSTILE, heldAttackDamage, pushBox, setEntityBoxes } from "./entities.js";
import { wakeSavedSleeper, BedSleep, BED_DIR, BED_TEXT, Beds, activateBed, bedRespawnPosition, nextMorning, verifyRespawn } from "./bed.js";
import { showChatLine, PLAYER_NAME } from "./death-messages.js";
import { deathComponent, chatTextComponent, senderComponent } from "./team-names.js";
import { ChatUi, printChat, chat } from "./chat-ui.js";
import { translation, fontWidth } from "./chat-component.js";
import { lookupStat, statComponent, statHover, profilerTick } from "./commands-extra.js";
import { Profiler } from "./profiler.js";
import { HitboxRenderer, collectHitboxes, crashStep, crashReport, showCrashReport, KEY_C, KEY_F3, KEY_B, KEY_S, KEY_T } from "./debug-keys.js";
import { DebugOverlay, selectSection, nativeYaw, readMemory, rendererStats, entityStats, columnStats, heightValue, floorD, WALK_SPEED, FLY_SPEED } from "./debug-overlay.js";
import { parseJsonNbt } from "./json-nbt.js";
import { itemStackFromNbt } from "./region-import.js";
import { breakSoundPitch } from "./mob-equipment.js";
import { NBT } from "./nbt.js";
import { chatCanOpen } from "./chat.js";
import { PlayerListUi, playerListVisible } from "./player-list.js";
import { takeScreenshot, downloadBlob } from "./screenshot.js";
import { composeWithDom } from "./screenshot-compose.js";
import { Achievements, BY_ID as BY_ACHIEVEMENT } from "./achievements.js";
import { AchievementToast } from "./achievements-ui.js";
import { Stats } from "./stats.js";
import { Scoreboard, scoreboardToJSON, scoreboardFromJSON } from "./scoreboard.js";
import { ScoreboardLive, SidebarUi } from "./scoreboard-live.js";
import { StatsLive, watchMobStats, watchDrops, addFallStat } from "./stats-live.js";
import { watchMobs, craftedAchievement, smeltedAchievement, pickedAchievement, pigFall } from "./achievements-live.js";
import { keyName as inventoryKeyName } from "./menu-screens.js";
import { BINDINGS, KeyBindings, HeldKeys, HOTBAR, lwjglCode, mouseCode, storedKeyCodes, keyDisplayString } from "./keybindings.js";
import { writeOptionsTxt, applyOptionsTxt } from "./options-txt.js";
import { FrameLimiter, limitFramerate } from "./frame-limit.js";
import { createCommandRunner, tr } from "./commands.js";
import { runCommandCart } from "./command-cart.js";
import { LanSession, LAN_NOTICE } from "./lan.js";
import { DedicatedClient, restoreReplica } from "./multiplayer/client.js";
import { RemotePlayers } from "./multiplayer/presence.js";
import { multiplayerScreen, profileScreen } from "./multiplayer/screen.js";
import { skinCanvas } from "./skin.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { createCommandHost, ruleOn } from "./command-host.js";
import { replayPlayerCommands } from "./away-commands.js";
import { gameRule, setGameRuleSource } from "./game-rules.js";
import { mayHitBlock } from "./adventure.js";
import { SHADOWS } from "./shadows.js";
import { MobRenderer } from "./mob-renderer.js";
import { ChestRenderer } from "./chest-renderer.js";
import { CHEST, settleFacing, chestPair, tickLid } from "./chest.js";
import { isChestBlock, ENDER_CHEST, newEnderTile, enderDisplayParticles } from "./chest-blocks.js";
import { DISPENSER, DROPPER, PISTON_HEAD, isDispenserPiston, itemForBlock, headBaseId } from "./dispenser-piston.js";
import { DispenserContainer, DISPENSER_TITLE } from "./dispenser-container.js";
import { HopperContainer, Hoppers, HOPPER, hopperActive } from "./hopper.js";
import { Survival, ITEMS, burnTime, gameModeOf } from "./survival.js";
import { stackName } from "./item-names.js";
import { containerTitle } from "./container-names.js";
import { ContainerScreen, makeStack, copyStack } from "./inventory.js";
import { CreativeScreen, CREATIVE_TABS, SEARCH, SURVIVAL_TAB, tabArea, itemTab, GUI_WIDTH } from "./creative.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { EyesOfEnder } from "./eye-of-ender-live.js";
import { MapsClock } from "./maps-clock-live.js";
import { ITEM_FILLED_MAP, mapStore } from "./maps.js";
import { FireworkRockets, dispenseFirework } from "./fireworks-live.js";
import { FireworkParticles } from "./firework-particles.js";
import { EndPortalRenderer } from "./end-portal-renderer.js";
import { BEACON, Beacons, validPrimary, validSecondary } from "./pyramid.js";
import { tickBeacons } from "./pyramid-live.js";
import { BeaconRenderer } from "./pyramid-renderer.js";
import { BeaconContainer } from "./pyramid-container.js";
import { beaconDecorationsHtml, beaconUiHtml, beaconTooltip } from "./pyramid-gui.js";
import { slotAt, slotDrawOps, slotDrawHtml, merchantArrowDraw, anvilDecorationsHtml, refreshAnvil, enchantDecorationsHtml, refreshEnchantOptions } from "./container-widgets.js";
import { Fishing } from "./fishing-simulation.js";
import { FISHING_ROD } from "./fishing-content.js";
import { WitchPotions } from "./witch-potions.js";
import {impactPlayerPearl} from './pearl-player.js';
import { Arrows, arrowTargets, bowStage, bowFov, easeFov, ARROW } from "./bow.js";
import { canSeeSky } from "./weather.js";
import { Fluids, eyeInWater, viewpointBlock } from "./fluids.js";
import { ScreenOverlays } from "./screen-overlays.js";
import { clientInsideOpaque, insideOverlayBlock, playerBrightness, worldFov, entityFizz } from "./fire-fx.js";
import { insideOpaqueBlock } from "./suffocation.js";
import { BRIGHTNESS } from "./lighting.js";
import { getRespiration } from "./enchantments.js";
import { Fire } from "./fire.js";
import { difficultySetting, localDifficulty, InhabitedTime } from "./difficulty.js";
import { isInvisible } from "./mob-effects.js";
import { DimensionWorld } from './dimension-world.js';
import { showEndCredits } from './end-credits.js';
import { DimensionLive, TILE_KEYS, storedRecord, dimensionOf, rootIdOf, viewId, bedExplosion, mcYaw, advanceWorldClock } from './dimension-live.js'; // Nether/End travel (dimensions track)
import { PortalTimer, splashBreak, NIGHT_VISION, BLINDNESS, NAUSEA, INVISIBILITY } from "./potion-fx.js";
import { primeTnt, TNT_SIZE, TNT_Y_OFFSET } from "./explosion.js";
import { TntRenderer } from "./tnt-renderer.js";
import { finishDrinking as finishBucketDrinking, rayTraceBlocks } from "./buckets.js";
import { finishDrinkingItem } from "./potion-use.js";
import { potionColor as damageColor, POTION_TYPES, durationString } from "./potions.js";
import { BREWING_STAND, brewingView, bubbleHeight } from "./brewing.js";
import { BrewingContainer } from "./brewing-container.js";
const finishDrinking = (player) => finishDrinkingItem(player, finishBucketDrinking);
import { captureBucketTarget } from "./buckets-simulation.js";
import { HUNGER, POISON } from "./status-effects.js";
import { PlayerMotion, fovMultiplier } from "./player-movement.js";
import { drainKnockback } from "./player-knockback.js";
import { spawnRunningParticles, freshRandom } from "./particles.js";
import { enterWater, drownBubbles, burst, potionColor, potionParticles, itemCrumbs, boneMealSparkles } from "./fx.js";
import { JavaRandom } from "./lighting.js";
import { useDragonEgg } from "./dragon-egg-live.js";
import { spawnDragonIfAbsent } from "./dragon-mobs.js";
import { vitalsLayout, heartsHtml, foodHtml, mountHeartLayout, mountHeartsHtml, REGENERATION, WITHER_EFFECT } from "./damage-hud.js";
import { hurtCameraRoll } from "./damage-fx.js";
import { displayTicks } from "./display-ticks.js";
import { importedRuntime, importedDimensionState } from "./world-import.js";
import { collectBases, basesFromJson } from "./whole-save-json.js";
import { tickWorldSystems } from "./world-tick.js";
import { captureMovementInput } from "./player-input.js";
import { movePlayer } from "./player-physics.js";
import { UseHold } from "./use-hold.js";
import { tickPlayerEnvironment, finishPlayerMovement, landPlayer, playerMoveTail } from "./player-environment.js";
import { tickEntitySimulation, finishEntitySimulation, entityWalkers, watchJoin, isWalked, vehicleTargets, thrownAtVehicleOrHanging } from "./entity-simulation.js";
import { ObjectTracker, objectViews, vehicleViews, hangingViews, knotViews, aimBox, aimKnotBox, rideCopy, boatSeat } from "./object-tracker.js";
import { pushClientPlayer } from "./client-push.js";
import { tickPlayerItemUse } from "./player-item-use.js";
import { tickLivingSimulation, drainMobEvents, explodeEvent, spawnLoot } from "./living-simulation.js";
import { tickPlayerMining } from "./player-mining.js";
import { createServerDig } from "./server-dig.js";
import { playerMiningState } from "./enchantment-effects.js";
import { applyExplosion } from "./explosion-simulation.js";
import { breakPlayerBlock } from "./block-break-simulation.js";
import { createPrediction, dryPlace, predictsPlacement } from "./client-prediction.js";
import { shapedPick } from "./shaped-blocks.js";
import { stoneUtilityPick, serializePots, restorePots } from "./stone-utility.js";
import { horseSeatsFor as seatsFor } from "./horse-live.js";
import { copySeat } from "./horse-copy.js";
import { HorseContainer, canInteract as horseReach, canWearArmor as horseWearsArmor } from "./horse-gear.js";
import { riddenHorse, jumpBar } from "./horse-gear-live.js";
import { HorseGearRenderer } from "./horse-gear-renderer.js";
import { SpamCounter, chatPacket, serverClick } from "./server-handlers.js";
import { capturePlayerAction, dispatchPlayerAction as dispatchPlayerActionRaw, captureReleaseAction, dispatchReleaseAction } from "./player-actions.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { normalizeFlatOptions } from "./flat-world.js";
import { bonusChestDue, placeBonusChest } from "./bonus-world.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { setOriginalBlockMapper } from "./mineshaft-world.js";
import { spawnerDisplayEntity } from "./mob-spawner.js";
import { cartSpawnerDisplayEntity } from "./cart-spawner-display.js";
import { watchSpawnerBlocks } from "./spawner-block.js";
import { Rails } from "./rails.js";
import { Torches } from "./torches.js";
import { RedstoneBlocks, isRedstoneBlock, itemOfBlock as redstoneItemOf } from "./redstone-blocks.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { createRecordHud } from "./jukebox.js";
import { discName } from "./note-jukebox-content.js";
import { MusicTicker, ambientMusicType, recordSound } from "./music.js";
import { MoodSound, moodLight } from "./cave-ambience.js";
import { status as bossStatus } from "./boss-bar.js";
import { countHtml, zeroCountHtml, tooltipHtml, drawLabels, drawLabel, xpLevelHtml, bitmapHtml } from "./bitmap-text.js";
import { labelsHtml, shellHtml, placeShell, drawBeaconLabels } from "./container-screens.js";
import { entityDisplayName } from "./entity-names.js";
import { Doors, WOODEN_DOOR_ITEM, IRON_DOOR_ITEM, blockItemId, solidTopSurface } from "./doors-panes.js";
import { spawnPointOf } from "./dimension-spawning.js"; // SpawnerAnimals' spawn point: the Overworld's in every dimension
import { MinecartRenderer } from "./minecart-renderer.js";
import { CartSounds } from "./cart-sounds.js";
import { BoatRenderer } from "./boat-renderer.js";
import { Boats, BOAT_ITEM } from "./boats.js";
import { boatBoxProvider } from "./entity-collision.js";
import { linkVehicleRiders } from "./vehicle-riders.js";
import { Hanging, pickHanging, hangingArrowTargets } from "./hanging.js";
import { orderGroups, stampSavedOrder, restoreSavedOrder } from "./saved-order.js";
import { reachesDragon } from "./dragon-parts.js";
import { HangingRenderer } from "./hanging-renderer.js";
import { SKULL, SKULLS, Skulls } from "./skull.js";
import { SkullRenderer } from "./skull-renderer.js";
import { EnchantingBooks, EnchantingScreenExtras } from "./enchanting-book-live.js";
import { EnchantingBookRenderer, EnchantingGuiBookView } from "./enchanting-book-renderer.js";
import { Signs, isSign, signShouldPop, signDrops } from "./signs.js";
import { SignRenderer } from "./sign-renderer.js";
import { openSignEditor } from "./sign-editor.js";
import { openBookUi } from "./book-ui.js";
import { ITEM_WRITABLE_BOOK, applyBookEdit, applyBookSign } from "./books.js";
import { applyHangingEdit } from "./hanging-interaction.js";
import { createPlayerRider, captureVehicleAction, dispatchVehicleAction, moveRidingPlayer, finishVehicleTick, restorePlayerVehicle, detachPlayerVehicle } from "./vehicle-simulation.js";
import { StreamPrefetch } from "./streaming-generator.js";
import { createRing, attachRing, fullColumn } from "./headless-columns.js";
import { seedRingChest } from "./ring-chests.js";
import { applyTiles } from "./tile-sync.js";
import { wrapMobHooks, wrapRandomTickLight, residentOnly } from "./headless-env.js";
import { startLoading, setStage, STAGES, loadingScreen, downloadTerrainScreen, errorScreen, nextPaint, nextFrame, SpawnAreaLog } from "./loading-screen.js";
import { gameOverScreen, exportScreen, notesScreen, signEditHost } from "./modal-dialogs.js";
import { NOTES } from "./notes-content.js";
import { runSteps, taskPause } from "./steps.js";
import { MeshPool, meshWorkersEnabled } from "./mesh-pool.js";
import { presolveWorld } from "./spawn-presolve.js";
import { blankLoading, arrivalWarmer } from "./travel-loading.js";
import "./lang-hooks.js";
import { loadLanguageManifest, selectLanguage, setForceUnicodeFont, translate } from "./lang.js";
import { loadFontResources, onFontChange, font, setFontAnaglyph } from "./font-renderer.js";
import { EntityIds } from "./entity-ids.js";
import { restoreStructureEntities, saveStructureEntities, tickMinecartSimulation, tickBoatSimulation, tickSpawnerSimulation, tickSpawnersClient, spawnerBurst, pickMinecart } from "./structure-simulation.js";
import { ringEntityActive } from "./streaming-ticks.js";
import { trackedWithin, ROCKET_TRACKING } from "./ring-events.js";
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
let worlds = [], worldsError = null;
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
  // Video settings (render-settings.js): Fancy graphics, Smooth Lighting Maximum, Clouds on, Mipmap Levels 4, Anisotropic Off.
  graphics: true,
  ao: 2,
  clouds: true,
  mipmapLevels: 4,
  anisotropic: 1,
  // Max Framerate 120 and Use VSync on (frame-limit.js); pauseOnLostFocus (F3+P) and advancedItemTooltips (F3+H).
  maxFps: 120,
  vsync: true,
  pauseOnLostFocus: true,
  advancedTooltips: false,
  // Chat Settings (ScreenChatOptions): visibility, colours, links, opacity, scale, width and heights at the GameSettings defaults.
  ...CHAT_SETTING_DEFAULTS,
};
try {
  // options.txt (options-txt.js) is mirrored on the device; it is read when no browser save exists.
  const json = localStorage.getItem("blockworld.settings"), txt = localStorage.getItem("blockworld.options.txt");
  const saved = json ? JSON.parse(json) : txt ? applyOptionsTxt({ settingsVersion: 3 }, txt).options : {};
  options = { ...options, ...migrateSettings(saved) };
} catch {}
// GameSettings.keyBindings (keybindings.js): LWJGL codes, mouse buttons as -100 + button.
const binds = new KeyBindings(storedKeyCodes(options));
options.keyBindings = binds.saved();
delete options.keys;
// Minecraft.runGameLoop's Display.sync (frame-limit.js) and GameSettings.hideGUI (F1, not saved).
const frameLimiter = new FrameLimiter();
let hideGUI = false;
chat.applySettings(options);
options.particles = particleSetting(options.particles);
// GuiScreenOptionsSounds has no mute switch: Master Volume is the only off control.
options.sound = true;
options.difficulty = difficultySetting(options.difficulty);
// The difficulty in every system that reads World.difficultySetting.
function updateDifficulty() {
  // MinecraftServer.func_147139_a: a hardcore world runs on Hard whatever GameSettings.difficulty says (hardcore.js).
  const d = worldDifficulty(active, options.difficulty);
  if (survival) survival.difficulty = d;
  if (mobs) mobs.difficulty = d;
  if (fire) fire.L.difficulty = d;
}
// Apply the saved client preference to current runtimes (weather is replaced on load).
function updateParticleOptions() {
  const setting = particleSetting(options.particles);
  scene.particles.setting = scene.explosionParticles.setting = scene.fx.setting = setting;
  projectiles.particleSetting = weather.particleSetting = setting;
  objectTracker.sims.balls.particleSetting = setting;
  // RenderGlobal uses one client World.rand; keep it separate from server simulation.
  scene.particles.worldRandom = projectiles.particleRandom = scene.fx.worldRandom = scene.explosionParticles.worldRandom;
  objectTracker.sims.balls.particleRandom = scene.explosionParticles.worldRandom;
  const viewer = [position.x, position.y + PHYSICS.eye, position.z];
  scene.explosionParticles.viewer = projectiles.particleViewer = scene.fx.viewer = viewer;
  objectTracker.sims.balls.particleViewer = viewer;
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
  keys = new HeldKeys(binds), // KeyboardEvent codes held; clear() is KeyBinding.unPressAllKeys
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
const useHold = new UseHold(); // Minecraft.rightClickDelayTimer: a held use button repeats eating every 4 ticks
let eyeRay = null; // the view ray of the last frame, for the bucket's liquid trace
const entityIds = new EntityIds(); // Entity.nextEntityID: one counter for every world and entity list (entity-ids.js)
let fire,fluids,farming,experience=new Experience(),xpOrbs=new ExperienceOrbs(undefined,undefined,entityIds),xpRenderer,playerTicks=0;
let weather = new Weather(), trees, plants, falling, foreignTicks;
const bedSleep = new BedSleep(); // EntityPlayer's sleeping state and bed spawn point (bed.js)
// EntityTNTPrimed entities (explosion.js primeTnt). Explosions draw ray lengths,
// drops, chained fuses and sound pitch from the saved weather.random World.rand.
let primed = [], genPrimed = null;
const joinedAs = (kind) => (e) => mobs?.joined(e, kind); // World.spawnEntityInWorld: a new entity's place in the loaded-entity list (entity-simulation.js entityWalkers)
watchJoin(primed, joinedAs("tnt"));
let entityTick = null; // this tick's { state, hooks } for tickEntitySimulation, which the walk in EntityWorld.tickMobs reads
let objectTracker = new ObjectTracker(10, Math.random, entityIds); // Batch 42: the client view of items, orbs, arrows, thrown entities, falling blocks and TNT
// Batch 44: the client copies spawn their own impact, trail, splash and rocket particles (object-tracker.js `hooks.particle`, `drainEvents`)
function bindObjectTracker() {
  objectTracker.hooks.rides = (live) => rider.vehicle === live; // Batch 51: the ridden boat's copy takes the live boat's state (batch 56: it runs its own physics, object-tracker.js rideBoat)
  objectTracker.hooks.particle = (name, x, y, z, vx, vy, vz) => name === "fireworksSpark" ? fireworkFx.spawnSpark(x, y, z, vx, vy, vz) : scene?.fx.spawn(name, x, y, z, vx, vy, vz);
  // Batch 45: the client copies' own sounds (impact, splash, step, rocket launch) and the entities their arrows and hooks search (the client mob copies and the player)
  // Their sounds are logged (object-tracker.js `sound`) but not played: the client world's playSoundAtEntity reaches only RenderGlobal.playSound
  // (bma.a(String,DDDFF)), whose body is a bare return in 1.7.10 (lead, javap), so the client copies are silent and only the server's sound packet is heard.
  objectTracker.hooks.clientTargets = () => {
    const out = [];
    // (batch 50: a removed mob's copy stays until its S13 is flushed, one tick later, so it is still a target for that tick: `dying`)
    for (const [live, en] of [...(mobs?.tracker?.entries ?? []), ...(mobs?.tracker?.dying ?? []).map((d) => [d.live, d])]) {
      const c = en.client;
      if (!c.present || !(live.health > 0)) continue;
      // The ender dragon is not collidable (EntityDragon.canBeCollidedWith is false): its seven client parts are, while the world lists them (reachesDragon)
      if (c.dragon?.parts) { for (const p of c.dragon.parts) out.push({ ref: c, kind: "dragonPart", box: p.box, answers: true, reach: (area) => reachesDragon(c, area) }); continue; }
      const [w, h] = mobs.size(live);
      out.push({ ref: c, box: [c.x - w / 2, c.y, c.z - w / 2, c.x + w / 2, c.y + h, c.z + w / 2] });
    }
    // Batch 47: the other collidables of the client world are the client copies of the boats, minecarts, paintings, item frames and leash knots the tracker spawned (object-tracker.js
    // vehicleTargets: their own boxes; the live boat or cart only while the client player rides it). EntityBoat, EntityMinecart, EntityHanging answer attackEntityFrom with true on a
    // client world (executed, tracker-hits-reference.json). The renderers still draw the live entities.
    out.push(...objectTracker.vehicleTargets((live) => rider.vehicle === live));
    out.push({ ref: "player", box: [position.x - PHYSICS.width / 2, position.y, position.z - PHYSICS.width / 2, position.x + PHYSICS.width / 2, position.y + PHYSICS.height, position.z + PHYSICS.width / 2], immune: survival.creative });
    return out;
  };
  // Batch 47: what the tracker follows besides the lists trackObjects passes: the live boats and carts, paintings and item frames, and the leash knots (a summoned knot stands on its floored tile)
  objectTracker.hooks.extraLists = () => ({ boat: (boats?.carts ?? []).filter((b) => !b.dead), minecart: (minecarts?.carts ?? []).filter((m) => !m.dead), painting: (hanging?.pickable() ?? []).filter((e) => e.kind === "painting"), itemFrame: (hanging?.pickable() ?? []).filter((e) => e.kind !== "painting"), leashKnot: (mobs?.knotList ?? []).filter((k) => !k.dead) });
  objectTracker.hooks.ignite = (ref, fire) => { if (ref?.present !== undefined && ref.type) ref.fire = fire; }; // a client mob copy's Entity.fire (zeroed at its next update, entity-tracker.js)
  objectTracker.hooks.clientOf = (live) => live === "player" ? "player" : live && typeof live === "object" ? mobs?.tracker?.clientIfTracked(live) ?? null : null;
  const balls = objectTracker.sims.balls;
  if (scene) { balls.useEffects(scene.effectRenderer); balls.particleSetting = projectiles.particleSetting; balls.particleRandom = projectiles.particleRandom; balls.particleViewer = projectiles.particleViewer; }
}
const THROWN_KINDS = ["snowball", "egg", "enderPearl", "potion", "expBottle"];
const thrownOf = (kind) => [...projectiles.balls, ...(mobs?.potions?.balls ?? [])].filter((b) => b.kind === kind); // the witch's potions are tracked like the player's
const viewBalls = (balls) => balls.map((b) => THROWN_KINDS.includes(b.kind) ? objectViews(objectTracker, [b], b.kind)[0] : b);
let populationBlocks, netherLive;
let sounds,
  firstPerson,
  screenOverlays,
  mobs,
  mobRenderer,
  chestRenderer,
  endPortalRenderer,
  tntRenderer,
  aimedEntity = null,
  horseGearRenderer = null,
  eating = null;
// Generated-structure entities (structure-simulation.js): mineshaft spawners and chest minecarts.
let cartSounds = null, spawners = null, minecarts = null, minecartRenderer = null, aimedCart = null;
// Boats (boats.js): their own system and renderer next to the minecarts.
let boats = new Boats({ ids: entityIds }), boatRenderer = null;
// World.getCollidingBoundingBoxes adds EntityBoat's box: the player and mobs stand on and bump into boats (entity-collision.js).
setEntityBoxes(boatBoxProvider({ get carts() { return boats?.carts; } }));
// Paintings and item frames (hanging.js): live entities, their renderer and the one under the crosshair.
let hanging = new Hanging({ ids: entityIds }), hangingRenderer = null, aimedHanging = null;
// Signs (signs.js): the tile entities (text) of every sign block, drawn by sign-renderer.js.
let signs = new Signs(), signRenderer = null, skullRenderer = null;
// TileEntityEnchantmentTable books (enchanting-book-live.js), their renderer, and the open screen's book and galactic names.
const enchantBooks = new EnchantingBooks(ENCHANTING_TABLE);
let enchantBookRenderer = null, enchantExtras = null;
// Beacons (pyramid.js): the tile entities (levels, powers) of every beacon block, drawn by pyramid-renderer.js.
let beacons = new Beacons(), beaconRenderer = null;
// Live redstone and pistons (redstone-runtime.js), rebuilt for each world that loads.
let redstoneRuntime = null, tickTree = null;
// Hopper tick host: the shared inventory-transfer.js stores, EntityItem pickup and live comparator notifications.
const hopperTiles = new Hoppers({
  get world() { return world; },
  chests: () => survival.chests,
  seedChest: (x, y, z) => seedRingChest(world, survival.chests, x, y, z, containerResidency),
  containerReady: (x, z) => containerResidency?.reach(x, z) ?? true,
  furnaces: () => survival.furnaces,
  dispensers: () => (survival.dispensers ??= {}),
  hoppers: () => (survival.hoppers ??= {}),
  brewing: () => (survival.brewing ??= {}),
  maxStack: (s) => survival.inventory.maxStack(s),
  burnTime,
  items: () => items.items,
  active: (x, z) => hopperActive(world, x, z), // the window, and ring columns that take writes (hopper.js)
  changed: (keys) => { saved = false; redstoneRuntime?.containerClosed(keys); },
});
let rider = createPlayerRider();
let onboardVehicle = null; // the vehicle the mount.onboard line was last shown for
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
  containerView = null;
// Dropped items as EntityItem physics objects (see item-entities.js).
const items = new ItemEntities();
items.joined = (e) => mobs?.joined(e, "item");
// Every system reads the game rules of the world being played (game-rules.js); a /gamerule edit applies on the next read.
setGameRuleSource((name) => ruleOn(active, name));
// gamerule doTileDrops: block drops are skipped while it is false (commands.js / command-host.js).
{ const dropBlock = items.dropBlock; items.dropBlock = function (...a) { return active && !ruleOn(active, "doTileDrops") ? undefined : dropBlock.apply(this, a); }; }
// Thrown snowballs and their particles (see projectiles.js).
const projectiles = new Projectiles();
projectiles.joined = (e) => mobs?.joined(e, "thrown");
const maps = new MapsClock(); // maps-clock-live.js: filled maps and the clock icon
const compass = createCompass();
let compassEpoch = 0, compassShownFrames = COMPASS_FRAMES;
const eyes = Object.assign(new EyesOfEnder(), { ids: entityIds }); // eye-of-ender-live.js: flying eyes of ender
const rockets = new FireworkRockets(); // fireworks-live.js: firework rockets in flight
rockets.joined = (e) => mobs?.joined(e, "rocket"); // the rocket's place in the loaded-entity list (entity-simulation.js entityWalkers)
// The scene is created in start(), so particles look up its effect renderer when they spawn.
const fireworkFx = new FireworkParticles({ effects: { add: (p) => scene.effectRenderer.add(p) }, playSound: (name, x, y, z, volume, pitch, distanceDelay) => sounds.play(name, { volume, pitch, position: { x, y, z }, distanceDelay: !!distanceDelay }) });
// The fishing rod's bobber (fishing-simulation.js).
const fishing = Object.assign(new Fishing(), { ids: entityIds });
// Arrows in flight or stuck in blocks (bow.js) and the eased field-of-view modifier the
// bow draw drives (EntityRenderer.fovModifierHand and its previous value).
const arrows = new Arrows();
arrows.joined = (e) => mobs?.joined(e, "arrow");
const bowFovState = { prev: 1, cur: 1 };
$("#app").innerHTML = `
 <div id="viewport" aria-label="Interactive voxel world"></div><div id="vignette"></div><div id="pumpkin-blur" hidden></div>
 <div id="gui" class="hidden"></div>
 <section id="hud" class="hidden" aria-label="Game heads-up display"><div class="game-top"><button class="game-brand" id="pause-button">${cube}<span>BLOCKWORLD<small id="world-label"></small></span><span class="pause-symbol">Ⅱ</span></button><div class="game-status"><span class="status-dot"></span><span id="save-label">Saved on this device</span><button id="fullscreen" aria-label="Toggle fullscreen">⛶</button></div></div><div id="crosshair">＋</div><pre id="debug" class="hidden"></pre><div id="block-label"></div><div id="jump-hud" class="hidden"><div class="experience-track"><div id="jump-fill"></div></div></div><div id="experience-hud" class="hidden"><div id="experience-level"></div><div class="experience-track"><div id="experience-fill"></div></div></div><div id="survival-hud" class="survival-hud hidden"></div><div id="mining-meter" class="mining-meter hidden" role="progressbar" aria-label="Mining progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><div id="flight-label" class="flight-label"><span id="mode-label">CREATIVE</span> <span>·</span> <b id="movement-label">WALKING</b></div><div class="hotbar" id="hotbar"></div><div class="game-help">W A S D <span>move</span> <i>·</i> SPACE <span>jump</span> <i>·</i> LMB <span>break</span> <i>·</i> RMB <span>use / place</span> <i>·</i> E <span>inventory</span> <i>·</i> ESC <span>pause</span></div><div id="mobile-controls"><div class="dpad"><button data-key="KeyW">↑</button><button data-key="KeyA">←</button><button data-key="KeyS">↓</button><button data-key="KeyD">→</button></div><div class="touch-actions"><button id="touch-break">Break</button><button id="touch-place">Use</button><button id="touch-inventory">Bag</button><button id="touch-fly">Fly</button><button data-key="Space">Jump</button></div></div></section>
 <div class="modal-overlay hidden" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></div><div id="toast" role="status"></div><input id="file-input" type="file" accept=".json,application/json" hidden><input id="folder-input" type="file" webkitdirectory multiple hidden>
 <div id="loading"><span>Loading terrain</span></div>`;
// 1.7.10 achievements (achievements.js): unlocks show the toast and the chat line; they are saved with the world.
const achievementToast = new AchievementToast({
  scale: () => guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0),
  icon: (id, damage) => icon(id, damage),
  keyName: () => inventoryKeyName(binds.code("key.inventory")),
  playing: () => screen !== "home",
});
// Statistics (stats.js): the per-world counters behind the Statistics screen and stats/<uuid>.json; awards in stats-live.js.
const stats = new Stats(), statsLive = new StatsLive(stats);
watchDrops(items, statsLive);
// player-actions.js dispatch plus the use stat of a placed or applied item (ItemStack.tryPlaceItemIntoWorld).
function dispatchPlayerAction(state, action, hooks) {
  const acted = dispatchPlayerActionRaw(state, action, hooks);
  statsLive.placed(acted, action.heldTool);
  return acted;
}
let achievementsFor = null, achievementTicks = 0;
const achievements = new Achievements({
  onUnlock: (a) => {
    achievementToast.show(a);
    // StatisticsFile.func_150873_a: chat.type.achievement with StatBase.func_150955_j, whose hover shows the achievement.
    printChat(translation("chat.type.achievement", senderComponent(scoreboard.formatName(PLAYER_NAME), PLAYER_NAME), statComponent(lookupStat("achievement." + a.id))));
    saved = false;
  },
});
// The world scoreboard (scoreboard.js, data/scoreboard.dat), its criteria hooks and the sidebar (scoreboard-live.js).
const scoreboard = new Scoreboard(), scoreboardLive = new ScoreboardLive({ scoreboard, stats, achievements, name: () => PLAYER_NAME }), sidebar = new SidebarUi(document);
scoreboard.onChange = () => { saved = false; };

// Open to LAN for this tab (lan.js); it lasts until the world is left.
const lan = new LanSession();
let multiplayer = null, remotePlayers = null, worldWriterAvailable = false;

function multiplayerDefaults() {
  try { return JSON.parse(localStorage.getItem('mc-web-server') || '{}'); } catch { return {}; }
}
let steveSkin = null;
function showMultiplayer() {
  if (!steveSkin) { steveSkin = new Image(); steveSkin.onload = () => gui.build(); steveSkin.src = STEVE_URL; }
  const loadSkin = (api) => async (hash) => {
    if (!hash) return null;
    try { const r = await fetch(api.skinUrl(hash)); return r.ok ? await skinCanvas(await r.blob()) : null; } catch { return null; }
  };
  gui.show(multiplayerScreen({ back: () => gui.show(menus.mainMenu()), defaults: multiplayerDefaults(), connect: joinMultiplayer,
    profile: (api, screen) => gui.show(profileScreen({ api, back: () => gui.show(screen), steve: steveSkin, loadSkin: loadSkin(api) })) }));
}
function leaveMultiplayer() {
  multiplayer?.close(); multiplayer = null;
  remotePlayers?.resetSkin(playerRenderer); remotePlayers?.clear(); remotePlayers = null;
}
function sendMultiplayerInput(controls = IDLE_INPUT) {
  multiplayer?.send({ type: 'input', controls, yaw, pitch, current: survival.inventory.current,
    hotbar: survival.inventory.main.slice(0, 9).map(s => s ? { id: s.id, damage: s.damage ?? 0 } : null) });
}
// Cells from a tick (S22/S21 equivalents) or a placement resend (the clicker's two S23 packets).
function applyMultiplayerCells(changes) {
  if (!multiplayer?.ready || !active?.remote) return;
  const cells = [];
  for (const [x, y, z, id, meta] of changes) {
    const old = world.get(x, y, z);
    world.put(x, y, z, id, meta, false); cells.push([x, y, z, old, id]);
  }
  if (cells.length) scene.updateBlocks(cells);
}
function applyMultiplayerTick(message) {
  if (!multiplayer?.ready || !active?.remote) return;
  if (redstoneRuntime?.redstone) redstoneRuntime.redstone.lit = new Set(message.redstone?.lit ?? []);
  applyMultiplayerCells(message.changes);
  if (message.tiles?.length) applyTiles(message.tiles, { world, signs, skulls: SKULLS, beacons, spawners }); // the S33/S35 descriptions that follow a chunk resend
  const self = message.players.find(p => p.id === multiplayer.id);
  if (self) {
    previous.copy(position); position.set(self.x, self.y, self.z);
    velocity.set(position.x - previous.x, position.y - previous.y, position.z - previous.z);
    flying = self.flying; grounded = self.grounded;
    motion.prevYSize = motion.ySize; motion.ySize = self.ySize ?? 0;
    motion.sneaking = self.sneak;
    motion.sprinting = self.sprinting;
    walkFrozen = self.sneak && self.grounded;
    $("#movement-label").textContent = flying ? 'FLYING' : 'WALKING';
    playerBody.tick({ position, previous, yaw, pitch, swinging: self.swing > 0 });
    if (playerRenderer) remotePlayers?.applySkin(playerRenderer, self.skin); // seen in F5
  }
  survival.time = message.time; weather.restore(message.weather); scene.setTime(message.time);
  chestRenderer.sync(world, survival.chests, undefined, survival.enderTiles);
  remotePlayers?.sync(message.players, multiplayer.id);
}
// S36 open sign editor: the tile is the one the S33 description made (editable here, as the native client sets it); closing the editor sends C12.
function openMultiplayerSign({ x, y, z }) {
  if (!multiplayer?.ready || !active?.remote || !isSign(world.get(x, y, z)) || screen !== 'playing') return;
  const tile = signs.tile(x, y, z) ?? signs.create(x, y, z);
  tile.editable = true; screen = 'inventory'; mining = null; mineHeld = false;
  const client = multiplayer;
  openSignEditor(signEditHost(gui, { close: resume, markUnsaved: () => {} }), signs, tile, world, text => { tile.editable = false; client.updateSign(x, y, z, text); });
}
// S2D open window (ContainerBeacon): the tile entity data comes from the server; the payment slot and the picks are sent as they change.
function openMultiplayerBeacon({ x, y, z, levels, primary, secondary, payment }) {
  if (!multiplayer?.ready || !active?.remote || world.get(x, y, z) !== BEACON || screen !== 'playing') return;
  const tile = beacons.ensure(x, y, z);
  Object.assign(tile, { levels: Number.isInteger(levels) ? levels : -1, primary: primary | 0, secondary: secondary | 0, payment: payment ? { id: payment.id, count: 1, damage: payment.damage | 0 } : null });
  useBeacon(`${x},${y},${z}`);
  containerView.remote = { client: multiplayer, x, y, z, sent: payment?.id ?? null };
}
async function joinMultiplayer(settings) {
  if (multiplayer) throw new Error('A connection is already open.');
  const client = new DedicatedClient({
    onTick: applyMultiplayerTick, onBlocks: message => applyMultiplayerCells(message.changes),
    onSignEditor: openMultiplayerSign, onBeaconWindow: openMultiplayerBeacon,
    onChat: ({ name, text }) => printChat(name ? chatTextComponent(name, text) : text),
    onClose: reason => { if (multiplayer === client) { leaveToTitle(false); gui.show(errorScreen({ title: 'Disconnected', message: reason, cancel: showMultiplayer })); } },
  });
  multiplayer = client;
  try {
    const welcome = await client.connect({ url: settings.url, session: settings.session });
    localStorage.setItem('mc-web-server', JSON.stringify({ name: settings.api.account?.name ?? '' }));
    const snapshot = welcome.world, prepared = restoreReplica(snapshot);
    const self = snapshot.players.find(p => p.id === client.id);
    streamStorage?.dispose(); streamStorage = null;
    const record = { id: 'remote-' + client.id, remote: true, name: 'ledoge0 — Multiplayer', seed: snapshot.seed,
      biome: snapshot.biome, generationVersion: snapshot.generationVersion, mode: 'creative', difficulty: 0,
      position: { ...self, yaw: welcome.self.yaw, pitch: welcome.self.pitch }, player: { ...welcome.self.player, time: snapshot.time },
      entities: [], weather: snapshot.weather, allowCommands: false, edits: [] };
    gui.show(downloadTerrainScreen()); await nextPaint();
    await launch(record, prepared, { slice: true });
    if (multiplayer !== client || client.socket.readyState !== WebSocket.OPEN) throw new Error('Disconnected while loading terrain.');
    remotePlayers = new RemotePlayers(scene, { skinUrl: hash => settings.api.skinUrl(hash) });
    client.start();
    sendMultiplayerInput();
    printChat('Shared Creative world on ledoge0. World border: 128 × 128. Containers, mobs and dimension travel are not connected yet.');
  } catch (error) {
    client.close(); if (multiplayer === client) leaveMultiplayer();
    if (active?.remote) leaveToTitle(false);
    throw error;
  }
}
// The 1.7.10 menu screens (menus.js) drawn over the game in #gui.
const menuContext = {
  get options() { return options; },
  bindings: binds,
  get worlds() { return worlds; },
  worldsError: () => worldsError, // GuiSelectWorld -> GuiErrorScreen "Unable to load worlds"
  get achievements() { return achievements; },
  get stats() { return stats; },
  icon: (id, damage) => icon(id, damage),
  splashes: "",
  saveOptions,
  exportOptionsTxt,
  importOptionsTxt,
  soundLevel: (k) => soundLevel(options.soundLevels, k),
  makeRecord,
  launch: openWorld,
  multiplayer: showMultiplayer,
  isRemote: () => !!multiplayer,
  canSingleplayer: () => worldWriterAvailable,
  exportWorld: chooseExport,
  importWorld: () => $("#file-input").click(),
  importFolder: chooseSaveFolder,
  activeWorld: () => active,
  deleteWorld,
  renameWorld,
  makeEndless,
  resume,
  goHome,
  toggleFullscreen,
  // GuiOptions "Super Secret Settings...": EntityRenderer.activateNextShader plus a random animals/blocks/mobs/players/weather sound.
  superSecret: () => {
    scene?.post.activateNextShader();
    const event = randomSuperSecretEvent(sounds?.manifest?.events ?? {});
    if (event) sounds.play(event, SUPER_SECRET_SOUND);
  },
  inGame: () => screen !== "home",
  notice: toast,
  lanOpen: () => lan.public || !!multiplayer,
  copyText: (text) => { try { navigator.clipboard?.writeText(text); } catch {} },
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
  // Minecraft.refreshResources, in place: the page and the running world stay (resource-refresh.js).
  reloadResources: () => refreshResources(),
});
const menus = createMenus(gui, menuContext);
// Selected resource packs (resource-packs.js): their lang entries replace the menu strings; textures and sounds are served by the worker.
initResourcePacks(options, LANG).then(async () => {
  // Languages (lang.js): the installed manifest, the saved language, Force Unicode Font, then glyph_sizes.bin and ascii.png widths.
  setFontAnaglyph(options.anaglyph); // FontRenderer's constructor reads GameSettings.anaglyph once: the § colour table is fixed for the session
  await loadLanguageManifest();
  setForceUnicodeFont(options.forceUnicodeFont);
  await selectLanguage(options.language || "en_US");
  await loadFontResources();
  gui.screen && gui.build();
});
onFontChange(() => gui.screen && gui.build());
// In-place refresh (resource-refresh.js): the textures of three.js and the CSS sprites reload by themselves; these re-read the rest.
onResourcesRefreshed(async () => { await initResourcePacks(options, LANG); await selectLanguage(options.language || "en_US"); await loadFontResources(); gui.screen && gui.build(); });
onResourcesRefreshed(() => scene?.textures.reload());
onResourcesRefreshed(() => scene?.reloadStrips());
onResourcesRefreshed((gen) => scene?.clouds?.reload(gen)); // clouds.png grid (an Image outside the TextureLoader registry)
onResourcesRefreshed(() => sounds?.refreshPacks?.());
addEventListener("resize", () => gui.build());

// `columns`: the active streamed world's edited column records (world-storage.js).
async function persist(columns = []) {
  if (!worldWriterAvailable || worldsError) return false; // an unread shelf is never overwritten with the empty list
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
    // WorldInfo.hardcore (GuiCreateWorld's Hardcore mode: Survival, locked on Hard, one life; hardcore.js).
    ...(p.hardcore === true ? { hardcore: true } : {}),
    // WorldInfo.allowCommands (GuiCreateWorld "Allow Cheats"). Records saved before 0.42.0 have no flag and read as
    // WorldInfo(NBTTagCompound) does: cheats on for a creative world, off for survival (commands.js cheatsAllowed).
    ...(typeof p.allowCommands === "boolean" ? { allowCommands: p.allowCommands } : {}),
    // Version 11 adds full Java population; 14 (finite) and 15 (streamed) add villages, strongholds and
    // temples; 16 (streamed) uses the native mutated-biome class rule in the biome layers; 18 (streamed) adds the native world spawn walk; 20 (streamed, new worlds) adds the population's neighbour callbacks (java-world.js). Finite worlds stay on 14,
    // the earlier biome rule. Saves retain their existing generator.
    // Default, Large Biomes and Amplified worlds are streamed (endless) with the matching WorldType generator.
    generationVersion: p.biome === "javaStreamed" ? 20 : isJavaLandscape(p.biome) ? 14 : 8,
    ...(p.biome === "javaStreamed" ? { worldType: streamedWorldType(p.worldType) } : {}),
    // Superflat: the FlatGeneratorInfo string (WorldInfo.generatorOptions), normalised as ass.toString writes it.
    ...(p.biome === "javaStreamed" && p.worldType === "flat" ? { generatorOptions: normalizeFlatOptions(p.generatorOptions) } : {}),
    // GuiCreateWorld "Bonus Chest": WorldInfo.isBonusChestEnabled; the chest is placed once (bonusChestPlaced).
    ...(p.bonusChest === true ? { bonusChest: true } : {}),
    edits: [],
    updated: Date.now(),
    version: 1,
  };
}
function toast(message) {
  // Bitmap glyph path (bitmap-text.js) at the GUI scale instead of the page face; the message is plain text.
  const el = $("#toast");
  el.className = "mc-text";
  el.style.setProperty("--u", `${guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0)}px`);
  el.innerHTML = bitmapHtml(String(message), 0xffffff);
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
// Block.SoundType through block-sounds.js: RenderGlobal.playAuxSFX 2001 for a break, ItemBlock.onItemUse for a placement
// (ItemDoor, ItemBed, ItemSign, ItemRedstone and ItemSeeds place silently), both at the cell's centre.
function sound(place, block = target ? world.get(...target.block) : 3) {
  if (place && (placesSilently(block) || mutePlaceSound)) return; // mutePlaceSound: the client half already played this placement's sound (b55 instantbreak)
  const s = place ? placeSound(block) : breakSound(block), cell = place ? target?.adjacent ?? target?.block : target?.block;
  sounds?.play(s.name, { volume: s.volume, pitch: s.pitch, position: cell && { x: cell[0] + 0.5, y: cell[1] + 0.5, z: cell[2] + 0.5 } });
}
const compassIcon = () => `<span class="vanilla-item-icon creative-strip" style="--strip:url('${COMPASS_STRIP}');--frames:var(--compass-frames,${COMPASS_FRAMES})" aria-hidden="true"></span>`;
function icon(id, damage = 0, stack) {
  const item = ITEMS[id];
  if (!id || !item) return '<span class="empty-hand">·</span>';
  // ItemPotion layers: potion_overlay tinted by the liquid colour under the untinted bottle (splash bottle for splash values).
  if (id === 385) return `<span class="vanilla-item-icon tinted-item" style="--tint:#${(damageColor(damage | 0) & 0xffffff).toString(16).padStart(6, "0")};--base:url('/media/1.7.10/items/potion_overlay.png')" aria-hidden="true"><i></i><img src="/media/1.7.10/items/${(damage | 0) & 16384 ? "potion_bottle_splash" : "potion_bottle_drinkable"}.png" alt=""></span>`;
  if (id === ITEM_SPAWN_EGG) return spawnEggIconHtml(damage); // spawn-eggs.js: primary and secondary colour layers
  if (id === ITEM_COMPASS) return compassIcon();
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
  return withGlint(icon(s.id, s.damage, s), s, ITEMS[s.id]) + (count === 0 ? zeroCountHtml() : countHtml(count)) + durabilityBar(s.damage, ITEMS[s.id]?.durability);
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
  $("#block-label").innerHTML = bitmapHtml(stackName(held, ITEMS) || ITEMS[held.id]?.name || "");
  $("#block-label").classList.add("visible");
  showHeldName.timer = setTimeout(
    () => $("#block-label").classList.remove("visible"),
    1300,
  );
}
let shellDispose = null;
function closeModal() {
  closeContainer();
  shellDispose?.(); shellDispose = null;
  $("#modal").classList.remove("gui-shell");
  $("#modal").classList.add("hidden");
  $("#modal").innerHTML = "";
}
// A GuiContainer host (the former page dialog, without its title bar and close button) (container-screens.js places the panel).
function containerShell(kind, body, extra, opts, mode = kind) {
  eating = null;
  keys.clear();
  if (screen === "playing") screen = "paused";
  if (document.pointerLockElement) document.exitPointerLock();
  shellDispose?.();
  $("#modal").innerHTML = shellHtml(extra, (opts.noLabels ? "" : labelsHtml(kind, opts)) + body);
  $("#modal").classList.remove("hidden");
  shellDispose = placeShell($("#modal"), mode, opts);
  $("#modal").querySelector("button,input")?.focus();
}
// Port-only build notes (no 1.7.10 screen, no trigger element in index.html today): glyph text on a Gui screen.
function notes() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (screen === "playing") screen = "paused";
  gui.show(notesScreen({ notes: NOTES, openLink: (url) => window.open(url, "_blank", "noopener"), back: () => (screen === "home" ? gui.show(menus.mainMenu()) : pause()) }));
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
  scene.setRenderSettings(options);
  chat.applySettings(options);
  sounds.updateVolumes();
  updateParticleOptions();
  updateDifficulty();
  updateGuiScale();
  options.keyBindings = binds.saved();
  try {
    localStorage.setItem("blockworld.settings", JSON.stringify(options));
    localStorage.setItem("blockworld.options.txt", writeOptionsTxt(options));
  } catch {}
}
// Controls screen "Export"/"Import": a browser-only helper (not part of 1.7.10, whose options.txt lives in the game folder). Export
// downloads the native-format file the mirror already holds; import runs GameSettings.loadOptions over the current settings
// (options-txt.js). The resource pack selection is kept as it is: changing it would need a pack refresh.
function exportOptionsTxt() {
  options.keyBindings = binds.saved();
  downloadBlob(new Blob([writeOptionsTxt(options)], { type: "text/plain" }), "options.txt");
  toast("options.txt exported (browser-only helper).");
}
function importOptionsTxt() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".txt,text/plain";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { options: next, skipped } = applyOptionsTxt(options, await file.text());
      next.resourcePacks = options.resourcePacks;
      const keys = new KeyBindings(next.keyBindings);
      Object.assign(options, next);
      binds.codes = keys.codes; binds.resetHash(); binds.releaseAll();
      saveOptions();
      gui.screen && gui.build();
      toast(`options.txt imported (browser-only helper)${skipped.length ? `, ${skipped.length} line(s) skipped` : ""}.`);
    } catch (err) { toast("options.txt import failed: " + (err.message ?? err)); }
  };
  input.click();
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
  // Every storage id the world occupies: its own columns/runtime/containers and the `${id}~-1` / `${id}~1` dimension views.
  const failed = await deleteWorldStorage(record, deleteStoredWorld);
  if (failed.length) toast('World removed from the shelf; its stored data could not be cleared.');
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
  if (active?.remote) return;
  if (!active || !world || screen === "home") return;
  // Streamed worlds store edits per column: only the columns edited since the last save are written.
  const columns = world.streaming ? world.takeDirtyColumns().map((c) => ({ world: active.id, ...c })) : [];
  world.beginColumnSave(columns);
  if (!world.streaming) active.edits = [...world.edits];
  if (world.streaming) active.editSequence = world.nextEditOrder;
  if (world.population) active.populatedColumns = world.saveClaimedColumns();
  active.position = { x: position.x, y: position.y, z: position.z, yaw, pitch };
  active.portalState = dims.state.save();
  active.player = survival.serialize();
  active.achievements = achievements.save();
  active.stats = stats.save();
  active.scoreboard = scoreboardToJSON(scoreboard);
  active.drops = items.serialize();
  active.projectiles = projectiles.serialize();
  active.eyes = eyes.serialize();
  active.maps = maps.serialize();
  active.rockets = rockets.serialize();
  active.fishing = fishing.serialize();
  active.thrownPotions = mobs?.potions?.serialize() ?? [];
  active.fireballs = [...(mobs?._fireballs?.serialize(world.dimension ?? 0) ?? []), ...(mobs?._skulls?.serialize(world.dimension ?? 0) ?? [])]; // fireballs.js; tagged with the dimension they fly in
  active.arrows = arrows.serialize();
  // EntityTNTPrimed.writeEntityToNBT keeps only the fuse (plus Entity's position and motion).
  active.tnt = primed.map((e) => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse }));
  active.weather = weather.saveWeather(); // while in the Nether/End: the Overworld's timers, which keep running (weather.js awayOverworld)
  active.bed = bedSleep.save();
  active.flying = flying && survival.creative ? true : undefined;
  active[simulationKey(world.dimension)] = weather.saveSimulation();
  if (weather.overworld) active.worldRandom = weather.saveOverworldSimulation(); // the Overworld's World.rand/updateLCG stay in worldRandom; each other dimension keeps its own (dimension state `simulation`)
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
  if (mobs?.saveTotalTime() !== undefined) active.totalTime = mobs.saveTotalTime();
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
  if (mobs) stampSavedOrder(mobs, orderGroups({ mobs, items, xpOrbs, primed, arrows, projectiles, falling, minecarts, boats, hanging, rockets }, active)); // b52so: each record's place in the native save walk (sections of each chunk)
  if (signs.tiles.size) active.signs = signs.toJSON(); else delete active.signs;
  if (SKULLS.tiles.size) active.skulls = SKULLS.toJSON(); else delete active.skulls;
  if (beacons.tiles.size) active.beacons = beacons.toJSON(); else delete active.beacons;
  active.updated = Date.now();
  const savingContainers=containerResidency, containerSave=savingContainers?.beginSave(active.player);
  if(containerSave)active.containerScope=savingContainers.scope(containerSave);
  // In the Nether/End `active` is a view record; the shelf keeps the root with `dimensions[d]` (dimension-live.js).
  const shelved = active.rootId ? storedRecord(active, worlds.find((w) => w.id === active.rootId) ?? active) : active;
  const i = worlds.findIndex((w) => w.id === shelved.id);
  if (i < 0) worlds.unshift(shelved);
  else worlds[i] = shelved;
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
async function exportSnapshot(record) {
  const id = rootIdOf(record), running = rootIdOf(active) === id;
  if (running) await save();
  const root = worlds.find(w => w.id === id) ?? record;
  const snapshot = structuredClone(await readRuntimeState(root));
  const allEdits = async (id) => {
    const durable = await readChunkEdits(id);
    return running && active.id === id ? [...new Map([...durable, ...world.edits])] : durable;
  };
  if (snapshot.chunked) snapshot.edits = await allEdits(id);
  for (const d of [-1, 1]) {
    const blob = snapshot.dimensions?.[d];
    if (blob) blob.edits = await allEdits(viewId(id, d));
  }
  return snapshot;
}

async function exportWorld(record = active) {
  try { record = await exportSnapshot(record); }
  catch (e) { toast('Could not read this world: ' + e.message); return; }
  const { chunked, runtimeChunked, editSequence, ...rest } = record;
  // A whole-save world's stored full columns ride along (whole-save-json.js); too many for one file are reported, not dropped silently.
  const stored = record.wholeSave ? await collectBases({ list: listBaseColumns, read: readBaseColumns, key: (d) => (d ? viewId(rootIdOf(record), d) : rootIdOf(record)) }) : null;
  if (stored) { rest.bases = stored.bases; if (stored.omitted) rest.wholeSave = { ...rest.wholeSave, basesOmitted: stored.omitted }; }
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { ...rest, format: "blockworld", version: 1 },
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
  // Port-only dialog (no 1.7.10 screen): modal-dialogs.js exportScreen, drawn with the FontRenderer glyphs.
  const back=()=>{if(screen==='home')gui.show(menus.selectWorld());else pause();};
  gui.show(exportScreen({
    back, busy: (on) => { exportBusy = on; }, notice: toast,
    browser: () => { back(); exportWorld(record); },
    java: async (progress) => {
      const snapshot = await exportSnapshot(record);
      const {exportJavaSave}=await import('./region-export.js');
      const result=await exportJavaSave(snapshot,{readBases:readBaseColumns,maxChunks:snapshot.wholeSave?16384:4096,onProgress:progress});
      const url=URL.createObjectURL(new Blob([result.zip],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=record.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()+'.java-1.7.10.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      return `Java save exported (${result.report.columns} columns). Unzip it into the Java saves folder; conversion notes are included.`;
    },
  }));
}
function requestLock() {
  if (screen !== "playing") return;
  try {
    const result = scene.renderer.domElement.requestPointerLock?.();
    result?.catch(() => {
      lockFallback = true;
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
    if (old === SKULL && now !== SKULL) SKULLS.remove(x, y, z); // TileEntitySkull goes with its block
    if (old === BEACON || now === BEACON) beacons.sync(x, y, z, now); // TileEntityBeacon goes with its block
    if (old === ENCHANTING_TABLE || now === ENCHANTING_TABLE) enchantBooks.changed(x, y, z, now); // TileEntityEnchantmentTable goes with its block
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
    // BlockCrops.canBlockStay / BlockFarmland.onNeighborBlockChange on every neighbour update (farming.js farmNeighbourChange).
    for(const c of farmNeighbourChange(world,x,y,z)){
      if(c.drops.length)items.dropBlock(c.drops.map(d=>makeStack(d.id,d.count)),c.x,c.y,c.z);
      farming?.observe(c.x,c.y,c.z);
      scene.updateBlock(c.x,c.z,c.y);
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
let tripLoading = false; // a portal trip is between worlds: screen is "home" for the loop but the music stays the game's
let pendingBonusChests = null; // chest tiles of a bonus chest placed during creation, consumed by launch
async function openWorld(record) {
  if (!worldWriterAvailable) { toast('Another tab owns local saves. Close it and reload to play Singleplayer.'); return; }
  leaveMultiplayer();
  if(openingWorld)return;
  openingWorld=true; performance.mark?.('trip:open');
  if (!record.transit) dims.endAway(); // away-world.js: a trip's pending Overworld run does not outlive the session it belongs to
  sounds?.stopStreams(); // Minecraft.loadWorld: SoundHandler.stopSounds (music and records), also between dimensions
  lan.close();
  // From the title screen: LoadingScreenRenderer's "Loading world" screen (loading-screen.js); portal trips keep the game on screen.
  // A portal trip (record.transit): Minecraft.loadWorld(world, "") draws a blank loading frame, then handleRespawn shows GuiDownloadTerrain (travel-loading.js).
  const trip = screen !== "home" && !!record.transit, tripFrom = screen, loading = screen === "home" ? startLoading() : trip ? blankLoading() : null, spawnLog = new SpawnAreaLog(64, trip ? () => {} : undefined);
  let warmer = null;
  const yieldTask = taskPause();
  if (trip) { screen = "home"; tripLoading = true; keys.clear(); $("#hud").classList.add("hidden"); } // the title-start path: no ticking, no scene drawing, until launch
  if (loading) { gui.show(loadingScreen(loading)); await nextPaint(); }
  if (trip) { gui.show(downloadTerrainScreen()); await nextPaint(); } // handleRespawn: GuiDownloadTerrain follows the blank frame for the whole transfer
  try {
    if (record.dimension && !record.rootId) record = dims.openRecord(record, await readRuntimeState(record)); // saved in the Nether/End: open that dimension
    const presolved = loading ? presolveWorld(record) : null; // the native spawn walk, then the resident window's cell, in a worker so this screen stays live (spawn-presolve.js)
    if (presolved) await presolved.spawn;
    // WorldServer.initialize runs createSpawnPosition under "Loading world"; the chunk load that follows is "Building terrain" (the World constructor populates the resident window).
    if (loading && !trip) { setStage(loading, STAGES.terrain); spawnLog.report(0, performance.now()); await nextPaint(); await presolved.terrain; }
    else if (trip) await presolved.terrain; // the Overworld's resident cell from the worker; the Nether/End have none
    performance.mark?.('trip:terrain');
    const prepared=dims.createWorld(record);
    if (loading) warmer = arrivalWarmer(prepared, { pause: yieldTask });
    if (!record.chunked) prepared.restore(record.edits??[]);
    if (!prepared.dimension && !record.worldSpawn) {
      if (prepared.nativeSpawn) record.worldSpawn = [prepared.nativeSpawn[0] - prepared.originX, prepared.nativeSpawn[1], prepared.nativeSpawn[2] - prepared.originZ]; // WorldInfo spawn (world-spawn.js)
      else { const { x, y, z } = prepared.spawn(); record.worldSpawn = [Math.floor(x), Math.floor(y), Math.floor(z)]; }
    }
    prepared.restoreClaimedColumns(record.populatedColumns);
    const transit = record.transit;
    await dims.arrive(prepared, record, loading ? { pause: yieldTask, warm: warmer } : {}); // portal travel: the Teleporter's arrival position
    const p=record.position; performance.mark?.('trip:arrived');
    if(prepared.streaming&&p&&[p.x,p.z].every(Number.isFinite)){ if (warmer) await warmer.window(p.x,p.z); prepared.streamAround(p.x,p.z); }
    performance.mark?.('trip:windowed');
    record=await readRuntimeState(record,prepared.streaming?{containerColumns:[...prepared.chunks.values()].map(c=>[c.x,c.z])}:{});
    const storage=prepared.streaming?new StreamStorage(prepared,record.id,{onError:e=>{pause();toast('Could not load saved columns. Reopen the world to retry: '+e.message);}}):null;
    prepared.nextEditOrder=Math.max(prepared.nextEditOrder,record.editSequence??(record.chunked?2000000:0));
    if(storage)await storage.ensure([...prepared.chunks.values()].map(c=>[c.x,c.z]));
    // WorldServer.initialize: the bonus chest belongs to world creation, after the spawn and before any runtime exists (bonus-world.js).
    if (bonusChestDue(record, prepared)) pendingBonusChests = placeBonusChest(prepared, record).chests;
    dims.applyWrites(prepared, record, { verifyBed: (w, s) => { const cell = verifyRespawn(w, s, false); return cell ? bedRespawnPosition(cell) : null; } }); // portal frame / End platform
    streamStorage?.dispose();streamStorage=storage;
    if (loading) spawnLog.report(prepared.chunks?.size ?? 0, performance.now(), true);
    // NetHandlerPlayClient.handleJoinGame shows GuiDownloadTerrain until the first position packet: here, while the columns are meshed and the player is placed.
    warmer?.dispose(); warmer = null;
    if (loading && !trip) { gui.show(downloadTerrainScreen()); await nextPaint(); }
    performance.mark?.('trip:launch');
    await launch(record,prepared,{slice:!!loading});
    performance.mark?.('trip:done');
    // PlayerList.transferPlayerToDimension: leaving the End, Overworld -> End, or any other portal trip (not a respawn).
    if (transit && !transit.death) achievements.trigger(transit.exit ? "theEnd2" : transit.from === 0 && prepared.dimension === 1 ? "theEnd" : "portal");
  } catch(e) {
    if (pendingBonusChests) { pendingBonusChests = null; record.bonusChestPlaced = false; } // placed on a world that never launched: owed again
    // GuiErrorScreen replaces the toast when the load started from the title screen.
    if (trip) { screen = tripFrom; $("#hud").classList.remove("hidden"); gui.hide(); toast('Could not open this world: '+e.message); } // the old world is still the active one
    else if (loading) gui.show(errorScreen({ title: "Could not open this world", message: String(e?.message ?? e), cancel: () => gui.show(menus.mainMenu()) }));
    else toast('Could not open this world: '+e.message);
  }
  finally{openingWorld=false;tripLoading=false;warmer?.dispose();}
}
async function launch(record, prepared, { slice = false } = {}) {
  try {
    active = record;
    world = prepared;
    portalTimer.reset();
    dims.restorePlayer(record);
    if (record.wholeSave) dims.warmStored({ id: rootIdOf(record), wholeSave: record.wholeSave }, dimensionOf(record)); // stored-column index for /spreadplayers and portal peeks (background)
    startPrefetch();
    if (world.dimension && (navigator.hardwareConcurrency ?? 4) >= 4) { const root = worlds.find((w) => w.id === rootIdOf(record)); if (root) presolveWorld({ ...root, dimension: 0 }); } // the Overworld's spawn walk and resident cell are built while this dimension is played, so a return does not wait for them (spawn-presolve.js parks them)
    // Restore World.rand before constructing the block runtimes that share it.
    weather = new Weather().restore(record.weather).restoreSimulation(record[simulationKey(world.dimension)]);
    if (world.dimension) weather.awayOverworld(record); // the Overworld keeps its weather timers running while the player is in the Nether/End
    // The cave mood sound (cave-ambience.js) on this world's World.rand and updateLCG.
    weather.mood = new MoodSound(weather);
    weather.mood.player = () => ({ x: position.x, y: position.y, z: position.z }); // EntityPlayerMP sets yOffset 0 (bytecode-read), so the server player's posY is the feet; getClosestPlayer uses Entity.getDistanceSq(posX, posY, posZ)
    hideBedScreen();
    bedSleep.restore(record.bed); // the spawn point; a saved sleeping state is resumed after the player is placed
    scene.setWorld(world, { defer: slice }); // from the title screen the column meshes are built in frame-sized slices below, behind the loading screen
    performance.mark?.('trip:setworld');
    const yieldTask = taskPause(); // macrotask pauses between slices (steps.js), not a frame each
    if (slice) while (scene.buildLight(12)) await yieldTask();
    performance.mark?.('trip:lit');
    // Block light for canBlockFreeze/canSnowAt/melting is the scene's light volume.
    world.blockLight = (x, y, z) => scene.light.blockAt(x, y, z);
    world.fullLight = (x, y, z) => scene.light.level(x, y, z, 0); // World.getFullBlockLightValue (plant-light.js: mushrooms)
    // ItemBucket in the Nether: water makes fizz and 8 smoke puffs instead of a block.
    world.evaporated = (x, y, z) => { sounds.play('random.fizz', { volume: 0.5, pitch: 2.6 + (Math.random() - Math.random()) * 0.8, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } }); for (let i = 0; i < 8; i++) scene.fx.spawn('largesmoke', x + Math.random(), y + 0.2, z + Math.random(), 0, 0, 0); };
    // Water washes away torches, wheat and tall grass (Block.dropBlockAsItem).
    fluids = new Fluids(world, { nether: !!world.isHell, skyless: !!world.dimension, random: weather.random, fizz: (x, y, z, pitch) => sounds.play("random.fizz", { volume: 0.5, pitch, position: { x, y, z } }), wash: (x, y, z, b) => { const d = b === WEB ? [{ id: 321, count: 1 }] : b === 20 ? [{ id: 20, count: 1 }] : isFlower(b) ? [{ id: b, count: 1, damage: b === RED_FLOWER ? world.getMeta(x, y, z) : 0 }] : b === SAPLING ? [{ id: b, count: 1, damage: world.getMeta(x, y, z) & 7 }] : cropDrops(b,Math.random,world.getMeta(x,y,z)); if (d?.length) items.dropBlock(d.map((e) => makeStack(e.id, e.count, e.damage || 0)), x, y, z); } });
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
      hurt:(box,amount,kind='anvil')=>{
        const intersects=b=>box[3]>b[0]&&box[0]<b[3]&&box[4]>b[1]&&box[1]<b[4]&&box[5]>b[2]&&box[2]<b[5];
        if(intersects(pushBox(position,PHYSICS.width,PHYSICS.height)))survival.anvilDamage(amount,kind);
        for(const e of mobs.entities){const size=ENTITY_TYPES[e.type];if(intersects(pushBox(e,size.width,size.height)))mobs.attackEntityFrom(e,amount,{name:kind});}
        saved=false;
      },
    }, record.falling).watch();
    falling.joined = (e) => mobs?.joined(e, "falling");
    falling.load(record.fallingTicks);
    // Saved ticks the lists above cannot hold (tile-ticks.js): taken at their due time, run only if the cell still holds a block the port ticks.
    foreignTicks = new ForeignTicks(record.foreignTicks, (x, y, z) => (world.inside(x, y, z) ? world.get(x, y, z) : -1), {
      fluid: (x, y, z, e) => fluids.schedule(x, y, z, 0, e.p | 0), fire: (x, y, z, e) => fire.schedule(x, y, z, 0, e.p | 0), falling: (x, y, z) => falling.schedule(x, y, z),
      redstone: (x, y, z, e) => redstoneRuntime?.redstone?.scheduleBlockUpdate(x, y, z, e.i, 0, e.p | 0),
    });
    farming=new Farming(world,record.farms);
    farming.lightLevel=(x,y,z)=>scene.light?scene.light.level(x,y,z,scene.subtracted):15; // World.getBlockLightValue for crop and stem growth
    restorePots(world,record.pots);
    // Rain moistens farmland (BlockFarmland.updateTick: canLightningStrikeAt(x, y + 1, z)).
    farming.rained = (x, y, z) => canLightningStrikeAt(weather, world, x, y + 1, z);
    weather.apply = applyWeatherEdit;
    weather.drop = (w, x, y, z, stacks) => items.dropBlock(stacks.map((d) => makeStack(d.id, d.count)), x, y, z); // BlockSnowBlock.updateTick: 4 snowballs
    fire.sharedRandomTicks = true;
    // One WorldServer random-tick stream: fire and still lava (fire.js), saplings and leaves (trees.js),
    // sugar cane and cactus (plants.js), then snow and ice melting in Weather.tickChunk itself.
    populationBlocks=new PopulationBlocks(world,{random:weather.random,drop:(stacks,x,y,z)=>items.dropBlock(stacks.map(d=>makeStack(d.id,d.count,d.damage||0)),x,y,z),apply:changes=>{scene.updateBlocks(changes);saved=false;}}).watch();
    world.populationBlocks=populationBlocks;
    weather.blockTick = (x, y, z, b) => populationBlocks.randomTick(x,y,z,b) || fire.randomTick(x, y, z, b) || trees.randomTick(x, y, z, b) || plants.randomTick(x, y, z, b) || netherLive.randomTick(x, y, z, b) || redstoneRuntime?.randomTick(x, y, z, b);
    scene.weather = weather;
    // EntityLightningBolt's fire, and the ticks of the fires saved with the world.
    weather.fire = fire.strikes;
    fire.load(record.fireTicks);
    experience=new Experience(record.experience);entityIds.reserveRecord(record);xpOrbs=new ExperienceOrbs(record.xpOrbs,undefined,entityIds);xpOrbs.joined=(e)=>mobs?.joined(e,"orb");playerTicks=0;
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
    netherLive = new NetherLive(world, { random: weather.random, drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; },
      // BlockPortal.updateTick's pig zombie (Overworld portals, doMobSpawning, nextInt(2000) < difficulty id).
      pigman: (at) => { mobs?.spawnPortalPigman(at, weather.random); saved = false; }, difficulty: () => mobs?.difficulty ?? 0, mobSpawning: () => gameRule("doMobSpawning"),
      solidTop: (x, y, z) => solidTopSurface(world, x, y, z), normalCube: isNormalCube }).watch();
    // Redstone components (inert, no power): unsupported ones drop; a pressed stone button releases 20 ticks later.
    world.redstoneBlocks = new RedstoneBlocks(world, { drop: dropBlock, apply: (changes) => { scene.updateBlocks(changes); saved = false; }, sound: (name, volume, pitch, x, y, z) => sounds.play(name, { volume, pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } }) }).watch();
    // Live redstone power and pistons (redstone-runtime.js). The inert RedstoneBlocks above keep only the tripwire
    // support rule; every block the engine ported (torches, plates, buttons, dust...) drops through its own behaviour.
    redstoneRuntime?.dispose();
    redstoneRuntime = createRedstoneRuntime({ world, scene, game: {
      commandHost: () => commandHost,
      music: {
        particle: (name, x, y, z, vx, vy, vz) => scene.fx.spawn(name, x, y, z, vx, vy, vz),
        // RenderGlobal.playRecord: stop the record at the jukebox; a disc sets the HUD line and plays "records.<name>" there
        // (music.js recordSound; silent unless npm run music:fetch installed the streams, public/research/music.md).
        play: (item, x, y, z) => {
          if (item) recordHud.show(item);
          sounds.playRecord(item ? recordSound(discName(item), x, y, z) : null, x, y, z);
        },
        spawn: (stack, x, y, z) => items.spawn(makeStack(stack.id, stack.count, stack.damage || 0), x, y, z, { delay: 10 }),
      },
      sound: (name, x, y, z, volume, pitch) => sounds.play(name, { volume, pitch, position: { x, y, z } }),
      drop: (x, y, z, d) => items.dropBlock([makeStack(d.id, d.count, d.damage || 0)], x, y, z),
      primeTnt: (x, y, z) => lightTnt(x, y, z, null),
      markUnsaved: () => { saved = false; },
      // Pistons push the player through its own moveEntity state (piston-push.js pushPlayer).
      player: () => ({ position, velocity, motion, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0, flying, inWater: wasInWater, vehicle: rider.vehicle ?? null, rider,
        get onGround() { return grounded; }, set onGround(v) { grounded = v; }, get collidedH() { return collidedH; }, set collidedH(v) { collidedH = v; },
        get fallDistance() { return fallDistance; }, set fallDistance(v) { fallDistance = v; },
        // The push's moveEntity tail (cactus, fire, webs) and its landing (fall damage), as in the player's own move.
        tail: (body) => playerMoveTail({ world, weather, survival, flying, inWater: wasInWater }, body, { fizz: playerFizz }),
        land: (d) => { addFallStat(stats, d, survival.creative); landPlayer({ world, position, survival, inWater: wasInWater }, d, playerLanding()); } }),
      mobs: () => mobs,
      items: () => items.items, itemSystem: () => items, // the systems: pistons push items and orbs through their own move (piston-push.js)
      arrows: () => arrows.list,
      thrown: () => [...projectiles.balls, ...(mobs.potions?.projectiles?.balls ?? [])], // string sensing: witch and dispensed potions fly in mobs.potions
      boats: () => boats.carts, boatSystem: () => boats, falling: () => falling.entities,
      orbs: () => xpOrbs.orbs, orbSystem: () => xpOrbs,
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
        arrow: (e) => { const a = arrows.make(e, e.rand, { shooter: null, pickup: 1 }); arrows.list.push(a); arrows.joined(a); },
        thrown: (kind, e) => {
          const ball = { x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, kind, px: e.x, py: e.y, pz: e.z, prevYaw: e.yaw, prevPitch: e.pitch, ticks: 0, rand: e.rand, random: e.rand, dead: false };
          if (kind === "potion" || kind === "expBottle") { const b = { ...ball, damage: e.damage ?? 0, owner: null }; (mobs.potions?.projectiles ?? projectiles).balls.push(b); mobs.joined?.(b, "potion"); } // potions and bottles walk as "potion"
          else { projectiles.balls.push(ball); projectiles.joined?.(ball); }
        },
        spawnEgg: (stack, at, roll) => { if (spawnEggMob({ mobs }, stack.damage, at, stack.displayName, roll)) saved = false; }, // BehaviorDispenseSpawnEgg
        fireball: ({ x, y, z, ax, ay, az }) => { mobs.fireballs.launch({ large: false, owner: null, x, y, z, exact: [ax, ay, az] }); }, // dispense.js FIRE_CHARGE
        cart: (type, x, y, z) => { if (type === 0) minecarts.spawnEmpty({ x, y, z }); else minecarts.spawnCart(type, { x, y, z, items: [] }); },
        firework: (stack, x, y, z, fx, fz) => { dispenseFirework(rockets, x, y, z, fx, fz, stack); saved = false; },
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
    tickTree = attachTickTree({ fluids, fire, falling, redstone: redstoneRuntime, foreign: foreignTicks, now: () => mobs?.saveTotalTime() ?? 0 }); // one WorldServer tick tree over the lists
    fluids.writers.push((x, y, z, old, now) => redstoneRuntime?.fluidChanges([[x, y, z, old, now]], true)); // World.setBlock notifies neighbours at once: redstone hears each write of a fluid run in order (batch 35)
    scene.repeaterLit = (x, y, z) => redstoneRuntime?.redstone?.lit?.has(`${x},${y},${z}`) === true;
    for (const k of redstoneRuntime.redstone.lit) { const [x, y, z] = k.split(",").map(Number); scene.updateBlock(x, z, y); } // restored powered repeaters emit light 9
    // Mineshaft spawners and chest minecarts: generation records on a world's first launch, the
    // saved live state afterwards. A broken spawner block removes its tile entity.
    ({ spawners, minecarts } = (() => {
      const restored = restoreStructureEntities(record, world, { minecartOptions: { ids: entityIds } });
      for (const t of restored.pendingTicks) fluids.schedule(t.x, t.y, t.z, t.delay);
      return restored;
    })());
    watchSpawnerBlocks(world, spawners);
    boats = Boats.fromJSON(record.boats, { ids: entityIds });
    boats.joined = joinedAs("boat"); // batch 48: a boat or cart the player places joins World.loadedEntityList at its spawn, not at the end of the walk (entity-simulation.js entityWalkers)
    if (minecarts) minecarts.joined = joinedAs("cart");
    if (boatRenderer) { boatRenderer.clear(); boatRenderer.boats = boats; }
    aimedCart = null;
    hanging = Hanging.fromJSON(record.hanging, { ids: entityIds }); hanging.joined = joinedAs("hanging"); aimedHanging = null; hangingRenderer?.clear();
    signs = Signs.fromJSON(record.signs); signRenderer?.clear();
    SKULLS.tiles = Skulls.fromJSON(record.skulls).tiles; skullRenderer?.clear();
    beacons = new Beacons().fromJSON(record.beacons); beaconRenderer?.clear();
    for (const [k, v] of world.edits) if ((v & 255) === BEACON) beacons.ensure(...k.split(",").map(Number));
    if (minecartRenderer) { minecartRenderer.clear(); minecartRenderer.minecarts = minecarts; }
    mobs?.leaveWorld?.([objectTracker]); // the old world's tracker lets the player go: its copies are gone with the client world (b55dt)
    mobs = new EntityWorld(world, !world.dimension && world.generationVersion >= 11 && !hasSavedPopulation(record) ? [] : record.entities, undefined, entityIds);
    mobs.fx = scene.fx;
    pendingEdits = []; prediction?.clearAll(); prediction = null; scene.predicted = null;
    mobs.afterEntities = () => redstoneRuntime?.tickTiles(); // World.updateEntities: the tile entities (moving piston blocks) update after every entity (b49po)
    { const tiles = mobs.afterEntities; mobs.afterEntities = () => { tiles(); tickServerDig(); runPendingEdits(); }; } // the network tick follows: the queued C02 / C08 / C07 actions (b50 meleeorder)
    mobs.blockParticle = (id, meta, x, y, z, vx, vy, vz) => scene.particles.spawn("blockcrack", id, meta, x, y, z, vx, vy, vz, [position.x, position.y + PHYSICS.eye, position.z]); // EntityIronGolem's walking dust
    linkVehicleRiders(mobs.entities, boats.carts, minecarts?.carts, (m) => mobs.size(m)[1]); // mobs saved riding a boat or cart
    if (pendingDragon) {
      pendingDragon = false;
      if (world.dimension === 1) {
        // ChunkProviderEnd.populate: the spikes' crystals (dimension-world.js endCrystals), then the dragon at chunk (0, 0).
        for (const c of slice && world.endCrystalSteps ? await runSteps(world.endCrystalSteps(), nextFrame) : world.endCrystals?.() ?? []) { const e = mobs.create("ender_crystal", c.x, c.y, c.z); e.yaw = (-c.yaw * Math.PI) / 180; mobs.entities.push(e); }
        spawnDragonIfAbsent(world, mobs);
      }
    }
    mobs.onLand = (entity, distance) => {
      trampleFarmland(entity, distance);
      if (entity.type === "pig" && pigFall(distance, rider.vehicle?.entity === entity)) achievements.trigger("flyPig");
    };
    mobs.landingDust = (entity, x, y, z, data) => scene.particles.landingDust(world, x, y, z, data, [position.x, position.y + PHYSICS.eye, position.z]); // playAuxSFX(2006) of any mob's landing
    watchMobs(mobs, { achievements, player: () => position });
    watchMobStats(mobs, { live: statsLive });
    mobs.onEntityWalking = (x, y, z) => touchRedstoneOre(x, y, z); // Entity.moveEntity's step tail: Block.onEntityWalking
    // World.getLightBrightness for EntityAI.getBlockPathWeight: daylight-reduced sky or block light.
    mobs.lightAt = (x, y, z) => (scene.light ? scene.light.level(x, y, z, scene.subtracted) : 15);
    mobs.dimensionBlockLight = (x, y, z) => scene.light?.blockAt(x, y, z) ?? 0;
    // Ocelot hooks (ocelot-ai.js, chest.js): the player's look for Tempt, chest and furnace state for OcelotSit, sitting cats on chests.
    mobs.playerLook = () => { const e = playerEye(); return { yaw: e.yaw, pitch: e.pitch }; };
    mobs.ocelotBlocks = { chestUsers: (x, y, z) => survival.chests[`${x},${y},${z}`]?.users ?? 0, furnaceLit: (x, y, z) => (survival.furnaces[`${x},${y},${z}`]?.burn ?? 0) > 0 };
    world.ocelotOnChest = (x, y, z) => mobs.ocelotSitsOn(x, y, z);
    // Entity.isWet: rain puts out burning mobs and stops zombies burning in the sun.
    mobs.wet = (e, height) => isWet(weather, world, e, height);
    // World.isDaytime (skylightSubtracted < 4) and Chunk.canBlockSeeTheSky for the skeleton's
    // sunburn and its sun tasks; EntitySkeleton's arrows come from bow.js.
    mobs.isDaytime = () => !world.dimension && (scene.subtracted ?? 0) < 4;
    mobs.canSeeSky = (x, y, z) => canSeeSky(world, x, y, z);
    mobs.isRaining = () => weather.isRaining();
    mobs.shoot = (e, target, scale) => arrows.skeletonShoot(e, target, scale, mobs.difficulty);
    // EntityWitch splash potions (witch-potions.js); EntityWorld.tick advances them.
    mobs.potions = new WitchPotions(mobs);
    mobs.riderLook = () => ({ yaw: Math.fround(180 - (yaw * 180) / Math.PI), pitch: Math.fround((-pitch * 180) / Math.PI) }); // the local player's look, which the ridden horse's client copy turns to (horse-copy.js)
    mobs.explodeInline = (ev) => explodeEvent(ev, explodeAt); // a creeper explodes inside its own update (entities.js)
    mobs.walks = entityWalkers(() => entityTick ?? { state: { items, arrows, projectiles, primed, xpOrbs, falling, world, position }, hooks: {} }); // arrows, thrown entities, items, orbs, TNT and falling blocks tick in the one list walk
    mobs.spawnLoot = (events) => spawnLoot({ xpOrbs, items }, events); // a death's drops and orbs join the list in the dying entity's own turn (entities.js flushLoot)
    mobs.ignite = (x, y, z) => fire.ignite(x, y, z); // fireballs.js: a small fireball lights the cell beside the block it hit
    mobs.potions.load(record.thrownPotions);
    if (Array.isArray(record.fireballs) && record.fireballs.length) { mobs.fireballs.load(record.fireballs, world.dimension ?? 0); mobs.skulls.load(record.fireballs, world.dimension ?? 0); } // blaze/ghast fireballs and wither skulls in flight
    // World.rand for EntityLiving.onSpawnWithEgg, and World.func_147462_b at a block.
    mobs.worldRandom = weather.random;
    mobs.localDifficulty = (x, y, z) => localDifficulty(mobs.difficulty, survival.time, inhabited.value, (world.isLoaded(x,z) || !!mobs.ring?.holds(x,z)) && y >= 0 && y < world.height);
    // SpawnerAnimals (natural-spawning.md): the saved sky light, World.getBlockLightValue with skylightSubtracted 10 while
    // thundering and 0 (getFullBlockLightValue, animals), the weather and WorldInfo's spawn point (overworld only here).
    mobs.skyLightAt = (x, y, z) => (scene.light ? scene.light.skyAt(x, y, z) : 15);
    mobs.thunderLightAt = (x, y, z) => (scene.light ? scene.light.level(x, y, z, 10) : 15);
    mobs.fullLightAt = (x, y, z) => (scene.light ? scene.light.level(x, y, z, 0) : 15);
    mobs.isThundering = () => weather.isThundering();
    mobs.spawnPoint = () => spawnPointOf(active);
    mobs.loadTotalTime(record.totalTime ?? record.player?.time); // WorldInfo.getWorldTotalTime drives the 400-tick animal cadence
    mobs.naturalSpawning = true;
    // Headless terrain columns for the spawner's chunks beyond the resident window (headless-columns.js, natural-spawning.md).
    mobs.ring = createRing(world, { worker: !!streamPrefetch && !streamPrefetch.failed });
    if (streamPrefetch) streamPrefetch.ring = mobs.ring;
    mobs.lightSubtracted = () => scene.subtracted;
    if (mobs.ring) { // ring mobs tick and ring columns take edits (natural-spawning.md "Round 5")
      attachRing(world, mobs.ring);
      mobs.ring.isHydrated = (cx, cz) => !streamStorage || streamStorage.loaded.has(`${cx},${cz}`);
      if (streamStorage) streamStorage.margin = 7; // hydrate the stored edits of every ring column too
      wrapMobHooks(mobs, mobs.ring, () => scene.subtracted ?? 0);
      wrapRandomTickLight(world, mobs.ring, () => scene.subtracted ?? 0, trees, farming); // random ticks in ring chunks read RingLight (natural-spawning.md "Round 8")
    }
    arrows.wet = (a) => isWet(weather, world, { x: a.x, y: a.y, z: a.z, inWater: a.water }, 0.5);
    mobRenderer.clear();
    animation.reset();
    eating = null;
    stepDistance = 0;
    wasInWater = false;
    survival = new Survival(legacyPlayer(record), record.mode || "creative");
    statsLive.bind(survival);
    // Achievements belong to the world (a portal trip keeps them in memory); the hint waits for "Taking Inventory".
    if (achievementsFor !== (record.rootId ?? record.id)) { achievements.load(record.achievements); stats.load(record.stats); scoreboardFromJSON(scoreboard, record.scoreboard); scoreboardLive.respawn(); statsLive.attacker = null; achievementsFor = record.rootId ?? record.id; }
    achievementToast.clear();
    if (!achievements.has("openInventory")) achievementToast.hint(BY_ACHIEVEMENT.openInventory);
    containerResidency?.dispose();
    containerResidency=world.streaming&&!world.isDimension?new ContainerResidency(world,record.id,survival,{scope:record.containerScope,onError:e=>{pause();toast('Could not load saved containers. Reopen the world to retry: '+e.message);}}):null;
    survival.furnaceActive = key => !world.streaming || world.isTicking(...[key.split(",")[0],key.split(",")[2]].map(Number));
    survival.furnaceChanged = key => redstoneRuntime?.containerClosed([key]);
    genPrimed = []; // generated primed TNT handed over before the saved `primed` list is read below
    restorePopulation(record,world,survival,mobs);
    if (record.villages) mobs.villages.loadJSON(record.villages);
    materializeFresh();
    if (pendingBonusChests) { Object.assign(survival.chests, pendingBonusChests); pendingBonusChests = null; saved = false; } // placed at creation (openWorld), tile data handed over here
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
      (st) => survival.inventory.read(st, true), // a Count 0 drop is kept (EntityItem.readEntityFromNBT)
      survival.time,
    );
    projectiles.load(record.projectiles);
    eyes.load(record.eyes);
    maps.load(record.maps);
    rockets.load(record.rockets);
    fishing.load(record.fishing);
    objectTracker = new ObjectTracker(10, Math.random, entityIds); // a fresh client world: nothing is tracked yet
    bindObjectTracker();
    primed = watchJoin((Array.isArray(record.tnt) ? record.tnt : []).filter((t) => t && [t.x, t.y, t.z, t.vx, t.vy, t.vz, t.fuse].every(Number.isFinite)).map((t) => Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse }), { vx: t.vx, vy: t.vy, vz: t.vz })), joinedAs("tnt"));
    if (genPrimed) { primed.push(...genPrimed); genPrimed = null; }
    tntRenderer?.clear();
    arrows.load(record.arrows);
    restoreSavedOrder(mobs, orderGroups({ mobs, items, xpOrbs, primed, arrows, projectiles, falling, minecarts, boats, hanging, rockets }, record)); // b52so: the saved list order
    scene.setArrows(objectViews(objectTracker, arrows.list, "arrow"));
    velocity.set(0, 0, 0);
    flying = record.flying === true && survival.creative; // level.dat abilities.flying (import)
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
    performance.mark?.('trip:runtimes');
    const warmed = slice ? scene.warmShaders() : null; // the End's sky and portal programs link here, behind the loading screen, while the workers mesh
    if (slice) await scene.buildPendingAsync(yieldTask); // column meshes in the worker pool (the page thread when there is none)
    await warmed;
    if (slice) { // the random-tick refcounts of the resident columns (WorldChunk.sectionTickCount, built on first use) are counted here, in slices, instead of in the first tick
      const cols = [...world.chunks.values()];
      for (let i = 0; i < cols.length;) { const end = performance.now() + 8; while (i < cols.length && performance.now() < end) cols[i++].sectionTickCount?.(0); await yieldTask(); }
    }
    performance.mark?.('trip:built');
    screen = "playing";
    gui.hide();
    $("#hud").classList.remove("hidden");
    $("#vignette").classList.add("in-game");
    $("#world-label").textContent = record.name;
    $("#save-label").textContent = record.remote ? 'Connected to ledoge0' : 'Saved on this device';
    $("#mode-label").textContent = survival.mode.toUpperCase();
    $("#hud").classList.toggle("survival", !survival.creative);
    closeModal();
    renderHotbar();
    renderVitals();
    save();
    scene.setTime(survival.time);
    scene.camera.position.copy(position);scene.camera.position.y+=PHYSICS.eye;scene.camera.rotation.set(pitch,yaw,0,"YXZ");
    restoreSleep(record.bed);
    if (record.wakeFromBed) { // imported level.dat player saved Sleeping: woken at once, standing beside the bed (bed.js)
      const feet = wakeSavedSleeper(world, record.wakeFromBed);
      if (feet) { position.set(feet.x, feet.y, feet.z); previous.copy(position); playerBody.reset(position, yaw, pitch); }
      delete record.wakeFromBed;
    }
    if (survival.health <= 0) die();
    else {
      requestLock();
    }
  } catch (e) {
    console.error(e);
    toast("Could not open this world: " + e.message);
  }
}
// ---- Chat and commands (chat-ui.js GuiChat/GuiNewChat, commands.js ServerCommandManager, command-host.js game state) ----
let chatOpen = false;
// /debug's Profiler (profiler.js) over the tick loop below, and the tick counter (MinecraftServer.getTickCounter) it reports.
const profiler = new Profiler();
// F3 debug screen (debug-overlay.js): the Shift+F3 pie reads a second Profiler over the frame; the tick phases feed both.
const clientProfiler = new Profiler(), debugOverlay = new DebugOverlay($("#debug"));
const tickProf = { start: (n) => { profiler.start(n); clientProfiler.start(n === "root" ? "tick" : n); }, endStart: (n) => { profiler.endStart(n); clientProfiler.endStart(n); }, end: () => { profiler.end(); clientProfiler.end(); } };
let debugChart = false, debugSection = "root", debugSecond = { at: 0, updates: 0, shown: 0 }, debugCache = { at: 0 };
let tickCounter = 0;
// The tooltip of a show_item hover: JsonToNBT, ItemStack.loadItemStackFromNBT, then the inventory tooltip's lines and colours.
const TIP_CODES = { aqua: "b", blue: "9", gray: "7", pink: "d", purple: "5", red: "c", yellow: "e", white: "f", bold: "l", italic: "o" };
const itemHoverLines = (snbt) => {
  let stack = null;
  try { const tag = parseJsonNbt(snbt); stack = tag?.type === NBT.COMPOUND ? itemStackFromNbt(tag.value) : null; } catch { stack = null; }
  if (!stack || !ITEMS[stack.id]) return null;
  return tooltipLines(ITEMS[stack.id], stack, options.advancedTooltips).map((l, i) => (l.color ?? (i ? "gray" : "white")).split(" ").map((c) => (TIP_CODES[c] ? "§" + TIP_CODES[c] : "")).join("") + (l.italic ? "§o" : "") + l.text);
};
const commandHost = createCommandHost({
  active: () => active, world: () => world, weather: () => weather, mobs: () => mobs, minecarts: () => minecarts, spawners: () => spawners, rockets: () => rockets, entityHosts: () => ({ items, xpOrbs, primed, falling, boats, projectiles, arrows, eyes, mobs, hanging, dimension: world.dimension ?? 0 }), survival: () => survival, experience: () => experience,
  position: () => ({ x: position.x, y: position.y, z: position.z }),
  storedTop: (x, z) => dims.storedTop({ id: rootIdOf(active) }, dimensionOf(active), x, z),
  seed: () => active.seed,
  scoreboard: () => scoreboard,
  beaconTile: (x, y, z) => beacons.ensure(x, y, z),
  commandTile: (x, y, z) => redstoneRuntime?.commandBlocks.tile(x, y, z),
  stackName: (s) => stackName(s, ITEMS) || ITEMS[s.id]?.name || "",
  giveDrop: (s, owner) => { const e = items.dropPlayer(s, position, yaw, pitch); if (e) { e.delay = 0; e.owner = owner; } },
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
  achievements: () => achievements,
  stats: () => stats,
  profiler,
  tickCounter: () => tickCounter,
  // CommandDebug writes debug/profile-results-*.txt; the browser offers the file as a download.
  saveFile: (name, text) => downloadBlob(new Blob([text], { type: "text/plain" }), name),
});
const commands = createCommandRunner(commandHost);
// NetHandlerPlayServer chat: single player is not exempt from the spam kick unless the owner may use commands (oi.g).
const chatSpam = new SpamCounter();
function chatSpamGate(text, deliver) {
  if (multiplayer) return deliver(text);
  const r = chatPacket(chatSpam, tickCounter, text, commandHost.cheats);
  if (r.deliver !== null) deliver(r.deliver);
  if (r.kick) { leaveToTitle(true); toast(r.kick); }
}
const chatUi = new ChatUi(document, {
  // ServerConfigurationManager prints "<Player> message"; a leading "/" runs the command.
  submit: (text) => chatSpamGate(text, (text) => { if (multiplayer) { if (text.startsWith('/')) printChat('Server commands are not available in this Creative milestone.'); else multiplayer.send({ type: 'chat', text }); } else if (text.startsWith("/")) commands.run(text); else printChat(chatTextComponent(scoreboard.formatName(PLAYER_NAME), text, PLAYER_NAME), 0, false); }),
  // GuiChat.func_146407_a: with chatLinksPrompt a GuiConfirmOpenLink asks first; Yes opens a new tab, and every choice returns to the chat.
  confirmLink: (url) => {
    const typed = chatUi.input.value;
    gui.show(menus.confirmOpenLink(url, (yes) => {
      if (yes) window.open(url, "_blank", "noopener");
      gui.hide();
      chatUi.input.value = typed;
      chatUi.input.focus();
    }));
  },
  openLink: (url) => window.open(url, "_blank", "noopener"),
  complete: (before) => commands.complete(before),
  // GuiScreen.func_146283_a: show_achievement and show_item hovers.
  hoverInfo: { stat: (id) => statHover(id, { itemName: (n) => commandHost.statItemName(n) }), item: itemHoverLines },
  close: () => closeChat(),
  stay: () => bedSleep.sleeping,
  visible: () => !!active && screen !== "home",
});
// GuiChat: no pause, but the pointer is released and the movement keys stop (the same state the sleep screen uses).
function openChat(prefill = "") {
  if (chatOpen || screen !== "playing" || gui.open || survival.health <= 0 || !chatCanOpen(options.chatVisibility)) return;
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
    bedButton.type = "button";
    // A GuiButton like the menus' (menu-screens.css .mc-button), labelled multiplayer.stopSleeping.
    bedButton.className = "mc-button";
    bedButton.setAttribute("aria-label", BED_TEXT.leave);
    bedButton.innerHTML = `<span class="mc-text mc-label" style="left:0;width:100%;text-align:center;top:calc(6*var(--u))">${textHtml(BED_TEXT.leave, null)}</span>`;
    // GuiSleepMP.initGui: a 200x20 button at (width / 2 - 100, height - 40), in GUI pixels. Centred with `left`, since
    // .mc-button (like the old .button) forces transform:none.
    bedButton.style.cssText = "position:fixed;box-sizing:border-box;left:calc(50% - 100*var(--u));bottom:calc(20*var(--u));width:calc(200*var(--u));height:calc(20*var(--u));--hw:100;z-index:31;display:none";
    bedButton.addEventListener("mousedown", (e) => e.preventDefault());
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
const SLEEP_EYE_RISE = 0.42 - 0.3; // orientCamera's sleeping offsets above posY
// Not native: 1.7.10 cuts straight to the lying view. Clicking a bed glides the camera there over BED_EASE_MS instead.
const BED_EASE_MS = 450;
let bedEase = null;
function enterSleep(ease = false) {
  bedEase = ease ? { position: scene.camera.position.clone(), quaternion: scene.camera.quaternion.clone(), start: performance.now() } : null;
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
  const boom = bedExplosion(world, x, y, z); // Nether/End: the bed explodes (dimension-live.js)
  if (boom) { for (const [bx, by, bz] of boom.cells) scene.updateBlock(bx, bz, by); if (boom.cells.length) explodeAt(boom.x, boom.y, boom.z, boom.size, { smoking: true, flaming: true }); return; }
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
  if (bedSleep.sleeping) { enterSleep(thirdPersonView === 0); saved = false; lastHealth = survival.health; }
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
function goHome() { leaveToTitle(true); }
function leaveToTitle(keep) {
  leaveMultiplayer();
  statsLive.leaveGame(); // ServerConfigurationManager.playerLoggedOut
  if (keep) save();
  lan.close();
  sounds.stopStreams(); // Minecraft.loadWorld(null): SoundHandler.stopSounds
  hideBedScreen();
  screen = "home";
  closeModal();
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("#hud").classList.add("hidden");
  $("#vignette").classList.remove("in-game");
  gui.show(menus.mainMenu());
}
function openHorse(e) { openContainer(new HorseContainer(survival.inventory, mobs.horseGear(e), () => { saved = false; }, e.customName), "horse", String(e.id)); containerView.horseMob = e; }
function inventory(station = false) {
  // EntityPlayerSP.func_110322_i: the inventory key while riding a saddled horse opens the horse's screen.
  const ridden = !station && riddenHorse(rider);
  if (ridden) { openHorse(ridden); return; }
  if (survival.creative && !station) {
    openCreative();
    return;
  }
  if (!station) achievements.trigger("openInventory");
  const container = station ? survival.openWorkbench() : survival.openInventory();
  container.onCraft = (stack, n) => { const id = craftedAchievement(stack?.id); if (id) achievements.trigger(id); statsLive.crafted(stack, n); };
  openContainer(container, station ? "workbench" : "inventory");
}
// GuiContainerCreative: tabs, the scrolling 9 x 5 item grid, search and the survival inventory tab.
function openCreative() {
  const gui = new CreativeScreen(survival.inventory, {
    playerContainer: () => survival.openInventory(),
    tooltip: (s) => tooltipLines(ITEMS[s.id], s, options.advancedTooltips).map((l) => l.text),
    tick: () => tickCounter,
  });
  openContainer(gui.container, "creative", null, gui);
}
function tabIcon(t) {
  const i = t.icon;
  if (i.id) return icon(i.id);
  if (i.potion) return `<span class="vanilla-item-icon tinted-item" style="--tint:#${i.potion.toString(16).padStart(6, "0")};--base:url('/media/1.7.10/items/potion_overlay.png')"><i></i><img src="/media/1.7.10/items/potion_bottle_drinkable.png" alt=""></span>`;
  if (i.frames) return compassIcon(); // the Search Items tab uses the same animated compass as the item
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
  drawLabel($("#modal-title"), selected.name);
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
const CONTAINER_TITLES = { inventory: "Inventory", workbench: "Crafting", furnace: "Furnace", creative: "", anvil: "Repair & Name", enchanting: "Enchant", merchant: "Villager", beacon: "Beacon" },
  CONTAINER_CLASSES = { furnace: "furnace-modal", chest: "chest-modal", dispenser: "dispenser-modal", horse: "horse-modal", brewing: "brewing-modal", hopper: "hopper-modal", creative: "creative-modal", anvil: "anvil-modal", enchanting: "enchanting-modal", merchant: "merchant-modal", beacon: "beacon-modal" };
// Slots are addressed by list index: wrapped creative slots all keep slotNumber 0.
// GuiContainer.drawScreen: .container-draw holds one .gui-slot per Slot (items, counts, quads from container-widgets.js slotDrawOps); the
// <button>s over it are transparent hit / focus targets that keep the aria-labels (the pointer hit test is GuiContainer.func_146981_a).
const slotsHtml = (container) => {
  const hide = (slot) => (slot.x < -1000 || slot.enabled === false ? " hidden" : ""), at = (slot) => `left:calc(${slot.x}*var(--u));top:calc(${slot.y}*var(--u))`;
  return `<div class="container-slots"><div class="container-draw" aria-hidden="true">${container.slots.map((slot, i) => `<div class="gui-slot" data-draw-slot="${i}"${hide(slot)} style="${at(slot)}"></div>`).join("")}</div>${container.slots.map((slot, i) => `<button class="container-slot" data-container-slot="${i}"${hide(slot)} style="${at(slot)}"></button>`).join("")}</div>`;
};
// GuiCommandBlock: Creative + command permission required; text and tracking changes are applied on Done only.
function openCommandBlock(x, y, z, cartTile = null) {
  if (!survival.creative || !commandHost.cheats) return;
  const tile = cartTile ?? redstoneRuntime.commandBlocks.tile(x, y, z);
  screen = "inventory"; mining = null; mineHeld = false;
  document.exitPointerLock?.();
  gui.show(commandBlockScreen({
    command: tile.command, lastOutput: tile.lastOutput, // bfh shows func_145749_h whatever TrackOutput says
    done: (command) => { tile.command = command; if ("watch24" in tile) tile.watch24 = tile.lastOutput ?? "null"; /* MC|AdvCdm: setCommand then func_145756_e (nh, bytecode-read) */ saved = false; resume(); },
    cancel: resume,
  }));
}
function openContainer(container, kind, key = null, gui = new ContainerScreen(container)) {
  screen = "inventory";
  mining = null;
  mineHeld = false;
  const decorations =
    kind === "enchanting"
      ? enchantDecorationsHtml()
      : kind === "beacon"
      ? beaconDecorationsHtml()
      : kind === "merchant"
      ? merchantDecorationsHtml()
      : kind === "anvil"
      ? anvilDecorationsHtml()
      : kind === "brewing"
      ? '<i class="brewing-bubbles" id="brewing-bubbles"></i><i class="brewing-arrow" id="brewing-arrow"></i>'
      : kind === "furnace"
      ? '<i class="furnace-flame" id="furnace-flame"></i><i class="furnace-arrow" id="furnace-arrow"></i>'
      : kind === "horse"
      ? `${container.horse.chested ? '<i class="horse-chest-bg"></i>' : ""}${horseWearsArmor(container.horse.type) ? '<i class="horse-armor-bg"></i>' : ""}`
      : kind === "chest" || kind === "dispenser" || kind === "hopper"
        ? '<i class="chest-bottom" aria-hidden="true"></i>'
        : "";
  // GuiContainer shell (container-screens.js): drawDefaultBackground gradient, panel at guiLeft / guiTop, glyph labels, no title bar or close button.
  const shellTitle = kind === "inventory" || kind === "workbench" ? containerTitle("Crafting") : kind === "creative" ? "" : containerTitle(container.title ?? CONTAINER_TITLES[kind]);
  containerShell(
    kind,
    kind === "creative" ? '<div class="creative-body"></div>' : slotsHtml(container) + decorations,
    CONTAINER_CLASSES[kind] ? `${CONTAINER_CLASSES[kind]} container-screen` : "inventory-modal native-inventory container-screen" + (kind === "workbench" ? " native-workbench" : ""),
    { title: shellTitle, inventory: containerTitle("Inventory"), rows: container.rows },
  );
  if (kind === "inventory") $("#modal .container-screen")?.insertAdjacentHTML("beforeend", '<div class="effect-list" id="effect-list"></div>');
  attachPaperdoll(kind === "inventory" ? "inventory" : null);
  attachHorsePreview(kind === "horse" ? container.horse : null);
  if (kind === "chest") $("#modal .modal").style.setProperty("--rows", container.rows);
  $("#modal").insertAdjacentHTML("beforeend", '<div class="cursor-stack" id="cursor-stack" aria-hidden="true"></div><div class="slot-tooltip hidden" id="slot-tooltip" role="tooltip"></div>');
  drawLabels($("#modal")); // titles and the "Inventory" label in FontRenderer glyphs, 0x404040 without a shadow
  if (kind === "beacon") drawBeaconLabels($("#modal"));
  document.activeElement?.blur();
  containerView = { container, gui, kind, key, hovered: null, x: innerWidth / 2, y: innerHeight / 2, gx: -1, gy: -1, shown: [] };
  enchantExtras?.dispose();
  enchantExtras = kind === "enchanting" ? new EnchantingScreenExtras(document.querySelector("#modal .enchanting-modal"), (canvas) => new EnchantingGuiBookView(canvas)) : null;
  const creative = kind === "creative",
    overlay = $("#modal"),
    javaButton = (b) => (b === 2 ? 1 : b === 1 ? 2 : b),
    // Pointer position in GUI pixels; creative tabs lie outside the 195 x 136 screen.
    at = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY),
        box = $("#modal .container-screen").getBoundingClientRect(),
        u = box.width / (creative ? GUI_WIDTH : kind === "beacon" ? 230 : 176),
        x = Math.floor((e.clientX - box.left) / u),
        y = Math.floor((e.clientY - box.top) / u);
      return { slot: slotAt(container.slots, x, y), outside: creative ? x < 0 || y < 0 || e.clientX >= box.right || e.clientY >= box.bottom : !el?.closest(".container-screen"), x, y };
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
    const beaconButton = e.target.closest("[data-beacon]");
    if (beaconButton) { e.preventDefault(); beaconClick(beaconButton); return; }
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
    if (e.target.closest('#anvil-name') || e.target.closest("[data-enchant-option]") || e.target.closest("[data-merchant-step]") || e.target.closest("[data-beacon]")) return;
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
// GuiScreenHorseInventory draws the horse through func_147046_a (horse-preview.js).
let horsePreview = null;
function attachHorsePreview(horse) {
  const slots = $("#modal .container-screen .container-slots");
  if (!horse || !slots || !scene) return horsePreview?.detach();
  horsePreview ??= new HorsePreviewView(scene);
  horsePreview.attach(slots.parentNode, slots, horse);
}
function horsePreviewFrame() {
  const box = $("#modal .container-screen")?.getBoundingClientRect();
  if (!horsePreview?.mounted || !box || !containerView) return;
  const unit = box.width / HORSE_PREVIEW_LAYOUT.width;
  horsePreview.frame(Math.floor((containerView.x - box.left) / unit), Math.floor((containerView.y - box.top) / unit), unit);
}
function closeContainer() {
  paperdoll?.detach();
  horsePreview?.detach();
  enchantExtras?.dispose();
  enchantExtras = null;
  if (!containerView) return;
  const { container, kind, key, remote } = containerView;
  containerView = null;
  remote?.client.closeWindow(); // C0D
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
    preview = gui.preview();
  if (view.kind === "anvil") refreshAnvil($("#modal"), container, anvilCost(container)); // GuiRepair glyph field, cost line, cross
  if (view.kind === "beacon") refreshBeacon(view);
  if (view.kind === "merchant") renderMerchantView(view);
  if (view.kind === "enchanting") {
    const levels = container.levels, shelves = `Bookshelves: ${container.bookshelves}`;
    refreshEnchantOptions($("#modal"), levels, { xpLevel: container.experienceLevel(), creative: container.creative(), mouseX: view.gx, mouseY: view.gy });
    if ($("#enchant-shelves").textContent !== shelves) $("#enchant-shelves").textContent = shelves;
    enchantExtras?.names(container);
  }
  let contentChanged = false;
  container.slots.forEach((slot, i) => {
    const b = document.querySelector(`[data-container-slot="${i}"]`), d = document.querySelector(`[data-draw-slot="${i}"]`);
    if (!b || !d) return;
    const ops = slotDrawOps(slot, { gui, preview, hovered: view.hovered }),
      part = (o) => o.kind === "stack" ? `s${o.stack.id},${o.stack.count},${o.stack.damage},${o.stack.color},${o.capped},${stackHasEffect(o.stack, ITEMS[o.stack.id])}` : o.kind === "icon" ? "i" + o.name : "r" + o.z,
      key = ops.map(part).join("|"), content = ops.filter((o) => o.kind === "stack").map(part).join("");
    const label = stackLabel(slot.stack);
    if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
    if (view.shown[i] === key) return;
    view.shown[i] = key;
    if ((view.contents ??= [])[i] !== content) { view.contents[i] = content; contentChanged = true; } // a quad alone is not a content change
    d.innerHTML = slotDrawHtml(ops, (stack, capped) => stackHtml(stack));
    for (const c of d.querySelectorAll(".item-count")) c.classList.toggle("full", ops.some((o) => o.kind === "stack" && o.capped));
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
  if (view.kind === "beacon" && !lines.length) { const text = beaconTooltip(view.gx, view.gy, { levels: container.tile.levels, primary: view.pick?.primary }); if (text) lines = [{ text }]; }
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
    const tipped = tooltipHtml(lines); // 1.7.10 FontRenderer glyphs (bitmap-text.js), box width = widest getStringWidth
    if (tip.dataset.html !== tipped.html) { tip.dataset.html = tipped.html; tip.innerHTML = tipped.html; }
    tip.style.setProperty("--tw", tipped.width);
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
  const jump=jumpBar(rider);$('#jump-hud').classList.toggle('hidden',!jump.visible);$('#jump-fill').style.width=jump.width/182*100+'%';
  $('#experience-hud').classList.toggle('hidden',survival.creative||jump.visible);{const lv=$('#experience-level'),k=String(experience.level||'');if(lv.dataset.lv!==k+font.version){lv.dataset.lv=k+font.version;lv.innerHTML=xpLevelHtml(experience.level);}}$('#experience-fill').style.width=(experience.progress*100)+'%';$('#experience-hud').setAttribute('aria-label',`Experience level ${experience.level}, ${experience.points} of ${experience.level>=30?62+(experience.level-30)*7:experience.level>=15?17+(experience.level-15)*3:17} points`);
  $("#survival-hud").classList.toggle("hidden", survival.creative);
  if (survival.creative) return;
  // GuiIngame.renderPlayerStats (damage-hud.js): the hurt blink, low-health jiggle, regeneration wave, Absorption and hunger shake.
  const vitals = vitalsLayout({ health: survival.health, maxHealth: survival.maxHealth, absorption: survival.absorption || 0, hurtResistantTime: survival.clientResist, updateCounter: survival.ticks, poison: survival.effects.has(POISON), wither: survival.effects.has(WITHER_EFFECT), regeneration: survival.effects.has(REGENERATION), food: survival.food, saturation: survival.saturation, hunger: survival.effects.has(HUNGER), hardcore: active?.hardcore === true }),
    hearts = heartsHtml(vitals.hearts),
    food = foodHtml(vitals.food),
    // GuiIngame: armor points above the hearts; air bubbles above hunger, with one popping.
    armor = survival.armorValue,
    armorRow = armor > 0 ? `<div class="armor-row" style="--lift:${vitals.lift}" aria-label="Armor ${armor} of 20">${Array.from({ length: 10 }, (_, i) => `<span class="${i * 2 + 1 < armor ? "full" : i * 2 + 1 === armor ? "half" : "empty"}"></span>`).join("")}</div>` : "",
    bubbles = Math.max(0, Math.ceil(((survival.air - 2) * 10) / 300)),
    popping = Math.max(0, Math.ceil((survival.air * 10) / 300) - bubbles),
    air = survival.air < 300 ? `<div class="air" style="--lift:${vitals.lift}" aria-label="Air ${Math.max(0, survival.air)} of 300">${"<span></span>".repeat(bubbles)}${'<span class="pop"></span>'.repeat(popping)}</div>` : "";
  // GuiIngame: the food row is drawn only on foot; a living mount (pig, horse) shows its own hearts there, a cart or boat nothing.
  const mount = rider.vehicle ? rider.vehicle.entity ?? null : undefined,
    mountMax = mount ? (ENTITY_TYPES[mount.type] ? maxHealthOf(mount, mount.horse?.maxHealth ?? ENTITY_TYPES[mount.type].health) : null) ?? 20 : 0,
    foodRow = mount === undefined
      ? `<div class="hunger${survival.effects.has(HUNGER) ? ' afflicted' : ''}" aria-label="Hunger ${survival.food} of 20${survival.effects.has(HUNGER) ? ', Hunger effect' : ''}">${food}</div>`
      : mount ? `<div class="mount-hearts" aria-label="Mount health ${Math.ceil(mount.health)} of ${mountMax}">${mountHeartsHtml(mountHeartLayout({ health: mount.health, maxHealth: mountMax }))}</div>` : '<div class="mount-hearts"></div>';
  $("#survival-hud").innerHTML =
    `<div class="vital-row"><div class="hearts${survival.effects.has(POISON) ? ' poisoned' : ''}" aria-label="Health ${Math.ceil(survival.health)} of 20${survival.effects.has(POISON) ? ', Poison' : ''}">${hearts}</div>${foodRow}</div>${armorRow}${air}`;
}
// EntityPlayer.dropOneItem / closing a screen with held items: thrown along
// the view with a 40-tick pickup delay.
function throwStacks(stacks) {
  if (!world) return;
  for (const s of stacks) if (s?.count) items.dropPlayer(copyStack(s), position, yaw, pitch); // func_146097_a refuses only an exact size 0
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
  for (const step of document.querySelectorAll("[data-merchant-step]")) {
    // GuiMerchant.MerchantButton.drawButton: the sprite column follows enabled + the Gui hit test on the pointer (view.gx / gy), not :hover.
    const next = +step.dataset.merchantStep > 0, enabled = next ? info.next : info.previous, d = merchantArrowDraw(next ? "next" : "previous", { enabled, mouseX: view.gx, mouseY: view.gy });
    step.disabled = !enabled;
    step.dataset.hover = String(d.hover);
    step.style.setProperty("background-position", `calc(${-d.u}*var(--u)) calc(${-d.v}*var(--u))`, "important");
  }
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
// BlockBeacon.onBlockActivated: ContainerBeacon over the tile; picks are local until Confirm (MC|Beacon, pyramid-gui.js).
function useBeacon(key) {
  const [x, y, z] = key.split(",").map(Number), tile = beacons.ensure(x, y, z);
  openContainer(new BeaconContainer({ inventory: survival.inventory, tile, onConfirm: () => { saved = false; } }), "beacon", key);
  containerView.pick = { primary: tile.primary, secondary: tile.secondary };
  refreshBeacon(containerView);
}
function refreshBeacon(view) {
  const tile = view.container.tile, pick = view.pick ??= { primary: tile.primary, secondary: tile.secondary }, payment = !!view.container.payment;
  const remote = view.remote, pay = view.container.payment?.id ?? null;
  if (remote && remote.sent !== pay) { remote.sent = pay; remote.client.setBeaconPayment(view.container.payment); } // a click on the window's slot 0
  const html = beaconUiHtml({ levels: tile.levels, ...pick, payment, icon: (id) => stackHtml({ id, count: 1, damage: 0 }), mouseX: view.gx, mouseY: view.gy }) /* renderItemAndEffectIntoGUI only: no count */, ui = $("#beacon-ui");
  if (ui && ui.dataset.shown !== html) { ui.dataset.shown = html; ui.innerHTML = html; }
}
function beaconClick(button) {
  const view = containerView, tile = view.container.tile, pick = view.pick, kind = button.dataset.beacon;
  if (kind === "cancel") return resume();
  if (button.getAttribute("aria-disabled") === "true") return;
  if (kind === "confirm") {
    if (view.remote && view.container.payment && pick.primary > 0) { view.remote.client.chooseBeacon(view.remote.x, view.remote.y, view.remote.z, pick.primary, pick.secondary); view.container.pay.stacks[0] = null; tile.payment = null; view.remote.sent = null; sounds?.play("gui.button.press", { volume: 0.25, pitch: 1 }); resume(); return; } // MC|Beacon: the server validates and applies; its S35 follows
    if (view.remote) return;
    if (view.container.payment && pick.primary > 0 && view.container.confirm(pick.primary, pick.secondary)) { sounds?.play("gui.button.press", { volume: 0.25, pitch: 1 }); resume(); } return; }
  const id = +button.dataset.id;
  if (+button.dataset.tier < 3) pick.primary = validPrimary(tile.levels, id) || pick.primary; else pick.secondary = validSecondary(tile.levels, id) || pick.secondary;
  refreshBeacon(view);
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
  const smeltedId = smeltedAchievement(stack?.id);
  if (smeltedId) achievements.trigger(smeltedId);
  statsLive.crafted(stack, amount); // SlotFurnace.onCrafting
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
  if (containerView?.kind === "hopper" && containerView.key && world.get(...containerView.key.split(",").map(Number)) !== HOPPER) resume();
  if (containerView?.kind === "brewing" && world.get(...containerView.key.split(",").map(Number)) !== BREWING_STAND) resume();
  if (containerView?.kind === "horse") { const m = containerView.horseMob; if (!m || !horseReach(m.health > 0 && mobs.entities.includes(m), Math.hypot(m.x - position.x, m.y - position.y, m.z - position.z))) resume(); }
  if (containerView?.kind === "dispenser" && ![DISPENSER, DROPPER].includes(world.get(...containerView.key.split(",").map(Number)))) resume();
  if (containerView?.kind === "chest" && containerView.container.keys?.some((k) => { const b = world.get(...k.split(",").map(Number)); return !isChestBlock(b) && b !== ENDER_CHEST; })) resume();
  if (containerView?.kind === "enchanting") {
    // ContainerEnchantment.canInteractWith: the table must still exist and be within 8 blocks.
    const [x, y, z] = containerView.key.split(",").map(Number);
    if (world.get(x, y, z) !== ENCHANTING_TABLE || !withinEnchantReach(position, x, y, z)) resume();
  }
  if (containerView?.kind === "beacon") { // ContainerBeacon.canInteractWith: the block must remain within 8 blocks
    const [x, y, z] = containerView.key.split(",").map(Number);
    if (world.get(x, y, z) !== BEACON || (position.x - x - .5) ** 2 + (position.y - y - .5) ** 2 + (position.z - z - .5) ** 2 > 64) resume();
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
  statsLive.death();
  // EntityPlayerMP.onDeath broadcasts the death message to chat at the moment of death.
  const message = survival.died && deathComponent(survival.combat, scoreboard.formatName(PLAYER_NAME), { selfItem: survival.held?.displayName, selfStack: survival.held }); // CombatTracker.func_151521_b; EntityPlayer.func_145748_c_: the team-formatted name, one component per argument (team-names.js)
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
  gameOverScore = deathScore;
  showGameOver();
}
// GuiGameOver (modal-dialogs.js): the death screen and its GuiYesNo quit question are Gui screens, not DOM dialogs.
let gameOverScore = 0;
function showGameOver() {
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  const hardcore = active?.hardcore === true;
  gui.show(gameOverScreen({
    hardcore, score: gameOverScore, show: (s) => gui.show(s), again: showGameOver, isDead: () => screen === "dead",
    respawn: respawnPlayer,
    leave: () => leaveToTitle(true),
    // GuiGameOver.confirmClicked(false): Respawn. In a hardcore world the server kicks the player and deletes the world
    // (NetHandlerPlayServer.processClientStatus).
    confirmNo: hardcore ? async () => { const record = active; leaveToTitle(false); await deleteWorld(record); toast(HARDCORE_KICK); } : respawnPlayer,
  }));
}
async function respawnPlayer() {
    if (dimensionOf(active)) { // died in the Nether/End: back to the Overworld, then the usual respawn below
      if (await dims.leaveByDeath()) await respawnPlayer();
      return;
    }
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
    scoreboardLive.respawn(); // the new EntityPlayerMP re-sends its health criteria
    mobs?.playerJoined?.(true); // the new EntityPlayerMP takes a new entity id and joins the end of loadedEntityList (tracker-joint2-b53.test.js)
    survival = new Survival({ time, slots: [], ...kept, furnaces: survival.furnaces, chests: survival.chests, dispensers: survival.dispensers, hoppers: survival.hoppers, brewing: survival.brewing }, survival.mode);
    statsLive.bind(survival);
    portalTimer.reset();
    dims.restorePlayer({});
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
}
// One weather tick: timers, lightning (flash, damage, sound) and the client's rain
// splashes and rain sound (see weather.js).
const sceneLight = { skyAt: (x, y, z) => (world.ringSink?.outside(x, z) ? world.ringSink.light.skyAt(x, y, z) : scene.light?.skyAt(x, y, z) ?? 15), blockAt: (x, y, z) => (world.ringSink?.outside(x, z) ? world.ringSink.light.blockAt(x, y, z) : scene.light?.blockAt(x, y, z) ?? 0) }; // ring cells read RingLight (the mood roll of a ring chunk draws but cannot be heard)
function tickWeather() {
  if (weather.mood) weather.mood.light ??= moodLight(world, sceneLight);
  if (world.dimension) {
    // The Nether and the End have no weather (World.updateWeatherBody skips provider.hasNoSky), but WorldServer's chunk loop runs there
    // unchanged: mood sound, the lightning/ice rolls and the random block ticks (natural-spawning.md "Round 9").
    if (!weather.mood) return;
    weather.tickDimension(world, position);
    for (const e of weather.drain()) sounds.play(e.sound, { volume: e.volume, pitch: e.pitch, position: { x: e.x, y: e.y, z: e.z } });
    return;
  }
  tickWeatherSimulation({ world, weather, mobs, survival }, position, PHYSICS.width, PHYSICS.height);
  weather.rainParticles(world, { x: position.x, y: position.y + PHYSICS.eye, z: position.z }, (kind, x, y, z) => scene.fx.addDirect(kind, x, y, z));
  for (const e of weather.drain()) {
    // Thunder is volume 10000 in vanilla: gain 1, and a LINEAR distance of 160000 blocks (SoundManager.playSound), so the
    // falloff is nil in range but it still pans. The rain loop and the explosion are placed where they happen.
    sounds.play(e.sound, { volume: e.volume, pitch: e.pitch, position: { x: e.x, y: e.y, z: e.z } });
  }
}
// EntityPlayerSP.timeInPortal: Nausea longer than 60 ticks winds the screen warp up (potion-fx.js).
const portalTimer = new PortalTimer();
const dims = new DimensionLive({
  active: () => active, worlds: () => worlds, save: () => save(), openWorld, dirty: () => { saved = false; },
  // Away run (away-world.js): copies of the resident columns, the physics tick counter, and the clock ticks a loading screen skipped.
  ticks: () => tickCounter,
  totalTime: () => mobs?.saveTotalTime(), // WorldInfo.getWorldTotalTime, the Teleporter cache clock (dimension-live.js clock)
  difficulty: () => worldDifficulty(active, options.difficulty),
  // A column outside the streamed window comes from the headless ring (headless-columns.js, 21 x 21 chunks around the player) when it holds it; any other column is not copied.
  chunks: (cols) => cols.flatMap(([x, z]) => { const c = world.chunks?.get(`${x},${z}`); if (c) return [{ x, z, blocks: c.blocks.slice(), meta: c.meta.slice() }]; const r = world.ringSink?.column?.(x, z); return r ? [{ x, z, ...fullColumn(r, world.height) }] : []; }),
  entityIds, // the shared Entity.nextEntityID: finishAway hands the away run its start (plan.idBase)
  advanceTicks: (n) => advanceWorldClock({ mobs, weather, survival, scene }, n), // WorldInfo total time too: the server ticks through loading screens (dimension-live.js clock)
  // Command blocks that ran while away (away-commands.js): /time shifts the clock, /weather the Overworld's timers, rules, and the chat lines they printed.
  // The player as he returns: the away run's shadow player starts from it (the queued commands then advance it in firing order).
  awayPlayer: () => { const sp = JSON.parse(JSON.stringify(survival.serialize())); for (const k of TILE_KEYS) delete sp[k]; return { state: sp, experience: experience.serialize(), mode: survival.mode === "creative" ? 1 : survival.mode === "adventure" ? 2 : 0, level: experience.level }; },
  awayResult: (r, root) => { if (r.difficulty !== undefined) commandHost.setDifficulty(r.difficulty); if (r.timeShift && !survival.timeFrozen) survival.time += r.timeShift; if (r.weather) weather.overworld?.restore(r.weather); if (r.world) Object.assign(active, r.world); for (const l of r.chat ?? []) printChat(l);
    // Batch 34: the commands that act on the player, queued by the run in firing order, through the live command host (/give goes straight into the inventory).
    if (r.playerCommands?.length) r.stats.commands.replayed = replayPlayerCommands(r.playerCommands, { host: commandHost, records: root?.commandBlocks, carts: root?.minecarts?.carts, delta: r.inventoryDelta, inventory: survival.inventory, playerDelta: r.playerDelta, xpOps: r.xpOps, survival, death: !!r.playerDeath, giveStack: (s) => { survival.inventory.add(s); if (s.count > 0) items.dropPlayer(s, position, yaw, pitch); renderHotbar(); renderVitals(); saved = false; } });
    // Batch 43 (away-death.js): the shadow died. Its drops went to the dimension he died in (finishAway); here the live player loses the inventory and experience they stood for and dies
    // through the usual path (death screen on the Overworld, message, respawn), so die() drops nothing.
    if (r.deathPlaced) { if (!r.deathPlaced.keepInventory) { survival.inventory.takeAll(); experience.death(); } survival.hurtTicks = 0; survival.protection = 0; if (!survival.damage(survival.health + 1, r.deathPlaced.cause) && survival.health > 0 && !survival.creative) { survival.health = 0; survival.lastDamage = r.deathPlaced.cause; survival.died = true; } r.stats.commands.death = r.deathPlaced; renderHotbar(); renderVitals(); }
    // The return builds the Overworld record from `root`, whose player state is the departure's: carry what the replay changed (the tile maps in root.player are the Overworld's own).
    if (r.stats.commands.replayed?.applied || r.deathPlaced) { const sp = survival.serialize(); root.player = { ...(root.player ?? {}) }; for (const k of Object.keys(sp)) if (!TILE_KEYS.includes(k)) root.player[k] = sp[k]; root.experience = experience.serialize(); root.mode = survival.mode; root.achievements = achievements.save(); root.stats = stats.save(); } },
  player: () => ({ x: position.x, y: position.y, z: position.z, yaw }),
  sound: (n, o) => sounds.play(n, o),
  showCredits: async () => {
    screen = "credits";
    keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    await showEndCredits();
    screen = "playing";
  },
});
// First entry to the End (dimension-live.js): ChunkProviderEnd's dragon, spawned once the new world's mobs exist (launch).
let pendingDragon = false;
dims.onDragonSpawn = () => { pendingDragon = true; };
// Per-tick achievement observers: the biome set (every 20 ticks), minecart distance and a beacon reaching level 4.
function watchAchievements() {
  if (achievementTicks++ % 20 === 0) achievements.visit(world.biomeAt?.(Math.floor(position.x), Math.floor(position.z))?.name, 0);
  const cart = rider.vehicle;
  if (cart && !cart.boat && !cart.horse) achievements.rideMinecart(position.x, position.y, position.z); else achievements.stopRiding();
  for (const [key, tile] of beacons.tiles) {
    const [bx, by, bz] = key.split(",").map(Number);
    const near = position.x >= bx - 10 && position.x <= bx + 11 && position.y >= by - 5 && position.y <= by + 6 && position.z >= bz - 10 && position.z <= bz + 11;
    achievements.beacon(key, tile.levels | 0, near);
  }
}
// Entity.moveEntity: playSoundAtEntity(random.fizz, 0.7, 1.6 + (r - r) * 0.4) at the player (fire-fx.js entityFizz).
function playerFizz() { const s = entityFizz(Math.random); sounds.play(s.name, { volume: s.volume, pitch: s.pitch, position: { x: position.x, y: position.y, z: position.z } }); }
// The landing hooks of player-environment.js landPlayer (the tick's landing and a piston push's).
function playerLanding() {
  return {
    trample: trampleFarmland,
    fallSound: (s) => sounds?.play(s.name, { volume: s.volume, pitch: s.pitch }),
    landingDust: (x, y, z, count) => scene.particles.landingDust(world, x, y, z, count, [position.x, position.y + PHYSICS.eye, position.z]),
  };
}
function tickSurvival(inWater, oldPosition, inLavaNow = false) {
  // Game rules the Survival object reads (gamerule naturalRegeneration / doDaylightCycle).
  survival.naturalRegeneration = ruleOn(active, "naturalRegeneration");
  survival.timeFrozen = !ruleOn(active, "doDaylightCycle");
  // Nether/End portals (BlockPortal / BlockEndPortal collision, Entity.onEntityUpdate) and the overlay + sounds.
  const inPortalNow = dims.tick(world, oldPosition, position, { creative: survival.creative, riding: !!rider.vehicle, alive: survival.health > 0 });
  portalTimer.tick(survival.effects.get(NAUSEA)?.duration ?? 0, inPortalNow);
  dims.portalFrame(portalTimer, inPortalNow);
  tickPlayerEnvironment({ world, weather, position, survival, motion, flying, sleeping: bedSleep.sleeping }, { inWater, inLavaNow }, {
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
    fizz: playerFizz,
  });
  // Scheduled sand and gravel updates and the falling-block entities (WorldServer.tick).
  if (falling) {
    foreignTicks?.tick(mobs?.saveTotalTime());
    falling.tick({ entities: !isWalked(mobs) }); // walked: the entity updates run in EntityWorld.tickMobs's list walk
    world.redstoneBlocks?.tick();
    scene.setFalling?.(objectViews(objectTracker, falling.entities, "falling"));
  }
  // WorldClient.doVoidFogParticles: Block.randomDisplayTick around the viewer (torch and
  // furnace flames, fire smoke and crackle, water and lava particles, sounds and drips).
  displayTicks(world, Math.floor(position.x), Math.floor(position.y + PHYSICS.eye), Math.floor(position.z), {
    rand: scene.explosionParticles.worldRandom,
    fx: scene.fx,
    voidFog: hasVoidParticles({ worldType: world.worldType, dimension: world.dimension || 0 }),
    canStrike: (x, y, z) => canLightningStrikeAt(weather, world, x, y, z),
    lit: (x, y, z) => scene.litFurnaces.has(`${x},${y},${z}`),
    repeaterLit: (x, y, z) => redstoneRuntime?.redstone?.lit?.has(`${x},${y},${z}`) === true,
    sound: (name, x, y, z, volume, pitch) => sounds.play(name, { volume, pitch, position: { x, y, z } }),
  });
  // MobSpawnerBaseLogic.updateSpawner on the client: smoke and flame, the display mob's spin.
  tickSpawnersClient({ spawners, minecarts, random: scene.explosionParticles.worldRandom, eye: { x: position.x, y: position.y + Math.fround(PHYSICS.eye), z: position.z } },
    { particle: (name, x, y, z) => scene.fx.spawn(name, x, y, z) });
  if (grounded) addFallStat(stats, landedFall, survival.creative); // EntityPlayer.fall
  const movement = { world, position, survival, motion, grounded, fallDistance, landedFall };
  finishPlayerMovement(movement, { inWater, inLavaNow, oldPosition }, playerLanding());
  ({ fallDistance, landedFall } = movement);
  tickBeacons(beacons, { world, time: survival.time, players: [{ x: position.x, y: position.y, z: position.z, width: PHYSICS.width, height: PHYSICS.height }], apply: (_p, e) => survival.effects.add(e) });
  watchAchievements();
  scoreboardLive.tick(survival.health, survival.absorption || 0); // EntityPlayerMP.onUpdate: health criteria
  statsLive.tick({ oldPosition, position, vehicle: rider.vehicle, eyeInWater: clientEyeInWater(), inWater, onLadder: !flying && countsVertical(world, position.x, position.y, position.z), grounded });
  fireworkFx.viewer = [position.x, position.y + PHYSICS.eye, position.z];
  eyes.tick({ particle: (name, x, y, z, vx, vy, vz) => scene.fx.spawn(name, x, y, z, vx, vy, vz), drop: (stack, x, y, z) => items.spawn(stack, x, y, z) });
  const facing = mcYaw(yaw);
  maps.tick({ survival, position, yaw: facing, world, time: survival.time, frames: hanging.entities });
  if (compassEpoch !== spriteEpoch()) { compassEpoch = spriteEpoch(); Object.assign(compass, createCompass()); } // new sprite after a pack with another strip
  const previousCompassFrame = compass.frame, compassFrames = compassFrameCount();
  setCompassWorld(active.worldSpawn, !world.dimension); // item frames read it (hanging-renderer.js)
  const frame = tickCompass(compass, compassAngle(position, Math.fround(facing), active.worldSpawn, !world.dimension), compassFrames);
  if (frame !== previousCompassFrame || compassFrames !== compassShownFrames) {
    compassShownFrames = compassFrames;
    setCompassTextureFrame(frame);
    document.documentElement.style.setProperty("--compass-frames", String(compassFrames));
    document.documentElement.style.setProperty("--compass-position", `${frame * 100 / Math.max(1, compassFrames - 1)}%`);
  }
  const dropVehicleItem = (d) => { if (d.stack) items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay, motion: d.motion }); saved = false; };
  const cartHooks = { drop: dropVehicleItem, cartHost };
  const boatHooks = {
    drop: dropVehicleItem,
    particle: ([kind, x, y, z, mx, my, mz]) => scene.fx.spawn(kind, x, y, z, mx, my, mz),
    splash: (b, volume, pitch) => sounds.play("game.neutral.swim.splash", { volume, pitch, position: { x: b.x, y: b.posY, z: b.z } }),
    clear: (x, y, z, block) => {
      if (block === SNOW_LAYER) { if (world.set(x, y, z, 0)) scene.updateBlock(x, z, y); } else breakBlock([x, y, z]);
      saved = false;
    },
  };
  entityTick = { state: { world, items, primed, projectiles, arrows, rockets, mobs, xpOrbs, falling, survival, position, sneaking: !!motion.sneaking, onGround: grounded, flying,
    minecarts, boats, hanging, velocity, rider, alive: survival.health > 0, width: PHYSICS.width, height: PHYSICS.height }, hooks: {
    carts: cartHooks,
    boats: boatHooks,
    // the live rocket's hooks (fireworks-live.js): the 32-block ring, the 64-block tracking range for status 17, sounds and sparks; the client rocket copies draw the trail and the explosion (object-tracker.js)
    rocketHooks: () => ({ ringActive: (r) => ringEntityActive(world, r), tracked: (r) => trackedWithin(ROCKET_TRACKING, r.x, r.z, position), sound: (name, x, y, z, volume, pitch) => sounds.play(name, { volume, pitch, position: { x, y, z } }), spark: (...a) => fireworkFx.spawnSpark(...a), clientCopies: true }),
    hangingActive: (e) => !world.streaming || world.isTicking(e.x, e.z),
    hangingDrop: (d) => { items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }); saved = false; },
    mobExplosion: (ev) => explodeEvent(ev, explodeAt),
    maxStack: st => survival.inventory.maxStack(st),
    smoke: (x, y, z) => scene.explosionParticles.spawn("smoke", x, y, z),
    explodeTnt: explodeAt,
    itemPicked: ({ item }) => {
      const pickedId = pickedAchievement(item.stack?.id);
      if (pickedId) achievements.trigger(pickedId);
      sounds.play("random.pop", { volume: 0.2, pitch: ((Math.random() - Math.random()) * 0.7 + 1) * 2 });
      scene.drops.pickup(item, position);
    },
    itemsCollected: () => { renderHotbar(); saved = false; },
    // EntityThrowable's ray takes every collidable entity: the paintings and item frames too (hanging.js).
    projectileTargets: () => [...mobTargets(mobs?.entities || [], position, PHYSICS.width, PHYSICS.height), ...vehicleTargets(entityTick.state)], // and the carts and boats too (entity-simulation.js)
    projectileHit: (e, ball) => e === "player" ? false : thrownAtStruck(e) || thrownHit(mobs, e, position, ball), // a snowball does 3 to a blaze (projectiles.js)
    projectilePearlImpact: ({pearl,hit}) => {
      const state={world,position,previous,survival,rider,minecarts,fallDistance,landedFall};
      impactPlayerPearl(state,pearl,hit,{
        hit:(e,source)=>e!=="player"&&(thrownAtStruck(e)||mobs?.attackEntityFrom(e,source.amount,{
          name:'thrown',player:!!source.thrower,attacker:'projectile',
          ...(source.thrower?{from:{x:position.x,z:position.z}}:{}),
        })),
        particle:()=>{}, // the client's copy of the pearl portals on impact (object-tracker.js, Projectiles.clientImpact)
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
  } };
  tickEntitySimulation(entityTick.state, entityTick.hooks);
  const trackLists = () => {
    const lists = { item: items.items.filter((e) => e.stack), orb: xpOrbs.orbs, arrow: arrows.list, falling: falling?.entities ?? [], tnt: primed, eyeOfEnder: eyes.eyes, firework: rockets.rockets, fishHook: fishing.active ? [fishing.hook] : [] };
    for (const k of THROWN_KINDS) lists[k] = thrownOf(k);
    return lists;
  };
  const afterTrack = () => {
    for (const e of objectTracker.drainEvents()) if (e.firework) fireworkFx.spawnStarter(e.firework.x, e.firework.y, e.firework.z, e.firework.vx, e.firework.vy, e.firework.vz, e.firework.fireworks); // S1A 17
    scene.setArrows(objectViews(objectTracker, arrows.list, "arrow"));
  };
  // Batch 51: with the one list walk the object tracker's entries join the mob tracker's loop (EntityWorld.tickMobs, `jointTracking`), as EntityTracker walks mobs and objects together
  if (mobs) mobs.jointTracking = () => world && screen !== "home" ? { tracker: objectTracker, lists: trackLists(), world, after: afterTrack } : null;
  const trackObjects = () => {
  if (world && screen !== "home") { // EntityTracker.updateTrackedEntities then the client's world tick for the non-mob entities
    if (mobs?.tracker) objectTracker.shareOrder(mobs.tracker); // EntityTracker.trackedEntities: one HashSet for mobs and objects
    objectTracker.update(trackLists(), position, world);
    afterTrack();
  }
  };
  entityTick.track = () => { if (mobs?.jointRan) mobs.jointRan = false; else trackObjects(); }; // the walked tick's tracker pass ran in tickMobs when `jointRan`
  if (!isWalked(mobs)) trackObjects();
  fishing.tick(fishingHost());
  statsLive.fishing(fishing);
  // EntityMinecartChest.onUpdate and the player's and mobs' pushes against carts; spilled
  // contents and the broken cart's items become item entities.
  if (!isWalked(mobs)) {
  if (tickMinecartSimulation({ world, minecarts, mobs, position, velocity, rider, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0 }, cartHooks).length) saved = false;
  // EntityBoat.onUpdate: buoyancy, rider input, breakage; its splash particles and cleared snow or lily pads.
  if (tickBoatSimulation({ world, boats, mobs, position, velocity, rider, width: PHYSICS.width, height: PHYSICS.height, alive: survival.health > 0 }, boatHooks).length) saved = false;
  // EntityHanging.onUpdate: the surface check every 100 ticks; broken ones drop their items.
  hanging.tick(world, { active: entityTick.hooks.hangingActive });
  spawnHangingDrops();
  } // walked: carts, boats and hanging entities run in the list walk (entity-simulation.js)
  const vehicle = vehicleState();
  finishVehicleTick(vehicle);
  applyVehicleState(vehicle);
  seatOnCartCopy();
  if (containerView?.container.cart && !minecarts.usable(containerView.container.cart, position)) resume();
  $("#pumpkin-blur").hidden = !showsPumpkinBlur(survival.inventory?.armor?.[3], thirdPersonView) || $("#hud").classList.contains("hidden"); // GuiIngame.renderPumpkinBlur
  scene.setFishing(fishing.active ? { hook: objectViews(objectTracker, [fishing.hook], "fishHook")[0], first: !thirdPersonView, sneaking: !!motion.sneaking, angler: multiplayer ? null : playerBody } : null);
  scene.setDrops(objectViews(objectTracker, items.items, "item"));
  scene.setProjectiles(eyes.eyes.length || rockets.rockets.length || mobs?.potions?.balls?.length || mobs?._golemBalls?.balls.length || mobs?._fireballs?.balls.length || mobs?._skulls?.balls.length ? [...viewBalls(projectiles.balls), ...eyes.rows(objectViews(objectTracker, eyes.eyes, "eyeOfEnder")), ...rockets.rows(objectViews(objectTracker, rockets.rockets, "firework")), ...viewBalls(mobs?.potions?.balls ?? []), ...(mobs?._golemBalls?.balls ?? []), ...(mobs?._fireballs?.balls ?? []), ...(mobs?._skulls?.balls ?? [])] : viewBalls(projectiles.balls), projectiles.particles);
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
  scene.setArrows(objectViews(objectTracker, arrows.list, "arrow"));
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
// BlockRedstoneOre.func_150185_e (redstone-ore.js): onBlockClicked, onEntityWalking and onBlockActivated sparkle and light the ore.
function touchRedstoneOre(x, y, z) {
  if (world.populationBlocks?.touch(x, y, z, { rand: scene.explosionParticles.worldRandom, spawn: (...a) => scene.fx.spawn(...a) })) saved = false;
}
function trampleFarmland(entity, distance) {
  const x = Math.floor(entity.x), y = Math.floor(entity.y - 0.2), z = Math.floor(entity.z);
  if (farming.trample(x, y, z, distance, Math.random, entity === position || gameRule("mobGriefing"))) {
    applyFarmUpdates(farming.drain());
    saved = false;
  }
}
function applyFarmUpdates(updates){const chunks=new Set();for(const[x,y,z]of updates)if(!world.ringSink||world.isLoaded(x,z))chunks.add([Math.floor(x/16)*16,Math.floor(z/16)*16].join(','));for(const key of chunks)scene.buildChunk(...key.split(',').map(Number));}
// Shared synchronous event routing, also used immediately after player attacks/interaction.
function mobEventHooks() {
  return {
    push: (v) => { velocity.x += v.x; velocity.y += v.y; velocity.z += v.z; },
    knock: (s) => drainKnockback(s, velocity, position),
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
      // EntityAIBreakDoor's World.destroyBlockInWorldPartially: the crack overlay of the zombie at the door.
      if (event.crack) scene.effects.mobCrack(event.crack.id, [event.crack.x, event.crack.y, event.crack.z], event.crack.stage);
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
  if (survival.food >= 20 && !ITEMS[id]?.alwaysEdible) { // ItemFood.onItemRightClick: canEat(alwaysEdible) - the golden apple is always edible
    return; // ItemFood.onItemRightClick refuses silently
  }
  if (survival.usable(id) && !eating) eating = { id, ticks: 32 };
}
// Development-only bounded trace of captured edit/release actions with their player tick.
function traceAction(action) {
  if (!import.meta.env.DEV) return;
  editActionLog.push({ tick: survival.time, action });
  if (editActionLog.length > 256) editActionLog.shift();
}
// Browser adapters transfer live references and scalar movement state synchronously.
function vehicleState() {
  return { screen, world, minecarts, boats, horses: seatsFor(mobs, rider), rider, position, previous, velocity, motion, survival, yaw, eating,
    grounded, collidedH, flying, fallDistance, landedFall };
}
// Batch 52: the client player on a minecart is seated from the cart's client copy (World.updateEntity: the copy's update, then the rider's updateRiderPosition), so the camera and
// the player model follow the interpolated cart the renderer draws. The server side (the tick's physics, the dismount) keeps the live seat; this runs at the end of each seating.
function seatOnCartCopy() {
  const live = rider.vehicle;
  if (live?.horse && live.entity) { // Batch 53 (pig), batch 54 (horse): seated from the packet-driven client copy the same way (Entity.updateRiderPosition; horse-copy.js)
    const seat = copySeat(mobs?.tracker?.clientIfTracked(live.entity), live.entity);
    if (seat) { position.x = seat.x; position.y = seat.y; position.z = seat.z; }
    return;
  }
  const c = live && !live.horse && rideCopy(objectTracker, live);
  if (!c) return;
  if (c.kind === "boat") { const seat = boatSeat(c); position.x = seat.x; position.y = seat.y; position.z = seat.z; return; } // Batch 56: the boat copy runs its own physics from the rider's input
  position.x = c.x; position.y = c.y + minecarts.getMountedYOffset() - 0.5; position.z = c.z;
}
function applyVehicleState(state) {
  ({ grounded, collidedH, flying, fallDistance, landedFall } = state);
}
function spawnHangingDrops() {
  for (const d of hanging.drain()) { items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }); saved = false; }
}
// NetHandlerPlayServer C08 / C07 / C02 acceptance on the integrated server (server-handlers.js): the second gate behind the client reach.
// A refused block click is resent as it is (the client changes nothing); a click above the build limit also prints the server's message.
function serverAcceptsClick(place) {
  const feet = [position.x, position.y, position.z];
  const resend = (b, a) => { for (const c of [b, a]) if (c) scene.updateBlock(c[0], c[2], c[1]); };
  // C02 for every aimed entity (mob, cart, boat, painting, frame): posY and getEyeHeight as the native entity has them, sight by a block ray.
  const aimed = aimedEntity ? { pos: [aimedEntity.entity.x, aimedEntity.entity.y, aimedEntity.entity.z], eye: aimedEntity.entity.knotRef ? 0 : mobs.ai.brain(aimedEntity.entity).eyeHeight } // a leash knot (EntityHanging) keeps Entity.getEyeHeight, 0
    : aimedCart ? { pos: [aimedCart.cart.x, aimedCart.cart.posY, aimedCart.cart.z], eye: 0 }
    : aimedHanging ? { pos: [aimedHanging.entity.x, aimedHanging.entity.y, aimedHanging.entity.z], eye: 0 } : null;
  if (aimed) return serverClick({ kind: 'entity', player: feet, entity: aimed.pos, eyeHeight: aimed.eye, action: place ? 'interact' : 'attack',
    lineBlocked: (a, b) => rayTraceBlocks(world, a, b, false, false) !== null }).accept;
  if (!target) return true;
  const r = serverClick({ kind: place ? 'place' : 'dig', player: feet, pos: target.block, adjacent: target.adjacent });
  if (r.accept) return true;
  resend(target.block, target.adjacent);
  if (r.message) printChat(r.message);
  return false;
}
// Batch 50: C02 (use entity) / C08 / C07 packets are handled in the network tick, after the worlds' entity walk of the same server tick
// (MinecraftServer.updateTimeLightAndEntities; bytecode-read). An action aimed at an entity, or one that throws or places an entity, waits for the walk's
// afterEntities hook; the client's own swing stays at once.
let pendingEdits = [], runningEdits = false;
function defersToNetworkTick(place) {
  if (runningEdits || !mobs) return false;
  if (aimedEntity || aimedCart || aimedHanging) return true;
  if (pendingEdits.length) return true; // packets are handled in arrival order: nothing overtakes a queued action
  if (place && target) return true; // C08 on a block (placement, doors, containers, item use): the client's own prediction is the swing and the GUI, which waits for the server anyway
  const h = heldId();
  return place && (isThrowable(h) || h === BOAT_ITEM || h === ITEM_EXP_BOTTLE || h === ITEM_SPAWN_EGG);
}
function runPendingEdits() {
  if (!pendingEdits.length) return;
  const list = pendingEdits; pendingEdits = [];
  const was = [aimedEntity, aimedCart, aimedHanging], wasTarget = target;
  runningEdits = true;
  try {
    for (const q of list) {
      if (q.fn) { q.fn(); continue; } // a C07 stop-digging / creative break queued by breakBlockPacket
      [aimedEntity, aimedCart, aimedHanging] = q.aimed; target = q.target;
      endPrediction(q.predicted); mutePlaceSound = !!q.predicted?.soundDone;
      try { edit(q.place); } finally { mutePlaceSound = false; }
      revertPrediction(q.predicted);
    }
  } finally { runningEdits = false; [aimedEntity, aimedCart, aimedHanging] = was; target = wasTarget; }
}
// ItemInWorldManager's own dig timer (b53 digfinish, server-dig.js): the player's update (before the network tick) counts a tick and runs a delayed break.
const serverDig = createServerDig();
let serverDigTicked = false;
const serverDigRate = (p) => { const b = world.get(p[0], p[1], p[2]); return b ? playerMiningState(survival, b, heldId(), clientEyeInWater(), grounded).progress : null; };
function tickServerDig() {
  if (serverDigTicked) return;
  serverDigTicked = true;
  const hit = serverDig.tick(serverDigRate);
  if (hit) breakBlock(hit, false);
}
// C07 status 1 (b54 digabort): PlayerControllerMP.resetBlockRemoving sends it when the client stops a dig it has not finished (the button released, the aim or the
// held item changed, a screen opened); the server half (ItemInWorldManager.cancelDestroyingBlock) clears its cracks and its digging flag, in the network tick.
// The digger itself never receives the crack packets (they go to the other players), so only the timer's state shows here.
let watchedDig = null;
function digAbortPacket() { watchedDig = null; serverTask(() => serverDig.abort()); }
function watchClientDig() {
  if (watchedDig && mining !== watchedDig) { if (!watchedDig.finished) digAbortPacket(); watchedDig = null; }
  if (mining && !watchedDig) watchedDig = mining;
}
// C07 status 2 on the server: breaks whatever block is at the cell once 0.7 of its own damage is reached, else resends it (S23) and waits for damage 1.
function serverFinishDig(p) {
  const r = serverClick({ kind: 'dig', player: [position.x, position.y, position.z], pos: p }).accept && serverDig.finish(p, serverDigRate(p));
  if (r !== 'break') scene.updateBlock(p[0], p[2], p[1]);
  return r === 'break';
}
// C07 (finished digging, creative / instant break): the block goes in the network tick. The progress, sounds and hit particles stay client-side and at once.
function breakBlockPacket(p, creative = false, accept = null) {
  if (accept && watchedDig) watchedDig.finished = true; // a finished dig ends the client's dig state (onPlayerDestroyBlock): no abort follows
  if (runningEdits || !mobs || multiplayer) return !accept || accept() ? breakBlock(p, creative) : false;
  const predicted = predictBreak(p);
  pendingEdits.push({ fn: () => {
    endPrediction(predicted);
    muteBreakFx = !!predicted;
    try { if (!accept || accept()) breakBlock(p, creative); } finally { muteBreakFx = false; }
    revertPrediction(predicted);
  } });
  return true;
}
// Batch 55 (instantbreak, client-prediction.js): PlayerControllerMP removes the block on the client world at once (onPlayerDestroyBlock: aux 2001, then setBlockToAir)
// and ItemBlock.onItemUse places on it at once; the shared world keeps the server half in the network tick, so the client half is an overlay the renderer, the aim ray
// and the client player's collision read until the queued task runs. The sound and particles play here, once, and the queued run skips them.
let prediction = null, predictionToken = 0, muteBreakFx = false, mutePlaceSound = false;
function predictionLayer() {
  if (!prediction || prediction.world !== world) { prediction = createPrediction(world); }
  scene.predicted = prediction;
  return prediction;
}
const clientWorld = () => (prediction && prediction.world === world ? prediction.read() : world);
function showPrediction(list) {
  const layer = predictionLayer(), token = ++predictionToken, cells = [];
  for (const [x, y, z, block, meta] of list) {
    const was = { block: world.get(x, y, z), meta: world.getMeta(x, y, z) };
    if (layer.set(x, y, z, block, meta, token)) cells.push({ x, y, z, was });
  }
  for (const c of cells) scene.showPredicted(c.x, c.z);
  return cells.length ? { token, cells } : null;
}
function predictBreak(p) {
  const seen = predictionLayer().read(), block = seen.get(...p); // a cell an earlier queued break already cleared on the client is air
  if (!block) return null;
  const meta = seen.getMeta(...p), s = breakSound(block);
  sounds?.play(s.name, { volume: s.volume, pitch: s.pitch, position: { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 } });
  scene.particles.destroyBlock(world, ...p, block, meta);
  return showPrediction([[p[0], p[1], p[2], 0, 0]]) ?? { token: 0, cells: [] };
}
function predictPlace() {
  const held = heldId(), layer = predictionLayer();
  if (!predictsPlacement({ world: layer.read(), target, heldId: held, sneaking: !!motion.sneaking, aimed: aimedEntity || aimedCart || aimedHanging })) return null;
  let soundDone = false;
  const out = dryPlace({ world: layer.read(), survival, position, flowers: FLOWERS, yaw }, { id: held, item: ITEMS[held], target }, { sound: (...a) => { soundDone = true; sound(...a); } });
  if (!out.placed) return null;
  const shown = showPrediction(out.cells.map((c) => [c.x, c.y, c.z, c.block, c.meta]));
  return { token: shown?.token ?? 0, cells: shown?.cells ?? [], soundDone };
}
function endPrediction(pred) { if (pred) for (const c of pred.cells) prediction?.clear(c.x, c.y, c.z, pred.token); }
// S23 for a cell the server left as it was (a refusal): the chunk is meshed from the real world again.
function revertPrediction(pred) { if (pred) for (const c of pred.cells) if (world.get(c.x, c.y, c.z) === c.was.block && world.getMeta(c.x, c.y, c.z) === c.was.meta) scene.updateBlock(c.x, c.z, c.y); }
// A server-side effect of a click (ItemInWorldManager.onBlockClicked at C07 status 0): queued in arrival order, at once in multiplayer or while the queue runs.
function serverTask(fn) {
  if (runningEdits || !mobs || multiplayer) { fn(); return; }
  pendingEdits.push({ fn });
}
// The player's click entry points call this instead of edit: the client's own part (the swing) at once, the packet's part in the network tick.
function clickEdit(place = false) {
  if (screen === "playing" && !multiplayer && defersToNetworkTick(place)) {
    if (!place) animation.swing(); // Minecraft.clickMouse swings at once; the server handles the attack in the network tick
    pendingEdits.push({ place, aimed: [aimedEntity, aimedCart, aimedHanging], target, predicted: place && target ? predictPlace() : null });
    return;
  }
  edit(place);
}
function edit(place = false) {
  if (screen !== "playing") return;
  if (multiplayer) { sendMultiplayerInput(captureMovementInput(d => binds.isDown(d))); multiplayer.send({ type: 'edit', place }); animation.swing(); return; }
  if (!serverAcceptsClick(place)) { mining = null; return; }
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
    const action = captureVehicleAction({ cartId: aimedCart.cart.id, boat: !!aimedCart.cart.boat, place, sneak: binds.isDown("key.sneak"), heldTool: heldId() });
    traceAction(action);
    const done = dispatchVehicleAction(state, action, {
      swing: () => animation.swing(),
      damage: () => heldAttackDamage(heldId(), survival),
      openContainer: (container, kind) => openContainer(container, kind ?? "chest"),
      openCommandCart: (cart) => openCommandBlock(0, 0, 0, cart.command),
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
    farming, trees, fire, fluids, items, projectiles, eyes, maps, rockets, grounded, fallDistance, wasInWater, yaw, pitch,
    eating, mining, mineCooldown, mineHeld, flowers: FLOWERS, boneRandom, itemRand, signs, difficulty: survival.difficulty, rider };
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
    useFishingRod: () => { const r = fishing.use(fishingHost()); statsLive.fishing(fishing); return r; },
    renderHotbar,
    renderVitals,
    spawnWither: (x, y, z, yaw) => { achievements.trigger("spawnWither"); return mobs.spawnWither(x, y, z, yaw); }, // wither-boss-mobs.js
    markUnsaved: () => { saved = false; },
    playSound: (name, options) => sounds.play(name, options),
    particle: (name, x, y, z, vx, vy, vz) => scene.fx.spawn(name, x, y, z, vx, vy, vz),
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
    useBeacon: key => { useBeacon(key); syncContainerState(); },
    useBed,
    openSignEditor: (tile) => { screen = "inventory"; mining = null; mineHeld = false; openSignEditor(signEditHost(gui, { close: resume, markUnsaved: () => { saved = false; } }), signs, tile, world); syncContainerState(); },
    // GuiScreenBook (book-ui.js); MC|BEdit / MC|BSign are applied to the selected stack as NetHandlerPlayServer does.
    openBook: (held) => { if (!held) return; screen = "inventory"; mining = null; mineHeld = false; openBookUi({ show: (title, html) => containerShell("book", html, "book-modal", { noLabels: true }, "screen"), close: () => { resume(); renderHotbar(); }, markUnsaved: () => { saved = false; } }, { stack: held, editable: held.id === ITEM_WRITABLE_BOOK, playerName: PLAYER_NAME, send: (channel, packet) => { (channel === "MC|BSign" ? applyBookSign : applyBookEdit)(survival.held, packet, PLAYER_NAME); renderHotbar(); } }); syncContainerState(); },
    useCommandBlock: openCommandBlock,
    // ItemRecord.onItemUse / BlockJukebox / BlockNote.onBlockActivated; the disc leaves the stack outside Creative.
    useNoteJukebox: (x, y, z, held) => {
      const r = redstoneRuntime?.music.use(x, y, z, held);
      if (!r?.handled) return false;
      if (r.consumed && !survival.creative) { survival.take(held); renderHotbar(); }
      saved = false;
      return true;
    },
    useDragonEgg: (x, y, z) => { useDragonEgg({ world, serverRandom: () => scene.explosionParticles.worldRandom, clientRandom: () => new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))), updateBlock: (i, j, k) => scene.updateBlock(i, k, j), spawnParticle: (...a) => scene.fx.spawn(...a) }, x, y, z); saved = false; return true; },
    touchRedstoneOre,
    blockClicked: (x, y, z) => { if (!survival.creative) { redstoneRuntime?.music.click(x, y, z); saved = false; } },
    openMerchant: entity => { const opened = useMerchant(entity); if (opened) syncContainerState(); return opened; },
    useEnchantingTable: key => { useEnchantingTable(key); syncContainerState(); },
    openChest: (chest, key) => { openContainer(chest, "chest", key); redstoneRuntime?.chestViewersChanged(chest.keys); syncContainerState(); },
    openBrewing: (tile, key) => {
      const brewing = new BrewingContainer(survival.inventory, brewingView(tile), () => { saved = false; });
      // SlotBrewingStack.onPickupFromSlot: taking a potion from a bottle slot.
      for (const slot of brewing.slots.slice(0, 3)) { const taken = slot.onPickup?.bind(slot); slot.onPickup = (s) => { if (s?.id === 385) achievements.trigger("potion"); return taken?.(s); }; }
      openContainer(brewing, "brewing", key);
      syncContainerState();
    },
    openHopper: (hopper, key) => { openContainer(new HopperContainer(survival.inventory, hopper, () => { saved = false; }), "hopper", key); syncContainerState(); },
    openHorse: (e) => { openHorse(e); syncContainerState(); },
    openDispenser: (dispenser, key, _block, title = DISPENSER_TITLE) => { openContainer(Object.assign(new DispenserContainer(survival.inventory, dispenser, () => { saved = false; }), { title }), "dispenser", key); syncContainerState(); },
    breakBlock: breakBlockPacket,
    clientEyeInWater,
    serverTask,
    digStart: (cell) => serverDig.start(cell, serverDigRate(cell)),
    // ItemBoat.onItemRightClick: a water trace along the view ray (works on land too); the boat is taken
    // from the stack except in Creative.
    placeBoat: () => {
      // Entities the new boat must not overlap (the player, mobs, boats, carts) and the canBeCollidedWith ones its line of sight checks.
      const pbox = [position.x - PHYSICS.width / 2, position.y, position.z - PHYSICS.width / 2, position.x + PHYSICS.width / 2, position.y + PHYSICS.height, position.z + PHYSICS.width / 2];
      const alive = mobs.entities.filter((e) => e.health > 0).map((e) => { const [w, h] = mobs.size(e); return { bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2] }; });
      const solid = [...boats.carts, ...(minecarts?.carts ?? [])].filter((c) => !c.dead && c.bb).map((c) => ({ bb: c.bb }));
      const sight = [...alive, ...solid];
      if (!eyeRay || !boats.place(world, { eye: eyeRay.origin, dir: eyeRay.dir, yaw: Math.fround(180 - yaw * 180 / Math.PI), box: pbox }, [{ bb: pbox }, ...sight], sight)) return false;
      if (!survival.creative) survival.take(BOAT_ITEM, 1);
      animation.swing(); renderHotbar(); saved = false;
      return true;
    },
  });
  ({ eating, mining, mineCooldown } = state);
  // BlockPumpkin.onBlockAdded: a pumpkin set on an iron T builds a player-created iron golem.
  const put = acted?.placement;
  if (put?.placed && (put.block === PUMPKIN || put.block === JACK_O_LANTERN) && put.position) {
    const [px, py, pz] = Array.isArray(put.position) ? put.position : [put.position.x, put.position.y, put.position.z];
    const cleared = mobs.tryBuildGolem(px, py, pz);
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
// Furnace, TNT and hopper carts (cart-variants.js): the explosion, smoke, primed sound and the hopper transfer host.
const cartHost = {
  explode: (cart, x, y, z, power) => { explodeAt(x, y, z, power, { exploder: null, smoking: true }); saved = false; },
  particle: (name, x, y, z, mx, my, mz) => scene.fx?.spawn(name, x, y, z, mx, my, mz),
  sound: (name, cart) => sounds.play(name, { position: { x: cart.x, y: cart.posY, z: cart.z } }),
  get transfer() { return hopperTiles.host; },
  changed: () => { saved = false; },
  runCommand: (cart) => runCommandCart(cart, { host: commandHost, changed: () => { saved = false; } }), // command-cart.js
};
// EntitySnowball/EntityEgg/EntityEnderPearl.onImpact on a cart, boat, painting or item frame: attackEntityFrom(thrown by the player, 0) wobbles a vehicle (a Creative thrower breaks it)
// and breaks a painting (a frame with an item loses the item), entity-simulation.js. False for anything else (a mob).
function thrownAtStruck(e) { if (!thrownAtVehicleOrHanging(entityTick.state, e, entityTick.hooks, { player: true, creative: survival.creative })) return false; saved = false; return true; }
function explodeAt(x, y, z, size, { exploder = null, attacker = null, smoking = true, flaming = false, blue = false } = {}) {
  applyExplosion({ world, weather, mobs, items, xpOrbs, arrows, projectiles, falling, primed, hanging, minecarts, boats,
    survival, position, velocity, farming }, { x, y, z, size, exploder, attacker, smoking, flaming, blue }, {
    ignite: (fx, fy, fz) => fire.ignite(fx, fy, fz), // Explosion.isFlaming (ender crystal): fire on a third of the cells above an opaque block
    brokenTool: reportBrokenTool,
    vehicleDrop: (d) => { if (d.stack) items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay, motion: d.motion }); },
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
    playBlockSound: (...a) => { if (!muteBreakFx) sound(...a); },
    destroyParticles: (...args) => { if (!muteBreakFx) scene.particles.destroyBlock(...args); },
    markUnsaved: () => { saved = false; },
    releaseSilverfish: (x, y, z) => mobs.spawnSilverfishAt?.(x, y, z),
    harvested: (info) => statsLive.harvested(info),
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
  statsLive.broken(survival.broken);
  sounds.play("random.break", { volume: 0.8, pitch: breakSoundPitch(weather.random) }); // World.rand, as every renderBrokenItemStack (attributes2-reference.json breakPitch)
  itemCrumbs(scene.fx, 5, "iconcrack_" + survival.broken, playerEye(), playerRandom);
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
    // C07 status 2 (finished digging): refused past 6 blocks from the eye or at y >= 256; the block is resent unchanged.
    // ItemInWorldManager.blockRemoving also reads the block at the cell when the packet is handled: one that is no longer the dug type is refused and resent.
    digAbort: digAbortPacket,
    breakBlock: (p, c, type) => breakBlockPacket(p, c, () => type === undefined || serverFinishDig(p)), // a finished dig is the server's own check (ItemInWorldManager.blockRemoving); creative and instant breaks are unchecked
    hitParticles: (x, y, z, side) => scene.particles.hitBlock(world, x, y, z, side),
    mayHit: (x, y, z) => mayHitBlock(survival, world.get(x, y, z), world.getMeta(x, y, z), heldId()),
  });
  mining = state.mining;
  mineCooldown = state.cooldown;
  watchClientDig();
}
// Streamed population (version 13): chests, animals, spawners, carts and liquid ticks of columns that
// just became resident for the first time. Resident columns already claimed are never handed over again.
function materializeFresh() {
  containerResidency?.admit();
  const columns = world.claimFreshColumns();
  if (columns.length) {
    const handed = restorePopulationColumns(columns, { world, survival, mobs, spawners, minecarts, fluids, primed: genPrimed ?? primed });
    if (handed.primed || handed.animals || handed.chests || handed.dispensers || handed.pots || handed.spawners || handed.carts || handed.ticks) saved = false;
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
  if (!world.streaming || (world.noPrefetch && !world.dimension) || typeof Worker !== "function") return; // the worker builds Overworld terrain and, through DimensionWorld, Nether/End columns (batch 28)
  try {
    const spawn = () => new Worker(new URL("./streaming-worker.js", import.meta.url), { type: "module" });
    streamPrefetch = new StreamPrefetch(world, spawn(), { ringSpawn: spawn, ringMax: Math.max(0, Math.min(3, (navigator.hardwareConcurrency ?? 4) - 3)) }); // the ring fills from extra workers made on demand and ended once it is full (a Nether/End column 40-60 ms, an Overworld cell 1-2 s each); none up to 3 cores
    // A ring hopper reaching a never-resident chest waits for the worker to build its population cell instead of building it here (ring-chests.js).
    if (world.population) world.population.requestCell = (cx, cz) => { if (!streamPrefetch || streamPrefetch.failed) return false; streamPrefetch.whenHas([[cx, cz]]); return true; };
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
  if (multiplayer) { sendMultiplayerInput(screen === 'playing' ? controls : IDLE_INPUT); return; }
  survival.blocking = !!eating?.block; // EntityPlayer.isBlocking for this tick's damage (survival.js damage)
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
  const state = { world: clientWorld(), position, previous, velocity, motion, survival, yaw, eating, minecarts, boats, horses: seatsFor(mobs, rider), rider,
    grounded, collidedH, flying, fallDistance, landedFall, sleeping: bedSleep.sleeping };
  const { inWater, inLavaNow, sneakOnGround, oldPosition } = moveRidingPlayer(state, controls,
    { trace: traceAction, markUnsaved: () => { saved = false; } }) ?? movePlayer(state, controls, toast);
  ({ grounded, collidedH, flying, fallDistance, landedFall } = state);
  pushClientPlayer(mobs, { x: position.x, y: position.y, z: position.z, width: PHYSICS.width, height: PHYSICS.height, riding: !!rider.vehicle, dead: survival.health <= 0 }, velocity); // sv.bo on the client player, after the move
  streamPrefetch?.update(position.x, position.z);
  if (world.ringSink?.rtList && world.warmBiomes) world.warmBiomes(world.ringSink.rtList); // ring chunks' biomes, a few ms a tick, before their ice rolls need them
  walkFrozen = sneakOnGround;
  $("#movement-label").textContent = rider.vehicle ? "RIDING" : flying
    ? "FLYING"
    : inWater
      ? "SWIMMING"
      : "WALKING";
  tickSurvival(inWater, oldPosition, inLavaNow);
  tickWorldSystems({ farming, fluids, fire, tickTree, hoppers: hopperTiles, brewing: tickBrewingStands, redstone: redstoneRuntime, deferTiles: true },
    { time: survival.time, daylight: scene.daylight, x: position.x, z: position.z },
    { farming: applyFarmUpdates,
      // Fluid writes notify redstone one by one through fluids.writers (added where the tree attaches), as each native setBlock does; fire edits pass the
      // redstone funnel of world.set. The scene batch follows per kind.
      fluids: changes => { scene.updateBlocks(changes); if (tickTree) redstoneRuntime?.flush(); else redstoneRuntime?.fluidChanges(changes); },
      fire: changes => scene.updateBlocks(changes) });
  recordHud.tick();
  // NetHandlerPlayClient.handleEntityAttach: boarding any vehicle (cart, boat, pig, horse) shows
  // GuiIngame.func_110326_a(I18n "mount.onboard" with the sneak key's display string, false) above the hotbar.
  if (rider.vehicle && rider.vehicle !== onboardVehicle) recordHud.message(translate("mount.onboard", "Press %1$s to dismount").replace("%1$s", keyDisplayString(binds.code("key.sneak")) ?? "null"));
  onboardVehicle = rider.vehicle ?? null;
  scene.setFurnaces(survival.furnaces);
  tickChests();
  enchantBooks.tick(world, [{ x: position.x, y: position.y, z: position.z }]); // TileEntityEnchantmentTable.updateEntity
  if (containerView?.kind === "enchanting") enchantExtras?.tick(containerView.container); // GuiEnchantment.updateScreen
  mobs.look = { yaw, pitch }; // the enderman stare rule reads the view
  mobs.viewChunks = options.distance; // the integrated server's view distance: the chunk square the tracker shows entities in (entity-tracker.js)
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
  tickServerDig(); runPendingEdits(); // no-ops when the walk already ran them
  serverDigTicked = false;
  redstoneRuntime?.tickTiles(); // no-op when the walk's afterEntities hook already ran them
  if (isWalked(mobs) && entityTick) { finishEntitySimulation(entityTick.state, entityTick.hooks); entityTick.track?.(); const seat = vehicleState(); finishVehicleTick(seat); applyVehicleState(seat); seatOnCartCopy(); } // after the list walk: pickups, thrown-entity events, then the tracker's view of the end state
  dims.tickEntities(world, { mobs, items, xpOrbs, carts: minecarts, boats }); // mobs, items, orbs, minecarts and boats in portals (entity-portal.js)
  // EntityAIControlledByPlayer wore the carrot on a stick (pig-saddle-live.js); reportBrokenTool runs at the tick's end.
  if (mobs?.stickWorn) { mobs.stickWorn = false; renderHotbar(); saved = false; }
  // MobSpawnerBaseLogic.updateSpawner on the server (tile entities tick after the entities).
  if (mobs && (spawners?.size || minecarts?.carts.some((c) => c.type === 4))) {
    const level = (x, y, z, sub) => (scene.light ? scene.light.level(x, y, z, sub) : 15);
    const spawned = tickSpawnerSimulation({ spawners, mobs, minecarts, boats, random: weather.random, isLoaded: world.streaming ? (x, z) => world.isLoaded(x, z) : null,
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
    // Entity.moveEntity: Block.onEntityWalking runs with the step sound, on the cell 0.2 below the feet (redstone ore lights up).
    touchRedstoneOre(Math.floor(position.x), Math.floor(position.y - 0.2), Math.floor(position.z));
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
  if (useHold.tick(binds.isDown("key.use"), !!eating, !survival.creative && !!ITEMS[heldId()]?.food)) clickEdit(true);
  if (survival.health <= 0) die();
  // EntityRenderer.updateFovModifierHand: once a tick, toward getFOVMultiplier (flight, sprint, bow).
  easeFov(bowFovState, fovMultiplier({ flying, sprinting: motion.sprinting, potion: survival.effects?.moveSpeedMultiplier?.() ?? 1, bow: eating?.bow ? bowFov(eating.ticks) : 1 }));
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
// Shared by the Blockworld .json import and the Java save-folder import (which builds the same export object).
async function importBlockworldData(data, { id } = {}) {
  if (
    data.format !== "blockworld" ||
    data.version !== 1 ||
    typeof data.name !== "string" ||
    typeof data.seed !== "string" ||
    (!["meadow", "alpine", "island", "snowy"].includes(data.biome) && !isJavaLandscape(data.biome))
  )
    throw new Error("Choose a Blockworld export file");
  const check = new World(data.seed, data.biome, data.generationVersion ?? 1, data.worldType, data.generatorOptions);
  check.restore(data.edits);
  const record = {
    ...makeRecord(data),
    ...(id ? { id } : {}),
    ...(data.wholeSave ? { wholeSave: data.wholeSave } : {}),
    ...importedRuntime(data),
    edits: [...check.edits],
    generationVersion: data.generationVersion ?? 1,
    mode: gameModeOf(data.mode),
    player: new Survival(legacyPlayer(data), data.mode).serialize(),
  };
  const columns = [];
  if ([-1, 1].includes(data.dimension)) record.dimension = data.dimension;
  for (const d of [-1, 1]) {
    const blob = data.dimensions?.[d];
    if (!blob || typeof blob !== 'object') continue;
    const check = new DimensionWorld(record.seed, d);
    check.restore(blob.edits ?? []);
    const { edits, ...state } = blob;
    (record.dimensions ??= {})[d] = importedDimensionState(state);
    columns.push(...chunkRecords(viewId(record.id, d), check.edits));
  }
  const baseRecords = basesFromJson(data.bases, (d) => (d ? viewId(record.id, d) : record.id)); // stored full columns of a whole-save export
  if (baseRecords.length) for (let i = 0; i < baseRecords.length; i += 16) await writeBaseColumns(baseRecords.slice(i, i + 16));
  worlds.unshift(record);
  if (!await persist(columns)) throw new Error('World imported in memory. Export a copy because device storage is unavailable.');
  if (gui.screen?.id === "select-world") gui.build();
}
$("#file-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 128 * 1024 * 1024) throw new Error("File is too large");
    const data = JSON.parse(await file.text());
    await importBlockworldData(data);
    toast(data.wholeSave?.basesOmitted ? `World imported. ${data.wholeSave.basesOmitted} imported columns did not fit in the backup file and regenerate from the seed.` : "World imported.");
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
};
// Java save folder (import-screen.js): showDirectoryPicker where present, else <input webkitdirectory>.
let importAbort = null;
async function importPickedSave(entries) {
  if (importAbort) return;
  try {
    // A save with Anvil region files is imported whole (whole-save-import.js): every chunk becomes a stored column. Others use the area importer.
    if (regionFiles(indexSave(entries).files).length) {
      const worldId = crypto.randomUUID(), abort = importAbort = new AbortController();
      const status = (text) => { menuContext.importStatus = text; if (gui.screen?.id === "import-world") gui.build(); };
      menuContext.importCancel = () => abort.abort();
      let last = 0;
      try {
        const { record, report } = await importWholeSave(entries, { worldId, writeBases: writeBaseColumns, readBases: readBaseColumns, signal: abort.signal, onProgress: (p) => {
          const now = performance.now(); if (now - last < 250) return; last = now;
          status(p.phase === 'chunks' ? `Importing chunks: ${p.chunks} (region file ${p.fileIndex + 1} / ${p.fileCount})` : p.phase === 'populate' ? `Populating chunks the save never populated: ${p.done} / ${p.total}` : 'Reading level.dat...');
        } });
        await importBlockworldData(record, { id: worldId });
        const s = report.save, c = report.chunks;
        toast(`Java save imported whole: ${c.converted} chunks (${c.overworld} Overworld, ${c.nether} Nether, ${c.end} End)${c.skipped ? `, ${c.skipped} skipped` : ''}. ${(s?.notImported ?? []).join('; ')}`.trim());
      } catch (err) {
        for (const id of [worldId, `${worldId}~-1`, `${worldId}~1`]) await deleteStoredWorld(id).catch(() => {});
        throw err.name === 'AbortError' ? new Error('Import cancelled') : err;
      } finally { importAbort = null; menuContext.importStatus = ''; menuContext.importCancel = null; if (gui.screen?.id === "import-world") gui.build(); }
      return;
    }
    const { record, report } = await importSaveFolder(entries);
    await importBlockworldData(record);
    const s = report.save;
    toast(`Java save imported: ${s?.area?.width}x${s?.area?.depth} chunks around the ${s?.area?.around}. ${(s?.notImported ?? []).join('; ')}`.trim());
  } catch (err) {
    toast(err.message);
  }
}
async function chooseSaveFolder() {
  if (window.showDirectoryPicker) {
    try { await importPickedSave(await entriesFromDirectoryHandle(await window.showDirectoryPicker())); }
    catch (err) { if (err?.name !== "AbortError") toast(err.message); }
    return;
  }
  $("#folder-input").click();
}
$("#folder-input").onchange = async (e) => {
  const list = e.target.files;
  if (list?.length) await importPickedSave(entriesFromFileList(list));
  e.target.value = "";
};

// key.screenshot (F2): ScreenShotHelper.saveScreenshot after the frame is drawn, then a chat message; works on every screen.
const playerList = new PlayerListUi(document);
const shotNames = new Set();
function screenshot() {
  takeScreenshot({
    // The canvas frame, then the DOM GUI drawn over it (screenshot-compose.js); the plain frame if that fails.
    capture: (cb) => scene.requestCapture((blob) => (blob ? composeWithDom(blob, { skip: (el) => el === scene.renderer.domElement }).then(cb, () => cb(blob)) : cb(blob))),
    save: (blob, name) => { shotNames.add(name); downloadBlob(blob, name); },
    taken: (name) => shotNames.has(name),
    print: ({ text, links }) => chat.print(text, Math.floor(performance.now() / 50), 0, links),
  });
}
// GuiIngame.renderGameOverlay: the scoreboard sidebar (display slot 1) at the right edge, in scaled GUI pixels (scoreboard-live.js).
function sidebarFrame() {
  const scale = guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0);
  sidebar.update(scoreboard, screen !== "home" && screen !== "credits" && !$("#hud").classList.contains("hidden"), Math.ceil(innerWidth / scale), Math.ceil(innerHeight / scale), fontWidth);
}
// key.playerlist (Tab) held: GuiIngame draws the list unless a lone integrated player is on the server (player-list.js).
const showPlayerList = () => {
  if (multiplayer) { playerList.show(multiplayer.players.map(p => ({ name: p.name, ping: 0 })), Math.ceil(innerWidth / guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0))); return; }
  const listObjective = scoreboard.slot(0); // display slot "list": shows the overlay even for a lone player, with a score column
  if (!playerListVisible({ integrated: true, players: 1, hasObjective: !!listObjective, lanShared: lan.public })) return;
  playerList.show([{ name: scoreboard.formatName(PLAYER_NAME), ping: 0, score: listObjective ? scoreboard.peek(PLAYER_NAME, listObjective)?.value ?? 0 : undefined }], Math.floor(window.innerWidth / ((parseFloat(getComputedStyle(chatUi.box).fontSize) / 8) || 1)));
};
// Minecraft.dispatchKeypresses, after the screen's keyTyped and in every screen: a press that is not a
// repeat (nor within 20 ms of GuiControls taking a key) of key.screenshot or key.fullscreen. The stream
// keys have no Twitch stream to start here and do nothing.
function dispatchKeypress(e, code) {
  if (e.repeat || code === 0 || (gui.open && gui.screen?.id === "controls" && gui.screen.time > performance.now() - 20)) return;
  if (code === binds.code("key.screenshot")) { e.preventDefault(); screenshot(); }
  else if (code === binds.code("key.fullscreen")) { e.preventDefault(); toggleFullscreen(); }
}
// GuiContainer / GuiInventory: Block-pick of the targeted block (Minecraft.middleClickMouse).
function pickBlock() {
  const stonePick = target && (stoneUtilityPick(world, ...target.block) ?? shapedPick(world.get(...target.block), world.getMeta(...target.block)));
  const id = stonePick?.id ?? (target && pickItem(world.get(...target.block), world.getMeta(...target.block)));
  if (id) {
    survival.inventory.pick(id, survival.creative, stonePick ? stonePick.damage : isColoredBlock(world.get(...target.block)) ? coloredPickDamage(world.get(...target.block), world.getMeta(...target.block)) : treePickDamage(id, world.getMeta(...target.block)) ?? (id === WOOL || id === RED_FLOWER || id === 2 || id === 6 || id === 56 || id === 58 ? world.getMeta(...target.block) : undefined));
    mining = null;
    eating = null;
    renderHotbar();
    showHeldName();
  }
}
// Minecraft.runTick with no screen: the actions of a KeyBinding press (isPressed), whichever key or
// mouse button it is bound to.
function bindingPressed(d, ctrl) {
  if (d === "key.togglePerspective") thirdPersonView = nextView(thirdPersonView);
  else if (d === "key.smoothCamera") smoothCamera = !smoothCamera;
  else if (d === "key.inventory") inventory();
  else if (d === "key.drop") dropHeld(ctrl);
  else if (d === "key.chat") openChat("");
  else if (d === "key.command") openChat("/");
  else if (d === "key.attack") { mineHeld = true; clickEdit(false); }
  else if (d === "key.use") { useHold.press(); clickEdit(true); }
  else if (d === "key.pickItem") pickBlock();
  else if (d === "key.playerlist") showPlayerList();
  else if (HOTBAR.includes(d)) selectSlot(HOTBAR.indexOf(d));
}
// A binding released: key.playerlist hides the list, key.attack stops mining and key.use stops using.
function bindingReleased(d) {
  if (d === "key.playerlist") playerList.hide();
  else if (d === "key.attack") { mineHeld = false; if (mining && !mining.auto) mining = null; }
  else if (d === "key.use") { releaseBowUse(); eating = null; } // PlayerControllerMP.onStoppedUsingItem
}
// Minecraft.runTick keyboard loop, run on every screen (no currentScreen test): Keyboard.isKeyDown for the F3 combinations and the F3+C crash timer.
// bytecode-read: F1 hideGUI and F3 (showDebugInfo, Shift = profiler chart) toggle on their press; with F3 down, B toggles RenderManager.debugBoundingBox,
// S and T run refreshResources, F saves the options, A reloads the renderers, H and P toggle advancedItemTooltips / pauseOnLostFocus and save. No chat line.
const rawHeld = new Set();
let debugHitbox = false, crashStamp = -1, hitboxes = null;
function debugCrashTick() {
  const r = crashStep(crashStamp, performance.now(), rawHeld.has(KEY_C), rawHeld.has(KEY_F3));
  crashStamp = r.stamp;
  if (r.crash) { crashStamp = -1; rawHeld.clear(); if (screen === "playing") pause(); showCrashReport(document, crashReport(), () => {}); }
}
function debugKeyDown(e, code) {
  rawHeld.add(code);
  if (code === 59 || code === 61) e.preventDefault(); // F1, F3 are never the browser's
  debugCrashTick();
  if (e.repeat || screen === "home") return;
  const f3 = rawHeld.has(KEY_F3);
  if (f3 && code === 33) saveOptions();
  if (f3 && code === 30) for (const k of scene.chunks.keys()) scene.dirty.add(k); // RenderGlobal.loadRenderers
  if (f3 && (code === KEY_S || code === KEY_T)) { refreshResources(); for (const k of scene.chunks.keys()) scene.dirty.add(k); } // bao.c ends with loadRenderers
  if (f3 && code === 35) { options.advancedTooltips = !options.advancedTooltips; saveOptions(); }
  if (f3 && code === 25) { options.pauseOnLostFocus = options.pauseOnLostFocus === false; saveOptions(); }
  if (f3 && code === KEY_B) debugHitbox = !debugHitbox;
  if (code === 59) hideGUI = !hideGUI;
  if (code === 62) scene.post.deactivateShader(); // F4: EntityRenderer.deactivateShader
  if (code === 61) { debug = !debug; debugChart = e.shiftKey; $("#debug").classList.toggle("hidden", !debug); if (!debug) debugOverlay.hide(); }
}
window.addEventListener("keyup", (e) => { rawHeld.delete(lwjglCode(e)); debugCrashTick(); }, true);
window.addEventListener("blur", () => rawHeld.clear());
window.addEventListener("keydown", (e) => {
  if (screen === "credits") return;
  const code = lwjglCode(e);
  debugKeyDown(e, code);
  if (exportBusy) { dispatchKeypress(e, code); e.preventDefault(); return; }
  // An open menu screen takes every key (GuiScreen.handleKeyboardInput), then dispatchKeypresses.
  if (gui.open) {
    gui.key(e);
    dispatchKeypress(e, code);
    return;
  }
  dispatchKeypress(e, code);
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
  // A key event dispatched on window or document has a non-Element target with no matches(); without this
  // guard the handler threw before reaching binds.set.
  if (e.target instanceof Element && e.target.matches("input,select,textarea")) return;
  // GuiContainer.keyTyped compares key codes directly: key.inventory closes, the hotbar keys and
  // key.drop act on the hovered slot. GuiContainerCreative opens search with key.chat first.
  const hotbar = HOTBAR.findIndex((d) => binds.code(d) === code), drop = code !== 0 && code === binds.code("key.drop");
  if (screen === "inventory" && containerView?.kind === "creative") {
    const gui = containerView.gui, before = gui.tab;
    if (gui.typed({ code: e.code, key: e.key, ctrl: e.ctrlKey || e.metaKey, chat: code !== 0 && code === binds.code("key.chat"), hotbar }, containerView.hovered)) {
      e.preventDefault();
      if (gui.tab !== before) renderCreativeBody();
      refreshContainer();
      return;
    }
  }
  if (screen === "inventory" && code !== 0 && code === binds.code("key.inventory")) {
    e.preventDefault();
    resume();
    return;
  }
  if (screen === "inventory" && containerView) {
    if (hotbar >= 0) containerView.gui.hotbarKey(containerView.hovered, hotbar);
    if (drop) containerView.gui.dropKey(containerView.hovered, e.ctrlKey);
    if (hotbar >= 0 || drop) {
      e.preventDefault();
      refreshContainer();
    }
    return;
  }
  if (screen !== "playing") return;
  // Bound keys and F1/F3/F4 must not reach the browser (F5 reloads, Ctrl+W can close the tab).
  if (binds.binding(code) || code === 59 || code === 61 || code === 62 || (e.ctrlKey && !e.metaKey && /^Key[A-Z]$|^Space$/.test(e.code)))
    e.preventDefault();
  if (!e.repeat) {
    if (debug && debugChart && (code === 11 || (code >= 2 && code <= 10))) debugSection = selectSection(clientProfiler, debugSection, code === 11 ? 0 : code - 1); // Minecraft.b(int)
    // KeyBinding.setKeyBindState + onTick through the hash, then the binding's action.
    const d = binds.set(code, true);
    if (d) bindingPressed(d, e.ctrlKey);
    if (screen !== "playing") return;
  }
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  bindingReleased(binds.set(lwjglCode(e), false));
  keys.delete(e.code);
});
// EntityRenderer.updateCameraAndRender: with pauseOnLostFocus (F3+P) the game menu opens once the
// window has been inactive for 500 ms.
window.addEventListener("blur", () => {
  keys.clear();
  if (screen === "playing" && options.pauseOnLostFocus !== false) setTimeout(() => { if (screen === "playing" && !document.hasFocus()) pause(); }, 500);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "playing" && options.pauseOnLostFocus !== false) pause();
});
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && screen === "playing" && !lockFallback && (document.hasFocus() || options.pauseOnLostFocus !== false))
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
  // A touch button holds the binding whose default is its key.
  const d = BINDINGS.find((k) => k.defaultKey === lwjglCode(b.dataset.key))?.description;
  b.onpointerdown = (e) => {
    e.preventDefault();
    keys.add(b.dataset.key);
    binds.touch.add(d);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = b.onpointercancel = () => { keys.delete(b.dataset.key); binds.touch.delete(d); };
});
$("#touch-break").onclick = () => clickEdit(false);
$("#touch-place").onclick = () => clickEdit(true);
$("#touch-inventory").onclick = () => inventory();
$("#touch-fly").onclick = () => {
  if (survival.creative) {
    flying = !flying;
    velocity.y = 0;
  }
};
function setupPointer() {
  const canvas = scene.renderer.domElement;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (screen !== "playing") return;
    // Mouse buttons reach their KeyBinding through the hash as -100 + button (Mouse.getEventButton).
    const d = binds.set(mouseCode(e.button), true);
    if (d === "key.use") {
      useHold.press();
      edit(true);
      return;
    }
    if (d === "key.pickItem") {
      pickBlock();
      return;
    }
    if (document.pointerLockElement === canvas) {
      if (d) bindingPressed(d, e.ctrlKey);
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
    const binding = binds.set(mouseCode(e.button), false);
    bindingReleased(binding);
    if (binding === "key.use") return; // a released use button is not a left click
    if (dragging && dragDistance < 5 && e.pointerType !== "touch") clickEdit(false);
    dragging = false;
    mineHeld = false;
    if (mining && !mining.auto) mining = null;
  });
  canvas.addEventListener("pointercancel", () => {
    bindingReleased(binds.set(mouseCode(2), false));
    dragging = false;
    mineHeld = false;
    mining = null;
  });
  // A use button released outside the canvas still stops eating.
  window.addEventListener("pointerup", (e) => {
    const code = mouseCode(e.button);
    if (binds.binding(code) === "key.use" && binds.isDown("key.use")) bindingReleased(binds.set(code, false));
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
// Minecraft.runTick: MusicTicker.update (music.js) once per 50 ms client tick on every screen, including the title screen,
// except while the game is paused (the single-player game menu, and the credits, GuiWinGame also pausing). Opening the
// game menu pauses the playing streams (SoundHandler.pauseSounds) and closing it resumes them.
let musicTicker = null, musicTime = 0, streamsPaused = false;
function tickMusic(dt) {
  if (!sounds) return;
  const menu = screen === "paused" && lan.paused(true);
  if (menu !== streamsPaused) {
    streamsPaused = menu;
    if (menu) sounds.pauseStreams();
    else sounds.resumeStreams();
  }
  if (menu || (screen === "credits" && lan.paused(true))) return;
  musicTicker ??= new MusicTicker({ play: (event) => sounds.playStream(event), stop: (h) => sounds.stop(h), isPlaying: (h) => sounds.isPlaying(h) });
  for (musicTime += dt; musicTime >= PHYSICS.tick; musicTime -= PHYSICS.tick) {
    musicTicker.update(ambientMusicType({
      credits: screen === "credits", inWorld: screen !== "home" || tripLoading, dimension: world?.dimension ?? 0,
      bossName: bossStatus.name, bossFrames: bossStatus.length, creative: !!survival?.creative,
    }));
    if (screen !== "home") (cartSounds ??= new CartSounds(sounds)).tick(minecarts?.carts ?? [], rider);
    sounds.tick();
    sounds.updateStreams();
  }
}
// GuiIngame's debug screen on every screen but the title: the playing, inventory and menu frames all call it (GuiIngame renders before the screen).
function updateDebugOverlay() {
  // GuiIngame debug screen (debug-overlay.js). Counts that the port has no native source for are sampled four times a second.
  const eyeY = position.y + PHYSICS.eye - motion.ySize, bx = floorD(position.x), by = floorD(eyeY), bz = floorD(position.z), ms = performance.now();
  if (Math.floor(elapsed) !== debugSecond.at) { debugSecond.shown = (scene.chunkUpdates || 0) - debugSecond.updates; debugSecond.updates = scene.chunkUpdates || 0; debugSecond.at = Math.floor(elapsed); }
  if (ms - debugCache.at > 250) {
    const pts = [];
    for (const m of mobs?.entities || []) pts.push([m.x, m.y + 0.9, m.z, 1.5]);
    for (const i of items.items) pts.push([i.x, (i.posY ?? i.y ?? 0) + 0.125, i.z, 0.5]);
    for (const o of xpOrbs.orbs) pts.push([o.x, o.y, o.z, 0.5]);
    for (const c of [...(minecarts?.carts || []), ...boats.carts]) pts.push([c.x, c.posY ?? c.y ?? 0, c.z, 1.5]);
    for (const h of hanging.entities) pts.push([h.x, h.y ?? 0, h.z, 1]);
    const col = columnStats(world, bx >> 4, bz >> 4);
    debugCache = { at: ms, renders: rendererStats(scene, world), entities: entityStats(scene, pts, { thirdPerson: thirdPersonView > 0 }), topSegment: col.topSegment, height: heightValue(world, bx, bz) };
  }
  const loaded = !world.chunkAt || !!world.chunkAt(bx >> 4, bz >> 4), lv = scene.light, biome = world.biomeAt?.(bx, bz)?.name ?? "Unknown";
  const u = guiScale(innerWidth, innerHeight, Number(options.guiScale) || 0);
  debugOverlay.update({
    u, scaledWidth: Math.ceil(innerWidth / u), w: innerWidth, h: innerHeight, mem: readMemory(),
    pie: debugChart ? { list: clientProfiler.results(debugSection) } : null,
    left: {
      fps, chunkUpdates: debugSecond.shown, renders: debugCache.renders, entities: debugCache.entities, particles: scene.effectRenderer.count(),
      chunkCache: world.chunks?.size ?? scene.chunks.size, x: position.x, z: position.z, feetY: position.y, eyeY, yaw: nativeYaw(yaw), onGround: grounded && !flying, height: debugCache.height,
      walkSpeed: WALK_SPEED, flySpeed: FLY_SPEED,
      light: loaded && by >= 0 && by < 256 ? { topSegment: debugCache.topSegment, biome, block: lv ? lv.blockAt(bx, by, bz) : 0, sky: lv ? lv.skyAt(bx, by, bz) : 15, real: lv ? lv.level(bx, by, bz, 0) : 15 } : null,
    },
  });
}
// F3+B: every rendered entity's native box (debug-keys.js); the view entity only in third person.
function debugHitboxList() {
  const live = (e) => !world.streaming || world.isLoaded(e.x, e.z);
  return collectHitboxes({
    mobs: (mobs?.entities ?? []).filter(live), items: items.items, orbs: xpOrbs.orbs, carts: minecarts?.carts ?? [], boats: boats.carts, hanging: hanging.entities, tnt: primed,
    arrows: arrows.list, balls: [...projectiles.balls, ...(mobs?.potions?.projectiles?.balls ?? [])], rockets: rockets.rockets, fireballs: [...(mobs?.fireballs?.list ?? []), ...(mobs?.skulls?.list ?? [])],
    player: thirdPersonView > 0 ? { x: position.x, y: position.y - motion.ySize, z: position.z } : null,
  });
}
function animate(now) {
  requestAnimationFrame(animate);
  // Max Framerate: Display.sync(getLimitFramerate()) below Unlimited (frame-limit.js).
  if (!frameLimiter.ready(now, limitFramerate({ world: screen !== "home", screen: gui.open, maxFps: options.maxFps ?? 120 }))) return;
  // F1 (GameSettings.hideGUI): GuiIngame is drawn only while a screen is open.
  document.body.classList.toggle("hide-gui", hideGUI && screen === "playing" && !gui.open);
  sidebarFrame();
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
  const running = () => screen === "playing" || screen === "inventory" || (screen === "paused" && (multiplayer || !lan.paused(true)));
  { const want = debug && debugChart; if (clientProfiler.enabled !== want) { clientProfiler.clear(); clientProfiler.enabled = want; } clientProfiler.section = ""; clientProfiler.sections.length = 0; clientProfiler.stamps.length = 0; clientProfiler.start("root"); } // Minecraft.runGameLoop: profiler on while Shift+F3
  tickMusic(dt);
  if (running()) {
    accumulator += dt;
    while (accumulator >= PHYSICS.tick && running()) {
      profilerTick(profiler); // MinecraftServer.tick: /debug start takes effect here
      tickCounter++;
      gui.tick(); // Minecraft.runTick: currentScreen.updateScreen (sign editor blink)
      tickProf.start("root");
      tickProf.start("particles");
      updateParticleOptions();
      // --- Block particles (particles.js): Entity.onEntityUpdate's sprint particle uses the
      // pre-move position, last tick's motion and in-water flag, before movementTick moves the
      // player; EffectRenderer.updateEffects then runs after this tick's spawns. ---
      if (motion.sprinting) spawnRunningParticles(scene.particles, world, { x: position.x, y: position.y, z: position.z, mx: velocity.x, mz: velocity.z, sprinting: true, inWater: wasInWater, ySize: motion.ySize }, playerRandom, [position.x, position.y + PHYSICS.eye, position.z]);
      tickProf.endStart("tick");
      world.ringReads = !!world.ringSink; // simulation reads see the ring columns; meshing, light and the window shift do not
      try { movementTick(captureMovementInput(bedSleep.sleeping ? () => false : (d) => binds.isDown(d))); } finally { world.ringReads = false; } // a sleeping player ignores the keys
      tickProf.endStart("bed");
      if (!multiplayer) tickBed();
      tickProf.endStart("effects");
      scene.effectRenderer.tick(world);
      tickProf.endStart("player");
      // The model stands at posY - yOffset, and posY is lowered by ySize (the sneak drop).
      const lowered = (p, drop) => ({ x: p.x, y: p.y - drop, z: p.z });
      if (!multiplayer) playerBody.tick({ position: lowered(position, motion.ySize), previous: lowered(previous, motion.prevYSize), yaw, pitch, swinging: animation.swingTime < SWING_SECONDS, riding: !!rider.vehicle });
      // EntityRenderer.updateRenderer: the cinematic camera filters advance once per tick.
      mouseLook.tick(options.sensitivity, smoothCamera);
      tickProf.end();
      tickProf.end();
      accumulator -= PHYSICS.tick;
    }
    const t = multiplayer ? Math.min(1, Math.max(0, (performance.now() - (multiplayer.at ?? performance.now())) / 50)) : accumulator / PHYSICS.tick;
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
    // The held wool's colour (stack damage) rides along with the displayed item, and so do the spawn egg's mob and the potion's effects (their render passes, item-passes.js).
    pose.meta = pose.item === WOOL || pose.item === RED_FLOWER || pose.item === DYE || pose.item === ITEM_SPAWN_EGG || pose.item === ITEM_POTION || [2,6,56,58,4,5,7,48,70,71].includes(pose.item) ? survival.held?.damage || 0 : 0;
    const b = pose.bob;
    scene.camera.position.x += b.x * Math.cos(yaw);
    scene.camera.position.z -= b.x * Math.sin(yaw);
    scene.camera.position.y += b.y;
    // EntityRenderer.hurtCameraEffect with the frame's partial tick (damage-fx.js); the roll is a GL angle, which
    // the camera's z rotation shares, so `- hurt` below adds it.
    const hurt = -(hurtCameraRoll({ hurtTime: survival.hurtTime, health: survival.health }, Math.min(1, accumulator / PHYSICS.tick)) * Math.PI) / 180;
    scene.camera.rotation.set(pitch + b.rx, yaw, b.rz - hurt, "YXZ");
    if (bedSleep.sleeping) {
      // EntityRenderer.orientCamera while sleeping: glTranslatef(0, 0.3, 0), glRotatef(bed meta * 90, 0, 1, 0), and the
      // player's yaw/pitch turns cancel against the common ones, then glTranslatef(0, yOffset - 1.62 + 1 = -0.42, 0).
      // The eye is posY + 0.12, just over the lying head, looking level along the bed towards its foot.
      const [hx, hz] = BED_DIR[bedSleep.facing];
      scene.camera.position.set(bedSleep.pos.x, bedSleep.pos.y + SLEEP_EYE_RISE, bedSleep.pos.z);
      scene.camera.rotation.set(0, Math.atan2(hx, hz), 0, "YXZ");
      if (bedEase) {
        const t = Math.min(1, (performance.now() - bedEase.start) / BED_EASE_MS), e = t * t * (3 - 2 * t); // smoothstep
        if (t >= 1) bedEase = null;
        else {
          scene.camera.position.lerpVectors(bedEase.position, scene.camera.position, e);
          scene.camera.quaternion.slerpQuaternions(bedEase.quaternion, scene.camera.quaternion.clone(), e);
        }
      }
    } else bedEase = null;
    animate.pose = pose;
    const dir = new THREE.Vector3();
    scene.camera.getWorldDirection(dir);
    // Mining and picking start at the player's eye in every view.
    const aim = scene.camera.position.clone();
    if (thirdPersonView && !bedSleep.sleeping) {
      // EntityRenderer.orientCamera: back off from the eye, pulled in by the world. A sleeper takes the bed branch instead.
      const cam = thirdPersonCamera(world, aim, yaw, pitch, thirdPersonView);
      scene.camera.position.set(...cam.position);
      scene.camera.rotation.set(cam.rotation.x + (thirdPersonView === 2 ? -b.rx : b.rx), cam.rotation.y, b.rz - hurt, "YXZ");
    }
    target = raycast(
      clientWorld(),
      aim,
      dir,
      survival.creative ? 5 : 4.5,
    );
    eyeRay = { origin: [aim.x, aim.y, aim.z], dir: [dir.x, dir.y, dir.z] };
    mobs.knotBoxOf ??= (k) => aimKnotBox(objectTracker, k, (live) => { const c = live.summoned ? [live.px, live.py, live.pz] : [live.x + 0.5, live.y + 0.5, live.z + 0.5]; return [c[0] - 0.25, c[1], c[2] - 0.25, c[0] + 0.25, c[1] + 0.5, c[2] + 0.25]; }); // Batch 50: a leash knot is aimed through its client copy's box
    aimedEntity = mobs.pick(
      aim,
      dir,
      survival.creative ? 6 : 3,
      target?.distance ?? 6,
    );
    // EntityRenderer.getMouseOver: the nearest entity box (a cart grown by its 0.1 border) wins.
    aimedCart = pickMinecart(minecarts, aim, dir, survival.creative ? 6 : 3, target?.distance ?? 6, rider.vehicle, (c) => aimBox(objectTracker, c, rider.vehicle === c)); // Batch 49: the client copy's box, the live entity answers
    const aimedBoat = pickMinecart(boats, aim, dir, survival.creative ? 6 : 3, target?.distance ?? 6, rider.vehicle, (c) => aimBox(objectTracker, c, rider.vehicle === c));
    if (aimedBoat && (!aimedCart || aimedBoat.distance < aimedCart.distance)) aimedCart = aimedBoat;
    if (aimedCart && aimedEntity && aimedEntity.distance <= aimedCart.distance) aimedCart = null;
    if (aimedCart) aimedEntity = null;
    // EntityRenderer.getMouseOver: a painting or frame (box grown by 0.1) nearer than the block and any mob/cart.
    aimedHanging = pickHanging(hanging, aim, dir, survival.creative ? 6 : 3, target?.distance ?? 6, (e) => aimBox(objectTracker, e));
    if (aimedHanging && ((aimedEntity && aimedEntity.distance <= aimedHanging.distance) || (aimedCart && aimedCart.distance <= aimedHanging.distance))) aimedHanging = null;
    if (aimedHanging) { aimedEntity = null; aimedCart = null; }
    scene.outline.visible = !hideGUI && !!target && !aimedEntity && !aimedCart && !aimedHanging; // drawSelectionBox skips while hideGUI
    if (target) {
      // getSelectedBoundingBoxFromPool after setBlockBoundsBasedOnState (world.js selectionBounds: slabs, stairs, fences, plants, snow,
      // ladders, cactus...; block-sweep-reference.json). The outline is the box grown by 0.002.
      const [x0, y0, z0, x1, y1, z1] = selectionBounds(world, ...target.block);
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
    if (debug) updateDebugOverlay();
    if (elapsed - lastSave > 5) save();
    scene.effects.crack(mining?.block, mining?.progress);
  } else if (screen === "dead") {
    // GuiGameOver does not pause the game. Here only EntityLivingBase.onDeathUpdate and the
    // particles keep ticking (the rest of the world waits on the death screen): at deathTime
    // 20 the client player, still 0.6 x 1.8 (onDeath's setSize runs on the server), goes up
    // in 20 "explode" from posY, which is its eye.
    accumulator += dt;
    while (accumulator >= PHYSICS.tick) {
      gui.tick(); // GuiGameOver / GuiYesNo updateScreen: the 20-tick button delay counts these client ticks
      survival.hurtTime = Math.max(0, survival.hurtTime - 1);
      { const feet = { x: position.x, y: position.y - motion.ySize, z: position.z }; playerBody.tick({ position: feet, previous: feet, yaw, pitch }); } // limb swing settles; the head and body stay put
      if (++deathTime === 20) burst(scene.fx, "explode", 20, { x: position.x, y: position.y + Math.fround(PHYSICS.eye), z: position.z, width: PHYSICS.width, height: PHYSICS.height }, playerRandom);
      scene.effectRenderer.tick(world);
      accumulator -= PHYSICS.tick;
    }
    // EntityRenderer.hurtCameraEffect: a dead view rolls 40 - 8000 / (deathTime + partial + 200)
    // degrees about the view axis (the same sign convention as the hurt tilt and view bob).
    const roll = (hurtCameraRoll({ hurtTime: survival.hurtTime, health: 0, deathTime }, Math.min(1, accumulator / PHYSICS.tick)) * Math.PI) / 180;
    scene.camera.rotation.z = roll;
  } else if (screen === "home") scene.preview(elapsed);
  if (debug && screen !== "home" && !running()) updateDebugOverlay();
  const partial = Math.min(1, accumulator / PHYSICS.tick);
  // TileEntityMobSpawnerRenderer: the spinning display mob of each spawner within 64 blocks.
  const shown = spawners?.size && screen !== "home" ? spawners.values().filter((sp) => (sp.x + 0.5 - position.x) ** 2 + (sp.y + 0.5 - position.y) ** 2 + (sp.z + 0.5 - position.z) ** 2 < 4096).map((sp) => spawnerDisplayEntity(sp, partial)).filter(Boolean) : [];
  if (minecarts && screen !== "home") for (const c of vehicleViews(objectTracker, minecarts.carts, (live) => rider.vehicle === live)) if (c.type === 4 && (c.x - position.x) ** 2 + (c.posY - position.y) ** 2 + (c.z - position.z) ** 2 < 4096) { const d = cartSpawnerDisplayEntity(minecarts, world, c, partial); if (d) shown.push(d); }
  if (mobs) horseGearRenderer?.update(screen === "home" ? [] : mobs.gearViews(), { holder: { x: position.x, y: position.y, z: position.z }, camera: position, looked: mobs.gearViewOf(aimedEntity), sneaking: !!motion.sneaking, knots: knotViews(objectTracker, mobs.knotList ?? []) }); // Batch 48: the knot copies
  if (mobs) mobRenderer.update([...(world.streaming ? mobs.entities.filter(e=>world.isLoaded(e.x,e.z)) : mobs.entities), ...shown],dt,partial,180 - yaw * 180 / Math.PI,(e) => mobs.clientPosition(e));
  // Batch 48: drawn from the client copies (object-tracker.js vehicleViews / hangingViews); the boat or cart the client player rides keeps the live entity
  const drawn = (x, z) => !world.streaming || world.isLoaded(x, z), rides = (live) => rider.vehicle === live;
  minecartRenderer?.update(screen === "home" || !minecarts ? [] : vehicleViews(objectTracker, minecarts.carts, rides, drawn), partial, world);
  boatRenderer?.update(screen === "home" ? [] : vehicleViews(objectTracker, boats.carts, rides, drawn), partial, world);
  hangingRenderer?.update(screen === "home" ? [] : hangingViews(objectTracker, hanging.entities, drawn));
  if (screen !== "home") { hitboxes ??= new HitboxRenderer(scene.scene); hitboxes.update(debugHitbox ? debugHitboxList() : null); } // RenderManager.debugBoundingBox
  signRenderer?.update(screen === "home" ? [] : [...signs.tiles.values()], world, position);
  skullRenderer?.update(screen === "home" ? [] : [...SKULLS.tiles.values()], world, position);
  enchantBookRenderer?.update(screen === "home" ? [] : [...enchantBooks.tiles.values()], world, position, partial);
  enchantExtras?.frame(partial);
  beaconRenderer?.update(screen === "home" ? [] : [...beacons.tiles.values()], world, survival.time, partial);
  tntRenderer?.update(screen === "home" ? [] : objectViews(objectTracker, primed, "tnt"), partial);
  redstoneRuntime?.frame(screen === "home" ? 1 : partial);
  recordHud.frame(partial);
  playerRenderer?.update(playerBody, partial, {
    // RenderGlobal draws the view entity in first person too while it is sleeping (isPlayerSleeping).
    // The death screen keeps drawing the dying model until onDeathUpdate's setDead at deathTime 20 removes the entity.
    visible: (thirdPersonView > 0 || bedSleep.sleeping) && (["playing", "inventory", "paused"].includes(screen) || (screen === "dead" && deathTime < 20)),
    deathTime: screen === "dead" ? deathTime : 0,
    sleeping: bedSleep.sleeping ? { pos: bedSleep.pos, offset: bedSleep.offset, facing: bedSleep.facing } : null,
    swing: animate.pose ? (animate.pose.progress < 1 ? animate.pose.progress : 0) : 0,
    armor: survival?.inventory?.armor ?? [],
    held: heldId(),
    heldDamage: survival.held?.damage || 0,
    heldColor: survival.held?.color,
    heldGlint: stackHasEffect(survival.held, ITEMS[survival.held?.id]),
    blocking: !!eating?.block,
    hurt: survival.hurtTime > 0,
    sneak: motion.sneaking,
    riding: !!rider.vehicle,
    arrowCount: survival.arrowCount,
    arrowEntityId: playerBody.entityId,
    burning: survival.fire > 0,
    fireViewYaw: 180 - yaw * 180 / Math.PI,
    invisible: survival.effects.has(INVISIBILITY),
  });
  if (screen === "inventory") { paperdollFrame(); horsePreviewFrame(); }
  chestRenderer?.update(running() ? accumulator / PHYSICS.tick : 1);
  endPortalRenderer?.update(world, position, performance.now() / 1000);
  if(xpRenderer)xpRenderer.update(objectViews(objectTracker, residentOnly(world,xpOrbs.orbs), "orb"),partial); // ring orbs are not drawn (headless-env.js)
  scene.dropPartial = partial;
  scene.particleView = { yaw, pitch, mirror: thirdPersonView === 2 };
  // EntityRenderer's potion terms (potion-fx.js): Night Vision / Blindness durations, the Nausea warp amount and the player's feet height.
  const potionEffects = screen === "home" ? null : survival?.effects;
  scene.potionView = potionEffects ? { nightVision: potionEffects.get(NIGHT_VISION)?.duration ?? 0, blindness: potionEffects.get(BLINDNESS)?.duration ?? 0, waterBreathing: potionEffects.has(13), respiration: getRespiration(survival.inventory.armor), nausea: potionEffects.has(NAUSEA), warp: portalTimer.amount(partial), feetY: position.y, eyeY: position.y + PHYSICS.eye, creative: survival.mode === "creative" } : null;
  scene.setShadows(screen === "home" ? [] : shadowCasters(scene.dropPartial), { x: position.x, y: position.y + PHYSICS.eye, z: position.z });
  // EntityRenderer.getFOVModifier multiplies the field of view by the eased modifier.
  // getFOVModifier: x 60 / 70 while the view block is water (fire-fx.js worldFov).
  const fov = worldFov(options.fov * (bowFovState.prev + (bowFovState.cur - bowFovState.prev) * partial), viewpointBlock(world, scene.camera.position.x, scene.camera.position.y, scene.camera.position.z) === 10);
  if (Math.abs(scene.camera.fov - fov) > 1e-9) {
    scene.camera.fov = fov;
    scene.camera.updateProjectionMatrix();
  }
  // The title and world screens cover the view; a paused world still draws behind its menu.
  clientProfiler.start("render");
  remotePlayers?.frame();
  if (screen !== "home") scene.render(elapsed, dt);
  clientProfiler.end();
  clientProfiler.end();
  if (firstPerson && animate.pose)
    firstPerson.render(animate.pose, {
      // EntityRenderer.renderHand: first person only, and never while the player is sleeping.
      visible: thirdPersonView === 0 && !bedSleep.sleeping && !hideGUI && ["playing", "inventory", "paused"].includes(screen),
      light: scene.brightness(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z),
      view: scene.camera,
      time: elapsed,
      eating: eating && !eating.bow && !eating.block ? Math.max(0,eating.ticks-accumulator/PHYSICS.tick) : null,
      // The bow's icon follows the whole ticks of draw; its pull uses the ticks - 1 + partial.
      bow: eating?.bow ? { stage: bowStage(eating.ticks), draw: eating.ticks - 1 + partial } : null,
      blocking: !!eating?.block, // ItemRenderer: a sword in use (EnumAction.block)
      glint: stackHasEffect(survival.held, ITEMS[survival.held?.id]),
      color: survival.held?.color,
      map: survival.held?.id === ITEM_FILLED_MAP ? { data: mapStore.get(survival.held.damage | 0) } : null, // ItemRenderer's map branch
      pitchDeg: -pitch / (Math.PI / 180),
    });
  // ItemRenderer.renderOverlays (fire-fx.js, screen-overlays.js): fire, the inside-of-block darkening and the water tint, over the hand.
  if (screenOverlays && screen !== "home" && ["playing", "inventory", "paused"].includes(screen)) {
    const eye = playerEye(), posY = position.y + PHYSICS.eye, inside = clientInsideOpaque(insideOpaqueBlock, world, position.x, posY, position.z, 0.6, bedSleep.sleeping);
    screenOverlays.render({
      burning: survival.fire > 0, thirdPerson: thirdPersonView, sleeping: bedSleep.sleeping, inWater: clientEyeInWater(), viewInWater: viewpointBlock(world, scene.camera.position.x, scene.camera.position.y, scene.camera.position.z) === 10,
      insideBlock: inside ? insideOverlayBlock((x, y, z) => world.get(x, y, z), position.x, posY, position.z, 0.6, 1.8) : 0,
      brightness: playerBrightness((x, y, z) => scene.light.level(x, y, z, scene.subtracted), BRIGHTNESS, position.x, position.y, position.z, 1.8, !!scene.light),
      yawDeg: eye.yaw, pitchDeg: eye.pitch, tick: elapsed * 20, aspect: innerWidth / innerHeight,
    });
  }
  if (screen !== "home") scene.endFrame(); // post shaders / anaglyph merge, after the hand
}
// Entities that cast a shadow, as Java positions: an item's posY is 0.125
// above its box (yOffset); items, orbs and mobs are interpolated like their
// renderers, with `pos` the tick position for the shadow's distance test.
function shadowCasters(partial) {
  const list = [], lerp = (a, b) => a + (b - a) * partial;
  for (const e of objectViews(objectTracker, items.items, "item"))
    if (e.stack) list.push({ ...SHADOWS.item, x: lerp(e.px, e.x), y: lerp(e.py, e.y) + 0.125, z: lerp(e.pz, e.z), pos: { x: e.x, y: e.y + 0.125, z: e.z }, height: 0.25 });
  // RenderTNTPrimed: shadowSize 0.5 under the box (posY is its centre).
  for (const e of objectViews(objectTracker, primed, "tnt")) list.push({ ...SHADOWS.tnt, x: lerp(e.px, e.x), y: lerp(e.py, e.y) + TNT_Y_OFFSET, z: lerp(e.pz, e.z), pos: { x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z }, height: TNT_SIZE });
  for (const o of objectViews(objectTracker, xpOrbs.orbs, "orb")) list.push({ ...SHADOWS.orb, x: lerp(o.px, o.x), y: lerp(o.py, o.y) + 0.25, z: lerp(o.pz, o.z), pos: { x: o.x, y: o.posY, z: o.z }, height: 0.5 });
  // The local player casts a shadow only when it is on screen.
  // A sleeper is rendered in first person too (RenderGlobal), so its shadow draws at the bed position in every view.
  if (bedSleep.sleeping && !survival.effects.has(INVISIBILITY)) list.push(sleeperShadowCaster(bedSleep.pos, SHADOWS.player));
  else if (thirdPersonView > 0 && !survival.effects.has(INVISIBILITY)) list.push(playerShadowCaster(position, previous, partial, SHADOWS.player, motion.prevYSize, motion.ySize));
  // RenderBoat: shadowSize 0.5; getShadowSize is 0, so `height` 0 keeps the cast at the boat's posY.
  for (const b of vehicleViews(objectTracker, boats.carts, (live) => rider.vehicle === live, (x, z) => !world.streaming || world.isLoaded(x, z))) list.push({ ...SHADOWS.boat, x: lerp(b.px, b.x), y: lerp(b.py, b.posY), z: lerp(b.pz, b.z), pos: { x: b.x, y: b.posY, z: b.z }, height: 0 });
  // RenderMinecart: shadowSize 0.5, EntityMinecart.getShadowSize 0 (the same cast as the boat's, from the copy view).
  if (minecarts) for (const c of vehicleViews(objectTracker, minecarts.carts, (live) => rider.vehicle === live, (x, z) => !world.streaming || world.isLoaded(x, z))) list.push({ ...SHADOWS.minecart, x: lerp(c.px, c.x), y: lerp(c.py, c.posY), z: lerp(c.pz, c.z), pos: { x: c.x, y: c.posY, z: c.z }, height: 0 });
  for (const e of mobs?.entities ?? []) {
    const child = e.growingAge < 0;
    // RendererLivingEntity passes Render.doRenderShadowAndFire no shadow for an invisible mob.
    if (SHADOWS[e.type] && !isInvisible(e)) { const c = mobs.clientPosition(e) ?? e; list.push({ ...SHADOWS[e.type], x: lerp(c.px, c.x), y: lerp(c.py, c.y), z: lerp(c.pz, c.z), pos: e, height: ENTITY_TYPES[e.type].height * (child ? 0.5 : 1), child }); }
  }
  return list;
}
async function boot(){try {
  try { await acquireWorldWriter(); worldWriterAvailable = true; }
  catch { worldWriterAvailable = false; } // another local-save owner must not prevent multiplayer-only tabs
  // Read the shelf under ownership: another tab may have finished a save while
  // this page was starting up, before the browser granted its lock.
  if (worldWriterAvailable) {
    try {const shelf=JSON.parse(localStorage.getItem(storageKey)||'[]');worlds=Array.isArray(shelf)?shelf:[];}catch{worlds=[];}
    try { worlds = await readWorldShelf(worlds); } catch (e) { worlds = []; worldsError = String(e?.message ?? e); }
  } else worlds = [];
  scene = new VoxelScene($("#viewport"));
  if (meshWorkersEnabled()) scene.setMeshPool(new MeshPool()); // column meshes in workers; ?meshWorkers=0 keeps them on the page thread
  scene.post.anaglyph = () => !!options.anaglyph; // GameSettings.anaglyph (options.txt anaglyph3d)
  scene.weather = weather;
  projectiles.useEffects(scene.effectRenderer);
  projectiles.spawner = scene.fx;
  projectiles.clientParticles = true; // impacts are the client copies' (object-tracker.js)
  arrows.fx = null; // the crit trail, bubbles and splash of an arrow are drawn by its client copy
  bindObjectTracker();
  await scene.textures.ready;
  xpRenderer=new ExperienceRenderer(scene.scene);
  sounds = new SoundBank(
    () => options,
    // SoundManager.setListener (probed): the player's posY (the eye, lowered by ySize while sneaking) interpolated by the partial tick, and the look.
    () => {
      const t = Math.min(1, accumulator / PHYSICS.tick);
      return {
        x: previous.x + (position.x - previous.x) * t,
        y: previous.y + (position.y - previous.y) * t + PHYSICS.eye - motion.drop(t),
        z: previous.z + (position.z - previous.z) * t,
        yaw, pitch, inWorld: screen !== "home",
        feet: { x: position.x, y: position.y, z: position.z }, // the server's position of the player, for the S29 range (sound-origin.js)
      };
    },
  );
  firstPerson = new FirstPerson(scene.renderer, scene.textures.texture, scene.lighting);
  screenOverlays = new ScreenOverlays(scene.renderer, scene.textures.texture);
  mobRenderer = new MobRenderer(scene.scene, scene);
  horseGearRenderer = new HorseGearRenderer(scene.scene);
  playerRenderer = new PlayerRenderer(scene.scene, scene, scene.textures.texture);
  chestRenderer = new ChestRenderer(scene.scene, scene);
  endPortalRenderer = new EndPortalRenderer(scene.scene);
  beaconRenderer = new BeaconRenderer(scene.scene);
  tntRenderer = new TntRenderer(scene.scene, scene);
  minecartRenderer = new MinecartRenderer(scene.scene, scene, null);
  boatRenderer = new BoatRenderer(scene.scene, scene, boats);
  hangingRenderer = new HangingRenderer(scene.scene, scene);
  signRenderer = new SignRenderer(scene.scene, scene);
  skullRenderer = new SkullRenderer(scene.scene, scene);
  enchantBookRenderer = new EnchantingBookRenderer(scene.scene, scene);
  document.addEventListener("pointerdown", () => sounds.unlock(), {
    once: true,
  });
  world = new World("Overworld");
  scene.setWorld(world);
  scene.camera.fov = options.fov;
  scene.camera.updateProjectionMatrix();
  scene.setDistance(renderDistanceBlocks(options.distance));
  scene.setGamma(Number(options.gamma) || 0);
  scene.setRenderSettings(options);
  updateParticleOptions();
  setupPointer();
  // Development-only handle for browser checks; Vite strips it from builds.
  if (import.meta.env.DEV)
    window.__mc = { scene, dims, travel: (d) => dims.travel(d), get editActions() { return structuredClone(editActionLog); }, get survival() { return survival; }, get world() { return world; }, get streamStorage() { return streamStorage; }, get containerResidency() { return containerResidency; }, position, velocity, motion, get flying() { return flying; }, get grounded() { return grounded; }, look(p, y) { pitch = p; yaw = y; }, view(n) { thirdPersonView = n; }, playerBody, teleport(x, y, z) { position.set(x, y, z); }, items, projectiles, arrows, eyes, rockets, get objectTracker() { return objectTracker; }, get mobs() { return mobs; }, get rider() { return rider; }, get minecarts() { return minecarts; }, get boats() { return boats; }, get hanging() { return hanging; }, get aimedHanging() { return aimedHanging; }, fishing, get target() { return target; }, get redstone() { return redstoneRuntime; }, get spawners() { return spawners; }, get aimedCart() { return aimedCart; }, save, breakBlock, get weather() { return weather; }, commands, chatUi, get chatOpen() { return chatOpen; }, get commandHost() { return commandHost; }, openChat, closeChat, get fire() { return fire; }, get trees() { return trees; }, get plants() { return plants; }, get falling() { return falling; }, get primed() { return primed; }, get xpOrbs() { return xpOrbs; }, get experience() { return experience; }, get sounds() { return sounds; }, explodeAt, lightTnt, useBed, get bedSleep() { return bedSleep; }, get playerRenderer() { return playerRenderer; } };
  if (import.meta.env.DEV) Object.defineProperty(window.__mc, 'multiplayer', { get: () => multiplayer });
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
