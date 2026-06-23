// ダンジョンZ — 全ゲームパラメータの一元管理
// 数値はここで調整する。

export const PLAYER = {
  MAX_HP: 100,
  MOVE_SPEED: 5.2,        // m/s
  TURN_SPEED: 12,         // 向き補間の速さ
  RADIUS: 0.5,            // 衝突半径
  HEIGHT: 1.8,
};

export const SWORD = {
  RANGE: 2.6,            // 通常攻撃が届く距離(m)
  ARC: Math.PI * 0.7,    // 攻撃判定の左右角度(ラジアン)
};

// 特殊技パラメータ
export const SPECIAL = {
  // ダッシュ
  DASH_DURATION: 5,      // 効果時間(秒)
  DASH_MULT: 2,          // 移動速度倍率

  // ハイパージャンプ
  JUMP_RISE_TIME: 2,     // 上昇にかける時間(秒)
  JUMP_HEIGHT: 8,        // 最高到達高度(m)
  JUMP_GRAVITY: 22,      // 落下加速度
  JUMP_LAND_DAMAGE: 0.5, // 着地ダメージ

  // 隕石投げ
  METEOR_COUNT: 2,       // 同時に降らせる数（近いゾンビ順）
  METEOR_FREEZE: 2,      // 着弾後、蒸発するまでの硬直(秒)
  METEOR_LIFE: 10,       // 着弾後、崩れて消えるまで(秒)
  METEOR_SIZE: 0.9,      // 隕石半径（直径=プレイヤー身長相当）
  METEOR_SPAWN_Y: 13,    // 出現高度
  METEOR_FALL_GRAVITY: 30,

  // インフェルノソード
  INFERNO_ARROW_COUNT: 122,
  INFERNO_RADIUS: 28,

  // 分身
  CLONE_COUNT: 3,
  CLONE_HP: 30,
  CLONE_ATTACK_RANGE: 3.5,
  CLONE_ATTACK_COOLDOWN: 1.5,
  CLONE_MOVE_SPEED: 4.0,
  CLONE_DAMAGE: 20,

  // 爆無闇死矢
  GHOST_COUNT: 2,
  GHOST_ARROW_COUNT: 5,
  GHOST_RADIUS: 15,

  // 透明化
  INVIS_DURATION: 5.0,
};

// 武器種別定義
export const WEAPONS = {
  copper: {
    name: 'ボロボロの銅の剣',
    damage: 20, aoe: false,
    bladeColor: 0xb87333, guardColor: 0x4a3525, glowColor: null,
  },
  iron: {
    name: '鉄の剣',
    damage: 20, aoe: false,
    bladeColor: 0xd4d4d4, guardColor: 0x909090, glowColor: null,
  },
  diamond: {
    name: 'ダイヤの剣',
    damage: 40, aoe: false,
    bladeColor: 0x26c6da, guardColor: 0x00acc1, glowColor: 0x003a4a,
  },
  netherite: {
    name: 'ネザライトの剣',
    damage: 40, aoe: true,
    bladeColor: 0x8845b5, guardColor: 0x2d1640, glowColor: 0x280040,
  },
  light: {
    name: '光の剣',
    damage: 40, aoe: false,
    bladeColor: 0xFFD700, guardColor: 0xB8860B, glowColor: 0xFFEE00,
  },
  blackhole: {
    name: 'ブラックホールソード',
    damage: 35, aoe: true,
    bladeColor: 0x111111, guardColor: 0x220033, glowColor: 0x6600bb,
  },
  lightning: {
    name: 'ライトニングソード',
    damage: 40, aoe: false,
    bladeColor: 0x111100, guardColor: 0x333300, glowColor: 0xFFFF00,
  },
  bubble: {
    name: 'バブルソード',
    damage: 45, aoe: true,
    bladeColor: 0x40e0d0, guardColor: 0x008b8b, glowColor: 0x00ced1,
  },
  inferno: {
    name: 'インフェルノソード',
    damage: 50, aoe: true,
    bladeColor: 0xff4500, guardColor: 0x8b0000, glowColor: 0xff6600,
  },
  ice: {
    name: 'アイスソード',
    damage: 45, aoe: true,
    bladeColor: 0xadd8e6, guardColor: 0x4682b4, glowColor: 0x87ceeb,
  },
};

