// Native records for the generation-time neighbour chains of a fallen stone/wooden button (BlockButton.onNeighborBlockChange, ajs.a) and a
// powered TNT block (BlockTNT.onBlockAdded / onNeighborBlockChange, aob.b / aob.a): the unchanged blocks run in the real World/Chunk harness
// of RedstoneProbe (same native setBlock, notify and power queries). Only spawnEntityInWorld differs: it records an EntityItem (drop) or an
// EntityTNTPrimed (position, fuse; its motion comes from Math.random and is not recorded). Each case reports the call log
// (s = setBlock, m = metadata, n = neighbour notification, p = sound, e = item), the drops with their offsets, the primed TNT and the next
// two draws of the world Random, so the replay pins both the writes and the Random consumption.
import java.lang.reflect.Field;
import java.util.*;

public class NeighborChainProbe {
  public static class W2 extends RedstoneProbe.W {
    List<String> primed;
    public boolean d(sa e) {
      if (e instanceof xw) {
        xw t = (xw) e;
        try { primed.add("[" + e.s + "," + e.t + "," + e.u + "," + RedstoneProbe.field(xw.class, "a").getInt(t) + "]"); } catch (Exception x) { throw new RuntimeException(x); }
        add("e,tnt");
        return true;
      }
      return super.d(e);
    }
  }
  static W2 world(long seed) throws Exception {
    // RedstoneProbe.world(seed, 15, 0, 0f, false) with the W2 subclass.
    W2 w = (W2) RedstoneProbe.unsafe.allocateInstance(W2.class);
    RedstoneProbe.Provider provider = new RedstoneProbe.Provider(); provider.g = false;
    RedstoneProbe.field(ahb.class, "t").set(w, provider);
    RedstoneProbe.field(ahb.class, "j").setInt(w, 0);
    RedstoneProbe.field(ahb.class, "s").set(w, new Random(seed));
    RedstoneProbe.field(ahb.class, "u").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "C").set(w, new qi());
    RedstoneProbe.field(ahb.class, "v").set(w, new RedstoneProbe.Chunks(w));
    RedstoneProbe.field(ahb.class, "a").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "g").set(w, new ArrayList());
    w.sky = 15; w.angle = 0f;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    w.primed = new ArrayList<>();
    return w;
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String result(W2 w, long seed, String name, int id, int meta, int x, int y, int z, String extra) {
    String log = w.log.toString();
    float r0 = w.s.nextFloat(), r1 = w.s.nextFloat();
    return "{\"name\":" + q(name) + ",\"seed\":" + seed + ",\"id\":" + id + ",\"meta\":" + meta + ",\"at\":[" + x + "," + y + "," + z + "]" + extra + ",\"log\":" + q(log) + ",\"drops\":" + list(w.drops) + ",\"primed\":" + list(w.primed)
      + ",\"final\":" + aji.b(w.a(x, y, z)) + ",\"finalMeta\":" + w.e(x, y, z) + ",\"next\":[" + r0 + "," + r1 + "]}";
  }
  static void support(W2 w, int x, int y, int z, int mask) {
    // mask bits: 1 = x-1, 2 = x+1, 4 = z-1, 8 = z+1 solid stone
    if ((mask & 1) != 0) w.raw(x - 1, y, z, aji.e(1), 0);
    if ((mask & 2) != 0) w.raw(x + 1, y, z, aji.e(1), 0);
    if ((mask & 4) != 0) w.raw(x, y, z - 1, aji.e(1), 0);
    if ((mask & 8) != 0) w.raw(x, y, z + 1, aji.e(1), 0);
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); RedstoneProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    List<String> out = new ArrayList<>();
    int x = 8, y = 64, z = 8;
    // Buttons: every facing (metadata 1..4 = support at x-1, x+1, z-1, z+1) against every support mask, pressed or not, for ids 77 and 143.
    for (int id : new int[] {77, 143}) for (int facing = 1; facing <= 4; facing++) for (int mask = 0; mask < 16; mask++) for (int pressed = 0; pressed < 2; pressed++) {
      long seed = 900 + id + facing * 31 + mask + pressed * 7;
      W2 w = world(seed);
      support(w, x, y, z, mask);
      w.raw(x, y, z, aji.e(id), facing | (pressed << 3));
      w.log.setLength(0);
      aji.e(id).a(w, x, y, z, aji.e(1));
      out.add(result(w, seed, "button " + id + " facing " + facing + " support " + mask + " pressed " + pressed, id, facing | (pressed << 3), x, y, z, ",\"mask\":" + mask));
    }
    // Buttons on the floor / ceiling (metadata 5, 6 and 0 in 1.7.10 are not placeable; included to pin the no-op reads).
    // TNT: unpowered and powered (a redstone block beside it, a powered stone block above) for onBlockAdded and the neighbour change.
    for (int mode = 0; mode < 3; mode++) for (int hook = 0; hook < 2; hook++) {
      long seed = 5000 + mode * 2 + hook;
      W2 w = world(seed);
      w.raw(x, y, z, aji.e(46), 0);
      if (mode == 1) w.raw(x + 1, y, z, aji.e(152), 0);        // redstone block: weak power 15 to every side
      if (mode == 2) { w.raw(x, y + 1, z, aji.e(1), 0); w.raw(x, y + 2, z, aji.e(152), 0); } // strong power through a normal cube above
      w.log.setLength(0);
      if (hook == 0) aji.e(46).b(w, x, y, z); else aji.e(46).a(w, x, y, z, aji.e(1));
      out.add(result(w, seed, "tnt " + (hook == 0 ? "onBlockAdded" : "neighbour") + " " + new String[] {"unpowered", "adjacent power block", "powered cube above"}[mode], 46, 0, x, y, z, ",\"mode\":" + mode + ",\"hook\":" + hook));
    }
    System.out.println("{\"case\":\"neighbourChains\",\"cases\":" + list(out) + "}");
  }
}
