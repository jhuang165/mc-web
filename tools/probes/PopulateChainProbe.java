import java.lang.reflect.*;
import java.util.*;

// The unchanged 1.7.10 ChunkProviderGenerate.populate (aqz.a(provider, x, z)) with map features off:
// the biome read, the population reseed, water and lava lakes, eight dungeon attempts, the biome's
// decorate, worldgen animals and the freeze/snow loop. The world is PopulationTailProbe's Chunk-backed
// double over a 6x6-chunk region of native terrain, caves and ravines, plus a synthetic saved sky
// light (call kind 7) for the lakes' grass test and its chunks marked loaded. Real chest and spawner tile entities live in the
// chunks' maps, and the records list them after the inner 4x4 chunks are populated in shuffled order.
public class PopulateChainProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static class C extends PopulationTailProbe.P {
    public int b(ahn l,int x,int y,int z){if(l!=ahn.a)return super.b(l,x,y,z);call(7,x,y,z);return Math.floorMod(x*3+y*5+z*7+lightBase,16);}
  }
  static C world(long seed,long worldRand)throws Exception{
    C w=SpringProbe.world(C.class,seed,worldRand);w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.spawned=new ArrayList<>();return w;
  }
  // Tile entities in the chunk maps, chunks in key order and entries by y, z, x.
  static String tiles(C w)throws Exception{
    List<Long> keys=new ArrayList<>(w.chunks.keySet());Collections.sort(keys);StringBuilder s=new StringBuilder("[");Field name=TerrainProbe.field(agq.class,"a");
    for(long k:keys){List<aor> list=new ArrayList<>();for(Object o:w.chunks.get(k).i.values())list.add((aor)o);
      list.sort(Comparator.<aor>comparingInt(t->t.d).thenComparingInt(t->t.e).thenComparingInt(t->t.c));
      for(aor t:list){if(s.length()>1)s.append(',');s.append('[').append(t.c).append(',').append(t.d).append(',').append(t.e).append(',');
        if(t instanceof aow){s.append(q("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)s.append(',');s.append(DungeonProbe.stack(((aow)t).a(i)));}s.append(']');}
        else if(t instanceof apj)s.append(q("spawner")).append(',').append(q((String)name.get(((apj)t).a())));
        else throw new IllegalStateException(t.getClass().getName());
        s.append(',').append(t.r()).append(']');}}
    return s.append(']').toString();
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    String only=args.length>0?args[0]:null;
    StringBuilder comparators=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(b!=null&&aji.b(b)==id&&b.M()){if(comparators.length()>1)comparators.append(',');comparators.append(id);}}comparators.append(']');
    StringBuilder providers=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(b!=null&&aji.b(b)==id&&b instanceof akw){if(providers.length()>1)providers.append(',');providers.append(id);}}providers.append(']');
    System.out.println("{\"kind\":\"config\",\"comparators\":"+comparators+",\"tileProviders\":"+providers+",\"blocks\":["+aji.b(ajn.ae)+","+aji.b(ajn.ac)+","+aji.b(ajn.j)+","+aji.b(ajn.l)+","+aji.b(ajn.bh)+"]}");
    // [seed, origin chunk x, z] of 6x6 regions; the inner 4x4 chunks are populated.
    long[][] regions=REGIONS;
    Random pick=new Random(20261105L);
    for(int ri=0;ri<regions.length;ri++){
      long seed=regions[ri][0];int cx0=(int)regions[ri][1],cz0=(int)regions[ri][2];
      BiomeDecoratorProbe.D t=BiomeDecoratorProbe.world(seed,0);TerrainProbe.resetMesa();aqz g=new aqz(t,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
      List<Object[]> input=new ArrayList<>();StringBuilder inputs=new StringBuilder("[");
      for(int x=cx0;x<cx0+6;x++)for(int z=cz0;z<cz0+6;z++){
        aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(g,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
        axl.a();g.a(x,z,blocks);axl.a();g.a(x,z,blocks,meta,t.manager.b(null,x*16,z*16,16,16));caves.a(null,t,x,z,blocks);ravines.a(null,t,x,z,blocks);
        input.add(new Object[]{x,z,blocks,meta});
        if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(',').append(q(TerrainProbe.hash(meta))).append(']');
      }
      inputs.append(']');
      System.out.println("{\"kind\":\"region\",\"index\":"+ri+",\"seed\":"+q(""+seed)+",\"origin\":["+cx0+","+cz0+"],\"inputs\":"+inputs+"}");
      for(int k=0;k<2;k++){
        long worldRand=pick.nextLong();int lightBase=pick.nextInt(16);
        List<int[]> targets=new ArrayList<>();for(int x=cx0+1;x<cx0+5;x++)for(int z=cz0+1;z<cz0+5;z++)targets.add(new int[]{x,z});Collections.shuffle(targets,pick);
        // The first record populates all sixteen inner chunks, the second a shuffled subset.
        int n=k==0?16:4+pick.nextInt(9);
        String label=ri+":"+k;if(only!=null&&!only.equals(label))continue;
        C w=world(seed,worldRand);w.lightBase=lightBase;if(only!=null)w.trace=new StringBuilder();
        // Chunks are loaded (Chunk.onChunkLoad's isChunkLoaded) before ChunkProviderServer populates them;
        // Chunk.removeTileEntity only acts on loaded chunks.
        for(Object[] c:input){SpringProbe.chunk(w,(int)c[0],(int)c[1],(aji[])c[2],(byte[])c[3]);w.chunks.get(SpringProbe.G.ck((int)c[0],(int)c[1])).d=true;}
        aqz gen=new aqz(w,seed,false);Random rand=(Random)TerrainProbe.get(gen,"i");StringBuilder steps=new StringBuilder("[");
        for(int i=0;i<n;i++){
          int cx=targets.get(i)[0],cz=targets.get(i)[1];
          gen.a(gen,cx,cz);
          if(steps.length()>1)steps.append(',');steps.append('[').append(cx).append(',').append(cz).append(',').append(w.a(cx*16+16,cz*16+16).ay).append(',').append(w.spawned.size()).append(',').append(q(""+rand.nextLong())).append(']');
        }
        String listed=tiles(w),removed;
        // Every tile entity is then removed, as an overlapping lake or dungeon would: chests emptied
        // slot by slot and set to air with notification, spawners overwritten with stone at flag 2.
        {List<aor> all=new ArrayList<>();for(apx c:w.chunks.values())for(Object o:c.i.values())all.add((aor)o);
          all.sort(Comparator.<aor>comparingInt(e->e.c).thenComparingInt(e->e.e).thenComparingInt(e->e.d));
          for(aor e:all){if(e instanceof aow){for(int i=0;i<27;i++)((aow)e).a(i,null);w.f(e.c,e.d,e.e);}else w.d(e.c,e.d,e.e,ajn.b,0,2);}
          removed=tiles(w);}
        System.out.println("{\"kind\":\"record\",\"label\":"+q(label)+",\"region\":"+ri+",\"worldRand\":"+q(""+worldRand)+",\"lightBase\":"+lightBase
          +",\"steps\":"+steps+"],\"entities\":"+w.entities()+",\"tiles\":"+listed+",\"removed\":"+removed+","+BiomeOverrideProbe.record(w)+"}");
        if(only!=null)System.err.print(w.trace);
      }
    }
  }
  // Four of PopulationTailProbe's regions shifted out by a chunk, then regions whose inner chunks
  // hold successful dungeons in a scan of pre-population terrain.
  static final long[][] REGIONS={{1234567L,91,63},{8675309L,-137,-69},{0L,91,-89},{7L,-13,115},
    {8675309L,-109,-142},{8675309L,-150,-144},{1234567L,81,42},{1234567L,44,71},{0L,72,-69},{0L,60,-110},{7L,-26,110},{7L,-21,97},{7L,-1,97},
    {42L,7,-19},{42L,9,17},{-123456789L,31,24},{-123456789L,37,23}};
}
