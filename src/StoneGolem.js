// 特殊技「ストーンゴーレム」— 黒い沼から出現する岩のゴーレム
// 腕を振り下ろして周囲のモンスターを11秒スタン
import * as THREE from 'three';
import { SPECIAL } from './core/Constants.js';

export class StoneGolem {
  constructor(scene, playerPos) {
    this._scene = scene;
    this.alive  = true;
    this._life  = SPECIAL.GOLEM_LIFE;
    this._slamCooldown = 3.0; // 出現後3秒で最初のスラム
    this._slamming  = false;
    this._slamTimer = 0;
    this._rising    = true;
    this._riseTimer = 0;

    this.root = new THREE.Group();
    // 最初は地中から出てくる（Y=-3）
    this.root.position.set(
      playerPos.x - Math.sin(playerPos.y ?? 0) * 2,
      -3,
      playerPos.z + 2.2,
    );

    this._build();
    scene.add(this.root);
  }

  _build() {
    const rockDark = new THREE.MeshLambertMaterial({ color: 0x4a4540 });
    const rockMid  = new THREE.MeshLambertMaterial({ color: 0x5c5550 });
    const rockLight = new THREE.MeshLambertMaterial({ color: 0x6e6862 });

    // 黒い沼（地面ディスク）
    const swampGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.18, 20);
    const swampMat = new THREE.MeshLambertMaterial({ color: 0x060a06, transparent: true, opacity: 0.93 });
    this._swamp = new THREE.Mesh(swampGeo, swampMat);
    this._swamp.position.y = 0.06;
    this.root.add(this._swamp);

    // 胴体
    const bodyGeo = new THREE.BoxGeometry(1.3, 1.6, 0.9);
    this._body = new THREE.Mesh(bodyGeo, rockMid);
    this._body.position.y = 1.45;
    this.root.add(this._body);

    // 頭
    const headGeo = new THREE.BoxGeometry(1.0, 0.9, 0.82);
    this._head = new THREE.Mesh(headGeo, rockLight);
    this._head.position.y = 2.5;
    this.root.add(this._head);

    // 目（オレンジ発光）
    [-0.24, 0.24].forEach(x => {
      const eyeGeo = new THREE.SphereGeometry(0.11, 7, 7);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 2.56, 0.42);
      this.root.add(eye);
    });

    // 左腕グループ（腕+こぶし をまとめてY軸で動かす）
    this._armGroupL = new THREE.Group();
    this._armGroupL.position.set(-1.0, 1.45, 0);
    const armGeoL = new THREE.BoxGeometry(0.52, 1.4, 0.52);
    this._armMeshL = new THREE.Mesh(armGeoL, rockDark);
    this._armMeshL.position.y = 0;
    this._armGroupL.add(this._armMeshL);
    const fistGeoL = new THREE.BoxGeometry(0.58, 0.58, 0.58);
    this._fistL = new THREE.Mesh(fistGeoL, rockMid);
    this._fistL.position.y = -0.78;
    this._armGroupL.add(this._fistL);
    this.root.add(this._armGroupL);

    // 右腕グループ
    this._armGroupR = new THREE.Group();
    this._armGroupR.position.set(1.0, 1.45, 0);
    const armGeoR = new THREE.BoxGeometry(0.52, 1.4, 0.52);
    this._armMeshR = new THREE.Mesh(armGeoR, rockDark);
    this._armMeshR.position.y = 0;
    this._armGroupR.add(this._armMeshR);
    const fistGeoR = new THREE.BoxGeometry(0.58, 0.58, 0.58);
    this._fistR = new THREE.Mesh(fistGeoR, rockMid);
    this._fistR.position.y = -0.78;
    this._armGroupR.add(this._fistR);
    this.root.add(this._armGroupR);
  }

  get position() { return this.root.position; }

  // 戻り値: true = スラムが着地（スタン発動タイミング）
  update(dt, playerPos) {
    if (!this.alive) return false;

    // 沼から上昇するアニメーション（1.6秒）
    if (this._rising) {
      this._riseTimer += dt;
      const k = Math.min(1, this._riseTimer / 1.6);
      this.root.position.y = THREE.MathUtils.lerp(-3, 0, k * k * (3 - 2 * k));
      if (k >= 1) { this._rising = false; this.root.position.y = 0; }
      return false;
    }

    // ライフタイム
    this._life -= dt;
    if (this._life <= 0) { this.dispose(); return false; }

    // プレイヤーの後ろ付近をゆるく追従
    const dx = playerPos.x - this.root.position.x;
    const dz = playerPos.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    const followDist = 3.8;
    if (dist > followDist) {
      const spd = 3.5;
      this.root.position.x += (dx / dist) * spd * dt;
      this.root.position.z += (dz / dist) * spd * dt;
    }
    if (dist > 0.1) this.root.rotation.y = Math.atan2(dx, dz);

    // スラムクールダウン
    if (!this._slamming) {
      this._slamCooldown -= dt;
      if (this._slamCooldown <= 0) {
        this._slamming  = true;
        this._slamTimer = 0;
      }
      return false;
    }

    // スラムアニメーション
    this._slamTimer += dt;
    const RAISE_END  = 0.65; // 腕を上げ終わる時間
    const SLAM_END   = 0.82; // 叩きつけ終わる時間
    const RESET_END  = 1.1;  // 戻り終わる時間

    if (this._slamTimer < RAISE_END) {
      // 腕を大きく上に上げる
      const k = this._slamTimer / RAISE_END;
      const y = THREE.MathUtils.lerp(1.45, 3.2, k);
      this._armGroupL.position.y = y;
      this._armGroupR.position.y = y;
    } else if (this._slamTimer < SLAM_END) {
      // 地面に一気に叩きつける
      const k = (this._slamTimer - RAISE_END) / (SLAM_END - RAISE_END);
      const y = THREE.MathUtils.lerp(3.2, 0.3, k);
      this._armGroupL.position.y = y;
      this._armGroupR.position.y = y;
    } else if (this._slamTimer < RESET_END) {
      // ゆっくり戻す
      const k = (this._slamTimer - SLAM_END) / (RESET_END - SLAM_END);
      const y = THREE.MathUtils.lerp(0.3, 1.45, k);
      this._armGroupL.position.y = y;
      this._armGroupR.position.y = y;

      // SLAM_END ちょうどのフレームでスタンを発動（1回だけ）
      if (this._slamTimer - dt < SLAM_END) {
        this._slamming     = false;
        this._slamCooldown = SPECIAL.GOLEM_SLAM_COOLDOWN;
        return true; // スタン発動
      }
    } else {
      // フォールバック
      this._armGroupL.position.y = 1.45;
      this._armGroupR.position.y = 1.45;
      this._slamming     = false;
      this._slamCooldown = SPECIAL.GOLEM_SLAM_COOLDOWN;
    }

    return false;
  }

  dispose() {
    if (!this.alive) return;
    this.alive = false;
    if (this._scene) {
      this._scene.remove(this.root);
      this.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          Array.isArray(o.material)
            ? o.material.forEach(m => m.dispose())
            : o.material.dispose();
        }
      });
      this._scene = null;
    }
  }
}