export const ZOMBIE = {
  MAX_HP: 40,            // 銅の剣(20)で2撃（3発目までに確実に倒せる）
  MOVE_SPEED: 2.2,       // m/s（主人公より遅い）
  RADIUS: 0.5,
  ATTACK_DAMAGE: 5,      // 主人公HP100 → 20回で死亡
  ATTACK_RANGE: 1.5,     // この距離まで近づくと攻撃
  ATTACK_COOLDOWN: 1.2,  // 攻撃間隔(秒)
  HIT_STUN: 0.25,        // 被弾でのけぞる時間(秒)
};

export const STAGE = {
  NAME: 'ゾンビの森',
  ZOMBIE_COUNT: 3,
  RADIUS: 38,            // プレイエリア半径(m)
  TREE_COUNT: 70,
  // ドロップ確率（合計は1.0でなくてよい。各素材を独立抽選）
  DROP: {
    STONE: 0.60,         // 古びた石 60%
    ORE: 0.40,           // 鉄の鉱石 40%
  },
};

export const BOSS = {
  HP: 130,
  MOVE_SPEED: 2.0,
  ATTACK_RANGE: 3.4,
  ATTACK_DAMAGE: 12,
  ATTACK_COOLDOWN: 2.0,
  WEAPON_DAMAGE: {
    copper: 10, iron: 13, diamond: 19, netherite: 44,
    light: 44, blackhole: 44, lightning: 44,
  },
};

export const STAGE2 = {
  NAME: '石バイオーム',
  ZOMBIE_COUNT: 5,
  RADIUS: 38,
  DROP: { STONE: 0.65, ORE: 0.50 },
};

export const MINI_ZOMBIE = {
  MAX_HP: 40,
  MOVE_SPEED: 3.6,
  RADIUS: 0.35,
  ATTACK_DAMAGE: 5,
  ATTACK_RANGE: 1.2,
  ATTACK_COOLDOWN: 1.2,
  HIT_STUN: 0.25,
  SCALE: 0.55,
};

export const PURPLE_ZOMBIE = {
  MAX_HP: 10,
  MOVE_SPEED: 2.8,
  RADIUS: 0.5,
  ATTACK_DAMAGE: 25,
  ATTACK_RANGE: 1.5,
  ATTACK_COOLDOWN: 1.2,
  HIT_STUN: 0.25,
};

export const STAGE3 = {
  NAME: '溶岩バイオーム',
  ZOMBIE_COUNT: 6,
  MINI_ZOMBIE_COUNT: 2,
  RADIUS: 38,
  DROP: { STONE: 0.60, ORE: 0.50 },
};

export const STAGE4 = {
  NAME: '砂漠バイオーム',
  ZOMBIE_COUNT: 5,
  MINI_ZOMBIE_COUNT: 5,
  RADIUS: 38,
  DROP: { STONE: 0.55, ORE: 0.45 },
};

export const STAGE5 = {
  NAME: '氷のバイオーム',
  ZOMBIE_COUNT: 2,
  MINI_ZOMBIE_COUNT: 10,
  RADIUS: 38,
  DROP: { STONE: 0.50, ORE: 0.50 },
};

export const STAGE6 = {
  NAME: '魔界バイオーム',
  PURPLE_COUNT: 3,
  RADIUS: 38,
  DROP: { STONE: 0.45, ORE: 0.55 },
};

export const STAGE7 = {
  NAME: '天国バイオーム',
  ARCHER_COUNT: 1,
  MINI_ZOMBIE_COUNT: 2,
  RADIUS: 38,
  DROP: { STONE: 0.40, ORE: 0.60 },
};

