// 主人公（自分）の服装。洋服屋さんで着せ替えした内容(dz_outfit)があれば
// それを使い、無ければ起動ごとにランダムな初期服を1回だけ抽選する。
// 髪型はイケメン風の茶色で固定（着せ替え不可）。
import { COLORS } from './core/Constants.js';

const HAIR_COLOR = 0x4a2f17;       // イケメン風の茶色
const HAIR_STYLE = 'naturalShort';

// 体（上半身）をタップで切り替わる12種：長袖6色 → 半袖6色
export const BODY_OPTIONS = [
  { color: 0xd32f2f, sleeve: 'long' },  // 赤い長袖
  { color: 0x1565c0, sleeve: 'long' },  // 青い長袖
  { color: 0xf2c200, sleeve: 'long' },  // 黄色い長袖
  { color: 0x141414, sleeve: 'long' },  // 黒い長袖
  { color: 0xff80ab, sleeve: 'long' },  // ピンクの長袖
  { color: 0xff7a00, sleeve: 'long' },  // オレンジの長袖
  { color: 0xd32f2f, sleeve: 'short' }, // 赤い半袖
  { color: 0x1565c0, sleeve: 'short' }, // 青い半袖
  { color: 0xf2c200, sleeve: 'short' }, // 黄色い半袖
  { color: 0x141414, sleeve: 'short' }, // 黒い半袖
  { color: 0xff80ab, sleeve: 'short' }, // ピンクの半袖
  { color: 0xff7a00, sleeve: 'short' }, // オレンジの半袖
];

// 足（下半身）をタップで切り替わる8種：長ズボンの色
export const LEG_OPTIONS = [
  0xd32f2f, // 赤
  0x1565c0, // 青
  0xf2c200, // 黄
  0x141414, // 黒
  0xff80ab, // ピンク
  0x6a1b9a, // 紫
  0xff7a00, // オレンジ
  0x2e7d32, // 緑
];

const OUTFITS = [
  { cloth: 0xf2c200, clothPattern: 0x141414, sleeve: 'short',
    legwear: 'pants', pants: 0x2647c8, shoes: { type: 'nike', color: 0x6d4c41, accent: 0xffffff } },
  { cloth: 0xd32f2f, sleeve: 'long',
    legwear: 'shorts', pants: 0x141414, shoes: { type: 'boots', color: 0x1565c0 } },
  { cloth: 0xff7a00, sleeve: 'short', gloves: 0x1565c0,
    legwear: 'shorts', pants: 0x1565c0, pantsPattern: 0xf2c200, shoes: { type: 'boots', color: 0xffffff } },
];

let _cached = null;

// 着せ替えデータ（{bodyIdx, legIdx}）の取得・保存
export function getOutfitIndices() {
  try {
    const o = JSON.parse(localStorage.getItem('dz_outfit') || 'null');
    if (o && typeof o.bodyIdx === 'number' && typeof o.legIdx === 'number') return o;
  } catch (_) {}
  return null;
}
export function setOutfitIndices(bodyIdx, legIdx) {
  localStorage.setItem('dz_outfit', JSON.stringify({ bodyIdx, legIdx }));
}
// 未設定なら初期化（{0,0}＝赤い長袖＋赤い長ズボン）
export function ensureOutfit() {
  let ix = getOutfitIndices();
  if (!ix) { ix = { bodyIdx: 0, legIdx: 0 }; setOutfitIndices(0, 0); }
  return ix;
}
export function cycleOutfitBody() {
  const ix = ensureOutfit();
  ix.bodyIdx = (ix.bodyIdx + 1) % BODY_OPTIONS.length;
  setOutfitIndices(ix.bodyIdx, ix.legIdx);
  return ix;
}
export function cycleOutfitLegs() {
  const ix = ensureOutfit();
  ix.legIdx = (ix.legIdx + 1) % LEG_OPTIONS.length;
  setOutfitIndices(ix.bodyIdx, ix.legIdx);
  return ix;
}

// buildHumanoid にそのまま渡せる外見オプションを返す
export function getPlayerOutfit() {
  const ix = getOutfitIndices();
  if (ix) {
    const b = BODY_OPTIONS[ix.bodyIdx] || BODY_OPTIONS[0];
    const pants = LEG_OPTIONS[ix.legIdx] ?? LEG_OPTIONS[0];
    return {
      skin:         COLORS.PLAYER_SKIN,
      cloth:        b.color,
      clothPattern: null,
      pants,
      pantsPattern: null,
      pantsAccent:  null,
      hairColor:    HAIR_COLOR,
      hairStyle:    HAIR_STYLE,
      sleeve:       b.sleeve,
      legwear:      'pants',
      gloves:       null,
      shoes:        { type: 'normal', color: 0x3a3a3a },
      face:         'player',
    };
  }
  // 着せ替え未設定 → ランダム初期服（起動中はキャッシュ）
  if (!_cached) {
    const o = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
    _cached = {
      skin: COLORS.PLAYER_SKIN, cloth: o.cloth, clothPattern: o.clothPattern ?? null,
      pants: o.pants, pantsPattern: o.pantsPattern ?? null, pantsAccent: null,
      hairColor: HAIR_COLOR, hairStyle: HAIR_STYLE, sleeve: o.sleeve, legwear: o.legwear,
      gloves: o.gloves ?? null, shoes: o.shoes, face: 'player',
    };
  }
  return _cached;
}
