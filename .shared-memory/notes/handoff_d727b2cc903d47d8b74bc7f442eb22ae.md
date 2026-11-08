Singleplayer-only title menu, at the user's request ("bring back singleplayer only on 5179").

Bug: since 7793119 the Singleplayer button always passed a `reason`. menu-ui's button() does `enable(enabled && !reason)`, so Singleplayer was greyed out ("Another tab owns local saves") even when this tab held the lock. Fix: pass the reason only when canSingleplayer() is false.

Change: Multiplayer is disabled behind `MULTIPLAYER_ENABLED = false` in src/menus.js, with UNAVAILABLE.multiplayer "Multiplayer is paused while the game is played locally."

Tests: new src/title-menu.test.js; full suite 4,354 pass / 0 fail.

Browser check: headless muted Chrome against the user's :5179. Singleplayer is enabled, Multiplayer is disabled with that reason, and creating a new world loaded in about 6 s with no errors. The user's 5179 process (PID 70791) was not restarted.

Where the change lives:
- Committed only on worktree branch accounts-skins as 5181c22, which is not pushed. That branch also carries the unpushed eaaa558 and 4b4a3fa; Pages is unpublished, so pushing publishes nothing.
- The canonical game/ (main a514448) has the identical src/menus.js edit uncommitted, alongside its other dirty chest/bed/icon edits. That is what 5179 serves via HMR. game/ still lacks the accounts/skins/retry commits.
- Before `git merge --ff-only accounts-skins` in game/, run `git checkout src/menus.js` (identical content), and sort out the dirty main.js and block-textures.js first.