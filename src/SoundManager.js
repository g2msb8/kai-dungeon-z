// SoundManager — Web Audio API による効果音合成
// 外部音源ファイル不要。すべてリアルタイム生成。
// モジュール内シングルトン `soundManager` をエクスポート。

class SoundManager {
  constructor() {
    this._ctx        = null;
    this._stepTimer  = 0;
    this._stepInterval = 0.29;  // 足音の間隔（秒）
    this._footL      = 0;       // 左右交互フラグ
  }

  // ─── AudioContext（遅延初期化）────────────────────────────
  get ctx() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  // ─── ノイズバッファ生成ヘルパー ────────────────────────────
  _noise(duration) {
    const ctx = this.ctx;
    if (!ctx) return null;
    const len = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  // ─── ディストーション曲線 ─────────────────────────────────
  _distCurve(amount) {
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return c;
  }

  // ═══════════════════════════════════════════════════════════
  // 足音（タッタッタッタッ）
  //   update ループから毎フレーム呼ぶ。moving=true のとき周期的に鳴らす。
  // ═══════════════════════════════════════════════════════════
  updateFootstep(dt, moving) {
    if (!moving) {
      // 停止中はタイマーを中間にリセット（再走り出し時に即鳴るのを防ぐ）
      this._stepTimer = this._stepInterval * 0.45;
      return;
    }
    this._stepTimer -= dt;
    if (this._stepTimer <= 0) {
      this._stepTimer += this._stepInterval;
      this._playStep();
    }
  }

  _playStep() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t   = ctx.currentTime;
    const src = this._noise(0.07);
    if (!src) return;

    // バンドパス（左右で少し周波数を変えて「タッ、トッ」交互感を出す）
    const filt = ctx.createBiquadFilter();
    filt.type            = 'bandpass';
    filt.frequency.value = this._footL ? 370 : 420;
    filt.Q.value         = 1.1;
    this._footL ^= 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  // ═══════════════════════════════════════════════════════════
  // 攻撃音（ザシュッ）
  //   剣を振った瞬間に呼ぶ
  // ═══════════════════════════════════════════════════════════
  playAttack() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // ── ノイズ swish（高周波から低周波へ急速スイープ）──
    const ns = this._noise(0.24);
    if (ns) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(3200, t);
      hpf.frequency.exponentialRampToValueAtTime(600, t + 0.20);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.58, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      ns.connect(hpf);
      hpf.connect(ng);
      ng.connect(ctx.destination);
      ns.start(t);
    }

    // ── 刃の衝撃（低めの短いズン）──
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.13);

    const og = ctx.createGain();
    og.gain.setValueAtTime(0.26, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ═══════════════════════════════════════════════════════════
  // ゾンビ攻撃音（ガオー、バシッ）
  //   ゾンビがプレイヤーに攻撃するときに呼ぶ
  // ═══════════════════════════════════════════════════════════
  playZombieAttack() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // ── ガオー（低い唸り声）──
    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.frequency.setValueAtTime(88, t);
    growl.frequency.setValueAtTime(68, t + 0.20);

    // ビブラート LFO
    const vib  = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibG = ctx.createGain();
    vibG.gain.value = 12;
    vib.connect(vibG);
    vibG.connect(growl.frequency);

    const dist = ctx.createWaveShaper();
    dist.curve = this._distCurve(160);

    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0, t);
    gg.gain.linearRampToValueAtTime(0.48, t + 0.04);
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.40);

    growl.connect(dist);
    dist.connect(gg);
    gg.connect(ctx.destination);
    growl.start(t);  growl.stop(t + 0.42);
    vib.start(t);    vib.stop(t + 0.42);

    // ── バシッ（打撃）── 0.30s 後
    const imp = this._noise(0.12);
    if (imp) {
      const lpf = ctx.createBiquadFilter();
      lpf.type            = 'lowpass';
      lpf.frequency.value = 380;

      const ig = ctx.createGain();
      ig.gain.setValueAtTime(0.75, t + 0.30);
      ig.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      imp.connect(lpf);
      lpf.connect(ig);
      ig.connect(ctx.destination);
      imp.start(t + 0.30);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ゾンビ死亡音（ギャー！枯れた絶叫）
  //   ゾンビが倒されたときに呼ぶ
  // ═══════════════════════════════════════════════════════════
  playZombieDeath() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // ── 複数デチューンのオシレーター（枯れ声感）──
    // ピッチ：ギャー → グオー と落ちていく
    [440, 447, 433].forEach((baseF, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseF * 0.85, t);
      osc.frequency.linearRampToValueAtTime(baseF * 1.18, t + 0.10); // キャー（上昇）
      osc.frequency.exponentialRampToValueAtTime(78, t + 0.54);      // ガー（下降）

      const dist = ctx.createWaveShaper();
      dist.curve = this._distCurve(180 + i * 50);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.35 : 0.16, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.56);

      osc.connect(dist);
      dist.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.58);
    });

    // ── ノイズ（かすれ感）──
    const ns = this._noise(0.54);
    if (ns) {
      const bpf = ctx.createBiquadFilter();
      bpf.type            = 'bandpass';
      bpf.frequency.value = 1500;
      bpf.Q.value         = 0.55;

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.20, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.54);

      ns.connect(bpf);
      bpf.connect(ng);
      ng.connect(ctx.destination);
      ns.start(t);
    }
  }
}

export const soundManager = new SoundManager();
