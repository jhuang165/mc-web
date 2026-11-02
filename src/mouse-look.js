// Mouse look of 1.7.10: EntityRenderer.updateCameraAndRender (per frame), EntityRenderer.updateRenderer
// (per tick, the cinematic camera filters), MouseFilter.smooth and Entity.setAngles. Constants read
// with javap from the pinned client JAR (blt, qm, sa); see settings-parity-catalogue.md.
import { lookCurve } from "./settings.js";

const f = Math.fround;

// net.minecraft.util.MouseFilter (qm), three float fields in declaration order.
export class MouseFilter {
  constructor() {
    this.a = 0; // field_76336_a: accumulated input
    this.b = 0; // field_76334_b: accumulated output
    this.c = 0; // field_76335_c: smoothed step
  }
  // func_76333_a(delta, factor).
  smooth(delta, factor) {
    this.a = f(this.a + delta);
    let d = f(f(this.a - this.b) * factor);
    this.c = f(this.c + f(f(d - this.c) * f(0.5)));
    if ((d > 0 && d > this.c) || (d < 0 && d < this.c)) d = this.c;
    this.b = f(this.b + d);
    return d;
  }
}

export class MouseLook {
  constructor() {
    this.filterX = new MouseFilter(); // mouseFilterXAxis
    this.filterY = new MouseFilter(); // mouseFilterYAxis
    this.smoothYaw = 0; // smoothCamYaw (K): curve-scaled input gathered since the last tick
    this.smoothPitch = 0; // smoothCamPitch (L)
    this.filteredYaw = 0; // smoothCamFilterX (M): this tick's filtered turn
    this.filteredPitch = 0; // smoothCamFilterY (N)
    this.partial = 0; // smoothCamPartialTicks (O)
  }
  // updateRenderer: with smoothCamera on, filter the gathered input with factor 0.05 * curve.
  tick(sensitivity, smoothCamera) {
    if (!smoothCamera) return;
    const k = f(f(0.05) * lookCurve(sensitivity));
    this.filteredYaw = this.filterX.smooth(this.smoothYaw, k);
    this.filteredPitch = this.filterY.smooth(this.smoothPitch, k);
    this.partial = 0;
    this.smoothYaw = 0;
    this.smoothPitch = 0;
  }
  // updateCameraAndRender: the mouse delta of this frame (dx right, dy up, as LWJGL reports) and the
  // render partial tick give the two Entity.setAngles arguments. invertMouse negates the pitch one.
  frame(dx, dy, partial, { sensitivity, invertMouse = false, smoothCamera = false }) {
    const curve = lookCurve(sensitivity);
    let yaw = f(f(dx) * curve), pitch = f(f(dy) * curve);
    const invert = invertMouse ? -1 : 1;
    if (smoothCamera) {
      this.smoothYaw = f(this.smoothYaw + yaw);
      this.smoothPitch = f(this.smoothPitch + pitch);
      const step = f(f(partial) - this.partial);
      this.partial = f(partial);
      yaw = f(this.filteredYaw * step);
      pitch = f(this.filteredPitch * step);
    }
    return [yaw, f(pitch * invert)];
  }
}

// Entity.setAngles: rotationYaw += yaw * 0.15, rotationPitch -= pitch * 0.15, pitch clamped to
// [-90, 90] degrees. The port keeps yaw/pitch in radians with pitch up positive (rotationPitch
// negated), so the clamp is +-PI/2.
export function setAngles(view, yaw, pitch) {
  const rad = (0.15 * Math.PI) / 180;
  view.yaw -= yaw * rad;
  view.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, view.pitch + pitch * rad));
  return view;
}
