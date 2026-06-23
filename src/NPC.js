// ホーム画面の環境NPC。自律的に動き回り、セリフを喋りながら
// 各施設を訪れたり、回転・ジャンプなどのリアクションをする。
import * as THREE from 'three';
import { buildHumanoid } from './Humanoid.js';

// 各施設のワールド座標（HomeScene の建物位置と一致させる）
const DEST = {
  training:   new THREE.Vector3(-12,  0,  0),
  blacksmith: new THREE.Vector3( 12,  0,  0),
  shop:       new THREE.Vector3(  0,  0,-12),
  battle:     new THREE.Vector3(  0,  0, 12),
  petshop:    new THREE.Vector3(-4.5, 0,-13),
  volcano:    new THREE.Vector3(  9,  0, -9),
};

// 外見はプレイヤーと完全に同じ（ユーザー要件）

const MOVE_SPEED  = 3.2;   // m/s
const ROOM_RADIUS = 16;    // 部屋の壁まで
const JUMP_T      = 0.42;  // 1回のジャンプにかかる時間(秒)
const JUMP_H      = 0.7;   // ジャンプの高さ(m)
const SPIN_SPEED  = Math.PI * 2 * 2; // 回転速度(rad/s) ≒ 2回転/秒

// ランダム外見パレット（髪型・服・ズボン・靴の組み合わせでスキンを決める）
const SKIN_TONES   = [0xe8c49a, 0xd4a87a, 0xb88a60, 0x8d5524, 0xf0d0b0, 0xc68642];
const CLOTHES      = [0x111111, 0x1565c0, 0xc62828, 0x2e7d32, 0x6a1b9a, 0xff8f00, 0x00838f, 0xeeeeee, 0x455a64, 0xfdd835];
const PANTS_COL    = [0x3355bb, 0x333333, 0x5d4037, 0x37474f, 0x6d4c41, 0x283593, 0x795548];
const HAIRS        = [0x2a180a, 0x5c3d1e, 0x111111, 0xc0a020, 0x884400, 0x999999, 0xaa3333];
const HAIR_STYLES  = [
  'naturalShort', 'asymmetry', 'airy', 'wavy', 'wolf', 'softMohawk',
  'mash', 'twoBlockBuzz', 'design', 'semiLong', 'wolf', 'short', 'veryShort', 'long',
];
const SHOE_TYPES   = ['normal', 'nike', 'boots'];
const SHOE_COLORS  = [0xffffff, 0x111111, 0xd32f2f, 0x1565c0, 0x2e7d32, 0xfbc02d, 0x6d4c41, 0xff7043];
const SHOE_ACCENTS = [0xffffff, 0x111111, 0xff1744, 0x00e676, 0x2979ff];

// 頭上に表示する名前（ランダム）
const NAMES = [
  'ドラゴニック',
  'ハイパーライトニングスピン',
  'ガルディロックスゴールデン',
  'ダイヤモンドスパイダー',
  'ウルトラレジェンド',
  'バトルマン',
  'トルネード127.1.65',
  'マグマブルースパイラル',
  'レジェンドプロゲーマー',
  'モンスターハンター22号',
  'ビッグマックス',
  'クロックハンズ',
  'ウルトラスピード',
  'ファイヤースネーク',
  'デビルブラック',
];

function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ランダムなスキン（外見）を1つ生成
export function randomNpcStyle() {
  const pants = pick(PANTS_COL);
  return {
    skin:        pick(SKIN_TONES),
    cloth:       pick(CLOTHES),
    pants,
    pantsAccent: _darken(pants, 0.6),
    hairColor:   pick(HAIRS),
    hairStyle:   pick(HAIR_STYLES),
    sleeve:      Math.random() < 0.5 ? 'short' : 'long',
    legwear:     Math.random() < 0.5 ? 'shorts' : 'pants',
    shoes: {
      type:   pick(SHOE_TYPES),
      color:  pick(SHOE_COLORS),
      accent: pick(SHOE_ACCENTS),
    },
  };
}

// 同一スキン判定用の署名（全員別スキンにするための重複チェックに使う）
export function npcStyleKey(s) {
  return [
    s.hairStyle, s.hairColor, s.cloth, s.sleeve,
    s.legwear, s.pants, s.skin, s.shoes.type, s.shoes.color,
  ].join('|');
}

