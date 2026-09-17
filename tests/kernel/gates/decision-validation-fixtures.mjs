import {createCheckResult} from '../../../src/kernel/gates/checks.ts';
import {createDecisionValidationResult, prepareDecisionValidation} from '../../../src/kernel/gates/decision-validation.ts';
import {DECISION_INPUTS, DECISION_LIMITS} from '../../../src/kernel/gates/decision-validators.ts';
import {CHANGEKERNEL_VERSION} from '../../../src/kernel/identity/version.ts';
import {fixture, ok, digest} from './check-fixtures.mjs';

// Synthetic grounds and judgments for contract/transport tests, not semantic qualification.
export function decisionFixture(options = {}) {
  const domain = options.domain ?? fixture();
  const domainResult = options.domainResult ?? ok(createCheckResult({checkId: domain.definition.checkId, inputDigest: domain.input.digest,
    executionDigest: domain.input.executionDigest, producerId: 'fixture:producer:domain', status: 'completed',
    passed: true, failureKind: null, feedback: {summary: 'Synthetic domain pass.', where: 'Fixture', reason: 'Fixture only.', resolution: null, preserve: []},
    evidenceDigests: [digest('1')], limitations: ['Not a qualified domain assessment.']}));
  const {adoptionDigest: _adoption, ...current} = domain.selection.current;
  const values = [[{retained: 'Preserve the accepted public behavior outside the correction.', proposedRevision: null}],
    [{path: 'source.mjs', before: 'old fixture behavior', after: 'corrected fixture behavior'}],
    [{role: 'observation', body: 'Synthetic reproduction. No live facts or private conversation.'}],
    {intent: 'Correct one observed behavior.', scope: 'One local source correction.', alternatives: ['Do nothing; retain the observed defect.'],
      assumptions: [], outcomeConditions: ['The reproduction passes without changing other public behavior.']}];
  return {domain, selection: {current, configuration: {dependenciesDigest: domain.definition.implementation.dependenciesDigest,
    permissionDigest: domain.input.permissionDigest, limits: {...DECISION_LIMITS, milliseconds: 10000, memoryBytes: 128 * 1024 * 1024},
    model: options.model ?? {routeDigest: digest('1'), settingsDigest: digest('2')}},
    slots: DECISION_INPUTS.map((input, index) => ({name: input.name, status: 'available', value: values[index], sources: [domain.adoption.adoptedBy], evidenceDigests: [digest('1')], omissions: []})),
    domain: {selection: domain.selection, results: [domainResult]}}};
}
export function decisionResult(selection, index = 0, patch = {}) {
  const prepared = ok(prepareDecisionValidation(selection)), entry = prepared.entries[index];
  return ok(createDecisionValidationResult({owner: 'backend', stage: 'decision', kernelVersion: CHANGEKERNEL_VERSION,
    kernelBuildDigest: prepared.current.kernelBuildDigest, definitionDigest: entry.definitionDigest, checkId: entry.checkId,
    inputDigest: entry.inputDigest, executionDigest: entry.executionDigest, producerId: 'changekernel:producer:linux-check-host',
    status: 'completed', passed: true, failureKind: null, feedback: {summary: 'Synthetic common pass.', where: 'Fixture', reason: 'Contract fixture only.', resolution: null, preserve: []},
    evidenceDigests: entry.evidenceDigests, limitations: ['Not semantic qualification.'], ...patch}));
}
export function modelDecision(passed = true) {
  return {passed, failureKind: passed ? 'none' : 'insufficient-support', summary: 'Synthetic assessment.', where: 'Supplied material',
    reason: passed ? 'Synthetic condition supported.' : 'Synthetic condition lacks support.', resolution: passed ? '' : 'Supply the missing grounds.',
    preserve: '["Keep the accepted scope."]', evidenceDigests: JSON.stringify([digest('1')]), limitations: '["Synthetic fixture, not semantic qualification."]'};
}
