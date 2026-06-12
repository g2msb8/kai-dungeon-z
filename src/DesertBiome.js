// ステージ4「砂漠バイオーム」の環境。
import * as THREE from 'three';
import { STAGE4 } from './core/Constants.js';

export function buildDesertBiome(scene) {
  const group = new THREE.Group();

  // 砂地の地面
  const gnd = new THREE.MeshStandardMaterial({ color: 0xd4a84b, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE4.RADIUS + 8, 60), gnd);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 砂のパッチ（色むら）
  const sandMat1 = new THREE.MeshStandardMaterial({ color: 0xc49040, roughness: 1 });
  const sandMat2 = new THREE.MeshStandardMaterial({ color: 0xe0b860, roughness: 1 });
  for (let i = 0; i < 50; i++) {
    const r = Math.random() * STAGE4.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const sz = 1.2 + Math.random() * 3.5;
    const m = Math.random() > 0.5 ? sandMat1 : sandMat2;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), m);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(patch);
  }

  // 砂漠の岩・ボルダー 30 個
  const rockMat1 = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.95, metalness: 0 });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0xa07040, roughness: 0.95, metalness: 0 });

  for (let i = 0; i < 30; i++) {
    const r = 3 + Math.random() * STAGE4.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const b = makeDesertBoulder(rockMat1, rockMat2);
    b.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(b);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0xd4a060, 15, STAGE4.RADIUS + 10);
  scene.background = new THREE.Color(0xc8a050);

  return { group, bounds: { radius: STAGE4.RADIUS } };
}

function makeDesertBoulder(mat1, mat2) {
  const b = new THREE.Group();
  const count = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const s = 0.20 + Math.random() * 0.80;
    const m = Math.random() > 0.4 ? mat1 : mat2;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), m);
    rock.scale.set(rand(0.7, 1.5), rand(0.35, 0.85), rand(0.8, 1.5));
    rock.position.set(rand(-0.50, 0.50), s * 0.32, rand(-0.50, 0.50));
    rock.rotation.set(rand(0, 0.5), rand(0, Math.PI * 2), rand(0, 0.3));
    rock.castShadow = true;
    b.add(rock);
  }
  return b;
}

function rand(a, b) { return a + Math.random() * (b - a); }
