// A gun server tab's copy of the mobs near it (not 1.7.10 networking): each tick's rows (server-mobs.js rows) update records in
// the tab's own mob list, which its mob renderer draws as it draws single-player mobs. The previous tick's position, rotations and
// limb swing become the prev* fields, so the renderer interpolates between the last two server ticks as RenderManager does between
// lastTickPos and pos. The tab never ticks these mobs; the server decides everything about them.
export class RemoteMobs {
  // `list`: the array the renderer draws (main.js mobs.entities). `create(type, x, y, z)`: a full default record of a type (the
  // tab's EntityWorld create), so every field a rig reads exists; without it a bare record is used.
  constructor(list, create = null) { this.list = list; this.create = create; this.byId = new Map(); }
  apply(rows) {
    if (!Array.isArray(rows)) return;
    const seen = new Set();
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 15) continue;
      const [id, type, x, y, z, body, head, pitch, swing, amount, hurt, death, growingAge, age, extra] = row;
      if (!Number.isInteger(id) || typeof type !== 'string' || ![x, y, z].every(Number.isFinite)) continue;
      seen.add(id);
      let e = this.byId.get(id);
      if (e && e.type !== type) { this.drop(e); e = null; }
      if (!e) {
        e = this.create?.(type, x, y, z) ?? { type, x, y, z };
        Object.assign(e, { id: `mob-${id}`, type, x, y, z, px: x, py: y, pz: z, renderYawOffset: body, prevRenderYawOffset: body,
          rotationYawHead: head, prevRotationYawHead: head, rotationPitch: pitch, prevRotationPitch: pitch,
          limbSwing: swing, limbSwingAmount: amount, prevLimbSwingAmount: amount, health: 1, remote: true });
        this.byId.set(id, e); this.list.push(e);
      }
      Object.assign(e, { px: e.x, py: e.y, pz: e.z, prevRenderYawOffset: e.renderYawOffset, prevRotationYawHead: e.rotationYawHead,
        prevRotationPitch: e.rotationPitch, prevLimbSwingAmount: e.limbSwingAmount });
      Object.assign(e, { x, y, z, renderYawOffset: body, rotationYawHead: head, rotationPitch: pitch, limbSwing: swing, limbSwingAmount: amount,
        hurt, death, growingAge, age, health: death > 0 ? 0 : Math.max(e.health, 1) });
      e.rotationYaw = body; e.yaw = (-body * Math.PI) / 180;
      if (extra && typeof extra === 'object') {
        // Chicken wings are interpolated too (oFlap/oFlapSpeed are the previous values the server sends with them).
        Object.assign(e, extra);
        e.ridingEntity = extra.riding ? (e.ridingEntity ?? true) : null;
      }
    }
    for (const [id, e] of this.byId) if (!seen.has(id)) this.drop(e);
  }
  drop(e) {
    this.byId.delete(Number(String(e.id).replace('mob-', '')));
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }
  clear() { for (const e of [...this.byId.values()]) this.drop(e); }
  get(id) { return this.byId.get(id) ?? null; }
}
