import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 biome decorate overrides (BiomeGenBase.decorate, ahu.a(World, Random, II), and
// every subclass override) and the generators they add: WorldGenDoublePlant (arm), DesertWells (arl),
// Melon (asc), Vines (asr), IceSpike (arw), IcePath (arv), BlockBlob (arf), BlockDoublePlant breaking, plus the inline emerald
// ore and monster-egg veins of extreme hills. The world is BiomeDecoratorProbe's Chunk-backed double
// over native terrain, caves and ravines, in regions chosen for ice spikes, desert, mega taiga,
// jungle, plains, sunflower plains, flower and roofed forests, extreme hills and savanna.
public class BiomeOverrideProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static Object field(Object o,String n)throws Exception{
    for(Class<?> c=o.getClass();c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f.get(o);}catch(NoSuchFieldException e){}
    throw new NoSuchFieldException(n);}
  // The class parameter a slot's decorate override reads.
  static int param(ahu b)throws Exception{
    if(b instanceof aif)return (Integer)field(b,"aF");
    if(b instanceof aip||b instanceof aij)return ((Boolean)field(b,"aC"))?1:0;
    if(b instanceof aiw)return (Integer)field(b,"aH");
    if(b instanceof ain)return ((ahu)field(b,"aD")).ay;
    return -1;}
  static arn gen(String kind){
    switch(kind){
      case "well":return new arl(); case "spike":return new arw(); case "path":return new arv(4); case "blob":return new arf(ajn.Y,0);
      case "melon":return new asc(); case "vines":return new asr();
      case "dpbreak":return new arm();
      default:{arm a=new arm();a.a(Integer.parseInt(kind.substring(2)));return a;}
    }}
  static String record(SpringProbe.G w)throws Exception{
    return "\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writeCount\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))
      +",\"pendingCount\":"+w.pendingKeys.size()+",\"pendingSha1\":"+q(BiomeDecoratorProbe.sha(w.pending.toString()))+",\"drops\":["+w.drops+"],\"sounds\":["+w.sounds+"],\"aux\":["+w.aux+"],\"stateSha1\":"+q(w.state())+",\"worldNextLong\":"+q(""+w.s.nextLong());}
  // BlockDoublePlant.onNeighborBlockChange: each bottom half in turn loses its soil, its top or itself, notifying.
  static void breakPlants(SpringProbe.G w,int x0,int y0,int z0){
    int k=0;
    for(int x=x0-8;x<=x0+8;x++)for(int z=z0-8;z<=z0+8;z++)for(int y=y0-4;y<=y0+4;y++){
      if(w.a(x,y,z)!=ajn.cm||(w.e(x,y,z)&8)!=0)continue;
      w.d(x,y+(k%3==0?-1:k%3==1?1:0),z,ajn.a,0,3);k++;}
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    String only=args.length>0?args[0]:null;
    List<Integer> slots=new ArrayList<>();StringBuilder biomes=new StringBuilder("[");
    for(int slot=0;slot<256;slot++){ahu b=ahu.n()[slot];if(b==null||slot==8||slot==9)continue;slots.add(slot);
      if(biomes.length()>1)biomes.append(',');biomes.append('[').append(slot).append(',').append(q(b.getClass().getName())).append(',').append(param(b)).append(']');}
    biomes.append(']');
    aji[] used={ajn.cm,ajn.ba,ajn.bd,ajn.cj,ajn.bA,ajn.aU,ajn.Y,ajn.A,ajn.U,ajn.aE,ajn.aD,ajn.m,ajn.i};
    StringBuilder ids=new StringBuilder("[");for(aji b:used){if(ids.length()>1)ids.append(',');ids.append(aji.b(b));}ids.append(']');
    System.out.println("{\"kind\":\"config\",\"biomes\":"+biomes+",\"slots\":"+slots+",\"blocks\":"+ids+"}");
    // [seed, origin chunk x, z]: the inner 2x2 chunks of each 4x4 region share one natural biome.
    long[][] regions={{1234567L,92,64},{8675309L,-136,-68},{0L,92,-88},{7L,-12,116},{8675309L,-100,-68},{8675309L,-136,32},{8675309L,-124,-104},{8675309L,-156,-144},{8675309L,-160,-108},{8675309L,-80,40}};
    String[] kinds={"well","spike","path","blob","melon","vines","dp0","dp1","dp2","dp3","dp4","dp5","dpbreak"};
    Random pick=new Random(20261103L);int next=0;List<Integer> order=new ArrayList<>(slots);Collections.shuffle(order,pick);
    for(int ri=0;ri<regions.length;ri++){
      long seed=regions[ri][0];int cx0=(int)regions[ri][1],cz0=(int)regions[ri][2];
      BiomeDecoratorProbe.D t=BiomeDecoratorProbe.world(seed,0);TerrainProbe.resetMesa();aqz g=new aqz(t,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
      List<Object[]> input=new ArrayList<>();StringBuilder inputs=new StringBuilder("[");
      for(int x=cx0;x<cx0+4;x++)for(int z=cz0;z<cz0+4;z++){
        aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(g,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
        axl.a();g.a(x,z,blocks);axl.a();g.a(x,z,blocks,meta,t.manager.b(null,x*16,z*16,16,16));caves.a(null,t,x,z,blocks);ravines.a(null,t,x,z,blocks);
        input.add(new Object[]{x,z,blocks,meta});
        if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(',').append(q(TerrainProbe.hash(meta))).append(']');
      }
      inputs.append(']');
      int natural=t.a((cx0+1)*16+16,(cz0+1)*16+16).ay;
      System.out.println("{\"kind\":\"region\",\"index\":"+ri+",\"seed\":"+q(""+seed)+",\"origin\":["+cx0+","+cz0+"],\"natural\":"+natural+",\"inputs\":"+inputs+"}");
      // Generators called directly at six origins on one world and one Random.
      for(String kind:kinds){
        long worldRand=pick.nextLong(),randSeed=pick.nextLong();int lightBase=pick.nextInt(16);int[][] at=new int[6][];
        for(int i=0;i<6;i++)at[i]=new int[]{(cx0+1)*16+pick.nextInt(32),(cz0+1)*16+pick.nextInt(32)};
        String label=ri+":"+kind;if(only!=null&&!only.equals(label))continue;
        BiomeDecoratorProbe.D w=BiomeDecoratorProbe.world(seed,worldRand);w.lightBase=lightBase;if(only!=null)w.trace=new StringBuilder();
        for(Object[] c:input)SpringProbe.chunk(w,(int)c[0],(int)c[1],(aji[])c[2],(byte[])c[3]);
        Random rand=new Random(randSeed);arn gen=gen(kind);StringBuilder origins=new StringBuilder("["),results=new StringBuilder("[");
        for(int i=0;i<6;i++){int x=at[i][0],z=at[i][1],y=w.f(x,z)+(kind.equals("well")?1:0);
          if(i>0){origins.append(',');results.append(',');}origins.append('[').append(x).append(',').append(y).append(',').append(z).append(']');
          if(kind.equals("dpbreak"))((arm)gen).a(i%6);
          results.append(gen.a(w,rand,x,y,z));
          if(kind.equals("dpbreak"))breakPlants(w,x,y,z);}
        System.out.println("{\"kind\":\"feature\",\"label\":"+q(label)+",\"region\":"+ri+",\"feature\":"+q(kind)+",\"worldRand\":"+q(""+worldRand)+",\"randSeed\":"+q(""+randSeed)+",\"lightBase\":"+lightBase
          +",\"origins\":"+origins+"],\"results\":"+results+"],\"nextLong\":"+q(""+rand.nextLong())+","+record(w)+"}");
        if(only!=null)System.err.print(w.trace);
      }
      // BiomeGenBase.decorate for the natural biome or the next slot in a shuffled cycle.
      for(int k=0;k<8;k++){
        long worldRand=pick.nextLong();int lightBase=pick.nextInt(16);
        List<int[]> targets=new ArrayList<>(Arrays.asList(new int[]{cx0+1,cz0+1},new int[]{cx0+2,cz0+1},new int[]{cx0+1,cz0+2},new int[]{cx0+2,cz0+2}));Collections.shuffle(targets,pick);
        int n=1+pick.nextInt(4);int[] chosen=new int[n];for(int i=0;i<n;i++)chosen[i]=pick.nextBoolean()?natural:order.get(next++%order.size());
        String label=ri+":"+k;if(only!=null&&!only.equals(label))continue;
        BiomeDecoratorProbe.D w=BiomeDecoratorProbe.world(seed,worldRand);w.lightBase=lightBase;if(only!=null)w.trace=new StringBuilder();
        for(Object[] c:input)SpringProbe.chunk(w,(int)c[0],(int)c[1],(aji[])c[2],(byte[])c[3]);
        StringBuilder decorations=new StringBuilder("[");
        for(int i=0;i<n;i++){
          int cx=targets.get(i)[0],cz=targets.get(i)[1],slot=chosen[i];ahu b=ahu.n()[slot];long ps=BiomeDecoratorProbe.populationSeed(seed,cx,cz);Random rand=new Random(ps);
          b.a(w,rand,cx*16,cz*16);
          if(decorations.length()>1)decorations.append(',');decorations.append("[").append(cx).append(',').append(cz).append(',').append(slot).append(',').append(q(""+ps)).append(',').append(q(""+rand.nextLong())).append(']');
        }
        decorations.append(']');
        System.out.println("{\"kind\":\"decorate\",\"label\":"+q(label)+",\"region\":"+ri+",\"worldRand\":"+q(""+worldRand)+",\"lightBase\":"+lightBase+",\"decorations\":"+decorations+","+record(w)+"}");
        if(only!=null)System.err.print(w.trace);
      }
    }
  }
}
