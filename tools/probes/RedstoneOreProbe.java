import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// BlockRedstoneOre (amz) and its lit twin on the unchanged 1.7.10 classes, over the EnchantmentEffectProbe world double
// (cells, setBlock recording, captured spawnParticle, spawned items and orbs, World.rand): the static facts (tickRate,
// light value and opacity, random ticking, the item dropped, createStackedBlock), onBlockClicked / onEntityWalking /
// onBlockActivated on the unlit and the lit ore over every neighbour-opacity mask (func_150186_m's reddust points and
// the swap to lit ore), updateTick, and Block.harvestBlock with Silk Touch and Fortune 0-3 (drops and experience).
// Seeded World.rand; nothing is patched.
public class RedstoneOreProbe {
  static String num(double v) { return Double.toString(v); }

  static String particles() {
    StringBuilder s = new StringBuilder();
    for (int i = 0; i < DifficultyProbe.World.swirls.size(); i++) {
      double[] v = DifficultyProbe.World.swirls.get(i);
      s.append(i > 0 ? "," : "").append("[\"" + DifficultyProbe.World.swirlNames.get(i) + "\"," + num(v[0]) + "," + num(v[1]) + "," + num(v[2]) + "," + num(v[3]) + "," + num(v[4]) + "," + num(v[5]) + "]");
    }
    return "[" + s + "]";
  }

  static void clear() {
    EnchantmentEffectProbe.World.ids.clear(); EnchantmentEffectProbe.World.metas.clear(); EnchantmentEffectProbe.World.sets.clear();
    DifficultyProbe.World.swirls.clear(); DifficultyProbe.World.swirlNames.clear(); CombatProbe.World.spawned.clear();
  }

  // The six neighbours in func_150186_m's order: up, down, south (+z), north (-z), east (+x), west (-x).
  static final int[][] FACES = {{0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}, {1, 0, 0}, {-1, 0, 0}};
  static void neighbours(int x, int y, int z, int mask, int filler) {
    for (int f = 0; f < 6; f++) {
      String k = (x + FACES[f][0]) + "," + (y + FACES[f][1]) + "," + (z + FACES[f][2]);
      EnchantmentEffectProbe.World.ids.put(k, (mask >> f & 1) == 1 ? 1 : filler);
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    CombatProbe.World w = (CombatProbe.World) u.allocateInstance(EnchantmentEffectProbe.World.class);
    EnchantmentEffectProbe.w = w; DifficultyProbe.w = w; CombatProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    EnchantmentEffectProbe.fd(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    EnchantmentEffectProbe.fd(ays.class, "g").setLong(info, 1);
    EnchantmentEffectProbe.fd(ays.class, "x").set(info, new agy());
    EnchantmentEffectProbe.fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    EnchantmentEffectProbe.fd(ahb.class, "J").set(w, date);
    EnchantmentEffectProbe.fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    EnchantmentEffectProbe.Player p = EnchantmentEffectProbe.player(u);
    final int X = 10, Y = 70, Z = 10;
    String key = X + "," + Y + "," + Z;

    // Static facts: tickRate, light value (m), light opacity (k), getTickRandomly (t), isOpaqueCube (c), the item dropped and the stacked block.
    Method stacked = MobMoveProbe.method(amz.class, "j", int.class);
    for (int id : new int[] {73, 74}) {
      aji b = aji.e(id);
      add s = (add) stacked.invoke(b, 0);
      System.out.println("{\"case\":\"facts\",\"block\":" + id + ",\"class\":\"" + b.getClass().getName() + "\",\"tickRate\":" + b.a(w) + ",\"light\":" + b.m() + ",\"opacity\":" + b.k()
        + ",\"tickRandomly\":" + b.t() + ",\"opaque\":" + b.c() + ",\"item\":" + adb.b(b.a(0, new Random(1), 0)) + ",\"stacked\":[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"
        + ",\"quantity\":[" + b.a(0, new Random(3)) + "," + b.a(1, new Random(3)) + "," + b.a(3, new Random(3)) + "],\"itemOfBlock\":" + adb.b(adb.a(b)) + "}");
    }

    // The touch events: [event] 0 onBlockClicked, 1 onEntityWalking, 2 onBlockActivated, over every neighbour mask (stone = opaque, air otherwise)
    // and some masks with glass/torch fillers (not opaque, not air); the unlit (73) and lit (74) ore.
    int[] fillers = {0, 20, 50};
    for (int id : new int[] {73, 74})
      for (int event = 0; event < 3; event++)
        for (int filler : fillers)
          for (int mask = 0; mask < 64; mask += filler == 0 ? 1 : 9) {
            clear();
            EnchantmentEffectProbe.World.ids.put(key, id);
            neighbours(X, Y, Z, mask, filler);
            Random r = new Random(mask * 31 + event * 7 + id);
            MobMoveProbe.set(w, "s", r);
            aji b = aji.e(id);
            String ret = "null";
            if (event == 0) b.a(w, X, Y, Z, p);
            else if (event == 1) b.b(w, X, Y, Z, p);
            else ret = String.valueOf(b.a(w, X, Y, Z, p, 1, 0.5f, 0.5f, 0.5f));
            System.out.println("{\"case\":\"touch\",\"block\":" + id + ",\"event\":" + event + ",\"filler\":" + filler + ",\"mask\":" + mask + ",\"seed\":" + (mask * 31 + event * 7 + id)
              + ",\"particles\":" + particles() + ",\"sets\":[" + String.join(",", EnchantmentEffectProbe.World.sets) + "],\"return\":" + ret + ",\"next\":" + r.nextInt() + "}");
          }

    // updateTick (the random tick) of both blocks.
    for (int id : new int[] {73, 74}) {
      clear();
      EnchantmentEffectProbe.World.ids.put(key, id);
      Random r = new Random(5), wr = new Random(6);
      MobMoveProbe.set(w, "s", wr);
      aji.e(id).a(w, X, Y, Z, r);
      System.out.println("{\"case\":\"tick\",\"block\":" + id + ",\"sets\":[" + String.join(",", EnchantmentEffectProbe.World.sets) + "],\"particles\":" + particles() + ",\"next\":" + r.nextInt() + ",\"worldNext\":" + wr.nextInt() + "}");
    }

    // Block.harvestBlock with an iron pickaxe: [set] 0 none, 1 silk, 2-4 fortune 1-3.
    int[][][] sets = {null, {{33, 1}}, {{35, 1}}, {{35, 2}}, {{35, 3}}};
    yx inv = p.bm;
    inv.c = 0;
    for (int id : new int[] {73, 74})
      for (int set = 0; set < sets.length; set++)
        for (int seed = 0; seed < 40; seed++) {
          clear();
          EnchantmentEffectProbe.World.ids.put("0,64,0", id); EnchantmentEffectProbe.World.ids.put("0,63,0", 3); EnchantmentEffectProbe.World.ids.put("0,65,0", 0);
          for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
          inv.a[0] = EnchantmentEffectProbe.stack(257, sets[set]);
          long rs = seed * 2654435761L + id * 31;
          Random rand = new Random(rs);
          MobMoveProbe.set(w, "s", rand);
          aji.e(id).a(w, p, 0, 64, 0, 0);
          System.out.println("{\"case\":\"harvest\",\"block\":" + id + ",\"set\":" + set + ",\"seed\":" + rs + ",\"drops\":" + EnchantmentEffectProbe.drops() + ",\"xp\":" + EnchantmentEffectProbe.xp() + ",\"next\":" + rand.nextInt() + "}");
        }
  }
}
