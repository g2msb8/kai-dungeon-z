// ローポリ人型モデル共通ビルダー（主人公／NPC用）。
// opts.face = 'player' を渡すと外国人男性の顔を追加する。
// 追加のスタイル指定（省略時はプレイヤーの既定外見）:
//   hairStyle: 'short'(既定) ほか naturalShort/asymmetry/airy/wavy/wolf/
//              softMohawk/mash/twoBlockBuzz/design/semiLong/veryShort/long
//   sleeve:    'short'|'long'        （長袖なら腕が服色＋手のひら）
//   legwear:   'pants'|'shorts'      （半ズボンなら脛が肌色）
//   shoes:     null | { type:'normal'|'nike'|'boots', color, accent }
import * as THREE from 'three';

export function buildHumanoid({
  skin, cloth, pants, skinDark, face, hairColor, pantsAccent,
  hairStyle = 'short', sleeve = 'short', legwear = 'pants', shoes = null,
}) {
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
    _addPlayerFace(headGroup, skin);
    _addHair(headGroup, hairColor, hairStyle);
  }

  // ── 腕（肩ピボット） ──
  const sleeveLong = sleeve === 'long';
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 1.50, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.62, 0.19), sleeveLong ? clothMat : skinDkMat);
    upper.position.y = -0.31;
    upper.castShadow = true;
    pivot.add(upper);
    if (sleeveLong) {
      // 袖から出る手（肌色）
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.20), skinMat);
      hand.position.y = -0.66;
      hand.castShadow = true;
      pivot.add(hand);
    }
    root.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ── 脚（ヒップピボット） ──
  const shortsOn = legwear === 'shorts';
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.78, 0);

    if (shortsOn) {
      // 半ズボン（上）＋ 素足の脛（下）
      const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.42, 0.24), pantsMat);
      shorts.position.y = -0.21;
      shorts.castShadow = true;
      pivot.add(shorts);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.20), skinDkMat);
      shin.position.y = -0.60;
      shin.castShadow = true;
      pivot.add(shin);
    } else {
      // 長ズボン
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
    }

    // 靴
    if (shoes) _addShoe(pivot, side, shoes);

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

// ─── 靴 ─────────────────────────────────────────────────────────────
function _addShoe(pivot, side, shoes) {
  const colMat = mat(shoes.color, 0.7);

  if (shoes.type === 'boots') {
    // 長靴: 脛まで覆う筒 + 足
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.46, 0.26), colMat);
    shaft.position.set(0, -0.60, 0);
    shaft.castShadow = true;
    pivot.add(shaft);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.36), colMat);
    foot.position.set(0, -0.85, -0.05);
    foot.castShadow = true;
    pivot.add(foot);
    return;
  }

  // normal / nike 共通: 黒いソール + 本体
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.38), mat(0x1a1a1a, 0.6));
  sole.position.set(0, -0.87, -0.05);
  pivot.add(sole);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.32), colMat);
  body.position.set(0, -0.80, -0.03);
  body.castShadow = true;
  pivot.add(body);

  if (shoes.type === 'nike') {
    // 横のスウッシュ（アクセント色）
    const accMat = mat(shoes.accent ?? 0xffffff, 0.5);
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.16), accMat);
    sw.position.set(side * 0.13, -0.80, -0.02);
    pivot.add(sw);
  }
}

