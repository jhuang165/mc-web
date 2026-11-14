import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 61: the client copy's own Random draws that batch 60's MobSoundsProbe (dry world, no status packets) could not show. The unchanged mob classes
// (sg.a EntityList.createEntityByName) on a CLIENT world double (ahb.E true), a logging Random as the copy's Entity.rand (sa.Z) and another as the world's (ahb.s).
//   water   every mob h() (onUpdate: onEntityUpdate, onLivingUpdate, body turn) 420 ticks, dropped from y 8 into a pool (water y 0..4, x 7..13, z -9..-3, stone below y 0):
//           entering (Entity.handleWaterMovement splash), swimming, and drowning (air supply down to -20, the 8 bubbles). Row per tick:
//           [draws, sounds, particles, onGround, inWater, air, x, y, z (before the tick), vx, vy, vz (before the tick), worldDraws]
//   wither  xc.h() 14 ticks with watcher 20 (invulnerable time, xc.s) 100, then armoured (health 100 of 300), then both, on dry ground
//   status  sa.a(byte) (Entity.handleHealthUpdate) for every mob and status in STATUSES, then 40 ticks of h() for the focus pairs
//   potion  zombie h() 40 ticks with watcher 7 (colour) and 8 (ambient) set, visible / invisible
//   scream  enderman h() 300 ticks with watcher 18 (screaming) set, never aggressive (client)
public class MobCopies2Probe {
  public static class PW extends HorseProbe.World {
    static List<String> particles = new ArrayList<>();
    static boolean pool = false;
    static int rainMinY = Integer.MAX_VALUE; // b64: ahb.y = canLightningStrikeAt on this client world: true at y >= rainMinY (an open column from there up); `strikes` logs the asked cells
    static List<String> strikes = new ArrayList<>();
    public boolean y(int x, int y, int z) { strikes.add(x + "," + y + "," + z); return y >= rainMinY; }
    boolean in(int x, int y, int z) { return pool && x >= 7 && x <= 13 && z >= -9 && z <= -3 && y >= 0 && y <= 4; }
    public aji a(int x, int y, int z) { return in(x, y, z) ? aji.e(9) : super.a(x, y, z); }
    public int e(int x, int y, int z) { return 0; }
    public ahu a(int x, int z) { return ahu.p; } // the biome the snow golem's onLivingUpdate reads (a temperate one)
    public float n(int x, int y, int z) { return 1.0f; }
    public int k(int x, int y, int z) { return 15; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add(name); }
  }
  static String q(String s) { return "\"" + s + "\""; }
  static final String[] NAMES = { "Creeper", "Skeleton", "Spider", "CaveSpider", "Giant", "Zombie", "PigZombie", "Slime", "LavaSlime", "Ghast", "Enderman", "Silverfish", "Blaze", "WitherBoss", "Witch",
    "Bat", "Pig", "Sheep", "Cow", "MushroomCow", "Chicken", "Squid", "Wolf", "Ozelot", "SnowMan", "VillagerGolem", "Villager", "EntityHorse" };
  static final int[] STATUSES = { 1, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22 };
  static HorseCopyProbe.Log wr;
  static sv make(String name, long seed, double x, double y, double z, boolean pool) throws Exception {
    PW.rainMinY = Integer.MAX_VALUE; PW.strikes.clear();
    PW.pool = pool; MobMoveProbe.ProbeWorld.water = pool; // the real World.handleMaterialAcceleration
    HorseCopyProbe.build(PW.class, true);
    HorseProbe.clear(); PW.particles.clear();
    wr = new HorseCopyProbe.Log(seed + 7000); MobMoveProbe.set(HorseProbe.W, "s", wr);
    Object provider = MobMoveProbe.field(ahb.class, "v").get(HorseProbe.W);
    Object chunk = provider.getClass().getMethod("d", int.class, int.class).invoke(provider, 0, 0);
    java.util.List[] lists = new java.util.List[16]; for (int k = 0; k < 16; k++) lists[k] = new ArrayList();
    MobMoveProbe.set(chunk, "j", lists); MobMoveProbe.set(chunk, "u", new apz[16]); MobMoveProbe.set(chunk, "e", HorseProbe.W);
    sv e = (sv) sg.a(name, HorseProbe.W);
    HorseCopyProbe.Log r = new HorseCopyProbe.Log(seed); MobMoveProbe.set(e, "Z", r);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    return e;
  }
  static HorseCopyProbe.Log rand(sv e) throws Exception { return (HorseCopyProbe.Log) MobMoveProbe.field(sa.class, "Z").get(e); }
  static void watch(sv e, int index, Object v) throws Exception { ((te) MobMoveProbe.field(sa.class, "af").get(e)).b(index, v); }
  static String row(sv e, HorseCopyProbe.Log r, boolean extra) throws Exception {
    String s = "[\"" + String.join(" ", r.log) + "\"," + HorseCopyProbe.list(new ArrayList<>(HorseProbe.World.sounds)) + "," + HorseCopyProbe.list(new ArrayList<>(PW.particles)) + "," + MobMoveProbe.field(sa.class, "D").getBoolean(e)
      + "," + MobMoveProbe.field(sa.class, "H").getBoolean(e) + "," + e.ar() + ",\"" + String.join(" ", wr.log) + "\"";
    return s + "]";
  }
  static String pre(sv e) throws Exception {
    return MobMoveProbe.d(e, "s") + "," + MobMoveProbe.d(e, "t") + "," + MobMoveProbe.d(e, "u") + "," + MobMoveProbe.d(e, "v") + "," + MobMoveProbe.d(e, "w") + "," + MobMoveProbe.d(e, "x");
  }
  static void clearLogs(HorseCopyProbe.Log r) { r.log.clear(); wr.log.clear(); HorseProbe.World.sounds.clear(); PW.particles.clear(); }
  static String ticks(sv e, int n, boolean withPre) throws Exception {
    HorseCopyProbe.Log r = rand(e);
    StringBuilder rows = new StringBuilder(); String error = "null";
    for (int i = 0; i < n; i++) {
      String p = withPre ? pre(e) : "";
      clearLogs(r);
      try { e.h(); } catch (Throwable t) { error = q((t + " @ " + t.getStackTrace()[0] + " " + t.getStackTrace()[1]).replace("\"", "'")); break; }
      String row = row(e, r, false);
      rows.append(i > 0 ? "," : "").append(withPre ? "{\"pre\":[" + p + "],\"row\":" + row + "}" : row);
    }
    return "\"error\":" + error + ",\"ticks\":[" + rows + "]";
  }
  static String head(String kind, String name, long seed, sv e) {
    return "{\"case\":" + q(kind) + ",\"name\":" + q(name) + ",\"cls\":" + q(e.getClass().getName()) + ",\"seed\":" + seed;
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    long seed = 6100;
    for (String name : NAMES) {
      seed++;
      sv e = make(name, seed, 10.5, 8.0, -5.5, true);
      HorseProbe.out(head("water", name, seed, e) + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 420, true) + "}");
    }
    { // b62 singleleft: an enderman copy in water on a world where a teleport can succeed (exact floor boxes: the standing enderman's box does not meet the floor cell, so the destination test passes
      // unless the target cell is water; and the floor stands at y 2 for z >= 2). EntityEnderman.onLivingUpdate (ya.e) wet branch: teleportRandomly = nextDouble, nextInt(64), nextDouble, then teleportTo's checks; a success moves the copy
      // and spawns the 128 portal particles. Rows as `water`, with the position before each tick; 3 seeds (a fresh copy each) so several targets land inside and outside the pool.
      MobMoveProbe.ProbeWorld.exact = true; MobMoveProbe.step = 2; // a floor at y 0..1 for z >= 2: teleportTo needs a solid block at y >= 0 under the target (its scan stops at y 0)
      for (long sd = 6600; sd < 6603; sd++) {
        sv e = make("Enderman", sd, 10.5, 8.0, -5.5, true);
        HorseProbe.out(head("watertp", "Enderman", sd, e) + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 160, true) + "}");
      }
      MobMoveProbe.ProbeWorld.exact = false; MobMoveProbe.step = 0;
    }
    { // b63 mobcopies3: ya.e `if (isWet() || isBurning())` on the copy. Entity.isBurning (sa.al) is `!immune && (fire > 0 || (isRemote && getFlag(0)))`: the client copy's burning is watcher 0 bit 0.
      // burntp: a DRY enderman copy with watcher 0 = 1 on the watertp floor (only the burning branch can teleport it); 3 seeds, 100 ticks.
      MobMoveProbe.ProbeWorld.exact = true; MobMoveProbe.step = 2;
      for (long sd = 6700; sd < 6703; sd++) {
        sv e = make("Enderman", sd, 10.5, 8.0, -5.5, false);
        watch(e, 0, (byte) 1);
        HorseProbe.out(head("burntp", "Enderman", sd, e) + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 100, true) + "}");
      }
      MobMoveProbe.ProbeWorld.exact = false; MobMoveProbe.step = 0;
      // wetscream: the wet branch also runs setScreaming(false) (watcher 18 = 0) before the `isScreaming && !isAggressive && nextInt(100) == 0` roll, so a screaming wet copy draws no nextInt(100) at all.
      for (long sd = 6800; sd < 6803; sd++) {
        sv e = make("Enderman", sd, 10.5, 8.0, -5.5, true);
        watch(e, 18, (byte) 1);
        HorseProbe.out(head("wetscream", "Enderman", sd, e) + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 60, true) + "}");
      }
    }
    { // b64 trackertransient: Entity.isWet (sa.L) on the copy asks the CLIENT world's canLightningStrikeAt (ahb.y, rain strength > 0.2, sky, biome) at the feet cell and at floor(posY + height), so rain
      // makes a dry enderman copy take the ya.e wet branch. The world's y(III) is overridden (true for y >= rainMinY); the executed Entity.isWet asks it, `asked` is the list of cells it asked on tick 1.
      // rainfeet: rain at every y; rainhead: only from y 2 up (the feet cell at y 0 is dry, the head cell floor(posY + 2.9) = 2 is rained on); raindry: rain nowhere (control, the strike test is asked, answers no).
      MobMoveProbe.ProbeWorld.exact = true; MobMoveProbe.step = 2;
      String[] kinds = { "rainfeet", "rainhead", "raindry" }; int[] minY = { -64, 2, 99 };
      for (int k = 0; k < 3; k++) for (long sd = 6900 + 10 * k; sd < 6903 + 10 * k; sd++) {
        sv e = make("Enderman", sd, 10.5, k >= 1 ? 0.0 : 8.0, -5.5, false); // rainhead and raindry start on the ground (feet cell y 0): a fall would hurt the copy, which sets its scream flag (Enderman.attackEntityFrom)
        PW.rainMinY = minY[k];
        String body = ticks(e, 60, true);
        HorseProbe.out(head(kinds[k], "Enderman", sd, e) + ",\"rainMinY\":" + minY[k] + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + ",\"asked\":" + HorseCopyProbe.list(new ArrayList<>(PW.strikes.subList(0, Math.min(8, PW.strikes.size())))) + "," + body + "}");
      }
      MobMoveProbe.ProbeWorld.exact = false; MobMoveProbe.step = 0;
    }
    { // b65 trackertransient2: client-side fall damage on an enderman copy. EntityLivingBase.fall (landing after a drop above 3 blocks) calls attackEntityFrom(fall); EntityEnderman.attackEntityFrom
      // (ya.a) runs setScreaming(true) BEFORE super, whose client side refuses (isRemote), so the copy screams (watcher 18) and then rolls nextInt(100) each tick. Dry copy dropped from y 8 (fallhigh, fall 8)
      // and from y 3.5 (fallshort, fall 3.5: damage ceil(0.5) = 1 still counts) and from y 3.0 (fallnone: nothing); 3 seeds, 60 ticks, `pre` rows as the rain records.
      MobMoveProbe.ProbeWorld.exact = true; MobMoveProbe.step = 2;
      String[] kinds = { "fallhigh", "fallshort", "fallnone" }; double[] fromY = { 8.0, 3.5, 3.0 };
      for (int k = 0; k < 3; k++) for (long sd = 7000 + 10 * k; sd < 7003 + 10 * k; sd++) {
        sv e = make("Enderman", sd, 10.5, fromY[k], -5.5, false);
        HorseProbe.out(head(kinds[k], "Enderman", sd, e) + ",\"fromY\":" + fromY[k] + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 60, true) + "}");
      }
      MobMoveProbe.ProbeWorld.exact = false; MobMoveProbe.step = 0;
    }
    { // b65: a BURNING copy (watcher 0 bit 0) in the rain. Entity.onEntityUpdate (sa.C) zeroes `fire` on every client entity, and Entity.moveEntity (sa.d) plays random.fizz only for `isWet() && fire > 0`
      // (fire is set again inside the move only when NOT wet), so the copy never fizzes and nothing is extinguished: rain strikes at every y, zombie copy on the ground, 60 ticks, 3 seeds.
      MobMoveProbe.ProbeWorld.exact = true; MobMoveProbe.step = 2;
      for (long sd = 7100; sd < 7103; sd++) {
        sv e = make("Zombie", sd, 10.5, 0.0, -5.5, false);
        watch(e, 0, (byte) 1); PW.rainMinY = -64;
        HorseProbe.out(head("rainburn", "Zombie", sd, e) + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + "," + ticks(e, 60, true) + "}");
      }
      MobMoveProbe.ProbeWorld.exact = false; MobMoveProbe.step = 0;
    }
    { // wither: spawn charge and armour
      long[] seeds = { 6201, 6202, 6203 }; int[] invul = { 100, 0, 100 }; float[] health = { 300f, 100f, 100f };
      for (int k = 0; k < 3; k++) {
        sv e = make("WitherBoss", seeds[k], 10.5, 1.0, 10.5, false);
        MobMoveProbe.method(sv.class, "g", float.class).invoke(e, health[k]);
        ((xc) e).s(invul[k]);
        HorseProbe.out(head("wither", "WitherBoss", seeds[k], e) + ",\"invul\":" + invul[k] + ",\"health\":" + health[k] + "," + ticks(e, 14, false) + "}");
      }
    }
    { // handleHealthUpdate sweep
      long s2 = 6300;
      for (String name : NAMES) for (int status : STATUSES) {
        s2++;
        sv e = make(name, s2, 10.5, 1.0, 10.5, false);
        if (name.equals("Zombie")) { watch(e, 13, (byte) 1); }
        HorseCopyProbe.Log r = rand(e);
        clearLogs(r);
        String error = "null";
        try { e.a((byte) status); } catch (Throwable t) { error = q((t + " @ " + t.getStackTrace()[0]).replace("\"", "'")); }
        String imm = row(e, r, false);
        boolean focus = (name.equals("Wolf") && status == 8) || (name.equals("Zombie") && status == 16) || (name.equals("Witch") && status == 15) || (name.equals("VillagerGolem") && (status == 4 || status == 11))
          || (name.equals("Villager") && status >= 12 && status <= 14) || (name.equals("Wolf") && (status == 6 || status == 7)) || (name.equals("Ozelot") && (status == 6 || status == 7)) || (name.equals("Sheep") && status == 10);
        HorseProbe.out(head("status", name, s2, e) + ",\"status\":" + status + ",\"statusError\":" + error + ",\"immediate\":" + imm + (focus ? "," + ticks(e, 40, false) : "") + "}");
      }
    }
    { // potion swirl draws: colour 0x336699, plain / ambient / invisible, a zombie C()+h() 40 ticks
      int[][] modes = { { 0, 0 }, { 1, 0 }, { 0, 1 } }; // ambient, invisible
      for (int k = 0; k < 3; k++) {
        sv e = make("Zombie", 6400 + k, 10.5, 1.0, 10.5, false);
        watch(e, 7, 0x336699); watch(e, 8, (byte) modes[k][0]); watch(e, 0, (byte) (modes[k][1] == 1 ? 32 : 0));
        HorseProbe.out(head("potion", "Zombie", 6400 + k, e) + ",\"ambient\":" + modes[k][0] + ",\"invisible\":" + modes[k][1] + "," + ticks(e, 40, false) + "}");
      }
    }
    { // enderman screaming from the watcher
      sv e = make("Enderman", 6500, 10.5, 1.0, 10.5, false);
      watch(e, 18, (byte) 1);
      HorseProbe.out(head("scream", "Enderman", 6500, e) + "," + ticks(e, 300, false) + "}");
    }
  }
}
