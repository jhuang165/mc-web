# chatnames b54 track

Branch `batch54-chatnames` from 20bbab13b.

## Summary
- Death messages: `deathComponent` now builds the victim and a player attacker (direct, arrow, thorns, explosion, fireball, fall assist/finish, revenge ".player") as `EntityPlayer.func_145748_c_` components (team-formatted text, `/msg <raw name> ` suggest_command click). A mob killer stays a plain string (`Entity.func_145748_c_`). `CombatTracker.message` also returns `players` (raw player name per argument, or null); a private `#message` computes it from the entity objects (no name-string matching).
- Achievement broadcast (`main.js`, one line): `chat.type.achievement` takes `senderComponent(formatName(name), name)`; the hoverable achievement component (`statComponent`) was already in place.
- Scoreboard displays: no change. The gap as written is wrong for them: 1.7.10 `GuiIngame` (bbv) calls `ScorePlayerTeam.formatPlayerName` (azy.a(team, name)) at the sidebar and tab-list sites and draws the returned String; no component is involved. Bytecode-read (3 call sites in bbv). The port's `scoreboard.formatName` strings are already the native shape.

## Evidence
- Executed: 4 new `b54cn` rows (`deathPlayerClick`, `deathMobPlayerVictim`, `deathGenericClick`, `achievementClick`) in `chat-component-reference.json` (27 rows total) through the real `fr`/`fq`/`fn`/`fh`/`fk` classes via `ChatComponentProbe`: JSON, getFormattedText, getUnformattedText.
- Source-recalled: the translation trees DamageSource.func_151519_b / StatisticsFile build (those classes are not in the client jar). Bytecode-read: `yz.c_` (func_145748_c_), `bbv` sidebar sites.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-chat-component.mjs` (27 rows)
- `node --test src/chat-names-b54.test.js src/chat-component-b52.test.js src/cmd-tell-b53.test.js src/team-names.test.js src/combat-tracker.test.js src/death-messages.test.js src/scoreboard.test.js`: 45 pass, 0 fail. `npm run build` once. No full `npm test`, no browser run.

## Follow-ups
- The killer's held-item argument (`func_151000_E`) still uses the common colour for every stack (rarity/enchant colour not ported).
- Multiplayer/server death and achievement broadcasts were not touched (vanilla-only track).
