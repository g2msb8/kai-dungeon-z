// HUD更新：HPバー・残ゾンビ数・素材カウンタ・ボスHPバー。
import { PLAYER } from '../core/Constants.js';

export class HUD {
  constructor() {
    this.hpFill     = document.getElementById('hp-fill');
    this.zombieCount = document.getElementById('zombie-count');
    this.stoneCount  = document.getElementById('stone-count');
    this.oreCount    = document.getElementById('ore-count');
    this._bossBar   = document.getElementById('boss-hp-wrap');
    this._bossFill  = document.getElementById('boss-hp-fill');
  }

  setHP(hp) {
    const pct = Math.max(0, Math.min(100, (hp / PLAYER.MAX_HP) * 100));
    this.hpFill.style.width = `${pct}%`;
  }

  setZombies(n) {
    this.zombieCount.textContent = n;
  }

  setDrops(drops) {
    this.stoneCount.textContent = drops.stone;
    this.oreCount.textContent   = drops.ore;
  }

  setBossHP(fraction) {
    if (fraction === null || fraction === undefined) {
      this._bossBar.classList.add('hidden');
    } else {
      this._bossBar.classList.remove('hidden');
      this._bossFill.style.width = Math.max(0, Math.min(100, fraction * 100)).toFixed(1) + '%';
    }
  }

  reset() {
    this.setHP(PLAYER.MAX_HP);
    this.setDrops({ stone: 0, ore: 0 });
    this.setBossHP(null);
  }
}
