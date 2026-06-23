// エントリ：状態機械
// OPENING_CHOICE → (見る) OPENING → TITLE → PLAYING → CLEAR / OVER
import * as THREE from 'three';
import { Game }           from './Game.js';
import { HomeScene }      from './HomeScene.js';
import { Joystick }       from './input/Joystick.js';
import { Keyboard }       from './input/Keyboard.js';
import { AttackButton }   from './input/AttackButton.js';
import { HUD }            from './ui/HUD.js';
import { Screens }        from './ui/Screens.js';
import { Opening }        from './ui/Opening.js';
import { Stage2Opening }  from './ui/Stage2Opening.js';
import { Stage3Opening }  from './ui/Stage3Opening.js';
import { Stage4Opening }  from './ui/Stage4Opening.js';
import { Stage5Opening }  from './ui/Stage5Opening.js';
import { Stage6Opening }  from './ui/Stage6Opening.js';
import { Stage7Opening }  from './ui/Stage7Opening.js';
import { GenericOpening } from './ui/GenericOpening.js';
import { BossChallenge } from './ui/BossChallenge.js';

const STATE = {
  HOME:           'home',
  OPENING_CHOICE: 'opening_choice',
  OPENING:        'opening',
  TITLE:          'title',
  PLAYING:        'playing',
  CLEAR:          'clear',
  OVER:           'over',
};

const game      = new Game(document.getElementById('app'));
const homeScene = new HomeScene(document.getElementById('home-canvas'));
const hud       = new HUD();

const joystick = new Joystick(
  document.getElementById('joystick-zone'),
  document.getElementById('joystick-base'),
  document.getElementById('joystick-knob'),
);
const keyboard = new Keyboard();

// ジョイスティックとキーボードの入力を合成（どちらも使えるように）
function getMoveInput() {
  const joy = joystick.value;
  const key = keyboard.moveValue;
  let x = (joy.x || 0) + (key.x || 0);
  let y = (joy.y || 0) + (key.y || 0);
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

new AttackButton(document.getElementById('attack-btn'), () => {
  if (state === STATE.PLAYING) game.player.tryAttack();
});

const screens = new Screens({
  onStart:     () => startGame(),
  onRetry:     () => retryCurrentStage(),
  onNextStage: () => {
    if      (currentStage === 1) startStage2Opening();
    else if (currentStage === 2) startStage3Opening();
    else if (currentStage === 3) startStage4Opening();
    else if (currentStage === 4) startStage5Opening();
    else if (currentStage === 5) startStage6Opening();
    else if (currentStage === 6) startStage7Opening();
    else if (currentStage === 7) startStage8Opening();
    else if (currentStage === 8) startStage9Opening();
    else if (currentStage === 9) startStage10Opening();
    else if (currentStage === 10) startStage11Opening();
    else if (currentStage === 11) startStage12Opening();
  },
});

let state        = STATE.HOME;
let currentStage = 1;
let potions      = parseInt(localStorage.getItem('dz_potions') || '0', 10);

// ─── DOM 要素参照 ──────────────────────────────────────────
const homeEl      = document.getElementById('screen-home');
const shopEl      = document.getElementById('screen-shop');
const shopMenuEl  = document.getElementById('screen-shop-menu');
const shopSkillEl = document.getElementById('screen-shop-skill');
const opChoiceEl  = document.getElementById('screen-op-choice');

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
  const el3 = document.getElementById('shopskill-coin-display');
  if (el)  el.textContent  = c;
  if (el2) el2.textContent = c;
  if (el3) el3.textContent = c;
}

// ─── 特殊技の定義 ──────────────────────────────────────────
const SKILLS = [
  { id: 'dash',         name: 'ダッシュ' },
  { id: 'hyperjump',    name: 'ハイパージャンプ' },
  { id: 'meteor',       name: '隕石投げ' },
  { id: 'clone',        name: '分身' },
  { id: 'ghostarrows',  name: '爆無闇死矢' },
  { id: 'invisibility', name: '透明化' },
];

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

// ── ショップ選択メニュー（剣 / 特殊技）──
function showShopMenu() {
  updateCoinDisplay();
  shopMenuEl.classList.remove('hidden');
}
function hideShopMenu() {
  shopMenuEl.classList.add('hidden');
}

