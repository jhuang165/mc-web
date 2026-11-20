import java.lang.reflect.Field;
import java.util.*;

// Batch 86 summon86: the order of the entities an untagged /summon creates. CommandSummon (bu.b) builds the entity from an id-only compound (EntityList.createEntityFromNBT,
// so its Entity constructor takes the next entity id), places it (setLocationAndAngles with the yaw readFromNBT left at 0), runs onSpawnWithEgg(null) and only then
// spawnEntityInWorld. The extras onSpawnWithEgg creates (the ocelot's two kittens, a spider jockey's skeleton, a chicken jockey's chicken) are constructed after the
// summoned mob (higher ids) but join the world list before it. Uses CmdExec83Probe's server, players and world double unchanged (the world double records
// spawnEntityInWorld in order). For each EntityList name and World.rand seed 0..N-1 (World.rand = new Random(seed) before the command):
//   [seed (decimal string: run index * 0x9E3779B97F4A7C15), [[class, id - first id, index of ridingEntity in the list or -1, {writeToNBT keys}]...], World.rand.nextLong() after the command]
// Only the runs that spawned more than one entity are kept beyond the first 40 seeds.
public class Summon86Probe {
  static String q(String s) { return CmdChatProbe.q(s); }

  static void setup() throws Exception {
    PlayerDamageProbe.init();
    sun.misc.Unsafe u = PlayerDamageProbe.u;
    CmdExec83Probe.u = u;
    CmdChatProbe.u = u;
    CmdExec83Probe.W w = (CmdExec83Probe.W) u.allocateInstance(CmdExec83Probe.W.class);
    for (Class<?> c = PlayerDamageProbe.World.class; c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
        f.setAccessible(true); f.set(w, f.get(PlayerDamageProbe.w));
      }
    { Field l = ahb.class.getDeclaredField("L"); l.setAccessible(true); l.set(w, new ArrayList<>()); }
    PlayerDamageProbe.w = w; SuffocationProbe.w = w; DifficultyProbe.w = w;
    pp.a(); pc.a();
    CmdExec83Probe.statsDir = java.nio.file.Files.createTempDirectory("summon86").toFile();
    CmdChatProbe.Srv server = (CmdChatProbe.Srv) u.allocateInstance(CmdChatProbe.Srv.class);
    CmdExec83Probe.server = server;
    oi mgr = (oi) u.allocateInstance(CmdChatProbe.MgrImpl.class);
    Field e = oi.class.getDeclaredField("e"); e.setAccessible(true);
    CmdExec83Probe.online = new ArrayList<>();
    u.putObject(mgr, u.objectFieldOffset(e), CmdExec83Probe.online);
    Field mi = oi.class.getDeclaredField("i"); mi.setAccessible(true);
    u.putObject(mgr, u.objectFieldOffset(mi), server);
    Field uf = net.minecraft.server.MinecraftServer.class.getDeclaredField("u"); uf.setAccessible(true);
    u.putObject(server, u.objectFieldOffset(uf), mgr);
    Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
    u.putObject(u.staticFieldBase(jf), u.staticFieldOffset(jf), server);
    u.putObject(server, u.objectFieldOffset(net.minecraft.server.MinecraftServer.class.getDeclaredField("b")), new qi());
    mt ws = (mt) u.allocateInstance(mt.class);
    for (Field f : ahb.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true); f.set(ws, f.get(w));
    }
    Field wsf = net.minecraft.server.MinecraftServer.class.getDeclaredField("c"); wsf.setAccessible(true);
    wsf.set(server, new mt[] { ws, ws, ws });
    y.a(new CmdExec83Probe.Admin());
    CmdExec83Probe.handler = new z();
    aa summon = new bu();
    CmdExec83Probe.handler.a(summon);
    CmdExec83Probe.byName.put(summon.c(), summon);
    Field of = net.minecraft.server.MinecraftServer.class.getDeclaredField("o"); u.putObject(server, u.objectFieldOffset(of), CmdExec83Probe.handler);
  }

  public static void main(String[] argv) throws Exception {
    setup();
    Field rand = ahb.class.getDeclaredField("s"); rand.setAccessible(true);
    Field idField = sa.class.getDeclaredField("c"); idField.setAccessible(true);
    Field riding = sa.class.getDeclaredField("m"); riding.setAccessible(true);
    String[] keys = { "Age", "IsBaby", "IsVillager", "Color", "Profession", "SkeletonType", "Type", "Variant", "CatType", "CanPickUpLoot" };
    String[][] kinds = { { "Ozelot", "400" }, { "Spider", "2000" }, { "Zombie", "4000" }, { "PigZombie", "4000" }, { "Skeleton", "40" }, { "Chicken", "40" }, { "Sheep", "40" },
      { "Villager", "40" }, { "EntityHorse", "40" }, { "Pig", "40" } };
    CmdExec83Probe.fresh("solo");
    StringBuilder out = new StringBuilder("{\"order\":[");
    boolean firstKind = true;
    for (String[] k : kinds) {
      int n = Integer.parseInt(k[1]);
      StringBuilder rows = new StringBuilder("[");
      boolean firstRow = true;
      for (int seed = 0; seed < n; seed++) {
        CmdExec83Probe.W.spawned.clear(); CmdExec83Probe.admin.clear();
        long rowSeed = seed * 0x9E3779B97F4A7C15L; // consecutive small seeds give near-linear first draws; the golden-ratio multiple spreads them
        Random r = new Random(rowSeed);
        rand.set(PlayerDamageProbe.w, r);
        String crash = null;
        try { CmdExec83Probe.byName.get("summon").b(CmdExec83Probe.alex, new String[] { k[0], "0.5", "64", "0.5" }); } catch (Throwable t) { crash = String.valueOf(t); }
        List<sa> got = new ArrayList<>(CmdExec83Probe.W.spawned);
        if (seed >= 40 && got.size() <= 1 && crash == null) continue;
        int first = Integer.MAX_VALUE;
        for (sa s : got) first = Math.min(first, idField.getInt(s));
        StringBuilder list = new StringBuilder("[");
        for (sa s : got) {
          dh tag = new dh();
          String nbt;
          try {
            s.e(tag);
            StringBuilder kb = new StringBuilder("{");
            for (String key : keys) if (tag.c(key)) kb.append(kb.length() > 1 ? "," : "").append(q(key)).append(":").append(q(tag.a(key).toString()));
            nbt = kb.append("}").toString();
          } catch (Throwable t) { nbt = q("!" + t); }
          Object m = riding.get(s);
          list.append(list.length() > 1 ? "," : "").append("[" + q(s.getClass().getName()) + "," + (idField.getInt(s) - first) + "," + (m == null ? -1 : got.indexOf(m)) + "," + nbt + "]");
        }
        list.append("]");
        rows.append(firstRow ? "" : ",").append("[" + q(Long.toString(rowSeed)) + "," + list + "," + q(Long.toString(r.nextLong())) + (crash != null ? "," + q(crash) : "") + "]");
        firstRow = false;
      }
      rows.append("]");
      out.append(firstKind ? "" : ",").append("[" + q(k[0]) + "," + n + "," + rows + "]");
      firstKind = false;
    }
    System.out.println(out.append("]}"));
  }
}
