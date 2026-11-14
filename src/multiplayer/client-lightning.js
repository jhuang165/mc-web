// Batch 66 mplightning: the client half of the server's lightning (server-lightning.js). S2C spawn global entity makes the client's own EntityLightningBolt (random lifetime and
// path of its own, no fire on a remote world); it is ticked like Weather.tick ticks single player's bolts: the sky flash (lastLightningBolt = 2 while its state >= 0),
// ambient.weather.thunder and random.explode, and the drawn path (weather-renderer.js reads weather.bolts).
import { LightningBolt } from '../weather.js';
import { JavaRandom } from '../java-random.js';

export class RemoteLightning {
  // `weather()` returns the client's current Weather; `sound(event)` plays { sound, volume, pitch, x, y, z }.
  constructor(weather, sound = () => {}) { this.weather = weather; this.sound = sound; }
  apply(message) {
    const w = this.weather();
    if (!w || ![message?.x, message?.y, message?.z].every(Number.isFinite) || w.bolts.length >= 32) return;
    w.bolts.push(new LightningBolt(message.x, message.y, message.z, new JavaRandom(Math.floor(Math.random() * 2 ** 48)), null));
  }
  tick() {
    const w = this.weather();
    if (!w) return;
    if (w.lastLightning > 0) w.lastLightning--;
    const events = [];
    for (const b of w.bolts) if (b.tick(events)) w.lastLightning = 2;
    w.bolts = w.bolts.filter(b => !b.dead);
    for (const e of events) this.sound(e);
  }
}
