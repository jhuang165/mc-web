import * as THREE from 'three';
import { PlayerBody, PlayerRenderer } from '../player-renderer.js';
import { skinCanvas } from '../skin.js';
import { ITEMS } from '../survival.js';
import { BOW } from '../bow.js';
import { JavaRandom } from '../java-random.js';
import { itemCrumbs, burst } from '../fx.js';
import { stepRemoteDeath } from './remote-death.js';
import { stepRemoteHurt } from './remote-hurt.js';
import { createRemoteUse, tickRemoteUse, remoteEye } from './remote-eating.js';
import { labelRows, paintTagRow, tagPlan, tagHeights, invisibleToViewer } from './remote-labels.js'; // b64 mpscoreboard, b65 mpinvis

// EntityOtherPlayerMP with the item-in-use flag (entity metadata 0, bit 4): the pose follows the held stack's EnumAction, so a sword blocks and a bow aims;
// eating and drinking change no third-person pose.
export const useFlags = p => ({ blocking: !!p.using && ITEMS[p.held?.id]?.kind === 'sword', aimedBow: !!p.using && p.held?.id === BOW });

export class RemotePlayers {
  // `skinUrl(hash)`: where the account server serves a skin PNG.
  constructor(scene, { skinUrl = () => null, board = null } = {}) {
    this.board = board; // b64 mpscoreboard: the replica Scoreboard (team-coloured names, the belowName score)
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
      if (p.id === self) { this.me = p; continue; } // b65 mpinvis: the viewer's own name and position (name tag distance, team visibility)
      seen.add(p.id);
      let entry = this.entries.get(p.id);
      if (!entry) {
        const body = new PlayerBody(); body.reset(p, p.yaw, p.pitch);
        const renderer = new PlayerRenderer(this.scene.scene, this.scene, this.scene.textures.texture);
        const tags = { name: [this.tagSprite(renderer.root, 10), this.tagSprite(renderer.root, 11)], score: [this.tagSprite(renderer.root, 10), this.tagSprite(renderer.root, 11)] }; // b65: [dim, bright] per row
        entry = { body, renderer, tags, name: p.name, last: { ...p }, use: createRemoteUse(), rand: new JavaRandom(Math.floor(Math.random() * 2 ** 48)) }; this.entries.set(p.id, entry);
        this.drawLabel(entry);
      }
      this.applySkin(entry.renderer, p.skin);
      { const d = stepRemoteDeath(entry, p.dead); if (d.burst && this.scene.fx) burst(this.scene.fx, 'explode', 20, { x: p.x, y: p.y - (p.ySize ?? 0), z: p.z, width: 0.6, height: 1.8 }, entry.rand); } // b60: S19 status 3 copy, 20 ticks of tilt then the poof
      if (entry.name !== p.name || (this.board && entry.sbRev !== this.board.revision)) { entry.name = p.name; this.drawLabel(entry); }
      stepRemoteHurt(entry, p.hurt === true, entry.body); // b61: S19 status 2 on the copy: limbSwingAmount 1.5 and hurtTime 10, before its onUpdate
      entry.body.tick({ position: { ...p, y: p.y - (p.ySize ?? 0) }, previous: entry.last, yaw: p.yaw, pitch: p.pitch, swinging: p.swing > 0, riding: !!p.riding });
      entry.last = { ...p, y: p.y - (p.ySize ?? 0) }; entry.state = p;
      // EntityOtherPlayerMP.onUpdate: the crumbs of eating run from the synced item-in-use flag (the sound comes from the server).
      tickRemoteUse(entry.use, { using: !!p.using, held: p.held }, id => this.scene.fx && itemCrumbs(this.scene.fx, 5, 'iconcrack_' + id, remoteEye({ ...p, y: p.y - (p.ySize ?? 0) }), entry.rand));
    }
    for (const [id, entry] of this.entries) if (!seen.has(id)) { this.dispose(entry); this.entries.delete(id); }
  }
  frame() {
    const t = Math.min(1, Math.max(0, (performance.now() - this.at) / 50));
    for (const entry of this.entries.values()) {
      const p = entry.state;
      const invisible = !!p.invisible, viewer = this.me?.name ?? null; // b65 mpinvis
      entry.renderer.update(entry.body, t, { invisible, ghost: invisible && !invisibleToViewer(true, p.name, viewer, this.board), visible: !entry.hidden, deathTime: entry.deathTime || 0, held: p.held?.id ?? 0, heldDamage: p.held?.damage ?? 0, hurt: (entry.hurtTime || 0) > 0, ...useFlags(p), sneak: p.sneak, riding: !!p.riding, ...useFlags(p), swing: p.swing > 0 ? (6 - p.swing) / 6 : 0 });
      this.placeTags(entry, p, invisible, viewer);
    }
  }
  // b65 mpinvis: one tag sprite (256x40 canvas); `order` keeps the dim pass under the bright one.
  tagSprite(root, order) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 40;
    const texture = new THREE.CanvasTexture(canvas), material = new THREE.SpriteMaterial({ map: texture, depthTest: order === 11, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material); sprite.scale.set(2.8, .4375, 1); sprite.renderOrder = order; root.add(sprite);
    return { canvas, texture, material, sprite };
  }
  // The native tag (tagPlan): hidden when invisible to the viewer or out of range, belowName row within 10 blocks, a sneaking name lower and depth-tested, a standing one dim through walls and bright in view.
  placeTags(entry, p, invisible, viewer) {
    const me = this.me, distSq = me ? (me.x - p.x) ** 2 + (me.y - p.y) ** 2 + (me.z - p.z) ** 2 : 0;
    const plan = tagPlan({ invisible, sneak: !!p.sneak, distSq, name: p.name, viewerName: viewer, board: this.board }), show = plan.show && !entry.hidden;
    const below = plan.below && entry.rows?.below != null, y = tagHeights({ sneak: !!p.sneak, below });
    const [nd, nb] = entry.tags.name, [sd, sb] = entry.tags.score;
    nd.sprite.visible = show; nb.sprite.visible = show && !plan.sneakStyle; nd.material.depthTest = plan.sneakStyle; nd.sprite.position.y = nb.sprite.position.y = y.name;
    sd.sprite.visible = sb.sprite.visible = show && below; sd.sprite.position.y = sb.sprite.position.y = y.score;
  }
  // Plain canvas text is only a name tag; untrusted names are never HTML.
  drawLabel(entry) {
    if (this.board) entry.sbRev = this.board.revision; // b64 mpscoreboard
    const rows = this.board ? labelRows(this.board, entry.name) : { top: entry.name, below: null };
    entry.rows = rows;
    const paint = ([dim, bright], text) => { paintTagRow(dim.canvas, text, 'dim'); paintTagRow(bright.canvas, text, 'bright'); dim.texture.needsUpdate = bright.texture.needsUpdate = true; };
    paint(entry.tags.name, rows.top);
    if (rows.below != null) paint(entry.tags.score, rows.below);
  }
  dispose(entry) {
    entry.renderer.root.removeFromParent(); entry.renderer.fire.root.removeFromParent();
    for (const m of entry.renderer.materials) m.dispose();
    entry.renderer.held?.traverse(node => node.geometry?.dispose());
    for (const row of Object.values(entry.tags)) for (const t of row) { t.sprite.removeFromParent(); t.texture.dispose(); t.material.dispose(); }
  }
  clear() {
    for (const entry of this.entries.values()) this.dispose(entry);
    this.entries.clear();
    for (const p of this.skins.values()) void p.then(t => t?.dispose());
    this.skins.clear();
  }
}
