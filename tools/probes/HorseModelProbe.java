import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 56: the unchanged ModelHorse (bhs) setLivingAnimations (bhs.a(sv, F, F, F)) on a real EntityHorse (wi), one `pose` row per input set, from the executed class.
// ONE bhs instance is kept for the whole run, like RenderHorse's single model: setLivingAnimations only writes some fields in some branches (the bag G's point is written
// only for a saddled horse, the saddle straps' angles only when saddled), so a part keeps what an earlier row left; rows are replayed in order.
// A second record, `tail`, runs the real wi.h() (onUpdate) on a client world double with a logging Random as the horse's own Entity.rand and records, per tick, every draw (bound:result)
// and the tail counter bp: the tail roll nextInt(200) == 0 starts bp (wi.cR) on the client entity too, and its position among the draws.
// Each row writes the entity inputs it set (yaw / pitch fields, counters, flags, growing age, rider) and the six values (c d e f g h) of the 39 parts afterwards.
public class HorseModelProbe {
  static String num(float v) { return Float.toString(v); }

  static final String[] PARTS = { "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S" };

  static String parts(bhs m) throws Exception {
    StringBuilder b = new StringBuilder("{");
    for (int i = 0; i < PARTS.length; i++) {
      bix r = (bix) MobMoveProbe.field(bhs.class, PARTS[i]).get(m);
      b.append(i > 0 ? "," : "").append("\"" + PARTS[i] + "\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "," + num(r.f) + "," + num(r.g) + "," + num(r.h) + "]");
    }
    return b.append("}").toString();
  }

  static void flag(wi e, int bit, boolean on) throws Exception { MobMoveProbe.method(wi.class, "b", int.class, boolean.class).invoke(e, bit, on); }

  public static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int v = super.nextInt(bound); log.add(bound + ":" + v); return v; }
    public int nextInt() { int v = super.nextInt(); log.add("i:" + v); return v; }
    public float nextFloat() { float v = super.nextFloat(); log.add("f"); return v; }
    public double nextDouble() { double v = super.nextDouble(); log.add("d"); return v; }
    public boolean nextBoolean() { boolean v = super.nextBoolean(); log.add("b"); return v; }
  }

  static String tail(long seed, int ticks, boolean emit) throws Exception {
    HorseRearProbe.world(true, true);
    wi e = HorseProbe.typed(5, 0);
    Log rnd = new Log(seed);
    MobMoveProbe.set(e, "Z", rnd);
    Method h = MobMoveProbe.method(wi.class, "h");
    StringBuilder rows = new StringBuilder();
    int hits = 0;
    for (int i = 0; i < ticks; i++) {
      rnd.log.clear();
      h.invoke(e);
      for (String d : rnd.log) if (d.equals("200:0")) hits++;
      rows.append(i > 0 ? "," : "").append("{\"bp\":" + MobMoveProbe.field(wi.class, "bp").getInt(e) + ",\"bq\":" + MobMoveProbe.field(wi.class, "bq").getInt(e) + ",\"draws\":" + rnd.log.stream().map(x -> "\"" + x + "\"").collect(java.util.stream.Collectors.toList()) + "}");
    }
    return hits >= 3 || !emit ? "{\"case\":\"tail\",\"seed\":" + seed + ",\"hits\":" + hits + ",\"ticks\":[" + rows + "]}" : null;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    for (long seed = 1; ; seed++) { String row = tail(seed, 600, true); if (row != null) { HorseProbe.out(row); break; } }
    HorseRearProbe.world(true, true);
    HorseProbe.player = HorseProbe.makePlayer(false);
    bhs model = new bhs();
    Random r = new Random(56);
    int[] ages = { 0, 0, 0, -24000, -12000, -1, -3000 };
    for (int i = 0; i < 240; i++) {
      wi e = HorseProbe.typed(5, new int[] { 0, 0, 1, 2, 3, 4 }[r.nextInt(6)]);
      boolean saddled = r.nextBoolean(), chested = r.nextBoolean(), rider = r.nextInt(3) == 0;
      int age = ages[r.nextInt(ages.length)];
      flag(e, 4, saddled);
      flag(e, 8, chested);
      if (age != 0) e.c(age);
      MobMoveProbe.set(e, "l", rider ? HorseProbe.player : null);
      float aN = r.nextFloat() * 720 - 360, aM = aN + (r.nextInt(4) == 0 ? r.nextFloat() * 400 - 200 : r.nextFloat() * 40 - 20);
      float aP = r.nextFloat() * 720 - 360, aO = aP + (r.nextInt(4) == 0 ? r.nextFloat() * 400 - 200 : r.nextFloat() * 40 - 20);
      if (r.nextBoolean()) { aP = aN + r.nextFloat() * 50 - 25; aO = aM + r.nextFloat() * 50 - 25; }
      float pitchPrev = r.nextFloat() * 180 - 90, pitch = pitchPrev + r.nextFloat() * 20 - 10;
      int ticks = r.nextInt(100000);
      float partial = new float[] { 0f, 0.25f, 0.5f, 1f, r.nextFloat() }[r.nextInt(5)];
      float swing = r.nextInt(5) == 0 ? 0f : r.nextFloat() * 40;
      float amount = r.nextInt(3) == 0 ? r.nextFloat() * 0.2f : r.nextFloat();
      float[] anim = new float[6]; // bK bJ (head lean prev, cur), bM bL (rear), bO bN (mouth)
      for (int k = 0; k < 6; k += 2) if (r.nextInt(5) < 2) { anim[k] = r.nextFloat(); anim[k + 1] = r.nextFloat(); }
      int bp = r.nextInt(3) == 0 ? 1 + r.nextInt(8) : 0;
      String[] names = { "bK", "bJ", "bM", "bL", "bO", "bN" };
      for (int k = 0; k < 6; k++) MobMoveProbe.set(e, names[k], anim[k]);
      MobMoveProbe.set(e, "bp", bp);
      MobMoveProbe.set(e, "aN", aN); MobMoveProbe.set(e, "aM", aM); MobMoveProbe.set(e, "aP", aP); MobMoveProbe.set(e, "aO", aO);
      MobMoveProbe.set(e, "B", pitchPrev); MobMoveProbe.set(e, "z", pitch); MobMoveProbe.set(e, "aa", ticks);
      model.a((sv) e, swing, amount, partial);
      HorseProbe.out("{\"case\":\"pose\",\"i\":" + i + ",\"type\":" + e.bZ() + ",\"saddled\":" + e.cu() + ",\"chested\":" + e.ck() + ",\"rider\":" + rider + ",\"age\":" + e.d() + ",\"ci\":" + num(e.ci())
        + ",\"aN\":" + num(aN) + ",\"aM\":" + num(aM) + ",\"aP\":" + num(aP) + ",\"aO\":" + num(aO) + ",\"pitchPrev\":" + num(pitchPrev) + ",\"pitch\":" + num(pitch) + ",\"ticks\":" + ticks
        + ",\"partial\":" + num(partial) + ",\"swing\":" + num(swing) + ",\"amount\":" + num(amount)
        + ",\"anim\":{\"prevLean\":" + num(anim[0]) + ",\"lean\":" + num(anim[1]) + ",\"prevRear\":" + num(anim[2]) + ",\"rear\":" + num(anim[3]) + ",\"prevMouth\":" + num(anim[4]) + ",\"mouth\":" + num(anim[5]) + ",\"tail\":" + bp + "}"
        + ",\"p\":" + num(e.p(partial)) + ",\"q\":" + num(e.q(partial)) + ",\"r\":" + num(e.r(partial)) + ",\"parts\":" + parts(model) + "}");
    }
  }
}
