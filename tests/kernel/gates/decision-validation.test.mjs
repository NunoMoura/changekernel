import assert from 'node:assert/strict';
import test from 'node:test';
import {createCheckResult, decodeCheckResult} from '../../../src/kernel/gates/checks.ts';
import {createDecisionValidationResult, decodeDecisionValidationResult, prepareDecisionValidation, reduceDecisionValidation} from '../../../src/kernel/gates/decision-validation.ts';
import {DECISION_QUESTIONS, decisionValidatorArtifact} from '../../../src/kernel/gates/decision-validators.ts';
import {ok, digest, fixture} from './check-fixtures.mjs';
import {decisionFixture, decisionResult} from './decision-validation-fixtures.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
function resultPatch(result, patch) {const {protocol: _protocol, digest: _digest, ...body} = result; return ok(createDecisionValidationResult({...body, ...patch}));}

test('Decision catalog is release-owned, stage-bound and required independently of domain adoption', () => {
  const {selection} = decisionFixture(), prepared = ok(prepareDecisionValidation(selection));
  assert.equal(prepared.entries.length, 10);
  assert.deepEqual(prepared.entries.map(entry => entry.checkId), DECISION_QUESTIONS.map(question => question.checkId));
  assert(prepared.entries.every(entry => entry.readiness === 'ready'));
  assert(prepared.definitions.every(definition => definition.owner === 'backend' && definition.stage === 'decision'));
  assert(prepared.inputs.every(input => !Object.hasOwn(input, 'adoptionDigest') && input.owner === 'backend'));
  assert.equal(selection.domain.selection.adoption.checks.length, 1, 'No manufactured backend Pack adoption');
  for (const extra of [{definitions: []}, {validators: []}, {owner: 'backend'}, {activation: false}, {approval: true}]) {
    assert.equal(prepareDecisionValidation({...selection, ...extra}).ok, false);
  }
  assert.throws(() => decisionValidatorArtifact('fixture:optional:replacement'));
  const admitted = ok(reduceDecisionValidation({selection, results: []}));
  assert.equal(admitted.domain.passed, true); assert.equal(admitted.passed, false);
  assert.equal(admitted.backend.blockers.length, 10);
});

test('Every backend condition and required domain assessment must pass; approval is separate', () => {
  const {selection} = decisionFixture(), results = DECISION_QUESTIONS.map((_, index) => decisionResult(selection, index));
  const pass = ok(reduceDecisionValidation({selection, results}));
  assert.equal(pass.passed, true); assert.equal(Object.hasOwn(pass, 'authorized'), false); assert.equal(Object.hasOwn(pass, 'nextState'), false);
  for (let index = 0; index < results.length; index++) {
    const incomplete = results.filter((_, i) => i !== index);
    assert.equal(ok(reduceDecisionValidation({selection, results: incomplete})).passed, false);
    const failed = results.map((result, i) => i === index ? resultPatch(result, {passed: false, failureKind: 'insufficient-support'}) : result);
    const reduced = ok(reduceDecisionValidation({selection, results: failed}));
    assert.equal(reduced.passed, false); assert.deepEqual(reduced.backend.failed, [results[index].checkId]);
  }
});

test('Operational errors remain missing semantic judgment, not false assessment', () => {
  const {selection} = decisionFixture(), result = decisionResult(selection, 0, {status: 'operational-error', passed: null, failureKind: null});
  const reduced = ok(reduceDecisionValidation({selection, results: [result]}));
  assert.equal(reduced.passed, false); assert.deepEqual(reduced.backend.failed, []);
  assert(reduced.backend.blockers.includes(`operational-error:${result.checkId}`));
  assert.equal(decodeDecisionValidationResult({...result, passed: false}).ok, false);
});

