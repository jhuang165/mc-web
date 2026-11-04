// Open to LAN of 1.7.10 for the one browser tab: IntegratedServer.shareToLAN (bsx.a(ahk, boolean)) and its effects on the
// host. Natively it opens a network endpoint on a free port and starts the LAN ping thread, then sets
// ServerConfigurationManager's game type for players who join (oi.a(ahk): the host keeps its own mode) and
// commandsAllowedForAll (oi.c(boolean)), and returns the port. A web page can neither listen on a port nor broadcast on
// the local network, so nobody else can join. Only the host-side effects remain:
// - commandsAllowedForAll: commands work for the host for the rest of the session, as the Allow Cheats trick does natively;
// - Minecraft.isGamePaused is false once the server is public, so the world keeps running behind the game menu;
// - GuiIngameMenu enables Open to LAN only while the server is not public.
// Nothing is saved: WorldInfo keeps its own allowCommands, and the LAN state ends when the world is left.
// HttpUtil.func_76181_a (a free port from ServerSocket(0)) has no browser counterpart; the port shown is the fallback
// shareToLAN itself uses when that lookup fails.
export const LAN_FALLBACK_PORT = 25564;
export const LAN_NOTICE = "Other devices cannot join a browser game.";

export class LanSession {
  constructor() { this.open = null; }
  // shareToLAN(gameType, cheats): returns the port as text. Calling it again (/publish after the LAN screen) overwrites
  // both settings, as the native method does.
  share(gameType, cheats) {
    this.open = { gameType, cheats: !!cheats, port: LAN_FALLBACK_PORT };
    return String(LAN_FALLBACK_PORT);
  }
  close() { this.open = null; }
  get public() { return !!this.open; }
  // Minecraft.isGamePaused: singleplayer && a pausing screen && !integratedServer.getPublic().
  paused(screenPauses) { return !!screenPauses && !this.public; }
}
