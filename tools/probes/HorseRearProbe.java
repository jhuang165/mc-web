import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

// Batch 55: three records on the unchanged EntityHorse (wi) and its driver classes.
//   anim     the client copy's own wi.h() (onUpdate) with only the data watcher 16 bits written between ticks (what an S1C does): headLean bJ/bK, rearing amount bL/bM,
//            mouth openness bN/bO, the tail counter bp, the counter bq, the mouth counter bE, and the p/q/r partial-tick getters. A client world double with a client chunk provider.
//   copy     a ridden UNSADDLED horse's client copy: wi.h() each tick on that client world (the provider answers a loaded chunk, or none), from rest, with a spawn-packet motion
//            in the air, and on the ground; per tick position, motion, onGround, yaw
//   buck     a real EntityPlayerMP (ServerPlayerProbe) riding a wild horse: the unchanged vg.e() (EntityAIRunAroundLikeCrazy) until it bucks (status 6), and the unchanged
//            mountEntity(null) (yz.a(sa) -> sv.m(sa) dismountEntity) called directly, in a world with stone cells around the horse; the player's position before and after
public class HorseRearProbe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static class RW extends HorseProbe.World {
    static Set<String> cells = new HashSet<>();
    public aji a(int x, int y, int z) { return cells.contains(x + "," + y + "," + z) ? aji.e(1) : super.a(x, y, z); }
    public int e(int x, int y, int z) { return 0; } // getBlockMetadata: every cell has metadata 0 (World.doesBlockHaveSolidTopSurface reads it for stairs)
    public List a(azt box) { // ahb.func_147461_a: the block collision boxes in the box (blocks only)
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < Math.floor(box.f + 1); z++) a(x, y, z).a(this, x, y, z, box, out, null);
      return out;
    }
  }

  static RW world(boolean client, boolean loaded) throws Exception {
    RW world = (RW) HorseProbe.u.allocateInstance(RW.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, client);
    if (client) { // ChunkProviderClient.provideChunk: the chunk the client has (apx.d, isChunkLoaded) or, when it has none, its blank chunk (d false)
      apx chunk = (apx) HorseProbe.u.allocateInstance(apx.class);
      chunk.d = loaded;
      InvocationHandler h = (proxy, m, a) -> m.getName().equals("d") && a != null && a.length == 2 ? chunk : m.getReturnType() == boolean.class ? (Object) false : m.getReturnType() == int.class ? (Object) 0 : null;
      MobMoveProbe.set(world, "v", Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, h));
    }
    HorseProbe.W = world;
    return world;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    anim();
    copy();
    buck();
  }

  static void anim() throws Exception {
    Object[][] scripts = {
      { "rearThenEat", new int[][] { { 2, 24, 64 }, { 30, 44, 32 } } },
      { "mouthRearEat", new int[][] { { 1, 6, 128 }, { 4, 10, 64 }, { 8, 30, 32 }, { 20, 22, 128 } } },
      { "rearWhileEating", new int[][] { { 0, 12, 32 }, { 6, 16, 64 } } },
    };
    for (Object[] sc : scripts) {
      world(true, true);
      wi e = HorseProbe.typed(5, 0);
      Method setFlag = MobMoveProbe.method(wi.class, "b", int.class, boolean.class);
      Method h = MobMoveProbe.method(wi.class, "h");
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 50; i++) {
        for (int flag : new int[] { 32, 64, 128 }) {
          boolean on = false;
          for (int[] span : (int[][]) sc[1]) if (span[2] == flag && i >= span[0] && i <= span[1]) on = true;
          setFlag.invoke(e, flag, on);
        }
        h.invoke(e);
        rows.append(i > 0 ? "," : "").append("{\"eat\":" + e.cm() + ",\"rear\":" + e.cn() + ",\"headLean\":" + num(MobMoveProbe.fl(e, "bJ")) + ",\"prevHeadLean\":" + num(MobMoveProbe.fl(e, "bK"))
          + ",\"rearAmount\":" + num(MobMoveProbe.fl(e, "bL")) + ",\"prevRearAmount\":" + num(MobMoveProbe.fl(e, "bM")) + ",\"mouth\":" + num(MobMoveProbe.fl(e, "bN")) + ",\"prevMouth\":" + num(MobMoveProbe.fl(e, "bO"))
          + ",\"mouthCounter\":" + MobMoveProbe.field(wi.class, "bE").getInt(e) + ",\"bp\":" + MobMoveProbe.field(wi.class, "bp").getInt(e) + ",\"bq\":" + MobMoveProbe.field(wi.class, "bq").getInt(e)
          + ",\"p\":" + num(e.p(0.5f)) + ",\"q\":" + num(e.q(0.5f)) + ",\"r\":" + num(e.r(0.5f)) + "}");
      }
      HorseProbe.out("{\"case\":\"anim\",\"name\":\"" + sc[0] + "\",\"ticks\":[" + rows + "]}");
    }
  }

  static void copy() throws Exception {
    // name, loaded chunk, start y, motion x, y, z (a spawn packet's (int)/8000 values), ticks
    Object[][] sc = {
      { "air", true, 5.0, 0.12, 0.0, -0.07, 14 },
      { "ground", true, 0.0, 0.1, 0.0, 0.0, 10 },
      { "unloaded", false, 5.0, 0.12, 0.0, -0.07, 8 },
    };
    for (Object[] s : sc) {
      world(true, (Boolean) s[1]);
      HorseProbe.player = HorseProbe.makePlayer(false);
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(3, false, 0f, 0f, 0f, 0f);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.0, (Double) s[2], 64.0);
      MobMoveProbe.set(e, "D", (Double) s[2] == 0.0);
      MobMoveProbe.set(e, "v", (Double) s[3]); MobMoveProbe.set(e, "w", (Double) s[4]); MobMoveProbe.set(e, "x", (Double) s[5]);
      Method h = MobMoveProbe.method(wi.class, "h");
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[6]; i++) {
        h.invoke(e);
        rows.append(i > 0 ? "," : "").append("{\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
          + ",\"mx\":" + num(MobMoveProbe.d(e, "v")) + ",\"my\":" + num(MobMoveProbe.d(e, "w")) + ",\"mz\":" + num(MobMoveProbe.d(e, "x")) + ",\"onGround\":" + MobMoveProbe.b(e, "D") + "}");
      }
      HorseProbe.player.a((sa) null);
      HorseProbe.out("{\"case\":\"copy\",\"name\":\"" + s[0] + "\",\"loaded\":" + s[1] + ",\"start\":[64.0," + num((Double) s[2]) + ",64.0],\"motion\":[" + num((Double) s[3]) + "," + num((Double) s[4]) + "," + num((Double) s[5]) + "],\"ticks\":[" + rows + "]}");
    }
  }

  // Stone cells as boxes [x0, y0, z0, x1, y1, z1] (inclusive), around the horse at (64, 0, 64)
  static Object[][] bucks = {
    { "open", new int[][] {} },
    { "ringed", new int[][] { { 61, 1, 61, 67, 3, 63 }, { 61, 1, 65, 67, 3, 67 }, { 61, 1, 64, 63, 3, 64 }, { 65, 1, 64, 67, 3, 64 } } },
    { "wallEast", new int[][] { { 65, 0, 61, 67, 3, 67 } } },
    { "wallWest", new int[][] { { 61, 0, 61, 63, 3, 67 } } },
    { "wallNorth", new int[][] { { 61, 0, 61, 67, 3, 63 } } },
    { "wallSouth", new int[][] { { 61, 0, 65, 67, 3, 67 } } },
    { "lowCeiling", new int[][] { { 61, 2, 61, 67, 2, 67 } } },
  };

  // NetHandlerPlayServer.setPlayerLocation: the server moves the player to the spot (setPositionAndRotation) and records it. mw.a(DDD) (setPositionAndUpdate, which sv.m ends with)
  // and mw.a(sa) (the spot after super.mountEntity) both go through it.
  public static class RecNet extends ServerPlayerProbe.Net {
    static List<String> spots = new ArrayList<>();
    static sa player;
    public void a(double x, double y, double z, float yaw, float pitch) {
      spots.add("[" + num(x) + "," + num(y) + "," + num(z) + "]");
      try { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, x, y, z); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
  }

  static String triple(sa p) throws Exception { return "[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "]"; }

  static void buck() throws Exception {
    for (Object[] b : bucks) for (int mode = 0; mode < 2; mode++) {
      RW.cells.clear();
      for (int[] bx : (int[][]) b[1]) for (int x = bx[0]; x <= bx[3]; x++) for (int y = bx[1]; y <= bx[4]; y++) for (int z = bx[2]; z <= bx[5]; z++) RW.cells.add(x + "," + y + "," + z);
      RW w = world(false, false);
      HorseProbe.clear();
      mw pl = ServerPlayerProbe.make(w, "probe");
      pl.a = (nh) HorseProbe.u.allocateInstance(RecNet.class);
      RecNet.player = pl;
      RecNet.spots.clear();
      wi e = HorseProbe.horse(1);
      e.a((sy) null);
      e.i(false);
      pl.a((sa) e); // the real mw.a(sa) -> yz.a(sa) -> mount
      e.ac();
      String seat = triple(pl);
      RecNet.spots.clear();
      int status = -1;
      if (mode == 0) { // the unchanged vg.e() until its buck
        vg task = new vg(e, 1.2);
        for (int tick = 0; tick < 4000 && status < 0; tick++) {
          HorseProbe.World.states.clear();
          task.e();
          if (!HorseProbe.World.states.isEmpty()) status = HorseProbe.World.states.get(0);
        }
      } else pl.a((sa) null); // mountEntity(null) directly
      HorseProbe.out("{\"case\":\"buck\",\"name\":\"" + b[0] + "\",\"mode\":\"" + (mode == 0 ? "task" : "direct") + "\",\"status\":" + status + ",\"yOffset\":" + num(MobMoveProbe.fl(pl, "L"))
        + ",\"playerWidth\":" + num(MobMoveProbe.fl(pl, "M")) + ",\"playerHeight\":" + num(MobMoveProbe.fl(pl, "N")) + ",\"horse\":" + triple(e) + ",\"horseMinY\":" + num(((azt) MobMoveProbe.field(sa.class, "C").get(e)).b)
        + ",\"horseHeight\":" + num(MobMoveProbe.fl(e, "N")) + ",\"seat\":" + seat + ",\"spots\":" + RecNet.spots + ",\"after\":" + triple(pl) + ",\"mounted\":" + (MobMoveProbe.field(sa.class, "m").get(pl) != null)
        + ",\"horseHasRider\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + ",\"cells\":" + java.util.Arrays.deepToString((int[][]) b[1]) + "}");
    }
  }
}
