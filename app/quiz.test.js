import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, BY_ID } from './data.js';
import { pickDistractors, relatedIds } from './quiz.js';

const shuffle = (a) => a.sort(() => Math.random() - 0.5);
const quizItems = ITEMS.filter((x) => !x.noQuiz && !x.extra);
const opts = { items: ITEMS, byId: BY_ID, isAvailable: (x) => !x.noQuiz && !x.extra, shuffle };

test('every question gets exactly 3 different wrong answers', () => {
  for (const item of quizItems) {
    for (let k = 0; k < 5; k++) {
      const d = pickDistractors(item, opts);
      assert.equal(d.length, 3, item.id);
      assert.equal(new Set(d).size, 3, item.id);
      assert.ok(!d.includes(item), item.id);
    }
  }
});

test('also works when only a few structures are available (like M1: 3 sternum parts)', () => {
  const few = { ...opts, isAvailable: (x) => x.kind !== 'part' || x.parent === 'sternum' };
  assert.equal(pickDistractors(BY_ID.manubrium_sterni, few).length, 3);
});

test('never offers an answer that is also correct', () => {
  for (const item of quizItems) {
    const bad = relatedIds(item, ITEMS, BY_ID);
    for (let k = 0; k < 5; k++) for (const d of pickDistractors(item, opts)) assert.ok(!bad.has(d.id), `${item.id} → ${d.id}`);
  }
  assert.ok(relatedIds(BY_ID.talus, ITEMS, BY_ID).has('ossa_tarsi'));
  assert.ok(relatedIds(BY_ID.ossa_carpi, ITEMS, BY_ID).has('os_pisiforme'));
  assert.ok(relatedIds(BY_ID.manubrium_sterni, ITEMS, BY_ID).has('sternum'));
});

test('prefers structures of the same kind and region', () => {
  for (let k = 0; k < 10; k++) {
    for (const d of pickDistractors(BY_ID.vert_lumbales, opts)) assert.equal(d.region || 'pater', 'pater');
  }
});
