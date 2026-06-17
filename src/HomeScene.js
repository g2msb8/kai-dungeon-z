// ホーム画面の3Dシーン: 丸い白い部屋、カーペット、シーリングファン、ランプ
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';
import { COLORS } from './core/Constants.js';

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
    this.nearShop      = false;
    this.nearBattle    = false;
    this._shopPos      = null;
    this._jetPos       = null;

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
    this._buildPlayer();
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

  _buildPlayer() {
    const h = buildHumanoid({
      skin:        COLORS.PLAYER_SKIN,
      cloth:       COLORS.PLAYER_CLOTH,
      pants:       COLORS.PLAYER_PANTS,
      pantsAccent: COLORS.PLAYER_PANTS_DARK,
      skinDark:    COLORS.PLAYER_SKIN,
      face:        'player',
      hairColor:   COLORS.PLAYER_HAIR,
    });
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
    // ファン回転
    this._fanAngle += dt * 3.2;
    if (this._fanBlades) this._fanBlades.rotation.y = this._fanAngle;

    if (!this._humanoid) return;

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

    // カメラ追従（バトルと同じ俯瞰視点）
    const p  = this._humanoid.root.position;

    // 近接判定
    this.nearShop   = this._shopPos ? p.distanceTo(this._shopPos) < 5.5 : false;
    this.nearBattle = this._jetPos  ? p.distanceTo(this._jetPos)  < 5.5 : false;
    const desired = new THREE.Vector3(p.x, p.y + 4.5, p.z + 7.5);
    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    this._camTarget.set(p.x, p.y + 1.4, p.z - 1);
    this.camera.lookAt(this._camTarget);
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
}

function _lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
