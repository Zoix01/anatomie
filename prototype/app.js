import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ITEMS, BY_ID, GENERIC_PARENT } from './data.js';
import { buildSkeleton, PART_IDS } from './skeleton.js';
import { isMatch } from './match.js';

const COLORS = {
  bone: new THREE.Color('#E8E2D4'),
  hover: new THREE.Color('#3D8BFD'),
  accent: new THREE.Color('#0E7C86'),
};
const PART_PALETTE = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7', '#D55E00', '#0072B2'].map((c) => new THREE.Color(c));
// Malé části jdou ťuknout jen v izolované kosti.
const SMALL_PARTS = new Set(['incisura_radialis', 'incisura_trochlearis', 'canalis_caroticus']);
const PART_CODE = Object.fromEntries(PART_IDS.map((id, i) => [id, i]));
const $ = (id) => document.getElementById(id);

// ---------- 3D scéna ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#E3E5E8');
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(1, 2, 3);
camera.add(sun);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.08;
controls.maxDistance = 5;
controls.zoomToCursor = true;
const ISO_DIR = new THREE.Vector3(0.45, 0.35, 1); // izolovaná kost: šikmý pohled zepředu

const meshes = buildSkeleton(scene);
const DEFAULT_VIEW = { pos: new THREE.Vector3(0, 0.9, 2.7), target: new THREE.Vector3(0, 0.86, 0) };
camera.position.copy(DEFAULT_VIEW.pos);
controls.target.copy(DEFAULT_VIEW.target);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  requestRender();
}
window.addEventListener('resize', resize);

let needsRender = true;
function requestRender() { needsRender = true; }
controls.addEventListener('change', () => { requestRender(); updatePartVisibility(); });

let camAnim = null;
function loop(t) {
  requestAnimationFrame(loop);
  if (camAnim) {
    const k = Math.min(1, (t - camAnim.start) / 450);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    if (k === 1) camAnim = null;
    needsRender = true;
  }
  if (controls.update()) needsRender = true;
  if (needsRender) {
    renderer.render(scene, camera);
    needsRender = false;
  }
}

function flyTo(pos, target) {
  camAnim = {
    start: performance.now(),
    fromPos: camera.position.clone(), toPos: pos.clone(),
    fromTarget: controls.target.clone(), toTarget: target.clone(),
  };
}

// Natočí kameru na box, směr pohledu zachová.
function frameBox(box3, pad = 1.4, minDist = 0.12, dir = null) {
  const sphere = box3.getBoundingSphere(new THREE.Sphere());
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const half = Math.min(halfV, Math.atan(Math.tan(halfV) * camera.aspect)); // na výšku telefonu omezuje šířka
  const dist = Math.max((sphere.radius * pad) / Math.sin(half), minDist);
  dir = (dir || camera.position.clone().sub(controls.target)).clone().normalize();
  flyTo(sphere.center.clone().add(dir.multiplyScalar(dist)), sphere.center);
}

// ---------- členství a cíle ----------
const membersOf = (id) => meshes.filter((m) => m.userData.item === id || m.userData.groups.includes(id));

function boxOf(targets) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const m of targets.meshes) {
    m.updateMatrixWorld();
    if (targets.code == null) { box.expandByObject(m); continue; }
    const pos = m.geometry.attributes.position;
    const part = m.geometry.attributes.part;
    for (let i = 0; i < pos.count; i++) {
      if (part.array[i] === targets.code) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    }
  }
  return box;
}

// Pro test: struktura na jedné (pravé) straně, části obratlů/žeber na všech.
function quizTargets(item) {
  const notLeft = (m) => m.userData.side !== 'L';
  if (item.kind !== 'part') return { meshes: membersOf(item.id).filter(notLeft), code: null };
  const code = PART_CODE[item.id];
  if (item.parent === 'vertebra') return { meshes: meshes.filter((m) => m.userData.isVertebra), code };
  if (item.parent === 'costa') return { meshes: meshes.filter((m) => m.userData.isRib && notLeft(m)), code };
  return { meshes: membersOf(item.parent).filter(notLeft), code };
}

// ---------- barvení ----------
const tint = { hover: null, select: null, quiz: null }; // { meshes:Set, code|null }
const partsShown = new Set();
const partOrder = new Map();

function partColor(mesh, code) {
  let order = partOrder.get(mesh);
  if (!order) {
    order = new Map();
    for (const c of mesh.geometry.attributes.part.array) if (c >= 0 && !order.has(c)) order.set(c, order.size);
    partOrder.set(mesh, order);
  }
  return PART_PALETTE[order.get(code) % PART_PALETTE.length];
}

