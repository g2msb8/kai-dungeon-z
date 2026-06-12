// ステージ4オープニング：2シーン構成。
// Scene1: 紫の目のゾンビに囲まれた場面 + 大ジャンプで脱出
// Scene2: 砂漠バイオーム宣言
export class Stage4Opening {
  constructor(onComplete) {
    this._onComplete = onComplete;
    this._el = null;
    this._timers = [];
  }

  start() {
    this._el = document.createElement('div');
    Object.assign(this._el.style, {
      position: 'fixed', inset: '0', zIndex: '45',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',
      transition: 'background 1.0s',
      userSelect: 'none',
    });
    document.body.appendChild(this._el);
    this._scene1();
  }

  _scene1() {
    this._el.style.background = 'rgba(20,0,30,0.85)';

    const title = this._text('〜 溶岩バイオーム 〜', '22px', '#ff7733', 'normal', '0');
    this._el.appendChild(title);

    const msg1 = this._text('紫の瞳のゾンビたちに　囲まれた…！', '20px', '#cc88ff', 'bold');
    msg1.style.opacity = '0';
    msg1.style.transition = 'opacity 0.9s';
    msg1.style.marginTop = '18px';
    this._el.appendChild(msg1);

    const msg2 = this._text('あなたは大きくジャンプして　脱出した！', '17px', 'rgba(255,255,255,0.6)');
    msg2.style.opacity = '0';
    msg2.style.transition = 'opacity 0.8s';
    msg2.style.marginTop = '12px';
    this._el.appendChild(msg2);

    this._t(() => {
      msg1.style.opacity = '1';
      this._speak('うぅぅ…', 0.6, 0.7);
    }, 900);
    this._t(() => { msg2.style.opacity = '1'; }, 2400);
    this._t(() => this._scene2(), 5500);
  }

  _scene2() {
    this._el.style.background = 'radial-gradient(ellipse at 50% 50%, #e8c060 0%, #a07020 100%)';
    this._el.innerHTML = '';

    const biome = this._text('砂漠バイオーム', '54px', '#ffffff', 'bold', '0');
    biome.style.letterSpacing = '8px';
    biome.style.opacity = '0';
    biome.style.textShadow = '0 0 30px rgba(255,200,100,0.8)';
    biome.style.transition = 'opacity 1.0s';
    this._el.appendChild(biome);

    const sub = this._text('', '19px', 'rgba(80,40,0,0.85)');
    sub.style.opacity = '0';
    sub.style.marginTop = '28px';
    sub.style.transition = 'opacity 0.6s';
    this._el.appendChild(sub);

    this._t(() => { biome.style.opacity = '1'; }, 200);
    this._t(() => { sub.style.opacity = '1'; sub.textContent = '「砂漠だ…」'; this._speak('砂漠だ…', 0.80, 0.85); }, 1200);
    this._t(() => { sub.textContent = '「誰かいる？」'; this._speak('誰かいる？', 0.82, 0.90); }, 2400);
    this._t(() => { sub.style.opacity = '0'; }, 4200);
    this._t(() => this._finish(), 5000);
  }

  _text(content, size, color, weight = 'normal', marginTop = '0') {
    const el = document.createElement('div');
    el.textContent = content;
    Object.assign(el.style, {
      fontSize: size, color, fontWeight: weight,
      marginTop, textAlign: 'center', letterSpacing: '2px',
      padding: '0 24px',
    });
    return el;
  }

  _shakeEl() {
    this._el.style.animation = 'stage2shake 0.55s ease-in-out 3';
    this._t(() => { if (this._el) this._el.style.animation = ''; }, 1800);
  }

  _speak(text, pitch = 0.80, rate = 0.90) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.pitch = pitch; u.rate = rate;
    // 男性の日本語音声を優先選択（Hattori=iOS男性, Otoya=macOS男性）
    const voices = speechSynthesis.getVoices();
    const male = voices.find(v => v.lang.startsWith('ja') && /eddy|hattori|otoya|reed|rocko/i.test(v.name));
    const jp   = male || voices.find(v => v.lang.startsWith('ja'));
    if (jp) u.voice = jp;
    speechSynthesis.speak(u);
  }

  _t(fn, ms) { this._timers.push(setTimeout(fn, ms)); }

  _finish() {
    this._cleanup();
    if (this._onComplete) this._onComplete();
  }

  _cleanup() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}
