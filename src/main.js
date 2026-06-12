// エントリ：状態機械
// OPENING_CHOICE → (見る) OPENING → TITLE → PLAYING → CLEAR / OVER
import * as THREE from 'three';
import { Game }           from './Game.js';
import { Joystick }       from './input/Joystick.js';
import { AttackButton }   from './input/AttackButton.js';
import { HUD }            from './ui/HUD.js';
import { Screens }        from './ui/Screens.js';
import { Opening }        from './ui/Opening.js';
import { Stage2Opening }  from './ui/Stage2Opening.js';
import { Stage3Opening }  from './ui/Stage3Opening.js';
import { Stage4Opening }  from './ui/Stage4Opening.js';

const STATE = {
  HOME:           'home',
  OPENING_CHOICE: 'opening_choice',
  OPENING:        'opening',
  TITLE:          'title',
  PLAYING:        'playing',
  CLEAR:          'clear',
  OVER:           'over',
};

const game = new Game(document.getElementById('app'));
const hud  = new HUD();

const joystick = new Joystick(
  document.getElementById('joystick-zone'),
  document.getElementById('joystick-base'),
  document.getElementById('joystick-knob'),
);

new AttackButton(document.getElementById('attack-btn'), () => {
  if (state === STATE.PLAYING) game.player.tryAttack();
});

const screens = new Screens({
  onStart:     () => startGame(),
  onRetry:     () => retryCurrentStage(),
  onNextStage: () => {
    if (currentStage === 1) startStage2Opening();
    else if (currentStage === 2) startStage3Opening();
    else if (currentStage === 3) startStage4Opening();
  },
});

let state        = STATE.HOME;
let currentStage = 1;
let potions      = parseInt(localStorage.getItem('dz_potions') || '0', 10);

// ─── DOM 要素参照 ──────────────────────────────────────────
const homeEl     = document.getElementById('screen-home');
const shopEl     = document.getElementById('screen-shop');
const opChoiceEl = document.getElementById('screen-op-choice');

// ─── コインシステム ────────────────────────────────────────
function getCoins() {
  return parseInt(localStorage.getItem('dz_coins') || '0', 10);
}
function addCoins(n) {
  localStorage.setItem('dz_coins', getCoins() + n);
  updateCoinDisplay();
}
function spendCoins(n) {
  localStorage.setItem('dz_coins', Math.max(0, getCoins() - n));
  updateCoinDisplay();
}
function updateCoinDisplay() {
  const c = getCoins();
  const el  = document.getElementById('home-coin-display');
  const el2 = document.getElementById('shop-coin-display');
  if (el)  el.textContent  = c;
  if (el2) el2.textContent = c;
}

// ─── 所持アイテム ──────────────────────────────────────────
function getOwned() {
  try { return JSON.parse(localStorage.getItem('dz_owned') || '{}'); } catch { return {}; }
}
function ownItem(id) {
  const o = getOwned(); o[id] = true;
  localStorage.setItem('dz_owned', JSON.stringify(o));
}

// ─── 装備中の武器 ──────────────────────────────────────────
function getEquipped() {
  return localStorage.getItem('dz_equipped') || null;
}
function setEquipped(id) {
  localStorage.setItem('dz_equipped', id);
}

// ─── ショップ ──────────────────────────────────────────────
function refreshShopButtons() {
  const coins   = getCoins();
  const owned   = getOwned();
  const current = getBestWeapon(); // 現在装備中の武器
  document.querySelectorAll('.shop-buy-btn').forEach(btn => {
    const id   = btn.dataset.item;
    const cost = parseInt(btn.dataset.cost, 10);
    if (owned[id]) {
      if (id === current) {
        btn.textContent = '装備中';
        btn.disabled    = true;
        btn.className   = 'shop-buy-btn equipped';
      } else {
        btn.textContent = '装備する';
        btn.disabled    = false;
        btn.className   = 'shop-buy-btn equip';
      }
    } else {
      btn.textContent = '購入する';
      btn.disabled    = coins < cost;
      btn.className   = 'shop-buy-btn';
    }
  });
}
function showShop() {
  updateCoinDisplay();
  refreshShopButtons();
  shopEl.classList.remove('hidden');
}
function hideShop() {
  shopEl.classList.add('hidden');
}

document.getElementById('btn-shop-close').addEventListener('click', hideShop);

