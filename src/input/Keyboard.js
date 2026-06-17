// PC キーボード入力ハンドラ
// 移動: ArrowUp/Left/Right  アクション: KeyA(攻撃) KeyK(回復) KeyT(特殊技)
const GAME_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyA', 'KeyK', 'KeyT',
]);

export class Keyboard {
  constructor() {
    this._down     = new Set();
    this._justDown = new Set();

    window.addEventListener('keydown', e => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      if (!this._down.has(e.code)) this._justDown.add(e.code);
      this._down.add(e.code);
    });
    window.addEventListener('keyup', e => {
      this._down.delete(e.code);
    });
  }

  // ジョイスティック互換の移動ベクトル {x, y}
  get moveValue() {
    let x = 0, y = 0;
    if (this._down.has('ArrowLeft'))  x -= 1;
    if (this._down.has('ArrowRight')) x += 1;
    if (this._down.has('ArrowUp'))    y -= 1;
    if (this._down.has('ArrowDown'))  y += 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  // 押した瞬間だけ true を返す（一度読んだら消費）
  consumeJustPressed(code) {
    if (this._justDown.has(code)) {
      this._justDown.delete(code);
      return true;
    }
    return false;
  }
}
