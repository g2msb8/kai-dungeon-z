// 右攻撃ボタン。押下のたびに onAttack を発火。長押し連打にも対応。
// 自身のポインターを setPointerCapture で占有し、ジョイスティック側の操作と
// 干渉（pointercancel 連鎖）しないようにする。
export class AttackButton {
  constructor(el, onAttack) {
    this.el = el;
    this.onAttack = onAttack;
    this.pointerId = null;

    const press = (e) => {
      e.preventDefault();
      this.pointerId = e.pointerId;
      try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
      this.el.classList.add('pressed');
      this.onAttack();
    };
    const release = (e) => {
      if (this.pointerId !== null) {
        try { this.el.releasePointerCapture(this.pointerId); } catch (_) {}
        this.pointerId = null;
      }
      this.el.classList.remove('pressed');
    };

    this.el.addEventListener('pointerdown', press, { passive: false });
    this.el.addEventListener('pointerup', release);
    this.el.addEventListener('pointercancel', release);
  }
}
