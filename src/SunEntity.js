// 太陽の中ステージの敵。自分（主人公）と同じスキン・攻撃力・強さ。
// ただし特殊技は使わない。zombies 配列で扱える Zombie 互換インターフェース。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { getPlayerOutfit } from './PlayerSkin.js';
import { Sword } from './Sword.js';
import { SUN_ENTITY } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class SunEntity {
  constructor(position, weaponType = 'copper', damage = 20) {
    const h = buildHumanoid(getPlayerOutfit()); // 自分と同じスキン
    this.root = h.root;
    this.root.position.copy(position);
    this.root.scale.setScalar(1.25);

    // 敵だと分かるよう赤いオーラ
    this.root.traverse(o => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0xff2200);
        o.material.emissiveIntensity = 0.3;
        o.castShadow = true;
      }
    });

    this._h    = h;
    this.sword = new Sword(h.parts.armR, h.parts.armL, weaponType);
    this._damage = damage;

    this.hp     = SUN_ENTITY.MAX_HP;
    this.alive  = true;
    this.dying  = false;
    this.deathT = 0;
    this.facing = 0;
    this.attackTimer = 0;
    this.hitStun = 0;
    this._moving = false;

    this._allMeshes = [];
    this.root.traverse(o => { if (o.isMesh) this._allMeshes.push(o); });
  }

  get position() { return this.root.position; }

  update(dt, player) {
    this.sword.update(dt); // 剣の振りアニメ

    if (this.dying) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.8);
      this.root.rotation.x = t * (Math.PI / 2.2);
      this.root.position.y = -t * 0.5;
      if (t >= 1) this.alive = false;
      return 0;
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitStun > 0) {
      this.hitStun -= dt;
      this._h.update(dt, { moving: false });
      return 0;
    }

    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) {
      this.facing = Math.atan2(-dx / dist, -dz / dist); // プレイヤー規約で正対
      this.root.rotation.y = this.facing;
    }

    let damage = 0;
    this._moving = false;
    if (dist > SUN_ENTITY.ATTACK_RANGE) {
      const nx = dx / dist, nz = dz / dist;
      this.root.position.x += nx * SUN_ENTITY.MOVE_SPEED * dt;
      this.root.position.z += nz * SUN_ENTITY.MOVE_SPEED * dt;
      this._moving = true;
    } else if (this.attackTimer <= 0 && player.alive) {
      this.attackTimer = SUN_ENTITY.ATTACK_COOLDOWN;
      damage = this._damage;          // 自分と同じ攻撃力
      this.sword.startSwing();
      soundManager.playAttack();
    }

    this._h.update(dt, { moving: this._moving && !this.sword.swinging, lockRightArm: true });
    return damage;
  }

  takeDamage(amount) {
    if (this.dying) return false;
    this.hp -= amount;
    this.hitStun = SUN_ENTITY.HIT_STUN;
    this._flash();
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  _flash() {
    this._allMeshes.forEach(m => {
      const orig = m.material;
      const f = orig.clone();
      f.emissive = new THREE.Color(0xff4040);
      f.emissiveIntensity = 1.1;
      m.material = f;
      setTimeout(() => { if (m) m.material = orig; }, 110);
    });
  }

  die() { this.dying = true; this.deathT = 0; }

  updateSpin(dt) { this.root.rotation.y += dt * 4; this._h.update(dt, { moving: false }); }

  dispose(scene) {
    if (this.sword && this.sword.dispose) this.sword.dispose();
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