function paint(mesh) {
  const col = mesh.geometry.attributes.color;
  const part = mesh.geometry.attributes.part.array;
  const showParts = partsShown.has(mesh);
  const layers = [tint.quiz && { ...tint.quiz, c: COLORS.accent }, tint.select && { ...tint.select, c: COLORS.hover }, tint.hover && { ...tint.hover, c: COLORS.hover }]
    .filter((l) => l && l.meshes.has(mesh));
  for (let i = 0; i < part.length; i++) {
    const code = part[i];
    let c = showParts && code >= 0 ? partColor(mesh, code) : COLORS.bone;
    for (const l of layers) if (l.code == null || l.code === code) { c = l.c; break; }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
function paintAll() { meshes.forEach(paint); requestRender(); }

// Části se ukážou, když kost zabírá aspoň třetinu obrazovky na výšku (nebo je izolovaná).
const tmpV = new THREE.Vector3();
function updatePartVisibility() {
  let changed = false;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  for (const m of meshes) {
    let show = false;
    if (m.userData.hasParts && m.visible) {
      if (state.mode === 'isolate') show = true;
      else if (state.mode === 'explore') {
        const s = m.geometry.boundingSphere;
        const dist = tmpV.copy(s.center).applyMatrix4(m.matrixWorld).distanceTo(camera.position);
        show = (2 * s.radius) / (2 * dist * halfH) > 1 / 3;
      }
    }
    if (show !== partsShown.has(m)) {
      changed = true;
      show ? partsShown.add(m) : partsShown.delete(m);
    }
  }
  if (changed) {
    if (partsShown.size) $('zoomHint').hidden = true; // nápověda zmizí po prvním přiblížení
    paintAll();
  }
}

// ---------- výběr pod prstem ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(meshes.filter((m) => m.visible), false)[0];
  if (!hit) return null;
  const mesh = hit.object;
  const code = mesh.geometry.attributes.part.array[hit.face.a];
  if (code >= 0 && partsShown.has(mesh)) {
    const id = PART_IDS[code];
    if (state.mode === 'isolate' || !SMALL_PARTS.has(id)) return { item: BY_ID[id], mesh, meshes: new Set([mesh]), code };
  }
  const item = BY_ID[mesh.userData.item];
  // Skupina svítí celá; v izolaci jen to, co je vidět.
  const set = item.kind === 'group' ? membersOf(item.id).filter((m) => m.visible) : [mesh];
  return { item, mesh, meshes: new Set(set), code: null };
}

const sameTarget = (a, b) => a && b && a.item === b.item && a.mesh === b.mesh;
function setHover(t) {
  if (sameTarget(t, tint.hover) || (!t && !tint.hover)) return;
  tint.hover = t;
  paintAll();
}

let down = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, multi: !e.isPrimary };
  if (e.pointerType !== 'mouse' && interactive()) setHover(pick(e.clientX, e.clientY));
});
canvas.addEventListener('pointermove', (e) => {
  if (!interactive()) return;
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
    down.moved = true;
    if (e.pointerType !== 'mouse') setHover(null);
  }
  if (e.pointerType === 'mouse' && !down) setHover(pick(e.clientX, e.clientY));
});
canvas.addEventListener('pointerup', (e) => {
  const d = down;
  down = null;
  if (e.pointerType !== 'mouse') setHover(null);
  if (!d || d.moved || d.multi || performance.now() - d.t > 600 || !interactive()) return;
  const t = pick(e.clientX, e.clientY);
  if (t) openCard(t); else closeCard();
});
canvas.addEventListener('pointercancel', () => { down = null; setHover(null); });
canvas.addEventListener('pointerleave', () => { if (!down) setHover(null); });
const interactive = () => state.mode === 'explore' || state.mode === 'isolate';

// ---------- obrazovky ----------
const state = { mode: 'home', returnTo: null, saved: null, isolated: null, card: null };
const SCREENS = ['home', 'explore', 'setup', 'quiz', 'results'];

function show(screen) {
  SCREENS.forEach((s) => $(s).classList.toggle('active', s === screen));
}

function go(mode) {
  closeCard();
  if (state.mode === 'isolate' && mode !== 'isolate') endIsolate(false);
  state.mode = mode;
  tint.hover = null;
  if (mode !== 'quiz') tint.quiz = null;
  if (mode === 'explore') {
    show('explore');
    $('exploreTitle').textContent = 'Prozkoumat';
    $('exploreBack').textContent = '‹ Zpět';
  } else if (mode === 'home' || mode === 'setup' || mode === 'results') {
    show(mode);
    state.returnTo = null;
    tint.select = null;
  }
  updatePartVisibility();
  paintAll();
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  const to = b.dataset.go;
  if (to === 'explore') { resetCamera(true); go('explore'); } else go(to);
}));

$('exploreBack').addEventListener('click', () => {
  if (state.mode === 'isolate') return endIsolate(true);
  if (state.returnTo === 'results') { go('results'); return; }
  go('home');
});

