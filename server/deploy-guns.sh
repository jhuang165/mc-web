#!/bin/bash
# Gun-world game service (loopback 8091) and route gateway (loopback 8092) on ledoge0.
# This script never changes Tailscale Funnel/Serve or GitHub Pages: the public cutover is only PRINTED at the end
# for the user to run manually after approval. It never touches local.mc-web.dedicated (8089),
# local.mc-web.profiles (8090) or their directories (~/.local/share/mc-web, ~/.local/share/mc-web-profiles).
set -eu
set -o pipefail
cd "$(dirname "$0")/.."
target="${1:-elheffeh@100.75.167.95}"

if [ "${MC_GUNS_DEPLOY_CONFIRM:-}" != 1 ]; then
  cat >&2 <<PLAN
deploy-guns.sh would, on $target:
  - require the existing Node runtime ~/.local/mc-web-runtime/node-v24.22.2-darwin-arm64 (never downloads it)
  - refuse unless loopback 8091 is free or owned by local.mc-web.guns and 8092 is free or owned by local.mc-web.gateway
  - upload committed server/, src/ (no *.test.js), package.json, package-lock.json of HEAD
    ($(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)) to ~/.local/share/mc-web-guns/releases/<build>/ and run npm ci there
  - sync only *.json from public/mods/{tacz,cs2,lrtactical}/ to ~/.local/share/mc-web-guns/packs/
  - create missing private config in ~/.config/mc-web-guns/ (never overwrites), back up state/, flip current,
    keep the 3 newest releases, and (re)start LaunchAgents local.mc-web.guns and local.mc-web.gateway
  - check http://127.0.0.1:8091/status, :8092/health and :8092/api/me (expects 401), then print Funnel commands
It does not change Funnel/Serve, GitHub Pages, local.mc-web.dedicated or local.mc-web.profiles.
Set MC_GUNS_DEPLOY_CONFIRM=1 to proceed.
PLAN
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo 'Refusing to deploy: tracked files have uncommitted changes. Commit or revert them first.' >&2; exit 1
fi
build="$(git rev-parse --short=12 HEAD)"
for file in server/guns-server.js server/gateway.js server/properties.js package.json package-lock.json; do
  git cat-file -e "HEAD:$file" 2>/dev/null || { echo "Refusing to deploy: $file is not committed at $build." >&2; exit 1; }
done
for pack in tacz cs2 lrtactical; do
  test -d "public/mods/$pack" || { echo "Missing local pack directory public/mods/$pack." >&2; exit 1; }
done

# Stage exactly the committed tree so untracked files never ship under this build ID.
stage="$(mktemp -d "${TMPDIR:-/tmp}/mc-web-guns.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
git archive --format=tar HEAD server src package.json package-lock.json | tar -xf - -C "$stage"

ssh -o BatchMode=yes "$target" /bin/bash -s <<'REMOTE'
set -eu
umask 077
bin="$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin"
if [ ! -x "$bin/node" ] || [ ! -x "$bin/npm" ]; then echo "Node runtime missing at $bin." >&2; exit 1; fi
uid="$(id -u)"
check_port() {
  port="$1"; label="$2"
  listeners="$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$listeners" ]; then
    # lsof only lists this user's processes; a listener owned by anyone else still accepts connections.
    if nc -z -G 1 127.0.0.1 "$port" >/dev/null 2>&1; then echo "Port $port is already in use by another service." >&2; return 1; fi
    return 0
  fi
  owner="$(launchctl print "gui/$uid/$label" 2>/dev/null | awk '$1 == "pid" && $2 == "=" { print $3; exit }')"
  for pid in $listeners; do
    if [ -z "$owner" ] || [ "$pid" != "$owner" ]; then echo "Port $port is already in use by a process other than $label." >&2; return 1; fi
  done
}
check_port 8091 local.mc-web.guns
check_port 8092 local.mc-web.gateway
base="$HOME/.local/share/mc-web-guns"
mkdir -p "$base/releases" "$base/state" "$base/backups" "$base/packs/tacz" "$base/packs/cs2" "$base/packs/lrtactical" \
  "$HOME/.config/mc-web-guns" "$HOME/Library/LaunchAgents"
chmod 700 "$base" "$base/state" "$base/backups" "$base/packs" "$HOME/.config/mc-web-guns"
REMOTE

rsync -a --delete --exclude='/node_modules/' --exclude='/BUILD' --exclude='*.test.js' "$stage/" "$target:.local/share/mc-web-guns/releases/$build/"
# Private pack data: JSON only, quietly (no file listing), never printed.
for pack in tacz cs2 lrtactical; do
  rsync -a --delete --prune-empty-dirs --include='*/' --include='*.json' --exclude='*' "public/mods/$pack/" "$target:.local/share/mc-web-guns/packs/$pack/"
done

ssh -o BatchMode=yes "$target" /bin/bash -s -- "$build" <<'REMOTE'
set -eu
umask 077
build="$1"
case "$build" in ''|*[!0-9a-f]*) echo 'Invalid build ID.' >&2; exit 1 ;; esac
bin="$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin"
base="$HOME/.local/share/mc-web-guns"
release="$base/releases/$build"
state="$base/state"
config="$HOME/.config/mc-web-guns"
agents="$HOME/Library/LaunchAgents"
uid="$(id -u)"
export PATH="$bin:/usr/bin:/bin:/usr/sbin:/sbin"
chmod -R go-rwx "$base/packs" "$release"

printf '%s\n' "$build" > "$release/BUILD"
cd "$release"
npm ci --omit=dev --no-audit --no-fund
touch "$release"

