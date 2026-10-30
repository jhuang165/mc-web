// Curves recovered from 1.7.10 ItemRenderer, EntityRenderer and ModelBiped.
export const SWING_SECONDS = 6 / 20,
  EQUIP_PER_TICK = Math.fround(0.4);
export function swingPose(progress) {
  const s = Math.max(0, Math.min(1, progress)),
    root = Math.sin(Math.sqrt(s) * Math.PI);
  return {
    x: -root * 0.4,
    y: Math.sin(Math.sqrt(s) * Math.PI * 2) * 0.2,
    z: -Math.sin(s * Math.PI) * 0.2,
    rx: (-root * 80 * Math.PI) / 180,
    ry: (-Math.sin(s * s * Math.PI) * 20 * Math.PI) / 180,
    rz: (-root * 20 * Math.PI) / 180,
  };
}
export function bobPose(distance, amount) {
  return {
    x: Math.sin(distance * Math.PI) * amount * 0.5,
    y: -Math.abs(Math.cos(distance * Math.PI) * amount),
    rx:
      (Math.abs(Math.cos(distance * Math.PI - 0.2) * amount) * 5 * Math.PI) /
      180,
    rz: (Math.sin(distance * Math.PI) * amount * 3 * Math.PI) / 180,
  };
}
export function limbAngles(phase, amount) {
  const a = Math.cos(phase * 0.6662) * 1.4 * amount,
    b = Math.cos(phase * 0.6662 + Math.PI) * 1.4 * amount;
  return [a, b, b, a];
}
export class PlayerAnimation {
  constructor() {
    this.reset();
  }
  reset() {
    this.walk = 0;
    this.amount = 0;
    this.swingTime = 1;
    this.equipped = 0;
    this.displayed = 0;
    this.requested = 0;
    this.stepDistance = 0;
    this.eating = 0;
  }
  swing() {
    if (this.swingTime >= SWING_SECONDS * 0.5) this.swingTime = 0;
  }
  frame(
    dt,
    {
      item = 0,
      moving = false,
      speed = 0,
      grounded = true,
      bobbing = true,
      eating = 0,
    } = {},
  ) {
    this.swingTime += dt;
    this.requested = item;
    const target = item === this.displayed ? 1 : 0;
    this.equipped += Math.max(
      -EQUIP_PER_TICK * 20 * dt,
      Math.min(EQUIP_PER_TICK * 20 * dt, target - this.equipped),
    );
    if (this.equipped < 0.1) this.displayed = item;
    this.amount +=
      (Math.min(0.1, speed) * Number(moving && grounded) - this.amount) *
      Math.min(1, dt * 10);
    this.walk += speed * 20 * dt * 0.6;
    this.eating = eating;
    return {
      bob: bobbing ? bobPose(-this.walk, this.amount) : bobPose(0, 0),
      swing: swingPose(Math.min(1, this.swingTime / SWING_SECONDS)),
      equip: this.equipped,
      item: this.displayed,
    };
  }
}
