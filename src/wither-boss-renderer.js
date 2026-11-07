// RenderWither (bpc) with ModelWither (bin, 64 x 64): the three heads, the shoulders, the spine with three ribs and the tail; wither.png and
// wither_invulnerable.png (the spawn flashing), the growth scale, the armour pass below half health and the boss bar call. Boxes, pivots
// and the per-frame pose are probed from the unchanged ModelWither (public/research/wither-model-reference.json, replayed in
// wither-targets.test.js); the RenderWither numbers (scale, texture choice, armour pass) are bytecode-read (bpc) and checked in
// wither-boss.test.js / wither-targets.test.js. mob-renderer.js calls createWitherRig and the rig's `custom`.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { FOG_PARS } from "./light-material.js";
import { witherTexture, witherPose, witherScalePartial, armorScroll, WITHER_ARMOR_PASS, armored } from "./wither-boss.js";
import { setBossStatus, startBossBar } from "./boss-bar.js";
import { translate } from "./lang.js";
export const WITHER_TEXTURES = { wither: "/media/1.7.10/entity/wither/wither.png", wither_invulnerable: "/media/1.7.10/entity/wither/wither_invulnerable.png" };
const WITHER_LIGHT = 15728880; // xc.c(float): fullbright
// bpc.a(xc, F) armour pass: the invulnerable skin scrolled by (cos(age * 0.02) * 3, age * 0.01), colour 0.5, blended ONE, ONE, lit off.
function armorMaterial(lighting, map) {
  return new THREE.ShaderMaterial({
    uniforms: { ...lighting.uniforms, map: { value: map }, scroll: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv;varying float vFogDistance;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map;uniform vec2 scroll;varying vec2 vUv;${FOG_PARS}
void main(){vec4 t=texture2D(map,fract(vUv+vec2(scroll.x,-scroll.y)));if(t.a<=.1)discard;gl_FragColor=vec4(applyFog(t.rgb*.5),1.);}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}
const turn = (g, ax = 0, ay = 0, az = 0) => (g.rotation.order = "ZYX", g.rotation.set(ax, -ay, -az), g);
// ModelWither's six ModelRenderers with their boxes [x, y, z, w, h, d, u, v] (px), as probed in wither-model-reference.json (the pose
// itself is witherPose in wither-boss.js, replayed there). The armour pass draws the same boxes again (no grown copy: bpc passes mainModel).
export const WITHER_MODEL = [
  { name: "shoulders", boxes: [[-10, 3.9, -0.5, 20, 3, 3, 0, 16]] },
  { name: "spine", boxes: [[0, 0, 0, 3, 10, 3, 0, 22], [-4, 1.5, 0.5, 11, 2, 2, 24, 22], [-4, 4, 0.5, 11, 2, 2, 24, 22], [-4, 6.5, 0.5, 11, 2, 2, 24, 22]] },
  { name: "tail", boxes: [[0, 0, 0, 3, 6, 3, 12, 22]] },
  { name: "head0", boxes: [[-4, -4, -4, 8, 8, 8, 0, 0]] },
  { name: "head1", boxes: [[-4, -4, -4, 6, 6, 6, 32, 0]] },
  { name: "head2", boxes: [[-4, -4, -4, 6, 6, 6, 32, 0]] },
];
export function createWitherRig(renderer) {
  const lighting = renderer.view.lighting, root = new THREE.Group(), frame = new THREE.Group(), shellFrame = new THREE.Group(),
    skins = { wither: entityMaterial(lighting, { map: pixelTexture(WITHER_TEXTURES.wither) }), wither_invulnerable: entityMaterial(lighting, { map: pixelTexture(WITHER_TEXTURES.wither_invulnerable) }) },
    armor = armorMaterial(lighting, pixelTexture(WITHER_TEXTURES.wither_invulnerable)), sets = { wither: [], wither_invulnerable: [] }, shell = [], parts = {};
  root.add(frame);
  frame.position.y = 1 / 128;
  // bpc pass 1: glTranslatef(0, -0.01, 0), glScalef(1.1) in model space about the model origin (1.5 blocks above the feet): in this
  // frame (y up from the feet, z flipped) that is scale 1.1 about the feet and a drop of 0.14.
  shellFrame.scale.setScalar(WITHER_ARMOR_PASS.scale);
  shellFrame.position.y = 1.5 - 1.5 * WITHER_ARMOR_PASS.scale - WITHER_ARMOR_PASS.translateY;
  frame.add(shellFrame);
  shellFrame.visible = false;
  for (const { name, boxes } of WITHER_MODEL) {
    const g = new THREE.Group(), twin = new THREE.Group();
    g.rotation.order = twin.rotation.order = "ZYX";
    frame.add(g); shellFrame.add(twin);
    parts[name] = [g, twin];
    for (const [ox, oy, oz, w, h, d, u, v] of boxes) {
      for (const skin of Object.keys(sets)) {
        const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 64), skins[skin]);
        mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
        g.add(mesh);
        sets[skin].push(mesh);
      }
      const pass = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 64), armor);
      pass.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      pass.renderOrder = 1;
      twin.add(pass);
      shell.push(pass);
    }
  }
  renderer.scene.add(root);
  startBossBar();
  return { root, neck: new THREE.Group(), limbs: [], materials: Object.values(skins), type: "wither", lift: 0, scale: 2, fullbright: WITHER_LIGHT, wither: { parts, shellFrame, sets, shell, armor }, custom: animateWither };
}
// bin.a(f1..f6) and bin.a(sv, f, f, f) through witherPose (replayed against the native render in wither-targets.test.js). bpc: the scale 2
// (smaller while growing, with the partial tick), the texture swap, the armour pass whenever cb() (also during the spawn), the bar.
export function animateWither(r, e, pose, partial = 0) {
  const { parts, shellFrame, sets, armor } = r.wither, invul = e.invul ?? 0;
  const p = witherPose({ age: pose.age, headYaw: pose.headYaw, headPitch: pose.headPitch, bodyYaw: e.renderYawOffset ?? e.rotationYaw ?? pose.bodyYaw ?? 0, sideYaw: e.headYaw ?? [0, 0], sidePitch: e.headPitch ?? [0, 0] });
  for (const [name, [g, twin]] of Object.entries(parts)) {
    const { point: [x, y, z], rot: [rx, ry, rz] } = p[name];
    for (const t of [g, twin]) { t.position.set(x / 16, (24 - y) / 16, -z / 16); turn(t, rx, ry, rz); }
  }
  r.root.scale.setScalar(witherScalePartial(invul, partial));
  const tex = witherTexture(invul);
  for (const [name, meshes] of Object.entries(sets)) for (const m of meshes) m.visible = name === tex;
  shellFrame.visible = armored(e.health);
  const [sx, sy] = armorScroll(pose.age);
  armor.uniforms.scroll.value.set(sx, sy);
  if (e.health > 0) setBossStatus({ health: e.health, maxHealth: 300 }, translate("entity.WitherBoss.name", "Wither"), false);
}
