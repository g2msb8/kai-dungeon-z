// 真っ白い世界ステージの開始前画面：「ボス」テキスト＋挑戦/帰宅ボタン。
export class BossChallenge {
  constructor(onChallenge, onHome) {
    this._onChallenge = onChallenge;
    this._onHome = onHome;
    this._el = null;
  }

  start() {
    this._el = document.createElement('div');
    Object.assign(this._el.style, {
      position: 'fixed', inset: '0', zIndex: '47',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '34px',
      background: 'radial-gradient(ellipse at 50% 40%, #ffffff 0%, #e6e6e6 70%, #cccccc 100%)',
      fontFamily: '-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',
      userSelect: 'none',
    });

    const title = document.createElement('div');
    title.textContent = 'ボス';
    Object.assign(title.style, {
      fontSize: 'clamp(56px, 20vw, 110px)', fontWeight: 'bold', letterSpacing: '10px',
      color: '#111', textShadow: '0 4px 0 rgba(0,0,0,0.15), 0 0 30px rgba(0,0,0,0.2)',
    });
    this._el.appendChild(title);

    const btns = document.createElement('div');
    Object.assign(btns.style, { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' });

    const challenge = this._button('⚔ 勝負に挑む', 'linear-gradient(180deg,#ef5350,#b71c1c)', '#7f0000');
    challenge.addEventListener('click', () => { this._close(); if (this._onChallenge) this._onChallenge(); });
    btns.appendChild(challenge);

    const home = this._button('🏠 ホームに戻る', 'linear-gradient(180deg,#bdbdbd,#757575)', '#424242');
    home.addEventListener('click', () => { this._close(); if (this._onHome) this._onHome(); });
    btns.appendChild(home);

    this._el.appendChild(btns);
    document.body.appendChild(this._el);
  }

  _button(label, bg, shadow) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      padding: '18px 44px', fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px',
      color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer',
      background: bg, boxShadow: `0 5px 0 ${shadow}, 0 8px 20px rgba(0,0,0,0.3)`,
      minWidth: '240px',
    });
    return b;
  }

  _close() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}
