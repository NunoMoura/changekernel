import type {CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {PRODUCT_OPERATIONS} from "../../api/transport/envelope.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import type {ProjectReadConfiguration} from "./source.ts";

export function discoverProject(configuration: ProjectReadConfiguration): CanonicalValue {
	return Object.freeze({
		project: configuration.projectName,
		status: "available",
		kernelVersion: configuration.kernelVersion,
		nextAction: "Inspect capabilities or an exact managed-document proposal. Decision and Work execution are not implemented yet.",
	});
}

/** Permission and implementation availability are distinct; a grant does not implement an operation. */
export function readProjectCapabilities(actor: AuthorizedProjectActor): CanonicalValue {
	const supported = ["project.discover", "project.capabilities", "changes.propose-profile", "changes.read"];
	const allowed = supported.filter(operation => actor.capabilities.some(capability => capability === operation) &&
		(!operation.startsWith("changes.") || (actor.wikiItemIds === null && (operation !== "changes.propose-profile" || actor.changeIds === null))));
	return Object.freeze({
		available: Object.freeze(allowed),
		restrictions: Object.freeze({"changes.read": "get only"}),
		unavailable: Object.freeze(PRODUCT_OPERATIONS.filter(operation => !allowed.includes(operation)).map(capability => Object.freeze({
			capability,
			reason: supported.includes(capability) ? "The required grant or scope is absent." : "Not implemented by the current Kernel.",
		}))),
	});
}
