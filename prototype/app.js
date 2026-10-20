import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ITEMS, BY_ID, GENERIC_PARENT } from './data.js?v=3';
import { buildSkeleton, PART_IDS } from './skeleton.js?v=3';
import { isMatch } from './match.js?v=3';

const COLORS = {
  bone: new THREE.Color('#DDD6C6'),
  hover: new THREE.Color('#4F7CA3'),
  accent: new THREE.Color('#2F6F73'),
};
// Tlumené zemité tóny, aby se části odlišily, ale kostra nekřičela.
const PART_PALETTE = ['#B0835A', '#6F8F7E', '#6E87A3', '#A5706A', '#8C8A5B', '#8E7C9E', '#5E8A87'].map((c) => new THREE.Color(c));
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
scene.background = new THREE.Color('#D3D6D9');
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
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
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
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), camAnim.rot, e);
    const d = THREE.MathUtils.lerp(camAnim.fromDist, camAnim.toDist, e);
    camera.position.copy(controls.target).add(camAnim.fromDir.clone().applyQuaternion(q).multiplyScalar(d));
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
  const fromOff = camera.position.clone().sub(controls.target);
  const toOff = pos.clone().sub(target);
  const fromDir = fromOff.clone().normalize();
  camAnim = {
    start: performance.now(),
    fromTarget: controls.target.clone(), toTarget: target.clone(),
    fromDir, rot: new THREE.Quaternion().setFromUnitVectors(fromDir, toOff.clone().normalize()),
    fromDist: fromOff.length(), toDist: toOff.length(),
  };
}

const viewDist = (radius, pad, minDist) => {
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const half = Math.min(halfV, Math.atan(Math.tan(halfV) * camera.aspect)); // na výšku telefonu omezuje šířka
  return Math.max((radius * pad) / Math.sin(half), minDist);
};

// Natočí kameru na box, směr pohledu zachová.
function frameBox(box3, pad = 1.4, minDist = 0.12, dir = null) {
  const sphere = box3.getBoundingSphere(new THREE.Sphere());
  const dist = viewDist(sphere.radius, pad, minDist);
  dir = (dir || camera.position.clone().sub(controls.target)).clone().normalize();
  flyTo(sphere.center.clone().add(dir.multiplyScalar(dist)), sphere.center);
}

// ---------- nejlepší pohled ----------
// Zkusí směry kolem struktury a vybere ten, odkud ji ostatní kosti nejméně zakrývají; mírně preferuje `prefer`.
const FRONT = new THREE.Vector3(0, 0.15, 1).normalize();
const CANDIDATE_DIRS = [];
for (const el of [0.15, 0.65, -0.45]) {
  for (let a = 0; a < 8; a++) {
    const az = (a / 8) * Math.PI * 2;
    CANDIDATE_DIRS.push(new THREE.Vector3(Math.sin(az), el, Math.cos(az)).normalize());
  }
}
const toSet = (x) => (x instanceof Set ? x : new Set(x));
const rc = new THREE.Raycaster();

function samplePoints(targets, center, max = 48) {
  const all = [];
  for (const m of targets.meshes) {
    m.updateMatrixWorld();
    const part = m.geometry.attributes.part.array;
    for (let i = 0; i < part.length; i++) if (targets.code == null || part[i] === targets.code) all.push([m, i]);
  }
  const step = Math.max(1, Math.floor(all.length / max));
  // body kousek dovnitř, aby paprsek netrefil jen hranu
  return all.filter((_, k) => k % step === 0).slice(0, max).map(([m, i]) =>
    new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position, i).applyMatrix4(m.matrixWorld).lerp(center, 0.05));
}

function visibleShare(targets, pts, eye) {
  const pool = meshes.filter((m) => m.visible);
  let ok = 0;
  for (const p of pts) {
    const to = p.clone().sub(eye);
    const len = to.length();
    rc.set(eye, to.divideScalar(len));
    rc.far = len + 0.01;
    const hit = rc.intersectObjects(pool, false)[0];
    if (hit && targets.meshes.has(hit.object) && (targets.code == null || hit.object.geometry.attributes.part.array[hit.face.a] === targets.code)) ok++;
  }
  return ok / pts.length;
}

