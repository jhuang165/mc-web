import * as THREE from "three";
import { installAnaglyphUpload } from "./anaglyph.js";
import { guiAnaglyph } from "./gui-anaglyph.js";
import { PlayerRenderer } from "./player-renderer.js";
import { createLighting, ITEM_LIGHTS } from "./light-material.js";

// The live player in GuiInventory (bfu) and in the survival-inventory tab of GuiContainerCreative (bfl): both call
// GuiInventory.func_147046_a (bfu.a(IIIFFLsv;)V, "drawEntityOnScreen"). Constants below are read from that bytecode and
// recorded in public/research/inventory-player-reference.json (tools/verify-inventory-player.mjs). See
// public/research/inventory-player.md for what is native-verified and what is approximated.
const f = Math.fround;

// bfu.func_146976_a: a(guiLeft + 51, guiTop + 75, 30, guiLeft + 51 - mouseX, guiTop + 75 - 50 - mouseY, thePlayer).
// bfl.func_146976_a (inventory tab): a(guiLeft + 43, guiTop + 45, 20, guiLeft + 43 - mouseX, guiTop + 45 - 30 - mouseY, thePlayer).
// `size` is the GUI size in pixels (xSize x ySize) the canvas covers.
export const PAPERDOLL_LAYOUTS = {
  inventory: { x: 51, y: 75, scale: 30, lookX: 51, lookY: 25, width: 176, height: 166 },
  creative: { x: 43, y: 45, scale: 20, lookX: 43, lookY: 15, width: 195, height: 136 },
};

// func_147046_a: renderYawOffset = atan(mx / 40) * 20, rotationYaw = atan(mx / 40) * 40, rotationYawHead (and its
// previous value) = rotationYaw, rotationPitch = -atan(my / 40) * 20, and a glRotatef of -atan(my / 40) * 20 about the
// x axis. Everything is float arithmetic around Math.atan(double).
export function paperdollPose(mx, my) {
  const ax = f(Math.atan(f(f(mx) / 40))), ay = f(Math.atan(f(f(my) / 40)));
  const pitch = f(-ay * 20);
  return { renderYawOffset: f(ax * 20), rotationYaw: f(ax * 40), rotationYawHead: f(ax * 40), rotationPitch: pitch, tilt: pitch };
}

// GUI offset of the mouse from the model's anchor, for a layout and the mouse in GUI pixels relative to guiLeft/guiTop.
export function paperdollLook(layout, guiX, guiY) {
  return paperdollPose(layout.lookX - guiX, layout.lookY - guiY);
}

// The model-view matrix of func_147046_a up to the entity: translate(x, y, 50), scale(-s, s, s), rotate 180 about z,
// [rotate 135 / lighting / rotate -135 about y cancel], rotate tilt about x. The entity's yOffset translate and
// RenderPlayer's `y - yOffset` cancel, so the feet sit on the anchor. `depth` is the eye-space z of the GUI plane
// (the GUI's glTranslatef(0, 0, -2000)).
export function paperdollMatrix(layout, tilt, depth = -2000) {
  const m = new THREE.Matrix4().makeTranslation(layout.x, layout.y, depth + 50);
  m.multiply(new THREE.Matrix4().makeScale(-layout.scale, layout.scale, layout.scale));
  m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
  m.multiply(new THREE.Matrix4().makeRotationX((tilt * Math.PI) / 180));
  return m;
}

// RenderHelper.enableStandardItemLighting is called with the model-view of translate/scale/rotateZ(180)/rotateY(135) applied, so the
// two light directions are those vectors transformed by that matrix (a direction, mirror included).
export function paperdollLights(layout) {
  const m = new THREE.Matrix4().makeScale(-layout.scale, layout.scale, layout.scale);
  m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
  m.multiply(new THREE.Matrix4().makeRotationY((135 * Math.PI) / 180));
  return ITEM_LIGHTS.map((l) => l.clone().transformDirection(m));
}

