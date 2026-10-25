import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ITEMS, BY_ID, GENERIC_PARENT } from './data.js?v=8';
import { loadSkeleton, loadDetail, PART_IDS } from './model.js?v=8';
import { isMatch } from './match.js?v=8';
import { pickDistractors } from './quiz.js?v=8';

const COLORS = {
  bone: new THREE.Color('#EBE2CC'),
  hover: new THREE.Color('#E2B59A'),
  select: new THREE.Color('#B77466'),
  accent: new THREE.Color('#B77466'),
};
// Jemné pískové a béžové tóny: části se odliší, ale kost zůstane klidná.
const PART_PALETTE = ['#D9C49C', '#B7B09E', '#D6B19A', '#C2B48F', '#CFC6B1', '#C7A88C', '#ADA48A'].map((c) => new THREE.Color(c));
// Kolik barvy zvýraznění se přimíchá do podkladu (0 = nic, 1 = plná barva).
const MIX = { hover: 0.5, select: 0.6, quiz: 0.85 };
// Malé části jdou ťuknout jen v izolované kosti.
const SMALL_PARTS = new Set(['incisura_radialis', 'incisura_trochlearis', 'canalis_caroticus']);
const PART_CODE = Object.fromEntries(PART_IDS.map((id, i) => [id, i]));
const $ = (id) => document.getElementById(id);

// ---------- 3D scéna ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // pozadí = CSS přechod pod plátnem
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
scene.add(new THREE.HemisphereLight(0xfff4e2, 0xb39d84, 1.7)); // teplé světlo, ať kosti nešednou
const sun = new THREE.DirectionalLight(0xfff1dc, 1.3);
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

// Kostra se načítá na pozadí hned po otevření stránky; výchozí pohled se spočítá z jejích rozměrů.
const meshes = [];
const DEFAULT_VIEW = { pos: new THREE.Vector3(0, 0.9, 2.7), target: new THREE.Vector3(0, 0.86, 0) };
const skeletonBox = new THREE.Box3();
camera.position.copy(DEFAULT_VIEW.pos);
controls.target.copy(DEFAULT_VIEW.target);

// Výchozí pohled zepředu na celou kostru; počítá se znovu, protože se mohl změnit poměr stran okna.
function updateDefaultView() {
  if (skeletonBox.isEmpty()) return;
  const dir = new THREE.Vector3(0, 0.03, 1).normalize();
  skeletonBox.getCenter(DEFAULT_VIEW.target);
  DEFAULT_VIEW.pos.copy(DEFAULT_VIEW.target).addScaledVector(dir, fitDist(skeletonBox, dir, 1.04, 0.5));
}
const pickable = () => meshes.filter((m) => m.visible && !m.userData.decor);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (state.mode === 'home') homeView();
  requestRender();
}
window.addEventListener('resize', resize);

let needsRender = true;
function requestRender() { needsRender = true; }
controls.addEventListener('change', () => { requestRender(); updatePartVisibility(); });

let camAnim = null;
let lastT = null;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = lastT == null ? 0 : Math.min(0.1, (t - lastT) / 1000); // s; otáčení na úvodu nezávisí na snímkové frekvenci
  lastT = t;
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
  if (controls.update(dt)) needsRender = true;
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

// Osy obrazovky pro pohled ve směru `dir` (od cíle ke kameře): vpravo a nahoru.
function viewAxes(dir) {
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y);
  if (up.lengthSq() < 1e-6) up.set(0, 0, -1);
  up.normalize();
  return { up, right: new THREE.Vector3().crossVectors(up, dir).normalize() };
}

// Vzdálenost, ze které jsou všechny body (relativně ke středu `c`) vidět ve směru `dir`.
function fitPoints(points, c, dir, pad, minDist) {
  const { up, right } = viewAxes(dir);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  const p = new THREE.Vector3();
  let dist = minDist;
  for (const q of points) {
    p.copy(q).sub(c);
    const z = p.dot(dir);
    dist = Math.max(dist, z + (Math.abs(p.dot(right)) * pad) / tanH, z + (Math.abs(p.dot(up)) * pad) / tanV);
  }
  return dist;
}

// Vzdálenost, ze které je celý box vidět ve směru `dir` (promítnou se všechny rohy, ne obalová koule).
function fitDist(box3, dir, pad = 1.1, minDist = 0.12) {
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z));
  return fitPoints(corners, box3.getCenter(new THREE.Vector3()), dir, pad, minDist);
}

