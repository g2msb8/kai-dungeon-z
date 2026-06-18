// 紫の目のゾンビ（ボス敵）。Zombie.js とほぼ同じ実装だが、
// 目を紫に変更し、takeDamage は常に 1 ダメージしか受けない。
import * as THREE from 'three';
import { buildZombieModel } from './ZombieModel.js';
import { PURPLE_ZOMBIE } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class PurpleZombie {
  constructor(position) {
    const model = buildZombieModel();
    this.root = model.root;
    this.parts = model.parts;
    this._allMeshes = model.allMeshes;
    this.root.position.copy(position);

    // 目を紫グロウに変更（赤い emissive を持つメッシュを探す）
    this._allMeshes.forEach((m) => {
      const mat = m.material;
      if (!mat) return;
      const em = mat.emissive;
      if (em && em.r > 0.4 && em.g < 0.1 && em.b < 0.1) {
        mat.color.set(0xaa00cc);
        mat.emissive.set(0x8800aa);
        mat.emissiveIntensity = 2.0;
      }
    });

    this._phase = Math.random() * Math.PI * 2;

    this.hp = PURPLE_ZOMBIE.MAX_HP;
    this.alive = true;
    this.attackTimer = 0;
    this.hitStun = 0;
    this.dying = false;
    this.deathT = 0;
    this.facing = 0;
    this._moving = false;
    this._lunging = false;
  }

  get position() { return this.root.position; }

  update(dt, player) {
    if (this.dying) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.8);
      this.root.rotation.x = t * (Math.PI / 2.2);
      this.root.position.y = -t * 0.5;
      this.root.scale.setScalar(1 - t * 0.12);
      if (t >= 1) this.alive = false;
      return 0;
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitStun > 0) {
      this.hitStun -= dt;
      this._moving = false;
      this._animateShamble(dt, false);
      return 0;
    }

    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001) {
      this.facing = Math.atan2(dx, dz);
      this.root.rotation.y = this.facing;
    }

    let damage = 0;
    this._moving = false;

    if (dist > PURPLE_ZOMBIE.ATTACK_RANGE) {
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * PURPLE_ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z += nz * PURPLE_ZOMBIE.MOVE_SPEED * dt;
      this._moving = true;
    } else {
      if (this.attackTimer <= 0 && player.alive) {
        this.attackTimer = PURPLE_ZOMBIE.ATTACK_COOLDOWN;
        damage = PURPLE_ZOMBIE.ATTACK_DAMAGE;
        soundManager.playZombieAttack();
        this._lunge();
      }
    }

    this._animateShamble(dt, this._moving);
    return damage;
  }

  _animateShamble(dt, moving) {
    this._phase += dt * 2.4;
    const ph = this._phase;
    const { head, torso, armL, armR, legL, legR } = this.parts;

    head.rotation.x = 0.35 + Math.sin(ph * 0.7) * 0.10;
    head.rotation.z = Math.sin(ph * 0.55) * 0.30;

    torso.rotation.z = Math.sin(ph * 0.48) * 0.08;
    torso.rotation.x = 0.10 + Math.abs(Math.sin(ph * 0.6)) * 0.06;

    if (!this._lunging) {
      armL.rotation.x = -1.35 + Math.sin(ph + 1.0) * 0.12;
      armR.rotation.x = -1.35 + Math.sin(ph) * 0.12;
      armL.rotation.z =  0.18 + Math.sin(ph * 0.38) * 0.07;
      armR.rotation.z = -0.18 - Math.sin(ph * 0.38) * 0.07;
    }

    if (moving) {
      legL.rotation.x =  Math.sin(ph) * 0.55;
      legR.rotation.x =  Math.sin(ph + Math.PI * 0.88) * 0.44;
    } else {
      legL.rotation.x *= 1 - Math.min(1, dt * 9);
      legR.rotation.x *= 1 - Math.min(1, dt * 9);
    }
  }

  _lunge() {
    if (this._lunging) return;
    this._lunging = true;
    const { armL, armR, torso } = this.parts;
    armL.rotation.x = -1.85;
    armR.rotation.x = -1.85;
    torso.rotation.x = 0.40;
    setTimeout(() => {
      if (!this.dying && this.alive) {
        armL.rotation.x = -1.35;
        armR.rotation.x = -1.35;
        torso.rotation.x = 0.10;
      }
      this._lunging = false;
    }, 220);
  }

  // 透明化時にその場で回転（ZombieManager の invisible ループ用）
  updateSpin(dt) {
    this._phase += dt * 2.4;
    this.root.rotation.y += dt * 3;
    this._animateShamble(dt, false);
  }

  // 隕石などの即死系への対応（通常は 1 ダメージ制限を維持）
  freeze()      { /* 紫ゾンビは凍結しない */ }
  vaporizeDie() { if (!this.dying) { this.hp = 0; this.die(); } }

  // 常に 1 ダメージしか受けない（量を無視する）
  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= 1;
    this.hitStun = PURPLE_ZOMBIE.HIT_STUN;
    this._flash();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  _flash() {
    this._allMeshes.forEach((m) => {
      const orig = m.material;
      const flashMat = orig.clone();
      flashMat.emissive = new THREE.Color(0xcc00ff);
      flashMat.emissiveIntensity = 1.5;
      m.material = flashMat;
      setTimeout(() => { if (m) m.material = orig; }, 110);
    });
  }

  die() {
    this.dying = true;
    this.deathT = 0;
  }

  dispose(scene) {
    scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
