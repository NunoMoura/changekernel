import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSystemDiagrams } from "../../src/domains/software-development/system-diagrams.ts";

const components = [
	"cw:component:project-server",
	"cw:component:checks",
	"cw:component:change-trace",
];
const flows = ["cw:flow:change-lifecycle"];

function validDiagram() {
	return {
		codewiki_id: "cw:diagram:architecture",
		codewiki_facets: {
			topology: {kind: "yaml", pointer: "/components"},
		},
		id: "architecture",
		purpose: "Show the authoritative Checks and persistence path.",
		components: [
			{
				id: "project-server",
				concept: "cw:component:project-server",
				label: "Project Server",
				zone: "core",
			},
			{
				id: "checks",
				concept: "cw:component:checks",
				label: "Checks",
				zone: "core",
			},
			{
				id: "trace",
				concept: "cw:component:change-trace",
				label: "Change Trace",
				zone: "repository",
			},
		],
		connections: [
			{
				id: "project-server-invokes-checks",
				from: "project-server",
				to: "checks",
				type: "invokes",
				label: "runs Gate",
			},
			{
				id: "checks-return-project-server",
				from: "checks",
				to: "project-server",
				type: "returns",
				label: "returns Gate Report",
			},
			{
				id: "project-server-writes-trace",
				from: "project-server",
				to: "trace",
				type: "writes",
				label: "accepts operations",
				boundary: {
					type: "persistence",
					failure: "Reject write and retain prior accepted head.",
				},
			},
		],
		flows: [
			{
				concept: "cw:flow:change-lifecycle",
				paths: [
					{
						connections: [
							"project-server-invokes-checks",
							"checks-return-project-server",
							"project-server-writes-trace",
						],
					},
				],
			},
		],
	};
}

describe("System diagram contract", () => {
	it("requires every Component and Flow to map into canonical topology", () => {
		assert.deepEqual(
			validateSystemDiagrams({
				diagrams: [validDiagram()],
				componentConcepts: components,
				flowConcepts: flows,
			}),
			[],
		);
	});

	it("rejects overlapping or unresolved YAML facet locators", () => {
		const diagram = validDiagram();
		diagram.codewiki_facets = {
			topology: {kind: "yaml", pointer: "/components"},
			firstComponent: {kind: "yaml", pointer: "/components/0"},
		};
		assert.equal(
			validateSystemDiagrams({
				diagrams: [diagram],
				componentConcepts: components,
				flowConcepts: flows,
			}).some((entry) => entry.code === "invalid_diagram_facets"),
			true,
		);
	});

	it("rejects orphan components and flows", () => {
		const issues = validateSystemDiagrams({
			diagrams: [],
			componentConcepts: components,
			flowConcepts: flows,
		});
		assert.deepEqual(
			issues.map((entry) => entry.code),
			[
				"component_not_diagrammed",
				"component_not_diagrammed",
				"component_not_diagrammed",
				"flow_not_diagrammed",
			],
		);
	});

	it("requires a contiguous path of at least two declared connections", () => {
		const diagram = validDiagram();
		diagram.flows[0].paths = [
			{ connections: ["project-server-invokes-checks"] },
			{ connections: ["project-server-writes-trace", "checks-return-project-server"] },
		];
		const issues = validateSystemDiagrams({
			diagrams: [diagram],
			componentConcepts: components,
			flowConcepts: flows,
		});
		assert.deepEqual(
			issues.map((entry) => entry.code),
			["flow_path_too_short", "noncontiguous_flow_path"],
		);
	});

	it("requires cross-zone connections to declare failure behavior", () => {
		const diagram = validDiagram();
		delete diagram.connections[2].boundary;
		const issues = validateSystemDiagrams({
			diagrams: [diagram],
			componentConcepts: components,
			flowConcepts: flows,
		});
		assert.equal(issues[0].code, "missing_connection_boundary");
	});

	it("requires boundary connections to belong to a Flow", () => {
		const diagram = validDiagram();
		diagram.flows[0].paths[0].connections.pop();
		const issues = validateSystemDiagrams({
			diagrams: [diagram],
			componentConcepts: components,
			flowConcepts: flows,
		});
		assert.equal(issues.at(-1).code, "unmapped_boundary_connection");
	});
});
