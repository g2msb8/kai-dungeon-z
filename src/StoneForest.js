// ステージ2「石バイオーム」の環境。
import * as THREE from 'three';
import { STAGE2 } from './core/Constants.js';

export function buildStoneForest(scene) {
  const group = new THREE.Group();

  const gnd = new THREE.MeshStandardMaterial({ color: 0x4a4a45, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE2.RADIUS + 8, 60), gnd);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  for (let i = 0; i < 55; i++) {
    const r = Math.random() * STAGE2.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const sz = 1.5 + Math.random() * 4;
    const c = Math.random() > 0.5 ? 0x585854 : 0x363634;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(sz, 7),
      new THREE.MeshStandardMaterial({ color: c, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(patch);
  }

  const rock1 = std(0x686864);
  const rock2 = std(0x4a4a48);
  const rockDk = std(0x2a2a28);

  // 石柱（木の代わり）
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * (STAGE2.RADIUS + 4);
    const p = makePillar(rock1, rock2, rockDk);
    p.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(p);
  }

  // 岩塊
  for (let i = 0; i < 50; i++) {
    const r = 3 + Math.random() * STAGE2.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const b = makeBoulder(rock1, rock2);
    b.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(b);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x4a4a50, 14, STAGE2.RADIUS + 10);
  scene.background = new THREE.Color(0x2e2e32);

  return { group, bounds: { radius: STAGE2.RADIUS } };
}

function std(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
}

function makePillar(mat1, mat2, darkMat) {
  const g = new THREE.Group();
  const h = 3.5 + Math.random() * 5.5;
  const r = 0.28 + Math.random() * 0.22;

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r, h, 7), mat1);
  pillar.position.y = h / 2;
  pillar.castShadow = true;
  g.add(pillar);

  if (Math.random() > 0.4) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, 0.28, r * 1.9), mat2);
    cap.position.y = h;
    cap.rotation.y = Math.random() * 0.6;
    cap.castShadow = true;
    g.add(cap);
  }

  for (let i = 0; i < 2; i++) {
    const ang = Math.random() * Math.PI * 2;
    const crack = new THREE.Mesh(new THREE.BoxGeometry(r * 0.14, h * rand(0.3, 0.6), r * 0.06), darkMat);
    crack.position.set(Math.sin(ang) * r * 0.95, h * rand(0.2, 0.65), Math.cos(ang) * r * 0.95);
    g.add(crack);
  }

  return g;
}

function makeBoulder(mat1, mat2) {
  const b = new THREE.Group();
  const count = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const s = 0.18 + Math.random() * 0.65;
    const m = Math.random() > 0.4 ? mat1 : mat2;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), m);
    rock.scale.set(rand(0.7, 1.4), rand(0.35, 0.8), rand(0.8, 1.5));
    rock.position.set(rand(-0.45, 0.45), s * 0.32, rand(-0.45, 0.45));
    rock.rotation.set(rand(0, 0.5), rand(0, Math.PI * 2), rand(0, 0.3));
    rock.castShadow = true;
    b.add(rock);
  }
  return b;
}

function rand(a, b) { return a + Math.random() * (b - a); }
