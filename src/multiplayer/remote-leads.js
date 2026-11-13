// The client half of leads (batch 62 mpriding2, server side: server-leads.js). The server's S1B mode 1 packets reach RemoteMobs.attach, which keeps the wire holder on the copy
// (`mob.leadWire`: { kind: 'player', id } | { kind: 'knot', x, y, z } | null). This module turns those into what the single-player lead renderer (HorseGearRenderer.update)
// takes: mob records with a `leash`, and the knots. A lead held by the client's own player is `{ holder: 'player' }`; one held by another player names a stand-in holder record at that
// player's position (the renderer finds a mob holder by uuid among the list it is given), so the rope runs to the other player.
const views = new WeakMap(); // copy -> stable view (the renderer keys its rope meshes on the object)

// `copies`: the stand-in mobs (RemoteMobs.list()), `selfId`: this client's player id, `where(id)`: { x, y, z } of another player or null.
// Returns { mobs, knots } to add to the renderer's lists; mobs without a lead are left out.
export function leadViews(copies, selfId, where) {
  const mobs = [], knots = new Map(), holders = new Map();
  for (const m of copies) {
    const w = m.leadWire;
    if (!w || !(m.health > 0 || m.health === undefined)) continue;
    let v = views.get(m);
    if (!v) { v = Object.create(m); views.set(m, v); }
    if (w.kind === 'knot') { v.leash = { knot: { x: w.x, y: w.y, z: w.z } }; knots.set(`${w.x},${w.y},${w.z}`, { x: w.x, y: w.y, z: w.z }); }
    else if (w.kind === 'player' && w.id === selfId) v.leash = { holder: 'player' };
    else if (w.kind === 'player') {
      const at = where(w.id);
      if (!at) continue;
      const uuid = `lead-holder:${w.id}`;
      v.leash = { holder: 'mob', holderUuid: uuid };
      if (!holders.has(uuid)) holders.set(uuid, { uuid, health: 1, x: at.x, y: at.y + 1, z: at.z }); // the hand height is about the player's chest
    } else continue;
    mobs.push(v);
  }
  return { mobs: [...mobs, ...holders.values()], knots: [...knots.values()] };
}
