// ステージ8「海ステージ」の環境。
import * as THREE from 'three';
import { STAGE8 } from './core/Constants.js';

function rand(a, b) { return a + Math.random() * (b - a); }

export function buildSeaBiome(scene) {
  const group = new THREE.Group();
  const R = STAGE8.RADIUS;

  // 海面（青）
  const water = new THREE.MeshStandardMaterial({ color: 0x1f6fb0, roughness: 0.3, metalness: 0.2 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 8, 64), water);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 波（明るい青のパッチ）
  const foam1 = new THREE.MeshStandardMaterial({ color: 0x3a9fd6, roughness: 0.35 });
  const foam2 = new THREE.MeshStandardMaterial({ color: 0x7fd3f0, roughness: 0.4 });
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * R;
    const sz = 1.0 + Math.random() * 3.0;
    const m = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), Math.random() > 0.5 ? foam1 : foam2);
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(m);
  }

  // 岩・サンゴ
  const rockM  = new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.95 });
  const coralM = new THREE.MeshStandardMaterial({ color: 0xff7088, roughness: 0.8 });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (R - 5);
    if (Math.random() > 0.5) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.8, 0), rockM);
      rock.position.set(Math.sin(a) * r, 0.3, Math.cos(a) * r);
      rock.castShadow = true;
      group.add(rock);
    } else {
      const coral = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 6), coralM);
      coral.position.set(Math.sin(a) * r, 0.7, Math.cos(a) * r);
      coral.castShadow = true;
      group.add(coral);
    }
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x2a82c0, 18, R + 14);
  scene.background = new THREE.Color(0x2a82c0);
  return { group, bounds: { radius: R } };
}