// ── 特殊技のお店 ──
function refreshSkillButtons() {
  const coins = getCoins();
  const owned = getOwned();
  document.querySelectorAll('.skill-buy-btn').forEach(btn => {
    const id   = btn.dataset.skill;
    const cost = parseInt(btn.dataset.cost, 10);
    if (owned[id]) {
      btn.textContent = '購入済み';
      btn.disabled    = true;
      btn.className   = 'skill-buy-btn owned';
    } else {
      btn.textContent = '購入する';
      btn.disabled    = coins < cost;
      btn.className   = 'skill-buy-btn';
    }
  });
}
function showSkillShop() {
  updateCoinDisplay();
  refreshSkillButtons();
  shopSkillEl.classList.remove('hidden');
}
function hideSkillShop() {
  shopSkillEl.classList.add('hidden');
}

document.getElementById('btn-shop-close').addEventListener('click', () => {
  hideShop();
  showShopMenu();
});
document.getElementById('btn-shopmenu-close').addEventListener('click', hideShopMenu);
document.getElementById('btn-shopskill-close').addEventListener('click', () => {
  hideSkillShop();
  showShopMenu();
});
document.getElementById('btn-shop-sword').addEventListener('click', () => {
  hideShopMenu();
  showShop();
});
document.getElementById('btn-shop-skill').addEventListener('click', () => {
  hideShopMenu();
  showSkillShop();
});

// 特殊技の購入
document.querySelectorAll('.skill-buy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id   = btn.dataset.skill;
    const cost = parseInt(btn.dataset.cost, 10);
    if (getOwned()[id]) return;
    if (getCoins() < cost) return;
    spendCoins(cost);
    ownItem(id);
    refreshSkillButtons();
    updateSpecialBtn();
  });
});

