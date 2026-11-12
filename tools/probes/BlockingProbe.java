import java.util.*;

// Batch 48: EntityPlayer.damageEntity's blocking rule (yz.d(ro, float)) executed on the PlayerDamageProbe double: the real EntityPlayerMP (mw) with its itemInUse (yz.f) set to a stack,
// then attackEntityFrom (sv.a(ro, float)). Records the health lost, the hurt-window state and isBlocking (yz.bC) for each source, amount, held item in use and armour.
public class BlockingProbe {
  static String num(float v) { return Float.toString(v); }
  static void run(String name, int item, boolean armor, String... ops) throws Exception {
    Map<String, Object> setup = armor ? PlayerDamageProbe.setup("armor", true) : PlayerDamageProbe.setup();
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, setup);
    if (item > 0) PlayerDamageProbe.fd(yz.class, "f").set(e, new add(adb.d(item), 1, 0)); // EntityPlayer.itemInUse
    yq attacker = new yq(PlayerDamageProbe.w); PlayerDamageProbe.pos(attacker, 66.5, 5.0, 64.5);
    StringBuilder hits = new StringBuilder();
    boolean blocking = ((yz) e).bC();
    for (String op : ops) {
      String[] s = op.split(":"); // tick:source:amount
      int tick = Integer.parseInt(s[0]);
      while (PlayerDamageProbe.tickOf(e) < tick) PlayerDamageProbe.tick(e);
      float before = e.aS();
      boolean ok = e.a(PlayerDamageProbe.source(s[1], attacker), Float.parseFloat(s[2]));
      hits.append(hits.length() == 0 ? "" : ",").append("{\"tick\":").append(tick).append(",\"source\":\"").append(s[1]).append("\",\"amount\":").append(s[2]).append(",\"accepted\":").append(ok)
        .append(",\"lost\":").append(num(before - e.aS())).append(",").append(PlayerDamageProbe.state(e)).append("}");
    }
    System.out.println("{\"case\":\"block\",\"name\":\"" + name + "\",\"item\":" + item + ",\"armor\":" + armor + ",\"blocking\":" + blocking + ",\"hits\":[" + hits + "]}");
  }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    String[] sources = { "mob", "inFire", "lava", "cactus", "onFire", "inWall", "drown", "starve", "fall", "outOfWorld", "generic" };
    for (int item : new int[] { 0, 267, 268, 276, 283, 272, 261, 260, 297, 373 }) // none, iron/wood/diamond/gold/stone sword, bow, apple, bread, potion in use
      for (String src : sources) run("single-" + src, item, false, "0:" + src + ":6");
    for (String src : new String[] { "mob", "cactus", "fall" }) run("armor-" + src, 267, true, "0:" + src + ":7");
    run("amounts", 267, false, "0:mob:0.5");
    run("amounts-1", 267, false, "0:mob:1");
    run("amounts-20", 267, false, "0:mob:20");
    // Hurt window: the top-up difference is what gets halved, the stored last damage stays the raw hit.
    run("topup", 267, false, "0:mob:4", "3:mob:9", "4:mob:9", "25:mob:3");
    run("topup-armor", 267, true, "0:mob:4", "3:mob:9");
    run("topup-unblocked", 0, false, "0:mob:4", "3:mob:9");
  }
}
