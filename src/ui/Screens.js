// タイトル/クリア/ゲームオーバー画面の表示制御。
export class Screens {
  constructor({ onStart, onRetry, onNextStage }) {
    this.title = document.getElementById('screen-title');
    this.clear = document.getElementById('screen-clear');
    this.over  = document.getElementById('screen-over');
    this.clearResult = document.getElementById('clear-result');
    this.overResult  = document.getElementById('over-result');
    this._clearBig   = document.getElementById('clear-big');
    this._nextBtn    = document.getElementById('btn-next-stage');

    document.getElementById('btn-start').addEventListener('click', onStart);
    document.getElementById('btn-retry-clear').addEventListener('click', onRetry);
    document.getElementById('btn-retry-over').addEventListener('click', onRetry);
    if (this._nextBtn) this._nextBtn.addEventListener('click', onNextStage);
  }

  hideAll() {
    this.title.classList.add('hidden');
    this.clear.classList.add('hidden');
    this.over.classList.add('hidden');
  }

  showTitle() {
    this.hideAll();
    this.title.classList.remove('hidden');
  }

  showClear(drops, stage = 1) {
    this.hideAll();
    const msgMap = {
      1: '周囲のゾンビをすべて倒した',
      2: 'ボスを撃破した！',
      3: '紫の目のゾンビを倒した！',
      4: '砂漠のゾンビをすべて倒した！',
    };
    if (this._clearBig) {
      this._clearBig.textContent = msgMap[stage] ?? '全滅させた！';
    }
    this.clearResult.innerHTML =
      `見つけた素材<br>古びた石 × ${drops.stone}　／　鉄の鉱石 × ${drops.ore}`;
    if (this._nextBtn) {
      // ステージ4 はもう次がないのでボタンを隠す
      this._nextBtn.style.display = stage < 4 ? '' : 'none';
    }
    this.clear.classList.remove('hidden');
  }

  showOver(drops) {
    this.hideAll();
    this.overResult.innerHTML =
      `見つけた素材<br>古びた石 × ${drops.stone}　／　鉄の鉱石 × ${drops.ore}`;
    this.over.classList.remove('hidden');
  }
}
