// b82 pots82: the digger's own crack stage and the port's mining meter, safe for Mining Fatigue V (a NaN or negative break progress).
// Bytecode-read (1.7.10 jar, PlayerControllerMP bje.a(IIII) onPlayerDamageBlock and bje.b clickBlock): World.destroyBlockInWorldPartially(id, x, y, z,
// (int)(curBlockDamageMP * 10.0F) - 1). Java's float-to-int is 0 for NaN, truncates toward zero and saturates; the int subtraction wraps.
// RenderGlobal.destroyBlockPartially keeps a stage only when 0 <= stage < 10, anything else removes the overlay: progress 0, NaN and any
// negative progress show no crack, and the stages are one below floor(progress * 10).
const f = Math.fround;
const javaInt = (v) => (v !== v ? 0 : Math.max(-2147483648, Math.min(2147483647, Math.trunc(v))));
export function clientCrackStage(progress) {
  const s = (javaInt(f(f(Number(progress)) * 10)) - 1) | 0;
  return s >= 0 && s < 10 ? s : -1;
}
// The meter's fill in percent (0-100), never NaN: a non-positive or NaN progress is an empty bar.
export const meterPercent = (progress) => (progress > 0 ? Math.min(100, progress * 100) : 0);
