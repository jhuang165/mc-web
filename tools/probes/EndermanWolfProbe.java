import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 42 (records b42-*). Enderman (EntityEnderman ya: findPlayerToAttack with the gaze test, stare timer, scream, teleport) and wolf (EntityWolf wv: wild, tamed, angry, sitting; EntityAITargetNonTamed,
// EntityAIOwnerHurtByTarget, EntityAIOwnerHurtTarget, EntityAIHurtByTarget with call for help) targeting against a real EntityPlayerMP (ServerPlayerProbe), every mob ticked by Entity.onUpdate on the
// VillageLiveProbe double (the same one VillageFightProbe uses; no village is involved). Unchanged 1.7.10 classes, executed.
//   types: one letter per mob: E enderman, W wild wolf, A angry wild wolf, T tamed wolf (owner = the probe player, standing), S tamed sitting wolf (EntityAISit wish on), H sheep, Z zombie (bare), G a second tamed
//   wolf owned by the player is `T` again; `O` is a tamed wolf of another owner (a random UUID). The probe player has the index types.length.
//   rows per tick: [mobs: [x, y, z, health, target index, revenge index, flags, draws, [motion x, y, z, yaw, pitch, head yaw, body yaw offset, onGround, isJumping, moveForward, moveStrafing]], sounds, player health lost, player revenge index, player ticks]
//   flags: enderman [screaming, aggressive, bt stare timer, bs teleport timer, carried block id]; wolf [angry, sitting, tamed, sit wish, wet]; others []
//   script ops ("tick op args"): look yaw pitch | helmet blockId | day on|off | rain on|off | move idx x z [y] | walk idx dx dz | creative|adventure|invisible|sneak idx on|off | melee victim (the player's real
//   EntityPlayer.attackTargetEntityWithCurrentItem) | hit victim attacker dmg mob (DamageSource.causeMobDamage) | angry idx | sit idx on|off | setpitch.
// Entity.rand of every mob is a logging Random (DLog over VillageFightProbe.Log: nextInt(bound) "i<bound>", nextFloat "f", nextGaussian "g", nextBoolean "b", nextDouble "d").
public class EndermanWolfProbe {
  public static class EW extends VillageLiveProbe.W {
    // Batch 43: EntityEnderman picks a block (World.setBlock(.., air)) and places it back (setBlock with flags 3); the probe world keeps blocks in a cell map. VillageLiveProbe.W.f removes the cells above and below too (the door
    // hack), so setBlockToAir is not used here: the pick calls b(IIILaji)Z, which reaches this d.
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { VillagerProbe.World.cells.put(VillagerProbe.key(x, y, z), new int[] {aji.b(b), meta}); return true; }
    public void a(double x, double y, double z, String sound, float volume, float pitch) { VillagerProbe.World.sounds.add(sound + "|" + volume + "|" + pitch + "@"); }
    // Batch 44: World.spawnEntityInWorld adds an entity to the chunk lists at once, so a baby an EntityAIMate spawns is pushed by (and pushes) its parents in the same tick; it is dropped from the list after
    // that tick (it is never ticked here, and the replay does not tick it either).
    public boolean d(sa entity) { boolean ok = super.d(entity); if (ok && B44 && entity instanceof wf && !VillagerProbe.World.entities.contains(entity)) VillagerProbe.World.entities.add(entity); return ok; }
    // Batch 45 (creeperwitch): WorldServer.newExplosion: doExplosionA, doExplosionB(false) (no client particles, so no extra world.rand draws), the affected list cleared after when not smoking;
    // each explosion is recorded with the knockback map entry of the probe player ([x, y, z, size, flaming, smoking, push x, y, z or null]).
    static List<String> booms = new ArrayList<>();
    static yz boomPlayer;
    public agw a(sa exploder, double x, double y, double z, float size, boolean flaming, boolean smoking) {
      agw ex = new agw(this, exploder, x, y, z, size);
      ex.a = flaming; ex.b = smoking;
      ex.a();
      ex.a(false);
      if (!smoking) ex.h.clear();
      Object push = ex.b().get(boomPlayer);
      String p = "null";
      if (push != null) { azw v = (azw) push; p = "[" + VillageFightProbe.num(v.a) + "," + VillageFightProbe.num(v.b) + "," + VillageFightProbe.num(v.c) + "]"; }
      booms.add("[" + VillageFightProbe.num(x) + "," + VillageFightProbe.num(y) + "," + VillageFightProbe.num(z) + "," + VillageFightProbe.num(size) + "," + (flaming ? 1 : 0) + "," + (smoking ? 1 : 0) + "," + p + "]");
      return ex;
    }
    // Batch 45 (mobfixes): EntityAIOcelotSit.func_151486_a reads TileEntityChest.numPlayersUsing (aow.o) of a chest cell; a chest tile entity here is an allocated aow (users 0, nobody has it open).
    // Batch 48 (pistonpush): a moving piston block (BlockPistonMoving, cell id 36) finds its TileEntityPiston (aps) here; the tile loop of the scenario runs them (World.updateEntities' tile entity pass).
    static java.util.LinkedHashMap<String, aps> pistons = new java.util.LinkedHashMap<>();
    public void p(int x, int y, int z) { pistons.remove(VillagerProbe.key(x, y, z)); }
    public aor o(int x, int y, int z) {
      aps moving = pistons.get(VillagerProbe.key(x, y, z));
      if (moving != null) return moving;
      int[] c = VillagerProbe.World.cells.get(VillagerProbe.key(x, y, z));
      if (c == null || c[0] != 54) return null;
      try { return (aor) MobMoveProbe.unsafe().allocateInstance(aow.class); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
    public boolean y(int x, int y, int z) { return VillageLiveProbe.W.rain && i(x, y, z); } // World.canLightningStrikeAt in a flat plains world: raining, open sky
  }

  // Batch 43: the Entity.rand log also records nextDouble ("d"; the doubles inside nextGaussian are not logged separately), so every draw of the stream is compared, not only the typed ones.
  public static class DLog extends VillageFightProbe.Log {
    boolean inGauss;
    DLog(long seed) { super(seed); }
    public double nextDouble() { double r = super.nextDouble(); if (!inGauss) log.add("d"); return r; }
    public double nextGaussian() { inGauss = true; try { return super.nextGaussian(); } finally { inGauss = false; } }
  }
  static boolean B44, B45, BCW, B46, B47, B47H, B48;
  // Batch 45: a horse with fixed type, variant, tamed flag, growing age and attribute bases (health set to the maximum).
  static wi b45Horse(ahb w, int type, int variant, boolean tame, int age, double maxHealth, double speed, double jump) throws Exception {
    wi h = new wi(w);
    h.s(type); h.t(variant); h.i(tame); h.c(age);
    h.a(yj.a).a(maxHealth); h.a(yj.d).a(speed); h.a((th) MobMoveProbe.field(wi.class, "bv").get(null)).a(jump);
    h.g((float) maxHealth);
    return h;
  }
  // [love, growing age, type, variant, tame, temper, max health, speed, jump, health]: the horse's state, attribute bases as doubles and health.
  static String horseFlags(wi h) throws Exception {
    return "[" + MobMoveProbe.field(wf.class, "bp").getInt(h) + "," + h.d() + "," + h.bZ() + "," + h.ca() + "," + (h.cc() ? 1 : 0) + "," + h.cq() + "," + ((ti) h.a(yj.a)).e() + "," + ((ti) h.a(yj.d)).e() + "," + h.ct() + "," + Float.toString(h.aS()) + "]";
  }
  static float flv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getFloat(o); }

  static String q(String s) { return "\"" + s + "\""; }
  static int index(Object[] ents, Object e) { for (int k = 0; k < ents.length; k++) if (ents[k] == e) return k; return -1; }

  // Batch 45: what a tick spawned and changed. Items: [id, damage, count, x, y, z] (the item's motion comes from Math.random, not recorded); orbs: [value, x, y, z, vx, vy, vz]; potions: [damage, x, y, z, vx, vy, vz, seed].
  static String extras(int seen, java.util.Map<String, String> before, yz player, Object[] ents) throws Exception {
    StringBuilder sp = new StringBuilder();
    for (int k = seen; k < VillagerProbe.World.spawned.size(); k++) {
      Object o = VillagerProbe.World.spawned.get(k);
      if (sp.length() > 0) sp.append(",");
      sa e = (sa) o;
      if (o instanceof xk) { add st = ((xk) o).f(); sp.append("[\"item\",").append(adb.b(st.b())).append(",").append(st.k()).append(",").append(st.b).append(",").append(VillageFightProbe.num(e.s)).append(",").append(VillageFightProbe.num(e.t)).append(",").append(VillageFightProbe.num(e.u)).append("]"); }
      else if (o instanceof sq) sp.append("[\"xp\",").append(((sq) o).e()).append(",").append(VillageFightProbe.num(e.s)).append(",").append(VillageFightProbe.num(e.t)).append(",").append(VillageFightProbe.num(e.u)).append("]"); // no velocity: EntityXPOrb draws it from Math.random, so it differs between runs
      else if (o instanceof zo) sp.append("[\"potion\",").append(((zo) o).k()).append(",").append(VillageFightProbe.num(e.s)).append(",").append(VillageFightProbe.num(e.t)).append(",").append(VillageFightProbe.num(e.u)).append(",").append(VillageFightProbe.num(e.v)).append(",").append(VillageFightProbe.num(e.w)).append(",").append(VillageFightProbe.num(e.x)).append(",").append(((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(e)).seed).append("]");
      else sp.append("[\"other\",\"").append(o.getClass().getSimpleName()).append("\"]");
    }
    java.util.TreeSet<String> keys = new java.util.TreeSet<>(before.keySet());
    keys.addAll(VillagerProbe.World.cells.keySet());
    StringBuilder ch = new StringBuilder();
    for (String key : keys) {
      int[] now = VillagerProbe.World.cells.get(key);
      String was = before.get(key), is = now == null ? "0,0" : now[0] + "," + now[1];
      if (was == null) was = "0,0";
      if (!was.equals(is)) { if (ch.length() > 0) ch.append(","); ch.append("[").append(key).append(",").append(is).append("]"); }
    }
    return "[[" + String.join(",", EW.booms) + "],[" + sp + "],[" + ch + "],[" + VillageFightProbe.num(player.v) + "," + VillageFightProbe.num(player.w) + "," + VillageFightProbe.num(player.x) + "]]";
  }

  static void scenario(String name, long seed, int ticks, String types, double[][] pos, String[] script, int[][] roofs, int[][] blocks, boolean water, int bright) throws Exception {
    int n = types.length();
    if (System.getenv("VF_ONLY") != null && !name.equals(System.getenv("VF_ONLY"))) return;
    if (System.getenv("VF_PREFIX") != null && !name.startsWith(System.getenv("VF_PREFIX"))) return;
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[2]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    for (int[] r : roofs) VillageLiveProbe.W.roofs.add(r);
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = bright; MobMoveProbe.ProbeWorld.water = water;
    VillagerProbe.World.brightLevel = bright; VillagerProbe.World.brightPatches = new int[0][0]; VillagerProbe.World.vulnerable = true;
    VillagerProbe.World.chunkCache = false; VillagerProbe.World.unloaded.clear();
    VillagerProbe.World.sounds.clear(); VillageLiveProbe.W.rain = false;
    ahb w = VillageLiveProbe.world;
    ServerPlayerProbe.PM player = ServerPlayerProbe.make(w, "probe");
    Object[] ents = new Object[n + 1];
    String owner = player.aB().toString(), other = java.util.UUID.nameUUIDFromBytes("someone".getBytes()).toString();
    for (int i = 0; i < n; i++) {
      switch (types.charAt(i)) {
        case 'E': ents[i] = new ya(w); break;
        case 'W': ents[i] = new wv(w); break;
        case 'A': { wv wolf = new wv(w); wolf.l(true); ents[i] = wolf; break; }
        case 'T': { wv wolf = new wv(w); wolf.j(true); wolf.b(owner); wolf.g(20f); ents[i] = wolf; break; }
        case 'S': { wv wolf = new wv(w); wolf.j(true); wolf.b(owner); wolf.g(20f); wolf.cc().a(true); ents[i] = wolf; break; }
        case 'O': { wv wolf = new wv(w); wolf.j(true); wolf.b(other); wolf.g(20f); ents[i] = wolf; break; }
        case 'H': ents[i] = new wp(w); break;
        case 'Z': ents[i] = new yq(w); break;
        // batch 44 (passivedraws): the other EntityAITasks mobs on Entity.rand
        case 'C': ents[i] = new wh(w); break;
        case 'M': ents[i] = new wm(w); break;
        case 'P': ents[i] = new wo(w); break;
        case 'R': { wi horse = new wi(w); horse.a(yj.a).a(20.0); horse.a(yj.d).a(0.2f); horse.g(20f); ents[i] = horse; break; } // the horse's rolled health and speed (onSpawnWithEgg) are not AI draws: fixed
        case 'L': ents[i] = new wn(w); break;
        case 'G': ents[i] = new wt(w); break;
        case 'N': ents[i] = new wr(w); break;
        case 'K': ents[i] = new yp(w); break;
        case 'X': ents[i] = new xz(w); break;
        case 'U': { wn cat = new wn(w); cat.j(true); cat.b(owner); cat.g(10f); ents[i] = cat; break; }
        // batch 45 (horses): fixed-attribute tame parents (Q horse, q a second horse, D donkey), foals (F wild, Y tame) and V, a horse built by onSpawnWithEgg on its own Entity.rand (a following V passes the previous GroupData on, as a herd does)
        case 'Q': ents[i] = b45Horse(w, 0, 258, true, 0, 24.0, 0.25, 0.55); break;
        case 'q': ents[i] = b45Horse(w, 0, 773, true, 0, 18.0, 0.3, 0.65); break;
        case 'D': ents[i] = b45Horse(w, 1, 0, true, 0, 22.0, 0.175, 0.5); break;
        case 'F': ents[i] = b45Horse(w, 0, 258, false, -24000, 20.0, 0.2, 0.7); break;
        case 'Y': ents[i] = b45Horse(w, 0, 258, true, -24000, 20.0, 0.2, 0.7); break;
        case 'V': ents[i] = new wi(w); break;
        // batch 47 (horses2): skeleton and zombie horses (type 3 zombie, 4 skeleton; only /summon, NBT or a trap makes them), wild (3, 4) and tame (5, 6)
        case '3': ents[i] = b45Horse(w, 3, 0, false, 0, 15.0, 0.2, 0.5); break;
        case '4': ents[i] = b45Horse(w, 4, 0, false, 0, 15.0, 0.2, 0.5); break;
        case '5': ents[i] = b45Horse(w, 3, 0, true, 0, 15.0, 0.2, 0.5); break;
        case '6': ents[i] = b45Horse(w, 4, 0, true, 0, 15.0, 0.2, 0.5); break;
        // batch 49 (pistonorder): B a spider (yn, 1.4 x 0.9), I a size 4 slime (ym, 2.04 x 2.04; its jump timer fixed to 20 so the constructor's draw does not matter)
        case 'B': ents[i] = new yn(w); break;
        case 'I': { ym slime = new ym(w); java.lang.reflect.Method setSize = ym.class.getDeclaredMethod("a", int.class); setSize.setAccessible(true); setSize.invoke(slime, 4); MobMoveProbe.set(slime, "bn", 20); ents[i] = slime; break; }
        // batch 50 (legacybody): the other mobs whose EntityLiving.isAIEnabled (sw.bk) is false: f silverfish (yk), g giant (ye), z zombie pigman (yh), a blaze (xx)
        case 'f': ents[i] = new yk(w); break;
        case 'g': ents[i] = new ye(w); break;
        case 'z': ents[i] = new yh(w); break;
        case 'a': ents[i] = new xx(w); break;
        case 'c': { wh calf = new wh(w); calf.c(-24000); ents[i] = calf; break; }
        case 'p': { wo piglet = new wo(w); piglet.c(-24000); ents[i] = piglet; break; }
        case 'm': { wm calf = new wm(w); calf.c(-24000); ents[i] = calf; break; }
        default: throw new RuntimeException(types);
      }
    }
    ents[n] = player;
    VillageFightProbe.Log[] logs = new VillageFightProbe.Log[ents.length];
    for (int i = 0; i < ents.length; i++) {
      sa e = (sa) ents[i];
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      logs[i] = new DLog(seed * 10 + i);
      MobMoveProbe.set(e, "Z", logs[i]);
      VillageFightProbe.at(e, pos[i][0], pos[i].length > 2 ? pos[i][2] : 0, pos[i][1]);
      MobMoveProbe.set(e, "D", true);
      VillagerProbe.World.entities.add(e); // the player too: selectEntitiesWithinAABB (zombie targeting) reads this list
    }
    StringBuilder init = new StringBuilder();
    sy group = null;
    for (int i = 0; i < n; i++) {
      if (types.charAt(i) != 'V') { init.append(i > 0 ? "," : "").append("[]"); continue; }
      group = ((wi) ents[i]).a(group); // the unchanged EntityHorse.onSpawnWithEgg: its draws are the entity's first
      init.append(i > 0 ? "," : "").append("[").append(VillageFightProbe.draws(logs[i].log)).append("]");
      logs[i].log.clear();
    }
    player.a(yj.a).a(1000.0); player.g(1000.0f);
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(Arrays.asList(player));
    { Field hf = ahb.class.getDeclaredField("h"); hf.setAccessible(true); List pl = (List) hf.get(w); pl.clear(); pl.add(player); }
    VillagerProbe.World.realPlayers = true;
    VillagerProbe.World.immediateMobs = false;
    player.bE.a = false; player.bE.d = false;
    if (B46) { player.w = -0.0784000015258789; player.D = true; } // a player standing on the floor: the steady state of a grounded EntityLivingBase (motionY -0.0784, onGround), not its first tick with motionY 0
    if (B46) { // the statistics file of the ticked player (EntityPlayerMP.onUpdateEntity increments stats and checks achievements every 20 ticks) needs its map
      for (Field f : mw.class.getDeclaredFields()) if (pq.class.isAssignableFrom(f.getType())) { f.setAccessible(true); Object sf = f.get(player); if (sf == null) { sf = MobMoveProbe.unsafe().allocateInstance(f.getType()); f.set(player, sf); } Field m = pq.class.getDeclaredField("a"); m.setAccessible(true); m.set(sf, new java.util.HashMap()); }
    }
    SeedMath.reset(seed * 7 + 5);
    EW.pistons.clear();
    int spawnedSeen = 0;
    java.util.Map<String, String> cellsBefore = new java.util.HashMap<>();
    if (BCW) {
      SeedRandom.next = 7000000L + seed * 1000; // entities built mid-run (items, orbs, potions, the skeleton and arrow of arrowkill) count their Entity.rand seeds up from here
      EW.booms.clear(); EW.boomPlayer = player;
      MobMoveProbe.set(w, "s", new Random(seed)); // World.rand (explosion rays, drop scatter, the sound pitch) restarts per record so the replay can seed it the same way
      w.O().a("mobGriefing", "true");
      VillagerProbe.World.spawned.clear();
    }
    double cpx = 0, cpy = 0, cpz = 0;
    int gBefore = 1;
    // Batch 47 (serverplayer): the client is a separate position (cl) that the script's walk and move op drive; the server copy keeps the last position a C03 packet gave it
    // (EntityClientPlayerMP.sendMotionUpdates: a position packet when the squared move since the last one is over 9.0E-4 or 20 ticks passed) and NetHandlerPlayServer.processPlayer
    // puts it back after onUpdateEntity (setPositionAndRotation at the position it had when the packet arrived).
    double[] cl = {player.s, player.t, player.u}, sent = {0, 0, 0};
    boolean clGround = true;
    int sinceSent = 0;
    double[][] vel = new double[ents.length][2];
    StringBuilder rs = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      VillagerProbe.World.tick = t;
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "look": { float yaw = Float.parseFloat(p[2]), pitch = Float.parseFloat(p[3]); player.y = yaw; player.z = pitch; MobMoveProbe.set(player, "A", yaw); MobMoveProbe.set(player, "B", pitch); break; }
          case "helmet": ((yx) MobMoveProbe.field(yz.class, "bm").get(player)).b[3] = p[2].equals("0") ? null : new add(adb.a(aji.e(Integer.parseInt(p[2])))); break;
          case "day": VillageLiveProbe.W.day = p[2].equals("on"); break;
          case "rain": VillageLiveProbe.W.rain = p[2].equals("on"); break;
          case "bright": VillagerProbe.World.brightLevel = Integer.parseInt(p[2]); break;
          case "creative": ServerPlayerProbe.gameType(player, p[3].equals("on") ? ahk.c : ahk.b); break;
          case "adventure": ServerPlayerProbe.gameType(player, p[3].equals("on") ? ahk.d : ahk.b); break;
          case "invisible": player.d(p[3].equals("on")); break;
          case "sneak": player.b(p[3].equals("on")); break;
          case "fly": player.bE.b = p[3].equals("on"); break; // batch 47: capabilities.isFlying of the server copy (the C13 packet sets it)
          case "piston": { // batch 48: piston idx-less: "t piston x y z facing extending(0|1) storedId storedMeta [renderHead]": the cell becomes BlockPistonMoving (36) with a real TileEntityPiston, as BlockPistonBase.tryExtend / doMove leave it
            int px = Integer.parseInt(p[2]), py = Integer.parseInt(p[3]), pz = Integer.parseInt(p[4]), face = Integer.parseInt(p[5]);
            aps tile = new aps(aji.e(Integer.parseInt(p[7])), Integer.parseInt(p[8]), face, p[6].equals("1"), p.length > 9 && p[9].equals("1"));
            tile.b = w; tile.c = px; tile.d = py; tile.e = pz;
            VillagerProbe.World.cells.put(VillagerProbe.key(px, py, pz), new int[] {36, face});
            EW.pistons.put(VillagerProbe.key(px, py, pz), tile);
            break;
          }
          case "ground": clGround = p[3].equals("on"); break; // batch 47: the onGround flag the client reports in every C03 packet
          case "hold": { yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(player); inv.a[inv.c] = p[2].equals("0") ? null : new add(adb.d(Integer.parseInt(p[2]))); break; } // batch 43: the held item of the player (beg tasks)
          case "holdn": { yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(player); inv.a[inv.c] = p[2].equals("0") ? null : new add(adb.d(Integer.parseInt(p[2])), Integer.parseInt(p[3])); break; } // batch 44: a stack of p[3]
          case "use": player.q((sa) ents[Integer.parseInt(p[2])]); break; // batch 44: the player's real interaction (EntityPlayer.interactWith: feeding, taming, breeding)
          case "effect": ((sv) ents[Integer.parseInt(p[2])]).c(new rw(Integer.parseInt(p[3]), Integer.parseInt(p[4]), 0)); break; // addPotionEffect(id, ticks, amplifier 0)
          case "mount": player.a((sa) ents[Integer.parseInt(p[2])]); break; // batch 47: the player mounts a horse (EntityPlayerMP.mountEntity; the network handler's position packet goes nowhere)
          case "age": ((wi) ents[Integer.parseInt(p[2])]).c(Integer.parseInt(p[3])); break; // batch 47: EntityAgeable.setGrowingAge (a foal a few ticks from growing up)
          case "temper": ((wi) ents[Integer.parseInt(p[2])]).u(Integer.parseInt(p[3])); break;
          case "difficulty": MobMoveProbe.set(w, "r", rd.values()[Integer.parseInt(p[2])]); break; // batch 45
          case "grief": w.O().a("mobGriefing", p[2].equals("on") ? "true" : "false"); break;
          case "power": ((sa) ents[Integer.parseInt(p[2])]).af.b(17, Byte.valueOf((byte) 1)); break; // a charged creeper (datawatcher 17)
          case "bolt": ((sa) ents[Integer.parseInt(p[2])]).a((xh) null); break; // Entity.onStruckByLightning (the bolt argument is unused by Entity and EntityCreeper)
          case "fire": ((sa) ents[Integer.parseInt(p[2])]).e(Integer.parseInt(p[3])); break; // Entity.setFire(seconds) is sa.e (ArmorEnchantmentProbe)
          case "arrowkill": { // a skeleton's arrow kills a mob: DamageSource.causeArrowDamage(arrow, skeleton)
            sv victim = (sv) ents[Integer.parseInt(p[2])];
            yl skel = new yl(w); zc arrow = new zc(w);
            victim.a(ro.a(arrow, skel), Float.parseFloat(p[3]));
            break;
          }
          case "health": ((sv) ents[Integer.parseInt(p[2])]).g(Float.parseFloat(p[3])); break;
          case "angry": ((wv) ents[Integer.parseInt(p[2])]).l(true); break;
          case "sit": ((wv) ents[Integer.parseInt(p[2])]).cc().a(p[3].equals("on")); break;
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": if (B47 && Integer.parseInt(p[2]) == n) { cl[0] = Double.parseDouble(p[3]); cl[1] = p.length > 5 ? Double.parseDouble(p[5]) : 0; cl[2] = Double.parseDouble(p[4]); } else VillageFightProbe.at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : 0, Double.parseDouble(p[4])); break;
          case "melee": player.r((sa) ents[Integer.parseInt(p[2])]); break; // the real attackTargetEntityWithCurrentItem: damage, then setLastAttacker
          case "hit": {
            sv victim = (sv) ents[Integer.parseInt(p[2])];
            sa attacker = (sa) ents[Integer.parseInt(p[3])];
            victim.a(ro.a((sv) attacker), Float.parseFloat(p[4]));
            break;
          }
          default: throw new RuntimeException(op);
        }
      }
      if (BCW) { cellsBefore.clear(); for (java.util.Map.Entry<String, int[]> en : VillagerProbe.World.cells.entrySet()) cellsBefore.put(en.getKey(), en.getValue()[0] + "," + en.getValue()[1]); EW.booms.clear(); }
      for (int i = 0; i < ents.length; i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = (sa) ents[i]; if (B47 && i == n) { cl[0] += vel[i][0]; cl[2] += vel[i][1]; } else VillageFightProbe.at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (B47) { // the client's position packet for this tick: a position only when it moved over 0.03 or 20 ticks passed; every packet carries onGround
        double ddx = cl[0] - sent[0], ddy = cl[1] - sent[1], ddz = cl[2] - sent[2];
        boolean send = ddx * ddx + ddy * ddy + ddz * ddz > 9.0E-4 || sinceSent >= 20;
        sinceSent++;
        if (send) { VillageFightProbe.at(player, cl[0], cl[1], cl[2]); sent = cl.clone(); sinceSent = 0; }
        player.D = clGround;
        cpy = cl[1];
      }
      else if (B46) { cpx = player.s; cpy = player.t; cpz = player.u; } // the client's position for this tick (after the script's walk)
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (VillageFightProbe.Log l : logs) l.log.clear();
      if (!B47H) VillagerProbe.World.sounds.clear(); // batch 47 (horses2): the sounds a script op makes (feeding, rearing) stay in the tick's row
      if (!B46 || B47) player.aa++; // (b47sp: the world tick's EntityPlayerMP.onUpdate counts it) // (b46mp: mw.i counts it) EntityPlayerMP.onUpdate: ++ticksExisted (the player is not ticked otherwise); EntityLivingBase.getAITarget's window and the owner's wolves read it
      for (int i = 0; i < n; i++) {
        sa e = (sa) ents[i];
        if (e.K) continue;
        e.aa++;
        VillageFightProbe.update(e);
        if (B47H && e instanceof wi && e.l != null) ((wi) e).ac(); // World.updateEntityWithOptionalForce then updates the rider: Entity.updateRidden -> updateRiderPosition (the probe never ticks its player)
      }
      // Batch 48 (pistonpush): World.updateEntities' tile entity pass: every moving piston block updates (TileEntityPiston.updateEntity, aps.h) after the entities and before the network tick; it pushes whatever is in its box with Entity.moveEntity.
      if (B48) for (aps tile : new ArrayList<>(EW.pistons.values())) tile.h();
      // Batch 46 (mobpush): the network tick after the world tick: EntityPlayerMP.onUpdateEntity (mw.i) runs the real EntityPlayer.onUpdate (onLivingUpdate, motion, collideWithNearbyEntities) on the probe player.
      if (B46) { try { gBefore = player.D ? 1 : 0; double sx = player.s, sy = player.t, sz = player.u; player.i(); if (B47) VillageFightProbe.at(player, sx, sy, sz); else VillageFightProbe.at(player, cpx, player.t, cpz); /* the client's position packet puts the server copy back at the client's x and z (its y follows its own fall) */ } catch (Throwable ex) { System.err.println("player.i failed at tick " + t + ": " + ex); ex.printStackTrace(); } }
      StringBuilder kids = new StringBuilder();
      if (B45) for (Object o : VillagerProbe.World.entities) if (o instanceof wi && !java.util.Arrays.asList(ents).contains(o)) kids.append(kids.length() > 0 ? "," : "").append(horseFlags((wi) o));
      VillagerProbe.World.entities.removeIf(o -> o instanceof wf && !java.util.Arrays.asList(ents).contains(o));
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < n; i++) {
        sa e = (sa) ents[i];
        if (i > 0) row.append(",");
        sv tgt = ents[i] instanceof ya ? (sv) ((td) e).bT() : ((sw) e).o();
        sv rv = (sv) MobMoveProbe.field(sv.class, "i").get(e);
        String flags = "[]";
        if (e instanceof ya) { ya en = (ya) e; flags = "[" + (en.cd() ? 1 : 0) + "," + (MobMoveProbe.b(en, "bv") ? 1 : 0) + "," + MobMoveProbe.field(ya.class, "bt").getInt(en) + "," + MobMoveProbe.field(ya.class, "bs").getInt(en) + "," + aji.b(en.cb()) + "]"; }
        if (BCW && e instanceof yp) { yp wi = (yp) e; add held = ((sv) e).be(); flags = "[" + (wi.bZ() ? 1 : 0) + "," + MobMoveProbe.field(yp.class, "bs").getInt(wi) + "," + (held == null ? -1 : held.k()) + "," + VillageFightProbe.num(((sv) e).a(yj.d).e()) + "]"; }
        else if (BCW && e instanceof xz) { xz cr = (xz) e; flags = "[" + cr.cb() + "," + MobMoveProbe.field(xz.class, "bq").getInt(cr) + "," + MobMoveProbe.field(xz.class, "bp").getInt(cr) + "," + (cr.bZ() ? 1 : 0) + "," + (cr.cc() ? 1 : 0) + "]"; } // state, timeSinceIgnited, lastActiveTime, powered, ignited
        if (e instanceof wv) { wv wf = (wv) e; flags = "[" + (wf.ci() ? 1 : 0) + "," + (wf.ca() ? 1 : 0) + "," + (wf.bZ() ? 1 : 0) + "," + (MobMoveProbe.b(wf.cc(), "b") ? 1 : 0) + "," + (e.L() ? 1 : 0) + (B44 ? "," + MobMoveProbe.field(wf.class, "bp").getInt(e) + "," + ((rx) e).d() : "") + "]"; }
        else if (B45 && e instanceof wi) flags = horseFlags((wi) e);
        else if (B44 && e instanceof wf) flags = "[" + MobMoveProbe.field(wf.class, "bp").getInt(e) + "," + ((rx) e).d() + "]"; // love, growing age
        row.append("[").append(VillageFightProbe.num(e.s)).append(",").append(VillageFightProbe.num(e.t)).append(",").append(VillageFightProbe.num(e.u)).append(",").append(VillageFightProbe.num(((sv) e).aS()))
          .append(",").append(index(ents, tgt)).append(",").append(index(ents, rv)).append(",").append(flags).append(",[").append(VillageFightProbe.draws(logs[i].log)).append("],[").append(VillageFightProbe.num(e.v)).append(",").append(VillageFightProbe.num(e.w)).append(",").append(VillageFightProbe.num(e.x)).append(",")
          .append(VillageFightProbe.num(e.y)).append(",").append(VillageFightProbe.num(e.z)).append(",").append(VillageFightProbe.num(flv(sv.class, e, "aO"))).append(",").append(VillageFightProbe.num(flv(sv.class, e, "aM"))).append(",").append(e.D ? 1 : 0).append(",").append(MobMoveProbe.b(e, "bc") ? 1 : 0).append(",").append(VillageFightProbe.num(flv(sv.class, e, "be"))).append(",").append(VillageFightProbe.num(flv(sv.class, e, "bd"))).append("]]");
      }
      row.append("],[");
      for (int k = 0; k < VillagerProbe.World.sounds.size(); k++) row.append(k > 0 ? "," : "").append(q(VillagerProbe.World.sounds.get(k)));
      row.append("],").append(VillageFightProbe.num(1000.0 - player.aS())).append(",").append(index(ents, MobMoveProbe.field(sv.class, "i").get(player))).append(",").append(player.aa);
      if (B45) row.append(",[" + kids + "]");
      if (BCW) row.append(",").append(extras(spawnedSeen, cellsBefore, player, ents)); // creeperwitch: [explosions, spawned entities, changed cells, player motion]
      if (BCW) spawnedSeen = VillagerProbe.World.spawned.size();
      if (B46) row.append(",").append(gBefore).append(",").append(VillageFightProbe.num(cpy));
      if (B47) row.append(",[").append(VillageFightProbe.num(player.s)).append(",").append(VillageFightProbe.num(player.t)).append(",").append(VillageFightProbe.num(player.u)).append("]"); // row element 8: the server copy's position after the tick // row elements 6 and 7: whether the server copy was onGround when its update began and its y at the start of the tick (the client reports it in the position packet; the replay feeds it as input)
      if (B48) { // row element 9: the moving piston blocks left after the tick [x, y, z, progress, lastProgress]
        row.append(",[");
        boolean first = true;
        for (aps tile : EW.pistons.values()) { row.append(first ? "" : ",").append("[").append(tile.c).append(",").append(tile.d).append(",").append(tile.e).append(",").append(VillageFightProbe.num(MobMoveProbe.field(aps.class, "m").getFloat(tile))).append(",").append(VillageFightProbe.num(MobMoveProbe.field(aps.class, "n").getFloat(tile))).append("]"); first = false; }
        row.append("]");
      }
      row.append("]");
      if (t > 0) rs.append(",");
      rs.append(row);
      if (B47H) VillagerProbe.World.sounds.clear();
      player.g(1000.0f);
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"endermanwolf\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"types\":" + q(types) + ",\"bright\":" + bright + (B44 ? ",\"ext\":1" : "") + (B45 ? ",\"init\":[" + init + "]" : "") + (water ? ",\"water\":true" : "")
      + ",\"roofs\":" + Arrays.deepToString(roofs) + ",\"blocks\":" + Arrays.deepToString(blocks) + ",\"pos\":" + Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"rows\":[" + rs + "]}");
    VillagerProbe.World.entities.clear();
  }

  static void scenario(String name, long seed, int ticks, String types, double[][] pos, String[] script) throws Exception { scenario(name, seed, ticks, types, pos, script, new int[0][0], new int[0][0], false, 15); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    EW w = (EW) u.allocateInstance(EW.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    if (args.length > 0 && args[0].equals("b47h")) for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == ArrayList.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); } // batch 47: World.updateEntity's unmount path clears an ArrayList field
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    B47H = args.length > 0 && args[0].equals("b47h");
    B45 = B47H || (args.length > 0 && args[0].equals("b45"));
    B48 = args.length > 0 && (args[0].equals("b48pp") || args[0].equals("b49po") || args[0].equals("b50lb"));
    B47 = B48 || (args.length > 0 && (args[0].equals("b47sp") || args[0].equals("b46mp"))); // b50: the b46mp scenarios run under the b47 client / server-copy rules (client position, C03 packets, ticksExisted counted by the world tick)
    B46 = B47 || (args.length > 0 && args[0].equals("b46mp"));
    BCW = B46 || (args.length > 0 && args[0].equals("b45cw"));
    B44 = B45 || BCW || (args.length > 0 && args[0].equals("b44"));
    if (args.length > 0 && args[0].equals("b50lb")) EndermanWolfScenarios.run50(); else if (args.length > 0 && args[0].equals("b49po")) EndermanWolfScenarios.run49(); else if (B48) EndermanWolfScenarios.run48(); else if (B47H) EndermanWolfScenarios.run47h(); else if (B45) EndermanWolfScenarios.run45(); else if (args.length > 0 && args[0].equals("b46mp")) EndermanWolfScenarios.run46(); else if (B47) EndermanWolfScenarios.run47(); else if (B46) EndermanWolfScenarios.run46(); else if (BCW) EndermanWolfScenarios.runCW(); else if (B44) EndermanWolfScenarios.run44(); else if (args.length > 0 && args[0].equals("b43")) EndermanWolfScenarios.run43(); else EndermanWolfScenarios.run();
  }
}
