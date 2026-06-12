// ゾンビ管理。スポーン・更新・全滅判定・撃破ドロップ。
// stage2 では 5体のゾンビを倒した後にボスが出現する。
// stage3 では通常ゾンビ+ミニゾンビを倒した後に紫ゾンビが出現する。
import * as THREE from 'three';
import { Zombie } from './Zombie.js';
import { MiniZombie } from './MiniZombie.js';
import { PurpleZombie } from './PurpleZombie.js';
import { Boss } from './Boss.js';
import { STAGE, STAGE2, STAGE3, STAGE4, SWORD, BOSS, MINI_ZOMBIE, PURPLE_ZOMBIE } from './core/Constants.js';
import { soundManager } from './SoundManager.js';

export class ZombieManager {
  constructor(scene) {
    this.scene   = scene;
    this.zombies = [];
    this.drops   = { stone: 0, ore: 0 };
    this.killed  = 0;
    this.onKill    = null;
    this.onCleared = null;
    this.onBossSpawn = null;
    this.onBossKill  = null;   // ボス撃破時コールバック（回復薬判定用）
    this._clearedFired = false;
    this._arrows    = [];  // netherite VFX 矢
    this._particles = [];  // light / blackhole / lightning VFX

    // stage2 ボス管理
    this._hasBoss    = false;
    this._boss       = null;
    this._bossSpawned = false;
    this._stageDrop  = STAGE.DROP;  // スポーン時に切り替え

    // stage3 紫ゾンビ管理
    this._hasPurple    = false;
    this._purpleZombie = null;
    this._purpleSpawned = false;
  }

  // ── スポーン ─────────────────────────────────────────────
  spawn() {
    this.clear();
    this._hasBoss   = false;
    this._stageDrop = STAGE.DROP;
    const n = STAGE.ZOMBIE_COUNT;
    for (let i = 0; i < n; i++) this._spawnZombie(i, n);
  }

  // stage2: 5体のゾンビ + ボス
  setupBossStage(zombieCount) {
    this.clear();
    this._hasBoss    = true;
    this._bossSpawned = false;
    this._stageDrop  = STAGE2.DROP;
    for (let i = 0; i < zombieCount; i++) this._spawnZombie(i, zombieCount);
  }

  // stage3: ミニゾンビ + 通常ゾンビ → 紫ゾンビボス
  setupStage3() {
    this.clear();
    this._hasPurple    = true;
    this._purpleSpawned = false;
    this._hasBoss      = false;
    this._stageDrop    = STAGE3.DROP;
    const miniCount    = STAGE3.MINI_ZOMBIE_COUNT;
    const total        = miniCount + STAGE3.ZOMBIE_COUNT;
    for (let i = 0; i < miniCount; i++) this._spawnMiniZombie(i, total);
    for (let i = 0; i < STAGE3.ZOMBIE_COUNT; i++) this._spawnZombie(miniCount + i, total);
  }

  // stage4: ミニゾンビ + 通常ゾンビ（ボスなし）
  setupStage4() {
    this.clear();
    this._hasPurple    = false;
    this._hasBoss      = false;
    this._stageDrop    = STAGE4.DROP;
    const miniCount    = STAGE4.MINI_ZOMBIE_COUNT;
    const total        = miniCount + STAGE4.ZOMBIE_COUNT;
    for (let i = 0; i < miniCount; i++) this._spawnMiniZombie(i, total);
    for (let i = 0; i < STAGE4.ZOMBIE_COUNT; i++) this._spawnZombie(miniCount + i, total);
  }

  _spawnZombie(i, total) {
    const ang = (i / total) * Math.PI * 2 + rand(-0.3, 0.3);
    const r   = rand(14, STAGE.RADIUS - 4);
    const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    const z   = new Zombie(pos);
    this.scene.add(z.root);
    this.zombies.push(z);
  }

  _spawnMiniZombie(i, total) {
    const ang = (i / total) * Math.PI * 2 + rand(-0.3, 0.3);
    const r   = rand(14, STAGE.RADIUS - 4);
    const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    const z   = new MiniZombie(pos);
    this.scene.add(z.root);
    this.zombies.push(z);
  }

