// Batch 74 mpmisc74: which client messages count as player activity for player-idle-timeout.
// Bytecode-read (javap of the 1.7.10 jar, NetHandlerPlayServer nh and EntityPlayerMP mw): the idle clock is EntityPlayerMP.func_143004_u (mw.x, field bX), set
// to the wall-clock time at creation and by mw.v (func_143004_u's setter, "markPlayerActive"). NetHandlerPlayServer.update kicks with "You have been idle
// for too long!" when x() > 0, the timeout is > 0 and now - x() > minutes * 60000. mw.v is called from exactly these packet handlers (all other handlers
// do not call it):
//   C07 PlayerDigging (every status, including drop item and release use item), C08 BlockPlacement (every one), C09 HeldItemChange (only a valid slot),
//   C01 Chat (not when chat is HIDDEN; commands too), C0A Animation (swing), C0B EntityAction (sneak / sprint / bed / horse), C02 UseEntity (every one,
//   even for a missing target), C16 ClientStatus, C10 CreativeInventoryAction, C11 EnchantItem, C12 UpdateSign.
// NOT calling it: C03/C04/C05/C06 movement and look, C00 KeepAlive, C0D CloseWindow, C0E ClickWindow, C0F ConfirmTransaction, C13 Abilities, C14 TabComplete,
// C15 ClientSettings, C17 CustomPayload (books, beacon, trade select, anvil name, command block). Walking, turning, jumping or opening and clicking
// a container does not keep a player from being kicked.
// This port's wire messages map as below. `input` carries movement, the held slot (`current`, C09) and the sneak and sprint flags (C0B when they change).

// Wire types that are one of the activity packets whatever their fields say.
const ALWAYS = new Set(['edit', 'dig', 'use', 'attack', 'attackPlayer', 'animUse', 'vehUse', 'vehHit', 'sign', 'invCreative', 'stationEnchant', 'respawn', 'requestStats', 'openInventory', 'sleepLeave', 'achDrop', 'horseJump', 'horseInventory']);

/**
 * Whether `message` from a player marks them active. `prev` is that player's remembered input state ({ current, sneak, sprint } or undefined) and the
 * function returns the state to remember next. `chatAllowed` is false while the player's chat visibility is HIDDEN.
 */
export function idleActivity(message, prev, chatAllowed = true) {
  const type = message?.type;
  if (type === 'input') {
    const c = message.controls ?? {}, next = { current: message.current, sneak: !!c.sneak, sprint: !!c.sprint };
    // The first input only sets the baseline: the client sent no C09 / C0B for it.
    const reset = !!prev && (prev.current !== next.current || prev.sneak !== next.sneak || prev.sprint !== next.sprint);
    return { reset, state: next };
  }
  if (type === 'chat') return { reset: chatAllowed !== false, state: prev };
  return { reset: ALWAYS.has(type), state: prev };
}
