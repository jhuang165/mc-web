import java.lang.reflect.Field;
import java.util.*;

// Batch 101 (mobrec101): iron golem spawn gating of Village.tick (vz.a(int)) from the unchanged 1.7.10 classes on the VillageLiveProbe world:
// villagers / 10 > golems, doors > 20, World.rand.nextInt(7000) == 0, then the 10-try spawn box search (vz.a(IIIIII): nextInt(16), nextInt(6), nextInt(16)).
// The villager and golem counts come from World.getEntitiesWithinAABB (the probe's entity list); a spawned golem is added to that list so the next recount sees it.
// Script ops (tick op args): door x y z meta, rmdoor x y z, vill x y z (a villager with its feet at y), golem x y z, fill x0 y0 z0 x1 y1 z1 (stone).
// Output, one JSON object per line: case gate101 with name, seed, ticks, script, spawns [[tick, x, y, z, golems counted after]], zeroRolls [tick of each nextInt(7000) == 0],
// draws [[tick, bound, value]] of the search (bounds 16 and 6), snaps [[tick, villages digest]] every 500 ticks.
public class VillageGate101Probe {
  static int tick;
  static class G101Random extends Random {
    static List<String> draws = new ArrayList<>(), zero = new ArrayList<>();
    G101Random(long seed) { super(seed); }
    public int nextInt(int bound) {
      int r = super.nextInt(bound);
      if (bound == 7000 && r == 0) zero.add("" + tick);
      if (bound == 16 || bound == 6) draws.add("[" + tick + "," + bound + "," + r + "]");
      return r;
    }
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String[] cat(String[]... a) { List<String> l = new ArrayList<>(); for (String[] x : a) l.addAll(Arrays.asList(x)); return l.toArray(new String[0]); }
  static String[] vills(int n, double y) { String[] s = new String[n]; for (int i = 0; i < n; i++) s[i] = "0 vill 52.5 " + y + " 52.5"; return s; }

  static void run(String name, long seed, int ticks, String[] script) throws Exception {
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    MobMoveProbe.set(VillageLiveProbe.world, "s", new G101Random(seed));
    G101Random.draws.clear(); G101Random.zero.clear();
    List<String> spawns = new ArrayList<>(), snaps = new ArrayList<>();
    int seen = 0;
    for (tick = 0; tick <= ticks; tick++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != tick) continue;
        switch (p[1]) {
          case "door": VillageLiveProbe.door(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), Integer.parseInt(p[5])); break;
          case "rmdoor": VillageLiveProbe.rmdoor(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); break;
          case "vill": { yv v = VillageLiveProbe.vill(Double.parseDouble(p[2]), Double.parseDouble(p[4]), 200 + VillagerProbe.World.entities.size(), 0); v.b(Double.parseDouble(p[2]), Double.parseDouble(p[3]), Double.parseDouble(p[4])); break; }
          case "golem": { wt g = new wt(VillageLiveProbe.world); g.b(Double.parseDouble(p[2]), Double.parseDouble(p[3]), Double.parseDouble(p[4])); VillagerProbe.World.entities.add(g); break; }
          case "fill": for (int x = Integer.parseInt(p[2]); x <= Integer.parseInt(p[5]); x++) for (int y = Integer.parseInt(p[3]); y <= Integer.parseInt(p[6]); y++) for (int z = Integer.parseInt(p[4]); z <= Integer.parseInt(p[7]); z++) VillageLiveProbe.put(x, y, z, 1, 0); break;
          default: throw new IllegalStateException(op);
        }
      }
      if (tick % 60 == 0) c.a(52, 0, 52);
      c.a();
      while (seen < VillagerProbe.World.spawned.size()) {
        sa g = (sa) VillagerProbe.World.spawned.get(seen++);
        VillagerProbe.World.entities.add(g);
        spawns.add("[" + tick + "," + VillageLiveProbe.num(MobMoveProbe.d(g, "s")) + "," + VillageLiveProbe.num(MobMoveProbe.d(g, "t")) + "," + VillageLiveProbe.num(MobMoveProbe.d(g, "u")) + "," + VillageLiveProbe.gi(c.b().get(0), "l") + "]");
      }
      if (tick % 500 == 0) snaps.add("[" + tick + "," + VillageLiveProbe.villages(c) + "]");
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"gate101\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"script\":[" + sc + "],\"spawns\":[" + String.join(",", spawns) + "],\"zeroRolls\":[" + String.join(",", G101Random.zero) + "],\"draws\":[" + String.join(",", G101Random.draws) + "],\"snaps\":[" + String.join(",", snaps) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    VillageLiveProbe.W w = (VillageLiveProbe.W) u.allocateInstance(VillageLiveProbe.W.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);

    String[] d20 = VillageLiveProbe.grid(20, 0), d21 = VillageLiveProbe.grid(21, 0);
    String[] g1 = {"0 golem 52.5 0 52.5"}, g2 = {"0 golem 52.5 0 52.5", "0 golem 53.5 0 52.5"};
    run("gate-ctrl-42", 42, 4500, cat(d21, vills(10, 0)));
    run("gate-ctrl-43", 43, 4500, cat(d21, vills(10, 0)));
    run("gate-doors20-42", 42, 4500, cat(d20, vills(10, 0)));
    run("gate-doors20-vill30-42", 42, 4500, cat(d20, vills(30, 0)));
    run("gate-vill9-42", 42, 4500, cat(d21, vills(9, 0)));
    run("gate-vill19-golem1-42", 42, 4500, cat(d21, vills(19, 0), g1));
    run("gate-vill20-golem1-42", 42, 4500, cat(d21, vills(20, 0), g1));
    run("gate-vill20-golem2-42", 42, 4500, cat(d21, vills(20, 0), g2));
    run("gate-vill-high-42", 42, 4500, cat(d21, vills(10, 10)));
    run("gate-vill-edge-top-42", 42, 4500, cat(d21, vills(5, 3.9375), vills(5, 4.0)));
    run("gate-vill-edge-in-42", 42, 4500, cat(d21, vills(10, 3.9375)));
    run("gate-vill-edge-low-42", 42, 4500, cat(d21, vills(5, -5.75), vills(5, -5.8125)));
    run("gate-vill-late-42", 42, 4500, cat(d21, vills(9, 0), new String[] {"1000 vill 52.5 0 52.5"}));
    run("gate-door-late-42", 42, 4500, cat(d20, vills(10, 0), new String[] {"1500 door 50 0 62 0"}));
    run("gate-door-removed-42", 42, 4500, cat(d21, vills(10, 0), new String[] {"500 rmdoor 50 0 62"}));
    run("gate-slab1-42", 42, 4500, cat(d21, vills(10, 0), new String[] {"0 fill 30 1 30 80 1 80"}));
    run("gate-slab3-42", 42, 4500, cat(d21, vills(10, 0), new String[] {"0 fill 30 3 30 80 3 80"}));
    run("gate-pillars-42", 42, 4500, cat(d21, vills(10, 0), new String[] {"0 fill 30 0 30 48 4 80"}));
    run("gate-long-vill20-42", 42, 12000, cat(d21, vills(20, 0)));
    run("gate-long-vill10-42", 42, 12000, cat(d21, vills(10, 0)));
  }
}