document.getElementById('btn-reset-data').addEventListener('click', () => {
  localStorage.setItem('dz_coins', '0');
  localStorage.setItem('dz_owned', '{}');
  localStorage.removeItem('dz_equipped');
  localStorage.removeItem('dz_next_stage');
  localStorage.removeItem('dz_potions');
  potions = 0;
  updateCoinDisplay();
  refreshShopButtons();
  updatePotionBtn();
});

document.getElementById('btn-cheat-coin').addEventListener('click', () => {
  addCoins(1000);
  refreshShopButtons();
});

document.getElementById('potion-btn').addEventListener('click', () => {
  if (state !== STATE.PLAYING || potions <= 0) return;
  potions--;
  localStorage.setItem('dz_potions', String(potions));
  // HP を 50 回復（上限 100）
  game.player.hp = Math.min(100, (game.player.hp || 0) + 50);
  hud.setHP(game.player.hp);
  updatePotionBtn();
});

document.querySelectorAll('.shop-buy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id   = btn.dataset.item;
    const cost = parseInt(btn.dataset.cost, 10);
    if (getOwned()[id]) {
      // 所持済み → 装備に切り替え
      setEquipped(id);
      refreshShopButtons();
    } else {
      // 未購入 → 購入して自動装備
      if (getCoins() < cost) return;
      spendCoins(cost);
      ownItem(id);
      setEquipped(id);
      refreshShopButtons();
    }
  });
});

// ─── ホーム画面 ────────────────────────────────────────────
document.getElementById('btn-home-start').addEventListener('click', () => {
  const nextStage = parseInt(localStorage.getItem('dz_next_stage') || '1', 10);
  homeEl.classList.add('hidden');
  if (nextStage === 2) {
    startStage2Opening();
  } else if (nextStage === 3) {
    startStage3Opening();
  } else if (nextStage === 4) {
    startStage4Opening();
  } else {
    // Stage 1 → 通常フロー（オープニング選択）
    state = STATE.OPENING_CHOICE;
    opChoiceEl.classList.remove('hidden');
  }
});

document.getElementById('btn-home-shop').addEventListener('click', showShop);

// ─── ゾンビ管理コールバック ────────────────────────────────
game.zombies.onKill = ({ drops, remaining }) => {
  hud.setDrops(drops);
  hud.setZombies(remaining);
};
game.zombies.onCleared = () => {
  if (state !== STATE.PLAYING) return;
  state = STATE.CLEAR;
  const coinMap = { 1: 50, 2: 100, 3: 150, 4: 200 };
  addCoins(coinMap[currentStage] ?? 50);
  // 次回スタート位置を保存（Stage4クリアで全クリ → リセット）
  if (currentStage < 4) {
    localStorage.setItem('dz_next_stage', String(currentStage + 1));
  } else {
    localStorage.removeItem('dz_next_stage');
  }
  updatePotionBtn();
  screens.showClear(game.zombies.drops, currentStage);
};
game.zombies.onBossSpawn = () => {
  _showBossWarning();
};
game.zombies.onBossKill = () => {
  if (Math.random() < 0.60) {
    potions++;
    localStorage.setItem('dz_potions', String(potions));
    _showPotionGet();
  }
};

// ─── ポーションボタン表示更新 ──────────────────────────────
function updatePotionBtn() {
  const btn = document.getElementById('potion-btn');
  if (!btn) return;
  const n = potions;
  if (n > 0 && state === STATE.PLAYING) {
    btn.classList.remove('hidden');
    btn.innerHTML = n > 1
      ? `使う<span style="font-size:11px;display:block;opacity:0.85;">×${n}</span>`
      : '使う';
  } else {
    btn.classList.add('hidden');
  }
}

// ─── 回復薬ゲット通知 ────────────────────────────────────
function _showPotionGet() {
  const el = document.createElement('div');
  el.textContent = '💊 回復薬をゲット！';
  Object.assign(el.style, {
    position: 'fixed', left: '50%', top: '38%',
    transform: 'translateX(-50%)',
    zIndex: '22', pointerEvents: 'none',
    fontSize: '21px', fontWeight: 'bold',
    color: '#80deea',
    textShadow: '0 0 14px #00bcd4, 0 2px 6px #000',
    whiteSpace: 'nowrap',
    animation: 'potionGetAnim 2.4s forwards',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
  updatePotionBtn();
}

// ─── ボス出現警告 ──────────────────────────────────────────
function _showBossWarning() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', left: '50%', top: '30%',
    zIndex: '22', pointerEvents: 'none',
    fontSize: '36px', fontWeight: 'bold',
    color: '#ff4444',
    textShadow: '0 0 18px #ff0000, 0 2px 6px #000',
    whiteSpace: 'nowrap',
    animation: 'bossWarnAnim 2.6s forwards',
  });
  el.textContent = '⚠　ボス出現　⚠';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ─── 装備中の武器を返す（未設定なら最強の所持武器） ─────────
