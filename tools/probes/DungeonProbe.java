import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged WorldGenDungeons and its loot/enchantment helpers. World is a double.
public class DungeonProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static String key(int x,int y,int z){return x+","+y+","+z;}
  static String stack(add s){
    if(s==null)return "null";
    StringBuilder e=new StringBuilder("[");dq tags=ade.bR.g(s);
    for(int i=0;i<tags.c();i++){if(i>0)e.append(',');dh t=tags.b(i);e.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']');}
    return "["+adb.b(s.b())+","+s.b+","+s.k()+","+e+"]]";
  }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){} // Suppress native world notifications only.
  }
  static class W extends TerrainProbe.W {
    String fixture;String inputs;long worldSeed;Map<String,aji[]> chunks;int x,y,z,rx,rz;Map<String,aji> edits=new HashMap<>();Map<String,aor> tiles=new LinkedHashMap<>();
    StringBuilder writes=new StringBuilder("[");MessageDigest calls;int callCount;
    void call(int... args){callCount++;for(int a:args)for(int s=0;s<32;s+=8)calls.update((byte)(a>>s));}
    public aji a(int bx,int by,int bz){call(0,bx,by,bz);if(by<0||by>=256||bx< -30000000||bx>=30000000||bz< -30000000||bz>=30000000)return aji.e(0);
      aji edit=edits.get(key(bx,by,bz));if(edit!=null)return edit;
      if(fixture.equals("natural")){aji[] c=chunks.get((bx>>4)+","+(bz>>4));if(c==null)throw new AssertionError("Missing chunk");aji b=c[((bx&15)*16+(bz&15))*256+by];return b==null?aji.e(0):b;}
      int dx=bx-x,dy=by-y,dz=bz-z,id=1;
      boolean tunnel=dy>=0&&dy<=1&&dz==0&&dx<=0;
      if(fixture.equals("solid"))tunnel=false;
      if(fixture.equals("manyDoors"))tunnel=dy>=0&&dy<=1;
      if(fixture.equals("fiveDoors"))tunnel=dy>=0&&dy<=1&&dx== -rx-1&&Math.abs(dz)<=2;
      if(fixture.equals("sixDoors"))tunnel=dy>=0&&dy<=1&&dx== -rx-1&&dz>= -2&&dz<=3;
      if(tunnel)id=0;
      if(fixture.equals("floorHole")&&dy== -1&&dx== -rx-1&&dz== -rz-1)id=0;
      if(fixture.equals("roofHole")&&dy==4&&dx==0&&dz==0)id=0;
      if(fixture.equals("unsupported")&&dy== -2&&Math.floorMod(dx+dz,3)==0)id=0;
      if(fixture.equals("water")&&dy==2)id=9;
      if(fixture.equals("plants")&&dy==2&&Math.floorMod(dx+dz,4)==0)id=31;
      return aji.e(id);
    }
    public ahu a(int x,int z){return manager.a(x,z);}
    public boolean c(int x,int y,int z){call(1,x,y,z);return a(x,y,z)==aji.e(0);}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(2,x,y,z,aji.b(b),meta,flags);if(y<0||y>=256||x< -30000000||x>=30000000||z< -30000000||z>=30000000)return false;
      edits.put(key(x,y,z),b);if(writes.length()>1)writes.append(',');writes.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');
      String k=key(x,y,z);tiles.remove(k);
      if(b==ajn.ae&&!fixture.equals("missingChest"))tiles.put(k,new Chest());
      if(b==ajn.ac&&!fixture.equals("missingSpawner"))tiles.put(k,new apj());
      return true;
    }
    public boolean f(int x,int y,int z){call(3,x,y,z);return d(x,y,z,ajn.a,0,3);}
    public aor o(int x,int y,int z){call(4,x,y,z);return tiles.get(key(x,y,z));}
  }
  static void run(long seed,String fixture,int x,int y,int z)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.fixture=fixture;w.x=x;w.y=y;w.z=z;Random dims=new Random(seed);w.rx=dims.nextInt(2)+2;w.rz=dims.nextInt(2)+2;
    w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.writes=new StringBuilder("[");w.calls=MessageDigest.getInstance("SHA-1");Random r=new Random(seed);
    boolean ok=new asd().a(w,r,x,y,z);emit(w,r,seed,ok);
  }
  static void emit(W w,Random r,long seed,boolean ok){int x=w.x,y=w.y,z=w.z;StringBuilder tiles=new StringBuilder("[");
    for(Map.Entry<String,aor> en:w.tiles.entrySet()){
      if(tiles.length()>1)tiles.append(',');tiles.append('[').append(q(en.getKey())).append(',');
      if(en.getValue() instanceof Chest){Chest c=(Chest)en.getValue();tiles.append(q("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)tiles.append(',');tiles.append(stack(c.a(i)));}tiles.append("],[").append(String.join(",",c.calls)).append(']');}
      else tiles.append(q("spawner")).append(',').append(q(((apj)en.getValue()).a().e()));tiles.append(']');
    }
    System.out.println("{\"kind\":\"dungeon\","+(w.inputs==null?"":"\"worldSeed\":"+q(""+w.worldSeed)+",\"inputs\":"+w.inputs+",")+"\"seed\":"+q(""+seed)+",\"fixture\":"+q(w.fixture)+",\"pos\":["+x+","+y+","+z+"],\"result\":"+ok+",\"writes\":"+w.writes+"],\"tiles\":"+tiles+"],\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+q(""+r.nextLong())+"}");
  }
  static void natural(long seed,int cx,int cz)throws Exception{
    W base=(W)TerrainProbe.unsafe.allocateInstance(W.class);base.seed=seed;base.manager=new aib(seed,ahm.b);base.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(base.info,ahm.b);}
    Map<String,aji[]> chunks=new HashMap<>();StringBuilder inputs=new StringBuilder("[");TerrainProbe.resetMesa();aqz terrain=new aqz(base,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
    for(int x=cx;x<=cx+1;x++)for(int z=cz;z<=cz+1;z++){
      aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
      axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,base.manager.b(null,x*16,z*16,16,16));caves.a(null,base,x,z,blocks);ravines.a(null,base,x,z,blocks);chunks.put(x+","+z,blocks);
      if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(']');
    }
    inputs.append(']');Random picks=new Random(seed+789);int accepted=0,rejected=0;
    for(int i=0;i<4000&&(accepted<2||rejected<2);i++){
      W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.fixture="natural";w.chunks=chunks;w.inputs=inputs.toString();w.worldSeed=seed;w.x=cx*16+6+picks.nextInt(20);w.y=8+picks.nextInt(64);w.z=cz*16+6+picks.nextInt(20);
      w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.writes=new StringBuilder("[");w.calls=MessageDigest.getInstance("SHA-1");long randomSeed=1000+i;Random r=new Random(randomSeed);boolean ok=new asd().a(w,r,w.x,w.y,w.z);
      if(ok&&accepted<2){accepted++;emit(w,r,randomSeed,ok);}else if(!ok&&rejected<2){rejected++;emit(w,r,randomSeed,ok);}
    }
    if(accepted!=2||rejected!=2)throw new AssertionError("Natural coverage "+seed+" "+accepted+"/"+rejected);
  }
  static void config()throws Exception{
    StringBuilder ench=new StringBuilder("[");Set<String> classes=new TreeSet<>();
    for(aft e:aft.b)if(e!=null){classes.add(e.getClass().getName());if(ench.length()>1)ench.append(',');ench.append('[').append(e.B).append(',').append(e.c()).append(",[");for(int l=e.d();l<=e.b();l++){if(l>e.d())ench.append(',');ench.append('[').append(l).append(',').append(e.a(l)).append(',').append(e.b(l)).append(']');}ench.append("],[");boolean comma=false;for(aft b:aft.b)if(b!=null&&e.a(b)){if(comma)ench.append(',');comma=true;ench.append(b.B);}ench.append("]]");}
    StringBuilder loot=new StringBuilder("[");for(qx row:(qx[])TerrainProbe.field(asd.class,"a").get(null)){if(loot.length()>1)loot.append(',');loot.append('[').append(stack((add)TerrainProbe.get(row,"b"))).append(',').append(TerrainProbe.get(row,"c")).append(',').append(TerrainProbe.get(row,"d")).append(',').append(TerrainProbe.get(row,"a")).append(']');}
    StringBuilder materials=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);classes.add(b.o().getClass().getName());if(id>0)materials.append(',');materials.append('[').append(id).append(',').append(b.o().a()).append(']');}
    classes.add(ade.aG.getClass().getName());StringBuilder names=new StringBuilder("[");for(String c:classes){if(names.length()>1)names.append(',');names.append(q(c));}
    System.out.println("{\"kind\":\"config\",\"materials\":"+materials+"],\"enchantability\":"+ade.aG.c()+",\"enchantments\":"+ench+"],\"loot\":"+loot+"],\"serviceClasses\":"+names+"]}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();config();
    for(int level=1;level<=60;level++){Map<Integer,agc> map=afv.b(level,new add(ade.aG));StringBuilder a=new StringBuilder("[");if(map!=null)for(agc e:map.values()){if(a.length()>1)a.append(',');a.append('[').append(e.b.B).append(',').append(e.c).append(']');}System.out.println("{\"kind\":\"candidates\",\"level\":"+level+",\"values\":"+a+"]}");}
    for(long seed=0;seed<256;seed++){Random r=new Random(seed);qx book=ade.bR.b(r);System.out.println("{\"kind\":\"book\",\"seed\":"+q(""+seed)+",\"stack\":"+stack((add)TerrainProbe.get(book,"b"))+",\"nextLong\":"+q(""+r.nextLong())+"}");}
    for(long seed:new long[]{0,1,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE})for(String f:new String[]{"tunnel","solid","manyDoors","fiveDoors","sixDoors","floorHole","roofHole","unsupported","water","plants","missingChest","missingSpawner"})for(int[] p:new int[][]{{0,32,0},{-17,4,29},{15,251,-16}})run(seed,f,p[0],p[1],p[2]);
    for(long seed=0;seed<64;seed++)run(seed,"tunnel",15,32,-16);
    for(long seed:new long[]{0,1,-1,8675309})for(int[] p:new int[][]{{0,0,0},{0,1,0},{15,1,-16},{0,252,0},{29999999,32,0},{-30000000,32,0}})run(seed,"tunnel",p[0],p[1],p[2]);
    for(long seed:new long[]{0,8675309,-123456789})natural(seed,0,0);
  }
}
