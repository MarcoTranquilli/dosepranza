import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.v20260325.js', import.meta.url), 'utf8');
const cutoff = source.match(/const ORDER_CUTOFF = (\{[^;]+\});/)[1];
const predicate = source.slice(source.indexOf('const isOrderWindowOpen = () => {'), source.indexOf('const ensureOrderWindow ='));

for (const [instant, expected] of [
  ['2026-10-19T08:29:59Z', true],
  ['2026-10-19T08:30:00Z', false],
  ['2026-10-19T08:31:00Z', false],
  ['2026-12-07T09:29:59Z', true],
  ['2026-12-07T09:30:00Z', false]
]) {
  test(`Russo checkout uses Rome cutoff at ${instant}`, () => {
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
    const actual = vm.runInNewContext(`const isLocalE2E=false; const ORDER_CUTOFF=${cutoff}; ${predicate} isOrderWindowOpen();`, {Date:Clock, Intl});
    assert.equal(actual, expected);
  });
}

test('Russo has no remaining old cutoff control or label', () => {
  const html = fs.readFileSync(new URL('../russo/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(source + html, /11:30|hour:\s*11|11\s*\*\s*60|pre1130|post1130/);
});
