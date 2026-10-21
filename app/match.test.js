import test from 'node:test';
import assert from 'node:assert/strict';
import { isMatch } from './match.js';

const item = { la: 'processus styloideus radii' };

test('ignores case, diacritics and extra spaces', () => {
  assert.ok(isMatch('  Processus   STYLOIDEUS radií ', item));
});

test('expands abbreviations', () => {
  assert.ok(isMatch('proc. styloideus radii', item));
  assert.ok(isMatch('proc styloideus radii', item));
  assert.ok(isMatch('for. magnum', { la: 'foramen magnum' }));
  assert.ok(isMatch('inc. trochlearis', { la: 'incisura trochlearis' }));
});

test('accepts slide variants', () => {
  assert.ok(isMatch('costae liberae', { la: 'costae fluctuantes', variants: ['costae liberae'] }));
});

test('rejects typos (left to the "Měl/a jsem pravdu" button)', () => {
  assert.equal(isMatch('processus styloideus radi', item), false);
  assert.equal(isMatch('kost vřetenní', { la: 'radius' }), false);
});
