import {fileURLToPath} from "node:url";
import {
	prepareCheckPackTransport,
	type CheckPackTransportPlan,
} from "../../checks/packs/transport.ts";
import {SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY} from "./plugin.ts";

export const SOFTWARE_DEVELOPMENT_DEFAULT_CHECK_PACK_ID =
	"software-development-default" as const;

/** Resolve and validate release-owned default Packs without loading project code. */
export function prepareSoftwareDevelopmentDefaultCheckPacks(): Promise<CheckPackTransportPlan> {
	return prepareCheckPackTransport({
		kind: "domain",
		locator: SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY.pluginId,
		resolvedRevision: SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY.identityDigest,
		packageRoot: fileURLToPath(new URL("../../../", import.meta.url)),
	});
}
