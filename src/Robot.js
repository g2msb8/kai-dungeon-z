// ショップで買う「特殊ロボット」。バトルでペットと一緒に登場し、
// プレイヤーに追従しながらゾンビを攻撃する（ロボットは無敵＝殴られない）。
import * as THREE from 'three';
import { soundManager } from './SoundManager.js';

// behavior: 'drone'(空中ミサイル) | 'melee'(走って殴る) | 'humanoid'(剣・警告) | 'beast'(噛みつき)
export const ROBOT_DEF = {
  drone: {
    name: 'ドローン', emoji: '🛸', cost: 200, behavior: 'drone',
    sense: 7.0, dmg: 9, cooldown: 0.95,   // dmg9 → ゾンビ(40)を約4〜5発
  },
  smallbot: {
    name: '小型ロボット', emoji: '🤖', cost: 350, behavior: 'melee',
    sense: 16, bite: 1.4, dmg: 14, cooldown: 0.55, scale: 0.7, // 14 → 約3発
  },
  humanoid: {
    name: 'ヒューマノイドロボット', emoji: '🦾', cost: 500, behavior: 'humanoid',
    sense: 10.8, bite: 2.2, dmg: 9999, cooldown: 1.0,          // 一撃必殺＋警告
  },
  lion: {
    name: 'ライオン型ロボット', emoji: '🦁', cost: 700, behavior: 'beast',
    sense: 6.5, bite: 1.8, dmg: 25, cooldown: 0.7,             // 25 → 1〜2発
  },
};

export const ROBOT_ORDER = ['drone', 'smallbot', 'humanoid', 'lion'];

function mat(color, rough = 0.4, metal = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

// ─── モデル ───────────────────────────────────────────────────
function buildDrone() {
  const g = new THREE.Group();
  const bodyM = mat(0x5a6470, 0.5, 0.7);
  const accM  = mat(0xff5533, 0.4, 0.5);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), bodyM);
  g.add(core);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff2200, emissiveIntensity: 1.8 }));
  eye.position.set(0, 0, 0.26);
  g.add(eye);
  const rotors = [];
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.34), bodyM);
    arm.position.set(ax * 0.28, 0.05, az * 0.28);
    arm.lookAt(ax * 0.6, 0.05, az * 0.6);
    g.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), accM);
    rotor.position.set(ax * 0.4, 0.1, az * 0.4);
    g.add(rotor);
    rotors.push(rotor);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root: g, rotors, kind: 'drone' };
}

function buildSmallBot() {
  const g = new THREE.Group();
  const bodyM = mat(0xcfd6dd, 0.4, 0.7);
  const accM  = mat(0x3aa0ff, 0.3, 0.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.26), bodyM);
  body.position.y = 0.5; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), bodyM);
  head.position.y = 0.82; g.add(head);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), accM);
  eye.position.set(0, 0.84, 0.13); g.add(eye);
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.09), bodyM);
    arm.position.set(sx * 0.24, 0.5, 0.04); g.add(arm); arms.push(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.12), bodyM);
    leg.position.set(sx * 0.09, 0.13, 0); g.add(leg);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root: g, arms, kind: 'biped' };
}

function buildHumanoidBot() {
  const g = new THREE.Group();
  const steel = mat(0xb8c0c8, 0.35, 0.85);
  const dark  = mat(0x44505a, 0.5, 0.7);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), steel);
  torso.position.y = 1.15; g.add(torso);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x33ddff, emissive: 0x22bbff, emissiveIntensity: 1.6 }));
  core.position.set(0, 1.2, 0.2); g.add(core);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), steel);
  head.position.y = 1.7; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff1122, emissiveIntensity: 1.4 }));
  visor.position.set(0, 1.72, 0.17); g.add(visor);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.2), dark);
    leg.position.set(sx * 0.16, 0.4, 0); g.add(leg);
  }
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), steel);
  armL.position.set(-0.42, 1.15, 0); g.add(armL);
  // 右腕（剣を持つ。攻撃でピボット回転）
  const armR = new THREE.Group();
  armR.position.set(0.42, 1.46, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), steel);
  upper.position.y = -0.31; armR.add(upper);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f0, metalness: 0.9, roughness: 0.15, emissive: 0x335577, emissiveIntensity: 0.3 }));
  blade.position.set(0, -0.95, 0.05); armR.add(blade);
  g.add(armR);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root: g, armR, torso, kind: 'humanoid' };
}

