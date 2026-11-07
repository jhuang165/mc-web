import * as THREE from 'three';
import { PlayerBody, PlayerRenderer } from '../player-renderer.js';

export class RemotePlayers {
  constructor(scene) { this.scene = scene; this.entries = new Map(); this.at = performance.now(); }
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
        // Plain canvas text is only a name tag; untrusted names are never HTML.
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 40;
        const c = canvas.getContext('2d'); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, 256, 40);
        c.fillStyle = '#fff'; c.font = '24px monospace'; c.textAlign = 'center'; c.fillText(p.name, 128, 28);
        const texture = new THREE.CanvasTexture(canvas), material = new THREE.SpriteMaterial({ map: texture, depthTest: true });
        const label = new THREE.Sprite(material); label.scale.set(2.8, .4375, 1); label.position.y = 2.2; renderer.root.add(label);
        entry = { body, renderer, label, texture, material, last: { ...p } }; this.entries.set(p.id, entry);
      }
      entry.body.tick({ position: { ...p, y: p.y - (p.ySize ?? 0) }, previous: entry.last, yaw: p.yaw, pitch: p.pitch, swinging: p.swing > 0 });
      entry.last = { ...p, y: p.y - (p.ySize ?? 0) }; entry.state = p;
    }
    for (const [id, entry] of this.entries) if (!seen.has(id)) { this.dispose(entry); this.entries.delete(id); }
  }
  frame() {
    const t = Math.min(1, Math.max(0, (performance.now() - this.at) / 50));
    for (const entry of this.entries.values()) {
      const p = entry.state;
      entry.renderer.update(entry.body, t, { held: p.held?.id ?? 0, heldDamage: p.held?.damage ?? 0, sneak: p.sneak, swing: p.swing > 0 ? (6 - p.swing) / 6 : 0 });
      entry.label.visible = !p.sneak;
    }
  }
  dispose(entry) {
    entry.renderer.root.removeFromParent(); entry.renderer.fire.root.removeFromParent();
    for (const m of entry.renderer.materials) m.dispose();
    entry.renderer.held?.traverse(node => node.geometry?.dispose());
    entry.texture.dispose(); entry.material.dispose();
  }
  clear() { for (const entry of this.entries.values()) this.dispose(entry); this.entries.clear(); }
}
