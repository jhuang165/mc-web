// Runs the unchanged original BlockPistonBase (app, normal 33 / sticky 29), BlockPistonExtension (apq,
// id 34), BlockPistonMoving (apr, id 36) and TileEntityPiston (aps) together with the redstone blocks the
// REDSTONE-04 scenarios use (wire, torch, lever, buttons, lamp, redstone block, repeater, pressure plates)
// inside a real World (ahb) whose chunk provider hands out real Chunk (apx) objects. The World subclass is
// allocated without its constructor and keeps the native World.setBlock, setBlockMetadataWithNotify,
// notifyBlocksOfNeighborChange, power queries, setTileEntity / getTileEntity / removeTileEntity and the
// native updateEntities (tile-entity update loop, TileEntityPiston.updateEntity). Only these are replaced:
//   - scheduleBlockUpdate / WithPriority / func_147446_b / isBlockTickScheduledThisTick and
//     WorldServer.addBlockEvent / sendQueuedBlockEvents (copies of the WorldServer code: the double-buffered
//     ServerBlockEventList pair with BlockEventData de-duplication, delivered through the native
//     Block.onBlockEventReceived);
//   - getTotalWorldTime, getGameRules, playSoundEffect (recorded), spawnParticle (dropped),
//     spawnEntityInWorld (EntityItem recorded), getEntitiesWithinAABB / ...ExcludingEntity (a scripted list;
//     the piston scenarios keep it empty, so entity pushing by TileEntityPiston.func_145863_a is not exercised);
//   - lighting updates (func_147451_t / updateLightByType return false).
// Per server tick (MinecraftServer.updateTimeLightAndEntities): events of the tick, world time + 1,
// tickUpdates, sendQueuedBlockEvents (end of WorldServer.tick), then World.updateEntities (tile entities).
// Scenarios arrive on stdin (see tools/verify-pistons.mjs); one JSON line per scenario goes to stdout.
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class PistonProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String n) throws Exception { for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} throw new NoSuchFieldException(n); }
  static class Provider extends aqo { public String l() { return "probe"; } }
  static class Chunks implements apu {
    final ahb world; final Map<Long, apx> map = new HashMap<>();
    Chunks(ahb w) { world = w; }
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) { return map.computeIfAbsent(((long) x << 32) ^ (z & 0xffffffffL), k -> { apx c = new apx(world, x, z); c.c(); return c; }); } // c() = Chunk.onChunkLoad: isChunkLoaded = true }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) {}
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return true; }
    public String f() { return "probe"; }
    public List a(sx s, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return map.size(); }
    public void e(int x, int z) {}
    public void c() {}
  }
  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    long time; agy rules; StringBuilder log; int calls; long tick; int sky = 15; float angle;
    List<String> sounds, drops;
    List<Object[]> ents; // {entity, double[6] box}
    Set<ahs> M; TreeSet<ahs> N; List<ahs> V;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    void add(String s) { if (log.length() > 0) log.append(' '); log.append(s); calls++; }
    public long I() { return time; }
    public int b(ahn type, int x, int y, int z) { return sky; }
    public float d(float partial) { return angle; }
    public agy O() { return rules; }
    public boolean t(int x, int y, int z) { return false; }
    public boolean c(ahn type, int x, int y, int z) { return false; }
    public void a(double x, double y, double z, String name, float volume, float pitch) {
      sounds.add("[" + tick + "," + x + "," + y + "," + z + ",\"" + name + "\"," + volume + "," + pitch + "]");
      add("p," + name);
    }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    // World.getEntitiesWithinAABB(Class, AABB) and getEntitiesWithinAABBExcludingEntity(null, AABB)
    // over the scripted entities, with AxisAlignedBB.intersectsWith semantics.
    List scripted(Class c, azt box) {
      List r = new ArrayList();
      for (Object[] e : ents) {
        double[] b = (double[]) e[1];
        if ((c == null || c.isInstance(e[0])) && b[3] > box.a && b[0] < box.d && b[4] > box.b && b[1] < box.e && b[5] > box.c && b[2] < box.f) r.add(e[0]);
      }
      return r;
    }
    public List a(Class c, azt box) { return scripted(c, box); }
    public List b(sa e, azt box) { return scripted(null, box); }
    public boolean d(sa e) {
      xk item = (xk) e; add stack = item.f();
      drops.add("[" + tick + "," + e.s + "," + e.t + "," + e.u + "," + adb.b(stack.b()) + "," + stack.b + "," + stack.k() + "]");
      add("e," + adb.b(stack.b()));
      return true;
    }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      add("s," + x + "," + y + "," + z + "," + aji.b(b) + "," + meta + "," + flags);
      return super.d(x, y, z, b, meta, flags);
    }
    public boolean a(int x, int y, int z, int meta, int flags) {
      add("m," + x + "," + y + "," + z + "," + meta + "," + flags);
      return super.a(x, y, z, meta, flags);
    }
    public void e(int x, int y, int z, aji src) {
      add("n," + x + "," + y + "," + z + "," + aji.b(src));
      super.e(x, y, z, src);
    }
    // WorldServer.addBlockEvent: de-duplicate against the list currently being filled, then append.
    List<ags>[] bev; int bevIdx;
    public void c(int x, int y, int z, aji b, int ev, int param) {
      add("b," + x + "," + y + "," + z + "," + aji.b(b) + "," + ev + "," + param);
      ags d = new ags(x, y, z, b, ev, param);
      for (ags o : bev[bevIdx]) if (o.equals(d)) return;
      bev[bevIdx].add(d);
    }
    // WorldServer.sendQueuedBlockEvents / func_147485_a (the packet broadcast is dropped).
    void sendQueuedBlockEvents() {
      while (!bev[bevIdx].isEmpty()) {
        int i = bevIdx; bevIdx ^= 1;
        for (ags d : bev[i]) {
          aji b = a(d.a(), d.b(), d.c());
          if (b == d.f()) {
            add("v," + d.a() + "," + d.b() + "," + d.c() + "," + aji.b(b) + "," + d.d() + "," + d.e());
            boolean r = b.a((ahb) this, d.a(), d.b(), d.c(), d.d(), d.e());
            add("r," + (r ? 1 : 0));
          }
        }
        bev[i].clear();
      }
    }
    // Tile entity bookkeeping calls, logged and then run natively.
    public void a(int x, int y, int z, aor te) { add("k," + x + "," + y + "," + z); super.a(x, y, z, te); }
    public void p(int x, int y, int z) { add("K," + x + "," + y + "," + z); super.p(x, y, z); }
    // WorldServer.func_147477_a.
    public boolean a(int x, int y, int z, aji b) { return V.contains(new ahs(x, y, z, b)); }
    // WorldServer.scheduleBlockUpdate -> scheduleBlockUpdateWithPriority(.., 0).
    public void a(int x, int y, int z, aji b, int delay) { a(x, y, z, b, delay, 0); }
    // WorldServer.scheduleBlockUpdateWithPriority with scheduledUpdatesAreImmediate false;
    // checkChunksExist is always true here.
    public void a(int x, int y, int z, aji b, int delay, int priority) {
      add("t," + x + "," + y + "," + z + "," + aji.b(b) + "," + delay + "," + priority);
      ahs e = new ahs(x, y, z, b);
      if (b.o() != awt.a) { e.a((long) delay + time); e.a(priority); }
      if (!M.contains(e)) { M.add(e); N.add(e); }
    }
    public void b(int x, int y, int z, aji b, int delay, int priority) {
      ahs e = new ahs(x, y, z, b); e.a(priority);
      if (b.o() != awt.a) e.a((long) delay + time);
      if (!M.contains(e)) { M.add(e); N.add(e); }
    }
    // WorldServer.tickUpdates(false), after the total world time has advanced.
    void tickUpdates() {
      int n = N.size();
      if (n != M.size()) throw new IllegalStateException("TickNextTick list out of synch");
      if (n > 1000) n = 1000;
      for (int i = 0; i < n; i++) {
        ahs e = N.first();
        if (e.d > time) break;
        N.remove(e); M.remove(e); V.add(e);
      }
      for (Iterator<ahs> it = V.iterator(); it.hasNext(); ) {
        ahs e = it.next(); it.remove();
        aji b = a(e.a, e.b, e.c);
        if (b.o() == awt.a || !aji.a(b, e.a())) continue;
        add("u," + e.a + "," + e.b + "," + e.c + "," + aji.b(b));
        b.a((ahb) this, e.a, e.b, e.c, s);
      }
      V.clear();
    }
    // Raw section write used only for the initial terrain (no callbacks).
    void raw(int x, int y, int z, aji b, int meta) {
      apx c = e(x >> 4, z >> 4); apz[] st = c.i();
      if (st[y >> 4] == null) st[y >> 4] = new apz(y >> 4 << 4, !t.g);
      st[y >> 4].a(x & 15, y & 15, z & 15, b); st[y >> 4].a(x & 15, y & 15, z & 15, meta);
    }
  }
  static W world(long seed) throws Exception { return world(seed, 15, 0, 0f, false); }
  static W world(long seed, int sky, int subtraction, float angle, boolean noSky) throws Exception {
    W w = (W) unsafe.allocateInstance(W.class);
    Provider provider = new Provider(); provider.g = noSky;
    field(ahb.class, "t").set(w, provider);
    field(ahb.class, "j").setInt(w, subtraction);
    field(ahb.class, "s").set(w, new Random(seed));
    field(ahb.class, "u").set(w, new ArrayList());
    field(ahb.class, "C").set(w, new qi());
    field(ahb.class, "v").set(w, new Chunks(w));
    field(ahb.class, "a").set(w, new ArrayList());  // addedTileEntityList
    field(ahb.class, "g").set(w, new ArrayList());  // loadedTileEntityList
    for (String n : new String[] {"b", "e", "f", "h", "i"}) field(ahb.class, n).set(w, new ArrayList());  // tileEntitiesToUnload, loadedEntityList, unloadedEntityList, playerEntities, weatherEffects
    w.sky = sky; w.angle = angle;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    w.bev = new List[] {new ArrayList<ags>(), new ArrayList<ags>()};
    return w;
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    // The wire's blocksNeedingUpdate set lives on the single Blocks.redstone_wire instance.
    Field wireSet = field(ana.class, "b");
    // Native block properties: material opaque, renderAsNormalBlock, canProvidePower,
    // isNormalCube, and doesBlockHaveSolidTopSurface for metadata 0..15 (bitmask), plus the piston rules:
    // getBlockHardness == -1, getMobilityFlag, ITileEntityProvider, material air.
    StringBuilder props = new StringBuilder(), pprops = new StringBuilder();
    W probe = world(0);
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id); if (b == null || (id != 0 && b == ajn.a)) continue;
      int top = 0;
      for (int m = 0; m < 16; m++) { probe.raw(0, 1, 0, b, m); if (ahb.a(probe, 0, 1, 0)) top |= 1 << m; }
      props.append(props.length() > 0 ? "," : "").append("[").append(id).append(",").append(b.o().k() ? 1 : 0).append(",").append(b.d() ? 1 : 0).append(",").append(b.f() ? 1 : 0).append(",").append(b.r() ? 1 : 0).append(",").append(top).append("]");
      probe.raw(0, 1, 0, b, 0);
      pprops.append(pprops.length() > 0 ? "," : "").append("[").append(id).append(",").append(b.f(probe, 0, 1, 0) == -1.0f ? 1 : 0).append(",").append(b.h()).append(",").append(b instanceof akw ? 1 : 0).append(",").append(b.o() == awt.a ? 1 : 0).append("]");
    }
    // Blocks fields the ported rules compare against.
    String[] names = {"af", "aN", "aR", "aS", "aJ", "bk", "w", "bK", "az", "aA", "bu", "bv", "Z", "J", "F", "K", "M"};
    StringBuilder ids = new StringBuilder();
    for (String n : names) ids.append(ids.length() > 0 ? "," : "").append(q(n)).append(":").append(aji.b((aji) ajn.class.getField(n).get(null)));
    StringBuilder cls = new StringBuilder();
    for (int id : new int[] {29, 33, 34, 36, 70, 72, 93, 94}) cls.append(cls.length() > 0 ? "," : "").append(q(String.valueOf(id))).append(":").append(q(aji.e(id).getClass().getName()));
    System.out.println("{\"kind\":\"blocks\",\"props\":[" + props + "],\"pistonProps\":[" + pprops + "],\"fields\":{" + ids + "},\"items\":{\"redstone\":" + adb.b(ade.ax) + ",\"repeater\":" + adb.b(ade.aW) + "},\"classes\":{" + cls + "}}");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1];
      int ox = Integer.parseInt(h[2]), oy = Integer.parseInt(h[3]), oz = Integer.parseInt(h[4]);
      int dx = Integer.parseInt(h[5]), dy = Integer.parseInt(h[6]), dz = Integer.parseInt(h[7]), ticks = Integer.parseInt(h[8]);
      long seed = Long.parseLong(h[9]);
      int sky = h.length > 10 ? Integer.parseInt(h[10]) : 15, subtraction = h.length > 11 ? Integer.parseInt(h[11]) : 0;
      float angle = h.length > 12 ? Float.parseFloat(h[12]) : 0f;
      boolean noSky = h.length > 13 && Integer.parseInt(h[13]) != 0;
      W w = world(seed, sky, subtraction, angle, noSky);
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      int[][] prev = snapshot(w, ox, oy, oz, dx, dy, dz);
      int[] prevSig = signals(w, ox, oy, oz, dx, dy, dz);
      StringBuilder frames = new StringBuilder(), logs = new StringBuilder(), tiles = new StringBuilder(), tes = new StringBuilder();
      for (int t = 1; t <= ticks; t++) {
        w.tick = t; w.log.setLength(0);
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          int x = ox + Integer.parseInt(e[3]), y = oy + Integer.parseInt(e[4]), z = oz + Integer.parseInt(e[5]);
          w.add("E," + e[2]);
          switch (e[2]) {
            case "place": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            case "air": w.f(x, y, z); break;
            case "use": w.a(x, y, z).a((ahb) w, x, y, z, (yz) null, 0, 0f, 0f, 0f); break;
            // ItemReed.onItemUse for a diode: setBlock(block, 0, 3) then Block.onBlockPlacedBy(placer facing yaw).
            case "placeby": {
              aji b = aji.e(Integer.parseInt(e[6]));
              sv placer = (sv) unsafe.allocateInstance(yq.class);
              field(sa.class, "y").setFloat(placer, Float.parseFloat(e[7]));
              if (w.d(x, y, z, b, 0, 3) && w.a(x, y, z) == b) b.a((ahb) w, x, y, z, placer, (add) null);
              break;
            }
            // ItemBlock.placeBlockAt for a piston: setBlock(block, 0, 3) then Block.onBlockPlacedBy with a placer
            // standing at (px, py, pz) (posY is the feet; yOffset 1.62) looking along yaw.
            case "placepiston": {
              aji b = aji.e(Integer.parseInt(e[6]));
              sv placer = (sv) unsafe.allocateInstance(yq.class);
              field(sa.class, "s").setDouble(placer, ox + Double.parseDouble(e[7]));
              field(sa.class, "t").setDouble(placer, oy + Double.parseDouble(e[8]));
              field(sa.class, "u").setDouble(placer, oz + Double.parseDouble(e[9]));
              field(sa.class, "y").setFloat(placer, Float.parseFloat(e[10]));
              field(sa.class, "L").setFloat(placer, 1.62f);
              if (w.d(x, y, z, b, 0, 3) && w.a(x, y, z) == b) b.a((ahb) w, x, y, z, placer, (add) null);
              break;
            }
            // BlockCauldron.func_150024_a (setWaterLevel).
            case "cauldron": ((ajw) aji.e(118)).a((ahb) w, x, y, z, Integer.parseInt(e[6])); break;
            case "container": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            // IInventory.setInventorySlotContents; the tile-entity setter performs the native dirty/update call.
            case "slot": {
              Object inv = w.o(x, y, z);
              int item = Integer.parseInt(e[7]), count = Integer.parseInt(e[8]), damage = Integer.parseInt(e[9]);
              inv.getClass().getMethod("a", int.class, add.class).invoke(inv, Integer.parseInt(e[6]), count > 0 ? new add(adb.d(item), count, damage) : null);
              break;
            }
            case "notify": w.e(x, y, z, aji.e(Integer.parseInt(e[6]))); break;
            case "daylight": ((akg) aji.e(151)).e((ahb) w, x, y, z); break;
            case "power": w.add("q," + w.e(x, y, z, Integer.parseInt(e[6])) + "," + w.g(x, y, z, Integer.parseInt(e[6])) + "," + (w.v(x + 1, y, z) ? 1 : 0)); break;
            case "fixture": w.sky = Integer.parseInt(e[6]); field(ahb.class, "j").setInt(w, Integer.parseInt(e[7])); w.angle = Float.parseFloat(e[8]); ((aqo) field(ahb.class, "t").get(w)).g = Integer.parseInt(e[9]) != 0; break;
            case "cake": w.a(x, y, z, Integer.parseInt(e[6]), 3); break;
            case "record": {
              ((alq) aji.e(84)).b((ahb) w, x, y, z, new add(adb.d(Integer.parseInt(e[6])), 1));
              w.add("q," + ((alq) aji.e(84)).g((ahb) w, x, y, z, 0));
              break;
            }
            // Scripted entity stand-ins in one cell: 0.25 wide, 0.25 tall box on the cell floor. kind 0 item, 1 mob, 2 player.
            case "entity": {
              int kind = Integer.parseInt(e[6]);
              Object ent = unsafe.allocateInstance(kind == 0 ? xk.class : kind == 1 ? yq.class : mw.class);
              w.ents.add(new Object[] {ent, new double[] {x + 0.375, y, z + 0.375, x + 0.625, y + 0.25, z + 0.625}, new int[] {x, y, z}});
              break;
            }
            case "unentity": w.ents.removeIf(o -> { int[] c = (int[]) o[2]; return c[0] == x && c[1] == y && c[2] == z; }); break;
            case "collide": w.a(x, y, z).a((ahb) w, x, y, z, (sa) null); break;
            default: throw new IllegalArgumentException(e[2]);
          }
        }
        w.time++;
        w.add("T");
        w.tickUpdates();
        w.sendQueuedBlockEvents();
        w.h();
        int[][] now = snapshot(w, ox, oy, oz, dx, dy, dz);
        StringBuilder diff = new StringBuilder();
        for (int i = 0; i < now.length; i++) if (now[i][0] != prev[i][0] || now[i][1] != prev[i][1]) {
          int x = i / (dy * dz), y = i / dz % dy, z = i % dz;
          diff.append(diff.length() > 0 ? "," : "").append("[").append(x).append(",").append(y).append(",").append(z).append(",").append(now[i][0]).append(",").append(now[i][1]).append("]");
        }
        prev = now;
        int[] sig = signals(w, ox, oy, oz, dx, dy, dz);
        StringBuilder td = new StringBuilder();
        for (int i = 0; i < sig.length; i++) if (sig[i] != prevSig[i]) td.append(td.length() > 0 ? "," : "").append("[").append(i / (dy * dz)).append(",").append(i / dz % dy).append(",").append(i % dz).append(",").append(sig[i]).append("]");
        prevSig = sig;
        tiles.append(t > 1 ? "," : "").append("[").append(td).append("]");
        StringBuilder te = new StringBuilder();
        for (Object o : (List) field(ahb.class, "g").get(w)) if (o instanceof aps) {
          aps p = (aps) o;
          te.append(te.length() > 0 ? "," : "").append("[").append(p.c - ox).append(",").append(p.d - oy).append(",").append(p.e - oz).append(",").append(aji.b(p.a())).append(",").append(p.p()).append(",").append(p.c()).append(",").append(p.b() ? 1 : 0).append(",").append(p.d() ? 1 : 0).append(",").append(field(aps.class, "m").getFloat(p)).append(",").append(field(aps.class, "n").getFloat(p)).append("]");
        }
        tes.append(t > 1 ? "," : "").append("[").append(te).append("]");
        frames.append(t > 1 ? "," : "").append("[").append(diff).append("]");
        logs.append(t > 1 ? "," : "").append(q(w.log.toString()));
      }
      StringBuilder pend = new StringBuilder();
      for (ahs e : w.N) pend.append(pend.length() > 0 ? "," : "").append("[").append(e.a - ox).append(",").append(e.b - oy).append(",").append(e.c - oz).append(",").append(aji.b(e.a())).append(",").append(e.d - w.time).append(",").append(e.e).append("]");
      StringBuilder queued = new StringBuilder();
      for (ags d : w.bev[w.bevIdx]) queued.append(queued.length() > 0 ? "," : "").append("[").append(d.a() - ox).append(",").append(d.b() - oy).append(",").append(d.c() - oz).append(",").append(aji.b(d.f())).append(",").append(d.d()).append(",").append(d.e()).append("]");
      StringBuilder fin = new StringBuilder();
      for (int[] c : prev) fin.append(fin.length() > 0 ? "," : "").append(c[0]).append(c[1] != 0 ? ":" + c[1] : "");
      System.out.println("{\"kind\":\"scenario\",\"name\":" + q(name) + ",\"frames\":[" + frames + "],\"tiles\":[" + tiles + "],\"te\":[" + tes + "],\"queued\":[" + queued + "],\"calls\":[" + logs + "],\"final\":" + q(fin.toString()) + ",\"pending\":[" + pend + "],\"sounds\":[" + String.join(",", w.sounds) + "],\"drops\":[" + String.join(",", w.drops) + "],\"rng\":" + w.s.nextInt() + "}");
    }
  }
  // TileEntityComparator output signal of every comparator block (ids 149 and 150) in the region, else 0.
  static int[] signals(W w, int ox, int oy, int oz, int dx, int dy, int dz) {
    int[] r = new int[dx * dy * dz];
    for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
      int id = aji.b(w.a(ox + x, oy + y, oz + z));
      if (id == 149 || id == 150) r[(x * dy + y) * dz + z] = ((aoz) w.o(ox + x, oy + y, oz + z)).a();
    }
    return r;
  }
  static int[][] snapshot(W w, int ox, int oy, int oz, int dx, int dy, int dz) {
    int[][] r = new int[dx * dy * dz][];
    for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++)
      r[(x * dy + y) * dz + z] = new int[] {aji.b(w.a(ox + x, oy + y, oz + z)), w.e(ox + x, oy + y, oz + z)};
    return r;
  }
}
