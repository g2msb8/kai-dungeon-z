// 主人公。移動・向き・攻撃・HPを管理。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { Sword } from './Sword.js';
import { PLAYER, COLORS, SPECIAL } from './core/Constants.js';
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

    // 特殊技状態
    this._dashTime = 0;     // ダッシュ残り時間(秒)
    this._jump     = null;  // ハイパージャンプ状態 {phase,t,vy,y}
  }

  get position() { return this.root.position; }

  // 武器を切り替える（ショップ購入後にステージ開始前に呼ぶ）
  setWeapon(type) {
    this.sword.dispose();
    this.sword = new Sword(this.armR, this.armL, type);
  }

  update(dt, move, bounds) {
    if (!this.alive) return;

    // ダッシュタイマー
    if (this._dashTime > 0) this._dashTime = Math.max(0, this._dashTime - dt);
    const dashing = this._dashTime > 0;

    const len = Math.hypot(move.x, move.z);
    this._moving = len > 0.05;

    const moveSpeed = PLAYER.MOVE_SPEED * (dashing ? SPECIAL.DASH_MULT : 1);

    if (this._moving) {
      const nx = move.x / len, nz = move.z / len;
      this.root.position.x += nx * moveSpeed * dt;
      this.root.position.z += nz * moveSpeed * dt;

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

    // ハイパージャンプの Y オフセット
    const jumpY = this._updateHyperJump(dt);

    // Y位置: 剣ジャンプ（copper/iron）+ ハイパージャンプ
    this.root.position.y = this.sword.getJumpY() + jumpY;

    // ボディチルト: バク転（iron）+ ダッシュ前傾
    this.root.rotation.x = this.sword.getBodyTiltX() + (dashing ? 0.32 : 0);

    // 足音
    soundManager.updateFootstep(dt, this._moving);

    // 歩行アニメ（攻撃中は腕をロック。ダッシュ中は素早く＝走り）
    const swinging = this.sword.swinging;
    const lockLeft = swinging && this.sword.weaponType === 'diamond';
    this.humanoid.update(dt, {
      moving: this._moving && !swinging,
      lockRightArm: true,
      lockLeftArm: lockLeft,
      speedScale: dashing ? 1.9 : 1,
    });

    return this.sword.update(dt);
  }

  // ─── 特殊技: ダッシュ ──────────────────────────────────────
  startDash() {
    this._dashTime = SPECIAL.DASH_DURATION;
    soundManager.playWhoosh();
  }

  // ─── 特殊技: ハイパージャンプ ──────────────────────────────
  // 黄色ボタンから呼ぶ。空中なら無視。
  startHyperJump() {
    if (this._jump) return false;
    this._jump = { phase: 'up', t: 0, vy: 0, y: 0 };
    soundManager.playWhoosh();
    return true;
  }

  get airborne() { return !!this._jump; }

  // 戻り値: ジャンプによる Y オフセット(m)
  _updateHyperJump(dt) {
    const j = this._jump;
    if (!j) return 0;

    if (j.phase === 'up') {
      // 2秒かけてイーズアウトで上昇
      j.t += dt;
      const k = Math.min(1, j.t / SPECIAL.JUMP_RISE_TIME);
      j.y = SPECIAL.JUMP_HEIGHT * Math.sin(k * Math.PI / 2);
      if (j.t >= SPECIAL.JUMP_RISE_TIME) {
        j.phase = 'down';
        j.vy = 0;
        j.y = SPECIAL.JUMP_HEIGHT;
      }
      return j.y;
    }

    // 落下
    j.vy -= SPECIAL.JUMP_GRAVITY * dt;
    j.y  += j.vy * dt;
    if (j.y <= 0) {
      this._jump = null;
      this.takeDamage(SPECIAL.JUMP_LAND_DAMAGE); // 着地ダメージ
      soundManager.playLand();
      return 0;
    }
    return j.y;
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
    this._dashTime = 0;
    this._jump     = null;
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
