// 汎用ステージオープニング（ステージ8〜12用）。
// バイオーム名と色を渡すと、暗転→ステージ名演出→開始 を行う。
export class GenericOpening {
  constructor(name, bgGradient, color, onComplete, lines = []) {
    this._name = name;
    this._bg   = bgGradient;
    this._color = color;
    this._lines = lines;
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
      background: 'rgba(0,0,0,0.92)',
      fontFamily: '-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',
      transition: 'background 1.0s', userSelect: 'none',
    });
    document.body.appendChild(this._el);
    this._t(() => { this._el.style.background = this._bg; this._scene(); }, 400);
  }

  _scene() {
    this._el.innerHTML = '';
    const biome = this._text(this._name, 'clamp(34px,11vw,54px)', this._color, 'bold');
    biome.style.letterSpacing = '6px';
    biome.style.opacity = '0';
    biome.style.textShadow = '0 0 26px rgba(255,255,255,0.4), 0 2px 8px #000';
    biome.style.transition = 'opacity 1.0s';
    this._el.appendChild(biome);

    const sub = this._text('', '18px', 'rgba(255,255,255,0.85)');
    sub.style.opacity = '0';
    sub.style.marginTop = '24px';
    sub.style.transition = 'opacity 0.5s';
    this._el.appendChild(sub);

    this._t(() => { biome.style.opacity = '1'; }, 200);
    let delay = 1200;
    for (const ln of this._lines) {
      const d = delay;
      this._t(() => { sub.style.opacity = '1'; sub.textContent = ln; }, d);
      delay += 1600;
    }
    this._t(() => { sub.style.opacity = '0'; }, delay);
    this._t(() => this._finish(), delay + 700);
  }

  _text(content, size, color, weight = 'normal') {
    const el = document.createElement('div');
    el.textContent = content;
    Object.assign(el.style, {
      fontSize: size, color, fontWeight: weight,
      textAlign: 'center', letterSpacing: '2px', padding: '0 24px',
    });
    return el;
  }

  _t(fn, ms) { this._timers.push(setTimeout(fn, ms)); }

  _finish() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
    if (this._onComplete) this._onComplete();
  }
}