// Izolovaná kost: rámuje se podle bodů povrchu, ne podle rohů boxu (ty by šikmo kost zbytečně zmenšily).
function frameMeshes(list, pad, minDist, dir) {
  dir = dir.clone().normalize();
  const { up, right } = viewAxes(dir);
  const pts = [];
  for (const m of list) {
    const a = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(a.count / 2000));
    for (let i = 0; i < a.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(a, i)); // geometrie je už ve světě
  }
  // střed podle rozsahu na obrazovce, ať kost není posunutá ke kraji
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const q of pts) {
    [q.dot(right), q.dot(up), q.dot(dir)].forEach((v, k) => { lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); });
  }
  const c = new THREE.Vector3().addScaledVector(right, (lo[0] + hi[0]) / 2).addScaledVector(up, (lo[1] + hi[1]) / 2).addScaledVector(dir, (lo[2] + hi[2]) / 2);
  flyTo(c.clone().addScaledVector(dir, fitPoints(pts, c, dir, pad, minDist)), c);
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

function samplePoints(targets, center, max = 24) {
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
const arrowMat = new THREE.MeshBasicMaterial({ color: '#8F5446', depthTest: false, transparent: true, opacity: 0.95 });
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
// Kde na obrazovce leží karta / panel, aby je struktura nezakryla. Na širokém displeji je karta vpravo.
const isWide = () => window.innerWidth >= 900;
function overlayOffset(kind) {
  if (isWide()) return kind === 'card' ? { lift: 0, shift: 0.16 } : { lift: 0.1, shift: 0 };
  return { lift: kind === 'card' ? 0.2 : 0.16, shift: 0 };
}

// `arrowAt` = kam míří šipka (u párových kostí jen na jednu stranu, ne doprostřed mezi ně).
function frameOn(targets, { box = null, pad = 1.6, minDist = 0.3, prefer = FRONT, lift = 0.2, shift = 0, arrowAt = null } = {}) {
  const t = { meshes: toSet(targets.meshes), code: targets.code };
  const focusBox = boxOf(t);
  const focus = focusBox.getCenter(new THREE.Vector3());
  const sphere = (box || focusBox).getBoundingSphere(new THREE.Sphere());
  const dist = viewDist(sphere.radius, pad, minDist);
  const dir = bestDir(t, focus, dist, prefer.clone().normalize());
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const right = new THREE.Vector3().crossVectors(up, dir).normalize();
  const center = sphere.center.clone().addScaledVector(up, -lift * viewH).addScaledVector(right, shift * viewH * camera.aspect);
  flyTo(center.clone().addScaledVector(dir, dist), center);
  // šipka shora (na obrazovce) míří na střed struktury
  const arrowBox = arrowAt ? boxOf({ meshes: arrowAt, code: t.code }) : focusBox;
  const r = arrowBox.getBoundingSphere(new THREE.Sphere()).radius;
  arrow.position.copy(arrowBox.getCenter(new THREE.Vector3())).addScaledVector(up, Math.min(r * 0.6, viewH * 0.05));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  arrow.scale.setScalar(viewH * 0.07);
  arrow.visible = true;
  requestRender();
}

// ---------- členství a cíle ----------
// Žebro patří dohromady se svou chrupavkou (costa = os costale + cartilago costalis).
function cartilagesOf(ribs) {
  return meshes.filter((c) => c.userData.decor === 'cartilage' && ribs.some((r) => r.userData.side === c.userData.side
    && (c.userData.ribOf ? c.userData.ribOf === r.userData.fma : r.userData.item === c.userData.ribGroup)));
}
function membersOf(id) {
  const ms = meshes.filter((m) => m.userData.item === id || m.userData.groups.includes(id));
  const ribs = ms.filter((m) => m.userData.isRib);
  return ribs.length ? ms.concat(cartilagesOf(ribs)) : ms;
}
// Jedna strana párové struktury (pro šipku): pravá, nebo strana, na kterou uživatel ťukl.
const oneSide = (list, side = 'R') => (list.some((m) => m.userData.side) ? list.filter((m) => !m.userData.side || m.userData.side === side) : list);

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

// Pro test: párové struktury na obou stranách, části obratlů/žeber na všech.
function quizTargets(item) {
  if (item.kind !== 'part') return { meshes: membersOf(item.id), code: null };
  const code = PART_CODE[item.id];
  if (item.parent === 'vertebra') return { meshes: meshes.filter((m) => m.userData.isVertebra), code };
  if (item.parent === 'costa') return { meshes: meshes.filter((m) => m.userData.isRib), code };
  return { meshes: membersOf(item.parent), code };
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
  // Když je něco vybrané, barevné části má jen vybraná kost; ostatní jsou jednobarevné.
  const showParts = partsShown.has(mesh) && (!tint.select || tint.select.meshes.has(mesh));
  const layers = [
    tint.quiz && { ...tint.quiz, c: COLORS.accent, k: MIX.quiz },
    tint.select && { ...tint.select, c: COLORS.select, k: MIX.select },
    tint.hover && { ...tint.hover, c: COLORS.hover, k: MIX.hover },
  ].filter((l) => l && l.meshes.has(mesh));
  const c = new THREE.Color();
  for (let i = 0; i < part.length; i++) {
    const code = part[i];
    c.copy(showParts && code >= 0 ? partColor(mesh, code) : mesh.userData.base || COLORS.bone);
    for (const l of layers) if (l.code == null || l.code === code) { c.lerp(l.c, l.k); break; }
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
  // zuby se neťukají (paprsek projde k čelisti za nimi)
  const hit = raycaster.intersectObjects(meshes.filter((m) => m.visible), false).find((h) => h.object.userData.decor !== 'teeth');
  if (!hit) return null;
  let mesh = hit.object;
  let code = mesh.geometry.attributes.part.array[hit.face.a];
  if (mesh.userData.decor === 'cartilage') {
    // chrupavka vybere své žebro
    const c = mesh.userData;
    mesh = meshes.find((r) => r.userData.isRib && r.userData.side === c.side && (c.ribOf ? r.userData.fma === c.ribOf : r.userData.item === c.ribGroup));
    code = -1;
  }
  // Párové kosti svítí na obou stranách; v izolaci jen to, co je vidět.
  const visibleMembers = (id) => membersOf(id).filter((m) => m.visible);
  if (code >= 0 && partsShown.has(mesh)) {
    const id = PART_IDS[code];
    const set = mesh.userData.isRib || mesh.userData.isVertebra ? [mesh] : visibleMembers(mesh.userData.item);
    if (state.mode === 'isolate' || !SMALL_PARTS.has(id)) return { item: BY_ID[id], mesh, meshes: new Set(set), code };
  }
  const item = BY_ID[mesh.userData.item];
  return { item, mesh, meshes: new Set(visibleMembers(item.id)), code: null };
}

const sameTarget = (a, b) => a && b && a.item === b.item && a.mesh === b.mesh;
function setHover(t) {
  stage.classList.toggle('pointing', !!t);
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

// ---------- úvod: kostra se pomalu otáčí nad nadpisem ----------
function homeView() {
  if (skeletonBox.isEmpty()) return;
  const dir = new THREE.Vector3(0, 0.08, 1).normalize();
  const dist = fitDist(skeletonBox, dir, 1.7, 0.5);
  // kostra v horní části obrazovky, dole zůstane místo na nadpis a tlačítka
  const c = skeletonBox.getCenter(new THREE.Vector3());
  c.y -= 0.36 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(dir, dist);
  camAnim = null;
  requestRender();
}
function setHomeSpin(on) {
  controls.autoRotate = on;
  controls.autoRotateSpeed = 1; // jedna otáčka za minutu
  controls.enabled = !on;
}

function go(mode) {
  closeCard();
  hideArrow();
  if (state.mode === 'isolate' && mode !== 'isolate') endIsolate(false);
  state.mode = mode;
  setHomeSpin(mode === 'home');
  if (mode === 'home') homeView();
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
  if (to === 'explore') whenLoaded(() => { resetCamera(true); go('explore'); });
  else go(to);
}));

$('exploreBack').addEventListener('click', () => {
  if (state.mode === 'isolate') return endIsolate(true);
  if (state.returnTo === 'results') { go('results'); return; }
  go('home');
});

function resetCamera(instant = false) {
  if (state.mode === 'isolate' && state.isolated) return frameMeshes(state.isolated, 1.12, 0.12, ISO_DIR);
  updateDefaultView();
  if (instant) { camera.position.copy(DEFAULT_VIEW.pos); controls.target.copy(DEFAULT_VIEW.target); camAnim = null; requestRender(); }
  else flyTo(DEFAULT_VIEW.pos, DEFAULT_VIEW.target);
}
$('resetView').addEventListener('click', () => resetCamera());

// ---------- karta ----------
// quiz: 'right' | 'wrong' = karta po odpovědi v testu; yours = co uživatel napsal (Těžká, špatně).
function openCard(t, { quiz: result = null, yours = null } = {}) {
  const inQuiz = !!result;
  state.card = t;
  tint.select = { meshes: t.meshes, code: t.code };
  paintAll();
  if (state.mode === 'explore') {
    const box = t.code == null ? null : boxOf({ meshes: [t.mesh], code: null });
    const prefer = camera.position.clone().sub(controls.target); // zůstaň na straně, odkud uživatel ťukl
    frameOn({ meshes: t.meshes, code: t.code }, { box, pad: 2, minDist: 0.45, prefer, arrowAt: oneSide([...t.meshes], t.mesh.userData.side || 'R'), ...overlayOffset('card') });
  }
  const badge = $('cardBadge');
  badge.hidden = !inQuiz;
  badge.textContent = result === 'wrong' ? 'Špatně – správně je:' : 'Správně!';
  badge.classList.toggle('wrong', result === 'wrong');
  $('cardClose').hidden = inQuiz;
  const yoursEl = $('cardYours');
  yoursEl.innerHTML = '';
  if (yours) yoursEl.append('Tvoje odpověď: ', Object.assign(document.createElement('i'), { textContent: yours }));
  yoursEl.hidden = !yours;
  $('cardClaim').hidden = !yours;
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
  if (state.mode === 'quiz') {
    if (quiz.pendingWrong) { quiz.pendingWrong = false; quiz.answered += 1; quiz.wrong.push(quiz.item); }
    closeCard();
    nextQuestion();
    return;
  }
  const t = state.card;
  const it = t.item;
  const m = t.mesh;
  let iso;
  const base = it.kind === 'part' ? BY_ID[m.userData.item] : it;
  if (m.userData.isRib) iso = [m, ...cartilagesOf([m])];
  else if (m.userData.isVertebra) iso = [m];
  else iso = membersOf(base.id).filter((x) => x.userData.side === m.userData.side);
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
  frameMeshes(iso, 1.12, 0.12, ISO_DIR);
  // Kost v plném rozlišení se dotáhne na pozadí a vymění za zjednodušenou.
  const token = (state.isoToken = {});
  const todo = iso.filter((m) => !m.userData.decor);
  $('isoLoading').hidden = false;
  Promise.all(todo.map((m) => loadDetail(m.userData.fma))).then((geos) => {
    if (state.isoToken !== token) return;
    geos.forEach((g, i) => {
      if (!g) return;
      todo[i].userData.lowGeo = todo[i].geometry;
      todo[i].geometry = g;
    });
    $('isoLoading').hidden = true;
    paintAll();
  });
}

function endIsolate(toExplore) {
  state.isoToken = null;
  $('isoLoading').hidden = true;
  for (const m of state.isolated || []) {
    if (m.userData.lowGeo) { m.geometry = m.userData.lowGeo; delete m.userData.lowGeo; }
  }
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

$('startQuiz').addEventListener('click', () => whenLoaded(startQuiz));
function startQuiz() {
  Object.assign(quiz, { deck: [], n: 0, correct: 0, answered: 0, wrong: [] });
  state.mode = 'quiz';
  setHomeSpin(false);
  show('quiz');
  $('easyAnswers').hidden = difficulty !== 'easy';
  $('hardForm').hidden = difficulty !== 'hard';
  resetCamera(true);
  nextQuestion();
}

// V testu jen to, co model už umí ukázat (části kostí přibudou v M2).
function available(it) {
  if (it.noQuiz || it.extra) return false;
  if (it.kind !== 'part') return membersOf(it.id).length > 0;
  return meshes.some((m) => m.geometry.attributes.part.array.includes(PART_CODE[it.id]));
}

function nextQuestion() {
  if (!quiz.deck.length) quiz.deck = shuffle(ITEMS.filter(available));
  quiz.item = quiz.deck.pop();
  quiz.n += 1;
  quiz.locked = false;
  updateStatus();
  const t = quizTargets(quiz.item);
  tint.quiz = { meshes: new Set(t.meshes), code: t.code };
  paintAll();
  frameQuiz(quiz.item);
  $('answerPanel').hidden = false;
  if (difficulty === 'easy') renderOptions();
  else {
    $('hardInput').value = '';
    $('hardInput').disabled = false;
    $('hardSubmit').disabled = true;
    $('hardForm').hidden = false;
    if (matchMedia('(hover: hover)').matches) $('hardInput').focus(); // na telefonu by klávesnice zakryla kostru
  }
}

// V testu je vždy celá kostra; kamera se natočí tak, aby zvýrazněná struktura byla vidět (u části i celá kost).
function frameQuiz(item) {
  const t = quizTargets(item);
  frameOn(t, { box: boxOf({ meshes: t.meshes, code: null }), pad: 2.2, minDist: 0.7, arrowAt: oneSide(t.meshes), ...overlayOffset('quiz') });
}

// Po odpovědi (správné i špatné): karta jako v Prozkoumat (latinsky, česky, nadřazená struktura, zajímavost) + „Další“.
function showQuizCard(result, yours = null) {
  const t = quizTargets(quiz.item);
  $('answerPanel').hidden = true;
  openCard({ item: quiz.item, mesh: t.meshes[0], meshes: new Set(t.meshes), code: t.code }, { quiz: result, yours });
}

function updateStatus() {
  $('quizStatus').innerHTML = `Otázka ${quiz.n} · <b>${quiz.correct}</b> správně`;
}

const distractors = (item) => pickDistractors(item, { items: ITEMS, byId: BY_ID, isAvailable: available, shuffle });

function renderOptions() {
  const box = $('easyAnswers');
  box.innerHTML = '';
  box.classList.remove('locked');
  shuffle([quiz.item, ...distractors(quiz.item)]).forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.dataset.id = opt.id;
    b.append(Object.assign(document.createElement('span'), { className: 'key', textContent: i + 1 }), opt.la);
    b.addEventListener('click', () => {
      if (quiz.locked) return;
      quiz.locked = true;
      box.classList.add('locked');
      const right = opt === quiz.item;
      b.classList.add(right ? 'ok' : 'bad');
      if (!right) box.querySelector(`[data-id="${quiz.item.id}"]`).classList.add('ok');
      record(right);
    });
    box.append(b);
  });
}

