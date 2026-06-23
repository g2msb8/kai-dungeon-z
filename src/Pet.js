// ガチャで仲間になるペット。バトルでプレイヤーに追従し、
// 近くのゾンビに噛みつき、〇発殴られると死ぬ。
import * as THREE from 'three';
import { soundManager } from './SoundManager.js';

// 種別ごとのパラメータ（hits=何発で死ぬか, dmg=噛みつき威力, prob=出現%）
export const PET_DEF = {
  chihuahua: { name: 'チワワ',       emoji: '🐕', prob: 40, hits: 9,  dmg: 6,  scale: 0.74,
               body: 0xf5f5f0, body2: 0xe6e6df, ear: 'big',    eye: 0x141414, snout: 0xf0d8c0 },
  poodle:    { name: 'プードル',      emoji: '🐩', prob: 20, hits: 13, dmg: 9,  scale: 0.92,
               body: 0x8a5a2a, body2: 0x6e4420, ear: 'floppy', eye: 0x20100a, snout: 0x5a3a18, fluffy: true },
  shiba:     { name: '柴犬',         emoji: '🐕', prob: 17, hits: 17, dmg: 13, scale: 1.18,
               body: 0xc06820, body2: 0xf4ecdc, ear: 'pointy', eye: 0x20100a, snout: 0xf4ecdc },
  graywolf:  { name: '灰色オオカミ',  emoji: '🐺', prob: 11, hits: 22, dmg: 18, scale: 1.34,
               body: 0x6f6f6f, body2: 0x4a4a4a, ear: 'pointy', eye: 0xff2020, snout: 0x555555, wolf: true },
  whitewolf: { name: '白オオカミ',    emoji: '🐺', prob: 13, hits: 22, dmg: 18, scale: 1.34,
               body: 0xf0f0f0, body2: 0xc04848, ear: 'pointy', eye: 0x2a6cff, snout: 0xdadada, wolf: true },

  // ── レア（猫） ──
  purplecat: { name: 'むらさき猫',   emoji: '🐱', tier: 'rare', behavior: 'fighter',
               prob: 40, hits: 27, dmg: 12, scale: 0.96, cat: true,
               body: 0x9c4dcc, body2: 0x7a2e9e, ear: 'pointy', eye: 0xffe000, snout: 0xc89ad8 },
  bigcat:    { name: 'でかい猫',     emoji: '🐈', tier: 'rare', behavior: 'fighter',
               prob: 20, hits: 34, dmg: 17, scale: 1.65, cat: true,
               body: 0x9a8c7a, body2: 0xf0e8d8, ear: 'pointy', eye: 0x2a8a2a, snout: 0xe8dcc8 },
  shycat:    { name: 'シャイな猫',   emoji: '🐱', tier: 'rare', behavior: 'shy',
               prob: 17, hits: 40, dmg: 0, scale: 0.92, cat: true,
               body: 0xd2b48c, body2: 0xf4ecdc, ear: 'pointy', eye: 0x4a3020, snout: 0xf4ecdc },
  rampagecat:{ name: '暴れニャンコ', emoji: '😼', tier: 'rare', behavior: 'rampage',
               prob: 11, hits: 45, dmg: 0, scale: 1.06, cat: true, sunglasses: true,
               body: 0x2f6fb0, body2: 0x224f7d, ear: 'pointy', eye: 0x111111, snout: 0x4f8fd0 },
};

// ガチャの段階ごとのプール
export const PET_POOLS = {
  normal:    ['chihuahua', 'poodle', 'shiba', 'graywolf', 'whitewolf'],
  rare:      ['purplecat', 'bigcat', 'shycat', 'rampagecat'],
  superrare: [], // 未定（準備中）
};

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}

