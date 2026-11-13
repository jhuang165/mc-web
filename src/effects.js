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
    // RenderGlobal drops a partially destroyed block 400 ticks after its last stage (a breaker that died leaves one).
    if (this.mobCracks?.size) for (const [id, mesh] of this.mobCracks) if (performance.now() - mesh.userData.at > 20000) this.mobCrack(id, null, -1);
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
  // World.destroyBlockInWorldPartially(entityId, ...) for a mob (a zombie leaning on a door): one overlay per breaker id,
  // stage 0-9, with a negative stage or no block taking it away. The overlay is the same full box as the player's.
  mobCrack(id, block, stage) {
    this.mobCracks ??= new Map();
    let mesh = this.mobCracks.get(id);
    if (!block || stage < 0 || stage > 9) { // RenderGlobal.destroBlockPartially: only stages 0-9 keep an entry
      if (mesh) {
        this.scene.remove(mesh);
        this.mobCracks.delete(id);
      }
      return;
    }
    if (!mesh) {
      mesh = new THREE.Mesh(this.crackMesh.geometry, this.crackMesh.material.clone());
      this.scene.add(mesh);
      this.mobCracks.set(id, mesh);
    }
    mesh.userData.at = performance.now();
    mesh.position.set(...block.map((n) => n + 0.5));
    mesh.material.map = this.cracks[Math.min(9, stage)];
    mesh.material.needsUpdate = true;
  }
  clear() {
    this.crackMesh.visible = false;
    for (const id of [...(this.mobCracks?.keys() ?? [])]) this.mobCrack(id, null, -1);
  }
}