// An EntityLivingBase stand-in for PlayerRenderer.update at partial tick 1 (func_147046_a renders with partialTicks 1).
export function paperdollBody(pose, limb) {
  return {
    px: 0, py: 0, pz: 0, x: 0, y: 0, z: 0,
    rotationYaw: pose.rotationYaw, renderYawOffset: pose.renderYawOffset, prevRenderYawOffset: pose.renderYawOffset,
    rotationYawHead: pose.rotationYawHead, prevRotationYawHead: pose.rotationYawHead,
    rotationPitch: pose.rotationPitch, prevRotationPitch: pose.rotationPitch,
    limbSwing: limb.limbSwing, limbSwingAmount: limb.limbSwingAmount, prevLimbSwingAmount: limb.prevLimbSwingAmount,
    growingAge: 0, death: 0, age: limb.age,
  };
}

// A private WebGL canvas drawn while an inventory screen is open. The model, armour, held item, hurt tint and
// invisibility come from the same PlayerRenderer as the third-person view.
export class InventoryPlayerView {
  constructor(sceneView) {
    this.sceneView = sceneView;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "paperdoll-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, powerPreference: "low-power" });
    installAnaglyphUpload(this.renderer.getContext(), guiAnaglyph); // GUI textures upload converted while 3D Anaglyph is on (TextureUtil.anaglyphColor)
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0, 0);
    this.scene = new THREE.Scene();
    this.holder = new THREE.Group();
    this.holder.matrixAutoUpdate = false;
    this.scene.add(this.holder);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 1, 4000);
    // The GUI draws entities without the lightmap (full brightness); only the item lights and 0.4 ambient shade them.
    this.lighting = createLighting();
    this.lighting.data.fill(255);
    this.lighting.texture.needsUpdate = true;
    // The GUI has no fog; the model sits ~2000 units from the eye in this camera.
    this.lighting.uniforms.fogNear.value = 1e8;
    this.lighting.uniforms.fogFar.value = 2e8;
    const real = sceneView, owner = this;
    this.view = {
      lighting: this.lighting,
      // The hurt tint's brightness is the real entity's world light (RendererLivingEntity), not the model's GUI position.
      brightness: () => real.brightness(owner.feet.x, owner.feet.y + 1.188, owner.feet.z),
      get subtracted() { return real.subtracted ?? 0; },
    };
    this.feet = { x: 0, y: 0, z: 0 };
    this.player = new PlayerRenderer(this.holder, this.view, real.textures.texture);
    this.lightKey = "";
    this.size = "";
  }
  // Put the canvas in `host` just before `before` (the slot layer) so items draw over the model.
  attach(host, before, mode) {
    this.mode = mode;
    if (this.canvas.parentNode !== host || this.canvas.nextSibling !== before) host.insertBefore(this.canvas, before ?? null);
    this.canvas.style.setProperty("--w", PAPERDOLL_LAYOUTS[mode].width);
    this.canvas.style.setProperty("--h", PAPERDOLL_LAYOUTS[mode].height);
    this.lightKey = "";
    this.size = "";
  }
  detach() {
    this.canvas.remove();
    this.mode = null;
  }
  // `guiX`/`guiY`: mouse in GUI pixels from the screen's top left; `state` is PlayerRenderer.update's option bag plus
  // `limb`; `unit` is CSS pixels per GUI pixel.
  frame(guiX, guiY, unit, state, limb, feet) {
    const layout = PAPERDOLL_LAYOUTS[this.mode];
    if (!layout) return;
    this.feet = feet;
    const dpr = Math.min(devicePixelRatio || 1, 2), width = Math.round(layout.width * unit * dpr), height = Math.round(layout.height * unit * dpr), key = `${width}x${height}`;
    if (key !== this.size) {
      this.size = key;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      Object.assign(this.camera, { left: 0, right: layout.width, top: 0, bottom: layout.height });
      this.camera.updateProjectionMatrix();
    }
    const pose = paperdollLook(layout, guiX, guiY);
    this.holder.matrix.copy(paperdollMatrix(layout, pose.tilt));
    this.holder.matrixWorldNeedsUpdate = true;
    this.player.update(paperdollBody(pose, limb), 1, { ...state, fireViewYaw: 180, visible: true });
    const lights = paperdollLights(layout);
    for (const m of this.player.materials) {
      if (m.uniforms.light0) {
        m.uniforms.light0.value = lights[0];
        m.uniforms.light1.value = lights[1];
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
