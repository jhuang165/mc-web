import * as THREE from "three";
import { createHorseRig } from "./horse-renderer.js";
import { createLighting } from "./light-material.js";
import { paperdollPose, paperdollMatrix, paperdollLights } from "./inventory-player.js";
import { growthScale } from "./horse.js";

// GuiScreenHorseInventory.func_146976_a (bft.a(FII)V, javap -c): after the horse.png quads it calls
// GuiInventory.func_147046_a(guiLeft + 51, guiTop + 60, 17, guiLeft + 51 - mouseX, guiTop + 75 - 50 - mouseY, horse),
// the same pose maths as the inventory player (inventory-player.js) with anchor (51, 60) and scale 17.
// The model is drawn with the existing horse rig at rest (no limb swing, no rear/eat animation).
export const HORSE_PREVIEW_LAYOUT = { x: 51, y: 60, scale: 17, lookX: 51, lookY: 25, width: 176, height: 166 };

// The pose for a mouse position in GUI pixels from the screen's top left.
export const horsePreviewPose = (guiX, guiY) => paperdollPose(HORSE_PREVIEW_LAYOUT.lookX - guiX, HORSE_PREVIEW_LAYOUT.lookY - guiY);

const RAD = Math.PI / 180;

// A private WebGL canvas drawn while the horse screen is open (same arrangement as InventoryPlayerView).
export class HorsePreviewView {
  constructor(sceneView) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "paperdoll-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, powerPreference: "low-power" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0, 0);
    this.scene = new THREE.Scene();
    this.holder = new THREE.Group();
    this.holder.matrixAutoUpdate = false;
    this.scene.add(this.holder);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 1, 4000);
    this.lighting = createLighting();
    this.lighting.data.fill(255);
    this.lighting.texture.needsUpdate = true;
    this.lighting.uniforms.fogNear.value = 1e8;
    this.lighting.uniforms.fogFar.value = 2e8;
    this.view = { lighting: this.lighting, brightness: () => 1, get subtracted() { return sceneView?.subtracted ?? 0; } };
    this.rig = null;
    this.size = "";
  }
  // Show `horse` (the mob record's `horse` state) in `host`, before `before` so the slots draw over the model.
  attach(host, before, horse) {
    this.dispose();
    this.horse = horse;
    this.rig = createHorseRig({ scene: this.holder, view: this.view }, { horse });
    this.mounted = true;
    if (this.canvas.parentNode !== host || this.canvas.nextSibling !== before) host.insertBefore(this.canvas, before ?? null);
    this.canvas.style.setProperty("--w", HORSE_PREVIEW_LAYOUT.width);
    this.canvas.style.setProperty("--h", HORSE_PREVIEW_LAYOUT.height);
    this.size = "";
  }
  dispose() {
    if (this.rig) {
      this.holder.remove(this.rig.root);
      this.rig.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of this.rig.materials) m.dispose();
    }
    this.rig = null;
  }
  detach() {
    this.dispose();
    this.canvas.remove();
    this.mounted = false;
  }
  frame(guiX, guiY, unit) {
    const L = HORSE_PREVIEW_LAYOUT, rig = this.rig;
    if (!rig) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), width = Math.round(L.width * unit * dpr), height = Math.round(L.height * unit * dpr), key = `${width}x${height}`;
    if (key !== this.size) {
      this.size = key;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      Object.assign(this.camera, { left: 0, right: L.width, top: 0, bottom: L.height });
      this.camera.updateProjectionMatrix();
    }
    const pose = horsePreviewPose(guiX, guiY), h = this.horse;
    this.holder.matrix.copy(paperdollMatrix(L, pose.tilt));
    this.holder.matrixWorldNeedsUpdate = true;
    // Saddle, chest bags, ears and armour follow the live record (the stacks change while the screen is open).
    rig.custom?.(null, { horse: h });
    rig.root.position.set(0, rig.lift ?? 0, 0);
    rig.root.scale.setScalar(growthScale(h.age ?? 0));
    rig.root.rotation.set(0, -pose.renderYawOffset * RAD, 0);
    // The head turns by rotationYawHead - renderYawOffset and the pose pitch, as in MobRenderer.update.
    rig.neck.rotation.set(pose.rotationPitch * RAD, -(pose.rotationYawHead - pose.renderYawOffset) * RAD, 0);
    const lights = paperdollLights(L);
    for (const m of rig.materials) if (m.uniforms?.light0) { m.uniforms.light0.value = lights[0]; m.uniforms.light1.value = lights[1]; }
    this.renderer.render(this.scene, this.camera);
  }
}
