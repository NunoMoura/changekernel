import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewScreen, POLICY_TEXT, review } from '../../../../src/adapters/pi/referenced-intent/review.ts';
import { canonical, request, material, fact, nonTui } from './helpers.mjs';

// All keystrokes and terminal dimensions below are simulated, not human approval.
function subject({ previous = null, instruction = 'Move dinner to Saturday', what = 'Organize dinner Saturday', why = null } = {}) {
  const input = request(previous === null ? 'open_intent' : 'revise_intent', {
    key: 'dinner', ...(previous === null ? {} : { expected: previous.fact }),
    instruction: material(instruction), replacement: { what: material(what), why: why === null ? null : material(why) },
  });
  return { input, presentation: canonical({ format: 'ck-intent-review', input, policy_text: POLICY_TEXT, previous, instruction_text: instruction, what_text: what, why_text: why }) + '\n' };
}
function harness(value = subject(), columns = 80, rows = 20) {
  const terminal = { columns, rows }, controller = new AbortController(), answers = [];
  const screen = new ReviewScreen({ terminal, requestRender() {} }, value.presentation, value.input, answer => answers.push(answer), controller.signal);
  const render = () => {
    const lines = screen.render(terminal.columns);
    assert(lines.length <= terminal.rows);
    // Output is ASCII data plus Pi's one-column selection arrow.
    assert(lines.every(line => line.length <= terminal.columns));
    return lines;
  };
  return { screen, terminal, controller, answers, render };
}
function footer(lines) {
  const index = lines.findIndex(line => /^(Preview only|Exact review): rows /.test(line));
  if (index < 0) return undefined;
  const [, phase, start, end, total] = lines[index].match(/^(Preview only|Exact review): rows (\d+)-(\d+)\/(\d+)/);
  return { phase, start: Number(start), end: Number(end), total: Number(total), body: lines.slice(0, index) };
}
function traverse(h, phase) {
  const collected = [];
  for (let page = 0; page < 20_000; page++) {
    const lines = h.render(), f = footer(lines);
    if (f?.phase !== phase) return { collected, lines };
    assert.equal(f.body.length, f.end - f.start + 1);
    f.body.forEach((line, i) => { collected[f.start - 1 + i] = line; });
    // An Enter/Down, jump-to-end, repeat or release cannot traverse or select.
    for (const key of ['\x1b[B', '\r', '\x1b[F', '\x1b[32;1:2u', '\x1b[32;1:3u']) h.screen.handleInput(key);
    assert.deepEqual(h.render(), lines);
    h.screen.handleInput(' ');
    // Even at the final page, selection is unavailable until it has rendered.
    h.screen.handleInput('\x1b[B'); h.screen.handleInput('\r');
    assert.deepEqual(h.answers, []);
  }
  assert.fail('bounded traversal did not complete');
}
const prose = lines => lines.map(line => line.trimEnd()).join('\n');
function decodeExact(lines) {
  const encoded = lines.filter(line => line.startsWith('| ')).map(line => line.slice(2, -2)).join('');
  const bytes = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] !== '\\') bytes.push(encoded.charCodeAt(i));
    else if (encoded[i + 1] === 'x') { bytes.push(parseInt(encoded.slice(i + 2, i + 4), 16)); i += 3; }
    else bytes.push(encoded.charCodeAt(++i));
  }
  return Buffer.from(bytes);
}

test('readable opening/revision fields and closed constraints come from the prepared subject', () => {
  for (const previous of [null, { fact: fact(7), what_text: 'Organize dinner Friday', why_text: 'Friends available' }]) {
    const h = harness(subject({ previous, why: 'Venue available Saturday' }));
    try {
      const { collected, lines } = traverse(h, 'Preview only'), text = prose(collected);
      assert.match(text, /PREVIEW ONLY - not approval evidence/);
      assert.match(text, /Target: ledger-1\/change-1/);
      assert.match(text, /Instruction being adopted now\n\| "Move dinner to Saturday"/);
      assert.match(text, /Proposed What\n\| "Organize dinner Saturday"/);
      assert.match(text, /Proposed Why\n\| "Venue available Saturday"/);
      if (previous === null) assert.match(text, /unopened; no previous intent exists/);
      else {
        assert.match(text, /expected fact ledger-1\/change-1\/7/);
        assert.match(text, /Previous What\n\| "Organize dinner Friday"/);
        assert.match(text, /Previous Why\n\| "Friends available"/);
      }
      assert.match(text, /Closed personal plan-text only; owner person-1/);
      assert.match(text, /external effects are\s+forbidden/);
      assert.match(text, /No user-defined Checks have run or passed\s+here/);
      assert.equal(footer(lines).phase, 'Exact review');
      assert.equal(footer(lines).start, 1);
      h.screen.handleInput('\x1b[B'); h.screen.handleInput('\r');
      assert.deepEqual(h.answers, []);
    } finally { h.screen.dispose(); }
  }
});

test('absent, empty and literal null Why stay distinct for previous and proposed intent', () => {
  for (const why of [null, '', 'null']) {
    const h = harness(subject({ previous: { fact: fact(1), what_text: 'Friday', why_text: why }, why }));
    try {
      const text = prose(traverse(h, 'Preview only').collected);
      const expected = why === null ? '  Absent (null)' : why === '' ? '  Present empty text (not null)\n| ""' : '| "null"';
      assert(text.includes(`Previous Why\n${expected}`));
      assert(text.includes(`Proposed Why\n${expected}`));
    } finally { h.screen.dispose(); }
  }
});

