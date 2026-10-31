import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { limbAngles } from "./animation.js";
import { entityMaterial } from "./light-material.js";
import { ENTITY_TYPES, mobPose } from "./entities.js";
import { FLEECE_COLORS } from "./sheep.js";
import { BRIGHTNESS, mhSin, mhCos } from "./lighting.js";
const RAD = Math.PI / 180;
export class MobRenderer {
  // `view` supplies the lightmap and world brightness (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.rigs = new Map();
    this.particles=[];
    this.heartTexture=pixelTexture("/media/1.7.10/gui/icons.png").clone();this.heartTexture.repeat.set(9/256,9/256);this.heartTexture.offset.set(52/256,1-9/256);
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
    return { root, neck, limbs, fur, wool, materials: [skin, wool], type: "sheep" };
  }
  create(e) {
    if (e.type === "sheep") return this.createSheep();
    const root = new THREE.Group(),
      limbs = [],
      materials = [],
      zombie = e.type === "zombie",
      cow = e.type === "cow";
    const texture = pixelTexture(
      "/media/1.7.10/entity/" +
        (zombie ? "zombie/zombie" : cow ? "cow/cow" : "pig/pig") +
        ".png",
    );
    const material = entityMaterial(this.view.lighting, { map: texture });
    materials.push(material);
    // ModelBiped/ModelQuadruped turn the head about its rotation point; the head
    // boxes hang off this neck pivot (pig 0,.75,.375; cow 0,1.25,.5; zombie at
    // the base of the head) with their offsets kept relative to it.
    const neck = new THREE.Group();
    neck.rotation.order = "YXZ";
    neck.position.set(0, zombie ? 1.3 : cow ? 1.25 : 0.75, zombie ? 0 : cow ? 0.5 : 0.375);
    root.add(neck);
    function box(w, h, d, u, v, x, y, z, parent = root) {
      const mesh = new THREE.Mesh(
        skinBox(w, h, d, u, v, 64, zombie ? 64 : 32),
        material,
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }
    if (zombie) {
      box(8, 8, 8, 0, 0, 0, 0.25, 0, neck);
      box(8, 12, 4, 16, 16, 0, 1.02, 0);
      for (let i = 0; i < 4; i++) {
        const arm = i < 2,
          pivot = new THREE.Group();
        pivot.position.set(
          arm ? (i === 0 ? -0.375 : 0.375) : i === 2 ? -0.125 : 0.125,
          arm ? 1.35 : 0.65,
          0,
        );
        const mesh = new THREE.Mesh(
          skinBox(4, 12, 4, arm ? 40 : 0, 16, 64, 64),
          material,
        );
        mesh.position.y = -0.35;
        pivot.add(mesh);
        // ModelRenderer applies Z, then Y, then X.
        if (arm) pivot.rotation.order = "ZYX";
        root.add(pivot);
        limbs.push(pivot);
      }
    } else {
      const head = box(
        8,
        8,
        cow ? 6 : 8,
        0,
        0,
        0,
        -0.1,
        cow ? 0.05 : 0.225,
        neck,
      );
      const body = box(
        10,
        cow ? 18 : 16,
        8,
        cow ? 18 : 28,
        cow ? 4 : 8,
        0,
        cow ? 0.85 : 0.6,
        0,
      );
      body.rotation.x = Math.PI / 2;
      const leg = cow ? 12 : 6;
      for (const [x, z] of [
        [-0.1875, 0.4375],
        [0.1875, 0.4375],
        [-0.1875, -0.4375],
        [0.1875, -0.4375],
      ]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, leg / 16, z);
        const mesh = new THREE.Mesh(
          skinBox(4, leg, 4, 0, 16, 64, 32),
          material,
        );
        mesh.position.y = -leg / 32;
        pivot.add(mesh);
        root.add(pivot);
        limbs.push(pivot);
      }
      if (cow) {
        for (const x of [-0.2, 0.2]) {
          const horn = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.12, 0.06),
            materials[materials.push(entityMaterial(this.view.lighting, { color: [0.847, 0.816, 0.714] })) - 1],
          );
          horn.position.set(x, 0.24, 0);
          head.add(horn);
        }
      } else {
        const snout = box(4, 3, 1, 16, 16, 0, -0.14, 0.5, neck);
      }
    }
    this.scene.add(root);
    return { root, neck, limbs, materials, type: e.type };
  }
  hearts(p){for(let i=0;i<5;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.heartTexture,transparent:true,depthWrite:false}));sprite.position.set(p.x+(Math.random()-.5)*.8,p.y+Math.random()*.4,p.z+(Math.random()-.5)*.8);sprite.scale.setScalar(.22);this.scene.add(sprite);this.particles.push({sprite,life:1});}}
  // `partial` is the fraction of the current tick elapsed (mobPose interpolates).
  update(entities,dt=0,partial=1) {
    this.particles=this.particles.filter(p=>{p.life-=dt;p.sprite.position.y+=dt*.45;if(p.life>0)return true;this.scene.remove(p.sprite);p.sprite.material.dispose();return false;});
    const active = new Set(entities.map((e) => e.id));
    for (const [id, rig] of this.rigs)
      if (!active.has(id)) {
        this.scene.remove(rig.root);
        rig.root.traverse((o) => {
          if (o.isMesh) o.geometry.dispose();
        });
        for (const m of rig.materials) m.dispose();
        this.rigs.delete(id);
      }
    for (const e of entities) {
      let r = this.rigs.get(e.id);
      if (!r) {
        r = this.create(e);
        this.rigs.set(e.id, r);
      }
      const pose = mobPose(e, partial);
      r.root.position.set(pose.x, pose.y, pose.z);r.root.scale.setScalar(e.growingAge<0?.5:1);
      // Java yaw turns the opposite way to three.js, hence the sign.
      r.root.rotation.set(0, -pose.bodyYaw * RAD, pose.death * RAD);
      r.neck.rotation.set(e.type === "sheep" ? pose.headTilt : pose.headPitch * RAD, -pose.headYaw * RAD, 0);
      if (e.type === "sheep") {
        // ModelSheep2.setLivingAnimations: rotationPointY = 6 + func_70894_j * 9. A lamb's
        // head is drawn at full size, moved down 8 and back 4 before the body shrinks (x0.5).
        const baby = e.growingAge < 0, drop = 6 + pose.headDrop * 9;
        r.neck.position.set(0, ((24 - drop) / 16 - (baby ? 8 / 16 : 0)) * (baby ? 2 : 1), 8 / 16);
        r.neck.scale.setScalar(baby ? 2 : 1);
        for (const m of r.fur) m.visible = !e.sheared;
        r.wool.uniforms.tint.value.set(...FLEECE_COLORS[e.color ?? 0]);
      }
      const angles = limbAngles(pose.limbSwing, pose.limbSwingAmount);
      // ModelZombie.setRotationAngles holds the arms out with a sway driven by
      // ageInTicks (ticksExisted + partial); the Java Y/Z angles flip sign here.
      const sway = mhSin(pose.age * 0.067) * 0.05, spread = mhCos(pose.age * 0.09) * 0.05 + 0.05;
      r.limbs.forEach((l, i) => {
        if (e.type === "zombie" && i < 2) {
          const side = i === 0 ? 1 : -1;
          l.rotation.set(-Math.PI / 2 + side * sway, side * 0.1, -side * spread);
        } else l.rotation.x = angles[i];
      });
      // Entity.getBrightnessForRender samples 0.66 of the way up the body.
      // RendererLivingEntity overlays (brightness, 0, 0, 0.4) while hurt or
      // dying; the burning tint stands in for the fire overlay, which is not drawn.
      const t = ENTITY_TYPES[e.type], h = (t?.height ?? 1.8) * (e.growingAge < 0 ? 0.5 : 1),
        packed = this.view.brightness(e.x, e.y + h * 0.66, e.z),
        level = Math.max(((packed >> 20) & 15) - (this.view.subtracted ?? 0), (packed >> 4) & 15),
        b = BRIGHTNESS[Math.max(0, level)];
      for (const m of r.materials) {
        m.setLight(packed);
        if (e.hurt > 0 || e.death) m.uniforms.overlay.value.set(b, 0, 0, 0.4);
        else if (e.burn) m.uniforms.overlay.value.set(b, b * 0.5, 0, 0.2);
        else m.uniforms.overlay.value.set(0, 0, 0, 0);
      }
    }
  }
  clear() {
    for(const p of this.particles){this.scene.remove(p.sprite);p.sprite.material.dispose();}this.particles=[];
    this.update([]);
  }
}
