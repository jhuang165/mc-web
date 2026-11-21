import java.util.*;

// Batch 92 entnbt92: Entity.writeToNBT (sa.e) of a natural EntityPainting / EntityItemFrame (the real constructors through HangingProbe's P and F on its map-backed
// world, and ItemHangingEntity.onItemUse) before and after onUpdate and a push, to prove the "Fire" value a hanging entity saves. One JSON line per row:
// {"kind":"hangingFire","name":..,"steps":[[step, Fire as written (null when absent)]...]}. Needs HangingProbe, MinecartProbe, PlayerStepProbe and NbtProbe on the class path.
public class Entnbt92Probe {
  static String q(String s) { return HangingProbe.q(s); }
  static String fire(sa e) { dh t = new dh(); e.e(t); return t.c("Fire") ? String.valueOf(t.e("Fire")) : "null"; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for (String name : new String[] { "Painting", "ItemFrame" }) {
      MinecartProbe.MW w = HangingProbe.world(HangingProbe.plane(2, 0, 64, 0));
      HangingProbe.seed = 7;
      ss h = name.equals("Painting") ? new HangingProbe.P(w, 0, 64, 0, 2) : new HangingProbe.F(w, 0, 64, 0, 2);
      StringBuilder b = new StringBuilder("[[\"new\"," + q(fire(h)) + "]");
      for (int i = 0; i < 205; i++) { h.h(); if (i == 0 || i == 100 || i == 204) b.append(",[\"update" + (i + 1) + "\"," + q(fire(h)) + "]"); }
      h.d(0.1, 0, 0);
      b.append(",[\"push\"," + q(fire(h)) + "]");
      h.d(0, 0, 0);
      b.append(",[\"push0\"," + q(fire(h)) + "]]");
      System.out.println("{\"kind\":\"hangingFire\",\"name\":" + q(name) + ",\"steps\":" + b + "}");
    }
    for (boolean frame : new boolean[] { false, true }) {
      List<int[]> cells = new ArrayList<>();
      cells.add(new int[] { 0, 65, 0, 1, 0 });
      MinecartProbe.MW w = HangingProbe.world(cells);
      HangingProbe.seed = 17;
      MinecartProbe.Target p = HangingProbe.player(w, false, HangingProbe.mk(frame ? 389 : 321, 3, 0));
      p.bm.h().a(p, w, 0, 65, 0, 2, 0.5f, 0.5f, 0.5f);
      for (sa e : w.spawned) if (e instanceof ss) System.out.println("{\"kind\":\"hangingFire\",\"name\":" + q((frame ? "ItemFrame" : "Painting") + " placed by item") + ",\"steps\":[[\"placed\"," + q(fire(e)) + "]]}");
    }
  }
}
