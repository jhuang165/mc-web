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
    public void a(double x, double y, double z, String sound, float volume, float pitch) { VillagerProbe.World.sounds.add(sound + "|" + volume + "|" + pitch + "@"); }
    public boolean y(int x, int y, int z) { return VillageLiveProbe.W.rain && i(x, y, z); } // World.canLightningStrikeAt in a flat plains world: raining, open sky
  }

  // Batch 43: the Entity.rand log also records nextDouble ("d"; the doubles inside nextGaussian are not logged separately), so every draw of the stream is compared, not only the typed ones.
  public static class DLog extends VillageFightProbe.Log {
    boolean inGauss;
    DLog(long seed) { super(seed); }
    public double nextDouble() { double r = super.nextDouble(); if (!inGauss) log.add("d"); return r; }
    public double nextGaussian() { inGauss = true; try { return super.nextGaussian(); } finally { inGauss = false; } }
  }
  static float flv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getFloat(o); }

  static String q(String s) { return "\"" + s + "\""; }
  static int index(Object[] ents, Object e) { for (int k = 0; k < ents.length; k++) if (ents[k] == e) return k; return -1; }

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
    player.a(yj.a).a(1000.0); player.g(1000.0f);
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(Arrays.asList(player));
    { Field hf = ahb.class.getDeclaredField("h"); hf.setAccessible(true); List pl = (List) hf.get(w); pl.clear(); pl.add(player); }
    VillagerProbe.World.realPlayers = true;
    VillagerProbe.World.immediateMobs = false;
    player.bE.a = false; player.bE.d = false;
    SeedMath.reset(seed * 7 + 5);
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
          case "angry": ((wv) ents[Integer.parseInt(p[2])]).l(true); break;
          case "sit": ((wv) ents[Integer.parseInt(p[2])]).cc().a(p[3].equals("on")); break;
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": VillageFightProbe.at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : 0, Double.parseDouble(p[4])); break;
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
      for (int i = 0; i < ents.length; i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = (sa) ents[i]; VillageFightProbe.at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (VillageFightProbe.Log l : logs) l.log.clear();
      VillagerProbe.World.sounds.clear();
      player.aa++; // EntityPlayerMP.onUpdate: ++ticksExisted (the player is not ticked otherwise); EntityLivingBase.getAITarget's window and the owner's wolves read it
      for (int i = 0; i < n; i++) {
        sa e = (sa) ents[i];
        if (e.K) continue;
        e.aa++;
        VillageFightProbe.update(e);
      }
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < n; i++) {
        sa e = (sa) ents[i];
        if (i > 0) row.append(",");
        sv tgt = ents[i] instanceof ya ? (sv) ((td) e).bT() : ((sw) e).o();
        sv rv = (sv) MobMoveProbe.field(sv.class, "i").get(e);
        String flags = "[]";
        if (e instanceof ya) { ya en = (ya) e; flags = "[" + (en.cd() ? 1 : 0) + "," + (MobMoveProbe.b(en, "bv") ? 1 : 0) + "," + MobMoveProbe.field(ya.class, "bt").getInt(en) + "," + MobMoveProbe.field(ya.class, "bs").getInt(en) + "," + aji.b(en.cb()) + "]"; }
        if (e instanceof wv) { wv wf = (wv) e; flags = "[" + (wf.ci() ? 1 : 0) + "," + (wf.ca() ? 1 : 0) + "," + (wf.bZ() ? 1 : 0) + "," + (MobMoveProbe.b(wf.cc(), "b") ? 1 : 0) + "," + (e.L() ? 1 : 0) + "]"; }
        row.append("[").append(VillageFightProbe.num(e.s)).append(",").append(VillageFightProbe.num(e.t)).append(",").append(VillageFightProbe.num(e.u)).append(",").append(VillageFightProbe.num(((sv) e).aS()))
          .append(",").append(index(ents, tgt)).append(",").append(index(ents, rv)).append(",").append(flags).append(",[").append(VillageFightProbe.draws(logs[i].log)).append("],[").append(VillageFightProbe.num(e.v)).append(",").append(VillageFightProbe.num(e.w)).append(",").append(VillageFightProbe.num(e.x)).append(",")
          .append(VillageFightProbe.num(e.y)).append(",").append(VillageFightProbe.num(e.z)).append(",").append(VillageFightProbe.num(flv(sv.class, e, "aO"))).append(",").append(VillageFightProbe.num(flv(sv.class, e, "aM"))).append(",").append(e.D ? 1 : 0).append(",").append(MobMoveProbe.b(e, "bc") ? 1 : 0).append(",").append(VillageFightProbe.num(flv(sv.class, e, "be"))).append(",").append(VillageFightProbe.num(flv(sv.class, e, "bd"))).append("]]");
      }
      row.append("],[");
      for (int k = 0; k < VillagerProbe.World.sounds.size(); k++) row.append(k > 0 ? "," : "").append(q(VillagerProbe.World.sounds.get(k)));
      row.append("],").append(VillageFightProbe.num(1000.0 - player.aS())).append(",").append(index(ents, MobMoveProbe.field(sv.class, "i").get(player))).append(",").append(player.aa).append("]");
      if (t > 0) rs.append(",");
      rs.append(row);
      player.g(1000.0f);
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"endermanwolf\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"types\":" + q(types) + ",\"bright\":" + bright + (water ? ",\"water\":true" : "")
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
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    EndermanWolfScenarios.run();
  }
}
