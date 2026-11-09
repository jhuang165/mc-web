# Accounts for the protected guns preview

This build requires an account to enter Singleplayer, as requested. The Account screen supports username/email/password registration, sign-in by name or email, name changes, PNG skins and sign-out. A saved token is verified with the account service before entering a world. Worlds remain saved on the device; profiles do not synchronize worlds.

The independent `server/profile-server.js` service handles accounts and skins only. It has no world, static-file or WebSocket routes. Production uses HTTPS at `https://ledoge0.tail92abaf.ts.net/api/`; development defaults to `http://localhost:8090/api/`. `VITE_PROFILE_API_URL` can override the build endpoint.

Accounts use salted scrypt hashes (N=16384, r=8, p=5); session tokens are random and only their SHA-256 hashes are stored server-side. Legacy dedicated-server hashes remain readable and upgrade on successful profile login. Emails are private account fields. Registration/sign-in are rate limited. Skin uploads are bounded, decoded and re-encoded as normalized 64×32 PNGs; the UI also accepts 64×64 images using their 1.7.10 top half. There is no email verification, password recovery or account deletion UI yet.

Run locally with `node server/profile-server.js`. `MC_PROFILE_PORT`, `MC_PROFILE_ACCOUNTS` and the comma-separated `MC_PROFILE_ORIGINS` configure the listener, private state file and allowed browser origins. The listener binds to loopback. Keep private state and tokens out of Git.

`server/deploy-profiles.sh` installs a separate `local.mc-web.profiles` user LaunchAgent on ledoge0, listening on 127.0.0.1:8090. Data is under `~/.local/share/mc-web-profiles/state/`, with the account file mode 0600. The agent runs after that Mac user's login. It does not start the paused multiplayer service or configure public forwarding. Public HTTPS forwarding requires the explicit approval recorded by the deployment guide in `multiplayer.md`; that deployment step is separate from installation.

The encrypted GitHub Pages gate still protects the application assets independently. The profile service does not contain the gate passcode. Account sessions expire after 30 days; the gate unlock expires after 12 hours.
