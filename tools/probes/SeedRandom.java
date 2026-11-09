import java.util.Random;

// Batch 32. Entity.rand (sa.Z) is `new Random()`, seeded from the clock, so an arrow's heading draws (EntityArrow's constructor) and a converted or
// reinforcement zombie's onSpawnWithEgg draws could not be reproduced. tools/verify-village-fight.mjs renames the constant-pool class entry
// "java/util/Random" of sa.class (Entity) to SeedRandom: no bytecode of Entity changes, only the class that its one `new Random()` builds. The
// probe sets `next` before a scenario; the n-th Entity built gets seed next + n and records it in `seed`.
public class SeedRandom extends Random {
  static long next = 1;
  long seed;
  java.util.List<String> log = new java.util.ArrayList<>(); // draws, as VillageFightProbe.Log records them (a Log set after construction would miss a converted zombie's onSpawnWithEgg draws)
  static final boolean TRACE = System.getenv("VF_TRACE") != null; // development aid: tag each draw with its caller frames
  static String where() { StringBuilder b = new StringBuilder("@"); int k = 0; for (StackTraceElement e : new Throwable().getStackTrace()) { if (e.getClassName().equals("SeedRandom") || e.getClassName().startsWith("VillageFightProbe$Log") || e.getClassName().equals("java.util.Random")) continue; b.append(e.getClassName()).append('.').append(e.getMethodName()).append('>'); if (++k == 3) break; } return b.toString(); }
  public int nextInt(int bound) { int r = super.nextInt(bound); if (log != null) log.add("i" + bound + (TRACE ? where() : "")); return r; }
  public float nextFloat() { float r = super.nextFloat(); if (log != null) log.add("f"); return r; }
  public double nextGaussian() { double r = super.nextGaussian(); if (log != null) log.add("g"); return r; }
  public boolean nextBoolean() { boolean r = super.nextBoolean(); if (log != null) log.add("b"); return r; }
  public SeedRandom() { this(next++); }
  private SeedRandom(long s) { super(s); seed = s; }
}
