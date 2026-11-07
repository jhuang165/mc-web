// SoundManager's playing-sound bookkeeping (btj.d update, btj.a(bst) isSoundPlaying, btj.b stopSound, btj.c playSound's tail),
// replayed against audio3-reference.json (tools/probes/AudioProbe3.java: the unchanged SoundManager over a fake paulscode
// library whose sources start and end on command). No audio device: `native` is the sound system as the manager sees it.
//
// A sound that started is entered with playingSoundsStopTime = playTime + 20. `isSoundPlaying` is true while the sound system
// says the source plays, and, for a source that does NOT play, only once that stop time has come (playTime >= stop time) and
// until `update` removes it in the same pass: so a sound that is not (yet) playing counts as not playing during its first
// 20 ticks, and a stopped or ended one still counts as playing for the tick the update pass has not run yet. MusicTicker.update
// runs before SoundHandler.update (bytecode of Minecraft.runTick: ticker, then handler, both skipped while the game is paused),
// so the ticker sees the end of a stream one tick late, and MusicTicker's own type-change stop (stopSound, then isSoundPlaying)
// finds the sound still "playing" after its grace and therefore rolls its random delay on two consecutive ticks.
export const STOP_TIME_GRACE = 20;

// native: { playing(name), stop(name), remove(name), start(sound, name), apply(name, sound) } (paulscode's playing / stop /
// removeSource, the newSource + play pair, and the per-tick setVolume / setPitch / setPosition of a tickable sound).
// sound: { canRepeat, repeatDelay, tickable?: { update(), donePlaying() } } (ISound; ITickableSound adds update / isDonePlaying).
export class SoundBookkeeping {
  constructor(native) {
    this.native = native;
    this.playTime = 0;
    this.names = 0;
    this.playing = new Map(); // name -> sound (playingSounds; its BiMap inverse is invPlayingSounds)
    this.nameOf = new Map(); // sound -> name
    this.stopTimes = new Map(); // name -> playTime + 20 (playingSoundsStopTime)
    this.delayed = new Map(); // sound -> due playTime (delayedSounds)
    this.tickables = []; // ITickableSound instances being updated
  }
  // SoundManager.playSound after the sound system accepted it: the name, the stop time, the maps, the tickable list.
  play(sound) {
    const name = `sound_${++this.names}`;
    this.native.start(sound, name);
    this.stopTimes.set(name, this.playTime + STOP_TIME_GRACE);
    this.playing.set(name, sound);
    this.nameOf.set(sound, name);
    if (sound.tickable) this.tickables.push(sound);
    return name;
  }
  isSoundPlaying(sound) {
    const name = this.nameOf.get(sound);
    if (name === undefined || !this.playing.has(name)) return false; // the BiMap inverse: gone with its entry
    return this.native.playing(name) || (this.stopTimes.has(name) && this.stopTimes.get(name) <= this.playTime);
  }
  stopSound(sound) {
    const name = this.nameOf.get(sound);
    if (name !== undefined && this.playing.has(name)) this.native.stop(name);
  }
  // SoundManager.update, once per client tick while the game runs.
  update() {
    this.playTime++;
    for (const sound of [...this.tickables]) {
      sound.tickable.update();
      if (sound.tickable.donePlaying()) this.stopSound(sound);
      else {
        const name = this.nameOf.get(sound);
        if (name !== undefined && this.playing.has(name)) this.native.apply(name, sound);
      }
    }
    for (const [name, sound] of [...this.playing]) {
      if (this.native.playing(name) || this.stopTimes.get(name) > this.playTime) continue;
      if (sound.canRepeat && sound.repeatDelay > 0) this.delayed.set(sound, this.playTime + sound.repeatDelay);
      this.playing.delete(name);
      this.nameOf.delete(sound);
      this.native.remove(name);
      this.stopTimes.delete(name);
      const i = this.tickables.indexOf(sound);
      if (i >= 0) this.tickables.splice(i, 1);
    }
    for (const [sound, due] of [...this.delayed]) {
      if (this.playTime < due) continue;
      if (sound.tickable) sound.tickable.update();
      this.delayed.delete(sound);
      this.play(sound);
    }
  }
  // SoundManager.stopAllSounds: every playing sound stops; the maps (but not the play time) are cleared.
  stopAll() {
    for (const name of this.playing.keys()) this.native.stop(name);
    this.playing.clear();
    this.nameOf.clear();
    this.delayed.clear();
    this.tickables.length = 0;
    this.stopTimes.clear();
  }
}
