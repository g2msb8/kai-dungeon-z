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

  // しっぽ
  const tail = new THREE.Group();
  tail.position.set(0, 0.74, -0.48);
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, def.wolf ? 0.5 : 0.34), bodyM);
  tailMesh.position.z = def.wolf ? -0.25 : -0.17;
  tail.add(tailMesh);
  tail.rotation.x = -0.5;
  root.add(tail);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, headG, legs, tail };
}

export class Pet {
  constructor(scene, position, type) {
    const def = PET_DEF[type] || PET_DEF.chihuahua;
    this.type = type;
    this.def  = def;
    this.damage   = def.dmg;
    this.cooldown = 0.7;
    this.hits  = def.hits;
    this.alive = true;
    this._scene = scene;
    this._atkCd = 0;
    this._phase = Math.random() * Math.PI * 2;
    this._biteT = 0;
    this._allMeshes = [];

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

  update(dt, player, zombies, onKill) {
    if (!this.alive) return;
    if (this._atkCd > 0) this._atkCd -= dt;
    if (this._biteT > 0) this._biteT -= dt;

    // 最近接の生存ゾンビ
    let nearest = null, nd = Infinity;
    for (const z of zombies) {
      if (!z.alive || z.dying) continue;
      const d = Math.hypot(z.position.x - this.root.position.x, z.position.z - this.root.position.z);
      if (d < nd) { nd = d; nearest = z; }
    }

    const dpx = player.position.x - this.root.position.x;
    const dpz = player.position.z - this.root.position.z;
    const distPlayer = Math.hypot(dpx, dpz);

    const AGGRO = 9, BITE = 1.7, LEASH = 13, FOLLOW = 3.0, SPEED = 4.4;
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
    } else if (distPlayer > FOLLOW) {
      this._face(dpx, dpz);
      this.root.position.x += (dpx / distPlayer) * SPEED * dt;
      this.root.position.z += (dpz / distPlayer) * SPEED * dt;
      moving = true;
    }

    this._animate(dt, moving);
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
const GACHA_ORDER = ['chihuahua', 'poodle', 'shiba', 'graywolf', 'whitewolf'];

export function rollPet() {
  const total = GACHA_ORDER.reduce((s, k) => s + PET_DEF[k].prob, 0);
  let r = Math.random() * total;
  for (const k of GACHA_ORDER) {
    r -= PET_DEF[k].prob;
    if (r < 0) return k;
  }
  return 'chihuahua';
}

// レア度（数字が大きいほどレア）。10連の「アクティブ」決定に使う
export function petRarity(type) {
  return { chihuahua: 1, poodle: 2, shiba: 3, whitewolf: 4, graywolf: 5 }[type] || 0;
}