  _spawnPurpleZombie() {
    const ang = Math.random() * Math.PI * 2;
    const r   = rand(14, 16);
    const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    this._purpleZombie  = new PurpleZombie(pos);
    this._purpleSpawned = true;
    this.scene.add(this._purpleZombie.root);
    if (this.onBossSpawn) this.onBossSpawn();
  }

  _spawnBoss() {
    const ang = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(Math.sin(ang) * 16, 0, Math.cos(ang) * 16);
    this._boss = new Boss(pos);
    this.scene.add(this._boss.root);
    this._bossSpawned = true;
    if (this.onBossSpawn) this.onBossSpawn();
  }

  // ── ゲッター ─────────────────────────────────────────────
  get aliveCount() {
    const zc = this.zombies.filter(z => z.alive && !z.dying).length;
    const bc  = (this._boss && this._boss.alive) ? 1 : 0;
    const pc  = (this._purpleZombie && this._purpleZombie.alive) ? 1 : 0;
    return zc + bc + pc;
  }

  get bossHPFraction() {
    if (this._boss && this._boss.alive) return Math.max(0, this._boss.hp / BOSS.HP);
    if (this._purpleZombie && this._purpleZombie.alive) return Math.max(0, this._purpleZombie.hp / PURPLE_ZOMBIE.MAX_HP);
    return null;
  }

  // ── 毎フレーム更新 ────────────────────────────────────────
  update(dt, player) {
    // ネザライト矢 VFX
    for (let i = this._arrows.length - 1; i >= 0; i--) {
      const a = this._arrows[i];
      a.life -= dt;
      a.vy   -= 20 * dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.z += a.vz * dt;
      a.mesh.rotation.x += dt * 5;
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this._arrows.splice(i, 1);
      }
    }