function resetCamera(instant = false) {
  if (state.mode === 'isolate' && state.isolated) return frameBox(boxOf({ meshes: state.isolated, code: null }), 1.25, 0.12, ISO_DIR);
  if (instant) { camera.position.copy(DEFAULT_VIEW.pos); controls.target.copy(DEFAULT_VIEW.target); camAnim = null; requestRender(); }
  else flyTo(DEFAULT_VIEW.pos, DEFAULT_VIEW.target);
}
$('resetView').addEventListener('click', () => resetCamera());

// ---------- karta ----------
function openCard(t) {
  state.card = t;
  tint.select = { meshes: t.meshes, code: t.code };
  paintAll();
  const it = t.item;
  $('cardLa').textContent = it.la;
  $('cardCz').textContent = it.cz;
  const parentEl = $('cardParent');
  parentEl.innerHTML = '';
  let label = null;
  let value = null;
  if (it.kind === 'part') {
    label = 'Část kosti:';
    value = GENERIC_PARENT[it.parent] || BY_ID[it.parent].la;
  } else {
    const groups = t.mesh.userData.groups.filter((g) => g !== it.id);
    const outer = groups[groups.length - 1] || it.groupOf;
    if (outer) { label = 'Patří do:'; value = BY_ID[outer].la; }
  }
  if (label) {
    parentEl.append(Object.assign(document.createElement('b'), { textContent: label + ' ' }));
    parentEl.append(Object.assign(document.createElement('i'), { textContent: value }));
  }
  parentEl.hidden = !label;
  $('cardFact').textContent = it.fact || '';
  $('cardFact').hidden = !it.fact;
  $('cardIsolate').hidden = state.mode === 'isolate';
  $('card').hidden = false;
}
function closeCard() {
  $('card').hidden = true;
  if (state.card) { state.card = null; tint.select = null; paintAll(); }
}
$('cardClose').addEventListener('click', closeCard);

// ---------- izolace ----------
$('cardIsolate').addEventListener('click', () => {
  const t = state.card;
  const it = t.item;
  const m = t.mesh;
  let iso;
  if (it.kind === 'group' && !m.userData.isRib && !m.userData.isVertebra) iso = membersOf(it.id).filter((x) => x.userData.side === m.userData.side);
  else iso = [m];
  closeCard();
  startIsolate(iso, it.kind === 'part' ? BY_ID[m.userData.item].la : it.la);
});

function startIsolate(iso, title) {
  state.saved = { pos: camera.position.clone(), target: controls.target.clone() };
  state.isolated = iso;
  const set = new Set(iso);
  meshes.forEach((m) => { m.visible = set.has(m); });
  state.mode = 'isolate';
  $('exploreTitle').textContent = title;
  $('exploreBack').textContent = '‹ Zpět na kostru';
  updatePartVisibility();
  frameBox(boxOf({ meshes: iso, code: null }), 1.25, 0.12, ISO_DIR);
}

function endIsolate(toExplore) {
  meshes.forEach((m) => { m.visible = true; });
  state.isolated = null;
  if (state.saved) flyTo(state.saved.pos, state.saved.target);
  if (toExplore) {
    closeCard();
    state.mode = 'explore';
    $('exploreTitle').textContent = 'Prozkoumat';
    $('exploreBack').textContent = '‹ Zpět';
    updatePartVisibility();
    paintAll();
  }
}

// ---------- test ----------
let difficulty = 'easy';
document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
  difficulty = b.dataset.diff;
  document.querySelectorAll('[data-diff]').forEach((x) => x.classList.toggle('selected', x === b));
}));

const quiz = { deck: [], n: 0, correct: 0, answered: 0, wrong: [], item: null, locked: false };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

$('startQuiz').addEventListener('click', () => {
  Object.assign(quiz, { deck: [], n: 0, correct: 0, answered: 0, wrong: [] });
  state.mode = 'quiz';
  show('quiz');
  $('easyAnswers').hidden = difficulty !== 'easy';
  $('hardForm').hidden = difficulty !== 'hard';
  resetCamera(true);
  nextQuestion();
});

function nextQuestion() {
  if (!quiz.deck.length) quiz.deck = shuffle(ITEMS.filter((it) => !it.noQuiz)); // řady zápěstí nemají latinský název
  quiz.item = quiz.deck.pop();
  quiz.n += 1;
  quiz.locked = false;
  updateStatus();
  const t = quizTargets(quiz.item);
  tint.quiz = { meshes: new Set(t.meshes), code: t.code };
  paintAll();
  frameQuiz(quiz.item);
  $('feedback').hidden = true;
  $('afterButtons').hidden = true;
  if (difficulty === 'easy') renderOptions();
  else {
    $('hardInput').value = '';
    $('hardInput').disabled = false;
    $('hardSubmit').disabled = true;
    $('hardForm').hidden = false;
  }
}

