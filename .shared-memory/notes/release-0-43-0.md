# 0.43.0 release (2026-11-04)

Resumed claude-lead at 877cee5 without discarding any intended work. The release also carries that previously local adventure/LAN commit.

Completed: JsonToNBT parser/getters and command tags for give/summon/setblock/testforblock; shared item/container/mob converters; native error ordering, summon bases/egg skip/Fire/Motion, unmounted Riding with a note, typed NBT subset comparison. Added command block original 137 / internal 139 / item 1139, original texture and item placement, native unbreakable/blast resistance, Creative+permission editor, one-tick rising edges, level-2 sender, local player selectors, independent commandBlockOutput/TrackOutput, comparator SuccessCount, Control import/export and chunk runtime persistence (unloaded records retained). Inventory/third-person player fire and worn-armour glint now render; stuck arrows use a stable nonzero per-lifetime runtime id.

Validation before commit: npm test 1809/1809; npm run build passed (existing bundle-size warning). JsonToNBT retained 119 native cases/zero mismatches. verify-command-blocks bytecode assertions, verify-shadows and verify-game-rules passed; generated catalogues refreshed. No bridge implementation changes. npm run push:github is the required final release validation/push step.

Browser: localhost:5179/?silent, scratch world '0.43.0 command checks'. Named enchanted helmet equipped; live command block gave diamond; testforblock matched SuccessCount:1; editor showed previous output, saved command and tracking toggle, and survived closing/reopening the world. Burning inventory player visible. Final editor screenshot /tmp/mc-0.43.0-editor.png. Browser console had no warnings/errors. Local Vite release only; no ChatGPT Site publication.

Limits: unsupported NBT keys reported and discarded; native parser hang becomes an error, exceptional float double-rounding tie may differ; supported effects/equipment only, unmounted Riding, incomplete tile types/attributes, local player/server/selector adapter, approximate fire/glint GPU composition and non-native entity-id construction order. Full parity remains unfinished.

Mobs never sleep is native Java 1.7.10 behavior. Missing hit sound still needs the user's answers: tab opened before 0.42.0, Friendly/Hostile Creatures slider levels, which mob and browser. Final claim handoffs record the release commit and actual push outcome.
