// シーン/カメラ/レンダラ/ライト/ループの統括。状態は main.js が持つ。
import * as THREE from 'three';
import { buildForest } from './Forest.js';
import { buildStoneForest } from './StoneForest.js';
import { buildLavaBiome } from './LavaBiome.js';
import { buildDesertBiome } from './DesertBiome.js';
import { Player } from './Player.js';
import { ZombieManager } from './ZombieManager.js';
import { COLORS, PLAYER } from './core/Constants.js';

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
    const dmg = this.zombies.update(dt, this.player);
    if (dmg > 0) this.player.takeDamage(dmg);
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

  startStage() {
    this.player.reset();
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

    this.player.reset();
    this.zombies.setupStage4();
    this._updateCamera(1, true);
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
