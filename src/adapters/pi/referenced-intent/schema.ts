import { Type, type Static, type TSchema } from "typebox";
import { canonical, cloneInput, FRAME_LIMIT, VERSION, type Json } from "./codec.ts";

const obj = <P extends Record<string, TSchema>>(p: P) => Type.Object(p, { additionalProperties: false });
const lit = Type.Literal;
const nullable = <S extends TSchema>(s: S) => Type.Union([s, Type.Null()]);
const integer = (min: number, max: number) => Type.Integer({ minimum: min, maximum: max });
const text = Type.String({ maxLength: 65_536 });
const key = Type.String({ pattern: "^[A-Za-z0-9_-]{1,64}$" });
export const Material = obj({ custody: lit("custody-1"), sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }), bytes: integer(0, 65_536), text: lit("utf8-exact") });
export const Fact = obj({ ledger: lit("ledger-1"), change: lit("change-1"), seq: integer(1, 128) });
export const Intent = obj({ what: Material, why: nullable(Material) });
const base = { version: lit(VERSION), ledger: lit("ledger-1"), change: lit("change-1") };
const request = <O extends string, P extends Record<string, TSchema>>(op: O, p: P) => obj({ version: base.version, op: lit(op), ledger: base.ledger, change: base.change, ...p });
export const requests = {
  open_intent: request("open_intent", { key, instruction: Material, replacement: Intent }),
  revise_intent: request("revise_intent", { key, expected: Fact, instruction: Material, replacement: Intent }),
  retain_text: request("retain_text", { text }),
  read_context: request("read_context", { at: nullable(Fact) }),
  read_history: request("read_history", { through: nullable(Fact), after: integer(0, 128), limit: integer(1, 8) }),
  resolve_text: request("resolve_text", { material: Material }),
  inspect_operation: request("inspect_operation", { key }),
};
export type Op = keyof typeof requests;
export const Mutation = Type.Union([requests.open_intent, requests.revise_intent]);
export const Request = Type.Union([requests.open_intent, requests.revise_intent, requests.retain_text, requests.read_context, requests.read_history, requests.resolve_text, requests.inspect_operation]);
export type RequestValue = Static<typeof Request>;
export type MutationValue = Static<typeof Mutation>;
const Result = obj({ format: lit("ck-intent-result"), version: base.version, kind: Type.Union([lit("opened"), lit("intent_revised")]), key, actor: lit("person-1"), fact: Fact, previous: nullable(Fact) });
const RecordSchema = obj({ version: base.version, custody: lit("custody-1"), seq: integer(1, 128), prev: nullable(Fact), input: Mutation, approval: Material });
const blockers = ["blocked_pending", "blocked_control_temp", "blocked_material_temp", "blocked_unaccepted_tail"] as const;
const readiness = Type.Array(Type.Union([lit(blockers[0]), lit(blockers[1]), lit(blockers[2]), lit(blockers[3])]), { maxItems: 4, uniqueItems: true });
const response = <O extends string, P extends Record<string, TSchema>>(kind: O, p: P) => obj({ version: base.version, kind: lit(kind), ...p });
export const Failure = response("error", { code: Type.Union([lit("invalid_input"), lit("unsupported"), lit("conflict"), lit("denied"), lit("unavailable")]), acceptance: lit("not_established") });
export const Unknown = response("transport_unknown", { reason: Type.Union([lit("timeout"), lit("cancelled"), lit("closed"), lit("protocol"), lit("cleanup_unconfirmed")]), acceptance: lit("not_established") });
const Accepted = response("accepted", { result: Result });
const Operation = response("operation", { key, status: Type.Union([lit("accepted"), lit("pending"), lit("not_found_now")]), result: nullable(Result), tip: nullable(Fact), readiness });
const Retained = response("retained", { material: Material });
const Resolved = response("resolved", { material: Material, text });
const coverage = { first: integer(0, 128), last: integer(0, 128) };
const Context = response("context", { tip: nullable(Fact), at: nullable(Fact), intent: nullable(Intent), approval: nullable(Material), policy: Material, coverage: obj({ ...coverage, through: nullable(Fact) }), readiness });
const History = response("history", { tip: nullable(Fact), through: nullable(Fact), records: Type.Array(RecordSchema, { maxItems: 8 }), coverage: obj(coverage), next_after: nullable(integer(1, 128)), readiness });
export const Discarded = response("discarded", {});
export const Response = Type.Union([Accepted, Operation, Retained, Resolved, Context, History, Failure, Unknown]);
export type ResponseValue = Static<typeof Response>;
export const outputs = {
  open_intent: Type.Union([Accepted, Failure, Unknown]),
  revise_intent: Type.Union([Accepted, Failure, Unknown]),
  retain_text: Type.Union([Retained, Failure, Unknown]),
  read_context: Type.Union([Context, Failure, Unknown]),
  read_history: Type.Union([History, Failure, Unknown]),
  resolve_text: Type.Union([Resolved, Failure, Unknown]),
  inspect_operation: Type.Union([Operation, Failure, Unknown]),
};
const permission = Type.Union([lit("allow"), lit("deny"), lit("unavailable")]);
export const Lease = obj({ principal: lit("person-1"), disclose: permission, mutate: permission });
export type LeaseValue = Static<typeof Lease>;
const path = Type.String({ minLength: 1, maxLength: 4096, pattern: "^/(?:[^/\\u0000-\\u001f\\u007f]+/)*[^/\\u0000-\\u001f\\u007f]+$" });
export const Grant = obj({ version: base.version, custody: lit("custody-1"), ledger: base.ledger, change: base.change, owner: lit("person-1"), coverage: lit("closed-personal-plan"), policy: Material, directory: path, anchor: path });
export const Configuration = obj({ executable: path, mode: Type.Union([lit("fresh_provision"), lit("resume_provision"), lit("reopen")]), grant: Grant, authorization: Lease });
export type ConfigurationValue = Static<typeof Configuration>;
const envelope = <O extends string, P extends Record<string, TSchema>>(kind: O, p: P) => obj({ bridge: lit("ck-intent-bridge"), id: integer(1, 1_000_000), kind: lit(kind), ...p });
export const Incoming = Type.Union([
  envelope("connected", { version: base.version }), envelope("closed", {}),
  envelope("prepared", { input: Mutation, presentation: text }),
  envelope("reply", { value: Type.Union([Accepted, Operation, Retained, Resolved, Context, History, Failure, Discarded]) }),
]);
export type IncomingValue = Static<typeof Incoming>;

