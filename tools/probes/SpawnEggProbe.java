import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Spawn egg (ItemMonsterPlacer aee, item 383), Bottle o' Enchanting (ItemExpBottle acp, item 384 / EntityExpBottle zn) and fire charge
// (ItemFireball acq, item 385) of Minecraft Java 1.7.10, driven through the unchanged original classes on the MobMoveProbe world
// double (stone below y 0, extended here with a cell map, spawnEntityInWorld/aux/sound/setBlock recording).
// Output is one JSON object per line; tools/verify-spawn-eggs.mjs collects them into public/research/spawn-eggs-reference.json.
// Cases: eggs (EntityList.entityEggs + ItemMonsterPlacer colours and names), use (onItemUse placement), water (onItemRightClick),
// expThrow (ItemExpBottle right-click, EntityExpBottle constants and launch replay), expImpact (EntityExpBottle.onImpact),
// fire (ItemFireball.onItemUse).
public class SpawnEggProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String n(double v) { return Double.toString(v); }
  static String n(float v) { return Float.toString(v); }

  static class W extends MobMoveProbe.ProbeWorld {
    Map<String, int[]> cells = new HashMap<>();
    List<String> events = new ArrayList<>();
    List<sa> spawned = new ArrayList<>();
    static String key(int x, int y, int z) { return x + "," + y + "," + z; }
    int[] cell(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return c != null ? c : new int[] {y < 0 ? 1 : 0, 0}; }
    void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
    public aji a(int x, int y, int z) { return aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return cell(x, y, z)[1]; }
    public boolean d(sa entity) { spawned.add(entity); events.add("spawn|" + entity.getClass().getName()); return true; }
    public void c(int id, int x, int y, int z, int data) { events.add("aux|" + id + "|" + x + "," + y + "," + z + "|" + data); }
    public void a(double x, double y, double z, String sound, float volume, float pitch) {
      events.add("sound|" + sound + "|" + x + "," + y + "," + z + "|" + volume + "|" + pitch);
    }
    public boolean b(int x, int y, int z, aji block) {
      events.add("setBlock|" + x + "," + y + "," + z + "|" + aji.b(block)); put(x, y, z, aji.b(block), 0); return true;
    }
    public boolean a(yz player, int x, int y, int z) { return true; } // canMineBlock (server side spawn protection absent)
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static class P extends yz {
    P() { super(null, null); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public r f_() { return null; }
    public boolean a(int level, String command) { return false; }
    public void a(fj message) {}
  }

  static sun.misc.Unsafe u;
  static W world(long seed, boolean remote) throws Exception {
    W w = (W) u.allocateInstance(W.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(seed));
    MobMoveProbe.set(w, "C", new qi());
    w.E = remote;
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new HashMap<>(); w.events = new ArrayList<>(); w.spawned = new ArrayList<>();
    return w;
  }
  static P player(W w, boolean creative, double x, double y, double z, float yaw, float pitch) throws Exception {
    P p = (P) u.allocateInstance(P.class);
    MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(5)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "bE", new yw()); p.bE.d = creative;
    MobMoveProbe.set(p, "s", x); MobMoveProbe.set(p, "t", y); MobMoveProbe.set(p, "u", z);
    MobMoveProbe.set(p, "p", x); MobMoveProbe.set(p, "q", y); MobMoveProbe.set(p, "r", z);
    MobMoveProbe.set(p, "y", yaw); MobMoveProbe.set(p, "z", pitch);
    MobMoveProbe.set(p, "A", yaw); MobMoveProbe.set(p, "B", pitch); // prevRotationYaw/Pitch
    MobMoveProbe.set(p, "L", 1.62F); // yOffset
    return p;
  }
  static String events(W w) {
    StringBuilder b = new StringBuilder("[");
    for (String s : w.events) { if (b.length() > 1) b.append(','); b.append(q(s)); }
    return b.append(']').toString();
  }
  static String entityJson(sa e) throws Exception {
    StringBuilder b = new StringBuilder("{\"class\":" + q(e.getClass().getName()) + ",\"x\":" + n(e.s) + ",\"y\":" + n(e.t) + ",\"z\":" + n(e.u) + ",\"yaw\":" + n(e.y) + ",\"pitch\":" + n(e.z));
    if (e instanceof sw) {
      sw l = (sw) e;
      b.append(",\"rotationYawHead\":").append(n(MobMoveProbe.fl(l, "aO"))).append(",\"renderYawOffset\":").append(n(MobMoveProbe.fl(l, "aM")));
      b.append(",\"customName\":").append(q(l.bG()));
    }
    return b.append("}").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    adb egg = adb.d(383), bottle = adb.d(384), charge = adb.d(385);
    System.out.println("{\"case\":\"items\",\"egg\":{\"class\":\"" + egg.getClass().getName() + "\",\"maxStack\":" + MobMoveProbe.field(adb.class, "h").getInt(egg) + ",\"multiplePasses\":" + egg.b() + ",\"unlocalized\":" + q(egg.a()) + "},\"bottle\":{\"class\":\""
      + bottle.getClass().getName() + "\",\"maxStack\":" + MobMoveProbe.field(adb.class, "h").getInt(bottle) + ",\"hasEffect\":" + bottle.e(new add(bottle, 1, 0)) + ",\"unlocalized\":" + q(bottle.a()) + "},\"charge\":{\"class\":\"" + charge.getClass().getName() + "\",\"maxStack\":"
      + MobMoveProbe.field(adb.class, "h").getInt(charge) + ",\"unlocalized\":" + q(charge.a()) + "}}");

    // eggs: every EntityList.entityEggs entry in id order, with the entity class name, both pass colours and the display name.
    W w0 = world(1, false);
    TreeMap<Integer, sh> eggs = new TreeMap<>();
    for (Object o : sg.a.values()) { sh e = (sh) o; eggs.put(e.a, e); }
    int eggCount = 0;
    for (sh e : eggs.values()) {
      add stack = new add(egg, 1, e.a);
      String cls;
      try { cls = sg.a(e.a).getName(); } catch (Throwable t) { cls = "?"; }
      System.out.println("{\"case\":\"egg\",\"id\":" + e.a + ",\"entity\":" + q(sg.b(e.a)) + ",\"class\":" + q(cls) + ",\"primary\":" + e.b + ",\"secondary\":" + e.c + ",\"pass0\":" + egg.a(stack, 0) + ",\"pass1\":" + egg.a(stack, 1) + ",\"name\":" + q(stack.s()) + "}");
      eggCount++;
    }
    // A damage value without an egg: colour is white (16777215) and the name still reads EntityList.getStringFromID.
    for (int d : new int[] {0, 1, 53, 63, 101}) {
      add stack = new add(egg, 1, d);
      System.out.println("{\"case\":\"noEgg\",\"damage\":" + d + ",\"entity\":" + q(sg.b(d)) + ",\"pass0\":" + egg.a(stack, 0) + ",\"pass1\":" + egg.a(stack, 1) + ",\"name\":" + q(stack.s()) + "}");
    }

    // use: ItemMonsterPlacer.onItemUse (aee.a(add, yz, ahb, x, y, z, side, fx, fy, fz)) on a stone block at (5, 0, 5) (a fence at (9, 0, 9)).
    int[] used = {90, 50, 54, 91, 92, 93, 120, 62, 98};
    for (int d : used) {
      for (int mode = 0; mode < 3; mode++) {
        boolean creative = mode == 1, remote = mode == 2;
        for (int side = 0; side < 6; side++) {
          for (int fence = 0; fence < 2; fence++) {
            if (fence == 1 && (side != 1 && side != 0)) continue;
            W w = world(100 + d * 7 + side, remote);
            int tx = fence == 1 ? 9 : 5, tz = fence == 1 ? 9 : 5;
            w.put(tx, 0, tz, fence == 1 ? 85 : 1, 0);
            P p = player(w, creative, 5.5, 1.0, 2.5, 0F, 0F);
            add stack = new add(egg, 3, d);
            String err = null; boolean r = false;
            try { r = egg.a(stack, p, w, tx, 0, tz, side, 0.5F, 0.5F, 0.5F); } catch (Throwable t) { err = t.toString(); }
            StringBuilder b = new StringBuilder("{\"case\":\"use\",\"damage\":" + d + ",\"side\":" + side + ",\"fence\":" + (fence == 1) + ",\"creative\":" + creative + ",\"remote\":" + remote + ",\"returned\":" + r + ",\"count\":" + stack.b + ",\"spawned\":[");
            for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) b.append(','); b.append(entityJson(w.spawned.get(i))); }
            b.append("],\"error\":").append(q(err)).append(",\"events\":").append(events(w)).append("}");
            System.out.println(b);
          }
        }
      }
    }
    // Every egg once on top of the stone block: the spawn height, whether the class constructs on the double, and the rolled yaw.
    for (sh e : eggs.values()) {
      W w = world(300 + e.a, false);
      w.put(5, 0, 5, 1, 0);
      P p = player(w, false, 5.5, 1.0, 2.5, 0F, 0F);
      add stack = new add(egg, 1, e.a);
      String err = null; boolean r = false;
      try { r = egg.a(stack, p, w, 5, 0, 5, 1, 0.5F, 0.5F, 0.5F); } catch (Throwable t) { err = t.toString(); }
      System.out.println("{\"case\":\"useEach\",\"damage\":" + e.a + ",\"returned\":" + r + ",\"count\":" + stack.b + ",\"spawned\":" + (w.spawned.isEmpty() ? "null" : entityJson(w.spawned.get(0))) + ",\"error\":" + q(err) + "}");
    }
    // A named egg gives the mob a custom name (setCustomNameTag) and a plain egg none.
    for (int named = 0; named < 2; named++) {
      W w = world(400, false); w.put(5, 0, 5, 1, 0);
      P p = player(w, false, 5.5, 1.0, 2.5, 0F, 0F);
      add stack = new add(egg, 1, 90);
      if (named == 1) stack.c("Bob");
      egg.a(stack, p, w, 5, 0, 5, 1, 0.5F, 0.5F, 0.5F);
      System.out.println("{\"case\":\"named\",\"named\":" + (named == 1) + ",\"spawned\":" + entityJson(w.spawned.get(0)) + "}");
    }

    // water: ItemMonsterPlacer.onItemRightClick (aee.a(add, ahb, yz)) aiming down at a water source at (3, -1, 3) and at air.
    for (int mode = 0; mode < 3; mode++) {
      boolean creative = mode == 1;
      for (int target = 0; target < 3; target++) {
        W w = world(500 + target, false);
        // target 0: still water source (9) under the player's aim, 1: stone block (no spawn), 2: nothing in reach.
        if (target == 0) { w.put(3, -1, 3, 9, 0); w.put(3, 0, 3, 0, 0); }
        P p = player(w, creative, 3.5, 1.0, 3.5, 0F, 90F);
        if (target == 2) { MobMoveProbe.set(p, "z", -90F); MobMoveProbe.set(p, "B", -90F); }
        if (target == 1) w.put(3, -1, 3, 1, 0);
        add stack = new add(egg, 2, 90);
        String err = null; add ret = null;
        try { ret = egg.a(stack, w, p); } catch (Throwable t) { err = t.toString(); StackTraceElement[] st = t.getStackTrace(); if (st.length > 0) err += "@" + st[0]; }
        System.out.println("{\"case\":\"water\",\"target\":" + target + ",\"creative\":" + creative + ",\"sameStack\":" + (ret == stack) + ",\"count\":" + stack.b + ",\"spawned\":" + (w.spawned.isEmpty() ? "null" : entityJson(w.spawned.get(0))) + ",\"error\":" + q(err) + ",\"events\":" + events(w) + "}");
      }
    }

    // expThrow: ItemExpBottle.onItemRightClick, the entity's constants and the launch (EntityThrowable(world, thrower) replayed with
    // a seeded Entity.rand: the same real calls as the constructor, since the constructor's own rand is unseeded).
    Method e0 = MobMoveProbe.method(zk.class, "e"), f0 = MobMoveProbe.method(zk.class, "f"), i0 = MobMoveProbe.method(zn.class, "i");
    zn probeBottle = new zn(null, 0, 0, 0);
    System.out.println("{\"case\":\"expConstants\",\"velocity\":" + n((Float) e0.invoke(probeBottle)) + ",\"pitchOffset\":" + n((Float) f0.invoke(probeBottle)) + ",\"gravity\":" + n((Float) i0.invoke(probeBottle))
      + ",\"width\":" + n(MobMoveProbe.fl(probeBottle, "M")) + ",\"height\":" + n(MobMoveProbe.fl(probeBottle, "N")) + "}");
    for (int mode = 0; mode < 3; mode++) {
      boolean creative = mode == 1, remote = mode == 2;
      W w = world(600, remote);
      P p = player(w, creative, 2.0, 64.0, -3.0, 25F, -10F);
      add stack = new add(bottle, 2, 0);
      Field g = adb.class.getDeclaredField("g"); g.setAccessible(true); g.set(null, new Random(71));
      String err = null; add ret = null;
      try { ret = bottle.a(stack, w, p); } catch (Throwable t) { err = t.toString(); }
      StringBuilder b = new StringBuilder("{\"case\":\"expThrow\",\"creative\":" + creative + ",\"remote\":" + remote + ",\"sameStack\":" + (ret == stack) + ",\"count\":" + stack.b + ",\"spawned\":[");
      for (int i = 0; i < w.spawned.size(); i++) {
        sa e = w.spawned.get(i);
        if (i > 0) b.append(',');
        b.append("{\"class\":" + q(e.getClass().getName()) + ",\"x\":" + n(e.s) + ",\"y\":" + n(e.t) + ",\"z\":" + n(e.u) + ",\"yaw\":" + n(e.y) + ",\"pitch\":" + n(e.z) + ",\"speed\":" + n(Math.sqrt(e.v * e.v + e.w * e.w + e.x * e.x)) + "}");
      }
      b.append("],\"error\":").append(q(err)).append(",\"events\":").append(events(w)).append("}");
      System.out.println(b);
    }
    // Launch replay: the real EntityThrowable(world, thrower) statements with the same method calls and a seeded rand.
    double[][] views = {{2.0, 64.0, -3.0, 25, -10}, {0, 0, 0, 0, 0}, {10.5, 70.25, -4.75, 180, 45}, {-3.5, 12.0, 8.0, -90, -60}, {1.0, 5.0, 1.0, 315.5, 80.5}, {0, 0, 0, 90, 30}};
    int viewIndex = 0;
    for (double[] v : views) {
      for (long seed = 1; seed <= 3; seed++) {
        zn z = new zn(null, 0, 0, 0);
        z.Z = new Random(seed * 1000 + viewIndex);
        float yaw = (float) v[3], pitch = (float) v[4];
        z.b(v[0], v[1] + 1.62F, v[2], yaw, pitch);
        z.s -= qh.b(z.y / 180.0F * 3.1415927F) * 0.16F;
        z.t -= 0.10000000149011612;
        z.u -= qh.a(z.y / 180.0F * 3.1415927F) * 0.16F;
        z.b(z.s, z.t, z.u);
        MobMoveProbe.set(z, "L", 0.0F);
        float k = 0.4F;
        z.v = -qh.a(z.y / 180.0F * 3.1415927F) * qh.b(z.z / 180.0F * 3.1415927F) * k;
        z.x = qh.b(z.y / 180.0F * 3.1415927F) * qh.b(z.z / 180.0F * 3.1415927F) * k;
        z.w = -qh.a((z.z + (Float) f0.invoke(z)) / 180.0F * 3.1415927F) * k;
        z.c(z.v, z.w, z.x, (Float) e0.invoke(z), 1.0F);
        System.out.println("{\"case\":\"expLaunch\",\"view\":" + viewIndex + ",\"seed\":" + (seed * 1000 + viewIndex) + ",\"feet\":[" + v[0] + "," + v[1] + "," + v[2] + "],\"yaw\":" + yaw + ",\"pitch\":" + pitch
          + ",\"x\":" + n(z.s) + ",\"y\":" + n(z.t) + ",\"z\":" + n(z.u) + ",\"mx\":" + n(z.v) + ",\"my\":" + n(z.w) + ",\"mz\":" + n(z.x) + ",\"rotYaw\":" + n(z.y) + ",\"rotPitch\":" + n(z.z) + "}");
      }
      viewIndex++;
    }
    // Flight: 30 ticks of the original EntityThrowable motion for one launch is covered by tools/verify-... via projectiles.js
    // (ticks use the shared EntityThrowable.onUpdate already replayed for snowballs and potions); only gravity 0.07 differs.

    // expImpact: EntityExpBottle.onImpact (zn.a(azu)) in a server world: aux 2002 at the rounded position, then orbs of
    // 3 + nextInt(5) + nextInt(5) points split by EntityXPOrb.getXPSplit. 400 seeded impacts at fractional positions.
    Method onImpact = MobMoveProbe.method(zn.class, "a", azu.class);
    for (int i = 0; i < 400; i++) {
      double x = -7.49 + i * 0.037, y = 63.51 + (i % 7) * 0.5, z = 100.5 - i * 0.021;
      W w = world(7000 + i, false);
      zn z0 = new zn(w, x, y, z);
      onImpact.invoke(z0, new Object[] {null});
      StringBuilder b = new StringBuilder("{\"case\":\"expImpact\",\"seed\":" + (7000 + i) + ",\"pos\":[" + n(x) + "," + n(y) + "," + n(z) + "],\"aux\":");
      b.append(events(w)).append(",\"orbs\":[");
      for (int j = 0; j < w.spawned.size(); j++) { if (j > 0) b.append(','); b.append(((sq) w.spawned.get(j)).e()); }
      b.append("],\"dead\":").append(MobMoveProbe.b(z0, "K")).append("}");
      System.out.println(b);
    }
    {
      W w = world(7, true);
      zn z0 = new zn(w, 1, 2, 3);
      onImpact.invoke(z0, new Object[] {null});
      System.out.println("{\"case\":\"expImpactRemote\",\"events\":" + events(w) + ",\"dead\":" + MobMoveProbe.b(z0, "K") + "}");
    }
    int[] splits = {1, 2, 3, 6, 7, 8, 16, 17, 20, 36, 37, 72, 73, 148, 149, 306, 307, 616, 617, 1236, 1237, 2476, 2477, 5000};
    StringBuilder sp = new StringBuilder();
    for (int s : splits) { if (sp.length() > 0) sp.append(','); sp.append("[").append(s).append(",").append(sq.a(s)).append("]"); }
    System.out.println("{\"case\":\"xpSplit\",\"pairs\":[" + sp + "]}");

    // fire: ItemFireball.onItemUse (acq.a(add, yz, ahb, x, y, z, side, fx, fy, fz)) on a stone block at (5, 0, 5), air or a block in
    // the cell the face points at, survival and creative, client and server.
    for (int mode = 0; mode < 3; mode++) {
      boolean creative = mode == 1, remote = mode == 2;
      for (int side = 0; side < 6; side++) {
        for (int blocked = 0; blocked < 2; blocked++) {
          W w = world(800 + side, remote);
          w.put(5, 0, 5, 1, 0);
          int[] off = {0, 0, 0};
          int[][] d = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
          if (blocked == 1) w.put(5 + d[side][0], 0 + d[side][1], 5 + d[side][2], 4, 0);
          P p = player(w, creative, 5.5, 3.0, 2.5, 0F, 0F);
          add stack = new add(charge, 3, 0);
          Field g = adb.class.getDeclaredField("g"); g.setAccessible(true); g.set(null, new Random(900 + side));
          String err = null; boolean r = false;
          try { r = charge.a(stack, p, w, 5, 0, 5, side, 0.5F, 0.5F, 0.5F); } catch (Throwable t) { err = t.toString(); }
          System.out.println("{\"case\":\"fire\",\"side\":" + side + ",\"blockedTarget\":" + (blocked == 1) + ",\"creative\":" + creative + ",\"remote\":" + remote + ",\"returned\":" + r + ",\"count\":" + stack.b + ",\"error\":" + q(err) + ",\"events\":" + events(w) + "}");
        }
      }
    }
  }
}
