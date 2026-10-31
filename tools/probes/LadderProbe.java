import java.util.*;

// Unchanged BlockLadder (als), EntityLivingBase.isOnLadder/moveEntityWithHeading (sv.h_/e(FF))
// and Entity.moveEntity's ladder step distance (sa.d), Minecraft Java 1.7.10.
// The world double holds stone below y 0, an optional stone wall at z = -1 (y 0..8) and a
// ladder column at x = z = 0 (y 0..5) facing +z (metadata 3). Entities are constructor-less
// doubles from MobMoveProbe (zombie) and SneakProbe-style EntityPlayerSP (blk).
public class LadderProbe {
  static int mask = 0; // placement/support tests: stone at x-1, x+1, z-1, z+1 (bits 0..3) around (8,4,8)
  static int ladderMeta = 3;
  static boolean column = true;
  static List<String> sounds = new ArrayList<>();
  static int removed = 0;

  static boolean stone(int x, int y, int z) {
    if (y < 0) return true;
    if (!column) return y == 4 && ((x == 7 && z == 8 && (mask & 1) != 0) || (x == 9 && z == 8 && (mask & 2) != 0) || (x == 8 && z == 7 && (mask & 4) != 0) || (x == 8 && z == 9 && (mask & 8) != 0));
    return z == -1 && y <= 8;
  }
  static boolean ladder(int x, int y, int z) { return column ? x == 0 && z == 0 && y >= 0 && y <= 5 : x == 8 && y == 4 && z == 8; }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) { return stone(x, y, z) ? aji.e(1) : ladder(x, y, z) ? aji.e(65) : aji.e(0); }
    public int e(int x, int y, int z) { return ladder(x, y, z) ? ladderMeta : 0; }
    public boolean f(int x, int y, int z) { removed++; return true; } // setBlockToAir
    public void a(double x, double y, double z, String sound, float volume, float pitch, boolean delay) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            if (stone(x, y, z) || ladder(x, y, z)) a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static String num(double v) { return Double.toString(v); }
  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }

  static blk player(sun.misc.Unsafe u, World w, double x, double y, double z, float yaw, boolean sneak) throws Exception {
    blk e = (blk) u.allocateInstance(blk.class);
    MobMoveProbe.set(e, "o", w);
    MobMoveProbe.set(e, "Z", new Random(1));
    MobMoveProbe.set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(e);
    MobMoveProbe.set(e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(e);
    MobMoveProbe.field(sv.class, "f").set(e, new HashMap());
    MobMoveProbe.set(e, "bE", new yw());
    MobMoveProbe.set(e, "bp", new zr());
    bli input = new bli();
    input.d = sneak;
    MobMoveProbe.set(e, "c", input);
    MobMoveProbe.set(e, "J", true);
    MobMoveProbe.set(e, "W", 0.5f);
    MobMoveProbe.set(e, "aQ", 0.02f);
    MobMoveProbe.set(e, "M", 0.6f);
    MobMoveProbe.set(e, "N", 1.8f);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    MobMoveProbe.set(e, "y", yaw);
    MobMoveProbe.method(yz.class, "aD").invoke(e);
    MobMoveProbe.set(e, "D", y == 0);
    return e;
  }

  static String state(sv e) throws Exception {
    return "{\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
      + ",\"vx\":" + num(MobMoveProbe.d(e, "v")) + ",\"vy\":" + num(MobMoveProbe.d(e, "w")) + ",\"vz\":" + num(MobMoveProbe.d(e, "x"))
      + ",\"onGround\":" + MobMoveProbe.b(e, "D") + ",\"collidedH\":" + MobMoveProbe.b(e, "E") + ",\"ladder\":" + e.h_()
      + ",\"fall\":" + MobMoveProbe.fl(e, "R") + ",\"step\":" + MobMoveProbe.fl(e, "Q") + ",\"sounds\":" + sounds.size() + "}";
  }

  // One tick: prevPos, optional jump on the ground, setAIMoveSpeed, moveEntityWithHeading.
  static void tick(sv e, float speed, float forward, boolean jump) throws Exception {
    MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
    MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
    MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
    if (jump && MobMoveProbe.b(e, "D")) MobMoveProbe.method(sv.class, "bj").invoke(e);
    e.i(speed);
    e.e(0f, forward);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aji l = aji.e(65);
    ajm sound = MobMoveProbe.field(aji.class, "H").getType() == ajm.class ? (ajm) MobMoveProbe.field(aji.class, "H").get(l) : null;
    System.out.println("{\"case\":\"facts\",\"id\":" + aji.b(l) + ",\"hardness\":" + l.f(w, 0, 0, 0) + ",\"opacity\":" + l.k() + ",\"render\":" + l.b()
      + ",\"opaque\":" + l.c() + ",\"normal\":" + l.d() + ",\"normalCube\":" + l.r() + ",\"circuits\":" + (l.o() == awt.q) + ",\"blocksMovement\":" + l.o().c()
      + ",\"requiresTool\":" + !l.o().l() + ",\"drop\":" + adb.b(l.a(3, new Random(1), 0)) + ",\"quantity\":" + l.a(new Random(1)) + ",\"damageDropped\":" + l.a(3)
      + ",\"tab\":" + (l.J() == abt.c) + ",\"stepSound\":\"" + sound.e() + "\",\"breakSound\":\"" + sound.a() + "\",\"placeSound\":\"" + sound.b() + "\",\"volume\":" + sound.c() + ",\"pitch\":" + sound.d() + "}");
    // Collision and selection boxes per metadata, at the origin cell.
    column = true;
    for (int meta = 2; meta <= 5; meta++) {
      ladderMeta = meta;
      System.out.println("{\"case\":\"bounds\",\"meta\":" + meta + ",\"collision\":" + box(l.a(w, 0, 0, 0)) + ",\"selection\":" + box(l.g(w, 0, 0, 0)) + "}");
    }
    // canPlaceBlockAt and onBlockPlaced for every neighbour layout and clicked side.
    column = false;
    for (mask = 0; mask < 16; mask++) {
      StringBuilder metas = new StringBuilder();
      for (int side = 0; side < 6; side++) metas.append(side > 0 ? "," : "").append(l.a(w, 8, 4, 8, side, 0.5f, 0.5f, 0.5f, 0));
      System.out.println("{\"case\":\"place\",\"mask\":" + mask + ",\"canPlace\":" + l.c(w, 8, 4, 8) + ",\"meta\":[" + metas + "]}");
    }
    // onNeighborBlockChange: support for each attached face. isRemote skips the item drop.
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, true);
    for (mask = 0; mask < 16; mask++)
      for (int meta = 2; meta <= 5; meta++) {
        ladderMeta = meta; removed = 0;
        l.a(w, 8, 4, 8, aji.e(0));
        System.out.println("{\"case\":\"support\",\"mask\":" + mask + ",\"meta\":" + meta + ",\"removed\":" + (removed > 0) + "}");
      }
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    column = true; ladderMeta = 3;
    // Movement in the ladder column: Java yaw 180 faces -z (the wall behind the ladder).
    Object[][] runs = {
      // name, entity, x, y, z, yaw, sneak, forward, ticks, vx, vy, vz, fall
      {"climb", "player", 0.5, 0.0, 0.5, 180f, false, 0.98f, 70, 0, 0, 0, 0},
      {"climb", "zombie", 0.5, 0.0, 0.5, 180f, false, 0.98f, 70, 0, 0, 0, 0},
      {"slide", "player", 0.5, 4.0, 0.5, 180f, false, 0f, 40, 0, 0, 0, 0},
      {"slide", "zombie", 0.5, 4.0, 0.5, 180f, false, 0f, 40, 0, 0, 0, 0},
      {"sneak", "player", 0.5, 3.0, 0.5, 180f, true, 0f, 20, 0, 0, 0, 0},
      {"sneak-climb", "player", 0.5, 1.0, 0.5, 180f, true, 0.294f, 40, 0, 0, 0, 0},
      {"fall", "player", 0.5, 5.5, 0.5, 0f, false, 0f, 40, 0, -1.2, 0, 9.0},
      {"fall", "zombie", 0.5, 5.5, 0.5, 0f, false, 0f, 40, 0, -1.2, 0, 9.0},
      {"fling", "player", 0.5, 2.0, 0.5, 90f, false, 0f, 20, 0.6, 0.3, 0.5, 0},
      {"walk-off", "player", 0.5, 0.0, 0.5, 0f, false, 0.98f, 30, 0, 0, 0, 0},
    };
    for (Object[] r : runs) {
      boolean isPlayer = r[1].equals("player");
      double x = (Double) r[2], y = (Double) r[3], z = (Double) r[4];
      sv e = isPlayer ? player(u, w, x, y, z, (Float) r[5], (Boolean) r[6]) : MobMoveProbe.spawn(u, w, "zombie", x, y, z, (Float) r[5]);
      if (!isPlayer) MobMoveProbe.set(e, "D", y == 0);
      MobMoveProbe.set(e, "v", ((Number) r[9]).doubleValue());
      MobMoveProbe.set(e, "w", ((Number) r[10]).doubleValue());
      MobMoveProbe.set(e, "x", ((Number) r[11]).doubleValue());
      MobMoveProbe.set(e, "R", ((Number) r[12]).floatValue());
      float speed = isPlayer ? 0.1f : (float) ((ti) e.a(yj.d)).e();
      sounds.clear();
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < (Integer) r[8]; i++) {
        tick(e, speed, (Float) r[7], false);
        if (i > 0) out.append(",");
        out.append(state(e));
      }
      System.out.println("{\"case\":\"move\",\"name\":\"" + r[0] + "\",\"type\":\"" + r[1] + "\",\"start\":[" + x + "," + y + "," + z + "],\"yaw\":" + r[5] + ",\"sneak\":" + r[6]
        + ",\"forward\":" + r[7] + ",\"speed\":" + speed + ",\"motion\":[" + r[9] + "," + r[10] + "," + r[11] + "],\"fall\":" + r[12] + ",\"soundNames\":\"" + String.join(";", sounds) + "\",\"ticks\":[" + out + "]}");
    }
  }
}
