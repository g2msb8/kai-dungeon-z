// オープニングシネマティック
// Three.js ミニシーン（研究所）+ DOM/CSS（警報以降）
// 5シーン: 研究所3D → 警報 → ゾンビの群れ → 逃走 → 森に到着
// onComplete() が呼ばれたらホーム画面へ遷移する。

import * as THREE from 'three';
import { buildHumanoid } from '../Humanoid.js';
import { COLORS } from '../core/Constants.js';

// ─── シーン定義 ───────────────────────────────────────────
const SCENES = [
  {
    duration: 11500,
    bg: 'radial-gradient(ellipse at 50% 80%, #0a0a18 0%, #020204 100%)',
    lines: ['2023年2月32日', '未確認生物誕生研究所'],
    sub: '場所不明',
    textColor: '#99aabf',
    effect: 'lab3d',
    speak: '2023年2月32日。未確認生物誕生研究所。場所不明。',
  },
  {
    duration: 5500,
    bg: 'radial-gradient(ellipse at 50% 50%, #100c04 0%, #080400 100%)',
    lines: ['目を覚ました'],
    sub: '逃げろ、逃げろという声が奥から聞こえてくる',
    textColor: '#c8a87a',
    effect: 'wakeup',
    speak: '目を覚ました。逃げろ、逃げろという声が奥から聞こえてくる。',
  },
  {
    duration: 4800,
    bg: 'radial-gradient(ellipse at 50% 50%, #2a0000 0%, #0e0000 100%)',
    lines: ['避難警報  発信中'],
    sub: '逃げてください。ゾンビが襲来しています。',
    textColor: '#ff3333',
    effect: 'alarm',
    speak: '避難警報 発信中。逃げてください。ゾンビが襲来しています。',
  },
  {
    duration: 7000,
    bg: 'radial-gradient(ellipse at 50% 40%, #180800 0%, #0a0200 100%)',
    lines: ['外に出ると——', '化け物がいる'],
    sub: '逃げろという声が頭をよぎってくる',
    textColor: '#ffaa44',
    effect: 'zombiehorde',
    speak: '外に出ると、化け物がいる。逃げろという声が頭をよぎってくる。',
  },
  {
    duration: 5500,
    bg: 'radial-gradient(ellipse at 30% 60%, #100800 0%, #060200 100%)',
    lines: ['あなたは逃げた'],
    sub: '振り返る余裕もなく、すべての速さをまとめて全速力でダッシュした',
    textColor: '#dddddd',
    effect: 'run',
    speak: 'あなたは逃げた。振り返る余裕もなく、すべての速さをまとめて全速力でダッシュした。',
  },
  {
    duration: 6000,
    bg: 'radial-gradient(ellipse at 50% 40%, #051a05 0%, #010a01 100%)',
    lines: ['気づくと', '森に入っていた'],
    sub: 'ここはどこかもわからない。ゾンビの声が聞こえてくる。もう終わりではなかったようだ。',
    textColor: '#77cc77',
    effect: 'forest',
    speak: '気づくと森に入っていた。ここはどこかもわからない。ゾンビの声が聞こえてくる。もう終わりではなかったようだ。',
  },
];

// ─── CSS keyframes を1回だけ注入 ─────────────────────────
function _injectStyles() {
  if (document.getElementById('opening-styles')) return;
  const style = document.createElement('style');
  style.id = 'opening-styles';
  style.textContent = `
    @keyframes opFadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    @keyframes opAlarm   { from { opacity:0.05; } to { opacity:0.20; } }
    @keyframes opFlicker { 0%,100%{opacity:1} 10%{opacity:0.6} 20%{opacity:1} 55%{opacity:0.85} 60%{opacity:1} }
    @keyframes opScan    { from { background-position:0 0; } to { background-position:0 100px; } }
    @keyframes opZSway   { from { transform:translateX(-2px) rotate(-3deg); } to { transform:translateX(2px) rotate(3deg); } }
    @keyframes opFire    { 0%,100%{opacity:0.4;transform:scaleY(1)} 50%{opacity:0.6;transform:scaleY(1.06)} }
    @keyframes opRun     { from{transform:translateX(0)} to{transform:translateX(-60px)} }
    @keyframes opTreeSway{ from{transform:rotate(-1deg) translateX(-1px)} to{transform:rotate(1deg) translateX(1px)} }
    @keyframes opFogDrift{ from{transform:translateX(-20px)} to{transform:translateX(20px)} }
  `;
  document.head.appendChild(style);
}