// ─── モデル生成（四足。頭は +Z 前方）─────────────────────────────
function buildPetModel(def) {
  const root = new THREE.Group();
  const bodyM = mat(def.body, def.fluffy ? 1.0 : 0.8);
  const accM  = mat(def.body2, def.fluffy ? 1.0 : 0.85);
  const snoutM = mat(def.snout, 0.85);
  const eyeM  = new THREE.MeshStandardMaterial({
    color: def.eye, roughness: 0.3,
    emissive: (def.wolf ? def.eye : 0x000000), emissiveIntensity: def.wolf ? 0.8 : 0,
  });
  const noseM = mat(0x111111, 0.5);

  // 胴体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.95), bodyM);
  body.position.y = 0.62;
  root.add(body);
  // 背の差し色（柴・白オオカミの模様）
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.7), accM);
  back.position.set(0, 0.78, -0.02);
  root.add(back);
  // 胸/腹の白（柴）
  if (!def.wolf || def.body2) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.4), accM);
    chest.position.set(0, 0.5, 0.34);
    root.add(chest);
  }

  // 頭グループ
  const headG = new THREE.Group();
  headG.position.set(0, 0.78, 0.5);
  root.add(headG);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.40, 0.40), bodyM);
  headG.add(head);
  // マズル
  const snoutLen = def.wolf ? 0.34 : 0.24;
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.20, snoutLen), snoutM);
  snout.position.set(0, -0.06, 0.22 + snoutLen * 0.3);
  headG.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.07), noseM);
  nose.position.set(0, -0.02, 0.24 + snoutLen * 0.55);
  headG.add(nose);

  // 耳
  if (def.ear === 'big') {
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), bodyM);
      ear.position.set(sx * 0.2, 0.34, -0.02);
      ear.rotation.z = sx * -0.25;
      headG.add(ear);
    }
  } else if (def.ear === 'floppy') {
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.30, 0.16), accM);
      ear.position.set(sx * 0.24, 0.06, -0.04);
      ear.rotation.z = sx * 0.2;
      headG.add(ear);
    }
  } else { // pointy
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.30, 4), bodyM);
      ear.position.set(sx * 0.16, 0.30, -0.02);
      ear.rotation.z = sx * -0.12;
      headG.add(ear);
    }
  }

  // 目
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(def.fluffy ? 0.08 : 0.06, 7, 5), eyeM);
    eye.position.set(sx * 0.12, 0.04, 0.2);
    headG.add(eye);
  }

  // 金色のサングラス（暴れニャンコ）
  if (def.sunglasses) {
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffcf30, metalness: 0.9, roughness: 0.25 });
    const lensM = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.15, metalness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.04), goldM);
    bar.position.set(0, 0.05, 0.205);
    headG.add(bar);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.05), lensM);
      lens.position.set(sx * 0.12, 0.04, 0.215);
      headG.add(lens);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.03), goldM);
      rim.position.set(sx * 0.12, 0.04, 0.205);
      headG.add(rim);
    }
  }

  // 脚（4本）
  const legs = [];
  const legM = mat(def.body2 && def.wolf ? def.body : def.body, 0.85);
  for (const [lx, lz] of [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.32], [0.18, -0.32]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.42, lz);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.16), legM);
    shin.position.y = -0.21;
    leg.add(shin);
    root.add(leg);
    legs.push(leg);
  }

  // しっぽ（猫は長く上向き、狼は太め、犬は短め）
  const tail = new THREE.Group();
  tail.position.set(0, 0.74, -0.48);
  const tailLen = def.cat ? 0.6 : (def.wolf ? 0.5 : 0.34);
  const tailW   = def.cat ? 0.09 : 0.12;
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(tailW, tailW, tailLen), bodyM);
  tailMesh.position.z = -tailLen * 0.5;
  tail.add(tailMesh);
  tail.rotation.x = def.cat ? 0.7 : -0.5; // 猫はピンと立てる
  root.add(tail);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, headG, legs, tail };
}

