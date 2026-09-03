export const PROJECT_STORE_PORT_PROTOCOL = Object.freeze({
	id: "codewiki.port.project-store",
	version: "1.0.0",
} as const);

/** Capability marker. SK3C adds immutable object reads, construction, and guarded ref CAS. */
export interface ProjectStorePort {
	readonly protocol: typeof PROJECT_STORE_PORT_PROTOCOL;
}
