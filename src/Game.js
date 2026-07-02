// シーン/カメラ/レンダラ/ライト/ループの統括。状態は main.js が持つ。
import * as THREE from 'three';
import { buildForest } from './Forest.js';
import { buildStoneForest } from './StoneForest.js';
import { buildLavaBiome } from './LavaBiome.js';
import { buildDesertBiome } from './DesertBiome.js';
import { buildIceBiome } from './IceBiome.js';
import { buildDemonBiome } from './DemonBiome.js';
import { buildHeavenBiome } from './HeavenBiome.js';
import { buildSeaBiome } from './SeaBiome.js';
import { buildSpaceBiome } from './SpaceBiome.js';
import { buildPoisonForestBiome } from './PoisonForestBiome.js';
import { buildSunBiome } from './SunBiome.js';
import { buildWhiteWorldBiome } from './WhiteWorldBiome.js';
import { Player } from './Player.js';
import { ZombieManager } from './ZombieManager.js';
import { Pet } from './Pet.js';
import { Robot } from './Robot.js';
import { StoneGolem } from './StoneGolem.js';
import { COLORS, PLAYER, SPECIAL } from './core/Constants.js';

export class Game {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

    const ambient = new THREE.AmbientLight(COLORS.SKY, 1.1);
    this.scene.add(ambient);
    this._ambient = ambient;

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
    sun.position.set(20, 35, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 100;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const { group, bounds } = buildForest(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;

    this.player = new Player();
    this.scene.add(this.player.root);

    this.zombies = new ZombieManager(this.scene);
    this.pet   = null;
    this.robot = null;
    this.golem = null;

    this._camTarget = new THREE.Vector3();
    this._updateCamera(1, true);

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  inputToWorld(joyValue) {
    return { x: joyValue.x, z: joyValue.y };
  }

  update(dt, joyValue) {
    const move  = this.inputToWorld(joyValue);
    const doHit = this.player.update(dt, move, this.bounds);
    if (doHit) this.zombies.resolveAttack(this.player);

    // 分身の更新（武器エフェクト・ダメージはプレイヤーと同じ resolveAttack で解決）
    const aliveClones = [];
    for (const c of this.player._clones) {
      if (c.alive) {
        const doHit = c.update(dt, this.zombies.allTargets);
        if (doHit) this.zombies.resolveAttack(c);
        aliveClones.push(c);
      } else {
        c.dispose();
      }
    }
    this.player._clones = aliveClones;

    // ゾンビが攻撃できる対象（分身＋ペット）
    const targets = aliveClones.slice();

    // ペット更新（追従＋ゾンビに噛みつく）
    if (this.pet) {
      if (this.pet.alive) {
        this.pet.update(dt, this.player, this.zombies.zombies, () => this.zombies.recordKill());
        targets.push(this.pet);
      } else {
        this.pet = null;
      }
    }

    // 特殊ロボット更新（無敵＝ゾンビの標的にはしない）
    if (this.robot && this.robot.alive) {
      this.robot.update(dt, this.player, this.zombies.zombies, () => this.zombies.recordKill());
    }

    // ストーンゴーレム更新
    if (this.golem) {
      if (this.golem.alive) {
        const didSlam = this.golem.update(dt, this.player.root.position);
        if (didSlam) {
          this.zombies.stunNearby(
            this.golem.position.x, this.golem.position.z,
            SPECIAL.GOLEM_STUN_RADIUS, SPECIAL.GOLEM_STUN_DURATION,
          );
        }
      } else {
        this.golem = null;
      }
    }

    const dmg = this.zombies.update(dt, this.player, targets);
    if (dmg > 0 && !this.player.invincible) {
      if (!this.player.absorbBarrierHit()) {
        this.player.takeDamage(dmg);
        // シャイ猫など：主人公が攻撃された通知
        if (this.pet && this.pet.alive && this.pet.onPlayerHit) this.pet.onPlayerHit();
      }
    }
    this._updateCamera(dt, false);
  }

  _updateCamera(dt, instant) {
    const p = this.player.root.position;
    const desired = new THREE.Vector3(p.x, p.y + 4.5, p.z + 7.5);
    if (instant) {
      this.camera.position.copy(desired);
    } else {
      this.camera.position.lerp(desired, Math.min(1, dt * 6));
    }
    this._camTarget.set(p.x, p.y + 1.4, p.z - 1);
    this.camera.lookAt(this._camTarget);
    this.sun.position.set(p.x + 20, 35, p.z + 12);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  spawnGolem() {
    if (!this.golem || !this.golem.alive) {
      this.golem = new StoneGolem(this.scene, this.player.root.position.clone());
    }
  }

  startStage() {
    this.player.reset();
    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.zombies.spawn();
    this._updateCamera(1, true);
  }

  startStage2() {
    // 現在のステージを撤去して石バイオームに切り替え
    this._clearStageGroup();
    const { group } = buildStoneForest(this.scene);
    this._stageGroup = group;
    // ライトを薄暗く
    this._ambient.color.set(0x5a6080);
    this.sun.color.set(0xd0d8e8);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupBossStage(5);
    this._updateCamera(1, true);
  }

  startStage3() {
    this._clearStageGroup();
    const { group, bounds } = buildLavaBiome(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;
    // 暗いオレンジ系ライト
    this._ambient.color.set(0x402010);
    this.sun.color.set(0xff6600);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupStage3();
    this._updateCamera(1, true);
  }

  startStage4() {
    this._clearStageGroup();
    const { group, bounds } = buildDesertBiome(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;
    // 暖かい砂漠のライト
    this._ambient.color.set(0x806040);
    this.sun.color.set(0xffd080);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupStage4();
    this._updateCamera(1, true);
  }

  startStage5() {
    this._clearStageGroup();
    const { group, bounds } = buildIceBiome(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;
    // 冷たい青白いライト
    this._ambient.color.set(0x6080c0);
    this.sun.color.set(0xd0e8ff);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupStage5();
    this._updateCamera(1, true);
  }

  startStage6() {
    this._clearStageGroup();
    const { group, bounds } = buildDemonBiome(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;
    // 暗い魔界のライト（紫がかった暗闇）
    this._ambient.color.set(0x180020);
    this.sun.color.set(0x8800aa);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupStage6();
    this._updateCamera(1, true);
  }

  startStage7() {
    this._clearStageGroup();
    const { group, bounds } = buildHeavenBiome(this.scene);
    this._stageGroup = group;
    this.bounds = bounds;
    // 天国の明るい白いライト
    this._ambient.color.set(0xb0c8ff);
    this.sun.color.set(0xffffff);

    if (this.golem) { this.golem.dispose(); this.golem = null; }
    if (this.golem) { this.golem.dispose(); this.golem = null; }
    this.player.reset();
    this.zombies.setupStage7();
    this._updateCamera(1, true);
  }

  startStage8() {
    this._clearStageGroup();
    const { group, bounds } = buildSeaBiome(this.scene);
    this._stageGroup = group; this.bounds = bounds;
    this._ambient.color.set(0x6090c0);
    this.sun.color.set(0xcfe8ff);
    this.player.reset();
    this.zombies.setupStage8();
    this._updateCamera(1, true);
  }

  startStage9() {
    this._clearStageGroup();
    const { group, bounds } = buildSpaceBiome(this.scene);
    this._stageGroup = group; this.bounds = bounds;
    this._ambient.color.set(0x404070);
    this.sun.color.set(0x8090d0);
    this.player.reset();
    this.zombies.setupStage9();
    this._updateCamera(1, true);
  }

  startStage10() {
    this._clearStageGroup();
    const { group, bounds } = buildPoisonForestBiome(this.scene);
    this._stageGroup = group; this.bounds = bounds;
    this._ambient.color.set(0x4a3060);
    this.sun.color.set(0x9a70c0);
    this.player.reset();
    this.zombies.setupStage10();
    this._updateCamera(1, true);
  }

  startStage11() {
    this._clearStageGroup();
    const { group, bounds } = buildSunBiome(this.scene);
    this._stageGroup = group; this.bounds = bounds;
    this._ambient.color.set(0xffb060);
    this.sun.color.set(0xffe0a0);
    this.player.reset();
    // 自分と同じ武器・攻撃力のエンティティ
    this.zombies.setupStage11(this.player.sword.weaponType, this.player.sword.damage);
    this._updateCamera(1, true);
  }

  startStage12() {
    this._clearStageGroup();
    const { group, bounds } = buildWhiteWorldBiome(this.scene);
    this._stageGroup = group; this.bounds = bounds;
    this._ambient.color.set(0xf4f4f4);
    this.sun.color.set(0xffffff);
    this.player.reset();
    this.zombies.setupStage12();
    this._updateCamera(1, true);
  }

  // エンドレスモード：広い真っ白い世界
  startEndless() {
    this._clearStageGroup();
    const R = 60;
    const group = new THREE.Group();
    const gM = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.92, emissive: 0xf4f4f4, emissiveIntensity: 0.25,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 12, 72), gM);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);
    this.scene.add(group);
    this.scene.fog = new THREE.Fog(0xffffff, 32, R + 24);
    this.scene.background = new THREE.Color(0xffffff);

    this._stageGroup = group;
    this.bounds = { radius: R };
    this._ambient.color.set(0xf6f6f6);
    this.sun.color.set(0xffffff);

    this.player.reset();
    this.zombies.setupEndless();
    this._updateCamera(1, true);
  }

  // バトル開始時にペットを出す（type が null なら出さない）
  spawnPet(type) {
    if (this.pet) { this.pet.dispose(); this.pet = null; }
    if (!type) return;
    const p = this.player.root.position;
    const pos = new THREE.Vector3(p.x + 1.3, 0, p.z + 1.3);
    this.pet = new Pet(this.scene, pos, type);
  }

  // バトル開始時に特殊ロボットを出す（type が null なら出さない）
  spawnRobot(type) {
    if (this.robot) { this.robot.dispose(); this.robot = null; }
    if (!type) return;
    const p = this.player.root.position;
    const pos = new THREE.Vector3(p.x - 1.3, 0, p.z + 1.3);
    this.robot = new Robot(this.scene, pos, type);
  }

  _clearStageGroup() {
    if (!this._stageGroup) return;
    this.scene.remove(this._stageGroup);
    this._stageGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    this._stageGroup = null;
  }
}