test('Domain results cannot be relabeled as backend results, even using a reserved-looking identifier', () => {
  const domain = fixture({definition: {checkId: DECISION_QUESTIONS[0].checkId}}), {selection} = decisionFixture({domain});
  const domainResult = selection.domain.results[0], backend = decisionResult(selection);
  assert.equal(decodeDecisionValidationResult(domainResult).ok, false);
  assert.equal(decodeCheckResult(backend).ok, false);
  const {protocol: _protocol, digest: _digest, ...body} = domainResult;
  const relabeled = ok(createDecisionValidationResult({...body, owner: 'backend', stage: 'decision', kernelVersion: backend.kernelVersion,
    kernelBuildDigest: backend.kernelBuildDigest, definitionDigest: backend.definitionDigest}));
  assert.equal(reduceDecisionValidation({selection, results: [relabeled]}).ok, false);
  assert.equal(reduceDecisionValidation({selection, results: [domainResult]}).ok, false);
});

test('Admission rejects duplicate, foreign, corrupted, oversized and wrongly produced backend results', () => {
  const {selection} = decisionFixture(), result = decisionResult(selection);
  const invalid = [resultPatch(result, {checkId: 'fixture:foreign:check'}), resultPatch(result, {inputDigest: digest('a')}),
    resultPatch(result, {executionDigest: digest('b')}), resultPatch(result, {definitionDigest: digest('c')}), resultPatch(result, {kernelBuildDigest: digest('d')}),
    resultPatch(result, {kernelVersion: '999.0.0'}), resultPatch(result, {producerId: 'fixture:producer:domain'}), resultPatch(result, {evidenceDigests: [digest('e')]}), {...result, passed: false}];
  for (const wrong of invalid) assert.equal(reduceDecisionValidation({selection, results: [wrong]}).ok, false);
  assert.equal(reduceDecisionValidation({selection, results: [result, result]}).ok, false);
  const large = resultPatch(result, {limitations: Array(5).fill('x'.repeat(4000))});
  assert.equal(reduceDecisionValidation({selection, results: [large]}).ok, false);
  const {protocol: _protocol, digest: _digest, ...body} = result;
  for (const patch of [{owner: 'domain'}, {stage: 'review'}, {stage: 'planning'}, {stage: 'implementation'}]) assert.equal(createDecisionValidationResult({...body, ...patch}).ok, false);
});

test('Unavailable sources, exclusions and incomplete effects block every condition without fake judgments', () => {
  const {selection} = decisionFixture();
  for (const status of ['missing', 'denied', 'stale']) {
    const altered = clone(selection); Object.assign(altered.slots[0], {status, value: null, omissions: ['Unavailable fixture material.']});
    assert(ok(prepareDecisionValidation(altered)).entries.every(entry => entry.readiness === 'unready'));
    assert.equal(ok(reduceDecisionValidation({selection: altered, results: []})).passed, false);
  }
  const excluded = clone(selection); excluded.slots[0].omissions.push('Excluded part of the commitment set.');
  assert(ok(prepareDecisionValidation(excluded)).entries.every(entry => entry.readiness === 'unready'));
  const incomplete = decisionFixture({domain: fixture({input: {effectsComplete: false}})}).selection;
  incomplete.domain.results = []; assert(ok(prepareDecisionValidation(incomplete)).entries.every(entry => entry.readiness === 'unready'));
  for (const slots of [[], selection.slots.slice(1), [...selection.slots, selection.slots[0]]]) assert.equal(prepareDecisionValidation({...selection, slots}).ok, false);
});

test('Domain gaps and false results cannot be waived by passing backend results', () => {
  const {selection} = decisionFixture(), prior = decisionResult(selection), failed = clone(selection);
  const {protocol: _protocol, digest: _digest, ...body} = failed.domain.results[0];
  failed.domain.results = [ok(createCheckResult({...body, passed: false, failureKind: 'contradiction'}))];
  assert.equal(ok(reduceDecisionValidation({selection: failed, results: []})).domain.passed, false);
  assert.equal(reduceDecisionValidation({selection: failed, results: [prior]}).ok, false);
  const absent = clone(selection); absent.domain.results = [];
  assert(ok(prepareDecisionValidation(absent)).entries.every(entry => entry.missing.includes('required-domain-assessment')));
});