function buildLionBot() {
  const g = new THREE.Group();
  const goldM = mat(0xe0a83a, 0.4, 0.7);
  const maneM = mat(0xb5781f, 0.6, 0.4);
  const darkM = mat(0x6b4a14, 0.5, 0.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.05), goldM);
  body.position.y = 0.66; g.add(body);
  const headG = new THREE.Group();
  headG.position.set(0, 0.78, 0.62); g.add(headG);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), maneM);
  headG.add(mane);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.34), goldM);
  face.position.z = 0.18; headG.add(face);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.2), darkM);
  snout.position.set(0, -0.08, 0.36); headG.add(snout);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xff4422, emissive: 0xff2200, emissiveIntensity: 1.4 }));
    eye.position.set(sx * 0.1, 0.05, 0.34); headG.add(eye);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.2, 0.34], [0.2, 0.34], [-0.2, -0.34], [0.2, -0.34]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.42, lz);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), goldM);
    shin.position.y = -0.22; leg.add(shin);
    g.add(leg); legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), goldM);
  tail.position.set(0, 0.78, -0.7); tail.rotation.x = -0.6; g.add(tail);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root: g, headG, legs, kind: 'beast' };
}

function buildRobotModel(type) {
  if (type === 'drone')    return buildDrone();
  if (type === 'smallbot') return buildSmallBot();
  if (type === 'humanoid') return buildHumanoidBot();
  return buildLionBot();
}

