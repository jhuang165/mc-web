// GameRules (agy) for the systems that read them. The values live in the world record (`gameRules`, written by /gamerule
// through command-host.js); main.js points the source at the active record, so a change takes effect on the next read,
// as World.getGameRules().getGameRuleBooleanValue does. Without a source (tests, before a world loads) the 1.7.10
// defaults apply. Native call sites: public/research/game-rules-reference.json.
import { GAME_RULES } from "./command-data.js";

export const DEFAULT_RULES = Object.freeze(Object.fromEntries(GAME_RULES));
// GameRules.Value.setValue keeps Boolean.parseBoolean of the text: "true" in any letter case, anything else is false.
export const ruleOn = (record, name) => String(record?.gameRules?.[name] ?? DEFAULT_RULES[name]).toLowerCase() === "true";

let source = null;
export function setGameRuleSource(fn) { source = fn; }
export const gameRule = (name) => (source ? source(name) : ruleOn(null, name));
