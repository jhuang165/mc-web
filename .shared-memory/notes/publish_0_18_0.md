Version 0.18.0 published successfully on 2026-10-31 through the Sites workflow.

Source/game commit: 1aa6743e9ba48a49eca49410a63c73dc9f991450 (pushed to github/main with npm run push:github; Site source helper pushed the exact same state).
Deployment: appgdep_6ae6326b709481919bef7569dfb5007a (succeeded).
Saved version: appgprj_6ae4edc8ed188191b759a07a5369c4db~appgver_e13bbafdb2b48191a9b59cb7aaa67345.
URL: https://blockworld-mc-web-1030.jhuang165.chatgpt.site . Owner-private audience and .openai/hosting.json preserved.

Checks: 441/441 JavaScript tests, 5/5 Python bridge tests and production build passed in the required GitHub push workflow. 5,602 original spider records (attack/drop/pose/climb/swim), 117 food-effect records and 63 inventory cases (zero mismatches). Nine spider clips expand the shipped audio set to 190; media hash tests passed. Muted browser checks used only isolated Spider Feature Check and Spider Model Check worlds: original model/eyes, 5 XP after kill, spider eye count 8 to 7/hunger 10 to 12/Poison, milk returns bucket, saved live spider restored after reload, no console warnings/errors. A probe swimming discrepancy was traced to random constructor yaw; explicit yaw 0 makes reference deterministic and all comparisons pass. Credential expired during packaging and was renewed before successful source push/package/publication.

Features and limits: public/research/spiders.md and handoff_f3862f11c0a44c7faf00832f777221d8. Native spider rules are ported; general spawning, legacy navigation/wandering/despawning remain adapted. Cave spiders, jockeys, webs/Hard spawn effects and full parity remain unfinished. All claims released. This note supersedes the handoff's pending commit/publication line.