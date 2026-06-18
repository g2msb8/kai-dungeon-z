// 弓矢ゾンビ：プレイヤーに向かって矢を放つ遠距離攻撃ゾンビ。
// 攻撃力 1.5 / クールダウン 2 秒 / 射程 15m
import * as THREE from 'three';
import { buildZombieModel } from './ZombieModel.js';
import { ARCHER_ZOMBIE } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class ArcherZombie {
  constructor(position, scene) {
    const model = buildZombieModel();
    this.root      = model.root;
    this.parts     = model.parts;
    this._allMeshes = model.allMeshes;
    this.root.position.copy(position);

    this._scene    = scene;
    this._arrows   = [];  // {mesh, vx, vy, vz, life}

    this._phase = Math.random() * Math.PI * 2;

    this.hp          = ARCHER_ZOMBIE.MAX_HP;
    this.alive       = true;
    this.attackTimer = 0;
    this.hitStun     = 0;
    this.dying       = false;
    this.deathT      = 0;
    this.facing      = 0;
    this._moving     = false;
    this._aiming     = false;

    this._buildBow();
    scene.add(this.root);
  }

  get position() { return this.root.position; }

  _buildBow() {
    // 弓：半円形のトーラス
    const bowMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.85 });
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 14, Math.PI), bowMat);
    bow.rotation.y = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(-0.30, 1.35, -0.15);
    this.root.add(bow);

    // 弦：細いシリンダー
    const strMat = new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.5 });
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.64, 4), strMat);
    str.rotation.z = Math.PI / 4;
    str.position.set(-0.48, 1.35, -0.15);
    this.root.add(str);

    // 矢（待機中）
    const arrowShaftMat = new THREE.MeshStandardMaterial({ color: 0x7a4a10 });
    const arrowHeadMat  = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), arrowShaftMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(-0.30, 1.35, -0.12);
    this.root.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.10, 5), arrowHeadMat);
    head.rotation.z = -Math.PI / 2;
    head.position.set(0.02, 1.35, -0.12);
    this.root.add(head);
  }

  // 矢を発射してプレイヤーに向かって飛ばす
  _fireArrow(target) {
    const dx = target.position.x - this.root.position.x;
    const dy = (target.position.y ?? 0) + 1.0 - (this.root.position.y + 1.35);
    const dz = target.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.1) return;

    const spd = ARCHER_ZOMBIE.ARROW_SPEED;
    const arrowMat  = new THREE.MeshStandardMaterial({ color: 0x7a4a10 });
    const arrowHead = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 });

    const g = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), arrowMat);
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.10, 5), arrowHead);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.33;
    g.add(tip);

    g.position.set(
      this.root.position.x,
      this.root.position.y + 1.35,
      this.root.position.z,
    );
    // 飛翔方向に向ける
    g.rotation.y = this.facing;
    g.rotation.z = -Math.atan2(dy, Math.hypot(dx, dz));

    this._scene.add(g);
    this._arrows.push({
      mesh: g,
      vx: (dx / dist) * spd,
      vy: (dy / dist) * spd,
      vz: (dz / dist) * spd,
      life: ARCHER_ZOMBIE.ARROW_LIFE,
    });
  }

  update(dt, target) {
    if (this.dying) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.85);
      this.root.rotation.x = t * (Math.PI / 2.2);
      this.root.position.y = -t * 0.5;
      if (t >= 1) this.alive = false;
      // 矢は最後まで飛ばし続ける
      return this._updateArrows(dt, target);
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitStun > 0) {
      this.hitStun -= dt;
      this._moving = false;
      this._animateShamble(dt, false);
      return this._updateArrows(dt, target);
    }

    const dx   = target.position.x - this.root.position.x;
    const dz   = target.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001) {
      this.facing = Math.atan2(dx, dz);
      this.root.rotation.y = this.facing;
    }

    this._moving = false;
    this._aiming = false;

    if (dist > ARCHER_ZOMBIE.ATTACK_RANGE) {
      // 射程外：接近する
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * ARCHER_ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z += nz * ARCHER_ZOMBIE.MOVE_SPEED * dt;
      this._moving = true;
    } else {
      // 射程内：クールダウンが切れたら発射
      this._aiming = true;
      if (this.attackTimer <= 0 && target.alive) {
        this.attackTimer = ARCHER_ZOMBIE.ATTACK_COOLDOWN;
        this._fireArrow(target);
        soundManager.playWhoosh();
      }
    }

    this._animateShamble(dt, this._moving);
    return this._updateArrows(dt, target);
  }

  _updateArrows(dt, target) {
    let dmg = 0;
    for (let i = this._arrows.length - 1; i >= 0; i--) {
      const a = this._arrows[i];
      a.life -= dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.z += a.vz * dt;
      a.vy -= 4 * dt; // 軽い重力

      // プレイヤーとの当たり判定
      const hx = a.mesh.position.x - target.position.x;
      const hz = a.mesh.position.z - target.position.z;
      const hy = a.mesh.position.y - ((target.position.y ?? 0) + 1.0);
      const hitDist = Math.hypot(hx, hy, hz);

      if (hitDist < ARCHER_ZOMBIE.HIT_RADIUS || a.life <= 0) {
        this._scene.remove(a.mesh);
        a.mesh.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        this._arrows.splice(i, 1);
        if (hitDist < ARCHER_ZOMBIE.HIT_RADIUS && target.alive) {
          dmg += ARCHER_ZOMBIE.ATTACK_DAMAGE;
        }
      }
    }
    return dmg;
  }

  _animateShamble(dt, moving) {
    this._phase += dt * 2.5;
    const ph = this._phase;
    const { head, torso, armL, armR, legL, legR } = this.parts;

    head.rotation.x = 0.28 + Math.sin(ph * 0.6) * 0.08;
    head.rotation.z = Math.sin(ph * 0.5) * 0.22;
    torso.rotation.z = Math.sin(ph * 0.45) * 0.07;
    torso.rotation.x = 0.08 + Math.abs(Math.sin(ph * 0.55)) * 0.05;

    if (this._aiming) {
      // 弓を引く構え：右腕を前、左腕を後ろに
      armR.rotation.x = -1.2;
      armL.rotation.x = -0.9;
      armR.rotation.z = -0.22;
      armL.rotation.z =  0.22;
    } else {
      armL.rotation.x = -1.2 + Math.sin(ph + 1.0) * 0.10;
      armR.rotation.x = -1.2 + Math.sin(ph) * 0.10;
      armL.rotation.z =  0.18;
      armR.rotation.z = -0.18;
    }

    if (moving) {
      legL.rotation.x =  Math.sin(ph) * 0.50;
      legR.rotation.x =  Math.sin(ph + Math.PI * 0.9) * 0.42;
    } else {
      legL.rotation.x *= 1 - Math.min(1, dt * 8);
      legR.rotation.x *= 1 - Math.min(1, dt * 8);
    }
  }

  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= amount;
    this.hitStun = ARCHER_ZOMBIE.HIT_STUN;
    this._flash();
    if (this.hp <= 0) {
      this.dying = true;
      this.deathT = 0;
      return true;
    }
    return false;
  }

  _flash() {
    this._allMeshes.forEach(m => {
      const orig = m.material;
      const flashMat = orig.clone();
      flashMat.emissive = new THREE.Color(0xff2020);
      flashMat.emissiveIntensity = 1.1;
      m.material = flashMat;
      setTimeout(() => { if (m) m.material = orig; }, 110);
    });
  }

  updateSpin(dt) {
    this._phase += dt * 2.5;
    this.root.rotation.y += dt * 4;
    this._animateShamble(dt, false);
  }

  dispose(scene) {
    // 飛んでいる矢を全削除
    for (const a of this._arrows) {
      this._scene.remove(a.mesh);
      a.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this._arrows = [];

    const s = scene || this._scene;
    s.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
