// ゾンビ管理。スポーン・更新・全滅判定・撃破ドロップ。
// stage2 では 5体のゾンビを倒した後にボスが出現する。
// stage3 では通常ゾンビ+ミニゾンビを倒した後に紫ゾンビが出現する。
import * as THREE from 'three';
import { Zombie } from './Zombie.js';
import { MiniZombie } from './MiniZombie.js';
import { PurpleZombie } from './PurpleZombie.js';
import { Boss } from './Boss.js';
import { ArcherZombie } from './ArcherZombie.js';
import { PurpleElephant } from './PurpleElephant.js';
import { SunEntity } from './SunEntity.js';
import { STAGE, STAGE2, STAGE3, STAGE4, STAGE5, STAGE6, STAGE7, STAGE8, STAGE9, STAGE10, STAGE11, STAGE12, SWORD, BOSS, MINI_ZOMBIE, PURPLE_ZOMBIE, SPECIAL, WEAPONS } from './core/Constants.js';
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
    this._meteors   = [];  // 特殊技「隕石投げ」の隕石

    // stage2 ボス管理
    this._hasBoss    = false;
    this._boss       = null;
    this._bossSpawned = false;
    this._stageDrop  = STAGE.DROP;  // スポーン時に切り替え

    // stage3 紫ゾンビ管理
    this._hasPurple    = false;
    this._purpleZombie = null;
    this._purpleSpawned = false;

    // stage12 真っ白い世界（2ウェーブ）
    this._whiteWorld = false;
    this._whiteWave  = 0;

    // エンドレスモード
    this._endless      = false;
    this._endlessCount = 0;
    this.onEndlessKill = null;  // (count) => {} 倒すたびに通知
  }

  get endlessCount() { return this._endlessCount; }

  // エンドレス：ゾンビ1匹から始まり、倒すたびに数が増えていく
  setupEndless() {
    this.clear();
    this._endless      = true;
    this._endlessCount = 0;
    this._stageDrop    = { STONE: 0, ORE: 0 }; // 素材ドロップなし
    this._spawnEndlessZombie();
  }

  _spawnEndlessZombie() {
    const ang = Math.random() * Math.PI * 2;
    const r   = 16 + Math.random() * 14;
    const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    const z   = new Zombie(pos);
    this.scene.add(z.root);
    this.zombies.push(z);
  }

  // ── 追加ステージ用スポーンヘルパー ───────────────────────────
  _spawnAt(EnemyClass, rMin, rMax, ...args) {
    const ang = Math.random() * Math.PI * 2;
    const r   = rMin + Math.random() * (rMax - rMin);
    const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    const e = new EnemyClass(pos, ...args);
    this.scene.add(e.root);
    this.zombies.push(e);
    return e;
  }

  _spawnElephant() { return this._spawnAt(PurpleElephant, 12, 18); }

  // stage8: 海 — イノシシ/紫瞳/紫象 を各2体（全部 zombies 配列で扱う）
  setupStage8() {
    this.clear();
    this._hasBoss = false; this._hasPurple = false; this._whiteWorld = false;
    this._stageDrop = STAGE8.DROP;
    const n = STAGE8.BOSS_EACH;
    for (let i = 0; i < n; i++) {
      this._spawnAt(Boss, 14, 18);
      this._spawnAt(PurpleZombie, 12, 16);
      this._spawnElephant();
    }
  }

  // stage9: 宇宙 — 弓矢ゾンビ20体
  setupStage9() {
    this.clear();
    this._hasBoss = false; this._hasPurple = false; this._whiteWorld = false;
    this._stageDrop = STAGE9.DROP;
    for (let i = 0; i < STAGE9.ARCHER_COUNT; i++) {
      this._spawnAt(ArcherZombie, 14, STAGE9.RADIUS - 4, this.scene);
    }
  }

  // stage10: 毒の森 — 各ゾンビ4体ずつ + 紫象1体
  setupStage10() {
    this.clear();
    this._hasBoss = false; this._hasPurple = false; this._whiteWorld = false;
    this._stageDrop = STAGE10.DROP;
    const n = STAGE10.EACH;
    for (let i = 0; i < n; i++) {
      this._spawnAt(Zombie, 14, STAGE10.RADIUS - 4);
      this._spawnAt(MiniZombie, 14, STAGE10.RADIUS - 4);
      this._spawnAt(ArcherZombie, 14, STAGE10.RADIUS - 4, this.scene);
      this._spawnAt(PurpleZombie, 12, 16);
    }
    for (let i = 0; i < STAGE10.ELEPHANT_COUNT; i++) this._spawnElephant();
  }

  // stage11: 太陽の中 — 自分と同じスキン・攻撃力のエンティティ2体（特殊技なし）
  setupStage11(weaponType, damage) {
    this.clear();
    this._hasBoss = false; this._hasPurple = false; this._whiteWorld = false;
    this._stageDrop = STAGE11.DROP;
    for (let i = 0; i < STAGE11.ENTITY_COUNT; i++) {
      this._spawnAt(SunEntity, 10, 14, weaponType, damage);
    }
  }

  // stage12: 真っ白い世界 — ウェーブ1=ボス全種、全滅後にウェーブ2=紫象3体
  setupStage12() {
    this.clear();
    this._hasBoss = false; this._hasPurple = false;
    this._whiteWorld = true;
    this._whiteWave  = 1;
    this._stageDrop  = STAGE12.DROP;
    const n = STAGE12.WAVE1_EACH;
    for (let i = 0; i < n; i++) {
      this._spawnAt(Boss, 14, 18);
      this._spawnAt(PurpleZombie, 12, 16);
      this._spawnElephant();
    }
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

  // stage5: 氷のバイオーム — チビゾンビ10 + 通常ゾンビ2
  setupStage5() {
    this.clear();
    this._hasPurple    = false;
    this._hasBoss      = false;
    this._stageDrop    = STAGE5.DROP;
    const miniCount    = STAGE5.MINI_ZOMBIE_COUNT;
    const total        = miniCount + STAGE5.ZOMBIE_COUNT;
    for (let i = 0; i < miniCount; i++) this._spawnMiniZombie(i, total);
    for (let i = 0; i < STAGE5.ZOMBIE_COUNT; i++) this._spawnZombie(miniCount + i, total);
  }

  // stage6: 魔界バイオーム — 紫の瞳ゾンビ3体（通常ゾンビ枠として直接スポーン）
  setupStage6() {
    this.clear();
    this._hasPurple    = false;
    this._hasBoss      = false;
    this._stageDrop    = STAGE6.DROP;
    const n = STAGE6.PURPLE_COUNT;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const r   = rand(12, STAGE6.RADIUS - 6);
      const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
      const z   = new PurpleZombie(pos);
      this.scene.add(z.root);
      this.zombies.push(z);
    }
  }

  // stage7: 天国バイオーム — 弓矢ゾンビ + チビゾンビ2
  setupStage7() {
    this.clear();
    this._hasPurple    = false;
    this._hasBoss      = false;
    this._stageDrop    = STAGE7.DROP;
    const miniCount    = STAGE7.MINI_ZOMBIE_COUNT;
    const archerCount  = STAGE7.ARCHER_COUNT;
    const total        = miniCount + archerCount;
    for (let i = 0; i < miniCount; i++) this._spawnMiniZombie(i, total);
    for (let i = 0; i < archerCount; i++) {
      const ang = ((miniCount + i) / total) * Math.PI * 2 + rand(-0.3, 0.3);
      const r   = rand(14, STAGE7.RADIUS - 4);
      const pos = new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r);
      const z   = new ArcherZombie(pos, this.scene);
      this.zombies.push(z);
    }
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
  update(dt, player, clones = []) {
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

    // 隕石（特殊技）更新
    this._updateMeteors(dt);

    // 透明化: ゾンビはその場でくるくる回転し、攻撃しない
    if (player.isInvisible) {
      for (const z of this.zombies) {
        if (z.alive && !z.dying) z.updateSpin(dt);
      }
      for (let i = this.zombies.length - 1; i >= 0; i--) {
        if (!this.zombies[i].alive) { this.zombies[i].dispose(this.scene); this.zombies.splice(i, 1); }
      }
      if (this._boss         && this._boss.alive)         this._boss.root.rotation.y         += dt * 3;
      if (this._purpleZombie && this._purpleZombie.alive) this._purpleZombie.root.rotation.y += dt * 3;
      return 0;
    }

    // 分身がいる場合: 各ゾンビが最近接ターゲット（プレイヤー or 分身）を追う
    const activeClones = clones.filter(c => c.alive);

    // ゾンビ更新
    let totalDmg = 0;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const target = activeClones.length > 0 ? this._nearestTarget(z, player, activeClones) : player;
      totalDmg += z.update(dt, target);
      // 分身への攻撃ダメージを分身に適用
      if (target !== player && totalDmg > 0) {
        target.takeDamage(1);
        totalDmg = 0;
      }
    }
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      if (!this.zombies[i].alive) {
        this.zombies[i].dispose(this.scene);
        this.zombies.splice(i, 1);
      }
    }

    // エンドレス: 常に必要数を維持して湧かせ続ける（クリア判定なし）
    if (this._endless) {
      const desired = 1 + Math.floor(this._endlessCount / 3); // 3体倒すごとに同時数+1
      let active = this.zombies.filter(z => !z.dying).length;
      let guard = 0;
      while (active < desired && guard++ < 30) { this._spawnEndlessZombie(); active++; }
      return totalDmg;
    }

    // stage2: ゾンビ全滅後にボスをスポーン
    if (this._hasBoss && !this._bossSpawned && this.zombies.length === 0 && this.killed > 0) {
      this._spawnBoss();
    }

    // stage3: ゾンビ全滅後に紫ゾンビをスポーン
    if (this._hasPurple && !this._purpleSpawned && this.zombies.length === 0 && this.killed > 0) {
      this._spawnPurpleZombie();
    }

    // stage12: ウェーブ1（ボス全種）を全滅 → ウェーブ2（紫象3体）
    if (this._whiteWorld && this._whiteWave === 1 && this.zombies.length === 0 && this.killed > 0) {
      this._whiteWave = 2;
      for (let i = 0; i < STAGE12.WAVE2_ELEPHANTS; i++) this._spawnElephant();
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
    const whiteOk  = !this._whiteWorld || this._whiteWave === 2;
    if (!this._clearedFired && this.zombies.length === 0 && this.killed > 0 && bossOk && purpleOk && whiteOk) {
      this._clearedFired = true;
      if (this.onCleared) this.onCleared();
    }

    return totalDmg;
  }

  // ── 攻撃判定 ─────────────────────────────────────────────
  // 分身がゾンビを倒したときに呼ばれる（kill カウント更新）
  recordKill() { this._onKill(); }

  // 分身が攻撃できる全ターゲット（ゾンビ＋ボス＋紫ゾンビ）
  get allTargets() {
    return [
      ...this.zombies,
      ...(this._boss && this._boss.alive ? [this._boss] : []),
      ...(this._purpleZombie && this._purpleZombie.alive ? [this._purpleZombie] : []),
    ];
  }

  // 分身がいる場合: ゾンビの最近接ターゲットを選ぶ
  _nearestTarget(zombie, player, clones) {
    let best = player;
    let bestDist = Math.hypot(player.position.x - zombie.root.position.x, player.position.z - zombie.root.position.z);
    for (const c of clones) {
      const d = Math.hypot(c.position.x - zombie.root.position.x, c.position.z - zombie.root.position.z);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

  resolveAttack(player) {
    const px = player.position.x, pz = player.position.z;
    const wt = player.sword.weaponType;

    if (wt === 'light')     { this._resolveLight(player);     return; }
    if (wt === 'blackhole') { this._resolveBlackhole(player); return; }
    if (wt === 'lightning') { this._resolveLightning(player); return; }
    if (wt === 'bubble')    { this._resolveBubble(player);    return; }
    if (wt === 'inferno')   { this._resolveInferno(player);   return; }
    if (wt === 'ice')       { this._resolveIce(player);       return; }

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

  // ── バブルソード: 周囲に泡を噴出し全方向AOE ─────────────────
  _resolveBubble(player) {
    const px = player.position.x, pz = player.position.z;
    const range = 8;
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      if (Math.hypot(z.position.x - px, z.position.z - pz) > range) continue;
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
    this._hitBossIfInRange(px, pz, player, range);
    this._hitPurpleIfInRange(px, pz, player, range);
    this._spawnBubbleVfx(player.position);
  }

  _spawnBubbleVfx(pos) {
    const COLS = [0x40e0d0, 0x87ceeb, 0x00ced1, 0xe0f7ff, 0xb2ebf2];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 + rand(-0.15, 0.15);
      const speed = 5 + Math.random() * 5;
      const size  = 0.18 + Math.random() * 0.12;
      const geo  = new THREE.SphereGeometry(size, 6, 6);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 5] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.2, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 1.4,
        vx: Math.sin(angle) * speed,
        vy: rand(0.5, 1.5),
        vz: Math.cos(angle) * speed,
        gravity: true,
      });
    }
  }

  // ── インフェルノソード: トルネード爆発 + 122本の炎の矢 ───────
  _resolveInferno(player) {
    const px = player.position.x, pz = player.position.z;
    const range = SPECIAL.INFERNO_RADIUS;
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      if (Math.hypot(z.position.x - px, z.position.z - pz) > range) continue;
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
      else this._spawnRedAuraVfx(z.position);
    }
    this._hitBossIfInRange(px, pz, player, range);
    this._hitPurpleIfInRange(px, pz, player, range);
    this._spawnInfernoVfx(player.position);
  }

  _spawnInfernoVfx(pos) {
    const FIRE = [0xff4500, 0xff6600, 0xffaa00, 0xff0000, 0xff8800];
    // 渦巻きトルネード粒子 (内側から外側に爆発)
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const r     = 0.5 + Math.random() * 2.5;
      const speed = 5 + Math.random() * 8;
      const geo  = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat  = new THREE.MeshBasicMaterial({ color: FIRE[i % 5] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + Math.sin(angle) * r, pos.y + Math.random() * 2, pos.z + Math.cos(angle) * r);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.7,
        vx: Math.sin(angle) * speed,
        vy: 2 + Math.random() * 4,
        vz: Math.cos(angle) * speed,
        gravity: true,
      });
    }
    // 122本の炎の矢 (全方向ランダム)
    for (let i = 0; i < SPECIAL.INFERNO_ARROW_COUNT; i++) {
      const angle     = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI * 0.4;
      const speed     = 15 + Math.random() * 12;
      const geo  = new THREE.BoxGeometry(0.06, 0.06, 0.38);
      const mat  = new THREE.MeshBasicMaterial({ color: FIRE[i % 5] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.1, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.85,
        vx: Math.sin(angle) * Math.cos(elevation) * speed,
        vy: Math.sin(elevation) * speed,
        vz: Math.cos(angle) * Math.cos(elevation) * speed,
        gravity: false,
      });
    }
  }

  _spawnRedAuraVfx(pos) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const geo  = new THREE.BoxGeometry(0.10, 0.10, 0.10);
      const mat  = new THREE.MeshBasicMaterial({ color: 0xff2200 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 1.0 + Math.random(), pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.45,
        vx: Math.sin(angle) * 2, vy: 2 + Math.random() * 2, vz: Math.cos(angle) * 2,
        gravity: true,
      });
    }
  }

  // ── アイスソード: 各ゾンビに氷柱20本を集中 ─────────────────
  _resolveIce(player) {
    const px = player.position.x, pz = player.position.z;
    const range = 10;
    // プレイヤーオーラ VFX
    this._spawnIceAuraVfx(player.position);
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      if (Math.hypot(z.position.x - px, z.position.z - pz) > range) continue;
      this._spawnIcePillarVfx(player.position, z.position);
      if (z.takeDamage(player.sword.damage)) { soundManager.playZombieDeath(); this._onKill(); }
    }
    this._hitBossIfInRange(px, pz, player, range);
    this._hitPurpleIfInRange(px, pz, player, range);
  }

  _spawnIceAuraVfx(pos) {
    const COLS = [0xadd8e6, 0xe0f7ff, 0x87ceeb, 0xffffff];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const geo  = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + Math.sin(angle) * 1.2, pos.y + 0.8 + Math.random(), pos.z + Math.cos(angle) * 1.2);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.6,
        vx: Math.sin(angle) * 0.5, vy: 1.5 + Math.random(), vz: Math.cos(angle) * 0.5,
        gravity: false,
      });
    }
  }

  _spawnIcePillarVfx(from, to) {
    const COLS = [0xadd8e6, 0xe0f7ff, 0x87ceeb, 0xffffff, 0xb2fafa];
    const dx = to.x - from.x, dz = to.z - from.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    const nx = dx / dist, nz = dz / dist;
    for (let i = 0; i < 20; i++) {
      const offset = rand(-0.5, 0.5);
      const speed  = 10 + Math.random() * 6;
      const geo  = new THREE.BoxGeometry(0.07, 0.38, 0.07);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 5] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        from.x + Math.random() * 2 - 1,
        from.y + 0.8 + Math.random() * 1.2,
        from.z + Math.random() * 2 - 1,
      );
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.55,
        vx: nx * speed + offset,
        vy: (Math.random() - 0.3) * 3,
        vz: nz * speed + offset,
        gravity: false,
      });
    }
  }

  // ── 特殊技「爆無闇死矢」: 幽霊2体 + 紫矢10本 ───────────────
  castGhostArrows(player) {
    const px = player.position.x, pz = player.position.z;
    // 射程内のゾンビを最大10体選ぶ（近い順）
    const targets = [
      ...this.zombies.filter(z => z.alive && !z.dying),
      ...(this._boss && this._boss.alive ? [this._boss] : []),
      ...(this._purpleZombie && this._purpleZombie.alive ? [this._purpleZombie] : []),
    ]
      .filter(z => Math.hypot(z.position.x - px, z.position.z - pz) <= SPECIAL.GHOST_RADIUS)
      .sort((a, b) => Math.hypot(a.position.x - px, a.position.z - pz) - Math.hypot(b.position.x - px, b.position.z - pz))
      .slice(0, SPECIAL.GHOST_COUNT * SPECIAL.GHOST_ARROW_COUNT);

    // 幽霊VFX (2体: プレイヤー左右に出現)
    for (let g = 0; g < SPECIAL.GHOST_COUNT; g++) {
      const gAngle = player.facing + (g === 0 ? -Math.PI / 3 : Math.PI / 3);
      const gx = px + Math.sin(gAngle) * 2.5;
      const gz = pz + Math.cos(gAngle) * 2.5;
      this._spawnGhostVfx(new THREE.Vector3(gx, 0, gz));

      // 各幽霊から矢を5本発射
      for (let a = 0; a < SPECIAL.GHOST_ARROW_COUNT; a++) {
        const angle = gAngle + (a / SPECIAL.GHOST_ARROW_COUNT) * Math.PI * 2;
        const speed = 14 + Math.random() * 8;
        const geo  = new THREE.BoxGeometry(0.06, 0.06, 0.45);
        const mat  = new THREE.MeshBasicMaterial({ color: a % 2 === 0 ? 0xaa00ff : 0x6600cc });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(gx, 1.2, gz);
        this.scene.add(mesh);
        this._particles.push({
          mesh, life: 0.9,
          vx: -Math.sin(angle) * speed,
          vy: (Math.random() - 0.3) * 2,
          vz: -Math.cos(angle) * speed,
          gravity: false,
        });
      }
    }

    // ゾンビを時間差でvanish
    targets.forEach((z, i) => {
      setTimeout(() => {
        if (z.alive && !z.dying) {
          if (z.vanish) {
            z.vanish();
            soundManager.playZombieDeath();
            this._onKill();
          } else {
            if (z.takeDamage(9999)) { soundManager.playZombieDeath(); this._onKill(); }
          }
        }
      }, i * 180);
    });
  }

  _spawnGhostVfx(pos) {
    const COLS = [0xaa00ff, 0xcc44ff, 0xdd88ff, 0x880088];
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const ht    = 0.4 + (i % 4) * 0.45;
      const geo  = new THREE.BoxGeometry(0.09, 0.09, 0.09);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + Math.sin(angle) * 0.35,
        pos.y + ht,
        pos.z + Math.cos(angle) * 0.35,
      );
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 1.0 + Math.random() * 0.4,
        vx: Math.sin(angle) * 0.3,
        vy: 0.5 + Math.random() * 0.8,
        vz: Math.cos(angle) * 0.3,
        gravity: false,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 特殊技「隕石投げ」
  // 近くの生存ゾンビ最大2体に隕石を落とす。
  //   着弾でゾンビは凍結 → 2秒後に蒸発して死亡。
  //   隕石は当たっても残り、着弾10秒後に崩れて消える。
  // ═══════════════════════════════════════════════════════════
  castMeteor(player) {
    const px = player.position.x, pz = player.position.z;
    const targets = this.zombies
      .filter(z => z.alive && !z.dying && !z.frozen)
      .map(z => ({ z, d: Math.hypot(z.position.x - px, z.position.z - pz) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, SPECIAL.METEOR_COUNT);

    for (const { z } of targets) {
      z.freeze();              // 着弾を待つ間も動かないよう即凍結
      this._spawnMeteor(z);
    }
    return targets.length;
  }

  _spawnMeteor(target) {
    const mesh = buildMeteor(SPECIAL.METEOR_SIZE);
    mesh.position.set(target.position.x, SPECIAL.METEOR_SPAWN_Y, target.position.z);
    this.scene.add(mesh);
    this._meteors.push({
      mesh, target,
      vy: 0,
      phase: 'fall',
      deathTimer: SPECIAL.METEOR_FREEZE, // 着弾後カウントダウン
      life: SPECIAL.METEOR_LIFE,         // 着弾後の寿命
      landY: SPECIAL.METEOR_SIZE * 0.9,
    });
  }

  _updateMeteors(dt) {
    for (let i = this._meteors.length - 1; i >= 0; i--) {
      const m = this._meteors[i];
      m.mesh.rotation.x += dt * 1.2;
      m.mesh.rotation.y += dt * 0.9;

      if (m.phase === 'fall') {
        m.vy -= SPECIAL.METEOR_FALL_GRAVITY * dt;
        m.mesh.position.y += m.vy * dt;
        if (m.mesh.position.y <= m.landY) {
          m.mesh.position.y = m.landY;
          m.phase = 'landed';
          soundManager.playMeteorImpact();
          this._spawnMeteorImpactVfx(m.mesh.position);
        }
        continue;
      }

      // 着弾後
      if (m.target) {
        m.deathTimer -= dt;
        if (m.deathTimer <= 0) {
          const z = m.target;
          m.target = null;
          if (z.alive && !z.dying) {
            z.vaporizeDie();
            soundManager.playEvaporate();
            this._spawnVaporVfx(z.position);
            this._onKill();
          }
        }
      }

      m.life -= dt;
      if (m.life <= 2) {
        // 最後の2秒でボロボロ崩れて縮む
        const k = Math.max(0, m.life / 2);
        m.mesh.scale.setScalar(Math.max(0.001, k));
        m.mesh.position.y = m.landY * k;
      }
      if (m.life <= 0) {
        this._disposeMeteor(m);
        this._meteors.splice(i, 1);
      }
    }
  }

  _disposeMeteor(m) {
    this.scene.remove(m.mesh);
    m.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(x => x.dispose());
        else o.material.dispose();
      }
    });
  }

  // 着弾時の砂塵・破片
  _spawnMeteorImpactVfx(pos) {
    const COLS = [0xff6622, 0xffaa33, 0x552211, 0x884422];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const speed = 4 + Math.random() * 5;
      const geo  = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.3, pos.z);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.6,
        vx: Math.sin(angle) * speed, vy: 3 + Math.random() * 3, vz: Math.cos(angle) * speed,
        gravity: true,
      });
    }
  }

  // 蒸発する湯気
  _spawnVaporVfx(pos) {
    const COLS = [0xccffcc, 0xaaffdd, 0xeeffee, 0x99ddbb];
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * 0.4;
      const geo  = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat  = new THREE.MeshBasicMaterial({ color: COLS[i % 4] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + Math.sin(angle) * r, 0.5 + Math.random() * 0.5, pos.z + Math.cos(angle) * r);
      this.scene.add(mesh);
      this._particles.push({
        mesh, life: 0.9,
        vx: Math.sin(angle) * 0.6, vy: 2 + Math.random() * 1.5, vz: Math.cos(angle) * 0.6,
        gravity: false,
      });
    }
  }

  _onKill() {
    this.killed++;
    if (this._endless) {
      this._endlessCount++;
      if (this.onEndlessKill) this.onEndlessKill(this._endlessCount);
      return; // エンドレスは素材ドロップなし
    }
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
    for (const m of this._meteors) this._disposeMeteor(m);
    this.zombies        = [];
    this._arrows        = [];
    this._particles     = [];
    this._meteors       = [];
    this.drops          = { stone: 0, ore: 0 };
    this.killed         = 0;
    this._clearedFired  = false;
    this._hasBoss       = false;
    this._bossSpawned   = false;
    this._hasPurple     = false;
    this._purpleSpawned = false;
    this._whiteWorld    = false;
    this._whiteWave     = 0;
    this._endless       = false;
    this._endlessCount  = 0;
  }
}

// ── 隕石メッシュ生成（ごつごつした溶岩岩） ──────────────────
function buildMeteor(radius) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  // 頂点を少しランダムにずらして岩のごつごつ感を出す
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.82 + Math.random() * 0.36;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x3a2218, roughness: 1.0, metalness: 0.0,
    emissive: 0xff4500, emissiveIntensity: 0.6,
  }));
  rock.castShadow = true;
  g.add(rock);
  return g;
}

function rand(a, b) { return a + Math.random() * (b - a); }
function normalizeAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
