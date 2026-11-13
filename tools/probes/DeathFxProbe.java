import java.util.ArrayList;
import java.util.List;

// Batch 59: the client copy of a dying mob. The unchanged EntityLivingBase / EntityLiving onEntityUpdate (sv.C) on a CLIENT world double (ahb.E true) with a logging Random as
// the copy's own Entity.rand and a world that records spawnParticle (ahb.a(String, 6 doubles)). Cases: zombie (yq), pig (wo), piglet (wo, age -24000) and horse (wi).
// Per tick: the entity status (3 at tick 2: sv.a(byte), the copy's health goes to 0 and onDeath runs), the position the copy has when onEntityUpdate runs (the port moves it
// AFTER, as onLivingUpdate's interpolation does), deathTime (sv.aA), the draws of that tick and the particles the world was asked for (name, x, y, z, vx, vy, vz).
// Also `size` (width, height) of the copy and, per tick, nothing else. Output: one JSON object per case.
public class DeathFxProbe {
  public static class PW extends HorseProbe.World {
    static List<String> particles = new ArrayList<>();
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      particles.add(name + "|" + x + "|" + y + "|" + z + "|" + vx + "|" + vy + "|" + vz);
    }
  }
  static sv make(String kind, ahb w) throws Exception {
    switch (kind) {
      case "zombie": return new yq(w);
      case "pig": return new wo(w);
      case "piglet": { wo p = new wo(w); p.c(-24000); return p; }
      default: return HorseProbe.typed(0, 0);
    }
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    String[] kinds = { "zombie", "pig", "piglet", "horse" };
    long seed = 31;
    for (String kind : kinds) {
      seed++;
      HorseCopyProbe.build(PW.class, true);
      HorseProbe.clear(); PW.particles.clear();
      sv e = make(kind, HorseProbe.W);
      HorseCopyProbe.Log r = new HorseCopyProbe.Log(seed); MobMoveProbe.set(e, "Z", r);
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 26; i++) {
        r.log.clear(); PW.particles.clear();
        int status = i == 2 ? 3 : 0;
        if (status != 0) e.a((byte) status);
        r.log.clear(); HorseProbe.World.sounds.clear(); PW.particles.clear(); // the status sound's draws belong to the packet phase (horse-status-reference.json), not to the tick
        double x = 10 + 0.25 * i, y = 64 + 0.125 * i, z = -5 + 0.5 * i;
        MobMoveProbe.set(e, "s", x); MobMoveProbe.set(e, "t", y); MobMoveProbe.set(e, "u", z);
        e.C();
        StringBuilder ps = new StringBuilder("[");
        for (int k = 0; k < PW.particles.size(); k++) ps.append(k > 0 ? "," : "").append("\"" + PW.particles.get(k) + "\"");
        ps.append("]");
        rows.append(i > 0 ? "," : "").append("[" + status + "," + x + "," + y + "," + z + "," + e.aA + ",\"" + String.join(" ", r.log) + "\"," + ps + "]");
      }
      HorseProbe.out("{\"case\":\"death\",\"kind\":\"" + kind + "\",\"seed\":" + seed + ",\"width\":" + MobMoveProbe.fl(e, "M") + ",\"height\":" + MobMoveProbe.fl(e, "N") + ",\"ticks\":[" + rows + "]}");
    }
  }
}
