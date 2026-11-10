import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Runs the unchanged EntityVillager (yv), EntityAgeable (rx), EntityCreature (td), the villager's
// EntityAI* classes (tw avoid, uf swim, vl trade, uo look at trade, ur move indoors, ve restrict open
// door, uy open door, ut move towards restriction, up villager mate, vj follow golem, va play, ul/un
// watch closest, vc wander), the wooden BlockDoor (akn), the PathFinder (ayg) and ModelVillager (bik)
// from the 1.7.10 JAR on top of a flat-world double (stone below y 0, MobMoveProbe style). The villager
// is built with its real constructor, so the task list is the original one. World.A is a real, empty
// VillageCollection (wc), so the village lookup answers null and detachHome runs; no village exists.
// Every tick is Entity.onUpdate (sa.h): the living-sound roll, then onLivingUpdate (sv.e) with the AI.
// Prints one JSON object per line: facts, tasks, sounds, drops, model, wander, avoid, door.
public class VillagerProbe {
  static final Map<String, String> NAMES = new HashMap<>();
  static {
    NAMES.put("uf", "EntityAISwimming"); NAMES.put("tw", "EntityAIAvoidEntity"); NAMES.put("vl", "EntityAITradePlayer");
    NAMES.put("uo", "EntityAILookAtTradePlayer"); NAMES.put("ur", "EntityAIMoveIndoors"); NAMES.put("ve", "EntityAIRestrictOpenDoor");
    NAMES.put("uy", "EntityAIOpenDoor"); NAMES.put("ut", "EntityAIMoveTowardsRestriction"); NAMES.put("up", "EntityAIVillagerMate");
    NAMES.put("vj", "EntityAIFollowGolem"); NAMES.put("va", "EntityAIPlay"); NAMES.put("ul", "EntityAIWatchClosest2");
    NAMES.put("vc", "EntityAIWander"); NAMES.put("un", "EntityAIWatchClosest");
  }
  static String name(Object o) { String n = o.getClass().getName(); return NAMES.getOrDefault(n, n); }

  static String key(int x, int y, int z) { return x + "," + y + "," + z; }

