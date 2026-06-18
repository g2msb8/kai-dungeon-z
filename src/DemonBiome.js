// ステージ7「魔界バイオーム」の環境。
import * as THREE from 'three';
import { STAGE7 } from './core/Constants.js';

function rand(a, b) { return a + Math.random() * (b - a); }

export function buildDemonBiome(scene) {
  const group = new THREE.Group();

  // 暗い地面（赤黒）
  const gnd = new THREE.MeshStandardMaterial({ color: 0x1a0010, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE7.RADIUS + 8, 60), gnd);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 地面の模様（暗い赤・紫のパッチ）
  const patchMat1 = new THREE.MeshStandardMaterial({ color: 0x2a0018, roughness: 1 });
  const patchMat2 = new THREE.MeshStandardMaterial({ color: 0x1e000e, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const r = Math.random() * STAGE7.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const sz = 1.5 + Math.random() * 4;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), Math.random() > 0.5 ? patchMat1 : patchMat2);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(patch);
  }

  // 骸骨の障害物
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xe0d8b8, roughness: 0.85, metalness: 0.0,
    emissive: 0x111100, emissiveIntensity: 0.08,
  });
  for (let i = 0; i < 18; i++) {
    const r = 4 + Math.random() * (STAGE7.RADIUS - 5);
    const a = Math.random() * Math.PI * 2;
    const skel = makeSkeleton(boneMat);
    skel.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(skel);
  }

  // 暗い炎のような縦長の石柱
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x2a0020, roughness: 0.9, metalness: 0,
    emissive: 0x330008, emissiveIntensity: 0.5,
  });
  for (let i = 0; i < 10; i++) {
    const r = 6 + Math.random() * (STAGE7.RADIUS - 6);
    const a = Math.random() * Math.PI * 2;
    const h = 1.5 + Math.random() * 2.5;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), pillarMat);
    pillar.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r);
    pillar.rotation.y = Math.random() * Math.PI;
    pillar.castShadow = true;
    group.add(pillar);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x0e0010, 10, STAGE7.RADIUS + 6);
  scene.background = new THREE.Color(0x120018);

  return { group, bounds: { radius: STAGE7.RADIUS } };
}

function makeSkeleton(mat) {
  const g = new THREE.Group();

  // 頭蓋骨
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), mat);
  skull.position.set(0, 1.68, 0);
  skull.castShadow = true;
  g.add(skull);

  // 顎
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.18), mat);
  jaw.position.set(0, 1.50, 0.02);
  g.add(jaw);

  // 胴体（肋骨風）
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.45, 0.12), mat);
  torso.position.set(0, 1.22, 0);
  torso.castShadow = true;
  g.add(torso);

  for (let row = 0; row < 3; row++) {
    for (const sx of [-0.14, 0.14]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), mat);
      rib.position.set(sx, 1.38 - row * 0.14, 0);
      g.add(rib);
    }
  }

  // 骨盤
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.10), mat);
  pelvis.position.set(0, 0.95, 0);
  g.add(pelvis);

  // 大腿骨・脛骨
  for (const sx of [-0.08, 0.08]) {
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 5), mat);
    femur.position.set(sx, 0.70, 0);
    g.add(femur);
    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5), mat);
    tibia.position.set(sx, 0.32, 0);
    g.add(tibia);
  }

  // 上腕・前腕
  for (const sx of [-0.16, 0.16]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 5), mat);
    upper.position.set(sx, 1.22, 0);
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 5), mat);
    lower.position.set(sx, 0.88, 0);
    g.add(lower);
  }

  // ランダムに倒れている・傾いている
  g.rotation.y = rand(0, Math.PI * 2);
  g.rotation.z = rand(-0.5, 0.5);
  g.rotation.x = rand(-0.3, 0.15);
  return g;
}
