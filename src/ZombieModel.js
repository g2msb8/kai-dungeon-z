// ゾンビ専用モデルビルダー。
// 頭: CapsuleGeometry（頭蓋骨型）+ 詳細なゾンビ顔（目窩・歯・傷跡）
// 腕・脚: CylinderGeometry + SphereGeometry ジョイント
import * as THREE from 'three';

const C = {
  SKIN:      0x8aac78,
  SKIN_ROT:  0x5a7848,
  SKIN_PALE: 0xaabf90,
  CLOTH:     0x4a3c2c,
  PANTS:     0x383030,
  WOUND:     0x5c1a1a,
  TEETH:     0xd0c8b0,
  BONE:      0xd4c09a,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.92,
    metalness: 0,
    emissive:          opts.emissive          ? new THREE.Color(opts.emissive)          : undefined,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
}
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function circle(r, m) {
  return new THREE.Mesh(new THREE.CircleGeometry(r, 8), m);
}

export function buildZombieModel() {
  const root = new THREE.Group();

  // ─────────────────────────── HEAD GROUP ─────────────────────
  // headGroup を使うことで、Zombie.js の _animateShamble で
  // head.rotation を変えると顔パーツも一緒に動く
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.76;
  headGroup.rotation.x = 0.35; // うなだれ

  const headMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.175, 0.20, 4, 8),
    mat(C.SKIN)
  );
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // 顔パーツを headGroup 子に追加（正面 = -z）
  _addZombieFace(headGroup);

  root.add(headGroup);

  // ─────────────────────────── NECK ───────────────────────────
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 0.17, 6), mat(C.SKIN_ROT));
  neck.position.set(0, 1.58, 0.02);
  neck.rotation.x = 0.15;
  root.add(neck);

  // ─────────────────────────── TORSO ──────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.68, 0.27), mat(C.CLOTH));
  torso.position.set(0, 1.15, 0);
  torso.rotation.x = 0.10;
  torso.castShadow = true;
  root.add(torso);

  // 胸の傷（血の染み）
  const wBig = new THREE.Mesh(
    new THREE.CircleGeometry(0.10, 7),
    mat(C.WOUND, { emissive: 0x200000, emissiveIntensity: 0.25 })
  );
  wBig.position.set(0.10, 1.22, -0.145);
  root.add(wBig);

  const wSm = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 6),
    mat(C.WOUND, { emissive: 0x1a0000, emissiveIntensity: 0.2 })
  );
  wSm.position.set(-0.15, 1.06, -0.145);
  root.add(wSm);

  // 衣服の破れ
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.04), mat(0x362c1e));
  tear.position.set(0.08, 0.82, -0.12);
  tear.rotation.z = 0.3;
  root.add(tear);

  // ─────────────────────────── ARMS ───────────────────────────
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 1.50, 0);

    shoulder.add(_mesh(new THREE.SphereGeometry(0.092, 6, 5), mat(C.SKIN_ROT)));

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.068, 0.50, 7), mat(C.SKIN_ROT));
    upper.position.y = -0.25; upper.castShadow = true; shoulder.add(upper);

    shoulder.add(_at(new THREE.Mesh(new THREE.SphereGeometry(0.078, 6, 5), mat(C.SKIN_ROT)), 0, -0.52, 0));

    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.44, 7), mat(C.SKIN_PALE));
    fore.position.y = -0.76; fore.castShadow = true; shoulder.add(fore);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.095, 0.095), mat(C.SKIN_PALE));
    hand.position.set(side * 0.01, -1.01, 0.01); shoulder.add(hand);

    shoulder.rotation.x = -1.35;
    shoulder.rotation.z = side * -0.18;
    root.add(shoulder);
    return shoulder;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ─────────────────────────── LEGS ───────────────────────────
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.15, 0.78, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.096, 0.50, 7), mat(C.PANTS));
    thigh.position.y = -0.25; thigh.castShadow = true; hip.add(thigh);

    hip.add(_at(new THREE.Mesh(new THREE.SphereGeometry(0.102, 6, 5), mat(C.PANTS)), 0, -0.51, 0));

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.090, 0.073, 0.44, 7), mat(C.PANTS));
    shin.position.y = -0.74; shin.castShadow = true; hip.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.082, 0.26), mat(C.SKIN_ROT));
    foot.position.set(side * 0.01, -0.984, -0.04); hip.add(foot);

    root.add(hip);
    return hip;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const parts = { head: headGroup, neck, torso, armL, armR, legL, legR };

  const allMeshes = [];
  root.traverse((o) => { if (o.isMesh) allMeshes.push(o); });

  return { root, parts, allMeshes };
}

// ─── ゾンビ顔パーツ（headGroup のローカル空間, 正面 = -z） ───────────
function _addZombieFace(g) {
  const fz = -0.178; // 顔の前面 z（CapsuleGeometry 半径 ≈ 0.175）

  // 目窩（暗い凹み）
  const socketMat  = mat(0x100808);
  const eyeGlowMat = new THREE.MeshStandardMaterial({
    color: 0xcc1111,
    emissive: new THREE.Color(0x880000),
    emissiveIntensity: 1.4,
  });
  [-0.075, 0.075].forEach((x, i) => {
    const socket = new THREE.Mesh(new THREE.CircleGeometry(0.058, 8), socketMat);
    socket.position.set(x, 0.03, fz); g.add(socket);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.034, 7), eyeGlowMat);
    glow.position.set(x + (i === 0 ? 0.006 : -0.006), 0.03, fz - 0.002); g.add(glow);
  });

  // 鼻（部分的に欠損・傷跡）
  const wMat = mat(C.WOUND, { emissive: 0x1a0000, emissiveIntensity: 0.45 });
  const nose = new THREE.Mesh(new THREE.CircleGeometry(0.030, 6), wMat);
  nose.position.set(0.010, -0.022, fz); g.add(nose);

  // 歯（上歯列：不揃いな白い歯）
  const teethMat = mat(C.TEETH, { roughness: 0.8 });
  const txs = [-0.062, -0.038, -0.012, 0.014, 0.038, 0.062];
  txs.forEach((x, i) => {
    const th = 0.030 + Math.sin(i * 1.3 + 0.6) * 0.013;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.021, th, 0.017), teethMat);
    tooth.position.set(x, -0.085, fz - 0.003);
    tooth.rotation.z = (i % 2 === 0 ? 0.07 : -0.07) * (i < 3 ? 1 : -1);
    g.add(tooth);
  });

  // 下歯列（食いしばり）
  [-0.048, -0.020, 0.006, 0.032].forEach((x, i) => {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.022, 0.015), teethMat);
    tooth.position.set(x, -0.110, fz - 0.002);
    tooth.rotation.z = (i % 2 === 0 ? -0.05 : 0.05);
    g.add(tooth);
  });

  // あご（むき出しの骨）
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.020, 0.016), mat(C.BONE));
  jaw.position.set(0, -0.120, fz - 0.004); g.add(jaw);

  // 頬の傷
  const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.038, 6),
    mat(C.WOUND, { emissive: 0x220000, emissiveIntensity: 0.35 }));
  cheek.position.set(-0.120, 0.000, fz); g.add(cheek);

  // 額の裂傷
  const gash = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.014, 0.010),
    mat(C.WOUND, { emissive: 0x1a0000, emissiveIntensity: 0.3 }));
  gash.position.set(-0.018, 0.110, fz - 0.002);
  gash.rotation.z = 0.18; g.add(gash);
}

function _mesh(geo, mat) {
  return new THREE.Mesh(geo, mat);
}
function _at(mesh, x, y, z) {
  mesh.position.set(x, y, z); return mesh;
}