// V testu je vždy celá kostra; kamera ukáže celou kost (u části) s okolím.
function frameQuiz(item) {
  const t = quizTargets(item);
  frameBox(boxOf({ meshes: t.meshes, code: null }), 1.6, 0.8, new THREE.Vector3(0, 0.15, 1));
}

function updateStatus() {
  $('quizStatus').textContent = `Otázka ${quiz.n} · ${quiz.correct} správně`;
}

// Špatné možnosti: stejný druh a co nejblíž (části téže kosti, kosti téže oblasti).
function distractors(item) {
  const same = (f) => ITEMS.filter((x) => x.id !== item.id && x.kind === item.kind && f(x));
  let pool = item.kind === 'part' ? same((x) => x.parent === item.parent) : same((x) => x.region === item.region);
  if (pool.length < 3) pool = pool.concat(shuffle(same(() => true)).filter((x) => !pool.includes(x)));
  return shuffle(pool).slice(0, 3);
}

function renderOptions() {
  const box = $('easyAnswers');
  box.innerHTML = '';
  for (const opt of shuffle([quiz.item, ...distractors(quiz.item)])) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = opt.la;
    b.addEventListener('click', () => {
      if (quiz.locked) return;
      quiz.locked = true;
      const right = opt === quiz.item;
      b.classList.add(right ? 'ok' : 'bad');
      if (!right) [...box.children].find((x) => x.textContent === quiz.item.la).classList.add('ok');
      record(right);
    });
    box.append(b);
  }
}

$('hardInput').addEventListener('input', (e) => { $('hardSubmit').disabled = !e.target.value.trim(); });
$('hardForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = $('hardInput').value;
  if (!val.trim() || quiz.locked) return;
  quiz.locked = true;
  $('hardInput').disabled = true;
  if (isMatch(val, quiz.item)) return record(true);
  const fb = $('feedback');
  fb.innerHTML = '';
  const line = (label, text) => {
    const p = document.createElement('div');
    p.append(label + ' ', Object.assign(document.createElement('i'), { textContent: text }));
    return p;
  };
  fb.append(line('Tvoje odpověď:', val.trim()), line('Správně:', quiz.item.la));
  fb.hidden = false;
  $('hardForm').hidden = true;
  $('claimRight').hidden = false;
  $('afterButtons').hidden = false;
  quiz.pendingWrong = true;
});

function record(right) {
  quiz.answered += 1;
  if (right) {
    quiz.correct += 1;
    updateStatus();
    const fb = $('feedback');
    fb.innerHTML = '<span class="good">Správně!</span>';
    fb.hidden = false;
    if (difficulty === 'hard') $('hardForm').hidden = true;
    setTimeout(() => { if (state.mode === 'quiz') nextQuestion(); }, 1000);
  } else {
    quiz.wrong.push(quiz.item);
    $('claimRight').hidden = true;
    $('afterButtons').hidden = false;
  }
}

$('nextQ').addEventListener('click', () => {
  if (quiz.pendingWrong) { quiz.pendingWrong = false; quiz.answered += 1; quiz.wrong.push(quiz.item); }
  nextQuestion();
});
$('claimRight').addEventListener('click', () => {
  quiz.pendingWrong = false;
  quiz.answered += 1;
  quiz.correct += 1;
  updateStatus();
  nextQuestion();
});
$('quizReset').addEventListener('click', () => frameQuiz(quiz.item));

$('quizEnd').addEventListener('click', () => {
  if (quiz.pendingWrong) { quiz.pendingWrong = false; quiz.answered += 1; quiz.wrong.push(quiz.item); }
  if (!quiz.answered) return go('setup');
  showResults();
});

function showResults() {
  const pct = Math.round((quiz.correct / quiz.answered) * 100);
  $('score').textContent = `${quiz.correct} z ${quiz.answered}`;
  $('percent').textContent = `${pct} % správně`;
  const list = $('reviewList');
  list.innerHTML = '';
  const unique = [...new Set(quiz.wrong)];
  $('reviewLabel').textContent = unique.length ? 'Zopakuj si:' : 'Bez jediné chyby!';
  for (const it of unique) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.append(Object.assign(document.createElement('i'), { textContent: it.la }), ` – ${it.cz}`);
    b.addEventListener('click', () => reviewInExplore(it));
    li.append(b);
    list.append(li);
  }
  go('results');
}

// Z výsledků: Prozkoumat se strukturou zvýrazněnou, „‹ Zpět“ vrátí na výsledky.
function reviewInExplore(it) {
  go('explore');
  state.returnTo = 'results';
  const t = quizTargets(it);
  tint.select = { meshes: new Set(t.meshes), code: t.code };
  resetCamera(true);
  frameQuiz(it);
  paintAll();
}

resize();
paintAll();
requestAnimationFrame(loop);
