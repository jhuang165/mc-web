// Opt-in world mods (not 1.7.10): the `mods` field of a world record. Only flags that are exactly true are kept, and an empty
// set leaves the field out, so a vanilla world's record is unchanged. No imports: menus.js and main.js both read it.
export function worldMods(mods) {
  const kept = Object.fromEntries(Object.entries(mods ?? {}).filter(([, v]) => v === true));
  return Object.keys(kept).length ? kept : null;
}
// `fields` with one mod flag set or cleared in its `mods`; other mods' flags are kept.
export function withWorldMod(fields, name, on) {
  const { mods: old, ...rest } = fields;
  const mods = worldMods({ ...(old ?? {}), [name]: on === true });
  return mods ? { ...rest, mods } : rest;
}
