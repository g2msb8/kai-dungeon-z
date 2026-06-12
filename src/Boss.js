// 石バイオームのボス — 革装備の大イノシシ。
import * as THREE from 'three';
import { BOSS } from './core/Constants.js';

function smat(color, roughness = 0.85, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class Boss {
  constructor(position) {
    this.hp           = BOSS.HP;
    this.alive        = true;
    this.dying        = false;
    this._deathT      = 0;
    this._attackTimer = 0;
    this._hitStun     = 0;
    this._phase       = Math.random() * Math.PI * 2;
    this.facing       = 0;
    this._allMeshes   = [];
    this._armR        = null;
    this._headGroup   = null;
    this._legs        = [];

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this._buildModel();
    this.root.scale.setScalar(1.6);
  }

  get position() { return this.root.position; }

  _box(w, h, d, mat, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    this._allMeshes.push(m);
    if (parent) parent.add(m);
    return m;
  }

  _buildModel() {
    const skin    = smat(0xc09060);
    const armor   = smat(0x7b3a10);
    const armDk   = smat(0x4a2208);
    const tusk    = smat(0xfff8e0, 0.4);
    const axeBl   = smat(0x546e7a, 0.2, 0.7);
    const axeEdge = smat(0xb0bec5, 0.05, 0.9);
    const hndl    = smat(0x3a2510, 0.95);

    // 胴体
    const torso = this._box(1.3, 0.85, 1.0, armor, this.root);
    torso.position.set(0, 1.10, 0);

    // 鎧ストラップ
    for (const x of [-0.30, 0.30]) {
      const s = this._box(0.12, 0.88, 0.06, armDk, this.root);
      s.position.set(x, 1.10, -0.53);
    }
    // 肩パッド
    for (const x of [-0.82, 0.82]) {
      const sp = this._box(0.36, 0.30, 0.42, armDk, this.root);
      sp.position.set(x, 1.50, 0);
    }

    // 頭グループ
    const hg = new THREE.Group();
    hg.position.set(0, 1.68, -0.60);
    this.root.add(hg);
    this._headGroup = hg;

    this._box(0.74, 0.65, 0.70, skin, hg);

    const snout = this._box(0.48, 0.34, 0.28, skin, hg);
    snout.position.set(0, -0.10, -0.46);

    const nMat = smat(0x4a2a14);
    for (const nx of [-0.12, 0.12]) {
      const n = this._box(0.09, 0.07, 0.04, nMat, hg);
      n.position.set(nx, -0.13, -0.60);
    }

    for (const ex of [-0.40, 0.40]) {
      const ear = this._box(0.20, 0.32, 0.12, skin, hg);
      ear.position.set(ex, 0.36, 0.06);
      ear.rotation.z = ex > 0 ? 0.28 : -0.28;
    }

    for (const tx of [-0.22, 0.22]) {
      const tk = this._box(0.10, 0.10, 0.26, tusk, hg);
      tk.position.set(tx, -0.22, -0.54);
      tk.rotation.x = 0.25;
    }

    const helm = this._box(0.78, 0.24, 0.74, armDk, hg);
    helm.position.set(0, 0.30, 0);

    // 脚（4本）
    const legDefs = [[-0.40, -0.28], [0.40, -0.28], [-0.40, 0.28], [0.40, 0.28]];
    for (const [lx, lz] of legDefs) {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.50, lz);
      const leg = this._box(0.30, 0.56, 0.30, armor, piv);
      leg.position.y = -0.28;
      const hoop = this._box(0.34, 0.10, 0.34, armDk, piv);
      hoop.position.y = -0.08;
      this.root.add(piv);
      this._legs.push(piv);
    }

    // 右腕（斧を持つ）
    const armRG = new THREE.Group();
    armRG.position.set(0.82, 1.48, 0);
    this.root.add(armRG);
    this._armR = armRG;

    const uarm = this._box(0.26, 0.55, 0.26, armor, armRG);
    uarm.position.y = -0.28;

    const axeG = new THREE.Group();
    axeG.position.set(0.10, -0.62, 0);
    armRG.add(axeG);

    const hndlM = this._box(0.08, 1.40, 0.08, hndl, axeG);
    hndlM.position.y = -0.22;

    const bladeM = this._box(0.70, 0.60, 0.12, axeBl, axeG);
    bladeM.position.set(0.28, -0.80, 0);

    const edgeM = this._box(0.07, 0.60, 0.14, axeEdge, axeG);
    edgeM.position.set(0.64, -0.80, 0);

    // 左腕
    const armLG = new THREE.Group();
    armLG.position.set(-0.82, 1.48, 0);
    this.root.add(armLG);
    const uarmL = this._box(0.26, 0.55, 0.26, armor, armLG);
    uarmL.position.y = -0.28;
  }

  update(dt, player) {
    if (this.dying) {
      this._deathT += dt;
      const t = Math.min(1, this._deathT / 1.4);
      this.root.rotation.z = t * (Math.PI / 2.1);
      this.root.position.y = -t * 0.35 * this.root.scale.x;
      if (t >= 1) this.alive = false;
      return 0;
    }

    if (this._attackTimer > 0) this._attackTimer -= dt;
    if (this._hitStun > 0) { this._hitStun -= dt; return 0; }

    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001) {
      this.facing = Math.atan2(dx, dz);
      this.root.rotation.y = this.facing;
    }

    let damage = 0;
    const moving = dist > BOSS.ATTACK_RANGE;
    if (moving) {
      this.root.position.x += (dx / dist) * BOSS.MOVE_SPEED * dt;
      this.root.position.z += (dz / dist) * BOSS.MOVE_SPEED * dt;
    } else if (this._attackTimer <= 0 && player.alive) {
      this._attackTimer = BOSS.ATTACK_COOLDOWN;
      damage = BOSS.ATTACK_DAMAGE;
      this._swingAxe();
    }
    this._animateWalk(dt, moving);
    return damage;
  }

  _animateWalk(dt, moving) {
    this._phase += dt * (moving ? 2.2 : 0.5);
    const s = Math.sin(this._phase);
    if (moving) {
      this._legs[0].rotation.x =  s * 0.45;
      this._legs[1].rotation.x = -s * 0.45;
      this._legs[2].rotation.x = -s * 0.45;
      this._legs[3].rotation.x =  s * 0.45;
      this.root.rotation.z = s * 0.04;
    } else {
      for (const l of this._legs) l.rotation.x *= 1 - Math.min(1, dt * 8);
    }
    if (this._headGroup) {
      this._headGroup.rotation.z = Math.sin(this._phase * 0.45) * 0.06;
    }
  }

  _swingAxe() {
    if (!this._armR) return;
    this._armR.rotation.x = -1.4;
    setTimeout(() => {
      if (this._armR && !this.dying) {
        this._armR.rotation.x = 0.3;
        setTimeout(() => { if (this._armR && !this.dying) this._armR.rotation.x = 0; }, 160);
      }
    }, 200);
  }

  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= amount;
    this._hitStun = 0.18;
    this._flash();
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  _flash() {
    this._allMeshes.forEach(m => {
      const orig = m.material;
      const fl = orig.clone();
      fl.emissive = new THREE.Color(0xff2020);
      fl.emissiveIntensity = 1.2;
      m.material = fl;
      setTimeout(() => { if (m.parent) m.material = orig; }, 100);
    });
  }

  die() { this.dying = true; this._deathT = 0; }

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
