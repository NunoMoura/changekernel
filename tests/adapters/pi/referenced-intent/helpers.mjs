import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonical, VERSION } from '../../../../src/adapters/pi/referenced-intent/codec.ts';
import { digest, policyRef } from '../../../../src/adapters/pi/referenced-intent/review.ts';
export const base = { version: VERSION, ledger: 'ledger-1', change: 'change-1' };
export const lease = { principal: 'person-1', disclose: 'allow', mutate: 'allow' };
export const fact = seq => ({ ledger: 'ledger-1', change: 'change-1', seq });
export const material = text => ({ custody: 'custody-1', sha256: digest(text), bytes: Buffer.byteLength(text), text: 'utf8-exact' });
export const request = (op, fields) => ({ version: VERSION, op, ledger: 'ledger-1', change: 'change-1', ...fields });
export const root = () => mkdtemp(join(process.env.CK_TEST_ROOT ?? tmpdir(), 'ck-r76-'));
export function configuration(directory, executable, mode = 'fresh_provision') {
  return { executable, mode, grant: { version: VERSION, custody: 'custody-1', ledger: 'ledger-1', change: 'change-1', owner: 'person-1', coverage: 'closed-personal-plan', policy: policyRef, directory: join(directory, 'slot'), anchor: join(directory, 'anchor.json') }, authorization: lease };
}
export const nonTui = { mode: 'rpc', hasUI: true, ui: { custom() { throw new Error('RPC must not review'); } } };
/** Simulated terminal input, never evidence of real-human adoption. Uses production component gates. */
export function drive(screen, terminal, action = 'adopt') {
  let lines = screen.render(terminal.columns);
  screen.handleInput('\r'); // cannot adopt before traversal
  for (let page = 0; page < 10_000; page++) {
    screen.handleInput(' ');
    lines = screen.render(terminal.columns);
    if (lines.some(line => line.includes('Adopt this exact subject'))) {
      if (action === 'adopt') screen.handleInput('\x1b[B');
      screen.handleInput('\r');
      return;
    }
  }
  throw new Error('bounded traversal did not complete');
}
export async function withSimulatedTui(run, onScreen = drive) {
  const savedIn = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  const savedOut = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  let reviews = 0;
  const terminal = { columns: 80, rows: 30 };
  const ctx = { mode: 'tui', hasUI: true, ui: {
    custom: async factory => {
      reviews++;
      let settled = false, answer;
      const screen = factory({ terminal, requestRender() {} }, {}, {}, v => { settled = true; answer = v; });
      try { await onScreen(screen, terminal); if (!settled) throw new Error('review unresolved'); return answer; }
      finally { screen.dispose(); }
    },
  } };
  try { return await run(ctx, () => reviews); }
  finally {
    if (savedIn) Object.defineProperty(process.stdin, 'isTTY', savedIn); else delete process.stdin.isTTY;
    if (savedOut) Object.defineProperty(process.stdout, 'isTTY', savedOut); else delete process.stdout.isTTY;
  }
}
export async function fakeChild(directory, behavior) {
  const executable = join(directory, 'peer');
  const code = `#!${process.execPath}\n` + `
const fs = require('node:fs');
const log = ${JSON.stringify(join(directory, 'wire.jsonl'))};
let buf = Buffer.alloc(0);
const frame = text => { const p = Buffer.from(text); const h = Buffer.alloc(4); h.writeUInt32BE(p.length); process.stdout.write(Buffer.concat([h,p])); };
const send = value => frame(JSON.stringify(value) + '\\n');
process.stdin.on('data', chunk => {
 buf = Buffer.concat([buf, chunk]);
 while(buf.length >= 4 && buf.length >= 4 + buf.readUInt32BE(0)) {
  const length=buf.readUInt32BE(0); const r=JSON.parse(buf.subarray(4,4+length)); buf=buf.subarray(4+length);
  fs.appendFileSync(log, JSON.stringify(r)+'\\n');
  const connected = {bridge:'ck-intent-bridge', id:r.id, kind:'connected', version:${JSON.stringify(VERSION)}};
  const error = {bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:{version:${JSON.stringify(VERSION)},kind:'error',code:'unavailable',acceptance:'not_established'}};
  ${behavior}
 }
});
process.stdin.on('end',()=>process.exit(0));
`;
  await writeFile(executable, code); await chmod(executable, 0o700);
  return executable;
}
export { canonical, VERSION };
