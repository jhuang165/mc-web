// Runs the unchanged original BlockRedstoneWire (ana), BlockRedstoneTorch (anc),
// BlockTorch (aoc), BlockLever (alv), BlockButton (ajs/anx/aon),
// BlockRedstoneLight (anb), BlockCompressedPowered (ams), BlockRedstoneDiode (akj) with
// BlockRedstoneRepeater (anf), BlockRedstoneComparator (akc) with TileEntityComparator (aoz),
// BlockDaylightDetector (akg), BlockTripWireHook (aog) and BlockTripWire (aof),
// BlockBasePressurePlate (ajd) with BlockPressurePlate (amu) and BlockPressurePlateWeighted (aol),
// and the comparator-override blocks BlockCauldron (ajw) and BlockEndPortalFrame (aku), all inside a real
// World (ahb) whose chunk provider hands out real Chunk (apx) objects. The
// World subclass is allocated without its constructor (as TerrainProbe does)
// and keeps the native World.setBlock, setBlockMetadataWithNotify,
// notifyBlocksOfNeighborChange, notifyBlockOfNeighborChange, power queries
// (getBlockPowerInput, getIndirectPowerLevelTo, isBlockIndirectlyGettingPowered,
// getStrongestIndirectPower), plus explicit sky-brightness, skylight-subtraction and celestial-angle fixtures
// for BlockDaylightDetector.updateLightLevel, doesBlockHaveSolidTopSurface and
// isBlockNormalCubeDefault. Only these are replaced:
//   - scheduleBlockUpdate / WithPriority / func_147446_b / isBlockTickScheduledThisTick:
//     copies of the WorldServer pending-tick code (HashSet + TreeSet of the
//     original NextTickListEntry (ahs), 1000-entry cap, this-tick list);
//   - getTotalWorldTime, getGameRules, playSoundEffect (recorded),
//     spawnParticle (dropped), spawnEntityInWorld (EntityItem recorded),
//     getEntitiesWithinAABB / ...ExcludingEntity (a scripted list of entity stand-ins with
//     boxes: constructor-less EntityItem, EntityZombie and EntityPlayerMP instances);
//   - lighting updates (func_147451_t / updateLightByType return false: no
//     redstone rule reads light).
// The call log wraps (and then calls) the native setBlock, setBlockMetadataWithNotify
// and notifyBlockOfNeighborChange and records scheduled ticks and updateTick
// calls. Scenarios arrive on stdin (see tools/verify-redstone.mjs); one JSON
// line per scenario goes to stdout.
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class RedstoneProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String n) throws Exception { for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} throw new NoSuchFieldException(n); }
  static class Provider extends aqo { public String l() { return "probe"; } }
  static class Chunks implements apu {
    final ahb world; final Map<Long, apx> map = new HashMap<>();
    Chunks(ahb w) { world = w; }
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) { return map.computeIfAbsent(((long) x << 32) ^ (z & 0xffffffffL), k -> new apx(world, x, z)); }
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
    w.sky = sky; w.angle = angle;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    return w;
  }
  // Block.getTickRandomly of the hook/string and Entity.doesEntityNotTriggerPressurePlate of the entity classes the live port can put in a string's box.
  static String tripwireEntities() throws Exception {
    StringBuilder b = new StringBuilder("{\"tickRandomly\":{");
    for (int id : new int[] {1, 59, 131, 132}) b.append(id == 1 ? "" : ",").append(q(String.valueOf(id))).append(":").append(aji.e(id).t());
    b.append("},\"ignoresPlates\":{");
    Object[][] kinds = {{"item", xk.class}, {"mob", yq.class}, {"player", mw.class}, {"arrow", zc.class}, {"snowball", zj.class}, {"egg", zl.class}, {"enderPearl", zm.class}, {"potion", zo.class}, {"expBottle", zn.class}, {"bat", we.class}, {"fireball", zg.class}, {"minecart", xs.class}, {"tnt", xw.class}, {"xpOrb", sq.class}, {"boat", xi.class}, {"fallingBlock", xj.class}};
    for (int i = 0; i < kinds.length; i++) b.append(i == 0 ? "" : ",").append(q((String) kinds[i][0])).append(":").append(((sa) unsafe.allocateInstance((Class<?>) kinds[i][1])).az());
    return b.append("}}").toString();
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    // The wire's blocksNeedingUpdate set lives on the single Blocks.redstone_wire instance.
    Field wireSet = field(ana.class, "b");
    // Native block properties: material opaque, renderAsNormalBlock, canProvidePower,
    // isNormalCube, and doesBlockHaveSolidTopSurface for metadata 0..15 (bitmask).
    StringBuilder props = new StringBuilder();
    W probe = world(0);
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id); if (b == null || (id != 0 && b == ajn.a)) continue;
      int top = 0;
      for (int m = 0; m < 16; m++) { probe.raw(0, 1, 0, b, m); if (ahb.a(probe, 0, 1, 0)) top |= 1 << m; }
      props.append(props.length() > 0 ? "," : "").append("[").append(id).append(",").append(b.o().k() ? 1 : 0).append(",").append(b.d() ? 1 : 0).append(",").append(b.f() ? 1 : 0).append(",").append(b.r() ? 1 : 0).append(",").append(top).append("]");
    }
    // Blocks fields the ported rules compare against.
    String[] names = {"af", "aN", "aR", "aS", "aJ", "bk", "w", "bK", "az", "aA", "bu", "bv"};
    StringBuilder ids = new StringBuilder();
    for (String n : names) ids.append(ids.length() > 0 ? "," : "").append(q(n)).append(":").append(aji.b((aji) ajn.class.getField(n).get(null)));
    // Ids of the repeater/comparator/plate/override blocks and their original classes, and drop items.
    StringBuilder cls = new StringBuilder();
    for (int id : new int[] {70, 72, 84, 92, 93, 94, 118, 120, 147, 148, 149, 150, 151}) cls.append(cls.length() > 0 ? "," : "").append(q(String.valueOf(id))).append(":").append(q(aji.e(id).getClass().getName()));
    StringBuilder limits = new StringBuilder();
    for (int id = 0; id < 4096; id++) {
      adb item = adb.d(id);
      if (item != null && item.m() != 64) limits.append(limits.length() > 0 ? "," : "").append("[").append(id).append(",").append(item.m()).append("]");
    }
    StringBuilder tileClasses = new StringBuilder();
    int[] containerIds = {23, 54, 61, 62, 84, 146, 154, 158};
    for (int id : containerIds) {
      W tw = world(0); tw.raw(0, 1, 0, aji.e(id), 0);
      aor te = tw.o(0, 1, 0);
      tileClasses.append(tileClasses.length() > 0 ? "," : "").append(q(String.valueOf(id))).append(":").append(q(te.getClass().getName()));
    }
    System.out.println("{\"kind\":\"blocks\",\"props\":[" + props + "],\"fields\":{" + ids + "},\"items\":{\"redstone\":" + adb.b(ade.ax) + ",\"repeater\":" + adb.b(ade.aW) + ",\"comparator\":" + adb.b(ade.bS) + "},\"classes\":{" + cls + "},\"stackLimits\":[" + limits + "],\"tileClasses\":{" + tileClasses + "},\"tripwireEntities\":" + tripwireEntities() + "}");
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
      StringBuilder frames = new StringBuilder(), logs = new StringBuilder(), tiles = new StringBuilder();
      for (int t = 1; t <= ticks; t++) {
        w.tick = t; w.log.setLength(0);
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          int x = ox + Integer.parseInt(e[3]), y = oy + Integer.parseInt(e[4]), z = oz + Integer.parseInt(e[5]);
          w.add("E," + e[2]);
          switch (e[2]) {
            case "place": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            // World.setBlock flags 2 (structure generation) and ItemBlock.placeBlockAt: setBlock(.., 3), onPostBlockPlaced(meta).
            case "place2": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 2); break;
            case "placehook": {
              aji b = aji.e(Integer.parseInt(e[6])); int pm = Integer.parseInt(e[7]);
              if (w.d(x, y, z, b, pm, 3) && w.a(x, y, z) == b) b.e((ahb) w, x, y, z, pm);
              break;
            }
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
            // Entity classes the tripwire sensing box is asked about: 0 item, 1 mob, 2 player, 3 arrow, 4 snowball, 5 egg, 6 ender pearl, 7 thrown potion, 8 bat, 9 boat, 10 falling block, 11 thrown experience bottle.
            // Arrows are 0.5 wide, the rest 0.25 (the scripted box is only the intersection geometry; the class decides doesEntityNotTriggerPressurePlate).
            case "entity2": {
              int kind = Integer.parseInt(e[6]);
              Class<?>[] kinds = {xk.class, yq.class, mw.class, zc.class, zj.class, zl.class, zm.class, zo.class, we.class, xi.class, xj.class, zn.class};
              Object ent = unsafe.allocateInstance(kinds[kind]);
              double r = kind == 3 ? 0.25 : kind == 9 ? 0.75 : kind == 10 ? 0.49 : 0.125, hgt = kind == 3 ? 0.5 : kind == 9 ? 0.6 : kind == 10 ? 0.98 : 0.25;
              w.ents.add(new Object[] {ent, new double[] {x + 0.5 - r, y, z + 0.5 - r, x + 0.5 + r, y + hgt, z + 0.5 + r}, new int[] {x, y, z}});
              break;
            }
            // Block.onBlockHarvested with a player holding 0 nothing, 1 shears, 2 a stick (BlockTripWire shears disarm).
            case "harvest": {
              // TripwireHolder (tools/probes/TripwireHolder.java, compiled only by tools/verify-tripwire.mjs: its constructor type needs authlib).
              Object pl = unsafe.allocateInstance(Class.forName("TripwireHolder"));
              int held = Integer.parseInt(e[6]);
              field(pl.getClass(), "held").set(pl, held == 0 ? null : new add(held == 1 ? ade.aZ : ade.F, 1));
              w.a(x, y, z).a((ahb) w, x, y, z, w.e(x, y, z), (yz) pl);
              break;
            }
            // Block.updateTick from a random tick (WorldServer.func_147456_g passes the world Random).
            case "randomtick": w.a(x, y, z).a((ahb) w, x, y, z, (Random) field(ahb.class, "s").get(w)); break;
            case "unentity": w.ents.removeIf(o -> { int[] c = (int[]) o[2]; return c[0] == x && c[1] == y && c[2] == z; }); break;
            // Remove only the scripted entities of one entity2 kind in the cell.
            case "unentity2": {
              Class<?>[] kinds = {xk.class, yq.class, mw.class, zc.class, zj.class, zl.class, zm.class, zo.class, we.class, xi.class, xj.class, zn.class};
              Class<?> k = kinds[Integer.parseInt(e[6])];
              w.ents.removeIf(o -> { int[] c = (int[]) o[2]; return c[0] == x && c[1] == y && c[2] == z && o[0].getClass() == k; });
              break;
            }
            case "collide": w.a(x, y, z).a((ahb) w, x, y, z, (sa) null); break;
            default: throw new IllegalArgumentException(e[2]);
          }
        }
        w.time++;
        w.add("T");
        w.tickUpdates();
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
        frames.append(t > 1 ? "," : "").append("[").append(diff).append("]");
        logs.append(t > 1 ? "," : "").append(q(w.log.toString()));
      }
      StringBuilder pend = new StringBuilder();
      for (ahs e : w.N) pend.append(pend.length() > 0 ? "," : "").append("[").append(e.a - ox).append(",").append(e.b - oy).append(",").append(e.c - oz).append(",").append(aji.b(e.a())).append(",").append(e.d - w.time).append(",").append(e.e).append("]");
      StringBuilder fin = new StringBuilder();
      for (int[] c : prev) fin.append(fin.length() > 0 ? "," : "").append(c[0]).append(c[1] != 0 ? ":" + c[1] : "");
      System.out.println("{\"kind\":\"scenario\",\"name\":" + q(name) + ",\"frames\":[" + frames + "],\"tiles\":[" + tiles + "],\"calls\":[" + logs + "],\"final\":" + q(fin.toString()) + ",\"pending\":[" + pend + "],\"sounds\":[" + String.join(",", w.sounds) + "],\"drops\":[" + String.join(",", w.drops) + "],\"rng\":" + w.s.nextInt() + "}");
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
