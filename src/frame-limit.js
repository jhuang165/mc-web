// Max Framerate (GameSettings.limitFramerate) as Minecraft.runGameLoop applies it: Display.sync(limit)
// when getLimitFramerate() is below the slider maximum (260, "Unlimited"); getLimitFramerate is 30
// with no world and a screen open (the title screen), else the setting. Display.sync waits for the
// next frame time and then sets it to max(next + 1000 / fps, now); requestAnimationFrame cannot wait,
// so a frame that arrives before its time is skipped (1 ms early still draws). VSync is always on
// for requestAnimationFrame, so Use VSync is saved but cannot unlock frames above the display rate.
export const FRAMERATE_MAX = 260;
export const limitFramerate = ({ world, screen, maxFps }) => (!world && screen ? 30 : maxFps);
export class FrameLimiter {
  constructor() { this.next = 0; }
  // Whether the frame at `now` (ms) is drawn under `fps`.
  ready(now, fps) {
    if (!(fps < FRAMERATE_MAX)) { this.next = now; return true; }
    if (now < this.next - 1) return false;
    this.next = Math.max(this.next + 1000 / fps, now);
    return true;
  }
}
