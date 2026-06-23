// でかい紫色の象。紫の瞳ゾンビの1.5倍強い強敵。
// zombies 配列で扱えるよう Zombie 互換のインターフェースを持つ。
import * as THREE from 'three';
import { PURPLE_ELEPHANT } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

function pmat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}

export class PurpleElephant {
  constructor(position) {
    this.hp     = PURPLE_ELEPHANT.MAX_HP;
    this.alive  = true;
    this.dying  = false;
    this.deathT = 0;
    this.facing = 0;
    this.attackTimer = 0;
    this.hitStun = 0;
    this._phase = Math.random() * Math.PI * 2;
    this._allMeshes = [];
    this._legs = [];
    this._trunk = [];

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this._build();
    this.root.scale.setScalar(PURPLE_ELEPHANT.SCALE);
  }

  get position() { return this.root.position; }

  _box(w, h, d, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    this._allMeshes.push(m);
    (parent || this.root).add(m);
    return m;
  }

  _build() {
    const body  = pmat(0x8e24aa);     // 紫
    const bodyD = pmat(0x5e1378);     // 濃い紫
    const tusk  = pmat(0xfff4e0, 0.4);
    const eyeM  = new THREE.MeshStandardMaterial({ color: 0xbb44ff, emissive: 0xaa00ff, emissiveIntensity: 1.6 });

    // 胴体
    this._box(2.2, 1.5, 1.4, body, this.root, 0, 1.6, 0);
    this._box(2.0, 0.5, 1.3, bodyD, this.root, 0, 0.95, 0); // 腹の影

    // 頭
    const head = new THREE.Group();
    head.position.set(0, 1.7, -1.0);
    this.root.add(head);
    this._headGroup = head;
    this._box(1.1, 1.1, 1.0, body, head, 0, 0, 0);

    // 耳（大きい平たい板）
    for (const sx of [-1, 1]) {
      this._box(0.12, 1.0, 0.9, bodyD, head, sx * 0.62, 0.05, 0.1);
    }

    // 目（紫に光る）
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeM);
      e.position.set(sx * 0.32, 0.15, -0.5);
      head.add(e);
    }

    // 鼻（トランク・複数セグメントで下へ）
    let py = -0.4, pz = -0.55, seg = 0.34;
    for (let i = 0; i < 5; i++) {
      const t = this._box(0.34 - i * 0.03, seg, 0.34 - i * 0.03, body, head, 0, py, pz);
      this._trunk.push(t);
      py -= 0.28; pz -= 0.06;
    }

    // 牙
    for (const sx of [-1, 1]) {
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 0.7, 6), tusk);
      tk.rotation.x = 0.5;
      tk.position.set(sx * 0.28, -0.45, -0.6);
      head.add(tk);
    }

    // 4本の太い脚
    for (const sx of [-0.7, 0.7]) {
      for (const sz of [-0.45, 0.55]) {
        const leg = this._box(0.5, 1.1, 0.5, bodyD, this.root, sx, 0.55, sz);
        this._legs.push(leg);
      }
    }
  }

  update(dt, player) {
    if (this.dying) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 1.0);
      this.root.rotation.z = t * 0.5;
      this.root.position.y = -t * 0.6;
      this.root.scale.setScalar(PURPLE_ELEPHANT.SCALE * (1 - t * 0.15));
      if (t >= 1) this.alive = false;
      return 0;
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitStun > 0) { this.hitStun -= dt; this._animate(dt, false); return 0; }

    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001) {
      this.facing = Math.atan2(dx, dz);
      this.root.rotation.y = this.facing;
    }

    let damage = 0;
    let moving = false;
    if (dist > PURPLE_ELEPHANT.ATTACK_RANGE) {
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * PURPLE_ELEPHANT.MOVE_SPEED * dt;
      this.root.position.z += nz * PURPLE_ELEPHANT.MOVE_SPEED * dt;
      moving = true;
    } else if (this.attackTimer <= 0 && player.alive) {
      this.attackTimer = PURPLE_ELEPHANT.ATTACK_COOLDOWN;
      damage = PURPLE_ELEPHANT.ATTACK_DAMAGE;
      soundManager.playZombieAttack();
    }

    this._animate(dt, moving);
    return damage;
  }

  _animate(dt, moving) {
    this._phase += dt * (moving ? 5 : 2);
    const ph = this._phase;
    if (this._headGroup) this._headGroup.rotation.x = Math.sin(ph * 0.5) * 0.06;
    // トランクの揺れ
    this._trunk.forEach((t, i) => { t.rotation.x = Math.sin(ph * 0.8 + i * 0.5) * 0.12; });
    // 脚の歩行
    if (moving) {
      this._legs.forEach((leg, i) => { leg.rotation.x = Math.sin(ph + i * Math.PI / 2) * 0.35; });
    } else {
      this._legs.forEach(leg => { leg.rotation.x *= 1 - Math.min(1, dt * 8); });
    }
  }

  // 紫ゾンビと同様、常に1ダメージしか受けない（量を無視）
  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= 1;
    this.hitStun = PURPLE_ELEPHANT.HIT_STUN;
    this._flash();
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  _flash() {
    this._allMeshes.forEach(m => {
      const orig = m.material;
      const f = orig.clone();
      f.emissive = new THREE.Color(0xff3030);
      f.emissiveIntensity = 1.0;
      m.material = f;
      setTimeout(() => { if (m) m.material = orig; }, 110);
    });
  }

  die() { this.dying = true; this.deathT = 0; }

  updateSpin(dt) { this.root.rotation.y += dt * 2.4; this._animate(dt, false); }

  dispose(scene) {
    scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
