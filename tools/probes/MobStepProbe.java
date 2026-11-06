import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Footstep and fall sounds of every mob the browser supports, from the unchanged 1.7.10 classes: each mob is built by
// EntityList.createEntityByName (sg.a(String, ahb)) with its real constructor on the HorseProbe/MobMoveProbe world double
// (stone floor below y 0; blocks and the snow layer above them can be overridden per cell). One JSON object per line:
//   facts    type, class, canTriggerWalking (sa.g_), swim sound (sa.H, game.hostile.swim for EntityMob)
//   step     func_145780_a (sa.a(int,int,int,aji)) on a block, with and without a snow layer above: the sounds it plays
//   cadence  200 ticks of the real Entity.moveEntity (sa.d) at dx = 0.1 per tick on stone: ticks that played a sound,
//            their sounds, and distanceWalkedOnStepModified (sa.Q) / nextStepDistance (private int sa.d) at the end
//   fall     EntityLivingBase.fall (sv.b(F)) from a distance onto stone: health lost and the sounds in order
public class MobStepProbe {
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static final Map<String, aji> over = new HashMap<>();

  public static class World extends HorseProbe.World {
    public aji a(int x, int y, int z) {
      aji o = over.get(x + "," + y + "," + z);
      return o != null ? o : super.a(x, y, z);
    }
  }

  static World W;
  static String q(String s) { return "\"" + s + "\""; }
  static void out(String s) { System.out.println(s); }
  static String sounds() { return HorseProbe.strings(HorseProbe.World.sounds); }

  static sa made(String name, int horseType) throws Exception {
    sa e = sg.a(name, W);
    if (e == null) throw new IllegalStateException("no entity " + name);
    if (horseType >= 0) ((wi) e).a(new wk(horseType, 0));
    MobMoveProbe.set(e, "Z", new Random(1));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.5, 0.0, 64.5);
    MobMoveProbe.set(e, "D", true);
    return e;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    String[][] mobs = {
      {"pig", "Pig", "-1"}, {"cow", "Cow", "-1"}, {"mooshroom", "MushroomCow", "-1"}, {"sheep", "Sheep", "-1"}, {"chicken", "Chicken", "-1"},
      {"wolf", "Wolf", "-1"}, {"ocelot", "Ozelot", "-1"}, {"horse", "EntityHorse", "0"}, {"donkey", "EntityHorse", "1"}, {"mule", "EntityHorse", "2"},
      {"zombie_horse", "EntityHorse", "3"}, {"skeleton_horse", "EntityHorse", "4"},
      {"zombie", "Zombie", "-1"}, {"pigman", "PigZombie", "-1"}, {"skeleton", "Skeleton", "-1"}, {"spider", "Spider", "-1"}, {"cave_spider", "CaveSpider", "-1"},
      {"creeper", "Creeper", "-1"}, {"enderman", "Enderman", "-1"}, {"silverfish", "Silverfish", "-1"}, {"witch", "Witch", "-1"}, {"villager", "Villager", "-1"},
      {"iron_golem", "VillagerGolem", "-1"}, {"snow_golem", "SnowMan", "-1"}, {"slime", "Slime", "-1"}, {"magma_cube", "LavaSlime", "-1"},
      {"squid", "Squid", "-1"}, {"bat", "Bat", "-1"}, {"blaze", "Blaze", "-1"}, {"ghast", "Ghast", "-1"}, {"wither", "WitherBoss", "-1"}, {"ender_dragon", "EnderDragon", "-1"},
    };
    Object[][] blocks = { {"stone", 1}, {"grass", 2}, {"gravel", 13}, {"sand", 12}, {"planks", 5}, {"wool", 35}, {"glass", 20}, {"snow", 80}, {"water", 9}, {"lava", 11}, {"soul_sand", 88}, {"ladder", 65}, {"iron_block", 42} };
    float[] dists = {0f, 3f, 3.5f, 4f, 5f, 10f, 20f};
    for (String[] m : mobs) {
      int ht = Integer.parseInt(m[2]);
      sa e = made(m[1], ht);
      boolean can = (Boolean) MobMoveProbe.method(sa.class, "g_").invoke(e);
      String swim = (String) MobMoveProbe.method(sa.class, "H").invoke(e);
      out("{\"case\":\"facts\",\"type\":" + q(m[0]) + ",\"entity\":" + q(m[1]) + ",\"horseType\":" + ht + ",\"class\":" + q(e.getClass().getName()) + ",\"canTriggerWalking\":" + can + ",\"swim\":" + q(swim) + "}");
      for (Object[] b : blocks) for (int snow = 0; snow < 2; snow++) {
        over.clear();
        if (snow == 1) over.put("64,1,64", aji.e(78));
        HorseProbe.World.sounds.clear();
        MobMoveProbe.method(sa.class, "a", int.class, int.class, int.class, aji.class).invoke(e, 64, 0, 64, aji.e((Integer) b[1]));
        out("{\"case\":\"step\",\"type\":" + q(m[0]) + ",\"block\":" + q((String) b[0]) + ",\"id\":" + b[1] + ",\"snowAbove\":" + (snow == 1) + ",\"sounds\":" + sounds() + "}");
      }
      over.clear();
      // cadence: real moveEntity on the stone floor, 0.1 per tick east
      sa w = made(m[1], ht);
      StringBuilder ticks = new StringBuilder(), names = new StringBuilder();
      int n = 0;
      for (int t = 0; t < 200; t++) {
        HorseProbe.World.sounds.clear();
        w.d(0.1, 0.0, 0.0);
        if (!HorseProbe.World.sounds.isEmpty()) {
          ticks.append(n > 0 ? "," : "").append(t);
          names.append(n > 0 ? "," : "").append(sounds());
          n++;
        }
      }
      out("{\"case\":\"cadence\",\"type\":" + q(m[0]) + ",\"ticks\":200,\"stepTicks\":[" + ticks + "],\"sounds\":[" + names + "],\"distance\":" + w.Q + ",\"nextStep\":" + MobMoveProbe.field(sa.class, "d").getInt(w) + ",\"x\":" + w.s + "}");
      // fall onto stone
      for (float d : dists) {
        sa f = made(m[1], ht);
        HorseProbe.World.sounds.clear();
        float before = f instanceof sv ? ((sv) f).aS() : 0f;
        boolean fatal = false;
        try { MobMoveProbe.method(sa.class, "b", float.class).invoke(f, d); } catch (java.lang.reflect.InvocationTargetException x) { fatal = true; } // death needs world state the double lacks
        float lost = f instanceof sv ? before - ((sv) f).aS() : 0f;
        out("{\"case\":\"fall\",\"type\":" + q(m[0]) + ",\"distance\":" + d + ",\"lost\":" + lost + ",\"fatal\":" + fatal + ",\"sounds\":" + sounds() + "}");
      }
    }
  }
}
