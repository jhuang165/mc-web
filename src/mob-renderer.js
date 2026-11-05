import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { limbAngles } from "./animation.js";
import { entityMaterial, FOG_PARS } from "./light-material.js";
import { ENTITY_TYPES, mobPose } from "./entities.js";
import { FLEECE_COLORS } from "./sheep.js";
import { BRIGHTNESS, mhSin, mhCos } from "./lighting.js";
import { heldItemMatrix } from "./player-renderer.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { spiderLegs } from "./spider.js";
import { SILVERFISH_MODEL, silverfishPose } from "./silverfish.js";
import { creeperFlash, creeperScale, creeperWhite, creeperPose, armorScroll } from "./creeper.js";
import { isInvisible } from "./mob-effects.js";
import { createVillagerRig, villagerLegAngle } from "./villager-renderer.js";
import { createIronGolemRig, animateIronGolem } from "./iron-golem-renderer.js";
import { createWitchRig, animateWitch } from "./witch-renderer.js";
import { createSlimeRig, animateSlime } from "./slime-renderer.js";
import { mobScale } from "./slime.js";
import { createWolfRig, animateWolf } from "./wolf-renderer.js";
import { createOcelotRig } from "./ocelot-renderer.js";
import { createEndermanRig, animateEnderman } from "./enderman-renderer.js";
import { createSquidRig, createBatRig } from "./squid-bat-renderer.js";
const RAD = Math.PI / 180;
// RenderCreeper's powered pass (bni.a(xz, I, F), pass 1): creeper_armor.png with the texture
// matrix translated by (scroll, scroll), colour 0.5, lighting off, blended GL_ONE, GL_ONE.
// three.js flips v, so the scroll runs down v here. GL_REPEAT is the fract().
function armorMaterial(lighting, map) {
  return new THREE.ShaderMaterial({
    uniforms: { ...lighting.uniforms, map: { value: map }, scroll: { value: 0 } },
    vertexShader: `varying vec2 vUv;varying float vFogDistance;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map;uniform float scroll;varying vec2 vUv;${FOG_PARS}
void main(){vec4 t=texture2D(map,fract(vUv+vec2(scroll,-scroll)));if(t.a<=.1)discard;gl_FragColor=vec4(applyFog(t.rgb*.5),1.);}`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
// RendererLivingEntity.doRender: rotateCorpse, scale(-1, -1, 1), preRenderCallback, then
// translate(0, -24 * 0.0625 - 0.0078125, 0): RenderCreeper's swell scale is taken about the
// point 1.5078125 above the feet, so the swollen feet sink a little.
const MODEL_ORIGIN = 24 / 16 + 1 / 128;
export class MobRenderer {
  // `view` supplies the lightmap and world brightness (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.rigs = new Map();
  }
  // RenderSheep (boq) with ModelSheep2 (bhy, sheep.png) and its fur pass ModelSheep1
  // (bhx, sheep_fur.png, tinted by the fleece colour, skipped once sheared). Boxes and
  // pivots are the model's own: x stays, y runs down from 24 and z points to the
  // back, so three.js gets (x, 24 - y, -z) / 16, and an X rotation keeps its sign.
  createSheep() {
    const root = new THREE.Group(), neck = new THREE.Group(), limbs = [], fur = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/sheep/sheep.png") }),
      wool = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/sheep/sheep_fur.png") });
    neck.rotation.order = "YXZ";
    root.add(neck);
    // A ModelBox at model offset (ox, oy, oz) inflated by `grow` on every side; the
    // texture still maps the uninflated size, as ModelBox does.
    const part = (material, parent, w, h, d, u, v, ox, oy, oz, grow = 0) => {
      const g = skinBox(w, h, d, u, v, 64, 32);
      if (grow) g.scale((w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d);
      const mesh = new THREE.Mesh(g, material);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      if (material === wool) fur.push(mesh);
      return mesh;
    };
    // Leg pivots (-3|3, 12, 7|-5) in ModelQuadruped order; limbAngles drives them as leg0..3.
    for (const [x, z] of [[-3, 7], [3, 7], [-3, -5], [3, -5]]) {
      const leg = new THREE.Group();
      leg.position.set(x / 16, 12 / 16, -z / 16);
      root.add(leg);
      limbs.push(leg);
    }
    // ModelQuadruped turns the body box about (0, 5, 2) by pi / 2.
    const body = new THREE.Group();
    body.position.set(0, 19 / 16, -2 / 16);
    body.rotation.x = Math.PI / 2;
    root.add(body);
    // Pass 1 is ModelSheep2 (head tex (0,0), body (28,8), legs (0,16) 12 high); pass 2 is
    // ModelSheep1, inflated by 0.6 / 1.75 / 0.5 with a 6-high leg box and a head box that
    // starts 2 pixels further back.
    part(skin, neck, 6, 6, 8, 0, 0, -3, -4, -6);
    part(skin, body, 8, 16, 6, 28, 8, -4, -10, -7);
    part(wool, neck, 6, 6, 6, 0, 0, -3, -4, -4, 0.6);
    part(wool, body, 8, 16, 6, 28, 8, -4, -10, -7, 1.75);
    for (const leg of limbs) {
      part(skin, leg, 4, 12, 4, 0, 16, -2, 0, -2);
      part(wool, leg, 4, 6, 4, 0, 16, -2, 0, -2, 0.5);
    }
    this.scene.add(root);
    return { root, neck, limbs, fur, wool, materials: [skin, wool], type: "sheep", lift: 1 / 128 };
  }
  // RenderChicken (bng) with ModelChicken (bhh, chicken.png 64x32). Same model->three.js
  // mapping as the sheep: (x, 24 - y, -z) / 16, X rotations keep their sign and Z
  // rotations flip. Head, bill and chin share the (0, 15, -4) pivot; the wings hang off
  // (+-4, 13, 0) and flap by rotateAngleZ = +-(sin(flap) + 1) * flapSpeed.
  createChicken() {
    const root = new THREE.Group(), neck = new THREE.Group(), limbs = [], wings = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/chicken.png") });
    neck.rotation.order = "YXZ";
    neck.position.set(0, 9 / 16, 4 / 16);
    root.add(neck);
    // Box offsets are relative to the parent's rotation point, as ModelBox's are.
    const part = (parent, w, h, d, u, v, ox, oy, oz) => {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 32), skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      return mesh;
    };
    part(neck, 4, 6, 3, 0, 0, -2, -6, -2);
    part(neck, 4, 2, 2, 14, 0, -2, -4, -4);
    part(neck, 2, 2, 2, 14, 4, -1, -2, -3);
    const body = new THREE.Group();
    body.position.set(0, 8 / 16, 0);
    body.rotation.x = Math.PI / 2;
    root.add(body);
    part(body, 6, 8, 6, 0, 9, -3, -4, -3);
    for (const x of [-2, 1]) {
      const leg = new THREE.Group();
      leg.position.set(x / 16, 5 / 16, -1 / 16);
      root.add(leg);
      limbs.push(leg);
      part(leg, 3, 5, 3, 26, 0, -1, 0, -3);
    }
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 4 / 16, 11 / 16, 0);
      root.add(wing);
      wings.push(wing);
      part(wing, 1, 4, 6, 24, 13, side < 0 ? 0 : -1, 0, -3);
    }
    this.scene.add(root);
    return { root, neck, limbs, wings, materials: [skin], type: "chicken", lift: 1 / 128 };
  }
  // RenderSkeleton (bos) with ModelSkeleton (bic, skeleton.png 64 x 32) and RenderBiped's
  // held item (the bow in the right hand). Pivots and boxes are the model's own at 1:1
  // (ModelBiped is 32 pixels tall; the skeleton's box is 1.8): three.js gets
  // (x, 24 - y, -z) / 16 like the sheep, and RendererLivingEntity's translate(0, -24 *
  // 0.0625 - 0.0078125) lifts it by 1/128. The arms and legs are 2 x 12 x 2, the left pair
  // mirrored.
  createSkeleton() {
    const root = new THREE.Group(), frame = new THREE.Group(), limbs = [],
      material = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/skeleton/skeleton.png") }),
      materials = [material];
    frame.position.y = 1 / 128;
    root.add(frame);
    const part = (parent, w, h, d, u, v, ox, oy, oz, mirror = false) => {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 32, mirror), material);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      return mesh;
    };
    const pivot = (x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x / 16, (24 - y) / 16, -z / 16);
      frame.add(g);
      return g;
    };
    const neck = pivot(0, 0, 0);
    neck.rotation.order = "YXZ";
    part(neck, 8, 8, 8, 0, 0, -4, -8, -4);
    part(pivot(0, 0, 0), 8, 12, 4, 16, 16, -4, 0, -2);
    // Right arm, left arm, right leg, left leg (the order limbAngles drives them in).
    for (const [x, y, arm, mirror] of [[-5, 2, true, false], [5, 2, true, true], [-2, 12, false, false], [2, 12, false, true]]) {
      const g = pivot(x, y, 0);
      part(g, 2, 12, 2, arm ? 40 : 0, 16, -1, arm ? -2 : 0, -1, mirror);
      if (arm) g.rotation.order = "ZYX";
      limbs.push(g);
    }
    // RenderBiped.renderEquippedItems: after the right arm's postRender the bow's transform;
    // the group undoes the (x, -y, -z) frame so the matrix is in the model's own axes.
    const mc = new THREE.Group(), bow = new THREE.Mesh(spriteGeometry(), entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/items/bow_standby.png"), side: THREE.DoubleSide }));
    materials.push(bow.material);
    mc.scale.set(1, -1, -1);
    const held = new THREE.Group();
    held.matrixAutoUpdate = false;
    held.matrix.copy(heldItemMatrix("bow"));
    held.add(bow);
    mc.add(held);
    limbs[0].add(mc);
    this.scene.add(root);
    return { root, neck, limbs, materials, type: "skeleton", keep: [bow] };
  }
  // ModelSpider: head/body/rear at y=15, eight 16x2x2 legs. All boxes and
  // pivots use the original pixel coordinates; (x,24-y,-z)/16 maps to three.js.
  // RenderCaveSpider (bnf) is RenderSpider with textures/entity/spider/cave_spider.png and
  // preRenderCallback glScalef(0.7, 0.7, 0.7) (applied in update); the eye pass is the same.
  createSpider(cave = false) {
    const root = new THREE.Group(), frame = new THREE.Group(), limbs = [], skinMeshes = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture(`/media/1.7.10/entity/spider/${cave ? "cave_spider" : "spider"}.png`) }),
      eyes = new THREE.MeshBasicMaterial({ map: pixelTexture("/media/1.7.10/entity/spider_eyes.png"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    frame.position.y = 1 / 128;
    root.add(frame);
    const part = (parent, w, h, d, u, v, ox, oy, oz, glow = false) => {
      const geometry = skinBox(w, h, d, u, v, 64, 32), mesh = new THREE.Mesh(geometry, skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      skinMeshes.push(mesh);
      if (glow) { const pass = new THREE.Mesh(geometry.clone(), eyes); pass.position.copy(mesh.position); pass.renderOrder = 1; parent.add(pass); }
    };
    const pivot = (x, y, z) => {
      const group = new THREE.Group();
      group.position.set(x / 16, (24 - y) / 16, -z / 16);
      group.rotation.order = "ZYX";
      frame.add(group);
      return group;
    };
    const neck = pivot(0, 15, -3);
    neck.rotation.order = "YXZ";
    part(neck, 8, 8, 8, 32, 4, -4, -4, -8, true);
    part(pivot(0, 15, 0), 6, 6, 6, 0, 0, -3, -3, -3);
    part(pivot(0, 15, 9), 10, 8, 12, 0, 12, -5, -4, -6);
    for (const z of [2, 1, 0, -1]) for (const x of [-4, 4]) {
      const leg = pivot(x, 15, z);
      part(leg, 16, 2, 2, 18, 0, x < 0 ? -15 : -1, -1, -1);
      limbs.push(leg);
    }
    this.scene.add(root);
    return { root, neck, limbs, materials: [skin], eyes, skinMeshes, type: cave ? "cave_spider" : "spider", scale: cave ? Math.fround(0.7) : 1 };
  }
  // RenderSilverfish (bor) with ModelSilverfish (bia, silverfish.png 64 x 32): seven segments and three
  // layer boxes on pivots (0, y, z); setRotationAngles sways each pivot's x and yaw with the entity age
  // (silverfish.js), the layers copying segments 2, 4 and 1. Same pixel frame as ModelSpider.
  createSilverfish() {
    const root = new THREE.Group(), frame = new THREE.Group(), neck = new THREE.Group(), segments = [], layers = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/silverfish.png") });
    frame.position.y = 1 / 128;
    root.add(frame);
    const part = (m) => {
      const [x0, y0, z0, x1, y1, z1] = m.box, group = new THREE.Group();
      group.position.set(0, (24 - m.y) / 16, -m.z / 16);
      group.rotation.order = "ZYX";
      const mesh = new THREE.Mesh(skinBox(x1 - x0, y1 - y0, z1 - z0, m.uv[0], m.uv[1], 64, 32), skin);
      mesh.position.set((x0 + (x1 - x0) / 2) / 16, -(y0 + (y1 - y0) / 2) / 16, -(z0 + (z1 - z0) / 2) / 16);
      group.add(mesh);
      frame.add(group);
      return group;
    };
    for (const m of SILVERFISH_MODEL.segments) segments.push(part(m));
    for (const m of SILVERFISH_MODEL.layers) layers.push(part(m));
    this.scene.add(root);
    return { root, neck, limbs: [], silverfish: { segments, layers }, materials: [skin], type: "silverfish" };
  }
  // RenderCreeper (bni) with ModelCreeper (bhj, creeper.png 64 x 32): head (0, 0) 8 x 8 x 8 and
  // body (16, 16) 8 x 12 x 4 on pivots (0, 4, 0), four 4 x 6 x 4 legs (0, 16) on pivots
  // (-2|2, 16, 4|-4) in the model's d, e, f, g order. ModelCreeper(2.0F) is the powered shell:
  // every box grown by 2 pixels each way with the same texture layout. (x, 24 - y, -z) / 16 as
  // for the skeleton; ModelCreeper's legs end at y = 22, so 1.7.10 creepers stand 2 pixels up.
  createCreeper() {
    const root = new THREE.Group(), swell = new THREE.Group(), frame = new THREE.Group(), limbs = [], shell = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/creeper/creeper.png") }),
      armor = armorMaterial(this.view.lighting, pixelTexture("/media/1.7.10/entity/creeper/creeper_armor.png"));
    swell.position.y = MODEL_ORIGIN;
    frame.position.y = 1 / 128 - MODEL_ORIGIN;
    root.add(swell);
    swell.add(frame);
    const part = (parent, w, h, d, u, v, ox, oy, oz) => {
      const geometry = skinBox(w, h, d, u, v, 64, 32), mesh = new THREE.Mesh(geometry, skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
      const pass = new THREE.Mesh(geometry, armor);
      pass.position.copy(mesh.position);
      pass.scale.set((w + 4) / w, (h + 4) / h, (d + 4) / d);
      pass.renderOrder = 1;
      pass.visible = false;
      parent.add(pass);
      shell.push(pass);
    };
    const pivot = (x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x / 16, (24 - y) / 16, -z / 16);
      frame.add(g);
      return g;
    };
    const neck = pivot(0, 4, 0);
    neck.rotation.order = "YXZ";
    part(neck, 8, 8, 8, 0, 0, -4, -8, -4);
    part(pivot(0, 4, 0), 8, 12, 4, 16, 16, -4, 0, -2);
    for (const [x, z] of [[-2, 4], [2, 4], [-2, -4], [2, -4]]) {
      const g = pivot(x, 16, z);
      part(g, 4, 6, 4, 0, 16, -2, 0, -2);
      limbs.push(g);
    }
    this.scene.add(root);
    return { root, neck, limbs, materials: [skin], armor, shell, swell, type: "creeper", keep: shell };
  }
  // RenderPig (boo) with ModelPig (bhu) and RenderCow (bnh) with ModelCow (bhi), both
  // ModelQuadruped (bhw) on 64 x 32 skins. Boxes, texture offsets and pivots are the ones
  // ModelProbe reads from the constructed models; (x, 24 - y, -z) / 16 as for the sheep.
  // The pig's snout and the cow's horns sit on the head, the udder on the body.
  createQuadruped(type) {
    const cow = type === "cow", root = new THREE.Group(), limbs = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture(`/media/1.7.10/entity/${cow ? "cow/cow" : "pig/pig"}.png`) });
    const part = (parent, w, h, d, u, v, ox, oy, oz) => {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 32), skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
    };
    const pivot = (x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x / 16, (24 - y) / 16, -z / 16);
      root.add(g);
      return g;
    };
    // ModelQuadruped(legHeight): head pivot (0, 18 - legHeight, -6), body (0, 17 - legHeight, 2)
    // turned by pi / 2, legs (+-3, 24 - legHeight, 7 | -5); ModelCow moves the head to
    // (0, 4, -8) and the legs to (+-4, 12, 7 | -6).
    const head = cow ? [0, 4, -8] : [0, 12, -6], neck = pivot(...head);
    neck.rotation.order = "YXZ";
    const body = pivot(0, cow ? 5 : 11, 2);
    body.rotation.x = Math.PI / 2;
    if (cow) {
      part(neck, 8, 8, 6, 0, 0, -4, -4, -6);
      part(neck, 1, 3, 1, 22, 0, -5, -5, -4);
      part(neck, 1, 3, 1, 22, 0, 4, -5, -4);
      part(body, 12, 18, 10, 18, 4, -6, -10, -7);
      part(body, 4, 6, 1, 52, 0, -2, 2, -8);
    } else {
      part(neck, 8, 8, 8, 0, 0, -4, -4, -8);
      part(neck, 4, 3, 1, 16, 16, -2, 0, -9);
      part(body, 10, 16, 8, 28, 8, -5, -10, -7);
    }
    const leg = cow ? 12 : 6, x = cow ? 4 : 3, back = 7, front = cow ? -6 : -5;
    for (const [lx, lz] of [[-x, back], [x, back], [-x, front], [x, front]]) {
      const g = pivot(lx, 24 - leg, lz);
      part(g, 4, leg, 4, 0, 16, -2, 0, -2);
      limbs.push(g);
    }
    this.scene.add(root);
    // childYOffset / childZOffset: pig 4 / 4, cow 8 / 6.
    return { root, neck, limbs, materials: [skin], type, head, child: cow ? [8, 6] : [4, 4], lift: 1 / 128 };
  }
  // RenderZombie (bpf) with ModelZombie (bip, ModelBiped on the 64 x 64 zombie.png): head
  // (0, 0) and body (16, 16) on (0, 0, 0), 4 x 12 x 4 arms (40, 16) on (+-5, 2, 0) and legs
  // (0, 16) on (+-1.9, 12, 0), the left pair mirrored. The headwear box (32, 0) is drawn by
  // ModelBiped.render but zombie.png leaves it fully transparent, so it is omitted.
  // A zombie villager (ModelZombieVillager, bil, on zombie_villager.png) has a taller head, a 10-pixel box at (0, 32), and
  // the villager's 2 x 4 x 2 nose at (24, 32) in front of it; the body and limbs are ModelBiped's.
  createZombie(villager = false) {
    const root = new THREE.Group(), frame = new THREE.Group(), limbs = [],
      skin = entityMaterial(this.view.lighting, { map: pixelTexture(villager ? "/media/1.7.10/entity/zombie/zombie_villager.png" : "/media/1.7.10/entity/zombie/zombie.png") });
    root.add(frame);
    const part = (parent, w, h, d, u, v, ox, oy, oz, mirror = false) => {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 64, mirror), skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
    };
    const pivot = (x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x / 16, (24 - y) / 16, -z / 16);
      frame.add(g);
      return g;
    };
    const neck = pivot(0, 0, 0);
    neck.rotation.order = "YXZ";
    if (villager) {
      part(neck, 8, 10, 8, 0, 32, -4, -10, -4);
      part(neck, 2, 4, 2, 24, 32, -1, -3, -6);
    } else part(neck, 8, 8, 8, 0, 0, -4, -8, -4);
    part(pivot(0, 0, 0), 8, 12, 4, 16, 16, -4, 0, -2);
    for (const [x, y, ox, arm, mirror] of [[-5, 2, -3, true, false], [5, 2, -1, true, true], [-1.9, 12, -2, false, false], [1.9, 12, -2, false, true]]) {
      const g = pivot(x, y, 0);
      part(g, 4, 12, 4, arm ? 40 : 0, 16, ox, arm ? -2 : 0, -2, mirror);
      // ModelRenderer applies Z, then Y, then X.
      if (arm) g.rotation.order = "ZYX";
      limbs.push(g);
    }
    this.scene.add(root);
    return { root, neck, limbs, materials: [skin], type: "zombie", lift: 1 / 128, villager };
  }
  create(e) {
    if (e.type === "creeper") return this.createCreeper();
    if (e.type === "spider" || e.type === "cave_spider") return this.createSpider(e.type === "cave_spider");
    if (e.type === "silverfish") return this.createSilverfish();
    if (e.type === "skeleton") return this.createSkeleton();
    if (e.type === "chicken") return this.createChicken();
    if (e.type === "sheep") return this.createSheep();
    if (e.type === "zombie") return this.createZombie(e.villager === true);
    if (e.type === "villager") return createVillagerRig(this, e);
    if (e.type === "witch") return createWitchRig(this, e);
    if (e.type === "slime") return createSlimeRig(this, e);
    if (e.type === "wolf") return createWolfRig(this);
    if (e.type === "ocelot") return createOcelotRig(this);
    if (e.type === "enderman") return createEndermanRig(this);
    if (e.type === "iron_golem") return createIronGolemRig(this);
    if (e.type === "squid") return createSquidRig(this);
    if (e.type === "bat") return createBatRig(this);
    return this.createQuadruped(e.type);
  }
  // `partial` is the fraction of the current tick elapsed (mobPose interpolates).
  update(entities,dt=0,partial=1) {
    const active = new Set(entities.map((e) => e.id));
    for (const [id, rig] of this.rigs)
      if (!active.has(id)) {
        this.scene.remove(rig.root);
        rig.root.traverse((o) => {
          if (o.isMesh) o.geometry.dispose();
        });
        for (const m of rig.materials) m.dispose();
        rig.eyes?.dispose();
        rig.armor?.dispose();
        this.rigs.delete(id);
      }
    for (const e of entities) {
      let r = this.rigs.get(e.id);
      if (!r) {
        r = this.create(e);
        this.rigs.set(e.id, r);
      }
      const pose = mobPose(e, partial);
      const baby = e.growingAge < 0;
      // RendererLivingEntity.renderModel draws no model for an invisible mob (an Invisibility
      // effect); RenderSpider's eye pass still runs, with the depth mask off.
      const invisible = isInvisible(e);
      if (r.skinMeshes) for (const m of r.skinMeshes) m.visible = !invisible;
      else if (r.keep) {
        // Skeleton bow and the powered creeper pass are drawn apart from renderModel, so they stay with the body hidden.
        if (!!r.hidden !== invisible) { r.hidden = invisible; r.root.traverse((o) => { if (o.isMesh && !r.keep.includes(o)) o.visible = !invisible; }); }
      } else r.root.visible = !invisible;
      // RendererLivingEntity's 1/128 lift, for rigs that do not carry it in a frame.
      r.root.position.set(pose.x, pose.y + (r.lift ?? 0), pose.z);
      r.root.scale.setScalar((baby ? 0.5 : 1) * (r.scale ?? 1));
      // Java yaw turns the opposite way to three.js, hence the sign.
      r.root.rotation.set(0, -pose.bodyYaw * RAD, pose.death * RAD);
      // A spawner's display mob (mob-spawner.js spawnerDisplayEntity): the
      // TileEntityMobSpawnerRenderer matrix ahead of the usual living-entity transform.
      if (e.displayMatrix) {
        r.root.matrixAutoUpdate = false;
        r.root.updateMatrix();
        r.root.matrix.premultiply(new THREE.Matrix4().fromArray(e.displayMatrix));
      }
      r.neck.rotation.set(e.type === "sheep" ? pose.headTilt : pose.headPitch * RAD, -pose.headYaw * RAD, 0);
      if (e.type === "sheep") {
        // ModelSheep2.setLivingAnimations: rotationPointY = 6 + func_70894_j * 9. A lamb's
        // head is drawn at full size, moved down 8 and back 4 before the body shrinks (x0.5).
        const drop = 6 + pose.headDrop * 9;
        r.neck.position.set(0, ((24 - drop) / 16 - (baby ? 8 / 16 : 0)) * (baby ? 2 : 1), 8 / 16);
        r.neck.scale.setScalar(baby ? 2 : 1);
        for (const m of r.fur) m.visible = !e.sheared;
        r.wool.uniforms.tint.value.set(...FLEECE_COLORS[e.color ?? 0]);
      }
      if (r.child) {
        // ModelQuadruped.render: a child's head is drawn full size, moved down childYOffset
        // and back childZOffset pixels; the body and legs shrink by half about the feet.
        const [, y, z] = r.head, [dy, dz] = baby ? r.child : [0, 0], k = baby ? 2 : 1;
        r.neck.position.set(0, (24 - y - dy) / 16 * k, (-z - dz) / 16 * k);
        r.neck.scale.setScalar(k);
      }
      // ModelBiped.render: a child zombie's head is scaled 0.75 (1.5 against the halved body)
      // and moved down 16 of those pixels, which leaves its pivot where the root puts it.
      if (e.type === "zombie") r.neck.scale.setScalar(baby ? 1.5 : 1);
      if (e.type === "chicken") {
        // ModelChicken.render: a chick's head, bill and chin stay full size, moved down 5
        // and back 2 (px / 16) before the rest shrinks to half; the root's x0.5 is undone here.
        r.neck.position.set(0, baby ? 0.5 : 9 / 16, baby ? 0.25 : 4 / 16);
        r.neck.scale.setScalar(baby ? 2 : 1);
        // rightWing.rotateAngleZ = flap, leftWing = -flap; Z flips sign in this frame.
        r.wings[0].rotation.z = -pose.flap;
        r.wings[1].rotation.z = pose.flap;
      }
      const angles = limbAngles(pose.limbSwing, pose.limbSwingAmount);
      // ModelZombie.setRotationAngles holds the arms out with a sway driven by
      // ageInTicks (ticksExisted + partial); the Java Y/Z angles flip sign here.
      const sway = mhSin(pose.age * 0.067) * 0.05, spread = mhCos(pose.age * 0.09) * 0.05 + 0.05;
      const spider = e.type === "spider" || e.type === "cave_spider" ? spiderLegs(pose.limbSwing, pose.limbSwingAmount) : null;
      const creeper = e.type === "creeper" ? creeperPose(pose.limbSwing, pose.limbSwingAmount, pose.headYaw, pose.headPitch) : null;
      if (r.silverfish) {
        // ModelSilverfish.setRotationAngles: rotationPointX and rotateAngleY per segment; Java's Y turns the other way here.
        const sf = silverfishPose(pose.age);
        sf.segments.forEach((s, i) => { r.silverfish.segments[i].position.x = s.x / 16; r.silverfish.segments[i].rotation.y = -s.yaw; });
        sf.layers.forEach((s, i) => { r.silverfish.layers[i].position.x = s.x / 16; r.silverfish.layers[i].rotation.y = -s.yaw; });
      }
      if (r.nose) animateWitch(r, e, pose.age);
      if (r.squish) animateSlime(r, e, partial);
      if (r.golem) animateIronGolem(r, e, pose, partial);
      if (r.wolf) animateWolf(r, e, pose);
      if (r.enderman) animateEnderman(r, e, pose, this);
      if (r.custom) r.custom(r, e, pose, partial);
      r.limbs.forEach((l, i) => {
        if (spider) { l.rotation.set(0, -spider[i][0], -spider[i][1]); return; }
        if (creeper) { l.rotation.x = creeper[i + 1][0]; return; }
        if (e.type === "villager" || e.type === "witch") { l.rotation.x = villagerLegAngle(pose.limbSwing, pose.limbSwingAmount, i); return; }
        if ((e.type === "zombie" || e.type === "skeleton") && i < 2) {
          const side = i === 0 ? 1 : -1;
          l.rotation.set(-Math.PI / 2 + side * sway, side * 0.1, -side * spread);
        } else l.rotation.x = angles[i];
      });
      // Entity.getBrightnessForRender samples 0.66 of the way up the body.
      // RendererLivingEntity overlays (brightness, 0, 0, 0.4) while hurt or
      // dying; the burning tint stands in for the fire overlay, which is not drawn.
      const t = ENTITY_TYPES[e.type], h = (t?.height ?? 1.8) * mobScale(e),
        // A display mob takes the spawner block's lightmap (TileEntityRendererDispatcher).
        packed = e.lightPos ? this.view.brightness(e.lightPos.x, e.lightPos.y, e.lightPos.z) : this.view.brightness(e.x, e.y + h * 0.66, e.z),
        level = Math.max(((packed >> 20) & 15) - (this.view.subtracted ?? 0), (packed >> 4) & 15),
        b = BRIGHTNESS[Math.max(0, level)];
      // RenderCreeper: the swell scale (preRenderCallback), the powered shell, and the white
      // getColorMultiplier pass drawn after the red one; the two blends fold into one mix.
      let white = 0;
      if (e.type === "creeper") {
        const flash = creeperFlash(e, partial);
        r.swell.scale.set(...creeperScale(flash));
        white = creeperWhite(flash);
        for (const m of r.shell) m.visible = !!e.powered;
        r.armor.uniforms.scroll.value = armorScroll(pose.age);
      }
      for (const m of r.materials) {
        m.setLight(packed);
        const o = m.uniforms.overlay.value;
        if (e.hurt > 0 || e.death) {
          if (white > 0) {
            const a = 1 - 0.6 * (1 - white), red = 0.4 * (1 - white);
            o.set((red * b + white) / a, white / a, white / a, a);
          } else o.set(b, 0, 0, 0.4);
        } else if (white > 0) o.set(1, 1, 1, white);
        else if (e.burn) o.set(b, b * 0.5, 0, 0.2);
        else o.set(0, 0, 0, 0);
      }
    }
  }
  clear() {
    this.update([]);
  }
}
