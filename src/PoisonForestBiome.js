// ステージ10「毒の森ステージ」の環境。
import * as THREE from 'three';
import { STAGE10 } from './core/Constants.js';

function rand(a, b) { return a + Math.random() * (b - a); }

export function buildPoisonForestBiome(scene) {
  const group = new THREE.Group();
  const R = STAGE10.RADIUS;

  // 毒々しい地面（暗い緑＋紫）
  const gM = new THREE.MeshStandardMaterial({ color: 0x21381f, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 8, 64), gM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 毒沼のパッチ（光る紫）
  const poison = new THREE.MeshStandardMaterial({ color: 0x7b2fb0, roughness: 0.6, emissive: 0x4a0080, emissiveIntensity: 0.5 });
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * R;
    const sz = 1.0 + Math.random() * 2.5;
    const m = new THREE.Mesh(new THREE.CircleGeometry(sz, 8), poison);
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.sin(a) * r, 0.012, Math.cos(a) * r);
    group.add(m);
  }

  // 枯れ木（暗い幹＋紫の葉）
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.95 });
  const leafM  = new THREE.MeshStandardMaterial({ color: 0x6a1f99, roughness: 0.85, emissive: 0x33004d, emissiveIntensity: 0.4 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (R - 4);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const hgt = 2.5 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, hgt, 6), trunkM);
    trunk.position.set(x, hgt / 2, z);
    trunk.castShadow = true;
    group.add(trunk);
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.6, 0), leafM);
    blob.position.set(x, hgt + 0.3, z);
    blob.castShadow = true;
    group.add(blob);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x241a33, 14, R + 8);
  scene.background = new THREE.Color(0x1d142b);
  return { group, bounds: { radius: R } };
}
