// ステージ6オープニング：魔界バイオーム
export class Stage6Opening {
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
    this._el.style.background = 'rgba(8, 0, 18, 0.95)';

    const title = this._text('〜 氷のバイオーム クリア 〜', '22px', '#88ccff', 'normal', '0');
    this._el.appendChild(title);

    const msg1 = this._text('凍える世界を突き破った！', '20px', '#aaddff', 'bold');
    msg1.style.opacity = '0';
    msg1.style.transition = 'opacity 0.9s';
    msg1.style.marginTop = '18px';
    this._el.appendChild(msg1);

    const msg2 = this._text('しかし…　空気が歪む。', '17px', 'rgba(200,100,255,0.85)');
    msg2.style.opacity = '0';
    msg2.style.transition = 'opacity 0.8s';
    msg2.style.marginTop = '12px';
    this._el.appendChild(msg2);

    const msg3 = this._text('禍々しい瘴気が漂ってきた…', '16px', 'rgba(180,80,255,0.70)');
    msg3.style.opacity = '0';
    msg3.style.transition = 'opacity 0.7s';
    msg3.style.marginTop = '10px';
    this._el.appendChild(msg3);

    this._t(() => { msg1.style.opacity = '1'; this._speak('凍える世界を突き破った！', 0.78, 0.88); }, 800);
    this._t(() => { msg2.style.opacity = '1'; }, 2400);
    this._t(() => { msg3.style.opacity = '1'; this._speak('禍々しい瘴気が…', 0.55, 0.72); }, 3800);
    this._t(() => this._scene2(), 6200);
  }

  _scene2() {
    this._el.style.background = 'radial-gradient(ellipse at 50% 60%, #2a0040 0%, #0a0015 100%)';
    this._el.innerHTML = '';

    const biome = this._text('魔界バイオーム', '54px', '#cc66ff', 'bold', '0');
    biome.style.letterSpacing = '8px';
    biome.style.opacity = '0';
    biome.style.textShadow = '0 0 30px rgba(180,50,255,0.9), 0 0 60px rgba(120,0,200,0.5)';
    biome.style.transition = 'opacity 1.0s';
    this._el.appendChild(biome);

    const sub = this._text('', '19px', 'rgba(200,100,255,0.95)');
    sub.style.opacity = '0';
    sub.style.marginTop = '28px';
    sub.style.transition = 'opacity 0.6s';
    this._el.appendChild(sub);

    this._t(() => { biome.style.opacity = '1'; }, 200);
    this._t(() => { sub.style.opacity = '1'; sub.textContent = '「ここは…　魔界か…！」'; this._speak('ここは魔界か！', 0.58, 0.78); }, 1200);
    this._t(() => { sub.textContent = '「紫の瞳の怪物が待ち受けている…」'; this._speak('紫の瞳の怪物が！', 0.55, 0.75); }, 2800);
    this._t(() => { sub.style.opacity = '0'; }, 4600);
    this._t(() => this._finish(), 5400);
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