// 「近くにいるよ」警告ふきだし（カメラ正面のスプライト）
function makeWarnSprite(text) {
  const fs = 40, pad = 14;
  const font = `bold ${fs}px -apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width + pad * 2);
  const h = fs + pad * 2;
  c.width = w; c.height = h;
  ctx = c.getContext('2d');
  ctx.font = font;
  ctx.fillStyle = 'rgba(180,20,20,0.9)';
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 12); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 12); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.renderOrder = 999;
  sp.scale.set(w * 0.006, h * 0.006, 1);
  return sp;
}

export class Robot {
  constructor(scene, position, type) {
    const def = ROBOT_DEF[type] || ROBOT_DEF.drone;
    this.type = type;
    this.def = def;
    this.behavior = def.behavior;
    this.alive = true;
    this._scene = scene;
    this._atkCd = 0;
    this._phase = Math.random() * Math.PI * 2;
    this._missiles = [];
    this._blasts = [];
    this._warnSprite = null;
    this._swingT = 0;

    const m = buildRobotModel(type);
    this.root   = m.root;
    this._parts = m;
    if (def.scale) this.root.scale.setScalar(def.scale);
    this.root.position.copy(position);
    if (this.behavior === 'drone') this.root.position.y = 2.6; // 空に浮く
    scene.add(this.root);
  }

  get position() { return this.root.position; }

  _face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  _nearest(zombies, fromX, fromZ) {
    let best = null, bd = Infinity;
    for (const z of zombies) {
      if (!z.alive || z.dying) continue;
      const d = Math.hypot(z.position.x - fromX, z.position.z - fromZ);
      if (d < bd) { bd = d; best = z; }
    }
    return { best, bd };
  }

  _follow(dt, player, speed, followDist, y = 0) {
    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d > followDist) {
      this._face(dx, dz);
      this.root.position.x += (dx / d) * speed * dt;
      this.root.position.z += (dz / d) * speed * dt;
      this.root.position.y = y;
      return true;
    }
    this.root.position.y = y;
    return false;
  }

  update(dt, player, zombies, onKill) {
    if (!this.alive) return;
    if (this._atkCd > 0) this._atkCd -= dt;
    if (this._swingT > 0) this._swingT -= dt;
    this._phase += dt * 6;
    this._updateMissiles(dt, onKill);
    this._updateBlasts(dt);

    if (this.behavior === 'drone')    return this._updateDrone(dt, player, zombies);
    if (this.behavior === 'humanoid') return this._updateHumanoid(dt, player, zombies, onKill);
    // melee / beast は共通（走って攻撃）
    this._updateChaser(dt, player, zombies, onKill);
  }

  // ── ドローン：プレイヤー上空に浮き、7m以内のゾンビへミサイル ──
  _updateDrone(dt, player, zombies) {
    // プレイヤーの斜め上に追従
    const tx = player.position.x, tz = player.position.z + 0.5;
    this.root.position.x += (tx - this.root.position.x) * Math.min(1, dt * 3);
    this.root.position.z += (tz - this.root.position.z) * Math.min(1, dt * 3);
    this.root.position.y = 2.6 + Math.sin(this._phase) * 0.12;
    if (this._parts.rotors) for (const r of this._parts.rotors) r.rotation.y += dt * 40;

    // プレイヤーの7m以内のゾンビを狙う
    const { best, bd } = this._nearest(zombies, player.position.x, player.position.z);
    if (best && bd <= this.def.sense) {
      this._face(best.position.x - this.root.position.x, best.position.z - this.root.position.z);
      if (this._atkCd <= 0) {
        this._atkCd = this.def.cooldown;
        this._fireMissile(best);
      }
    }
  }

  _fireMissile(target) {
    const mm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xff6600, emissiveIntensity: 1.5 }),
    );
    mm.position.copy(this.root.position);
    this._scene.add(mm);
    this._missiles.push({ mesh: mm, target, dmg: this.def.dmg });
    soundManager.playWhoosh && soundManager.playWhoosh();
  }

  _updateMissiles(dt, onKill) {
    const SPD = 16;
    for (let i = this._missiles.length - 1; i >= 0; i--) {
      const ms = this._missiles[i];
      const t = ms.target;
      let tx, ty, tz;
      if (t && t.alive && !t.dying) { tx = t.position.x; ty = 1.0; tz = t.position.z; }
      else { tx = ms.mesh.position.x; ty = 0.4; tz = ms.mesh.position.z; } // 標的消失→その場で爆発
      const dx = tx - ms.mesh.position.x, dy = ty - ms.mesh.position.y, dz = tz - ms.mesh.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.7 || !t) {
        // 爆発
        this._spawnBlast(ms.mesh.position, 1.6);
        if (t && t.alive && !t.dying) {
          const died = t.takeDamage(ms.dmg);
          if (died && onKill) onKill();
        }
        this._scene.remove(ms.mesh);
        ms.mesh.geometry.dispose(); ms.mesh.material.dispose();
        this._missiles.splice(i, 1);
        continue;
      }
      ms.mesh.position.x += (dx / d) * SPD * dt;
      ms.mesh.position.y += (dy / d) * SPD * dt;
      ms.mesh.position.z += (dz / d) * SPD * dt;
      ms.mesh.lookAt(tx, ty, tz);
    }
  }

  _spawnBlast(pos, max) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5500, emissiveIntensity: 2.0, transparent: true, opacity: 0.8 }));
    m.position.set(pos.x, Math.max(0.5, pos.y), pos.z);
    this._scene.add(m);
    this._blasts.push({ mesh: m, t: 0, max });
  }

  _updateBlasts(dt) {
    for (let i = this._blasts.length - 1; i >= 0; i--) {
      const b = this._blasts[i];
      b.t += dt;
      const k = b.t / 0.35;
      b.mesh.scale.setScalar(0.4 + k * b.max);
      b.mesh.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) {
        this._scene.remove(b.mesh);
        b.mesh.geometry.dispose(); b.mesh.material.dispose();
        this._blasts.splice(i, 1);
      }
    }
  }

  // ── 小型ロボ / ライオン：走って殴る・噛みつく ──
  _updateChaser(dt, player, zombies, onKill) {
    const { best, bd } = this._nearest(zombies, this.root.position.x, this.root.position.z);
    const distPlayer = Math.hypot(player.position.x - this.root.position.x, player.position.z - this.root.position.z);
    const SPEED = this.behavior === 'beast' ? 6.0 : 5.0;
    const LEASH = 16;
    let moving = false;
    if (best && bd <= this.def.sense && distPlayer < LEASH) {
      const dx = best.position.x - this.root.position.x;
      const dz = best.position.z - this.root.position.z;
      this._face(dx, dz);
      if (bd > this.def.bite) {
        this.root.position.x += (dx / bd) * SPEED * dt;
        this.root.position.z += (dz / bd) * SPEED * dt;
        moving = true;
      } else if (this._atkCd <= 0) {
        this._atkCd = this.def.cooldown;
        this._swingT = 0.2;
        const died = best.takeDamage(this.def.dmg);
        soundManager.playAttack && soundManager.playAttack();
        if (died && onKill) onKill();
      }
    } else {
      moving = this._follow(dt, player, SPEED, 3.0);
    }
    this._animateLegs(dt, moving);
  }

  // ── ヒューマノイド：剣・近くにいると赤オーラ警告・一撃 ──
  _updateHumanoid(dt, player, zombies, onKill) {
    const { best, bd } = this._nearest(zombies, this.root.position.x, this.root.position.z);
    const distPlayer = Math.hypot(player.position.x - this.root.position.x, player.position.z - this.root.position.z);
    const sensing = best && bd <= this.def.sense;

    this._setWarn(sensing);

    let moving = false;
    if (sensing && distPlayer < 16) {
      const dx = best.position.x - this.root.position.x;
      const dz = best.position.z - this.root.position.z;
      this._face(dx, dz);
      if (bd > this.def.bite) {
        this.root.position.x += (dx / bd) * 5.2 * dt;
        this.root.position.z += (dz / bd) * 5.2 * dt;
        moving = true;
      } else if (this._atkCd <= 0) {
        this._atkCd = this.def.cooldown;
        this._swingT = 0.45; // 3連撃ぶん
        const died = best.takeDamage(this.def.dmg); // 一撃必殺
        soundManager.playAttack && soundManager.playAttack();
        if (died && onKill) onKill();
      }
    } else {
      moving = this._follow(dt, player, 5.0, 3.0);
    }
    // 剣の3連撃アニメ
    if (this._parts.armR) {
      this._parts.armR.rotation.x = this._swingT > 0
        ? -1.4 + Math.sin(this._swingT * 40) * 0.6
        : -0.1;
    }
    this._animateLegs(dt, moving);
  }

  _setWarn(on) {
    if (on && !this._warnSprite) {
      this._warnSprite = makeWarnSprite('近くにいるよ');
      this._warnSprite.position.set(0, 2.25, 0);
      this.root.add(this._warnSprite);
      // 赤オーラ（胴体を発光）
      if (this._parts.torso) this._parts.torso.material.emissive = new THREE.Color(0xff2020);
      if (this._parts.torso) this._parts.torso.material.emissiveIntensity = 0.7;
    } else if (!on && this._warnSprite) {
      this.root.remove(this._warnSprite);
      if (this._warnSprite.material.map) this._warnSprite.material.map.dispose();
      this._warnSprite.material.dispose();
      this._warnSprite = null;
      if (this._parts.torso) this._parts.torso.material.emissiveIntensity = 0;
    }
  }

  _animateLegs(dt, moving) {
    const sw = Math.sin(this._phase * 1.6) * (moving ? 0.6 : 0);
    if (this._parts.legs) {
      this._parts.legs[0].rotation.x = sw;  this._parts.legs[3].rotation.x = sw;
      this._parts.legs[1].rotation.x = -sw; this._parts.legs[2].rotation.x = -sw;
    }
    if (this._parts.arms) {
      this._parts.arms[0].rotation.x = this._swingT > 0 ? -1.6 : sw;
      this._parts.arms[1].rotation.x = this._swingT > 0 ? -1.6 : -sw;
    }
  }

  dispose() {
    if (!this._scene) return;
    for (const ms of this._missiles) {
      this._scene.remove(ms.mesh); ms.mesh.geometry.dispose(); ms.mesh.material.dispose();
    }
    for (const b of this._blasts) {
      this._scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose();
    }
    this._missiles = []; this._blasts = [];
    this._scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); }
    });
    this._scene = null;
  }
}