document.getElementById('btn-reset-data').addEventListener('click', () => {
  localStorage.setItem('dz_coins', '0');
  localStorage.setItem('dz_owned', '{}');
  localStorage.removeItem('dz_equipped');
  localStorage.removeItem('dz_next_stage');
  localStorage.removeItem('dz_potions');
  localStorage.removeItem('dz_training_level');
  localStorage.removeItem('dz_enhance');
  localStorage.removeItem('dz_player_name');
  homeScene.setPlayerName(null);
  potions = 0;
  trainingLevel = 0;
  forgeActive = false;
  forgeWeapon = null;
  stopTraining();
  updateCoinDisplay();
  refreshShopButtons();
  refreshSkillButtons();
  updatePotionBtn();
  updateSpecialBtn();
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

// ─── 強化ボーナス (localStorage) ──────────────────────────
function getEnhanceBonuses() {
  try { return JSON.parse(localStorage.getItem('dz_enhance') || '{}'); } catch { return {}; }
}
function getEnhanceBonus(weaponType) {
  return getEnhanceBonuses()[weaponType] ?? 0;
}
function addEnhanceBonus(weaponType) {
  const b = getEnhanceBonuses();
  b[weaponType] = (b[weaponType] ?? 0) + 1;
  localStorage.setItem('dz_enhance', JSON.stringify(b));
}

// ─── ホーム画面 近接ボタン ────────────────────────────────
const shopEnterBtn   = document.getElementById('btn-home-shop-enter');
const battleEnterBtn = document.getElementById('btn-home-battle-enter');
const trainEnterBtn  = document.getElementById('btn-home-train-enter');
const trainStopBtn   = document.getElementById('btn-home-train-stop');
const forgeEnterBtn  = document.getElementById('btn-home-forge-enter');
const mypageEnterBtn = document.getElementById('btn-home-mypage-enter');
const endlessEnterBtn = document.getElementById('btn-home-endless-enter');
const trainTimerEl   = document.getElementById('home-train-timer');
const levelupEl      = document.getElementById('home-levelup-popup');
const maxlevelEl     = document.getElementById('home-maxlevel-overlay');
const moveHintEl     = document.getElementById('home-move-hint');
let   moveHintDismissed = false; // 一度動かしたらガイドを消す

shopEnterBtn.addEventListener('click', () => { showShopMenu(); });
battleEnterBtn.addEventListener('click', () => { startBattleFlow(); });
trainEnterBtn.addEventListener('click', () => { startTraining(); });
trainStopBtn.addEventListener('click',  () => { stopTraining(); });
endlessEnterBtn.addEventListener('click', () => { startEndlessMode(); });

// ─── マイページ（自分の名前変更）──────────────────────────────
const PLAYER_NAME_KEY = 'dz_player_name';
function getPlayerName() { return localStorage.getItem(PLAYER_NAME_KEY) || ''; }
function setPlayerNameLS(n) { localStorage.setItem(PLAYER_NAME_KEY, n); }

const mypageOverlay   = document.getElementById('mypage-overlay');
const mypageNameBtn   = document.getElementById('mypage-name-btn');
const mypageExitBtn   = document.getElementById('btn-mypage-exit');
const mypageCurName   = document.getElementById('mypage-current-name');
let   mypageNameTimer = null;
let   inMyPage        = false;

function _spawnMypageLamps() {
  // 既存ランプを消して周囲にランダム配置
  mypageOverlay.querySelectorAll('.mypage-lamp').forEach(el => el.remove());
  const spots = [
    [8, 55], [16, 74], [26, 88], [50, 92], [74, 88], [84, 74], [92, 55],
    [12, 40], [88, 40], [22, 64], [78, 64], [50, 70],
  ];
  for (const [x, y] of spots) {
    const lamp = document.createElement('div');
    lamp.className = 'mypage-lamp';
    lamp.style.left = `${x}%`;
    lamp.style.top  = `${y}%`;
    lamp.style.animationDelay = `${(x * 0.013).toFixed(2)}s`;
    mypageOverlay.appendChild(lamp);
  }
}

function _refreshMypageName() {
  const n = getPlayerName();
  mypageCurName.textContent = n ? `いまの名前: ${n}` : '名前はまだ未設定です';
}

function enterMyPage() {
  inMyPage = true;
  _spawnMypageLamps();
  _refreshMypageName();
  mypageNameBtn.classList.remove('show'); // 3秒後に出す
  mypageOverlay.classList.remove('hidden');
  // 近接ボタンは隠す
  mypageEnterBtn.classList.add('hidden');
  if (mypageNameTimer) clearTimeout(mypageNameTimer);
  mypageNameTimer = setTimeout(() => { mypageNameBtn.classList.add('show'); }, 3000);
}

function exitMyPage() {
  inMyPage = false;
  if (mypageNameTimer) { clearTimeout(mypageNameTimer); mypageNameTimer = null; }
  mypageNameBtn.classList.remove('show');
  mypageOverlay.classList.add('hidden');
}

mypageEnterBtn.addEventListener('click', () => { enterMyPage(); });
mypageExitBtn.addEventListener('click', () => { exitMyPage(); });
mypageNameBtn.addEventListener('click', () => {
  const cur = getPlayerName();
  const input = window.prompt('あたらしい名前を入力してください（16文字まで）', cur);
  if (input === null) return;               // キャンセル
  const name = input.trim().slice(0, 16);
  if (!name) return;
  setPlayerNameLS(name);
  homeScene.setPlayerName(name);            // 頭上ラベル（赤＋黒）を更新
  _refreshMypageName();
});

function startBattleFlow() {
  homeScene.stop();
  homeEl.classList.add('hidden');
  opChoiceEl.classList.remove('hidden');
  state = STATE.OPENING_CHOICE;
  updateCoinDisplay();
}

// ─── エンドレスモード ──────────────────────────────────────────
let isEndless = false;
const endlessCounterEl = document.getElementById('endless-counter');
const ENDLESS_BEST_KEY = 'dz_endless_best';

game.zombies.onEndlessKill = (n) => {
  if (endlessCounterEl) endlessCounterEl.textContent = `撃破 ${n}`;
};

function startEndlessMode() {
  homeScene.stop();
  homeEl.classList.add('hidden');
  showBattleUI();
  applyWeaponBonuses();
  isEndless = true;
  game.startEndless();
  hud.reset();
  hud.setZombies(game.zombies.aliveCount);
  screens.hideAll();
  if (endlessCounterEl) {
    endlessCounterEl.textContent = '撃破 0';
    endlessCounterEl.classList.remove('hidden');
  }
  state = STATE.PLAYING;
  updatePotionBtn();
}

function _showEndlessOver(count) {
  const best    = parseInt(localStorage.getItem(ENDLESS_BEST_KEY) || '0', 10);
  const newBest = count > best;
  if (newBest) localStorage.setItem(ENDLESS_BEST_KEY, String(count));
  const bestShown = Math.max(best, count);

  const el = document.createElement('div');
  el.className = 'screen';
  el.style.zIndex = '60';
  el.innerHTML =
    `<h1 style="color:#ff5a5a;">ゲームオーバー</h1>` +
    (newBest ? `<div class="endless-best">★ 最高記録 ★</div>` : '') +
    `<div class="big">あなたの記録は ${count}回目です</div>` +
    `<div class="result">最高記録：${bestShown}回</div>` +
    `<div class="clear-btns">` +
    `<button class="btn btn-orange" id="endless-retry">もう一度</button>` +
    `<button class="btn btn-teal" id="endless-home">ホームに戻る</button>` +
    `</div>`;
  document.body.appendChild(el);

  el.querySelector('#endless-retry').addEventListener('click', () => {
    el.remove();
    startEndlessMode();
  });
  el.querySelector('#endless-home').addEventListener('click', () => {
    el.remove();
    isEndless = false;
    showHome();
  });
}

// ─── 修行システム ─────────────────────────────────────────
const TRAINING_TIMES = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21]; // 各レベルの修行時間(秒)
const MAX_TRAINING_LEVEL = 10;

let trainingActive = false;
let trainingLevel  = parseInt(localStorage.getItem('dz_training_level') || '0', 10);
let trainingTimer  = 0;

function getTrainingBonus() {
  return parseInt(localStorage.getItem('dz_training_level') || '0', 10) * 0.2;
}

function startTraining() {
  if (trainingLevel >= MAX_TRAINING_LEVEL) return;
  trainingActive = true;
  trainingTimer  = TRAINING_TIMES[trainingLevel];
  homeScene.setSitting(true);
  trainEnterBtn.classList.add('hidden');
  trainStopBtn.classList.remove('hidden');
  trainTimerEl.classList.remove('hidden');
  _updateTrainTimer();
}

function stopTraining() {
  trainingActive = false;
  homeScene.setSitting(false);
  trainStopBtn.classList.add('hidden');
  trainTimerEl.classList.add('hidden');
}

function _updateTrainTimer() {
  const lv  = trainingLevel + 1;
  const sec = Math.ceil(trainingTimer);
  trainTimerEl.textContent = `Lv${lv} まで あと ${sec}秒`;
}

function _onTrainingLevelUp() {
  trainingLevel++;
  localStorage.setItem('dz_training_level', String(trainingLevel));

  if (trainingLevel >= MAX_TRAINING_LEVEL) {
    // レベル10 MAX！激しいエフェクト
    stopTraining();
    _showMaxLevelEffect();
  } else {
    // 通常レベルアップ → 次のレベルへ続行
    trainingTimer = TRAINING_TIMES[trainingLevel];
    _showLevelUp(trainingLevel);
  }
}

function _showLevelUp(lv) {
  levelupEl.textContent = `${lv} レベルアップ！`;
  levelupEl.style.animation = 'none';
  void levelupEl.offsetWidth; // reflow
  levelupEl.style.animation = 'levelupAnim 2.4s forwards';
  levelupEl.classList.remove('hidden');
  setTimeout(() => levelupEl.classList.add('hidden'), 2500);
}

function _showMaxLevelEffect() {
  // 通常のレベルアップ表示
  levelupEl.textContent = '10 レベルアップ！';
  levelupEl.style.animation = 'none';
  void levelupEl.offsetWidth;
  levelupEl.style.animation = 'levelupAnim 2.4s forwards';
  levelupEl.classList.remove('hidden');
  setTimeout(() => levelupEl.classList.add('hidden'), 2500);

  // 激しいMAXエフェクト（0.6秒後に表示）
  setTimeout(() => {
    // 星パーティクル生成
    const starsEl = document.getElementById('ml-stars');
    starsEl.innerHTML = '';
    const STAR_CHARS = ['✦', '★', '✧', '✨', '⭐'];
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('span');
      s.className = 'ml-star';
      s.textContent = STAR_CHARS[i % STAR_CHARS.length];
      const angle = (i / 24) * 360;
      const radius = 120 + Math.random() * 140;
      s.style.setProperty('--a', `${angle}deg`);
      s.style.setProperty('--r', `-${radius}px`);
      s.style.setProperty('--dur', `${1.5 + Math.random() * 1.2}s`);
      s.style.animationDelay = `${Math.random() * 0.4}s`;
      starsEl.appendChild(s);
    }
    maxlevelEl.classList.remove('hidden');
    setTimeout(() => maxlevelEl.classList.add('hidden'), 4000);
  }, 600);
}

