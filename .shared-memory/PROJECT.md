# Shared project state

Target: Minecraft Java 1.7.10 browser recreation. Latest app version: 0.6.0. Full parity is unfinished.

Live Site: https://blockworld-mc-web-1030.jhuang165.chatgpt.site (owner-private).
GitHub: https://github.com/jhuang165/mc-web . Canonical checkout in this Desktop workspace: `mc-web/game`.

Working: finite seeded terrain, movement, Creative/Survival, hunger/health, shaped crafting and furnace, original textures/audio, first-person animation, pigs/cows/zombies, wheat farming and cow breeding, XP, classic menus. 0.6 corrects native crafting/count coordinates and integer GUI scaling; mining uses original tool behavior, Java float rounding, water/air penalties and wear. Shears, snowballs/flint/books and related recipes are added.

Verification: 50 JavaScript tests; 2,640 original-tool cases; 7 original FoodStats cases / 28 comparisons. Bridge has 5 Python tests. Browser measurements confirmed original 2×2 and 3×3 coordinates and count anchors at GUI scale two, and the same 2×2/result/count positions at GUI scale three. Read the latest handoff for final publication IDs.

Remaining: exact 36-slot/cursor inventory, complete original registries/mobs, armor, enchanting/anvils, status effects, redstone, structures, weather, dimensions, Java terrain/seeds/saves, multiplayer and remaining rendering details. Snowball throwing and most shearing/animal interactions are incomplete. Prioritize user-reported correctness before adding broad features.

Workflow: read context, claim distinct paths, implement, test, leave notes, commit reviewed changes, push GitHub. GitHub pushing and Sites publication are separate. Do not overwrite another agent's edits or switch a shared working tree underneath them. Runtime claims are local to the same checkout; durable Markdown notes travel through Git between clones.
