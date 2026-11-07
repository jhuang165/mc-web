// Hardcore mode (1.7.10): the WorldInfo hardcore flag and everything the GUI and the server tie to it.
// Evidence is bytecode-read, not probed (public/research/hardcore.md): GuiCreateWorld (bdb), GuiGameOver (bdc), GuiOptions (bdm),
// GuiSelectWorld.List (bdy), MinecraftServer.func_147139_a (setDifficultyForAllWorlds) and NetHandlerPlayServer.processClientStatus (nh).
import { HARD, difficultySetting } from "./difficulty.js";

// --- GuiCreateWorld.actionPerformed id 2 (the game mode button) ---
// Fields: r = game mode ("survival" | "hardcore" | "creative"), t = Allow Cheats, u = Allow Cheats pressed by hand, w = hardcore flag,
// v = Bonus Chest. Survival -> Hardcore -> Creative -> Survival. The Bonus Chest (C) and Allow Cheats (E) buttons are disabled
// while the mode is hardcore, and the created WorldSettings drops both (`v && !w`, `t && !w`).
export function createModeState(mode = "survival") {
  return { mode: mode === "hardcore" || mode === "creative" ? mode : "survival", allowCommands: false, manualCommands: false, hardcore: mode === "hardcore", bonus: false };
}
export function cycleCreateMode(state) {
  if (state.mode === "survival") {
    if (!state.manualCommands) state.allowCommands = false;
    state.mode = "hardcore"; state.hardcore = true;
  } else if (state.mode === "hardcore") {
    if (!state.manualCommands) state.allowCommands = true;
    state.hardcore = false; state.mode = "creative";
  } else {
    if (!state.manualCommands) state.allowCommands = false;
    state.mode = "survival"; state.hardcore = false;
  }
  return state;
}
// GuiCreateWorld.func_146319_h: what the two buttons show and whether they can be pressed.
export const cheatsButtonEnabled = (state) => !state.hardcore;
export const cheatsShownOn = (state) => state.allowCommands && !state.hardcore;
export const bonusShownOn = (state) => state.bonus && !state.hardcore;
// The game mode key GuiCreateWorld gives GameType.getByName: "hardcore" is not a type name, so it is Survival with the flag.
export function createdWorldFlags(state) {
  return {
    mode: state.mode === "creative" ? "creative" : "survival",
    hardcore: state.mode === "hardcore",
    allowCommands: state.allowCommands && state.mode !== "hardcore",
    bonusChest: state.bonus && state.mode !== "hardcore",
  };
}
// GuiCreateWorld.func_146318_a (Re-Create): a hardcore world comes back as the Hardcore mode.
export const createModeOf = (record) => (record?.hardcore === true ? "hardcore" : record?.mode === "creative" ? "creative" : "survival");

// --- Difficulty ---
// MinecraftServer.func_147139_a: a world whose WorldInfo is hardcore runs on Hard whatever the setting says (and spawns both mob
// kinds); other singleplayer worlds take GameSettings.difficulty. The setting itself is not changed, so it applies again in other worlds.
export const worldDifficulty = (record, setting) => (record?.hardcore === true ? HARD : difficultySetting(setting));
// GuiOptions.initGui: with a hardcore world loaded the difficulty button is disabled and reads "Difficulty: Hardcore".
export const difficultyLocked = (record) => record?.hardcore === true;

// --- GuiSelectWorld.List.drawSlot third line ---
// A hardcore world shows gameMode.hardcore in dark red (EnumChatFormatting.DARK_RED, then RESET) in place of its game mode.
export const HARDCORE_COLOR = 0xaa0000;
export const isHardcoreRecord = (record) => record?.hardcore === true;

// --- GuiGameOver ---
// initGui: hardcore + integrated server -> one button, id 1 "Delete world" (centre - 100, h/4 + 96); hardcore on a server ->
// "Leave server"; otherwise Respawn (id 0, h/4 + 72) and Title screen (id 1, h/4 + 96). Every button starts disabled and enables
// when the screen's tick counter reaches 20. actionPerformed: id 0 respawns; id 1 opens GuiYesNo("Are you sure you want to quit?",
// "", "Title screen", "Respawn") with a 20 tick button delay, whose Title screen answer leaves the world and whose Respawn answer
// sends the respawn packet. In a hardcore singleplayer world the server answers that packet with the kick "You have died. Game
// over, man, it's game over!" and deleteWorldAndStopServer (nh bytecode), which is what removes the world.
export const GAME_OVER_ENABLE_TICKS = 20;
export function gameOverView(hardcore) {
  if (hardcore) {
    return {
      titleKey: "deathScreen.title.hardcore", infoKey: "deathScreen.hardcoreInfo", infoY: 144,
      buttons: [{ id: 1, key: "deathScreen.deleteWorld", y: 96 }],
    };
  }
  return {
    titleKey: "deathScreen.title", infoKey: null,
    buttons: [{ id: 0, key: "deathScreen.respawn", y: 72 }, { id: 1, key: "deathScreen.titleScreen", y: 96 }],
  };
}
// GuiGameOver.confirmClicked and the hardcore server branch: what each answer of the quit confirmation does.
export function gameOverConfirm(hardcore, titleScreenChosen) {
  if (titleScreenChosen) return "title";
  return hardcore ? "deleteWorld" : "respawn";
}
export const HARDCORE_KICK = "You have died. Game over, man, it's game over!";

// --- World deletion ---
// Every storage id a world occupies: its own record (shelf entry, chunk columns, runtime and container columns) and the Nether and
// End views (`${id}~-1`, `${id}~1`). deleteStored(id) is world-storage.js deleteStoredWorld.
export const storedWorldIds = (record) => [record.id, `${record.id}~-1`, `${record.id}~1`]; // dimension-live.js viewId
export async function deleteWorldStorage(record, deleteStored) {
  const failed = [];
  for (const id of storedWorldIds(record)) {
    try { await deleteStored(id); } catch (error) { failed.push({ id, error }); }
  }
  return failed;
}
