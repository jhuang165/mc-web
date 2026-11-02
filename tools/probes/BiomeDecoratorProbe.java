import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 BiomeDecorator.decorateChunk (aia.a(ahb,Random,ahu,II)) and its genDecorations
// driver: ores, sand/clay/gravel discs, trees with the biome picker, big mushrooms, biome flowers,
// grass, dead bushes, lilies, mushrooms, reeds, pumpkins, cacti and springs, called through each
// biome's own decorator instance (biome decorate overrides are not run). The world is
// SpringProbe's World double over real Chunk storage built from native terrain (ChunkProviderGenerate
// generateTerrain + replaceBlocksForBiome, MapGenCaves, MapGenRavine) for a 4x4 chunk region;
// the inner 2x2 chunks are decorated with chosen biome slots.
public class BiomeDecoratorProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static class D extends SpringProbe.G {
    public ahu a(int x,int z){return manager.a(x,z);}
  }
  static D world(long seed,long worldRand)throws Exception{
    D w=SpringProbe.world(D.class,seed,worldRand);w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    return w;
  }
  static long populationSeed(long seed,int x,int z){Random r=new Random(seed);long a=r.nextLong()/2L*2L+1L,b=r.nextLong()/2L*2L+1L;return (long)x*a+(long)z*b^seed;}
  static String sha(String s)throws Exception{return TerrainProbe.hex(MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8")));}
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    String only=args.length>0?args[0]:null;
    // Decorated slots: overworld biomes whose decorator is the base BiomeDecorator.
    List<Integer> slots=new ArrayList<>();StringBuilder biomes=new StringBuilder("[");
    for(int slot=0;slot<256;slot++){ahu b=ahu.n()[slot];if(b==null)continue;
      Object param=b instanceof aif?TerrainProbe.get(b,"aF"):-1;
      if(biomes.length()>1)biomes.append(',');biomes.append('[').append(slot).append(',').append(q(b.getClass().getName())).append(',').append(q(b.ar.getClass().getName())).append(',').append(param).append(']');
      if(slot!=8&&slot!=9&&b.ar.getClass()==aia.class)slots.add(slot);}
    biomes.append(']');
    System.out.println("{\"kind\":\"config\",\"biomes\":"+biomes+",\"slots\":"+slots+"}");
    long[][] regions={{8675309L,-2,-2},{0L,9,-7},{-123456789L,40,22},{1234567L,-60,31},{42L,-3,12}};
    Random pick=new Random(20261102L);int next=0;List<Integer> order=new ArrayList<>(slots);Collections.shuffle(order,pick);
    for(int ri=0;ri<regions.length;ri++){
      long seed=regions[ri][0];int cx0=(int)regions[ri][1],cz0=(int)regions[ri][2];
      D t=world(seed,0);TerrainProbe.resetMesa();aqz gen=new aqz(t,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
      List<Object[]> input=new ArrayList<>();StringBuilder inputs=new StringBuilder("[");
      for(int x=cx0;x<cx0+4;x++)for(int z=cz0;z<cz0+4;z++){
        aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(gen,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
        axl.a();gen.a(x,z,blocks);axl.a();gen.a(x,z,blocks,meta,t.manager.b(null,x*16,z*16,16,16));caves.a(null,t,x,z,blocks);ravines.a(null,t,x,z,blocks);
        input.add(new Object[]{x,z,blocks,meta});
        if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(',').append(q(TerrainProbe.hash(meta))).append(']');
      }
      inputs.append(']');
      System.out.println("{\"kind\":\"region\",\"index\":"+ri+",\"seed\":"+q(""+seed)+",\"origin\":["+cx0+","+cz0+"],\"inputs\":"+inputs+"}");
      for(int k=0;k<14;k++){
        long worldRand=pick.nextLong();int lightBase=pick.nextInt(16);
        List<int[]> targets=new ArrayList<>(Arrays.asList(new int[]{cx0+1,cz0+1},new int[]{cx0+2,cz0+1},new int[]{cx0+1,cz0+2},new int[]{cx0+2,cz0+2}));Collections.shuffle(targets,pick);
        int n=1+pick.nextInt(4);
        D w=world(seed,worldRand);w.lightBase=lightBase;String label=ri+":"+k;if(only!=null&&!only.equals(label)){for(int i=0;i<n;i++)next++;continue;}
        if(only!=null)w.trace=new StringBuilder();
        for(Object[] c:input)SpringProbe.chunk(w,(int)c[0],(int)c[1],(aji[])c[2],(byte[])c[3]);
        StringBuilder decorations=new StringBuilder("[");
        for(int i=0;i<n;i++){
          int cx=targets.get(i)[0],cz=targets.get(i)[1],slot=order.get(next++%order.size());ahu b=ahu.n()[slot];long ps=populationSeed(seed,cx,cz);Random rand=new Random(ps);
          b.ar.a(w,rand,b,cx*16,cz*16);
          if(decorations.length()>1)decorations.append(',');decorations.append("[").append(cx).append(',').append(cz).append(',').append(slot).append(',').append(q(""+ps)).append(',').append(q(""+rand.nextLong())).append(']');
        }
        decorations.append(']');
        System.out.println("{\"kind\":\"decorate\",\"label\":"+q(label)+",\"region\":"+ri+",\"worldRand\":"+q(""+worldRand)+",\"lightBase\":"+lightBase+",\"decorations\":"+decorations
          +",\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writeCount\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))
          +",\"pendingCount\":"+w.pendingKeys.size()+",\"pendingSha1\":"+q(sha(w.pending.toString()))+",\"drops\":["+w.drops+"],\"sounds\":["+w.sounds+"],\"aux\":["+w.aux+"],\"stateSha1\":"+q(w.state())+",\"worldNextLong\":"+q(""+w.s.nextLong())+"}");
        if(only!=null)System.err.print(w.trace);
      }
    }
  }
}