function getBestWeapon() {
  const owned    = getOwned();
  const equipped = getEquipped();
  // 明示的に装備している武器があればそれを使う
  if (equipped && owned[equipped]) return equipped;
  // フォールバック: 最強の所持武器
  if (owned.lightning) return 'lightning';
  if (owned.blackhole) return 'blackhole';
  if (owned.light)     return 'light';
  if (owned.netherite) return 'netherite';
  if (owned.diamond)   return 'diamond';
  if (owned.iron)      return 'iron';
  return 'copper';
}

// ─── 現在のステージをリトライ（ステージを維持して再挑戦） ──
function retryCurrentStage() {
  game.player.setWeapon(getBestWeapon());
  if      (currentStage === 2) game.startStage2();
  else if (currentStage === 3) game.startStage3();
  else if (currentStage === 4) game.startStage4();
  else                         game.startStage();
  hud.reset();
  hud.setZombies(game.zombies.aliveCount);
  screens.hideAll();
  state = STATE.PLAYING;
  updatePotionBtn();
}

// ─── ステージ1 開始 ────────────────────────────────────────
function startGame() {
  currentStage = 1;
  game.player.setWeapon(getBestWeapon());
  game.startStage();
  hud.reset();
  hud.setZombies(game.zombies.aliveCount);
  screens.hideAll();
  state = STATE.PLAYING;
  updatePotionBtn();
}

// ─── ステージ2 オープニング → ゲーム開始 ──────────────────
function startStage2Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage2Opening(() => {
    currentStage = 2;
    game.player.setWeapon(getBestWeapon());
    game.startStage2();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ3 オープニング → ゲーム開始 ──────────────────
function startStage3Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage3Opening(() => {
    currentStage = 3;
    game.player.setWeapon(getBestWeapon());
    game.startStage3();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ4 オープニング → ゲーム開始 ──────────────────
function startStage4Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage4Opening(() => {
    currentStage = 4;
    game.player.setWeapon(getBestWeapon());
    game.startStage4();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ホーム画面へ（オープニング後・ゲームクリア後） ─────────
function showHome() {
  currentStage = 1;
  state = STATE.HOME;
  homeEl.classList.remove('hidden');
  hideShop();
  screens.hideAll();
  updateCoinDisplay();
  updatePotionBtn();
}

// ─── タイトル画面へ ────────────────────────────────────────
function showTitle() {
  state = STATE.TITLE;
  screens.showTitle();
}

// ─── オープニング選択画面 ───────────────────────────────────
document.getElementById('btn-op-yes').addEventListener('click', () => {
  opChoiceEl.classList.add('hidden');
  state = STATE.OPENING;
  const opening = new Opening(() => { startGame(); });
  opening.start();
});

document.getElementById('btn-op-no').addEventListener('click', () => {
  opChoiceEl.classList.add('hidden');
  showTitle();
});

// ─── クリア画面「ホーム画面に戻る」 ─────────────────────────
document.getElementById('btn-home-from-clear').addEventListener('click', () => {
  showHome();
});

// ─── メインループ ───────────────────────────────────────────
let rafId = null;
let last  = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);

  if (state === STATE.PLAYING) {
    game.update(dt, joystick.value);
    hud.setHP(game.player.hp);
    hud.setZombies(game.zombies.aliveCount);
    hud.setBossHP(game.zombies.bossHPFraction);

    if (!game.player.alive) {
      state = STATE.OVER;
      updatePotionBtn();
      screens.showOver(game.zombies.drops);
    }
  } else {
    game.update(0, { x: 0, y: 0 });
  }

  game.render();
  rafId = requestAnimationFrame(loop);
}

// ─── デバッグ用 ────────────────────────────────────────────
window.__dz = {
  game,
  get state() { return state; },
  get currentStage() { return currentStage; },
  startGame,
  startStage2Opening,
  startStage3Opening,
  startStage4Opening,
  pauseLoop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
  resumeLoop() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); } },
};

// ─── 起動 ─────────────────────────────────────────────────
document.getElementById('loading').style.display = 'none';
updateCoinDisplay();
rafId = requestAnimationFrame(loop);
