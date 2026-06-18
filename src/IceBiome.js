// ステージ5「氷のバイオーム」の環境。
import * as THREE from 'three';
import { STAGE5 } from './core/Constants.js';

function rand(a, b) { return a + Math.random() * (b - a); }

export function buildIceBiome(scene) {
  const group = new THREE.Group();

  // 雪の地面（白/薄青）
  const gnd = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE5.RADIUS + 8, 60), gnd);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 雪のパッチ（色むら）
  const snowMat1 = new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.9 });
  const snowMat2 = new THREE.MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.9 });
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * STAGE5.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const sz = 1.0 + Math.random() * 3.5;
    const m = Math.random() > 0.5 ? snowMat1 : snowMat2;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), m);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(patch);
  }

  // 大きい氷の破片（障害物）
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x88ccee, roughness: 0.05, metalness: 0.15,
    transparent: true, opacity: 0.82,
  });
  const iceMat2 = new THREE.MeshStandardMaterial({
    color: 0xaaddff, roughness: 0.10, metalness: 0.10,
    transparent: true, opacity: 0.75,
  });

  for (let i = 0; i < 22; i++) {
    const r = 5 + Math.random() * (STAGE5.RADIUS - 5);
    const a = Math.random() * Math.PI * 2;
    const chunk = makeIceChunk(Math.random() > 0.45 ? iceMat : iceMat2);
    chunk.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(chunk);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0xc0deff, 18, STAGE5.RADIUS + 12);
  scene.background = new THREE.Color(0xb0d0f8);

  return { group, bounds: { radius: STAGE5.RADIUS } };
}

function makeIceChunk(mat) {
  const g = new THREE.Group();
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const s = 0.5 + Math.random() * 1.0;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    mesh.scale.set(rand(0.6, 1.3), rand(1.5, 3.5), rand(0.6, 1.3));
    mesh.position.set(rand(-0.5, 0.5), s * 0.8, rand(-0.5, 0.5));
    mesh.rotation.set(rand(-0.25, 0.25), rand(0, Math.PI * 2), rand(-0.25, 0.25));
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