// ─── Opening クラス ───────────────────────────────────────
export class Opening {
  /** @param {() => void} onComplete */
  constructor(onComplete) {
    this.onComplete  = onComplete;
    this._overlay    = null;
    this._sceneEl    = null;
    this._textEl     = null;
    this._effectEl   = null;
    this._sceneIdx   = 0;
    this._advTimer   = null;
    this._fadeTimer  = null;
    // Lab3d 専用
    this._labRenderer  = null;
    this._labRaf       = null;
    this._labMidTimer  = null;
    _injectStyles();
    this._build();
  }

  // ─── DOM構築 ─────────────────────────────────────────────
  _build() {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;inset:0;z-index:50;background:#000;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      overflow:hidden;
    `;

    // シネマスコープ帯（上下黒帯）
    ['top:0', 'bottom:0'].forEach(pos => {
      const bar = document.createElement('div');
      bar.style.cssText = `position:absolute;left:0;right:0;${pos};height:11%;background:#000;z-index:5;`;
      el.appendChild(bar);
    });

    // シーン背景
    const sceneEl = document.createElement('div');
    sceneEl.style.cssText = `
      position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;transition:background 1.4s ease;
    `;
    this._sceneEl = sceneEl;

    // エフェクト層（Three.js canvas もここに入る）
    const effectEl = document.createElement('div');
    effectEl.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;';
    this._effectEl = effectEl;
    sceneEl.appendChild(effectEl);

    // テキスト層
    const textEl = document.createElement('div');
    textEl.style.cssText = `
      position:relative;z-index:3;text-align:center;padding:0 40px;
      font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif;
    `;
    this._textEl = textEl;
    sceneEl.appendChild(textEl);

    // スキップボタン
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'SKIP ▶';
    skipBtn.style.cssText = `
      position:absolute;bottom:13%;right:24px;z-index:10;pointer-events:auto;cursor:pointer;
      background:transparent;border:1px solid rgba(255,255,255,0.3);
      color:rgba(255,255,255,0.5);font-size:13px;padding:8px 20px;
      border-radius:6px;letter-spacing:2px;transition:all 0.2s;
    `;
    skipBtn.addEventListener('pointerover', () => {
      skipBtn.style.borderColor = 'rgba(255,255,255,0.7)';
      skipBtn.style.color = 'rgba(255,255,255,0.9)';
    });
    skipBtn.addEventListener('pointerout', () => {
      skipBtn.style.borderColor = 'rgba(255,255,255,0.3)';
      skipBtn.style.color = 'rgba(255,255,255,0.5)';
    });
    skipBtn.addEventListener('click', () => this._finish());

    el.appendChild(sceneEl);
    el.appendChild(skipBtn);
    this._overlay = el;
    document.body.appendChild(el);
  }

  // ─── 音声読み上げ ────────────────────────────────────────
  _speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = 'ja-JP';
    u.rate  = 0.88;
    u.pitch = 0.80;  // 青年男性らしい低めのピッチ
    // 男性の日本語音声を優先選択（Hattori=iOS男性, Otoya=macOS男性）
    const voices = window.speechSynthesis.getVoices();
    const male   = voices.find(v => v.lang.startsWith('ja') && /eddy|hattori|otoya|reed|rocko/i.test(v.name));
    const jp     = male || voices.find(v => v.lang.startsWith('ja'));
    if (jp) u.voice = jp;
    window.speechSynthesis.speak(u);
  }

  // ─── 再生 ─────────────────────────────────────────────────
  start() {
    this._sceneIdx = 0;
    this._overlay.style.opacity = '1';
    this._showScene(0);
  }

  _showScene(idx) {
    // 前シーンの lab3d クリーンアップ
    this._cleanupLab();

    if (idx >= SCENES.length) { this._finish(); return; }
    const s = SCENES[idx];

    // 背景
    this._sceneEl.style.background = s.bg;

    // テキスト
    let html = '';
    s.lines.forEach((line, i) => {
      const large = i === s.lines.length - 1;
      html += `<div style="
        font-size:${large ? '30px' : '18px'};font-weight:bold;
        letter-spacing:${large ? '6px' : '3px'};
        color:${s.textColor};
        text-shadow:0 0 30px ${s.textColor}66, 0 2px 6px rgba(0,0,0,0.8);
        margin-bottom:${large ? '20px' : '10px'};
        opacity:0;animation:opFadeIn 0.9s ${i * 0.55 + 0.1}s forwards;
      ">${line}</div>`;
    });
    html += `<div style="
      font-size:14px;color:rgba(255,255,255,0.55);letter-spacing:2px;line-height:1.8;
      margin-top:16px;opacity:0;
      animation:opFadeIn 0.7s ${s.lines.length * 0.55 + 0.4}s forwards;
      text-shadow:0 1px 4px rgba(0,0,0,0.9);
    ">${s.sub}</div>`;
    this._textEl.innerHTML = html;
    this._textEl.style.opacity = '1';
    this._textEl.style.transition = '';

    // 音声（声がロードされる前に呼ばれる場合の対策）
    if (window.speechSynthesis) {
      const trySpeak = () => this._speak(s.speak);
      if (window.speechSynthesis.getVoices().length > 0) {
        trySpeak();
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', trySpeak, { once: true });
      }
    }

    // エフェクト
    this._effectEl.innerHTML = '';
    this._applyEffect(s.effect);

    // 自動送り
    if (this._advTimer) clearTimeout(this._advTimer);
    this._advTimer = setTimeout(() => this._nextScene(), s.duration);
  }

  _nextScene() {
    if (this._advTimer) { clearTimeout(this._advTimer); this._advTimer = null; }
    this._textEl.style.transition = 'opacity 0.6s';
    this._textEl.style.opacity    = '0';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      this._textEl.style.transition = '';
      this._textEl.style.opacity    = '1';
      this._sceneIdx++;
      this._showScene(this._sceneIdx);
    }, 620);
  }

  // ─── Lab3d クリーンアップ ─────────────────────────────────
  _cleanupLab() {
    if (this._labRaf)      { cancelAnimationFrame(this._labRaf); this._labRaf = null; }
    if (this._labRenderer) { this._labRenderer.dispose(); this._labRenderer = null; }
    if (this._labMidTimer) { clearTimeout(this._labMidTimer); this._labMidTimer = null; }
  }

  // ─── Three.js 研究所シーン ───────────────────────────────
  _buildLabScene(container) {
    const W = window.innerWidth;
    const H = window.innerHeight;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    const cvs = renderer.domElement;
    cvs.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    container.appendChild(cvs);
    this._labRenderer = renderer;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060f);
    scene.fog = new THREE.FogExp2(0x06060f, 0.10);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0x203050, 1.8));
    const dir = new THREE.DirectionalLight(0x7090b0, 0.7);
    dir.position.set(3, 6, 3);
    scene.add(dir);
    // 非常灯（赤い点滅ライト）
    const redPt = new THREE.PointLight(0xff2200, 2.5, 14);
    redPt.position.set(-2.5, 3.5, -2);
    scene.add(redPt);
    // 床からの薄い補光
    const fillPt = new THREE.PointLight(0x304060, 0.8, 8);
    fillPt.position.set(0, 0.3, 1);
    scene.add(fillPt);

    // --- Floor（コンクリートタイル） ---
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshLambertMaterial({ color: 0x131320 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // --- Lab 備品 ---
    const addBox = (x, y, z, w, h, d, c, emissive) => {
      const mat = new THREE.MeshLambertMaterial({ color: c });
      if (emissive) mat.emissive = new THREE.Color(emissive);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    addBox(-3.8, 0.7, -5.5, 2.0, 1.4, 0.8, 0x1a1a2a);     // 実験台L
    addBox(3.8, 0.7, -5.5, 2.0, 1.4, 0.8, 0x1a1a2a);      // 実験台R
    addBox(-3.8, 1.6, -5.8, 1.0, 0.65, 0.05, 0x001a3a, 0x000d22); // モニターL
    addBox(3.8, 1.6, -5.8, 1.0, 0.65, 0.05, 0x001a3a, 0x000d22);  // モニターR
    addBox(0, 1.5, -8.9, 12, 3.0, 0.2, 0x0c0c18);          // 奥壁
    addBox(0, 0.06, -6, 3.0, 0.12, 0.5, 0x0e0e1c);         // 手前段差

    // --- Player ヒューマノイド ---
    const hum = buildHumanoid({
      skin:        COLORS.PLAYER_SKIN,
      cloth:       COLORS.PLAYER_CLOTH,
      pants:       COLORS.PLAYER_PANTS,
      pantsAccent: COLORS.PLAYER_PANTS_DARK,
      skinDark:    COLORS.PLAYER_SKIN,
      face:        'player',
      hairColor:   COLORS.PLAYER_HAIR,
    });
    const pRoot = hum.root;
    scene.add(pRoot);

    // --- Camera ---
    const cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 60);

    // --- アニメーションフェーズ（秒） ---
    const PHASE_LIE  = 4.5;   // 0→4.5s: 床に倒れている
    const PHASE_RISE = 8.0;   // 4.5→8.0s: 起き上がる
    const PHASE_WALK = 11.5;  // 8.0→11.5s: 歩いて出口へ

    let elapsed = 0;
    let lastT   = null;

    const tick = (now) => {
      this._labRaf = requestAnimationFrame(tick);
      if (lastT === null) lastT = now;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      elapsed += dt;

      // 非常灯のちらつき
      redPt.intensity = 1.8 + Math.sin(now * 0.009) * 1.0 + Math.sin(now * 0.031) * 0.6;

      if (elapsed < PHASE_LIE) {
        // フェーズ1: 床に仰向けで倒れている
        pRoot.rotation.x = -Math.PI / 2;
        pRoot.rotation.y = 0;
        pRoot.position.set(0, 0, 0);

        const ct = elapsed / PHASE_LIE;
        cam.position.set(0, 2.2 - ct * 0.2, 2.6 - ct * 0.2);
        cam.lookAt(0, 0, -0.7);

      } else if (elapsed < PHASE_RISE) {
        // フェーズ2: 起き上がる
        const t    = (elapsed - PHASE_LIE) / (PHASE_RISE - PHASE_LIE);
        const ease = 1 - Math.pow(1 - t, 2.8);
        pRoot.rotation.x = -(Math.PI / 2) * (1 - ease);
        pRoot.rotation.y = 0;
        pRoot.position.y = 0;

        cam.position.set(0, 2.0 - ease * 0.5, 2.4 + ease * 1.8);
        cam.lookAt(0, 0.9 * ease, 0);

      } else {
        // フェーズ3: 起き上がってそのまま出口（奥）へ歩いていく
        const t = Math.min(1, (elapsed - PHASE_RISE) / (PHASE_WALK - PHASE_RISE));
        pRoot.rotation.x = 0;
        pRoot.rotation.y = 0; // カメラに背を向けて奥へ
        pRoot.position.z = -t * 3.5; // 奥へ歩く
        pRoot.position.y = 0;

        // 歩行アニメ（腕脚スイング）
        const swing = Math.sin(elapsed * 5.5) * 0.45;
        hum.parts.legL.rotation.x =  swing;
        hum.parts.legR.rotation.x = -swing;
        hum.parts.armL.rotation.x = -swing * 0.45;
        hum.parts.armR.rotation.x =  swing * 0.45;

        // カメラ: TPSスタイルで追尾
        cam.position.set(0, 1.6, 4.2);
        cam.lookAt(pRoot.position.x, 0.9, pRoot.position.z);
      }

      renderer.render(scene, cam);
    };
    this._labRaf = requestAnimationFrame(tick);
  }

  // ─── シーンエフェクト ────────────────────────────────────
  _applyEffect(type) {
    const el = this._effectEl;

    if (type === 'lab3d') {
      this._buildLabScene(el);
      return;
    }

    if (type === 'wakeup') {
      // 意識が戻る演出: ぼんやりした暖色パルス + 強いビネット
      const pulse = document.createElement('div');
      pulse.style.cssText = `
        position:absolute;inset:0;
        background:radial-gradient(ellipse at 50% 55%, rgba(180,110,40,0.18), transparent 65%);
        animation:opAlarm 2.0s ease-in-out infinite alternate;
      `;
      el.appendChild(pulse);
      const vig = document.createElement('div');
      vig.style.cssText = `
        position:absolute;inset:0;
        background:radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,0,0.80) 100%);
      `;
      el.appendChild(vig);
    }

    if (type === 'scanline') {
      const d = document.createElement('div');
      d.style.cssText = `
        position:absolute;inset:0;
        background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.12) 3px,rgba(0,0,0,0.12) 4px);
        animation:opScan 4s linear infinite;
      `;
      el.appendChild(d);
    }

    if (type === 'flicker') {
      const d = document.createElement('div');
      d.style.cssText = `
        position:absolute;inset:0;background:rgba(30,30,80,0.15);
        animation:opFlicker 2.2s infinite;
      `;
      el.appendChild(d);
      const lamp = document.createElement('div');
      lamp.style.cssText = `
        position:absolute;top:15%;left:50%;transform:translateX(-50%);
        width:18px;height:18px;border-radius:50%;
        background:#ff1a1a;box-shadow:0 0 30px 10px rgba(255,20,20,0.35);
        animation:opAlarm 0.7s infinite alternate;
      `;
      el.appendChild(lamp);
    }

    if (type === 'alarm') {
      const flash = document.createElement('div');
      flash.style.cssText = `
        position:absolute;inset:0;background:rgba(200,0,0,0.14);
        animation:opAlarm 0.55s infinite alternate;
      `;
      el.appendChild(flash);
      const stripe = document.createElement('div');
      stripe.style.cssText = `
        position:absolute;inset:0;
        background:repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(160,0,0,0.08) 14px,rgba(160,0,0,0.08) 28px);
      `;
      el.appendChild(stripe);
      const warn = document.createElement('div');
      warn.style.cssText = `
        position:absolute;top:10%;left:50%;transform:translateX(-50%);
        font-size:11px;letter-spacing:4px;color:rgba(255,60,60,0.7);
        font-family:monospace;white-space:nowrap;
        animation:opFlicker 1.1s infinite;
      `;
      warn.textContent = '▌ ALERT ▌ ALERT ▌ ALERT ▌ ALERT ▌';
      el.appendChild(warn);
    }

    if (type === 'zombiehorde') {
      const fire = document.createElement('div');
      fire.style.cssText = `
        position:absolute;bottom:11%;left:0;right:0;height:22%;
        background:linear-gradient(0deg,rgba(255,70,0,0.45),rgba(220,40,0,0.25),transparent);
        animation:opFire 0.5s ease-in-out infinite alternate;
      `;
      el.appendChild(fire);
      const count = 55;
      for (let i = 0; i < count; i++) {
        const z   = document.createElement('div');
        const x   = Math.random() * 100;
        const y   = 45 + Math.random() * 32;
        const sc  = 0.5 + Math.random() * 1.0;
        const spd = 1.2 + Math.random() * 2.0;
        const del = (Math.random() * 2).toFixed(2);
        z.style.cssText = `
          position:absolute;left:${x}%;top:${y}%;
          width:${7*sc}px;height:${17*sc}px;
          background:#3a5030;border-radius:40% 40% 15% 15%;
          opacity:${0.35 + Math.random() * 0.5};
          animation:opZSway ${spd}s ${del}s ease-in-out infinite alternate;
          box-shadow:0 0 ${4*sc}px rgba(80,150,60,0.3);
        `;
        el.appendChild(z);
        [-1, 1].forEach(side => {
          const arm = document.createElement('div');
          arm.style.cssText = `
            position:absolute;
            left:${x + side * 5 * sc}%;top:${y + 3}%;
            width:${12*sc}px;height:${4*sc}px;
            background:#4a6040;border-radius:2px;
            opacity:${0.3 + Math.random() * 0.4};
            transform:rotate(${side * (10 + Math.random()*15)}deg);
            animation:opZSway ${spd}s ${del}s ease-in-out infinite alternate;
          `;
          el.appendChild(arm);
        });
      }
      const smoke = document.createElement('div');
      smoke.style.cssText = `
        position:absolute;top:0;left:0;right:0;height:40%;
        background:radial-gradient(ellipse at 50% 0%,rgba(60,30,10,0.5),transparent 80%);
        animation:opFogDrift 8s ease-in-out infinite alternate;
      `;
      el.appendChild(smoke);
    }

    if (type === 'run') {
      for (let i = 0; i < 18; i++) {
        const line = document.createElement('div');
        const y    = 10 + Math.random() * 80;
        const w    = 40 + Math.random() * 120;
        const spd  = 0.15 + Math.random() * 0.2;
        line.style.cssText = `
          position:absolute;top:${y}%;left:100%;
          height:1px;width:${w}px;
          background:linear-gradient(90deg,rgba(255,255,255,0.35),transparent);
          animation:opRun ${spd}s linear infinite;
        `;
        el.appendChild(line);
      }
    }

    if (type === 'forest') {
      [-38, -22, -8, 8, 22, 38].forEach((offset, i) => {
        const tree = document.createElement('div');
        const h = 120 + Math.random() * 80;
        const w = 50 + Math.random() * 40;
        tree.style.cssText = `
          position:absolute;bottom:11%;
          left:calc(50% + ${offset}%);
          transform:translateX(-50%);
          width:${w}px;height:${h}px;
          animation:opTreeSway ${2 + i * 0.3}s ease-in-out infinite alternate;
        `;
        const trunk = document.createElement('div');
        trunk.style.cssText = `
          position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          width:${w * 0.22}px;height:${h * 0.42}px;
          background:#2a1a0a;border-radius:3px;
        `;
        const leaf = document.createElement('div');
        leaf.style.cssText = `
          position:absolute;top:0;left:50%;transform:translateX(-50%);
          width:${w}px;height:${h * 0.65}px;
          background:radial-gradient(ellipse at 50% 60%,#1a3a14,#0a1a08);
          border-radius:50% 50% 30% 30%;
        `;
        tree.appendChild(leaf);
        tree.appendChild(trunk);
        el.appendChild(tree);
      });
      const fog = document.createElement('div');
      fog.style.cssText = `
        position:absolute;bottom:11%;left:0;right:0;height:30%;
        background:linear-gradient(0deg,rgba(20,50,20,0.55),transparent);
        animation:opFogDrift 6s ease-in-out infinite alternate;
      `;
      el.appendChild(fog);
    }
  }

  // ─── 終了 ────────────────────────────────────────────────
  _finish() {
    if (this._advTimer)  { clearTimeout(this._advTimer);  this._advTimer  = null; }
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    this._cleanupLab();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    this._overlay.style.transition = 'opacity 1.0s';
    this._overlay.style.opacity    = '0';
    setTimeout(() => {
      this._overlay.remove();
      this.onComplete();
    }, 1050);
  }
}
