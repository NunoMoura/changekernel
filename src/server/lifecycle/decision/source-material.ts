import {productError, type ProductError} from "../../../api/transport/envelope.ts";
import {decodeProjectSnapshot} from "../../../kernel/changes/snapshot.ts";
import {canonicalJson} from "../../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../../kernel/data-contracts/outcome.ts";
import {decodeContract, exactRecord, requiredField, textField} from "../../../kernel/data-contracts/validation.ts";
import {decodeGitOidValue} from "../../../kernel/identity/git.ts";
import {profileScopeGuard, type AuthorizedProjectActor} from "../../authorization/policy.ts";
import {loadProfileDecisionGrounds, type ProfileDecisionGrounds} from "../../queries/profile-change.ts";
import {resolveProjectSourceDetailed, type ProjectReadConfiguration} from "../../queries/source.ts";
import type {ProjectStorePort} from "../../../ports/project-store.ts";

function decodeRequest(input: unknown) {
	return decodeContract("Decision source material", input, value => {
		const record = exactRecord("Decision source material", value, "$", ["changeId", "expectedProjectHead", "expectedChangeTip"]);
		return Object.freeze({
			changeId: textField("Decision source material", record, "changeId", "$", {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u}),
			expectedProjectHead: decodeGitOidValue(requiredField("Decision source material", record, "expectedProjectHead")),
			expectedChangeTip: decodeGitOidValue(requiredField("Decision source material", record, "expectedChangeTip")),
		});
	});
}
export type DecisionSourceRequest = Extract<ReturnType<typeof decodeRequest>, {ok: true}>["value"];

/**
 * Private source assembly for the existing Wiki-only proposed Change format.
 * Configuration and Store are trusted backend bindings. authorize must consult
 * current access policy for this project and exact request on every call.
 * No caller-supplied bodies, effects, Check results or completeness assertions.
 * Full bodies and exclusions remain in the returned grounds; this does not prove
 * semantic coverage, adopted domain policy, accepted Evidence or readiness.
 * Mutable heads are observed again before delivery, not locked: execution and
 * acceptance must independently recheck their own current authority and sources.
 */
export async function readDecisionSourceMaterial(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	authorize: (request: DecisionSourceRequest) => Outcome<AuthorizedProjectActor, ProductError>,
	input: unknown,
): Promise<Outcome<ProfileDecisionGrounds, ProductError>> {
	const request = decodeRequest(input);
	if (!request.ok) return failure(productError("invalid_request", "Decision source request requires only the proposed Change and exact Project and Change heads.", "Refresh the proposed Change revision; do not supply source bodies or verdicts.", false));
	const exactRequest = request.value;
	// Snapshot trusted configuration before callbacks and asynchronous Store reads.
	const configured = Object.freeze({...configuration, limits: Object.freeze({...configuration.limits})});
	let authorityIdentity: string | undefined;
	function currentAuthority(): Outcome<AuthorizedProjectActor, ProductError> {
		try {
			const authorization = authorize(exactRequest);
			if (!authorization.ok) return authorization;
			const actor = authorization.value;
			const scope = profileScopeGuard(actor, "decision.evaluate", {});
			if (scope) return failure(scope);
			if (actor.changeIds !== null && !actor.changeIds.includes(exactRequest.changeId)) return failure(denied());
			const identity = canonicalJson(actor);
			if (!identity.ok || (authorityIdentity !== undefined && identity.value !== authorityIdentity)) return failure(denied());
			authorityIdentity = identity.value;
			return success(Object.freeze({...actor, capabilities: Object.freeze([...actor.capabilities]),
				wikiItemIds: actor.wikiItemIds === null ? null : Object.freeze([...actor.wikiItemIds]),
				changeIds: actor.changeIds === null ? null : Object.freeze([...actor.changeIds])}));
		} catch {return failure(denied());}
	}
	const authorized = currentAuthority();
	if (!authorized.ok) return authorized;
	try {
		const grounds = await loadProfileDecisionGrounds(store, configured, authorized.value, request.value);
		if (!grounds.ok) return grounds;
		const stillAuthorized = currentAuthority();
		if (!stillAuthorized.ok) return stillAuthorized;
		for (const [source, expected] of [
			[{kind: "canonical" as const}, grounds.value.project],
			[{kind: "change" as const, changeId: request.value.changeId}, grounds.value.containing],
		] as const) {
			const observed = await resolveProjectSourceDetailed(store, configured, source);
			if (!observed.ok) return failure(stale());
			const snapshot = decodeProjectSnapshot(observed.value);
			if (!snapshot.ok || snapshot.value.snapshotDigest !== expected.snapshotDigest) return failure(stale());
		}
		const delivery = currentAuthority();
		if (!delivery.ok) return delivery;
		return grounds;
	} catch {
		return failure(productError("unavailable", "Decision source assembly could not complete; no partial material is delivered.", "Investigate source access before retrying.", false));
	}
}
function denied(): ProductError {
	return productError("authorization_denied", "Current authority does not permit delivery of this proposed Change's source material.", "Refresh the applicable project and Change authorization.", true);
}
function stale(): ProductError {
	return productError("source_stale", "Project baseline or proposed Change revision changed during source assembly.", "Refresh both heads and rebuild the material.", false);
}
