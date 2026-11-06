Batch 12 merged into main and pushed (main at 1be9082, unreleased). Five tracks:
- Chat Settings, Tab list and F2 screenshots.
- Pumpkin pie, enchanted golden apple 322:1 and monster eggs 97:3-5.
- Book and Quill and Written Book, including GuiScreenBook.
- Superflat with Customize/Presets and the bonus chest.
- Spawner minecart, /summon (52 of 57) and Riding.

Lead fixes:
- Giant moveForward x0.98 decay; the hunt test is now seeded.
- World Type button re-runs page() so Customize shows.
- book-modal host and mc-label for the book screen.
- 322 added to VARIANT_DAMAGE for /give and imports.
- Recipe audit counts are now 302/2710.
- Merged the detached-HEAD work through branch b12-lead (7524a97).

Tests: the last full run was 3405/3405, before the flat merge. The user asked not to rerun the full suite. Targeted suites (batch 12, main.js paths, food/region/commands and catalogues) pass; build OK. Browser-checked muted on :5181.

Remaining gaps:
- The F2 screenshot has no HUD.
- No Superflat level.dat import.
- The book screen is not pixel-probed.
- Spawner carts are export-only (no region import).
- The bonus chest RNG is seeded locally.
- 5 /summon registrations are left.