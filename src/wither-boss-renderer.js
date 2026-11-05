// RenderWither (bpc) with ModelWither (bin, 64 x 64): the three heads, the shoulders, the spine with three ribs and the tail; wither.png and
// wither_invulnerable.png (the spawn flashing), the growth scale, the armour pass below half health and the boss bar call. Boxes, pivots
// and animations are read from bin.<init> / bin.a(FFFFFF) / bin.a(sv,FFF) and bpc.a/b/a(F) bytecode (bytecode-derived, not run);
// the texture, scale and bar numbers are replayed in wither-boss.test.js. mob-renderer.js calls createWitherRig and the rig's `custom`.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { FOG_PARS } from "./light-material.js";
import { mhCos } from "./lighting.js";
import { witherTexture, witherScale, armored } from "./wither-boss.js";
import { setBossStatus, startBossBar } from "./boss-bar.js";
const RAD = 1 / 57.3, f = Math.fround;
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
export function createWitherRig(renderer) {
  const lighting = renderer.view.lighting, root = new THREE.Group(), frame = new THREE.Group(),
    skins = { wither: entityMaterial(lighting, { map: pixelTexture(WITHER_TEXTURES.wither) }), wither_invulnerable: entityMaterial(lighting, { map: pixelTexture(WITHER_TEXTURES.wither_invulnerable) }) },
    armor = armorMaterial(lighting, pixelTexture(WITHER_TEXTURES.wither_invulnerable)), sets = { wither: [], wither_invulnerable: [] }, shell = [];
  root.add(frame);
  frame.position.y = 1 / 128;
  const part = ([x, y, z]) => { const g = new THREE.Group(); g.rotation.order = "ZYX"; g.position.set(x / 16, (24 - y) / 16, -z / 16); frame.add(g); return g; };
  // One box in both skins, plus its ModelWither(0.5) copy for the armour pass (grown 0.5 each side, drawn at 1.1).
  const box = (parent, ox, oy, oz, w, h, d, u, v) => {
    for (const name of Object.keys(sets)) {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 64), skins[name]);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      sets[name].push(mesh);
    }
    const pass = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 64), armor);
    pass.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
    pass.scale.set((w + 1) / w * 1.1, (h + 1) / h * 1.1, (d + 1) / d * 1.1);
    pass.renderOrder = 1;
    pass.visible = false;
    parent.add(pass);
    shell.push(pass);
  };
  const heads = [part([0, 0, 0]), part([-8, 4, 0]), part([10, 4, 0])];
  box(heads[0], -4, -4, -4, 8, 8, 8, 0, 0);
  for (const h of [heads[1], heads[2]]) box(h, -4, -4, -4, 6, 6, 6, 32, 0);
  box(part([0, 0, 0]), -10, 3.9, -0.5, 20, 3, 3, 0, 16);
  const spine = part([-2, 6.9, -0.5]), tail = part([-2, 6.9, -0.5]);
  box(spine, 0, 0, 0, 3, 10, 3, 0, 22);
  for (const y of [1.5, 4, 6.5]) box(spine, -4, y, 0.5, 11, 2, 2, 24, 22);
  box(tail, 0, 0, 0, 3, 6, 3, 12, 22);
  renderer.scene.add(root);
  startBossBar();
  return { root, neck: new THREE.Group(), limbs: [], materials: Object.values(skins), type: "wither", lift: 0, scale: 2, fullbright: WITHER_LIGHT, wither: { heads, spine, tail, sets, shell, armor }, custom: animateWither };
}
const lerp = (a, b, p) => a + (b - a) * p;
const wrap = (a) => { a %= 360; return a >= 180 ? a - 360 : a < -180 ? a + 360 : a; };
// bin.a(f1..f6) and bin.a(sv, f, f, f): the spine and tail nod with cos(age * 0.1); the middle head follows the head yaw and pitch, the side
// heads their own tracked angles relative to the body. bpc: the scale 2 (smaller while growing), the texture swap, the armour pass, the bar.
export function animateWither(r, e, pose, partial = 0) {
  const { heads, spine, tail, sets, shell, armor } = r.wither, age = pose.age, c = mhCos(age * 0.1), invul = e.invul ?? 0;
  turn(spine, (0.065 + 0.05 * c) * Math.PI);
  turn(tail, (0.265 + 0.1 * c) * Math.PI);
  const sx = Math.sin((0.065 + 0.05 * c) * Math.PI) * 10, cx = Math.cos((0.065 + 0.05 * c) * Math.PI) * 10;
  tail.position.set(-2 / 16, (24 - (6.9 + cx)) / 16, -(-0.5 + sx) / 16);
  turn(heads[0], pose.headPitch * RAD, pose.headYaw * RAD, 0);
  for (let i = 0; i < 2; i++) {
    const yaw = lerp(e.prevHeadYaw?.[i] ?? 0, e.headYaw?.[i] ?? 0, partial), pitch = lerp(e.prevHeadPitch?.[i] ?? 0, e.headPitch?.[i] ?? 0, partial);
    turn(heads[i + 1], pitch * RAD, wrap(yaw - pose.bodyYaw) * RAD, 0);
  }
  r.root.scale.setScalar(witherScale(invul));
  const tex = witherTexture(invul);
  for (const [name, meshes] of Object.entries(sets)) for (const m of meshes) m.visible = name === tex;
  const shown = armored(e.health) && invul <= 0;
  for (const m of shell) m.visible = shown;
  armor.uniforms.scroll.value.set(Math.cos(age * 0.02) * 3, age * 0.01);
  if (e.health > 0) setBossStatus({ health: e.health, maxHealth: 300 }, "Wither", false);
}
