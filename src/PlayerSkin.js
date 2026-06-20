// 主人公（自分）のランダム服装。ホーム/バトルで共通になるよう
// ページ読み込みごとに1回だけ抽選してキャッシュする。
// 髪型は全員イケメン風の茶色で固定。
import { COLORS } from './core/Constants.js';

const HAIR_COLOR = 0x4a2f17;       // イケメン風の茶色
const HAIR_STYLE = 'naturalShort'; // イケメン風のナチュラルショート

const OUTFITS = [
  {
    // 黄色と黒が混ざったTシャツ／青いデニムのズボン／茶色いナイキの靴
    cloth: 0xf2c200, clothPattern: 0x141414,
    sleeve: 'short',
    legwear: 'pants', pants: 0x2647c8,
    shoes: { type: 'nike', color: 0x6d4c41, accent: 0xffffff },
  },
  {
    // 赤い長袖／黒い半ズボン／青い長靴
    cloth: 0xd32f2f,
    sleeve: 'long',
    legwear: 'shorts', pants: 0x141414,
    shoes: { type: 'boots', color: 0x1565c0 },
  },
  {
    // オレンジTシャツに青い手袋／青と黄色が混ざった模様の半ズボン／白い長靴
    cloth: 0xff7a00,
    sleeve: 'short', gloves: 0x1565c0,
    legwear: 'shorts', pants: 0x1565c0, pantsPattern: 0xf2c200,
    shoes: { type: 'boots', color: 0xffffff },
  },
];

let _cached = null;

// buildHumanoid にそのまま渡せる外見オプションを返す
export function getPlayerOutfit() {
  if (!_cached) {
    const o = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
    _cached = {
      skin:         COLORS.PLAYER_SKIN,
      cloth:        o.cloth,
      clothPattern: o.clothPattern ?? null,
      pants:        o.pants,
      pantsPattern: o.pantsPattern ?? null,
      pantsAccent:  null,
      hairColor:    HAIR_COLOR,
      hairStyle:    HAIR_STYLE,
      sleeve:       o.sleeve,
      legwear:      o.legwear,
      gloves:       o.gloves ?? null,
      shoes:        o.shoes,
      face:         'player',
    };
  }
  return _cached;
}
