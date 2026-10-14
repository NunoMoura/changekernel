// Closed, bounded JSON at the host boundary. No getters, prototypes, lossy UTF-8 or duplicate keys.
export const VERSION = "0.5.0-prototype.1" as const;
export const FRAME_LIMIT = 262_144;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export function scalarText(value: string): boolean {
  return !/[\uD800-\uDFFF]/u.test(value);
}
export function canonical(value: Json): string {
  if (typeof value === "string") {
    if (!scalarText(value)) throw new Error("surrogate");
    let out = '"';
    for (const c of value) {
      const n = c.codePointAt(0)!;
      out += n < 32 ? `\\u${n.toString(16).padStart(4, "0")}` : c === '"' || c === "\\" ? `\\${c}` : c;
    }
    return out + '"';
  }
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new Error("integer");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).map(([k, v]) => `${canonical(k)}:${canonical(v)}`).join(",")}}`;
}
export function parseJson(bytes: Uint8Array, limit = FRAME_LIMIT): Json {
  if (!bytes.length || bytes.length > limit) throw new Error("size");
  const s = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  let at = 0;
  const ws = () => { while (/[ \t\r\n]/.test(s[at] ?? "x")) at++; };
  const string = (): string => {
    const start = at++;
    while (at < s.length) {
      const c = s[at++];
      if (c === "\\") { at++; continue; }
      if (c === '"') {
        let v: unknown;
        try { v = JSON.parse(s.slice(start, at)); }
        catch { throw new Error("invalid JSON string"); }
        if (typeof v !== "string" || !scalarText(v)) throw new Error("string");
        return v;
      }
    }
    throw new Error("unterminated string");
  };
  const value = (depth: number): Json => {
    if (depth > 16) throw new Error("depth");
    ws();
    const c = s[at];
    if (c === '"') return string();
    if (c === "{" || c === "[") {
      at++; ws();
      const array = c === "[";
      const end = array ? "]" : "}";
      const list: Json[] = [];
      const obj: { [key: string]: Json } = Object.create(null);
      if (s[at] === end) { at++; return array ? list : obj; }
      while (at < s.length) {
        if (array) list.push(value(depth + 1));
        else {
          ws(); if (s[at] !== '"') throw new Error("key");
          const key = string(); ws();
          if (Object.hasOwn(obj, key) || s[at++] !== ":") throw new Error("duplicate/key separator");
          obj[key] = value(depth + 1);
        }
        ws();
        if (s[at] === end) { at++; return array ? list : obj; }
        if (s[at++] !== ",") throw new Error("separator");
      }
      throw new Error("incomplete");
    }
    for (const [token, v] of [["null", null], ["true", true], ["false", false]] as const) {
      if (s.startsWith(token, at)) { at += token.length; return v; }
    }
    const m = /^(0|[1-9][0-9]*)/.exec(s.slice(at));
    if (!m) throw new Error("value");
    at += m[0].length;
    const n = Number(m[0]);
    if (!Number.isSafeInteger(n)) throw new Error("integer");
    return n;
  };
  const out = value(0); ws();
  if (at !== s.length) throw new Error("trailing data");
  return out;
}
export function cloneInput(value: unknown, depth = 0, budget = { left: FRAME_LIMIT }): Json {
  if (--budget.left < 0) throw new Error("aggregate size");
  if (depth > 16) throw new Error("depth");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > FRAME_LIMIT || !scalarText(value)) throw new Error("string");
    budget.left -= Buffer.byteLength(value);
    if (budget.left < 0) throw new Error("aggregate size");
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)) return value;
  if (typeof value !== "object" || !value) throw new Error("value");
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !(Array.isArray(value) && proto === Array.prototype)) throw new Error("prototype");
  const keys = Reflect.ownKeys(value);
  if (keys.length > 256) throw new Error("members");
  const out: { [key: string]: Json } = Object.create(null);
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue;
    if (typeof key !== "string") throw new Error("symbol");
    budget.left -= Buffer.byteLength(key);
    if (budget.left < 0) throw new Error("aggregate size");
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!d.enumerable || !("value" in d)) throw new Error("descriptor");
    out[key] = cloneInput(d.value, depth + 1, budget);
  }
  if (Array.isArray(value)) {
    if (Object.keys(out).length !== value.length) throw new Error("sparse array");
    return Object.freeze(Array.from({ length: value.length }, (_, i) => {
      if (!Object.hasOwn(out, String(i))) throw new Error("array key");
      return out[String(i)]!;
    })) as Json[];
  }
  return Object.freeze(out);
}
