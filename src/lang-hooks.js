// Routes the keyed 1.7.10 strings through the selected language (lang.js). The hand-written English tables stay the base (and the
// fallback for a key the language file lacks, as en_US is for Locale); a language change overlays the selected file's keys on
// them and restores the English text when English comes back. Tables: the menu strings (menu-screens.js LANG), the command
// texts (command-data.js LANG, read by commands.js tr and chat-component.js translateKey), achievements and death messages.
// Item names go through item-name-keys (item-names.js).
import { onLanguage, overlayTable } from "./lang.js";
import { LANG } from "./menu-screens.js";
import { LANG as COMMAND_LANG } from "./command-data.js";
import { STRINGS as ACHIEVEMENT_STRINGS } from "./achievements.js";
import { DEATH_TEXT } from "./death-messages.js";

const prefixed = (prefix) => (k) => (k.startsWith(prefix) ? k.slice(prefix.length) : null);
const savedMenus = {}, savedCommands = {}, savedAchievements = {}, savedDeaths = {};
onLanguage((selected) => {
  overlayTable(LANG, savedMenus, selected);
  overlayTable(COMMAND_LANG, savedCommands, selected);
  overlayTable(ACHIEVEMENT_STRINGS, savedAchievements, selected, prefixed("achievement."));
  overlayTable(DEATH_TEXT, savedDeaths, selected, prefixed("death.attack."));
});