// ─── 鍛冶屋システム ───────────────────────────────────────
const FORGE_DURATION = 20; // 秒

const forgeOverlay  = document.getElementById('home-forge-overlay');
const forgeGrid     = document.getElementById('forge-weapon-grid');
const forgeOkBtn    = document.getElementById('forge-ok-btn');
const forgeStatusEl = document.getElementById('forge-status-msg');
const forgeTimerEl  = document.getElementById('forge-timer-display');

let forgeActive      = false;
let forgeTimer       = 0;
let forgeWeapon      = null; // 現在強化中の武器種
let forgeSelected    = null; // UIで選択中の武器種

// forgeEnterBtn のクリックで UI を開く
forgeEnterBtn.addEventListener('click', () => { _showForgeUI(); });
document.getElementById('forge-close-btn').addEventListener('click', () => {
  forgeOverlay.classList.add('hidden');
});
forgeOkBtn.addEventListener('click', () => {
  if (!forgeSelected) return;
  _startForge(forgeSelected);
  forgeOverlay.classList.add('hidden');
});

function _showForgeUI() {
  const owned    = getOwned();
  const bonuses  = getEnhanceBonuses();
  const WEAPON_NAMES = {
    copper: '銅の剣', iron: '鉄の剣', diamond: 'ダイヤの剣',
    netherite: 'ネザライト', light: '光の剣', blackhole: 'ブラックホール',
    lightning: 'ライトニング', bubble: 'バブル', inferno: 'インフェルノ', ice: 'アイス',
  };

  forgeGrid.innerHTML = '';
  forgeSelected = null;
  forgeOkBtn.disabled = true;

  if (forgeActive) {
    // 強化中 → タイマー表示モード
    forgeStatusEl.textContent = '強化中です…';
    forgeTimerEl.textContent  = `⏳ 残り ${Math.ceil(forgeTimer)} 秒`;
    forgeOkBtn.style.display  = 'none';
  } else {
    forgeStatusEl.textContent = '強化したい武器を選んでください';
    forgeTimerEl.textContent  = '';
    forgeOkBtn.style.display  = '';

    // 所持武器一覧を表示
    const weaponOrder = ['copper','iron','diamond','netherite','light','blackhole','lightning','bubble','inferno','ice'];
    weaponOrder.forEach(id => {
      if (!owned[id] && id !== 'copper') return; // copper は常に所持
      const bonus = bonuses[id] ?? 0;
      const btn   = document.createElement('button');
      btn.className    = 'forge-weapon-btn';
      btn.dataset.id   = id;
      btn.innerHTML    = `${WEAPON_NAMES[id] ?? id}<div class="forge-weapon-bonus">強化: +${bonus}</div>`;
      btn.addEventListener('click', () => {
        forgeGrid.querySelectorAll('.forge-weapon-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        forgeSelected = id;
        forgeOkBtn.disabled = false;
      });
      forgeGrid.appendChild(btn);
    });
  }

  forgeOverlay.classList.remove('hidden');
}

function _startForge(weaponType) {
  forgeActive = true;
  forgeTimer  = FORGE_DURATION;
  forgeWeapon = weaponType;
}

function _updateForgeTimer(dt) {
  if (!forgeActive) return;
  forgeTimer -= dt;
  if (forgeTimer <= 0) {
    forgeActive = false;
    addEnhanceBonus(forgeWeapon);
    _showForgeComplete(forgeWeapon);
    forgeWeapon = null;
  }
}

const WEAPON_NAMES_SHORT = {
  copper: '銅の剣', iron: '鉄の剣', diamond: 'ダイヤの剣',
  netherite: 'ネザライト', light: '光の剣', blackhole: 'ブラックホール',
  lightning: 'ライトニング', bubble: 'バブル', inferno: 'インフェルノ', ice: 'アイス',
};
function _showForgeComplete(wt) {
  const name = WEAPON_NAMES_SHORT[wt] ?? wt;
  // 既存のレベルアップ通知を流用
  levelupEl.textContent = `⚒️ ${name} 強化完成！`;
  levelupEl.style.animation = 'none';
  void levelupEl.offsetWidth;
  levelupEl.style.animation = 'levelupAnim 2.8s forwards';
  levelupEl.classList.remove('hidden');
  setTimeout(() => levelupEl.classList.add('hidden'), 3000);
}

// ─── ゾンビ管理コールバック ────────────────────────────────
game.zombies.onKill = ({ drops, remaining }) => {
  hud.setDrops(drops);
  hud.setZombies(remaining);
};
game.zombies.onCleared = () => {
  if (state !== STATE.PLAYING) return;
  state = STATE.CLEAR;
  const coinMap = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 250, 6: 300, 7: 350,
                    8: 400, 9: 450, 10: 500, 11: 600, 12: 800 };
  addCoins(coinMap[currentStage] ?? 50);
  // ステージ進行: 1→…→7→8(海)→9(宇宙)→10(毒の森)→11(太陽)→12(真っ白い世界)→全クリ
  const nextMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12 };
  const next = nextMap[currentStage];
  if (next) {
    localStorage.setItem('dz_next_stage', String(next));
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
  // バトルHUDの「特殊技発動」ボタンも同じタイミングで更新
  updateSpecialBtn();
}

