import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { limbAngles } from "./animation.js";
export class MobRenderer {
  constructor(scene) {
    this.scene = scene;
    this.rigs = new Map();
    this.particles=[];
    this.heartTexture=pixelTexture("/media/1.7.10/gui/icons.png").clone();this.heartTexture.repeat.set(9/256,9/256);this.heartTexture.offset.set(52/256,1-9/256);
  }
  create(e) {
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
    const material = new THREE.MeshLambertMaterial({ map: texture });
    materials.push(material);
    function box(w, h, d, u, v, x, y, z) {
      const mesh = new THREE.Mesh(
        skinBox(w, h, d, u, v, 64, zombie ? 64 : 32),
        material,
      );
      mesh.position.set(x, y, z);
      root.add(mesh);
      return mesh;
    }
    if (zombie) {
      box(8, 8, 8, 0, 0, 0, 1.55, 0);
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
        cow ? 1.15 : 0.65,
        cow ? 0.55 : 0.6,
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
            new THREE.MeshLambertMaterial({ color: "#d8d0b6" }),
          );
          horn.position.set(x, 0.24, 0);
          head.add(horn);
        }
      } else {
        const snout = box(4, 3, 1, 16, 16, 0, 0.61, 0.875);
      }
    }
    this.scene.add(root);
    return { root, limbs, materials, type: e.type };
  }
  hearts(p){for(let i=0;i<5;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.heartTexture,transparent:true,depthWrite:false}));sprite.position.set(p.x+(Math.random()-.5)*.8,p.y+Math.random()*.4,p.z+(Math.random()-.5)*.8);sprite.scale.setScalar(.22);this.scene.add(sprite);this.particles.push({sprite,life:1});}}
  update(entities,dt=0) {
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
      r.root.position.set(e.x, e.y, e.z);r.root.scale.setScalar(e.growingAge<0?.5:1);
      r.root.rotation.set(
        0,
        e.yaw,
        e.death
          ? (Math.min(1, Math.sqrt((e.death / 20) * 1.6)) * Math.PI) / 2
          : 0,
      );
      const angles = limbAngles(
        e.gait,
        e.walking || e.type === "zombie" ? 0.55 : 0.05,
      );
      r.limbs.forEach(
        (l, i) =>
          (l.rotation.x =
            e.type === "zombie" && i < 2
              ? -Math.PI / 2 + Math.sin(e.gait) * 0.07
              : angles[i]),
      );
      r.materials.forEach((m) =>
        m.color.set(e.hurt > 0 ? "#ff9d9d" : e.burn ? "#ffc5a3" : "#ffffff"),
      );
    }
  }
  clear() {
    for(const p of this.particles){this.scene.remove(p.sprite);p.sprite.material.dispose();}this.particles=[];
    this.update([]);
  }
}
