import * as THREE from "three";
import { BLOCKS } from "./world.js";
export class WorldEffects {
  constructor(scene, lighting) {
    this.scene = scene;
    this.lighting = lighting;
    this.light = null;
    this.tint = new THREE.Color();
    const loader = new THREE.TextureLoader();
    this.cracks = Array.from({ length: 10 }, (_, i) => {
      const t = loader.load("/media/1.7.10/blocks/destroy_stage_" + i + ".png");
      t.magFilter = t.minFilter = THREE.NearestFilter;
      return t;
    });
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.005, 1.005, 1.005),
      new THREE.MeshBasicMaterial({
        map: this.cracks[0],
        transparent: true,
        depthWrite: false,
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
      }),
    );
    this.crackMesh.visible = false;
    scene.add(this.crackMesh);
    this.particles = [];
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.045),
      // Particles take the lightmap colour at their cell, without face shading.
      new THREE.MeshBasicMaterial(),
      256,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
  }
  crack(block, progress = 0) {
    this.crackMesh.visible = !!block;
    if (block) {
      this.crackMesh.position.set(...block.map((n) => n + 0.5));
      const map = this.cracks[Math.min(9, Math.floor(progress * 10))];
      if (this.crackMesh.material.map !== map) {
        this.crackMesh.material.map = map;
        this.crackMesh.material.needsUpdate = true;
      }
    }
  }
  burst(block, id, count = 32) {
    const color = new THREE.Color(BLOCKS[id]?.color || "#8b947c");
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 256) this.particles.shift();
      this.particles.push({
        p: new THREE.Vector3(
          block[0] + Math.random(),
          block[1] + Math.random(),
          block[2] + Math.random(),
        ),
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 3,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.5 + Math.random() * 0.4,
        color: color.clone().multiplyScalar(0.7 + Math.random() * 0.5),
      });
    }
  }
  update(dt) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.v.y -= 12 * dt;
      p.p.addScaledVector(p.v, dt);
      return true;
    });
    this.mesh.count = this.particles.length;
    this.particles.forEach((p, i) => {
      this.dummy.position.copy(p.p);
      this.dummy.scale.setScalar(Math.min(1, p.life * 5));
      this.dummy.rotation.set(p.life * 2, p.life * 4, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      const rgb = this.light ? this.lighting.rgb(this.light.packed(Math.floor(p.p.x), Math.floor(p.p.y), Math.floor(p.p.z))) : [1, 1, 1];
      this.mesh.setColorAt(i, this.tint.copy(p.color).multiply({ r: rgb[0], g: rgb[1], b: rgb[2] }));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.particles = [];
    this.mesh.count = 0;
    this.crackMesh.visible = false;
  }
}
