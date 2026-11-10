// Which client sees an event, for events whose source can sit outside the resident window (natural-spawning.md "Batch 38").
// Bytecode-read (javap on the unchanged server classes, nothing executed; ring-events-reference.json):
//  - EntityTracker.trackEntity (mn.a(sa)): EntityPlayerMP 512, EntityFishHook 64, EntityArrow 64 (every 20 ticks), SmallFireball and
//    Fireball 64, Snowball, EnderPearl, Egg, Potion, ExpBottle, EnderEye and FireworkRocket 64 (rocket every 10 ticks), EntityItem 64,
//    Minecart and Boat 80, EntitySquid 64, EntityBat 80, EntityWither 80, any other IAnimals 80 (every 3 ticks), EntityDragon 160,
//    EntityTNTPrimed, EntityFallingBlock, EntityXPOrb and hanging entities 160, EntityEnderCrystal 256.
//    EntityTrackerEntry shows an entity to a player whose |dx| and |dz| are both within that range (a square, not a circle).
//    Status 2 and 3 (hurt and death sounds on the client, EntityLivingBase.handleHealthUpdate) and the firework rocket's status 17 reach
//    only a tracking client.
//  - WorldServer.newExplosion (mt.a(sa, x, y, z, size, flaming, smoking)) sends S27 only to players with Entity.getDistanceSq(x, y, z)
//    < 4096 (64 blocks, from the player's feet): the client's hugeexplosion / largeexplode particles are exempt from the 16-block
//    cull of RenderGlobal.doSpawnParticle, so they have no other range test.
//  - WorldServer.spawnParticle (mt.a(String, x, y, z, count, ...), S2A) sends to players within 16 blocks (squared distance
//    <= 256 from the player's floor(x), floor(y + 0.5), floor(z)) and its only caller is EntityFishHook (bubble, wake). Every other
//    particle is made client-side and then passes RenderGlobal's 16-block cull, which fx.js and particles.js already apply, so the
//    16-block ring particle cull is the native range, not a shortcut.
const MOB_RANGE = 80;
const MOB_RANGES = { squid: 64, ender_dragon: 160, ender_crystal: 256 };
export const trackingRange = (type) => MOB_RANGES[type] ?? MOB_RANGE;
// EntityTrackerEntry.updatePlayerEntity: both axes within `range`.
export const trackedWithin = (range, x, z, player) => !!player && Math.abs(x - player.x) <= range && Math.abs(z - player.z) <= range;
export const tracksMob = (e, player) => trackedWithin(trackingRange(e.type), e.x, e.z, player);
export const ROCKET_TRACKING = 64;
export const EXPLOSION_PACKET_RANGE_SQ = 4096;
// The S27 explosion packet: strictly inside 64 blocks of the player's feet.
export const explosionReaches = (x, y, z, player) => !player || (x - player.x) ** 2 + (y - player.y) ** 2 + (z - player.z) ** 2 < EXPLOSION_PACKET_RANGE_SQ;
