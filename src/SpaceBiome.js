// ステージ9「宇宙ステージ」の環境。
import * as THREE from 'three';
import { STAGE9 } from './core/Constants.js';

export function buildSpaceBiome(scene) {
  const group = new THREE.Group();
  const R = STAGE9.RADIUS;

  // 暗い床（宇宙の足場）
  const floorM = new THREE.MeshStandardMaterial({ color: 0x16142a, roughness: 0.7, metalness: 0.3 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 8, 64), floorM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 星（小さな白い点を散りばめる）
  const starM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * (R + 22);
    const h = 2 + Math.random() * 26;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 4, 4), starM);
    s.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
    group.add(s);
  }

  // 惑星（色つきの球）
  const planetColors = [0xff7043, 0x42a5f5, 0xab47bc, 0xffca28, 0x26a69a];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = R - 4 + Math.random() * 6;
    const rad = 1.5 + Math.random() * 2.5;
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(rad, 16, 12),
      new THREE.MeshStandardMaterial({ color: planetColors[i % planetColors.length], roughness: 0.8, emissive: 0x111133, emissiveIntensity: 0.3 }),
    );
    p.position.set(Math.sin(a) * r, 3 + Math.random() * 8, Math.cos(a) * r);
    group.add(p);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x05030f, 30, R + 26);
  scene.background = new THREE.Color(0x05030f);
  return { group, bounds: { radius: R } };
}
