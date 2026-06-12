// ステージ3「溶岩バイオーム」の環境。
import * as THREE from 'three';
import { STAGE3 } from './core/Constants.js';

export function buildLavaBiome(scene) {
  const group = new THREE.Group();

  // 暗い岩盤の地面
  const gnd = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE3.RADIUS + 8, 60), gnd);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 溶岩池 25 個
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: new THREE.Color(0xff3300),
    emissiveIntensity: 0.8,
    roughness: 0.9,
  });
  for (let i = 0; i < 25; i++) {
    const r = 2 + Math.random() * (STAGE3.RADIUS - 3);
    const a = Math.random() * Math.PI * 2;
    const sz = 0.8 + Math.random() * 2.5;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(sz, 10), lavaMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(Math.sin(a) * r, 0.005, Math.cos(a) * r);
    group.add(pool);
  }

  // 黒い岩・暗い岩 35 個
  const rockMat1 = new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.95, metalness: 0 });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x280a00, roughness: 0.95, metalness: 0 });

  for (let i = 0; i < 35; i++) {
    const r = 3 + Math.random() * STAGE3.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const b = makeDarkBoulder(rockMat1, rockMat2);
    b.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(b);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0x1a0800, 12, STAGE3.RADIUS + 8);
  scene.background = new THREE.Color(0x120200);

  return { group, bounds: { radius: STAGE3.RADIUS } };
}

function makeDarkBoulder(mat1, mat2) {
  const b = new THREE.Group();
  const count = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const s = 0.20 + Math.random() * 0.75;
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
