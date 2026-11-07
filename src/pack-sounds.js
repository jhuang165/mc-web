// sounds.json from resource packs (SoundHandler.onResourceManagerReload / loadSoundResource, SoundListSerializer, SoundList$SoundEntry
// of Minecraft 1.7.10; bytecode-read, see public/research/resource-packs.md). Every pack's assets/minecraft/sounds.json is parsed in
// pack order (lowest priority first) and applied over the vanilla event table: an entry with "replace": true starts the event over
// with the entry's category, otherwise its sounds are appended to the existing composite (the first definition's category stays).
// A sound entry is a name or { name, type: "file"|"event", volume, pitch, weight, stream }; volume, pitch and weight must be > 0.
// A file entry needs sounds/<name>.ogg in a pack or the bundled set (else the sound is skipped, a warning natively).

// SoundCategory.getCategory(name): the lookup keys, not the enum names.
export const SOUND_CATEGORIES = ["master", "music", "record", "weather", "block", "hostile", "neutral", "player", "ambient"];

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const must = (cond, message) => { if (!cond) throw new Error(message); };

// SoundListSerializer.deserialize for the whole file (Map<String, SoundList>). One invalid entry rejects the file (the
// native Gson read throws inside fromJson and SoundHandler logs "Invalid sounds.json"). Returns [{ event, replace, category, sounds }].
export function parseSoundsJson(text) {
  const root = JSON.parse(String(text).replace(/^﻿/, ""));
  must(root && typeof root === "object" && !Array.isArray(root), "Expected sounds.json to be a JsonObject");
  const events = [];
  for (const [event, entry] of Object.entries(root)) {
    must(entry && typeof entry === "object" && !Array.isArray(entry), "Expected entry to be a JsonObject");
    let replace = false;
    if ("replace" in entry) { must(typeof entry.replace === "boolean", "Expected replace to be a Boolean"); replace = entry.replace; }
    const category = "category" in entry ? entry.category : "master";
    must(typeof category === "string" && SOUND_CATEGORIES.includes(category), "Invalid category");
    const sounds = [];
    if ("sounds" in entry) {
      must(Array.isArray(entry.sounds), "Expected sounds to be a JsonArray");
      for (const value of entry.sounds) {
        const sound = { name: "", type: "file", volume: 1, pitch: 1, weight: 1, stream: false };
        if (typeof value === "string") sound.name = value;
        else {
          must(value && typeof value === "object" && !Array.isArray(value), "Expected sound to be a JsonObject");
          must(typeof value.name === "string", "Missing name, expected to find a String");
          sound.name = value.name;
          if ("type" in value) { must(value.type === "file" || value.type === "event", "Invalid type"); sound.type = value.type; }
          for (const key of ["volume", "pitch"]) if (key in value) { must(isNumber(value[key]) && value[key] > 0, "Invalid " + key); sound[key] = value[key]; }
          if ("weight" in value) { must(isNumber(value.weight) && Math.trunc(value.weight) > 0, "Invalid weight"); sound.weight = Math.trunc(value.weight); }
          if ("stream" in value) { must(typeof value.stream === "boolean", "Expected stream to be a Boolean"); sound.stream = value.stream; }
        }
        sounds.push(sound);
      }
    }
    events.push({ event, replace, category, sounds });
  }
  return events;
}

// The base manifest shape of SoundBank: { files: { name: { url, stream? } }, events: { event: { category, sounds: [...] } } }.
// `layers` is [{ pack, events }] from parseSoundsJson, lowest priority first; `packFiles` the sound names ("mob/pig/say1") some
// selected pack ships as sounds/<name>.ogg. Returns a new manifest (the base is not changed) and a list of warnings.
export function applySoundLayers(base, layers = [], packFiles = []) {
  const files = { ...base.files }, events = {}, warnings = [];
  for (const [event, def] of Object.entries(base.events)) events[event] = { ...def, sounds: [...(def.sounds ?? [])] };
  const known = new Set(packFiles);
  for (const { pack, events: list } of layers) {
    for (const { event, replace, category, sounds } of list) {
      // `!registry.containsKey(event) || list.isReplacing()` starts a fresh composite with this entry's category.
      if (!events[event] || replace) events[event] = { category, sounds: [] };
      for (const s of sounds) {
        if (s.type === "event") { events[event].sounds.push({ type: "event", name: s.name.replace(/^minecraft:/, ""), ...(s.weight !== 1 ? { weight: s.weight } : {}) }); continue; }
        const name = s.name.replace(/^minecraft:/, "");
        if (name.includes(":") || name.includes("..")) { warnings.push(`${pack}: ${event}: sound ${s.name} is outside the minecraft namespace`); continue; }
        if (!files[name] && !known.has(name)) { warnings.push(`${pack}: File ${name} does not exist, cannot add it to event ${event}`); continue; }
        if (!files[name]) files[name] = { url: (s.stream ? "/audio/1.7.10-streams/" : "/audio/1.7.10/") + name + ".ogg", ...(s.stream ? { stream: true } : {}) };
        const entry = { name };
        if (s.volume !== 1) entry.volume = s.volume;
        if (s.pitch !== 1) entry.pitch = s.pitch;
        if (s.weight !== 1) entry.weight = s.weight;
        if (s.stream) entry.stream = true;
        events[event].sounds.push(entry);
      }
    }
  }
  return { manifest: { ...base, files, events }, warnings };
}