    // 汎用パーティクル VFX (light / blackhole / lightning)
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.gravity) p.vy -= 9.8 * dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this._particles.splice(i, 1);
      }
    }

    // ゾンビ更新
    let totalDmg = 0;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      totalDmg += z.update(dt, player);
    }
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      if (!this.zombies[i].alive) {
        this.zombies[i].dispose(this.scene);
        this.zombies.splice(i, 1);
      }
    }

    // stage2: ゾンビ全滅後にボスをスポーン
    if (this._hasBoss && !this._bossSpawned && this.zombies.length === 0 && this.killed > 0) {
      this._spawnBoss();
    }

    // stage3: ゾンビ全滅後に紫ゾンビをスポーン
    if (this._hasPurple && !this._purpleSpawned && this.zombies.length === 0 && this.killed > 0) {
      this._spawnPurpleZombie();
    }

    // ボス更新
    if (this._boss) {
      totalDmg += this._boss.update(dt, player);
      if (!this._boss.alive) {
        this._boss.dispose(this.scene);
        this._boss = null;
        if (this.onBossKill) this.onBossKill();
      }
    }

    // 紫ゾンビ更新
    if (this._purpleZombie) {
      totalDmg += this._purpleZombie.update(dt, player);
      if (!this._purpleZombie.alive) {
        this._purpleZombie.dispose(this.scene);
        this._purpleZombie = null;
        if (this.onBossKill) this.onBossKill();
      }
    }

    // クリア判定
    const bossOk   = !this._hasBoss   || (this._bossSpawned   && this._boss         === null);
    const purpleOk = !this._hasPurple || (this._purpleSpawned && this._purpleZombie === null);
    if (!this._clearedFired && this.zombies.length === 0 && this.killed > 0 && bossOk && purpleOk) {
      this._clearedFired = true;
      if (this.onCleared) this.onCleared();
    }

    return totalDmg;
  }

  // ── 攻撃判定 ─────────────────────────────────────────────
  resolveAttack(player) {
    const px = player.position.x, pz = player.position.z;
    const wt = player.sword.weaponType;

    if (wt === 'light')     { this._resolveLight(player);     return; }
    if (wt === 'blackhole') { this._resolveBlackhole(player); return; }
    if (wt === 'lightning') { this._resolveLightning(player); return; }

    if (player.sword.isAoe) {
      const aoeRange = SWORD.RANGE * 2.2;
      for (const z of this.zombies) {
        if (!z.alive || z.dying) continue;
        if (Math.hypot(z.position.x - px, z.position.z - pz) > aoeRange) continue;
        if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
      }
      this._hitBossIfInRange(px, pz, player, aoeRange);
      this._hitPurpleIfInRange(px, pz, player, aoeRange);
      this._spawnNetheriteVfx(player.position);
      return;
    }

    // 前方扇形で最近のターゲット（ゾンビ or ボス）
    const facing = player.facing;
    let bestDist = Infinity, bestZombie = null, bestIsBoss = false;

    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      const dx = z.position.x - px, dz = z.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > SWORD.RANGE) continue;
      const diff = Math.abs(normalizeAngle(Math.atan2(-dx, -dz) - facing));
      if (diff > SWORD.ARC / 2) continue;
      if (dist < bestDist) { bestDist = dist; bestZombie = z; bestIsBoss = false; }
    }

    if (this._boss && this._boss.alive && !this._boss.dying) {
      const bdx = this._boss.position.x - px, bdz = this._boss.position.z - pz;
      const bdist = Math.hypot(bdx, bdz);
      const bossReach = SWORD.RANGE * 1.6;
      if (bdist <= bossReach) {
        const bdiff = Math.abs(normalizeAngle(Math.atan2(-bdx, -bdz) - facing));
        if (bdiff <= SWORD.ARC / 2 && bdist < bestDist) {
          bestDist = bdist; bestZombie = null; bestIsBoss = true;
        }
      }
    }

    let bestIsPurple = false;
    if (this._purpleZombie && this._purpleZombie.alive && !this._purpleZombie.dying) {
      const pdx = this._purpleZombie.position.x - px, pdz = this._purpleZombie.position.z - pz;
      const pdist = Math.hypot(pdx, pdz);
      const purpleReach = SWORD.RANGE * 1.6;
      if (pdist <= purpleReach) {
        const pdiff = Math.abs(normalizeAngle(Math.atan2(-pdx, -pdz) - facing));
        if (pdiff <= SWORD.ARC / 2 && pdist < bestDist) {
          bestDist = pdist; bestZombie = null; bestIsBoss = false; bestIsPurple = true;
        }
      }
    }

    if (bestIsBoss) {
      const dmg = BOSS.WEAPON_DAMAGE[player.sword.weaponType] ?? BOSS.WEAPON_DAMAGE.copper;
      if (this._boss.takeDamage(dmg)) soundManager.playZombieDeath();
    } else if (bestIsPurple) {
      if (this._purpleZombie.takeDamage(player.sword.damage)) soundManager.playZombieDeath();
    } else if (bestZombie) {
      if (bestZombie.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
  }

  _hitBossIfInRange(px, pz, player, range) {
    if (!this._boss || !this._boss.alive || this._boss.dying) return;
    if (Math.hypot(this._boss.position.x - px, this._boss.position.z - pz) > range) return;
    const dmg = BOSS.WEAPON_DAMAGE[player.sword.weaponType] ?? BOSS.WEAPON_DAMAGE.copper;
    if (this._boss.takeDamage(dmg)) soundManager.playZombieDeath();
  }

  _hitPurpleIfInRange(px, pz, player, range) {
    if (!this._purpleZombie || !this._purpleZombie.alive || this._purpleZombie.dying) return;
    if (Math.hypot(this._purpleZombie.position.x - px, this._purpleZombie.position.z - pz) > range) return;
    if (this._purpleZombie.takeDamage(player.sword.damage)) soundManager.playZombieDeath();
  }

  // ── 光の剣: 前方扇形に波動弾 ─────────────────────────────
  _resolveLight(player) {
    const px = player.position.x, pz = player.position.z;
    const facing = player.facing;
    const range  = SWORD.RANGE * 2.8;
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      const dx = z.position.x - px, dz = z.position.z - pz;
      if (Math.hypot(dx, dz) > range) continue;
      const diff = Math.abs(normalizeAngle(Math.atan2(-dx, -dz) - facing));
      if (diff > Math.PI * 0.55) continue;
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
    this._hitBossIfInRange(px, pz, player, range);
    this._hitPurpleIfInRange(px, pz, player, range);
    this._spawnLightWaveVfx(player.position, facing);
  }

  // ── ブラックホールソード: 引力 → 二連ダメージ ─────────────
  _resolveBlackhole(player) {
    const px = player.position.x, pz = player.position.z;
    const pullRange = SWORD.RANGE * 2.4;
    const hitRange  = SWORD.RANGE * 1.8;
    // 引力: ゾンビをプレイヤーに近づける
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      const dx = px - z.position.x, dz = pz - z.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > pullRange || dist < 0.6) continue;
      const pull = 1.5;
      z.root.position.x += (dx / dist) * pull;
      z.root.position.z += (dz / dist) * pull;
    }
    // ダメージ判定
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      if (Math.hypot(z.position.x - px, z.position.z - pz) > hitRange) continue;
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
    this._hitBossIfInRange(px, pz, player, hitRange);
    this._hitPurpleIfInRange(px, pz, player, hitRange);
    this._spawnBlackholeVfx(player.position);
  }

  // ── ライトニングソード: 5連斬り・各ヒットで雷撃爆発 ──────
  _resolveLightning(player) {
    const px = player.position.x, pz = player.position.z;
    const facing = player.facing;
    const range  = SWORD.RANGE * 2.2;   // 近距離高威力
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      const dx = z.position.x - px, dz = z.position.z - pz;
      if (Math.hypot(dx, dz) > range) continue;
      const diff = Math.abs(normalizeAngle(Math.atan2(-dx, -dz) - facing));
      if (diff > Math.PI * 0.50) continue;
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
    this._hitBossIfInRange(px, pz, player, range);
    this._hitPurpleIfInRange(px, pz, player, range);
    this._spawnLightningStrikeVfx(player.position, facing);
  }

  // ── 光の波動弾 VFX ────────────────────────────────────────
  _spawnLightWaveVfx(pos, facing) {
    const COLS = [0xffffff, 0xffd700, 0xffee80, 0xffcc00];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const spread = (i / (N - 1)) * Math.PI * 1.1 - Math.PI * 0.55;
      const angle  = facing + spread;
      const speed  = 10 + Math.random() * 4;
      const geo  = new THREE.BoxGeometry(0.07, 0.07, 0.45);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.1, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.65,
        vx: -Math.sin(angle) * speed,
        vy: 0.3,
        vz: -Math.cos(angle) * speed,
        gravity: false,
      });
    }
  }

  // ── ブラックホール VFX ────────────────────────────────────
  _spawnBlackholeVfx(pos) {
    const DARK = [0x6600cc, 0x440099, 0x220055, 0x000022];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const r     = 2.5 + Math.random() * 1.5;
      const speed = 6 + Math.random() * 4;
      const geo  = new THREE.BoxGeometry(0.10, 0.10, 0.10);
      const mat  = new THREE.MeshBasicMaterial({ color: DARK[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + Math.sin(angle) * r,
        pos.y + 0.8 + Math.random() * 0.8,
        pos.z + Math.cos(angle) * r,
      );
      this.scene.add(mesh);
      // 中心に向かって引き込まれる
      this._particles.push({
        mesh, life: 0.5,
        vx: -Math.sin(angle) * speed,
        vy: 0.5,
        vz: -Math.cos(angle) * speed,
        gravity: false,
      });
    }
    // 中心の爆発フラッシュ
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      const geo  = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const mat  = new THREE.MeshBasicMaterial({ color: 0xaa00ff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.0, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.35,
        vx: Math.sin(angle) * speed,
        vy: 1.5,
        vz: Math.cos(angle) * speed,
        gravity: true,
      });
    }
  }

  // ── ライトニング VFX: 各ヒットで雷撃爆発スパーク ──────────
  _spawnLightningStrikeVfx(pos, facing) {
    // 衝撃点（プレイヤー前方）
    const ix = pos.x - Math.sin(facing) * 2.0;
    const iz = pos.z - Math.cos(facing) * 2.0;
    const iy = pos.y + 0.6;

    const SPARK  = [0xffff00, 0xffffff, 0xffee44, 0x88ffff, 0xffffcc];
    const BEAM   = [0xffffff, 0xffff00];

    // 衝撃点から放射状スパーク
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 6 + Math.random() * 6;
      const geo  = new THREE.BoxGeometry(0.055, 0.055, 0.22);
      const mat  = new THREE.MeshBasicMaterial({ color: SPARK[i % 5] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ix, iy + Math.random() * 0.6, iz);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.28,
        vx: Math.sin(angle) * speed,
        vy: 3.5 + Math.random() * 3.0,
        vz: Math.cos(angle) * speed,
        gravity: true,
      });
    }

    // プレイヤーから衝撃点への高速ビーム
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * 0.18;
      const angle  = facing + spread;
      const speed  = 22 + Math.random() * 8;
      const geo  = new THREE.BoxGeometry(0.042, 0.042, 0.55);
      const mat  = new THREE.MeshBasicMaterial({ color: BEAM[i % 2] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.0 + (Math.random() - 0.5) * 0.35, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.18,
        vx: -Math.sin(angle) * speed,
        vy: 0.0,
        vz: -Math.cos(angle) * speed,
        gravity: false,
      });
    }

    // 衝撃点で上昇する電撃フラッシュ
    for (let i = 0; i < 6; i++) {
      const geo  = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const mat  = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0xffff00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        ix + (Math.random() - 0.5) * 0.5,
        iy,
        iz + (Math.random() - 0.5) * 0.5,
      );
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.22,
        vx: (Math.random() - 0.5) * 2,
        vy: 5 + Math.random() * 4,
        vz: (Math.random() - 0.5) * 2,
        gravity: true,
      });
    }
  }

  // ── ネザライト VFX ────────────────────────────────────────
  _spawnNetheriteVfx(pos) {
    const LIGHT = [0xffffff, 0xd0d0ff, 0xffd0ff, 0xaaccff];
    const DARK  = [0x9900ff, 0x6600cc, 0x440088, 0x220055];
    for (let i = 0; i < 16; i++) {
      const angle     = (i / 16) * Math.PI * 2;
      const elevation = Math.PI / 5 + Math.random() * Math.PI / 3;
      const speed     = 8 + Math.random() * 5;
      const isLight   = i < 8;
      const color     = isLight ? LIGHT[i % 4] : DARK[(i - 8) % 4];
      const geo  = new THREE.BoxGeometry(0.09, 0.09, 0.55);
      const mat  = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.2, pos.z);
      this.scene.add(mesh);
      this._arrows.push({
        mesh, life: 1.2,
        vx: Math.sin(angle) * Math.cos(elevation) * speed,
        vy: Math.sin(elevation) * speed,
        vz: Math.cos(angle) * Math.cos(elevation) * speed,
      });
    }
  }

  _onKill() {
    this.killed++;
    const got = { stone: false, ore: false };
    if (Math.random() < this._stageDrop.STONE) { this.drops.stone++; got.stone = true; }
    if (Math.random() < this._stageDrop.ORE)   { this.drops.ore++;   got.ore   = true; }
    if (this.onKill) this.onKill({ drops: this.drops, got, remaining: this.aliveCount });
  }

  clear() {
    for (const z of this.zombies) z.dispose(this.scene);
    if (this._boss) { this._boss.dispose(this.scene); this._boss = null; }
    if (this._purpleZombie) { this._purpleZombie.dispose(this.scene); this._purpleZombie = null; }
    for (const a of this._arrows) {
      this.scene.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mesh.material.dispose();
    }
    for (const p of this._particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.zombies        = [];
    this._arrows        = [];
    this._particles     = [];
    this.drops          = { stone: 0, ore: 0 };
    this.killed         = 0;
    this._clearedFired  = false;
    this._hasBoss       = false;
    this._bossSpawned   = false;
    this._hasPurple     = false;
    this._purpleSpawned = false;
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }
function normalizeAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