  public static class World extends MobMoveProbe.ProbeWorld {
    static Map<String, int[]> cells = new HashMap<>(); // x,y,z -> {id, meta}
    static List<sa> entities = new ArrayList<>();
    static List<String> sounds = new ArrayList<>();
    static List<Object> spawned = new ArrayList<>();
    static List<String> aux = new ArrayList<>();
    static int[] cell(int x, int y, int z) { return cells.get(key(x, y, z)); }
    public aji a(int x, int y, int z) { int[] c = cell(x, y, z); return c != null ? aji.e(c[0]) : super.a(x, y, z); }
    boolean floor(int x, int y, int z) { return super.floor(x, y, z) && cell(x, y, z) == null; } // batch 32: a water pool replaces the floor cell
    public int e(int x, int y, int z) { int[] c = cell(x, y, z); return c != null ? c[1] : 0; }
    public boolean a(int x, int y, int z, int meta, int flags) { int[] c = cell(x, y, z); if (c == null) return false; c[1] = meta; return true; }
    public void c(int x0, int y0, int z0, int x1, int y1, int z1) {}
    public void a(yz player, int event, int x, int y, int z, int data) { aux.add(event + "|" + x + "," + y + "," + z); }
    public float n(int x, int y, int z) { return 1.0f; }
    public java.util.Calendar V() { java.util.Calendar c = java.util.Calendar.getInstance(); c.setTimeInMillis(1592200000000L); return c; } // batch 31: World.getCurrentDate (EntityZombie.onSpawnWithEgg's Halloween pumpkin check), a fixed mid-June date
    static float localDiff = 0.0f; // batch 37: record field `local`
    public float B(int x, int y, int z) { return localDiff; } // batch 31: World.func_147462_b (regional difficulty) reads a chunk; EntityZombie.onSpawnWithEgg of a converted villager asks, and its result is not observed
    static int light = 15; // batch 32: a dark scenario lets a Hard zombie's reinforcement site search find a spot
    public int k(int x, int y, int z) { return light; } // batch 31: World.getBlockLightValue (a Hard zombie's reinforcement site search reads it; fully lit, so none is ever spawned)
    public ahu a(int x, int z) { return ahu.d(1); } // plains: MoveIndoors reads its biome
    // Batch 30: World.rayTraceBlocks is the real one (EntitySenses.canSee, doors in the way) only when VillageFightProbe asks; every other probe keeps the stub its reference was recorded with.
    static boolean realRays = false;
    public azu a(azw a, azw b) { return realRays ? super.a(a, b) : null; }
    public azu a(azw a, azw b, boolean c) { return realRays ? super.a(a, b, c) : null; }
    public azu a(azw a, azw b, boolean c, boolean d, boolean e) { return realRays ? super.a(a, b, c, d, e) : null; }
    public boolean d(sa entity) { if (!unloaded.isEmpty() && !(entity instanceof yz) && unloaded.contains(chunkKey(qh.c(entity.s / 16.0), qh.c(entity.u / 16.0)))) return false; spawned.add(entity); if (pickEntities && ((immediateZombies && entity instanceof yq) || (immediateChickens && entity instanceof wg) || (immediateMobs && (entity instanceof yn || entity instanceof yl)))) entities.add(entity); return true; } // batch 33: World.spawnEntityInWorld makes an entity visible to getEntitiesWithinAABB at once (VillageFightProbe b33 records; earlier records keep the drain-time add)
    static boolean immediateZombies = false;
    static boolean immediateMobs = false; // batch 37: a spider and its skeleton jockey join the entity list at once
    static boolean immediateChickens = false; // batch 36: a chicken a baby zombie spawns joins the entity list at once (as immediateZombies)
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    // World.getClosestPlayerToEntity (a(sa, D)): only VillageFightProbe fills this (batch 29), so EntityLiving.despawnEntity sees its player; elsewhere null as before.
    static List<yz> closePlayers = null;
    public yz a(sa e, double d) {
      if (closePlayers == null) return null;
      yz best = null; double bd = -1;
      for (yz p : closePlayers) { double dx = p.s - e.s, dy = p.t - e.t, dz = p.u - e.u, q = dx * dx + dy * dy + dz * dz; if ((d < 0 || q < d * d) && (bd == -1 || q < bd)) { bd = q; best = p; } }
      return best;
    }
    public yz b(sa e, double d) { return null; }
    // Batch 29: VillageFightProbe turns this on so entities push each other and collideWithEntity runs (getEntitiesWithinAABBExcludingEntity); every
    // other probe leaves it off and keeps the empty answer its reference was recorded with.
    static boolean pickEntities = false;
    static List others(sa entity, azt box, sj selector) {
      List out = new ArrayList();
      for (sa o : entities) if (o != entity && o.C.b(box) && (selector == null || selector.a(o))) out.add(o);
      return out;
    }
    public List b(sa entity, azt box) { return pickEntities ? others(entity, box, null) : new ArrayList(); }
    public List a(sa entity, azt box) {
      List out = super.a(entity, box);
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            if (cell(x, y, z) != null) a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
    static List pick(Class c, azt box, sj selector) {
      List out = new ArrayList();
      for (sa o : entities) if (c.isInstance(o) && o.C.b(box) && (selector == null || selector.a(o))) out.add(o);
      return out;
    }
    public List a(sa entity, azt box, sj selector) { return pickEntities ? others(entity, box, selector) : new ArrayList(); }
    public List a(Class c, azt box) { return pick(c, box, null); }
    public List a(Class c, azt box, sj selector) { return pick(c, box, selector); }
    // Batch 34: with `chunkCache` on, World.getEntityPathToXYZ / getPathEntityToEntity are the real ones in everything but where the blocks come from: the real ChunkCache (ahr) over real Chunks
    // (apx, apz storage filled from `cells`; y < 0, where the probe floor is, and chunks without a cell read as air exactly as ahr.a answers). The PathFinder only reads it for the swimming start loop. `unloaded` chunk keys model a ChunkProviderServer
    // that has not loaded them: World.checkChunksExist (b) is false over them and World.spawnEntityInWorld (d) refuses a non-player entity in them (chunkExists), as natively.
    static boolean chunkCache = false;
    static java.util.Set<Long> unloaded = new java.util.HashSet<>();
    static long chunkKey(int cx, int cz) { return ((long) cx << 32) ^ (cz & 0xffffffffL); }
    static java.util.Map<Long, apx> image = new HashMap<>(); static long imageStamp = Long.MIN_VALUE; static boolean serving = false;
    public apx e(int cx, int cz) { return serving ? image.get(chunkKey(cx, cz)) : null; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) {
      if (unloaded.isEmpty()) return true;
      if (y1 < 0 || y0 > 255) return false; // World.checkChunksExist: the native y test comes first
      for (int cx = x0 >> 4; cx <= x1 >> 4; cx++) for (int cz = z0 >> 4; cz <= z1 >> 4; cz++) if (unloaded.contains(chunkKey(cx, cz))) return false;
      return true;
    }
    static void refreshImage() throws Exception {
      long stamp = cells.size();
      for (Map.Entry<String, int[]> en : cells.entrySet()) stamp += en.getKey().hashCode() * 1000003L + en.getValue()[0] * 131L + en.getValue()[1] * 7L;
      if (stamp == imageStamp) return;
      imageStamp = stamp; image = new HashMap<>();
      for (Map.Entry<String, int[]> en : cells.entrySet()) {
        String[] k = en.getKey().split(",");
        int x = Integer.parseInt(k[0]), y = Integer.parseInt(k[1]), z = Integer.parseInt(k[2]);
        if (y < 0 || y > 255) continue;
        apx chunk = image.computeIfAbsent(chunkKey(x >> 4, z >> 4), key -> new apx(null, x >> 4, z >> 4));
        apz[] storage = (apz[]) MobMoveProbe.field(apx.class, "u").get(chunk);
        if (storage[y >> 4] == null) storage[y >> 4] = new apz(y >> 4 << 4, true);
        storage[y >> 4].a(x & 15, y & 15, z & 15, aji.e(en.getValue()[0]));
        storage[y >> 4].a(x & 15, y & 15, z & 15, en.getValue()[1]);
      }
    }
    ahr cacheAround(sa e, double centreY, int pad, float range) {
      try {
        refreshImage();
        int cx = qh.c(e.s), cy = qh.c(centreY), cz = qh.c(e.u), r = (int) (range + pad);
        serving = true;
        try { return new ahr(this, cx - r, cy - r, cz - r, cx + r, cy + r, cz + r, 0); } finally { serving = false; }
      } catch (Exception ex) { throw new RuntimeException(ex); }
    }
    // Batch 35: every native search is counted: `searches` lists [points the PathFinder created (its IntHashMap `c` size), 1 when it returned a path]; `tick` is set by the fight probe. Wall-clock nanoseconds go to `searchNanos`
    // (not recorded: timing is not deterministic).
    static java.util.List<long[]> searches = new ArrayList<>(); static java.util.List<Long> searchNanos = new ArrayList<>(); static int tick = 0;
    static ayf counted(ayg finder, java.util.concurrent.Callable<ayf> run) {
      try {
        long t0 = System.nanoTime(); ayf path = run.call(); long dt = System.nanoTime() - t0;
        pz map = (pz) MobMoveProbe.field(ayg.class, "c").get(finder);
        searches.add(new long[] {tick, MobMoveProbe.field(pz.class, "b").getInt(map), path == null ? 0 : 1}); searchNanos.add(dt);
        if (System.getenv("VF_PATHS") != null) { // batch 37 development aid: the path every native search returned, as x,y,z points on stderr
          StringBuilder pb = new StringBuilder("path " + (searches.size() - 1) + " tick " + tick + " points " + (path == null ? "null" : path.d() + ":"));
          if (path != null) for (int k = 0; k < path.d(); k++) { aye q = path.a(k); pb.append(" ").append(q.a).append(",").append(q.b).append(",").append(q.c); }
          java.nio.file.Files.writeString(java.nio.file.Path.of(System.getenv("VF_PATHS")), pb + "\n", java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        }
        if (System.getenv("VF_DUMPSEARCH") != null && searches.size() == Integer.parseInt(System.getenv("VF_DUMPSEARCH"))) { // development aid: every point (x y z visited) of the nth search of this run
          StringBuilder b = new StringBuilder(); qa[] table = (qa[]) MobMoveProbe.field(pz.class, "a").get(map);
          for (qa head : table) for (qa en = head; en != null; en = en.c) { aye p = (aye) en.b; b.append(p.a).append(' ').append(p.b).append(' ').append(p.c).append(' ').append(p.i ? 1 : 0).append('\n'); }
          java.nio.file.Files.writeString(java.nio.file.Path.of(System.getenv("VF_DUMPFILE")), b.toString());
        }
        return path;
      } catch (Exception ex) { throw new RuntimeException(ex); }
    }
    public ayf a(sa e, int x, int y, int z, float range, boolean open, boolean doors, boolean water, boolean swim) { ayg f = new ayg(chunkCache ? cacheAround(e, e.t, 8, range) : this, open, doors, water, swim); return counted(f, () -> f.a(e, x, y, z, range)); }
    public ayf a(sa e, sa target, float range, boolean open, boolean doors, boolean water, boolean swim) { ayg f = new ayg(chunkCache ? cacheAround(e, e.t + 1.0, 16, range) : this, open, doors, water, swim); return counted(f, () -> f.a(e, target, range)); }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static float fl(Object o, String n) throws Exception { return MobMoveProbe.fl(o, n); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }

  static yv villager(World w, int profession, double x, double z, long seed) throws Exception {
    yv e = new yv(w, profession);
    MobMoveProbe.set(e, "Z", new Random(seed));
    for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f); // the EntityLivingBase constructor rolls rotationYaw from Math.random()
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, 0.0, z);
    return e;
  }

