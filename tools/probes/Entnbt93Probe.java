import java.util.*;

// Batch 93 entnbt93: a mob summoned at Health 0 with a DeathTime (the real 1.7.10 EntityLivingBase.readEntityFromNBT through CommandSummon on Summon86Probe's server double),
// then written (writeToNBTOptional, sa.c) after 0, 1, 5, 19, 20 and 21 onUpdate calls. Per row: [name, tag, [[updates, written: null when not saved, else "HealF Health DeathTime isDead"]...]].
// One JSON line {"rows": [...]}.
public class Entnbt93Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static String line(sa e) throws Exception { dh t = new dh(); if (!e.c(t)) return null; return t.h("HealF") + " " + t.e("Health") + " " + t.e("DeathTime") + " " + e.K; }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    String[][] cases = { { "Cow", "{HealF:0f,Health:0s,DeathTime:7s}" }, { "Cow", "{HealF:0f,Health:0s,DeathTime:0s}" }, { "Cow", "{HealF:0f,Health:0s}" }, { "Cow", "{HealF:0f,Health:0s,DeathTime:25s}" }, { "Cow", "{HealF:10f,Health:10s,DeathTime:9s}" } };
    StringBuilder out = new StringBuilder("{\"rows\":[");
    boolean first = true;
    for (String[] c : cases) {
      StringBuilder steps = new StringBuilder();
      try {
        List<sa> got = Summon87Probe.summon(c[0], c[1]);
        sa e = got.get(got.size() - 1);
        int done = 0;
        for (int target : new int[] { 0, 1, 5, 19, 20, 21 }) {
          while (done < target) { e.h(); done++; }
          steps.append(steps.length() == 0 ? "" : ",").append("[" + target + "," + q(line(e)) + "]");
        }
      } catch (Throwable t) { steps.append((steps.length() == 0 ? "" : ",") + "[-1," + q("!" + t) + "]"); }
      out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + ",[" + steps + "]]"); first = false;
    }
    System.out.println(out.append("]}"));
  }
}
