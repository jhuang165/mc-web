import * as THREE from 'three';
import { PlayerBody, PlayerRenderer } from '../player-renderer.js';
import { skinCanvas } from '../skin.js';
import { ITEMS } from '../survival.js';
import { BOW } from '../bow.js';

// EntityOtherPlayerMP with the item-in-use flag (entity metadata 0, bit 4): the pose follows the held stack's EnumAction, so a sword blocks and a bow aims;
// eating and drinking change no third-person pose.
export const useFlags = p => ({ blocking: !!p.using && ITEMS[p.held?.id]?.kind === 'sword', aimedBow: !!p.using && p.held?.id === BOW });

export class RemotePlayers {
  // `skinUrl(hash)`: where the account server serves a skin PNG.
  constructor(scene, { skinUrl = () => null } = {}) {
    this.scene = scene; this.entries = new Map(); this.at = performance.now();
    this.skinUrl = skinUrl; this.skins = new Map(); // hash → Promise<texture | null>
  }
  // Skins are re-normalized here even though the server checked them: the PNG
  // is decoded by the browser as untrusted data and only ever becomes pixels.
  skin(hash) {
    if (!hash) return Promise.resolve(null);
    if (!this.skins.has(hash)) this.skins.set(hash, (async () => {
      const url = this.skinUrl(hash);
      if (!url) return null;
      const response = await fetch(url);
      if (!response.ok) throw new Error('skin ' + response.status);
      const texture = new THREE.CanvasTexture(await skinCanvas(await response.blob()));
      texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
      return texture;
    })().catch(() => null));
    return this.skins.get(hash);
  }
  // Swap a PlayerRenderer's skin; Steve stays until (and if) the skin loads.
  applySkin(renderer, hash) {
    if (renderer.skinHash === (hash ?? null)) return;
    renderer.skinHash = hash ?? null;
    const uniform = renderer.base.uniforms.map;
    renderer.steveMap ??= uniform.value;
    if (!hash) { uniform.value = renderer.steveMap; return; }
    void this.skin(hash).then(texture => { if (renderer.skinHash === hash) uniform.value = texture ?? renderer.steveMap; });
  }
  resetSkin(renderer) { if (renderer?.steveMap) renderer.base.uniforms.map.value = renderer.steveMap; if (renderer) renderer.skinHash = null; }
  sync(players, self) {
    this.at = performance.now();
    const seen = new Set();
    for (const p of players) {
      if (p.id === self) continue;
      seen.add(p.id);
      let entry = this.entries.get(p.id);
      if (!entry) {
        const body = new PlayerBody(); body.reset(p, p.yaw, p.pitch);
        const renderer = new PlayerRenderer(this.scene.scene, this.scene, this.scene.textures.texture);
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 40;
        const texture = new THREE.CanvasTexture(canvas), material = new THREE.SpriteMaterial({ map: texture, depthTest: true });
        const label = new THREE.Sprite(material); label.scale.set(2.8, .4375, 1); label.position.y = 2.2; renderer.root.add(label);
        entry = { body, renderer, label, texture, material, canvas, name: p.name, last: { ...p } }; this.entries.set(p.id, entry);
        this.drawLabel(entry);
      }
      this.applySkin(entry.renderer, p.skin);
      if (entry.name !== p.name) { entry.name = p.name; this.drawLabel(entry); }
      entry.body.tick({ position: { ...p, y: p.y - (p.ySize ?? 0) }, previous: entry.last, yaw: p.yaw, pitch: p.pitch, swinging: p.swing > 0 });
      entry.last = { ...p, y: p.y - (p.ySize ?? 0) }; entry.state = p;
    }
    for (const [id, entry] of this.entries) if (!seen.has(id)) { this.dispose(entry); this.entries.delete(id); }
  }
  frame() {
    const t = Math.min(1, Math.max(0, (performance.now() - this.at) / 50));
    for (const entry of this.entries.values()) {
      const p = entry.state;
      entry.renderer.update(entry.body, t, { held: p.held?.id ?? 0, heldDamage: p.held?.damage ?? 0, ...useFlags(p), sneak: p.sneak, ...useFlags(p), swing: p.swing > 0 ? (6 - p.swing) / 6 : 0 });
      entry.label.visible = !p.sneak;
    }
  }
  // Plain canvas text is only a name tag; untrusted names are never HTML.
  drawLabel(entry) {
    const c = entry.canvas.getContext('2d');
    c.clearRect(0, 0, 256, 40); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, 256, 40);
    c.fillStyle = '#fff'; c.font = '24px monospace'; c.textAlign = 'center'; c.fillText(entry.name, 128, 28);
    entry.texture.needsUpdate = true;
  }
  dispose(entry) {
    entry.renderer.root.removeFromParent(); entry.renderer.fire.root.removeFromParent();
    for (const m of entry.renderer.materials) m.dispose();
    entry.renderer.held?.traverse(node => node.geometry?.dispose());
    entry.texture.dispose(); entry.material.dispose();
  }
  clear() {
    for (const entry of this.entries.values()) this.dispose(entry);
    this.entries.clear();
    for (const p of this.skins.values()) void p.then(t => t?.dispose());
    this.skins.clear();
  }
}
