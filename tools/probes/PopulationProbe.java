import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Original WorldGenMinable and BiomeDecorator.generateOres execute unchanged.
// World only supplies block reads/writes. Population seed probe stops before features.
public class PopulationProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static String key(int x,int y,int z){return x+","+y+","+z;}
  public static class W extends TerrainProbe.W {
    String fixture; Map<String,aji> edits; Map<String,aji[]> chunks; StringBuilder writes; MessageDigest reads; int readCount;
    public ahu a(int x,int z){return manager.a(x,z);}
    public aji a(int x,int y,int z){
      readCount++;for(int v:new int[]{x,y,z})for(int s=0;s<32;s+=8)reads.update((byte)(v>>s));
      if(y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000)return aji.e(0);
      aji b=edits.get(key(x,y,z));if(b!=null)return b;
      if(fixture.equals("natural")){aji[] c=chunks.get((x>>4)+","+(z>>4));if(c==null)throw new AssertionError("Missing chunk "+x+","+z);b=c[((x&15)*16+(z&15))*256+y];return b==null?aji.e(0):b;}
      int id=1;
      if(fixture.equals("mixed"))id=new int[]{1,3,13,0,8,9,10,11,7,24,159,172,1,1,1,1}[Math.floorMod(x+z,16)];
      return aji.e(id);
    }
    public boolean d(int x,int y,int z,aji b,int meta,int flags){
      // Mirror World bounds; no lighting, notifications or native Chunk storage are executed.
      if(y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000)return false;
      edits.put(key(x,y,z),b);if(writes.length()>1)writes.append(',');writes.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');return true;
    }
  }
  static W world(String fixture,long seed)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.fixture=fixture;w.edits=new HashMap<>();w.chunks=new HashMap<>();w.writes=new StringBuilder("[");w.reads=MessageDigest.getInstance("SHA-1");return w;
  }
  static String result(W w,Random r){return ",\"writes\":"+w.writes.toString()+"],\"readCount\":"+w.readCount+",\"readSha1\":"+q(TerrainProbe.hex(w.reads.digest()))+",\"nextLong\":"+q(""+r.nextLong());}
  static class Wrapped extends arn {
    arn inner;int id;StringBuilder attempts;
    Wrapped(arn gen,StringBuilder a)throws Exception{inner=gen;id=aji.b((aji)TerrainProbe.get(gen,"a"));attempts=a;}
    public boolean a(ahb w,Random r,int x,int y,int z){if(attempts.length()>1)attempts.append(',');attempts.append('[').append(id).append(',').append(x).append(',').append(y).append(',').append(z).append(']');return inner.a(w,r,x,y,z);}
  }
  static class Decorator extends aia {
    StringBuilder plan=new StringBuilder("["),attempts=new StringBuilder("[");
    Decorator()throws Exception{for(String f:new String[]{"h","i","j","k","l","m","n","o"})TerrainProbe.set(this,f,new Wrapped((arn)TerrainProbe.get(this,f),attempts));}
    void row(String mode,int count,arn gen,int min,int max){try{Wrapped g=(Wrapped)gen;if(plan.length()>1)plan.append(',');plan.append('[').append(q(mode)).append(',').append(count).append(',').append(g.id).append(',').append(TerrainProbe.get(g.inner,"b")).append(',').append(aji.b((aji)TerrainProbe.get(g.inner,"c"))).append(',').append(min).append(',').append(max).append(']');}catch(Exception e){throw new RuntimeException(e);}}
    protected void a(int count,arn gen,int min,int max){row("uniform",count,gen,min,max);super.a(count,gen,min,max);}
    protected void b(int count,arn gen,int center,int spread){row("triangle",count,gen,center,spread);super.b(count,gen,center,spread);}
    void run(W w,Random r,int x,int z){a=w;b=r;c=x;d=z;super.a();}
  }
  static void vein(long seed,String fixture,int size,int ore,int target,int x,int y,int z)throws Exception{
    W w=world(fixture,8675309);Random r=new Random(seed);boolean ok=new ase(aji.e(ore),size,aji.e(target)).a(w,r,x,y,z);
    System.out.println("{\"kind\":\"vein\",\"seed\":"+q(""+seed)+",\"fixture\":"+q(fixture)+",\"size\":"+size+",\"ore\":"+ore+",\"target\":"+target+",\"pos\":["+x+","+y+","+z+"],\"result\":"+ok+result(w,r)+"}");
  }
  static void ores(long seed,long randomSeed,String fixture,int cx,int cz)throws Exception{
    W w=world(fixture,seed);StringBuilder inputs=new StringBuilder("[");
    if(fixture.equals("natural")){
      TerrainProbe.resetMesa();aqz terrain=new aqz(w,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
      for(int x=cx-1;x<=cx+2;x++)for(int z=cz-1;z<=cz+2;z++){
        aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
        axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,w.manager.b(null,x*16,z*16,16,16));caves.a(null,w,x,z,blocks);ravines.a(null,w,x,z,blocks);w.chunks.put(x+","+z,blocks);
        if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(']');
      }
    }
    Random r=new Random(randomSeed);Decorator d=new Decorator();d.run(w,r,cx*16,cz*16);
    System.out.println("{\"kind\":\"ores\",\"seed\":"+q(""+seed)+",\"randomSeed\":"+q(""+randomSeed)+",\"fixture\":"+q(fixture)+",\"chunk\":["+cx+","+cz+"],\"inputs\":"+inputs+"],\"plan\":"+d.plan+"],\"attempts\":"+d.attempts+"]"+result(w,r)+"}");
  }
  static class Stop extends RuntimeException{}
  static class SeedTrace extends Random {
    List<Long> seeds=new ArrayList<>();
    public synchronized void setSeed(long seed){super.setSeed(seed);if(seeds!=null){seeds.add(seed);if(seeds.size()==2)throw new Stop();}}
  }
  static void populationSeed(long seed,int cx,int cz)throws Exception{
    W w=world("solid",seed);aqz gen=new aqz(w,seed,false);SeedTrace r=new SeedTrace();TerrainProbe.set(gen,"i",r);
    try{gen.a((apu)null,cx,cz);throw new AssertionError("No seed interception");}catch(Stop ok){}finally{akx.M=false;}
    long pop=r.seeds.get(1);System.out.println("{\"kind\":\"populationSeed\",\"seed\":"+q(""+seed)+",\"chunk\":["+cx+","+cz+"],\"populationSeed\":"+q(""+pop)+",\"nextLong\":"+q(""+new Random(pop).nextLong())+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();
    for(long seed:new long[]{0,1,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE}){
      for(int[] pos:new int[][]{{0,0},{-17,29},{1874999,-1874999},{-1875000,1874999}})populationSeed(seed,pos[0],pos[1]);
      for(int size:new int[]{1,6,7,8,16,32})for(int[] p:new int[][]{{0,32,0},{-18,4,29},{14,255,15},{29999992,60,-29999990},{-30000008,0,23},{15,0,-17}})for(String fixture:new String[]{"solid","mixed"})vein(seed,fixture,size,56,1,p[0],p[1],p[2]);
      for(int[] p:new int[][]{{0,32,0},{-19,60,7}})vein(seed,"mixed",8,1,1,p[0],p[1],p[2]);
      for(int target:new int[]{0,3,13,24})vein(seed,"mixed",8,14,target,-19,60,7);
      for(String fixture:new String[]{"solid","mixed"})for(int[] c:new int[][]{{0,0},{-3,4},{1874999,-1874999}})ores(8675309,seed,fixture,c[0],c[1]);
    }
    // Isolated ore-pass RNG input, not a claim of the stream after lakes/dungeons.
    for(long seed:new long[]{0,8675309,-123456789})for(int[] c:new int[][]{{0,0},{-17,29}})ores(seed,1234,"natural",c[0],c[1]);
  }
}
