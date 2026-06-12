// ゾンビ個体。主人公を追尾し、近づくと攻撃。被弾・死亡を扱う。
// モデルは ZombieModel.js の専用ビルダーを使用。
import * as THREE from 'three';
import { buildZombieModel } from './ZombieModel.js';
import { ZOMBIE } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class Zombie {
  constructor(position) {
    const model = buildZombieModel();
    this.root = model.root;
    this.parts = model.parts;
    this._allMeshes = model.allMeshes;
    this.root.position.copy(position);

    // アニメーション用位相（各個体でランダムにずらして一斉感をなくす）
    this._phase = Math.random() * Math.PI * 2;

    this.hp = ZOMBIE.MAX_HP;
    this.alive = true;
    this.attackTimer = 0;
    this.hitStun = 0;
    this.dying = false;
    this.deathT = 0;
    this.facing = 0;
    this._moving = false;
    this._lunging = false;

    // 隕石による凍結（true の間は動かず攻撃しない）
    this.frozen = false;
    this._frozenX = 0;
    this._frozenZ = 0;
    this._vaporize = false; // 蒸発death演出フラグ
  }

  get position() { return this.root.position; }

  // 戻り値: このフレームで主人公に与えるダメージ量(0なら無し)
  update(dt, player) {
    if (this.dying) {
      this.deathT += dt;
      if (this._vaporize) {
        // 蒸発: 上昇しながら縮んで回転して消える
        const t = Math.min(1, this.deathT / 0.9);
        this.root.position.y = t * 1.6;
        this.root.rotation.y += dt * 6;
        this.root.scale.setScalar(Math.max(0.001, 1 - t));
        if (t >= 1) this.alive = false;
        return 0;
      }
      const t = Math.min(1, this.deathT / 0.8);
      // 前方へ崩れ落ちる演出
      this.root.rotation.x = t * (Math.PI / 2.2);
      this.root.position.y = -t * 0.5;
      this.root.scale.setScalar(1 - t * 0.12);
      if (t >= 1) this.alive = false;
      return 0;
    }

    // 隕石で凍結中: その場で小刻みに震えるだけ
    if (this.frozen) {
      this._phase += dt * 28;
      this.root.position.x = this._frozenX + Math.sin(this._phase) * 0.03;
      this.root.position.z = this._frozenZ + Math.cos(this._phase * 1.3) * 0.02;
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

    // 主人公の方を向く
    if (dist > 0.001) {
      this.facing = Math.atan2(dx, dz);
      this.root.rotation.y = this.facing;
    }

    let damage = 0;
    this._moving = false;

    if (dist > ZOMBIE.ATTACK_RANGE) {
      // 追尾
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * ZOMBIE.MOVE_SPEED * dt;
      this.root.position.z += nz * ZOMBIE.MOVE_SPEED * dt;
      this._moving = true;
    } else {
      // 攻撃レンジ内
      if (this.attackTimer <= 0 && player.alive) {
        this.attackTimer = ZOMBIE.ATTACK_COOLDOWN;
        damage = ZOMBIE.ATTACK_DAMAGE;
        soundManager.playZombieAttack(); // ガオー + バシッ
        this._lunge();
      }
    }

    this._animateShamble(dt, this._moving);
    return damage;
  }

  // ─── ゾンビシャンブルアニメーション ───────────────────────
  _animateShamble(dt, moving) {
    // ランダムオフセット入りで各個体の動きがバラバラに見える
    this._phase += dt * 2.4;
    const ph = this._phase;
    const { head, torso, armL, armR, legL, legR } = this.parts;

    // 頭：うなだれながら左右にぐらつく（グロテスクな不規則感）
    head.rotation.x = 0.35 + Math.sin(ph * 0.7) * 0.10;
    head.rotation.z = Math.sin(ph * 0.55) * 0.30;

    // 胴体：左右にうねるように揺れる
    torso.rotation.z = Math.sin(ph * 0.48) * 0.08;
    torso.rotation.x = 0.10 + Math.abs(Math.sin(ph * 0.6)) * 0.06;

    if (!this._lunging) {
      // 腕：水平前方ゾンビポーズ。左右で位相をずらして生気のないうねり
      armL.rotation.x = -1.35 + Math.sin(ph + 1.0) * 0.12;
      armR.rotation.x = -1.35 + Math.sin(ph) * 0.12;
      armL.rotation.z =  0.18 + Math.sin(ph * 0.38) * 0.07;
      armR.rotation.z = -0.18 - Math.sin(ph * 0.38) * 0.07;
    }

    // 脚：非対称のひきずり歩き（左右で振り幅・位相が違う ＝ リンプ）
    if (moving) {
      legL.rotation.x =  Math.sin(ph) * 0.55;
      legR.rotation.x =  Math.sin(ph + Math.PI * 0.88) * 0.44; // 少しずれてびっこ
    } else {
      legL.rotation.x *= 1 - Math.min(1, dt * 9);
      legR.rotation.x *= 1 - Math.min(1, dt * 9);
    }
  }

  // ─── 攻撃ルンジ ────────────────────────────────────────────
  _lunge() {
    if (this._lunging) return;
    this._lunging = true;
    const { armL, armR, torso } = this.parts;
    // 腕を思い切り前に突き出し、胴体を大きく前傾
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

  // ─── 被弾 ──────────────────────────────────────────────────
  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= amount;
    this.hitStun = ZOMBIE.HIT_STUN;
    this._flash();
    if (this.hp <= 0) {
      this.die();
      return true; // 撃破
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

  // ─── 死亡 ──────────────────────────────────────────────────
  die() {
    this.dying = true;
    this.deathT = 0;
  }

  // ─── 隕石: 凍結 ────────────────────────────────────────────
  freeze() {
    this.frozen = true;
    this._frozenX = this.root.position.x;
    this._frozenZ = this.root.position.z;
  }

  // ─── 隕石: 蒸発して死亡 ────────────────────────────────────
  vaporizeDie() {
    this.frozen = false;
    this._vaporize = true;
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