// ─── 特殊技 発動UI ────────────────────────────────────────
const specialBtn  = document.getElementById('special-btn');
const specialMenu = document.getElementById('special-menu');
const hyperBtn    = document.getElementById('hyperjump-btn');

function ownedSkills() {
  const o = getOwned();
  return SKILLS.filter(s => o[s.id]);
}

// バトル中かつ所持特殊技があれば「特殊技発動」ボタンを表示
function updateSpecialBtn() {
  const playing = state === STATE.PLAYING;
  if (playing && ownedSkills().length > 0) {
    specialBtn.classList.remove('hidden');
  } else {
    specialBtn.classList.add('hidden');
  }
  if (!playing) {
    specialMenu.classList.add('hidden');
    hyperBtn.classList.add('hidden');
  }
}

// 所持している特殊技を選択メニューに並べる
function buildSpecialMenu() {
  specialMenu.innerHTML = '';
  for (const s of ownedSkills()) {
    const b = document.createElement('button');
    b.className   = 'special-skill-btn';
    b.textContent = s.name;
    b.addEventListener('click', () => {
      activateSkill(s.id);
      specialMenu.classList.add('hidden');
    });
    specialMenu.appendChild(b);
  }
}

function activateSkill(id) {
  if (state !== STATE.PLAYING) return;
  if (id === 'dash') {
    game.player.startDash();
  } else if (id === 'hyperjump') {
    hyperBtn.classList.remove('hidden');
  } else if (id === 'meteor') {
    game.zombies.castMeteor(game.player);
  } else if (id === 'clone') {
    game.player.startClone(game.scene);
  } else if (id === 'ghostarrows') {
    game.zombies.castGhostArrows(game.player);
  } else if (id === 'invisibility') {
    game.player.startInvisibility();
  }
}

