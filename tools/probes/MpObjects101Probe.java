import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

// Batch 101 mpobjects101. Which World.setEntityState (S19) statuses a real 1.7.10 EntityVillager (yv) sends, and on which tick: the unchanged classes run in VillageFightProbe's village
// double (EntityAIVillagerMate, EntityVillager.useRecipe / the restock timer, setRevengeTarget) with the world's setEntityState (ahb.a(sa, byte)) recording [tick, entity class, status, growing age].
// Records: one JSON line per scenario: {name, ticks, statuses: [[tick, "EntityVillager", status]...]}. VillageFightProbe's own fight records are discarded.
public class MpObjects101Probe {
  public static class W101 extends VillageLiveProbe.W {
    static List<String> states = new ArrayList<>();
    public void a(sa e, byte b) { states.add("[" + VillagerProbe.World.tick + ",\"" + e.getClass().getSimpleName() + "\"," + b + "," + (e instanceof rx ? ((rx) e).d() : 0) + "]"); } // [tick, class, status, the entity's growing age (rx.d(): -24000 a newborn child)]
  }
  static void run(String name, long seed, int ticks, String types, double[][] pos, String[] script) throws Exception {
    W101.states.clear();
    PrintStream real = System.out;
    System.setOut(new PrintStream(new ByteArrayOutputStream()));
    try { VillageFightProbe.scenario(name, seed, ticks, types, pos, script); } finally { System.setOut(real); }
    System.out.println("{\"name\":\"" + name + "\",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"types\":\"" + types + "\",\"script\":" + Arrays.toString(Arrays.stream(script).map(s -> "\"" + s + "\"").toArray()) + ",\"statuses\":[" + String.join(",", W101.states) + "]}");
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    VillageLiveProbe.W w = (VillageLiveProbe.W) u.allocateInstance(W101.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    VillageFightProbe.local = 0; VillageFightProbe.eggTimer = 6000; VillageFightProbe.bright = 15; VillageFightProbe.patches = new int[][] {};
    double[][] pair = {{58.5, 52.5}, {60.5, 56.5}, {30.5, 30.5}};
    double[][] talk = {{52.5, 54.5}, {49.5, 54.5}};
    // 12: the mating task in a village of 12 doors (the b98 breeding layout; the seeds are b98's)
    ArrayList<int[]> doors = new ArrayList<>();
    for (int i = 1; i < 12; i++) { doors.add(new int[] {50, 0, 50 + 3 * i, 50, 0, 50 + 3 * i, 64, 0}); doors.add(new int[] {50, 1, 50 + 3 * i, 50, 1, 50 + 3 * i, 64, 8}); }
    VillageFightProbe.blocks = doors.toArray(new int[0][]);
    for (int sd : new int[] {9813}) run("b100-m101-breed-" + sd, sd, 1800, "VV", pair, new String[] {"0 day on"});
    run("b100-m101-breed-birth-9902", 9902, 2400, "VV", pair, new String[] {"0 day on"}); // b98's record with a birth: the child (growing age -24000) gets its own 12
    ArrayList<int[]> doors9 = new ArrayList<>();
    for (int i = 1; i < 9; i++) { doors9.add(new int[] {50, 0, 50 + 3 * i, 50, 0, 50 + 3 * i, 64, 0}); doors9.add(new int[] {50, 1, 50 + 3 * i, 50, 1, 50 + 3 * i, 64, 8}); }
    VillageFightProbe.blocks = doors9.toArray(new int[0][]);
    run("b100-m101-breed-birth-10072", 10072, 800, "VV", pair, new String[] {"0 day on"}); // b99's 9-door birth
    VillageFightProbe.blocks = new int[][] {};
    // 14: a trade, the 40-tick timer, then the restock with a remembered buyer in a village (yv.bp); with the screen closed before the timer runs out the status still comes; a night villager with no buyer none
    for (int sd : new int[] {9833, 9834}) run("b100-m101-restock-" + sd, sd, 300, "V", talk, new String[] {"0 day on", "5 trade 0", "10 buy 0", "15 untrade 0"});
    run("b100-m101-restock-open-9836", 9836, 300, "V", talk, new String[] {"0 day on", "5 trade 0", "10 buy 0", "60 untrade 0"});
    run("b100-m101-trade-nobuy-9830", 9830, 200, "V", talk, new String[] {"0 day on", "5 trade 0", "100 untrade 0"});
    // 13: setRevengeTarget with a player in a village (yv.b(sv)); a mob attacker or a villager outside every village sends none
    run("b100-m101-hit-player-10101", 10101, 20, "V", new double[][] {{52.5, 52.5}, {54.5, 52.5}}, new String[] {"2 hit 0 1 1.0 player"});
    run("b100-m101-hit-mob-10102", 10102, 20, "VZ", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {58.5, 52.5}}, new String[] {"2 hit 0 1 1.0 mob"});
    run("b100-m101-hit-player-no-village-10103", 10103, 20, "V", new double[][] {{-40.5, -40.5}, {-38.5, -40.5}}, new String[] {"2 hit 0 1 1.0 player"});
    run("b100-m101-hit-player-lethal-10104", 10104, 20, "V", new double[][] {{52.5, 52.5}, {54.5, 52.5}}, new String[] {"2 hit 0 1 100.0 player"});
  }
}
