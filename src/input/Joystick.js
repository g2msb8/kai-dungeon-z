// 左バーチャルジョイスティック。タッチした位置を基点に、ドラッグ方向/量を-1..1で返す。
// マウスでも動作（PCデバッグ用）。
// マルチタッチ対策：自身のポインターを setPointerCapture で占有し、攻撃ボタン等
// 2本目の指が触れても pointercancel で移動入力が途切れないようにする。
export class Joystick {
  constructor(zoneEl, baseEl, knobEl) {
    this.zone = zoneEl;
    this.base = baseEl;
    this.knob = knobEl;
    this.value = { x: 0, y: 0 }; // x:右+, y:下+（画面座標）
    this.active = false;
    this.pointerId = null;
    this.origin = { x: 0, y: 0 };
    this.maxRadius = 56;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    // すべて zone に紐付ける。pointerdown でキャプチャすれば、以降の move/up/cancel は
    // 指が zone の外（画面のどこ）へ動いても zone に届く。
    this.zone.addEventListener('pointerdown', this._onDown, { passive: false });
    this.zone.addEventListener('pointermove', this._onMove, { passive: false });
    this.zone.addEventListener('pointerup', this._onUp);
    this.zone.addEventListener('pointercancel', this._onUp);
  }

  _onDown(e) {
    if (this.active) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    // このポインターを zone に占有させる（他要素へ奪われない／cancelされにくい）
    try { this.zone.setPointerCapture(e.pointerId); } catch (_) {}
    this.origin.x = e.clientX;
    this.origin.y = e.clientY;
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.style.display = 'block';
    this.knob.style.left = `${e.clientX}px`;
    this.knob.style.top = `${e.clientY}px`;
    this.knob.style.display = 'block';
  }

  _onMove(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }
    this.knob.style.left = `${this.origin.x + dx}px`;
    this.knob.style.top = `${this.origin.y + dy}px`;
    this.value.x = dx / this.maxRadius;
    this.value.y = dy / this.maxRadius;
  }

  _onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    try { this.zone.releasePointerCapture(e.pointerId); } catch (_) {}
    this.active = false;
    this.pointerId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.base.style.display = 'none';
    this.knob.style.display = 'none';
  }
}
