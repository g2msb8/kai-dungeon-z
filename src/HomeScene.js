// ホーム画面の3Dシーン: 丸い白い部屋、カーペット、シーリングファン、ランプ
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { COLORS } from './core/Constants.js';
import { NPC, randomNpcStyle, npcStyleKey } from './NPC.js';
import { getPlayerOutfit } from './PlayerSkin.js';

export class HomeScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfaf8f5);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    this.camera.position.set(0, 2.8, 5.8);
    this.camera.lookAt(0, 1.2, 0);

    this._rafId        = null;
    this._fanAngle     = 0;
    this._fanBlades    = null;
    this._humanoid     = null;
    this._playerFacing = 0;
    this._camTarget    = new THREE.Vector3();
    this._joy          = { x: 0, y: 0 };
    this.nearShop        = false;
    this.nearBattle      = false;
    this.nearTraining    = false;
    this.nearBlacksmith  = false;
    this.nearMyPage      = false;
    this.nearEndless     = false;
    this._shopPos        = null;
    this._jetPos         = null;
    this._trainingPos    = null;
    this._blacksmithPos  = null;
    this._mypagePos      = null;
    this._endlessPos     = null;
    this._volcanoGlow    = null;
    this._mpDoorPivot    = null;
    this._mpDoorAngle    = 0;
    this._playerName     = null;
    this._playerNameSprite = null;
    this._waterfallTex = null;
    this._splashParts  = [];
    this._isSitting    = false;
    this._elapsed      = 0;
    this._npcs         = [];
    this.onSpecialEnter = null;  // NPCが行動6で再入場したとき (name) => {} で通知

    this._build();
    this._onResize();
    this._resizeBound = () => this._onResize();
    window.addEventListener('resize', this._resizeBound);
  }

  // ─── シーン構築 ────────────────────────────────────────────
  _build() {
    this._buildLighting();
    this._buildRoom();
    this._buildCarpet();
    this._buildCeilingFan();
    this._buildLamps();
    this._buildShop();
    this._buildJet();
    this._buildTrainingSpot();
    this._buildBlacksmith();
    this._buildMyPageHouse();
    this._buildEndlessVolcano();
    this._buildPlayer();
    this._buildNPCs();
  }

  _buildLighting() {
    // 環境光（柔らかい全体光）
    this.scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));

    // メインシーリングライト
    const mainLight = new THREE.PointLight(0xfff5e0, 2.2, 40);
    mainLight.position.set(0, 7.8, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(512, 512);
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far  = 20;
    this.scene.add(mainLight);

    // 柔らかい補助光（前方から）
    const fill = new THREE.DirectionalLight(0xfff0e8, 0.6);
    fill.position.set(2, 5, 6);
    this.scene.add(fill);
  }

  _buildRoom() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const ceilMat  = new THREE.MeshStandardMaterial({ color: 0xf8f6f2, roughness: 0.9 });

    // 床
    const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 72), whiteMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 円形の壁（内側向き = BackSide）
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa, roughness: 0.88, side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 10, 80, 1, true), wallMat);
    wall.position.y = 5;
    this.scene.add(wall);

    // 天井
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(20, 72), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 10;
    this.scene.add(ceil);

    // 幅木（壁と床の境目: 薄いリング）
    const baseboard = new THREE.Mesh(
      new THREE.CylinderGeometry(19.92, 19.92, 0.18, 80, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe0dbd4, roughness: 0.7 }),
    );
    baseboard.position.y = 0.09;
    this.scene.add(baseboard);
  }

  _buildCarpet() {
    // ペルシャ絨毯風：同心円リングを積み重ねてパターンを表現
    // [半径, 色] の順に描く（後ろのものが前のものを上書き）
    const layers = [
      [7.0,  0x7a0000],  // 最外周 極濃赤
      [6.7,  0xb71c1c],  // 外境界帯
      [6.5,  0x7a0000],  // 濃赤リング
      [6.25, 0xc9a227],  // ゴールド帯
      [6.0,  0xd32f2f],  // 外フィールド赤
      [5.6,  0x7a0000],  // 仕切りリング
      [5.4,  0xc9a227],  // ゴールド細帯
      [5.15, 0xe53935],  // 内フィールド明赤
      [4.7,  0x7a0000],  // 内境界リング
      [4.5,  0xc9a227],  // ゴールド帯
      [4.25, 0xd32f2f],  // メダリオン外縁
      [3.8,  0x7a0000],  // 仕切り
      [3.5,  0xc9a227],  // ゴールドリング
      [3.1,  0xe53935],  // メダリオン明赤
      [2.3,  0x7a0000],  // 中心仕切り
      [2.0,  0xc9a227],  // ゴールドセンター
      [1.55, 0xd32f2f],  // センター赤
      [0.85, 0xc9a227],  // 中心ゴールド点
      [0.45, 0x7a0000],  // 中心赤点
    ];

    layers.forEach(([r, color], i) => {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(r, 80),
        new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.0 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.003 + i * 0.0003;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // フリンジ（外周の房）
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xf0dfc0, roughness: 0.95 });
    const FRINGE = 140;
    for (let i = 0; i < FRINGE; i++) {
      const ang = (i / FRINGE) * Math.PI * 2;
      const r   = 7.08;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.28), fringeMat);
      mesh.rotation.y = -ang;
      mesh.position.set(Math.sin(ang) * r, 0.004, Math.cos(ang) * r);
      this.scene.add(mesh);
    }
  }

  _buildCeilingFan() {
    const fanGroup = new THREE.Group();
    fanGroup.position.set(0, 9.75, 0);

    const metalMat  = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.72, roughness: 0.28 });
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x757575, metalness: 0.65, roughness: 0.35 });

    // キャノピー（天井取付けプレート）
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.10, 24), metalMat);
    canopy.position.y = -0.05;
    fanGroup.add(canopy);

    // ダウンロッド（吊り下げ棒）
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.65, 12), metalDark);
    rod.position.y = -0.48;
    fanGroup.add(rod);

    // ロッドカバー上部カラー
    const collarTop = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12), metalMat);
    collarTop.position.y = -0.16;
    fanGroup.add(collarTop);

    // モーターハウジング（上フランジ＋胴体＋下フランジ）
    const mHousingTop = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.09, 24), metalMat);
    mHousingTop.position.y = -0.86;
    fanGroup.add(mHousingTop);

    const mHousingBody = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.26, 24), metalDark);
    mHousingBody.position.y = -1.00;
    fanGroup.add(mHousingBody);

    const mHousingBot = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.07, 24), metalMat);
    mHousingBot.position.y = -1.17;
    fanGroup.add(mHousingBot);

    // ブレードアーム＋ブレード（5セット）
    this._fanBlades = new THREE.Group();
    this._fanBlades.position.y = -0.97;
    const armMat   = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.65, roughness: 0.35 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb5803a, roughness: 0.80 });
    const bladeEdge = new THREE.MeshStandardMaterial({ color: 0x8a5e28, roughness: 0.85 });

    for (let i = 0; i < 5; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 5) * Math.PI * 2;

      // ブレードアーム（薄い金属ブラケット）
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.58), armMat);
      arm.position.set(0, 0.02, -0.44);
      arm.rotation.x = -0.14;
      pivot.add(arm);

      // ブレード本体（前端が細い台形状 → BoxGeometryを変形して表現）
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 1.45), bladeMat);
      blade.position.set(0, 0.002, -1.25);
      blade.rotation.x = -0.12;
      pivot.add(blade);

      // ブレード先端エッジ（濃い色）
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.030, 0.06), bladeEdge);
      tip.position.set(0, 0.002, -1.99);
      tip.rotation.x = -0.12;
      pivot.add(tip);

      this._fanBlades.add(pivot);
    }
    fanGroup.add(this._fanBlades);

    // ライトキット取付けプレート
    const lightPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20), metalMat);
    lightPlate.position.y = -1.24;
    fanGroup.add(lightPlate);

    // ライトキット装飾リング
    const lightRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 8, 24), metalDark);
    lightRing.position.y = -1.28;
    fanGroup.add(lightRing);

    // ガラスグローブ × 3（外周）
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0xfffef5, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.62,
      emissive: 0xfff8d0, emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
    });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffff99, emissive: 0xffff44, emissiveIntensity: 2.2, roughness: 0.2,
    });

    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const gx  = Math.sin(ang) * 0.18;
      const gz  = Math.cos(ang) * 0.18;

      // グローブ（半球形シェード）
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.75),
        globeMat,
      );
      globe.position.set(gx, -1.40, gz);
      fanGroup.add(globe);

      // 電球
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), bulbMat);
      bulb.position.set(gx, -1.38, gz);
      fanGroup.add(bulb);

      // グローブソケット（小さい筒）
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), metalDark);
      socket.position.set(gx, -1.31, gz);
      fanGroup.add(socket);
    }

    // プルチェーン × 2
    const chainMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.8, roughness: 0.3 });
    const beadMat  = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.4 });
    [-0.09, 0.09].forEach((ox, ci) => {
      // チェーン本体
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.50, 6), chainMat);
      chain.position.set(ox, -1.45, 0.06 * (ci === 0 ? 1 : -1));
      fanGroup.add(chain);
      // 先端ビーズ
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), beadMat);
      bead.position.set(ox, -1.72, 0.06 * (ci === 0 ? 1 : -1));
      fanGroup.add(bead);
    });

    // ファン用PointLight
    const fanLight = new THREE.PointLight(0xfff5d0, 1.8, 14);
    fanLight.position.set(0, -1.42, 0);
    fanGroup.add(fanLight);

    this.scene.add(fanGroup);
  }

  _buildLamps() {
    const LAMP_COUNT  = 10;
    const LAMP_RADIUS = 9.5;
    const LAMP_Y      = 9.75;

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xf5e8c0, roughness: 0.6, side: THREE.DoubleSide,
    });
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x888080, metalness: 0.55, roughness: 0.4,
    });

    for (let i = 0; i < LAMP_COUNT; i++) {
      const ang = (i / LAMP_COUNT) * Math.PI * 2;
      const lx  = Math.sin(ang) * LAMP_RADIUS;
      const lz  = Math.cos(ang) * LAMP_RADIUS;

      // 光源
      const light = new THREE.PointLight(0xffe8c8, 1.0, 10);
      light.position.set(lx, LAMP_Y - 0.9, lz);
      this.scene.add(light);

      // 天井取付けプレート
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, 0.06, 10),
        armMat,
      );
      plate.position.set(lx, LAMP_Y - 0.03, lz);
      this.scene.add(plate);

      // 垂直コード
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.38, 6),
        armMat,
      );
      cord.position.set(lx, LAMP_Y - 0.25, lz);
      this.scene.add(cord);

      // シェード（コーン形）
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.42, 14, 1, true),
        shadeMat,
      );
      shade.rotation.x = Math.PI; // 開口部を下に
      shade.position.set(lx, LAMP_Y - 0.65, lz);
      this.scene.add(shade);

      // シェード上部リム
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.018, 6, 12),
        armMat,
      );
      rim.position.set(lx, LAMP_Y - 0.46, lz);
      this.scene.add(rim);

      // 電球（小さい発光球）
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xfffde7, emissive: 0xffee99, emissiveIntensity: 1.2,
          roughness: 0.2,
        }),
      );
      bulb.position.set(lx, LAMP_Y - 0.60, lz);
      this.scene.add(bulb);
    }
  }

  _buildNPCs() {
    const count = 7 + Math.floor(Math.random() * 14); // 7〜20体
    // 全員が別々のスキンになるよう重複を避けて生成
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let style, key, tries = 0;
      do { style = randomNpcStyle(); key = npcStyleKey(style); tries++; }
      while (used.has(key) && tries < 60);
      used.add(key);
      const npc = new NPC(this.scene, i, style, (name) => {
        if (this.onSpecialEnter) this.onSpecialEnter(name);
      });
      this._npcs.push(npc);
    }
  }

  _buildPlayer() {
    const h = buildHumanoid(getPlayerOutfit());
    h.root.position.set(0, 0, 0.5);
    h.root.rotation.y = Math.PI * 0.08;
    h.root.scale.setScalar(1.25);
    h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(h.root);
    this._humanoid = h;
  }

  // ─── リサイズ ───────────────────────────────────────────────
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ─── 開始 / 停止 ───────────────────────────────────────────
  start() {
    if (this._rafId) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // main.js のメインループから毎フレーム呼ばれる（ジョイスティック値を渡す）
  setJoy(value) {
    this._joy = value ?? { x: 0, y: 0 };
  }

  // ─── 毎フレーム更新 ─────────────────────────────────────────
  _update(dt) {
    this._elapsed += dt;

    // ファン回転
    this._fanAngle += dt * 3.2;
    if (this._fanBlades) this._fanBlades.rotation.y = this._fanAngle;

    // 滝テクスチャスクロール
    if (this._waterfallTex) this._waterfallTex.offset.y += dt * 0.85;

    // 火山クレーターの灯りをゆらめかせる
    if (this._volcanoGlow) {
      this._volcanoGlow.intensity = 2.0 + Math.sin(this._elapsed * 6) * 0.5 + Math.sin(this._elapsed * 13) * 0.25;
    }

    // しぶき粒子ボビング
    for (const sp of this._splashParts) {
      sp.position.y = sp._baseY + Math.sin(this._elapsed * sp._speed + sp._offset) * 0.04;
    }

    if (!this._humanoid) return;

    if (this._isSitting) {
      this._humanoid.update(0, { moving: false });
    } else {
      // setJoy() で毎フレーム更新される合成入力を使う
      const joy   = this._joy;
      const moveX = joy.x ?? 0;
      const moveZ = joy.y ?? 0;
      const len   = Math.hypot(moveX, moveZ);
      const moving = len > 0.05;

      if (moving) {
        const speed = 4.8;
        const nx = moveX / len, nz = moveZ / len;
        const pos = this._humanoid.root.position;
        pos.x += nx * speed * dt;
        pos.z += nz * speed * dt;

        // 部屋の壁（半径17m）で制限
        const d = Math.hypot(pos.x, pos.z);
        if (d > 17) { pos.x *= 17 / d; pos.z *= 17 / d; }

        // 向き補間
        const target = Math.atan2(-nx, -nz);
        this._playerFacing = _lerpAngle(this._playerFacing, target, Math.min(1, 12 * dt));
        this._humanoid.root.rotation.y = this._playerFacing;
      }

      this._humanoid.update(dt, { moving });
    }

    // カメラ追従（バトルと同じ俯瞰視点）
    const p  = this._humanoid.root.position;

    // 近接判定
    this.nearShop       = this._shopPos       ? p.distanceTo(this._shopPos)       < 5.5 : false;
    this.nearBattle     = this._jetPos        ? p.distanceTo(this._jetPos)        < 5.5 : false;
    this.nearTraining   = this._trainingPos   ? p.distanceTo(this._trainingPos)   < 5.5 : false;
    this.nearBlacksmith = this._blacksmithPos ? p.distanceTo(this._blacksmithPos) < 5.5 : false;
    this.nearMyPage     = this._mypagePos     ? p.distanceTo(this._mypagePos)     < 5.5 : false;
    this.nearEndless    = this._endlessPos    ? p.distanceTo(this._endlessPos)    < 5.5 : false;

    // マイページの家のドア開閉（近づくと勝手に開く）
    if (this._mpDoorPivot) {
      const targetAngle = this.nearMyPage ? -1.95 : 0;
      this._mpDoorAngle += (targetAngle - this._mpDoorAngle) * Math.min(1, dt * 5);
      this._mpDoorPivot.rotation.y = this._mpDoorAngle;
    }

    const desired = new THREE.Vector3(p.x, p.y + 4.5, p.z + 7.5);
    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    this._camTarget.set(p.x, p.y + 1.4, p.z - 1);
    this.camera.lookAt(this._camTarget);

    // NPC 更新
    for (const npc of this._npcs) npc.update(dt, this._npcs);
  }

  // ─── 修行：あぐらポーズ ON/OFF ────────────────────────────
  setSitting(on) {
    if (!this._humanoid || this._isSitting === on) return;
    this._isSitting = on;
    const { legL, legR, armL, armR } = this._humanoid.parts;
    if (on) {
      this._humanoid.root.position.y = -0.58;
      legL.rotation.set(Math.PI * 0.38, 0,  0.72);
      legR.rotation.set(Math.PI * 0.38, 0, -0.72);
      armL.rotation.set(0.42, 0,  0.18);
      armR.rotation.set(0.42, 0, -0.18);
    } else {
      this._humanoid.root.position.y = 0;
      legL.rotation.set(0, 0, 0);
      legR.rotation.set(0, 0, 0);
      armL.rotation.set(0, 0, 0);
      armR.rotation.set(0, 0, 0);
    }
  }

  // ─── テキストスプライト生成 ─────────────────────────────────
  _makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 72);
    ctx.fillStyle = '#7a1a1a';
    ctx.beginPath();
    ctx.roundRect(3, 3, 250, 66, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(3, 3, 250, 66, 12);
    ctx.stroke();
    ctx.font = 'bold 40px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 36);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    return sprite;
  }

  // ─── 滝テクスチャ生成 ──────────────────────────────────────
  _makeWaterfallTexture() {
    const W = 64, H = 128;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;
        const streak = Math.sin(nx * Math.PI * 14) * 0.5 + 0.5;
        const ripple = Math.sin(ny * Math.PI * 22 + nx * 6) * 0.1;
        const b = Math.min(1, streak * 0.62 + ripple + 0.26);
        const i = (y * W + x) * 4;
        d[i]   = Math.round(b * 80);
        d[i+1] = Math.round(b * 160);
        d[i+2] = Math.round(b * 220);
        d[i+3] = Math.round(b * 230);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  // ─── 修行スポット（池＋滝＋竹） ─────────────────────────────
  // グループ rotation.y = π/2 のため: local +Z → world +X（中央方向）
  // 崖・滝は中央から遠い側（local -Z）に置く
  _buildTrainingSpot() {
    const POS = new THREE.Vector3(-12, 0, 0);
    this._trainingPos = POS.clone();

    const g = new THREE.Group();
    g.position.copy(POS);
    g.rotation.y = Math.PI / 2; // 東向き（プレイヤー方向）

    const stone  = new THREE.MeshStandardMaterial({ color: 0x7a7a6a, roughness: 0.95 });
    const stDark = new THREE.MeshStandardMaterial({ color: 0x52524a, roughness: 0.95 });

    // ── 崖壁（壁側・local -Z → world 奥）──
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(5.0, 4.8, 1.0), stone);
    cliff.position.set(0, 2.4, -2.3);
    cliff.castShadow = true;
    g.add(cliff);

    const cliffL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 1.1), stDark);
    cliffL.position.set(-2.6, 1.9, -2.1);
    g.add(cliffL);
    const cliffR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 1.1), stDark);
    cliffR.position.set( 2.6, 1.9, -2.1);
    g.add(cliffR);

    const capRock = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 1.1), stDark);
    capRock.position.set(0, 5.0, -2.3);
    g.add(capRock);

    // ── 滝（崖の前面・local -Z 側）──
    // PlaneGeometry 法線: local +Z → world +X（プレイヤー向き）でFrontSideで見える
    this._waterfallTex = this._makeWaterfallTexture();
    const fallMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 3.8),
      new THREE.MeshStandardMaterial({
        map: this._waterfallTex, transparent: true, opacity: 0.92,
        roughness: 0.1, side: THREE.DoubleSide,
        emissive: 0x2255aa, emissiveIntensity: 0.28,
      }),
    );
    fallMesh.position.set(0, 1.9, -1.55);
    g.add(fallMesh);

    // ── 池 ──
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x194d70, roughness: 0.05,
      transparent: true, opacity: 0.88,
      emissive: 0x0a3050, emissiveIntensity: 0.4,
    });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.4, 36), pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.01;
    g.add(pond);

    const pondGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 24),
      new THREE.MeshStandardMaterial({
        color: 0x60b0e0, transparent: true, opacity: 0.55,
        emissive: 0x3080c0, emissiveIntensity: 0.7, roughness: 0.02,
      }),
    );
    pondGlow.rotation.x = -Math.PI / 2;
    pondGlow.position.y = 0.012;
    g.add(pondGlow);

    // ── しぶき粒子（滝の根元 local z ≈ -1.2）──
    const spMat = new THREE.MeshStandardMaterial({
      color: 0xb8e4ff, transparent: true, opacity: 0.72,
      emissive: 0x70b8f0, emissiveIntensity: 0.5,
    });
    this._splashParts = [];
    for (let i = 0; i < 14; i++) {
      const r = Math.random() * 0.9;
      const a = Math.random() * Math.PI * 2;
      const s = 0.04 + Math.random() * 0.055;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), spMat);
      sp.position.set(Math.cos(a) * r, 0.06 + Math.random() * 0.18, Math.sin(a) * r - 1.2);
      sp._baseY  = sp.position.y;
      sp._speed  = 0.6 + Math.random() * 1.1;
      sp._offset = Math.random() * Math.PI * 2;
      g.add(sp);
      this._splashParts.push(sp);
    }

    // ── 池の周りの石 ──
    const ROCKS = [
      // 左右サイド
      [ 2.1, 0,  0.1], [-2.1, 0,  0.2],
      [ 2.3, 0, -0.4], [-2.3, 0, -0.3],
      // 池奥（滝側）
      [ 0.9, 0, -1.4], [-0.8, 0, -1.5],
      [ 1.5, 0, -1.0], [-1.5, 0, -0.9],
      // 池手前（座石側）
      [ 0.6, 0,  0.9], [-0.7, 0,  0.8],
    ];
    ROCKS.forEach(([rx,,rz]) => {
      const s = 0.18 + Math.random() * 0.22;
      const r = new THREE.Mesh(
        new THREE.BoxGeometry(s * (1 + Math.random() * 0.6), s * 0.55, s * (1 + Math.random() * 0.6)),
        Math.random() > 0.5 ? stone : stDark,
      );
      r.position.set(rx, 0.1, rz);
      r.rotation.set((Math.random()-0.5)*0.4, Math.random()*Math.PI*2, (Math.random()-0.5)*0.3);
      r.castShadow = true;
      g.add(r);
    });

    // ── 竹（崖側に配置 local z < 0）──
    const bambooM = new THREE.MeshStandardMaterial({ color: 0x5a8228, roughness: 0.8 });
    const nodeM   = new THREE.MeshStandardMaterial({ color: 0x384f18, roughness: 0.85 });
    const leafM   = new THREE.MeshStandardMaterial({ color: 0x3a6a1e, roughness: 0.9, side: THREE.DoubleSide });
    [[-2.9,-1.9],[-3.1,-1.2],[-2.7,-2.0],[2.9,-1.9],[3.1,-2.0]].forEach(([bx, bz]) => {
      const h = 2.8 + Math.random() * 1.8;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, h, 7), bambooM);
      stalk.position.set(bx, h / 2, bz);
      stalk.rotation.z = (Math.random() - 0.5) * 0.10;
      g.add(stalk);
      for (let n = 1; n < Math.floor(h / 0.58); n++) {
        const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.04, 7), nodeM);
        nd.position.set(bx, n * 0.58, bz);
        g.add(nd);
      }
      for (let l = 0; l < 4; l++) {
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.09), leafM);
        lf.position.set(
          bx + (Math.random()-0.5)*0.35,
          h * 0.65 + l * 0.28,
          bz + (Math.random()-0.5)*0.35,
        );
        lf.rotation.set(Math.random()*0.5, Math.random()*Math.PI*2, Math.random()*0.45);
        g.add(lf);
      }
    });

    // ── 修行台（座石）プレイヤー側 local +Z ──
    const seatM = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.62, 0.20, 10),
      new THREE.MeshStandardMaterial({ color: 0x625244, roughness: 0.92 }),
    );
    seatM.position.set(0, 0.10, 0.9);
    seatM.castShadow = true;
    g.add(seatM);

    // ── 水辺の光（滝と池の間）──
    const wLight = new THREE.PointLight(0x40a8d8, 1.6, 10);
    wLight.position.set(0, 2.0, -0.8);
    g.add(wLight);

    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    this.scene.add(g);
  }

  // ─── ショップ（小さいお店） ────────────────────────────────
  _buildShop() {
    const SHOP_POS = new THREE.Vector3(0, 0, -12);
    this._shopPos  = SHOP_POS.clone();

    const g = new THREE.Group();
    g.position.copy(SHOP_POS);
    g.rotation.y = Math.PI; // 中央に向く

    const wood    = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.8 });
    const topWood = new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: 0.7 });
    const cream   = new THREE.MeshStandardMaterial({ color: 0xf5e8c8, roughness: 0.85 });
    const redRoof = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.88 });

    // カウンター本体
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.2), wood);
    counter.position.y = 0.55;
    g.add(counter);

    // カウンター天板
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.09, 1.28), topWood);
    topPlate.position.y = 1.14;
    g.add(topPlate);

    // 後ろ壁
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 0.12), cream);
    back.position.set(0, 1.25, -0.6);
    g.add(back);

    // 左右の壁
    for (const sx of [-1.54, 1.54]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 1.2), cream);
      sw.position.set(sx, 1.25, 0);
      g.add(sw);
    }

    // 屋根
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.15, 1.7), redRoof);
    roof.position.y = 2.57;
    g.add(roof);

    // 前柱
    for (const sx of [-1.42, 1.42]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), wood);
      post.position.set(sx, 1.25, 0.52);
      g.add(post);
    }

    // 宝石1（カウンター上）
    const gem1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.14),
      new THREE.MeshStandardMaterial({ color: 0x40e0d0, emissive: 0x00838f, emissiveIntensity: 0.5, roughness: 0.12 }));
    gem1.position.set(-0.85, 1.27, 0.18);
    g.add(gem1);

    // 宝石2
    const gem2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.11),
      new THREE.MeshStandardMaterial({ color: 0xff6840, emissive: 0xe03010, emissiveIntensity: 0.4, roughness: 0.12 }));
    gem2.position.set(0.72, 1.27, 0.18);
    g.add(gem2);

    // ミニ剣（カウンター上）
    const bladeM = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.8, roughness: 0.2 });
    const blade  = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.78, 0.03), bladeM);
    blade.position.set(0.1, 1.6, 0.18);
    blade.rotation.z = 0.13;
    g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.046, 0.03), bladeM);
    guard.position.set(0.1, 1.28, 0.18);
    g.add(guard);

    // 「ショップ」看板スプライト
    const sign = this._makeTextSprite('ショップ');
    sign.position.set(0, 3.25, 0.26);
    sign.scale.set(3.1, 0.88, 1);
    g.add(sign);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  // ─── ミニ戦闘機（ジェット） ───────────────────────────────
  _buildJet() {
    const JET_POS = new THREE.Vector3(0, 0, 12);
    this._jetPos  = JET_POS.clone();

    const g = new THREE.Group();
    g.position.copy(JET_POS);
    // 中央に向く (−Z方向)
    g.rotation.y = Math.PI;
    g.scale.setScalar(1.5);

    const bodyM  = new THREE.MeshStandardMaterial({ color: 0x5a6670, metalness: 0.5, roughness: 0.5 });
    const darkM  = new THREE.MeshStandardMaterial({ color: 0x2d3540, metalness: 0.4, roughness: 0.65 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.72, roughness: 0.08 });
    const glowM  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.2 });

    // 胴体
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 3.2, 12), bodyM);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 0.88;
    g.add(fuselage);

    // ノーズコーン
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.0, 12), bodyM);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.88, -2.1);
    g.add(nose);

    // コックピット
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), glassM);
    cockpit.position.set(0, 1.16, -0.5);
    g.add(cockpit);

    // 主翼（後退翼）
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.055, 1.0), bodyM);
      wing.position.set(side * 0.95, 0.83, 0.1);
      wing.rotation.y = side * -0.2;
      g.add(wing);
    }

    // 垂直尾翼
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.68), bodyM);
    vFin.position.set(0, 1.50, 1.35);
    g.add(vFin);

    // 水平尾翼
    for (const side of [-1, 1]) {
      const hFin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.055, 0.5), bodyM);
      hFin.position.set(side * 0.43, 0.9, 1.42);
      g.add(hFin);
    }

    // エンジンノズル
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.32, 10), darkM);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.88, 1.76);
    g.add(nozzle);

    // エンジングロー
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), glowM);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0.88, 1.94);
    g.add(exhaust);

    // エアインテーク
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.5), darkM);
    intake.position.set(0, 0.58, -0.72);
    g.add(intake);

    // 降着装置
    for (const [wx, wz] of [[0.55, 0.2], [-0.55, 0.2], [0, -1.2]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 8), darkM);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.035), darkM);
      strut.position.set(wx, 0.57, wz);
      g.add(strut);
    }

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  // ─── エンドレス火山（上に鬼の形の煙）────────────────────────
  _buildEndlessVolcano() {
    const POS = new THREE.Vector3(9, 0, 9);
    this._endlessPos = POS.clone();

    const g = new THREE.Group();
    g.position.copy(POS);
    g.rotation.y = -Math.PI * 0.75; // クレーターを中央に見せる

    const rockM  = new THREE.MeshStandardMaterial({ color: 0x3a302c, roughness: 0.98 });
    const rockDk = new THREE.MeshStandardMaterial({ color: 0x241d1a, roughness: 1.0 });
    const lavaM  = new THREE.MeshStandardMaterial({ color: 0xff5a1e, emissive: 0xff3300, emissiveIntensity: 2.4, roughness: 0.7 });
    const lavaHot = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xff7a00, emissiveIntensity: 2.6, roughness: 0.6 });

    // 火山本体（円錐の山）
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 2.5, 3.3, 14), rockM);
    cone.position.y = 1.65;
    g.add(cone);
    // 裾の岩
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.1, 0.5, 14), rockDk);
    skirt.position.y = 0.25;
    g.add(skirt);

    // クレーターのマグマ
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.3, 14), lavaM);
    crater.position.y = 3.35;
    g.add(crater);
    const magma = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 7), lavaHot);
    magma.position.y = 3.45;
    magma.scale.y = 0.5;
    g.add(magma);

    // 流れ落ちる溶岩の筋
    for (const a of [0.4, 2.0, 3.6, 5.1]) {
      const flow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.10), lavaM);
      flow.position.set(Math.sin(a) * 1.45, 1.7, Math.cos(a) * 1.45);
      flow.rotation.y = -a;
      flow.rotation.x = 0.12;
      g.add(flow);
    }

    // クレーターの灯り
    const glow = new THREE.PointLight(0xff5500, 2.2, 12);
    glow.position.set(0, 3.7, 0);
    g.add(glow);
    this._volcanoGlow = glow;

    // ── 上に立ちのぼる「鬼の形の煙」──
    const smokeM = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a, roughness: 1.0, transparent: true, opacity: 0.72,
    });
    const smokeDk = new THREE.MeshStandardMaterial({
      color: 0x6e6e6e, roughness: 1.0, transparent: true, opacity: 0.7,
    });

    // 立ちのぼる煙の柱
    for (const [y, s] of [[4.3, 0.55], [4.9, 0.7], [5.6, 0.9]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), smokeM);
      puff.position.set(0, y, 0);
      g.add(puff);
    }

    // 鬼の頭（煙）
    const headY = 6.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 9), smokeM);
    head.position.set(0, headY, 0);
    head.scale.set(1.05, 1.0, 0.95);
    g.add(head);
    // 頬・あご
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.7, 9, 7), smokeM);
    jaw.position.set(0, headY - 0.7, 0.15);
    g.add(jaw);

    // 角（2本）
    const hornM = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.85, transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.95, 7), hornM);
      horn.position.set(sx * 0.55, headY + 1.15, -0.1);
      horn.rotation.z = sx * -0.35;
      g.add(horn);
    }

    // 眉（怒り）
    const browM = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 1.0, transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.12), browM);
      brow.position.set(sx * 0.45, headY + 0.34, -0.95);
      brow.rotation.z = sx * 0.45;
      g.add(brow);
    }

    // 光る目（赤）
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xffe000, emissive: 0xff3000, emissiveIntensity: 2.2 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), eyeM);
      eye.position.set(sx * 0.42, headY + 0.12, -1.0);
      g.add(eye);
    }

    // 牙（白い小さな三角）
    const fangM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.9 });
    for (const sx of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), fangM);
      fang.position.set(sx * 0.28, headY - 0.95, -0.6);
      fang.rotation.x = Math.PI;
      g.add(fang);
    }

    // 看板
    const sign = this._makeTextSprite('エンドレス');
    sign.position.set(0, 0.9, 2.6);
    sign.scale.set(3.0, 0.85, 1);
    g.add(sign);

    g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  // ─── 刀鍛冶屋 ────────────────────────────────────────────
  // グループ位置(12,0,0)・rotation.y=-π/2 で西（中央）向き
  _buildBlacksmith() {
    const POS = new THREE.Vector3(12, 0, 0);
    this._blacksmithPos = POS.clone();

    const g = new THREE.Group();
    g.position.copy(POS);
    g.rotation.y = -Math.PI / 2; // 中央向き

    const stoneM  = new THREE.MeshStandardMaterial({ color: 0x5a5248, roughness: 0.92 });
    const darkM   = new THREE.MeshStandardMaterial({ color: 0x2e2a28, roughness: 0.95 });
    const woodM   = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85 });
    const metalM  = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.8 });
    const emberM  = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 2.2, roughness: 0.9 });
    const glowM   = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1.5, roughness: 1.0 });

    // ── 外壁（石造り）──
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 3.0), stoneM);
    wall.position.set(0, 1.5, -1.0);
    g.add(wall);

    // 屋根（切妻）
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 1.7), darkM);
    roofL.position.set(0, 3.04, -0.18);
    roofL.rotation.z = 0.44;
    g.add(roofL);
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 1.7), darkM);
    roofR.position.set(0, 3.04, -1.82);
    roofR.rotation.z = -0.44;
    g.add(roofR);

    // 屋根の棟（中央）
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.18, 0.18), darkM);
    ridge.position.set(0, 3.62, -1.0);
    g.add(ridge);

    // 煙突
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.55), stoneM);
    chimney.position.set(0.8, 4.2, -1.3);
    g.add(chimney);
    const chimneyTop = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.12, 0.70), darkM);
    chimneyTop.position.set(0.8, 5.05, -1.3);
    g.add(chimneyTop);

    // 炉（前面カウンター部）
    const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.0), darkM);
    forgeBase.position.set(0, 0.45, 0.55);
    g.add(forgeBase);
    const forgeFront = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.55), stoneM);
    forgeFront.position.set(0, 0.65, 1.0);
    g.add(forgeFront);

    // 炉内の燠火
    const ember1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), emberM);
    ember1.position.set(-0.25, 0.98, 1.0);
    g.add(ember1);
    const ember2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4), glowM);
    ember2.position.set( 0.30, 0.95, 0.95);
    g.add(ember2);
    const ember3 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 5, 4), glowM);
    ember3.position.set( 0.05, 1.02, 1.05);
    g.add(ember3);

    // 炉の光
    const forgeLight = new THREE.PointLight(0xff5500, 2.2, 6);
    forgeLight.position.set(0, 1.4, 1.0);
    g.add(forgeLight);
    this._forgeLight = forgeLight;

    // 金床（アンビル）
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.36), metalM);
    anvilBase.position.set(-0.9, 0.77, 0.6);
    g.add(anvilBase);
    const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.40), metalM);
    anvilTop.position.set(-0.9, 1.01, 0.6);
    g.add(anvilTop);
    const anvilHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.10, 0.32, 6), metalM);
    anvilHorn.rotation.z = Math.PI / 2;
    anvilHorn.position.set(-0.65, 0.98, 0.6);
    g.add(anvilHorn);

    // ハンマー（アンビルの隣に立てかけ）
    const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.90, 6), woodM);
    hammerHandle.rotation.z = 0.35;
    hammerHandle.position.set(-0.58, 0.78, 0.6);
    g.add(hammerHandle);
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.10), metalM);
    hammerHead.position.set(-0.44, 1.17, 0.6);
    hammerHead.rotation.z = 0.35;
    g.add(hammerHead);

    // 看板「刀鍛冶屋」
    const sign = this._makeTextSprite('刀鍛冶屋');
    sign.scale.set(3.6, 1.2, 1);
    sign.position.set(0, 3.9, 1.05);
    g.add(sign);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  // ─── マイページの家（黒壁・白屋根・黒線・茶色い木のドア）──────────
  _buildMyPageHouse() {
    const POS = new THREE.Vector3(-9, 0, -9);
    this._mypagePos = POS.clone();

    const g = new THREE.Group();
    g.position.copy(POS);
    g.rotation.y = Math.PI / 4; // 前面（ドア）を中央へ向ける

    const wallM   = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });   // 黒い壁
    const roofM   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });   // 白い屋根
    const woodM   = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 });   // 茶色い木のドア
    const woodDkM = new THREE.MeshStandardMaterial({ color: 0x55321a, roughness: 0.85 });
    const frameM  = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });     // 黒い枠線
    const paneM   = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcf66, emissiveIntensity: 0.7, roughness: 0.6 });
    const knobM   = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.3 });
    const lineM   = new THREE.LineBasicMaterial({ color: 0x000000 });

    const addEdges = (mesh) => {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), lineM);
      e.position.copy(mesh.position);
      e.rotation.copy(mesh.rotation);
      g.add(e);
    };

    const W = 4.2, H = 3.0, D = 3.4, rise = 1.3, half = D / 2;
    const phi = Math.atan2(rise, half);
    const slope = Math.hypot(half, rise) + 0.25;

    // 壁（黒）＋黒い輪郭線
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallM);
    wall.position.set(0, H / 2, 0);
    g.add(wall); addEdges(wall);

    // 屋根（白い切妻）＋黒い線
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.16, slope), roofM);
    roofL.position.set(0, H + rise / 2, half / 2); roofL.rotation.x = phi;
    g.add(roofL); addEdges(roofL);
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.16, slope), roofM);
    roofR.position.set(0, H + rise / 2, -half / 2); roofR.rotation.x = -phi;
    g.add(roofR); addEdges(roofR);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.2, 0.2), roofM);
    ridge.position.set(0, H + rise, 0);
    g.add(ridge); addEdges(ridge);

    // 茶色い木のドア（ヒンジ付き・近づくと開く）
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.55, 0, half + 0.02);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.12), woodM);
    door.position.set(0.55, 1.05, 0);
    doorPivot.add(door);
    for (const px of [0.3, 0.55, 0.8]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.14), woodDkM);
      plank.position.set(px, 1.05, 0);
      doorPivot.add(plank);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), knobM);
    knob.position.set(0.98, 1.05, 0.09);
    doorPivot.add(knob);
    doorPivot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(doorPivot);
    this._mpDoorPivot = doorPivot;

    // 黒いドア枠
    const ftop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.18), frameM);
    ftop.position.set(0, 2.22, half); g.add(ftop);
    for (const sx of [-0.72, 0.72]) {
      const fside = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.18), frameM);
      fside.position.set(sx, 1.1, half); g.add(fside);
    }

    // 窓（暖色＋黒い十字枠）
    for (const wx of [-1.45, 1.45]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.08), paneM);
      pane.position.set(wx, 1.75, half + 0.02); g.add(pane);
      const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.12), frameM);
      vbar.position.set(wx, 1.75, half + 0.04); g.add(vbar);
      const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.12), frameM);
      hbar.position.set(wx, 1.75, half + 0.04); g.add(hbar);
    }

    // 看板「マイページ」
    const mpSign = this._makeTextSprite('マイページ');
    mpSign.scale.set(3.2, 1.05, 1);
    mpSign.position.set(0, 3.5, half + 0.3);
    g.add(mpSign);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  // ─── 自分（主人公）の頭上の名前ラベル（赤文字＋黒フチ）──────────
  setPlayerName(name) {
    this._playerName = (name && name.trim()) ? name.trim() : null;
    this._buildPlayerNameLabel();
  }

  _buildPlayerNameLabel() {
    if (this._playerNameSprite) {
      if (this._playerNameSprite.parent) this._playerNameSprite.parent.remove(this._playerNameSprite);
      if (this._playerNameSprite.material.map) this._playerNameSprite.material.map.dispose();
      this._playerNameSprite.material.dispose();
      this._playerNameSprite = null;
    }
    if (!this._playerName || !this._humanoid) return;
    const spr = _makeNameSprite(this._playerName, '#e53935', '#000000'); // 赤文字＋黒フチ
    this._humanoid.root.add(spr);
    this._playerNameSprite = spr;
  }
}

// 頭上の名前スプライト（fill=文字色 / stroke=フチ色）
function _makeNameSprite(text, fillColor, strokeColor) {
  const fs = 40, pad = 14;
  const fontStr = `bold ${fs}px -apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = fontStr;
  const W = Math.ceil(ctx.measureText(text).width + pad * 2);
  const H = fs + pad * 2;
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d');
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = strokeColor;
  ctx.strokeText(text, W / 2, H / 2);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, W / 2, H / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.renderOrder = 998;
  const k = 0.0050;
  spr.scale.set(W * k, H * k, 1);
  spr.position.set(0, 2.2, 0);
  return spr;
}

function _lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
