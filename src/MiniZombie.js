// 小型の速いゾンビ（子供サイズ）。Zombie.js とほぼ同じ実装。
// MINI_ZOMBIE 定数を使用し、スケールが小さい。
import * as THREE from 'three';
import { buildZombieModel } from './ZombieModel.js';
import { MINI_ZOMBIE } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class MiniZombie {
  constructor(position) {
    const model = buildZombieModel();
    this.root = model.root;
    this.parts = model.parts;
    this._allMeshes = model.allMeshes;
    this.root.position.copy(position);
    this.root.scale.setScalar(MINI_ZOMBIE.SCALE);

    this._phase = Math.random() * Math.PI * 2;

    this.hp = MINI_ZOMBIE.MAX_HP;
    this.alive = true;
    this.attackTimer = 0;
    this.hitStun = 0;
    this.dying = false;
    this.deathT = 0;
    this.facing = 0;
    this._moving = false;
    this._lunging = false;
    this._vanishing = false;
  }

  get position() { return this.root.position; }

  update(dt, player) {
    if (this.dying) {
      this.deathT += dt;
      if (this._vanishing) {
        const t = Math.min(1, this.deathT / 0.35);
        this.root.scale.setScalar(Math.max(0.001, (1 - t) * MINI_ZOMBIE.SCALE));
        if (t >= 1) this.alive = false;
        return 0;
      }
      const t = Math.min(1, this.deathT / 0.8);
      this.root.rotation.x = t * (Math.PI / 2.2);
      this.root.position.y = -t * 0.5;
      this.root.scale.setScalar((1 - t * 0.12) * MINI_ZOMBIE.SCALE);
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

    if (dist > MINI_ZOMBIE.ATTACK_RANGE) {
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * MINI_ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z += nz * MINI_ZOMBIE.MOVE_SPEED * dt;
      this._moving = true;
    } else {
      if (this.attackTimer <= 0 && player.alive) {
        this.attackTimer = MINI_ZOMBIE.ATTACK_COOLDOWN;
        damage = Math.max(0, MINI_ZOMBIE.ATTACK_DAMAGE - (this._burnAtkReduce || 0)); // 炎エンチャントで-3.5
        soundManager.playZombieAttack();
        this._lunge();
      }
    }

    this._animateShamble(dt, this._moving);
    return damage;
  }

  _animateShamble(dt, moving) {
    this._phase += dt * 3.0;
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

  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= amount;
    this.hitStun = MINI_ZOMBIE.HIT_STUN;
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
      flashMat.emissive = new THREE.Color(0xff2020);
      flashMat.emissiveIntensity = 1.1;
      m.material = flashMat;
      setTimeout(() => { if (m) m.material = orig; }, 110);
    });
  }

  die() {
    this.dying = true;
    this.deathT = 0;
  }

  vanish() {
    if (this.dying) return;
    this._vanishing = true;
    this.dying  = true;
    this.deathT = 0;
  }

  updateSpin(dt) {
    this._phase += dt * 3.0;
    this.root.rotation.y += dt * 4;
    this._animateShamble(dt, false);
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