function bestDir(targets, focus, dist, prefer) {
  const pts = samplePoints(targets, focus);
  let best = prefer;
  let bestScore = -Infinity;
  for (const d of [prefer, ...CANDIDATE_DIRS]) {
    const score = visibleShare(targets, pts, focus.clone().addScaledVector(d, dist)) + 0.25 * d.dot(prefer);
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

// Šipka ukazuje na vybranou strukturu; kreslí se přes kosti.
const arrowMat = new THREE.MeshBasicMaterial({ color: '#2F6F73', depthTest: false, transparent: true, opacity: 0.95 });
const arrow = new THREE.Group();
arrow.add(
  new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 16).rotateX(Math.PI).translate(0, 0.2, 0), arrowMat),
  new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 10).translate(0, 0.7, 0), arrowMat),
);
arrow.children.forEach((c) => { c.renderOrder = 10; });
arrow.visible = false;
scene.add(arrow);
function hideArrow() { arrow.visible = false; requestRender(); }

// Kamera na strukturu z nejlepšího směru. `box` = co má být celé vidět (u části celá kost),
// `lift` posune strukturu nad kartu / panel odpovědí ve spodní části obrazovky.
function frameOn(targets, { box = null, pad = 1.6, minDist = 0.3, prefer = FRONT, lift = 0.2 } = {}) {
  const t = { meshes: toSet(targets.meshes), code: targets.code };
  const focusBox = boxOf(t);
  const focus = focusBox.getCenter(new THREE.Vector3());
  const sphere = (box || focusBox).getBoundingSphere(new THREE.Sphere());
  const dist = viewDist(sphere.radius, pad, minDist);
  const dir = bestDir(t, focus, dist, prefer.clone().normalize());
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const center = sphere.center.clone().addScaledVector(up, -lift * viewH);
  flyTo(center.clone().addScaledVector(dir, dist), center);
  // šipka shora (na obrazovce) míří na střed struktury
  const r = focusBox.getBoundingSphere(new THREE.Sphere()).radius;
  arrow.position.copy(focus).addScaledVector(up, Math.min(r * 0.6, viewH * 0.05));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  arrow.scale.setScalar(viewH * 0.07);
  arrow.visible = true;
  requestRender();
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
  hideArrow();
  if (state.mode === 'isolate' && mode !== 'isolate') endIsolate(false);
  state.mode = mode;
  tint.hover = null;
  if (mode !== 'quiz') tint.quiz = null;
  if (mode === 'explore') {
    show('explore');
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
function openCard(t, { quiz: inQuiz = false } = {}) {
  state.card = t;
  tint.select = { meshes: t.meshes, code: t.code };
  paintAll();
  if (state.mode === 'explore') {
    const box = t.code == null ? null : boxOf({ meshes: [t.mesh], code: null });
    const prefer = camera.position.clone().sub(controls.target); // zůstaň na straně, odkud uživatel ťukl
    frameOn({ meshes: t.meshes, code: t.code }, { box, pad: 1.5, minDist: 0.35, prefer, lift: 0.2 });
  }
  $('cardBadge').hidden = !inQuiz;
  $('cardClose').hidden = inQuiz;
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
  $('cardAction').textContent = inQuiz ? 'Další' : 'Izolovat kost';
  $('cardAction').hidden = state.mode === 'isolate';
  const card = $('card');
  card.hidden = false;
  card.classList.remove('slide-in');
  void card.offsetWidth;
  card.classList.add('slide-in');
}
function closeCard() {
  $('card').hidden = true;
  if (state.mode !== 'quiz') hideArrow();
  if (state.card) { state.card = null; tint.select = null; paintAll(); }
}
$('cardClose').addEventListener('click', closeCard);

// ---------- izolace ----------
$('cardAction').addEventListener('click', () => {
  if (state.mode === 'quiz') { closeCard(); nextQuestion(); return; }
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
  $('exploreBack').textContent = '‹ Zpět na kostru';
  hideArrow();
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
  $('answerPanel').hidden = false;
  if (difficulty === 'easy') renderOptions();
  else {
    $('hardInput').value = '';
    $('hardInput').disabled = false;
    $('hardSubmit').disabled = true;
    $('hardForm').hidden = false;
  }
}

// V testu je vždy celá kostra; kamera se natočí tak, aby zvýrazněná struktura byla vidět (u části i celá kost).
function frameQuiz(item) {
  const t = quizTargets(item);
  frameOn(t, { box: boxOf({ meshes: t.meshes, code: null }), pad: 1.6, minDist: 0.6, lift: 0.18 });
}

// Po správné odpovědi: karta jako v Prozkoumat (latinsky, česky, nadřazená struktura, zajímavost) + „Další“.
function showQuizCard() {
  const t = quizTargets(quiz.item);
  $('answerPanel').hidden = true;
  openCard({ item: quiz.item, mesh: t.meshes[0], meshes: new Set(t.meshes), code: t.code }, { quiz: true });
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
    setTimeout(() => { if (state.mode === 'quiz') showQuizCard(); }, difficulty === 'easy' ? 400 : 0);
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
  showQuizCard();
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
