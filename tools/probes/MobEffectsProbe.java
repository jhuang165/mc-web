import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.*;

// Batch 52 (mobexport, tag b52me): EntityLivingBase.writeEntityToNBT / readEntityFromNBT of ActiveEffects on real mob classes. Each mob is built by
// EntityList.createEntityByName (sg.a(String, ahb)) on the MobNbtProbe world double, gets PotionEffects put straight into its active-effect map
// (sv.f, as the NBT reader does), is written with Entity.writeToNBTOptional (sa.c), loaded with EntityList.createEntityFromNBT (sg.a(dh, ahb)) and
// the loaded mob's map is printed. One JSON object per line: {tag, kind, case, nbt (hex of the first write), reload (hex of the loaded mob written
// again), effects: [[id, amplifier, duration, ambient], ...] of the loaded mob}.
public class MobEffectsProbe {
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static HorseProbe.World W;
  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static final String[] KINDS = { "Pig", "Cow", "MushroomCow", "Sheep", "Chicken", "Wolf", "Spider", "CaveSpider", "Creeper", "Witch", "Silverfish", "SnowMan",
    "Villager", "VillagerGolem", "Zombie", "Slime", "Enderman", "Squid", "Bat", "LavaSlime", "PigZombie", "Ozelot", "EntityHorse", "Blaze", "Ghast", "WitherBoss", "Skeleton", "Giant" };
  // {id, amplifier, duration, ambient}
  static final int[][][] CASES = {
    {},
    { { 1, 0, 600, 0 } },
    { { 5, 1, 100, 0 }, { 1, 2, 3000, 1 }, { 10, 0, 5, 0 } },
    { { 11, 200, 1000, 0 }, { 22, 255, 40, 0 } },
    { { 12, 0, 2147483647, 0 }, { 13, 0, 7, 0 } },
    { { 3, 0, 50, 0 }, { 14, 0, 50, 0 } }
  };
  static void run(String kind, int ci) throws Exception {
    sa fresh = sg.a(kind, W);
    if (fresh == null) throw new IllegalStateException("no mob " + kind);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(fresh, 100.5, 64.0, -20.25);
    Field f = MobMoveProbe.field(sv.class, "f");
    HashMap map = (HashMap) f.get(fresh);
    for (int[] e : CASES[ci]) map.put(Integer.valueOf(e[0]), new rw(e[0], e[2], e[1], e[3] != 0));
    dh t = new dh();
    if (!fresh.c(t)) throw new IllegalStateException("not saved: " + kind);
    sa loaded = sg.a(t, W);
    if (loaded == null) throw new IllegalStateException("not loaded: " + kind);
    dh again = new dh();
    loaded.c(again);
    StringBuilder s = new StringBuilder("{\"tag\":\"b52me\",\"kind\":\"" + kind + "\",\"case\":" + ci + ",\"nbt\":\"" + hex(t) + "\",\"reload\":\"" + hex(again) + "\",\"effects\":[");
    boolean first = true;
    for (Object o : new TreeMap<Integer, Object>((HashMap) f.get(loaded)).values()) {
      rw p = (rw) o;
      if (!first) s.append(",");
      first = false;
      s.append("[").append(p.a()).append(",").append(p.c()).append(",").append(p.b()).append(",").append(p.e() ? 1 : 0).append("]");
    }
    System.out.println(s.append("]}"));
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    for (String k : KINDS) for (int c = 0; c < CASES.length; c++) {
      try { run(k, c); } catch (Throwable x) { System.out.println("{\"tag\":\"b52me\",\"kind\":\"" + k + "\",\"case\":" + c + ",\"error\":\"" + x + "\"}"); }
    }
  }
}
