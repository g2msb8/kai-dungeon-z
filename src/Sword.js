// 武器システム — copper / iron / diamond / netherite の4種に対応。
// Sword クラスは armR (+ 必要なら armL) を受け取り、
// 攻撃アニメーション・ジャンプ・ボディチルト・前進速度を管理する。
import * as THREE from 'three';
import { WEAPONS } from './core/Constants.js';

// ─── ヘルパー ─────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v)    { return Math.max(0, Math.min(1, v)); }
function easeIn(t)     { return t * t; }
function easeOut(t)    { return 1 - (1 - t) * (1 - t); }

// ─── 武器別タイミング定数 ──────────────────────────────────
const COPPER = {
  T_RISE: 0.28, T_PEAK: 0.45, T_SLAM: 0.68, T_TOTAL: 0.78,
  JUMP_H: 1.45, ARM_RAISE: 1.55, ARM_SLAM: -2.70,
  COOLDOWN: 1.20,
};
const IRON = {
  T_RISE: 0.30, T_PEAK: 0.48, T_SLAM: 0.68, T_TOTAL: 0.83,
  JUMP_H: 1.75, ARM_RAISE: 1.55, ARM_SLAM: -2.70,
  BODY_MAX: -Math.PI * 0.68,   // バク転最大傾き（後方）
  COOLDOWN: 1.10,
};
const DIAMOND = {
  T_RUSH: 0.18, T_STAB_END: 0.72, T_TOTAL: 0.88,
  RUSH_VEL: 5.5,               // ダッシュ速度 m/s
  STAB_FREQ: 18,               // 刺し頻度 (rad/s → sin周期)
  ARM_FWD: -1.90, ARM_BACK: -0.15,
  BODY_TILT: -0.22,
  COOLDOWN: 1.10,
};
const NETHERITE = {
  T_RAISE: 0.38, T_CHARGE: 0.72, T_FIRE: 0.82, T_TOTAL: 1.25,
  ARM_RAISED: 2.10,
  COOLDOWN: 1.50,
};
const LIGHT_SW = {
  T_RAISE: 0.20, T_CHARGE: 0.42, T_FIRE: 0.52, T_TOTAL: 0.92,
  ARM_FWD: -1.60,
  COOLDOWN: 1.0,
};
const BLACKHOLE_SW = {
  T_RAISE: 0.28, T_DARK: 0.58, T_HIT1: 0.76, T_HIT2: 0.96, T_TOTAL: 1.38,
  ARM_RAISED: 2.10,
  COOLDOWN: 1.55,
};
const LIGHTNING_SW = {
  T_RAISE: 0.16,                          // 腕を天に掲げる
  T_CHARGE: 0.32,                         // チャージ（剣が激しく輝く）
  // 5連斬り下ろし
  T_SLASH1: 0.43, T_UP1: 0.48,
  T_SLASH2: 0.59, T_UP2: 0.64,
  T_SLASH3: 0.75, T_UP3: 0.80,
  T_SLASH4: 0.91, T_UP4: 0.96,
  T_SLASH5: 1.07,
  T_TOTAL: 1.36,
  ARM_RAISED: 1.90,
  ARM_SLASH: -2.70,
  COOLDOWN: 1.55,
};
const BUBBLE_SW = {
  T_RAISE: 0.20, T_CHARGE: 0.50, T_FIRE: 0.80, T_TOTAL: 1.30,
  ARM_RAISED: 2.00,
  COOLDOWN: 2.0,
};
const ICE_SW = {
  T_RAISE: 0.20, T_GLOW: 0.50, T_FIRE: 0.90, T_TOTAL: 1.50,
  ARM_RAISED: 1.80,
  COOLDOWN: 2.5,
};
const INFERNO_SW = {
  // 0〜1.0: スピン、1.0〜3.0: 赤いチャージ、3.0: 発射
  T_SPIN_END: 1.0,
  T_CHARGE_END: 3.0,
  T_FIRE: 3.0,
  T_TOTAL: 3.5,
  ARM_RAISED: 2.10,
  COOLDOWN: 6.0,
};

