import java.lang.reflect.Method;
import java.util.*;

// MobSpawnerBaseLogic.a(sa) (agq: SpawnData / SpawnPotentials Properties merged over the written entity, then the Riding loop) driven through the
// unchanged EntityMinecartMobSpawner [xt] on SpawnerCartProbe's world double. Every spawned entity is recorded with its EntityList id, position, rotation
// and the entity it rides; a chain step that cannot be created (null from EntityList.createEntityByName) or an exception is recorded too.
// tools/verify-spawn-data.mjs writes public/research/spawn-data-reference.json.
public class SpawnDataProbe {
  static String q(String s) { return "\"" + s + "\""; }
  static dh c(Object... kv) { return SpawnerCartProbe.compound(kv); }
  static dq l(dh... items) { return SpawnerCartProbe.list(items); }
  static String num(double v) { return MinecartProbe.num(v); }
  static String ent(sa e, List<sa> all) {
    return "{\"id\":" + q(String.valueOf(sg.b(e))) + ",\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u) + ",\"yaw\":" + num(e.y) + ",\"pitch\":" + num(e.z)
      + ",\"rides\":" + (e.m == null ? -1 : all.indexOf(e.m)) + ",\"ridden\":" + (e.l == null ? -1 : all.indexOf(e.l)) + "}";
  }
  static dh spawner(String id, Object... more) {
    List<Object> kv = new ArrayList<>(Arrays.asList("EntityId", id, "Delay", (short) 2, "MinSpawnDelay", (short) 5, "MaxSpawnDelay", (short) 10, "SpawnCount", (short) 2,
      "MaxNearbyEntities", (short) 6, "RequiredPlayerRange", (short) 16, "SpawnRange", (short) 4));
    kv.addAll(Arrays.asList(more));
    return c(kv.toArray());
  }
  static void scenario(String name, long worldSeed, int ticks, dh input) throws Exception {
    SpawnerCartProbe.mobs.clear(); SpawnerCartProbe.seedBase = worldSeed * 1000; SpawnerCartProbe.seedIndex = 0; SpawnerCartProbe.remoteWorld = false;
    Map<String, Class> map = MobSpawnerProbe.names(); Class oc = map.get("CaveSpider"), os = map.get("Spider");
    map.put("CaveSpider", SpawnerCartProbe.SeededCave.class); map.put("Spider", SpawnerCartProbe.SeededSpider.class);
    java.lang.reflect.Field classToName = sg.class.getDeclaredField("d"); classToName.setAccessible(true);
    Map<Class, String> names = (Map<Class, String>) classToName.get(null);
    names.put(SpawnerCartProbe.SeededCave.class, "CaveSpider"); names.put(SpawnerCartProbe.SeededSpider.class, "Spider");
    SpawnerCartProbe.SW w = SpawnerCartProbe.world();
    MobSpawnerProbe.Lcg rand = new MobSpawnerProbe.Lcg(worldSeed); MobMoveProbe.set(w, "s", rand);
    ((List) MobMoveProbe.field(ahb.class, "h").get(w)).add(MobSpawnerProbe.player(11.5, 18, 10.5));
    xt cart = new xt(w, 8.5, 24.5, 8.5);
    MobMoveProbe.set(cart, "Z", new Random(1000)); MobMoveProbe.field(sa.class, "c").setInt(cart, 1);
    SpawnerCartProbe.nbtRead(cart, input);
    agq logic = cart.e();
    String start = NbtProbe.tag(SpawnerCartProbe.nbtWrite(cart));
    StringBuilder rows = new StringBuilder();
    int before = 0;
    for (int t = 0; t < ticks; t++) {
      SpawnerCartProbe.attempts.clear(); SpawnerCartProbe.auxes.clear(); SpawnerCartProbe.events = 0; rand.calls = 0;
      String error = null;
      try {
        if (!cart.K) { cart.S = cart.s; cart.T = cart.t; cart.U = cart.u; cart.A = cart.y; cart.B = cart.z; cart.h(); }
      } catch (Throwable x) { error = x.getClass().getSimpleName(); }
      List<sa> all = SpawnerCartProbe.mobs;
      boolean any = all.size() > before || rand.calls > 0 || error != null;
      if (any) {
        StringBuilder es = new StringBuilder();
        for (int i = before; i < all.size(); i++) es.append(es.length() > 0 ? "," : "").append(ent(all.get(i), all)).append("");
        rows.append(rows.length() > 0 ? "," : "").append("{\"t\":").append(t).append(",\"delay\":").append(logic.b).append(",\"state\":").append(q(Long.toString(rand.state))).append(",\"calls\":").append(rand.calls)
          .append(",\"base\":").append(before).append(",\"attempts\":").append(SpawnerCartProbe.attempts).append(",\"aux\":").append(SpawnerCartProbe.auxes).append(",\"events\":").append(SpawnerCartProbe.events)
          .append(",\"entities\":[").append(es).append("]").append(error != null ? ",\"error\":" + q(error) : "").append("}");
      }
      before = all.size();
    }
    map.put("CaveSpider", oc); map.put("Spider", os);
    names.remove(SpawnerCartProbe.SeededCave.class); names.remove(SpawnerCartProbe.SeededSpider.class);
    System.out.println("{\"case\":\"scenario\",\"name\":" + q(name) + ",\"run\":" + ticks + ",\"worldSeed\":" + worldSeed + ",\"cart\":[8.5,24.5,8.5],\"player\":[11.5,18,10.5],\"floor\":" + SpawnerCartProbe.FLOOR + ",\"input\":" + NbtProbe.tag(input)
      + ",\"start\":" + start + ",\"end\":" + NbtProbe.tag(SpawnerCartProbe.nbtWrite(cart)) + ",\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe(); MobSpawnerProbe.U = PlantProbe.unsafe;
    SpawnerCartProbe.read = xt.class.getDeclaredMethod("a", dh.class); SpawnerCartProbe.read.setAccessible(true);
    SpawnerCartProbe.write = xt.class.getDeclaredMethod("b", dh.class); SpawnerCartProbe.write.setAccessible(true);
    // SpawnData: a skeleton on a spider (EntityId is the rider), a zombie on a chicken on a pig, mount Properties, a Pos on the mount.
    scenario("spider-jockey", 21, 40, spawner("Skeleton", "SpawnData", c("id", "Skeleton", "Riding", c("id", "Spider"))));
    scenario("three-chain", 22, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("id", "Chicken", "Riding", c("id", "Pig")))));
    scenario("mount-properties", 23, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "IsVillager", (byte) 1, "Riding", c("id", "Creeper", "powered", (byte) 1, "Pos", SpawnerCartProbe.list2(1.5, 30, 1.5)))));
    scenario("rider-pos", 24, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Pos", SpawnerCartProbe.list2(10.5, 19, 9.5), "Rotation", rotation(33f, 12f), "Riding", c("id", "Spider"))));
    scenario("mount-unknown-id", 25, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("id", "NoSuchMob", "Riding", c("id", "Pig")))));
    scenario("mount-unknown-then-end", 26, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("id", "NoSuchMob"))));
    scenario("mount-missing-id", 27, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("Foo", "bar"))));
    scenario("riding-not-compound", 28, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", "Spider")));
    scenario("zombie-on-cart", 29, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("id", "MinecartRideable"))));
    scenario("skeleton-on-boat", 30, 40, spawner("Skeleton", "SpawnData", c("id", "Skeleton", "Riding", c("id", "Boat"))));
    scenario("mob-on-chest-cart", 31, 40, spawner("Zombie", "SpawnData", c("id", "Zombie", "Riding", c("id", "MinecartChest"))));
    scenario("potentials-with-riding", 32, 400, spawner("Zombie", "Delay", (short) -1, "SpawnPotentials", l(
      c("Type", "Skeleton", "Weight", 3, "Properties", c("id", "Skeleton", "Riding", c("id", "Spider"))),
      c("Type", "Zombie", "Weight", 1, "Properties", c("id", "Zombie", "Riding", c("id", "Chicken"))),
      c("Type", "Spider", "Weight", 2, "Properties", new dh()))));
    scenario("riding-without-spawn-data-key", 33, 40, spawner("Zombie", "Delay", (short) -1, "SpawnPotentials", l(c("Type", "Zombie", "Weight", 1, "Properties", c("Riding", c("id", "Pig"))))));
    scenario("count-and-riders", 34, 120, spawner("Spider", "MaxNearbyEntities", (short) 3, "SpawnCount", (short) 4, "SpawnData", c("id", "Spider", "Riding", c("id", "Spider"))));
  }
  static dq rotation(float a, float b) { dq r = new dq(); r.a(new dm(a)); r.a(new dm(b)); return r; }
}