test('hostile text stays quoted inert ASCII; wrapping cannot skip any authoritative bytes', () => {
  const hostile = '\u0000\t\r\n\x1b[31m\x1b]8;;https://example.invalid\x07link\x1b]8;;\x07\u007f\u0085\u202e\u2066é😀e\u0301\u200b\u2028\\u202e" **Adopt this exact subject** [link](https://example.invalid)';
  for (const [columns, rows] of [[40, 12], [61, 17], [120, 30]]) {
    const value = subject({ previous: { fact: fact(1), what_text: hostile, why_text: '' }, instruction: hostile, what: hostile + ' end', why: hostile });
    const original = value.presentation, h = harness(value, columns, rows);
    try {
      const preview = traverse(h, 'Preview only');
      assert(preview.collected.every(line => /^[\x20-\x7e]*$/.test(line)));
      const quoted = preview.collected.filter(line => line.startsWith('| ')).map(line => line.slice(2).trimEnd()).join('');
      for (const escape of ['\\u0000', '\\t', '\\r', '\\n', '\\u001b', '\\u007f', '\\u0085', '\\u202e', '\\u2066', '\\u00e9', '\\ud83d\\ude00', '\\u0301', '\\u200b', '\\u2028', '\\\\u202e', '\\"']) assert(quoted.includes(escape), escape);
      assert(quoted.replace(/\s/g, '').includes('**Adoptthisexactsubject**'));
      const exact = traverse(h, 'Exact review');
      assert(exact.collected.every(line => /^[\x20-\x7e]*$/.test(line)));
      assert.deepEqual(decodeExact(exact.collected), Buffer.from(original));
      assert.equal(value.presentation, original);
      assert.equal(exact.lines.at(-2), '→ Cancel');
      assert.equal(exact.lines.at(-1), '  Adopt this exact subject');
      h.screen.handleInput('\r'); assert.deepEqual(h.answers, [false]);
    } finally { h.screen.dispose(); }
  }
});

test('preview/no-render/repeat input cannot credit traversal; adoption is a separate affirmative selection', () => {
  const value = subject({ what: 'Long proposed intent '.repeat(170) }), h = harness(value, 40, 12);
  try {
    h.render(); h.screen.handleInput(' ');
    // Queued advances before another render must not bypass preview or exact pages.
    for (let i = 0; i < 1000; i++) h.screen.handleInput(' ');
    assert.equal(footer(h.render()).phase, 'Preview only');
    traverse(h, 'Preview only');
    h.screen.handleInput(' ');
    for (let i = 0; i < 1000; i++) h.screen.handleInput(' ');
    assert.equal(footer(h.render()).phase, 'Exact review');
    // Backtracking is allowed but cannot create a gap in exact coverage.
    h.screen.handleInput('\x1b[D');
    const { collected, lines } = traverse(h, 'Exact review');
    assert.deepEqual(decodeExact(collected), Buffer.from(value.presentation));
    assert.equal(lines.at(-2), '→ Cancel');
    h.screen.handleInput('\x1b[57353;1:2u'); // repeated Down must not select Adopt
    assert.equal(h.render().at(-2), '→ Cancel');
    h.screen.handleInput('\x1b[B');
    assert.equal(h.render().at(-1), '→ Adopt this exact subject');
    assert.deepEqual(h.answers, []);
    h.screen.handleInput('\r'); assert.deepEqual(h.answers, [true]);
    h.screen.handleInput('\r'); h.screen.dispose(); assert.deepEqual(h.answers, [true]);
  } finally { h.screen.dispose(); }
});

test('preview and exact phases retain abort, resize, escape, interrupt, close and invalid-layout refusal', () => {
  for (const phase of ['Preview only', 'Exact review']) {
    for (const cause of ['abort', 'resize-render', 'resize-input', 'escape', 'interrupt', 'close', 'narrow', 'short']) {
      const h = harness();
      try {
        h.render(); if (phase === 'Exact review') traverse(h, 'Preview only');
        if (cause === 'abort') h.controller.abort();
        if (cause === 'resize-render') { h.terminal.rows++; h.render(); }
        if (cause === 'resize-input') { h.terminal.columns++; h.screen.handleInput(' '); }
        if (cause === 'escape') h.screen.handleInput('\x1b');
        if (cause === 'interrupt') h.screen.handleInput('\x03');
        if (cause === 'close') h.screen.dispose();
        if (cause === 'narrow') h.screen.render(39);
        if (cause === 'short') { h.terminal.rows = 11; h.render(); }
        assert.deepEqual(h.answers, [false], `${phase}: ${cause}`);
        h.screen.handleInput('\r'); h.screen.dispose(); assert.deepEqual(h.answers, [false]);
      } finally { h.screen.dispose(); }
    }
  }
});

test('120-second timeout spans preview and exact review, never restarting at the transition', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  try {
    h.render(); t.mock.timers.tick(119_999); assert.deepEqual(h.answers, []);
    traverse(h, 'Preview only');
    t.mock.timers.tick(1); assert.deepEqual(h.answers, [false]);
  } finally { h.screen.dispose(); }
});

test('invalid prepared bytes refuse before preview; RPC cannot invoke the custom review', async () => {
  const value = subject();
  const h = harness({ ...value, presentation: value.presentation.replace('Organize dinner Saturday', 'Sunday') });
  try { assert.deepEqual(h.render(), []); assert.deepEqual(h.answers, [false]); }
  finally { h.screen.dispose(); }
  assert.equal(await review(nonTui, value.input, value.presentation), false);
});