test('Backend and domain assessment must refer to exactly the same current stage and subject', () => {
  const {selection} = decisionFixture();
  for (const patch of [{stage: 'review'}, {kernelBuildDigest: digest('a')}, {effects: []}, {effectsComplete: false}]) {
    assert.equal(prepareDecisionValidation({...selection, current: {...selection.current, ...patch}}).ok, false);
  }
  const changed = clone(selection); changed.current.subject.subjectDigest = digest('a');
  assert.equal(prepareDecisionValidation(changed).ok, false);
  const badData = clone(selection); badData.slots[0].value = {};
  assert.equal(prepareDecisionValidation(badData).ok, false);
});

test('Complete evaluation identity changes with uncited data, membership, roles, limits and route settings', () => {
  const {selection} = decisionFixture(), before = ok(prepareDecisionValidation(selection)), prior = decisionResult(selection);
  const changes = [s => s.slots[0].value.push({retained: 'Additional uncited commitment.'}), s => s.slots[2].value[0].role = 'assumption',
    s => s.slots[2].value[0].body += ' New counterevidence.', s => s.slots[3].value.intent = 'Changed objective.',
    s => s.configuration.model.settingsDigest = digest('a'), s => s.configuration.model.routeDigest = digest('b'),
    s => s.configuration.dependenciesDigest = digest('6'), s => s.configuration.limits.milliseconds--];
  for (const change of changes) {
    const altered = clone(selection); change(altered);
    const after = ok(prepareDecisionValidation(altered)); assert.notEqual(after.digest, before.digest);
    assert(after.inputs.every((input, index) => input.digest !== before.inputs[index].digest));
    assert.equal(reduceDecisionValidation({selection: altered, results: [prior]}).ok, false);
  }
  const permission = clone(selection); permission.configuration.permissionDigest = digest('0'); permission.current.permissionDigests.unshift(digest('0'));
  assert.notEqual(ok(prepareDecisionValidation(permission)).inputs[0].digest, before.inputs[0].digest);
});

test('Narrower bounds cannot skip inference or truncate material to manufacture readiness', () => {
  const {selection} = decisionFixture();
  const inputBytes = Buffer.byteLength(JSON.stringify({input: ok(prepareDecisionValidation(selection)).inputs[0], parameters: {}}));
  for (const limits of [{...selection.configuration.limits, modelCalls: 0, modelInputTokens: 0, modelOutputTokens: 0},
    {...selection.configuration.limits, inputBytes: 10}, {...selection.configuration.limits, inputBytes: inputBytes + 64},
    {...selection.configuration.limits, modelInputTokens: 1}, {...selection.configuration.limits, modelCalls: 2}]) {
    assert.equal(prepareDecisionValidation({...selection, configuration: {...selection.configuration, limits}}).ok, false);
  }
});

test('Input and result snapshots are frozen; changed surrounding permissions need not change evaluation identity', () => {
  const {selection} = decisionFixture(), prepared = ok(prepareDecisionValidation(selection)), before = prepared.inputs[0].slots[3].value.intent;
  selection.slots[3].value.intent = 'Later caller mutation.';
  assert.equal(prepared.inputs[0].slots[3].value.intent, before);
  assert(Object.isFrozen(prepared.inputs[0].slots[3].value));
  const original = decisionFixture().selection, updated = clone(original); updated.current.permissionDigests.unshift(digest('0'));
  const previous = ok(prepareDecisionValidation(original)), next = ok(prepareDecisionValidation(updated));
  assert.notEqual(previous.digest, next.digest); assert.equal(previous.inputs[0].digest, next.inputs[0].digest);
});
