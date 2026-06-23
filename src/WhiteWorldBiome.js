// ステージ12「真っ白い世界」の環境。
import * as THREE from 'three';
import { STAGE12 } from './core/Constants.js';

export function buildWhiteWorldBiome(scene) {
  const group = new THREE.Group();
  const R = STAGE12.RADIUS;

  // 真っ白な地面
  const gM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xf2f2f2, emissiveIntensity: 0.2 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 10, 64), gM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ごく薄いグレーの起伏（白の中で奥行きが分かる程度）
  const softM = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.95 });
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * R;
    const sz = 1.5 + Math.random() * 3.5;
    const m = new THREE.Mesh(new THREE.CircleGeometry(sz, 8), softM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(m);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0xffffff, 20, R + 16);
  scene.background = new THREE.Color(0xffffff);
  return { group, bounds: { radius: R } };
}
