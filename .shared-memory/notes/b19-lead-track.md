# Batch 19 lead (claude-b19-lead, 2026-11-07)

Eight Sonnet tracks in isolated agent worktrees, merged into main with --no-ff, then release 0.49.0 (commit 4bac1db):
catalogues (6718c51), signfont (1be6b5f), spawnpoint (86f3b9e), deaths (d618853), spawning3 (6088419), audio3 (8425efa), mobdoors3 (a01fba2), blocks3 (2ab0cdd). Per-track notes: `*-b19-track.md`.

Lead fix 0380f52: blocks3 removed the flower light rule (native BlockBush has none), which changed legacy generation 8 terrain hashes; legacy flower decoration (generation 4-8, flowers.js generateFlowers) keeps the old rule via `legacyFlowerCanStay`, so old saves regenerate unchanged; world-chunks.test.js hashes restored.

New generation versions: 18 (16 + native createSpawnPosition) and 19 (17 + native spawn), new streamed worlds only.

Verification: 4053 tests + build on merged main; muted headless Chrome on :5181 created a default world (gen 18, ~2 s, grass spawn, no errors, 16.7 ms frames).

Follow-ups seen: world-list title overlaps Import/Endless; Taking Inventory toast second line spills below its box; moving-piston box not used for collision; S29 helpers unwired; resident window 8x8 vs 15x15 eligible.