specialBtn.addEventListener('click', () => {
  if (specialMenu.classList.contains('hidden')) {
    buildSpecialMenu();
    specialMenu.classList.remove('hidden');
  } else {
    specialMenu.classList.add('hidden');
  }
});

hyperBtn.addEventListener('click', () => {
  if (state !== STATE.PLAYING) return;
  game.player.startHyperJump();
});

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

// ─── NPC再入場通知（ホーム左上・青い四角＋黒枠）─────────────
let _enterNoticeWrap = null;
function showEnterNotice(name) {
  if (!_enterNoticeWrap) {
    _enterNoticeWrap = document.createElement('div');
    Object.assign(_enterNoticeWrap.style, {
      position: 'fixed',
      top:  'calc(64px + env(safe-area-inset-top))',
      left: 'calc(12px + env(safe-area-inset-left))',
      zIndex: '46', pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', gap: '8px',
    });
    document.body.appendChild(_enterNoticeWrap);
  }

  const el = document.createElement('div');
  Object.assign(el.style, {
    background: '#1976d2', color: '#fff',
    border: '3px solid #000', borderRadius: '6px',
    padding: '8px 14px', maxWidth: '72vw',
    fontSize: '14px', textAlign: 'center', lineHeight: '1.3',
    boxShadow: '0 3px 10px rgba(0,0,0,0.45)',
    opacity: '0', transform: 'translateX(-14px)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
  });
  const nameEl = document.createElement('span');
  nameEl.textContent = name;                         // 真ん中に特殊ネーム
  nameEl.style.fontWeight = 'bold';
  nameEl.style.fontSize = '16px';
  el.appendChild(nameEl);
  el.appendChild(document.createTextNode('さんが入ってきました'));

  _enterNoticeWrap.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-14px)'; }, 3600);
  setTimeout(() => el.remove(), 3950);
}
homeScene.onSpecialEnter = showEnterNotice;

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
  if (owned.ice)       return 'ice';        // 2450
  if (owned.inferno)   return 'inferno';    // 2300
  if (owned.bubble)    return 'bubble';     // 2150
  if (owned.lightning) return 'lightning';  // 2000
  if (owned.blackhole) return 'blackhole';
  if (owned.light)     return 'light';
  if (owned.netherite) return 'netherite';
  if (owned.diamond)   return 'diamond';
  if (owned.iron)      return 'iron';
  return 'copper';
}

// ─── バトルUI（攻撃ボタン・HUD）を表示 ───────────────────────
function showBattleUI() {
  document.getElementById('attack-btn').style.display = '';
  // #hud は CSS で display:none。明示的に block にしないと
  // HPゲージ・古びた石・鉄の鉱石・残りゾンビが表示されない。
  document.getElementById('hud').style.display = 'block';
}

// 武器・修行ボーナス・強化ボーナスをまとめて適用
function applyWeaponBonuses() {
  const wt = getBestWeapon();
  game.player.setWeapon(wt);
  game.player.setTrainingBonus(getTrainingBonus());
  game.player.setEnhanceBonus(getEnhanceBonus(wt));
}

