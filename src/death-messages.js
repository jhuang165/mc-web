// The 1.7.10 death message. EntityPlayerMP.onDeath [mw.a(ro)] first broadcasts
// CombatTracker.func_151521_b [rn.b()] to chat; GuiGameOver [bdc] itself shows only the title
// and the score. When the last hit is not a fall, the text is DamageSource.func_151519_b:
// "death.attack.<type>", or "death.attack.<type>.player" naming the entity that last attacked
// the player when that key exists. player-damage-reference.json records the original text of
// each source alone and after a zombie hit.
//
// Only the sources with no ".player" form are mapped here, because this build does not keep the
// combat tracker's attacker: suffocation (inWall), starvation (starve) and the void (outOfWorld).
// Other causes return null (no message), as before.
export const DEATH_TEXT = {
  inWall: "%1$s suffocated in a wall",
  starve: "%1$s starved to death",
  outOfWorld: "%1$s fell out of the world",
};
// Survival.lastDamage reasons and the DamageSource each one is.
const SOURCE = { suffocation: "inWall", starvation: "starve", void: "outOfWorld" };

// This build has no account name; "Player" stands in for the profile name.
export const PLAYER_NAME = "Player";

export function deathMessage(reason, name = PLAYER_NAME) {
  const text = DEATH_TEXT[SOURCE[reason]];
  return text ? text.replace("%1$s", name) : null;
}

// GuiNewChat.drawChat [bcc.a(I)]: GuiIngame translates to (0, height - 48), the chat adds
// (2, 20); the newest line's 50 % black rectangle spans y -9..0 and width 320 + 4 (chat width
// 1.0), its text white with a shadow at y -8. A line shows for 200 ticks and fades over the
// last 20 (alpha (10 * (1 - age / 200))^2). The chat is part of the HUD, so the death screen's
// gradient covers it. Wall-clock timing approximates the tick counter here.
export function showChatLine(doc, text) {
  let line = doc.getElementById("chat-line");
  if (!line) {
    line = doc.createElement("div");
    line.id = "chat-line";
    line.setAttribute("role", "status");
    Object.assign(line.style, {
      position: "fixed", left: "calc(2 * var(--u))", bottom: "calc(28 * var(--u))", width: "calc(324 * var(--u))",
      height: "calc(9 * var(--u))", background: "rgba(0,0,0,.5)", color: "#fff", fontSize: "calc(8 * var(--u))",
      lineHeight: "calc(9 * var(--u))", textShadow: "var(--u) var(--u) #3f3f3f", whiteSpace: "nowrap", overflow: "hidden",
      pointerEvents: "none", zIndex: 9, transition: "opacity 1s ease-in",
    });
    doc.body.appendChild(line);
  }
  line.textContent = text;
  line.style.opacity = "1";
  clearTimeout(showChatLine.timer);
  showChatLine.timer = setTimeout(() => (line.style.opacity = "0"), 9000);
  return line;
}