$('hardInput').addEventListener('input', (e) => { $('hardSubmit').disabled = !e.target.value.trim(); });
$('hardForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = $('hardInput').value;
  if (!val.trim() || quiz.locked) return;
  quiz.locked = true;
  $('hardInput').disabled = true;
  if (isMatch(val, quiz.item)) return record(true);
  // Chyba se započítá až po „Další“; „Měl/a jsem pravdu“ ji změní na správnou odpověď.
  quiz.pendingWrong = true;
  showQuizCard('wrong', val.trim());
});

function record(right) {
  quiz.answered += 1;
  if (right) {
    quiz.correct += 1;
    updateStatus();
  } else {
    quiz.wrong.push(quiz.item);
  }
  // V Lehké chvilka na zelené/červené tlačítko, pak karta.
  setTimeout(() => { if (state.mode === 'quiz') showQuizCard(right ? 'right' : 'wrong'); }, difficulty === 'easy' ? 500 : 0);
}

$('cardClaim').addEventListener('click', () => {
  quiz.pendingWrong = false;
  quiz.answered += 1;
  quiz.correct += 1;
  updateStatus();
  closeCard();
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
  $('meterFill').style.width = `${pct}%`;
  const list = $('reviewList');
  list.innerHTML = '';
  const unique = [...new Set(quiz.wrong)];
  $('reviewLabel').textContent = unique.length ? 'Zopakuj si:' : 'Bez jediné chyby!';
  for (const it of unique) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const label = document.createElement('span');
    label.append(Object.assign(document.createElement('i'), { textContent: it.la }), ` – ${it.cz}`);
    b.append(label);
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

// ---------- načtení modelu ----------
let loaded = false;
let pending = null;
function whenLoaded(fn) {
  if (loaded) return fn();
  pending = fn;
  $('loading').hidden = false;
}
loadSkeleton(scene, (f) => { $('loadPct').textContent = Math.round(f * 100); })
  .then((list) => {
    meshes.push(...list);
    for (const m of meshes) skeletonBox.expandByObject(m);
    loaded = true;
    stage.classList.add('ready');
    if (state.mode === 'home') { homeView(); setHomeSpin(true); }
    $('loading').hidden = true;
    // Jen pro kontrolu modelu (?debug): přístup ke scéně z konzole / testů.
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __app: { THREE, camera, controls, meshes, requestRender, paintAll } });
    paintAll();
    if (pending) { const fn = pending; pending = null; fn(); }
  })
  .catch((err) => {
    console.error(err);
    $('loading').innerHTML = 'Kostru se nepodařilo načíst. <button class="btn" onclick="location.reload()">Zkusit znovu</button>';
    $('loading').hidden = false;
  });

resize();
requestAnimationFrame(loop);

// Klávesnice na počítači: 1–4 = odpověď, Enter = Další, Esc = zavřít kartu.
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
  const cardOpen = !$('card').hidden;
  if (state.mode === 'quiz' && cardOpen && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    $('cardAction').click();
  } else if (state.mode === 'quiz' && difficulty === 'easy' && /^[1-4]$/.test(e.key)) {
    $('easyAnswers').children[Number(e.key) - 1]?.click();
  } else if (e.key === 'Escape' && cardOpen && state.mode !== 'quiz') {
    closeCard();
  }
});
