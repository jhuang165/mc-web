import java.util.*;

// java.util.HashMap as OpenJDK 7 wrote it (7u40, no alternative hashing: hashSeed 0), as a subclass the 1.7.10 classes accept for their
// HashMap fields (EntityLivingBase.activePotionsMap). What differs from Java 8 and later, and what this keeps:
//   hash(h): h ^= (h >>> 20) ^ (h >>> 12); h ^ (h >>> 7) ^ (h >>> 4)   (Java 8 only folds h >>> 16)
//   a new key goes to the FRONT of its bucket's chain (Java 8 appends at the tail)
//   addEntry resizes first when size >= threshold and the target bucket is occupied (7u6 and later)
//   transfer() walks the old buckets in ascending order and pushes each entry to the front of its new chain (chains reverse)
//   iteration: buckets in ascending order, each chain from its head
// Source recalled from OpenJDK 7u40 java.util.HashMap; the keys here are Integers, whose hashCode is the value.
public class Java7Map extends HashMap<Object, Object> {
  static final class E implements Map.Entry<Object, Object> {
    final Object key; Object value; E next; final int hash;
    E(int h, Object k, Object v, E n) { hash = h; key = k; value = v; next = n; }
    public Object getKey() { return key; }
    public Object getValue() { return value; }
    public Object setValue(Object v) { Object o = value; value = v; return o; }
  }
  E[] table = new E[16];
  int count, threshold = 12;
  int mod;

  static int hash(Object k) { int h = k.hashCode(); h ^= (h >>> 20) ^ (h >>> 12); return h ^ (h >>> 7) ^ (h >>> 4); }
  static int index(int h, int n) { return h & (n - 1); }

  public int size() { return count; }
  public boolean isEmpty() { return count == 0; }
  E find(Object k) { int h = hash(k); for (E e = table[index(h, table.length)]; e != null; e = e.next) if (e.hash == h && Objects.equals(e.key, k)) return e; return null; }
  public Object get(Object k) { E e = find(k); return e == null ? null : e.value; }
  public boolean containsKey(Object k) { return find(k) != null; }
  public Object put(Object k, Object v) {
    E e = find(k);
    if (e != null) { Object o = e.value; e.value = v; return o; }
    mod++;
    int h = hash(k), i = index(h, table.length);
    if (count >= threshold && table[i] != null) { resize(2 * table.length); i = index(h, table.length); }
    table[i] = new E(h, k, v, table[i]);
    count++;
    return null;
  }
  void resize(int n) {
    E[] nt = new E[n];
    for (E head : table) for (E e = head; e != null; ) { E next = e.next; int i = index(e.hash, n); e.next = nt[i]; nt[i] = e; e = next; }
    table = nt;
    threshold = (int) (n * 0.75f);
  }
  public Object remove(Object k) {
    int h = hash(k), i = index(h, table.length);
    E prev = null;
    for (E e = table[i]; e != null; prev = e, e = e.next) {
      if (e.hash == h && Objects.equals(e.key, k)) { mod++; if (prev == null) table[i] = e.next; else prev.next = e.next; count--; return e.value; }
    }
    return null;
  }
  public void clear() { mod++; Arrays.fill(table, null); count = 0; }

  abstract class It<T> implements Iterator<T> {
    int idx = 0, expected = mod; E next, last;
    It() { advance(); }
    void advance() { while (next == null && idx < table.length) next = table[idx++]; }
    public boolean hasNext() { return next != null; }
    E nextEntry() {
      if (mod != expected) throw new ConcurrentModificationException();
      E e = next; if (e == null) throw new NoSuchElementException();
      last = e; next = e.next; advance(); return e;
    }
    public void remove() { if (last == null) throw new IllegalStateException(); Java7Map.this.remove(last.key); last = null; expected = mod; }
  }
  public Set<Object> keySet() { return new AbstractSet<Object>() {
    public Iterator<Object> iterator() { return new It<Object>() { public Object next() { return nextEntry().key; } }; }
    public int size() { return count; }
    public boolean contains(Object o) { return containsKey(o); }
    public boolean remove(Object o) { return Java7Map.this.remove(o) != null; }
  }; }
  public Collection<Object> values() { return new AbstractCollection<Object>() {
    public Iterator<Object> iterator() { return new It<Object>() { public Object next() { return nextEntry().value; } }; }
    public int size() { return count; }
  }; }
  public Set<Map.Entry<Object, Object>> entrySet() { return new AbstractSet<Map.Entry<Object, Object>>() {
    public Iterator<Map.Entry<Object, Object>> iterator() { return new It<Map.Entry<Object, Object>>() { public Map.Entry<Object, Object> next() { return nextEntry(); } }; }
    public int size() { return count; }
  }; }
}