// ─── 剣メッシュ生成ヘルパー ─────────────────────────────────
function _makeSwordGroup(bladeMat, guardColor, addNick) {
  const group = new THREE.Group();
  const gMat = new THREE.MeshStandardMaterial({
    color: guardColor, roughness: 0.5, metalness: 0.4,
  });

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.88, 0.022), bladeMat
  );
  blade.position.y = 0.44;
  group.add(blade);

  if (addNick) {
    const nick = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.06, 0.028),
      new THREE.MeshStandardMaterial({ color: 0x8a5a20, roughness: 1.0, metalness: 0.2 })
    );
    nick.position.set(0, 0.30, 0);
    group.add(nick);
  }

  const guardH = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.055, 0.075), gMat);
  const guardV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14,  0.075), gMat.clone());
  guardV.position.y = -0.045;

  const hiltMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
  const hilt    = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.25, 0.058), hiltMat);
  hilt.position.y = -0.165;
  const wrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.07, 0.065),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 })
  );
  wrap.position.y = -0.14;
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.09), gMat.clone());
  pommel.position.y = -0.31;

  group.add(guardH, guardV, hilt, wrap, pommel);
  return group;
}

// ─── Sword クラス ─────────────────────────────────────────
export class Sword {
  /**
   * @param {THREE.Group} armR  右腕ピボット
   * @param {THREE.Group} armL  左腕ピボット（diamond で使用）
   * @param {string}      weaponType  'copper'|'iron'|'diamond'|'netherite'
   */
  constructor(armR, armL, weaponType = 'copper') {
    this.armR       = armR;
    this.armPivot   = armR;   // 後方互換
    this.armL       = armL;
    this.weaponType = weaponType;

    this.swinging          = false;
    this.swingT            = 0;
    this.cooldown          = 0;
    this._swingHitCount    = 0;

    this._bodyTiltX  = 0;
    this._forwardVel = 0;
    this.mesh        = null;
    this._leftSword  = null;
    this._bladeMat   = null;

    this.restRot = -0.44;
    this._buildMesh();
    this.armR.rotation.x = this.restRot;
  }

  // ─── 公開プロパティ ─────────────────────────────────────
  get wData()  { return WEAPONS[this.weaponType] || WEAPONS.copper; }
  get damage() { return Math.round(this.wData.damage * (1 + (this._trainingBonus ?? 0)) * (this._enlargeMult ?? 1)) + (this._enhanceBonus ?? 0); }
  get isAoe()  { return this.wData.aoe; }
  get ready()  { return !this.swinging && this.cooldown <= 0; }

