# Commands round 2 (batch 16, branch b16-commands)

## Changed
- /summon: Painting, ItemFrame and LeashKnot added (55 of 57 EntityList registrations; Mob and Monster are abstract). `entity-summon.js`, `Hanging.summon` in `hanging.js`, `knotSummon` in `horse-gear-live.js`, summoned knot rendering in `horse-gear-renderer.js`; `main.js entityHosts` gained `hanging` (one token).
- Scoreboard criteria order: the jar's `StatList.allStats` order is recorded by `ScoreboardProbe` (`statOrder` in `scoreboard-reference.json`), `stats-data.js` carries `order`, `criteriaOrder` in `scoreboard.js` models the Java HashMap (table 2048). All 803 positions replay from that order.
- Selectors: `command-selector.js` is a faithful PlayerSelector/findPlayers port. Evidence: `tools/probes/SelectorProbe.java` + `tools/verify-selector.mjs` -> `public/research/selector-reference.json` (parser, score map, defaults, parseIntWithDefault, token regex). Filter loop is bytecode-read.
- mobGriefing: the stale "absent" statuses in `tools/verify-game-rules.mjs` were corrected (all 11 sites wired); `src/mob-griefing.test.js` is new.

## Tests
`npm test` and `npm run build` pass in the worktree (see the final handoff for counts). New/extended: `summon-coverage.test.js`, `scoreboard.test.js`, `commands-extra.test.js`, `command-selector.test.js`, `game-rules.test.js`, `mob-griefing.test.js`.

## Remaining
- craftItem completion order is identity-hash dependent (differs per JVM run); the shipped default matches 700+ of 803.
- Summoned hanging directions outside 0..3 are refused; summoned knots cannot be clicked; negative ItemRotation follows Java `%`.
- Selector score-argument iteration order and dimension matching are not modelled; findPlayers is not probe-run.