// ─── 現在のステージをリトライ（ステージを維持して再挑戦） ──
function retryCurrentStage() {
  showBattleUI();
  applyWeaponBonuses();
  if      (currentStage === 2) game.startStage2();
  else if (currentStage === 3) game.startStage3();
  else if (currentStage === 4) game.startStage4();
  else if (currentStage === 5) game.startStage5();
  else if (currentStage === 6) game.startStage6();
  else if (currentStage === 7) game.startStage7();
  else if (currentStage === 8) game.startStage8();
  else if (currentStage === 9) game.startStage9();
  else if (currentStage === 10) game.startStage10();
  else if (currentStage === 11) game.startStage11();
  else if (currentStage === 12) game.startStage12();
  else                         game.startStage();
  hud.reset();
  hud.setZombies(game.zombies.aliveCount);
  screens.hideAll();
  state = STATE.PLAYING;
  updatePotionBtn();
}

// ─── ステージ1 開始 ────────────────────────────────────────
function startGame() {
  showBattleUI();
  currentStage = 1;
  applyWeaponBonuses();
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
    showBattleUI();
    currentStage = 2;
    game.player.setWeapon(getBestWeapon());
    game.player.setTrainingBonus(getTrainingBonus());
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
    showBattleUI();
    currentStage = 3;
    game.player.setWeapon(getBestWeapon());
    game.player.setTrainingBonus(getTrainingBonus());
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
    showBattleUI();
    currentStage = 4;
    game.player.setWeapon(getBestWeapon());
    game.player.setTrainingBonus(getTrainingBonus());
    game.startStage4();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ5 オープニング → ゲーム開始 ──────────────────
function startStage5Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage5Opening(() => {
    showBattleUI();
    currentStage = 5;
    applyWeaponBonuses();
    game.startStage5();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ6 オープニング → ゲーム開始 ──────────────────
function startStage6Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage6Opening(() => {
    showBattleUI();
    currentStage = 6;
    applyWeaponBonuses();
    game.startStage6();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ7 オープニング → ゲーム開始 ──────────────────
function startStage7Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const op = new Stage7Opening(() => {
    showBattleUI();
    currentStage = 7;
    applyWeaponBonuses();
    game.startStage7();
    hud.reset();
    hud.setZombies(game.zombies.aliveCount);
    state = STATE.PLAYING;
    updatePotionBtn();
  });
  op.start();
}

// ─── ステージ8〜12（追加ステージ）─────────────────────────────
function _beginStage(stageNum, startFn) {
  showBattleUI();
  currentStage = stageNum;
  applyWeaponBonuses();
  startFn();
  hud.reset();
  hud.setZombies(game.zombies.aliveCount);
  state = STATE.PLAYING;
  updatePotionBtn();
}

function startStage8Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  new GenericOpening('海ステージ',
    'radial-gradient(ellipse at 50% 40%, #3aa0e0 0%, #14689f 100%)', '#ffffff',
    () => _beginStage(8, () => game.startStage8()),
    ['「今までのボスが集まってきた…！」', '各ボスが2体ずつ襲いかかる！']).start();
}

function startStage9Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  new GenericOpening('宇宙ステージ',
    'radial-gradient(ellipse at 50% 40%, #1a1740 0%, #05030f 100%)', '#aab4ff',
    () => _beginStage(9, () => game.startStage9()),
    ['「無数の弓矢ゾンビが浮かんでいる…」', '弓矢ゾンビ20体！']).start();
}

function startStage10Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  new GenericOpening('毒の森ステージ',
    'radial-gradient(ellipse at 50% 40%, #4a1f6e 0%, #1d142b 100%)', '#cc88ff',
    () => _beginStage(10, () => game.startStage10()),
    ['「毒の沼から無数のゾンビが…」', '各ゾンビ4体＋でかい紫の象！']).start();
}

function startStage11Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  new GenericOpening('太陽の中ステージ',
    'radial-gradient(ellipse at 50% 40%, #ffcf66 0%, #ff6a00 100%)', '#3a1a00',
    () => _beginStage(11, () => game.startStage11()),
    ['「自分とそっくりな者が現れた…！」', '同じ攻撃力・同じ強さ。ただし特殊技は使わない']).start();
}

// 真っ白い世界は「ボス」選択画面 → 勝負に挑む で開始
function startStage12Opening() {
  screens.hideAll();
  homeEl.classList.add('hidden');
  const challenge = new BossChallenge(
    () => _beginStage(12, () => game.startStage12()),
    () => showHome(),
  );
  challenge.start();
}

