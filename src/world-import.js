// Keep the runtime payload shared between local saves and imported exports.
// Each subsystem validates its own payload on launch. Identity and the validated
// world/player fields are built by the caller rather than copied from the file.
const RUNTIME_FIELDS = [
  "position", "drops", "entities", "farms", "experience", "xpOrbs", "falling",
  "weather", "projectiles", "arrows", "tnt", "fluidTicks", "fireTicks",
];

export function importedRuntime(data) {
  return Object.fromEntries(RUNTIME_FIELDS.filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]));
}
