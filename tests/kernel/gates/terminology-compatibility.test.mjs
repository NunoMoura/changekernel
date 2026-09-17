import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeCheckInput, decodeCheckAdoption, decodeCheckResult, prepareCheckSelection} from '../../../src/kernel/gates/checks.ts';
import {projectStateReference, subject} from '../../../src/kernel/gates/evaluation-data.ts';
import {decodeDecisionValidationResult, reduceDecisionValidation} from '../../../src/kernel/gates/decision-validation.ts';
import {fixture, result, ok} from './check-fixtures.mjs';
import {decisionFixture, decisionResult} from './decision-validation-fixtures.mjs';

// Captured from the independently installed pre-terminology package, not recomputed
// expected values. Fixture questions retain their historical wording deliberately.
const identities = {
  sha1: {
    adoption: 'sha256:a994ebfb921d6b4635fddfef1ac65a71e436ab51d0c3677b4250dcc5ce566761',
    input: 'sha256:726ffd08464a2da3fa2bacac613863dee4359628ffdb8de7486d19b9bfb72f39',
    execution: 'sha256:5fb0a236a43f1568e795f5e312424ccc51cf9c90c8067b4ca80dd4645310fb30',
    selection: 'sha256:ea8170f1e10be53d5726f05b7f0f444810f5647c65d2b7baf83fc2d6d3acd78b',
    result: 'sha256:91768b49dab96df70cc0c804b573ae8195ca2f6e0f1cfddc0c264fbf5542f5af',
  },
  sha256: {
    adoption: 'sha256:4c31409cb7d0faab683e277b9933277e4024541eca54de5fe971a5e5389b9606',
    input: 'sha256:3b0c350516a4379a6901d348bca4ca7d4804b1a31428a9623a8a42ad5df5d143',
    execution: 'sha256:3f13d82bff783bde8cbbafda9f3041bdf33ba603957a2450dc9de7d73bb6745c',
    selection: 'sha256:b8341c19dae566a518d5d8fc84b715c978bf0c639b95779271a272f5a1a141ff',
    result: 'sha256:9abf2682174688df63bd7ecf80f93efad76fc0284cbfa1dddeab4f3009bf666a',
  },
};
for (const algorithm of ['sha1', 'sha256']) test(`terminology ${algorithm}: stored Check identities and comparison-side fields remain unchanged`, () => {
  const f = fixture({algorithm}), expected = identities[algorithm];
  assert.equal(ok(decodeCheckAdoption(f.adoption)).digest, expected.adoption);
  assert.equal(ok(decodeCheckInput(f.input)).digest, expected.input);
  assert.equal(f.input.executionDigest, expected.execution);
  assert.equal(ok(prepareCheckSelection(f.selection)).digest, expected.selection);
  assert.equal(ok(decodeCheckResult(result(f))).digest, expected.result);
  const comparison = subject(f.input.subject);
  assert.deepEqual(Object.keys(comparison).sort(), ['baseline', 'candidate', 'subjectDigest']);
  assert.deepEqual(projectStateReference(comparison.baseline), f.selection.current.snapshot);
  assert.notDeepEqual(comparison.baseline.commit, comparison.candidate.commit);
  assert.equal('diff' in comparison, false); // References are not a derived Change diff.
  assert.equal('accepted' in comparison, false);
});

test('revised backend wording does not relabel a result bound to the previous evaluator', () => {
  const {selection} = decisionFixture();
  const previous = decisionResult(selection, 0, {
    definitionDigest: 'sha256:30f9dfd1963daf7097f3ca56561772ae1fda8c83b7f9ced40fe14113584da011',
    inputDigest: 'sha256:196c91bf378551e02a94292f6bfd25c95a936956a78fa571817f619eb07c9bd1',
    executionDigest: 'sha256:2f3caf080acf82b3360f6101d3b48e793d8b7f83e038d9c7175b8190c4355024',
  });
  assert.deepEqual(ok(decodeDecisionValidationResult(previous)), previous);
  assert.notEqual(previous.definitionDigest, decisionResult(selection).definitionDigest);
  assert.equal(reduceDecisionValidation({selection, results: [previous]}).ok, false);
});
