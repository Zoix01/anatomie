// Načte skutečnou kostru (model/skeleton.glb, postavenou tools/build-model.mjs).
// Každá kost je samostatný mesh; metadata z glTF „extras“ se přenesou do mesh.userData.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ITEMS } from './data.js?v=7';

export const PART_IDS = ITEMS.filter((it) => it.kind === 'part').map((it) => it.id);
const PART_CODE = Object.fromEntries(PART_IDS.map((id, i) => [id, i]));
export const MODEL_URL = 'model/skeleton.glb?v=7';

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

export async function loadSkeleton(scene, onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL, (e) => { if (e.total) onProgress?.(e.loaded / e.total); });
  const meshes = [];
  const sources = [];
  gltf.scene.traverse((o) => { if (o.isMesh) sources.push(o); });
  for (const src of sources) {
    const x = src.userData || {};
    const geo = bakeToWorld(src);
    const n = geo.attributes.position.count;
    // část kosti na vrcholech (index do PART_IDS, −1 = žádná); kost hrudní je ze tří těles = rovnou části
    const part = new Float32Array(n).fill(x.part ? PART_CODE[x.part] : -1);
    geo.setAttribute('part', new THREE.BufferAttribute(part, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = src.name;
    mesh.userData = {
      item: x.item,
      groups: x.groups || [],
      side: x.side,
      decor: x.decor || null,
      isRib: !!x.rib,
      isVertebra: !!x.vertebra,
      hasParts: !!x.part,
    };
    if (x.decor) {
      mat.vertexColors = false;
      mat.color.set(x.decor === 'teeth' ? '#F4EFE3' : '#C9D2D6');
      if (x.decor === 'cartilage') { mat.transparent = true; mat.opacity = 0.75; }
    }
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