  // ─── メッシュ構築 ────────────────────────────────────────
  _buildMesh() {
    const wd = this.wData;
    const bladeMat = new THREE.MeshStandardMaterial({
      color:             wd.bladeColor,
      roughness:         0.25,
      metalness:         0.8,
      emissive:          wd.glowColor ? new THREE.Color(wd.glowColor) : new THREE.Color(0x000000),
      emissiveIntensity: wd.glowColor ? 0.35 : 0,
    });
    this._bladeMat = bladeMat;

    const group = _makeSwordGroup(bladeMat, wd.guardColor, this.weaponType === 'copper');
    group.position.set(0.03, -0.56, 0.13);
    group.rotation.x = -0.72;
    group.rotation.z =  0.11;
    this.mesh = group;
    this.armR.add(group);

    // ライトニング: 刃に黄色ストライプを追加
    if (this.weaponType === 'lightning') {
      const sMat = new THREE.MeshStandardMaterial({
        color: 0xffdd00, emissive: new THREE.Color(0xffdd00), emissiveIntensity: 0.9, roughness: 0.2,
      });
      [0.18, 0.42, 0.66].forEach(y => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.028), sMat.clone());
        stripe.position.set(0, y, 0);
        stripe.rotation.z = 0.35;
        group.add(stripe);
      });
    }

    // ダイヤ: 左手にも剣を装備
    if (this.weaponType === 'diamond') {
      const left = _makeSwordGroup(bladeMat.clone(), wd.guardColor, false);
      left.position.set(-0.03, -0.56, 0.13);
      left.rotation.x = -0.72;
      left.rotation.z = -0.11;
      this._leftSword = left;
      this.armL.add(left);
    }
  }

  // ─── クリーンアップ ──────────────────────────────────────
  dispose() {
    this._clearEnchantAura();
    if (this.mesh)      { this.armR.remove(this.mesh);      this.mesh      = null; }
    if (this._leftSword){ this.armL.remove(this._leftSword); this._leftSword = null; }
    this.armR.rotation.x = this.restRot;
  }

  // ─── 剣エンチャントの見た目（炎/リーフ/毒のオーラ）─────────
  setEnchant(type) {
    this.enchant = type || null;
    this._clearEnchantAura();
    if (!this.enchant || !this.mesh) return;
    this._buildEnchantAura(this.enchant);
  }

  _clearEnchantAura() {
    this._enchParticles = [];
    if (this._enchAura) {
      this._enchAura.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); }
      });
      if (this._enchAura.parent) this._enchAura.parent.remove(this._enchAura);
      this._enchAura = null;
    }
  }

  _buildEnchantAura(type) {
    const g = new THREE.Group();
    g.position.set(0, 0.38, 0); // 刃の中ほど
    const COLS = {
      fire:   { aura: 0xff3300, emis: 0xff5a1e },
      leaf:   { aura: 0x33dd44, emis: 0x12aa22 },
      poison: { aura: 0xaa44dd, emis: 0x8e24aa },
      ice:    { aura: 0x88ddff, emis: 0x0099cc },
      money:  { aura: 0xffee44, emis: 0xcc8800 },
      curse:  { aura: 0xcc44ff, emis: 0x660099 },
    };
    const c = COLS[type] || COLS.fire;

    // 刃を包むオーラ（縦長の半透明シリンダー）
    const aura = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.10, 0.95, 10, 1, true),
      new THREE.MeshStandardMaterial({
        color: c.aura, emissive: c.emis, emissiveIntensity: 1.6,
        transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      }),
    );
    g.add(aura);
    this._enchAuraCore = aura;

    this._enchParticles = [];
    if (type === 'fire') {
      // 真ん中に火花
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4),
          new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xff8800, emissiveIntensity: 2.2 }));
        g.add(sp);
        this._enchParticles.push({ mesh: sp, base: Math.random() * Math.PI * 2 });
      }
    } else if (type === 'poison') {
      // 上から紫の小さいシャボン玉
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5),
          new THREE.MeshStandardMaterial({ color: 0xcc88ff, emissive: 0x8e24aa, emissiveIntensity: 1.2, transparent: true, opacity: 0.75 }));
        g.add(b);
        this._enchParticles.push({ mesh: b, y: Math.random() * 0.9, x: (Math.random() - 0.5) * 0.2, z: (Math.random() - 0.5) * 0.2, spd: 0.4 + Math.random() * 0.5 });
      }
    }

    this.mesh.add(g);
    this._enchAura = g;
    this._enchT = 0;
  }

  _updateEnchant(dt) {
    if (!this._enchAura) return;
    this._enchT += dt;
    const t = this._enchT;
    if (this._enchAuraCore) {
      this._enchAuraCore.material.opacity = 0.3 + Math.sin(t * 8) * 0.15;
      this._enchAuraCore.rotation.y += dt * 2;
    }
    if (this.enchant === 'fire') {
      for (const p of this._enchParticles) {
        const a = p.base + t * 10;
        p.mesh.position.set(Math.sin(a) * 0.05, ((t * 1.5 + p.base) % 1) * 0.6 - 0.1, Math.cos(a) * 0.05);
        p.mesh.material.emissiveIntensity = 1.5 + Math.sin(t * 20 + p.base) * 0.8;
      }
    } else if (this.enchant === 'poison') {
      for (const p of this._enchParticles) {
        p.y += p.spd * dt;
        if (p.y > 0.9) p.y = -0.1;
        p.mesh.position.set(p.x, p.y - 0.4, p.z);
        p.mesh.material.opacity = 0.4 + Math.sin(t * 4 + p.y * 6) * 0.3;
      }
    }
  }

  // ─── 攻撃開始 ────────────────────────────────────────────
  startSwing() {
    if (!this.ready) return false;
    this.swinging        = true;
    this.swingT          = 0;
    this._swingHitCount  = 0;
    this._bodyTiltX      = 0;
    this._forwardVel     = 0;
    return true;
  }

  // ─── Player.js へ公開する値 ─────────────────────────────
  getBodyTiltX()      { return this._bodyTiltX; }
  getForwardVelocity(){ return this._forwardVel; }

  getJumpY() {
    if (!this.swinging) return 0;
    if (this.weaponType === 'copper') return this._jumpY(COPPER);
    if (this.weaponType === 'iron')   return this._jumpY(IRON);
    return 0;
  }

  _jumpY(p) {
    const t = this.swingT;
    if (t < p.T_RISE) {
      return p.JUMP_H * easeIn(t / p.T_RISE);
    } else if (t < p.T_PEAK) {
      return p.JUMP_H;
    } else if (t < p.T_SLAM) {
      const ph = (t - p.T_PEAK) / (p.T_SLAM - p.T_PEAK);
      return p.JUMP_H * (1 - easeOut(ph));
    }
    return 0;
  }

  // ─── 毎フレーム更新（true = ヒット判定すべきフレーム） ───
  update(dt) {
    this._updateEnchant(dt); // エンチャントオーラのアニメ
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.swinging)    return false;

    this.swingT += dt;
    switch (this.weaponType) {
      case 'iron':      return this._updateIron();
      case 'diamond':   return this._updateDiamond(dt);
      case 'netherite': return this._updateNetherite();
      case 'light':     return this._updateLight();
      case 'blackhole': return this._updateBlackhole();
      case 'lightning': return this._updateLightning();
      case 'bubble':    return this._updateBubble();
      case 'ice':       return this._updateIce();
      case 'inferno':   return this._updateInferno();
      default:          return this._updateCopper();
    }
  }

  // ══ copper: ジャンプ叩きつけ ══════════════════════════════
  _updateCopper() {
    const p = COPPER;
    const t = clamp01(this.swingT / p.T_TOTAL);
    let doHit = false;

    if (this.swingT < p.T_RISE) {
      const ph = this.swingT / p.T_RISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISE, easeIn(ph));
    } else if (this.swingT < p.T_PEAK) {
      this.armR.rotation.x = p.ARM_RAISE;
    } else if (this.swingT < p.T_SLAM) {
      const ph = (this.swingT - p.T_PEAK) / (p.T_SLAM - p.T_PEAK);
      this.armR.rotation.x = lerp(p.ARM_RAISE, p.ARM_SLAM, easeIn(ph));
      if (this._swingHitCount < 1 && ph >= 0.60) {
        this._swingHitCount++; doHit = true;
      }
    } else {
      const ph = (this.swingT - p.T_SLAM) / (p.T_TOTAL - p.T_SLAM);
      this.armR.rotation.x = lerp(p.ARM_SLAM, this.restRot, easeOut(ph));
    }

    if (this.swingT >= p.T_TOTAL) this._endSwing(p.COOLDOWN);
    return doHit;
  }

  // ══ iron: バク転 → 上から斬り下ろし ══════════════════════
  _updateIron() {
    const p = IRON;
    let doHit = false;

    if (this.swingT < p.T_RISE) {
      const ph = this.swingT / p.T_RISE;
      // 腕: 同時に振り上げ
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISE, easeIn(ph));
      // ボディ: 後方バク転
      this._bodyTiltX = lerp(0, p.BODY_MAX, easeIn(ph));

    } else if (this.swingT < p.T_PEAK) {
      this.armR.rotation.x = p.ARM_RAISE;
      this._bodyTiltX      = p.BODY_MAX;

    } else if (this.swingT < p.T_SLAM) {
      const ph = (this.swingT - p.T_PEAK) / (p.T_SLAM - p.T_PEAK);
      this.armR.rotation.x = lerp(p.ARM_RAISE, p.ARM_SLAM, easeIn(ph));
      // 同時にボディを前方に戻す（叩きつけながら体が起き上がる）
      this._bodyTiltX = lerp(p.BODY_MAX, 0, easeOut(ph));
      if (this._swingHitCount < 1 && ph >= 0.65) {
        this._swingHitCount++; doHit = true;
      }
    } else {
      const ph = (this.swingT - p.T_SLAM) / (p.T_TOTAL - p.T_SLAM);
      this.armR.rotation.x = lerp(p.ARM_SLAM, this.restRot, easeOut(ph));
      this._bodyTiltX      = 0;
    }

    if (this.swingT >= p.T_TOTAL) { this._bodyTiltX = 0; this._endSwing(p.COOLDOWN); }
    return doHit;
  }

  // ══ diamond: 両手持ち ダッシュ → ザザザザザ連刺し ════════
  _updateDiamond(dt) {
    const p = DIAMOND;
    let doHit = false;

    if (this.swingT < p.T_RUSH) {
      // ─ ダッシュ前進 + 両腕を前に構える
      const ph = this.swingT / p.T_RUSH;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_FWD, easeOut(ph));
      if (this.armL) this.armL.rotation.x = lerp(0, p.ARM_FWD, easeOut(ph));
      this._forwardVel = p.RUSH_VEL;
      this._bodyTiltX  = lerp(0, p.BODY_TILT, ph);

    } else if (this.swingT < p.T_STAB_END) {
      // ─ ザザザザザ高速連刺し
      this._forwardVel = 0;
      this._bodyTiltX  = p.BODY_TILT;

      const elapsed  = this.swingT - p.T_RUSH;
      const wave     = Math.sin(elapsed * p.STAB_FREQ);
      const armRot   = lerp(p.ARM_FWD, p.ARM_BACK, (wave + 1) * 0.5);
      this.armR.rotation.x = armRot;
      if (this.armL) this.armL.rotation.x = lerp(p.ARM_FWD, p.ARM_BACK, (-wave + 1) * 0.5);

      // 最初の一刺し（波が前方に完全に伸びた瞬間）
      if (this._swingHitCount < 1 && wave > 0.9) {
        this._swingHitCount++; doHit = true;
      }
    } else {
      // ─ リカバリー
      const ph = (this.swingT - p.T_STAB_END) / (p.T_TOTAL - p.T_STAB_END);
      this.armR.rotation.x = lerp(p.ARM_FWD, this.restRot, easeOut(ph));
      if (this.armL) this.armL.rotation.x = lerp(p.ARM_FWD, 0, easeOut(ph));
      this._bodyTiltX  = lerp(p.BODY_TILT, 0, ph);
      this._forwardVel = 0;
    }

    if (this.swingT >= p.T_TOTAL) {
      this._bodyTiltX = 0; this._forwardVel = 0;
      if (this.armL) this.armL.rotation.x = 0;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ netherite: 剣を天に掲げ 光の矢＆闇の矢を発射 ════════
  _updateNetherite() {
    const p = NETHERITE;
    let doHit = false;

    if (this.swingT < p.T_RAISE) {
      // ─ 剣を天空へ掲げる
      const ph = this.swingT / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.2, ph);

    } else if (this.swingT < p.T_CHARGE) {
      // ─ チャージ（徐々に輝きが増す）
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (this.swingT - p.T_RAISE) / (p.T_CHARGE - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.2, 2.8, ph);

    } else if (this.swingT < p.T_FIRE) {
      // ─ 発射（一瞬フラッシュ、ここでヒット判定）
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 3.5;
      if (this._swingHitCount < 1) {
        this._swingHitCount++; doHit = true;
      }
    } else {
      // ─ リカバリー
      const ph = (this.swingT - p.T_FIRE) / (p.T_TOTAL - p.T_FIRE);
      this.armR.rotation.x = lerp(p.ARM_RAISED, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(3.5, 0.35, ph);
    }

    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = this.wData.glowColor ? 0.35 : 0;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ light: 剣を前に構え 光の波動弾を発射 ═════════════════
  _updateLight() {
    const p = LIGHT_SW;
    let doHit = false;

    if (this.swingT < p.T_RAISE) {
      const ph = this.swingT / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_FWD, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.2, ph);

    } else if (this.swingT < p.T_CHARGE) {
      this.armR.rotation.x = p.ARM_FWD;
      const ph = (this.swingT - p.T_RAISE) / (p.T_CHARGE - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.2, 3.0, ph);

    } else if (this.swingT < p.T_FIRE) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 4.0;
      if (this._swingHitCount < 1) { this._swingHitCount++; doHit = true; }

    } else {
      const ph = (this.swingT - p.T_FIRE) / (p.T_TOTAL - p.T_FIRE);
      this.armR.rotation.x = lerp(p.ARM_FWD, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(4.0, 0.35, ph);
    }

    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ blackhole: 剣を掲げ 暗黒引力 → 二連叩き ════════════
  _updateBlackhole() {
    const p = BLACKHOLE_SW;
    let doHit = false;

    if (this.swingT < p.T_RAISE) {
      const ph = this.swingT / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.5, ph);

    } else if (this.swingT < p.T_DARK) {
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (this.swingT - p.T_RAISE) / (p.T_DARK - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.5, 3.0, ph);

    } else if (this.swingT < p.T_HIT1) {
      // 一撃目 叩き下ろし
      const ph = (this.swingT - p.T_DARK) / (p.T_HIT1 - p.T_DARK);
      this.armR.rotation.x = lerp(p.ARM_RAISED, -2.50, easeIn(ph));
      if (this._swingHitCount < 1 && ph >= 0.72) { this._swingHitCount++; doHit = true; }

    } else if (this.swingT < p.T_HIT2) {
      // 二撃目 素早く振り上げ→再叩き
      const ph = (this.swingT - p.T_HIT1) / (p.T_HIT2 - p.T_HIT1);
      if (ph < 0.45) {
        this.armR.rotation.x = lerp(-2.50, p.ARM_RAISED * 0.5, easeOut(ph / 0.45));
      } else {
        const ph2 = (ph - 0.45) / 0.55;
        this.armR.rotation.x = lerp(p.ARM_RAISED * 0.5, -2.50, easeIn(ph2));
        if (this._swingHitCount < 2 && ph2 >= 0.72) { this._swingHitCount++; doHit = true; }
      }

    } else {
      const ph = (this.swingT - p.T_HIT2) / (p.T_TOTAL - p.T_HIT2);
      this.armR.rotation.x = lerp(-2.50, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(3.0, 0.35, ph);
    }

    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ lightning: 剣を天に掲げチャージ → 5連斬り下ろし ════
  _updateLightning() {
    const p = LIGHTNING_SW;
    const t = this.swingT;
    let doHit = false;

    if (t < p.T_RAISE) {
      // ─ 腕を天に掲げる
      const ph = t / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.8, ph);

    } else if (t < p.T_CHARGE) {
      // ─ チャージ（剣が激しく黄色に輝く）
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (t - p.T_RAISE) / (p.T_CHARGE - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.8, 5.5, ph);

    } else {
      // ─ 5連斬り下ろし + リカバリー
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 5.5;

      // アニメーション（腕の往復）
      if (t < p.T_SLASH1) {
        const ph = clamp01((t - p.T_CHARGE) / (p.T_SLASH1 - p.T_CHARGE));
        this.armR.rotation.x = lerp(p.ARM_RAISED, p.ARM_SLASH, easeIn(ph));
      } else if (t < p.T_UP1) {
        const ph = clamp01((t - p.T_SLASH1) / (p.T_UP1 - p.T_SLASH1));
        this.armR.rotation.x = lerp(p.ARM_SLASH, p.ARM_RAISED, easeOut(ph));
      } else if (t < p.T_SLASH2) {
        const ph = clamp01((t - p.T_UP1) / (p.T_SLASH2 - p.T_UP1));
        this.armR.rotation.x = lerp(p.ARM_RAISED, p.ARM_SLASH, easeIn(ph));
      } else if (t < p.T_UP2) {
        const ph = clamp01((t - p.T_SLASH2) / (p.T_UP2 - p.T_SLASH2));
        this.armR.rotation.x = lerp(p.ARM_SLASH, p.ARM_RAISED, easeOut(ph));
      } else if (t < p.T_SLASH3) {
        const ph = clamp01((t - p.T_UP2) / (p.T_SLASH3 - p.T_UP2));
        this.armR.rotation.x = lerp(p.ARM_RAISED, p.ARM_SLASH, easeIn(ph));
      } else if (t < p.T_UP3) {
        const ph = clamp01((t - p.T_SLASH3) / (p.T_UP3 - p.T_SLASH3));
        this.armR.rotation.x = lerp(p.ARM_SLASH, p.ARM_RAISED, easeOut(ph));
      } else if (t < p.T_SLASH4) {
        const ph = clamp01((t - p.T_UP3) / (p.T_SLASH4 - p.T_UP3));
        this.armR.rotation.x = lerp(p.ARM_RAISED, p.ARM_SLASH, easeIn(ph));
      } else if (t < p.T_UP4) {
        const ph = clamp01((t - p.T_SLASH4) / (p.T_UP4 - p.T_SLASH4));
        this.armR.rotation.x = lerp(p.ARM_SLASH, p.ARM_RAISED, easeOut(ph));
      } else if (t < p.T_SLASH5) {
        const ph = clamp01((t - p.T_UP4) / (p.T_SLASH5 - p.T_UP4));
        this.armR.rotation.x = lerp(p.ARM_RAISED, p.ARM_SLASH, easeIn(ph));
      } else {
        // リカバリー
        const ph = clamp01((t - p.T_SLASH5) / (p.T_TOTAL - p.T_SLASH5));
        this.armR.rotation.x = lerp(p.ARM_SLASH, this.restRot, easeOut(ph));
        if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(5.5, 0.35, ph);
      }

      // ヒット判定: 絶対時間閾値で確実に発火（フレームレート非依存）
      const hitTimes = [p.T_SLASH1, p.T_SLASH2, p.T_SLASH3, p.T_SLASH4, p.T_SLASH5];
      for (let i = 0; i < hitTimes.length; i++) {
        if (this._swingHitCount === i && t >= hitTimes[i]) {
          this._swingHitCount++;
          doHit = true;
          break;
        }
      }
    }

    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // インフェルノのトルネードスピン速度を返す（Player.jsが向き更新に使用）
  getBodySpinY() {
    if (this.weaponType !== 'inferno' || !this.swinging) return 0;
    const t = this.swingT;
    if (t < INFERNO_SW.T_SPIN_END)   return 18;
    if (t < INFERNO_SW.T_CHARGE_END) return 4;
    return 0;
  }

  // ══ bubble: 剣を空に向けて泡を噴出 ══════════════════════════
  _updateBubble() {
    const p = BUBBLE_SW;
    let doHit = false;
    if (this.swingT < p.T_RAISE) {
      const ph = this.swingT / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.5, ph);
    } else if (this.swingT < p.T_CHARGE) {
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (this.swingT - p.T_RAISE) / (p.T_CHARGE - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.5, 3.5, ph);
    } else if (this.swingT < p.T_FIRE) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 4.5;
      if (this._swingHitCount < 1) { this._swingHitCount++; doHit = true; }
    } else {
      const ph = (this.swingT - p.T_FIRE) / (p.T_TOTAL - p.T_FIRE);
      this.armR.rotation.x = lerp(p.ARM_RAISED, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(4.5, 0.35, ph);
    }
    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ ice: 水色オーラで氷柱を召喚 ════════════════════════════
  _updateIce() {
    const p = ICE_SW;
    let doHit = false;
    if (this.swingT < p.T_RAISE) {
      const ph = this.swingT / p.T_RAISE;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 1.2, ph);
    } else if (this.swingT < p.T_GLOW) {
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (this.swingT - p.T_RAISE) / (p.T_GLOW - p.T_RAISE);
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(1.2, 4.0, ph);
    } else if (this.swingT < p.T_FIRE) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 4.0 + Math.sin(this.swingT * 30) * 0.5;
      if (this._swingHitCount < 1) { this._swingHitCount++; doHit = true; }
    } else {
      const ph = (this.swingT - p.T_FIRE) / (p.T_TOTAL - p.T_FIRE);
      this.armR.rotation.x = lerp(p.ARM_RAISED, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(4.0, 0.35, ph);
    }
    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ══ inferno: トルネードスピン → 赤チャージ → 122本の炎の矢 ══
  _updateInferno() {
    const p = INFERNO_SW;
    let doHit = false;
    if (this.swingT < p.T_SPIN_END) {
      const ph = this.swingT / p.T_SPIN_END;
      this.armR.rotation.x = lerp(this.restRot, p.ARM_RAISED, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(0.35, 2.5, ph);
    } else if (this.swingT < p.T_CHARGE_END) {
      this.armR.rotation.x = p.ARM_RAISED;
      const ph = (this.swingT - p.T_SPIN_END) / (p.T_CHARGE_END - p.T_SPIN_END);
      const flicker = Math.sin(this.swingT * 22) * 0.4;
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(2.5, 6.0, ph) + flicker;
    } else if (this.swingT < p.T_TOTAL) {
      if (this._swingHitCount < 1) { this._swingHitCount++; doHit = true; }
      const ph = (this.swingT - p.T_FIRE) / (p.T_TOTAL - p.T_FIRE);
      this.armR.rotation.x = lerp(p.ARM_RAISED, this.restRot, easeOut(ph));
      if (this._bladeMat) this._bladeMat.emissiveIntensity = lerp(6.0, 0.35, ph);
    }
    if (this.swingT >= p.T_TOTAL) {
      if (this._bladeMat) this._bladeMat.emissiveIntensity = 0.35;
      this._endSwing(p.COOLDOWN);
    }
    return doHit;
  }

  // ─── スイング終了処理 ────────────────────────────────────
  _endSwing(cooldownSec) {
    this.swinging            = false;
    this.cooldown            = cooldownSec;
    this.armR.rotation.x     = this.restRot;
    this._bodyTiltX          = 0;
    this._forwardVel         = 0;
  }
}
