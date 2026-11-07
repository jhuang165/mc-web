import { printChat } from "./chat-ui.js";
import { translate } from "./lang.js";
import { EN_US } from "./lang-en-us.js";
import { CombatTracker, damageSource, setKnownKeys } from "./combat-tracker.js";
// The 1.7.10 death message. EntityPlayerMP.onDeath [mw.a(ro)] first broadcasts
// CombatTracker.func_151521_b [rn.b()] to chat; GuiGameOver [bdc] itself shows only the title
// and the score. combat-tracker.js ports the tracker (entries, the combat window, the fall texts, the fighting entity) and this
// file turns its { key, args } into the en_US text through the selected language. The rules were executed natively
// (combat-tracker-reference.json, replayed by combat-tracker.test.js); see public/research/combat.md.

const pick = (prefix) => Object.fromEntries(Object.entries(EN_US).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
// "death.attack.*" and "death.fell.*" English texts (the en_US values; lang-hooks.js overlays the selected language).
export const DEATH_TEXT = pick("death.attack.");
export const FELL_TEXT = pick("death.fell.");
export const ATTACK_TEXT = DEATH_TEXT;
setKnownKeys(Object.keys(EN_US).filter((k) => k.startsWith("death.")));

// This build has no account name; "Player" stands in for the profile name.
export const PLAYER_NAME = "Player";

const fill = (text, ...args) => text.replace(/%(\d)\$s/g, (m, n) => args[n - 1] ?? m);
const table = (key) => (key.startsWith("death.fell.") ? FELL_TEXT[key.slice(11)] : DEATH_TEXT[key.slice(13)]);

/** The text of a { key, args } component (StatCollector.translateToLocalFormatted). */
export function formatDeath({ key, args }) { return fill(translate(key, table(key)), ...args); }

/** The chat line of EntityPlayerMP.onDeath: CombatTracker.func_151521_b of `tracker`. `ctx.selfItem` is the held stack's custom name. */
export function trackerMessage(tracker, name = PLAYER_NAME, ctx = {}) {
  return formatDeath(tracker.message({ name, selfItem: ctx.selfItem ?? null }));
}

/** The line for one hit alone (the tracker after a single entry): `ctx` ({ source, attacker, item, via }) names the DamageSource entity. */
export function deathMessage(reason, name = PLAYER_NAME, ctx = {}) {
  const tracker = new CombatTracker();
  const src = damageSource(reason, ctx.source, ctx.attacker, ctx.via);
  tracker.record(src, 20, 20, 0, { alive: false });
  if (ctx.item && src.entity?.held) { const item = ctx.item; src.entity.held = () => item; }
  tracker.noteAttacker(src, 0);
  return trackerMessage(tracker, name, ctx);
}

// Death, bed and command messages all print to the one GuiNewChat model (chat.js), drawn by chat-ui.js: 100 stored
// lines, wrapped to the chat width, shown for 200 ticks and faded over the last 20 unless the chat is open.
export function showChatLine(doc, text) {
  printChat(text);
  return null;
}
