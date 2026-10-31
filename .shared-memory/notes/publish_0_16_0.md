Version 0.16.0 published successfully on 2026-10-31 through the Sites workflow.

Source/game commit: a9e0d9414cac22a8925b7b78af6cc08eb1b98ec5 (pushed to github/main with npm run push:github; source helper also pushed this exact state to the Site source).
Deployment: appgdep_6ae62cc27a7881919096c8ea44f15ee6 (succeeded).
Saved version: appgprj_6ae4edc8ed188191b759a07a5369c4db~appgver_ba29634a2f4881918f7989d88b2c799c.
URL: https://blockworld-mc-web-1030.jhuang165.chatgpt.site. Owner-private audience and .openai/hosting.json preserved.

Checks: 422/422 JavaScript tests, 5/5 Python bridge tests and production build passed in the required push workflow. Original crop probe: 4,683 records; inventory probe: 61 cases, zero mismatches; shadow reference regenerated. Muted browser checks verified carrot planting/consumption, bone meal, harvested drops, potato replant/growth, saved crop/inventory after reload, and baked potato hunger restoration from 12 to 18. No console errors. The isolated Root Farm Feature Check world remains in preview localStorage; existing worlds were not modified. Dev server stopped.

Feature details/limitations are in public/research/crops.md and handoff_768189e22aa740c8942d32e9a4dce8df. Poison effects are unfinished; farming still uses approximate hash-based random ticks/light. This note supersedes that handoff's pending commit/publication line.