// ─── ホーム画面へ（オープニング後・ゲームクリア後） ─────────
function showHome() {
  currentStage = 1;
  state = STATE.HOME;
  isEndless = false;
  if (endlessCounterEl) endlessCounterEl.classList.add('hidden');
  homeEl.classList.remove('hidden');
  hideShop();
  screens.hideAll();
  updateCoinDisplay();
  updatePotionBtn();
  homeScene.setPlayerName(getPlayerName()); // 頭上の名前を反映
  homeScene.start();
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

// ─── ゲームオーバー画面「ホームに戻る」 ──────────────────────
document.getElementById('btn-home-from-over').addEventListener('click', () => {
  showHome();
});

// ─── メインループ ───────────────────────────────────────────
let rafId = null;
let last  = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);

  const move = getMoveInput();

  if (state === STATE.HOME) {
    homeScene.setJoy(move);
    shopEnterBtn.classList.toggle('hidden', !homeScene.nearShop);
    battleEnterBtn.classList.toggle('hidden', !homeScene.nearBattle);

    // 移動ガイド: 一度でも動かしたらフェードアウト
    if (!moveHintDismissed && Math.hypot(move.x, move.y) > 0.05) {
      moveHintDismissed = true;
      if (moveHintEl) moveHintEl.classList.add('used');
    }

    // 修行ボタン: 近くにいて修行中でなければ表示（MAX到達済みなら非表示）
    const canTrain = homeScene.nearTraining && !trainingActive && trainingLevel < MAX_TRAINING_LEVEL;
    trainEnterBtn.classList.toggle('hidden', !canTrain);

    // 鍛冶屋ボタン: 近くにいて強化中でなければ表示
    forgeEnterBtn.classList.toggle('hidden', !homeScene.nearBlacksmith);

    // マイページボタン: 家に近づくと表示（室内にいる間は隠す）
    mypageEnterBtn.classList.toggle('hidden', !(homeScene.nearMyPage && !inMyPage));

    // エンドレス火山ボタン
    endlessEnterBtn.classList.toggle('hidden', !homeScene.nearEndless);

    // 修行タイマー更新
    if (trainingActive) {
      trainingTimer -= dt;
      _updateTrainTimer();
      if (trainingTimer <= 0) _onTrainingLevelUp();
    }

    // 鍛冶屋タイマー更新
    _updateForgeTimer(dt);
  } else if (state === STATE.PLAYING) {
    game.update(dt, move);
    hud.setHP(game.player.hp);
    hud.setZombies(game.zombies.aliveCount);
    hud.setBossHP(game.zombies.bossHPFraction);

    // キーボードアクション（PCのみ）
    if (keyboard.consumeJustPressed('KeyA')) {
      game.player.tryAttack();
    }
    if (keyboard.consumeJustPressed('KeyK')) {
      if (potions > 0) {
        potions--;
        localStorage.setItem('dz_potions', String(potions));
        game.player.hp = Math.min(100, (game.player.hp || 0) + 50);
        hud.setHP(game.player.hp);
        updatePotionBtn();
      }
    }
    if (keyboard.consumeJustPressed('KeyT')) {
      if (specialMenu.classList.contains('hidden')) {
        buildSpecialMenu();
        specialMenu.classList.remove('hidden');
      } else {
        specialMenu.classList.add('hidden');
      }
    }

    if (!game.player.alive) {
      state = STATE.OVER;
      updatePotionBtn();
      if (isEndless) {
        endlessCounterEl.classList.add('hidden');
        _showEndlessOver(game.zombies.endlessCount);
      } else {
        screens.showOver(game.zombies.drops);
      }
    }
    game.render();
  } else {
    game.update(0, { x: 0, y: 0 });
    game.render();
  }
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
  startStage5Opening,
  startStage6Opening,
  startStage7Opening,
  startStage8Opening,
  startStage9Opening,
  startStage10Opening,
  startStage11Opening,
  startStage12Opening,
  pauseLoop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
  resumeLoop() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); } },
};

// ─── モバイル: 実ビューポート高を CSS 変数に反映 ───────────
// iOS/Android のツールバー伸縮・回転で全画面オーバーレイが
// ずれないよう、visualViewport の高さを --app-height に同期する。
function _syncAppHeight() {
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
}
_syncAppHeight();
window.addEventListener('resize', _syncAppHeight);
window.addEventListener('orientationchange', _syncAppHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', _syncAppHeight);
}

// ─── 起動 ─────────────────────────────────────────────────
document.getElementById('loading').style.display = 'none';
updateCoinDisplay();
homeScene.setPlayerName(getPlayerName()); // 保存済みの名前を頭上に反映
homeScene.start();
rafId = requestAnimationFrame(loop);
