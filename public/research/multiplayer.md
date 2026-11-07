# Dedicated browser multiplayer — 2026-11-07

The selected authority model is **B**: Node on ledoge0 runs a world at 20 ticks per second. No player hosts the simulation. Closing, pausing or hiding every browser does not stop the world. This is a first playable **Creative building milestone**, not full multiplayer or Java 1.7.10 parity.

## Play

Choose **Multiplayer** on the title screen. Enter a name (1–16 ASCII letters, numbers or underscores), the server key supplied by the owner and an address:

- Default: `wss://ledoge0.tail92abaf.ts.net/multiplayer`.
- Development: `ws://localhost:8089/multiplayer` from an HTTP localhost page.
- HTTPS pages, including GitHub Pages, require `wss://`.

The world has 64 fully resident columns: x/z 0–127, y 0–255. Up to eight players can join. Movement, Creative flight, normal block placement/breaking, shared block changes, interpolated Steve models, name tags, held items, sneaking, swings, Tab presence and chat are connected. The server recomputes edit rays with five-block reach from its player state; clients send controls and edit intent, never authoritative coordinates. All players participate in placement collision checks.

Names, addresses and a random per-name/server reconnect identity are kept on the device. The key is sent in the first WebSocket message and is not stored in localStorage or included in URLs. Rejoin with the same name, browser and address to recover saved position/hotbar. This shared-key service has no account authentication or individual bans.

Additional tabs can use Multiplayer while one tab owns local saves. Singleplayer stays disabled in tabs that do not own the Web Lock. Remote worlds never enter IndexedDB or the local save shelf. Singleplayer and Open to LAN remain separate; Open to LAN still has only its previous local effects.

## Authority and extraction

`src/multiplayer/simulation.js` is DOM-free. It owns independent player state and calls the existing `movePlayer`, `placeHeldBlock` and `breakPlayerBlock` paths. World time is advanced once per server tick, independent of the number of connected players. Input expires after ten ticks without a fresh controls message. The server continues weather/random block updates, tree/plant growth, farming, fluids, fire, falling blocks and the base LiveRedstone engine with no clients.

`tickWorldSystems` in `src/world-tick.js` extracts the block/tile segment shared with Singleplayer, preserving farming → fluids → fire → hoppers → brewing → redstone order. The browser supplies presentation observers. The dedicated orchestrator currently installs a subset of those systems. The rest of `main.js`'s integrated simulation has **not** been extracted, and the dedicated runtime does not run the full Singleplayer tick.

An instance-level `World.put` wrapper captures tracked and untracked edits, including metadata and fluid/redstone writes, without changing the global World class. Changes coalesce per cell each tick. Clients receive complete initial column snapshots and apply authoritative deltas without running local world/player simulation. The browser's normal scene renders the replica. Server tick time drives the camera and remote-player interpolation; no hidden-tab tick pump is required.

## Wire format decision

Version 1 deliberately uses **custom versioned JSON messages**, not the preferred Java protocol-5 packet IDs/VarInt framing. This gets a complete authoritative snapshot of the port's internal block IDs and metadata into a browser without first implementing original-ID tile/NBT, inventory slot and DataWatcher adapters. Initial columns use validated run-length pairs of `internalBlock | metadata << 8`; the default seed's initial welcome is about 0.5 MB. Ordinary ticks carry final block changes, time, weather, redstone repeater state and player presence. This is a delivery tradeoff, not native protocol evidence. A Java bridge would require a separately versioned adapter and original-class codec probes; there is no Java-client interoperability promise.

Client messages: `join {protocol, token, name, resumeKey}`, `input {controls, yaw, pitch, hotbar, current}`, `edit {place}`, and `chat {text}`. Server messages: `welcome {protocol, id, world, self}`, `tick {tick, time, changes, players, weather, redstone}`, `chat {name, text}`, and `error {text}`. Frame boundaries supply message framing. TCP/WebSocket preserves order, and clients discard old tick numbers.

