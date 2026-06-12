// 共通マテリアル生成ヘルパ。ローポリ調なのでフラット気味のLambert/Standardを使う。
import * as THREE from 'three';

const cache = new Map();

// 単色マテリアル（同色は使い回してドローコール/生成を節約）
export function flat(color, opts = {}) {
  const key = `${color}-${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.0,
    flatShading: opts.flatShading ?? false,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
  });
  cache.set(key, mat);
  return mat;
}

// 金属（剣の刃など）。キャッシュしない（個体で色変化させる場合に備え）
export function metal(color) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.45, metalness: 0.7,
  });
}
