export const PREVIEW_PORT_PROTOCOL = Object.freeze({
	id: "codewiki.port.preview",
	version: "1.0.0",
} as const);

/** Capability marker. Later milestones add scoped preview.work and preview.verify effects. */
export interface PreviewPort {
	readonly protocol: typeof PREVIEW_PORT_PROTOCOL;
}