The pinned `ws` dependency supplies RFC 6455 parsing. The server requires an exact Origin allowlist, a key of at least 16 characters, a versioned join within ten seconds and valid names/controls/hotbar entries. It limits client messages to 8 KiB, player count to eight, pending handshakes to twelve, message rate and queued edits, and slow-client buffering. Ping/pong heartbeats remove dead clients. Keys are never part of health responses, logs or static assets. See the [ws API](https://github.com/websockets/ws/blob/master/doc/ws.md).

## Run locally

```sh
npm ci
# Supply a private key through your environment, then:
MC_WEB_TOKEN="$YOUR_PRIVATE_KEY" npm run server -- --bind 127.0.0.1 --port 8089 --data server-data/world.json
```

Origins default to `https://jhuang165.github.io`, localhost/127.0.0.1 port 5179 and `https://ledoge0.tail92abaf.ts.net`. For an isolated preview, supply `MC_WEB_ORIGINS=http://localhost:5197` and run Vite on 5197; do not restart the user's 5179 process. `/health` reports protocol, tick, connected-player count and save health. `/mc-web/` can serve a Pages-base production build from `dist/`.

Saves every ten seconds and SIGTERM/SIGINT use a serialized temporary-file → atomic-rename write, with 0600 files and a 0700 state directory. Saved state includes edits, clock, weather/world RNG, fluid/fire/falling queues, base redstone, tile records and reconnecting players' positions/hotbars. Startup refuses malformed/unsupported saves instead of replacing them. Back up the state directory; do not put keys or saves in Git.

## ledoge0 deployment

SSH was verified as `elheffeh@100.75.167.95`. Initial read-only inspection found macOS arm64, no Node installation, no Tailscale Serve configuration, and unrelated Java listeners on 25565/25575. The dedicated server uses **127.0.0.1:8089**. Node v24.22.2 was downloaded from the official [Node release directory](https://nodejs.org/dist/v24.22.2/) and checked against its SHA-256 manifest.

Run the reviewed deployment script from the canonical checkout:

```sh
bash server/deploy-ledoge0.sh elheffeh@100.75.167.95
```

It builds with `BASE_PATH=/mc-web/`, copies source and static files, installs locked production dependencies, creates the key only if absent, and installs `~/Library/LaunchAgents/local.mc-web.dedicated.plist`. It never pushes GitHub or enables Funnel. Files on ledoge0:

- App: `~/.local/share/mc-web/app/`.
- State, logs: `~/.local/share/mc-web/state/` (`world.json`, `server.log`, `server-error.log`).
- Private configuration: `~/.config/mc-web/server.env`, launcher `run.sh`.
- Runtime: `~/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/`.

The user LaunchAgent restarts crashes and starts after login. It is **not** a system LaunchDaemon: unattended service across macOS user logout/boot before login requires a separately administered LaunchDaemon. It does not need any browser to remain open.

Tailscale must first permit Serve for this device in the tailnet admin UI. After that, the script runs:

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --https=443 http://127.0.0.1:8089
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve status
curl -fsS https://ledoge0.tail92abaf.ts.net/health
```

Tailnet devices can open `https://ledoge0.tail92abaf.ts.net/mc-web/` for the review build. Public GitHub Pages publication requires a reviewed commit/push and the user's agreement. Funnel remains off; public access needs the user's explicit approval.

To inspect or stop on ledoge0:

```sh
launchctl print gui/$(id -u)/local.mc-web.dedicated
launchctl bootout gui/$(id -u)/local.mc-web.dedicated
```

Redeploying restarts the service and disconnects clients. Its state and existing private key are retained. The deploy script copies the current workspace, so review unrelated pending changes before publishing its static build beyond a private preview.

## Evidence and remaining work

`src/multiplayer.test.js` exercises RLE corruption, control validation, shared tick ordering, real headless player physics, server-side edit rays, untracked writes, stale-input stop, duplicate identities, empty-server ticking, reconnect state, two real WebSocket clients, chat/departure, Origin/token rejection and save/restart. These are browser-port regression tests, not native Java packet probes. The existing Singleplayer throw/bucket replay was retained with a disconnected multiplayer fixture.

Verification: `npm test` passed 4,347 tests in the canonical workspace; the clean 7793119 commit passed 4,345 (the two pre-existing uncommitted chest-icon tests are excluded). Both have zero failures and passing `/mc-web/` production builds. Muted Chrome on :5197 verified two same-origin tabs, shared movement/edits and replica equality. Two production-build tabs on :5198 connected through an SSH tunnel to the actual ledoge0 service, moved, exchanged chat and received both break/place writes, with no application errors or failed HTTP responses. The launchd service restarted with its world clock, edited cell and player records retained. Deployed source/static files were then replaced with the clean 7793119 build and the production browser check passed again. Temporary QA origins were removed. Tailnet HTTPS/WSS remains unverified until the owner enables Tailscale Serve. Preview tabs/processes are cleaned up; the owner’s :5179 process is untouched.

Still missing: Survival damage/inventories, container interaction/transfer, players' equipment, entity collisions/PvP, mobs/items/projectiles/TNT replication, sounds/particles/events, piston motion and the full redstone/tile runtime, portals/dimensions, infinite multi-centre residency, Java packet vocabulary, real measured ping, account permissions, an editable server list and public access. Falling blocks are authoritative but their in-flight entities are not replicated; clients see their final block writes. Some special held-item uses (beds, signs, buckets, spawn eggs, vehicles and other non-ItemBlock actions) are not connected. There is no automatic reconnect; a dropped client returns to the connection screen and can rejoin.