  static void reset() { World.cells.clear(); World.entities.clear(); World.sounds.clear(); World.spawned.clear(); World.aux.clear(); }

  static List<uk> entries(yv e) throws Exception {
    Field c = sw.class.getDeclaredField("c"); c.setAccessible(true);
    Field b = uj.class.getDeclaredField("b"); b.setAccessible(true);
    return (List<uk>) b.get(c.get(e));
  }

  static String running(yv e) throws Exception {
    Field c = sw.class.getDeclaredField("c"); c.setAccessible(true);
    Field l = uj.class.getDeclaredField("c"); l.setAccessible(true);
    StringBuilder s = new StringBuilder();
    for (Object o : (List) l.get(c.get(e))) { uk k = (uk) o; s.append(s.length() > 0 ? "+" : "").append(name(k.a)); }
    return s.toString();
  }

  static String params(Object action) throws Exception {
    StringBuilder s = new StringBuilder("{");
    boolean first = true;
    List<Field> all = new ArrayList<>();
    for (Class<?> c = action.getClass(); c != ui.class; c = c.getSuperclass()) for (Field f : c.getDeclaredFields()) all.add(f);
    for (Field f : all) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      Class<?> t = f.getType();
      if (t != double.class && t != float.class && t != int.class && t != boolean.class) continue;
      f.setAccessible(true);
      s.append(first ? "" : ",").append('"').append(f.getName()).append("\":").append(f.get(action));
      first = false;
    }
    return s.append("}").toString();
  }