export class NPC {
  constructor(scene, index, style = null, onEnter = null) {
    this._style = style ?? randomNpcStyle();
    this._onEnter = onEnter; // 行動6の再入場時に左上通知を出すコールバック
    const h = _buildFromStyle(this._style);
    h.root.scale.setScalar(1.25);
    h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this._h        = h;
    this.root      = h.root;
    this._scene    = scene;
    this._moving   = false;
    this._facing   = Math.random() * Math.PI * 2;
    this._target   = null;
    this._onArrive = null;
    this._afterWait = null;
    this._afterJump = null;

    // ステートマシン: idle / moving / waiting / gone / spinning / jumping / sitting
    this._state      = 'idle';
    this._stateTimer = 0;
    this._spinRemaining = 0;
    this._jumpsRemaining = 0;
    this._jumpT = 0;
    this._appearCenter = false;
    this._swapPending  = false;
    this._wanderTimer  = 0;
    this._wTarget      = null;
    this._actionTag    = null;  // 現在の行動タグ（参戦で他NPCがコピーする）
    this._siblings     = null;  // 他のNPC一覧（update で受け取る）

    // セリフ吹き出し
    this._speechSprite = null;
    this._speechTimer  = null;

    // 頭上の名前（ランダム）
    this._name        = pick(NAMES);
    this._nameSprite  = null;

    // 初期位置はセンター付近にランダム配置
    const ang = (index / 10) * Math.PI * 2 + rand(-0.3, 0.3);
    const r   = 1.5 + Math.random() * 3.0;
    this.root.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    this.root.rotation.y = this._facing;

    scene.add(this.root);
    this._buildNameLabel();
    this._pickBehavior();
  }

  // ── 行動選択（行動1〜8をランダムに）──────────────────────────────
  _pickBehavior() {
    const tags = ['wait2', 'training', 'blacksmith', 'wander', 'battle', 'walkSwap', 'shop',
                  'petShopVisit', 'volcanoVanish'];
    const b = randInt(1, 10);
    if (b === 10) this._pickSpeech();        // セリフ
    else          this._startAction(tags[b - 1]);
  }

  // ── セリフ（行動8）：セリフ＋対応アクションからランダム ───────────
  _pickSpeech() {
    const s = randInt(1, 9);

    if (s === 1) {
      this._say('やっほー！', 2600);                 // その場で3回転
      this._startAction('spin3');
    } else if (s === 2) {
      this._say('ショップ見に行こうよ！', 4000);      // ショップで5秒
      this._startAction('shopWait5');
    } else if (s === 3) {
      this._say('バトルに行こう、イェーイ！', 4000);  // 戦闘機で消えて再出現
      this._startAction('battleShort');
    } else if (s === 4) {
      this._say('ちょっとトイレ行ってくるから、ちょっとだけ立ち止まってるね。', 5000);
      this._startAction('toilet');
    } else if (s === 5) {
      this._say('ちょっとだけ修行してくるわ。', 4000); // 滝であぐら10秒
      this._startAction('sit10');
    } else if (s === 6) {
      this._say('ちょっと刀鍛冶に依頼してくるわ。', 4000); // 鍛冶屋で7秒
      this._startAction('forgeWait7');
    } else if (s === 7) {
      this._say('賛成', 2600);                       // 普通のジャンプ5回
      this._startAction('jump5');
    } else if (s === 8) {
      this._say('確かに。', 2600);                   // 2秒待って2回ジャンプ
      this._startAction('jump2wait');
    } else {
      this._joinIn();                                // 参戦
    }
  }

  // 参戦：他のNPC1体（ランダム）の今の行動を、1回だけ同じに行う
  _joinIn() {
    this._say('参戦！', 2600);
    const sibs = (this._siblings || []).filter(n =>
      n !== this && n.root.visible && n._actionTag && n._actionTag !== 'join'
    );
    if (sibs.length) {
      const target = pick(sibs);
      this._startAction(target._actionTag);
    } else {
      // 真似する相手がいなければ少し待つ
      this._actionTag = 'join';
      this._wait(2);
    }
  }

