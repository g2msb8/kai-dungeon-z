// ステージ5オープニング：氷のバイオーム
export class Stage5Opening {
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
    this._el.style.background = 'rgba(10, 30, 60, 0.90)';

    const title = this._text('〜 砂漠クリア 〜', '22px', '#ffd060', 'normal', '0');
    this._el.appendChild(title);

    const msg1 = this._text('灼熱の砂漠を乗り越えた…！', '20px', '#f0d080', 'bold');
    msg1.style.opacity = '0';
    msg1.style.transition = 'opacity 0.9s';
    msg1.style.marginTop = '18px';
    this._el.appendChild(msg1);

    const msg2 = this._text('しかし前方に　白い世界が広がっていた…', '17px', 'rgba(200,230,255,0.8)');
    msg2.style.opacity = '0';
    msg2.style.transition = 'opacity 0.8s';
    msg2.style.marginTop = '12px';
    this._el.appendChild(msg2);

    this._t(() => { msg1.style.opacity = '1'; this._speak('砂漠を乗り越えた…', 0.8, 0.85); }, 800);
    this._t(() => { msg2.style.opacity = '1'; }, 2200);
    this._t(() => this._scene2(), 5200);
  }

  _scene2() {
    this._el.style.background = 'radial-gradient(ellipse at 50% 40%, #b0d8ff 0%, #6098cc 100%)';
    this._el.innerHTML = '';

    const biome = this._text('氷のバイオーム', '54px', '#ffffff', 'bold', '0');
    biome.style.letterSpacing = '8px';
    biome.style.opacity = '0';
    biome.style.textShadow = '0 0 30px rgba(160,210,255,0.9), 0 0 60px rgba(100,180,255,0.5)';
    biome.style.transition = 'opacity 1.0s';
    this._el.appendChild(biome);

    const sub = this._text('', '19px', 'rgba(20,60,120,0.9)');
    sub.style.opacity = '0';
    sub.style.marginTop = '28px';
    sub.style.transition = 'opacity 0.6s';
    this._el.appendChild(sub);

    this._t(() => { biome.style.opacity = '1'; }, 200);
    this._t(() => { sub.style.opacity = '1'; sub.textContent = '「寒い…！」'; this._speak('寒い！', 0.85, 0.88); }, 1200);
    this._t(() => { sub.textContent = '「でも戦わなければ…！」'; this._speak('でも戦わなければ！', 0.82, 0.90); }, 2600);
    this._t(() => { sub.style.opacity = '0'; }, 4400);
    this._t(() => this._finish(), 5200);
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

  _speak(text, pitch = 0.80, rate = 0.90) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.pitch = pitch; u.rate = rate;
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
