/**
 * Structural diff between two JSON Schemas. Key order is ignored.
 * Returns a list of { path, kind, key, a, b } entries where kind is
 * "only_a", "only_b" or "changed".
 */
export function diffSchemas(a, b, path = '') {
  const out = [];
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const p = `${path}/${key}`;
      if (!(key in b)) out.push({ path: p, kind: 'only_a', key, a: a[key] });
      else if (!(key in a)) out.push({ path: p, kind: 'only_b', key, b: b[key] });
      else out.push(...diffSchemas(a[key], b[key], p).map((d) => ({ key: d.key ?? key, ...d })));
    }
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path, kind: 'changed', a, b });
  }
  return out;
}

const cost = (key, value) => JSON.stringify({ [key]: value }).length - 2 + 1; // "key":value plus comma

/** Groups a diff by keyword with occurrence counts and approximate character cost. */
export function summarizeDiff(diff) {
  const groups = {};
  for (const d of diff) {
    const key = d.path.split('/').pop();
    const id = `${d.kind}:${key}`;
    groups[id] ??= { kind: d.kind, key, count: 0, charsA: 0, charsB: 0, examples: [] };
    const g = groups[id];
    g.count += 1;
    if ('a' in d) g.charsA += cost(key, d.a);
    if ('b' in d) g.charsB += cost(key, d.b);
    if (g.examples.length < 2) g.examples.push(d);
  }
  return Object.values(groups).sort((x, y) => y.charsA + y.charsB - (x.charsA + x.charsB));
}
