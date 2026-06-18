// 主人公。移動・向き・攻撃・HPを管理。分身・透明化・無敵も扱う。
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
    this._trainingBonus = 0;
    this._enhanceBonus  = 0;

    // 特殊技状態
    this._dashTime  = 0;     // ダッシュ残り時間(秒)
    this._jump      = null;  // ハイパージャンプ状態 {phase,t,vy,y}
    this._invisTime = 0;     // 透明化残り時間(秒)
    this.isInvisible = false;
    this._clones    = [];    // 分身リスト
  }

  get position()    { return this.root.position; }
  // インフェルノ攻撃中は無敵
  get invincible()  { return this.sword.swinging && this.sword.weaponType === 'inferno'; }

  // 武器を切り替える（ショップ購入後にステージ開始前に呼ぶ）
  setWeapon(type) {
    const tBonus = this._trainingBonus ?? 0;
    const eBonus = this._enhanceBonus  ?? 0;
    this.sword.dispose();
    this.sword = new Sword(this.armR, this.armL, type);
    this.sword._trainingBonus = tBonus;
    this.sword._enhanceBonus  = eBonus;
  }

  // 修行による攻撃力ボーナス（レベル × 0.2 の乗数）
  setTrainingBonus(n) {
    this._trainingBonus = n;
    this.sword._trainingBonus = n;
  }

  // 刀鍛冶屋強化ボーナス（武器種ごとの固定 +N ダメージ）
  setEnhanceBonus(n) {
    this._enhanceBonus = n;
    this.sword._enhanceBonus = n;
  }

  update(dt, move, bounds) {
    if (!this.alive) return;

    // ダッシュタイマー
    if (this._dashTime > 0) this._dashTime = Math.max(0, this._dashTime - dt);
    const dashing = this._dashTime > 0;

    // 透明化タイマー
    if (this._invisTime > 0) {
      this._invisTime -= dt;
      if (this._invisTime <= 0) {
        this.isInvisible = false;
        this.root.traverse(m => {
          if (m.isMesh && m.material) { m.material.transparent = false; m.material.opacity = 1.0; }
        });
      }
    }

    const len = Math.hypot(move.x, move.z);
    this._moving = len > 0.05;

    const moveSpeed = PLAYER.MOVE_SPEED * (dashing ? SPECIAL.DASH_MULT : 1);

    // インフェルノ: スイング中にトルネードスピン
    const spinY = this.sword.getBodySpinY();
    if (spinY !== 0) {
      this.facing += spinY * dt;
      this.root.rotation.y = this.facing;
    } else if (this._moving) {
      const nx = move.x / len, nz = move.z / len;
      this.root.position.x += nx * moveSpeed * dt;
      this.root.position.z += nz * moveSpeed * dt;

      const target = Math.atan2(-nx, -nz);
      this.facing = lerpAngle(this.facing, target, Math.min(1, PLAYER.TURN_SPEED * dt));
      this.root.rotation.y = this.facing;
    } else {
      this.root.rotation.y = this.facing;
    }

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

  // ─── 特殊技: 透明化 ────────────────────────────────────────
  startInvisibility() {
    this.isInvisible = true;
    this._invisTime  = SPECIAL.INVIS_DURATION;
    this.root.traverse(m => {
      if (m.isMesh && m.material) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.opacity = 0.12;
      }
    });
    soundManager.playWhoosh();
  }

  // ─── 特殊技: 分身 ────────────────────────────────────────
  startClone(scene) {
    for (const c of this._clones) c.dispose();
    this._clones = [];
    for (let i = 0; i < SPECIAL.CLONE_COUNT; i++) {
      const angle = (i / SPECIAL.CLONE_COUNT) * Math.PI * 2;
      const dist  = 3.5;
      const pos   = new THREE.Vector3(
        this.root.position.x + Math.sin(angle) * dist,
        0,
        this.root.position.z + Math.cos(angle) * dist,
      );
      this._clones.push(new Clone(scene, pos, this.sword.weaponType, this._trainingBonus ?? 0));
    }
    soundManager.playWhoosh();
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
    this._dashTime  = 0;
    this._jump      = null;
    this._invisTime = 0;
    this.isInvisible = false;
    this.root.traverse(m => {
      if (m.isMesh && m.material && m.material.transparent) {
        m.material.transparent = false;
        m.material.opacity = 1.0;
      }
    });
    for (const c of this._clones) c.dispose();
    this._clones = [];
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

// ─── 分身クラス ───────────────────────────────────────────────
export class Clone {
  constructor(scene, position, weaponType = 'copper', trainingBonus = 0) {
    const h = buildHumanoid({
      skin:        COLORS.PLAYER_SKIN,
      cloth:       COLORS.PLAYER_CLOTH,
      pants:       COLORS.PLAYER_PANTS,
      pantsAccent: COLORS.PLAYER_PANTS_DARK,
      skinDark:    COLORS.PLAYER_SKIN,
      face:        'player',
      hairColor:   COLORS.PLAYER_HAIR,
    });
    this.root = h.root;
    this.root.position.copy(position);
    // 青い発光で分身と分かるようにする
    this.root.traverse(m => {
      if (m.isMesh && m.material) {
        m.material = m.material.clone();
        m.material.emissive = new THREE.Color(0x0044cc);
        m.material.emissiveIntensity = 0.45;
        m.material.transparent = true;
        m.material.opacity = 0.82;
      }
    });

    // プレイヤーと同じ武器を持たせる
    this.sword = new Sword(h.parts.armR, h.parts.armL, weaponType);
    this.sword._trainingBonus = trainingBonus;
    this._humanoidUpdate = h.update;

    this.hp      = SPECIAL.CLONE_HP;
    this.alive   = true;
    this._scene  = scene;
    this._facing = 0;
    this._moving = false;

    scene.add(this.root);
  }

  get position() { return this.root.position; }
  // resolveAttack() の arc 計算に合わせた facing (Player と同規約)
  get facing()   { return this._facing; }

  // 戻り値: doHit — 攻撃判定が発生したフレームは true
  update(dt, targets) {
    if (!this.alive) return false;

    const doHit = this.sword.update(dt);

    // インフェルノ用スピン
    const spinY = this.sword.getBodySpinY();
    if (spinY !== 0) {
      this._facing += spinY * dt;
      this.root.rotation.y = this._facing;
    }

    // ダイヤモンド用前進
    const fwdVel = this.sword.getForwardVelocity();
    if (Math.abs(fwdVel) > 0.001) {
      this.root.position.x += -Math.sin(this._facing) * fwdVel * dt;
      this.root.position.z += -Math.cos(this._facing) * fwdVel * dt;
    }

    // copper/iron: ジャンプ・傾き
    this.root.position.y = this.sword.getJumpY();
    this.root.rotation.x = this.sword.getBodyTiltX();

    // 最近接ターゲットを探す
    let nearest = null, nearestDist = Infinity;
    for (const z of targets) {
      if (!z.alive || z.dying) continue;
      const d = Math.hypot(z.position.x - this.root.position.x, z.position.z - this.root.position.z);
      if (d < nearestDist) { nearestDist = d; nearest = z; }
    }

    this._moving = false;
    if (nearest && spinY === 0) {
      const dx = nearest.position.x - this.root.position.x;
      const dz = nearest.position.z - this.root.position.z;
      const dist = Math.hypot(dx, dz);
      // Player と同じ facing 規約 (atan2(-nx, -nz)) にして arc 判定を合わせる
      this._facing = Math.atan2(-dx / dist, -dz / dist);
      this.root.rotation.y = this._facing;

      if (dist > SPECIAL.CLONE_ATTACK_RANGE) {
        this.root.position.x += (dx / dist) * SPECIAL.CLONE_MOVE_SPEED * dt;
        this.root.position.z += (dz / dist) * SPECIAL.CLONE_MOVE_SPEED * dt;
        this._moving = true;
      } else if (this.sword.ready) {
        this.sword.startSwing();
      }
    }

    this._humanoidUpdate(dt, {
      moving: this._moving && !this.sword.swinging,
      lockRightArm: true,
      lockLeftArm: this.sword.swinging && this.sword.weaponType === 'diamond',
      speedScale: 1,
    });

    return doHit;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.alive = false;
      this.dispose();
    }
  }

  dispose() {
    if (this._scene) {
      this.sword.dispose();
      this._scene.remove(this.root);
      this._scene = null;
    }
  }
}
