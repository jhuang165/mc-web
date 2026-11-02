import java.lang.reflect.*;
import java.util.*;

// The end of an unchanged 1.7.10 ChunkProviderGenerate.populate after the lakes and dungeons:
// BiomeGenBase.decorate, SpawnerAnimals.performWorldGenSpawning (aho.a) and the freeze/snow pass.
// The freeze/snow loop is populate's own inline code, copied here with its native World calls
// (getPrecipitationHeight, isBlockFreezable, func_147478_e and setBlock flag 2). The world is
// BiomeDecoratorProbe's Chunk-backed double over native terrain, caves and ravines, with a
// synthetic saved block light (call kind 6) and spawned animals captured in spawnEntityInWorld.
public class PopulationTailProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static final Map<Class<?>,String> NAMES=new LinkedHashMap<>();
  static{NAMES.put(wo.class,"Pig");NAMES.put(wp.class,"Sheep");NAMES.put(wg.class,"Chicken");NAMES.put(wh.class,"Cow");
    NAMES.put(wi.class,"EntityHorse");NAMES.put(wv.class,"Wolf");NAMES.put(wm.class,"MushroomCow");}
  public static class P extends BiomeDecoratorProbe.D {
    List<sa> spawned=new ArrayList<>();
    public int b(ahn l,int x,int y,int z){if(l!=ahn.b)return super.b(l,x,y,z);call(6,x,y,z);return Math.floorMod(x*7+y*3+z*13+lightBase,14);}
    public boolean d(sa e){if(e instanceof xk)return super.d(e);spawned.add(e);return true;}
    String entities(){StringBuilder s=new StringBuilder("[");
      for(sa e:spawned){if(s.length()>1)s.append(',');String name=NAMES.get(e.getClass());if(name==null)throw new IllegalStateException(e.getClass().getName());
        s.append('[').append(TerrainProbe.q(name)).append(',').append(e.s).append(',').append(e.t).append(',').append(e.u).append(',').append(Float.floatToIntBits(e.y)).append(',').append(Float.floatToIntBits(e.z)).append(',').append(e instanceof wp?((wp)e).bZ():-1).append(']');}
      return s.append(']').toString();}
  }
  static P world(long seed,long worldRand)throws Exception{
    P w=SpringProbe.world(P.class,seed,worldRand);w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.spawned=new ArrayList<>();return w;
  }
  // ChunkProviderGenerate.populate's last loop for chunk (cx, cz).
  static void snow(ahb w,int cx,int cz){
    int n6=cx*16+8,n7=cz*16+8;
    for(int n5=0;n5<16;++n5)for(int n4=0;n4<16;++n4){
      int n3=w.h(n6+n5,n7+n4);
      if(w.r(n5+n6,n3-1,n4+n7))w.d(n5+n6,n3-1,n4+n7,ajn.aD,0,2);
      if(!w.e(n5+n6,n3,n4+n7,true))continue;
      w.d(n5+n6,n3,n4+n7,ajn.aC,0,2);
    }
  }
  static Object field(Object o,String n)throws Exception{return BiomeOverrideProbe.field(o,n);}
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    String only=args.length>0?args[0]:null;
    List<Integer> slots=new ArrayList<>();StringBuilder biomes=new StringBuilder("[");
    for(int slot=0;slot<256;slot++){ahu b=ahu.n()[slot];if(b==null||slot==8||slot==9)continue;slots.add(slot);
      StringBuilder list=new StringBuilder("[");
      for(Object o:b.a(sx.b)){ahx e=(ahx)o;if(list.length()>1)list.append(',');String name=NAMES.get(e.b);if(name==null)throw new IllegalStateException(e.b.getName());
        list.append('[').append(TerrainProbe.q(name)).append(',').append(((qw)e).a).append(',').append(e.c).append(',').append(e.d).append(']');}
      if(biomes.length()>1)biomes.append(',');
      biomes.append('[').append(slot).append(',').append(Float.floatToIntBits((Float)field(b,"ao"))).append(',').append(Float.floatToIntBits(b.g())).append(',').append(list).append("]]");}
    biomes.append(']');
    StringBuilder normal=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(b!=null&&b!=ajn.a&&b.r()){if(normal.length()>1)normal.append(',');normal.append(id);}}normal.append(']');
    System.out.println("{\"kind\":\"config\",\"biomes\":"+biomes+",\"slots\":"+slots+",\"normalCubes\":"+normal+",\"blocks\":["+aji.b(ajn.aD)+","+aji.b(ajn.aC)+","+aji.b(ajn.j)+","+aji.b(ajn.i)+","+aji.b(ajn.cj)+","+aji.b(ajn.h)+"]}");
    long[][] regions={{1234567L,92,64},{8675309L,-136,-68},{0L,92,-88},{7L,-12,116},{8675309L,-100,-68},{8675309L,-136,32},{8675309L,-124,-104},{8675309L,-156,-144},{8675309L,-160,-108},{8675309L,-80,40},{8675309L,-20,-172},{1234567L,56,108}};
    Random pick=new Random(20261104L);int next=0;List<Integer> order=new ArrayList<>(slots);Collections.shuffle(order,pick);
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
      String[] modes={"spawn","spawn","spawn","spawn","spawn","spawn","snow","snow","tail","tail","tail","tail"};
      for(int k=0;k<modes.length;k++){
        String mode=modes[k];long worldRand=pick.nextLong(),randSeed=pick.nextLong();int lightBase=pick.nextInt(16);
        List<int[]> targets=new ArrayList<>(Arrays.asList(new int[]{cx0+1,cz0+1},new int[]{cx0+2,cz0+1},new int[]{cx0+1,cz0+2},new int[]{cx0+2,cz0+2}));Collections.shuffle(targets,pick);
        int n=mode.equals("snow")?4:1+pick.nextInt(4);int[] chosen=new int[n];
        // The fifth spawn record uses plains, the only common horse list.
        for(int i=0;i<n;i++)chosen[i]=mode.equals("spawn")&&!pick.nextBoolean()?order.get(next++%order.size()):k==5?1:-1;
        String label=ri+":"+k;if(only!=null&&!only.equals(label))continue;
        P w=world(seed,worldRand);w.lightBase=lightBase;if(only!=null)w.trace=new StringBuilder();
        for(Object[] c:input)SpringProbe.chunk(w,(int)c[0],(int)c[1],(aji[])c[2],(byte[])c[3]);
        Random rand=new Random(randSeed);StringBuilder steps=new StringBuilder("[");
        for(int i=0;i<n;i++){
          int cx=targets.get(i)[0],cz=targets.get(i)[1];ahu b=chosen[i]>=0?ahu.n()[chosen[i]]:w.a(cx*16+16,cz*16+16);
          if(mode.equals("spawn")){for(int r=0;r<20;r++)aho.a(w,b,cx*16+8,cz*16+8,16,16,rand);}
          else if(mode.equals("snow"))snow(w,cx,cz);
          else{rand.setSeed(BiomeDecoratorProbe.populationSeed(seed,cx,cz));b.a(w,rand,cx*16,cz*16);aho.a(w,b,cx*16+8,cz*16+8,16,16,rand);snow(w,cx,cz);}
          if(steps.length()>1)steps.append(',');steps.append('[').append(cx).append(',').append(cz).append(',').append(b.ay).append(',').append(w.spawned.size()).append(',').append(q(""+rand.nextLong())).append(']');
        }
        // Snow records then populate the first chunk from decorate on and rerun the loop over all four,
        // so precipitation heights cached by the first pass are read after decorate's writes.
        String again="null";
        if(mode.equals("snow")){
          int cx=targets.get(0)[0],cz=targets.get(0)[1];ahu b=w.a(cx*16+16,cz*16+16);rand.setSeed(BiomeDecoratorProbe.populationSeed(seed,cx,cz));
          b.a(w,rand,cx*16,cz*16);aho.a(w,b,cx*16+8,cz*16+8,16,16,rand);snow(w,cx,cz);
          // Then every third column of the second chunk's loop area is edited around its cached height:
          // a block on top, the top block removed, a floating block, or a block removed lower down.
          int ex=targets.get(1)[0]*16+8,ez=targets.get(1)[1]*16+8;
          for(int i=0;i<256;i+=3){int x=ex+(i&15),z=ez+(i>>4),h=w.h(x,z);
            switch(i%4){case 0:w.d(x,h,z,ajn.b,0,2);break;case 1:w.d(x,h-1,z,ajn.a,0,2);break;case 2:w.d(x,h+2,z,ajn.b,0,2);break;default:w.d(x,h-2,z,ajn.a,0,2);}}
          for(int[] c:targets)snow(w,c[0],c[1]);
          again="["+cx+","+cz+","+b.ay+","+w.spawned.size()+","+q(""+rand.nextLong())+"]";
        }
        System.out.println("{\"kind\":\"record\",\"label\":"+q(label)+",\"region\":"+ri+",\"mode\":"+q(mode)+",\"worldRand\":"+q(""+worldRand)+",\"randSeed\":"+q(""+randSeed)+",\"lightBase\":"+lightBase
          +",\"steps\":"+steps+"],\"again\":"+again+",\"entities\":"+w.entities()+","+BiomeOverrideProbe.record(w)+"}");
        if(only!=null)System.err.print(w.trace);
      }
    }
  }
}
