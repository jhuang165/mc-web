// Retry held use through the normal dispatcher so block/planting activation still wins over food.
export class UseHold {
  constructor() { this.delay = 0; }
  press() { this.delay = 4; }
  tick(down, using, eligible = true) {
    this.delay = Math.max(0, this.delay - 1);
    if (!down) { this.delay = 0; return false; }
    if (!eligible || using || this.delay) return false;
    this.press();
    return true;
  }
}
