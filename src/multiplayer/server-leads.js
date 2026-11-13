// Leads on the dedicated server (batch 62 mpriding2). The single-player lead code is reused unchanged (horse-gear-live.js on EntityWorld: leashInteract = EntityLiving.interactFirst's
// lead branch, leashFence = BlockFence.onBlockActivated / ItemLead.func_150909_a, the knots, leashTick = EntityLiving.updateLeashedState + EntityCreature.func_142017_o, `unleash` drops the
// item). That code knows one holder, "the player" = `ai.player`; the server has many, so a lead held by a player records `leash.holderId` and ServerMobs.target points the mob's AI
// at that player's view (the nearest-player rule would hand the lead to whoever stands closest).
//
// Wire (all prefixed `lead`): none new on the server side of the existing packets. The tracker's S1B mode 1 packets (entity-tracker.js, `attach` with `mode: 1`) are now forwarded in the
// `mobs` packet list as { type: 'attach', mode: 1, i, holder } where holder is { kind: 'player', id } | { kind: 'knot', x, y, z } | null (the lead is off). The client
// (remote-leads.js) draws it with HorseGearRenderer. Client -> server needs nothing new: the right click is the existing `animUse` (C02 interact) and the fence click the existing edit.
// Native facts used: a lead breaks when the holder is gone or more than 10 blocks away (leashTick, executed in leash-reference.json); a Nether holder is out of reach of
// Overworld mobs, so the lead drops (the Nether has no mobs: this port keeps one entity list per dimension).
export class ServerLeads {
  constructor(host) {
    this.host = host;
    const mobs = this.mobs = host.mobs.mobs;
    // Everything that makes a player lead: stamp the holder, and only the clicker's own mobs join a fence knot.
    const set = mobs.setLeash, near = mobs.leashedNear;
    mobs.setLeash = function (e, leash) { if (this.leashWho !== undefined && leash?.holder === 'player') leash = { ...leash, holderId: this.leashWho }; return set.call(this, e, leash); };
    mobs.leashedNear = function (centre) { return near.call(this, centre).filter(m => this.leashWho === undefined || m.leash?.holderId === this.leashWho); };
  }
  as(p, fn) { const mobs = this.mobs; mobs.leashWho = p.id; try { return fn(); } finally { mobs.leashWho = undefined; } }
  // C02 interact on a mob (before its own interact): a lead in hand ties it, the holder's click frees it (the lead drops unless creative).
  use(p, e) {
    if (e.leash && (e.leash.holder !== 'player' || e.leash.holderId !== p.id)) return false; // another player's lead or a knot: not handled here
    return this.as(p, () => !!this.mobs.leashInteract(e, p.survival));
  }
  // A right click on a fence block (BlockFence.onBlockActivated): true when the lead code took the click.
  fence(p, [x, y, z]) {
    const mobs = this.mobs;
    return this.as(p, () => { const v = mobs.ai.player; return v ? !!mobs.leashFence([x, y, z], p.survival) : false; });
  }
  // The view of the player holding `e` (ServerMobs.target), or null when the holder is gone (the lead drops here, once) or left the Overworld.
  holder(e, views) {
    const v = views.get(e.leash.holderId);
    if (v && !v.player.dimension) return v;
    this.mobs.unleash(e, true);
    return null;
  }
}
