#!/bin/bash
# Tailnet-only deployment. This never enables Funnel or pushes GitHub Pages.
set -eu
cd "$(dirname "$0")/.."
target="${1:-elheffeh@100.75.167.95}"
BASE_PATH=/mc-web/ npm run build
ssh -o BatchMode=yes "$target" /bin/bash -s <<'REMOTE'
set -eu
runtime="$HOME/.local/mc-web-runtime"
node_version=v24.22.2
if [ ! -x "$runtime/node-$node_version-darwin-arm64/bin/node" ]; then
  mkdir -p "$runtime"
  cd "$runtime"
  curl -fsSLO "https://nodejs.org/dist/$node_version/node-$node_version-darwin-arm64.tar.gz"
  curl -fsSLO "https://nodejs.org/dist/$node_version/SHASUMS256.txt"
  awk -v file="node-$node_version-darwin-arm64.tar.gz" '$2 == file {print}' SHASUMS256.txt > node.sha256
  test -s node.sha256
  shasum -a 256 -c node.sha256
  tar -xzf "node-$node_version-darwin-arm64.tar.gz"
fi
mkdir -p "$HOME/.local/share/mc-web/app" "$HOME/.local/share/mc-web/state" "$HOME/.config/mc-web" "$HOME/Library/LaunchAgents"
chmod 700 "$HOME/.config/mc-web" "$HOME/.local/share/mc-web/state"
launchctl bootout "gui/$(id -u)/local.mc-web.dedicated" 2>/dev/null || true
REMOTE
rsync -a --delete src/ "$target:.local/share/mc-web/app/src/"
rsync -a --delete server/ "$target:.local/share/mc-web/app/server/"
rsync -a --delete dist/ "$target:.local/share/mc-web/app/dist/"
rsync -a package.json package-lock.json "$target:.local/share/mc-web/app/"
ssh -o BatchMode=yes "$target" /bin/bash -s <<'REMOTE'
set -eu
app="$HOME/.local/share/mc-web/app"
state="$HOME/.local/share/mc-web/state"
export PATH="$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$app"
npm ci --omit=dev --no-audit --no-fund
if [ ! -f "$HOME/.config/mc-web/server.env" ]; then
  umask 077
  node --input-type=module -e 'import {randomBytes} from "node:crypto"; import {writeFileSync} from "node:fs"; writeFileSync(process.env.HOME+"/.config/mc-web/server.env", "export MC_WEB_TOKEN="+randomBytes(24).toString("hex")+"\n",{mode:0o600});'
fi
cat > "$HOME/.config/mc-web/run.sh" <<RUN
#!/bin/bash
set -eu
source "$HOME/.config/mc-web/server.env"
cd "$app"
exec "$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin/node" server/server.js --port 8089 --bind 127.0.0.1 --data "$state/world.json"
RUN
chmod 700 "$HOME/.config/mc-web/run.sh"
cat > "$HOME/Library/LaunchAgents/local.mc-web.dedicated.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>local.mc-web.dedicated</string>
<key>ProgramArguments</key><array><string>$HOME/.config/mc-web/run.sh</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>$state/server.log</string>
<key>StandardErrorPath</key><string>$state/server-error.log</string>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/local.mc-web.dedicated.plist"
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --https=443 http://127.0.0.1:8089
REMOTE
