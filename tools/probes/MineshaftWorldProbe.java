import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Live-world mineshafts (GEN-05b), Minecraft Java 1.7.10. For an 8x8-chunk live area plus a
// one-chunk ring, chunks load in x-outer, z-inner order as ChunkProviderServer.loadChunk does:
// the unchanged ChunkProviderGenerate.provideChunk (aqz.d: terrain, biome surface, MapGenCaves,
// MapGenRavine, Chunk construction and skylight map; map features off so no other structure runs),
// then the unchanged MapGenMineshaft start search (asw via MapGenBase.func_151539_a), then
// Chunk.populateChunk's four checks copied from apx.a(apu,apu,II), where the populate step is only
// ChunkProviderGenerate.populate's population reseed followed by the unchanged
// MapGenStructure.generateStructuresInChunk (ave.a(ahb,Random,II)) with BlockFalling.fallInstantly.
// The World is SpringProbe's double over real Chunk storage, so real World.setBlock, Chunk
// callbacks (BlockTorch, BlockRail/BlockRailBase$Rail, BlockMobSpawner tile entities) and
// notifications run. isBlockNormalCubeDefault reads loaded chunks (the double has no chunk
// provider); EntityMinecartChest spawns and EntityItem drops are recorded; MapGenStructureData is
// stubbed (load null, save ignored). World.rand is seeded 0.
// Args: label:seed:type:originChunkX:originChunkZ, type default|amplified|largeBiomes.
public class MineshaftWorldProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static class M extends SpringProbe.G {
    List<String> carts;
    public ahu a(int x,int z){return manager.a(x,z);}
    public boolean c(int x,int y,int z,boolean def){
      if(x< -30000000||z< -30000000||x>=30000000||z>=30000000)return def;
      if(!c(x>>4,z>>4))throw new AssertionError("normal-cube read of unloaded chunk "+(x>>4)+","+(z>>4));
      aji b=a(x,y,z);return b.o().k()&&b.d();
    }
    public boolean d(sa e){
      if(e instanceof xm){xm m=(xm)e;StringBuilder s=new StringBuilder("[").append(e.s).append(',').append(e.t).append(',').append(e.u).append(",[");
        for(int i=0;i<m.a();i++){if(i>0)s.append(',');s.append(MineshaftProbe.stack(m.a(i)));}
        carts.add(s.append("]]").toString());return true;}
      if(!(e instanceof xk))throw new AssertionError(e.getClass().getName());
      return super.d(e);
    }
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
  }
  static M world(long seed,ahm type)throws Exception{
    M w=SpringProbe.world(M.class,seed,0L);w.carts=new ArrayList<>();w.manager=new aib(seed,type);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}
    return w;
  }
  // Chunk cells: little-endian int32 id | meta << 12 per (x, z, y).
  static String chunkHash(apx c)throws Exception{
    MessageDigest d=MessageDigest.getInstance("SHA-1");byte[] buf=new byte[65536*4];int k=0;
    for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){int v=aji.b(c.a(x,y,z))|c.c(x,y,z)<<12;buf[k++]=(byte)v;buf[k++]=(byte)(v>>8);buf[k++]=(byte)(v>>16);buf[k++]=(byte)(v>>24);}
    d.update(buf);return TerrainProbe.hex(d.digest());
  }
  static String list(List<String> l){return "["+String.join(",",l)+"]";}
  static void run(String label,long seed,String typeName,int cx0,int cz0)throws Exception{
    ahm type=typeName.equals("default")?ahm.b:typeName.equals("amplified")?ahm.e:typeName.equals("largeBiomes")?ahm.d:null;
    if(type==null)throw new AssertionError(typeName);
    TerrainProbe.resetMesa();M w=world(seed,type);aqz gen=new aqz(w,seed,false);asw m=new asw();
    Set<Long> populated=new HashSet<>();List<String> order=new ArrayList<>(),inputs=new ArrayList<>(),rows=new ArrayList<>();
    for(int x=cx0-1;x<=cx0+8;x++)for(int z=cz0-1;z<=cz0+8;z++){
      apx c=gen.d(x,z);m.a((apu)gen,w,x,z,(aji[])null);c.d=true;w.chunks.put(SpringProbe.G.ck(x,z),c);
      inputs.add("["+x+","+z+","+q(chunkHash(c))+"]");
      int[][] tries=new int[4][];
      if(!populated.contains(SpringProbe.G.ck(x,z))&&w.c(x+1,z+1)&&w.c(x,z+1)&&w.c(x+1,z))tries[0]=new int[]{x,z};
      if(w.c(x-1,z)&&!populated.contains(SpringProbe.G.ck(x-1,z))&&w.c(x-1,z+1)&&w.c(x,z+1)&&w.c(x-1,z+1))tries[1]=new int[]{x-1,z};
      if(w.c(x,z-1)&&!populated.contains(SpringProbe.G.ck(x,z-1))&&w.c(x+1,z-1)&&w.c(x+1,z-1)&&w.c(x+1,z))tries[2]=new int[]{x,z-1};
      if(w.c(x-1,z-1)&&!populated.contains(SpringProbe.G.ck(x-1,z-1))&&w.c(x,z-1)&&w.c(x-1,z))tries[3]=new int[]{x-1,z-1};
      // Each check reads the population flag at its own turn, after the earlier populates ran.
      for(int[] t:tries){
        if(t==null||populated.contains(SpringProbe.G.ck(t[0],t[1])))continue;
        populated.add(SpringProbe.G.ck(t[0],t[1]));order.add("["+t[0]+","+t[1]+"]");
        w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.carts=new ArrayList<>();
        Random r=new Random(BiomeDecoratorProbe.populationSeed(seed,t[0],t[1]));akx.M=true;boolean ok=m.a(w,r,t[0],t[1]);akx.M=false;
        if(w.writeCount>0||!w.carts.isEmpty()||ok)rows.add("{\"chunk\":["+t[0]+","+t[1]+"],\"result\":"+ok+",\"writeCount\":"+w.writeCount+",\"writesSha1\":"+q(TerrainProbe.hex(w.writes.digest()))
          +",\"callCount\":"+w.callCount+",\"callsSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"carts\":"+list(w.carts)+",\"nextLong\":"+q(""+r.nextLong())+"}");
      }
    }
    List<String> spawners=new ArrayList<>();
    for(Object o:w.g)if(o instanceof apj&&!((aor)o).r()){aor t=(aor)o;spawners.add("["+t.c+","+t.d+","+t.e+","+q(((apj)o).a().e())+"]");}
    List<String> area=new ArrayList<>();
    for(int x=cx0;x<cx0+8;x++)for(int z=cz0;z<cz0+8;z++)area.add(q(chunkHash(w.chunks.get(SpringProbe.G.ck(x,z)))));
    System.out.println("{\"kind\":\"world\",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"type\":"+q(typeName)+",\"origin\":["+cx0+","+cz0+"],\"inputs\":"+list(inputs)
      +",\"populated\":"+list(order)+",\"chunks\":"+list(rows)+",\"starts\":"+MineshaftProbe.startList(m,0)+",\"spawners\":"+list(spawners)
      +",\"pendingCount\":"+w.pendingKeys.size()+",\"pending\":["+w.pending+"],\"drops\":["+w.drops+"],\"areaSha1\":"+list(area)+",\"worldNextLong\":"+q(""+w.s.nextLong())+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    // Block facts the JS world uses: isBlockNormalCubeDefault (Material.isOpaque && renderAsNormalBlock),
    // Block.isNormalCube, Block.canProvidePower and the rail blocks.
    List<String> normalDefault=new ArrayList<>(),normal=new ArrayList<>(),power=new ArrayList<>(),rails=new ArrayList<>();
    for(int id=0;id<256;id++){aji b=aji.e(id);if(aji.b(b)!=id)continue;
      if(b.o().k()&&b.d())normalDefault.add(""+id);if(b.r())normal.add(""+id);if(b.f())power.add(""+id);if(aje.a(b))rails.add(""+id);}
    System.out.println("{\"kind\":\"config\",\"normalCubeDefault\":"+list(normalDefault)+",\"normalCube\":"+list(normal)+",\"canProvidePower\":"+list(power)+",\"rails\":"+list(rails)
      +",\"torchStands\":["+aji.b(ajn.aJ)+","+aji.b(ajn.bk)+","+aji.b(ajn.w)+","+aji.b(ajn.bK)+"]}");
    for(String a:args){String[] p=a.split(":");run(p[0],Long.parseLong(p[1]),p[2],Integer.parseInt(p[3]),Integer.parseInt(p[4]));}
  }
}
