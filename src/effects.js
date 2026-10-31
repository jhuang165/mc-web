import * as THREE from "three";
// The block-breaking crack overlay (destroy_stage_0..9). Block particles are
// particles.js / particle-renderer.js.
export class WorldEffects {
  constructor(scene, lighting) {
    this.scene = scene;
    this.lighting = lighting;
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
  clear() {
    this.crackMesh.visible = false;
  }
}
