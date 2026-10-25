// Načte skutečnou kostru (model/skeleton.glb, postavenou tools/build-model.mjs).
// Každá kost je samostatný mesh; metadata z glTF „extras“ se přenesou do mesh.userData.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ITEMS } from './data.js?v=8';

export const PART_IDS = ITEMS.filter((it) => it.kind === 'part').map((it) => it.id);
const PART_CODE = Object.fromEntries(PART_IDS.map((id, i) => [id, i]));
const MODEL_VERSION = 8;
export const MODEL_URL = `model/skeleton.glb?v=${MODEL_VERSION}`;
const CARTILAGE = new THREE.Color('#F2EBDB');

// Komprimované pozice (Int16 + měřítko v uzlu) převedeme na obyčejné souřadnice ve světě,
// aby raycasting, rámování kamery a barvení pracovaly s jednou soustavou.
function bakeToWorld(mesh) {
  const geo = mesh.geometry.clone();
  for (const name of ['position', 'normal']) {
    const a = geo.getAttribute(name);
    if (!a) continue;
    const arr = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { arr[i * 3] = a.getX(i); arr[i * 3 + 1] = a.getY(i); arr[i * 3 + 2] = a.getZ(i); }
    geo.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  mesh.updateWorldMatrix(true, false);
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// Geometrie z glTF uzlu + atributy, se kterými aplikace počítá (část kosti, barva vrcholů).
function prepare(src) {
  const x = src.userData || {};
  const geo = bakeToWorld(src);
  const n = geo.attributes.position.count;
  // část kosti na vrcholech (index do PART_IDS, −1 = žádná); kost hrudní je ze tří těles = rovnou části
  geo.setAttribute('part', new THREE.BufferAttribute(new Float32Array(n).fill(x.part ? PART_CODE[x.part] : -1), 1));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return geo;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadSkeleton(scene, onProgress) {
  const gltf = await loader.loadAsync(MODEL_URL, (e) => { if (e.total) onProgress?.(e.loaded / e.total); });
  const meshes = [];
  const sources = [];
  gltf.scene.traverse((o) => { if (o.isMesh) sources.push(o); });
  for (const src of sources) {
    const x = src.userData || {};
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    const mesh = new THREE.Mesh(prepare(src), mat);
    mesh.name = src.name;
    mesh.userData = {
      fma: x.fma,
      item: x.item,
      groups: x.groups || [],
      side: x.side,
      decor: x.decor || null,
      extra: !!x.extra,
      ribOf: x.ribOf || null, // chrupavka: FMA svého žebra
      ribGroup: x.ribGroup || null, // společná chrupavka 8.–10. žebra
      isRib: !!x.rib,
      isVertebra: !!x.vertebra,
      hasParts: !!x.part,
    };
    if (x.decor === 'teeth') {
      mat.vertexColors = false;
      mat.color.set('#F4EFE3');
    } else if (x.decor === 'cartilage') {
      mesh.userData.base = CARTILAGE; // o odstín světlejší než kost, ať je vidět, kde žebro končí
    }
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

// Kost v plném rozlišení (model/detail/<FMA>.glb) pro izolaci; null, když soubor není.
const detailCache = new Map();
export function loadDetail(fma) {
  if (!detailCache.has(fma)) {
    detailCache.set(fma, loader.loadAsync(`model/detail/${fma}.glb?v=${MODEL_VERSION}`).then((gltf) => {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh) src = o; });
      return src && prepare(src);
    }).catch(() => null));
  }
  return detailCache.get(fma);
}
