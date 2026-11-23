import java.util.*;

// Batch 98 entnbt98: Fire, Air, PortalCooldown, Invulnerable and Dimension edge values on generic (non-player) entities through the real 1.7.10 classes.
// Row format as Entnbt97MobProbe: [id, /summon tag, written compound (sorted), after sg.a reload, written hex]; stage rows tick the entity (sa.h) and save again.
public class Entnbt98Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    List<String[]> e = new ArrayList<>();
    String[] ids = {"Zombie", "Cow", "Creeper", "Boat", "MinecartRideable", "PrimedTnt", "Arrow", "XPOrb", "Snowball", "ThrownEnderpearl", "ThrownExpBottle", "ThrownPotion", "EyeOfEnderSignal", "FireworksRocketEntity", "MinecartChest", "ItemFrame", "Painting", "FallingSand", "Pig", "Skeleton"};
    String[] tags = {
      "{Fire:5s}", "{Fire:-1s}", "{Fire:0s}", "{Fire:32767s}", "{Fire:-32768s}", "{Fire:70000}", "{Fire:5b}", "{Fire:5.7f}", "{Fire:5.7d}", "{Fire:\"5\"}", "{Fire:-20s}",
      "{Air:100s}", "{Air:-5s}", "{Air:32767s}", "{Air:-32768s}", "{Air:70000}", "{Air:5b}", "{Air:5.7f}", "{Air:\"5\"}", "{Air:301s}",
      "{PortalCooldown:100}", "{PortalCooldown:-5}", "{PortalCooldown:2147483647}", "{PortalCooldown:-2147483648}", "{PortalCooldown:5s}", "{PortalCooldown:5b}", "{PortalCooldown:5.5d}", "{PortalCooldown:\"x\"}", "{PortalCooldown:5L}",
      "{Invulnerable:1b}", "{Invulnerable:2b}", "{Invulnerable:-1b}", "{Invulnerable:256}", "{Invulnerable:1}", "{Invulnerable:0.5f}", "{Invulnerable:256s}", "{Invulnerable:\"true\"}", "{Invulnerable:0b}",
      "{Dimension:-1}", "{Dimension:1}", "{Dimension:7}", "{Dimension:2147483647}", "{Dimension:1b}", "{Dimension:1s}", "{Dimension:1L}", "{Dimension:0.9d}", "{Dimension:\"1\"}",
      "{Fire:5s,Air:7s,PortalCooldown:9,Invulnerable:1b,Dimension:-1}"};
    for (String id : ids) for (String t : tags) e.add(new String[] {id, t});
    StringBuilder out = new StringBuilder("{\"edge\":[");
    boolean first = true;
    for (String[] c : e) { out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + "," + q(Entnbt94Probe.edge(c[0], c[1], false)) + "," + q(Entnbt94Probe.edge(c[0], c[1], true)) + "," + q(Entnbt94Probe.hexW(c[0], c[1])) + "]"); first = false; }
    out.append("],\"ticks\":[");
    first = true;
    for (String[] c : e) {
      if (c[1].contains("Dimension:7") || !(c[1].startsWith("{Fire") || c[1].startsWith("{Air") || c[1].startsWith("{PortalCooldown") || c[1].contains(",Air"))) continue;
      StringBuilder steps = new StringBuilder();
      try {
        List<sa> got = Summon87Probe.summon(c[0], c[1]);
        sa m = got.get(got.size() - 1);
        int done = 0;
        for (int target : new int[] {1, 2, 5}) {
          while (done < target) { m.h(); done++; }
          dh t = new dh(); m.c(t);
          steps.append(steps.length() == 0 ? "" : ",").append("[" + target + "," + q(t.c("Fire") ? t.a("Fire").toString() : "none") + "," + q(t.c("Air") ? t.a("Air").toString() : "none") + "," + q(t.c("PortalCooldown") ? t.a("PortalCooldown").toString() : "none") + "]");
        }
      } catch (Throwable x) { steps.append(steps.length() == 0 ? "" : ",").append("[-1," + q("!" + x) + ",\"\",\"\"]"); }
      out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + ",[" + steps + "]]"); first = false;
    }
    System.out.println(out.append("]}"));
  }
}