// Same closed schemas drive registrations and validation. Only the schema vocabulary above is supported.
interface SchemaFields {
  anyOf?: TSchema[]; const?: Json; type?: string; maxLength?: number; minLength?: number;
  pattern?: string; minimum: number; maximum: number; maxItems: number; items: TSchema;
  uniqueItems?: boolean; properties: Record<string, TSchema>;
}
export function valid(source: TSchema, value: unknown): boolean {
  // SAFETY: only the constant TypeBox schemas above are passed here; their keyword vocabulary is closed.
  const schema = source as unknown as SchemaFields;
  if (schema.anyOf) return (schema.anyOf as TSchema[]).some(s => valid(s, value));
  if (Object.hasOwn(schema, "const")) return value === schema.const;
  switch (schema.type) {
    case "null": return value === null;
    case "string": return typeof value === "string" && value.length <= (schema.maxLength ?? FRAME_LIMIT) && value.length >= (schema.minLength ?? 0) && (!schema.pattern || new RegExp(schema.pattern).test(value));
    case "integer": return typeof value === "number" && Number.isSafeInteger(value) && value >= schema.minimum && value <= schema.maximum;
    case "array": return Array.isArray(value) && value.length <= schema.maxItems && value.every(v => valid(schema.items, v)) && (!schema.uniqueItems || new Set(value).size === value.length);
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const keys = Object.keys(schema.properties);
      return Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k) && valid(schema.properties[k], (value as Record<string, unknown>)[k]));
    }
    default: return false;
  }
}
export function checked<S extends TSchema>(schema: S, value: unknown): Static<S> {
  const copy = cloneInput(value);
  if (!valid(schema, copy) || Buffer.byteLength(canonical(copy)) > FRAME_LIMIT) throw new Error("invalid closed value");
  return copy as Static<S>;
}
export function ordered<S extends TSchema>(source: S, value: Static<S>): Json {
  // SAFETY: source is one of our constant schemas, never caller-supplied; values were checked against it.
  const schema = source as unknown as SchemaFields;
  if (schema.anyOf) return ordered((schema.anyOf as TSchema[]).find(s => valid(s, value))!, value);
  if (schema.type === "object") return Object.fromEntries(Object.entries(schema.properties as Record<string, TSchema>).map(([k, s]) => [k, ordered(s, (value as Record<string, Json>)[k])]));
  if (schema.type === "array") return (value as Json[]).map(v => ordered(schema.items, v));
  return value as Json;
}
export function failure(code: Static<typeof Failure>["code"]): ResponseValue { return { version: VERSION, kind: "error", code, acceptance: "not_established" }; }
export function unknown(reason: Static<typeof Unknown>["reason"]): ResponseValue { return { version: VERSION, kind: "transport_unknown", reason, acceptance: "not_established" }; }
export function validReadiness(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((v, i) => blockers.indexOf(v) >= 0 && (i === 0 || blockers.indexOf(value[i - 1]) < blockers.indexOf(v)));
}
