// ローポリ人型モデル共通ビルダー（主人公用）。
// opts.face = 'player' を渡すと外国人男性の顔を追加する。
import * as THREE from 'three';

export function buildHumanoid({ skin, cloth, pants, skinDark, face, hairColor, pantsAccent }) {
  const root = new THREE.Group();

  const skinMat     = mat(skin);
  const skinDkMat   = mat(skinDark ?? skin);
  const clothMat    = mat(cloth);
  const pantsMat    = mat(pants);
  const pantsAccMat = mat(pantsAccent ?? pants, 1.0);

  // ── 胴体 ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.72, 0.30), clothMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  root.add(torso);

  // ── 頭（Group にして顔パーツを子にできるように）──
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.72;
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);
  root.add(headGroup);

  if (face === 'player') {
    _addPlayerFace(headGroup, skin, hairColor);
  }

  // ── 腕（肩ピボット） ──
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 1.50, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.62, 0.19), skinDkMat);
    upper.position.y = -0.31;
    upper.castShadow = true;
    pivot.add(upper);
    root.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ── 脚（ヒップピボット） ──
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.78, 0);

    // メインのズボン
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.80, 0.23), pantsMat);
    leg.position.y = -0.40;
    leg.castShadow = true;
    pivot.add(leg);

    // 破れデニムのアクセント（ランダムな暗い縦筋）
    if (pantsAccent) {
      const tearH = 0.10 + Math.random() * 0.14;
      const tearY = -0.25 - Math.random() * 0.25;
      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.08, tearH, 0.22), pantsAccMat);
      tear.position.set(side * 0.03, tearY, 0);
      pivot.add(tear);
    }

    root.add(pivot);
    return pivot;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const parts = { head: headGroup, headMesh, torso, armL, armR, legL, legR };

  let walkPhase = 0;

  function update(dt, opts = {}) {
    const moving     = opts.moving ?? false;
    const speedScale = opts.speedScale ?? 1;
    const animArms   = opts.animateArms ?? true;

    if (moving) {
      walkPhase += dt * 8 * speedScale;
      const swing = Math.sin(walkPhase) * 0.58;
      legL.rotation.x =  swing;
      legR.rotation.x = -swing;
      if (animArms) {
        if (!opts.lockRightArm) armR.rotation.x = -swing * 0.55;
        if (!opts.lockLeftArm)  armL.rotation.x =  swing * 0.55;
      }
    } else {
      legL.rotation.x *= 1 - Math.min(1, dt * 10);
      legR.rotation.x *= 1 - Math.min(1, dt * 10);
      if (animArms) {
        if (!opts.lockLeftArm)  armL.rotation.x *= 1 - Math.min(1, dt * 10);
        if (!opts.lockRightArm) armR.rotation.x *= 1 - Math.min(1, dt * 10);
      }
    }
  }

  return { root, parts, update };
}

// ─── 外国人男性の顔 ─────────────────────────────────────────────────
// 頭ボックス: 0.34 × 0.36 × 0.34。正面 = -z（fz = -0.17）。
function _addPlayerFace(headGroup, skinColor, hairColor) {
  const fz = -0.175; // 正面 z 位置

  function m(color, r = 0.88) {
    return new THREE.MeshStandardMaterial({ color, roughness: r, metalness: 0 });
  }
  function box(w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    return mesh;
  }
  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    headGroup.add(mesh);
    return mesh;
  }

  const hair = m(hairColor ?? 0x2a180a);
  const lipM  = m(0xb25c5c);
  const jawM  = m(0x806050, 1.0);  // ヒゲ/顎影

  // ── 髪 ──────────────────────────────────────────────────────
  // 頭頂部 + サイド
  add(box(0.36, 0.11, 0.36, hair),  0,     0.225,  0);
  add(box(0.07, 0.20, 0.30, hair), -0.17,  0.12,   0);  // 左サイド
  add(box(0.07, 0.20, 0.30, hair),  0.17,  0.12,   0);  // 右サイド
  // 前髪（おでこにかかる）
  add(box(0.30, 0.055, 0.08, hair), 0,    0.155,  fz + 0.04);

  // ── 眉毛 ────────────────────────────────────────────────────
  const browM = m(0x301808);
  add(box(0.082, 0.020, 0.012, browM), -0.086, 0.105, fz - 0.005);
  add(box(0.082, 0.020, 0.012, browM),  0.086, 0.105, fz - 0.005);

  // ── 目（白目→虹彩→瞳）────────────────────────────────────
  [-0.086, 0.086].forEach((x) => {
    add(box(0.082, 0.046, 0.012, m(0xf4f0e4)),  x,  0.048, fz - 0.003);  // 白目
    add(box(0.048, 0.044, 0.014, m(0x2255aa)),  x,  0.048, fz - 0.006);  // 虹彩(青)
    add(box(0.024, 0.026, 0.016, m(0x080808)),  x,  0.048, fz - 0.008);  // 瞳
    add(box(0.006, 0.006, 0.018, m(0xffffff)),  x + 0.012, 0.056, fz - 0.009); // キャッチライト
    // まぶた（薄い肌色ライン）
    add(box(0.088, 0.014, 0.010, m(skinColor ?? 0xe8c49a)), x, 0.073, fz - 0.004);
  });

  // ── 鼻 ──────────────────────────────────────────────────────
  const noseM = m(0xd4a07a);
  add(box(0.040, 0.052, 0.030, noseM),  0,  0.004, fz - 0.015);  // 鼻梁
  add(box(0.062, 0.020, 0.018, noseM),  0, -0.020, fz - 0.010);  // 鼻底

  // ── 口・唇 ──────────────────────────────────────────────────
  add(box(0.094, 0.022, 0.012, m(0xb05050)), 0, -0.070, fz - 0.005);  // 上唇
  add(box(0.098, 0.024, 0.013, m(0x9a4040)), 0, -0.096, fz - 0.005);  // 下唇

  // ── 顎のヒゲ（無精ヒゲ）────────────────────────────────────
  add(box(0.20, 0.028, 0.011, jawM),  0, -0.118, fz - 0.003);
  add(box(0.11, 0.022, 0.011, jawM),  0, -0.144, fz - 0.002);
}

function mat(color, roughness = 0.87) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
