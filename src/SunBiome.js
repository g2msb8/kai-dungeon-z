// ステージ11「太陽の中ステージ」の環境。
import * as THREE from 'three';
import { STAGE11 } from './core/Constants.js';

export function buildSunBiome(scene) {
  const group = new THREE.Group();
  const R = STAGE11.RADIUS;

  // 灼熱の地面（明るいオレンジ・発光）
  const gM = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.5, emissive: 0xff5200, emissiveIntensity: 0.6 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 8, 64), gM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 炎のゆらぎ（黄・白の明るいパッチ）
  const hot1 = new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0xffb000, emissiveIntensity: 0.9, roughness: 0.5 });
  const hot2 = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe080, emissiveIntensity: 1.0, roughness: 0.5 });
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * R;
    const sz = 1.0 + Math.random() * 3.0;
    const m = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), Math.random() > 0.5 ? hot1 : hot2);
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.sin(a) * r, 0.012, Math.cos(a) * r);
    group.add(m);
  }

  // 火柱（縦の炎）
  const flameM = new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff5500, emissiveIntensity: 1.2, roughness: 0.9, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (R - 6);
    const h = 1.5 + Math.random() * 2.5;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, h, 6), flameM);
    f.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r);
    group.add(f);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0xff7b1a, 16, R + 10);
  scene.background = new THREE.Color(0xff9a30);
  return { group, bounds: { radius: R } };
}