  static int mutex(Object action) throws Exception {
    Field f = ui.class.getDeclaredField("a"); f.setAccessible(true);
    return f.getInt(action);
  }

  static void tick(yv e) throws Exception {
    MobMoveProbe.set(e, "p", d(e, "s"));
    MobMoveProbe.set(e, "q", d(e, "t"));
    MobMoveProbe.set(e, "r", d(e, "u"));
    e.h();
  }

  static String state(yv e) throws Exception {
    return "{\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
      + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x"))
      + ",\"yaw\":" + num(fl(e, "y")) + ",\"head\":" + num(fl(e, "aO")) + ",\"body\":" + num(fl(e, "aM"))
      + ",\"onGround\":" + MobMoveProbe.b(e, "D") + ",\"limbSwingAmount\":" + num(fl(e, "aF")) + ",\"limbSwing\":" + num(fl(e, "aG"))
      + ",\"running\":\"" + running(e) + "\"}";
  }

  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
    return s.append("]").toString();
  }

  static String box(bix r) {
    return "{\"point\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "]}";
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(world, "A", new wc(world));

    // facts: constructor size, attribute bases, eye height, age, profession range
    yv base = villager(world, 0, 64.5, 64.5, 1);
    System.out.println("{\"case\":\"facts\",\"width\":" + num(fl(base, "M")) + ",\"height\":" + num(fl(base, "N"))
      + ",\"maxHealth\":" + num(((ti) base.a(yj.a)).e()) + ",\"speed\":" + num(((ti) base.a(yj.d)).e())
      + ",\"followRange\":" + num(((ti) base.a(yj.b)).e()) + ",\"knockbackResistance\":" + num(((ti) base.a(yj.c)).e())
      + ",\"eyeHeight\":" + num(base.g()) + ",\"health\":" + num(base.aS()) + ",\"age\":" + base.d() + ",\"profession\":" + base.bZ()
      + ",\"aiEnabled\":" + MobMoveProbe.method(yv.class, "bk").invoke(base) + ",\"talkInterval\":" + base.q()
      + ",\"experienceValue\":" + MobMoveProbe.fl(base, "b") + ",\"canDespawn\":" + MobMoveProbe.method(sw.class, "v").invoke(base)
      + ",\"breakDoors\":" + MobMoveProbe.b(base.m(), "l") + ",\"avoidsWater\":" + MobMoveProbe.b(base.m(), "m") + "}");

    // tasks: priority, action class, mutex bits and the numeric constructor fields
    StringBuilder tl = new StringBuilder();
    List<uk> list = entries(base);
    for (int i = 0; i < list.size(); i++) {
      uk k = list.get(i);
      tl.append(i > 0 ? "," : "").append("{\"priority\":").append(k.b).append(",\"class\":\"").append(name(k.a)).append("\",\"mutex\":").append(mutex(k.a)).append(",\"params\":").append(params(k.a)).append("}");
    }
    Field tf = sw.class.getDeclaredField("d"); tf.setAccessible(true);
    Field tb = uj.class.getDeclaredField("b"); tb.setAccessible(true);
    System.out.println("{\"case\":\"tasks\",\"tasks\":[" + tl + "],\"targetTasks\":" + ((List) tb.get(tf.get(base))).size() + "}");

    // sounds: names, volume, pitch for the adult and a child (-24000), over seeded Entity.rand
    {
      Method idle = MobMoveProbe.method(yv.class, "t"), hit = MobMoveProbe.method(yv.class, "aT"), death = MobMoveProbe.method(yv.class, "aU"),
        vol = MobMoveProbe.method(sv.class, "bf"), pitch = MobMoveProbe.method(sv.class, "bg");
      StringBuilder pitches = new StringBuilder();
      for (int child = 0; child < 2; child++)
        for (long seed = 0; seed < 4; seed++) {
          yv e = villager(world, 0, 64.5, 64.5, seed);
          if (child == 1) e.c(-24000);
          pitches.append(pitches.length() > 0 ? "," : "").append("{\"child\":").append(child == 1).append(",\"seed\":").append(seed).append(",\"pitch\":").append(num((Float) pitch.invoke(e))).append("}");
        }
      System.out.println("{\"case\":\"sounds\",\"idle\":\"" + idle.invoke(base) + "\",\"hit\":\"" + hit.invoke(base) + "\",\"death\":\"" + death.invoke(base)
        + "\",\"volume\":" + num((Float) vol.invoke(base)) + ",\"pitches\":[" + pitches + "]}");
    }

    // drops: dropFewItems over seeded Entity.rand (alive, looting 0 and 3, burning), plus experience
    {
      Method drop = MobMoveProbe.method(yv.class, "b", boolean.class, int.class);
      int items = 0;
      for (int looting = 0; looting <= 3; looting += 3)
        for (long seed = 0; seed < 200; seed++) {
          reset();
          yv e = villager(world, (int) (seed % 5), 64.5, 64.5, seed);
          if (seed % 2 == 1) e.e(10);
          drop.invoke(e, true, looting);
          items += World.spawned.size();
        }
      Method xp = MobMoveProbe.method(sw.class, "e", yz.class);
      System.out.println("{\"case\":\"drops\",\"trials\":400,\"items\":" + items + ",\"experience\":" + xp.invoke(base, (Object) null) + "}");
    }

    // model: ModelVillager parts, then the limb angles for a few swings (ModelVillager.setRotationAngles)
    {
      bik m = new bik(0.0f);
      System.out.print("{\"case\":\"model\",\"parts\":");
      ModelProbe.dump("villager", m);
    }

    // wander: only the AI (no player, no entity) runs. The first three seeds from 1 whose villager starts an
    // EntityAIWander walk inside 500 ticks are recorded, each for 500 ticks.
    for (long seed = 1, found = 0; found < 3 && seed < 200; seed++) {
      reset();
      yv e = villager(world, 0, 64.5, 64.5, seed);
      StringBuilder out = new StringBuilder();
      boolean walked = false;
      for (int i = 0; i < 500; i++) { tick(e); String st = state(e); walked |= st.contains("Wander"); out.append(i > 0 ? "," : "").append(st); }
      if (!walked) continue;
      found++;
      System.out.println("{\"case\":\"wander\",\"seed\":" + seed + ",\"profession\":0,\"start\":[64.5,0,64.5],\"sounds\":" + strings(World.sounds) + ",\"ticks\":[" + out + "]}");
    }

    // avoid: a zombie (yq) at a scripted position; static at 2.5 blocks, and walking at 0.2 a tick toward the villager
    {
      String[] modes = {"static", "chase"};
      for (String mode : modes) {
        reset();
        yv e = villager(world, 3, 64.5, 64.5, 5);
        yq z = new yq(world);
        World.entities.add(z);
        StringBuilder out = new StringBuilder(), zs = new StringBuilder();
        for (int i = 0; i < 100; i++) {
          double zx = 64.5, zz = mode.equals("static") ? 67.0 : Math.max(66.0, 80.0 - 0.2 * i);
          MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(z, zx, 0.0, zz);
          tick(e);
          out.append(i > 0 ? "," : "").append(state(e));
          zs.append(i > 0 ? "," : "").append("[").append(zx).append(",").append(zz).append("]");
        }
        System.out.println("{\"case\":\"avoid\",\"mode\":\"" + mode + "\",\"seed\":5,\"profession\":3,\"start\":[64.5,0,64.5],\"zombie\":[" + zs + "],\"ticks\":[" + out + "]}");
      }
    }

    // door: a stone wall at x = 66 (z 56..72, y 0..3) with a wooden door at (66, 0|1, 64), closed, facing 0. The villager is given
    // the navigator target (69.5, 0, 64.5) after tick 0 (EntityAITasks wander would otherwise pick it). Wander is kept out of the window
    // by choosing the seed: the recorded `running` shows what ran.
    {
      for (long seed : new long[] {4, 9}) {
        reset();
        for (int z = 56; z <= 72; z++) for (int y = 0; y <= 3; y++) World.cells.put(key(66, y, z), new int[] {1, 0});
        World.cells.put(key(66, 0, 64), new int[] {64, 0});
        World.cells.put(key(66, 1, 64), new int[] {64, 8});
        yv e = villager(world, 1, 62.5, 64.5, seed);
        StringBuilder out = new StringBuilder(), doors = new StringBuilder();
        int lead = 0;
        while (!MobMoveProbe.b(e, "D")) { tick(e); lead++; out.append(state(e)).append(","); doors.append(World.cell(66, 0, 64)[1]).append(","); } // the navigator needs onGround
        boolean ok = e.m().a(69.5, 0.0, 64.5, 0.6);
        for (int i = lead; i < 120; i++) {
          tick(e);
          out.append(i > lead ? "," : "").append(state(e));
          doors.append(i > lead ? "," : "").append(World.cell(66, 0, 64)[1]);
        }
        System.out.println("{\"case\":\"door\",\"seed\":" + seed + ",\"profession\":1,\"start\":[62.5,0,64.5],\"goal\":[69.5,0,64.5],\"speed\":0.6,\"lead\":" + lead + ",\"lead\":" + lead + ",\"pathFound\":" + ok
          + ",\"door\":[66,0,64],\"doorMeta\":[" + doors + "],\"aux\":" + strings(World.aux) + ",\"sounds\":" + strings(World.sounds) + ",\"ticks\":[" + out + "]}");
      }
    }
  }
}
