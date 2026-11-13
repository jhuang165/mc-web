import java.util.ArrayList;
import java.util.List;

// Batch 60: the client copy's Random stream for every EntityLiving type. The unchanged mob classes (created by EntityList.createEntityByName, sg.a) on a CLIENT world double
// (ahb.E true) with a logging Random as the copy's own Entity.rand. Per mob two scenarios, both ALIVE and never given a status:
//   update  sv.C() = EntityLiving.onEntityUpdate alone (water check, air, living sound roll), 400 ticks: per tick the draws, the sounds the client world was asked to play
//           (name|volume|pitch) and the particles
//   full    sv.h() = onUpdate (onEntityUpdate, then onLivingUpdate and the body turn), 400 ticks, same record; an exception (a world double too small) is recorded as `error`
// Also per mob: talk interval (sw.q()), living sound volume (bf) and size. Output: one JSON object per mob and scenario.
public class MobSoundsProbe {
  public static class PW extends HorseProbe.World {
    static List<String> particles = new ArrayList<>();
    public float n(int x, int y, int z) { return 1.0f; } // getLightBrightness (a mob's brightness reads the dimension table)
    public int k(int x, int y, int z) { return 15; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add(name); }
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    String[] names = { "Creeper", "Skeleton", "Spider", "CaveSpider", "Giant", "Zombie", "PigZombie", "Slime", "LavaSlime", "Ghast", "Enderman", "Silverfish", "Blaze", "WitherBoss", "Witch",
      "Bat", "Pig", "Sheep", "Cow", "MushroomCow", "Chicken", "Squid", "Wolf", "Ozelot", "SnowMan", "VillagerGolem", "Villager", "EntityHorse" };
    long seed = 600;
    for (String name : names) for (int mode = 0; mode < 2; mode++) {
      seed++;
      HorseCopyProbe.build(PW.class, true);
      HorseProbe.clear(); PW.particles.clear();
      { // the chunk double's entity lists (apx.j, apx.u), which World.updateEntityWithOptionalForce reads when a mob's chunk coordinates change
        Object provider = MobMoveProbe.field(ahb.class, "v").get(HorseProbe.W);
        Object chunk = provider.getClass().getMethod("d", int.class, int.class).invoke(provider, 0, 0);
        java.util.List[] lists = new java.util.List[16]; for (int k = 0; k < 16; k++) lists[k] = new ArrayList();
        MobMoveProbe.set(chunk, "j", lists); MobMoveProbe.set(chunk, "u", new apz[16]); MobMoveProbe.set(chunk, "e", HorseProbe.W); // entity lists and (empty) block storages
      }
      sv e = (sv) sg.a(name, HorseProbe.W);
      if (e == null) { HorseProbe.out("{\"case\":\"missing\",\"name\":" + q(name) + "}"); continue; }
      HorseCopyProbe.Log r = new HorseCopyProbe.Log(seed); MobMoveProbe.set(e, "Z", r);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 10.5, 64.0, -5.5);
      StringBuilder rows = new StringBuilder(); String error = "null";
      for (int i = 0; i < 400; i++) {
        r.log.clear(); HorseProbe.World.sounds.clear(); PW.particles.clear();
        try { if (mode == 0) e.C(); else e.h(); } catch (Throwable t) { error = q((t + " @ " + t.getStackTrace()[0] + " " + t.getStackTrace()[1]).replace("\"", "'")); break; }
        rows.append(i > 0 ? "," : "").append("[\"" + String.join(" ", r.log) + "\"," + HorseCopyProbe.list(new ArrayList<>(HorseProbe.World.sounds)) + "," + HorseCopyProbe.list(new ArrayList<>(PW.particles)) + "," + MobMoveProbe.field(sa.class, "D").getBoolean(e) + "]");
      }
      int talk = (Integer) MobMoveProbe.method(sw.class, "q").invoke(e);
      HorseProbe.out("{\"case\":\"" + (mode == 0 ? "update" : "full") + "\",\"name\":" + q(name) + ",\"cls\":" + q(e.getClass().getName()) + ",\"seed\":" + seed + ",\"talk\":" + talk
        + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + ",\"error\":" + error + ",\"ticks\":[" + rows + "]}");
    }
  }
}
