import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 85 convert85: a live squid pushing and being pushed (EntityLivingBase.collideWithNearbyEntities, sv.bo, inside ws.e's blocked-free update) on the unchanged
// 1.7.10 classes. The world double is SquidBatProbe's (water above the stone floor) whose getEntitiesWithinAABBExcludingEntity (ahb.b(sa, azt)) answers the entities
// whose box meets the query box. Entity.rand is CorpseLivingProbe.Log (LCG copy with a draw counter). ticksExisted counts before each ws.h().
//   pair    two squids, B's start offset from A's by (dx, dz), A.h() then B.h() each tick for 40 ticks, in water: rows [tick, A state, A draws, A random, B state, B draws, B random]
//   player  one squid and a stub EntityPlayer (a bare yz, never ticked) at an offset: the squid's rows, and the player's motion after each tick
//   three   three squids in a cluster (pushes chain)
public class SquidPushProbe {
  public static class World extends SquidBatProbe.World {
    static List<sa> ents = new ArrayList<>();
    public List b(sa entity, azt box) {
      List out = new ArrayList();
      for (sa e : ents) if (e != entity && e.C.b(box)) out.add(e);
      return out;
    }
  }
  public static class P extends yz {
    P(ahb world) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes("probe".getBytes()), "probe")); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }

  static ws squid(World w, long seed, double x, double y, double z, CorpseLivingProbe.Log[] logOut, int i) throws Exception {
    ws e = SquidBatProbe.squid(w, seed, x, y, z);
    logOut[i] = new CorpseLivingProbe.Log(seed);
    MobMoveProbe.set(e, "Z", logOut[i]);
    World.ents.add(e);
    return e;
  }
  static String state(ws e, CorpseLivingProbe.Log r, int before, int tick) throws Exception {
    String s = SquidBatProbe.squidState(e, tick, 0);
    s = s.substring(s.indexOf(",\"tick\"") + 1, s.length() - 1);
    return "{" + s + ",\"draws\":" + (r.calls - before) + ",\"random\":" + r.json() + "}";
  }

  static void run(World w, String name, long seed, double[][] at, boolean withPlayer, int ticks) throws Exception {
    World.wet = true;
    World.ents.clear();
    int n = at.length - (withPlayer ? 1 : 0);
    CorpseLivingProbe.Log[] logs = new CorpseLivingProbe.Log[n];
    ws[] sq = new ws[n];
    for (int i = 0; i < n; i++) sq[i] = squid(w, seed + 31L * i, at[i][0], at[i][1], at[i][2], logs, i);
    yz player = null;
    if (withPlayer) {
      player = new P(w);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, at[n][0], at[n][1], at[n][2]);
      World.ents.add(player);
    }
    StringBuilder rows = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      StringBuilder row = new StringBuilder("[");
      for (int i = 0; i < n; i++) {
        int before = logs[i].calls;
        CorpseLivingProbe.tick(sq[i]);
        sq[i].h();
        row.append(i > 0 ? "," : "").append(state(sq[i], logs[i], before, t));
      }
      if (player != null) row.append(",[").append(num(player.v)).append(",").append(num(player.w)).append(",").append(num(player.x)).append("]");
      rows.append(t > 1 ? "," : "").append(row).append("]");
    }
    StringBuilder pos = new StringBuilder("[");
    for (int i = 0; i < at.length; i++) pos.append(i > 0 ? "," : "").append("[" + num(at[i][0]) + "," + num(at[i][1]) + "," + num(at[i][2]) + "]");
    System.out.println("{\"name\":\"" + name + "\",\"seed\":" + seed + ",\"squids\":" + n + ",\"player\":" + withPlayer + ",\"at\":" + pos + "],\"rows\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World w = (World) u.allocateInstance(World.class);
    CorpseLivingProbe.setupWorld(w);
    for (int k = 0; k < 4; k++) {
      double[][] d = { {0.1, 0.05}, {0.3, -0.2}, {0.0, 0.0}, {0.55, 0.4} }; // B's offset from A: overlapping, touching-ish, coincident, apart (0.2 margin)
      run(w, "pair-" + k, 100 + k, new double[][] { {64.5, 10, 64.5}, {64.5 + d[k][0], 10.2, 64.5 + d[k][1]} }, false, 40);
    }
    run(w, "three", 300, new double[][] { {64.5, 10, 64.5}, {64.8, 10.1, 64.6}, {64.6, 10.3, 64.9} }, false, 40);
    run(w, "player-0", 400, new double[][] { {64.5, 10, 64.5}, {64.7, 10, 64.6} }, true, 30);
    run(w, "player-1", 401, new double[][] { {64.5, 10, 64.5}, {64.2, 10, 64.9} }, true, 30);
  }
}