// シャイ猫の分身：二足歩行・首に黄色い鈴のミニ猫
function buildKittenModel() {
  const g = new THREE.Group();
  const furM  = mat(0xcfc4b4, 0.9);
  const darkM = mat(0x222222, 0.5);
  const bellM = new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.7, roughness: 0.3, emissive: 0x6a5400, emissiveIntensity: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.40, 0.20), furM);
  body.position.y = 0.50; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.26), furM);
  head.position.y = 0.82; g.add(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), furM);
    ear.position.set(sx * 0.09, 0.97, 0); g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), darkM);
    eye.position.set(sx * 0.07, 0.84, 0.13); g.add(eye);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.08), furM);
    arm.position.set(sx * 0.18, 0.50, 0.02); arm.rotation.z = sx * 0.2; g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.10), furM);
    leg.position.set(sx * 0.07, 0.16, 0); g.add(leg);
  }
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bellM);
  bell.position.set(0, 0.65, 0.12); g.add(bell);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.30), furM);
  tail.position.set(0, 0.42, -0.18); tail.rotation.x = 0.8; g.add(tail);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Pet {
  constructor(scene, position, type) {
    const def = PET_DEF[type] || PET_DEF.chihuahua;
    this.type = type;
    this.def  = def;
    this.behavior = def.behavior || 'fighter';
    this.damage   = def.dmg;
    this.cooldown = 0.7;
    this.hits  = def.hits;
    this.alive = true;
    this._scene = scene;
    this._atkCd = 0;
    this._phase = Math.random() * Math.PI * 2;
    this._biteT = 0;
    this._allMeshes = [];
    // 特殊行動用
    this._kittens   = [];  // シャイ猫の分身
    this._kittenCd  = 0;
    this._blasts    = [];  // 暴れニャンコの爆発VFX
    this._explodeCd = 0;

    const m = buildPetModel(def);
    this.root  = m.root;
    this._headG = m.headG;
    this._legs  = m.legs;
    this._tail  = m.tail;
    this.root.scale.setScalar(def.scale);
    this.root.position.copy(position);
    this.root.traverse(o => { if (o.isMesh) this._allMeshes.push(o); });

    scene.add(this.root);
  }

  get position() { return this.root.position; }

  _face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  _nearestZombie(zombies) {
    let nearest = null, nd = Infinity;
    for (const z of zombies) {
      if (!z.alive || z.dying) continue;
      const d = Math.hypot(z.position.x - this.root.position.x, z.position.z - this.root.position.z);
      if (d < nd) { nd = d; nearest = z; }
    }
    return { nearest, nd };
  }

  // プレイヤーへ追従して移動（戻り値: 動いたか）
  _follow(dt, player, speed = 4.4, followDist = 3.0) {
    const dpx = player.position.x - this.root.position.x;
    const dpz = player.position.z - this.root.position.z;
    const dist = Math.hypot(dpx, dpz);
    if (dist > followDist) {
      this._face(dpx, dpz);
      this.root.position.x += (dpx / dist) * speed * dt;
      this.root.position.z += (dpz / dist) * speed * dt;
      return true;
    }
    return false;
  }

  update(dt, player, zombies, onKill) {
    if (!this.alive) return;
    if (this._atkCd    > 0) this._atkCd    -= dt;
    if (this._biteT    > 0) this._biteT    -= dt;
    if (this._kittenCd > 0) this._kittenCd -= dt;
    if (this._explodeCd > 0) this._explodeCd -= dt;

    this._updateKittens(dt, zombies, onKill);
    this._updateBlasts(dt);

    if (this.behavior === 'shy')     { this._animate(dt, this._follow(dt, player)); return; }
    if (this.behavior === 'rampage') { this._updateRampage(dt, player, zombies, onKill); return; }

    // fighter（犬・狼・むらさき猫・でかい猫）
    const { nearest, nd } = this._nearestZombie(zombies);
    const distPlayer = Math.hypot(player.position.x - this.root.position.x, player.position.z - this.root.position.z);
    const AGGRO = 9, BITE = 1.7, LEASH = 13, SPEED = 4.4;
    let moving = false;

    if (nearest && nd < AGGRO && distPlayer < LEASH) {
      const dx = nearest.position.x - this.root.position.x;
      const dz = nearest.position.z - this.root.position.z;
      this._face(dx, dz);
      if (nd > BITE) {
        this.root.position.x += (dx / nd) * SPEED * dt;
        this.root.position.z += (dz / nd) * SPEED * dt;
        moving = true;
      } else if (this._atkCd <= 0) {
        this._atkCd = this.cooldown;
        this._biteT = 0.18;
        const died = nearest.takeDamage(this.damage);
        soundManager.playAttack && soundManager.playAttack();
        if (died && onKill) onKill();
      }
    } else {
      moving = this._follow(dt, player);
    }
    this._animate(dt, moving);
  }

  // 暴れニャンコ：ゾンビが近づくと自爆（周囲を吹き飛ばす）。本体は死なない
  _updateRampage(dt, player, zombies, onKill) {
    const { nearest, nd } = this._nearestZombie(zombies);
    if (nearest && nd < 3.2 && this._explodeCd <= 0) {
      this._explode(zombies, onKill);
      this._explodeCd = 2.2;
    }
    const moving = this._follow(dt, player);
    this._animate(dt, moving);
  }

  _explode(zombies, onKill) {
    const R = 5.5;
    for (const z of zombies) {
      if (!z.alive || z.dying) continue;
      const d = Math.hypot(z.position.x - this.root.position.x, z.position.z - this.root.position.z);
      if (d <= R) {
        const died = z.takeDamage(9999);
        if (died && onKill) onKill();
      }
    }
    soundManager.playWhoosh && soundManager.playWhoosh();
    // 爆風VFX
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xff7a00, emissive: 0xff5500, emissiveIntensity: 2.0, transparent: true, opacity: 0.7 }),
    );
    m.position.set(this.root.position.x, 0.8, this.root.position.z);
    this._scene.add(m);
    this._blasts.push({ mesh: m, t: 0, max: R });
  }

  _updateBlasts(dt) {
    for (let i = this._blasts.length - 1; i >= 0; i--) {
      const b = this._blasts[i];
      b.t += dt;
      const k = b.t / 0.4;
      const s = 0.5 + k * b.max;
      b.mesh.scale.setScalar(s);
      b.mesh.material.opacity = Math.max(0, 0.7 * (1 - k));
      if (k >= 1) {
        this._scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this._blasts.splice(i, 1);
      }
    }
  }

  // シャイ猫：主人公が攻撃された瞬間に分身猫を出す
  onPlayerHit() {
    if (this.behavior !== 'shy' || !this.alive) return;
    if (this._kittenCd > 0 || this._kittens.length >= 6) return;
    this._kittenCd = 1.2;
    for (let i = 0; i < 3; i++) this._spawnKitten();
  }

  _spawnKitten() {
    const k = buildKittenModel();
    const ang = Math.random() * Math.PI * 2;
    const r = 0.7 + Math.random() * 0.7;
    k.position.set(this.root.position.x + Math.sin(ang) * r, 0, this.root.position.z + Math.cos(ang) * r);
    this._scene.add(k);
    this._kittens.push({ mesh: k, life: 5.5, phase: Math.random() * 6 });
  }

  _updateKittens(dt, zombies, onKill) {
    for (let i = this._kittens.length - 1; i >= 0; i--) {
      const ki = this._kittens[i];
      ki.life -= dt;
      ki.phase += dt * 10;
      // 最近接ゾンビへ
      let nearest = null, nd = Infinity;
      for (const z of zombies) {
        if (!z.alive || z.dying) continue;
        const d = Math.hypot(z.position.x - ki.mesh.position.x, z.position.z - ki.mesh.position.z);
        if (d < nd) { nd = d; nearest = z; }
      }
      if (nearest) {
        const dx = nearest.position.x - ki.mesh.position.x;
        const dz = nearest.position.z - ki.mesh.position.z;
        ki.mesh.rotation.y = Math.atan2(dx, dz);
        if (nd < 1.3) {
          const died = nearest.takeDamage(9999); // 一発で倒す
          if (died && onKill) onKill();
          ki.life = 0; // 役目を終えて消える
        } else {
          ki.mesh.position.x += (dx / nd) * 7 * dt;
          ki.mesh.position.z += (dz / nd) * 7 * dt;
        }
      }
      ki.mesh.position.y = Math.abs(Math.sin(ki.phase)) * 0.12; // 二足歩行ホップ
      if (ki.life <= 0) {
        this._disposeKitten(ki.mesh);
        this._kittens.splice(i, 1);
      }
    }
  }

  _disposeKitten(mesh) {
    this._scene.remove(mesh);
    mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); }
    });
  }

  _animate(dt, moving) {
    this._phase += dt * (moving ? 11 : 3);
    const sw = Math.sin(this._phase);
    if (this._legs) {
      const amp = moving ? 0.6 : 0;
      this._legs[0].rotation.x =  sw * amp;
      this._legs[3].rotation.x =  sw * amp;
      this._legs[1].rotation.x = -sw * amp;
      this._legs[2].rotation.x = -sw * amp;
    }
    if (this._tail) this._tail.rotation.y = Math.sin(this._phase * 0.8) * 0.5;
    if (this._headG) this._headG.rotation.x = this._biteT > 0 ? 0.6 : Math.sin(this._phase * 0.5) * 0.05;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hits -= amount;
    this._flash();
    if (this.hits <= 0) {
      this.alive = false;
      this.dispose();
      return true;
    }
    return false;
  }

  _flash() {
    for (const m of this._allMeshes) {
      const orig = m.material;
      const f = orig.clone();
      f.emissive = new THREE.Color(0xff3030);
      f.emissiveIntensity = 0.9;
      m.material = f;
      setTimeout(() => { if (m) m.material = orig; }, 100);
    }
  }

  dispose() {
    if (!this._scene) return;
    for (const ki of this._kittens) this._disposeKitten(ki.mesh);
    this._kittens = [];
    for (const b of this._blasts) {
      this._scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    }
    this._blasts = [];
    this._scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose());
        else o.material.dispose();
      }
    });
    this._scene = null;
  }
}

// ─── ガチャ抽選 ──────────────────────────────────────────────
// tier: 'normal' | 'rare' | 'superrare'
export function rollPet(tier = 'normal') {
  const pool = (PET_POOLS[tier] && PET_POOLS[tier].length) ? PET_POOLS[tier] : PET_POOLS.normal;
  const total = pool.reduce((s, k) => s + PET_DEF[k].prob, 0);
  let r = Math.random() * total;
  for (const k of pool) {
    r -= PET_DEF[k].prob;
    if (r < 0) return k;
  }
  return pool[0];
}

// レア度（数字が大きいほどレア＝出現率が低い）。10連の「アクティブ」決定に使う
export function petRarity(type) {
  const d = PET_DEF[type];
  return d ? (100 - d.prob) : 0;
}
