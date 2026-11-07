# combat3 (batch 21): Thorns wear with Unbreaking, team-formatted names

## Summary
Never claim full parity.
- Thorns armour wear with Unbreaking 0-III replayed natively (2880 rows, 36 break rows). Result: player path already matched; the mob path ignored Unbreaking wrongly (batch 20 note was wrong) and now rolls it on the mob's Random via `attemptDamageItem` (`src/thorns-live.js`).
- Team-formatted names: only players are formatted (`yz.c_`); mobs never, even with a team member of the same name (probed). The death message and chat lines now print as chat-component translations (`src/team-names.js`), so each argument gets its own `§r` as `getFormattedText` does; the combat tracker uses `raw.formattedName` for a player attacker (`src/combat-tracker.js`).
- Item 3 (skeleton arrow at a villager, player as zombie target through a door) was NOT done: no time was spent on it; village.md is unchanged.

## Native evidence
- Probed: `tools/probes/ThornsWearProbe.java` (reuses `ArmorEnchantmentProbe` doubles; `tools/verify-thorns-wear.mjs` -> `public/research/thorns-wear-reference.json`, 2880 + 36 records): hit 3 / miss 1, Unbreaking on the wearer's Random (armour 60 % gate then `nextInt(l+1)`), mob/player/Creative wearers, two-piece order, the next Random int, break event.
- Probed: broken Thorns piece stays as a zero-size stack in the slot and keeps rolling Thorns (36 ghost rows).
- Probed: `tools/probes/TeamNameProbe.java` (`tools/verify-team-names.mjs` -> `public/research/team-names-reference.json`, 329 records): 7 team configurations x 23 scenarios x fatal/soft death messages (key, argument texts, `getUnformattedText`, `getFormattedText`) plus `chat.type.text`.
- Bytecode-read: `sa.c_` plain name, `yz.c_` uses `azy.a(team, name)` plus a `/msg` click, `sv.bt` null, `tg.bt` owner's team, `bcc.a(fj,int,int,boolean)` builds chat lines from `style code + unformatted text` per flattened component.
- Assumed: `chat.type.text` component construction in NetHandlerPlayServer (built in the probe from the same classes); item rarity colour white for all stacks.

## Tests
- `src/thorns-wear.test.js` (3 tests), `src/team-names.test.js` (3 tests). `npm test` and `npm run build` pass 4164 tests pass, 0 fail; build ok.

## Remaining gaps
- Zero-size broken stack that keeps rolling Thorns is not ported (the port removes the piece).
- Item argument rarity colour is white only; the port has no rarity table for named stacks.
- Team prefix/suffix other than the `color` option can only come from imported scoreboard data; no PvP so a player attacker's team name is replay-only.
- Skeleton arrow at a villager (aggressor registration, arrow death text, golem response) and the player as zombie target through a door: not replayed this batch.
- `Entity.func_145748_c_` of other command senders (`/tp`, `/give` texts) not audited for team formatting.

## Proposed remaining-gaps lines
- Thorns wear with Unbreaking is probed (player, mob, Creative); open: the zero-size stack a broken piece leaves natively (still rolls Thorns), item rarity colour in death-message item brackets.
- Team names: only players are formatted (probed), death messages and chat print as per-argument components; open: PvP, other command-sender texts.
- Open from combat3: skeleton arrow at a villager and player as zombie target through a door (not replayed).
