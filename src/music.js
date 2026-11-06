// MusicTicker (btg), MusicTicker.MusicType (bth), Minecraft.getAmbientMusicType (bao.Y) and the record sound of
// RenderGlobal.playRecord (bma) / PositionedSoundRecord (bso). Facts and the replayed probe: public/research/music.md and
// music-reference.json (tools/probes/MusicProbe.java, the unchanged original classes).
import { JavaRandom } from "./java-random.js";
export const MAX_INT = 2147483647;
// MusicType: the sounds.json event and the minimum / maximum delay (ticks) before the next song.
export const MUSIC_TYPES = Object.freeze({
  MENU: Object.freeze({ name: "MENU", event: "music.menu", min: 20, max: 600 }),
  GAME: Object.freeze({ name: "GAME", event: "music.game", min: 12000, max: 24000 }),
  CREATIVE: Object.freeze({ name: "CREATIVE", event: "music.game.creative", min: 1200, max: 3600 }),
  CREDITS: Object.freeze({ name: "CREDITS", event: "music.game.end.credits", min: MAX_INT, max: MAX_INT }),
  NETHER: Object.freeze({ name: "NETHER", event: "music.game.nether", min: 1200, max: 3600 }),
  END_BOSS: Object.freeze({ name: "END_BOSS", event: "music.game.end.dragon", min: 0, max: 0 }),
  END: Object.freeze({ name: "END", event: "music.game.end", min: 6000, max: 24000 }),
});
// MathHelper.getRandomIntegerInRange (qh.a(Random, int, int)).
export const randomIntInRange = (random, min, max) => (min >= max ? min : random.nextInt(max - min + 1) + min);
// Minecraft.getAmbientMusicType: the credits screen (GuiWinGame), else with a player the Nether, the End (the dragon
// fight while BossStatus has a name and frames left), creative with flight allowed, the Overworld; no player: the menu.
export function ambientMusicType({ credits = false, inWorld = false, dimension = 0, bossName = null, bossFrames = 0, creative = false, allowFlying = creative } = {}) {
  if (credits) return MUSIC_TYPES.CREDITS;
  if (!inWorld) return MUSIC_TYPES.MENU;
  if (dimension === -1) return MUSIC_TYPES.NETHER;
  if (dimension === 1) return bossName && bossFrames > 0 ? MUSIC_TYPES.END_BOSS : MUSIC_TYPES.END;
  return creative && allowFlying ? MUSIC_TYPES.CREATIVE : MUSIC_TYPES.GAME;
}
// MusicTicker.update, once per client tick while the game is not paused. `sound` plays an event (returning a handle,
// or null when nothing could start), stops a handle and answers whether it is still playing.
export class MusicTicker {
  constructor({ play, stop, isPlaying }, random = new JavaRandom(Math.floor(Math.random() * 2 ** 48))) {
    this.random = random;
    this.sound = { play, stop, isPlaying };
    this.current = null; // { event, handle }
    this.timer = 100; // timeUntilNextMusic
  }
  update(type) {
    if (this.current) {
      if (type.event !== this.current.event) {
        this.sound.stop(this.current.handle);
        this.timer = randomIntInRange(this.random, 0, Math.trunc(type.min / 2));
      }
      if (!this.sound.isPlaying(this.current.handle)) {
        this.current = null;
        this.timer = Math.min(randomIntInRange(this.random, type.min, type.max), this.timer);
      }
    }
    if (!this.current && this.timer-- <= 0) {
      this.current = { event: type.event, handle: this.sound.play(type.event) };
      this.timer = MAX_INT;
    }
  }
}
// RenderGlobal.playRecord / PositionedSoundRecord.func_147675_a: "records." + ItemRecord.recordName at the jukebox's
// integer block coordinates (not the block centre), volume 4 (so it carries 16 * 4 = 64 blocks), pitch 1, LINEAR.
export const RECORD_VOLUME = 4;
export function recordSound(name, x, y, z) {
  return { event: "records." + name, volume: RECORD_VOLUME, pitch: 1, attenuation: "LINEAR", position: { x, y, z } };
}
