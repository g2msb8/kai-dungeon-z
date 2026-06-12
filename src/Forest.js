// ステージ「ゾンビの森」環境。
// 有機的な木（タペリング幹＋枝＋IcosahedronGeometryの葉クラスタ）、岩、下草、霧。
import * as THREE from 'three';
import { COLORS, STAGE } from './core/Constants.js';

export function buildForest(scene) {
  const group = new THREE.Group();

  // ─── 地面（大きな円盤）────────────────────────────────────────
  const groundMat = new THREE.MeshStandardMaterial({ color: COLORS.GROUND, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(STAGE.RADIUS + 8, 60), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 地面パッチ（色ムラ）
  const patchMat = new THREE.MeshStandardMaterial({ color: COLORS.GROUND_PATCH, roughness: 1 });
  const mudMat   = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 1 });
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * STAGE.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const sz = 1.5 + Math.random() * 3;
    const m = Math.random() > 0.3 ? patchMat : mudMat;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(sz, 7), m);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(a) * r, 0.01, Math.cos(a) * r);
    group.add(patch);
  }

  // ─── マテリアル ────────────────────────────────────────────────
  const trunkMat     = std(COLORS.TREE_TRUNK);
  const trunkDarkMat = std(COLORS.TREE_TRUNK_DARK);
  const leafMats = [
    std(COLORS.TREE_LEAF),
    std(COLORS.TREE_LEAF2),
    std(COLORS.TREE_LEAF3),
    std(COLORS.TREE_LEAF4),
  ];
  const undergrowthMat = std(0x1a3a12);
  const rockMat        = std(COLORS.ROCK);

  // ─── 木を生成 ──────────────────────────────────────────────────
  for (let i = 0; i < STAGE.TREE_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    // 一部は境界外に置いて壁感を出す
    const r = 5 + Math.random() * (STAGE.RADIUS + 6);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const tree = makeTree(trunkMat, trunkDarkMat, leafMats);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);
  }

  // ─── 下草（低い茂み）──────────────────────────────────────────
  for (let i = 0; i < 80; i++) {
    const r = Math.random() * STAGE.RADIUS;
    const a = Math.random() * Math.PI * 2;
    if (r < 3) continue; // 中央付近は空ける
    const bush = makeBush(leafMats, undergrowthMat);
    bush.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(bush);
  }

  // ─── 岩 ────────────────────────────────────────────────────────
  for (let i = 0; i < 35; i++) {
    const r = 3 + Math.random() * STAGE.RADIUS;
    const a = Math.random() * Math.PI * 2;
    const rock = makeRock(rockMat);
    rock.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    group.add(rock);
  }

  // ─── 倒木 ──────────────────────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const r = 4 + Math.random() * (STAGE.RADIUS - 6);
    const a = Math.random() * Math.PI * 2;
    const log = makeLog(trunkDarkMat);
    log.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    log.rotation.y = Math.random() * Math.PI * 2;
    group.add(log);
  }

  scene.add(group);

  // ─── 霧・空の色 ────────────────────────────────────────────────
  scene.fog = new THREE.Fog(0x2a3c22, 16, STAGE.RADIUS + 12);
  scene.background = new THREE.Color(0x2a3c22);

  return { group, bounds: { radius: STAGE.RADIUS } };
}

// ─── ヘルパー ─────────────────────────────────────────────────────

function std(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
}

function makeTree(trunkMat, trunkDarkMat, leafMats) {
  const t = new THREE.Group();
  const h   = 4.5 + Math.random() * 4;
  const lean = (Math.random() - 0.5) * 0.08; // わずかな傾き

  // ── 幹（テーパリング付き）──
  const tr = 0.13 + Math.random() * 0.07;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(tr * 0.55, tr, h, 8, 2),
    trunkMat
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  t.add(trunk);

  // 幹の表面の凹凸（bark patch）
  for (let i = 0; i < 3; i++) {
    const ba = Math.random() * Math.PI * 2;
    const barkH = 0.3 + Math.random() * 0.4;
    const bark = new THREE.Mesh(
      new THREE.BoxGeometry(tr * 0.25, barkH, tr * 0.18),
      trunkDarkMat
    );
    bark.position.set(
      Math.sin(ba) * tr * 0.95,
      (0.4 + Math.random() * 0.5) * h,
      Math.cos(ba) * tr * 0.95
    );
    bark.rotation.y = ba;
    t.add(bark);
  }

  // 根元のフレア（地面との接合を自然に）
  for (let i = 0; i < 4; i++) {
    const ra = (i / 4) * Math.PI * 2;
    const flare = new THREE.Mesh(
      new THREE.BoxGeometry(tr * 0.5, 0.30, tr * 0.3),
      trunkDarkMat
    );
    flare.position.set(Math.sin(ra) * tr * 1.1, 0.12, Math.cos(ra) * tr * 1.1);
    flare.rotation.y = ra;
    flare.rotation.z = 0.35;
    t.add(flare);
  }

  // ── 枝 ──
  const numBranch = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numBranch; i++) {
    const ba  = (i / numBranch) * Math.PI * 2 + rand(-0.5, 0.5);
    const bh  = h * rand(0.40, 0.70);
    const blen = rand(1.0, 1.8);
    const br  = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.060, blen, 6),
      trunkMat
    );
    // 枝を斜め上方向へ配置
    br.position.set(
      Math.sin(ba) * blen * 0.42 + lean * h * 0.2,
      bh + blen * 0.28,
      Math.cos(ba) * blen * 0.42
    );
    br.rotation.order = 'YXZ';
    br.rotation.y = ba;
    br.rotation.z = -(0.45 + Math.random() * 0.30);
    br.castShadow = true;
    t.add(br);
  }

  // ── 葉クラスタ（IcosahedronGeometry で有機的な塊に）──
  const numCluster = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < numCluster; i++) {
    const ca  = Math.random() * Math.PI * 2;
    const cr  = rand(0.4, 1.3);
    const cy  = h * rand(0.58, 0.96);
    const cs  = rand(0.65, 1.05);
    const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(cs, 1), mat);
    leaf.position.set(
      Math.sin(ca) * cr + lean * h * 0.25,
      cy,
      Math.cos(ca) * cr
    );
    leaf.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    leaf.castShadow = true;
    t.add(leaf);
  }

  return t;
}

function makeBush(leafMats, backMat) {
  const b = new THREE.Group();
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const r   = rand(0.18, 0.30);
    const mat = Math.random() > 0.4 ? backMat : leafMats[Math.floor(Math.random() * leafMats.length)];
    const m   = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    m.position.set(rand(-0.28, 0.28), r * 0.75, rand(-0.28, 0.28));
    b.add(m);
  }
  return b;
}

function makeRock(rockMat) {
  const r = new THREE.Group();
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const s = rand(0.15, 0.38);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
    rock.scale.set(rand(0.7, 1.3), rand(0.4, 0.7), rand(0.8, 1.4));
    rock.position.set(rand(-0.25, 0.25), s * 0.35, rand(-0.25, 0.25));
    rock.rotation.set(rand(0, 0.5), rand(0, Math.PI * 2), rand(0, 0.3));
    rock.castShadow = true;
    r.add(rock);
  }
  return r;
}

function makeLog(mat) {
  const len = rand(1.5, 3.0);
  const r = rand(0.10, 0.18);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 7), mat);
  log.rotation.z = Math.PI / 2; // 横に倒す
  log.position.y = r * 0.55;
  log.castShadow = true;
  const g = new THREE.Group();
  g.add(log);
  return g;
}

function rand(a, b) { return a + Math.random() * (b - a); }
