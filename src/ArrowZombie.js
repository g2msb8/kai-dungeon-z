// スケルトンアーチャー。プレイヤーから距離を取り、矢を射る。
// 矢のクールダウン 2 秒、攻撃力 1.5。
import * as THREE from 'three';
import { ARROW_ZOMBIE } from './core/Constants.js';

export class ArrowZombie {
  constructor(position, scene) {
    this._scene  = scene;
    this.hp      = ARROW_ZOMBIE.MAX_HP;
    this.alive   = true;
    this.dying   = false;
    this._deathT = 0;
    this._hitStun = 0;
    this._atkCd   = ARROW_ZOMBIE.ATTACK_COOLDOWN * 0.5; // 最初は半分のクールダウン
    this._arrows  = [];
    this._phase   = Math.random() * Math.PI * 2;

    const built = _buildSkeletonModel();
    this.root = built.root;
    this.root.position.copy(position);
    this.root.position.y = 0;
  }

  get position() { return this.root.position; }

  update(dt, player) {
    if (this.dying) {
      this._deathT += dt;
      const t = Math.min(1, this._deathT / 0.8);
      this.root.rotation.x  = t * (Math.PI / 2.2);
      this.root.position.y  = -t * 0.5;
      if (t >= 1) this.alive = false;
      return 0;
    }

    let damage = 0;

    // 矢の更新
    for (let i = this._arrows.length - 1; i >= 0; i--) {
      const a = this._arrows[i];
      a.life -= dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.z += a.vz * dt;
      a.vy -= 2.5 * dt;
      // 飛行方向に向ける
      const hspd = Math.hypot(a.vx, a.vz);
      a.mesh.rotation.y = Math.atan2(a.vx, a.vz);
      a.mesh.rotation.x = -Math.atan2(a.vy, hspd);

      const ddx = a.mesh.position.x - player.position.x;
      const ddz = a.mesh.position.z - player.position.z;
      if (Math.hypot(ddx, ddz) < 0.72 && Math.abs(a.mesh.position.y - 1.0) < 1.0) {
        damage += ARROW_ZOMBIE.ATTACK_DAMAGE;
        a.dead = true;
      }

      if (a.dead || a.life <= 0) {
        this._scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this._arrows.splice(i, 1);
      }
    }

    if (this._hitStun > 0) { this._hitStun -= dt; return damage; }

    const dx   = player.position.x - this.root.position.x;
    const dz   = player.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.01) this.root.rotation.y = Math.atan2(dx, dz);

    const PREF_MIN = ARROW_ZOMBIE.ATTACK_RANGE * 0.45;
    const PREF_MAX = ARROW_ZOMBIE.ATTACK_RANGE;

    if (dist < PREF_MIN) {
      this.root.position.x -= (dx / dist) * ARROW_ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z -= (dz / dist) * ARROW_ZOMBIE.MOVE_SPEED * dt;
    } else if (dist > PREF_MAX) {
      this.root.position.x += (dx / dist) * ARROW_ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z += (dz / dist) * ARROW_ZOMBIE.MOVE_SPEED * dt;
    }

    if (this._atkCd > 0) this._atkCd -= dt;
    if (this._atkCd <= 0 && dist <= PREF_MAX + 2) {
      this._shootArrow(player.position);
      this._atkCd = ARROW_ZOMBIE.ATTACK_COOLDOWN;
    }

    this._phase += dt * 1.8;

    return damage;
  }

  _shootArrow(targetPos) {
    const geo  = new THREE.BoxGeometry(0.04, 0.04, 0.48);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    const sx   = this.root.position.x;
    const sy   = this.root.position.y + 1.25;
    const sz   = this.root.position.z;
    mesh.position.set(sx, sy, sz);
    this._scene.add(mesh);

    const ddx = targetPos.x - sx;
    const ddy = (targetPos.y + 1.0) - sy;
    const ddz = targetPos.z - sz;
    const len = Math.max(0.1, Math.hypot(ddx, ddy, ddz));
    const spd = ARROW_ZOMBIE.ARROW_SPEED;

    this._arrows.push({
      mesh, dead: false, life: 2.5,
      vx: (ddx / len) * spd,
      vy: (ddy / len) * spd + 1.5,
      vz: (ddz / len) * spd,
    });
  }

  // 透明化時にその場で回転（ZombieManager の invisible ループ用）
  updateSpin(dt) {
    this.root.rotation.y += dt * 3;
  }

  takeDamage(amount) {
    if (this.dying) return false;
    this._hitStun = ARROW_ZOMBIE.HIT_STUN;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying  = true;
      this._deathT = 0;
      for (const a of this._arrows) {
        this._scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
      }
      this._arrows = [];
      return true;
    }
    return false;
  }

  dispose(scene) {
    for (const a of this._arrows) {
      scene.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mesh.material.dispose();
    }
    this._arrows = [];
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

function _buildSkeletonModel() {
  const root    = new THREE.Group();
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe0d8c8, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(0x300000), emissiveIntensity: 0.6,
  });

  // 頭（スカル）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.30), boneMat);
  head.position.y = 1.60;
  root.add(head);
  for (const ex of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), darkMat);
    eye.position.set(ex, 0.04, 0.16);
    head.add(eye);
  }

  // 胴体（リブケージ風）
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.55, 0.18), boneMat);
  torso.position.y = 1.12;
  root.add(torso);

  // 右腕（弦を引く）
  const armR = new THREE.Group();
  armR.position.set(0.27, 1.35, 0);
  armR.rotation.x = -1.2;
  const foreR = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.40, 5), boneMat);
  foreR.position.y = -0.20;
  armR.add(foreR);
  root.add(armR);

  // 左腕（弓を持つ）
  const armL = new THREE.Group();
  armL.position.set(-0.27, 1.35, 0);
  armL.rotation.x = -0.9;
  const foreL = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.40, 5), boneMat);
  foreL.position.y = -0.20;
  armL.add(foreL);
  root.add(armL);

  // 弓（左腕に装着）
  const bowMat = new THREE.MeshStandardMaterial({ color: 0x7a5c20, roughness: 0.75 });
  const bow    = new THREE.Group();
  const arc    = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.027, 5, 14, Math.PI), bowMat);
  arc.rotation.z = Math.PI / 2;
  bow.add(arc);
  const strMat = new THREE.MeshStandardMaterial({ color: 0xd0b880 });
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.56, 4), strMat);
  string.position.set(-0.28, 0, 0);
  bow.add(string);
  bow.position.set(-0.05, -0.28, 0.12);
  bow.rotation.y = 0.3;
  armL.add(bow);

  // 脚
  for (const sx of [-0.12, 0.12]) {
    const leg  = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.70, 5), boneMat);
    leg.position.set(sx, 0.48, 0);
    root.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.18), boneMat);
    foot.position.set(sx, 0.028, 0.04);
    root.add(foot);
  }

  return { root };
}