// ─── 髪型 ───────────────────────────────────────────────────────────
function _addHair(headGroup, hairColor, style) {
  const hair = mat(hairColor ?? 0x2a180a, 0.9);
  const fz = -0.175;
  const B = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hair);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    headGroup.add(mesh);
    return mesh;
  };

  switch (style) {
    case 'naturalShort': // ナチュラルショート
      B(0.36, 0.10, 0.36, 0, 0.22, 0);
      B(0.06, 0.16, 0.32, -0.17, 0.10, 0);
      B(0.06, 0.16, 0.32,  0.17, 0.10, 0);
      B(0.30, 0.05, 0.07, 0, 0.15, fz + 0.04);
      break;

    case 'asymmetry': // アシンメトリー（左右非対称・片側に流す前髪）
      B(0.36, 0.10, 0.36, 0, 0.225, 0);
      B(0.07, 0.20, 0.30, -0.17, 0.10, 0);
      B(0.07, 0.12, 0.30,  0.17, 0.14, 0);
      B(0.17, 0.22, 0.06, -0.07, 0.05, fz + 0.03); // 長い斜め前髪（左）
      B(0.12, 0.05, 0.07,  0.07, 0.16, fz + 0.04); // 短い前髪（右）
      break;

    case 'airy': // エアリーヘア（ふんわり大きめ＋束感）
      B(0.40, 0.14, 0.40, 0, 0.24, 0);
      B(0.11, 0.11, 0.11, -0.14, 0.31, -0.02);
      B(0.11, 0.11, 0.11,  0.14, 0.31,  0.03);
      B(0.10, 0.10, 0.10,  0.00, 0.33, -0.10);
      B(0.30, 0.05, 0.08, 0, 0.16, fz + 0.04);
      break;

    case 'wavy': { // くせ毛風（ボコボコした束）
      B(0.36, 0.10, 0.36, 0, 0.21, 0);
      const bumps = [[-0.12, 0.29, -0.08], [0.10, 0.31, 0.06], [-0.04, 0.30, 0.10],
                     [0.13, 0.29, -0.10], [0.00, 0.32, -0.02]];
      for (const [x, y, z] of bumps) B(0.11, 0.10, 0.11, x, y, z);
      B(0.07, 0.16, 0.30, -0.17, 0.10, 0);
      B(0.07, 0.16, 0.30,  0.17, 0.10, 0);
      B(0.30, 0.06, 0.08, 0, 0.15, fz + 0.04);
      break;
    }

    case 'wolf': // ウルフカット（トップ短め＋襟足長め）
      B(0.36, 0.10, 0.36, 0, 0.22, 0);
      B(0.07, 0.16, 0.30, -0.17, 0.10, 0);
      B(0.07, 0.16, 0.30,  0.17, 0.10, 0);
      B(0.30, 0.06, 0.08, 0, 0.15, fz + 0.04);
      B(0.34, 0.26, 0.08, 0, -0.02, 0.175); // 襟足
      B(0.28, 0.10, 0.06, 0, -0.18, 0.16);
      break;

    case 'softMohawk': // ソフトモヒカン（控えめな中央の立ち上がり）
      B(0.36, 0.06, 0.36, 0, 0.205, 0);
      B(0.10, 0.13, 0.34, 0, 0.29, 0);
      B(0.30, 0.05, 0.07, 0, 0.15, fz + 0.04);
      break;

    case 'mash': // マッシュカット（丸いキノコ型）
      B(0.40, 0.16, 0.40, 0, 0.18, 0);
      B(0.38, 0.07, 0.10, 0, 0.10, fz + 0.02);
      B(0.10, 0.12, 0.38, -0.18, 0.08, 0);
      B(0.10, 0.12, 0.38,  0.18, 0.08, 0);
      break;

    case 'twoBlockBuzz': // ツーブロックボーズ（サイド刈り上げ＋トップ短め）
      B(0.36, 0.10, 0.34, 0, 0.225, 0);
      B(0.04, 0.14, 0.32, -0.17, 0.06, 0);
      B(0.04, 0.14, 0.32,  0.17, 0.06, 0);
      B(0.28, 0.05, 0.07, 0, 0.16, fz + 0.04);
      break;

    case 'design': { // デザインヘア（束感＋差し色メッシュ）
      B(0.36, 0.10, 0.36, 0, 0.215, 0);
      for (const sx of [-0.12, 0.0, 0.12])
        B(0.06, 0.13, 0.07, sx, 0.30, -0.02);
      B(0.05, 0.11, 0.30, -0.17, 0.09, 0);
      B(0.05, 0.11, 0.30,  0.17, 0.09, 0);
      // 差し色メッシュ（前髪に明るい一束）
      const accent = mat(0xff3b6b, 0.6);
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), accent);
      streak.position.set(-0.07, 0.15, fz + 0.04);
      streak.castShadow = true;
      headGroup.add(streak);
      break;
    }

    case 'semiLong': // セミロング（肩までいかない中くらい）
      B(0.37, 0.12, 0.37, 0, 0.225, 0);
      B(0.08, 0.26, 0.34, -0.18, 0.04, 0);
      B(0.08, 0.26, 0.34,  0.18, 0.04, 0);
      B(0.32, 0.20, 0.08, 0, 0.04, 0.175);
      B(0.30, 0.06, 0.08, 0, 0.15, fz + 0.04);
      break;

    case 'veryShort': // ベリーショート（かなり短い刈り込み）
      B(0.35, 0.06, 0.35, 0, 0.205, 0);
      B(0.05, 0.10, 0.30, -0.17, 0.10, 0);
      B(0.05, 0.10, 0.30,  0.17, 0.10, 0);
      B(0.26, 0.04, 0.06, 0, 0.17, fz + 0.04);
      break;

    case 'long': // ロング
      B(0.36, 0.11, 0.36, 0, 0.225, 0);
      B(0.09, 0.34, 0.32, -0.17, 0.02, 0.02);
      B(0.09, 0.34, 0.32,  0.17, 0.02, 0.02);
      B(0.34, 0.30, 0.08,  0,    0.02, 0.175);
      B(0.30, 0.055, 0.08, 0,    0.155, fz + 0.04);
      break;

    case 'short': // ショート（既定・主人公）
    default:
      B(0.36, 0.11, 0.36, 0, 0.225, 0);
      B(0.07, 0.20, 0.30, -0.17, 0.12, 0);
      B(0.07, 0.20, 0.30,  0.17, 0.12, 0);
      B(0.30, 0.055, 0.08, 0, 0.155, fz + 0.04);
      break;
  }
}

// ─── 外国人男性の顔（髪は _addHair で別途追加）─────────────────────────
// 頭ボックス: 0.34 × 0.36 × 0.34。正面 = -z（fz = -0.17）。
function _addPlayerFace(headGroup, skinColor) {
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

  const jawM = m(0x806050, 1.0);  // ヒゲ/顎影

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
