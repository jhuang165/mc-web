#!/bin/bash
# Accounts-only loopback service. Public HTTPS/Funnel is a separate, explicitly approved deployment step.
set -eu
cd "$(dirname "$0")/.."
target="${1:-elheffeh@100.75.167.95}"
ssh -o BatchMode=yes "$target" /bin/bash -s <<'REMOTE'
set -eu
umask 077
runtime="$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin/node"
test -x "$runtime"
if lsof -nP -iTCP:8090 -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl print "gui/$(id -u)/local.mc-web.profiles" >/dev/null 2>&1; then
  echo 'Port 8090 is already in use by another service.' >&2; exit 1
fi
mkdir -p "$HOME/.local/share/mc-web-profiles/app/server" "$HOME/.local/share/mc-web-profiles/app/src/multiplayer" "$HOME/.local/share/mc-web-profiles/state" "$HOME/.config/mc-web-profiles" "$HOME/Library/LaunchAgents"
chmod 700 "$HOME/.local/share/mc-web-profiles/state" "$HOME/.config/mc-web-profiles"
REMOTE
rsync -a server/profile-server.js server/accounts.js "$target:.local/share/mc-web-profiles/app/server/"
rsync -a src/skin.js src/png-codec.js "$target:.local/share/mc-web-profiles/app/src/"
rsync -a src/multiplayer/protocol.js "$target:.local/share/mc-web-profiles/app/src/multiplayer/"
ssh -o BatchMode=yes "$target" /bin/bash -s <<'REMOTE'
set -eu
umask 077
app="$HOME/.local/share/mc-web-profiles/app"
state="$HOME/.local/share/mc-web-profiles/state"
printf '{"type":"module"}\n' > "$app/package.json"
cat > "$HOME/.config/mc-web-profiles/run.sh" <<RUN
#!/bin/bash
set -eu
umask 077
export MC_PROFILE_ACCOUNTS="$state/accounts.json"
export MC_PROFILE_ORIGINS="https://jhuang165.github.io"
exec "$HOME/.local/mc-web-runtime/node-v24.22.2-darwin-arm64/bin/node" "$app/server/profile-server.js"
RUN
chmod 700 "$HOME/.config/mc-web-profiles/run.sh"
cat > "$HOME/Library/LaunchAgents/local.mc-web.profiles.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>local.mc-web.profiles</string>
<key>ProgramArguments</key><array><string>$HOME/.config/mc-web-profiles/run.sh</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>$state/server.log</string>
<key>StandardErrorPath</key><string>$state/server-error.log</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)/local.mc-web.profiles" 2>/dev/null || true
launchctl enable "gui/$(id -u)/local.mc-web.profiles"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/local.mc-web.profiles.plist"
for attempt in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:8090/health; then printf '\n'; exit 0; fi
  sleep 1
done
echo 'Account service did not become healthy.' >&2; exit 1
REMOTE
