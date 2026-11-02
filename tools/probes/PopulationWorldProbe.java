import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged ChunkProviderGenerate.populate, map features ON with only mineshafts enabled.
// Other structure objects are no-op subclasses: no draws or writes. 64 provideChunk/start
// searches first, then 64 populates x outer/z inner. Lazy halo supplies unpopulated terrain.
// World light is explicitly fixture 0/full and block, 15 sky; no light propagation claim.
public class PopulationWorldProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static class NoStronghold extends aug {
    public void a(apu p,ahb w,int x,int z,aji[] b){}
    public boolean a(ahb w,Random r,int x,int z){return false;}
  }
  public static class NoVillage extends avn {
    public void a(apu p,ahb w,int x,int z,aji[] b){}
    public boolean a(ahb w,Random r,int x,int z){return false;}
  }
  public static class NoTemple extends atx {
    public void a(apu p,ahb w,int x,int z,aji[] b){}
    public boolean a(ahb w,Random r,int x,int z){return false;}
  }
  public static class W extends MineshaftWorldProbe.M {
    aqz halo; List<sa> animals;
    public boolean c(int x,int z){return true;}
    public apx e(int x,int z){
      apx c=chunks.get(ck(x,z));
      if(c==null){c=halo.d(x,z);c.d=true;chunks.put(ck(x,z),c);}return c;
    }
    public int j(int x,int y,int z){call(3,x,y,z);return 0;}
    public int b(ahn l,int x,int y,int z){call(l==ahn.a?7:6,x,y,z);return l==ahn.a?15:0;}
    public boolean d(sa e){if(e instanceof xm||e instanceof xk)return super.d(e);animals.add(e);return true;}
    String entities(){StringBuilder s=new StringBuilder("[");
      for(sa e:animals){if(s.length()>1)s.append(',');String name=PopulationTailProbe.NAMES.get(e.getClass());if(name==null)throw new AssertionError(e.getClass());
        s.append('[').append(PopulationWorldProbe.q(name)).append(',').append(e.s).append(',').append(e.t).append(',').append(e.u).append(',').append(Float.floatToIntBits(e.y)).append(',').append(e instanceof wp?((wp)e).bZ():-1).append(']');}
      return s.append(']').toString();
    }
  }
  static String tiles(W w){
    List<aor> all=new ArrayList<>();for(apx c:w.chunks.values())for(Object o:c.i.values())all.add((aor)o);
    all.sort(Comparator.<aor>comparingInt(t->t.c).thenComparingInt(t->t.e).thenComparingInt(t->t.d));
    List<String> out=new ArrayList<>();for(aor t:all){
      if(t instanceof apj)out.add("["+t.c+","+t.d+","+t.e+",\"spawner\","+q(((apj)t).a().e())+"]");
      else if(t instanceof aow){List<String> slots=new ArrayList<>();for(int i=0;i<27;i++)slots.add(MineshaftProbe.stack(((aow)t).a(i)));
        out.add("["+t.c+","+t.d+","+t.e+",\"chest\","+w.e(t.c,t.d,t.e)+",["+String.join(",",slots)+"]]");}
      else throw new AssertionError(t.getClass());
    }return "["+String.join(",",out)+"]";
  }
  static void run(String label,long seed,String typeName,int cx,int cz)throws Exception{
    ahm type=typeName.equals("default")?ahm.b:typeName.equals("amplified")?ahm.e:ahm.d;
    TerrainProbe.resetMesa();W w=SpringProbe.world(W.class,seed,0L);w.carts=new ArrayList<>();w.animals=new ArrayList<>();w.manager=new aib(seed,type);
    w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}
    aqz gen=new aqz(w,seed,true);w.halo=new aqz(w,seed,false);
    TerrainProbe.field(aqz.class,"u").set(gen,new NoStronghold());TerrainProbe.field(aqz.class,"v").set(gen,new NoVillage());TerrainProbe.field(aqz.class,"x").set(gen,new NoTemple());
    List<String> inputs=new ArrayList<>(),steps=new ArrayList<>();
    for(int x=cx;x<cx+8;x++)for(int z=cz;z<cz+8;z++){apx c=gen.d(x,z);c.d=true;w.chunks.put(SpringProbe.G.ck(x,z),c);inputs.add("["+x+","+z+","+q(MineshaftWorldProbe.chunkHash(c))+"]");}
    Random random=(Random)TerrainProbe.get(gen,"i");
    for(int x=cx;x<cx+8;x++)for(int z=cz;z<cz+8;z++){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;
      gen.a(gen,x,z);
      steps.add("{\"chunk\":["+x+","+z+"],\"calls\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writes\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+",\"nextLong\":"+q(""+random.nextLong())+"}");
    }
    List<String> area=new ArrayList<>();for(int x=cx;x<cx+8;x++)for(int z=cz;z<cz+8;z++)area.add(q(MineshaftWorldProbe.chunkHash(w.e(x,z))));
    System.out.println("{\"kind\":\"world\",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"type\":"+q(typeName)+",\"origin\":["+cx+","+cz+"],\"inputs\":["+String.join(",",inputs)+"],\"steps\":["+String.join(",",steps)+"],\"areaSha1\":["+String.join(",",area)+"],\"tiles\":"+tiles(w)+",\"entities\":"+w.entities()+",\"carts\":["+String.join(",",w.carts)+"],\"pending\":["+w.pending+"],\"drops\":["+w.drops+"],\"worldNextLong\":"+q(""+w.s.nextLong())+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    for(String a:args){String[] p=a.split(":");run(p[0],Long.parseLong(p[1]),p[2],Integer.parseInt(p[3]),Integer.parseInt(p[4]));}
  }
}
