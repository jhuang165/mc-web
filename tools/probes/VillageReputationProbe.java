import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 28 village3. Village.playerReputation on the unchanged classes: a TreeMap<String, Integer> (vz.j, bytecode-read) keyed by the player's name, so the
// Players list of villages.dat is written in String.compareTo order and findNearestVillageTargetPlayer (vz.c) walks the names in that order, the later of two
// equally near players winning (dcmpl/ifle). Each case builds a real village (VillageLiveProbe double), applies a script, and prints the Players list that
// WorldSavedData villages writes (vz.b(dh) through du.a(dh, DataOutput), whole file hex) plus the nearest target-player name.
//   rep name delta       Village.setReputation-style change (vz.a(String,int)); output is the clamped result
//   target x z           place the golem-side asker at (x, z), call vz.c(sv) and print the chosen name (players in the world: see "online")
//   online name x z      put a real EntityPlayer (not ticked) with that name into World.getPlayerEntityByName at (x, 0, z)
//   offline name         remove it from the world
//   tick n               run n VillageCollection ticks (no villagers exist: the 20-tick population count clears the map)
//   reload               write the village to NBT, read it into a fresh wc, write again; both hex strings are recorded
public class VillageReputationProbe {
  static String q(String s) { StringBuilder b = new StringBuilder("\""); for (char c : s.toCharArray()) b.append(c < 32 || c > 126 || c == '"' || c == '\\' ? String.format("\\u%04x", (int) c) : String.valueOf(c)); return b.append('"').toString(); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

  public static class P extends yz {
    final String n;
    P(ahb world, String n) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes(n.getBytes()), n)); this.n = n; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bo = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bo));
    StringBuilder b = new StringBuilder();
    for (byte x : bo.toByteArray()) b.append(String.format("%02x", x & 255));
    return b.toString();
  }
  static dh data(wc c) throws Exception { dh inner = new dh(); c.b(inner); dh root = new dh(); root.a("data", inner); return root; }

  static void scenario(String name, long seed, String[] script) throws Exception {
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    vz village = (vz) c.b().get(0);
    yq asker = new yq(VillageLiveProbe.world);
    at(asker, 0, 0, 0);
    StringBuilder out = new StringBuilder(), sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    for (String op : script) {
      String[] p = op.split(" ", -1);
      out.append(out.length() > 0 ? "," : "");
      switch (p[0]) {
        case "rep": out.append(village.a(p[1].replace("_", ""), Integer.parseInt(p[2]))); break;
        case "target": {
          at(asker, Double.parseDouble(p[1]), 0, Double.parseDouble(p[2]));
          yz t = village.c(asker);
          out.append(t == null ? "null" : q(((P) t).n));
          break;
        }
        case "online": { P pl = new P(VillageLiveProbe.world, p[1].replace("_", "")); at(pl, Double.parseDouble(p[2]), 0, Double.parseDouble(p[3])); VillageLiveProbe.W.players.put(p[1].replace("_", ""), pl); out.append("0"); break; }
        case "offline": VillageLiveProbe.W.players.remove(p[1].replace("_", "")); out.append("0"); break;
        case "tick": for (int i = 0; i < Integer.parseInt(p[1]); i++) c.a(); out.append("0"); break;
        case "reload": {
          dh first = data(c);
          wc d = new wc(VillageLiveProbe.world);
          d.a((dh) first.m("data"));
          out.append("[").append(q(hex(first))).append(",").append(q(hex(data(d)))).append("]");
          break;
        }
        case "names": { List<String> ks = new ArrayList<>(((java.util.TreeMap<String, Integer>) field(village, "j")).keySet()); StringBuilder b = new StringBuilder("["); for (String k : ks) b.append(b.length() > 1 ? "," : "").append(q(k)).append(",").append(village.a(k)); out.append(b).append("]"); break; }
        default: throw new IllegalArgumentException(op);
      }
    }
    System.out.println("{\"case\":\"reputation\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"script\":[" + sc + "],\"out\":[" + out + "]}");
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
    MobMoveProbe.set(w, "r", rd.values()[2]);
    // "_" stands for the empty string where a name is needed; names use UTF-16 order: upper case before lower case, accents after z, surrogate pairs by code unit
    scenario("order-in-nbt", 0, new String[] {"rep zed -1", "rep Bob -2", "rep alice -3", "rep Zed -4", "rep _ -5", "rep bob -6", "rep émile -7", "rep 😀 -8", "rep ￿ -9", "rep Alice 4", "names", "reload"});
    scenario("clamp-and-threshold", 0, new String[] {"rep a -14", "rep a -1", "rep a -1", "rep a -20", "rep b 7", "rep b 7", "rep c -15", "rep c 100", "rep d 0", "names", "reload"});
    scenario("target-ties-and-order", 0, new String[] {"rep a -15", "rep b -15", "rep c -15", "rep d -14", "online a 10 0", "online b -10 0", "online c 10 0", "online d 1 0", "target 0 0", "online c 30 0", "target 0 0", "offline b", "target 0 0", "offline a", "target 0 0", "online d 1 0", "rep d -1", "target 0 0", "target 9 0",
      "online x 5 0", "rep x -30", "target 4 0", "online b 5 0", "rep b -20", "target 0 0"});
    // inserted in reverse sorted order: the walk still ends on the later name, not the last inserted
    scenario("tie-reverse-insert", 0, new String[] {"rep zed -15", "rep mid -15", "rep Amy -15", "online zed 5 0", "online mid -5 0", "online Amy 0 5", "target 0 0", "target 3 0", "target -3 0"});
    scenario("clear-without-villagers", 0, new String[] {"rep a -3", "rep b 2", "tick 10", "tick 15", "names", "tick 30", "names"});
    scenario("expiry-vs-reputation", 0, new String[] {"rep p -15", "online p 3 0", "target 0 0", "rep p 1", "target 0 0", "rep p -1", "target 0 0"});
  }
}
