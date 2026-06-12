// 主人公。移動・向き・攻撃・HPを管理。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { Sword } from './Sword.js';
import { PLAYER, COLORS } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class Player {
  constructor() {
    const h = buildHumanoid({
      skin:        COLORS.PLAYER_SKIN,
      cloth:       COLORS.PLAYER_CLOTH,
      pants:       COLORS.PLAYER_PANTS,
      pantsAccent: COLORS.PLAYER_PANTS_DARK,
      skinDark:    COLORS.PLAYER_SKIN,
      face:        'player',
      hairColor:   COLORS.PLAYER_HAIR,
    });
    this.humanoid = h;
    this.root  = h.root;
    this.armR  = h.parts.armR;
    this.armL  = h.parts.armL;
    this.sword = new Sword(this.armR, this.armL, 'copper');

    this.hp      = PLAYER.MAX_HP;
    this.facing  = 0;
    this.alive   = true;
    this._moving = false;
  }

  get position() { return this.root.position; }

  // 武器を切り替える（ショップ購入後にステージ開始前に呼ぶ）
  setWeapon(type) {
    this.sword.dispose();
    this.sword = new Sword(this.armR, this.armL, type);
  }

  update(dt, move, bounds) {
    if (!this.alive) return;

    const len = Math.hypot(move.x, move.z);
    this._moving = len > 0.05;

    if (this._moving) {
      const nx = move.x / len, nz = move.z / len;
      this.root.position.x += nx * PLAYER.MOVE_SPEED * dt;
      this.root.position.z += nz * PLAYER.MOVE_SPEED * dt;

      const target = Math.atan2(-nx, -nz);
      this.facing = lerpAngle(this.facing, target, Math.min(1, PLAYER.TURN_SPEED * dt));
    }
    this.root.rotation.y = this.facing;

    // ダイヤの剣のダッシュ前進
    const fwdVel = this.sword.getForwardVelocity();
    if (Math.abs(fwdVel) > 0.001) {
      this.root.position.x += -Math.sin(this.facing) * fwdVel * dt;
      this.root.position.z += -Math.cos(this.facing) * fwdVel * dt;
    }

    // 円形プレイエリア内に制限
    if (bounds) {
      const d = Math.hypot(this.root.position.x, this.root.position.z);
      if (d > bounds.radius) {
        this.root.position.x *= bounds.radius / d;
        this.root.position.z *= bounds.radius / d;
      }
    }

    // Y位置: ジャンプ（copper/iron）
    this.root.position.y = this.sword.getJumpY();

    // ボディチルト: バク転（iron）
    this.root.rotation.x = this.sword.getBodyTiltX();

    // 足音
    soundManager.updateFootstep(dt, this._moving);

    // 歩行アニメ（攻撃中は腕をロック）
    const swinging = this.sword.swinging;
    const lockLeft = swinging && this.sword.weaponType === 'diamond';
    this.humanoid.update(dt, {
      moving: this._moving && !swinging,
      lockRightArm: true,
      lockLeftArm: lockLeft,
    });

    return this.sword.update(dt);
  }

  tryAttack() {
    const started = this.sword.startSwing();
    if (started) soundManager.playAttack();
    return started;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.alive = false;
  }

  reset() {
    this.hp     = PLAYER.MAX_HP;
    this.alive  = true;
    this.facing = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
