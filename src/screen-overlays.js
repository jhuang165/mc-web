// Draws the three ItemRenderer.renderOverlays layers (fire, inside-block, water) over the finished world pass, after the
// hand, with the geometry of fire-fx.js. They use their own camera (identity view, the hand's projection) like first-person.js.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { blockTile, tileRect } from "./block-textures.js";
import { FIRE_OVERLAY, INSIDE_BLOCK_OVERLAY, fireOverlayQuads, insideBlockQuad, waterOverlayQuad, handFov, overlayPlan } from "./fire-fx.js";

// Side 2 (north) of the original is face 5 (-z) in block-textures.js's order (+x, -x, +y, -y, +z, -z).
const PORT_NORTH_FACE = INSIDE_BLOCK_OVERLAY.side === 2 ? 5 : 5;
const VERT = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
function quadGeometry(quads) {
  const pos = [], uv = [], index = [];
  for (const q of quads) {
    const b = pos.length / 3;
    for (const v of q) { pos.push(v.x, v.y, v.z); uv.push(v.u, v.v); }
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}
const overlayMaterial = (params) => new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false, ...params });

export class ScreenOverlays {
  constructor(renderer, atlas) {
    this.renderer = renderer;
    this.atlas = atlas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 10);
    // Fire: fire_layer_1, two quads, the animated frame picked by the shader (32 one-tick frames like the world's fire).
    const icon = { minU: 0, maxU: 1, minV: 1, maxV: 0 }; // three-space v: minV is the top of the frame
    this.fireMaterial = new THREE.ShaderMaterial({
      uniforms: { map: { value: pixelTexture("/media/1.7.10/blocks/fire_layer_1.png") }, frame: { value: 0 }, frames: { value: 32 }, alpha: { value: FIRE_OVERLAY.alpha } },
      vertexShader: VERT, transparent: true, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D map;uniform float frame,frames,alpha;varying vec2 vUv;void main(){vec4 c=texture2D(map,vec2(vUv.x,(vUv.y+frames-1.-frame)/frames));gl_FragColor=vec4(c.rgb,c.a*alpha);}",
    });
    this.fire = new THREE.Mesh(quadGeometry(fireOverlayQuads(icon)), this.fireMaterial);
    // Inside block: the atlas tile of side 2 at a tenth of its brightness.
    this.block = new THREE.Mesh(new THREE.BufferGeometry(), overlayMaterial({ map: atlas, opacity: 1 }));
    this.blockId = -1;
    // Water: misc/underwater.png repeating, brightness-tinted at 0.5 alpha.
    const tex = pixelTexture("/media/1.7.10/misc/underwater.png");
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), overlayMaterial({ map: tex }));
    for (const m of [this.fire, this.block, this.water]) { m.frustumCulled = false; m.visible = false; this.scene.add(m); }
  }
  // state: { burning, thirdPerson, sleeping, insideBlock (block id or 0), inWater, brightness, yawDeg, pitchDeg, tick, aspect, viewInWater }
  render(state) {
    const plan = overlayPlan({ burning: state.burning, thirdPerson: state.thirdPerson, sleeping: state.sleeping, insideOpaque: state.insideBlock > 0, inWater: state.inWater });
    this.shown = plan;
    if (!plan.length) return;
    this.camera.aspect = state.aspect;
    this.camera.fov = handFov(state.viewInWater);
    this.camera.updateProjectionMatrix();
    this.fire.visible = plan.includes("fire");
    this.block.visible = plan.includes("block");
    this.water.visible = plan.includes("water");
    if (this.fire.visible) this.fireMaterial.uniforms.frame.value = Math.floor(state.tick) % 32;
    if (this.block.visible && this.blockId !== state.insideBlock) {
      const r = tileRect(blockTile(state.insideBlock, PORT_NORTH_FACE), 0);
      const q = insideBlockQuad({ minU: r.u0, maxU: r.u1, minV: r.v1, maxV: r.v0 });
      this.block.geometry.dispose();
      this.block.geometry = quadGeometry([q.vertices]);
      this.block.material.color.setRGB(...q.color.slice(0, 3));
      this.blockId = state.insideBlock;
    }
    if (this.water.visible) {
      const q = waterOverlayQuad({ brightness: state.brightness, yaw: state.yawDeg, pitch: state.pitchDeg });
      this.water.geometry.dispose();
      this.water.geometry = quadGeometry([q.vertices.map((v) => ({ ...v, v: -v.v }))]);
      this.water.material.color.setRGB(...q.color.slice(0, 3));
      this.water.material.opacity = q.color[3];
    }
    const clear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = clear;
  }
}
