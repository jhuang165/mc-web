import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

// Batch 20 interchange evidence on the unchanged 1.7.10 classes (EquipmentProbe's world double, no class is patched or shipped).
//  spiderJockeyGear: EntitySpider.onSpawnWithEgg (yn.a(sy)) builds `new EntitySkeleton(world)` itself, so the skeleton's own Entity.rand (an unseeded
//    `new Random()`) cannot be swapped before its onSpawnWithEgg. Technique: read the skeleton's Random state after the call (Unsafe on Random.seed) and
//    run the LCG backwards: for n = 1..400 the state n draws earlier is fed to a counting Random on a fresh skeleton whose onSpawnWithEgg is run again;
//    the n that makes the draw count equal n, the final state equal the jockey's and the gear equal the jockey's recovers the initial seed
//    (a false match needs the 48-bit state to collide). The record carries `seed` (a java.util.Random constructor argument) for the replay.
//  leader: EntityZombie.onSpawnWithEgg (yq.a(sy)) on zombies and pigmen with the maximum local difficulty: the written NBT (Entity.writeToNBT, sa.e) with its
//    Attributes list and Modifiers, the attribute values, and the same compound read back into a new mob (sa.f).
public class InterchangeProbe {
  static class Counting extends Random {
    int n;
    Counting(long seed) { super(seed); }
    protected int next(int bits) { n++; return super.next(bits); }
  }
  static final long MULT = 0x5DEECE66DL, MASK = (1L << 48) - 1;
  static long inverseMult() { long x = 1; for (int i = 0; i < 6; i++) x = x * (2 - MULT * x) & MASK; return x; } // modular inverse of MULT mod 2^48
  static sun.misc.Unsafe u;
  static long state(Random r) throws Exception {
    Field f = Random.class.getDeclaredField("seed");
    return ((AtomicLong) u.getObject(r, u.objectFieldOffset(f))).get();
  }
  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String num(double v) { return Double.toString(v); }
  static EquipmentProbe.World w;

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
    EquipmentProbe.w = w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    th reinforcements = DifficultyProbe.reinforcement();

    // ---- spider jockey gear ----
    long inv = inverseMult();
    for (int d : new int[] { 1, 2, 3 }) {
      int found = 0, tried = 0;
      for (int seed = 0; seed < 6000 && found < 60; seed++) {
        DifficultyProbe.setDifficulty(d);
        EquipmentProbe.environment(1, 3600000, 6, 1, false);
        MobMoveProbe.set(w, "s", new Random(seed * 2654435761L + 11));
        yn spider = new yn(w);
        EquipmentProbe.place(spider, 3.5, 64.0, 7.5); spider.y = 90;
        MobMoveProbe.set(spider, "Z", new Random(seed + 1000));
        ChickenProbe.World.spawned.clear();
        spider.a((sy) null);
        yl sk = null;
        for (Object o : ChickenProbe.World.spawned) if (o instanceof yl) sk = (yl) o;
        if (sk == null) continue;
        tried++;
        String gear = EquipmentProbe.slots(sk), chances = EquipmentProbe.chances(sk);
        int wither = sk.cb();
        boolean loot = sk.bJ();
        long fin = state(EquipmentProbe.rand(sk));
        float local = w.b(3.5, 64.0, 7.5);
        long cur = fin;
        boolean ok = false;
        for (int n = 1; n <= 400 && !ok; n++) {
          cur = ((cur - 0xBL) * inv) & MASK;
          long seedArg = cur ^ MULT;
          Counting c = new Counting(seedArg);
          yl sk2 = new yl(w);
          MobMoveProbe.set(sk2, "Z", c);
          EquipmentProbe.place(sk2, 3.5, 64.0, 7.5);
          MobMoveProbe.set(w, "s", new Random(1));
          ChickenProbe.World.spawned.clear();
          sk2.a((sy) null);
          if (c.n == n && state(c) == fin && EquipmentProbe.slots(sk2).equals(gear)) {
            ok = true;
            System.out.println("{\"case\":\"spiderJockeyGear\",\"difficulty\":" + d + ",\"seed\":" + seedArg + ",\"draws\":" + n + ",\"local\":" + num(local) + ",\"equipment\":" + gear + ",\"dropChances\":" + chances
              + ",\"wither\":" + wither + ",\"loot\":" + loot + ",\"randNext\":" + c.nextInt() + "}");
            found++;
          }
        }
        if (!ok) System.out.println("{\"case\":\"spiderJockeyGearUnrecovered\",\"difficulty\":" + d + ",\"jockeySeed\":" + seed + "}");
      }
    }

    // ---- leader zombies and pigmen ----
    for (String kind : new String[] { "zombie", "pigman" })
      for (int d : new int[] { 2, 3 }) {
        int leaders = 0, plain = 0;
        for (int seed = 0; seed < 3000 && (leaders < 14 || plain < 4); seed++) {
          DifficultyProbe.setDifficulty(d);
          EquipmentProbe.environment(1, 3600000, 6, 1, false);
          MobMoveProbe.set(w, "s", new Random(seed * 2654435761L + 31));
          sw e = kind.equals("zombie") ? new yq(w) : new yh(w);
          e.a(reinforcements).a(0.0);
          Random rand = new Random(seed);
          MobMoveProbe.set(e, "Z", rand);
          float local = w.b(0.0, 0.0, 0.0);
          e.a((sy) null);
          double maxHealth = e.a(yj.a).e();
          boolean leader = maxHealth > 20.0;
          if (leader ? leaders >= 14 : plain >= 4) continue;
          if (leader) leaders++; else plain++;
          dh tag = new dh();
          e.e(tag);
          tag.a("UUIDMost", 1L); tag.a("UUIDLeast", 2L);
          sw back = kind.equals("zombie") ? new yq(w) : new yh(w);
          MobMoveProbe.set(back, "Z", new Random(5));
          back.f(tag);
          System.out.println("{\"case\":\"leader\",\"kind\":\"" + kind + "\",\"difficulty\":" + d + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 2654435761L + 31) + ",\"local\":" + num(local)
            + ",\"leader\":" + leader + ",\"maxHealth\":" + num(maxHealth) + ",\"reinforcement\":" + num(e.a(yq.bp).e()) + ",\"followRange\":" + num(e.a(yj.b).e())
            + ",\"knockback\":" + num(e.a(yj.c).e()) + ",\"breakDoors\":" + tag.n("CanBreakDoors") + ",\"nbt\":\"" + hex(tag) + "\",\"readMaxHealth\":" + num(back.a(yj.a).e())
            + ",\"readReinforcement\":" + num(back.a(yq.bp).e()) + ",\"readHealth\":" + num(back.aS()) + ",\"randNext\":" + rand.nextInt() + "}");
        }
      }
  }
}
