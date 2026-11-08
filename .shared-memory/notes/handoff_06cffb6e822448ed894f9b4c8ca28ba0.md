Shipped 23cad21 with user approval: GitHub main fast-forwarded 07ccb0f..23cad21, and Pages Actions 42435197527 succeeded.

What changed:
- Block-atlas startup images now retry twice, after 0.5 s and 2 s, using a fresh ?retry=n URL (retryAsset/retryUrl in src/asset-requests.js). A single transient GitHub Pages 503 no longer aborts startup with "Couldn't load the world".
- The Multiplayer screens no longer show or edit the server address. The localStorage mc-web-server url remains as a QA override and is no longer written on join. Connection errors now say "Check that Tailscale is connected."

Checks:
- Tests 4,352 pass / 0 fail; build passes.
- Headless Chrome with three textures forced to 503 once: each was re-requested with ?retry=1 and the title screen loaded with no errors.
- ledoge0 redeployed from the clean wt23-accounts worktree: protocol 2, world and accounts.json kept, Funnel off, empty error log.
- Live Pages check: no address field; a fake login returns "Wrong name or password."

Release record: commit eaaa558 (PROJECT.md) is local on branch accounts-skins, not pushed, to avoid another Pages deploy. Push it with the next change.

The canonical game/ checkout is still at a514448 because of its own dirty chest/bed/icon edits.