  // タグで指定した「行動（動き）」を1回実行する。セリフは含まない。
  // 他NPCの _actionTag を渡せば同じ行動を再現できる（参戦用）。
  _startAction(tag) {
    this._actionTag = tag;
    switch (tag) {
      case 'wait2':
        this._wait(2);
        break;
      case 'training': {
        const d = DEST.training.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._wait(rand(1, 20)));
        break;
      }
      case 'blacksmith': {
        const d = DEST.blacksmith.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._wait(rand(1, 5)));
        break;
      }
      case 'wander':
        this._wander(rand(2, 8));
        break;
      case 'battle': {
        const d = DEST.battle.clone().add(new THREE.Vector3(rand(-1.0, 1.0), 0, rand(-1.0, 1.0)));
        this._moveTo(d, () => {
          this._clearSpeech(); this._vanish();
          this._appearCenter = true;
          this._state = 'gone'; this._stateTimer = rand(20, 50);
        });
        break;
      }
      case 'walkSwap': {
        // ホームの真ん中へ戻って消える → 10〜30秒後に特殊ネームを変えて再入場
        const d = new THREE.Vector3(rand(-0.8, 0.8), 0, rand(-0.8, 0.8));
        this._moveTo(d, () => {
          this._clearSpeech(); this._vanish();
          this._swapPending = true;
          this._state = 'gone'; this._stateTimer = rand(10, 30);
        });
        break;
      }
      case 'shop': {
        const d = DEST.shop.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._wait(rand(5, 17)));
        break;
      }
      case 'spin3':
        this._spin(3);
        break;
      case 'jump5':
        this._jump(5);
        break;
      case 'jump2wait':
        this._wait(2, () => this._jump(2));
        break;
      case 'sit10': {
        const d = DEST.training.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._enterSit(10));
        break;
      }
      case 'shopWait5': {
        const d = DEST.shop.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._wait(5));
        break;
      }
      case 'battleShort': {
        const d = DEST.battle.clone().add(new THREE.Vector3(rand(-1.0, 1.0), 0, rand(-1.0, 1.0)));
        this._moveTo(d, () => {
          this._clearSpeech(); this._vanish();
          this._appearCenter = true;
          this._state = 'gone'; this._stateTimer = rand(10, 20);
        });
        break;
      }
      case 'forgeWait7': {
        const d = DEST.blacksmith.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(1.5, 3.0)));
        this._moveTo(d, () => this._wait(7));
        break;
      }
      case 'toilet':
        this._wait(60, () => { this._say('トイレ終わった', 3000); this._wait(2.5); });
        break;
      case 'petShopVisit':
        // その場で12秒待つ → ペットショップへ → 10〜30秒立ち止まる
        this._wait(12, () => {
          const d = DEST.petshop.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(1.5, 3.0)));
          this._moveTo(d, () => this._wait(rand(10, 30)));
        });
        break;
      case 'volcanoVanish': {
        // エンドレス火山の真ん中へ → 4秒待つ → 急に消えて再出現
        const d = DEST.volcano.clone();
        this._moveTo(d, () => {
          this._wait(4, () => {
            this._clearSpeech(); this._vanish();
            this._appearCenter = true;
            this._state = 'gone'; this._stateTimer = rand(10, 30);
          });
        });
        break;
      }
      default:
        this._wait(2);
    }
  }

  _wander(sec) {
    this._wanderTimer = sec;
    this._pickWanderTarget();
    this._state = 'wandering';
  }

  _pickWanderTarget() {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 2 + Math.random() * 4;
    const d = new THREE.Vector3(
      this.root.position.x + Math.sin(angle) * dist,
      0,
      this.root.position.z + Math.cos(angle) * dist,
    );
    _clampToRoom(d);
    this._wTarget = d;
  }

  // ── 状態変更ヘルパー ──────────────────────────────────────────
  _goIdle() {
    // 次のセリフまで少し間をあける（全員同時に喋らないように）
    this._state      = 'waiting';
    this._stateTimer = rand(1.5, 5);
    this._afterWait  = () => this._pickBehavior();
    this._moving     = false;
  }

  _wait(sec, after = null) {
    this._state      = 'waiting';
    this._stateTimer = sec;
    this._afterWait  = after;
    this._moving     = false;
  }

  _moveTo(target, onArrive = null) {
    this._target   = target;
    this._onArrive = onArrive;
    this._state    = 'moving';
  }

  _spin(times) {
    this._spinRemaining = times * Math.PI * 2;
    this._state = 'spinning';
  }

  _jump(times, after = null) {
    this._jumpsRemaining = times;
    this._jumpT     = 0;
    this._afterJump = after;
    this._state     = 'jumping';
  }

  _enterSit(sec) {
    const p = this._h.parts;
    p.legL.rotation.set(Math.PI * 0.38, 0,  0.72);
    p.legR.rotation.set(Math.PI * 0.38, 0, -0.72);
    p.armL.rotation.set(0.42, 0,  0.18);
    p.armR.rotation.set(0.42, 0, -0.18);
    this.root.position.y = -0.58;
    this._state      = 'sitting';
    this._stateTimer = sec;
    this._moving     = false;
  }

  _exitSit() {
    const p = this._h.parts;
    p.legL.rotation.set(0, 0, 0);
    p.legR.rotation.set(0, 0, 0);
    p.armL.rotation.set(0, 0, 0);
    p.armR.rotation.set(0, 0, 0);
    this.root.position.y = 0;
  }

  _vanish() {
    this.root.visible = false;
  }

  _appear() {
    const ang = Math.random() * Math.PI * 2;
    const r   = this._appearCenter ? Math.random() * 0.8 : 0.5 + Math.random() * 3.5;
    this._appearCenter = false;
    this.root.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
    this.root.visible = true;
  }

  // 行動6: 別人の見た目で作り直す（位置・向きは引き継ぐ）
  _swapSkin() {
    const pos  = this.root.position.clone();
    const rotY = this.root.rotation.y;

    // 旧モデルを破棄
    this._clearSpeech();
    this._scene.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });

    // 新しいランダム外見で作り直す
    this._style = randomNpcStyle();
    const h = _buildFromStyle(this._style);
    h.root.scale.setScalar(1.25);
    h.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    h.root.position.copy(pos);
    h.root.rotation.y = rotY;

    this._h   = h;
    this.root = h.root;
    this._facing = rotY;
    this._scene.add(this.root);
    this._buildNameLabel(); // 名前ラベルを新しいモデルに付け直す（this._name を使用）
  }

  // ── 毎フレーム更新 ────────────────────────────────────────────
  update(dt, siblings) {
    if (siblings) this._siblings = siblings;
    switch (this._state) {
      case 'gone':
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) {
          if (this._swapPending) {
            this._swapPending = false;
            this._name = pick(NAMES);   // 新しい特殊ネームをランダムに決定
            this._swapSkin();           // スキン作り直し（中で名前ラベルも新名で再生成）
            if (this._onEnter) this._onEnter(this._name); // 左上に「入ってきました」通知
          }
          this._appear();
          this._goIdle();
        }
        return;

      case 'wandering': {
        this._wanderTimer -= dt;
        const dx = this._wTarget.x - this.root.position.x;
        const dz = this._wTarget.z - this.root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25) {
          this._pickWanderTarget();          // 次の目標へ
        } else {
          const nx = dx / dist, nz = dz / dist;
          this.root.position.x += nx * MOVE_SPEED * 1.5 * dt;  // 走るので速め
          this.root.position.z += nz * MOVE_SPEED * 1.5 * dt;
          this._facing = _lerpAngle(this._facing, Math.atan2(-nx, -nz), Math.min(1, 12 * dt));
          this.root.rotation.y = this._facing;
        }
        if (this._wanderTimer <= 0) {
          this._goIdle();
          this._h.update(dt, { moving: false });
        } else {
          this._h.update(dt, { moving: true, speedScale: 1.5 });
        }
        return;
      }

      case 'moving':
        if (this._target) {
          const dx = this._target.x - this.root.position.x;
          const dz = this._target.z - this.root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.25) {
            this._target = null;
            this._moving = false;
            const cb = this._onArrive; this._onArrive = null;
            if (cb) cb(); else this._goIdle();
          } else {
            const nx = dx / dist, nz = dz / dist;
            this.root.position.x += nx * MOVE_SPEED * dt;
            this.root.position.z += nz * MOVE_SPEED * dt;
            this._facing = _lerpAngle(this._facing, Math.atan2(-nx, -nz), Math.min(1, 10 * dt));
            this.root.rotation.y = this._facing;
            this._moving = true;
          }
        }
        break;

      case 'waiting':
        this._stateTimer -= dt;
        this._moving = false;
        if (this._stateTimer <= 0) {
          const after = this._afterWait; this._afterWait = null;
          if (after) after(); else this._goIdle();
        }
        break;

      case 'spinning': {
        const d = SPIN_SPEED * dt;
        this._facing += d;
        this._spinRemaining -= d;
        this.root.rotation.y = this._facing;
        this._moving = false;
        if (this._spinRemaining <= 0) this._goIdle();
        break;
      }

      case 'jumping': {
        this._moving = false;
        this._jumpT += dt;
        if (this._jumpT >= JUMP_T) {
          this._jumpT -= JUMP_T;
          this._jumpsRemaining -= 1;
          if (this._jumpsRemaining <= 0) {
            this.root.position.y = 0;
            const after = this._afterJump; this._afterJump = null;
            if (after) after(); else this._goIdle();
            break;
          }
        }
        this.root.position.y = Math.sin(Math.PI * (this._jumpT / JUMP_T)) * JUMP_H;
        break;
      }

      case 'sitting':
        this._stateTimer -= dt;
        this._moving = false;
        if (this._stateTimer <= 0) { this._exitSit(); this._goIdle(); }
        // 座りポーズ保持のため歩行アニメは更新しない
        return;

      case 'idle':
      default:
        this._goIdle();
        break;
    }

    // 歩行アニメ（sitting はポーズ保持のため更新しない）
    if (this._state !== 'sitting') this._h.update(dt, { moving: this._moving });
  }

  // ── セリフ吹き出し ────────────────────────────────────────────
  _say(text, holdMs = 3500) {
    this._clearSpeech();

    const lines = _wrapJa(text, 9);
    const pad = 22, fs = 44, lh = 58;
    const fontStr = `bold ${fs}px -apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;

    const canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    ctx.font = fontStr;
    let maxW = 0;
    for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);

    const W = Math.ceil(maxW + pad * 2);
    const H = Math.ceil(lines.length * lh + pad * 2);
    canvas.width = W; canvas.height = H;

    ctx = canvas.getContext('2d');
    ctx.font = fontStr;
    // 吹き出し背景
    ctx.fillStyle   = 'rgba(255,255,255,0.96)';
    _roundRect(ctx, 2, 2, W - 4, H - 4, 18); ctx.fill();
    ctx.lineWidth   = 3;
    ctx.strokeStyle = 'rgba(40,40,55,0.55)';
    _roundRect(ctx, 2, 2, W - 4, H - 4, 18); ctx.stroke();
    // テキスト
    ctx.fillStyle    = '#1a1a22';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, pad + lh * (i + 0.5)));

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.renderOrder = 999;

    const k = 0.0055; // canvas px → ローカル単位
    spr.scale.set(W * k, H * k, 1);
    // 名前ラベルの上に出す
    spr.position.set(0, 2.55 + (H * k) * 0.5, 0);

    this.root.add(spr);
    this._speechSprite = spr;
    this._speechTimer  = setTimeout(() => this._clearSpeech(), holdMs);
  }

  // ── 頭上の名前ラベル（黒文字・常時表示）──────────────────────────
  _buildNameLabel() {
    if (this._nameSprite) {
      this.root.remove(this._nameSprite);
      if (this._nameSprite.material.map) this._nameSprite.material.map.dispose();
      this._nameSprite.material.dispose();
      this._nameSprite = null;
    }

    const fs = 40, pad = 14;
    const fontStr = `bold ${fs}px -apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;
    const canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    ctx.font = fontStr;
    const W = Math.ceil(ctx.measureText(this._name).width + pad * 2);
    const H = fs + pad * 2;
    canvas.width = W; canvas.height = H;

    ctx = canvas.getContext('2d');
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 視認性のため白い縁取り → 黒文字
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeText(this._name, W / 2, H / 2);
    ctx.fillStyle = '#000000';
    ctx.fillText(this._name, W / 2, H / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.renderOrder = 998;

    const k = 0.0050;
    spr.scale.set(W * k, H * k, 1);
    spr.position.set(0, 2.18, 0); // 頭のすぐ上
    this.root.add(spr);
    this._nameSprite = spr;
  }

  _clearSpeech() {
    if (this._speechTimer) { clearTimeout(this._speechTimer); this._speechTimer = null; }
    if (this._speechSprite) {
      this.root.remove(this._speechSprite);
      if (this._speechSprite.material.map) this._speechSprite.material.map.dispose();
      this._speechSprite.material.dispose();
      this._speechSprite = null;
    }
  }

  dispose() {
    this._clearSpeech();
    if (this._nameSprite && this._nameSprite.material.map) this._nameSprite.material.map.dispose();
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

function _lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function _clampToRoom(v) {
  const r = Math.hypot(v.x, v.z);
  if (r > ROOM_RADIUS) { v.x *= ROOM_RADIUS / r; v.z *= ROOM_RADIUS / r; }
}

// スタイルから人型モデルを生成
function _buildFromStyle(style) {
  return buildHumanoid({
    skin:        style.skin,
    cloth:       style.cloth,
    pants:       style.pants,
    pantsAccent: style.pantsAccent,
    skinDark:    style.skin,
    face:        'player',
    hairColor:   style.hairColor,
    hairStyle:   style.hairStyle,
    sleeve:      style.sleeve,
    legwear:     style.legwear,
    shoes:       style.shoes,
  });
}

// 0xRRGGBB を f 倍（0〜1）に暗くする
function _darken(hex, f) {
  const r = Math.floor(((hex >> 16) & 0xff) * f);
  const g = Math.floor(((hex >>  8) & 0xff) * f);
  const b = Math.floor(( hex        & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

// 日本語をおおよそ n 文字 / 句読点で折り返す
function _wrapJa(text, n) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (cur.length >= n || ch === '、' || ch === '。' || ch === '！' || ch === '？') {
      lines.push(cur); cur = '';
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
