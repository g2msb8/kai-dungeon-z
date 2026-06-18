// ホーム画面の環境NPC。自律的に歩き回り、各施設を訪れる。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { COLORS } from './core/Constants.js';

// 各施設のワールド座標（HomeScene の建物位置と一致させる）
const DEST = {
  training:   new THREE.Vector3(-12, 0,  0),
  blacksmith: new THREE.Vector3( 12, 0,  0),
  shop:       new THREE.Vector3(  0, 0,-12),
  battle:     new THREE.Vector3(  0, 0, 12),
};

const HAIR_COLORS  = [0x2a180a, 0x5c3d1e, 0xf0c060, 0xe04030, 0x111130, 0x888888];
const CLOTH_COLORS = [0x111111, 0x336699, 0x993322, 0x228833, 0x994488, 0x4a4a2a];

const MOVE_SPEED = 3.2;   // m/s
const ROOM_RADIUS = 16;   // 部屋の壁まで

function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

export class NPC {
  constructor(scene, index) {
    const hairColor  = HAIR_COLORS[index % HAIR_COLORS.length];
    const clothColor = CLOTH_COLORS[Math.floor(index * 1.3) % CLOTH_COLORS.length];

    const h = buildHumanoid({
      skin:        COLORS.PLAYER_SKIN,
      cloth:       clothColor,
      pants:       COLORS.PLAYER_PANTS,
      pantsAccent: COLORS.PLAYER_PANTS_DARK,
      skinDark:    COLORS.PLAYER_SKIN,
      face:        'player',
      hairColor,
    });
    h.root.scale.setScalar(1.25);
    h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this._h       = h;
    this.root     = h.root;
    this._scene   = scene;
    this._moving  = false;
    this._facing  = Math.random() * Math.PI * 2;
    this._phase   = Math.random() * Math.PI * 2;
    this._target  = null;
    this._onArrive = null;

    // ステートマシン: idle / moving / waiting / gone
    this._state      = 'idle';
    this._stateTimer = 0;

    // 初期位置はセンター付近にランダム配置
    const ang = (index / 10) * Math.PI * 2 + rand(-0.3, 0.3);
    const r   = 1.5 + Math.random() * 3.0;
    this.root.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    this.root.rotation.y = this._facing;

    scene.add(this.root);
    this._pickBehavior();
  }

  // ── 行動選択 ──────────────────────────────────────────────────
  _pickBehavior() {
    const b = randInt(1, 7);

    if (b === 1) {
      // 2秒その場で待つ
      this._wait(2);

    } else if (b === 2) {
      // 滝修行に行く → ランダム秒待つ
      const dest = DEST.training.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
      this._moveTo(dest, () => this._wait(rand(1, 20)));

    } else if (b === 3) {
      // 鍛冶屋の前で3秒待つ
      const dest = DEST.blacksmith.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(1.5, 3.0)));
      this._moveTo(dest, () => this._wait(3));

    } else if (b === 4) {
      // ショップに行く → ランダム秒待つ
      const dest = DEST.shop.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
      this._moveTo(dest, () => this._wait(rand(1, 20)));

    } else if (b === 5) {
      // バトル入り口に行って消える → 10秒〜2分後に戻る
      const dest = DEST.battle.clone().add(new THREE.Vector3(rand(-1.0, 1.0), 0, rand(-1.0, 1.0)));
      this._moveTo(dest, () => {
        this._vanish();
        this._state      = 'gone';
        this._stateTimer = rand(10, 120);
      });

    } else if (b === 6) {
      // ランダムな方向に1〜10秒走り回る（複数目標を連続で移動）
      this._wander(rand(1, 10));

    } else {
      // 行動7: 近くへ歩いて消える → 1〜20秒後に戻る
      const angle = Math.random() * Math.PI * 2;
      const dist  = 2 + Math.random() * 4;
      const dest  = new THREE.Vector3(
        this.root.position.x + Math.sin(angle) * dist,
        0,
        this.root.position.z + Math.cos(angle) * dist,
      );
      _clampToRoom(dest);
      this._moveTo(dest, () => {
        this._vanish();
        this._state      = 'gone';
        this._stateTimer = rand(1, 20);
      });
    }
  }

  // ── 状態変更ヘルパー ──────────────────────────────────────────
  _wait(sec) {
    this._state      = 'waiting';
    this._stateTimer = sec;
    this._moving     = false;
  }

  _moveTo(target, onArrive = null) {
    this._target   = target;
    this._onArrive = onArrive;
    this._state    = 'moving';
  }

  _wander(totalTime) {
    if (totalTime <= 0) { this._pickBehavior(); return; }
    const angle = Math.random() * Math.PI * 2;
    const dist  = 2 + Math.random() * 5;
    const dest  = new THREE.Vector3(
      this.root.position.x + Math.sin(angle) * dist,
      0,
      this.root.position.z + Math.cos(angle) * dist,
    );
    _clampToRoom(dest);

    this._moveTo(dest, () => {
      const travelTime = (this._lastTravelTime ?? 0);
      this._wander(totalTime - travelTime);
    });
    this._wanderStart = performance.now() / 1000;
  }

  _vanish() {
    this.root.visible = false;
  }

  _appear() {
    // センター付近のランダム位置に再出現
    const ang = Math.random() * Math.PI * 2;
    const r   = 0.5 + Math.random() * 3.5;
    this.root.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    this.root.visible = true;
  }

  // ── 毎フレーム更新 ────────────────────────────────────────────
  update(dt) {
    if (this._state === 'gone') {
      this._stateTimer -= dt;
      if (this._stateTimer <= 0) {
        this._appear();
        this._state = 'idle';
      }
      return;
    }

    if (this._state === 'moving' && this._target) {
      const dx   = this._target.x - this.root.position.x;
      const dz   = this._target.z - this.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.25) {
        // 到着
        this._lastTravelTime = 0;
        this._target  = null;
        this._moving  = false;
        this._state   = 'idle';
        const cb = this._onArrive;
        this._onArrive = null;
        if (cb) cb();
      } else {
        const nx = dx / dist, nz = dz / dist;
        this.root.position.x += nx * MOVE_SPEED * dt;
        this.root.position.z += nz * MOVE_SPEED * dt;
        this._facing = Math.atan2(nx, nz);
        this.root.rotation.y = this._facing;
        this._moving = true;
        this._lastTravelTime = (this._lastTravelTime ?? 0) + dt;
      }

    } else if (this._state === 'waiting') {
      this._stateTimer -= dt;
      this._moving = false;
      if (this._stateTimer <= 0) {
        this._state = 'idle';
      }

    } else if (this._state === 'idle') {
      this._moving = false;
      this._pickBehavior();
    }

    // 歩行アニメ
    this._h.update(dt, {
      moving: this._moving,
      lockRightArm: false,
      lockLeftArm: false,
      speedScale: 1,
    });
  }

  dispose() {
    this._scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}

function _clampToRoom(v) {
  const r = Math.hypot(v.x, v.z);
  if (r > ROOM_RADIUS) { v.x *= ROOM_RADIUS / r; v.z *= ROOM_RADIUS / r; }
}