# Private config: create only what is missing; never overwrite an operator's edits.
if [ ! -e "$config/server.properties" ]; then
  MC_GUNS_RELEASE="$release" MC_GUNS_PROPERTIES="$config/server.properties" node --input-type=module -e '
    import { writeFileSync } from "node:fs";
    import { pathToFileURL } from "node:url";
    const m = await import(pathToFileURL(process.env.MC_GUNS_RELEASE + "/server/properties.js").href);
    const d = m.DEFAULT_PROPERTIES, serialize = m.serializeProperties ?? m.formatProperties ?? m.stringifyProperties;
    const text = typeof d === "string" ? d : serialize ? serialize(d)
      : "#Minecraft server properties\n" + Object.entries(d).map(([k, v]) => k + "=" + v).join("\n") + "\n";
    writeFileSync(process.env.MC_GUNS_PROPERTIES, text, { mode: 0o600, flag: "wx" });'
fi
for list in whitelist.json ops.json banned-players.json; do
  if [ ! -e "$config/$list" ]; then printf '[]\n' > "$config/$list"; chmod 600 "$config/$list"; fi
done

cat > "$config/run-guns.sh" <<RUN
#!/bin/bash
set -eu
umask 077
export MC_GUNS_PORT=8091
export MC_GUNS_BIND=127.0.0.1
export MC_GUNS_CONFIG_DIR="$config"
export MC_GUNS_STATE_DIR="$state"
export MC_GUNS_PACK_DIR="$base/packs"
export MC_GUNS_PROFILE_API=http://127.0.0.1:8090
export MC_GUNS_ORIGINS=https://jhuang165.github.io
cd "$base/current"
exec "$bin/node" server/guns-server.js
RUN
cat > "$config/run-gateway.sh" <<RUN
#!/bin/bash
set -eu
umask 077
export MC_GATEWAY_PORT=8092
export MC_GATEWAY_BIND=127.0.0.1
export MC_GATEWAY_PROFILES=http://127.0.0.1:8090
export MC_GATEWAY_GAME=http://127.0.0.1:8091
cd "$base/current"
exec "$bin/node" server/gateway.js
RUN
chmod 700 "$config/run-guns.sh" "$config/run-gateway.sh"

plist() {
  label="$1"; script="$2"; log="$3"
  cat > "$agents/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$label</string>
<key>ProgramArguments</key><array><string>$script</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>$state/$log.log</string>
<key>StandardErrorPath</key><string>$state/$log-error.log</string>
</dict></plist>
PLIST
}
plist local.mc-web.guns "$config/run-guns.sh" guns
plist local.mc-web.gateway "$config/run-gateway.sh" gateway

# Atomic switch of the code the services run (macOS mv -h replaces the link, not its target directory).
previous="$(readlink "$base/current" 2>/dev/null || true)"
ln -sfn "$release" "$base/.current.$$"
mv -fh "$base/.current.$$" "$base/current"
ls -1t "$base/releases" | tail -n +4 | while IFS= read -r old; do
  case "$old" in ''|*[!0-9a-f]*) continue ;; esac
  if [ "$base/releases/$old" != "$release" ] && [ "$base/releases/$old" != "$previous" ]; then rm -rf "${base:?}/releases/$old"; fi
done

start_agent() {
  label="$1"
  launchctl bootout "gui/$uid/$label" 2>/dev/null || true
  if [ "$label" = local.mc-web.guns ]; then
    # Snapshot state while the game service is stopped.
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    cp -Rp "$state" "$base/backups/$stamp-$build"
  fi
  launchctl enable "gui/$uid/$label"
  for attempt in 1 2 3; do
    if launchctl bootstrap "gui/$uid" "$agents/$label.plist"; then return 0; fi
    sleep 1
  done
  echo "Could not start $label." >&2; return 1
}
start_agent local.mc-web.guns
start_agent local.mc-web.gateway

code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null || true; }
wait_for() {
  url="$1"; want="$2"; got=000
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    got="$(code "$url")"
    if [ "$got" = "$want" ]; then break; fi
    sleep 1
  done
  echo "$url -> $got"
  [ "$got" = "$want" ]
}
ok=1
wait_for http://127.0.0.1:8091/status 200 || ok=0
wait_for http://127.0.0.1:8092/health 200 || ok=0
wait_for http://127.0.0.1:8092/api/me 401 || ok=0
previous_name=none
if [ -n "$previous" ]; then previous_name="$(basename "$previous")"; fi
echo "Deployed build $build (previous: $previous_name)."
if [ "$ok" != 1 ]; then
  echo "A health check failed; see $state/guns-error.log and $state/gateway-error.log on this host." >&2
  if [ -n "$previous" ]; then echo "Code rollback: ln -sfn '$previous' '$base/.current.tmp' && mv -fh '$base/.current.tmp' '$base/current' && launchctl kickstart -k gui/$uid/local.mc-web.guns && launchctl kickstart -k gui/$uid/local.mc-web.gateway" >&2; fi
  exit 1
fi
REMOTE

# Printed only. Syntax per https://tailscale.com/docs/reference/tailscale-cli/funnel (tailscale funnel [flags] <target>).
cat <<FUNNEL

Services are up on loopback only. Public HTTPS still points wherever it did before (normally 8090).
After approval, run these yourself on ledoge0 (ssh $target):

  # Inspect the current Funnel/Serve config first
  /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel status

  # Cutover: public https://ledoge0.tail92abaf.ts.net -> gateway (accounts + game)
  /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg --https=443 http://127.0.0.1:8092

  # Rollback: public HTTPS -> accounts service only
  /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg --https=443 http://127.0.0.1:8090

  # Stop the new services (roll Funnel back first if it points at 8092)
  launchctl bootout gui/\$(id -u)/local.mc-web.gateway
  launchctl bootout gui/\$(id -u)/local.mc-web.guns
FUNNEL