export const ARCHER_ZOMBIE = {
  MAX_HP: 50,
  MOVE_SPEED: 2.0,
  RADIUS: 0.5,
  ATTACK_DAMAGE: 1.5,
  ATTACK_RANGE: 15,
  ATTACK_COOLDOWN: 2.0,
  HIT_STUN: 0.25,
  ARROW_SPEED: 14,
  ARROW_LIFE: 3.0,
  HIT_RADIUS: 0.7,
};

// でかい紫色の象（紫の瞳ゾンビの1.5倍強い）
export const PURPLE_ELEPHANT = {
  MAX_HP: 15,            // 紫ゾンビ(10)の1.5倍。1ダメージ制限あり＝15発必要
  MOVE_SPEED: 2.0,
  RADIUS: 1.2,
  ATTACK_DAMAGE: 37,     // 紫ゾンビ(25)の約1.5倍
  ATTACK_RANGE: 2.6,
  ATTACK_COOLDOWN: 1.5,
  HIT_STUN: 0.2,
  SCALE: 1.8,
};

// 太陽の中ステージ：自分と同じスキン・攻撃力のエンティティ
export const SUN_ENTITY = {
  MAX_HP: 100,           // 自分と同じ強さ
  MOVE_SPEED: 4.2,
  RADIUS: 0.5,
  ATTACK_RANGE: 2.4,
  ATTACK_COOLDOWN: 1.0,
  HIT_STUN: 0.18,
};

// 追加ステージ 8〜12
export const STAGE8 = {
  NAME: '海ステージ',
  RADIUS: 38,
  BOSS_EACH: 2,          // イノシシ/紫瞳/紫象 を各2体
  DROP: { STONE: 0.4, ORE: 0.6 },
};
export const STAGE9 = {
  NAME: '宇宙ステージ',
  ARCHER_COUNT: 20,
  RADIUS: 40,
  DROP: { STONE: 0.4, ORE: 0.6 },
};
export const STAGE10 = {
  NAME: '毒の森ステージ',
  EACH: 4,               // 各ゾンビ4体ずつ
  ELEPHANT_COUNT: 1,
  RADIUS: 40,
  DROP: { STONE: 0.4, ORE: 0.6 },
};
export const STAGE11 = {
  NAME: '太陽の中ステージ',
  ENTITY_COUNT: 2,
  RADIUS: 36,
  DROP: { STONE: 0.4, ORE: 0.6 },
};
export const STAGE12 = {
  NAME: '真っ白い世界',
  WAVE1_EACH: 1,         // イノシシ/紫瞳/紫象 を各1体
  WAVE2_ELEPHANTS: 3,    // 最後に紫象3体
  RADIUS: 38,
  DROP: { STONE: 0.3, ORE: 0.7 },
};

export const COLORS = {
  GROUND: 0x2f4a25,
  FOG: 0x33502f,
  SKY: 0x4a6b3f,
  PLAYER_SKIN: 0xe8c49a,      // 白人男性肌色
  PLAYER_CLOTH: 0x111111,     // 黒Tシャツ
  PLAYER_PANTS: 0x3355bb,     // 青デニム
  PLAYER_PANTS_DARK: 0x243a88,// デニム破れ影色
  PLAYER_HAIR: 0x2a180a,      // 暗い茶髪
  ZOMBIE_SKIN: 0x8aac78,
  ZOMBIE_SKIN_DARK: 0x5a7848,
  ZOMBIE_CLOTH: 0x4a3c2c,
  ZOMBIE_PANTS: 0x383030,
  SWORD_BLADE: 0xb87333,
  SWORD_HILT: 0x4a3525,
  TREE_TRUNK: 0x5c3d1e,       // リアルな樹皮
  TREE_TRUNK_DARK: 0x3a2410,  // 樹皮の影
  TREE_LEAF: 0x1e4a15,        // 深い森の緑
  TREE_LEAF2: 0x2d6020,       // 中間緑
  TREE_LEAF3: 0x3d7828,       // 明るい緑
  TREE_LEAF4: 0x4a6818,       // 黄緑
  GROUND: 0x243818,
  GROUND_PATCH: 0x2e4820,
  ROCK: 0x787068,
};
